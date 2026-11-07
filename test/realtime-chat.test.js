const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { Server } = require('socket.io');
const { io: connectSocket } = require('socket.io-client');
const { ObjectId } = require('mongodb');
const { normalizeAiChatRequest, MAX_MESSAGE_LENGTH } = require('../lib/ai-chat');
const { attachRealtimeChat } = require('../lib/realtime-chat');
const ChatMessage = require('../models/ChatMessage');

function createUser(id, role) {
  return {
    _id: { toString: () => id },
    name: id,
    role,
    adminRole: null,
    restricted: false,
    subscriptionStatus: 'active',
    subscriptionPlan: 'vip'
  };
}

function createRealtimeFixture() {
  const users = new Map([
    ['student-1', createUser('student-1', 'student')],
    ['teacher-1', createUser('teacher-1', 'teacher')]
  ]);
  const sessions = new Map();
  const messages = [];
  const replies = [];
  const httpServer = http.createServer();
  const io = new Server(httpServer);
  const sessionMiddleware = (request, _response, next) => {
    const id = request.headers['x-test-user'];
    request.sessionID = id;
    request.session = { user: id ? { id } : undefined };
    if (id) sessions.set(id, { user: { id } });
    next();
  };

  attachRealtimeChat(io, {
    sessionMiddleware,
    sessionStore: {
      get: (id, callback) => callback(null, sessions.get(id) || null)
    },
    UserModel: {
      findById: id => ({ select: async () => users.get(id) || null })
    },
    SystemConfigModel: {
      getVisitorSettings: async () => ({ subscriptionRequired: false })
    },
    isSubscriptionRequired: async () => false,
    getActiveCollection: () => ({
      findOne: async () => ({
        meetingId: 'meeting-123',
        meetingNumber: '123456789',
        expiresAt: new Date(Date.now() + 60_000)
      })
    }),
    ChatMessageModel: {
      find: query => {
        const results = messages.filter(message =>
          message.userId === query.userId &&
          (!query.roomName || message.roomName === query.roomName) &&
          (!query.$or || query.$or.some(cursor =>
            cursor.createdAt.$lt
              ? message.createdAt < cursor.createdAt.$lt
              : message.createdAt.getTime() === cursor.createdAt.getTime() &&
                message._id.toString() < cursor._id.$lt.toString()
          ))
        );
        let sortOrder = -1;
        let limit = 0;
        const queryBuilder = {
          sort: sort => { sortOrder = sort.createdAt; return queryBuilder; },
          limit: value => { limit = value; return queryBuilder; },
          lean: () => queryBuilder,
          exec: async () => results
            .sort((left, right) =>
              sortOrder * (left.createdAt - right.createdAt) ||
              sortOrder * left._id.toString().localeCompare(right._id.toString()))
            .slice(0, limit)
        };
        return queryBuilder;
      },
      create: async data => {
        const message = { _id: new ObjectId(), ...data, createdAt: data.createdAt || new Date() };
        messages.push(message);
        return message;
      },
      deleteMany: query => ({
        exec: async () => {
          const remaining = messages.filter(message =>
            message.userId !== query.userId ||
            (query.roomName && message.roomName !== query.roomName));
          const deletedCount = messages.length - remaining.length;
          messages.splice(0, messages.length, ...remaining);
          return { deletedCount };
        }
      })
    },
    generateReply: async request => {
      replies.push(request);
      return `Yanıt: ${request.ogrenciMesaji}`;
    }
  });

  return { httpServer, io, replies, sessions, messages };
}

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function connect(url, userId) {
  const socket = connectSocket(url, {
    transports: ['websocket'],
    reconnection: false,
    ...(userId ? { extraHeaders: { 'x-test-user': userId } } : {})
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(2000).emit(event, payload, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

test('AI chat input is normalized and bounded for REST and Socket.IO', () => {
  assert.deepEqual(normalizeAiChatRequest({
    ogrenciMesaji: '  Merhaba  ',
    grade: '7'
  }), {
    ogrenciMesaji: 'Merhaba',
    gorevTuru: 'ai_mentor',
    sinif: 7
  });
  assert.throws(() => normalizeAiChatRequest({ ogrenciMesaji: ' ' }), { status: 400 });
  assert.throws(() => normalizeAiChatRequest({
    ogrenciMesaji: 'x'.repeat(MAX_MESSAGE_LENGTH + 1)
  }), { status: 400 });
  assert.throws(() => normalizeAiChatRequest({ ogrenciMesaji: 'Soru', grade: 4 }), { status: 400 });
});

test('ChatMessage enforces the private conversation record schema', async () => {
  const valid = new ChatMessage({
    userId: 'student-1',
    roomName: 'assistant',
    sender: 'user',
    message: 'Merhaba'
  });
  await assert.doesNotReject(valid.validate());
  assert.equal(ChatMessage.collection.collectionName, 'chat_messages');
  const invalid = new ChatMessage({
    userId: 'student-1',
    roomName: 'assistant',
    sender: 'teacher',
    message: 'Merhaba'
  });
  await assert.rejects(invalid.validate(), { name: 'ValidationError' });
});

test('Socket.IO authenticates sessions and keeps persisted room history private', async t => {
  const fixture = createRealtimeFixture();
  const url = await listen(fixture.httpServer);
  const sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    await new Promise(resolve => fixture.io.close(resolve));
  });

  const unauthenticated = connectSocket(url, {
    transports: ['websocket'],
    reconnection: false
  });
  const unauthenticatedError = await new Promise(resolve => {
    unauthenticated.once('connect', resolve);
    unauthenticated.once('connect_error', resolve);
  });
  assert.match(unauthenticatedError.message, /Giriş yapmanız gerekiyor/);
  unauthenticated.disconnect();

  const student = await connect(url, 'student-1');
  const teacher = await connect(url, 'teacher-1');
  sockets.push(student, teacher);

  const denied = await emitWithAck(student, 'join-room', { roomId: 'another-meeting' });
  assert.equal(denied.success, false);
  assert.equal(denied.status, 404, denied.error);
  const studentJoin = await emitWithAck(student, 'join-room', '123456789');
  assert.equal(studentJoin.success, true);
  assert.deepEqual(studentJoin.messages, []);
  const teacherJoin = await emitWithAck(teacher, 'join-room', { roomId: 'meeting-123' });
  assert.equal(teacherJoin.success, true);
  assert.deepEqual(teacherJoin.messages, []);

  const studentReply = new Promise(resolve => student.once('receive-message', resolve));
  let teacherReceivedPrivateMessage = false;
  teacher.on('receive-message', () => { teacherReceivedPrivateMessage = true; });
  const acknowledgement = await emitWithAck(student, 'send-message', {
    requestId: 'request-1',
    roomId: '123456789',
    ogrenciMesaji: 'Kesir nedir?',
    grade: 6
  });
  assert.equal(acknowledgement.success, true);
  assert.equal(acknowledgement.yanit, 'Yanıt: Kesir nedir?');
  const received = await studentReply;
  assert.equal(received.userMessage.message, 'Kesir nedir?');
  assert.equal(received.aiMessage.message, 'Yanıt: Kesir nedir?');
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(teacherReceivedPrivateMessage, false);
  assert.equal(fixture.replies.length, 1);
  assert.equal(fixture.replies[0].sinif, 6);
  assert.equal(fixture.messages.length, 2);
  assert.deepEqual(fixture.messages.map(message => message.sender), ['user', 'ai']);
  assert.ok(fixture.messages.every(message => message.roomName === 'meeting-123'));

  const secondStudentSocket = await connect(url, 'student-1');
  sockets.push(secondStudentSocket);
  const rejoined = await emitWithAck(secondStudentSocket, 'join-room', '123456789');
  assert.equal(rejoined.messages.length, 2);
  assert.deepEqual(rejoined.messages.map(message => message.sender), ['user', 'ai']);

  const studentHistory = await emitWithAck(student, 'load-history', '123456789');
  assert.equal(studentHistory.success, true);
  assert.equal(studentHistory.messages.length, 2);
  assert.equal(studentHistory.messages[0].message, 'Kesir nedir?');
  assert.equal(studentHistory.messages[1].message, 'Yanıt: Kesir nedir?');
  const teacherHistory = await emitWithAck(teacher, 'load-history', { roomId: 'meeting-123' });
  assert.equal(teacherHistory.success, true);
  assert.deepEqual(teacherHistory.messages, []);
  const historyStart = Date.now();
  for (let index = 0; index < 25; index += 1) {
    fixture.messages.push({
      _id: new ObjectId(),
      userId: 'teacher-1',
      roomName: 'meeting-123',
      sender: index % 2 ? 'user' : 'ai',
      message: `Ders geçmişi ${index}`,
      createdAt: new Date(historyStart + index)
    });
  }
  const teacherRejoin = await emitWithAck(teacher, 'join-room', 'meeting-123');
  assert.equal(teacherRejoin.messages.length, 20);
  assert.equal(teacherRejoin.messages[0].message, 'Ders geçmişi 5');
  assert.equal(teacherRejoin.messages[19].message, 'Ders geçmişi 24');
  const invalidCursor = await emitWithAck(student, 'load-history', {
    before: { createdAt: 'not-a-date', id: 'invalid' }
  });
  assert.equal(invalidCursor.success, false);
  assert.equal(invalidCursor.status, 400);

  const privateReply = new Promise(resolve => student.once('receive-message', resolve));
  const privateAck = await emitWithAck(student, 'send-message', {
    requestId: 'request-private',
    ogrenciMesaji: 'Bağımsız bir soru'
  });
  await privateReply;
  assert.equal(privateAck.success, true);
  const privateHistory = await emitWithAck(student, 'load-history', {});
  assert.equal(privateHistory.messages.length, 4);
  assert.ok(privateHistory.messages.some(message => message.message === 'Bağımsız bir soru'));
  assert.ok(privateHistory.messages.some(message => message.message === 'Kesir nedir?'));
  assert.equal(fixture.messages.filter(message => message.userId === 'student-1').length, 4);
  for (let index = 0; index < 55; index += 1) {
    fixture.messages.push({
      _id: new ObjectId(),
      userId: 'student-1',
      roomName: 'assistant',
      sender: index % 2 ? 'user' : 'ai',
      message: `Geçmiş ${index}`,
      createdAt: new Date(Date.now() + 1000 + index)
    });
  }
  const firstPage = await emitWithAck(student, 'load-history', {});
  assert.equal(firstPage.messages.length, 50);
  assert.equal(firstPage.hasMore, true);
  const secondPage = await emitWithAck(student, 'load-history', { before: firstPage.nextBefore });
  assert.equal(secondPage.messages.length, 9);
  assert.equal(secondPage.hasMore, false);
  const deletedLessonHistory = await emitWithAck(student, 'delete-history', '123456789');
  assert.equal(deletedLessonHistory.success, true);
  assert.equal(deletedLessonHistory.deletedCount, 2);
  assert.deepEqual((await emitWithAck(student, 'load-history', '123456789')).messages, []);
  const deletedAllHistory = await emitWithAck(student, 'delete-history', {});
  assert.equal(deletedAllHistory.deletedCount, 57);
  assert.deepEqual((await emitWithAck(student, 'load-history', {})).messages, []);

  fixture.sessions.delete('student-1');
  const revoked = await emitWithAck(student, 'send-message', {
    requestId: 'request-revoked',
    ogrenciMesaji: 'Oturum kapatıldı mı?'
  });
  assert.equal(revoked.success, false);
  assert.equal(revoked.status, 401);
  assert.equal(fixture.replies.length, 2);
});
