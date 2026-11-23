const express = require('express');

function getDefaultConversations() {
  const now = new Date();
  const formatTime = (d) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const timeToday = (minsAgo) => formatTime(new Date(now.getTime() - minsAgo * 60 * 1000));

  return [
    {
      id: 'conv_1',
      name: 'Zeynep Kaya',
      role: '11. Sınıf Öğrencisi',
      roleType: 'student',
      studentName: 'Zeynep Kaya',
      avatar: 'ZK',
      avatarBg: '#059669', // emerald
      time: timeToday(18),
      unread: true,
      messages: [
        {
          id: 'msg_1_1',
          sender: 'student',
          senderName: 'Zeynep Kaya',
          text: 'Hocam merhaba, dün paylaştığınız trigonometri kazanım testindeki 4. sorunun çözüm adımında takıldım.',
          time: timeToday(20)
        },
        {
          id: 'msg_1_2',
          sender: 'student',
          senderName: 'Zeynep Kaya',
          text: 'Yarınki canlı dersimizde bu soruya birkaç dakika ayırabilir miyiz?',
          time: timeToday(18)
        }
      ]
    },
    {
      id: 'conv_2',
      name: 'Murat Demir',
      role: 'Veli',
      roleType: 'parent',
      studentName: 'Ali Demir',
      parentRelation: "Ali Demir'in Velisi",
      avatar: 'MD',
      avatarBg: '#d97706', // amber
      time: timeToday(140),
      unread: false,
      messages: [
        {
          id: 'msg_2_1',
          sender: 'parent',
          senderName: 'Murat Demir',
          text: "Ahmet Bey iyi günler, Ali'nin son deneme sınavındaki geometri netleri yükselmiş. İlginiz için çok teşekkür ederiz.",
          time: timeToday(145)
        },
        {
          id: 'msg_2_2',
          sender: 'teacher',
          senderName: 'Öğretmen',
          text: 'Rica ederim Murat Bey, Ali derste çok odaklı çalışıyor. Haftalık ödevlerini de aksatmadan bitiriyor.',
          time: timeToday(140)
        }
      ]
    },
    {
      id: 'conv_3',
      name: 'Burak Çelik',
      role: '8. Sınıf Öğrencisi (LGS)',
      roleType: 'student',
      studentName: 'Burak Çelik',
      avatar: 'BÇ',
      avatarBg: '#2563eb', // blue
      time: 'Dün',
      unread: false,
      messages: [
        {
          id: 'msg_3_1',
          sender: 'student',
          senderName: 'Burak Çelik',
          text: 'Hocam LGS deneme sınavı analiz raporu sisteme yüklendi mi?',
          time: 'Dün 17:40'
        },
        {
          id: 'msg_3_2',
          sender: 'teacher',
          senderName: 'Öğretmen',
          text: 'Evet Burak, başarı analizi sekmesinden karnene ulaşabilirsin.',
          time: 'Dün 17:55'
        }
      ]
    },
    {
      id: 'conv_4',
      name: 'Fatma Yılmaz',
      role: 'Veli',
      roleType: 'parent',
      studentName: 'Elif Yılmaz',
      parentRelation: "Elif Yılmaz'ın Velisi",
      avatar: 'FY',
      avatarBg: '#c026d3', // fuchsia
      time: timeToday(45),
      unread: true,
      messages: [
        {
          id: 'msg_4_1',
          sender: 'parent',
          senderName: 'Fatma Yılmaz',
          text: 'Hocam iyi günler, Elif bu hafta sonu yapılacak olan Türkiye Geneli Online Deneme Sınavına evden katılabilecek mi? Saat ve giriş adımları hakkında bilgi verebilir misiniz?',
          time: timeToday(45)
        }
      ]
    }
  ];
}

// Global in-memory cache for live state across requests
let conversationsStore = getDefaultConversations();

function createMessagesRouter({ getDb } = {}) {
  const router = express.Router();

  // GET /api/messages - Konuşma listesini ve okunmamış sayısını döndürür
  router.get('/', async (req, res) => {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      let convs = conversationsStore;

      if (db) {
        try {
          const col = db.collection('direct_messages');
          const dbConvs = await col.find({}).sort({ updatedAt: -1 }).toArray();
          if (dbConvs && dbConvs.length > 0) {
            convs = dbConvs;
            conversationsStore = dbConvs;
          } else {
            // İlk açılışta seed verisini koleksiyona yaz
            await col.insertMany(conversationsStore).catch(() => {});
          }
        } catch (dbErr) {
          console.warn('MongoDB direct_messages okunamadı, bellek içi depodan dönülüyor:', dbErr.message);
        }
      }

      const unreadCount = convs.filter(c => c.unread).length;
      res.json({
        success: true,
        conversations: convs,
        unreadCount
      });
    } catch (error) {
      console.error('Mesajlar getirilemedi:', error);
      res.status(500).json({ success: false, mesaj: 'Mesajlar alınamadı.' });
    }
  });

  // POST /api/messages - Öğretmenin yanıt göndermesi
  router.post('/', async (req, res) => {
    try {
      const { conversationId, text } = req.body || {};
      if (!conversationId || !text || !text.trim()) {
        return res.status(400).json({ success: false, mesaj: 'Konuşma ID ve mesaj metni zorunludur.' });
      }

      const cleanText = text.trim();
      const now = new Date();
      const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      let targetConv = conversationsStore.find(c => c.id === conversationId || String(c._id) === conversationId);
      if (!targetConv) {
        return res.status(404).json({ success: false, mesaj: 'Konuşma bulunamadı.' });
      }

      const newMsg = {
        id: 'msg_' + Date.now(),
        sender: 'teacher',
        senderName: req.session?.user?.name || 'Öğretmen',
        text: cleanText,
        time: timeStr,
        createdAt: now
      };

      targetConv.messages.push(newMsg);
      targetConv.time = timeStr;
      targetConv.unread = false; // Öğretmen yanıt verince okunmuş olur
      targetConv.updatedAt = now;

      // MongoDB güncellemesi
      const db = typeof getDb === 'function' ? getDb() : null;
      if (db) {
        try {
          const col = db.collection('direct_messages');
          await col.updateOne(
            { id: targetConv.id },
            { $set: { messages: targetConv.messages, time: timeStr, unread: false, updatedAt: now } },
            { upsert: true }
          );
        } catch (dbErr) {
          console.warn('MongoDB direct_messages güncellenemedi:', dbErr.message);
        }
      }

      const unreadCount = conversationsStore.filter(c => c.unread).length;
      res.json({
        success: true,
        message: newMsg,
        conversation: targetConv,
        unreadCount
      });
    } catch (error) {
      console.error('Mesaj gönderilemedi:', error);
      res.status(500).json({ success: false, mesaj: 'Mesaj iletilemedi.' });
    }
  });

  // POST /api/messages/mark-read - Bir konuşmayı okundu olarak işaretler
  router.post('/mark-read', async (req, res) => {
    try {
      const { conversationId } = req.body || {};
      if (!conversationId) {
        return res.status(400).json({ success: false, mesaj: 'Konuşma ID zorunludur.' });
      }

      const targetConv = conversationsStore.find(c => c.id === conversationId || String(c._id) === conversationId);
      if (targetConv) {
        targetConv.unread = false;
        const db = typeof getDb === 'function' ? getDb() : null;
        if (db) {
          try {
            const col = db.collection('direct_messages');
            await col.updateOne({ id: targetConv.id }, { $set: { unread: false } });
          } catch {}
        }
      }

      const unreadCount = conversationsStore.filter(c => c.unread).length;
      res.json({ success: true, unreadCount });
    } catch (error) {
      res.status(500).json({ success: false, mesaj: 'İşlem başarısız.' });
    }
  });

  // POST /api/messages/send-from-client - Öğrenci veya Veliden Öğretmene Mesaj Gönderme
  router.post('/send-from-client', async (req, res) => {
    try {
      const { roleType, senderName, studentName, text } = req.body || {};
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, mesaj: 'Mesaj metni zorunludur.' });
      }

      const cleanText = text.trim();
      const actualRoleType = roleType === 'parent' ? 'parent' : 'student';
      const actualSenderName = (senderName || req.session?.user?.name || (actualRoleType === 'parent' ? 'Veli' : 'Öğrenci')).trim();
      const now = new Date();
      const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      // İlgili konuşmayı bul ya da yeni oluştur
      let targetConv = conversationsStore.find(c =>
        c.roleType === actualRoleType && (c.name.toLowerCase() === actualSenderName.toLowerCase() || (actualRoleType === 'parent' && studentName && c.studentName?.toLowerCase() === studentName.toLowerCase()))
      );

      const newMsg = {
        id: 'msg_' + Date.now(),
        sender: actualRoleType,
        senderName: actualSenderName,
        text: cleanText,
        time: timeStr,
        createdAt: now
      };

      if (targetConv) {
        targetConv.messages.push(newMsg);
        targetConv.time = timeStr;
        targetConv.unread = true;
        targetConv.updatedAt = now;
      } else {
        const initials = actualSenderName.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || (actualRoleType === 'parent' ? 'VL' : 'ÖG');
        targetConv = {
          id: 'conv_' + Date.now(),
          name: actualSenderName,
          role: actualRoleType === 'parent' ? 'Veli' : 'Öğrenci',
          roleType: actualRoleType,
          studentName: studentName || actualSenderName,
          parentRelation: actualRoleType === 'parent' ? (studentName ? `${studentName}'in Velisi` : 'Öğrenci Velisi') : undefined,
          avatar: initials,
          avatarBg: actualRoleType === 'parent' ? '#d97706' : '#059669',
          time: timeStr,
          unread: true,
          messages: [newMsg],
          updatedAt: now
        };
        conversationsStore.unshift(targetConv);
      }

      const db = typeof getDb === 'function' ? getDb() : null;
      if (db) {
        try {
          const col = db.collection('direct_messages');
          await col.updateOne(
            { id: targetConv.id },
            { $set: targetConv },
            { upsert: true }
          );
        } catch {}
      }

      const unreadCount = conversationsStore.filter(c => c.unread).length;
      res.json({
        success: true,
        mesaj: 'Mesajınız öğretmeninize başarıyla iletildi!',
        conversation: targetConv,
        unreadCount
      });
    } catch (error) {
      console.error('Öğrenci/Veli mesajı iletilemedi:', error);
      res.status(500).json({ success: false, mesaj: 'Mesaj iletilemedi.' });
    }
  });

  return router;
}

module.exports = {
  createMessagesRouter,
  getDefaultConversations
};
