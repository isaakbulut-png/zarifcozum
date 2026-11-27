/* ==========================================================================
   ZarifÇözüm — İnteraktif Yazılı Stüdyosu v2 (5 Adımlı Tam Genişlik SPA)
   - 5 Adımlı Akıcı Sihirbaz (Dönem -> Hazırlık Animasyonu -> Mod -> Senaryo -> Kurallar & Dağılım)
   - 2 Sütunlu Geniş Sınav Stüdyosu (Sol: İnteraktif Geometri Lab / Şema | Sağ: a/b/c/d Alt Sorular & Klavye)
   - Web Audio API Mikro Sesler (🔊/🔇) + Sekmede Kal Odak Takibi + Boş Soru Teslim Modalı
   - Öğretmen Özel Provaları (zc_ogretmen_yazili_provalari) + Öğretmen Karne Senkronizasyonu
   Marka Paleti: #FAF8F5 (fildişi), #0F172A (gece mavisi), #D97706 (kehribar)
   ========================================================================== */
(function (global) {
  "use strict";

  var TEACHER_LS_KEY = "zc_ogretmen_yazili_provalari";
  var LEGACY_TEACHER_KEY = "zc_teacher_yazili_v1";
  var RESULTS_LS_KEY = "zc_yazili_sonuclar_v1";

  /* ── Web Audio API Mikro Ses Motoru ── */
  var SoundEngine = (function () {
    var muted = false;
    var ctx = null;
    function getCtx() {
      if (muted) return null;
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        if (!ctx) ctx = new AC();
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
      } catch (e) { return null; }
    }
    function play(kind) {
      var c = getCtx();
      if (!c) return;
      var now = c.currentTime;
      var seq = kind === "success"
        ? [{ f: 523.25, d: 0.09, t: 0 }, { f: 659.25, d: 0.09, t: 0.08 }, { f: 783.99, d: 0.16, t: 0.16 }]
        : kind === "draw"
        ? [{ f: 440, d: 0.06, t: 0 }, { f: 660, d: 0.1, t: 0.05 }]
        : kind === "snap"
        ? [{ f: 720, d: 0.05, t: 0 }]
        : kind === "step"
        ? [{ f: 392, d: 0.06, t: 0 }, { f: 523.25, d: 0.08, t: 0.05 }]
        : [{ f: 540, d: 0.035, t: 0 }];
      seq.forEach(function (n) {
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = kind === "click" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(n.f, now + n.t);
        gain.gain.setValueAtTime(0.0001, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.065, now + n.t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
      });
    }
    return {
      play: play,
      isMuted: function () { return muted; },
      toggleMute: function () { muted = !muted; return muted; }
    };
  })();
  global.ZarifYaziliSound = SoundEngine;

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function norm(val) {
    return String(val || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/,/g, ".")
      .replace(/°|tl$|cm2|cm²|cm|m2|m²|m|derece|köşe|kose/g, "")
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
    return "5";
  }

  function detectStudentName() {
    if (global.__currentStudent && global.__currentStudent.name) return global.__currentStudent.name;
    try {
      var u = JSON.parse(localStorage.getItem("zarif_active_user") || localStorage.getItem("currentUser") || "null");
      if (u && u.name) return u.name;
    } catch (e) {}
    return "Öğrenci";
  }

  function readLocalTeacherExams(grade, donem) {
    var out = [];
    [TEACHER_LS_KEY, LEGACY_TEACHER_KEY].forEach(function (key) {
      try {
        var list = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(list)) return;
        list.forEach(function (x) {
          if (String(x.grade) === String(grade) && (!donem || !x.donem || x.donem === donem)) {
            if (!out.some(function (o) { return o.id === x.id; })) out.push(x);
          }
        });
      } catch (e) {}
    });
    return out;
  }

  function saveResultRecord(rec) {
    try {
      var arr = JSON.parse(localStorage.getItem(RESULTS_LS_KEY) || "[]");
      if (!Array.isArray(arr)) arr = [];
      arr.unshift(rec);
      localStorage.setItem(RESULTS_LS_KEY, JSON.stringify(arr.slice(0, 25)));
    } catch (e) {}
  }

  function formatMMSS(sec) {
    var s = Math.max(0, sec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  }

  function initYaziliStudyosu() {
    var root = document.getElementById("yaziliya-hazirlik");
    if (!root || !global.ZARIF_YAZILI_HAVUZU) return;

    var pool = global.ZARIF_YAZILI_HAVUZU;
    var state = {
      step: "terms", // terms | loading | mode | scenario | briefing | exam | result
      grade: detectStudentGrade(),
      donem: "1_donem_1_yazili",
      mode: "interactive", // interactive | print
      senaryoNo: 1,
      selectedTeacherExam: null,
      activeQuestions: [],
      qIdx: 0,
      subIdx: 0,
      answers: {},       // { "qIdx": "..." } veya { "qIdx_subIdx": "..." }
      drawDone: {},      // { "qIdx": true }
      openRuleCard: null, // 'count' | 'time' | 'focus'
      showConfirmModal: false,
      showSolutions: false,
      remainingSec: 40 * 60,
      timerId: null,
      tabLeaveCount: 0,
      tabWarningVisible: false,
      lastScore: 0
    };

    function stopTimer() {
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
      }
    }

    function startTimer() {
      stopTimer();
      state.remainingSec = 40 * 60;
      state.timerId = setInterval(function () {
        state.remainingSec -= 1;
        var el = root.querySelector("[data-yz-timer]");
        if (el) el.textContent = formatMMSS(state.remainingSec);
        if (state.remainingSec <= 0) {
          stopTimer();
          finishExam();
        }
      }, 1000);
    }

    // Sekmede Kal odak takibi
    document.addEventListener("visibilitychange", function () {
      if (state.step === "exam" && document.hidden) {
        state.tabLeaveCount += 1;
        state.tabWarningVisible = true;
      } else if (state.step === "exam" && !document.hidden && state.tabWarningVisible) {
        var warn = root.querySelector("[data-yz-tab-warn]");
        if (warn) {
          warn.style.display = "flex";
          warn.querySelector("span").textContent = "⚠️ Sekmeden ayrıldığın tespit edildi (" + state.tabLeaveCount + " kez). Gerçek sınav disiplini için bu sekmede kal!";
        }
      }
    });

    function getTermLabel(id) {
      var found = (pool.DONEMLER || []).find(function (d) { return d.id === id; });
      return found ? found.ad : "1. Dönem 1. Yazılı";
    }

    function loadScenarioQuestions() {
      if (state.selectedTeacherExam && Array.isArray(state.selectedTeacherExam.sorular)) {
        state.activeQuestions = state.selectedTeacherExam.sorular;
      } else {
        state.activeQuestions = pool.getSorular(state.grade, state.donem, state.senaryoNo) || [];
      }
    }

    function isQuestionAnswered(idx) {
      var q = state.activeQuestions[idx];
      if (!q) return false;
      if (Array.isArray(q.altSorular) && q.altSorular.length) {
        return q.altSorular.some(function (sub, si) {
          if (sub.tip === "cizim") return Boolean(state.drawDone[idx]);
          return String(state.answers[idx + "_" + si] || "").trim().length > 0;
        });
      }
      return String(state.answers[String(idx)] || "").trim().length > 0;
    }

    function openPrintView() {
      loadScenarioQuestions();
      var title = state.grade + ". Sınıf Matematik — " + getTermLabel(state.donem) + " (Senaryo " + state.senaryoNo + ")";
      var html = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
        '<style>body{font-family:Georgia,serif;color:#0F172A;max-width:780px;margin:28px auto;padding:0 20px;line-height:1.65;}' +
        'h1{font-size:20px;border-bottom:2px solid #0F172A;padding-bottom:8px;}' +
        '.q{margin:18px 0;padding:14px;border:1px solid #CBD5E1;border-radius:8px;page-break-inside:avoid;}' +
        '.ans-space{height:68px;border-bottom:1px dashed #94A3B8;margin-top:12px;}' +
        '.key{page-break-before:always;margin-top:32px;}</style></head><body>' +
        '<h1>ZarifÇözüm — ' + esc(title) + '</h1>' +
        '<p><strong>Ad Soyad:</strong> ___________________________ &nbsp;&nbsp; <strong>Süre:</strong> 40 Dakika &nbsp;&nbsp; <strong>Toplam:</strong> 100 Puan</p>' +
        state.activeQuestions.map(function (q, i) {
          var subHtml = Array.isArray(q.altSorular)
            ? '<ol type="a">' + q.altSorular.map(function (s) { return '<li>' + esc(s.metin) + '</li>'; }).join("") + '</ol>'
            : "";
          return '<div class="q"><strong>Soru ' + (i + 1) + ' (' + (q.puan || 20) + ' Puan · ' + esc(q.kazanimKodu || "") + '):</strong><p>' + esc(q.metin) + '</p>' + subHtml + '<div class="ans-space"></div></div>';
        }).join("") +
        '<div class="key"><h2>Cevap Anahtarı ve Çözüm Adımları</h2>' +
        state.activeQuestions.map(function (q, i) {
          return '<p><strong>Soru ' + (i + 1) + ':</strong> ' + esc(q.cozumAdimlari || "") + '</p>';
        }).join("") +
        '</div><script>window.onload=function(){window.print();};</script></body></html>';
      var w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    }

    function finishExam() {
      stopTimer();
      var totalScore = 0;
      var maxScore = 0;
      state.activeQuestions.forEach(function (q, idx) {
        var pts = Number(q.puan) || Math.round(100 / Math.max(1, state.activeQuestions.length));
        maxScore += pts;
        if (Array.isArray(q.altSorular) && q.altSorular.length) {
          var subPts = pts / q.altSorular.length;
          q.altSorular.forEach(function (sub, si) {
            if (sub.tip === "cizim") {
              if (state.drawDone[idx]) totalScore += subPts;
            } else {
              var uVal = norm(state.answers[idx + "_" + si] || "");
              var ok = (sub.beklenen || []).some(function (b) { return uVal && (uVal === norm(b) || uVal.indexOf(norm(b)) >= 0); });
              if (ok) totalScore += subPts;
            }
          });
        } else {
          var val = norm(state.answers[String(idx)] || "");
          var matched = (q.beklenenSonuc || []).some(function (b) { return val && val.indexOf(norm(b)) >= 0; });
          if (matched) totalScore += pts;
          else if (val.length >= 6 && (q.yontemAnahtar || []).some(function (k) { return val.indexOf(norm(k)) >= 0; })) {
            totalScore += Math.round(pts * 0.5);
          }
        }
      });

      var finalPct = maxScore > 0 ? Math.min(100, Math.round((totalScore / maxScore) * 100)) : 0;
      state.lastScore = finalPct;
      state.step = "result";
      state.showConfirmModal = false;
      SoundEngine.play("success");

      var title = state.selectedTeacherExam
        ? state.selectedTeacherExam.title
        : (state.grade + ". Sınıf " + getTermLabel(state.donem) + " (Senaryo " + state.senaryoNo + ")");

      saveResultRecord({
        studentName: detectStudentName(),
        grade: state.grade,
        title: title,
        score: finalPct,
        tabLeaves: state.tabLeaveCount,
        date: new Date().toISOString()
      });

      if (global.ZarifStore && global.ZarifStore.tests && typeof global.ZarifStore.tests.recordResult === "function") {
        try {
          global.ZarifStore.tests.recordResult({
            topicTitle: title,
            grade: Number(state.grade),
            source: "yazili_provasi",
            total: state.activeQuestions.length,
            correct: Math.round((finalPct / 100) * state.activeQuestions.length),
            score: finalPct
          });
        } catch (e) {}
      }

      render();
    }

    function render() {
      var soundIcon = SoundEngine.isMuted() ? "🔇" : "🔊";

      /* ── ADIM 1: DÖNEM KARTLARI & ÖĞRETMEN PROVALARI ── */
      if (state.step === "terms") {
        var teacherExams = readLocalTeacherExams(state.grade, null);
        var grades = ["5", "6", "7", "8", "9", "10", "11", "12"];
        root.innerHTML =
          '<div class="yz2-shell yz2-fade">' +
            '<div class="yz2-hero">' +
              '<div class="yz2-hero-left">' +
                '<div class="yz2-hero-emblem">✍️</div>' +
                '<div>' +
                  '<h2 class="yz2-hero-title">İnteraktif Yazılı Stüdyosu</h2>' +
                  '<p class="yz2-hero-sub">MEB Türkiye Yüzyılı Maarif Modeli açık uçlu ve interaktif geometri araçlı yazılı simülasyonu.</p>' +
                '</div>' +
              '</div>' +
              '<div class="yz2-hero-actions">' +
                '<select class="yz2-grade-select" data-yz-grade>' +
                  grades.map(function (g) { return '<option value="' + g + '"' + (g === state.grade ? ' selected' : '') + '>' + g + '. Sınıf</option>'; }).join("") +
                '</select>' +
                '<button type="button" class="yz2-icon-btn" data-yz-sound title="Ses Aç/Kapat">' + soundIcon + '</button>' +
              '</div>' +
            '</div>' +

            (teacherExams.length ? (
              '<div class="yz2-teacher-strip">' +
                '<div class="yz2-teacher-head">👩‍🏫 Öğretmeninin Yayınladığı Özel Yazılı Provaları (' + state.grade + '. Sınıf)</div>' +
                '<div class="yz2-teacher-grid">' +
                  teacherExams.map(function (ex) {
                    return '<div class="yz2-teacher-card">' +
                      '<div><strong>' + esc(ex.title) + '</strong><p>' + esc(ex.aciklama || (ex.sorular.length + " Soru · 100 Puan")) + '</p></div>' +
                      '<button type="button" class="yz2-amber-btn" data-yz-teacher-exam="' + esc(ex.id) + '">Provası Başlat →</button>' +
                    '</div>';
                  }).join("") +
                '</div>' +
              '</div>'
            ) : "") +

            '<div class="yz2-term-grid">' +
              (pool.DONEMLER || []).map(function (d, idx) {
                return '<div class="yz2-term-card">' +
                  '<div class="yz2-term-top">' +
                    '<span class="yz2-term-pill">' + esc(d.ay) + '</span>' +
                    '<span class="yz2-term-num">0' + (idx + 1) + '</span>' +
                  '</div>' +
                  '<h3>' + esc(d.ad) + '</h3>' +
                  '<p>' + state.grade + '. Sınıf Matematik MEB Senaryolu İnteraktif &amp; Yazdırılabilir Yazılı Provaları</p>' +
                  '<button type="button" class="yz2-navy-btn" data-yz-term="' + esc(d.id) + '">→ İncele &amp; Başla</button>' +
                '</div>';
              }).join("") +
            '</div>' +

            '<div class="yz2-info-card">' +
              '<h4>İnteraktif Yazılı Nedir?</h4>' +
              '<ul>' +
                '<li>Gerçek sınav disipliniyle 40 dakikalık geri sayım ve <strong>Sekmede Kal</strong> odak takibiyle çözersin.</li>' +
                '<li>Sürüklenebilir <strong>Açıölçer</strong>, <strong>Pergel</strong> ve <strong>Çokgen Tahtası</strong> ile şekilleri bizzat ölçüp çizersin.</li>' +
                '<li>Teslim ettiğin anda puanını, adım adım çözümlerini ve öğretmen karnene yansıyan analizini görürsün.</li>' +
              '</ul>' +
            '</div>' +
          '</div>';

        root.querySelector("[data-yz-grade]")?.addEventListener("change", function (e) {
          state.grade = e.target.value;
          SoundEngine.play("click");
          render();
        });
        root.querySelector("[data-yz-sound]")?.addEventListener("click", function () {
          SoundEngine.toggleMute();
          render();
        });
        root.querySelectorAll("[data-yz-term]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.donem = btn.dataset.yzTerm;
            state.selectedTeacherExam = null;
            SoundEngine.play("step");
            goToLoadingThen("mode");
          });
        });
        root.querySelectorAll("[data-yz-teacher-exam]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = btn.dataset.yzTeacherExam;
            state.selectedTeacherExam = teacherExams.find(function (x) { return x.id === id; }) || null;
            SoundEngine.play("step");
            goToLoadingThen("mode");
          });
        });
        return;
      }

      /* ── ADIM 2: HAZIRLIK ANİMASYONU ── */
      if (state.step === "loading") {
        root.innerHTML =
          '<div class="yz2-shell yz2-loading-wrap yz2-fade">' +
            '<div class="yz2-pen-anim">' +
              '<svg viewBox="0 0 120 110" width="112" height="102" xmlns="http://www.w3.org/2000/svg">' +
                '<rect x="18" y="14" width="74" height="86" rx="12" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>' +
                '<line x1="32" y1="36" x2="78" y2="36" stroke="#CBD5E1" stroke-width="3" stroke-linecap="round"/>' +
                '<line x1="32" y1="52" x2="72" y2="52" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>' +
                '<line x1="32" y1="68" x2="64" y2="68" stroke="#CBD5E1" stroke-width="3" stroke-linecap="round"/>' +
                '<g class="yz2-pen-bob"><path d="M74 62 L102 22 L110 28 L82 68 L70 72 Z" fill="#D97706" stroke="#0F172A" stroke-width="2"/></g>' +
              '</svg>' +
            '</div>' +
            '<h3>Yazılın hazırlanıyor…</h3>' +
            '<p>Kalemini ve kâğıdını hazırla. MEB senaryo kazanımları yükleniyor.</p>' +
            '<div class="yz2-load-bar"><div class="yz2-load-fill"></div></div>' +
          '</div>';
        return;
      }

      /* ── ADIM 3: ÇÖZÜM MODU SEÇİMİ ── */
      if (state.step === "mode") {
        root.innerHTML =
          '<div class="yz2-shell yz2-fade">' +
            '<div class="yz2-step-header">' +
              '<button type="button" class="yz2-back-btn" data-yz-back="terms">← Dönemlere Dön</button>' +
              '<span class="yz2-crumb">' + state.grade + '. Sınıf Matematik · ' + esc(getTermLabel(state.donem)) + '</span>' +
              '<button type="button" class="yz2-icon-btn" data-yz-sound>' + soundIcon + '</button>' +
            '</div>' +
            '<div class="yz2-center-title">' +
              '<span class="yz2-kicker">İNTERAKTİF YAZILI</span>' +
              '<h2>Yazılıyı nasıl çözeceksin?</h2>' +
            '</div>' +
            '<div class="yz2-mode-grid">' +
              '<button type="button" class="yz2-mode-card" data-yz-mode="interactive">' +
                '<div class="yz2-mode-icon">💻</div>' +
                '<h3>İnteraktif olarak ekrandan çözeceğim</h3>' +
                '<p>Senaryonu seç, interaktif geometri araçlarıyla soruları ekranda çöz. Puanın ve adım adım çözümün anında gelsin.</p>' +
                '<span class="yz2-mode-cta">Devam Et →</span>' +
              '</button>' +
              '<button type="button" class="yz2-mode-card" data-yz-mode="print">' +
                '<div class="yz2-mode-icon yz2-icon-amber">🖨️</div>' +
                '<h3>Çıktı alıp kâğıt üzerinde çözeceğim</h3>' +
                '<p>Senaryonu seç, yazdırılabilir MEB yazılı kâğıdı yeni sekmede açılsın; cevap anahtarı son sayfada hazır gelsin.</p>' +
                '<span class="yz2-mode-cta">PDF / Yazdır →</span>' +
              '</button>' +
            '</div>' +
          '</div>';

        root.querySelector("[data-yz-back]")?.addEventListener("click", function () { state.step = "terms"; SoundEngine.play("click"); render(); });
        root.querySelector("[data-yz-sound]")?.addEventListener("click", function () { SoundEngine.toggleMute(); render(); });
        root.querySelectorAll("[data-yz-mode]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.mode = btn.dataset.yzMode;
            SoundEngine.play("step");
            if (state.selectedTeacherExam) {
              if (state.mode === "print") { openPrintView(); return; }
              state.step = "briefing";
            } else {
              state.step = "scenario";
            }
            render();
          });
        });
        return;
      }

      /* ── ADIM 4: SENARYO SEÇİCİ ── */
      if (state.step === "scenario") {
        var scenarios = [
          { no: 1, ad: "Senaryo 1", alt: "Temel Kazanımlar · 100 Puan", badge: "MEB Temel" },
          { no: 2, ad: "Senaryo 2", alt: "Beceri Temelli · 100 Puan", badge: "Yeni Nesil" },
          { no: 3, ad: "Senaryo 3", alt: "Karma Prova · 100 Puan", badge: "Dengeli" }
        ];
        root.innerHTML =
          '<div class="yz2-shell yz2-fade">' +
            '<div class="yz2-stepper">' +
              '<span class="yz2-st active"><strong>1</strong> Senaryonu seç</span>' +
              '<span class="yz2-st"><strong>2</strong> Kuralları ve konuları incele</span>' +
              '<span class="yz2-st"><strong>3</strong> Yazılıya başla</span>' +
            '</div>' +
            '<div class="yz2-center-title">' +
              '<h2>Hangi senaryodan sorumlusun?</h2>' +
              '<p>Öğretmeninin söylediği senaryoyu seç; sorular seçtiğin senaryonun MEB kazanımlarına uygun gelir.</p>' +
            '</div>' +
            '<div class="yz2-scenario-grid">' +
              scenarios.map(function (sc) {
                var qs = pool.getSorular(state.grade, state.donem, sc.no) || [];
                return '<div class="yz2-sc-card">' +
                  '<div class="yz2-sc-num">' + sc.no + '</div>' +
                  '<span class="yz2-sc-tag">' + esc(sc.badge) + '</span>' +
                  '<h3>' + esc(sc.ad) + '</h3>' +
                  '<p>' + qs.length + ' soru · 100 puan</p>' +
                  '<button type="button" class="yz2-amber-btn" data-yz-pick-sc="' + sc.no + '">Seç →</button>' +
                '</div>';
              }).join("") +
            '</div>' +
            '<div style="text-align:center;margin-top:20px;">' +
              '<button type="button" class="yz2-back-btn" data-yz-back="mode">← Çözüm Moduna Dön</button>' +
            '</div>' +
          '</div>';

        root.querySelector("[data-yz-back]")?.addEventListener("click", function () { state.step = "mode"; SoundEngine.play("click"); render(); });
        root.querySelectorAll("[data-yz-pick-sc]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.senaryoNo = Number(btn.dataset.yzPickSc);
            SoundEngine.play("step");
            if (state.mode === "print") {
              openPrintView();
            } else {
              loadScenarioQuestions();
              state.openRuleCard = "count";
              state.step = "briefing";
              render();
            }
          });
        });
        return;
      }

      /* ── ADIM 5: 2 SÜTUNLU KURALLAR & KONU-SORU DAĞILIMI ── */
      if (state.step === "briefing") {
        loadScenarioQuestions();
        var qCount = state.activeQuestions.length;
        var ruleDetails = {
          count: "Bu yazılıda " + qCount + " soru var. Üstteki numaralarla sorular arasında özgürce geçebilir, cevapların otomatik kaydedilir.",
          time: "Süren 40 dakika. Kalan süreyi üstteki sayaçtan takip edebilirsin. Süre bitince yazılım otomatik değerlendirilir.",
          focus: "Başka sekmeye ya da uygulamaya geçme. Kaç kez ayrıldığın raporuna yazılır; geri döndüğünde uyarı alırsın."
        };
        var activeRuleText = state.openRuleCard ? ruleDetails[state.openRuleCard] : "";

        root.innerHTML =
          '<div class="yz2-shell yz2-fade">' +
            '<div class="yz2-stepper">' +
              '<span class="yz2-st done">✓ Senaryo seçildi</span>' +
              '<span class="yz2-st active"><strong>2</strong> Kuralları ve konuları incele</span>' +
              '<span class="yz2-st"><strong>3</strong> Yazılıya başla</span>' +
            '</div>' +
            '<div class="yz2-brief-grid">' +
              '<div class="yz2-brief-left">' +
                '<span class="yz2-kicker">' + state.grade + '. SINIF MATEMATİK · ' + esc(getTermLabel(state.donem)) + '</span>' +
                '<h2>İnteraktif Yazılı Kuralları</h2>' +
                '<div class="yz2-rules-row">' +
                  '<button type="button" class="yz2-rule-tile' + (state.openRuleCard === "count" ? " open" : "") + '" data-yz-rule="count">' +
                    '<strong>' + qCount + ' soru</strong><span>' + (state.openRuleCard === "count" ? "Kapat ▲" : "Kuralı gör ▼") + '</span>' +
                  '</button>' +
                  '<button type="button" class="yz2-rule-tile' + (state.openRuleCard === "time" ? " open" : "") + '" data-yz-rule="time">' +
                    '<strong>40 dakika</strong><span>' + (state.openRuleCard === "time" ? "Kapat ▲" : "Kuralı gör ▼") + '</span>' +
                  '</button>' +
                  '<button type="button" class="yz2-rule-tile' + (state.openRuleCard === "focus" ? " open" : "") + '" data-yz-rule="focus">' +
                    '<strong>Sekmede kal</strong><span>' + (state.openRuleCard === "focus" ? "Kapat ▲" : "Kuralı gör ▼") + '</span>' +
                  '</button>' +
                '</div>' +
                (activeRuleText ? '<div class="yz2-rule-detail">' + esc(activeRuleText) + '</div>' : '') +
                '<div class="yz2-start-box">' +
                  '<p>Hazırsan başlayalım!</p>' +
                  '<button type="button" class="yz2-start-cta" data-yz-start>🚀 Yazılıya Başla</button>' +
                '</div>' +
              '</div>' +
              '<div class="yz2-brief-right">' +
                '<div class="yz2-brief-rhead">' +
                  '<h3>Konu ve Soru Dağılımı</h3>' +
                  '<button type="button" class="yz2-back-btn" data-yz-back="scenario">Senaryoyu değiştir</button>' +
                '</div>' +
                '<div class="yz2-dist-list">' +
                  state.activeQuestions.map(function (q, i) {
                    var toolBadge = q.interaktifArac ? '<span class="yz2-tool-pill">🧰 İnteraktif Araç</span>' : '';
                    return '<div class="yz2-dist-row">' +
                      '<span class="yz2-kaz-code">' + esc(q.kazanimKodu || ("MAT." + state.grade)) + '</span>' +
                      '<div class="yz2-dist-mid"><strong>' + (i + 1) + '. ' + esc(q.konu || "Açık Uçlu Soru") + '</strong>' + toolBadge + '</div>' +
                      '<span class="yz2-dist-pts">' + (q.puan || 20) + ' puan</span>' +
                    '</div>';
                  }).join("") +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';

        root.querySelectorAll("[data-yz-rule]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var k = btn.dataset.yzRule;
            state.openRuleCard = state.openRuleCard === k ? null : k;
            SoundEngine.play("click");
            render();
          });
        });
        root.querySelector("[data-yz-back]")?.addEventListener("click", function () {
          state.step = state.selectedTeacherExam ? "mode" : "scenario";
          SoundEngine.play("click");
          render();
        });
        root.querySelector("[data-yz-start]")?.addEventListener("click", function () {
          state.qIdx = 0;
          state.subIdx = 0;
          state.answers = {};
          state.drawDone = {};
          state.tabLeaveCount = 0;
          state.tabWarningVisible = false;
          state.step = "exam";
          SoundEngine.play("step");
          startTimer();
          render();
        });
        return;
      }

      /* ── ADIM 6: 2 SÜTUNLU GENİŞ İNTERAKTİF SINAV STÜDYOSU ── */
      if (state.step === "exam") {
        var q = state.activeQuestions[state.qIdx];
        if (!q) { finishExam(); return; }
        var hasSub = Array.isArray(q.altSorular) && q.altSorular.length > 0;
        if (hasSub && state.subIdx >= q.altSorular.length) state.subIdx = 0;
        var curSub = hasSub ? q.altSorular[state.subIdx] : null;
        var ansKey = hasSub ? (state.qIdx + "_" + state.subIdx) : String(state.qIdx);
        var curVal = state.answers[ansKey] || "";
        var symbols = ["°", "⊥", "∥", "∠", "[", "]", "→", "²", "√", "π", "×", "÷"];

        // Boş bırakılan sorular
        var emptyNums = [];
        state.activeQuestions.forEach(function (_, i) { if (!isQuestionAnswered(i)) emptyNums.push(i + 1); });

        root.innerHTML =
          '<div class="yz2-exam-shell yz2-fade">' +
            '<div class="yz2-exam-topbar">' +
              '<div class="yz2-q-pills">' +
                state.activeQuestions.map(function (_, i) {
                  var cls = "yz2-q-pill" + (i === state.qIdx ? " active" : "") + (isQuestionAnswered(i) ? " done" : "");
                  return '<button type="button" class="' + cls + '" data-yz-q="' + i + '">' + (i + 1) + '</button>';
                }).join("") +
              '</div>' +
              '<div class="yz2-exam-meta">' +
                '<span class="yz2-timer-pill">⏱ Kalan süre: <strong data-yz-timer>' + formatMMSS(state.remainingSec) + '</strong></span>' +
                '<button type="button" class="yz2-icon-btn" data-yz-sound>' + soundIcon + '</button>' +
                '<button type="button" class="yz2-submit-top" data-yz-ask-submit>Teslim Et</button>' +
              '</div>' +
            '</div>' +

            '<div class="yz2-tab-warn" data-yz-tab-warn style="display:none;"><span></span><button type="button" data-yz-warn-ok>Tamam</button></div>' +

            '<div class="yz2-exam-grid">' +
              // SOL SÜTUN: İnteraktif Geometri Laboratuvarı / Görsel Şema
              '<div class="yz2-exam-left">' +
                '<div class="yz2-left-mount" data-yz-left-mount></div>' +
              '</div>' +

              // SAĞ SÜTUN: Soru + a/b/c/d Alt Şıklar + Cevap & Sembol Klavyesi
              '<div class="yz2-exam-right">' +
                '<div class="yz2-q-head">' +
                  '<span class="yz2-kaz-code">' + esc(q.kazanimKodu || ("MAT." + state.grade)) + '</span>' +
                  '<span class="yz2-pts-badge">' + (q.puan || 20) + ' Puan</span>' +
                '</div>' +
                '<p class="yz2-q-stem">' + esc(q.metin) + '</p>' +

                (hasSub ? (
                  '<div class="yz2-sub-tabs">' +
                    q.altSorular.map(function (s, si) {
                      var filled = s.tip === "cizim" ? Boolean(state.drawDone[state.qIdx]) : Boolean(String(state.answers[state.qIdx + "_" + si] || "").trim());
                      return '<button type="button" class="yz2-sub-tab' + (si === state.subIdx ? " active" : "") + (filled ? " done" : "") + '" data-yz-sub="' + si + '">' + esc(s.harf) + '</button>';
                    }).join("") +
                    '<span class="yz2-sub-count">' + (state.subIdx + 1) + '. şık / ' + q.altSorular.length + ' şık</span>' +
                  '</div>' +
                  '<div class="yz2-sub-prompt"><strong>' + esc(curSub.harf) + ')</strong> ' + esc(curSub.metin) + '</div>'
                ) : '') +

                (curSub && curSub.tip === "cizim" ? (
                  '<div class="yz2-draw-status' + (state.drawDone[state.qIdx] ? ' ok' : '') + '">' +
                    (state.drawDone[state.qIdx]
                      ? '✅ Çizim tamamlandı! Bir sonraki şıkka geçebilirsin.'
                      : '✏️ Henüz çizmedin. Soldaki interaktif geometri aracını kullanarak çizimi tamamla.') +
                  '</div>'
                ) : (
                  '<div class="yz2-ans-wrap">' +
                    (curSub && curSub.tip === "sayi"
                      ? '<div class="yz2-num-row"><input type="text" class="yz2-num-input" data-yz-ans value="' + esc(curVal) + '" placeholder="Cevabını yaz…"><span class="yz2-unit">' + esc(curSub.birim || "") + '</span></div>'
                      : '<textarea class="yz2-textarea" rows="4" data-yz-ans placeholder="Çözüm adımlarını ve cevabını buraya yaz…">' + esc(curVal) + '</textarea>'
                    ) +
                    '<div class="yz2-sym-bar">' +
                      '<span class="yz2-sym-lbl">Semboller:</span>' +
                      symbols.map(function (sym) {
                        return '<button type="button" class="yz2-sym-btn" data-yz-sym="' + esc(sym) + '">' + esc(sym) + '</button>';
                      }).join("") +
                    '</div>' +
                  '</div>'
                )) +

                (q.ipucu ? (
                  '<details class="yz2-hint-box"><summary>💡 İpucu Gör</summary><p>' + esc(q.ipucu) + '</p></details>'
                ) : '') +

                '<div class="yz2-exam-foot">' +
                  '<button type="button" class="yz2-back-btn" data-yz-prev' + (state.qIdx === 0 ? ' disabled' : '') + '>← Önceki</button>' +
                  (state.qIdx < state.activeQuestions.length - 1
                    ? '<button type="button" class="yz2-amber-btn" data-yz-next>Sonraki →</button>'
                    : '<button type="button" class="yz2-navy-btn" data-yz-ask-submit>✅ Yazılıyı Teslim Et</button>'
                  ) +
                '</div>' +
              '</div>' +
            '</div>' +

            (state.showConfirmModal ? (
              '<div class="yz2-modal-backdrop">' +
                '<div class="yz2-modal-card">' +
                  '<h3>Yazılıyı Teslim Et</h3>' +
                  (emptyNums.length
                    ? '<p>Boş bıraktığın sorular: <strong>' + emptyNums.join(", ") + '</strong>.<br>Yazılıyı teslim etmek istiyor musun? Teslimden sonra cevapların değiştirilemez.</p>'
                    : '<p>Tüm soruları yanıtladın! Yazılıyı teslim edip puanını ve çözümlerini görmek istiyor musun?</p>') +
                  '<div class="yz2-modal-actions">' +
                    '<button type="button" class="yz2-back-btn" data-yz-modal-cancel>Geri Dön</button>' +
                    '<button type="button" class="yz2-navy-btn" data-yz-modal-confirm>Teslim Et</button>' +
                  '</div>' +
                '</div>' +
              '</div>'
            ) : '') +
          '</div>';

        // Sol Geometri Lab / SVG / Görsel montajı
        var leftMount = root.querySelector("[data-yz-left-mount]");
        var mountedLab = global.ZarifGeoLab && global.ZarifGeoLab.mount(leftMount, q, function () {
          state.drawDone[state.qIdx] = true;
          var stEl = root.querySelector(".yz2-draw-status");
          if (stEl) {
            stEl.classList.add("ok");
            stEl.textContent = "✅ Çizim tamamlandı! Bir sonraki şıkka geçebilirsin.";
          }
          var pill = root.querySelector('[data-yz-q="' + state.qIdx + '"]');
          if (pill) pill.classList.add("done");
        });

        if (!mountedLab && leftMount) {
          var visualHtml = "";
          if (q.resimUrl) {
            visualHtml += '<img src="' + esc(q.resimUrl) + '" alt="Soru Görseli" style="width:100%;max-height:280px;object-fit:contain;border-radius:10px;border:1px solid #E2DDD5;margin-bottom:10px;">';
          }
          if (q.svg && typeof q.svg === "string" && q.svg.trim().indexOf("<svg") === 0) {
            visualHtml += q.svg;
          } else if (!visualHtml && global.VisualMathEngine && typeof global.VisualMathEngine.inferVisualSpecFromText === "function") {
            var inf = global.VisualMathEngine.inferVisualSpecFromText(q.metin, q.konu, state.grade);
            if (inf) visualHtml = global.VisualMathEngine.renderToSvg(inf) || "";
          }
          leftMount.innerHTML = visualHtml
            ? '<div class="yz-geo-card"><div class="yz-geo-topbar"><span class="yz-geo-badge">📐 Soru Görseli &amp; Modeli</span></div><div class="yz-geo-stage" style="padding:12px;">' + visualHtml + '</div></div>'
            : '<div class="yz-geo-card"><div class="yz-geo-topbar"><span class="yz-geo-badge">📝 ' + esc(q.konu || "Açık Uçlu Soru") + '</span></div><div style="padding:26px 18px;text-align:center;color:#64748B;font-size:13.5px;line-height:1.6;">Bu soru metin tabanlı açık uçlu bir problemdir. İşlem adımlarını sağdaki alana net biçimde yazabilirsin.</div></div>';
        }

        // Event bağlamaları
        root.querySelectorAll("[data-yz-q]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.qIdx = Number(btn.dataset.yzQ);
            state.subIdx = 0;
            SoundEngine.play("click");
            render();
          });
        });
        root.querySelectorAll("[data-yz-sub]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.subIdx = Number(btn.dataset.yzSub);
            SoundEngine.play("click");
            render();
          });
        });
        var ansEl = root.querySelector("[data-yz-ans]");
        if (ansEl) {
          ansEl.addEventListener("input", function () {
            state.answers[ansKey] = ansEl.value;
            var pill = root.querySelector('[data-yz-q="' + state.qIdx + '"]');
            if (pill) pill.classList.toggle("done", isQuestionAnswered(state.qIdx));
          });
        }
        root.querySelectorAll("[data-yz-sym]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            if (!ansEl) return;
            var sym = btn.dataset.yzSym;
            ansEl.value = (ansEl.value || "") + sym;
            state.answers[ansKey] = ansEl.value;
            ansEl.focus();
            SoundEngine.play("click");
          });
        });
        root.querySelector("[data-yz-prev]")?.addEventListener("click", function () {
          if (state.qIdx > 0) { state.qIdx -= 1; state.subIdx = 0; SoundEngine.play("click"); render(); }
        });
        root.querySelector("[data-yz-next]")?.addEventListener("click", function () {
          if (state.qIdx < state.activeQuestions.length - 1) { state.qIdx += 1; state.subIdx = 0; SoundEngine.play("step"); render(); }
        });
        root.querySelectorAll("[data-yz-ask-submit]").forEach(function (btn) {
          btn.addEventListener("click", function () { state.showConfirmModal = true; SoundEngine.play("click"); render(); });
        });
        root.querySelector("[data-yz-modal-cancel]")?.addEventListener("click", function () { state.showConfirmModal = false; SoundEngine.play("click"); render(); });
        root.querySelector("[data-yz-modal-confirm]")?.addEventListener("click", function () { finishExam(); });
        root.querySelector("[data-yz-warn-ok]")?.addEventListener("click", function () {
          state.tabWarningVisible = false;
          var w = root.querySelector("[data-yz-tab-warn]");
          if (w) w.style.display = "none";
        });
        root.querySelector("[data-yz-sound]")?.addEventListener("click", function () { SoundEngine.toggleMute(); render(); });
        return;
      }

      /* ── ADIM 7: SONUÇ KARNESİ & ÇÖZÜM İNCELEME ── */
      if (state.step === "result") {
        root.innerHTML =
          '<div class="yz2-shell yz2-fade">' +
            '<div class="yz2-result-hero">' +
              '<div class="yz2-score-ring"><strong>' + state.lastScore + '</strong><span>/ 100</span></div>' +
              '<div>' +
                '<span class="yz2-kicker">YAZILI DEĞERLENDİRME KARNESİ</span>' +
                '<h2>' + (state.lastScore >= 85 ? "Harika Performans! 🏆" : state.lastScore >= 60 ? "Güzel İlerleme! 💪" : "Eksikleri Birlikte Tamamlayalım! 📘") + '</h2>' +
                '<p>' + state.grade + '. Sınıf · ' + esc(getTermLabel(state.donem)) + ' · Sekmeden ayrılma: ' + state.tabLeaveCount + ' kez</p>' +
                '<div class="yz2-res-actions">' +
                  '<button type="button" class="yz2-navy-btn" data-yz-toggle-sol>👁️ ' + (state.showSolutions ? "Çözümleri Gizle" : "Çözümleri Göster") + '</button>' +
                  '<button type="button" class="yz2-amber-btn" data-yz-retry>🔄 Yeniden Dene</button>' +
                  '<button type="button" class="yz2-back-btn" data-yz-home>← Yazılı Merkezine Dön</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            (state.showSolutions ? (
              '<div class="yz2-sol-list">' +
                state.activeQuestions.map(function (q, i) {
                  return '<div class="yz2-sol-card">' +
                    '<div class="yz2-q-head"><span class="yz2-kaz-code">Soru ' + (i + 1) + ' · ' + esc(q.kazanimKodu || "") + '</span><span class="yz2-pts-badge">' + (q.puan || 20) + ' Puan</span></div>' +
                    '<p class="yz2-sol-q">' + esc(q.metin) + '</p>' +
                    '<div class="yz2-sol-ans"><strong>📝 Adım Adım Çözüm:</strong><br>' + esc(q.cozumAdimlari || "").replace(/\n/g, "<br>") + '</div>' +
                  '</div>';
                }).join("") +
              '</div>'
            ) : '') +
          '</div>';

        root.querySelector("[data-yz-toggle-sol]")?.addEventListener("click", function () {
          state.showSolutions = !state.showSolutions;
          SoundEngine.play("click");
          render();
        });
        root.querySelector("[data-yz-retry]")?.addEventListener("click", function () {
          state.qIdx = 0; state.subIdx = 0; state.answers = {}; state.drawDone = {}; state.showSolutions = false;
          state.step = "exam"; SoundEngine.play("step"); startTimer(); render();
        });
        root.querySelector("[data-yz-home]")?.addEventListener("click", function () {
          state.step = "terms"; SoundEngine.play("click"); render();
        });
      }
    }

    function goToLoadingThen(nextStep) {
      state.step = "loading";
      render();
      setTimeout(function () {
        state.step = nextStep;
        SoundEngine.play("step");
        render();
      }, 950);
    }

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initYaziliStudyosu);
  } else {
    initYaziliStudyosu();
  }
})(window);
