// Öğretmen Paneli Sol Üst Profil Kartı & Avatar Yükleyici
// Ana panel betiğinden tamamen bağımsız çalışır; diğer modüllerdeki olası hatalardan etkilenmez.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function showToast(message, isError = false) {
    let el = document.getElementById('zarifProfileToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'zarifProfileToast';
      el.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:99999;padding:11px 16px;border-radius:10px;font-size:13.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.22);transition:opacity .25s ease;max-width:340px;font-family:Inter,system-ui,sans-serif';
      document.body.appendChild(el);
    }
    el.style.background = isError ? '#991b1b' : '#2c1a0e';
    el.style.color = '#fff';
    el.style.border = isError ? '1px solid #fecaca' : '1px solid #c2570c';
    el.textContent = message;
    el.style.opacity = '1';
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 260);
    }, isError ? 5000 : 3200);
  }

  function computeInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
    if (parts.length === 1 && parts[0].length > 0) return parts[0].slice(0, 2).toUpperCase();
    return 'Ö';
  }

  function applyProfileToUI(user) {
    const dbName = user?.name || user?.adSoyad || user?.fullName || '';
    const cachedName = typeof localStorage !== 'undefined' ? (localStorage.getItem('zarif_teacher_name') || '') : '';
    const name = (dbName || cachedName || user?.email?.split('@')[0] || 'Öğretmen').trim();

    const dbBranch = user?.branch || user?.brans || '';
    const cachedBranch = typeof localStorage !== 'undefined' ? (localStorage.getItem('zarif_teacher_branch') || '') : '';
    const branch = (dbBranch || cachedBranch || 'Matematik Öğretmeni').trim();

    const dbAvatar = user?.avatarUrl || user?.photo || user?.profileImage || user?.avatar || '';
    const cachedAvatar = typeof localStorage !== 'undefined' ? (localStorage.getItem('zarif_teacher_avatar') || '') : '';
    const avatar = dbAvatar || cachedAvatar || '';

    if (typeof localStorage !== 'undefined') {
      try {
        if (dbName && dbName !== 'Öğretmen') localStorage.setItem('zarif_teacher_name', dbName);
        if (dbBranch) localStorage.setItem('zarif_teacher_branch', dbBranch);
        if (dbAvatar) localStorage.setItem('zarif_teacher_avatar', dbAvatar);
      } catch (e) {}
    }

    if ($('sidebarCardTeacherName')) $('sidebarCardTeacherName').textContent = name;
    if ($('sidebarCardTeacherBranch')) $('sidebarCardTeacherBranch').textContent = branch;
    if ($('teacherName')) $('teacherName').textContent = name;
    if ($('dashboardGreeting')) $('dashboardGreeting').textContent = `Merhaba, ${name}`;

    const initials = computeInitials(name);
    if ($('sidebarTeacherAvatarFallback')) $('sidebarTeacherAvatarFallback').textContent = initials;
    if ($('teacherAvatar')) $('teacherAvatar').textContent = initials;

    const imgEl = $('sidebarTeacherAvatarImg');
    const fbEl = $('sidebarTeacherAvatarFallback');
    if (imgEl && fbEl) {
      if (avatar && avatar.length > 5) {
        imgEl.src = avatar;
        imgEl.style.display = 'block';
        fbEl.style.display = 'none';
      } else {
        imgEl.style.display = 'none';
        fbEl.style.display = 'block';
      }
    }
  }

  window.syncTeacherProfileCard = applyProfileToUI;

  async function fetchCurrentTeacher() {
    // Önce varsa önbellekten anlık çizim yap (ekran titremesin)
    applyProfileToUI({});

    try {
      const res = await fetch('/api/user/profile', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.user) {
          window.currentTeacherUser = { ...(window.currentTeacherUser || {}), ...data.user };
          applyProfileToUI(data.user);
          return;
        }
      }
    } catch (e) {}

    // Yedek: /me uç noktasından çek
    try {
      const res = await fetch('/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.user) {
          window.currentTeacherUser = { ...(window.currentTeacherUser || {}), ...data.user };
          applyProfileToUI(data.user);
        }
      }
    } catch (e) {
      console.warn('Öğretmen profil bilgisi alınamadı:', e.message);
    }
  }

  function resizeImageToBase64(file, maxSize = 400, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Görsel dosyası okunamadı.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Görsel işlenemedi. Lütfen farklı bir resim seçin.'));
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxSize || h > maxSize) {
            if (w >= h) {
              h = Math.round((h * maxSize) / w);
              w = maxSize;
            } else {
              w = Math.round((w * maxSize) / h);
              h = maxSize;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
          } catch (err) {
            reject(new Error('Görsel dönüştürülemedi.'));
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function bindAvatarUpload() {
    const input = $('teacherAvatarFileInput');
    const trigger = $('teacherAvatarUploadTrigger');
    if (!input || !trigger) return;

    // Trigger <label for="teacherAvatarFileInput"> ise yerel olarak zaten açar;
    // div olarak kalmışsa sadece input dışındaki tıklamalarda tetikle.
    if (trigger.tagName !== 'LABEL') {
      trigger.addEventListener('click', e => {
        if (e.target === input) return;
        input.click();
      });
    }

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith('image/')) {
        showToast('Lütfen geçerli bir resim dosyası seçin (JPG, PNG, WEBP).', true);
        input.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('Seçilen fotoğraf 10 MB sınırını aşıyor.', true);
        input.value = '';
        return;
      }

      const overlay = $('avatarHoverOverlay');
      if (overlay) {
        overlay.style.opacity = '1';
        overlay.innerHTML = '<span style="font-size:10px;font-weight:700;color:#fff">Yükleniyor…</span>';
      }

      try {
        const base64Url = await resizeImageToBase64(file, 400, 0.85);

        const res = await fetch('/api/user/avatar', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarUrl: base64Url })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.mesaj || `Sunucu hatası (${res.status})`);
        }

        const savedUrl = data.avatarUrl || base64Url;
        window.currentTeacherUser = { ...(window.currentTeacherUser || {}), avatarUrl: savedUrl };
        try { localStorage.setItem('zarif_teacher_avatar', savedUrl); } catch (e) {}
        applyProfileToUI(window.currentTeacherUser);
        window.dispatchEvent(new CustomEvent('teacher-avatar-updated'));
        showToast('✓ Profil fotoğrafınız güncellendi.');
      } catch (err) {
        console.error('Avatar yükleme hatası:', err);
        showToast('Fotoğraf yüklenemedi: ' + err.message, true);
      } finally {
        if (overlay) {
          overlay.style.opacity = '';
          overlay.innerHTML = '<svg style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span style="font-size:9px;font-weight:700;letter-spacing:0.3px;color:#fff">Yükle</span>';
        }
        input.value = '';
      }
    });
  }

  function init() {
    bindAvatarUpload();
    fetchCurrentTeacher();
    window.addEventListener('storage', e => {
      if (e.key === 'zarif_teacher_avatar' || e.key === 'zarif_teacher_name' || e.key === 'zarif_teacher_branch') {
        applyProfileToUI({});
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
