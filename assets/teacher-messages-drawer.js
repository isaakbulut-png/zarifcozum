/**
 * ZarifÇözüm Öğretmen Paneli: Ortak Mesajlaşma & İletişim Çekmecesi (Drawer)
 * Terracotta (#C84B31) & Koyu Kahve (#2c1a0e) Temalı
 * Veli ve Öğrenci Mesaj Entegrasyonu, 3'lü Hızlı Filtre ve Gerçek Zamanlı Senkronizasyon
 */
(() => {
  const STORAGE_KEY = 'zarif_conversations_v2';
  const LEGACY_STORAGE_KEY = 'zarif_direct_messages_v1';
  const CHANNEL_NAME = 'zarif_messages_channel';

  let channel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (e) {
    console.warn('BroadcastChannel desteklenmiyor:', e);
  }

  // Varsayılan Tohum Verisi
  const defaultConversations = [
    {
      id: 'conv_1',
      conversationId: 'conv_teacher1_student1',
      name: 'Zeynep Kaya',
      role: '11. Sınıf Öğrencisi',
      roleType: 'student',
      studentName: 'Zeynep Kaya',
      avatar: 'ZK',
      avatarBg: '#059669',
      time: '14:22',
      unread: true,
      messages: [
        {
          id: 'msg_1_1',
          sender: 'student',
          senderRole: 'student',
          senderName: 'Zeynep Kaya',
          text: 'Hocam merhaba, dün paylaştığınız trigonometri kazanım testindeki 4. sorunun çözüm adımında takıldım.',
          time: '14:20',
          isRead: true
        },
        {
          id: 'msg_1_2',
          sender: 'student',
          senderRole: 'student',
          senderName: 'Zeynep Kaya',
          text: 'Yarınki canlı dersimizde bu soruya birkaç dakika ayırabilir miyiz?',
          time: '14:22',
          isRead: false
        }
      ]
    },
    {
      id: 'conv_2',
      conversationId: 'conv_teacher1_parent1',
      name: 'Murat Demir',
      role: 'Veli',
      roleType: 'parent',
      studentName: 'Ali Demir',
      parentRelation: "Ali Demir'in Velisi",
      avatar: 'MD',
      avatarBg: '#d97706',
      time: '11:05',
      unread: false,
      messages: [
        {
          id: 'msg_2_1',
          sender: 'parent',
          senderRole: 'parent',
          senderName: 'Murat Demir',
          text: "Ahmet Bey iyi günler, Ali'nin son deneme sınavındaki geometri netleri yükselmiş. İlginiz için çok teşekkür ederiz.",
          time: '11:00',
          isRead: true
        },
        {
          id: 'msg_2_2',
          sender: 'teacher',
          senderRole: 'teacher',
          senderName: 'Öğretmen',
          text: 'Rica ederim Murat Bey, Ali derste çok odaklı çalışıyor. Haftalık ödevlerini de aksatmadan bitiriyor.',
          time: '11:05',
          isRead: true
        }
      ]
    },
    {
      id: 'conv_3',
      conversationId: 'conv_teacher1_student2',
      name: 'Burak Çelik',
      role: '8. Sınıf Öğrencisi (LGS)',
      roleType: 'student',
      studentName: 'Burak Çelik',
      avatar: 'BÇ',
      avatarBg: '#2563eb',
      time: 'Dün',
      unread: false,
      messages: [
        {
          id: 'msg_3_1',
          sender: 'student',
          senderRole: 'student',
          senderName: 'Burak Çelik',
          text: 'Hocam LGS deneme sınavı analiz raporu sisteme yüklendi mi?',
          time: 'Dün 17:40',
          isRead: true
        },
        {
          id: 'msg_3_2',
          sender: 'teacher',
          senderRole: 'teacher',
          senderName: 'Öğretmen',
          text: 'Evet Burak, başarı analizi sekmesinden karnene ulaşabilirsin.',
          time: 'Dün 17:55',
          isRead: true
        }
      ]
    },
    {
      id: 'conv_4',
      conversationId: 'conv_teacher1_parent2',
      name: 'Fatma Yılmaz',
      role: 'Veli',
      roleType: 'parent',
      studentName: 'Elif Yılmaz',
      parentRelation: "Elif Yılmaz'ın Velisi",
      avatar: 'FY',
      avatarBg: '#c026d3',
      time: '10:15',
      unread: true,
      messages: [
        {
          id: 'msg_4_1',
          sender: 'parent',
          senderRole: 'parent',
          senderName: 'Fatma Yılmaz',
          text: 'Hocam iyi günler, Elif bu hafta sonu yapılacak olan Türkiye Geneli Online Deneme Sınavına evden katılabilecek mi? Saat ve giriş adımları hakkında bilgi verebilir misiniz?',
          time: '10:15',
          isRead: false
        }
      ]
    },
    {
      id: 'conv_5',
      conversationId: 'conv_teacher1_parent_ayse',
      name: 'Ayşe Yılmaz',
      role: 'Veli',
      roleType: 'parent',
      studentName: 'Kerem Yılmaz',
      parentRelation: "Kerem Yılmaz'ın Velisi",
      avatar: 'AY',
      avatarBg: '#17805f',
      time: '14:30',
      unread: true,
      messages: [
        {
          id: 'msg_5_1',
          sender: 'teacher',
          senderRole: 'teacher',
          senderName: 'Ahmet Yılmaz',
          text: 'İyi günler Ayşe Hanım, Kerem bu hafta Kesirlerle İşlemler konusunda güzel bir gelişim gösterdi. Pekiştirme testlerini tamamlaması konuları iyice pekiştirecektir.',
          time: '13:40',
          isRead: true
        },
        {
          id: 'msg_5_2',
          sender: 'parent',
          senderRole: 'parent',
          senderName: 'Ayşe Yılmaz',
          text: 'Merhabalar Ahmet Hocam, bilgilendirmeniz için çok teşekkür ederiz. Kerem ile birlikte evde testleri takip ediyoruz.',
          time: '14:30',
          isRead: false
        }
      ]
    }
  ];

  let conversations = [];
  let selectedChatId = 'conv_1';
  let activeFilter = 'all'; // 'all', 'student', 'parent'
  let searchQuery = '';
  let drawerElement = null;

  // LocalStorage senkronizasyonu
  function loadLocalState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultConversations;
  }

  function saveLocalState(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem('zarif_msg_sync_ping', String(Date.now()));
      if (channel) {
        channel.postMessage({ type: 'SYNC_MESSAGES', data });
      }
    } catch {}
  }

  // API'den mesajları çek
  async function fetchMessagesFromApi() {
    try {
      const res = await fetch('/api/messages?role=teacher');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations) && data.conversations.length > 0) {
          conversations = data.conversations;
          saveLocalState(conversations);
          renderDrawer();
          updateBadges();
          return;
        }
      }
    } catch (e) {
      // API erişilemezse yerel depodan devam edilir
    }
    conversations = loadLocalState();
    renderDrawer();
    updateBadges();
  }

  // Bildirim rozetlerini güncelle
  function updateBadges() {
    // Öğretmen için okunmamış mesaj sayısı
    let unreadCount = 0;
    conversations.forEach(c => {
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      const hasUnread = msgs.some(m => !m.isRead && m.senderRole !== 'teacher' && m.sender !== 'teacher');
      if (hasUnread || c.unread) unreadCount++;
    });
    
    // Üst Bar Mesaj Rozeti
    const topBadge = document.getElementById('topMessageBadge');
    if (topBadge) {
      topBadge.textContent = String(unreadCount);
      topBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    // Sol Menü Mesaj Rozeti
    const sideBadge = document.getElementById('sidebarMessageBadge');
    if (sideBadge) {
      sideBadge.textContent = String(unreadCount);
      sideBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
  }

  // HTML Karakter Kaçışı
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Drawer HTML şablonunu oluştur ve body'ye ekle
  function ensureDrawerMarkup() {
    if (document.getElementById('teacherMessagesDrawer')) {
      drawerElement = document.getElementById('teacherMessagesDrawer');
      return;
    }

    drawerElement = document.createElement('div');
    drawerElement.id = 'teacherMessagesDrawer';
    drawerElement.className = 'tmd-drawer-backdrop';
    drawerElement.setAttribute('aria-hidden', 'true');

    drawerElement.innerHTML = `
      <div class="tmd-drawer-panel" role="dialog" aria-modal="true" aria-label="Mesajlaşma & İletişim Kutusu">
        
        <!-- Başlık -->
        <div class="tmd-header">
          <div class="tmd-header-brand">
            <div class="tmd-icon-box">
              <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="tmd-title-area">
              <h3>Mesajlaşma &amp; İletişim Kutusu</h3>
              <p>Öğrenci ve velilerinizden gelen anlık mesajlar</p>
            </div>
          </div>
          <button type="button" class="tmd-close-btn" id="tmdCloseBtn" aria-label="Kapat">
            <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- İki Sütunlu Gövde -->
        <div class="tmd-body">
          
          <!-- Sol Sütun: Filtreler & Konuşma Listesi -->
          <div class="tmd-sidebar">
            
            <!-- 3'lü Hızlı Filtre Sekmesi (Madde 2) -->
            <div class="tmd-filter-bar">
              <button type="button" class="tmd-filter-pill active" data-filter="all">Tümü</button>
              <button type="button" class="tmd-filter-pill" data-filter="student">Öğrenciler</button>
              <button type="button" class="tmd-filter-pill" data-filter="parent">Veliler</button>
            </div>

            <!-- Arama Kutusu -->
            <div class="tmd-search-box">
              <svg class="tmd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" class="tmd-search-input" id="tmdSearchInput" placeholder="Kişi veya mesaj ara..." autocomplete="off">
            </div>

            <!-- Konuşma Listesi -->
            <div class="tmd-conv-list" id="tmdConvList"></div>
          </div>

          <!-- Sağ Sütun: Aktif Sohbet -->
          <div class="tmd-chat-panel">
            <div class="tmd-chat-head" id="tmdChatHead"></div>
            <div class="tmd-messages-flow" id="tmdMessagesFlow"></div>
            <div class="tmd-chat-footer">
              <form class="tmd-reply-form" id="tmdReplyForm">
                <input type="text" class="tmd-reply-input" id="tmdReplyInput" placeholder="Yanıtınızı yazın (Enter ile gönder)..." required autocomplete="off">
                <button type="submit" class="tmd-send-btn">
                  <span>Gönder</span>
                  <svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </form>
            </div>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(drawerElement);
    bindDrawerEvents();
  }

  // Drawer Olay Dinleyicileri
  function bindDrawerEvents() {
    const closeBtn = document.getElementById('tmdCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    drawerElement.addEventListener('click', e => {
      if (e.target === drawerElement) closeDrawer();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawerElement.classList.contains('open')) {
        closeDrawer();
      }
    });

    // 3'lü Filtre Butonları
    const filterPills = drawerElement.querySelectorAll('.tmd-filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.dataset.filter;
        renderConversationList();
      });
    });

    // Arama Girişi
    const searchInput = document.getElementById('tmdSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderConversationList();
      });
    }

    // Cevap Gönderme Formu
    const replyForm = document.getElementById('tmdReplyForm');
    if (replyForm) {
      replyForm.addEventListener('submit', async e => {
        e.preventDefault();
        const input = document.getElementById('tmdReplyInput');
        const text = input.value.trim();
        if (!text) return;
        await sendTeacherReply(text);
        input.value = '';
        input.focus();
      });
    }
  }

  // Konuşma Listesini Render Et
  function renderConversationList() {
    const listEl = document.getElementById('tmdConvList');
    if (!listEl) return;

    let filtered = conversations;

    // Rol filtreleme
    if (activeFilter === 'student') {
      filtered = filtered.filter(c => c.roleType === 'student');
    } else if (activeFilter === 'parent') {
      filtered = filtered.filter(c => c.roleType === 'parent');
    }

    // Arama filtreleme
    if (searchQuery) {
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchQuery)) ||
        (c.studentName && c.studentName.toLowerCase().includes(searchQuery)) ||
        (c.parentRelation && c.parentRelation.toLowerCase().includes(searchQuery)) ||
        (c.messages && c.messages.some(m => m.text && m.text.toLowerCase().includes(searchQuery)))
      );
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="tmd-empty-state">
          <div class="tmd-empty-icon">🔍</div>
          <p style="font-size:12px;margin:0;">Kriterlere uygun mesaj bulunamadı.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(conv => {
      const convId = conv.conversationId || conv.id;
      const isSelected = (convId === selectedChatId) || (conv.id === selectedChatId);
      const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
      const isTeacherMsg = lastMsg && (lastMsg.senderRole === 'teacher' || lastMsg.sender === 'teacher');
      const snippet = lastMsg ? (isTeacherMsg ? 'Siz: ' : '') + lastMsg.text : 'Yeni konuşma';
      const isParent = conv.roleType === 'parent';
      const roleBadge = isParent
        ? `<span class="tmd-role-badge tmd-role-parent">👨‍👩‍👧 Veli</span>`
        : `<span class="tmd-role-badge tmd-role-student">🎒 Öğrenci</span>`;

      // Veli mesajlarında öğrencinin adı alt bilgi olarak görünsün
      const parentSub = isParent && (conv.parentRelation || conv.studentName)
        ? `<span class="tmd-parent-detail">${escapeHtml(conv.parentRelation || `${conv.studentName}'in Velisi`)}</span>`
        : '';

      const hasUnread = conv.unread || (conv.messages && conv.messages.some(m => !m.isRead && m.senderRole !== 'teacher' && m.sender !== 'teacher'));

      return `
        <div class="tmd-conv-card ${isSelected ? 'active' : ''}" data-chat-id="${convId}">
          <div class="tmd-avatar" style="background:${conv.avatarBg || '#C84B31'};">
            ${escapeHtml(conv.avatar || 'K')}
          </div>
          <div class="tmd-conv-info">
            <div class="tmd-conv-head">
              <span class="tmd-conv-name">${escapeHtml(conv.name)}</span>
              <span class="tmd-conv-time">${escapeHtml(conv.time || '')}</span>
            </div>
            ${roleBadge}
            ${parentSub}
            <p class="tmd-conv-snippet">${escapeHtml(snippet)}</p>
          </div>
          ${hasUnread ? '<span class="tmd-unread-dot" title="Okunmamış mesaj"></span>' : ''}
        </div>
      `;
    }).join('');

    // Kart tıklama olayları
    listEl.querySelectorAll('.tmd-conv-card').forEach(card => {
      card.addEventListener('click', () => {
        selectChat(card.dataset.chatId);
      });
    });
  }

  // Aktif Sohbet Penceresini Render Et
  function renderActiveChat() {
    const headEl = document.getElementById('tmdChatHead');
    const flowEl = document.getElementById('tmdMessagesFlow');
    if (!headEl || !flowEl) return;

    const currentChat = conversations.find(c => (c.conversationId || c.id) === selectedChatId || c.id === selectedChatId) || conversations[0];
    if (!currentChat) {
      headEl.innerHTML = '';
      flowEl.innerHTML = '<div class="tmd-empty-state"><p>Lütfen bir konuşma seçin.</p></div>';
      return;
    }

    const isParent = currentChat.roleType === 'parent';
    const subTitle = isParent
      ? `${escapeHtml(currentChat.name)} • ${escapeHtml(currentChat.parentRelation || `${currentChat.studentName}'in Velisi`)}`
      : `${escapeHtml(currentChat.role || 'Öğrenci')}`;

    headEl.innerHTML = `
      <div class="tmd-chat-user">
        <div class="tmd-avatar" style="background:${currentChat.avatarBg || '#C84B31'};">
          ${escapeHtml(currentChat.avatar || 'K')}
        </div>
        <div>
          <h4 class="tmd-chat-title">${escapeHtml(currentChat.name)}</h4>
          <p class="tmd-chat-subtitle">${subTitle}</p>
        </div>
      </div>
      <a href="#students" class="tmd-chat-link" id="tmdStudentDetailLink">Öğrenci Detayı ↗</a>
    `;

    const detailLink = document.getElementById('tmdStudentDetailLink');
    if (detailLink) {
      detailLink.addEventListener('click', (e) => {
        closeDrawer();
      });
    }

    const messages = currentChat.messages || [];
    flowEl.innerHTML = messages.map(msg => {
      const isTeacher = msg.senderRole === 'teacher' || msg.sender === 'teacher';
      const time = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
      const readStatus = isTeacher ? (msg.isRead ? '<span style="color:#059669;font-weight:700;margin-left:4px;">✓✓</span>' : '<span style="color:#94a3b8;margin-left:4px;">✓</span>') : '';
      return `
        <div class="tmd-bubble-row ${isTeacher ? 'teacher' : 'other'}">
          <div class="tmd-bubble">
            ${escapeHtml(msg.text)}
          </div>
          <span class="tmd-bubble-time">${escapeHtml(time)}${readStatus}</span>
        </div>
      `;
    }).join('');

    // Otomatik olarak en alta kaydır
    flowEl.scrollTop = flowEl.scrollHeight;
  }

  // Konuşma Seç ve Okundu Olarak İşaretle
  function selectChat(id) {
    selectedChatId = id;
    const current = conversations.find(c => (c.conversationId || c.id) === id || c.id === id);
    if (current) {
      current.unread = false;
      if (Array.isArray(current.messages)) {
        current.messages.forEach(m => {
          if (m.senderRole !== 'teacher' && m.sender !== 'teacher') {
            m.isRead = true;
          }
        });
      }
      saveLocalState(conversations);
      updateBadges();

      // Sunucuya ve servise bildir
      const targetConvId = current.conversationId || current.id;
      if (window.ZarifMessageService) {
        window.ZarifMessageService.markAsRead(targetConvId, 'teacher');
      } else {
        fetch('/api/messages/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: targetConvId, readerRole: 'teacher' })
        }).catch(() => {});
      }
    }
    renderConversationList();
    renderActiveChat();
  }

  // Öğretmenin Mesaj Göndermesi
  async function sendTeacherReply(text) {
    const current = conversations.find(c => (c.conversationId || c.id) === selectedChatId || c.id === selectedChatId);
    if (!current) return;

    const now = new Date();
    const isoTimestamp = now.toISOString();
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: 'msg_' + Date.now(),
      senderId: 'teacher_1',
      senderRole: 'teacher',
      sender: 'teacher',
      senderName: 'Ahmet Yılmaz',
      text: text,
      timestamp: isoTimestamp,
      time: timeStr,
      isRead: false
    };

    if (!Array.isArray(current.messages)) current.messages = [];
    current.messages.push(newMsg);
    current.time = timeStr;
    current.unread = false;

    saveLocalState(conversations);
    renderActiveChat();
    renderConversationList();

    const targetConvId = current.conversationId || current.id;
    if (window.ZarifMessageService) {
      window.ZarifMessageService.sendMessage({
        conversationId: targetConvId,
        text,
        senderId: 'teacher_1',
        senderName: 'Ahmet Yılmaz',
        senderRole: 'teacher'
      });
    } else {
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: targetConvId,
            senderId: 'teacher_1',
            senderName: 'Ahmet Yılmaz',
            senderRole: 'teacher',
            text: text
          })
        });
      } catch (e) {
        console.warn('Mesaj sunucuya iletilemedi, yerel depoda korundu:', e);
      }
    }
  }

  // Tüm Drawer'ı Yeniden Çiz
  function renderDrawer() {
    renderConversationList();
    renderActiveChat();
  }

  // Çekmeceyi Aç
  function openDrawer(filter) {
    ensureDrawerMarkup();
    if (filter && ['all', 'student', 'parent'].includes(filter)) {
      activeFilter = filter;
      const filterPills = drawerElement.querySelectorAll('.tmd-filter-pill');
      filterPills.forEach(p => {
        p.classList.toggle('active', p.dataset.filter === filter);
      });
    }
    fetchMessagesFromApi();
    drawerElement.classList.add('open');
    drawerElement.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // İlk açılışta aktif konuşmayı seç ve okundu yap
    if (selectedChatId) selectChat(selectedChatId);
    setTimeout(() => {
      const input = document.getElementById('tmdReplyInput');
      if (input) input.focus();
    }, 200);
  }

  // Çekmeceyi Kapat
  function closeDrawer() {
    if (!drawerElement) return;
    drawerElement.classList.remove('open');
    drawerElement.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Dışarıya Açılan Global Fonksiyonlar
  window.openTeacherMessagesDrawer = openDrawer;
  window.closeTeacherMessagesDrawer = closeDrawer;
  window.updateTeacherMessagesBadge = updateBadges;

  // BroadcastChannel Dinleyicisi (Sekmeler Arası Eşitleme)
  if (channel) {
    channel.onmessage = (event) => {
      const { type, data, payload } = event.data || {};
      const convList = data || payload?.conversations;
      if (Array.isArray(convList)) {
        conversations = convList;
        renderDrawer();
        updateBadges();
      } else {
        fetchMessagesFromApi();
      }
    };
  }

  // Window Storage Dinleyicisi
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY || e.key === 'zarif_msg_sync_ping') {
        conversations = loadLocalState();
        renderDrawer();
        updateBadges();
      }
    });
  }

  // Sayfa yüklendiğinde butonları bağla ve başlangıç verilerini çek
  function init() {
    conversations = loadLocalState();
    ensureDrawerMarkup();
    fetchMessagesFromApi();

    // 1. Üst Bar Mesaj Butonunu Bağla (#topMessagesBtn)
    const topBtn = document.getElementById('topMessagesBtn');
    if (topBtn) {
      topBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer('all');
      });
    }

    // 2. Sol Menü Mesaj Sekmesini Bağla (#sidebarMessagesLink)
    const sideLink = document.getElementById('sidebarMessagesLink');
    if (sideLink) {
      sideLink.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer('all');
      });
    }

    // Belirli aralıklarla yeni mesaj kontrolü (Polling)
    setInterval(() => {
      if (!drawerElement?.classList?.contains('open')) {
        fetchMessagesFromApi();
      }
    }, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
