/**
 * ZarifÇözüm Merkezi Paket Yetkilendirme & Dinamik Kilit Motoru (Student Plan Guard)
 * Admin panelinden öğrencinin paketi (free / temel / standart / vip) değiştirildiğinde
 * tüm sınıf seçicilerdeki ve özellik sekmelerindeki kilitleri otomatik olarak uygular veya kaldırır.
 */
(function (global) {
  'use strict';

  var ALL_GRADES = [5, 6, 7, 8, 9, 10, 11, 12];
  var PLAN_EVENT = 'zarif:plan-change';

  // Paket bazlı özellik yetki matrisi (Paketler.html + lib/konu-erisimi.js ile birebir uyumlu)
  // Not: Deneme Sınavları modülü kendi içinde en az 1 Ücretsiz Tanıtım Denemesini açık tutar.
  var FEATURE_RULES = {
    'asistanla-soru-coz': {
      plans: ['temel', 'standart', 'vip'],
      requiredLabel: 'Temel, Standart veya VIP Paket',
      title: 'Asistanla Görsel Soru Çözümü Kilitli',
      desc: 'Soru fotoğrafı yükleyerek adım adım yapay zekâ çözümü almak için Temel, Standart veya VIP pakete yükseltebilirsiniz.'
    },
    'yaziliya-hazirlik': {
      plans: ['temel', 'standart', 'vip'],
      requiredLabel: 'Temel, Standart veya VIP Paket',
      title: 'Yazılıya Hazırlık Modülü Kilitli',
      desc: 'Dönem yazılılarına özel hazırlık senaryoları ve çalışma kağıtları için Temel, Standart veya VIP pakete yükseltebilirsiniz.'
    },
    'live-lessons': {
      plans: ['standart', 'vip'],
      requiredLabel: 'Standart veya VIP Paket',
      title: 'Zoom Canlı Dersler Paketinizin Dışında',
      desc: 'Canlı Zoom matematik dersleri Temel ve Ücretsiz paketlere dahil değildir. Katılmak için Standart veya VIP pakete yükseltebilirsiniz.'
    },
    'video-dersler': {
      plans: ['standart', 'vip'],
      requiredLabel: 'Standart veya VIP Paket',
      title: 'Video Ders Arşivi Paketinizin Dışında',
      desc: 'Konu anlatım ve canlı ders video arşivi Standart (30 gün) ve VIP (tüm yıl) paketlerine özeldir. Üyeliğinizi yükselterek erişebilirsiniz.'
    }
  };

  var planState = {
    plan: 'free',
    isStaff: false,
    registeredGrade: 5,
    allowedGrades: [5],
    loaded: false
  };

  function normalizePlan(raw) {
    var s = String(raw || '').toLowerCase().trim();
    if (s.indexOf('vip') !== -1) return 'vip';
    if (s.indexOf('standart') !== -1 || s.indexOf('standard') !== -1 || s.indexOf('pro') !== -1) return 'standart';
    if (s.indexOf('temel') !== -1 || s.indexOf('baslangic') !== -1) return 'temel';
    return 'free';
  }

  function isGradeAllowed(grade) {
    if (planState.isStaff || planState.plan === 'vip') return true;
    return planState.allowedGrades.indexOf(Number(grade)) !== -1;
  }

  function isFeatureAllowed(sectionId) {
    if (planState.isStaff || planState.plan === 'vip') return true;
    var rule = FEATURE_RULES[sectionId];
    if (!rule) return true;
    return rule.plans.indexOf(planState.plan) !== -1;
  }

  function openUpgrade() {
    if (typeof global.openSubscriptionUpgradeModal === 'function') {
      global.openSubscriptionUpgradeModal();
    } else {
      global.location.href = '/Paketler.html?ref=plan-guard';
    }
  }

  function syncSidebarLocks() {
    Object.keys(FEATURE_RULES).forEach(function (secId) {
      var link = document.querySelector('.nav a[href="#' + secId + '"]');
      if (!link) return;
      var allowed = isFeatureAllowed(secId);
      var lockTag = link.querySelector('.zpg-nav-lock');
      if (!allowed) {
        if (!lockTag) {
          lockTag = document.createElement('span');
          lockTag.className = 'zpg-nav-lock';
          lockTag.textContent = '🔒';
          lockTag.style.cssText = 'margin-left:auto;font-size:0.78rem;opacity:0.9;';
          link.appendChild(lockTag);
        }
      } else if (lockTag) {
        lockTag.remove();
      }
    });
  }

  function syncSectionLockOverlays() {
    Object.keys(FEATURE_RULES).forEach(function (secId) {
      var sec = document.getElementById(secId);
      if (!sec) return;
      var rule = FEATURE_RULES[secId];
      var allowed = isFeatureAllowed(secId);
      var overlay = sec.querySelector('.zpg-section-lock');

      if (!allowed) {
        sec.dataset.zpgLocked = '1';
        if (!sec.style.position) sec.style.position = 'relative';
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'zpg-section-lock';
          overlay.style.cssText = [
            'margin:0 0 18px',
            'padding:18px 22px',
            'border-radius:16px',
            'background:linear-gradient(135deg,#3E2F26 0%,#2c2019 100%)',
            'border:1.5px solid #C59B47',
            'color:#FAF6F0',
            'display:flex',
            'align-items:center',
            'justify-content:space-between',
            'gap:16px',
            'flex-wrap:wrap',
            'box-shadow:0 12px 28px rgba(62,47,38,0.18)'
          ].join(';');
          sec.insertBefore(overlay, sec.firstChild);
        }
        overlay.innerHTML =
          '<div style="display:flex;align-items:center;gap:14px;flex:1;min-width:240px;">' +
            '<div style="width:44px;height:44px;border-radius:12px;background:rgba(197,155,71,0.2);border:1px solid #C59B47;display:grid;place-items:center;font-size:1.3rem;flex-shrink:0;">🔒</div>' +
            '<div>' +
              '<div style="font-size:0.74rem;font-weight:800;letter-spacing:0.4px;color:#f3d285;text-transform:uppercase;">' + rule.requiredLabel + '</div>' +
              '<strong style="display:block;font-family:Georgia,serif;font-size:1.02rem;color:#fff;margin:2px 0;">' + rule.title + '</strong>' +
              '<span style="font-size:0.83rem;color:#E8DFD5;">' + rule.desc + '</span>' +
            '</div>' +
          '</div>' +
          '<button type="button" data-zpg-upgrade style="padding:10px 18px;border-radius:11px;border:0;background:linear-gradient(135deg,#C59B47,#b08635);color:#2c2019;font-size:0.85rem;font-weight:800;cursor:pointer;white-space:nowrap;">🚀 Üyeliğini Yükselt →</button>';

        // İçeriği okunabilir tut (donuk/ölü bırakma); etkileşimde yükseltme penceresini aç
        Array.from(sec.children).forEach(function (child) {
          if (child === overlay || child.tagName === 'STYLE') return;
          child.style.opacity = '0.78';
          child.style.pointerEvents = '';
          child.style.userSelect = '';
        });

        if (!sec.dataset.zpgInterceptBound) {
          sec.dataset.zpgInterceptBound = '1';
          sec.addEventListener('click', function (e) {
            if (sec.dataset.zpgLocked !== '1') return;
            if (e.target.closest('.zpg-section-lock')) return;
            if (e.target.closest('button, a, input, select, textarea, label, [onclick]')) {
              e.preventDefault();
              e.stopPropagation();
              openUpgrade();
            }
          }, true);
          sec.addEventListener('submit', function (e) {
            if (sec.dataset.zpgLocked !== '1') return;
            e.preventDefault();
            e.stopPropagation();
            openUpgrade();
          }, true);
        }
      } else {
        delete sec.dataset.zpgLocked;
        if (overlay) overlay.remove();
        Array.from(sec.children).forEach(function (child) {
          if (child.tagName === 'STYLE') return;
          child.style.opacity = '';
          child.style.pointerEvents = '';
          child.style.userSelect = '';
        });
      }
    });
  }

  function syncAllGradeSelectors() {
    var selectorIds = ['kcGradeSelect', 'studentAiGradeSelect', 'stmGradeSelect', 'gzGrade', 'videoGradeFilter'];
    selectorIds.forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel || sel.tagName !== 'SELECT') return;

      Array.from(sel.options).forEach(function (opt) {
        var g = parseInt(opt.value, 10);
        if (!g || g < 5 || g > 12) return;
        var allowed = isGradeAllowed(g);
        var baseText = opt.textContent.replace(/\s*🔒\s*/g, '').trim();
        opt.textContent = allowed ? baseText : (baseText + ' 🔒');
      });

      // Eğer mevcut seçili sınıf kilitliyse öğrencinin kayıtlı sınıfına çek
      var curVal = parseInt(sel.value, 10);
      if (curVal >= 5 && curVal <= 12 && !isGradeAllowed(curVal)) {
        sel.value = String(planState.registeredGrade);
      }

      if (!sel.dataset.zpgBound) {
        sel.dataset.zpgBound = '1';
        sel.addEventListener('change', function (e) {
          var chosen = parseInt(sel.value, 10);
          if (chosen >= 5 && chosen <= 12 && !isGradeAllowed(chosen)) {
            e.stopImmediatePropagation();
            sel.value = String(planState.registeredGrade);
            openUpgrade();
          }
        }, true);
      }
    });
  }

  function readKesifModuProgress() {
    try {
      var raw = global.localStorage && global.localStorage.getItem('zc_kesif_modu_v1');
      var arr = raw ? JSON.parse(raw) : [];
      var list = Array.isArray(arr) ? arr : [];
      return { ids: list, count: Math.min(4, list.length), xp: Math.min(4, list.length) * 25 };
    } catch (e) {
      return { ids: [], count: 0, xp: 0 };
    }
  }

  function syncKesifXpToGamification(ids) {
    if (!ids.length || !global.ZarifGamification || typeof global.ZarifGamification.awardXp !== 'function') return;
    try {
      var syncKey = 'zc_kesif_synced_gamify_v1';
      var synced = JSON.parse(global.localStorage.getItem(syncKey) || '[]');
      if (!Array.isArray(synced)) synced = [];
      var changed = false;
      ids.forEach(function (id) {
        if (synced.indexOf(id) === -1) {
          synced.push(id);
          changed = true;
          global.ZarifGamification.awardXp({
            amount: 25,
            reason: 'Keşif Modu oyunu tamamlandı',
            silent: true
          });
        }
      });
      if (changed) {
        global.localStorage.setItem(syncKey, JSON.stringify(synced));
        if (typeof global.ZarifGamification.renderAllMounts === 'function') {
          global.ZarifGamification.renderAllMounts();
        }
      }
    } catch (e) {}
  }

  function syncKesifModuMenuVisibility() {
    var navItem = document.getElementById('navItemKesifModu');
    var navLink = document.getElementById('navLinkKesifModu');
    var sideBadge = document.getElementById('kesifModuSideBadge');
    var dashWidget = document.getElementById('kesifModuDashboardWidget');
    var dashXpChip = document.getElementById('kesifDashXpChip');
    var dashSummary = document.getElementById('kesifDashSummary');
    var dashFill = document.getElementById('kesifDashFill');
    var dashCta = document.getElementById('kesifDashCta');

    var g = Number(planState.registeredGrade);
    var isMiddleSchool = (g >= 5 && g <= 8);
    var shouldShow = isMiddleSchool || planState.isStaff;
    var targetHref = 'kesif-modu.html?sinif=' + (isMiddleSchool ? g : 5);

    var prog = readKesifModuProgress();
    syncKesifXpToGamification(prog.ids);

    if (navItem) {
      navItem.style.display = shouldShow ? '' : 'none';
      navItem.hidden = !shouldShow;
    }
    if (navLink) navLink.href = targetHref;
    if (sideBadge) {
      sideBadge.textContent = prog.xp > 0 ? (prog.count + '/4 · ' + prog.xp + ' XP') : (prog.count + '/4');
    }

    if (dashWidget) {
      dashWidget.style.display = shouldShow ? 'block' : 'none';
    }
    if (dashXpChip) dashXpChip.textContent = '⚡ ' + prog.xp + ' Keşif XP';
    if (dashSummary) dashSummary.textContent = prog.count + ' / 4 Oyun Tamamlandı • ' + prog.xp + ' Keşif XP';
    if (dashFill) dashFill.style.width = Math.round((prog.count / 4) * 100) + '%';
    if (dashCta) dashCta.href = targetHref;
  }

  function applyAllLocks() {
    syncSidebarLocks();
    syncSectionLockOverlays();
    syncAllGradeSelectors();
    syncKesifModuMenuVisibility();
    try {
      if (global.localStorage && planState.registeredGrade >= 5) {
        global.localStorage.setItem('zarif_student_grade', String(planState.registeredGrade));
      }
    } catch (e) {}
    global.dispatchEvent(new CustomEvent(PLAN_EVENT, { detail: Object.assign({}, planState) }));
  }

  async function refreshFromServer() {
    try {
      var params = new URLSearchParams(global.location.search || '');
      var previewId = params.get('previewUserId');
      var url = '/api/student/topics' + (previewId ? ('?previewUserId=' + encodeURIComponent(previewId)) : '');
      var res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return planState;
      var data = await res.json();
      if (data && data.access) {
        var acc = data.access;
        var nextPlan = normalizePlan(acc.plan);
        var nextStaff = Boolean(acc.isStaff);
        var nextReg = (Number(acc.registeredGrade) >= 5 && Number(acc.registeredGrade) <= 12)
          ? Number(acc.registeredGrade)
          : planState.registeredGrade;
        var nextAllowed = nextStaff || nextPlan === 'vip'
          ? ALL_GRADES.slice()
          : (Array.isArray(acc.allowedGrades) && acc.allowedGrades.length
              ? acc.allowedGrades.map(Number)
              : [nextReg]);

        var changed = !planState.loaded ||
          planState.plan !== nextPlan ||
          planState.isStaff !== nextStaff ||
          planState.registeredGrade !== nextReg ||
          planState.allowedGrades.join(',') !== nextAllowed.join(',');

        planState.plan = nextPlan;
        planState.isStaff = nextStaff;
        planState.registeredGrade = nextReg;
        planState.allowedGrades = nextAllowed;
        planState.loaded = true;

        if (changed) applyAllLocks();
      }
    } catch (e) {}
    return planState;
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest('[data-zpg-upgrade]')) {
      openUpgrade();
    }
  });

  function init() {
    refreshFromServer();
    global.addEventListener('focus', function () {
      refreshFromServer();
      syncKesifModuMenuVisibility();
    });
    global.addEventListener('storage', function (e) {
      if (e && e.key === 'zc_kesif_modu_v1') syncKesifModuMenuVisibility();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshFromServer();
    });
    // Admin paket değiştirdiğinde en geç 25 sn içinde otomatik senkronize et
    setInterval(refreshFromServer, 25000);
  }

  global.ZarifPlanGuard = {
    getState: function () { return Object.assign({}, planState); },
    isGradeAllowed: isGradeAllowed,
    isFeatureAllowed: isFeatureAllowed,
    refresh: refreshFromServer,
    applyAllLocks: applyAllLocks
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
