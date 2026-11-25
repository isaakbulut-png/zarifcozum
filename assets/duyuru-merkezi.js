/**
 * ZarifÇözüm — Modern Duyurular Merkezi & Canlı Kırmızı Bildirim Rozeti
 * Hem Öğrenci Paneli (#duyuruMerkeziRoot) hem Veli Paneli (#parentDuyuruMerkeziRoot)
 * üzerinde ortak çalışır.
 */
(function (global) {
  'use strict';

  var CAT_META = {
    genel: { label: '📢 Genel', color: '#3E2F26', bg: '#f3ece4' },
    sinav: { label: '📝 Sınav & Deneme', color: '#C59B47', bg: '#fdf6e7' },
    canli: { label: '🎥 Canlı Ders', color: '#2D8CFF', bg: '#eaf3ff' },
    yenilik: { label: '✨ Yenilikler', color: '#059669', bg: '#ecfdf5' }
  };

  var state = {
    role: 'student',
    category: 'all',
    expandedId: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatTimeAgo(iso) {
    try {
      var d = new Date(iso);
      var diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
      if (diffMin < 2) return 'Az önce';
      if (diffMin < 60) return diffMin + ' dk önce';
      var diffHr = Math.round(diffMin / 60);
      if (diffHr < 24) return diffHr + ' saat önce';
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Güncel';
    }
  }

  function injectStylesOnce() {
    if ($('zcAnnCenterStyles')) return;
    var st = document.createElement('style');
    st.id = 'zcAnnCenterStyles';
    st.textContent = [
      '.zc-red-badge,.vp-red-badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#EF4444;color:#fff;font-size:0.7rem;font-weight:800;margin-left:auto;box-shadow:0 0 0 0 rgba(239,68,68,0.65);animation:zcRedPulse 1.8s infinite;}',
      '.zc-red-badge[hidden],.vp-red-badge[hidden]{display:none !important;}',
      '@keyframes zcRedPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.65);}70%{box-shadow:0 0 0 8px rgba(239,68,68,0);}100%{box-shadow:0 0 0 0 rgba(239,68,68,0);}}',
      '.an-wrap{display:flex;flex-direction:column;gap:18px;font-family:Inter,system-ui,sans-serif;}',
      '.an-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
      '.an-markall{padding:9px 15px;border-radius:10px;border:1px solid #C59B47;background:#fff;color:#3E2F26;font-size:0.82rem;font-weight:800;cursor:pointer;transition:all .15s ease;}',
      '.an-markall:hover{background:#3E2F26;color:#f3d285;}',
      '.an-pinned{padding:24px 26px;border-radius:18px;background:linear-gradient(135deg,#3E2F26 0%,#2c2019 100%);border:1.5px solid #C59B47;color:#FAF6F0;box-shadow:0 14px 32px rgba(62,47,38,0.18);display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;}',
      '.an-pinned-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;background:rgba(197,155,71,0.2);border:1px solid rgba(197,155,71,0.45);color:#f3d285;font-size:0.72rem;font-weight:800;margin-bottom:8px;}',
      '.an-pinned h3{margin:0 0 6px;font-family:Georgia,serif;font-size:1.3rem;color:#fff;}',
      '.an-pinned p{margin:0;font-size:0.88rem;color:#E8DFD5;line-height:1.55;max-width:660px;}',
      '.an-pinned-btn{padding:11px 18px;border-radius:11px;border:0;background:linear-gradient(135deg,#C59B47,#b08635);color:#2c2019;font-size:0.85rem;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 6px 16px rgba(197,155,71,0.32);}',
      '.an-chips{display:flex;gap:8px;flex-wrap:wrap;}',
      '.an-chip{padding:8px 14px;border-radius:999px;border:1.5px solid #e6d7c8;background:#fff;color:#3E2F26;font-size:0.82rem;font-weight:700;cursor:pointer;transition:all .14s ease;}',
      '.an-chip:hover{border-color:#C59B47;}',
      '.an-chip.active{background:#3E2F26;color:#f3d285;border-color:#C59B47;}',
      '.an-list{display:flex;flex-direction:column;gap:12px;}',
      '.an-card{background:#fff;border:1px solid #ead8c5;border-left:5px solid #C59B47;border-radius:15px;padding:16px 18px;box-shadow:0 6px 18px rgba(62,47,38,0.05);cursor:pointer;transition:transform .14s ease,border-color .14s ease;}',
      '.an-card:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(62,47,38,0.09);}',
      '.an-card.unread{background:#fffdf9;}',
      '.an-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;}',
      '.an-cat-pill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:0.72rem;font-weight:800;}',
      '.an-new-pill{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;background:#EF4444;color:#fff;font-size:0.68rem;font-weight:800;letter-spacing:0.4px;}',
      '.an-card h4{margin:0;font-family:Georgia,serif;font-size:1rem;color:#3E2F26;}',
      '.an-card-msg{margin:6px 0 0;font-size:0.86rem;color:#5a493e;line-height:1.58;}',
      '.an-card-msg.clamped{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.an-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-top:8px;border-top:1px solid #f4ece3;font-size:0.75rem;color:#8a7667;}',
      '.an-action-link{border:0;background:none;color:#8c6821;font-weight:800;font-size:0.78rem;cursor:pointer;padding:0;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function updateSidebarBadges() {
    if (!global.ZarifStore || !global.ZarifStore.announcements) return;
    var sBadge = $('studentAnnouncementsBadge');
    if (sBadge) {
      var sCount = global.ZarifStore.announcements.unreadCount('student');
      sBadge.textContent = String(sCount);
      sBadge.hidden = sCount <= 0;
    }
    var pBadge = $('parentAnnouncementsBadge');
    if (pBadge) {
      var pCount = global.ZarifStore.announcements.unreadCount('parent');
      pBadge.textContent = String(pCount);
      pBadge.hidden = pCount <= 0;
    }
  }

  function handleActionTarget(target) {
    if (!target) return;
    if (state.role === 'student' && typeof global.showPanel === 'function') {
      global.showPanel(target, true);
      global.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (state.role === 'parent') {
      var map = { denemeler: 'tab-exams', 'live-lessons': 'tab-notifications', 'kazanim-testi': 'tab-outcomes' };
      var btn = document.querySelector('.vp-nav-btn[data-tab="' + (map[target] || 'tab-dashboard') + '"]');
      if (btn) btn.click();
    }
  }

  function render() {
    updateSidebarBadges();
    var mount = $('duyuruMerkeziRoot') || $('parentDuyuruMerkeziRoot');
    if (!mount || !global.ZarifStore || !global.ZarifStore.announcements) return;

    state.role = $('parentDuyuruMerkeziRoot') ? 'parent' : 'student';
    var allItems = global.ZarifStore.announcements.list({ role: state.role });
    var unreadTotal = allItems.filter(function (i) { return !i.isRead; }).length;
    var pinned = allItems.find(function (i) { return i.pinned; }) || allItems[0];
    var filtered = allItems.filter(function (i) {
      if (state.category !== 'all' && i.category !== state.category) return false;
      return true;
    });

    mount.innerHTML =
      '<div class="an-wrap">' +
        '<div class="an-topbar">' +
          '<div style="font-size:0.86rem;color:#6e5c50;font-weight:600;">' +
            (unreadTotal > 0 ? ('🔴 <strong>' + unreadTotal + '</strong> okunmamış duyurun var') : '✓ Tüm duyurular okundu') +
          '</div>' +
          '<button type="button" id="anMarkAllReadBtn" class="an-markall">✓ Tümünü Okundu İşaretle</button>' +
        '</div>' +

        (pinned ? (
          '<article class="an-pinned">' +
            '<div style="flex:1;min-width:240px;">' +
              '<div class="an-pinned-tag">📌 SABİTLENMİŞ ÖNEMLİ DUYURU · ' + esc(formatTimeAgo(pinned.createdAt)) + '</div>' +
              '<h3>' + esc(pinned.title) + '</h3>' +
              '<p>' + esc(pinned.message) + '</p>' +
            '</div>' +
            (pinned.actionLabel && pinned.actionTarget
              ? '<button type="button" class="an-pinned-btn" data-an-action="' + esc(pinned.actionTarget) + '" data-an-read="' + esc(pinned.id) + '">' + esc(pinned.actionLabel) + '</button>'
              : '') +
          '</article>'
        ) : '') +

        '<div class="an-chips">' +
          '<button type="button" class="an-chip' + (state.category === 'all' ? ' active' : '') + '" data-an-cat="all">Tümü (' + allItems.length + ')</button>' +
          '<button type="button" class="an-chip' + (state.category === 'genel' ? ' active' : '') + '" data-an-cat="genel">📢 Genel</button>' +
          '<button type="button" class="an-chip' + (state.category === 'sinav' ? ' active' : '') + '" data-an-cat="sinav">📝 Sınav &amp; Deneme</button>' +
          '<button type="button" class="an-chip' + (state.category === 'canli' ? ' active' : '') + '" data-an-cat="canli">🎥 Canlı Ders</button>' +
          '<button type="button" class="an-chip' + (state.category === 'yenilik' ? ' active' : '') + '" data-an-cat="yenilik">✨ Yenilikler</button>' +
        '</div>' +

        '<div class="an-list">' +
          (filtered.length
            ? filtered.map(function (item) {
                var meta = CAT_META[item.category] || CAT_META.genel;
                var isExpanded = state.expandedId === item.id;
                return '<article class="an-card' + (!item.isRead ? ' unread' : '') + '" style="border-left-color:' + meta.color + ';" data-an-card="' + esc(item.id) + '">' +
                  '<div class="an-card-top">' +
                    '<span class="an-cat-pill" style="background:' + meta.bg + ';color:' + meta.color + ';">' + meta.label + '</span>' +
                    '<div style="display:flex;align-items:center;gap:8px;">' +
                      (!item.isRead ? '<span class="an-new-pill">YENİ</span>' : '<span style="font-size:0.72rem;color:#059669;font-weight:700;">✓ Okundu</span>') +
                      '<span style="font-size:0.74rem;color:#8a7667;">' + esc(formatTimeAgo(item.createdAt)) + '</span>' +
                    '</div>' +
                  '</div>' +
                  '<h4>' + esc(item.title) + '</h4>' +
                  '<p class="an-card-msg' + (isExpanded ? '' : ' clamped') + '">' + esc(item.message) + '</p>' +
                  '<div class="an-card-foot">' +
                    '<span>✍️ ' + esc(item.author || 'ZarifÇözüm') + '</span>' +
                    (item.actionLabel && item.actionTarget
                      ? '<button type="button" class="an-action-link" data-an-action="' + esc(item.actionTarget) + '" data-an-read="' + esc(item.id) + '">' + esc(item.actionLabel) + '</button>'
                      : '<span>' + (isExpanded ? 'Detay açık' : 'Detayı görmek için tıkla →') + '</span>') +
                  '</div>' +
                '</article>';
              }).join('')
            : '<div style="padding:24px;border-radius:14px;background:#fff;border:1px dashed #d8c3ae;text-align:center;color:#786557;">Bu kategoride duyuru bulunmuyor.</div>') +
        '</div>' +
      '</div>';

    $('anMarkAllReadBtn')?.addEventListener('click', function () {
      global.ZarifStore.announcements.markAllRead(state.role);
      render();
    });

    mount.querySelectorAll('[data-an-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.category = btn.dataset.anCat;
        render();
      });
    });

    mount.querySelectorAll('[data-an-card]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-an-action]')) return;
        var id = card.dataset.anCard;
        state.expandedId = (state.expandedId === id) ? null : id;
        global.ZarifStore.announcements.markAsRead(id, state.role);
        render();
      });
    });

    mount.querySelectorAll('[data-an-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.dataset.anRead) {
          global.ZarifStore.announcements.markAsRead(btn.dataset.anRead, state.role);
        }
        handleActionTarget(btn.dataset.anAction);
        render();
      });
    });
  }

  function init() {
    injectStylesOnce();
    render();
    if (global.ZarifStore && global.ZarifStore.events) {
      global.ZarifStore.events.subscribe('announcements', render);
    }
  }

  global.ZarifDuyuruMerkezi = { refresh: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
