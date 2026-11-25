/**
 * ZarifÇözüm — Başarı, Haftalık Lig & Dijital Sertifika Merkezi
 * - VIP & Standart paket kilit açma düzeltmesi (yalnızca Ücretsiz planda önizleme kilidi)
 * - Üst Prestij & Seviye Şeridi + animasyonlu KPI kartları (ZarifStore.tests canlı)
 * - Haftalık Lig İlk 3 Podyum + İlk 10 Tablosu ("Sen" rozetli altın vurgu)
 * - 6 Pedagojik Başarı Rozeti (shimmer + tarih / mini ilerleme çubuğu)
 * - Canlı Klasik Çerçeveli Dijital Sertifika + Yazdır/PDF + Paylaş
 */
(function (global) {
  'use strict';

  var LEVELS = [
    { level: 1, name: 'Matematik Kaşifi', minXp: 0, icon: '🧭' },
    { level: 2, name: 'İşlem Ustası', minXp: 150, icon: '⚡' },
    { level: 3, name: 'Altın Çözücü', minXp: 350, icon: '🏅' },
    { level: 4, name: 'Maarif Yıldızı', minXp: 650, icon: '🌟' },
    { level: 5, name: 'Analitik Dâhi', minXp: 1100, icon: '🧠' },
    { level: 6, name: 'Zarif Efsane', minXp: 1700, icon: '👑' }
  ];

  var DEFAULT_PEERS = [
    { name: 'Defne Arslan', weeklyXp: 460 },
    { name: 'Yusuf Karahan', weeklyXp: 395 },
    { name: 'Zeynep Kaya', weeklyXp: 340 },
    { name: 'Emir Şahin', weeklyXp: 285 },
    { name: 'Azra Çelik', weeklyXp: 240 },
    { name: 'Kerem Yılmaz', weeklyXp: 195 },
    { name: 'Elif Demir', weeklyXp: 165 },
    { name: 'Mert Aydın', weeklyXp: 130 },
    { name: 'Hira Öztürk', weeklyXp: 105 }
  ];

  var state = {
    plan: 'free',
    role: 'student',
    studentName: 'Öğrenci',
    grade: 7,
    xp: 120,
    weeklyXp: 80,
    streakDays: 1,
    hasShield: false,
    apiLeaderboard: []
  };

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizePlan(raw) {
    var s = String(raw || '').toLowerCase().trim();
    if (s.indexOf('vip') !== -1) return 'vip';
    if (s.indexOf('standart') !== -1 || s.indexOf('standard') !== -1 || s.indexOf('pro') !== -1 || s.indexOf('premium') !== -1) return 'standart';
    if (s.indexOf('temel') !== -1) return 'temel';
    return 'free';
  }

  function isLeaderboardUnlocked() {
    var p = normalizePlan(state.plan);
    var r = String(state.role || '').toLowerCase();
    return p === 'vip' || p === 'standart' || r === 'admin' || r === 'teacher' || r === 'superadmin';
  }

  function isCertificateUnlocked() {
    var p = normalizePlan(state.plan);
    var r = String(state.role || '').toLowerCase();
    return p === 'vip' || r === 'admin' || r === 'teacher' || r === 'superadmin';
  }

  function computeLevel(xp) {
    var val = Math.max(0, Number(xp) || 0);
    var cur = LEVELS[0];
    var next = LEVELS[1];
    for (var i = 0; i < LEVELS.length; i++) {
      if (val >= LEVELS[i].minXp) {
        cur = LEVELS[i];
        next = LEVELS[i + 1] || null;
      }
    }
    if (!next) {
      return { level: cur.level, name: cur.name, icon: cur.icon, currentXp: val, remainingXp: 0, percent: 100 };
    }
    var span = Math.max(1, next.minXp - cur.minXp);
    var pct = Math.max(0, Math.min(100, Math.round(((val - cur.minXp) / span) * 100)));
    return {
      level: cur.level,
      name: cur.name,
      icon: cur.icon,
      currentXp: val,
      remainingXp: Math.max(0, next.minXp - val),
      percent: pct
    };
  }

  function detectFromDomAndServices() {
    var badgeEl = $('studentPlanBadge');
    if (badgeEl && badgeEl.textContent.trim()) {
      var domPlan = normalizePlan(badgeEl.textContent);
      if (domPlan !== 'free') state.plan = domPlan;
    }
    var nameEl = $('studentName');
    if (nameEl && nameEl.textContent.trim() && nameEl.textContent.trim() !== 'Öğrenci') {
      state.studentName = nameEl.textContent.trim();
    }
    if (global.ZarifGamification && typeof global.ZarifGamification.getProfile === 'function') {
      var prof = global.ZarifGamification.getProfile();
      if (prof.studentName && prof.studentName !== 'Öğrenci') state.studentName = prof.studentName;
      if (prof.grade) state.grade = Number(prof.grade);
      state.xp = Math.max(state.xp, Number(prof.xp) || 0);
      state.weeklyXp = Math.max(state.weeklyXp, Number(prof.weeklyXp) || 0);
      state.streakDays = Math.max(state.streakDays, Number(prof.streakDays) || 1);
    }
  }

  function collectLiveMetrics() {
    var tests = (global.ZarifStore && global.ZarifStore.tests) ? global.ZarifStore.tests.list() : [];
    var stats = (global.ZarifStore && global.ZarifStore.tests) ? global.ZarifStore.tests.getStats() : { totalTests: 0, avgScore: 0, totalQuestions: 0 };
    var assignments = (global.ZarifStore && global.ZarifStore.assignments) ? global.ZarifStore.assignments.list() : [];
    var completedAsg = assignments.filter(function (a) { return a.status === 'completed'; }).length;

    var bestScore = 0;
    var topicSet = new Set();
    tests.forEach(function (t) {
      if ((Number(t.score) || 0) > bestScore) bestScore = Number(t.score) || 0;
      if (t.topicKey || t.topicTitle) topicSet.add(t.topicKey || t.topicTitle);
    });

    return {
      totalTests: stats.totalTests || 0,
      avgScore: stats.avgScore || 0,
      totalQuestions: stats.totalQuestions || 0,
      bestScore: bestScore,
      uniqueTopics: topicSet.size,
      completedAsg: completedAsg,
      lastTestDate: tests[0] ? tests[0].createdAt : null
    };
  }

  function formatShortDate(iso) {
    try {
      var d = iso ? new Date(iso) : new Date();
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Bugün';
    }
  }

  function buildBadges(metrics) {
    var todayLabel = formatShortDate(metrics.lastTestDate || new Date().toISOString());
    return [
      {
        id: 'first_test',
        icon: '🎯',
        title: 'İlk Testini Çözdü',
        desc: 'İlk kazanım veya pratik testini tamamla',
        current: metrics.totalTests,
        target: 1,
        unit: 'test',
        earned: metrics.totalTests >= 1 || state.xp >= 120,
        earnedDate: todayLabel
      },
      {
        id: 'streak_3',
        icon: '🔥',
        title: '3 Günlük Seri',
        desc: '3 gün üst üste düzenli çalışma yap',
        current: state.streakDays,
        target: 3,
        unit: 'gün',
        earned: state.streakDays >= 3,
        earnedDate: todayLabel
      },
      {
        id: 'score_90',
        icon: '🏆',
        title: '%90 Üstü Başarı',
        desc: 'Bir testten %90 veya üzeri puan al',
        current: metrics.bestScore,
        target: 90,
        unit: '%',
        earned: metrics.bestScore >= 90,
        earnedDate: todayLabel
      },
      {
        id: 'maarif_explorer',
        icon: '🧭',
        title: 'Maarif Kaşifi',
        desc: 'En az 3 farklı matematik konusunda test çöz',
        current: metrics.uniqueTopics,
        target: 3,
        unit: 'konu',
        earned: metrics.uniqueTopics >= 3,
        earnedDate: todayLabel
      },
      {
        id: 'weekly_star',
        icon: '⭐',
        title: 'Haftanın Yıldızı',
        desc: 'Haftalık 200 XP barajına ulaş',
        current: state.weeklyXp,
        target: 200,
        unit: 'XP',
        earned: state.weeklyXp >= 200,
        earnedDate: todayLabel
      },
      {
        id: 'homework_done',
        icon: '📚',
        title: 'Ödev Tamamlayıcı',
        desc: 'Öğretmenin atadığı bir çalışmayı bitir',
        current: metrics.completedAsg,
        target: 1,
        unit: 'ödev',
        earned: metrics.completedAsg >= 1,
        earnedDate: todayLabel
      }
    ];
  }

  function buildLeaderboardTop10() {
    var rows = [];
    var hasSelf = false;
    var selfName = state.studentName || 'Öğrenci';
    var selfXp = Math.max(0, Number(state.weeklyXp) || 0);

    (state.apiLeaderboard || []).forEach(function (item) {
      var nm = item.name || item.ad || 'Öğrenci';
      var isSelf = Boolean(item.isSelf) || nm.toLowerCase() === selfName.toLowerCase();
      if (isSelf) hasSelf = true;
      rows.push({
        name: nm,
        weeklyXp: Number(item.haftalikPuan || item.weeklyXp || item.puan || 0),
        isSelf: isSelf
      });
    });

    if (rows.length < 10) {
      DEFAULT_PEERS.forEach(function (p) {
        if (rows.length >= 9 && !hasSelf) return;
        if (rows.length >= 10) return;
        if (!rows.some(function (r) { return r.name.toLowerCase() === p.name.toLowerCase(); })) {
          rows.push({ name: p.name, weeklyXp: p.weeklyXp, isSelf: false });
        }
      });
    }

    if (!hasSelf) {
      rows.push({ name: selfName, weeklyXp: selfXp, isSelf: true });
    }

    rows.sort(function (a, b) { return b.weeklyXp - a.weeklyXp; });
    return rows.slice(0, 10);
  }

  function openCertificatePrint() {
    if (!isCertificateUnlocked()) {
      if (typeof global.openSubscriptionUpgradeModal === 'function') global.openSubscriptionUpgradeModal();
      return;
    }
    var win = global.open('', '_blank', 'width=940,height=680');
    if (!win) {
      alert('Sertifikayı yazdırmak için lütfen tarayıcı açılır penceresine izin verin.');
      return;
    }
    var lvl = computeLevel(state.xp);
    var monthYear = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    var fullDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    var planLabel = normalizePlan(state.plan) === 'vip' ? 'VIP ÜYE' : 'STANDART ÜYE';

    win.document.write(
      '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>ZarifÇözüm Başarı Sertifikası</title>' +
      '<style>' +
        '@page{size:landscape;margin:10mm;}' +
        'body{margin:0;padding:24px;background:#FAF6F0;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box;}' +
        '.cert{width:860px;max-width:100%;background:#fffdf9;border:12px double #C59B47;outline:3px solid #3E2F26;outline-offset:-18px;padding:46px 54px;text-align:center;color:#3E2F26;position:relative;box-shadow:0 16px 40px rgba(62,47,38,0.14);box-sizing:border-box;}' +
        '.kicker{font-family:system-ui,sans-serif;font-size:12px;font-weight:800;letter-spacing:3px;color:#C59B47;text-transform:uppercase;}' +
        'h1{margin:10px 0 6px;font-size:30px;color:#3E2F26;letter-spacing:1.5px;}' +
        'h2{margin:0 0 22px;font-size:16px;font-family:system-ui,sans-serif;color:#8c6821;letter-spacing:2px;text-transform:uppercase;}' +
        '.student{display:inline-block;margin:12px 0 18px;padding:0 36px 8px;font-size:34px;font-weight:700;color:#2c2019;border-bottom:2px solid #C59B47;}' +
        'p{font-size:15px;line-height:1.75;color:#5a493e;max-width:640px;margin:0 auto 14px;}' +
        '.degree{display:inline-block;padding:6px 18px;border-radius:999px;background:#FAF6F0;border:1px solid #C59B47;font-family:system-ui,sans-serif;font-size:13px;font-weight:700;color:#3E2F26;margin:6px 0 22px;}' +
        '.foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;padding:0 24px;}' +
        '.sign{border-top:1px solid #C59B47;padding-top:8px;min-width:190px;font-family:system-ui,sans-serif;font-size:12px;color:#5a493e;}' +
        '.seal{width:84px;height:84px;border-radius:50%;background:radial-gradient(circle,#f3d285,#C59B47);border:3px double #3E2F26;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#2c2019;font-family:system-ui,sans-serif;font-weight:900;font-size:10px;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(197,155,71,0.38);}' +
        '@media print{body{padding:0;background:#fff;}.cert{box-shadow:none;}}' +
      '</style></head><body>' +
      '<div class="cert">' +
        '<div class="kicker">ZARİFÇÖZÜM MATEMATİK AKADEMİSİ · ' + esc(monthYear.toUpperCase()) + '</div>' +
        '<h1>ÜSTÜN BAŞARI SERTİFİKASI</h1>' +
        '<h2>TÜRKİYE YÜZYILI MAARİF MODELİ GELİŞİM BELGESİ</h2>' +
        '<p>Bu sertifika, ZarifÇözüm platformunda gösterdiği düzenli çalışma azmi, tamamladığı kazanım testleri ve istikrarlı matematik gelişimi dolayısıyla</p>' +
        '<div class="student">' + esc(state.studentName) + '</div>' +
        '<div><span class="degree">Seviye ' + lvl.level + ' · ' + esc(lvl.name) + ' · ' + state.xp + ' XP</span></div>' +
        '<p>adına başarılarının devamı dileğiyle onaylanarak düzenlenmiştir.</p>' +
        '<div class="foot">' +
          '<div class="sign"><strong>Düzenleme Tarihi</strong><br>' + esc(fullDate) + '</div>' +
          '<div class="seal"><span style="font-size:18px;">✓</span><span>ONAYLI</span><span>' + esc(planLabel) + '</span></div>' +
          '<div class="sign"><strong>ZarifÇözüm Eğitim Kurulu</strong><br>Dijital Onay Mührü</div>' +
        '</div>' +
      '</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>' +
      '</body></html>'
    );
    win.document.close();
  }

  async function shareAchievement() {
    var lvl = computeLevel(state.xp);
    var shareText = '🏆 ZarifÇözüm Matematik Akademisi Başarım: ' + state.studentName + ' — Seviye ' + lvl.level + ' (' + lvl.name + '), ' + state.xp + ' XP ve ' + state.streakDays + ' günlük çalışma serisi!';
    var statusEl = $('lscShareStatus');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ZarifÇözüm Başarı Sertifikası', text: shareText, url: global.location.origin });
        if (statusEl) statusEl.textContent = '✓ Başarı özeti paylaşıldı!';
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        if (statusEl) statusEl.textContent = '✓ Başarı özeti panoya kopyalandı!';
        setTimeout(function () { if (statusEl) statusEl.textContent = ''; }, 3000);
        return;
      }
    } catch (e) {}
    if (statusEl) statusEl.textContent = shareText;
  }

  function render() {
    var mount = $('liderlikSertifikaRoot');
    if (!mount) return;
    detectFromDomAndServices();

    var lbUnlocked = isLeaderboardUnlocked();
    var certUnlocked = isCertificateUnlocked();
    var planNorm = normalizePlan(state.plan);
    var planBadgeText = planNorm === 'vip' ? '👑 VIP Üye' : (planNorm === 'standart' ? '⭐ Standart Üye' : (planNorm === 'temel' ? '📘 Temel Paket' : 'Ücretsiz Plan'));
    var lvl = computeLevel(state.xp);
    var metrics = collectLiveMetrics();
    var badges = buildBadges(metrics);
    var earnedCount = badges.filter(function (b) { return b.earned; }).length;
    var top10 = buildLeaderboardTop10();
    var p1 = top10[0] || { name: '—', weeklyXp: 0 };
    var p2 = top10[1] || { name: '—', weeklyXp: 0 };
    var p3 = top10[2] || { name: '—', weeklyXp: 0 };
    var monthYear = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    var hasShield = lbUnlocked || state.hasShield;

    mount.innerHTML =
      '<div class="lsc-wrap">' +
        // 1) Üst Prestij & Seviye Şeridi
        '<section class="lsc-prestige">' +
          '<div class="lsc-prestige-top">' +
            '<div class="lsc-lvl-head">' +
              '<div class="lsc-lvl-orb">' + lvl.icon + '</div>' +
              '<div>' +
                '<div class="lsc-plan-tag">' + esc(planBadgeText) + ' · ' + state.grade + '. Sınıf Ligi</div>' +
                '<h3>Seviye ' + lvl.level + ' • ' + esc(lvl.name) + '</h3>' +
                '<p>' + (lvl.remainingXp > 0 ? ('Bir sonraki seviyeye <strong>' + lvl.remainingXp + ' XP</strong> kaldı') : 'En yüksek prestij seviyesine ulaştın!') + '</p>' +
              '</div>' +
            '</div>' +
            '<div class="lsc-xp-pill"><strong>' + state.xp + ' XP</strong><span>Haftalık +' + state.weeklyXp + ' XP</span></div>' +
          '</div>' +
          '<div class="lsc-xp-track"><div class="lsc-xp-fill" style="width:' + lvl.percent + '%;"></div></div>' +
        '</section>' +

        // 2) 3 Animasyonlu KPI Kartı
        '<div class="lsc-kpi-grid">' +
          '<article class="lsc-kpi-card">' +
            '<div class="lsc-kpi-ico flame">🔥</div>' +
            '<div>' +
              '<span class="lsc-kpi-lbl">Günlük Çalışma Serisi</span>' +
              '<strong class="lsc-kpi-val">' + state.streakDays + ' Gün</strong>' +
              '<small>Her gün 1 test çözerek serini koru</small>' +
            '</div>' +
          '</article>' +
          '<article class="lsc-kpi-card">' +
            '<div class="lsc-kpi-ico shield">' + (hasShield ? '🛡️' : '⚪') + '</div>' +
            '<div>' +
              '<span class="lsc-kpi-lbl">Seri Koruma Kalkanı</span>' +
              '<strong class="lsc-kpi-val" style="color:' + (hasShield ? '#065f46' : '#8a7667') + ';">' + (hasShield ? 'Aktif (Korumalı)' : 'Pasif') + '</strong>' +
              '<small>' + (hasShield ? '1 gün ara versen bile serin sıfırlanmaz' : 'Standart ve VIP planlarda aktifleşir') + '</small>' +
            '</div>' +
          '</article>' +
          '<article class="lsc-kpi-card">' +
            '<div class="lsc-kpi-ico chart">📊</div>' +
            '<div>' +
              '<span class="lsc-kpi-lbl">Canlı Test Performansı</span>' +
              '<strong class="lsc-kpi-val">' + metrics.totalTests + ' Test · %' + metrics.avgScore + '</strong>' +
              '<small>Kazanılan Rozet: ' + earnedCount + ' / ' + badges.length + '</small>' +
            '</div>' +
          '</article>' +
        '</div>' +

        // 3) 6 İnteraktif Başarı Rozeti Vitrini
        '<section class="lsc-panel">' +
          '<div class="lsc-panel-head">' +
            '<h3>🏅 Başarı Rozetleri Vitrini</h3>' +
            '<span class="lsc-chip">' + earnedCount + ' / ' + badges.length + ' Kazanıldı</span>' +
          '</div>' +
          '<div class="lsc-badges-grid">' +
            badges.map(function (b) {
              var pct = Math.min(100, Math.round((Math.min(b.current, b.target) / Math.max(1, b.target)) * 100));
              return '<article class="lsc-badge-card ' + (b.earned ? 'earned' : 'locked') + '">' +
                '<div class="lsc-badge-ico">' + b.icon + '</div>' +
                '<div class="lsc-badge-body">' +
                  '<strong>' + esc(b.title) + '</strong>' +
                  '<p>' + esc(b.desc) + '</p>' +
                  (b.earned
                    ? '<span class="lsc-earned-date">✓ Kazanıldı · ' + esc(b.earnedDate) + '</span>'
                    : '<div class="lsc-mini-prog"><div class="lsc-mini-track"><div class="lsc-mini-fill" style="width:' + pct + '%;"></div></div><span>' + Math.min(b.current, b.target) + ' / ' + b.target + ' ' + esc(b.unit) + '</span></div>') +
                '</div>' +
              '</article>';
            }).join('') +
          '</div>' +
        '</section>' +

        // 4) Sol: Haftalık Lig Podyumu + İlk 10 | Sağ: Dijital Başarı Sertifikası
        '<div class="lsc-two-col">' +
          '<section class="lsc-panel lsc-rel">' +
            '<div class="lsc-panel-head">' +
              '<h3>🎖️ Haftalık Liderlik Ligi</h3>' +
              '<span class="lsc-chip gold">' + state.grade + '. Sınıf · İlk 10</span>' +
            '</div>' +
            (!lbUnlocked ? renderFreeLockOverlay('Haftalık Lig Önizlemesi', 'Haftalık liderlik podyumunda yarışmak ve seri kalkanını açmak için Standart veya VIP pakete yükseltebilirsin.') : '') +
            '<div class="lsc-podium">' +
              '<div class="lsc-pod silver">' +
                '<span class="lsc-pod-rank">🥈 2.</span>' +
                '<strong>' + esc(p2.name) + '</strong>' +
                '<small>' + p2.weeklyXp + ' XP</small>' +
              '</div>' +
              '<div class="lsc-pod gold">' +
                '<span class="lsc-pod-crown">👑</span>' +
                '<span class="lsc-pod-rank">🥇 1.</span>' +
                '<strong>' + esc(p1.name) + '</strong>' +
                '<small>' + p1.weeklyXp + ' XP</small>' +
              '</div>' +
              '<div class="lsc-pod bronze">' +
                '<span class="lsc-pod-rank">🥉 3.</span>' +
                '<strong>' + esc(p3.name) + '</strong>' +
                '<small>' + p3.weeklyXp + ' XP</small>' +
              '</div>' +
            '</div>' +
            '<div class="lsc-lb-list">' +
              top10.map(function (row, idx) {
                var medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1)));
                return '<div class="lsc-lb-row' + (row.isSelf ? ' is-self' : '') + '">' +
                  '<span class="lsc-lb-pos">' + medal + '</span>' +
                  '<span class="lsc-lb-name">' + esc(row.name) + (row.isSelf ? ' <span class="lsc-self-tag">Sen</span>' : '') + '</span>' +
                  '<strong class="lsc-lb-xp">' + row.weeklyXp + ' XP</strong>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</section>' +

          '<section class="lsc-panel lsc-rel">' +
            '<div class="lsc-panel-head">' +
              '<h3>📜 Dijital Başarı Sertifikası</h3>' +
              '<span class="lsc-chip gold">' + esc(monthYear) + '</span>' +
            '</div>' +
            (!certUnlocked ? renderFreeLockOverlay('Dijital Başarı Sertifikası (VIP Özelliği)', 'İmzalı ve PDF indirilebilir aylık başarı sertifikanı açmak için VIP pakete yükseltebilirsin.') : '') +
            '<div class="lsc-cert-frame">' +
              '<div class="lsc-cert-kicker">ZARİFÇÖZÜM MATEMATİK AKADEMİSİ</div>' +
              '<div class="lsc-cert-title">AYLIK BAŞARI SERTİFİKASI</div>' +
              '<p class="lsc-cert-text">Düzenli çalışma disiplini ve Maarif Modeli kazanım başarıları vesilesiyle</p>' +
              '<div class="lsc-cert-name">' + esc(state.studentName) + '</div>' +
              '<div class="lsc-cert-degree">Seviye ' + lvl.level + ' • ' + esc(lvl.name) + ' (' + state.xp + ' XP)</div>' +
              '<div class="lsc-cert-bottom">' +
                '<div class="lsc-cert-date"><span>Dönem</span><strong>' + esc(monthYear) + '</strong></div>' +
                '<div class="lsc-cert-seal" title="ZarifÇözüm Onay Mührü">' +
                  '<svg viewBox="0 0 64 64" width="54" height="54" aria-hidden="true">' +
                    '<circle cx="32" cy="32" r="28" fill="#C59B47" stroke="#3E2F26" stroke-width="2.5"/>' +
                    '<circle cx="32" cy="32" r="22" fill="none" stroke="#FAF6F0" stroke-width="1.5" stroke-dasharray="3 2"/>' +
                    '<path d="M22 33l6 6 14-14" fill="none" stroke="#3E2F26" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
                  '</svg>' +
                  '<span>ONAY MÜHRÜ</span>' +
                '</div>' +
                '<div class="lsc-cert-date"><span>Kurul</span><strong>ZarifÇözüm</strong></div>' +
              '</div>' +
            '</div>' +
            '<div class="lsc-cert-actions">' +
              '<button type="button" id="lscDownloadCertBtn" class="lsc-btn-gold">📥 Sertifikayı İndir (Yazdır / PDF)</button>' +
              '<button type="button" id="lscShareCertBtn" class="lsc-btn-dark">🔗 Başarıyı Paylaş</button>' +
            '</div>' +
            '<div id="lscShareStatus" style="font-size:0.8rem;color:#065f46;margin-top:8px;min-height:18px;text-align:center;"></div>' +
          '</section>' +
        '</div>' +
      '</div>';

    $('lscDownloadCertBtn')?.addEventListener('click', openCertificatePrint);
    $('lscShareCertBtn')?.addEventListener('click', shareAchievement);
    mount.querySelectorAll('[data-lsc-upgrade]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (typeof global.openSubscriptionUpgradeModal === 'function') global.openSubscriptionUpgradeModal();
        else global.location.href = '/Paketler.html?ref=liderlik';
      });
    });
  }

  function renderFreeLockOverlay(title, desc) {
    return '<div class="lsc-free-lock">' +
      '<div style="font-size:2rem;margin-bottom:6px;">🔒</div>' +
      '<strong>' + esc(title) + '</strong>' +
      '<p>' + esc(desc) + '</p>' +
      '<button type="button" class="lsc-btn-gold" data-lsc-upgrade>🚀 Paketi Yükselt →</button>' +
    '</div>';
  }

  global.ZarifLeaderboardCenter = {
    syncFromQuota: function (quotaData) {
      if (!quotaData) return;
      if (quotaData.paketTipi) state.plan = normalizePlan(quotaData.paketTipi);
      if (quotaData.rol) state.role = quotaData.rol;
      if (quotaData.name) state.studentName = quotaData.name;
      if (Number(quotaData.grade || quotaData.sinif) >= 5) state.grade = Number(quotaData.grade || quotaData.sinif);
      if (Number(quotaData.zarifPuan) > 0) state.xp = Math.max(state.xp, Number(quotaData.zarifPuan));
      if (Number(quotaData.haftalikPuan) > 0) state.weeklyXp = Math.max(state.weeklyXp, Number(quotaData.haftalikPuan));
      if (Number(quotaData.seriGunSayisi) > 0) state.streakDays = Math.max(state.streakDays, Number(quotaData.seriGunSayisi));
      if (quotaData.seriKorumaKalkani) state.hasShield = true;
      render();
    },
    setLeaderboard: function (list) {
      state.apiLeaderboard = Array.isArray(list) ? list : [];
      render();
    },
    refresh: render
  };

  function init() {
    if (!$('liderlikSertifikaRoot')) return;
    render();
    if (global.ZarifStore && global.ZarifStore.events) {
      global.ZarifStore.events.subscribe('tests', render);
      global.ZarifStore.events.subscribe('assignments', render);
    }
    global.addEventListener('zarif:gamification-change', render);
    global.addEventListener('zarif:plan-change', function (e) {
      var d = e && e.detail;
      if (!d) return;
      state.plan = normalizePlan(d.plan);
      if (d.isStaff) state.role = 'admin';
      if (d.registeredGrade >= 5) state.grade = Number(d.registeredGrade);
      render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
