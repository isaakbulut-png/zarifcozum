(function () {
  const pending = new Map();
  let sequence = 0;
  const socket = typeof window.io === 'function' ? window.io({ withCredentials: true }) : null;
  let joinedRoomId = null;

  function acknowledge(event, payload) {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Gerçek zamanlı sohbet bağlantısı yüklenemedi.'));
        return;
      }
      socket.timeout(10000).emit(event, payload, (timeoutError, result) => {
        if (timeoutError) {
          reject(new Error('Sohbet sunucusundan zamanında yanıt alınamadı.'));
        } else if (!result?.success) {
          const error = new Error(result?.error || 'İşlem tamamlanamadı.');
          error.status = result?.status;
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  function rejectPending(requestId, message, status) {
    const request = pending.get(requestId);
    if (!request) return;
    clearTimeout(request.connectionTimer);
    clearTimeout(request.responseTimer);
    pending.delete(requestId);
    const error = new Error(message || 'AI Mentör şu anda yanıt veremiyor.');
    error.status = status;
    request.reject(error);
  }

  if (socket) {
    socket.on('connect', () => {
      if (joinedRoomId) {
        acknowledge('join-room', joinedRoomId).then(result => {
          window.dispatchEvent(new CustomEvent('zarif-room-history', { detail: result }));
        }).catch(error => {
          window.dispatchEvent(new CustomEvent('zarif-chat-error', { detail: error.message }));
        });
      }
    });

    socket.on('receive-message', data => {
      const request = pending.get(data?.requestId);
      if (!request) {
        window.dispatchEvent(new CustomEvent('zarif-chat-message', { detail: data }));
        return;
      }
      clearTimeout(request.connectionTimer);
      clearTimeout(request.responseTimer);
      pending.delete(data.requestId);
      request.resolve(data);
    });

    socket.on('chat-error', data => {
      rejectPending(data?.requestId, data?.error, data?.status);
    });

    socket.on('history-deleted', data => {
      window.dispatchEvent(new CustomEvent('zarif-history-deleted', { detail: data }));
    });
  }

  window.zarifAiChat = {
    joinRoom(roomId) {
      if (!roomId) return Promise.reject(new Error('Canlı ders odası kimliği bulunamadı.'));
      joinedRoomId = String(roomId);
      return acknowledge('join-room', joinedRoomId);
    },
    leaveRoom(roomId = joinedRoomId) {
      if (!socket || !roomId) return Promise.resolve();
      if (String(roomId) === joinedRoomId) joinedRoomId = null;
      return acknowledge('leave-room', { roomId: String(roomId) });
    },
    loadHistory({ roomId, before } = {}) {
      const payload = {};
      if (roomId) payload.roomId = String(roomId);
      if (before) payload.before = before;
      return acknowledge('load-history', payload);
    },
    deleteHistory({ roomId } = {}) {
      return acknowledge('delete-history', roomId ? { roomId: String(roomId) } : {});
    },
    sendMessage(payload) {
      if (!socket) return Promise.reject(new Error('Gerçek zamanlı sohbet bağlantısı yüklenemedi.'));

      return new Promise((resolve, reject) => {
        const requestId = typeof window.crypto?.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `${Date.now()}:${++sequence}`;
        const request = { resolve, reject, sent: false };
        pending.set(requestId, request);

        request.connectionTimer = setTimeout(() => {
          rejectPending(requestId, 'Sohbet sunucusuna bağlanılamadı.', 503);
        }, 10000);
        request.responseTimer = setTimeout(() => {
          rejectPending(requestId, 'AI Mentör yanıtı zaman aşımına uğradı.', 504);
        }, 130000);

        const send = () => {
          if (request.sent || !pending.has(requestId)) return;
          request.sent = true;
          clearTimeout(request.connectionTimer);
          socket.emit('send-message', { ...payload, requestId }, result => {
            if (result?.success === false) {
              rejectPending(requestId, result.error, result.status);
            }
          });
        };

        if (socket.connected) send();
        else socket.once('connect', send);
      });
    }
  };
})();
