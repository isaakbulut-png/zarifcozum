/**
 * ZarifÇözüm — Modern Deneme Sınavları Merkezi (İl Geneli & Türkiye Geneli)
 * - Üst Vitrin Hero Sınav Kartı + canlı geri sayım sayacı
 * - Kapsam sekmeleri: Tümü | Türkiye Geneli | İl Geneli | Tamamlanan Karnelerim
 * - Paket kontrolü: Temel/Standart/VIP tüm denemeler açık; Ücretsiz planda 1 Tanıtım Denemesi açık
 * - Tam Ekran Dijital Sınav Salonu & Canlı Optik Form (A-D / A-E, boş bırakma, sayaç)
 * - Net Hesaplamalı Sınav Karnesi (3Y-1D / 4Y-1D), Tahmini TG Yüzdelik & İl Sıralaması, Konu Dağılımı
 */
(function (global) {
  'use strict';

  var state = {
    activeTab: 'all', // 'all' | 'turkiye' | 'il' | 'reports'
    plan: 'free',
    isStaff: false,
    grade: 5,
    heroCountdownTimer: null,
    examSession: null,
    examTimer: null,
    reportCard: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatMath(text) {
    var clean = String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*\*/g, '');
    if (global.zarifMathText && typeof global.zarifMathText.format === 'function') {
      return global.zarifMathText.format(clean);
    }
    return esc(clean);
  }

  function formatMMSS(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function formatDateTR(iso) {
    try {
      return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Güncel';
    }
  }

  function detectPlanAndGrade() {
    if (global.ZarifPlanGuard && typeof global.ZarifPlanGuard.getState === 'function') {
      var ps = global.ZarifPlanGuard.getState();
      if (ps.loaded) {
        state.plan = ps.plan || 'free';
        state.isStaff = Boolean(ps.isStaff);
        if (ps.registeredGrade >= 5) state.grade = Number(ps.registeredGrade);
        return;
      }
    }
    var g = Number(global.localStorage && global.localStorage.getItem('zarif_student_grade'));
    if (g >= 5 && g <= 12) state.grade = g;
  }

  function isPaidPlan() {
    if (state.isStaff) return true;
    return ['temel', 'standart', 'vip'].indexOf(String(state.plan || '').toLowerCase()) !== -1;
  }

  function buildIntroExamQuestions(grade) {
    var isHigh = Number(grade) >= 9;
    var makeOpts = function (arr) {
      var letters = ['A', 'B', 'C', 'D', 'E'];
      return arr.slice(0, isHigh ? 5 : 4).map(function (t, i) {
        return { label: letters[i], text: t };
      });
    };
    return [
      {
        id: 'intro_q1',
        topic: 'Sayılar ve İşlemler',
        text: 'Bir kırtasiyeci tanesi 18 TL olan defterlerden 12 adet, tanesi 9 TL olan kalemlerden 8 adet satmıştır. Kırtasiyecinin toplam geliri kaç TL\'dir?',
        options: makeOpts(['264', '288', '296', '312', '324']),
        answer: 'B',
        explanation: '18 × 12 = 216 TL ve 9 × 8 = 72 TL; toplam 216 + 72 = 288 TL.'
      },
      {
        id: 'intro_q2',
        topic: 'Kesirler ve Oran',
        text: 'Bir su deposunun 2/5\'i doludur. Depoya 36 litre daha su eklendiğinde deponun tamamı dolduğuna göre deponun kapasitesi kaç litredir?',
        options: makeOpts(['48', '54', '60', '72', '80']),
        answer: 'C',
        explanation: 'Boş kısım 3/5\'tir. 3/5\'i 36 litre ise 1/5\'i 12 litre, tamamı 60 litredir.'
      },
      {
        id: 'intro_q3',
        topic: 'Cebirsel Düşünme',
        text: 'Bir sayının 3 katının 7 fazlası 40 olduğuna göre bu sayının 2 katı kaçtır?',
        options: makeOpts(['18', '20', '22', '24', '26']),
        answer: 'C',
        explanation: '3x + 7 = 40 ⇒ 3x = 33 ⇒ x = 11. İki katı 2 × 11 = 22.'
      },
      {
        id: 'intro_q4',
        topic: 'Geometri ve Ölçme',
        text: 'Çevresi 56 cm olan bir dikdörtgenin uzun kenarı kısa kenarından 4 cm fazladır. Bu dikdörtgenin alanı kaç cm²\'dir?',
        options: makeOpts(['180', '192', '196', '204', '210']),
        answer: 'B',
        explanation: 'Kısa + uzun = 28 cm. Kısa = 12 cm, uzun = 16 cm ⇒ Alan = 12 × 16 = 192 cm².'
      },
      {
        id: 'intro_q5',
        topic: 'Veri ve Olasılık',
        text: 'Dört sınavdan 82, 88, 90 ve 100 puan alan bir öğrencinin bu dört sınavdaki puan ortalaması kaçtır?',
        options: makeOpts(['88', '89', '90', '91', '92']),
        answer: 'C',
        explanation: '(82 + 88 + 90 + 100) / 4 = 360 / 4 = 90.'
      }
    ];
  }

  function getCatalogExams() {
    var grade = state.grade || 5;
    var now = Date.now();
    var storeExams = (global.ZarifStore && global.ZarifStore.mockExams)
      ? global.ZarifStore.mockExams.list()
      : [];

    var builtin = [
      {
        id: 'zc_intro_tg_free',
        title: 'ZarifÇözüm Türkiye Geneli Tanıtım Denemesi',
        grade: grade,
        scope: 'turkiye',
        province: 'Türkiye Geneli',
        durationMin: 15,
        startsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        isFreeIntro: true,
        participants: 1482,
        teacherName: 'ZarifÇözüm Ölçme Kurulu',
        questions: buildIntroExamQuestions(grade)
      },
      {
        id: 'zc_il_samsun_1',
        title: 'Samsun İl Geneli Maarif Modeli Matematik Denemesi',
        grade: grade,
        scope: 'il',
        province: 'Samsun',
        durationMin: 30,
        startsAt: new Date(now + 18 * 60 * 60 * 1000).toISOString(),
        isFreeIntro: false,
        participants: 640,
        teacherName: 'Samsun Matematik Zümresi',
        questions: buildIntroExamQuestions(grade)
      },
      {
        id: 'zc_tg_kasim_1',
        title: 'Kasım Ayı Türkiye Geneli Büyük Optik Deneme',
        grade: grade,
        scope: 'turkiye',
        province: 'Türkiye Geneli',
        durationMin: 40,
        startsAt: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
        isFreeIntro: false,
        participants: 3290,
        teacherName: 'ZarifÇözüm Ölçme Kurulu',
        questions: buildIntroExamQuestions(grade)
      }
    ];

    // Öğretmen/Admin panelinden yayınlanan gerçek denemeleri en öne ekle
    var merged = [];
    var seen = new Set();
    storeExams.concat(builtin).forEach(function (ex) {
      if (!ex || !ex.id || seen.has(ex.id)) return;
      seen.add(ex.id);
      merged.push(ex);
    });
    return merged;
  }

  function openUpgrade() {
    if (typeof global.openSubscriptionUpgradeModal === 'function') {
      global.openSubscriptionUpgradeModal();
    } else {
      global.location.href = '/Paketler.html?ref=denemeler';
    }
  }

  function startExam(examId) {
    var all = getCatalogExams();
    var exam = all.find(function (e) { return e.id === examId; });
    if (!exam) return;

    if (!exam.isFreeIntro && !isPaidPlan()) {
      openUpgrade();
      return;
    }

    var questions = (Array.isArray(exam.questions) && exam.questions.length)
      ? exam.questions
      : buildIntroExamQuestions(exam.grade || state.grade);

    var durationSec = Math.max(300, (Number(exam.durationMin) || 20) * 60);
    state.examSession = {
      exam: exam,
      questions: questions,
      answers: {},
      currentIdx: 0,
      totalSec: durationSec,
      remainingSec: durationSec,
      startedAt: Date.now()
    };
    state.reportCard = null;

    if (state.examTimer) clearInterval(state.examTimer);
    state.examTimer = setInterval(function () {
      if (!state.examSession) return;
      state.examSession.remainingSec = Math.max(0, state.examSession.remainingSec - 1);
      var tEl = $('dmOpticalTimer');
      if (tEl) tEl.textContent = formatMMSS(state.examSession.remainingSec);
      if (state.examSession.remainingSec <= 0) {
        submitOpticalExam();
      }
    }, 1000);

    renderOpticalModal();
  }

  function closeOpticalModal() {
    if (state.examTimer) { clearInterval(state.examTimer); state.examTimer = null; }
    state.examSession = null;
    state.reportCard = null;
    var modal = $('dmOpticalModal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    renderCenter();
  }

  function submitOpticalExam() {
    if (!state.examSession) return;
    if (state.examTimer) { clearInterval(state.examTimer); state.examTimer = null; }

    var ses = state.examSession;
    var ex = ses.exam;
    var grade = Number(ex.grade) || state.grade || 5;
    var wrongPenaltyDivisor = grade >= 9 ? 4 : 3; // 5-8: 3Y 1D, 9-12: 4Y 1D

    var correct = 0;
    var wrong = 0;
    var blank = 0;
    var topicMap = {};

    ses.questions.forEach(function (q, idx) {
      var ans = ses.answers[idx] || '';
      var qAns = String(q.answer || 'A').trim().toUpperCase().charAt(0);
      var topic = String(q.topic || 'Genel Matematik');
      if (!topicMap[topic]) topicMap[topic] = { topic: topic, total: 0, correct: 0 };
      topicMap[topic].total += 1;

      if (!ans) {
        blank++;
      } else if (ans === qAns) {
        correct++;
        topicMap[topic].correct += 1;
      } else {
        wrong++;
      }
    });

    var total = ses.questions.length;
    var net = Math.max(0, Number((correct - wrong / wrongPenaltyDivisor).toFixed(2)));
    var score = Math.max(0, Math.min(100, Math.round((net / Math.max(1, total)) * 100)));
    var turkeyPercentile = Number(Math.max(0.5, Math.min(95, 100 - score * 0.94)).toFixed(1));
    var provinceTotal = ex.participants || (ex.scope === 'il' ? 640 : 1480);
    var provinceRank = Math.max(1, Math.round((turkeyPercentile / 100) * provinceTotal));
    var elapsedSec = Math.max(1, ses.totalSec - ses.remainingSec);

    var topicBreakdown = Object.keys(topicMap).map(function (k) {
      var it = topicMap[k];
      return {
        topic: it.topic,
        total: it.total,
        correct: it.correct,
        pct: Math.round((it.correct / Math.max(1, it.total)) * 100)
      };
    });

    var report = {
      examId: ex.id,
      title: ex.title,
      scope: ex.scope,
      province: ex.province || 'Samsun',
      grade: grade,
      penaltyRule: wrongPenaltyDivisor === 3 ? '3 Yanlış 1 Doğru' : '4 Yanlış 1 Doğru',
      total: total,
      correct: correct,
      wrong: wrong,
      blank: blank,
      net: net,
      score: score,
      turkeyPercentile: turkeyPercentile,
      provinceRank: provinceRank,
      provinceTotal: provinceTotal,
      topicBreakdown: topicBreakdown,
      durationSec: elapsedSec,
      createdAt: new Date().toISOString()
    };

    if (global.ZarifStore && global.ZarifStore.mockExams) {
      global.ZarifStore.mockExams.recordAttempt(report);
    }
    if (global.ZarifGamification && typeof global.ZarifGamification.awardXp === 'function') {
      global.ZarifGamification.awardXp({
        amount: Math.max(25, correct * 12),
        reason: ex.title + ' tamamlandı (' + net + ' Net)'
      });
    }

    state.examSession = null;
    state.reportCard = report;
    renderOpticalModal();
  }

  function renderOpticalModal() {
    var modal = $('dmOpticalModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dmOpticalModal';
      modal.className = 'dm-modal-backdrop';
      document.body.appendChild(modal);
    }
    document.body.style.overflow = 'hidden';

    if (state.reportCard) {
      var r = state.reportCard;
      modal.innerHTML =
        '<div class="dm-report-shell">' +
          '<div class="dm-report-hero">' +
            '<div>' +
              '<span class="dm-badge gold">' + (r.scope === 'il' ? ('📍 ' + esc(r.province) + ' İl Geneli') : '🇹🇷 Türkiye Geneli') + ' · ' + esc(r.penaltyRule) + '</span>' +
              '<h2>' + esc(r.title) + ' — Deneme Karnesi</h2>' +
              '<p>Sonuçlarınız Başarı Raporları ve Öğretmen Analiz ekranına otomatik kaydedildi.</p>' +
            '</div>' +
            '<div class="dm-net-orb"><strong>' + r.net + '</strong><span>NET</span></div>' +
          '</div>' +
          '<div class="dm-report-kpis">' +
            '<div class="dm-rk ok"><strong>' + r.correct + '</strong><span>Doğru</span></div>' +
            '<div class="dm-rk err"><strong>' + r.wrong + '</strong><span>Yanlış</span></div>' +
            '<div class="dm-rk muted"><strong>' + r.blank + '</strong><span>Boş</span></div>' +
            '<div class="dm-rk gold"><strong>%' + r.turkeyPercentile + '</strong><span>Tahmini TG Dilimi</span></div>' +
            '<div class="dm-rk espresso"><strong>' + r.provinceRank + ' / ' + r.provinceTotal + '</strong><span>' + esc(r.scope === 'il' ? (r.province + ' Sırası') : 'Genel Sıralama') + '</span></div>' +
          '</div>' +
          '<div class="dm-topic-box">' +
            '<h4>📊 Konu Bazlı Başarı Dağılımı</h4>' +
            '<div class="dm-topic-bars">' +
              r.topicBreakdown.map(function (tb) {
                return '<div class="dm-tbar-row">' +
                  '<div class="dm-tbar-top"><span>' + esc(tb.topic) + '</span><strong>' + tb.correct + '/' + tb.total + ' (%' + tb.pct + ')</strong></div>' +
                  '<div class="dm-tbar-track"><div class="dm-tbar-fill" style="width:' + tb.pct + '%;"></div></div>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">' +
            '<button type="button" class="dm-btn-light" onclick="window.print()">🖨️ Karneyi Yazdır</button>' +
            '<button type="button" id="dmCloseReportBtn" class="dm-btn-gold">✓ Deneme Merkezine Dön</button>' +
          '</div>' +
        '</div>';

      $('dmCloseReportBtn')?.addEventListener('click', closeOpticalModal);
      return;
    }

    var ses = state.examSession;
    if (!ses) return;
    var q = ses.questions[ses.currentIdx];
    var grade = Number(ses.exam.grade) || state.grade || 5;
    var letters = grade >= 9 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
    var opts = Array.isArray(q.options) && q.options.length
      ? q.options
      : letters.map(function (l) { return { label: l, text: l + ' seçeneği' }; });
    var answeredCount = Object.keys(ses.answers).length;

    modal.innerHTML =
      '<div class="dm-hall zc-protected-content">' +
        '<header class="dm-hall-top">' +
          '<div>' +
            '<span class="dm-badge gold">' + (ses.exam.scope === 'il' ? ('📍 ' + esc(ses.exam.province)) : '🇹🇷 Türkiye Geneli') + '</span>' +
            '<strong>' + esc(ses.exam.title) + '</strong>' +
          '</div>' +
          '<div class="dm-hall-meta">' +
            '<span class="dm-timer-chip">⏱️ Kalan Süre: <strong id="dmOpticalTimer">' + formatMMSS(ses.remainingSec) + '</strong></span>' +
            '<button type="button" id="dmCancelHallBtn" class="dm-btn-light">✕ Salondan Çık</button>' +
          '</div>' +
        '</header>' +

        '<div class="dm-hall-body">' +
          '<!-- Sol Alan: Soru & Görsel -->' +
          '<div class="dm-q-pane">' +
            '<div class="dm-q-head">' +
              '<span class="dm-q-num">Soru ' + (ses.currentIdx + 1) + ' / ' + ses.questions.length + '</span>' +
              '<span class="dm-q-topic">' + esc(q.topic || 'Matematik') + '</span>' +
            '</div>' +
            (q.imageUrl ? '<div style="margin-bottom:14px;text-align:center;"><img src="' + esc(q.imageUrl) + '" alt="Soru" style="max-width:100%;max-height:300px;border-radius:12px;border:1px solid #ead8c5;"></div>' : '') +
            (q.svg && q.svg.indexOf('<svg') !== -1 ? '<div id="dmQuestionSvg" style="margin-bottom:14px;text-align:center;"></div>' : '') +
            '<div class="dm-q-stem">' + formatMath(q.text) + '</div>' +
            '<div class="dm-q-opts">' +
              opts.map(function (o) {
                var isSel = ses.answers[ses.currentIdx] === o.label;
                return '<button type="button" class="dm-q-opt' + (isSel ? ' selected' : '') + '" data-dm-pick="' + esc(o.label) + '">' +
                  '<span class="dm-q-let">' + esc(o.label) + '</span>' +
                  '<span>' + formatMath(o.text) + '</span>' +
                '</button>';
              }).join('') +
            '</div>' +
            (global.ZarifCopyright ? global.ZarifCopyright.stampHtml(q.id || ('DM_' + (ses.currentIdx + 1))) : '') +
            '<div class="dm-q-nav">' +
              '<button type="button" id="dmPrevQ" class="dm-btn-light"' + (ses.currentIdx <= 0 ? ' disabled' : '') + '>← Önceki</button>' +
              '<button type="button" id="dmClearQ" class="dm-btn-light">🧹 İşareti Temizle</button>' +
              '<button type="button" id="dmNextQ" class="dm-btn-dark"' + (ses.currentIdx >= ses.questions.length - 1 ? ' disabled' : '') + '>Sonraki →</button>' +
            '</div>' +
          '</div>' +

          '<!-- Sağ Alan: Canlı Optik Form -->' +
          '<aside class="dm-opt-pane">' +
            '<div class="dm-opt-head">' +
              '<h4>📝 Canlı Optik Form</h4>' +
              '<span>' + answeredCount + ' / ' + ses.questions.length + ' İşaretli</span>' +
            '</div>' +
            '<div class="dm-opt-rows">' +
              ses.questions.map(function (_, rowIdx) {
                var chosen = ses.answers[rowIdx] || '';
                return '<div class="dm-opt-row' + (rowIdx === ses.currentIdx ? ' active' : '') + '" data-dm-row="' + rowIdx + '">' +
                  '<span class="dm-opt-num">' + (rowIdx + 1) + '.</span>' +
                  '<div class="dm-opt-bubbles">' +
                    letters.map(function (l) {
                      return '<button type="button" class="dm-bubble' + (chosen === l ? ' filled' : '') + '" data-dm-bubble-q="' + rowIdx + '" data-dm-bubble-l="' + l + '">' + l + '</button>';
                    }).join('') +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>' +
            '<button type="button" id="dmSubmitOpticalBtn" class="dm-btn-gold" style="width:100%;margin-top:12px;">✓ Sınavı Bitir &amp; Optik Formu Gönder</button>' +
          '</aside>' +
        '</div>' +
      '</div>';

    if (q.svg && q.svg.indexOf('<svg') !== -1 && $('dmQuestionSvg')) {
      if (global.zarifSafeSvg && typeof global.zarifSafeSvg.parse === 'function') {
        try { global.zarifSafeSvg.render($('dmQuestionSvg'), global.zarifSafeSvg.parse(q.svg)); } catch (e) {}
      }
    }

    modal.querySelectorAll('[data-dm-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var l = btn.dataset.dmPick;
        if (ses.answers[ses.currentIdx] === l) delete ses.answers[ses.currentIdx];
        else ses.answers[ses.currentIdx] = l;
        renderOpticalModal();
      });
    });

    modal.querySelectorAll('[data-dm-bubble-q]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var qi = Number(btn.dataset.dmBubbleQ);
        var l = btn.dataset.dmBubbleL;
        if (ses.answers[qi] === l) delete ses.answers[qi];
        else ses.answers[qi] = l;
        ses.currentIdx = qi;
        renderOpticalModal();
      });
    });

    modal.querySelectorAll('[data-dm-row]').forEach(function (row) {
      row.addEventListener('click', function () {
        ses.currentIdx = Number(row.dataset.dmRow);
        renderOpticalModal();
      });
    });

    $('dmPrevQ')?.addEventListener('click', function () { if (ses.currentIdx > 0) { ses.currentIdx--; renderOpticalModal(); } });
    $('dmNextQ')?.addEventListener('click', function () { if (ses.currentIdx < ses.questions.length - 1) { ses.currentIdx++; renderOpticalModal(); } });
    $('dmClearQ')?.addEventListener('click', function () { delete ses.answers[ses.currentIdx]; renderOpticalModal(); });
    $('dmCancelHallBtn')?.addEventListener('click', closeOpticalModal);
    $('dmSubmitOpticalBtn')?.addEventListener('click', submitOpticalExam);
  }

  function updateHeroCountdown(targetIso) {
    var el = $('dmHeroCountdown');
    if (!el) return;
    var diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    el.textContent = String(d).padStart(2, '0') + 'g ' + String(h).padStart(2, '0') + 's ' + String(m).padStart(2, '0') + 'd ' + String(s).padStart(2, '0') + 'sn';
  }

  function renderCenter() {
    var root = $('denemeMerkeziRoot');
    if (!root) return;
    detectPlanAndGrade();

    var allExams = getCatalogExams();
    var attempts = (global.ZarifStore && global.ZarifStore.mockExams) ? global.ZarifStore.mockExams.listAttempts() : [];
    var heroExam = allExams[0];
    var paid = isPaidPlan();

    var filtered = allExams.filter(function (ex) {
      if (state.activeTab === 'turkiye') return ex.scope === 'turkiye';
      if (state.activeTab === 'il') return ex.scope === 'il';
      return true;
    });

    root.innerHTML =
      '<div class="dm-wrap">' +
        // 1) Üst Vitrin Hero Sınav Banner'ı
        (heroExam ? (
          '<article class="dm-hero">' +
            '<div class="dm-hero-left">' +
              '<div class="dm-hero-badges">' +
                '<span class="dm-badge gold">' + (heroExam.scope === 'il' ? ('📍 ' + esc(heroExam.province) + ' İl Geneli') : '🇹🇷 Türkiye Geneli') + '</span>' +
                (heroExam.isFreeIntro ? '<span class="dm-badge free">🎁 Ücretsiz Tanıtım Denemesi</span>' : '') +
              '</div>' +
              '<h3>' + esc(heroExam.title) + '</h3>' +
              '<p>' + (heroExam.questions?.length || 20) + ' Soru · ' + (heroExam.durationMin || 40) + ' Dakika · Canlı Optik Form &amp; Anlık Net Karnesi</p>' +
            '</div>' +
            '<div class="dm-hero-right">' +
              '<div class="dm-cd-box"><span>SINAVA KALAN / AKTİF</span><strong id="dmHeroCountdown">00g 02s 00d 00sn</strong></div>' +
              '<button type="button" class="dm-btn-gold" data-dm-start="' + esc(heroExam.id) + '">🚀 Sınava Gir / Katıl</button>' +
            '</div>' +
          '</article>'
        ) : '') +

        // 2) Kapsam Sekmeleri
        '<div class="dm-tabs">' +
          '<button type="button" class="dm-tab' + (state.activeTab === 'all' ? ' active' : '') + '" data-dm-tab="all">Tümü (' + allExams.length + ')</button>' +
          '<button type="button" class="dm-tab' + (state.activeTab === 'turkiye' ? ' active' : '') + '" data-dm-tab="turkiye">🇹🇷 Türkiye Geneli</button>' +
          '<button type="button" class="dm-tab' + (state.activeTab === 'il' ? ' active' : '') + '" data-dm-tab="il">📍 İl Geneli</button>' +
          '<button type="button" class="dm-tab' + (state.activeTab === 'reports' ? ' active' : '') + '" data-dm-tab="reports">📜 Tamamlanan Karnelerim (' + attempts.length + ')</button>' +
        '</div>' +

        // 3) Liste / Karneler
        (state.activeTab === 'reports'
          ? (attempts.length
              ? '<div class="dm-grid">' + attempts.map(function (a) {
                  return '<article class="dm-card">' +
                    '<div class="dm-card-top">' +
                      '<span class="dm-badge gold">' + (a.scope === 'il' ? ('📍 ' + esc(a.province)) : '🇹🇷 Türkiye Geneli') + '</span>' +
                      '<span class="dm-date">' + esc(formatDateTR(a.createdAt)) + '</span>' +
                    '</div>' +
                    '<h4>' + esc(a.title) + '</h4>' +
                    '<div class="dm-card-stats">' +
                      '<span><strong>' + a.net + '</strong> Net</span>' +
                      '<span><strong>' + a.correct + 'D / ' + a.wrong + 'Y / ' + a.blank + 'B</strong></span>' +
                      '<span>TG Dilimi: <strong>%' + a.turkeyPercentile + '</strong></span>' +
                    '</div>' +
                    '<div class="dm-card-foot">' +
                      '<span style="font-size:0.78rem;color:#786557;">Sıralama: <strong>' + a.provinceRank + ' / ' + a.provinceTotal + '</strong></span>' +
                      '<button type="button" class="dm-btn-dark" data-dm-view-att="' + esc(a.id) + '">📊 Karneyi Aç</button>' +
                    '</div>' +
                  '</article>';
                }).join('') + '</div>'
              : '<div class="dm-empty-note">Henüz tamamladığın bir deneme sınavı yok. Yukarıdaki <strong>Ücretsiz Tanıtım Denemesi</strong> ile hemen başlayabilirsin!</div>')
          : '<div class="dm-grid">' + filtered.map(function (ex) {
              var unlocked = ex.isFreeIntro || paid;
              return '<article class="dm-card' + (!unlocked ? ' is-locked' : '') + '">' +
                '<div class="dm-card-top">' +
                  '<span class="dm-badge ' + (ex.scope === 'il' ? 'il' : 'gold') + '">' + (ex.scope === 'il' ? ('📍 ' + esc(ex.province) + ' İl Geneli') : '🇹🇷 Türkiye Geneli') + '</span>' +
                  (ex.isFreeIntro ? '<span class="dm-badge free">🎁 Ücretsiz Açık</span>' : (!unlocked ? '<span class="dm-badge lock">🔒 Temel / Standart / VIP</span>' : '<span class="dm-badge ok">✓ Paketine Dahil</span>')) +
                '</div>' +
                '<h4>' + esc(ex.title) + '</h4>' +
                '<p class="dm-card-meta">' + esc(ex.teacherName || 'ZarifÇözüm Ölçme Kurulu') + ' · ' + (ex.questions?.length || 20) + ' Soru · ' + (ex.durationMin || 40) + ' dk</p>' +
                '<div class="dm-card-foot">' +
                  '<span style="font-size:0.76rem;color:#786557;">' + esc(ex.grade || state.grade) + '. Sınıf · Optik Form</span>' +
                  (unlocked
                    ? '<button type="button" class="dm-btn-gold" data-dm-start="' + esc(ex.id) + '">🚀 Sınava Gir</button>'
                    : '<button type="button" class="dm-btn-dark" data-dm-upgrade>🔒 Paketi Yükselt</button>') +
                '</div>' +
              '</article>';
            }).join('') + '</div>') +
      '</div>';

    if (state.heroCountdownTimer) clearInterval(state.heroCountdownTimer);
    if (heroExam) {
      updateHeroCountdown(heroExam.startsAt);
      state.heroCountdownTimer = setInterval(function () { updateHeroCountdown(heroExam.startsAt); }, 1000);
    }

    root.querySelectorAll('[data-dm-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeTab = btn.dataset.dmTab;
        renderCenter();
      });
    });

    root.querySelectorAll('[data-dm-start]').forEach(function (btn) {
      btn.addEventListener('click', function () { startExam(btn.dataset.dmStart); });
    });

    root.querySelectorAll('[data-dm-upgrade]').forEach(function (btn) {
      btn.addEventListener('click', openUpgrade);
    });

    root.querySelectorAll('[data-dm-view-att]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var found = attempts.find(function (a) { return a.id === btn.dataset.dmViewAtt; });
        if (found) {
          state.reportCard = found;
          state.examSession = null;
          renderOpticalModal();
        }
      });
    });
  }

  function init() {
    if (!$('denemeMerkeziRoot')) return;
    renderCenter();
    if (global.ZarifStore && global.ZarifStore.events) {
      global.ZarifStore.events.subscribe('mockExams', renderCenter);
    }
    global.addEventListener('zarif:plan-change', renderCenter);
  }

  global.ZarifDenemeMerkezi = { refresh: renderCenter, startExam: startExam };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
