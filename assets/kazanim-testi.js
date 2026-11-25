/**
 * ZarifÇözüm Öğrenci Paneli — Modern Kazanım Testi & Konu Ölçme Motoru
 * - Yalnızca öğretmen onaylı merkezi soru havuzundan (MongoDB + ZarifStore.publishedTests) soru çeker.
 * - Sahte/örnek soru üretmez; onaylı soru yoksa net bilgi kartı gösterir.
 * - Paket bazlı sınıf kilidi (5–12. Sınıf), konu başı onaylı soru sayısı, 10/20/30 soru seçici.
 * - Fisher-Yates karıştırma + önceki oturumdan farklı soru önceliklendirme.
 * - İnteraktif sınav ekranı (ilerleme çubuğu, soru kutucukları, süre sayacı, D/Y/B özeti + çözüm inceleme).
 * - Sonuçları otomatik olarak ZarifStore.tests.recordResult(...) ile kaydeder.
 */
(function (global) {
  'use strict';

  var ALL_GRADES = [5, 6, 7, 8, 9, 10, 11, 12];
  var state = {
    grade: 7,
    registeredGrade: 7,
    allowedGrades: [7],
    isStaff: false,
    plan: 'free',
    selectedTopic: '',
    questionCount: 10,
    approvedPool: [],
    topicsWithCounts: [],
    loadingPool: false,
    lastSessionIds: new Set(),
    exam: null,
    timerId: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normKey(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function formatMath(text) {
    var clean = String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*\*/g, '');
    if (global.zarifMathText && typeof global.zarifMathText.format === 'function') {
      return global.zarifMathText.format(clean);
    }
    return esc(clean);
  }

  function formatTimer(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function fisherYates(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function normalizeOptions(rawOpts) {
    var letters = ['A', 'B', 'C', 'D', 'E'];
    if (!rawOpts) return [];
    if (Array.isArray(rawOpts)) {
      return rawOpts.map(function (opt, idx) {
        if (opt && typeof opt === 'object') {
          return {
            label: String(opt.label || opt.key || letters[idx] || String(idx + 1)).toUpperCase(),
            text: String(opt.text || opt.value || opt.label || '')
          };
        }
        return { label: letters[idx] || String(idx + 1), text: String(opt || '') };
      }).filter(function (o) { return o.text.trim().length > 0; });
    }
    if (typeof rawOpts === 'object') {
      return Object.keys(rawOpts).map(function (k) {
        return { label: String(k).toUpperCase(), text: String(rawOpts[k] || '') };
      }).filter(function (o) { return o.text.trim().length > 0; });
    }
    return [];
  }

  function extractCurriculumTopics(grade) {
    var out = [];
    var seen = new Set();
    var addTitle = function (title) {
      var t = String(title || '').trim();
      if (!t || t === '[object Object]') return;
      var k = normKey(t);
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(t);
    };

    var mf = global.MATEMATIK_MUFREDATI || global.matematikMufredati;
    var gradeData = mf && (mf[grade] || mf[String(grade)]);
    if (Array.isArray(gradeData)) {
      gradeData.forEach(function (item) {
        if (typeof item === 'string') addTitle(item);
        else if (item && typeof item === 'object') {
          if (Array.isArray(item.konular) && item.konular.length) {
            item.konular.forEach(function (sub) {
              addTitle(typeof sub === 'string' ? sub : (sub.title || sub.name || sub.ad || sub.baslik));
            });
          } else {
            addTitle(item.title || item.name || item.ad || item.baslik || item.tema);
          }
        }
      });
    } else if (gradeData && Array.isArray(gradeData.temalar)) {
      gradeData.temalar.forEach(function (tm) {
        if (Array.isArray(tm.konular) && tm.konular.length) {
          tm.konular.forEach(function (k) {
            addTitle(typeof k === 'string' ? k : (k.title || k.name || k.ad || k.baslik));
          });
        } else {
          addTitle(tm.title || tm.ad || tm.baslik);
        }
      });
    }
    return out;
  }

  async function detectStudentAccess() {
    var storedGrade = Number(global.localStorage && global.localStorage.getItem('zarif_student_grade'));
    if (ALL_GRADES.indexOf(storedGrade) !== -1) {
      state.registeredGrade = storedGrade;
      state.grade = storedGrade;
      state.allowedGrades = [storedGrade];
    }

    try {
      var res = await fetch('/api/student/topics?grade=' + encodeURIComponent(state.grade), { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        if (data && data.access) {
          var acc = data.access;
          state.plan = acc.plan || 'free';
          state.isStaff = Boolean(acc.isStaff);
          if (ALL_GRADES.indexOf(Number(acc.registeredGrade)) !== -1) {
            state.registeredGrade = Number(acc.registeredGrade);
            state.grade = state.registeredGrade;
          }
          if (state.isStaff || state.plan === 'vip' || state.plan === 'standart') {
            state.allowedGrades = ALL_GRADES.slice();
          } else if (Array.isArray(acc.allowedGrades) && acc.allowedGrades.length) {
            state.allowedGrades = acc.allowedGrades.map(Number);
          } else {
            state.allowedGrades = [state.registeredGrade];
          }
        }
      }
    } catch (e) {}
  }

  function isGradeLocked(g) {
    if (state.isStaff) return false;
    if (!state.allowedGrades || !state.allowedGrades.length) return false;
    return state.allowedGrades.indexOf(Number(g)) === -1;
  }

  function openUpgradeModal() {
    if (typeof global.openSubscriptionUpgradeModal === 'function') {
      global.openSubscriptionUpgradeModal();
    } else {
      global.location.href = '/Paketler.html?ref=kazanim-testi';
    }
  }

  async function loadApprovedPoolForGrade(grade) {
    state.loadingPool = true;
    renderBuilder();

    var pool = [];
    var dedup = new Set();

    function pushQuestion(q, fallbackTopic) {
      if (!q) return;
      var text = String(q.text || q.soruMetni || q.question || q.stem || '').trim();
      var img = String(q.imageUrl || '').trim();
      if (!text && !img) return;
      var opts = normalizeOptions(q.options || q.secenekler || q.choices);
      var ans = String(q.answer || q.correctAnswer || q.dogruCevap || 'A').trim().toUpperCase();
      if (ans.length > 1) ans = ans.charAt(0);
      var topic = String(q.topic || q.topicTitle || fallbackTopic || 'Genel Matematik').trim();
      var sig = normKey(text.slice(0, 120) || img) + '|' + normKey(topic);
      if (dedup.has(sig)) return;
      dedup.add(sig);

      pool.push({
        id: String(q.id || q._id || ('kt_' + pool.length + '_' + Date.now().toString(36))),
        grade: Number(q.grade) || Number(grade),
        topic: topic,
        topicKey: normKey(topic),
        text: text,
        options: opts,
        answer: ans,
        explanation: String(q.explanation || q.solution || q.cozum || '').trim(),
        svg: typeof q.svg === 'string' ? q.svg : '',
        imageUrl: img,
        difficulty: String(q.difficulty || 'orta'),
        outcomeCode: String(q.outcomeCode || '')
      });
    }

    // 1) Backend MongoDB Merkezi Soru Havuzu (yalnızca gerçek kayıtlı/onaylı sorular)
    try {
      var res = await fetch('/api/central-question-bank?grade=' + encodeURIComponent(grade) + '&approvedOnly=1&limit=500', {
        credentials: 'include'
      });
      if (res.ok) {
        var data = await res.json();
        (data.questions || []).forEach(function (q) { pushQuestion(q, q.topic); });
      }
    } catch (e) {}

    // 2) ZarifStore.publishedTests (Öğretmen "Onayla & Yayınla" setleri)
    if (global.ZarifStore && global.ZarifStore.publishedTests) {
      var pubSets = global.ZarifStore.publishedTests.list({ status: 'published', grade: Number(grade) });
      pubSets.forEach(function (set) {
        var setTopic = set.topicTitle || set.title || 'Genel Matematik';
        (set.questions || []).forEach(function (q) {
          pushQuestion(q, q.topic || setTopic);
        });
      });
    }

    state.approvedPool = pool;
    buildTopicList(grade);
    state.loadingPool = false;
    renderBuilder();
  }

  function matchQuestionToTopic(q, topicTitle) {
    var qk = q.topicKey || normKey(q.topic);
    var tk = normKey(topicTitle);
    if (!tk) return true;
    return qk === tk || qk.indexOf(tk) !== -1 || tk.indexOf(qk) !== -1;
  }

  function buildTopicList(grade) {
    var curriculum = extractCurriculumTopics(grade);
    var seenKeys = new Set(curriculum.map(normKey));

    // Havuzda olup müfredat ağacında birebir geçmeyen öğretmen konularını da ekle
    state.approvedPool.forEach(function (q) {
      if (q.topic && !seenKeys.has(q.topicKey)) {
        seenKeys.add(q.topicKey);
        curriculum.push(q.topic);
      }
    });

    state.topicsWithCounts = curriculum.map(function (title) {
      var matched = state.approvedPool.filter(function (q) { return matchQuestionToTopic(q, title); });
      return { title: title, key: normKey(title), count: matched.length };
    });

    if (!state.selectedTopic || !state.topicsWithCounts.some(function (t) { return t.title === state.selectedTopic; })) {
      var withQ = state.topicsWithCounts.find(function (t) { return t.count > 0; });
      state.selectedTopic = withQ ? withQ.title : (state.topicsWithCounts[0] ? state.topicsWithCounts[0].title : '');
    }
  }

  function startTestForSelectedTopic() {
    var topicTitle = state.selectedTopic;
    var matching = state.approvedPool.filter(function (q) { return matchQuestionToTopic(q, topicTitle); });

    var noticeEl = $('ktNoticeBox');
    if (!matching.length) {
      if (noticeEl) {
        noticeEl.style.display = 'flex';
        noticeEl.innerHTML = '<span>⚠️</span><div><strong>Öğretmeniniz bu konu için henüz onaylı soru yayınlamadı.</strong><div style="font-size:0.82rem;margin-top:2px;">Platform kuralımız gereği yalnızca öğretmen onaylı gerçek sorular çözülür. Yayınlandığında bu konu otomatik aktif olacaktır.</div></div>';
      }
      return;
    }

    // Her seçimde farklı soru gelmesi için önceki oturumda görülmeyenleri öne al + Fisher-Yates
    var unseen = fisherYates(matching.filter(function (q) { return !state.lastSessionIds.has(q.id); }));
    var seen = fisherYates(matching.filter(function (q) { return state.lastSessionIds.has(q.id); }));
    var ordered = unseen.concat(seen);
    var targetCount = state.questionCount;
    var picked = ordered.slice(0, Math.min(targetCount, ordered.length));

    state.lastSessionIds = new Set(picked.map(function (q) { return q.id; }));

    var infoNote = picked.length < targetCount
      ? 'Havuzda bu konu için ' + picked.length + ' öğretmen onaylı soru bulundu; mevcut onaylı soruların tamamı teste eklendi.'
      : '';

    state.exam = {
      grade: state.grade,
      topicTitle: topicTitle || (state.grade + '. Sınıf Matematik'),
      questions: picked,
      answers: {},
      currentIdx: 0,
      startedAt: Date.now(),
      elapsedSec: 0,
      finished: false,
      infoNote: infoNote,
      summary: null
    };

    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(function () {
      if (!state.exam || state.exam.finished) return;
      state.exam.elapsedSec = Math.floor((Date.now() - state.exam.startedAt) / 1000);
      var tEl = $('ktTimerVal');
      if (tEl) tEl.textContent = formatTimer(state.exam.elapsedSec);
    }, 1000);

    renderExam();
  }

  function finishExam() {
    if (!state.exam || state.exam.finished) return;
    state.exam.finished = true;
    state.exam.elapsedSec = Math.floor((Date.now() - state.exam.startedAt) / 1000);
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }

    var correct = 0;
    var wrong = 0;
    var blank = 0;
    state.exam.questions.forEach(function (q, idx) {
      var ans = state.exam.answers[idx];
      if (!ans) blank++;
      else if (ans === q.answer) correct++;
      else wrong++;
    });

    var total = state.exam.questions.length;
    var score = Math.round((correct / Math.max(1, total)) * 100);
    state.exam.summary = { total: total, correct: correct, wrong: wrong, blank: blank, score: score };

    if (global.ZarifStore && global.ZarifStore.tests) {
      global.ZarifStore.tests.recordResult({
        grade: state.exam.grade,
        topicTitle: state.exam.topicTitle,
        source: 'kazanim-testi',
        total: total,
        correct: correct,
        wrong: wrong,
        blank: blank,
        score: score,
        durationSec: state.exam.elapsedSec
      });
    }

    if (global.ZarifGamification && typeof global.ZarifGamification.awardXP === 'function') {
      global.ZarifGamification.awardXP(Math.max(15, correct * 10), 'Kazanım Testi Tamamlandı');
    }

    renderExam();
  }

  function renderBuilder() {
    var root = $('kazanimTestiRoot');
    if (!root) return;
    if (state.exam) return;

    var totalApprovedInGrade = state.approvedPool.length;
    var selectedTopicObj = state.topicsWithCounts.find(function (t) { return t.title === state.selectedTopic; });

    root.innerHTML =
      '<div class="kt-shell">' +
        '<div class="kt-hero">' +
          '<div>' +
            '<span class="kt-pill">🛡️ Yalnızca Öğretmen Onaylı Merkezi Soru Havuzu</span>' +
            '<h3>Kazanım Testi &amp; Konu Ölçme Oluşturucu</h3>' +
            '<p>Sınıfını, konunu ve soru adedini seç; öğretmenlerin onaylayıp yayınladığı özgün sorulardan anında kişiselleştirilmiş testini başlat.</p>' +
          '</div>' +
          '<div class="kt-stat-chip"><strong>' + totalApprovedInGrade + '</strong><span>' + state.grade + '. Sınıf Onaylı Soru</span></div>' +
        '</div>' +

        '<div class="kt-card">' +
          '<div class="kt-field">' +
            '<label class="kt-label">1. Sınıf Seçimi (5–12. Sınıf)</label>' +
            '<div class="kt-grade-grid">' +
              ALL_GRADES.map(function (g) {
                var locked = isGradeLocked(g);
                var active = Number(state.grade) === g;
                return '<button type="button" class="kt-grade-btn' + (active ? ' active' : '') + (locked ? ' locked' : '') + '" data-kt-grade="' + g + '">' +
                  g + '. Sınıf' + (locked ? ' 🔒' : '') +
                '</button>';
              }).join('') +
            '</div>' +
          '</div>' +

          '<div class="kt-field">' +
            '<label class="kt-label" for="ktTopicSelect">2. Konu Seçimi <span style="font-weight:500;color:#786557;">(Her konunun yanında havuzdaki onaylı soru sayısı görünür)</span></label>' +
            (state.loadingPool
              ? '<div class="kt-loading">Merkezi onaylı soru havuzu taranıyor…</div>'
              : '<select id="ktTopicSelect" class="kt-select">' +
                  state.topicsWithCounts.map(function (t) {
                    var sel = t.title === state.selectedTopic ? ' selected' : '';
                    return '<option value="' + esc(t.title) + '"' + sel + '>' + esc(t.title) + ' (' + t.count + ' Onaylı Soru)</option>';
                  }).join('') +
                '</select>') +
          '</div>' +

          '<div class="kt-field">' +
            '<label class="kt-label">3. Soru Adedi Seçimi</label>' +
            '<div class="kt-segmented">' +
              [10, 20, 30].map(function (cnt) {
                return '<button type="button" class="kt-seg-btn' + (state.questionCount === cnt ? ' active' : '') + '" data-kt-count="' + cnt + '">' + cnt + ' Soru</button>';
              }).join('') +
            '</div>' +
          '</div>' +

          '<div id="ktNoticeBox" class="kt-notice" style="display:none;"></div>' +

          '<div class="kt-action-row">' +
            '<div class="kt-selected-meta">' +
              (selectedTopicObj
                ? 'Seçili Konu: <strong>' + esc(selectedTopicObj.title) + '</strong> · <span>' + selectedTopicObj.count + ' Onaylı Soru Hazır</span>'
                : 'Lütfen bir konu seçin') +
            '</div>' +
            '<button type="button" id="ktStartBtn" class="kt-start-btn">🚀 Soruları Getir &amp; Testi Başlat</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    root.querySelectorAll('[data-kt-grade]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = Number(btn.dataset.ktGrade);
        if (isGradeLocked(g)) {
          openUpgradeModal();
          return;
        }
        state.grade = g;
        state.selectedTopic = '';
        loadApprovedPoolForGrade(g);
      });
    });

    var topicSel = $('ktTopicSelect');
    if (topicSel) {
      topicSel.addEventListener('change', function () {
        state.selectedTopic = topicSel.value;
        var notice = $('ktNoticeBox');
        if (notice) notice.style.display = 'none';
        renderBuilder();
      });
    }

    root.querySelectorAll('[data-kt-count]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.questionCount = Number(btn.dataset.ktCount) || 10;
        renderBuilder();
      });
    });

    var startBtn = $('ktStartBtn');
    if (startBtn) startBtn.addEventListener('click', startTestForSelectedTopic);
  }

  function renderExam() {
    var root = $('kazanimTestiRoot');
    if (!root || !state.exam) return;
    var ex = state.exam;

    if (ex.finished && ex.summary) {
      var s = ex.summary;
      root.innerHTML =
        '<div class="kt-shell">' +
          '<div class="kt-result-hero">' +
            '<div>' +
              '<span class="kt-pill">✓ Sonuç Başarı Raporlarına Kaydedildi</span>' +
              '<h3>' + esc(ex.topicTitle) + ' — Kazanım Testi Karnesi</h3>' +
              '<p>' + ex.grade + '. Sınıf · Süre: ' + formatTimer(ex.elapsedSec) + '</p>' +
            '</div>' +
            '<div class="kt-score-circle">%' + s.score + '</div>' +
          '</div>' +
          '<div class="kt-summary-grid">' +
            '<div class="kt-sum-box ok"><strong>' + s.correct + '</strong><span>Doğru</span></div>' +
            '<div class="kt-sum-box err"><strong>' + s.wrong + '</strong><span>Yanlış</span></div>' +
            '<div class="kt-sum-box muted"><strong>' + s.blank + '</strong><span>Boş</span></div>' +
            '<div class="kt-sum-box gold"><strong>' + s.total + '</strong><span>Toplam Soru</span></div>' +
          '</div>' +
          '<div class="kt-review-list">' +
            ex.questions.map(function (q, idx) {
              var userAns = ex.answers[idx] || '';
              var isOk = userAns === q.answer;
              var statusBadge = !userAns
                ? '<span class="kt-rbadge muted">Boş</span>'
                : (isOk ? '<span class="kt-rbadge ok">✓ Doğru</span>' : '<span class="kt-rbadge err">✗ Yanlış</span>');
              return '<article class="kt-review-card">' +
                '<div class="kt-review-head"><strong>Soru ' + (idx + 1) + '</strong>' + statusBadge + '</div>' +
                '<div class="kt-q-text">' + formatMath(q.text) + '</div>' +
                '<div class="kt-review-ans">Senin Cevabın: <strong>' + esc(userAns || 'Boş') + '</strong> · Doğru Cevap: <strong style="color:#065f46;">' + esc(q.answer) + '</strong></div>' +
                (q.explanation ? '<div class="kt-review-exp">💡 Çözüm: ' + formatMath(q.explanation) + '</div>' : '') +
              '</article>';
            }).join('') +
          '</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">' +
            '<button type="button" id="ktRetryNewBtn" class="kt-start-btn">🔄 Farklı Sorularla Yeni Test</button>' +
            '<button type="button" id="ktBackBuilderBtn" class="kt-btn-light">← Test Oluşturucuya Dön</button>' +
          '</div>' +
        '</div>';

      $('ktBackBuilderBtn')?.addEventListener('click', function () {
        state.exam = null;
        renderBuilder();
      });
      $('ktRetryNewBtn')?.addEventListener('click', function () {
        state.exam = null;
        startTestForSelectedTopic();
      });
      return;
    }

    var q = ex.questions[ex.currentIdx];
    var answeredCount = Object.keys(ex.answers).length;
    var pct = Math.round((answeredCount / Math.max(1, ex.questions.length)) * 100);
    var curAns = ex.answers[ex.currentIdx] || '';

    root.innerHTML =
      '<div class="kt-shell zc-protected-content">' +
        '<div class="kt-exam-topbar">' +
          '<div>' +
            '<strong style="color:#3E2F26;font-size:1rem;">🎯 ' + esc(ex.topicTitle) + '</strong>' +
            '<div style="font-size:0.78rem;color:#786557;">' + ex.grade + '. Sınıf · Soru ' + (ex.currentIdx + 1) + ' / ' + ex.questions.length + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<span class="kt-timer-pill">⏱️ <strong id="ktTimerVal">' + formatTimer(ex.elapsedSec) + '</strong></span>' +
            '<button type="button" id="ktExitExamBtn" class="kt-btn-light">✕ Çık</button>' +
            '<button type="button" id="ktFinishExamBtn" class="kt-start-btn" style="padding:8px 16px;font-size:0.84rem;">✓ Testi Bitir</button>' +
          '</div>' +
        '</div>' +

        (ex.infoNote ? '<div class="kt-info-strip">ℹ️ ' + esc(ex.infoNote) + '</div>' : '') +

        '<div class="kt-progress-bar"><div class="kt-progress-fill" style="width:' + pct + '%;"></div></div>' +

        '<div class="kt-num-row">' +
          ex.questions.map(function (_, i) {
            var cls = 'kt-num-box';
            if (i === ex.currentIdx) cls += ' current';
            else if (ex.answers[i]) cls += ' answered';
            return '<button type="button" class="' + cls + '" data-kt-jump="' + i + '">' + (i + 1) + '</button>';
          }).join('') +
        '</div>' +

        '<article class="kt-question-card">' +
          '<div class="kt-q-meta">' +
            '<span class="kt-q-badge">Soru ' + (ex.currentIdx + 1) + '</span>' +
            (q.outcomeCode ? '<span class="kt-q-code">' + esc(q.outcomeCode) + '</span>' : '') +
          '</div>' +
          (q.imageUrl ? '<div style="margin-bottom:14px;text-align:center;"><img src="' + esc(q.imageUrl) + '" alt="Soru Görseli" style="max-width:100%;max-height:320px;border-radius:12px;border:1px solid #ead8c5;"></div>' : '') +
          (q.svg && q.svg.indexOf('<svg') !== -1 ? '<div id="ktQuestionSvgMount" style="margin-bottom:14px;text-align:center;"></div>' : '') +
          '<div class="kt-q-text">' + formatMath(q.text) + '</div>' +
          '<div class="kt-options">' +
            (q.options.length ? q.options : [{ label: 'A', text: 'A' }, { label: 'B', text: 'B' }, { label: 'C', text: 'C' }, { label: 'D', text: 'D' }]).map(function (opt) {
              var isSel = curAns === opt.label;
              return '<button type="button" class="kt-opt-btn' + (isSel ? ' selected' : '') + '" data-kt-opt="' + esc(opt.label) + '">' +
                '<span class="kt-opt-letter">' + esc(opt.label) + '</span>' +
                '<span class="kt-opt-text">' + formatMath(opt.text) + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
          (global.ZarifCopyright ? global.ZarifCopyright.stampHtml(q.id) : '') +
        '</article>' +

        '<div class="kt-nav-footer">' +
          '<button type="button" id="ktPrevBtn" class="kt-btn-light"' + (ex.currentIdx <= 0 ? ' disabled' : '') + '>← Önceki Soru</button>' +
          (ex.currentIdx < ex.questions.length - 1
            ? '<button type="button" id="ktNextBtn" class="kt-start-btn" style="padding:10px 20px;">Sonraki Soru →</button>'
            : '<button type="button" id="ktFinishExamBottomBtn" class="kt-start-btn" style="padding:10px 20px;">✓ Testi Tamamla &amp; Sonucu Gör</button>') +
        '</div>' +
      '</div>';

    if (q.svg && q.svg.indexOf('<svg') !== -1 && $('ktQuestionSvgMount')) {
      if (global.zarifSafeSvg && typeof global.zarifSafeSvg.parse === 'function') {
        try {
          global.zarifSafeSvg.render($('ktQuestionSvgMount'), global.zarifSafeSvg.parse(q.svg));
        } catch (e) {}
      }
    }

    root.querySelectorAll('[data-kt-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ex.answers[ex.currentIdx] = btn.dataset.ktOpt;
        renderExam();
      });
    });

    root.querySelectorAll('[data-kt-jump]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ex.currentIdx = Number(btn.dataset.ktJump);
        renderExam();
      });
    });

    $('ktPrevBtn')?.addEventListener('click', function () { if (ex.currentIdx > 0) { ex.currentIdx--; renderExam(); } });
    $('ktNextBtn')?.addEventListener('click', function () { if (ex.currentIdx < ex.questions.length - 1) { ex.currentIdx++; renderExam(); } });
    $('ktFinishExamBtn')?.addEventListener('click', finishExam);
    $('ktFinishExamBottomBtn')?.addEventListener('click', finishExam);
    $('ktExitExamBtn')?.addEventListener('click', function () {
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      state.exam = null;
      renderBuilder();
    });
  }

  async function openForTopic(grade, topicTitle) {
    if (typeof global.showPanel === 'function') {
      global.showPanel('kazanim-testi', true);
    } else {
      global.location.hash = '#kazanim-testi';
    }
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    state.exam = null;

    var g = Number(grade) || state.registeredGrade;
    if (!isGradeLocked(g)) {
      state.grade = g;
    }
    await loadApprovedPoolForGrade(state.grade);

    if (topicTitle) {
      var tk = normKey(topicTitle);
      var match = state.topicsWithCounts.find(function (t) {
        return t.key === tk || t.key.indexOf(tk) !== -1 || tk.indexOf(t.key) !== -1;
      });
      if (match) {
        state.selectedTopic = match.title;
      } else {
        state.topicsWithCounts.unshift({ title: topicTitle, key: tk, count: 0 });
        state.selectedTopic = topicTitle;
      }
      renderBuilder();
    }
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function init() {
    if (!$('kazanimTestiRoot')) return;
    await detectStudentAccess();
    await loadApprovedPoolForGrade(state.grade);
    if (global.ZarifStore && global.ZarifStore.events) {
      global.ZarifStore.events.subscribe('publishedTests', function () {
        if (!state.exam) loadApprovedPoolForGrade(state.grade);
      });
    }
  }

  global.ZarifKazanimTesti = {
    openForTopic: openForTopic,
    refresh: function () { return loadApprovedPoolForGrade(state.grade); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
