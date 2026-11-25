/**
 * ZarifÇözüm Öğrenci Paneli — Canlı Ders (Zoom Stüdyo) Kontrolcüsü
 * - Zoom vitrin kartı, canlı yayın dalga animasyonu ve 3'lü özellik şeridi
 * - Son 5 dakika canlı geri sayım sayacı (04:59) + parlama efektli Zoom katılım butonu
 * - Yaklaşan canlı dersler ve geçmiş ders kayıtları (ZarifStore.liveClasses + API)
 * - 15 dakika kala otomatik Veli uyarısı tetikleyici
 */
(function (global) {
  'use strict';

  var apiLiveState = { aktifDers: null, dersler: [] };
  var countdownTimer = null;
  var alertTimer = null;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTR(iso) {
    try {
      var d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return 'Planlandı';
      return d.toLocaleString('tr-TR', {
        weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return 'Planlandı';
    }
  }

  function formatMMSS(totalSec) {
    var sec = Math.max(0, Math.floor(totalSec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function getSampleUpcoming() {
    var now = Date.now();
    return [
      {
        id: 'sample_live_1',
        title: 'Rasyonel Sayılar & Yeni Nesil Problem Atölyesi',
        teacherName: 'ZarifÇözüm Matematik Zümresi',
        grade: 7,
        startsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        duration: 45,
        zoomUrl: '/canli.html',
        status: 'scheduled',
        isSample: true
      },
      {
        id: 'sample_live_2',
        title: 'Cebirsel İfadeler & Denklem Çözme Etüdü',
        teacherName: 'ZarifÇözüm Matematik Zümresi',
        grade: 7,
        startsAt: new Date(now + 26 * 60 * 60 * 1000).toISOString(),
        duration: 60,
        zoomUrl: '/canli.html',
        status: 'scheduled',
        isSample: true
      }
    ];
  }

  function getSampleRecordings() {
    var now = Date.now();
    return [
      {
        id: 'rec_1',
        title: 'Tam Sayılarla İşlemler — Soru Çözüm Maratonu',
        teacherName: 'Matematik Öğretmeni',
        startsAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 48,
        recordingUrl: '#video-dersler',
        isSample: true
      },
      {
        id: 'rec_2',
        title: 'Oran ve Orantı — Maarif Modeli Bağlam Soruları',
        teacherName: 'Matematik Öğretmeni',
        startsAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 52,
        recordingUrl: '#video-dersler',
        isSample: true
      },
      {
        id: 'rec_3',
        title: 'Yüzdeler ve Gerçek Yaşam Problemleri',
        teacherName: 'Matematik Öğretmeni',
        startsAt: new Date(now - 11 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 45,
        recordingUrl: '#video-dersler',
        isSample: true
      }
    ];
  }

  function collectMergedLessons() {
    var byId = {};
    var list = [];

    if (apiLiveState.aktifDers) {
      var a = apiLiveState.aktifDers;
      var aId = a.id || 'api_active_lesson';
      byId[aId] = {
        id: aId,
        title: a.title || 'Aktif Canlı Ders',
        teacherName: a.teacherName || 'Matematik Öğretmeni',
        startsAt: a.startsAt || new Date().toISOString(),
        duration: a.duration || 45,
        zoomUrl: a.link || a.zoomUrl || '/canli.html',
        status: 'active'
      };
    }

    (apiLiveState.dersler || []).forEach(function (d) {
      var id = d.id || ('api_' + (d.startsAt || d.title));
      if (!byId[id]) {
        byId[id] = {
          id: id,
          title: d.title || 'Planlı Matematik Dersi',
          teacherName: d.teacherName || 'Matematik Öğretmeni',
          startsAt: d.startsAt,
          duration: d.duration || 45,
          zoomUrl: d.link || d.zoomUrl || '/canli.html',
          status: d.status || 'scheduled',
          recordingUrl: d.recordingUrl || ''
        };
      }
    });

    if (global.ZarifStore && global.ZarifStore.liveClasses) {
      global.ZarifStore.liveClasses.list().forEach(function (c) {
        byId[c.id] = Object.assign({}, byId[c.id] || {}, c);
      });
    }

    Object.keys(byId).forEach(function (k) { list.push(byId[k]); });
    list.sort(function (x, y) {
      if (x.status === 'active' && y.status !== 'active') return -1;
      if (y.status === 'active' && x.status !== 'active') return 1;
      return new Date(x.startsAt || 0) - new Date(y.startsAt || 0);
    });
    return list;
  }

  function resolveSpotlightLesson(lessons) {
    var now = Date.now();
    var active = lessons.find(function (l) { return l.status === 'active'; });
    if (active) return { lesson: active, mode: 'active', diffMs: 0 };

    var upcoming = lessons.find(function (l) {
      if (l.status === 'completed') return false;
      var t = new Date(l.startsAt || 0).getTime();
      return Number.isFinite(t) && t >= now - 10 * 60 * 1000;
    });

    if (!upcoming) return { lesson: null, mode: 'idle', diffMs: Infinity };

    var startMs = new Date(upcoming.startsAt).getTime();
    var diffMs = startMs - now;
    if (diffMs <= 0) {
      return { lesson: upcoming, mode: 'active', diffMs: 0 };
    }
    if (diffMs <= 5 * 60 * 1000) {
      return { lesson: upcoming, mode: 'countdown5m', diffMs: diffMs };
    }
    return { lesson: upcoming, mode: 'scheduled', diffMs: diffMs };
  }

  function updateSpotlightTick() {
    var lessons = collectMergedLessons();
    var spot = resolveSpotlightLesson(lessons);

    var liveDot = document.getElementById('studentLiveDot');
    if (liveDot) liveDot.hidden = !(spot.mode === 'active' || spot.mode === 'countdown5m');

    var badgeEl = document.getElementById('zlsStatusBadge');
    var titleEl = document.getElementById('zlsHeroTitle');
    var subEl = document.getElementById('zlsHeroSub');
    var timerBox = document.getElementById('zlsCountdownBox');
    var timerVal = document.getElementById('zlsCountdownVal');
    var joinBtn = document.getElementById('zlsJoinZoomBtn');
    var pulseRing = document.getElementById('zlsPulseRing');

    if (!badgeEl || !titleEl || !joinBtn) return;

    if (spot.mode === 'active' && spot.lesson) {
      badgeEl.className = 'zls-status-pill is-live';
      badgeEl.innerHTML = '<span class="zls-dot"></span> CANLI YAYINDA · ZOOM AKTİF';
      titleEl.textContent = spot.lesson.title;
      subEl.textContent = (spot.lesson.teacherName || 'Matematik Öğretmeni') + ' ile canlı ders şu an yayında. Hemen katılabilirsin!';
      if (timerBox) timerBox.style.display = 'none';
      if (pulseRing) pulseRing.classList.add('is-live');
      joinBtn.classList.add('is-ready');
      joinBtn.classList.remove('is-disabled');
      joinBtn.href = spot.lesson.zoomUrl || '/canli.html';
      joinBtn.target = (spot.lesson.zoomUrl && spot.lesson.zoomUrl.indexOf('http') === 0) ? '_blank' : '_self';
      joinBtn.innerHTML = '🎥 Zoom Dersine Katıl →';
    } else if (spot.mode === 'countdown5m' && spot.lesson) {
      badgeEl.className = 'zls-status-pill is-soon';
      badgeEl.innerHTML = '<span class="zls-dot"></span> SON 5 DAKİKA · ODA AÇILDI';
      titleEl.textContent = spot.lesson.title;
      subEl.textContent = 'Canlı ders başlamak üzere! Zoom bekleme odası açıldı, şimdi katılabilirsin.';
      if (timerBox) timerBox.style.display = 'inline-flex';
      if (timerVal) timerVal.textContent = formatMMSS(spot.diffMs / 1000);
      if (pulseRing) pulseRing.classList.add('is-live');
      joinBtn.classList.add('is-ready');
      joinBtn.classList.remove('is-disabled');
      joinBtn.href = spot.lesson.zoomUrl || '/canli.html';
      joinBtn.target = (spot.lesson.zoomUrl && spot.lesson.zoomUrl.indexOf('http') === 0) ? '_blank' : '_self';
      joinBtn.innerHTML = '🎥 Zoom Dersine Katıl';
    } else if (spot.mode === 'scheduled' && spot.lesson) {
      badgeEl.className = 'zls-status-pill is-scheduled';
      badgeEl.innerHTML = '<span class="zls-dot"></span> PLANLI ZOOM DERSİ';
      titleEl.textContent = spot.lesson.title;
      subEl.textContent = 'Başlangıç: ' + formatDateTR(spot.lesson.startsAt) + ' · Derse 5 dakika kala katılım butonu aktifleşir.';
      if (timerBox) timerBox.style.display = 'none';
      if (pulseRing) pulseRing.classList.remove('is-live');
      joinBtn.classList.remove('is-ready');
      joinBtn.classList.add('is-disabled');
      joinBtn.href = 'javascript:void(0)';
      joinBtn.target = '_self';
      joinBtn.innerHTML = '⏳ Ders Saati Bekleniyor';
    } else {
      badgeEl.className = 'zls-status-pill is-idle';
      badgeEl.innerHTML = '<span class="zls-dot"></span> ZOOM STÜDYO HAZIR';
      titleEl.textContent = 'ZarifÇözüm Canlı Matematik Stüdyosu';
      subEl.textContent = 'Öğretmenin yeni bir Zoom dersi planladığında burada son 5 dakika geri sayımı otomatik olarak başlar.';
      if (timerBox) timerBox.style.display = 'none';
      if (pulseRing) pulseRing.classList.remove('is-live');
      joinBtn.classList.remove('is-ready');
      joinBtn.classList.add('is-disabled');
      joinBtn.href = 'javascript:void(0)';
      joinBtn.target = '_self';
      joinBtn.innerHTML = '🎥 Aktif Ders Bekleniyor';
    }
  }

  function renderLists() {
    var upcomingEl = document.getElementById('zlsUpcomingList');
    var recordingsEl = document.getElementById('zlsRecordingsList');
    if (!upcomingEl || !recordingsEl) return;

    var lessons = collectMergedLessons();
    var now = Date.now();

    var upcoming = lessons.filter(function (l) {
      if (l.status === 'completed') return false;
      if (l.status === 'active') return true;
      var t = new Date(l.startsAt || 0).getTime();
      return !Number.isFinite(t) || t >= now - 15 * 60 * 1000;
    });

    var recordings = lessons.filter(function (l) {
      return l.status === 'completed' || (l.recordingUrl && l.status !== 'active');
    });

    var usingSampleUpcoming = false;
    if (!upcoming.length) {
      upcoming = getSampleUpcoming();
      usingSampleUpcoming = true;
    }

    var usingSampleRec = false;
    if (!recordings.length) {
      recordings = getSampleRecordings();
      usingSampleRec = true;
    }

    var upBadge = document.getElementById('zlsUpcomingCount');
    if (upBadge) upBadge.textContent = usingSampleUpcoming ? 'Örnek Program' : (upcoming.length + ' Planlı Ders');

    upcomingEl.innerHTML = upcoming.map(function (l) {
      var startMs = new Date(l.startsAt || 0).getTime();
      var diffMs = startMs - now;
      var isReady = l.status === 'active' || (Number.isFinite(diffMs) && diffMs <= 5 * 60 * 1000);
      var statusLabel = l.status === 'active'
        ? '<span class="zls-chip live">🔴 CANLI</span>'
        : (isReady ? '<span class="zls-chip soon">⏱️ SON 5 DK</span>' : '<span class="zls-chip">📅 ' + esc(formatDateTR(l.startsAt)) + '</span>');
      var btnHtml = isReady
        ? '<a class="zls-card-btn ready" href="' + esc(l.zoomUrl || '/canli.html') + '"' + ((l.zoomUrl && l.zoomUrl.indexOf('http') === 0) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>🎥 Zoom\'a Katıl</a>'
        : '<span class="zls-card-btn waiting">' + (l.isSample ? 'Örnek Program' : (esc(l.duration || 45) + ' dk · Bekleniyor')) + '</span>';

      return '<article class="zls-lesson-card">' +
        '<div class="zls-lesson-ico">🎥</div>' +
        '<div class="zls-lesson-body">' +
          '<div class="zls-lesson-top">' + statusLabel + (l.isSample ? '<span class="zls-chip muted">Örnek</span>' : '') + '</div>' +
          '<h4>' + esc(l.title) + '</h4>' +
          '<p>' + esc(l.teacherName || 'Matematik Öğretmeni') + ' · ' + esc(l.duration || 45) + ' dakika · HD Zoom</p>' +
        '</div>' +
        '<div class="zls-lesson-act">' + btnHtml + '</div>' +
      '</article>';
    }).join('');

    var recBadge = document.getElementById('zlsRecordingsCount');
    if (recBadge) recBadge.textContent = usingSampleRec ? 'Örnek Arşiv' : (recordings.length + ' Kayıt');

    recordingsEl.innerHTML = recordings.map(function (r) {
      var href = r.recordingUrl || '#video-dersler';
      var isHash = href.charAt(0) === '#';
      return '<article class="zls-rec-card">' +
        '<div class="zls-rec-play">▶</div>' +
        '<div class="zls-rec-body">' +
          '<h4>' + esc(r.title) + '</h4>' +
          '<p>' + esc(formatDateTR(r.startsAt)) + ' · ' + esc(r.duration || 45) + ' dk</p>' +
        '</div>' +
        '<a class="zls-rec-btn" href="' + esc(href) + '"' + (isHash ? ' onclick="if(window.showPanel){showPanel(\'video-dersler\',true);return false;}"' : ' target="_blank" rel="noopener noreferrer"') + '>Tekrar İzle</a>' +
      '</article>';
    }).join('');
  }

  function renderAll() {
    updateSpotlightTick();
    renderLists();
  }

  function init() {
    if (!document.getElementById('zlsStudioRoot')) return;
    renderAll();

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateSpotlightTick, 1000);

    if (alertTimer) clearInterval(alertTimer);
    alertTimer = setInterval(function () {
      if (global.ZarifStore && global.ZarifStore.liveClasses) {
        global.ZarifStore.liveClasses.checkAndTrigger15MinParentAlerts();
      }
    }, 15000);

    if (global.ZarifStore && global.ZarifStore.events) {
      global.ZarifStore.events.subscribe('liveClasses', renderAll);
    }
  }

  global.ZarifLiveStudio = {
    setApiData: function (content) {
      apiLiveState = {
        aktifDers: (content && content.aktifDers) || null,
        dersler: (content && Array.isArray(content.dersler)) ? content.dersler : []
      };
      renderAll();
    },
    refresh: renderAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
