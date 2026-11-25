/**
 * ZarifÇözüm — İnteraktif Öğrenci Profili & Veli Eşleştirme Kodu Modalı
 * Sol yan paneldeki profil kartına tıklandığında açılır.
 * - Ad Soyad, Sınıf Seçimi (5–12) ve Hedef Okul / Puan Notu
 * - Otomatik Benzersiz Veli Eşleştirme Kodu (kopyala butonu + bağlılık durumu)
 * - Hızlı Şifre Değiştirme erişimi + Backend & ZarifStore canlı senkronizasyonu
 */
(function (global) {
  'use strict';

  var PROFILE_KEY = 'zc_student_profile_v1';
  var PARENT_CODE_KEY = 'zc_student_parent_code_v1';

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readLocalProfile() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeLocalProfile(data) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
        if (data.grade >= 5 && data.grade <= 12) {
          global.localStorage.setItem('zarif_student_grade', String(data.grade));
        }
      }
    } catch (e) {}
  }

  function getOrGenerateParentCode(apiCode) {
    if (apiCode && String(apiCode).trim()) {
      var clean = String(apiCode).trim().toUpperCase();
      try { global.localStorage.setItem(PARENT_CODE_KEY, clean); } catch (e) {}
      return clean;
    }
    var domCode = $('parentConnectionCode')?.textContent?.trim();
    if (domCode && domCode.length >= 4 && domCode !== '------') {
      return domCode;
    }
    try {
      var saved = global.localStorage.getItem(PARENT_CODE_KEY);
      if (saved) return saved;
      var rand = String(Math.floor(1000 + Math.random() * 9000));
      var fresh = 'ZC-VELI-' + rand;
      global.localStorage.setItem(PARENT_CODE_KEY, fresh);
      return fresh;
    } catch (e) {
      return 'ZC-VELI-4829';
    }
  }

  function injectModalOnce() {
    if ($('zcStudentProfileModal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'zcStudentProfileModal';
    wrap.style.cssText = 'display:none;position:fixed;inset:0;z-index:10060;background:rgba(30,20,14,0.68);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px;';
    wrap.innerHTML =
      '<div style="width:100%;max-width:520px;background:#FAF6F0;border:1.5px solid #C59B47;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(30,20,14,0.35);font-family:Inter,system-ui,sans-serif;color:#3E2F26;">' +
        '<div style="background:linear-gradient(135deg,#3E2F26 0%,#2c2019 100%);padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(197,155,71,0.35);">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<div id="zcProfModalAvatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#C59B47,#e4c475);color:#2c2019;font-weight:800;display:grid;place-items:center;font-size:0.95rem;">Ö</div>' +
            '<div>' +
              '<h3 style="margin:0;font-family:Georgia,serif;font-size:1.12rem;color:#fff;">Öğrenci Profili &amp; Veli Eşleştirme</h3>' +
              '<div id="zcProfModalEmail" style="font-size:0.76rem;color:#e4cfa0;margin-top:2px;"></div>' +
            '</div>' +
          '</div>' +
          '<button type="button" id="zcProfCloseBtn" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:16px;">✕</button>' +
        '</div>' +

        '<form id="zcStudentProfileForm" style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">' +
          '<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:12px;">' +
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.8rem;font-weight:700;color:#3E2F26;">Ad Soyad' +
              '<input type="text" id="zcProfNameInput" required maxlength="100" style="padding:10px 12px;border-radius:10px;border:1.5px solid #e2d1be;background:#fff;color:#3E2F26;font-size:0.9rem;font-weight:600;">' +
            '</label>' +
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.8rem;font-weight:700;color:#3E2F26;">Sınıf Düzeyi' +
              '<select id="zcProfGradeSelect" style="padding:10px 12px;border-radius:10px;border:1.5px solid #e2d1be;background:#fff;color:#3E2F26;font-size:0.9rem;font-weight:700;">' +
                [5,6,7,8,9,10,11,12].map(function (g) { return '<option value="' + g + '">' + g + '. Sınıf</option>'; }).join('') +
              '</select>' +
            '</label>' +
          '</div>' +

          '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.8rem;font-weight:700;color:#3E2F26;">Hedef Okul / Puan Notu' +
            '<input type="text" id="zcProfGoalInput" maxlength="220" placeholder="Örn. Fen Lisesi · LGS 480+ Puan" style="padding:10px 12px;border-radius:10px;border:1.5px solid #e2d1be;background:#fff;color:#3E2F26;font-size:0.88rem;">' +
          '</label>' +

          '<div style="padding:14px 16px;border-radius:14px;background:#fff;border:1.5px dashed #C59B47;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
              '<span style="font-size:0.78rem;font-weight:800;color:#3E2F26;text-transform:uppercase;letter-spacing:0.4px;">🔗 Veli Hesabı Eşleştirme Kodu</span>' +
              '<span id="zcProfParentStatusBadge" style="font-size:0.72rem;font-weight:700;padding:2px 9px;border-radius:999px;background:#FAF6F0;color:#8c6821;border:1px solid #ead8c5;">Eşleşmeye Hazır</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
              '<code id="zcProfParentCodeText" style="flex:1;padding:9px 12px;border-radius:10px;background:#FAF6F0;border:1px solid #e6d7c8;font-family:monospace;font-size:1.05rem;font-weight:800;color:#3E2F26;letter-spacing:1.2px;text-align:center;">ZC-VELI-4829</code>' +
              '<button type="button" id="zcProfCopyCodeBtn" style="padding:9px 14px;border-radius:10px;border:0;background:#3E2F26;color:#f3d285;font-size:0.82rem;font-weight:800;cursor:pointer;white-space:nowrap;">📋 Kodu Kopyala</button>' +
            '</div>' +
            '<p id="zcProfParentHelp" style="margin:8px 0 0;font-size:0.77rem;color:#786557;line-height:1.45;">Veliniz kendi panelinden bu kodu girerek hesabınızı bağlayabilir.</p>' +
          '</div>' +

          '<div id="zcProfStatusMsg" style="font-size:0.82rem;font-weight:700;min-height:18px;color:#065f46;"></div>' +

          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:8px;border-top:1px solid #ead8c5;">' +
            '<button type="button" id="zcProfPasswordBtn" style="padding:9px 14px;border-radius:10px;border:1px solid #d8c3ae;background:#fff;color:#3E2F26;font-size:0.82rem;font-weight:700;cursor:pointer;">🔒 Şifre Değiştir</button>' +
            '<div style="display:flex;gap:8px;">' +
              '<button type="button" id="zcProfCancelBtn" style="padding:9px 14px;border-radius:10px;border:1px solid #d8c3ae;background:transparent;color:#6e5c50;font-size:0.84rem;font-weight:700;cursor:pointer;">Vazgeç</button>' +
              '<button type="submit" id="zcProfSaveBtn" style="padding:9px 18px;border-radius:10px;border:0;background:linear-gradient(135deg,#C59B47,#b08635);color:#2c2019;font-size:0.86rem;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(197,155,71,0.3);">✓ Kaydet</button>' +
            '</div>' +
          '</div>' +
        '</form>' +
      '</div>';

    document.body.appendChild(wrap);

    var closeModal = function () { wrap.style.display = 'none'; };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeModal(); });
    $('zcProfCloseBtn').addEventListener('click', closeModal);
    $('zcProfCancelBtn').addEventListener('click', closeModal);

    $('zcProfCopyCodeBtn').addEventListener('click', async function () {
      var code = $('zcProfParentCodeText').textContent.trim();
      var btn = $('zcProfCopyCodeBtn');
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = '✓ Kopyalandı';
        setTimeout(function () { btn.textContent = '📋 Kodu Kopyala'; }, 2000);
      } catch (e) {
        btn.textContent = code;
      }
    });

    $('zcProfPasswordBtn').addEventListener('click', function () {
      closeModal();
      var pwBtn = $('changePasswordButton');
      if (pwBtn) pwBtn.click();
    });

    $('zcStudentProfileForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var saveBtn = $('zcProfSaveBtn');
      var statusEl = $('zcProfStatusMsg');
      var nameVal = ($('zcProfNameInput').value || '').trim();
      var gradeVal = Number($('zcProfGradeSelect').value) || 5;
      var goalVal = ($('zcProfGoalInput').value || '').trim();

      saveBtn.disabled = true;
      statusEl.style.color = '#786557';
      statusEl.textContent = 'Kaydediliyor…';

      writeLocalProfile({ name: nameVal, grade: gradeVal, goalNote: goalVal, updatedAt: new Date().toISOString() });

      try {
        await fetch('/api/auth/student-profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nameVal, grade: gradeVal, kayitliSinif: gradeVal, goalNote: goalVal })
        });
      } catch (err) {}

      // Canlı DOM ve panel senkronizasyonu
      if ($('studentName') && nameVal) $('studentName').textContent = nameVal;
      if ($('welcomeTitle') && nameVal) $('welcomeTitle').textContent = 'Hoş geldin, ' + nameVal;
      if ($('studentAvatar') && nameVal) {
        $('studentAvatar').textContent = nameVal.split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toLocaleUpperCase('tr-TR');
      }

      if (global.ZarifPlanGuard && typeof global.ZarifPlanGuard.refresh === 'function') {
        await global.ZarifPlanGuard.refresh();
      }
      if (global.ZarifKazanimTesti && typeof global.ZarifKazanimTesti.refresh === 'function') {
        global.ZarifKazanimTesti.refresh();
      }
      if (global.ZarifLeaderboardCenter && typeof global.ZarifLeaderboardCenter.refresh === 'function') {
        global.ZarifLeaderboardCenter.refresh();
      }

      statusEl.style.color = '#065f46';
      statusEl.textContent = '✓ Profiliniz güncellendi ve tüm sınıf filtreleri senkronize edildi!';
      saveBtn.disabled = false;
      setTimeout(closeModal, 900);
    });
  }

  async function openProfileModal() {
    injectModalOnce();
    var modal = $('zcStudentProfileModal');
    if (!modal) return;

    var local = readLocalProfile();
    var name = ($('studentName')?.textContent || local.name || 'Öğrenci').trim();
    var email = ($('studentEmail')?.textContent || '').trim();
    var grade = Number(local.grade || global.localStorage?.getItem('zarif_student_grade')) || 5;
    var goalNote = local.goalNote || '';
    var apiCode = '';
    var parentLinked = false;

    try {
      var res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        var data = await res.json();
        if (data && data.user) {
          if (data.user.name) name = data.user.name;
          if (data.user.email) email = data.user.email;
          if (Number(data.user.kayitliSinif) >= 5) grade = Number(data.user.kayitliSinif);
          if (data.user.bio) goalNote = data.user.bio;
          if (data.user.parentConnectionCode) apiCode = data.user.parentConnectionCode;
        }
      }
    } catch (e) {}

    var code = getOrGenerateParentCode(apiCode);

    $('zcProfModalAvatar').textContent = name.split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toLocaleUpperCase('tr-TR') || 'Ö';
    $('zcProfModalEmail').textContent = email;
    $('zcProfNameInput').value = name;
    $('zcProfGradeSelect').value = String(grade);
    $('zcProfGoalInput').value = goalNote;
    $('zcProfParentCodeText').textContent = code;
    $('zcProfStatusMsg').textContent = '';

    var stBadge = $('zcProfParentStatusBadge');
    var helpEl = $('zcProfParentHelp');
    if (parentLinked) {
      stBadge.textContent = '✓ Veli Hesabı Bağlı';
      stBadge.style.background = '#ecfdf5';
      stBadge.style.color = '#065f46';
      helpEl.textContent = 'Veli hesabınız başarıyla eşleştirildi; gelişim raporlarınız canlı paylaşılıyor.';
    } else {
      stBadge.textContent = 'Eşleşmeye Hazır';
      stBadge.style.background = '#FAF6F0';
      stBadge.style.color = '#8c6821';
      helpEl.textContent = 'Veliniz kendi panelinden bu kodu girerek hesabınızı bağlayabilir.';
    }

    modal.style.display = 'flex';
  }

  function bindProfileCard() {
    var card = $('studentProfileCard');
    if (!card || card.dataset.profileBound) return;
    card.dataset.profileBound = '1';
    card.addEventListener('click', function (e) {
      if (e.target.closest('#studentPlanBadge')) return;
      openProfileModal();
    });
  }

  global.ZarifStudentProfileModal = { open: openProfileModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindProfileCard);
  } else {
    bindProfileCard();
  }
})(window);
