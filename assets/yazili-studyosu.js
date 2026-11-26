/* ==========================================================================
   ZarifÇözüm — MEB Senaryolu İnteraktif Yazılı Stüdyosu (5 Adımlı SPA)
   Öğretmen Özel Provaları + Hazır MEB Havuzu + 40:00 Sayaç + AI İpucu + Karne + Print
   ========================================================================== */
(function (global) {
  "use strict";

  var TEACHER_LS_KEY = "zc_teacher_yazili_v1";
  var RESULTS_LS_KEY = "zc_yazili_sonuclar_v1";

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeAns(val) {
    return String(val || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/,/g, ".")
      .replace(/°/g, "")
      .replace(/tl$/g, "")
      .replace(/cm2|cm²|cm|m2|m²|m|gün|paket|şişe|derece|puan/g, "")
      .trim();
  }

  function detectStudentGrade() {
    if (global.__studentPreviewGrade) return String(global.__studentPreviewGrade);
    if (global.__currentStudent && (global.__currentStudent.kayitliSinif || global.__currentStudent.grade)) {
      return String(global.__currentStudent.kayitliSinif || global.__currentStudent.grade);
    }
    try {
      var u = JSON.parse(localStorage.getItem("zarif_active_user") || localStorage.getItem("currentUser") || "null");
      if (u && (u.kayitliSinif || u.grade)) return String(u.kayitliSinif || u.grade);
    } catch (e) {}
    var domGrade = document.querySelector("#studentProfileGrade, .student-grade-badge");
    if (domGrade) {
      var m = domGrade.textContent.match(/\b(5|6|7|8|9|10|11|12)\b/);
      if (m) return m[1];
    }
    return "5";
  }

  function readLocalTeacherExams(grade) {
    try {
      var list = JSON.parse(localStorage.getItem(TEACHER_LS_KEY) || "[]");
      if (!Array.isArray(list)) return [];
      return list.filter(function (x) { return String(x.grade) === String(grade); });
    } catch (e) {
      return [];
    }
  }

  function saveResultRecord(rec) {
    try {
      var arr = JSON.parse(localStorage.getItem(RESULTS_LS_KEY) || "[]");
      if (!Array.isArray(arr)) arr = [];
      arr.unshift(rec);
      localStorage.setItem(RESULTS_LS_KEY, JSON.stringify(arr.slice(0, 20)));
    } catch (e) {}
  }

  function initYaziliStudyosu() {
    var root = document.getElementById("yaziliya-hazirlik");
    if (!root || !global.ZARIF_YAZILI_HAVUZU) return;

    var pool = global.ZARIF_YAZILI_HAVUZU;
    var state = {
      grade: detectStudentGrade(),
      donem: "1_donem_1_yazili",
      senaryoNo: 1,
      view: "lobby", // lobby | exam | report
      teacherExams: [],
      activeExam: null,
      qIdx: 0,
      answers: {}, // { idx: { steps: '', final: '', hintUsed: false } }
      secondsLeft: 40 * 60,
      timerId: null
    };

    root.innerHTML =
      '<div class="zy-studio" id="zyStudioApp"></div>' +
      '<div class="zy-modal-backdrop" id="zyModeModal" role="dialog" aria-modal="true">' +
        '<div class="zy-modal">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
            '<h3 style="margin:0;font-size:1.3rem;font-weight:800;color:#3B281E;">Çözüm Modunu Seç</h3>' +
            '<button type="button" class="zy-btn-outline" id="zyCloseModal" style="min-height:36px;padding:0 12px;">×</button>' +
          '</div>' +
          '<p style="margin:0;color:#6E5A4F;font-size:0.95rem;" id="zyModalSubtitle"></p>' +
          '<div class="zy-mode-grid">' +
            '<button type="button" class="zy-mode-card" id="zyStartDigital">' +
              '<div style="font-size:1.7rem;margin-bottom:8px;">💻</div>' +
              '<strong style="display:block;font-size:1.05rem;margin-bottom:4px;color:#3B281E;">İnteraktif Ekranda Çöz</strong>' +
              '<span style="font-size:0.86rem;color:#6E5A4F;">40 dakikalık sayaç, açık uçlu işlem kutusu, AI ipucu ve anında 100 üzerinden yazılı karnesi.</span>' +
            '</button>' +
            '<button type="button" class="zy-mode-card" id="zyStartPrint">' +
              '<div style="font-size:1.7rem;margin-bottom:8px;">🖨️</div>' +
              '<strong style="display:block;font-size:1.05rem;margin-bottom:4px;color:#3B281E;">Kağıt Çıktısı Al (MEB Formatı)</strong>' +
              '<span style="font-size:0.86rem;color:#6E5A4F;">Ad-Soyad, puan baremi ve en sonda ayrı sayfada Cevap Anahtarı bulunan yazdırılabilir sınav kağıdı.</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="zy-print-sheet" id="zyPrintSheet"></div>';

    var appEl = document.getElementById("zyStudioApp");
    var modalEl = document.getElementById("zyModeModal");
    var printSheetEl = document.getElementById("zyPrintSheet");

    function stopTimer() {
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
      }
    }

    function formatTime(sec) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }

    async function fetchTeacherExams() {
      var combined = readLocalTeacherExams(state.grade);
      try {
        var res = await fetch("/api/yazili?grade=" + encodeURIComponent(state.grade), { credentials: "same-origin" });
        if (res.ok) {
          var data = await res.json();
          if (data && Array.isArray(data.provalar)) {
            data.provalar.forEach(function (p) {
              if (!combined.some(function (x) { return x.id === p.id; })) {
                combined.push({
                  id: p.id,
                  title: p.title,
                  grade: p.grade,
                  donem: p.donem,
                  senaryoNo: p.senaryoNo || 1,
                  aciklama: p.aciklama || "Öğretmeninin yayınladığı özel yazılı provası",
                  toplamPuan: p.toplamPuan || 100,
                  fromApi: true
                });
              }
            });
          }
        }
      } catch (e) {}
      state.teacherExams = combined;
      if (state.view === "lobby") renderLobby();
    }

    function buildCurrentScenarioExam() {
      var donemObj = pool.DONEMLER.filter(function (d) { return d.id === state.donem; })[0] || pool.DONEMLER[0];
      var senObj = pool.SENARYOLAR.filter(function (s) { return s.no === state.senaryoNo; })[0] || pool.SENARYOLAR[0];
      var sorular = pool.getSorular(state.grade, state.donem, state.senaryoNo);
      return {
        id: "meb-" + state.grade + "-" + state.donem + "-s" + state.senaryoNo,
        title: state.grade + ". Sınıf " + donemObj.ad + " — " + senObj.ad,
        grade: state.grade,
        donemAd: donemObj.ad,
        senaryoAd: senObj.ad,
        sorular: sorular
      };
    }

    function openModeModal(examObj) {
      state.activeExam = examObj;
      document.getElementById("zyModalSubtitle").textContent =
        examObj.title + " • " + examObj.sorular.length + " Açık Uçlu Soru (100 Puan)";
      modalEl.classList.add("is-open");
    }

    function triggerPrintPaper(examObj) {
      modalEl.classList.remove("is-open");
      var qHtml = examObj.sorular.map(function (q, idx) {
        return (
          '<div style="margin-bottom:20px;page-break-inside:avoid;">' +
            '<div style="font-weight:700;margin-bottom:6px;">Soru ' + (idx + 1) + ' (' + (q.puan || 15) + ' Puan) ' +
              (q.kazanimKodu ? '<span style="font-weight:400;font-size:9.5pt;">[' + esc(q.kazanimKodu) + ']</span>' : '') +
            '</div>' +
            '<div style="margin-bottom:10px;line-height:1.5;">' + esc(q.metin) + '</div>' +
            '<div style="height:68px;border:1px dashed #999;border-radius:6px;"></div>' +
          '</div>'
        );
      }).join("");

      var keyHtml = examObj.sorular.map(function (q, idx) {
        return (
          '<div style="margin-bottom:12px;">' +
            '<strong>Soru ' + (idx + 1) + ' (' + (q.puan || 15) + ' Puan):</strong> ' +
            '<div style="white-space:pre-line;margin-top:3px;">' + esc(q.cozumAdimlari || q.cozumMetni || '') + '</div>' +
          '</div>'
        );
      }).join("");

      printSheetEl.innerHTML =
        '<div style="border:2px solid #000;padding:12px 16px;margin-bottom:18px;">' +
          '<div style="text-align:center;font-weight:700;font-size:13pt;">T.C. MİLLÎ EĞİTİM BAKANLIĞI MAARİF MODELİ UYUMLU YAZILI PROVASI</div>' +
          '<div style="text-align:center;margin-top:4px;font-size:11pt;">' + esc(examObj.title) + ' (ZarifÇözüm)</div>' +
          '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:10pt;border-top:1px solid #000;padding-top:8px;">' +
            '<span>Adı Soyadı: _______________________</span>' +
            '<span>Sınıfı: ' + esc(examObj.grade) + '/___</span>' +
            '<span>Tarih: ___/___/2026</span>' +
            '<span>Puan: _____ / 100</span>' +
          '</div>' +
        '</div>' +
        qHtml +
        '<div class="zy-print-key">' +
          '<h3 style="border-bottom:1px solid #000;padding-bottom:6px;">CEVAP ANAHTARI VE DEĞERLENDİRME RUBRİĞİ</h3>' +
          keyHtml +
        '</div>';

      document.body.classList.add("zy-printing-exam");
      setTimeout(function () {
        global.print();
        setTimeout(function () {
          document.body.classList.remove("zy-printing-exam");
        }, 400);
      }, 100);
    }

    function startInteractiveExam(examObj) {
      modalEl.classList.remove("is-open");
      stopTimer();
      state.activeExam = examObj;
      state.view = "exam";
      state.qIdx = 0;
      state.answers = {};
      state.secondsLeft = 40 * 60;
      renderExam();

      state.timerId = setInterval(function () {
        state.secondsLeft--;
        var tEl = document.getElementById("zyTimerDisplay");
        if (tEl) tEl.textContent = "⏱ " + formatTime(Math.max(0, state.secondsLeft));
        if (state.secondsLeft <= 0) {
          stopTimer();
          finishExam();
        }
      }, 1000);
    }

    function gradeQuestion(q, ansObj) {
      var maxPts = Number(q.puan || 15);
      var finalRaw = (ansObj && ansObj.final) || "";
      var stepsRaw = (ansObj && ansObj.steps) || "";
      var hintPenalty = (ansObj && ansObj.hintUsed) ? 2 : 0;

      var normFinal = normalizeAns(finalRaw);
      var normAll = normalizeAns(stepsRaw + " " + finalRaw);

      var expected = Array.isArray(q.beklenenSonuc) ? q.beklenenSonuc : (q.beklenenSonuc ? [q.beklenenSonuc] : []);
      var matchedFull = expected.some(function (e) {
        var ne = normalizeAns(e);
        return ne && (normFinal === ne || (normFinal.length > 0 && normFinal.indexOf(ne) !== -1));
      });

      if (matchedFull) {
        return { puan: Math.max(0, maxPts - hintPenalty), maxPts: maxPts, durum: "tam", hintPenalty: hintPenalty };
      }

      // Kısmi puan: çözüm adımlarında yöntem anahtar kelimeleri geçiyorsa %50 puan
      var keys = Array.isArray(q.yontemAnahtar) ? q.yontemAnahtar : [];
      var hitCount = 0;
      keys.forEach(function (k) {
        if (normAll.indexOf(normalizeAns(k)) !== -1) hitCount++;
      });
      if (hitCount >= 2 || (stepsRaw.trim().length >= 18 && hitCount >= 1)) {
        var partial = Math.round(maxPts * 0.5);
        return { puan: Math.max(0, partial - hintPenalty), maxPts: maxPts, durum: "kismi", hintPenalty: hintPenalty };
      }

      return { puan: 0, maxPts: maxPts, durum: "eksik", hintPenalty: hintPenalty };
    }

    function finishExam() {
      stopTimer();
      state.view = "report";
      var exam = state.activeExam;
      var totalScore = 0;
      var maxTotal = 0;
      var missingTopics = [];

      var details = exam.sorular.map(function (q, idx) {
        var g = gradeQuestion(q, state.answers[idx]);
        totalScore += g.puan;
        maxTotal += g.maxPts;
        if (g.durum !== "tam") missingTopics.push(q.konu + " (" + (q.kazanimKodu || "MEB") + ")");
        return { q: q, grade: g, ans: state.answers[idx] || {} };
      });

      var normalized100 = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;
      var label = normalized100 >= 85 ? "Pekiyi 🌟" : normalized100 >= 70 ? "İyi 👍" : normalized100 >= 50 ? "Orta 📘" : "Geliştirilmeli 💪";

      saveResultRecord({
        date: new Date().toISOString(),
        title: exam.title,
        grade: exam.grade,
        score: normalized100,
        missingTopics: missingTopics
      });

      var isMiddle = ["5", "6", "7", "8"].indexOf(String(state.grade)) !== -1;

      var itemsHtml = details.map(function (d, idx) {
        var isLow = d.grade.durum !== "tam";
        return (
          '<div class="zy-report-item' + (isLow ? ' is-low' : '') + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;">' +
              '<strong>Soru ' + (idx + 1) + ' • ' + esc(d.q.konu || 'Açık Uçlu Soru') + '</strong>' +
              '<span class="zy-q-pts">' + d.grade.puan + ' / ' + d.grade.maxPts + ' Puan' + (d.grade.hintPenalty ? ' (−2 İpucu)' : '') + '</span>' +
            '</div>' +
            '<div style="font-size:0.9rem;color:#6E5A4F;margin-bottom:8px;">Senin Sonucun: <strong>' + esc(d.ans.final || 'Boş bırakıldı') + '</strong></div>' +
            '<div style="padding:10px 12px;border-radius:10px;background:#FAF6F0;font-size:0.9rem;white-space:pre-line;">' +
              '<strong>✅ Resmi Çözüm Adımları:</strong>\n' + esc(d.q.cozumAdimlari || d.q.cozumMetni || '') +
            '</div>' +
          '</div>'
        );
      }).join("");

      appEl.innerHTML =
        '<div class="zy-report-hero">' +
          '<div style="font-size:0.9rem;color:#F4D28D;font-weight:700;margin-bottom:6px;">' + esc(exam.title) + '</div>' +
          '<div class="zy-report-score">' + normalized100 + ' / 100 • ' + label + '</div>' +
          '<div style="margin-top:8px;font-size:0.95rem;color:#E6DCD2;">' +
            (missingTopics.length ? 'Tekrar Edilmesi Önerilen Kazanımlar: ' + esc(missingTopics.slice(0, 3).join(', ')) : 'Tebrikler! Tüm kazanımlarda tam başarı sağladın.') +
          '</div>' +
        '</div>' +
        itemsHtml +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;">' +
          (isMiddle ? '<a class="zy-btn-emerald" href="pages/kesif-modu.html">🧭 Eksik Kazanımları Keşif Modu\'nda Telafi Et →</a>' : '') +
          '<button type="button" class="zy-btn-primary" id="zyGoTopicsBtn">📖 Konu Çalış\'ta Telafi Et →</button>' +
          '<button type="button" class="zy-btn-outline" id="zyBackLobbyBtn">← Yazılı Stüdyosuna Dön</button>' +
        '</div>';

      document.getElementById("zyBackLobbyBtn").addEventListener("click", function () {
        state.view = "lobby";
        renderLobby();
      });
      document.getElementById("zyGoTopicsBtn").addEventListener("click", function () {
        var link = document.querySelector('a[href="#konularim"], a[href="#konu-anlatimlari"]');
        if (link) link.click();
        else global.location.href = "konu.html?sinif=" + encodeURIComponent(state.grade);
      });
    }

    function renderExam() {
      var exam = state.activeExam;
      var q = exam.sorular[state.qIdx];
      var curAns = state.answers[state.qIdx] || { steps: "", final: "", hintUsed: false };

      var pillsHtml = exam.sorular.map(function (_, idx) {
        var a = state.answers[idx];
        var answered = a && (a.final.trim() || a.steps.trim());
        return '<button type="button" class="zy-q-pill' + (idx === state.qIdx ? ' is-active' : answered ? ' is-answered' : '') + '" data-qidx="' + idx + '">' + (idx + 1) + '</button>';
      }).join("");

      appEl.innerHTML =
        '<div class="zy-exam-bar">' +
          '<div><strong>' + esc(exam.title) + '</strong></div>' +
          '<div class="zy-q-pills">' + pillsHtml + '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span class="zy-timer" id="zyTimerDisplay">⏱ ' + formatTime(state.secondsLeft) + '</span>' +
            '<button type="button" class="zy-btn-emerald" id="zyFinishExamBtn" style="min-height:38px;padding:0 16px;">Sınavı Bitir ve Teslim Et ✓</button>' +
          '</div>' +
        '</div>' +
        '<div class="zy-paper-card">' +
          '<div class="zy-q-meta">' +
            '<div>' +
              '<strong style="font-size:1.1rem;">Soru ' + (state.qIdx + 1) + ' / ' + exam.sorular.length + '</strong>' +
              (q.kazanimKodu ? ' <span style="font-size:0.85rem;color:#6E5A4F;">• ' + esc(q.kazanimKodu) + ' (' + esc(q.konu || '') + ')</span>' : '') +
            '</div>' +
            '<span class="zy-q-pts">' + (q.puan || 15) + ' Puan</span>' +
          '</div>' +
          '<p class="zy-q-text">' + esc(q.metin) + '</p>' +
          '<div class="zy-work-area">' +
            '<label style="display:block;font-weight:700;font-size:0.9rem;margin-bottom:6px;">✍️ Adım Adım İşlem Kutusu</label>' +
            '<textarea id="zyStepsInput" placeholder="Çözüm adımlarını buraya yaz (doğru yöntem kısmi puan kazandırır)...">' + esc(curAns.steps) + '</textarea>' +
            '<label style="display:block;font-weight:700;font-size:0.9rem;margin-bottom:6px;">🎯 Nihai Sonucun</label>' +
            '<input type="text" id="zyFinalInput" placeholder="Örn: 42 veya 3/8 veya 8x − 2" value="' + esc(curAns.final) + '">' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-top:16px;">' +
            '<button type="button" class="zy-btn-outline" id="zyHintBtn"' + (curAns.hintUsed ? ' disabled' : '') + '>' +
              (curAns.hintUsed ? '✨ İpucu Kullanıldı (−2 Puan)' : '✨ Zarif AI İpucu (−2 Puan)') +
            '</button>' +
            '<div style="display:flex;gap:8px;">' +
              '<button type="button" class="zy-btn-outline" id="zyPrevQ"' + (state.qIdx === 0 ? ' disabled style="opacity:.45"' : '') + '>← Önceki</button>' +
              '<button type="button" class="zy-btn-primary" id="zyNextQ">' + (state.qIdx === exam.sorular.length - 1 ? 'Teslim Et ✓' : 'Sonraki Soru →') + '</button>' +
            '</div>' +
          '</div>' +
          (curAns.hintUsed ? '<div class="zy-hint-box">💡 Zarif AI İpucu: ' + esc(q.ipucu || 'Verilenleri adım adım denklem veya oran haline getirerek sonuca ulaş.') + '</div>' : '') +
        '</div>';

      function syncInputs() {
        var sVal = document.getElementById("zyStepsInput")?.value || "";
        var fVal = document.getElementById("zyFinalInput")?.value || "";
        state.answers[state.qIdx] = {
          steps: sVal,
          final: fVal,
          hintUsed: Boolean(state.answers[state.qIdx]?.hintUsed)
        };
      }

      document.getElementById("zyStepsInput").addEventListener("input", syncInputs);
      document.getElementById("zyFinalInput").addEventListener("input", syncInputs);

      document.getElementById("zyHintBtn").addEventListener("click", function () {
        syncInputs();
        state.answers[state.qIdx].hintUsed = true;
        renderExam();
      });

      appEl.querySelectorAll("[data-qidx]").forEach(function (b) {
        b.addEventListener("click", function () {
          syncInputs();
          state.qIdx = Number(b.getAttribute("data-qidx"));
          renderExam();
        });
      });

      document.getElementById("zyPrevQ").addEventListener("click", function () {
        if (state.qIdx > 0) { syncInputs(); state.qIdx--; renderExam(); }
      });

      document.getElementById("zyNextQ").addEventListener("click", function () {
        syncInputs();
        if (state.qIdx === exam.sorular.length - 1) finishExam();
        else { state.qIdx++; renderExam(); }
      });

      document.getElementById("zyFinishExamBtn").addEventListener("click", function () {
        syncInputs();
        finishExam();
      });
    }

    function renderLobby() {
      stopTimer();
      var examPreview = buildCurrentScenarioExam();
      var totalPts = examPreview.sorular.reduce(function (acc, q) { return acc + Number(q.puan || 15); }, 0);

      var teacherHtml = "";
      if (state.teacherExams.length > 0) {
        teacherHtml =
          '<div class="zy-teacher-section">' +
            state.teacherExams.map(function (t, idx) {
              return (
                '<div class="zy-teacher-card">' +
                  '<div>' +
                    '<span class="zy-gold-badge">⭐ Öğretmeninin Özel Provası</span>' +
                    '<h3 style="margin:0 0 4px;font-size:1.1rem;">' + esc(t.title) + '</h3>' +
                    '<p style="margin:0;font-size:0.88rem;color:#6E5A4F;">' + esc(t.aciklama || '') + ' • ' + (t.sorular ? t.sorular.length : (t.soruSayisi || 6)) + ' Soru</p>' +
                  '</div>' +
                  '<button type="button" class="zy-btn-primary" data-open-teacher-exam="' + idx + '">Özel Provayı Başlat →</button>' +
                '</div>'
              );
            }).join("") +
          '</div>';
      }

      var periodsHtml = pool.DONEMLER.map(function (d) {
        return (
          '<button type="button" class="zy-period-btn' + (d.id === state.donem ? ' is-active' : '') + '" data-donem="' + d.id + '">' +
            '<small>' + esc(d.ay) + '</small>' +
            '<strong>' + esc(d.ad) + '</strong>' +
          '</button>'
        );
      }).join("");

      var scenariosHtml = pool.SENARYOLAR.map(function (s) {
        return (
          '<button type="button" class="zy-scenario-btn' + (s.no === state.senaryoNo ? ' is-active' : '') + '" data-senaryo="' + s.no + '">' +
            '<strong>' + esc(s.ad) + '</strong>' +
            '<span>' + esc(s.aciklama) + '</span>' +
          '</button>'
        );
      }).join("");

      var distRows = examPreview.sorular.map(function (q, i) {
        return (
          '<tr>' +
            '<td><strong>Soru ' + (i + 1) + '</strong></td>' +
            '<td>' + esc(q.kazanimKodu || 'MEB') + '</td>' +
            '<td>' + esc(q.konu || 'Açık Uçlu') + '</td>' +
            '<td><strong>' + (q.puan || 15) + ' Puan</strong></td>' +
          '</tr>'
        );
      }).join("");

      appEl.innerHTML =
        '<div class="zy-top-header">' +
          '<div>' +
            '<h2>📝 MEB Senaryolu İnteraktif Yazılı Stüdyosu</h2>' +
            '<p>' + esc(state.grade) + '. Sınıf Türkiye Yüzyılı Maarif Modeli açık uçlu yazılı provaları, kağıt çıktısı ve anında puanlama.</p>' +
          '</div>' +
          '<span class="zy-status-pill">✓ ' + esc(state.grade) + '. Sınıf MEB Senaryo Havuzu Aktif</span>' +
        '</div>' +
        teacherHtml +
        '<div class="zy-period-grid">' + periodsHtml + '</div>' +
        '<div class="zy-scenario-tabs">' + scenariosHtml + '</div>' +
        '<div class="zy-dist-card">' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;">' +
            '<div>' +
              '<strong style="font-size:1.05rem;">📊 Konu ve Soru Dağılım Tablosu</strong>' +
              '<div style="font-size:0.86rem;color:#6E5A4F;">' + esc(examPreview.title) + '</div>' +
            '</div>' +
            '<button type="button" class="zy-btn-primary" id="zyLaunchScenarioBtn">Senaryo Provasını Başlat →</button>' +
          '</div>' +
          '<table class="zy-dist-table">' +
            '<thead><tr><th>Soru</th><th>Kazanım Kodu</th><th>Konu</th><th>Puan</th></tr></thead>' +
            '<tbody>' + distRows + '</tbody>' +
            '<tfoot><tr><td colspan="3">Toplam (' + examPreview.sorular.length + ' Açık Uçlu Soru)</td><td>' + totalPts + ' Puan</td></tr></tfoot>' +
          '</table>' +
        '</div>';

      appEl.querySelectorAll("[data-donem]").forEach(function (b) {
        b.addEventListener("click", function () {
          state.donem = b.getAttribute("data-donem");
          renderLobby();
        });
      });

      appEl.querySelectorAll("[data-senaryo]").forEach(function (b) {
        b.addEventListener("click", function () {
          state.senaryoNo = Number(b.getAttribute("data-senaryo"));
          renderLobby();
        });
      });

      document.getElementById("zyLaunchScenarioBtn").addEventListener("click", function () {
        openModeModal(buildCurrentScenarioExam());
      });

      appEl.querySelectorAll("[data-open-teacher-exam]").forEach(function (b) {
        b.addEventListener("click", async function () {
          var t = state.teacherExams[Number(b.getAttribute("data-open-teacher-exam"))];
          if (!t) return;
          if (t.fromApi && (!t.sorular || !t.sorular.length)) {
            try {
              var res = await fetch("/api/yazili/" + encodeURIComponent(t.id), { credentials: "same-origin" });
              if (res.ok) {
                var d = await res.json();
                if (d.prova && Array.isArray(d.prova.sorular) && d.prova.sorular.length) {
                  t.sorular = d.prova.sorular;
                }
              }
            } catch (e) {}
          }
          if (!t.sorular || !t.sorular.length) {
            t.sorular = pool.getSorular(t.grade || state.grade, t.donem || state.donem, t.senaryoNo || 1);
          }
          openModeModal(t);
        });
      });
    }

    document.getElementById("zyCloseModal").addEventListener("click", function () { modalEl.classList.remove("is-open"); });
    modalEl.addEventListener("click", function (e) { if (e.target === modalEl) modalEl.classList.remove("is-open"); });
    document.getElementById("zyStartDigital").addEventListener("click", function () { if (state.activeExam) startInteractiveExam(state.activeExam); });
    document.getElementById("zyStartPrint").addEventListener("click", function () { if (state.activeExam) triggerPrintPaper(state.activeExam); });

    renderLobby();
    fetchTeacherExams();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initYaziliStudyosu);
  } else {
    initYaziliStudyosu();
  }
})(window);
