/**
 * ZarifÇözüm Veli Takip Paneli Kontrolcüsü
 * Palet: Krem (#FAF6F0), Koyu Espresso (#3E2F26), Altın (#C59B47)
 * ZarifStore (tests, assignments) + ZarifGamification + ZarifMessageService + Chart.js + Lucide
 */
(() => {
  'use strict';

  const PREFS_KEY = 'zc_parent_notify_prefs_v1';
  const ACTIVE_CONV_ID = 'conv_teacher1_parent_ayse';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const SAMPLE_TOPICS = [
    { topicTitle: 'Doğrular ve Açılar', attempts: 3, avgScore: 88, status: 'strong' },
    { topicTitle: 'Cebirsel İfadeler', attempts: 2, avgScore: 76, status: 'improving' },
    { topicTitle: 'Rasyonel Sayılar', attempts: 2, avgScore: 64, status: 'improving' },
    { topicTitle: 'Oran ve Orantı', attempts: 2, avgScore: 52, status: 'review' }
  ];

  const SAMPLE_EXAMS = [
    { createdAt: new Date(Date.now() - 1 * 86400000).toISOString(), topicTitle: 'Doğrular ve Açılar Kazanım Testi', grade: 7, correct: 9, total: 10, score: 90 },
    { createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), topicTitle: 'Cebirsel İfadeler Mini Test', grade: 7, correct: 4, total: 5, score: 80 },
    { createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), topicTitle: 'Oran ve Orantı Tarama', grade: 7, correct: 3, total: 6, score: 50 }
  ];

  let parentCtx = {
    parentName: 'Değerli Velimiz',
    studentName: 'Öğrenci',
    grade: 7,
    isRealSession: false
  };
  let trendChart = null;

  function initialsOf(name) {
    const parts = String(name || 'Ö').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(p => p[0].toUpperCase()).join('') || 'Ö';
  }

  async function detectParentAndStudent() {
    // 1. Önce Gamification / Store profilinden kayıtlı öğrenci adını al
    const gProf = window.ZarifGamification?.getProfile?.();
    if (gProf) {
      if (gProf.studentName && gProf.studentName !== 'Öğrenci') parentCtx.studentName = gProf.studentName;
      if (Number(gProf.grade) >= 5 && Number(gProf.grade) <= 12) parentCtx.grade = Number(gProf.grade);
    }
    const savedGrade = Number(localStorage.getItem('zarif_student_grade'));
    if (savedGrade >= 5 && savedGrade <= 12) parentCtx.grade = savedGrade;

    // 2. Oturum API'sinden gerçek giriş yapan kullanıcı/öğrenci bilgisini kontrol et
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        const u = d?.user || d;
        if (u && u.name) {
          parentCtx.isRealSession = true;
          if (u.role === 'parent') {
            parentCtx.parentName = u.name;
            if (u.relatedStudentName || u.studentName) {
              parentCtx.studentName = u.relatedStudentName || u.studentName;
            }
          } else if (u.role === 'student') {
            parentCtx.studentName = u.name;
            parentCtx.parentName = `${u.name.split(' ')[0]}'in Velisi`;
          } else {
            parentCtx.parentName = u.name;
          }
          if (Number(u.grade || u.sinif || u.kayitliSinif) >= 5) {
            parentCtx.grade = Number(u.grade || u.sinif || u.kayitliSinif);
          }
        }
      }
    } catch {}

    // 3. Eğer ZarifStore.assignments içinde gerçek bir öğrenci adı varsa onu da yansıt
    if (parentCtx.studentName === 'Öğrenci') {
      const asgs = window.ZarifStore?.assignments?.list?.() || [];
      const named = asgs.find(a => a.studentName && !/tüm|genel|öğrenci/i.test(a.studentName));
      if (named) parentCtx.studentName = named.studentName;
    }

    updateIdentityHeader();
  }

  function updateIdentityHeader() {
    if ($('vpGreetingTitle')) $('vpGreetingTitle').textContent = `Hoş Geldiniz, ${parentCtx.parentName}`;
    if ($('vpGreetingDesc')) {
      $('vpGreetingDesc').textContent = `${parentCtx.studentName} (${parentCtx.grade}. Sınıf) için haftalık çalışma temposu, Maarif Modeli kazanımları ve öğretmen raporları.`;
    }
    if ($('vpHeaderStudentPill')) {
      $('vpHeaderStudentPill').textContent = `🎓 ${parentCtx.studentName} · ${parentCtx.grade}. Sınıf`;
    }
    if ($('vpSidebarAvatar')) $('vpSidebarAvatar').textContent = initialsOf(parentCtx.studentName);
    if ($('vpSidebarStudentName')) $('vpSidebarStudentName').textContent = parentCtx.studentName;
    if ($('vpSidebarStudentMeta')) $('vpSidebarStudentMeta').textContent = `${parentCtx.grade}. Sınıf · Maarif Modeli`;
  }

  function getLiveOrSampleData() {
    const realTests = window.ZarifStore?.tests?.list?.() || [];
    const realSummary = window.ZarifStore?.tests?.getTopicSummary?.() || { topics: [], recommendation: '' };
    const realAssignments = window.ZarifStore?.assignments?.list?.() || [];
    const isMock = realTests.length === 0;

    const badge = $('vpDataModeBadge');
    if (badge) badge.style.display = isMock ? 'inline-flex' : 'none';

    return {
      isMock,
      tests: isMock ? SAMPLE_EXAMS : realTests,
      topics: isMock ? SAMPLE_TOPICS : realSummary.topics,
      recommendation: realSummary.recommendation || 'Oran ve Orantı konusunda kısa bir tekrar ve ardından onaylı pratik testi önerilir.',
      assignments: realAssignments
    };
  }

  function renderKpis(data) {
    const grid = $('vpKpiGrid');
    if (!grid) return;

    const totalQ = data.tests.reduce((s, t) => s + (Number(t.total) || 0), 0);
    const avgScore = data.tests.length
      ? Math.round(data.tests.reduce((s, t) => s + (Number(t.score) || 0), 0) / data.tests.length)
      : 0;
    const doneAsg = data.assignments.filter(a => a.status === 'completed').length;
    const totalAsg = data.assignments.length;
    const gProf = window.ZarifGamification?.getProfile?.() || { weeklyXp: 80, streakDays: 1 };

    if ($('vpSidebarStudentStats')) {
      $('vpSidebarStudentStats').textContent = `✓ ${totalQ} Soru · %${avgScore} Ortalama · 🔥 ${gProf.streakDays} Gün`;
    }

    grid.innerHTML = [
      { icon: 'check-circle-2', val: `${totalQ} Soru`, lbl: 'Çözülen Toplam Soru' },
      { icon: 'bar-chart-2', val: `%${avgScore}`, lbl: 'Genel Başarı Ortalaması' },
      { icon: 'clipboard-check', val: `${doneAsg} / ${totalAsg}`, lbl: 'Tamamlanan Öğretmen Görevi' },
      { icon: 'sparkles', val: `+${(gProf.weeklyXp || 0).toLocaleString('tr-TR')} XP`, lbl: 'Bu Haftaki Motivasyon Puanı' }
    ].map(k => `
      <div class="vp-kpi-card">
        <div class="vp-kpi-ico"><i data-lucide="${k.icon}" style="width:20px;height:20px;"></i></div>
        <div>
          <strong class="vp-kpi-val">${esc(k.val)}</strong>
          <span class="vp-kpi-lbl">${esc(k.lbl)}</span>
        </div>
      </div>
    `).join('');
  }

  function renderTrendChart(data) {
    const canvas = $('parentTrendCanvas');
    if (!canvas || typeof window.Chart !== 'function') return;
    if (trendChart) trendChart.destroy();

    let labels = ['Hafta 1', 'Hafta 2', 'Hafta 3', 'Hafta 4', 'Hafta 5', 'Hafta 6'];
    let scoreVals = [58, 64, 68, 74, 79, 85];
    if (!data.isMock && window.ZarifStore?.tests?.getWeeklyTrend) {
      const weekly = window.ZarifStore.tests.getWeeklyTrend(6);
      if (weekly.some(w => w.count > 0)) {
        labels = weekly.map(w => w.label);
        scoreVals = weekly.map(w => w.avgScore);
      }
    }

    trendChart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Haftalık Başarı (%)',
          data: scoreVals,
          borderColor: '#C59B47',
          backgroundColor: 'rgba(197, 155, 71, 0.16)',
          fill: true,
          tension: 0.36,
          pointBackgroundColor: '#3E2F26',
          pointBorderColor: '#C59B47',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => `%${v}` } }
        }
      }
    });
  }

  function renderAssignments(data) {
    const listEl = $('vpAssignmentsList');
    const tag = $('vpAssignPendingTag');
    if (!listEl) return;

    const pending = data.assignments.filter(a => a.status !== 'completed').length;
    if (tag) {
      tag.textContent = `${pending} Bekleyen`;
      tag.className = `vp-badge ${pending > 0 ? 'warn' : 'ok'}`;
    }

    if (!data.assignments.length) {
      listEl.innerHTML = '<div class="vp-row-item"><span style="color:var(--muted);">Öğretmen tarafından henüz hedefli çalışma atanmadı. Atandığında anında burada görünür.</span></div>';
      return;
    }

    listEl.innerHTML = data.assignments.slice(0, 6).map(a => {
      const done = a.status === 'completed';
      const due = a.dueDate ? new Date(a.dueDate).toLocaleDateString('tr-TR') : '—';
      return `
        <div class="vp-row-item">
          <div style="min-width:0;">
            <strong style="display:block;color:var(--espresso);">${esc(a.topicTitle)}</strong>
            <small style="color:var(--muted);">${esc(a.teacherName || 'Öğretmen')} · Son tarih: ${due}</small>
          </div>
          <span class="vp-badge ${done ? 'ok' : 'warn'}">${done ? '✓ Tamamlandı' : '⏳ Devam Ediyor'}</span>
        </div>
      `;
    }).join('');
  }

  function renderTopicPerformance(data) {
    const listEl = $('vpTopicPerfList');
    const tbody = $('vpOutcomesTbody');

    if (listEl) {
      listEl.innerHTML = data.topics.slice(0, 5).map(t => {
        const cls = t.avgScore >= 75 ? 'ok' : (t.avgScore >= 55 ? 'warn' : 'low');
        const lbl = t.avgScore >= 75 ? 'Güçlü' : (t.avgScore >= 55 ? 'Gelişiyor' : 'Destek Gerekli');
        return `
          <div class="vp-row-item">
            <div>
              <strong style="display:block;color:var(--espresso);">${esc(t.topicTitle)}</strong>
              <small style="color:var(--muted);">${t.attempts || 1} değerlendirme</small>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <strong style="color:var(--espresso);">%${t.avgScore}</strong>
              <span class="vp-badge ${cls}">${lbl}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    if (tbody) {
      tbody.innerHTML = data.topics.map(t => {
        const cls = t.avgScore >= 75 ? 'ok' : (t.avgScore >= 55 ? 'warn' : 'low');
        const lbl = t.avgScore >= 75 ? 'İyi' : (t.avgScore >= 55 ? 'Orta' : 'Tekrar Önerilir');
        const tip = t.avgScore >= 75
          ? 'Konu kavranmış; yeni nesil pekiştirme testlerine geçilebilir.'
          : (t.avgScore >= 55 ? 'Kısa konu özeti + 10 soruluk pratikle %75 üzerine çıkabilir.' : 'Öncelikli tekrar ve öğretmen hedefli çalışması önerilir.');
        return `
          <tr>
            <td><strong>${esc(t.topicTitle)}</strong></td>
            <td>${t.attempts || 1}</td>
            <td><strong>%${t.avgScore}</strong></td>
            <td><span class="vp-badge ${cls}">${lbl}</span></td>
            <td style="color:var(--muted);">${tip}</td>
          </tr>
        `;
      }).join('');
    }
  }

  function renderExamsAndReports(data) {
    const examsTbody = $('vpExamsTbody');
    if (examsTbody) {
      examsTbody.innerHTML = data.tests.map(t => {
        const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('tr-TR') : '—';
        const cls = t.score >= 75 ? 'ok' : (t.score >= 55 ? 'warn' : 'low');
        return `
          <tr>
            <td>${dateStr}</td>
            <td><strong>${esc(t.topicTitle)}</strong></td>
            <td>${t.grade || parentCtx.grade}. Sınıf</td>
            <td>${t.correct} / ${t.total}</td>
            <td><span class="vp-badge ${cls}">%${t.score}</span></td>
          </tr>
        `;
      }).join('');
    }

    const snippet = $('vpTeacherReportSnippet');
    if (snippet) {
      snippet.innerHTML = `<strong>📋 Güncel Öğretmen Özeti:</strong> ${esc(data.recommendation)}`;
    }

    const reportsList = $('vpSharedReportsList');
    if (reportsList) {
      const reportCards = [
        { title: `${parentCtx.grade}. Sınıf Haftalık Başarı Analizi`, date: new Date().toLocaleDateString('tr-TR'), note: data.recommendation },
        ...(data.assignments.slice(0, 3).map(a => ({
          title: `Hedefli Çalışma Raporu: ${a.topicTitle}`,
          date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('tr-TR') : '—',
          note: a.note || 'Öğretmen tarafından atanan tekrar çalışması.'
        })))
      ];
      reportsList.innerHTML = reportCards.map(r => `
        <div class="vp-row-item" style="flex-direction:column;align-items:stretch;gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <strong style="color:var(--espresso);">${esc(r.title)}</strong>
            <small style="color:var(--muted);">${esc(r.date)}</small>
          </div>
          <p style="font-size:0.83rem;color:var(--muted);margin:0;">${esc(r.note)}</p>
        </div>
      `).join('');
    }
  }

  // Mesajlaşma (ZarifMessageService ile canlı senkron)
  function renderChatMessages() {
    const flowEl = $('parentChatFlow');
    if (!flowEl) return;
    const conv = window.ZarifMessageService?.getConversationById?.(ACTIVE_CONV_ID);
    if (!conv || !Array.isArray(conv.messages) || !conv.messages.length) {
      flowEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px 0;font-size:0.85rem;">Henüz mesaj yok. Öğretmene ilk mesajı aşağıdan yazabilirsiniz.</div>';
      return;
    }
    flowEl.innerHTML = conv.messages.map(msg => {
      const isParent = msg.senderRole === 'parent';
      const time = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
      return `
        <div class="msg-row ${isParent ? 'parent' : 'teacher'}">
          <div class="msg-bubble">${esc(msg.text)}</div>
          <div class="msg-meta"><span>${esc(time)}</span>${isParent ? (msg.isRead ? '<span>✓✓ Okundu</span>' : '<span>✓ İletildi</span>') : ''}</div>
        </div>
      `;
    }).join('');
    flowEl.scrollTop = flowEl.scrollHeight;
  }

  function updateMsgBadges(convs, unreadCount) {
    const badge = $('parentMessagesBadge');
    if (!badge) return;
    const count = typeof unreadCount === 'number'
      ? unreadCount
      : (window.ZarifMessageService ? window.ZarifMessageService.getUnreadCount('parent') : 0);
    badge.textContent = String(count);
    badge.classList.toggle('show', count > 0);
  }

  async function sendParentMessage(text) {
    if (!text || !window.ZarifMessageService) return;
    await window.ZarifMessageService.sendMessage({
      conversationId: ACTIVE_CONV_ID,
      text,
      senderId: 'parent_ayse',
      senderName: parentCtx.parentName,
      senderRole: 'parent',
      targetUserId: 'teacher_1',
      targetName: 'Matematik Öğretmeni',
      targetRole: 'teacher',
      relatedStudentName: parentCtx.studentName
    });
    renderChatMessages();
  }

  function initNotificationPrefs() {
    const defaults = { weeklyEmail: true, assignmentAlert: true, examAlert: true };
    let prefs = defaults;
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (saved) prefs = Object.assign({}, defaults, saved);
    } catch {}

    const elEmail = $('prefWeeklyEmail');
    const elAsg = $('prefAssignmentAlert');
    const elExam = $('prefExamAlert');
    if (elEmail) elEmail.checked = Boolean(prefs.weeklyEmail);
    if (elAsg) elAsg.checked = Boolean(prefs.assignmentAlert);
    if (elExam) elExam.checked = Boolean(prefs.examAlert);

    const savePrefs = () => {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
          weeklyEmail: Boolean(elEmail?.checked),
          assignmentAlert: Boolean(elAsg?.checked),
          examAlert: Boolean(elExam?.checked)
        }));
      } catch {}
      const b = $('vpPrefsSavedBadge');
      if (b) {
        b.style.display = 'inline-flex';
        setTimeout(() => { b.style.display = 'none'; }, 1800);
      }
    };
    [elEmail, elAsg, elExam].forEach(el => el?.addEventListener('change', savePrefs));
  }

  function switchTab(tabId) {
    document.querySelectorAll('.vp-nav-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.vp-tab').forEach(sec => {
      sec.classList.toggle('active', sec.id === tabId);
    });
    if (tabId === 'tab-messages' && window.ZarifMessageService) {
      window.ZarifMessageService.markAsRead(ACTIVE_CONV_ID, 'parent');
    }
  }

  function renderAll() {
    const data = getLiveOrSampleData();
    renderKpis(data);
    renderTrendChart(data);
    renderAssignments(data);
    renderTopicPerformance(data);
    renderExamsAndReports(data);
    if (window.ZarifGamification) window.ZarifGamification.renderAllMounts();
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  async function init() {
    await detectParentAndStudent();

    if (window.ZarifMessageService) {
      window.ZarifMessageService.init({
        role: 'parent',
        userId: 'parent_ayse',
        name: parentCtx.parentName,
        relatedStudentName: parentCtx.studentName
      });
      window.ZarifMessageService.subscribe((convs, unread) => {
        renderChatMessages();
        updateMsgBadges(convs, unread);
      });
    }

    document.querySelectorAll('.vp-nav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll('[data-jump-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.jumpTab));
    });

    $('vpPrintReportBtn')?.addEventListener('click', () => window.print());

    $('vpQuickMsgForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const inp = $('vpQuickMsgInput');
      const txt = (inp?.value || '').trim();
      if (!txt) return;
      inp.value = '';
      await sendParentMessage(txt);
      const st = $('vpQuickMsgStatus');
      if (st) {
        st.textContent = '✓ Mesajınız öğretmene anında iletildi.';
        setTimeout(() => { st.textContent = ''; }, 2500);
      }
    });

    $('parentMsgForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const inp = $('parentMsgInput');
      const txt = (inp?.value || '').trim();
      if (!txt) return;
      inp.value = '';
      await sendParentMessage(txt);
    });

    initNotificationPrefs();
    renderAll();
    renderChatMessages();
    updateMsgBadges();

    window.ZarifStore?.events?.subscribe?.('tests', renderAll);
    window.ZarifStore?.events?.subscribe?.('assignments', renderAll);
    window.addEventListener('zarif:gamification-change', renderAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
