(function () {
  const root = document.querySelector('[data-live-ai-panel]');
  if (!root || !window.zarifAiChat) return;

  const floating = root.dataset.floating === 'true';
  root.classList.add('live-ai-panel');
  if (floating) root.classList.add('is-floating');
  root.innerHTML = `
    ${floating ? '<button class="live-ai-toggle" type="button" aria-expanded="false">AI Mentör</button>' : ''}
    <section class="live-ai-card" ${floating ? 'hidden' : ''} aria-label="Canlı ders AI Mentör">
      <header class="live-ai-header">
        <div><strong>AI Mentör</strong><small>Yanıtlarınızı yalnızca siz görebilirsiniz.</small></div>
        <div class="live-ai-actions">
          <button class="live-ai-delete" type="button">Geçmişi sil</button>
          ${floating ? '<button class="live-ai-close" type="button" aria-label="Paneli kapat">×</button>' : ''}
        </div>
      </header>
      <p class="live-ai-status" role="status">Canlı ders odasına bağlanılıyor…</p>
      <button class="live-ai-older" type="button" hidden>Daha eski mesajları yükle</button>
      <div class="live-ai-messages" aria-live="polite"></div>
      <form class="live-ai-form">
        <textarea name="message" rows="2" maxlength="4000" required placeholder="Mentöre sorunuzu yazın…" aria-label="AI Mentör mesajı"></textarea>
        <button type="submit">Gönder</button>
      </form>
    </section>
  `;

  const card = root.querySelector('.live-ai-card');
  const messages = root.querySelector('.live-ai-messages');
  const status = root.querySelector('.live-ai-status');
  const olderButton = root.querySelector('.live-ai-older');
  const form = root.querySelector('.live-ai-form');
  const input = form.elements.message;
  const sendButton = form.querySelector('button[type="submit"]');
  const toggle = root.querySelector('.live-ai-toggle');
  const deleteButton = root.querySelector('.live-ai-delete');
  let roomId = '';
  let nextBefore = null;
  let hasMore = false;
  let loadingOlder = false;

  function createMessage(role, text, richHtml) {
    const bubble = document.createElement('article');
    bubble.className = `live-ai-message is-${role}`;
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'Sen' : role === 'ai' ? 'AI Mentör' : 'Bilgi';
    const content = document.createElement('div');
    content.className = 'live-ai-content';
    if (role === 'ai' && richHtml && window.zarifRichContent?.render(content, richHtml)) {
      content.classList.add('has-rich-content');
    } else {
      content.textContent = text;
    }
    bubble.append(label, content);
    return bubble;
  }

  function addMessage(role, text, richHtml) {
    const bubble = createMessage(role, text, richHtml);
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function appendStoredMessage(record, prepend) {
    const bubble = createMessage(record.sender, record.message, record.richHtml);
    if (prepend) messages.prepend(bubble);
    else {
      messages.append(bubble);
      messages.scrollTop = messages.scrollHeight;
    }
  }

  function showHistory(result, prepend) {
    const records = result.messages || [];
    const fragment = document.createDocumentFragment();
    for (const record of records) {
      fragment.append(createMessage(record.sender, record.message, record.richHtml));
    }
    if (prepend) messages.prepend(fragment);
    else {
      messages.append(fragment);
      messages.scrollTop = messages.scrollHeight;
    }
    hasMore = result.hasMore;
    nextBefore = result.nextBefore;
    olderButton.hidden = !hasMore;
  }

  async function loadHistory(before) {
    const result = await window.zarifAiChat.loadHistory({ roomId, before });
    showHistory(result, Boolean(before));
    if (!before && result.messages?.length) status.textContent = 'Son ders mesajları yüklendi.';
    else if (!before) status.textContent = 'AI Mentör hazır.';
  }

  async function connectToRoom(id) {
    roomId = String(id || '');
    if (!roomId) return;
    try {
      const result = await window.zarifAiChat.joinRoom(roomId);
      root.hidden = false;
      status.textContent = 'Ders odasına bağlandınız. Sohbet geçmişiniz size özeldir.';
      showHistory(result, false);
    } catch (error) {
      root.hidden = false;
      status.textContent = error.message || 'Canlı ders odasına bağlanılamadı.';
      form.hidden = true;
      olderButton.hidden = true;
    }
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      card.hidden = !card.hidden;
      toggle.setAttribute('aria-expanded', String(!card.hidden));
    });
    root.querySelector('.live-ai-close').addEventListener('click', () => {
      card.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  deleteButton.addEventListener('click', async () => {
    if (!window.confirm('Bu sohbetin size özel geçmişi kalıcı olarak silinsin mi?')) return;
    deleteButton.disabled = true;
    try {
      await window.zarifAiChat.deleteHistory({ roomId });
      messages.replaceChildren();
      nextBefore = null;
      hasMore = false;
      olderButton.hidden = true;
      status.textContent = 'Sohbet geçmişiniz silindi.';
    } catch (error) {
      status.textContent = error.message || 'Sohbet geçmişi silinemedi.';
    } finally {
      deleteButton.disabled = false;
    }
  });

  window.addEventListener('zarif-history-deleted', event => {
    if (event.detail?.roomId && event.detail.roomId === roomId) {
      messages.replaceChildren();
      nextBefore = null;
      hasMore = false;
      olderButton.hidden = true;
    }
  });

  olderButton.addEventListener('click', async () => {
    if (!hasMore || !nextBefore || loadingOlder) return;
    loadingOlder = true;
    olderButton.disabled = true;
    const previousHeight = messages.scrollHeight;
    try {
      await loadHistory(nextBefore);
      messages.scrollTop += messages.scrollHeight - previousHeight;
    } catch (error) {
      status.textContent = error.message || 'Eski mesajlar yüklenemedi.';
    } finally {
      loadingOlder = false;
      olderButton.disabled = false;
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const ogrenciMesaji = input.value.trim();
    if (!ogrenciMesaji || sendButton.disabled) return;

    input.value = '';
    sendButton.disabled = true;
    status.textContent = 'AI Mentör yanıt hazırlıyor…';
    addMessage('user', ogrenciMesaji);
    try {
      const result = await window.zarifAiChat.sendMessage({
        roomId,
        ogrenciMesaji,
        gorevTuru: 'ai_mentor'
      });
      addMessage('ai', result.yanit, result.yanitHtml);
      status.textContent = 'AI Mentör hazır.';
    } catch (error) {
      addMessage('notice', error.message || 'AI Mentör şu anda yanıt veremiyor.');
      status.textContent = 'Mesaj gönderilemedi.';
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  });

  window.addEventListener('zarif-room-history', event => {
    if (event.detail?.roomId !== roomId) return;
    messages.replaceChildren();
    showHistory(event.detail, false);
  });

  window.addEventListener('zarif-chat-message', event => {
    const data = event.detail;
    if (!roomId || data?.roomId !== roomId) return;
    if (data.userMessage) appendStoredMessage(data.userMessage, false);
    if (data.aiMessage) appendStoredMessage(data.aiMessage, false);
  });

  window.liveAiPanel = {
    setRoomId: connectToRoom,
    async leaveRoom() {
      if (!roomId) return;
      const currentRoomId = roomId;
      roomId = '';
      try {
        await window.zarifAiChat.leaveRoom(currentRoomId);
      } catch (error) {
        status.textContent = error.message || 'Ders odasından çıkılamadı.';
      }
      root.hidden = true;
    }
  };

  window.addEventListener('pagehide', () => {
    if (roomId) window.zarifAiChat.leaveRoom(roomId).catch(() => {});
  });
})();
