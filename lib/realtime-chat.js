const { ObjectId } = require('mongodb');
const { adminRoleOf } = require('./admin-rbac');
const { featureDecision } = require('./subscription-plans');
const { normalizeAiChatRequest } = require('./ai-chat');

const CHAT_WINDOW_MS = 10 * 60 * 1000;
const CHAT_LIMIT = 20;
const HISTORY_PAGE_SIZE = 50;

function rolesForUser(user) {
  const adminRole = adminRoleOf(user);
  const roles = adminRole === 'superadmin' ? ['admin', 'teacher']
    : adminRole === 'editor' ? ['teacher']
    : adminRole === 'support' ? []
    : [user.role];
  return { adminRole, roles };
}

function lessonRoomName(meetingId) {
  return `lesson:${meetingId}`;
}

function roomIdFromPayload(payload) {
  return typeof payload === 'string' ? payload : payload?.roomId;
}

function attachRealtimeChat(io, {
  sessionMiddleware,
  sessionStore,
  UserModel,
  SystemConfigModel,
  isSubscriptionRequired,
  getActiveCollection,
  ChatMessageModel,
  LessonAttendanceModel,
  generateReply
}) {
  const usageByUser = new Map();
  io.engine.use(sessionMiddleware);

  async function loadAuthorizedUser(userId) {
    if (!userId) {
      const error = new Error('Giriş yapmanız gerekiyor.');
      error.status = 401;
      throw error;
    }

    const user = await UserModel.findById(userId)
      .select('name role adminRole restricted subscriptionStatus subscriptionPlan expiresAt');
    if (!user || user.restricted) {
      const error = new Error(user?.restricted
        ? 'Hesabınız yönetici tarafından kısıtlanmıştır.'
        : 'Hesap bulunamadı. Yeniden giriş yapın.');
      error.status = user?.restricted ? 403 : 401;
      throw error;
    }

    const { adminRole, roles } = rolesForUser(user);
    if (!roles.some(role => ['student', 'teacher', 'admin'].includes(role))) {
      const error = new Error('Bu işlem için yetkiniz yok.');
      error.status = 403;
      throw error;
    }

    return {
      record: user,
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      adminRole,
      roles
    };
  }

  async function loadSessionUser(socket) {
    const sessionId = socket.request.sessionID;
    if (!sessionId) {
      const error = new Error('Giriş oturumu sona erdi. Yeniden giriş yapın.');
      error.status = 401;
      throw error;
    }

    const storedSession = await new Promise((resolve, reject) => {
      sessionStore.get(sessionId, (error, value) => {
        if (error) {
          error.status = 503;
          reject(error);
        } else {
          resolve(value);
        }
      });
    });
    const userId = storedSession?.user?.id;
    if (!userId || userId !== socket.data.user.id) {
      const error = new Error('Giriş oturumu sona erdi. Yeniden giriş yapın.');
      error.status = 401;
      throw error;
    }
    return loadAuthorizedUser(userId);
  }

  async function ensureFeatureAccess(user, feature) {
    if (!user.roles.includes('student')) return;
    const subscriptionRequired = isSubscriptionRequired
      ? await isSubscriptionRequired()
      : (await SystemConfigModel.getVisitorSettings()).subscriptionRequired;
    if (!subscriptionRequired) return;
    const decision = featureDecision(user.record, feature);
    if (!decision.izin) {
      const error = new Error('Bu özellik için aktif aboneliğiniz veya uygun paketiniz olmalıdır.');
      error.status = decision.mevcutPlan ? 403 : 402;
      throw error;
    }
  }

  async function resolveChatContext(socket, requestedRoomId) {
    if (requestedRoomId === undefined) {
      return { roomName: 'assistant', roomId: null };
    }

    const roomId = typeof requestedRoomId === 'string' ? requestedRoomId.trim() : '';
    const roomName = socket.data.lessonRooms.get(roomId);
    if (!roomName) {
      throw Object.assign(new Error('Önce bu canlı ders odasına katılmanız gerekiyor.'), { status: 403 });
    }

    const active = await getActiveCollection().findOne({ _id: 'aktif' });
    if (!active || (active.expiresAt && new Date(active.expiresAt) <= new Date()) ||
        roomName !== lessonRoomName(String(active.meetingId))) {
      socket.data.lessonRooms.delete(roomId);
      await socket.leave(roomName);
      throw Object.assign(new Error('Canlı ders odası artık aktif değil.'), { status: 404 });
    }

    return { roomName: String(active.meetingId), roomId };
  }

  async function loadHistory(userId, roomName, before, limit = HISTORY_PAGE_SIZE) {
    const query = { userId };
    if (roomName) query.roomName = roomName;
    if (before) {
      query.$or = [
        { createdAt: { $lt: before.createdAt } },
        { createdAt: before.createdAt, _id: { $lt: before.id } }
      ];
    }
    const records = await ChatMessageModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    records.reverse();
    return {
      messages: records.map(record => ({
        id: String(record._id),
        roomName: record.roomName,
        sender: record.sender,
        message: record.message,
        createdAt: record.createdAt
      })),
      hasMore,
      nextBefore: hasMore && records.length
        ? { createdAt: records[0].createdAt, id: String(records[0]._id) }
        : null
    };
  }

  function consumeChatQuota(userId) {
    const now = Date.now();
    let usage = usageByUser.get(userId);
    if (!usage || usage.resetAt <= now) {
      usage = { count: 0, resetAt: now + CHAT_WINDOW_MS };
      usageByUser.set(userId, usage);
    }
    if (usage.count >= CHAT_LIMIT) return false;
    usage.count += 1;
    if (usageByUser.size > 10000) {
      for (const [id, entry] of usageByUser) {
        if (entry.resetAt <= now) usageByUser.delete(id);
      }
    }
    return true;
  }

  io.use(async (socket, next) => {
    try {
      const sessionUser = socket.request.session?.user;
      const sessionUserId = sessionUser?.id;
      if (!sessionUserId) {
        throw Object.assign(new Error('Giriş yapmanız gerekiyor.'), { status: 401 });
      }
      if (!['student', 'teacher', 'admin'].includes(sessionUser.role)) {
        throw Object.assign(new Error('Bu işlem için yetkiniz yok.'), { status: 403 });
      }
      const user = await loadAuthorizedUser(sessionUserId);
      if (user.role !== sessionUser.role) {
        throw Object.assign(new Error('Hesap rolü doğrulanamadı.'), { status: 401 });
      }
      socket.data.user = user;
      next();
    } catch (error) {
      const authError = new Error(error.message || 'Oturum doğrulanamadı.');
      authError.data = { status: error.status || 500 };
      next(authError);
    }
  });

  io.on('connection', socket => {
    const privateRoom = `user:${socket.data.user.id}`;
    socket.data.lessonRooms = new Map();
    socket.join(privateRoom);

    socket.on('join-room', async (payload, acknowledge) => {
      try {
        const requestedRoomId = typeof payload === 'string'
          ? payload.trim()
          : typeof payload?.roomId === 'string' ? payload.roomId.trim() : '';
        if (!requestedRoomId || requestedRoomId.length > 128) {
          throw Object.assign(new Error('Geçersiz canlı ders odası.'), { status: 400 });
        }
        const user = await loadSessionUser(socket);
        await ensureFeatureAccess(user, 'canli');
        const active = await getActiveCollection().findOne({ _id: 'aktif' });
        const meetingId = active?.meetingId ? String(active.meetingId) : '';
        const meetingNumber = active?.meetingNumber ? String(active.meetingNumber) : meetingId;
        if (!active || (active.expiresAt && new Date(active.expiresAt) <= new Date()) ||
            ![meetingId, meetingNumber].includes(requestedRoomId)) {
          throw Object.assign(new Error('Aktif canlı ders odası bulunamadı.'), { status: 404 });
        }

        const roomName = lessonRoomName(meetingId);
        if (socket.data.user.roles.includes('student')) {
          const joinedAt = new Date();
          await LessonAttendanceModel.updateOne({
            studentId: socket.data.user.id,
            meetingId
          }, {
            $setOnInsert: {
              title: String(active.topic || 'Canlı ders'),
              firstJoinedAt: joinedAt
            },
            $set: { lastJoinedAt: joinedAt },
            $inc: { joinCount: 1 }
          }, { upsert: true });
        }
        await socket.join(roomName);
        socket.data.lessonRooms.set(requestedRoomId, roomName);
        const history = await loadHistory(
          socket.data.user.id,
          meetingId,
          null,
          20
        );
        const result = { success: true, roomId: requestedRoomId, ...history };
        if (typeof acknowledge === 'function') acknowledge(result);
      } catch (error) {
        if (error.status >= 500 || !error.status) console.error('Socket.IO oda katılımı hatası:', error);
        if (typeof acknowledge === 'function') {
          acknowledge({ success: false, status: error.status || 500, error: error.message });
        }
      }
    });

    socket.on('leave-room', async (payload, acknowledge) => {
      const roomIdValue = roomIdFromPayload(payload);
      const roomId = typeof roomIdValue === 'string' ? roomIdValue.trim() : '';
      const roomName = socket.data.lessonRooms.get(roomId);
      if (!roomName) {
        if (typeof acknowledge === 'function') {
          acknowledge({ success: false, status: 404, error: 'Katılmış olduğunuz oda bulunamadı.' });
        }
        return;
      }
      await socket.leave(roomName);
      socket.data.lessonRooms.delete(roomId);
      if (typeof acknowledge === 'function') acknowledge({ success: true, roomId });
    });

    socket.on('load-history', async (payload, acknowledge) => {
      try {
        const user = await loadSessionUser(socket);
        const requestedRoomId = roomIdFromPayload(payload);
        const { roomName } = await resolveChatContext(socket, requestedRoomId);
        let before = null;
        if (payload?.before !== undefined) {
          const createdAt = new Date(payload.before?.createdAt);
          const id = payload.before?.id;
          if (!Number.isFinite(createdAt.getTime()) || !ObjectId.isValid(id)) {
            throw Object.assign(new Error('Geçmiş sayfası için imleç geçersiz.'), { status: 400 });
          }
          before = { createdAt, id: String(id) };
        }
        const history = await loadHistory(user.id, roomName === 'assistant' && requestedRoomId === undefined
          ? null
          : roomName, before);
        if (typeof acknowledge === 'function') acknowledge({ success: true, ...history });
      } catch (error) {
        if (error.status >= 500 || !error.status) console.error('Socket.IO sohbet geçmişi hatası:', error);
        if (typeof acknowledge === 'function') {
          acknowledge({
            success: false,
            status: error.status || 500,
            error: error.message || 'Sohbet geçmişi yüklenemedi.'
          });
        }
      }
    });

    socket.on('delete-history', async (payload, acknowledge) => {
      try {
        const user = await loadSessionUser(socket);
        const { roomName, roomId } = await resolveChatContext(socket, roomIdFromPayload(payload));
        const query = { userId: user.id };
        if (roomId) query.roomName = roomName;
        const result = await ChatMessageModel.deleteMany(query).exec();
        const deleted = { roomName: roomId ? roomName : null, roomId, deletedCount: result.deletedCount || 0 };
        io.to(privateRoom).emit('history-deleted', deleted);
        if (typeof acknowledge === 'function') acknowledge({ success: true, ...deleted });
      } catch (error) {
        if (error.status >= 500 || !error.status) console.error('Socket.IO sohbet geçmişi silme hatası:', error);
        if (typeof acknowledge === 'function') {
          acknowledge({
            success: false,
            status: error.status || 500,
            error: error.message || 'Sohbet geçmişi silinemedi.'
          });
        }
      }
    });

    socket.on('send-message', async (payload, acknowledge) => {
      const requestId = typeof payload?.requestId === 'string' &&
        /^[\w:.-]{1,100}$/.test(payload.requestId)
        ? payload.requestId
        : null;
      const respondWithError = (error, status) => {
        const result = {
          requestId,
          status: status || error.status || 500,
          error: error.message || 'AI Mentör şu anda yanıt veremiyor.'
        };
        socket.emit('chat-error', result);
        if (typeof acknowledge === 'function') acknowledge({ success: false, ...result });
      };

      try {
        if (!requestId) throw Object.assign(new Error('Geçerli requestId gerekli.'), { status: 400 });
        const user = await loadSessionUser(socket);
        await ensureFeatureAccess(user, 'asistan');
        if (!consumeChatQuota(user.id)) {
          throw Object.assign(new Error('Çok fazla istek gönderdiniz. Lütfen birkaç dakika sonra tekrar deneyin.'), {
            status: 429
          });
        }

        const chatRequest = normalizeAiChatRequest(payload);
        const { roomName, roomId } = await resolveChatContext(socket, payload.roomId);
        const userMessage = await ChatMessageModel.create({
          userId: user.id,
          roomName,
          sender: 'user',
          message: chatRequest.ogrenciMesaji
        });
        const yanit = await generateReply(chatRequest);
        const aiMessage = await ChatMessageModel.create({
          userId: user.id,
          roomName,
          sender: 'ai',
          message: yanit
        });
        const result = {
          requestId,
          roomId,
          roomName,
          userMessage: {
            id: String(userMessage._id),
            sender: userMessage.sender,
            message: userMessage.message,
            createdAt: userMessage.createdAt
          },
          aiMessage: {
            id: String(aiMessage._id),
            sender: aiMessage.sender,
            message: aiMessage.message,
            createdAt: aiMessage.createdAt
          },
          yanit
        };
        io.to(privateRoom).emit('receive-message', result);
        if (typeof acknowledge === 'function') acknowledge({ success: true, ...result });
      } catch (error) {
        if (error.status >= 500 || !error.status) console.error('Socket.IO AI sohbet hatası:', error);
        respondWithError(error, error.status);
      }
    });
  });

  return io;
}

module.exports = { attachRealtimeChat };
