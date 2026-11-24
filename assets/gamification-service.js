/**
 * ZarifÇözüm Merkezi Oyunlaştırma Servisi (Gamification Service)
 * Mevcut MongoDB (zarifPuan, haftalikPuan, seriGunSayisi, kazanilanRozetler)
 * ve ZarifStore (tests, assignments) ile senkronize çalışır.
 *
 * Paneller:
 *  - Öğrenci Paneli: Üst bar XP + Günlük Seri, Seviye Çubuğu, Kilitli/Açık Rozet Koleksiyonu,
 *                    Sınıf Bazlı Madalyalı Haftalık Liderlik Tablosu, Kutlama Toast'ı
 *  - Öğretmen Paneli: "+20 Motivasyon Puanı Gönder" aksiyonu
 *  - Veli Paneli: Öğrenci seviye, haftalık XP, günlük seri ve son rozetler özeti
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'zc_gamification_v1';
  const EVENT_NAME = 'zarif:gamification-change';

  const LEVELS = [
    { level: 1, name: 'Matematik Kaşifi', minXp: 0, icon: '🧭' },
    { level: 2, name: 'İşlem Ustası', minXp: 150, icon: '⚡' },
    { level: 3, name: 'Problem Çözücü', minXp: 350, icon: '🧩' },
    { level: 4, name: 'Maarif Yıldızı', minXp: 650, icon: '🌟' },
    { level: 5, name: 'Analitik Dâhi', minXp: 1100, icon: '🧠' },
    { level: 6, name: 'Zarif Efsane', minXp: 1700, icon: '👑' }
  ];

  const BADGE_CATALOG = [
    { id: 'first_test', title: 'İlk Adım', icon: '🎯', howTo: 'İlk testini veya mini testini tamamla.' },
    { id: 'streak_5', title: '5 Günlük Seri', icon: '🔥', howTo: '5 gün üst üste platforma giriş yap.' },
    { id: 'perfect_score', title: 'Tam Puan Şampiyonu', icon: '🏆', howTo: 'Bir testten %100 tam puan al.' },
    { id: 'homework_hero', title: 'Ödev Kahramanı', icon: '📚', howTo: 'Öğretmeninin atadığı bir çalışmayı tamamla.' },
    { id: 'teacher_praise', title: 'Öğretmen Takdiri', icon: '🌟', howTo: 'Öğretmeninden +20 Motivasyon Puanı kazan.' },
    { id: 'weekly_star', title: 'Haftalık Yıldız', icon: '👑', howTo: 'Haftalık 200 XP barajını aş.' }
  ];

  const SAMPLE_CLASSMATES = [
    { name: 'Defne A.', grade: 7, weeklyXp: 420, lig: 'Altın' },
    { name: 'Yusuf K.', grade: 7, weeklyXp: 360, lig: 'Altın' },
    { name: 'Zeynep K.', grade: 7, weeklyXp: 290, lig: 'Gümüş' },
    { name: 'Emir Ş.', grade: 7, weeklyXp: 210, lig: 'Gümüş' },
    { name: 'Azra Ç.', grade: 7, weeklyXp: 140, lig: 'Bronz' }
  ];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultState() {
    return {
      studentName: 'Öğrenci',
      grade: 7,
      xp: 120,
      weeklyXp: 80,
      streakDays: 1,
      lastLoginDate: todayStr(),
      badges: ['first_test'],
      motivationLog: [],
      processedTestIds: [],
      processedAsgIds: []
    };
  }

  function readState() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed || {});
    } catch {
      return defaultState();
    }
  }

  function writeState(next) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    } catch {}
  }

  function computeLevel(xp) {
    const val = Math.max(0, Number(xp) || 0);
    let current = LEVELS[0];
    let next = LEVELS[1] || null;
    for (let i = 0; i < LEVELS.length; i++) {
      if (val >= LEVELS[i].minXp) {
        current = LEVELS[i];
        next = LEVELS[i + 1] || null;
      }
    }
    if (!next) {
      return {
        level: current.level,
        name: current.name,
        icon: current.icon,
        currentXp: val,
        nextLevelXp: current.minXp,
        remainingXp: 0,
        percent: 100
      };
    }
    const span = Math.max(1, next.minXp - current.minXp);
    const gained = val - current.minXp;
    const percent = Math.max(0, Math.min(100, Math.round((gained / span) * 100)));
    return {
      level: current.level,
      name: current.name,
      icon: current.icon,
      currentXp: val,
      nextLevelXp: next.minXp,
      remainingXp: Math.max(0, next.minXp - val),
      percent
    };
  }

  function checkDailyStreak(st) {
    const today = todayStr();
    if (st.lastLoginDate === today) return st;
    const prev = st.lastLoginDate ? new Date(st.lastLoginDate) : null;
    const diffDays = prev ? Math.round((new Date(today) - prev) / (24 * 60 * 60 * 1000)) : 0;
    if (diffDays === 1) {
      st.streakDays = (Number(st.streakDays) || 0) + 1;
    } else if (diffDays > 1 || !st.streakDays) {
      st.streakDays = Math.max(1, Number(st.streakDays) || 1);
    }
    st.lastLoginDate = today;
    if (st.streakDays >= 5 && !st.badges.includes('streak_5')) {
      st.badges.push('streak_5');
    }
    return st;
  }

  function showCelebrationToast({ title, subtitle, xpDelta = 0, icon = '🎉' }) {
    try {
      let host = document.getElementById('zcGamifyToastHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'zcGamifyToastHost';
        host.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:99998;display:flex;flex-direction:column;gap:10px;max-width:360px;pointer-events:none;';
        document.body.appendChild(host);
      }
      const toast = document.createElement('div');
      toast.style.cssText = [
        'pointer-events:auto',
        'background:linear-gradient(135deg,#2c1a0e 0%,#462714 100%)',
        'color:#FBF9F5',
        'border:2px solid #d97706',
        'border-radius:14px',
        'padding:14px 16px',
        'box-shadow:0 16px 36px rgba(44,26,14,0.32)',
        'display:flex',
        'align-items:center',
        'gap:12px',
        'transition:opacity .3s ease,transform .3s ease'
      ].join(';');
      toast.innerHTML = `
        <div style="font-size:1.75rem;line-height:1;">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;font-size:0.92rem;color:#fde68a;">${esc(title)}</div>
          <div style="font-size:0.8rem;color:#f5ebe0;margin-top:2px;">${esc(subtitle)}</div>
        </div>
        ${xpDelta > 0 ? `<span style="padding:4px 9px;border-radius:999px;background:#C84B31;color:#fff;font-size:0.78rem;font-weight:800;white-space:nowrap;">+${xpDelta} XP</span>` : ''}
      `;
      host.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 320);
      }, 4200);
    } catch {}
  }

  function getProfile() {
    const st = checkDailyStreak(readState());
    return Object.assign({}, st, { levelInfo: computeLevel(st.xp) });
  }

  function awardXp({ amount = 10, reason = 'Çalışma tamamlandı', badgeId = null, silent = false } = {}) {
    const st = checkDailyStreak(readState());
    const prevLevel = computeLevel(st.xp).level;
    const pts = Math.max(0, Number(amount) || 0);
    st.xp = (Number(st.xp) || 0) + pts;
    st.weeklyXp = (Number(st.weeklyXp) || 0) + pts;

    const unlockedBadges = [];
    if (badgeId && !st.badges.includes(badgeId)) {
      st.badges.push(badgeId);
      unlockedBadges.push(badgeId);
    }
    if (st.weeklyXp >= 200 && !st.badges.includes('weekly_star')) {
      st.badges.push('weekly_star');
      unlockedBadges.push('weekly_star');
    }

    const nextLevelInfo = computeLevel(st.xp);
    writeState(st);

    if (!silent) {
      if (nextLevelInfo.level > prevLevel) {
        showCelebrationToast({
          icon: nextLevelInfo.icon,
          title: `Tebrikler! Seviye ${nextLevelInfo.level} Oldun`,
          subtitle: `Yeni unvanın: ${nextLevelInfo.name}`,
          xpDelta: pts
        });
      } else if (unlockedBadges.length) {
        const b = BADGE_CATALOG.find(item => item.id === unlockedBadges[0]);
        showCelebrationToast({
          icon: b ? b.icon : '🏅',
          title: `Yeni Rozet Kazandın: ${b ? b.title : 'Başarı'}`,
          subtitle: reason,
          xpDelta: pts
        });
      } else if (pts > 0) {
        showCelebrationToast({
          icon: '⚡',
          title: 'Harika Gidiyorsun!',
          subtitle: reason,
          xpDelta: pts
        });
      }
    }
    return getProfile();
  }

  function sendMotivationPoints({ studentName = 'Öğrenci', studentId = '', teacherName = '', points = 20 } = {}) {
    const st = checkDailyStreak(readState());
    const pts = Math.max(5, Number(points) || 20);
    const tName = teacherName || (global.localStorage && global.localStorage.getItem('zarif_teacher_name')) || 'Öğretmenin';
    st.xp = (Number(st.xp) || 0) + pts;
    st.weeklyXp = (Number(st.weeklyXp) || 0) + pts;
    if (!st.badges.includes('teacher_praise')) st.badges.push('teacher_praise');
    if (st.weeklyXp >= 200 && !st.badges.includes('weekly_star')) st.badges.push('weekly_star');
    st.motivationLog = [
      {
        id: 'mot_' + Date.now().toString(36),
        studentId,
        studentName,
        teacherName: tName,
        points: pts,
        createdAt: new Date().toISOString()
      },
      ...(st.motivationLog || [])
    ].slice(0, 30);
    writeState(st);
    return getProfile();
  }

  function syncFromServer(serverData) {
    if (!serverData) return getProfile();
    const st = checkDailyStreak(readState());
    if (serverData.name) st.studentName = serverData.name;
    if (Number(serverData.grade || serverData.sinif) >= 5) {
      st.grade = Number(serverData.grade || serverData.sinif);
    }
    if (Number(serverData.zarifPuan) > st.xp) st.xp = Number(serverData.zarifPuan);
    if (Number(serverData.haftalikPuan) > st.weeklyXp) st.weeklyXp = Number(serverData.haftalikPuan);
    if (Number(serverData.seriGunSayisi) > st.streakDays) st.streakDays = Number(serverData.seriGunSayisi);
    if (Array.isArray(serverData.kazanilanRozetler)) {
      serverData.kazanilanRozetler.forEach(r => {
        const key = String(r.kod || r.id || '').trim();
        if (key && !st.badges.includes(key)) st.badges.push(key);
      });
    }
    writeState(st);
    return getProfile();
  }

  function syncZarifStoreTriggers() {
    if (!global.ZarifStore) return;
    const st = readState();
    let changed = false;

    if (global.ZarifStore.tests) {
      const testList = global.ZarifStore.tests.list();
      testList.forEach(t => {
        if (!t || !t.id || st.processedTestIds.includes(t.id)) return;
        st.processedTestIds.push(t.id);
        changed = true;
        const gained = Math.max(10, (Number(t.correct) || 0) * 10);
        const badge = Number(t.score) >= 100 ? 'perfect_score' : 'first_test';
        writeState(st);
        awardXp({
          amount: gained,
          reason: `${t.topicTitle || 'Test'} tamamlandı (%${t.score})`,
          badgeId: badge
        });
      });
    }

    if (global.ZarifStore.assignments) {
      const asgList = global.ZarifStore.assignments.list();
      asgList.forEach(a => {
        if (!a || !a.id || a.status !== 'completed' || st.processedAsgIds.includes(a.id)) return;
        st.processedAsgIds.push(a.id);
        changed = true;
        writeState(st);
        awardXp({
          amount: 25,
          reason: `${a.topicTitle || 'Ödev'} çalışması tamamlandı`,
          badgeId: 'homework_hero'
        });
      });
    }

    if (changed) renderAllMounts();
  }

  // =========================================================================
  // UI RENDERERS (Öğrenci Paneli & Veli Paneli)
  // =========================================================================
  function renderStudentHeaderBar() {
    const mount = document.getElementById('studentGamifyHeaderBar');
    if (!mount) return;
    const p = getProfile();
    mount.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span title="Toplam XP Puanın · Seviye ${p.levelInfo.level}: ${esc(p.levelInfo.name)}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#2c1a0e;color:#fde68a;font-size:0.82rem;font-weight:700;border:1px solid #d97706;">
          <span>⚡</span>
          <span>${p.xp.toLocaleString('tr-TR')} XP</span>
          <span style="opacity:0.75;font-weight:600;">· Sv.${p.levelInfo.level}</span>
        </span>
        <span title="Ardışık günlük çalışma serin" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:999px;background:#fff4eb;color:#C84B31;font-size:0.82rem;font-weight:800;border:1px solid #f0c9a8;">
          <span>🔥</span>
          <span>${p.streakDays} Gün Seri</span>
        </span>
      </div>
    `;
  }

  function renderStudentLevelAndBadges() {
    const levelMount = document.getElementById('gamifyLevelProgressCard');
    const collectionMount = document.getElementById('gamifyBadgeCollection');
    const p = getProfile();

    if (levelMount) {
      const lv = p.levelInfo;
      levelMount.innerHTML = `
        <div style="background:linear-gradient(135deg,#FBF9F5 0%,#f5ebe0 100%);border:1px solid #e4cbb2;border-left:5px solid #C84B31;border-radius:14px;padding:18px 20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:48px;height:48px;border-radius:14px;background:#2c1a0e;color:#fde68a;display:grid;place-items:center;font-size:1.5rem;">${lv.icon}</div>
              <div>
                <div style="font-size:0.76rem;font-weight:700;color:#C84B31;text-transform:uppercase;letter-spacing:0.5px;">MEVCUT SEVİYEN</div>
                <div style="font-size:1.15rem;font-weight:800;color:#2c1a0e;">Seviye ${lv.level} · ${esc(lv.name)}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.1rem;font-weight:800;color:#2c1a0e;">${p.xp.toLocaleString('tr-TR')} XP</div>
              <div style="font-size:0.78rem;color:#6a5242;">Bu hafta: <strong style="color:#C84B31;">+${p.weeklyXp} XP</strong></div>
            </div>
          </div>
          <div style="height:11px;border-radius:999px;background:#e9dccd;overflow:hidden;">
            <div style="width:${lv.percent}%;height:100%;background:linear-gradient(90deg,#C84B31 0%,#d97706 100%);transition:width .4s ease;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:0.78rem;color:#6a5242;">
            <span>İlerleme: <strong>%${lv.percent}</strong></span>
            <span>${lv.remainingXp > 0 ? `Sonraki seviyeye <strong>${lv.remainingXp} XP</strong> kaldı` : '🏆 Maksimum seviyedesin!'}</span>
          </div>
        </div>
      `;
    }

    if (collectionMount) {
      collectionMount.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;">
          ${BADGE_CATALOG.map(b => {
            const earned = p.badges.includes(b.id);
            return `
              <div title="${esc(b.howTo)}" style="padding:14px;border-radius:12px;border:1.5px solid ${earned ? '#d97706' : '#e2d7cc'};background:${earned ? 'linear-gradient(145deg,#fffdf8,#fef3c7)' : '#f5f2ee'};opacity:${earned ? '1' : '0.72'};text-align:center;position:relative;">
                <div style="font-size:1.85rem;filter:${earned ? 'none' : 'grayscale(100%)'};margin-bottom:6px;">${earned ? b.icon : '🔒'}</div>
                <div style="font-weight:800;font-size:0.86rem;color:${earned ? '#2c1a0e' : '#6b7280'};">${esc(b.title)}</div>
                <div style="font-size:0.74rem;color:${earned ? '#92400e' : '#6b7280'};margin-top:4px;line-height:1.35;">${esc(b.howTo)}</div>
                <span style="display:inline-block;margin-top:7px;padding:2px 8px;border-radius:999px;font-size:0.68rem;font-weight:700;background:${earned ? '#d97706' : '#e5e7eb'};color:${earned ? '#fff' : '#4b5563'};">
                  ${earned ? '✓ Kazanıldı' : 'Kilitli'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const streakEl = document.getElementById('gamifyStreakCount');
    if (streakEl && p.streakDays > 0) {
      streakEl.textContent = `${p.streakDays} Gün`;
    }
  }

  function renderLeaderboardRows(serverRows) {
    const container = document.getElementById('leaderboardList');
    if (!container) return;
    const p = getProfile();
    const gradeLabelEl = document.getElementById('leaderboardGradeTag');
    if (gradeLabelEl) gradeLabelEl.textContent = `${p.grade}. Sınıf Ligi`;

    let rows = Array.isArray(serverRows) && serverRows.length
      ? serverRows.map(r => ({
          name: r.ad || r.name || 'Öğrenci',
          weeklyXp: Number(r.haftalikPuan ?? r.weeklyXp) || 0,
          lig: r.mevcutLig || 'Bronz',
          isMe: Boolean(r.isCurrentUser)
        }))
      : [
          ...SAMPLE_CLASSMATES.map(c => ({ name: c.name, weeklyXp: c.weeklyXp, lig: c.lig, isMe: false })),
          { name: `${p.studentName} (Sen)`, weeklyXp: p.weeklyXp, lig: p.weeklyXp >= 300 ? 'Altın' : (p.weeklyXp >= 150 ? 'Gümüş' : 'Bronz'), isMe: true }
        ];

    rows.sort((a, b) => b.weeklyXp - a.weeklyXp);

    container.innerHTML = rows.slice(0, 10).map((item, idx) => {
      const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}.`));
      const rowBg = item.isMe
        ? 'linear-gradient(135deg,#fff4eb,#fde8d7)'
        : (idx === 0 ? '#fffbeb' : (idx < 3 ? '#fdfaf3' : '#FBF9F5'));
      const rowBorder = item.isMe ? '2px solid #C84B31' : (idx < 3 ? '1px solid #f59e0b' : '1px solid #e6d7c8');
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;background:${rowBg};border:${rowBorder};">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-weight:800;font-size:${idx < 3 ? '1.15rem' : '0.88rem'};width:28px;text-align:center;color:#2c1a0e;">${medal}</span>
            <strong style="color:#2c1a0e;font-size:0.9rem;">${esc(item.name)}</strong>
            <span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:#fff;border:1px solid #e4cbb2;color:#7a4f2d;">${esc(item.lig)}</span>
          </div>
          <strong style="color:#C84B31;font-size:0.92rem;">${item.weeklyXp.toLocaleString('tr-TR')} XP</strong>
        </div>
      `;
    }).join('');
  }

  function renderParentGamificationCard() {
    const mount = document.getElementById('parentGamifySummaryMount');
    if (!mount) return;
    const p = getProfile();
    const lv = p.levelInfo;
    const earnedBadges = BADGE_CATALOG.filter(b => p.badges.includes(b.id)).slice(0, 4);

    mount.innerHTML = `
      <div style="background:linear-gradient(135deg,#FBF9F5 0%,#f6ede2 100%);border:1px solid #e4cbb2;border-left:4px solid #C84B31;border-radius:14px;padding:16px 18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div>
            <div style="font-size:0.74rem;font-weight:800;color:#C84B31;text-transform:uppercase;letter-spacing:0.5px;">🏆 ÖĞRENCİ OYUNLAŞTIRMA &amp; MOTİVASYON ÖZETİ</div>
            <div style="font-size:1.05rem;font-weight:800;color:#2c1a0e;margin-top:2px;">${lv.icon} Seviye ${lv.level}: ${esc(lv.name)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span style="padding:5px 11px;border-radius:999px;background:#2c1a0e;color:#fde68a;font-size:0.8rem;font-weight:700;">⚡ Haftalık +${p.weeklyXp} XP</span>
            <span style="padding:5px 11px;border-radius:999px;background:#fff4eb;border:1px solid #f0c9a8;color:#C84B31;font-size:0.8rem;font-weight:700;">🔥 ${p.streakDays} Gün Seri</span>
          </div>
        </div>
        <div style="height:9px;border-radius:999px;background:#e9dccd;overflow:hidden;margin-bottom:10px;">
          <div style="width:${lv.percent}%;height:100%;background:linear-gradient(90deg,#C84B31,#d97706);"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:0.78rem;color:#6a5242;font-weight:600;">Son Rozetler:</span>
            ${earnedBadges.length ? earnedBadges.map(b => `
              <span style="padding:3px 9px;border-radius:999px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-size:0.76rem;font-weight:700;">${b.icon} ${esc(b.title)}</span>
            `).join('') : '<span style="font-size:0.78rem;color:#8c7361;">Henüz rozet kazanılmadı.</span>'}
          </div>
          <span style="font-size:0.76rem;color:#6a5242;">Toplam: <strong>${p.xp.toLocaleString('tr-TR')} XP</strong></span>
        </div>
      </div>
    `;
  }

  function renderAllMounts() {
    renderStudentHeaderBar();
    renderStudentLevelAndBadges();
    renderParentGamificationCard();
  }

  function init() {
    syncZarifStoreTriggers();
    renderAllMounts();

    global.addEventListener(EVENT_NAME, renderAllMounts);
    global.addEventListener('storage', e => {
      if (e && e.key === STORAGE_KEY) renderAllMounts();
    });

    if (global.ZarifStore && global.ZarifStore.events) {
      global.ZarifStore.events.subscribe('tests', syncZarifStoreTriggers);
      global.ZarifStore.events.subscribe('assignments', syncZarifStoreTriggers);
    }
  }

  global.ZarifGamification = {
    VERSION: '1.0.0',
    LEVELS,
    BADGE_CATALOG,
    getProfile,
    awardXp,
    sendMotivationPoints,
    syncFromServer,
    showCelebrationToast,
    renderAllMounts,
    renderLeaderboardRows
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
