/* ==========================================================================
   ZarifÇözüm — İnteraktif Konu İstasyonları Motoru (konu-istasyonlari.js)
   Öğrenci "Konu Çalış" Stüdyosu için 3 Etkileşimli İstasyon:
     - İstasyon 2: 🔬 Deneyimle & Keşfet (Konuya Duyarlı Kaydırıcı Laboratuvarı)
     - İstasyon 3: 🧩 Kavrama Etkinliği (Otomatik Flashcard Eşleştirme Oyunu)
     - İstasyon 4: 🏆 Üst Düzey Konu Yarışması (5 Can · Seri · 4 Joker · Zoom)
   Marka Paleti: #FAF8F5 (fildişi), #0F172A (gece mavisi), #D97706 (kehribar)
   ========================================================================== */
(function (global) {
  "use strict";

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtMath(text) {
    var clean = String(text || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*\*/g, "");
    if (global.zarifMathText && typeof global.zarifMathText.format === "function") {
      return global.zarifMathText.format(clean);
    }
    return esc(clean);
  }

  function playTone(kind) {
    if (global.ZarifYaziliSound && typeof global.ZarifYaziliSound.play === "function") {
      global.ZarifYaziliSound.play(kind === "match" || kind === "victory" ? "success" : (kind === "wrong" ? "click" : "step"));
      return;
    }
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var now = ctx.currentTime;
      var notes = kind === "victory" || kind === "match"
        ? [523.25, 659.25, 783.99]
        : kind === "wrong"
        ? [310, 240]
        : [520];
      notes.forEach(function (f, i) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = kind === "wrong" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(f, now + i * 0.07);
        g.gain.setValueAtTime(0.0001, now + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.06, now + i * 0.07 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.14);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.16);
      });
    } catch (_) {}
  }

  /* ========================================================================
     İSTASYON 2: 🔬 DENEYİMLE & KEŞFET (KAYDIRICI LABORATUVARI)
     ======================================================================== */
  function renderDiscoveryLab(container, topic) {
    if (!container) return;
    var title = String(topic?.subTopicTitle || topic?.title || topic?.unit_topic || "").toLowerCase();
    var grade = Number(topic?.grade) || 5;

    // Konuya en uygun keşif simülasyonunu seç
    if (title.indexOf("açı") >= 0 || title.indexOf("üçgen") >= 0) {
      var deg = 65;
      var drawAngle = function () {
        var rad = (deg * Math.PI) / 180;
        var cx = deg > 110 ? 240 : 155, cy = 195, len = 148;
        var x2 = cx + len * Math.cos(rad), y2 = cy - len * Math.sin(rad);
        var kind = deg < 90 ? "Dar Açı (0° < α < 90°)" : (deg === 90 ? "Dik Açı (α = 90°)" : (deg < 180 ? "Geniş Açı (90° < α < 180°)" : "Doğru Açı (α = 180°)"));
        var arc = deg === 90
          ? '<rect x="' + cx + '" y="' + (cy - 26) + '" width="26" height="26" fill="rgba(217,119,6,0.2)" stroke="#D97706" stroke-width="2"/>'
          : '<path d="M ' + cx + ' ' + cy + ' L ' + (cx + 46) + ' ' + cy + ' A 46 46 0 0 0 ' + (cx + 46 * Math.cos(rad)).toFixed(1) + ' ' + (cy - 46 * Math.sin(rad)).toFixed(1) + ' Z" fill="rgba(217,119,6,0.2)" stroke="#D97706" stroke-width="2"/>';
        container.querySelector("[data-disc-svg]").innerHTML =
          '<svg viewBox="0 0 460 230" style="width:100%;max-width:480px;height:auto;display:block;margin:0 auto;">' +
            '<rect width="460" height="230" rx="14" fill="#FAF8F5" stroke="#E2DDD5" stroke-width="1.5"/>' +
            arc +
            '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + len) + '" y2="' + cy + '" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round"/>' +
            '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#2563EB" stroke-width="3.5" stroke-linecap="round"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#0F172A"/>' +
            '<text x="230" y="34" text-anchor="middle" font-size="14" font-weight="800" fill="#0F172A">' + deg + '° — ' + kind + '</text>' +
          '</svg>';
        container.querySelector("[data-disc-val]").textContent = deg + "°";
      };
      container.innerHTML =
        '<div class="ks-card">' +
          '<div class="ks-head">🔬 Deneyimle &amp; Keşfet — Dinamik Açı Laboratuvarı</div>' +
          '<p class="ks-sub">Kaydırıcıyı hareket ettirerek açının <strong>Dar → Dik → Geniş → Doğru</strong> açıya nasıl dönüştüğünü gözlemle!</p>' +
          '<div data-disc-svg></div>' +
          '<div class="ks-slider-row"><span>Açı Ölçüsü: <strong data-disc-val>65°</strong></span><input type="range" min="10" max="180" step="5" value="65" data-disc-rng></div>' +
        '</div>';
      drawAngle();
      container.querySelector("[data-disc-rng]").addEventListener("input", function (e) {
        deg = Number(e.target.value);
        drawAngle();
      });
      return;
    }

    if (title.indexOf("kesir") >= 0 || title.indexOf("ondalık") >= 0 || title.indexOf("yüzde") >= 0) {
      var pay = 3, payda = 8;
      var drawFrac = function () {
        if (pay > payda) pay = payda;
        var svg = global.VisualMathEngine
          ? global.VisualMathEngine.render("sayi_dogrusu_kesir", { alt_tip: "kesir_daire", pay: pay, payda: payda }, "Kesir Keşif Modeli (" + pay + "/" + payda + ")")
          : "";
        container.querySelector("[data-disc-svg]").innerHTML = svg;
        var pct = Math.round((pay / payda) * 100);
        container.querySelector("[data-disc-val]").textContent = pay + "/" + payda + " (≈ %" + pct + ")";
      };
      container.innerHTML =
        '<div class="ks-card">' +
          '<div class="ks-head">🔬 Deneyimle &amp; Keşfet — Canlı Kesir &amp; Yüzde Laboratuvarı</div>' +
          '<p class="ks-sub">Pay ve paydayı değiştirerek bütünün kaç eş parçaya bölündüğünü ve yüzdelik karşılığını anında gör.</p>' +
          '<div data-disc-svg></div>' +
          '<div class="ks-slider-row"><span>Model: <strong data-disc-val>3/8</strong></span>' +
            '<label>Pay: <input type="range" min="1" max="12" value="3" data-f-pay></label>' +
            '<label>Payda: <input type="range" min="2" max="12" value="8" data-f-payda></label>' +
          '</div>' +
        '</div>';
      drawFrac();
      container.querySelector("[data-f-pay]").addEventListener("input", function (e) { pay = Number(e.target.value); drawFrac(); });
      container.querySelector("[data-f-payda]").addEventListener("input", function (e) { payda = Number(e.target.value); drawFrac(); });
      return;
    }

    if (grade >= 8 && (title.indexOf("fonksiyon") >= 0 || title.indexOf("parabol") >= 0 || title.indexOf("doğrusal") >= 0 || title.indexOf("türev") >= 0 || title.indexOf("integral") >= 0)) {
      var a = 1, c = -2;
      var drawFn = function () {
        var svg = global.VisualMathEngine
          ? global.VisualMathEngine.render("fonksiyon_grafik", { alt_tip: "parabol", a: a, b: 0, c: c, etiket: "y = " + a + "x² " + (c >= 0 ? "+ " + c : c) }, "Dinamik Parabol Keşfi")
          : "";
        container.querySelector("[data-disc-svg]").innerHTML = svg;
        container.querySelector("[data-disc-val]").textContent = "y = " + a + "x² " + (c >= 0 ? "+ " + c : c);
      };
      container.innerHTML =
        '<div class="ks-card">' +
          '<div class="ks-head">🔬 Deneyimle &amp; Keşfet — Dinamik Grafik Laboratuvarı</div>' +
          '<p class="ks-sub">Katsayıları kaydırarak parabol kollarının yönünü ve y-ekseni kesişimini canlı gözlemle.</p>' +
          '<div data-disc-svg></div>' +
          '<div class="ks-slider-row"><span>Denklem: <strong data-disc-val>y = x² - 2</strong></span>' +
            '<label>a: <input type="range" min="-2" max="2" step="0.5" value="1" data-p-a></label>' +
            '<label>c: <input type="range" min="-4" max="4" step="1" value="-2" data-p-c></label>' +
          '</div>' +
        '</div>';
      drawFn();
      container.querySelector("[data-p-a]").addEventListener("input", function (e) { a = Number(e.target.value) || 0.5; drawFn(); });
      container.querySelector("[data-p-c]").addEventListener("input", function (e) { c = Number(e.target.value); drawFn(); });
      return;
    }

    // Varsayılan (Özellikle Temel Geometri: Doğru Parçası -> Işın -> Doğru Dönüşümü!)
    var ext = 0;
    var labels = [
      { ad: "Doğru Parçası [AB]", aciklama: "İki ucu da kapalı ve sınırlıdır; cetvelle uzunluğu ölçülebilir.", tip: "dogru_parcasi" },
      { ad: "Işın [AB", aciklama: "A noktasından başlar, B yönünde sonsuza kadar uzar (el feneri ışığı gibi).", tip: "isin" },
      { ad: "Doğru AB", aciklama: "Her iki ucu da sınırsız şekilde sonsuza uzar; uzunluğu ölçülemez.", tip: "dogru" }
    ];
    var drawLine = function () {
      var cur = labels[ext];
      var svg = global.VisualMathEngine
        ? global.VisualMathEngine.render("geometri", { alt_tip: cur.tip, nokta1: "A", nokta2: "B", dogru_adi: "d" }, cur.ad)
        : "";
      container.querySelector("[data-disc-svg]").innerHTML = svg;
      container.querySelector("[data-disc-val]").textContent = ext + " uç uzatıldı → " + cur.ad;
      container.querySelector("[data-disc-desc]").textContent = cur.aciklama;
    };
    container.innerHTML =
      '<div class="ks-card">' +
        '<div class="ks-head">🔬 Deneyimle &amp; Keşfet — Uçları Uzatarak Şekli Dönüştür!</div>' +
        '<p class="ks-sub">Kaydırıcıyı <strong>0, 1 ve 2</strong> konumlarına getirerek Doğru Parçası, Işın ve Doğru arasındaki farkı bizzat keşfet.</p>' +
        '<div data-disc-svg></div>' +
        '<div class="ks-slider-row"><span>Durum: <strong data-disc-val>0 uç uzatıldı</strong></span><input type="range" min="0" max="2" step="1" value="0" data-disc-ext></div>' +
        '<div class="ks-note" data-disc-desc></div>' +
      '</div>';
    drawLine();
    container.querySelector("[data-disc-ext]").addEventListener("input", function (e) {
      ext = Number(e.target.value);
      playTone("step");
      drawLine();
    });
  }

  /* ========================================================================
     İSTASYON 3: 🧩 KAVRAMA ETKİNLİĞİ (OTOMATİK EŞLEŞTİRME OYUNU)
     ======================================================================== */
  function renderMatchingGame(container, flashcards, topicTitle) {
    if (!container) return;
    var pairs = Array.isArray(flashcards) && flashcards.length >= 2
      ? flashcards.slice(0, 5).map(function (fc, i) { return { id: i, left: fc.front, right: fc.back }; })
      : [
          { id: 0, left: "Doğru Parçası [AB]", right: "İki ucu sınırlı, uzunluğu ölçülebilir." },
          { id: 1, left: "Işın [AB", right: "Bir ucu sabit, diğer ucu sonsuza uzar." },
          { id: 2, left: "Dik Açı (90°)", right: "İki doğrunun dik kesişmesiyle oluşur." },
          { id: 3, left: "Paralel Doğrular (∥)", right: "Aralarındaki mesafe değişmez, hiç kesişmez." }
        ];

    var rightShuffled = pairs.slice().sort(function () { return Math.random() - 0.5; });
    var selectedLeft = null;
    var matchedIds = new Set();
    var mistakes = 0;

    function draw() {
      var done = matchedIds.size === pairs.length;
      container.innerHTML =
        '<div class="ks-card">' +
          '<div class="ks-head-row">' +
            '<div class="ks-head">🧩 Kavrama Etkinliği — Kavram &amp; Anlam Eşleştirme</div>' +
            '<span class="ks-pill">' + matchedIds.size + ' / ' + pairs.length + ' Eşleşti</span>' +
          '</div>' +
          '<p class="ks-sub">Soldan bir kavram kartına tıkla, ardından sağdan doğru eşini seç!</p>' +
          (done ? '<div class="ks-win-banner">🎉 Harika! Tüm kavramları hatasız eşleştirdin! (' + mistakes + ' hata) <button type="button" class="ks-btn-amber" data-m-reset>🔁 Tekrar Oyna</button></div>' : '') +
          '<div class="ks-match-grid">' +
            '<div class="ks-match-col">' +
              pairs.map(function (p) {
                var cls = "ks-m-item" + (matchedIds.has(p.id) ? " matched" : (selectedLeft === p.id ? " active" : ""));
                return '<button type="button" class="' + cls + '" data-m-left="' + p.id + '"' + (matchedIds.has(p.id) ? ' disabled' : '') + '>' + fmtMath(p.left) + '</button>';
              }).join("") +
            '</div>' +
            '<div class="ks-match-col">' +
              rightShuffled.map(function (p) {
                var cls = "ks-m-item" + (matchedIds.has(p.id) ? " matched" : "");
                return '<button type="button" class="' + cls + '" data-m-right="' + p.id + '"' + (matchedIds.has(p.id) ? ' disabled' : '') + '>' + fmtMath(p.right) + '</button>';
              }).join("") +
            '</div>' +
          '</div>' +
        '</div>';

      container.querySelector("[data-m-reset]")?.addEventListener("click", function () {
        matchedIds.clear();
        selectedLeft = null;
        mistakes = 0;
        rightShuffled = pairs.slice().sort(function () { return Math.random() - 0.5; });
        draw();
      });

      container.querySelectorAll("[data-m-left]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          selectedLeft = Number(btn.dataset.mLeft);
          playTone("click");
          draw();
        });
      });

      container.querySelectorAll("[data-m-right]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (selectedLeft === null) return;
          var rid = Number(btn.dataset.mRight);
          if (rid === selectedLeft) {
            matchedIds.add(rid);
            selectedLeft = null;
            playTone(matchedIds.size === pairs.length ? "victory" : "match");
            draw();
          } else {
            mistakes += 1;
            playTone("wrong");
            btn.classList.add("wrong");
            setTimeout(function () { btn.classList.remove("wrong"); }, 450);
          }
        });
      });
    }
    draw();
  }

  /* ========================================================================
     İSTASYON 4: 🏆 ÜST DÜZEY KONU YARIŞMASI (5 CAN · SERİ · 4 JOKER · ZOOM)
     ======================================================================== */
  async function renderArenaRace(container, topic) {
    if (!container) return;
    container.innerHTML = '<div class="ks-card" style="text-align:center;padding:34px;">🏆 Konu yarışması soruları hazırlanıyor…</div>';

    var grade = Number(topic?.grade) || 5;
    var topicName = topic?.subTopicTitle || topic?.title || "";
    var questions = [];

    try {
      var res = await fetch("/api/pratik/sorular?sinif=" + encodeURIComponent(grade) + "&konu=" + encodeURIComponent(topicName), { credentials: "include" });
      if (res.ok) {
        var data = await res.json();
        var raw = Array.isArray(data?.sorular) ? data.sorular : [];
        questions = raw.filter(function (q) { return q && q.options && Object.keys(q.options).length >= 2; }).slice(0, 10);
      }
    } catch (_) {}

    if (!questions.length) {
      container.innerHTML =
        '<div class="ks-card" style="text-align:center;padding:32px;">' +
          '<div style="font-size:2rem;margin-bottom:8px;">🏆</div>' +
          '<h3 style="margin:0 0 8px;color:#0F172A;">Bu Konu İçin Onaylı Yarışma Sorusu Bekleniyor</h3>' +
          '<p style="margin:0;color:#64748B;font-size:0.9rem;">Öğretmenin bu konuda AI Soru Sihirbazı ile soru üretip <strong>Soru Bankasına Aktar</strong> dediğinde 5 Canlı ve 4 Jokerli Konu Yarışması burada otomatik açılır!</p>' +
        '</div>';
      return;
    }

    var st = {
      started: false,
      idx: 0,
      hearts: 5,
      streak: 0,
      score: 0,
      answered: false,
      selectedOpt: null,
      eliminated: [],
      doubleTryActive: false,
      doubleTryUsedOnQ: false,
      jokers: { eliminate: true, hint: true, doubleTry: true, skip: true },
      showHintEnvelope: false,
      zoomVisual: false,
      finished: false
    };

    function drawArena() {
      if (!st.started) {
        container.innerHTML =
          '<div class="ks-arena-intro">' +
            '<span class="ks-pill" style="background:#FEF3C7;color:#92400E;">🏆 ÜST DÜZEY KONU YARIŞMASI</span>' +
            '<h3>' + esc(grade) + '. Sınıf · ' + esc(topicName) + '</h3>' +
            '<div class="ks-intro-rules">' +
              '<div><strong>' + questions.length + ' Soru</strong><span>Onaylı havuzdan seçildi</span></div>' +
              '<div><strong>5 Can ❤️</strong><span>Her doğru seri puanı artırır</span></div>' +
              '<div><strong>4 Joker 🃏</strong><span>✂️ 2 Şık Ele · ✉️ İpucu · ✌️ Çift Cevap · ⏭️ Pas</span></div>' +
            '</div>' +
            '<button type="button" class="ks-btn-amber ks-btn-lg" data-ar-start>🚀 Yarışmaya Başla</button>' +
          '</div>';
        container.querySelector("[data-ar-start]")?.addEventListener("click", function () {
          st.started = true;
          playTone("step");
          drawArena();
        });
        return;
      }

      if (st.finished || st.hearts <= 0 || st.idx >= questions.length) {
        container.innerHTML =
          '<div class="ks-arena-intro">' +
            '<div style="font-size:2.6rem;">' + (st.hearts > 0 ? "🏆" : "💪") + '</div>' +
            '<h3>' + (st.hearts > 0 ? "Yarışma Tamamlandı!" : "Canların Bitti, Tekrar Dene!") + '</h3>' +
            '<p style="color:#475569;margin:6px 0 18px;">Toplam Puan: <strong style="color:#D97706;font-size:1.2rem;">' + st.score + ' XP</strong> · Kalan Can: ' + st.hearts + ' ❤️</p>' +
            '<button type="button" class="ks-btn-navy" data-ar-restart>🔄 Tekrar Yarış</button>' +
          '</div>';
        container.querySelector("[data-ar-restart]")?.addEventListener("click", function () {
          st.idx = 0; st.hearts = 5; st.streak = 0; st.score = 0; st.finished = false;
          st.answered = false; st.selectedOpt = null; st.eliminated = [];
          st.jokers = { eliminate: true, hint: true, doubleTry: true, skip: true };
          drawArena();
        });
        return;
      }

      var q = questions[st.idx];
      var letters = Object.keys(q.options || {});
      var heartsHtml = "";
      for (var h = 0; h < 5; h++) heartsHtml += '<span style="opacity:' + (h < st.hearts ? "1" : "0.22") + ';">❤️</span>';
      var visualMarkup = global.VisualMathEngine ? global.VisualMathEngine.renderFromQuestion(q) : (q.svg || "");

      container.innerHTML =
        '<div class="ks-arena-wrap">' +
          '<div class="ks-arena-top">' +
            '<span><strong>Soru ' + (st.idx + 1) + ' / ' + questions.length + '</strong></span>' +
            '<span class="ks-streak-badge">🔥 Seri: ' + st.streak + ' · ⭐ ' + st.score + ' XP</span>' +
            '<span class="ks-hearts">' + heartsHtml + '</span>' +
          '</div>' +

          '<div class="ks-arena-body">' +
            '<div class="ks-arena-main">' +
              (visualMarkup || q.imageUrl ? (
                '<div class="ks-arena-visual" data-ar-zoom title="Büyütmek için tıkla">' +
                  (q.imageUrl ? '<img src="' + esc(q.imageUrl) + '" style="max-height:190px;border-radius:10px;object-fit:contain;">' : '') +
                  visualMarkup +
                  '<span class="ks-zoom-tag">🔍 Büyüt</span>' +
                '</div>'
              ) : '') +
              '<div class="ks-arena-q">' + fmtMath(q.text) + '</div>' +
              '<div class="ks-arena-opts">' +
                letters.map(function (L) {
                  var isElim = st.eliminated.indexOf(L) >= 0;
                  var isCorrect = st.answered && L === q.answer;
                  var isWrong = st.answered && st.selectedOpt === L && L !== q.answer;
                  var cls = "ks-opt-btn" + (isElim ? " elim" : "") + (isCorrect ? " correct" : "") + (isWrong ? " wrong" : "");
                  return '<button type="button" class="' + cls + '" data-ar-opt="' + esc(L) + '"' + (isElim || st.answered ? " disabled" : "") + '>' +
                    '<span class="ks-opt-lbl">' + esc(L) + '</span><span>' + fmtMath(q.options[L]) + '</span>' +
                  '</button>';
                }).join("") +
              '</div>' +
              (st.answered ? (
                '<div class="ks-arena-feedback">' +
                  '<div><strong>📝 Çözüm:</strong> ' + fmtMath(q.explanation || q.solution || ("Doğru cevap: " + q.answer)) + '</div>' +
                  '<button type="button" class="ks-btn-amber" data-ar-next>' + (st.idx < questions.length - 1 ? "Sıradaki Soru →" : "Sonucu Gör 🏆") + '</button>' +
                '</div>'
              ) : '') +
            '</div>' +

            '<aside class="ks-joker-rail">' +
              '<div class="ks-joker-title">JOKERLER (1 KEZ)</div>' +
              '<button type="button" class="ks-joker-btn" data-jk="eliminate"' + (!st.jokers.eliminate || st.answered ? " disabled" : "") + '>✂️ 2 Şık Ele</button>' +
              '<button type="button" class="ks-joker-btn" data-jk="hint"' + (!st.jokers.hint || st.answered ? " disabled" : "") + '>✉️ İpucu Zarfı</button>' +
              '<button type="button" class="ks-joker-btn" data-jk="doubleTry"' + (!st.jokers.doubleTry || st.answered ? " disabled" : "") + '>✌️ Çift Cevap</button>' +
              '<button type="button" class="ks-joker-btn" data-jk="skip"' + (!st.jokers.skip || st.answered ? " disabled" : "") + '>⏭️ Pas Geç</button>' +
            '</aside>' +
          '</div>' +

          (st.showHintEnvelope ? (
            '<div class="ks-overlay" data-ar-close-env>' +
              '<div class="ks-env-card">' +
                '<div style="font-size:2.2rem;margin-bottom:6px;">✉️</div>' +
                '<h4>Küçük Bir İpucu</h4>' +
                '<p>' + fmtMath((q.explanation || q.solution || "Sorudaki sayıları ve verilenleri adım adım karşılaştır.").slice(0, 170)) + '…</p>' +
                '<button type="button" class="ks-btn-navy" data-ar-close-env>Anladım</button>' +
              '</div>' +
            '</div>'
          ) : '') +

          (st.zoomVisual ? (
            '<div class="ks-overlay" data-ar-close-zoom>' +
              '<div class="ks-zoom-card">' +
                (q.imageUrl ? '<img src="' + esc(q.imageUrl) + '" style="max-width:100%;max-height:70vh;border-radius:12px;">' : visualMarkup) +
                '<button type="button" class="ks-btn-navy" style="margin-top:12px;" data-ar-close-zoom>Kapat</button>' +
              '</div>' +
            '</div>'
          ) : '') +
        '</div>';

      container.querySelectorAll("[data-ar-opt]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var chosen = btn.dataset.arOpt;
          if (chosen === q.answer) {
            st.answered = true;
            st.selectedOpt = chosen;
            st.streak += 1;
            st.score += 10 + Math.min(20, st.streak * 5);
            playTone("match");
          } else if (st.doubleTryActive && !st.doubleTryUsedOnQ) {
            st.doubleTryUsedOnQ = true;
            st.eliminated.push(chosen);
            playTone("wrong");
          } else {
            st.answered = true;
            st.selectedOpt = chosen;
            st.streak = 0;
            st.hearts = Math.max(0, st.hearts - 1);
            playTone("wrong");
          }
          drawArena();
        });
      });

      container.querySelector("[data-ar-next]")?.addEventListener("click", function () {
        st.idx += 1;
        st.answered = false;
        st.selectedOpt = null;
        st.eliminated = [];
        st.doubleTryActive = false;
        st.doubleTryUsedOnQ = false;
        if (st.idx >= questions.length) { st.finished = true; playTone("victory"); }
        else playTone("step");
        drawArena();
      });

      container.querySelectorAll("[data-jk]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var jk = btn.dataset.jk;
          if (!st.jokers[jk]) return;
          st.jokers[jk] = false;
          if (jk === "eliminate") {
            var wrongs = letters.filter(function (l) { return l !== q.answer; }).slice(0, 2);
            st.eliminated = st.eliminated.concat(wrongs);
            playTone("step");
          } else if (jk === "hint") {
            st.showHintEnvelope = true;
            playTone("step");
          } else if (jk === "doubleTry") {
            st.doubleTryActive = true;
            playTone("step");
          } else if (jk === "skip") {
            st.idx += 1;
            st.answered = false;
            st.eliminated = [];
            playTone("step");
          }
          drawArena();
        });
      });

      container.querySelector("[data-ar-zoom]")?.addEventListener("click", function () { st.zoomVisual = true; drawArena(); });
      container.querySelectorAll("[data-ar-close-zoom]").forEach(function (el) { el.addEventListener("click", function () { st.zoomVisual = false; drawArena(); }); });
      container.querySelectorAll("[data-ar-close-env]").forEach(function (el) { el.addEventListener("click", function () { st.showHintEnvelope = false; drawArena(); }); });
    }
    drawArena();
  }

  global.ZarifKonuIstasyonlari = {
    renderDiscoveryLab: renderDiscoveryLab,
    renderMatchingGame: renderMatchingGame,
    renderArenaRace: renderArenaRace
  };
})(window);
