/**
 * ZarifÇözüm Ortak Mesajlaşma Servisi (messageService.js)
 * Öğretmen, Veli ve Öğrenci Panelleri Arasında Gerçek Zamanlı Mesajlaşma & Senkronizasyon
 * Veri Modeli:
 *   conversationId: Benzersiz kimlik
 *   participants: [{ userId, name, role, relatedStudentName }]
 *   messages: [{ id, senderId, senderRole, text, timestamp, isRead }]
 */
(() => {
  const STORAGE_KEY = 'zarif_conversations_v2';
  const CHANNEL_NAME = 'zarif_messages_channel';

  let channel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (e) {
    console.warn('BroadcastChannel kullanılamıyor:', e);
  }

  let subscribers = [];
  let currentUser = {
    userId: 'user_default',
    name: 'Kullanıcı',
    role: 'teacher', // 'teacher' | 'student' | 'parent'
    relatedStudentName: ''
  };

  function readFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('localStorage okuma hatası:', e);
    }
    return null;
  }

  function writeToStorage(conversations) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.warn('localStorage yazma hatası:', e);
    }
  }

  function broadcastEvent(type, payload) {
    const data = { type, payload, timestamp: Date.now() };
    if (channel) {
      try {
        channel.postMessage(data);
      } catch (e) {}
    }
    // Storage olayını tetiklemek için ufak bir ping
    try {
      localStorage.setItem('zarif_msg_sync_ping', String(Date.now()));
    } catch (e) {}
  }

  function notifySubscribers() {
    const convs = ZarifMessageService.getConversations();
    const unread = ZarifMessageService.getUnreadCount(currentUser.role);
    subscribers.forEach(cb => {
      try {
        cb(convs, unread);
      } catch (err) {
        console.error('Subscriber callback error:', err);
      }
    });
  }

  // Cross-tab dinleyiciler
  if (channel) {
    channel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'NEW_MESSAGE' || type === 'MESSAGES_UPDATED' || type === 'MARK_READ') {
        if (payload && Array.isArray(payload.conversations)) {
          writeToStorage(payload.conversations);
        } else {
          // Sunucudan veya storage'dan tazele
          ZarifMessageService.fetchConversations().catch(() => {});
        }
        notifySubscribers();
      }
    };
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === 'zarif_msg_sync_ping') {
        notifySubscribers();
      }
    });

    // Sekmeye dönüldüğünde güncelle
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        ZarifMessageService.fetchConversations().catch(() => {});
      }
    });
  }

  const ZarifMessageService = {
    /**
     * Kullanıcı bağlamını ayarlar (Örn: { role: 'parent', userId: 'parent_1', name: 'Ayşe Yılmaz', relatedStudentName: 'Kerem Yılmaz' })
     */
    init(userContext = {}) {
      currentUser = { ...currentUser, ...userContext };
      // İlk veri kontrolü
      const cached = readFromStorage();
      if (!cached || cached.length === 0) {
        this.fetchConversations().catch(() => {});
      } else {
        notifySubscribers();
      }
      return this;
    },

    getCurrentUser() {
      return { ...currentUser };
    },

    /**
     * Sunucudan konuşmaları çeker ve localStorage ile senkronize eder
     */
    async fetchConversations() {
      try {
        const params = new URLSearchParams();
        if (currentUser.role) params.set('role', currentUser.role);
        if (currentUser.userId) params.set('userId', currentUser.userId);

        const res = await fetch(`/api/messages?${params.toString()}`);
        if (!res.ok) throw new Error('Sunucu hatası: ' + res.status);
        const data = await res.json();
        if (data && data.success && Array.isArray(data.conversations)) {
          writeToStorage(data.conversations);
          notifySubscribers();
          return data.conversations;
        }
      } catch (err) {
        console.warn('API erişilemedi, yerel veri kullanılıyor:', err.message);
      }
      return this.getConversations();
    },

    /**
     * Yerel depodaki konuşmaları döndürür
     */
    getConversations() {
      const stored = readFromStorage();
      return Array.isArray(stored) ? stored : [];
    },

    /**
     * ID'ye göre konuşma bulur
     */
    getConversationById(convId) {
      const convs = this.getConversations();
      return convs.find(c => c.conversationId === convId || c.id === convId) || null;
    },

    /**
     * Belirtilen rol için okunmamış mesaj / konuşma sayısını hesaplar
     */
    getUnreadCount(role = currentUser.role) {
      const convs = this.getConversations();
      let unread = 0;
      convs.forEach(c => {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        const hasUnread = msgs.some(m => !m.isRead && m.senderRole !== role);
        if (hasUnread) unread++;
      });
      return unread;
    },

    /**
     * Yeni mesaj gönderir (Öğretmen, Veli veya Öğrenci)
     */
    async sendMessage({
      conversationId,
      text,
      senderId = currentUser.userId,
      senderName = currentUser.name,
      senderRole = currentUser.role,
      targetUserId,
      targetName,
      targetRole,
      relatedStudentName = currentUser.relatedStudentName
    }) {
      if (!text || !text.trim()) return null;
      const cleanText = text.trim();
      const now = new Date();
      const timestamp = now.toISOString();
      const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        senderId,
        senderRole,
        senderName,
        sender: senderRole,
        text: cleanText,
        timestamp,
        time: timeStr,
        isRead: false
      };

      // 1. İyimser Yerel Güncelleme (Optimistic Update)
      let convs = this.getConversations();
      let targetConv = convs.find(c => c.conversationId === conversationId || c.id === conversationId);

      if (!targetConv) {
        const participants = [
          { userId: senderId, name: senderName, role: senderRole, relatedStudentName: relatedStudentName || '' }
        ];
        if (targetUserId) {
          participants.push({
            userId: targetUserId,
            name: targetName || 'Öğretmen',
            role: targetRole || (senderRole === 'teacher' ? 'parent' : 'teacher'),
            relatedStudentName: relatedStudentName || ''
          });
        }
        targetConv = {
          conversationId: conversationId || ('conv_' + Date.now()),
          id: conversationId || ('conv_' + Date.now()),
          participants,
          messages: [],
          updatedAt: timestamp,
          time: timeStr
        };
        convs.unshift(targetConv);
      }

      if (!Array.isArray(targetConv.messages)) targetConv.messages = [];
      targetConv.messages.push(newMsg);
      targetConv.updatedAt = timestamp;
      targetConv.time = timeStr;

      writeToStorage(convs);
      notifySubscribers();
      broadcastEvent('NEW_MESSAGE', { conversationId: targetConv.conversationId, message: newMsg, conversations: convs });

      // 2. Sunucuya Gönderim
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: targetConv.conversationId,
            text: cleanText,
            senderId,
            senderName,
            senderRole,
            targetUserId,
            targetName,
            targetRole,
            relatedStudentName
          })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData && resData.conversation) {
            // Sunucu yanıtıyla yereli eşitle
            const idx = convs.findIndex(c => (c.conversationId || c.id) === targetConv.conversationId);
            if (idx !== -1) {
              convs[idx] = resData.conversation;
              writeToStorage(convs);
              notifySubscribers();
            }
          }
        }
      } catch (err) {
        console.warn('Sunucuya mesaj iletimi arka planda tekrar denenecek:', err.message);
      }

      return { success: true, message: newMsg, conversation: targetConv };
    },

    /**
     * Konuşmadaki tüm karşı taraf mesajlarını okundu (isRead: true) yapar
     */
    async markAsRead(conversationId, readerRole = currentUser.role, readerId = currentUser.userId) {
      if (!conversationId) return;

      let convs = this.getConversations();
      let targetConv = convs.find(c => c.conversationId === conversationId || c.id === conversationId);
      if (!targetConv) return;

      let changed = false;
      if (Array.isArray(targetConv.messages)) {
        targetConv.messages.forEach(m => {
          if (m.senderRole !== readerRole && (!readerId || m.senderId !== readerId)) {
            if (!m.isRead) {
              m.isRead = true;
              changed = true;
            }
          }
        });
      }

      if (changed) {
        targetConv.unread = false;
        writeToStorage(convs);
        notifySubscribers();
        broadcastEvent('MARK_READ', { conversationId, conversations: convs });
      }

      // Sunucuya bildir
      try {
        await fetch('/api/messages/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, readerRole, readerId })
        });
      } catch (e) {
        console.warn('Okundu sunucuya iletilemedi:', e);
      }
    },

    /**
     * Veri ve sayaç değişikliklerini dinlemek için abone olur
     */
    subscribe(callback) {
      if (typeof callback === 'function') {
        subscribers.push(callback);
        // Anlık ilk durumu gönder
        try {
          callback(this.getConversations(), this.getUnreadCount(currentUser.role));
        } catch (e) {}
      }
      return () => {
        subscribers = subscribers.filter(s => s !== callback);
      };
    }
  };

  window.ZarifMessageService = ZarifMessageService;
})();
