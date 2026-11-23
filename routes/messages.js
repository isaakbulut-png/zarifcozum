const express = require('express');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');

function isDbConnected() {
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
}

function getDefaultConversations() {
  const now = new Date();
  const timeOffset = (minsAgo) => new Date(now.getTime() - minsAgo * 60 * 1000).toISOString();
  const formatTime = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return [
    {
      conversationId: 'conv_teacher1_student1',
      participants: [
        { userId: 'teacher_1', name: 'Ahmet Yılmaz', role: 'teacher' },
        { userId: 'student_1', name: 'Zeynep Kaya', role: 'student' }
      ],
      messages: [
        {
          id: 'msg_1_1',
          senderId: 'student_1',
          senderRole: 'student',
          text: 'Hocam merhaba, dün paylaştığınız trigonometri kazanım testindeki 4. sorunun çözüm adımında takıldım.',
          timestamp: timeOffset(20),
          isRead: true
        },
        {
          id: 'msg_1_2',
          senderId: 'student_1',
          senderRole: 'student',
          text: 'Yarınki canlı dersimizde bu soruya birkaç dakika ayırabilir miyiz?',
          timestamp: timeOffset(18),
          isRead: false
        }
      ],
      updatedAt: new Date(now.getTime() - 18 * 60 * 1000)
    },
    {
      conversationId: 'conv_teacher1_parent1',
      participants: [
        { userId: 'teacher_1', name: 'Ahmet Yılmaz', role: 'teacher' },
        { userId: 'parent_1', name: 'Murat Demir', role: 'parent', relatedStudentName: 'Ali Demir' }
      ],
      messages: [
        {
          id: 'msg_2_1',
          senderId: 'parent_1',
          senderRole: 'parent',
          text: "Ahmet Bey iyi günler, Ali'nin son deneme sınavındaki geometri netleri yükselmiş. İlginiz için çok teşekkür ederiz.",
          timestamp: timeOffset(145),
          isRead: true
        },
        {
          id: 'msg_2_2',
          senderId: 'teacher_1',
          senderRole: 'teacher',
          text: 'Rica ederim Murat Bey, Ali derste çok odaklı çalışıyor. Haftalık ödevlerini de aksatmadan bitiriyor.',
          timestamp: timeOffset(140),
          isRead: true
        }
      ],
      updatedAt: new Date(now.getTime() - 140 * 60 * 1000)
    },
    {
      conversationId: 'conv_teacher1_student2',
      participants: [
        { userId: 'teacher_1', name: 'Ahmet Yılmaz', role: 'teacher' },
        { userId: 'student_2', name: 'Burak Çelik', role: 'student' }
      ],
      messages: [
        {
          id: 'msg_3_1',
          senderId: 'student_2',
          senderRole: 'student',
          text: 'Hocam LGS deneme sınavı analiz raporu sisteme yüklendi mi?',
          timestamp: timeOffset(24 * 60 + 10),
          isRead: true
        },
        {
          id: 'msg_3_2',
          senderId: 'teacher_1',
          senderRole: 'teacher',
          text: 'Evet Burak, başarı analizi sekmesinden karnene ulaşabilirsin.',
          timestamp: timeOffset(24 * 60),
          isRead: true
        }
      ],
      updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
    },
    {
      conversationId: 'conv_teacher1_parent2',
      participants: [
        { userId: 'teacher_1', name: 'Ahmet Yılmaz', role: 'teacher' },
        { userId: 'parent_2', name: 'Fatma Yılmaz', role: 'parent', relatedStudentName: 'Elif Yılmaz' }
      ],
      messages: [
        {
          id: 'msg_4_1',
          senderId: 'parent_2',
          senderRole: 'parent',
          text: 'Hocam iyi günler, Elif bu hafta sonu yapılacak olan Türkiye Geneli Online Deneme Sınavına evden katılabilecek mi? Saat ve giriş adımları hakkında bilgi verebilir misiniz?',
          timestamp: timeOffset(45),
          isRead: false
        }
      ],
      updatedAt: new Date(now.getTime() - 45 * 60 * 1000)
    },
    {
      conversationId: 'conv_teacher1_parent_ayse',
      participants: [
        { userId: 'teacher_1', name: 'Ahmet Yılmaz', role: 'teacher' },
        { userId: 'parent_ayse', name: 'Ayşe Yılmaz', role: 'parent', relatedStudentName: 'Kerem Yılmaz' }
      ],
      messages: [
        {
          id: 'msg_5_1',
          senderId: 'teacher_1',
          senderRole: 'teacher',
          text: 'İyi günler Ayşe Hanım, Kerem bu hafta Kesirlerle İşlemler konusunda güzel bir gelişim gösterdi. Pekiştirme testlerini tamamlaması konuları iyice pekiştirecektir.',
          timestamp: timeOffset(80),
          isRead: true
        },
        {
          id: 'msg_5_2',
          senderId: 'parent_ayse',
          senderRole: 'parent',
          text: 'Merhabalar Ahmet Hocam, bilgilendirmeniz için çok teşekkür ederiz. Kerem ile birlikte evde testleri takip ediyoruz.',
          timestamp: timeOffset(30),
          isRead: false
        }
      ],
      updatedAt: new Date(now.getTime() - 30 * 60 * 1000)
    }
  ];
}

// In-memory store fallback
let conversationsStore = getDefaultConversations();

/**
 * Normalizes conversation data for client usage and ensures both new schema
 * (conversationId, participants, messages with isRead) and UI helper properties exist.
 */
function enrichConversation(conv, viewerRole = 'teacher') {
  const c = { ...conv };
  c.id = c.conversationId || c.id;
  c.conversationId = c.id;

  const participants = Array.isArray(c.participants) ? c.participants : [];
  const otherParticipant = participants.find(p => p.role !== viewerRole) || participants[0] || {};
  const parentParticipant = participants.find(p => p.role === 'parent');
  const studentParticipant = participants.find(p => p.role === 'student');

  c.name = c.name || otherParticipant.name || 'Kullanıcı';
  c.roleType = c.roleType || (parentParticipant ? 'parent' : studentParticipant ? 'student' : otherParticipant.role || 'student');
  
  if (parentParticipant) {
    c.studentName = parentParticipant.relatedStudentName || c.studentName || '';
    c.parentRelation = c.studentName ? `${c.studentName}'in Velisi` : 'Öğrenci Velisi';
    c.role = c.role || 'Veli';
  } else if (studentParticipant) {
    c.studentName = studentParticipant.name || c.name;
    c.role = c.role || 'Öğrenci';
  } else {
    c.role = c.role || otherParticipant.role || 'Kullanıcı';
  }

  // Avatar helper
  if (!c.avatar) {
    const initials = (c.name || 'ZK').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    c.avatar = initials || 'ZK';
  }
  if (!c.avatarBg) {
    c.avatarBg = c.roleType === 'parent' ? '#d97706' : '#059669';
  }

  // Format messages
  const messages = Array.isArray(c.messages) ? c.messages : [];
  c.messages = messages.map(m => {
    const msg = { ...m };
    if (!msg.timestamp && msg.time) {
      msg.timestamp = new Date().toISOString();
    }
    if (typeof msg.isRead === 'undefined') {
      msg.isRead = !c.unread;
    }
    if (!msg.senderRole) {
      msg.senderRole = msg.sender === 'teacher' ? 'teacher' : (c.roleType || 'student');
    }
    if (!msg.sender) {
      msg.sender = msg.senderRole;
    }
    if (!msg.time && msg.timestamp) {
      msg.time = new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    return msg;
  });

  const lastMsg = c.messages[c.messages.length - 1];
  if (lastMsg) {
    c.time = lastMsg.time || new Date(lastMsg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } else {
    c.time = c.time || '12:00';
  }

  // Unread status relative to viewerRole
  // If viewer is teacher: any message not sent by teacher that has isRead === false
  // If viewer is parent: any message not sent by parent that has isRead === false
  const hasUnread = c.messages.some(m => !m.isRead && m.senderRole !== viewerRole);
  c.unread = hasUnread;

  return c;
}

function createMessagesRouter({ getDb } = {}) {
  const router = express.Router();

  // GET /api/messages - Konuşma listesini ve okunmamış sayısını döndürür
  router.get('/', async (req, res) => {
    try {
      const viewerRole = req.query.role || req.session?.user?.role || 'teacher';
      const viewerUserId = req.query.userId || req.session?.user?.id || '';

      let convs = [];
      let usedDb = false;

      // MongoDB desteği
      try {
        if (isDbConnected() && Conversation && Conversation.find) {
          const filter = {};
          if (viewerRole === 'parent' && viewerUserId) {
            filter['participants.userId'] = viewerUserId;
          }
          const docs = await Conversation.find(filter).sort({ updatedAt: -1 }).lean().exec();
          if (docs && docs.length > 0) {
            convs = docs;
            usedDb = true;
          }
        }
      } catch (dbErr) {
        // Fallback to in-memory store
      }

      if (!usedDb) {
        convs = conversationsStore;
      }

      // Filter by viewer role if specified
      if (viewerRole === 'parent' && viewerUserId) {
        convs = convs.filter(c => 
          Array.isArray(c.participants) && c.participants.some(p => p.userId === viewerUserId)
        );
      }

      const enriched = convs.map(c => enrichConversation(c, viewerRole));
      const unreadCount = enriched.filter(c => c.unread).length;

      res.json({
        success: true,
        conversations: enriched,
        unreadCount
      });
    } catch (error) {
      console.error('Mesajlar getirilemedi:', error);
      res.status(500).json({ success: false, mesaj: 'Mesajlar alınamadı.' });
    }
  });

  // GET /api/messages/:id - Belirli bir konuşmayı getirir
  router.get('/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const viewerRole = req.query.role || req.session?.user?.role || 'teacher';

      let target = null;
      try {
        if (isDbConnected() && Conversation && Conversation.findOne) {
          target = await Conversation.findOne({ conversationId }).lean().exec();
        }
      } catch (e) {}

      if (!target) {
        target = conversationsStore.find(c => c.conversationId === conversationId || c.id === conversationId);
      }

      if (!target) {
        return res.status(404).json({ success: false, mesaj: 'Konuşma bulunamadı.' });
      }

      res.json({
        success: true,
        conversation: enrichConversation(target, viewerRole)
      });
    } catch (error) {
      res.status(500).json({ success: false, mesaj: 'Konuşma alınırken hata oluştu.' });
    }
  });

  // POST /api/messages - Mesaj gönderme (Öğretmen, Veli veya Öğrenci)
  router.post('/', async (req, res) => {
    try {
      const {
        conversationId,
        text,
        senderId,
        senderName,
        senderRole = 'teacher',
        targetUserId,
        targetName,
        targetRole,
        relatedStudentName
      } = req.body || {};

      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, mesaj: 'Mesaj metni zorunludur.' });
      }

      const cleanText = text.trim();
      const now = new Date();
      const isoTimestamp = now.toISOString();
      const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const finalSenderRole = senderRole || req.session?.user?.role || 'teacher';
      const finalSenderId = senderId || req.session?.user?.id || (finalSenderRole + '_1');
      const finalSenderName = senderName || req.session?.user?.name || (finalSenderRole === 'teacher' ? 'Ahmet Yılmaz' : 'Kullanıcı');

      let targetConv = conversationsStore.find(c => c.conversationId === conversationId || c.id === conversationId);

      // Konuşma henüz yoksa yeni oluştur
      if (!targetConv) {
        const participants = [
          { userId: finalSenderId, name: finalSenderName, role: finalSenderRole, relatedStudentName: relatedStudentName || '' }
        ];
        if (targetUserId) {
          participants.push({
            userId: targetUserId,
            name: targetName || 'Kullanıcı',
            role: targetRole || (finalSenderRole === 'teacher' ? 'student' : 'teacher'),
            relatedStudentName: relatedStudentName || ''
          });
        } else if (finalSenderRole !== 'teacher') {
          participants.push({
            userId: 'teacher_1',
            name: 'Ahmet Yılmaz',
            role: 'teacher'
          });
        }

        targetConv = {
          conversationId: conversationId || ('conv_' + Date.now()),
          participants,
          messages: [],
          updatedAt: now
        };
        conversationsStore.unshift(targetConv);
      }

      const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        senderId: finalSenderId,
        senderRole: finalSenderRole,
        senderName: finalSenderName,
        sender: finalSenderRole,
        text: cleanText,
        timestamp: isoTimestamp,
        time: timeStr,
        isRead: false // Alıcı henüz okumadı
      };

      targetConv.messages.push(newMsg);
      targetConv.updatedAt = now;

      // Öğretmen yanıt verdiğinde konuşmadaki gelen mesajları da okundu yapar
      if (finalSenderRole === 'teacher') {
        targetConv.messages.forEach(m => {
          if (m.senderRole !== 'teacher' && m.sender !== 'teacher') {
            m.isRead = true;
          }
        });
      }

      // MongoDB'ye kaydet
      try {
        if (isDbConnected() && Conversation && Conversation.findOneAndUpdate) {
          await Conversation.findOneAndUpdate(
            { conversationId: targetConv.conversationId },
            {
              $set: {
                participants: targetConv.participants,
                messages: targetConv.messages,
                updatedAt: now
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
        }
      } catch (dbErr) {
        console.warn('MongoDB kayıt uyarısı:', dbErr.message);
      }

      const enriched = enrichConversation(targetConv, finalSenderRole);

      res.json({
        success: true,
        message: newMsg,
        conversation: enriched
      });
    } catch (error) {
      console.error('Mesaj gönderilemedi:', error);
      res.status(500).json({ success: false, mesaj: 'Mesaj gönderilemedi.' });
    }
  });

  // POST /api/messages/mark-read - Konuşmayı okundu olarak işaretler
  router.post('/mark-read', async (req, res) => {
    try {
      const { conversationId, readerRole = 'teacher', readerId } = req.body || {};
      if (!conversationId) {
        return res.status(400).json({ success: false, mesaj: 'Konuşma ID zorunludur.' });
      }

      let targetConv = conversationsStore.find(c => c.conversationId === conversationId || c.id === conversationId);

      if (targetConv && Array.isArray(targetConv.messages)) {
        // Okuyanın rolü dışındakilerin gönderdiği mesajları okundu yap
        targetConv.messages.forEach(m => {
          if (m.senderRole !== readerRole && (!readerId || m.senderId !== readerId)) {
            m.isRead = true;
          }
        });
        targetConv.updatedAt = new Date();
      }

      try {
        if (isDbConnected() && Conversation && Conversation.findOne) {
          const doc = await Conversation.findOne({ conversationId });
          if (doc && Array.isArray(doc.messages)) {
            doc.messages.forEach(m => {
              if (m.senderRole !== readerRole && (!readerId || m.senderId !== readerId)) {
                m.isRead = true;
              }
            });
            doc.updatedAt = new Date();
            await doc.save();
          }
        }
      } catch (dbErr) {
        console.warn('MongoDB okundu güncelleme uyarısı:', dbErr.message);
      }

      res.json({ success: true, conversationId });
    } catch (error) {
      console.error('Okundu işaretleme hatası:', error);
      res.status(500).json({ success: false, mesaj: 'İşlem başarısız.' });
    }
  });

  // POST /api/messages/send-from-client - Veli veya Öğrenci panelinden öğretmene mesaj
  router.post('/send-from-client', async (req, res) => {
    try {
      const {
        roleType = 'student',
        senderName,
        studentName,
        text,
        senderId,
        teacherId = 'teacher_1'
      } = req.body || {};

      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, mesaj: 'Mesaj metni zorunludur.' });
      }

      const cleanText = text.trim();
      const now = new Date();
      const isoTimestamp = now.toISOString();
      const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const finalRole = roleType === 'parent' ? 'parent' : 'student';
      const actualSenderName = senderName || (finalRole === 'parent' ? 'Öğrenci Velisi' : 'Öğrenci');
      const actualStudentName = studentName || (finalRole === 'parent' ? 'Öğrenci' : actualSenderName);
      const actualSenderId = senderId || (finalRole + '_' + Date.now());

      // Konuşmayı bul veya oluştur
      let targetConv = conversationsStore.find(c => {
        if (c.roleType === finalRole && (c.name === actualSenderName || c.studentName === actualStudentName)) {
          return true;
        }
        if (Array.isArray(c.participants)) {
          return c.participants.some(p => p.role === finalRole && (p.name === actualSenderName || p.userId === actualSenderId));
        }
        return false;
      });

      if (!targetConv) {
        const newConvId = `conv_${finalRole}_${Date.now()}`;
        targetConv = {
          conversationId: newConvId,
          participants: [
            { userId: teacherId, name: 'Ahmet Yılmaz', role: 'teacher' },
            {
              userId: actualSenderId,
              name: actualSenderName,
              role: finalRole,
              relatedStudentName: finalRole === 'parent' ? actualStudentName : ''
            }
          ],
          messages: [],
          updatedAt: now
        };
        conversationsStore.unshift(targetConv);
      }

      const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        senderId: actualSenderId,
        senderRole: finalRole,
        senderName: actualSenderName,
        sender: finalRole,
        text: cleanText,
        timestamp: isoTimestamp,
        time: timeStr,
        isRead: false
      };

      targetConv.messages.push(newMsg);
      targetConv.updatedAt = now;

      // MongoDB kayıt
      try {
        if (isDbConnected() && Conversation && Conversation.findOneAndUpdate) {
          await Conversation.findOneAndUpdate(
            { conversationId: targetConv.conversationId },
            {
              $set: {
                participants: targetConv.participants,
                messages: targetConv.messages,
                updatedAt: now
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
        }
      } catch (dbErr) {
        console.warn('MongoDB senkronizasyon uyarısı:', dbErr.message);
      }

      const enriched = enrichConversation(targetConv, 'teacher');

      res.json({
        success: true,
        message: newMsg,
        conversation: enriched
      });
    } catch (error) {
      console.error('İstemci mesaj gönderimi başarısız:', error);
      res.status(500).json({ success: false, mesaj: 'Mesaj iletilemedi.' });
    }
  });

  return router;
}

module.exports = {
  createMessagesRouter,
  getDefaultConversations,
  enrichConversation
};
