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

  /* ── Gerçekçi Alkış Sesi (Web Audio Filtreli Alkış + Melodi) ── */
  function playApplause() {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var now = ctx.currentTime;
      // 4 yumuşak ritmik alkış vuruşu (bandpass gürültü)
      [0, 0.13, 0.26, 0.39].forEach(function (offset) {
        var len = Math.floor(ctx.sampleRate * 0.055);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
        }
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1150;
        filter.Q.value = 1.1;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.14, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);
        src.connect(filter);
        filter.connect(g);
        g.connect(ctx.destination);
        src.start(now + offset);
      });
    } catch (_) {}
  }

  /* ── Profesyonel, Büyük & Gerçekçi Alkışlayan Öğrenci Karakteri SVG ── */
  function buildMascotSvg(mood, activeWord) {
    var isCelebrate = mood === "celebrate";
    var isClap = mood === "clap" || isCelebrate;
    var cls = isCelebrate ? "ks-mascot-pro ks-mascot-jump" : (isClap ? "ks-mascot-pro ks-mascot-clap" : "ks-mascot-pro ks-mascot-idle");
    var badgeWord = esc(activeWord || "Harikasın!");

    var clapBurst = isClap
      ? '<g class="ks-clap-burst">' +
          '<line x1="100" y1="108" x2="100" y2="95" stroke="#D97706" stroke-width="2.6" stroke-linecap="round"/>' +
          '<line x1="87" y1="114" x2="77" y2="105" stroke="#F59E0B" stroke-width="2.4" stroke-linecap="round"/>' +
          '<line x1="113" y1="114" x2="123" y2="105" stroke="#F59E0B" stroke-width="2.4" stroke-linecap="round"/>' +
          '<text x="22" y="42" font-size="22" class="ks-star-pop">✨</text>' +
          '<text x="156" y="38" font-size="22" class="ks-star-pop">⭐</text>' +
          (isCelebrate ? '<text x="89" y="24" font-size="24" class="ks-star-pop">🏆</text>' : '') +
        '</g>'
      : '';

    var eyes = isClap
      ? '<path d="M78 72 Q84 64 90 72" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M110 72 Q116 64 122 72" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>'
      : '<ellipse cx="84" cy="72" rx="4.6" ry="5.4" fill="#0F172A"/><circle cx="85.8" cy="70" r="1.6" fill="#FFFFFF"/>' +
        '<ellipse cx="116" cy="72" rx="4.6" ry="5.4" fill="#0F172A"/><circle cx="117.8" cy="70" r="1.6" fill="#FFFFFF"/>';

    var mouth = isClap
      ? '<path d="M84 88 Q100 106 116 88 Z" fill="#991B1B" stroke="#0F172A" stroke-width="2.2"/>' +
        '<path d="M88 90 Q100 94 112 90" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M88 90 Q100 98 112 90" fill="none" stroke="#0F172A" stroke-width="2.6" stroke-linecap="round"/>';

    var arms = isClap
      ? // Göğüs önünde gerçek alkış vuruşu yapan sol ve sağ kollar + eller
        '<g class="ks-arm-l">' +
          '<path d="M64 124 Q52 132 82 126" fill="none" stroke="#D97706" stroke-width="14" stroke-linecap="round"/>' +
          '<ellipse cx="92" cy="123" rx="10" ry="12" transform="rotate(-18 92 123)" fill="#FCD5B5" stroke="#0F172A" stroke-width="2"/>' +
        '</g>' +
        '<g class="ks-arm-r">' +
          '<path d="M136 124 Q148 132 118 126" fill="none" stroke="#D97706" stroke-width="14" stroke-linecap="round"/>' +
          '<ellipse cx="108" cy="123" rx="10" ry="12" transform="rotate(18 108 123)" fill="#FCD5B5" stroke="#0F172A" stroke-width="2"/>' +
        '</g>'
      : '<path d="M62 126 Q46 146 56 160" fill="none" stroke="#D97706" stroke-width="13" stroke-linecap="round"/>' +
        '<circle cx="57" cy="160" r="8" fill="#FCD5B5" stroke="#0F172A" stroke-width="2"/>' +
        '<path d="M138 126 Q154 146 144 160" fill="none" stroke="#D97706" stroke-width="13" stroke-linecap="round"/>' +
        '<circle cx="143" cy="160" r="8" fill="#FCD5B5" stroke="#0F172A" stroke-width="2"/>';

    return '<div class="ks-pro-avatar-wrap">' +
      (isClap ? '<div class="ks-word-pill" data-ks-word-pill>' + badgeWord + '</div>' : '') +
      '<svg class="' + cls + '" viewBox="0 0 200 185" width="196" height="182" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<radialGradient id="ksGlow" cx="50%" cy="50%" r="50%">' +
            '<stop offset="0%" stop-color="#FEF3C7" stop-opacity="0.95"/>' +
            '<stop offset="100%" stop-color="#FAF8F5" stop-opacity="0"/>' +
          '</radialGradient>' +
        '</defs>' +
        '<circle cx="100" cy="96" r="82" fill="url(#ksGlow)"/>' +
        clapBurst +
        '<ellipse cx="100" cy="174" rx="52" ry="8" fill="rgba(15,23,42,0.12)"/>' +
        // Gövde (Okul hırkası + yaka)
        '<path d="M58 170 L62 126 Q64 110 82 110 L118 110 Q136 110 138 126 L142 170 Z" fill="#0F172A" stroke="#0F172A" stroke-width="2"/>' +
        '<path d="M84 110 L100 132 L116 110 Z" fill="#FFFFFF"/>' +
        '<circle cx="122" cy="136" r="6" fill="#D97706"/>' +
        // Boyun & Baş (hafif neşeli baş sallama)
        '<g class="ks-head-bob">' +
          '<rect x="91" y="98" width="18" height="16" rx="6" fill="#F4C29F"/>' +
          '<circle cx="62" cy="76" r="8" fill="#FCD5B5" stroke="#0F172A" stroke-width="2"/>' +
          '<circle cx="138" cy="76" r="8" fill="#FCD5B5" stroke="#0F172A" stroke-width="2"/>' +
          '<circle cx="100" cy="74" r="38" fill="#FCD5B5" stroke="#0F172A" stroke-width="2.4"/>' +
          // Katmanlı saç + parlaklık
          '<path d="M61 68 Q64 26 100 28 Q136 26 139 68 Q128 46 108 48 Q84 44 61 68 Z" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>' +
          '<path d="M78 39 Q96 32 116 39" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>' +
          // Kaşlar
          '<path d="M76 61 Q84 57 91 61" fill="none" stroke="#1E293B" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path d="M109 61 Q116 57 124 61" fill="none" stroke="#1E293B" stroke-width="2.4" stroke-linecap="round"/>' +
          eyes +
          '<circle cx="72" cy="83" r="6" fill="rgba(244,63,94,0.24)"/>' +
          '<circle cx="128" cy="83" r="6" fill="rgba(244,63,94,0.24)"/>' +
          mouth +
        '</g>' +
        arms +
      '</svg>' +
    '</div>';
  }

  /* ========================================================================
     İSTASYON 2: 🔬 DENEYİMLE & KEŞFET (4 ETKİLEŞİMLİ DENEY + KEŞİF GÖREVLERİ)
     ======================================================================== */
  function renderDiscoveryLab(container, topic) {
    if (!container) return;
    var title = String(topic?.subTopicTitle || topic?.title || topic?.unit_topic || "").toLowerCase();
    var grade = Number(topic?.grade) || 5;

    // Konuya göre ilk açılacak en ilgili deneyi seç, öğrenci tüm 4 deneyi gezebilir!
    var activeExp = "line";
    if (title.indexOf("açı") >= 0 || title.indexOf("üçgen") >= 0) activeExp = "angle";
    else if (title.indexOf("kesir") >= 0 || title.indexOf("ondalık") >= 0 || title.indexOf("yüzde") >= 0) activeExp = "frac";
    else if (grade >= 8 && (title.indexOf("fonksiyon") >= 0 || title.indexOf("parabol") >= 0 || title.indexOf("doğrusal") >= 0 || title.indexOf("türev") >= 0 || title.indexOf("integral") >= 0)) activeExp = "parabola";

    var expTabs = [
      { id: "line", label: "📏 Doğru · Işın · Parça" },
      { id: "angle", label: "📐 Dinamik Açı" },
      { id: "frac", label: "🍕 Canlı Kesir & Yüzde" },
      { id: "parabola", label: "📈 Parabol & Grafik" }
    ];

    function buildMissionPanel(missions, doneSet) {
      return '<div class="ks-mission-box">' +
        '<div class="ks-mission-head">🎯 Keşif Görevleri (' + doneSet.size + '/' + missions.length + ')</div>' +
        '<p style="margin:0 0 12px;font-size:0.86rem;color:#64748B;">Soldaki kaydırıcıyı oynatarak aşağıdaki tüm keşif hedeflerini yakala!</p>' +
        '<div style="display:grid;gap:10px;">' +
          missions.map(function (m) {
            var ok = doneSet.has(m.id);
            return '<div class="ks-mission-item' + (ok ? ' done' : '') + '">' +
              '<span>' + (ok ? '✅' : '⬜') + ' ' + esc(m.text) + '</span>' +
              (ok ? '<strong style="color:#059669;">+10 XP</strong>' : '') +
            '</div>';
          }).join("") +
        '</div>' +
        (doneSet.size === missions.length
          ? '<div class="ks-mission-win">🎉 Tüm keşif görevlerini tamamladın! Diğer deneye geçebilirsin.</div>'
          : '') +
      '</div>';
    }

    function renderActiveExperiment() {
      var tabsHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
        expTabs.map(function (tb) {
          var isAct = tb.id === activeExp;
          return '<button type="button" data-exp-tab="' + tb.id + '" style="padding:8px 14px;border-radius:10px;border:1.5px solid ' + (isAct ? '#0F172A' : '#E2DDD5') + ';background:' + (isAct ? '#0F172A' : '#FFFFFF') + ';color:' + (isAct ? '#FDE68A' : '#0F172A') + ';font-size:13px;font-weight:800;cursor:pointer;">' + tb.label + '</button>';
        }).join("") +
      '</div>';

      var mountHost = function (innerHtml) {
        container.innerHTML = tabsHtml + innerHtml;
        container.querySelectorAll("[data-exp-tab]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeExp = btn.dataset.expTab;
            playTone("click");
            renderActiveExperiment();
          });
        });
      };

      if (activeExp === "angle") {
        var deg = 65, doneM = new Set();
        var missions = [
          { id: "dar", text: "Dar açı oluştur (0° < α < 90°)" },
          { id: "dik", text: "Tam 90° Dik Açı yakala" },
          { id: "genis", text: "Geniş açı oluştur (90° < α < 180°)" },
          { id: "dogru", text: "Tam 180° Doğru Açı yakala" }
        ];
        mountHost(
          '<div class="ks-disc-2col">' +
            '<div class="ks-card">' +
              '<div class="ks-head">📐 Dinamik Açı Laboratuvarı</div>' +
              '<p class="ks-sub">Kaydırıcıyı hareket ettirerek açının <strong>Dar → Dik → Geniş → Doğru</strong> açıya dönüşümünü canlı keşfet.</p>' +
              '<div data-disc-svg></div>' +
              '<div class="ks-slider-row"><span>Açı Ölçüsü: <strong data-disc-val>65°</strong></span><input type="range" min="10" max="180" step="5" value="65" data-disc-rng style="width:220px;accent-color:#D97706;"></div>' +
            '</div>' +
            '<div data-disc-missions></div>' +
          '</div>'
        );
        var drawAngle = function () {
          if (deg < 90) doneM.add("dar");
          if (deg === 90) doneM.add("dik");
          if (deg > 90 && deg < 180) doneM.add("genis");
          if (deg === 180) doneM.add("dogru");
          var rad = (deg * Math.PI) / 180;
          var cx = deg > 110 ? 240 : 155, cy = 205, len = 152;
          var x2 = cx + len * Math.cos(rad), y2 = cy - len * Math.sin(rad);
          var kind = deg < 90 ? "Dar Açı" : (deg === 90 ? "Dik Açı" : (deg < 180 ? "Geniş Açı" : "Doğru Açı"));
          var arc = deg === 90
            ? '<rect x="' + cx + '" y="' + (cy - 26) + '" width="26" height="26" fill="rgba(217,119,6,0.22)" stroke="#D97706" stroke-width="2.2"/>'
            : '<path d="M ' + cx + ' ' + cy + ' L ' + (cx + 48) + ' ' + cy + ' A 48 48 0 0 0 ' + (cx + 48 * Math.cos(rad)).toFixed(1) + ' ' + (cy - 48 * Math.sin(rad)).toFixed(1) + ' Z" fill="rgba(217,119,6,0.22)" stroke="#D97706" stroke-width="2.2"/>';
          container.querySelector("[data-disc-svg]").innerHTML =
            '<svg viewBox="0 0 460 242" style="width:100%;max-width:560px;height:auto;display:block;margin:0 auto;">' +
              '<rect width="460" height="242" rx="14" fill="#FAF8F5" stroke="#E2DDD5" stroke-width="1.5"/>' + arc +
              '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + len) + '" y2="' + cy + '" stroke="#0F172A" stroke-width="3.6" stroke-linecap="round"/>' +
              '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#2563EB" stroke-width="3.6" stroke-linecap="round"/>' +
              '<circle cx="' + cx + '" cy="' + cy + '" r="5.5" fill="#0F172A"/>' +
              '<text x="230" y="34" text-anchor="middle" font-size="15" font-weight="800" fill="#0F172A">' + deg + '° — ' + kind + '</text>' +
            '</svg>';
          container.querySelector("[data-disc-val]").textContent = deg + "° (" + kind + ")";
          container.querySelector("[data-disc-missions]").innerHTML = buildMissionPanel(missions, doneM);
        };
        drawAngle();
        container.querySelector("[data-disc-rng]").addEventListener("input", function (e) { deg = Number(e.target.value); drawAngle(); });
        return;
      }

      if (activeExp === "frac") {
        var pay = 3, payda = 8, doneF = new Set();
        var fMissions = [
          { id: "yarim", text: "Tam yarım (%50) kesir oluştur (örn. 4/8)" },
          { id: "ceyrek", text: "Çeyrek (%25) kesir oluştur (örn. 2/8)" },
          { id: "butun", text: "Tam bütün (%100) kesir oluştur" }
        ];
        mountHost(
          '<div class="ks-disc-2col">' +
            '<div class="ks-card">' +
              '<div class="ks-head">🍕 Canlı Kesir &amp; Yüzde Laboratuvarı</div>' +
              '<p class="ks-sub">Pay ve paydayı kaydırarak kesir dilimlerini ve yüzdelik karşılığını anında gör.</p>' +
              '<div data-disc-svg></div>' +
              '<div class="ks-slider-row"><span>Model: <strong data-disc-val>3/8</strong></span><label>Pay: <input type="range" min="1" max="12" value="3" data-f-pay></label><label>Payda: <input type="range" min="2" max="12" value="8" data-f-payda></label></div>' +
            '</div>' +
            '<div data-disc-missions></div>' +
          '</div>'
        );
        var drawFrac = function () {
          if (pay > payda) pay = payda;
          var ratio = pay / payda;
          if (Math.abs(ratio - 0.5) < 0.01) doneF.add("yarim");
          if (Math.abs(ratio - 0.25) < 0.01) doneF.add("ceyrek");
          if (Math.abs(ratio - 1) < 0.01) doneF.add("butun");
          container.querySelector("[data-disc-svg]").innerHTML = global.VisualMathEngine
            ? global.VisualMathEngine.render("sayi_dogrusu_kesir", { alt_tip: "kesir_daire", pay: pay, payda: payda }, "Kesir Keşif Modeli (" + pay + "/" + payda + ")")
            : "";
          container.querySelector("[data-disc-val]").textContent = pay + "/" + payda + " (≈ %" + Math.round(ratio * 100) + ")";
          container.querySelector("[data-disc-missions]").innerHTML = buildMissionPanel(fMissions, doneF);
        };
        drawFrac();
        container.querySelector("[data-f-pay]").addEventListener("input", function (e) { pay = Number(e.target.value); drawFrac(); });
        container.querySelector("[data-f-payda]").addEventListener("input", function (e) { payda = Number(e.target.value); drawFrac(); });
        return;
      }

      if (activeExp === "parabola") {
        var a = 1, c = -2, doneP = new Set(["up"]);
        var pMissions = [
          { id: "up", text: "Kolları yukarı bakan parabol (a > 0)" },
          { id: "down", text: "Kolları aşağı bakan parabol (a < 0)" },
          { id: "origin", text: "Orijinden geçen parabol yakala (c = 0)" }
        ];
        mountHost(
          '<div class="ks-disc-2col">' +
            '<div class="ks-card">' +
              '<div class="ks-head">📈 Dinamik Parabol &amp; Grafik Laboratuvarı</div>' +
              '<p class="ks-sub">a ve c katsayılarını değiştirerek parabolün yönünü ve y-ekseni kesişimini gözlemle.</p>' +
              '<div data-disc-svg></div>' +
              '<div class="ks-slider-row"><span>Denklem: <strong data-disc-val>y = x² - 2</strong></span><label>a: <input type="range" min="-2" max="2" step="0.5" value="1" data-p-a></label><label>c: <input type="range" min="-4" max="4" step="1" value="-2" data-p-c></label></div>' +
            '</div>' +
            '<div data-disc-missions></div>' +
          '</div>'
        );
        var drawFn = function () {
          if (a === 0) a = 0.5;
          if (a > 0) doneP.add("up");
          if (a < 0) doneP.add("down");
          if (c === 0) doneP.add("origin");
          var eq = "y = " + a + "x² " + (c >= 0 ? "+ " + c : c);
          container.querySelector("[data-disc-svg]").innerHTML = global.VisualMathEngine
            ? global.VisualMathEngine.render("fonksiyon_grafik", { alt_tip: "parabol", a: a, b: 0, c: c, etiket: eq }, "Dinamik Parabol Keşfi")
            : "";
          container.querySelector("[data-disc-val]").textContent = eq;
          container.querySelector("[data-disc-missions]").innerHTML = buildMissionPanel(pMissions, doneP);
        };
        drawFn();
        container.querySelector("[data-p-a]").addEventListener("input", function (e) { a = Number(e.target.value); drawFn(); });
        container.querySelector("[data-p-c]").addEventListener("input", function (e) { c = Number(e.target.value); drawFn(); });
        return;
      }

      // Temel Geometri: Doğru Parçası -> Işın -> Doğru
      var ext = 0, doneL = new Set(["seg"]);
      var lMissions = [
        { id: "seg", text: "0 uç uzat: Doğru Parçası [AB] incele" },
        { id: "ray", text: "1 uç uzat: Işın [AB oluştur" },
        { id: "line", text: "2 uç uzat: Doğru AB oluştur" }
      ];
      var labels = [
        { id: "seg", ad: "Doğru Parçası [AB]", aciklama: "İki ucu da kapalı ve sınırlıdır; cetvelle uzunluğu ölçülebilir.", tip: "dogru_parcasi" },
        { id: "ray", ad: "Işın [AB", aciklama: "A noktasından başlar, B yönünde sonsuza kadar uzar (el feneri ışığı gibi).", tip: "isin" },
        { id: "line", ad: "Doğru AB", aciklama: "Her iki ucu da sınırsız şekilde sonsuza uzar; uzunluğu ölçülemez.", tip: "dogru" }
      ];
      mountHost(
        '<div class="ks-disc-2col">' +
          '<div class="ks-card">' +
            '<div class="ks-head">📏 Uçları Uzatarak Şekli Dönüştür!</div>' +
            '<p class="ks-sub">Kaydırıcıyı <strong>0, 1 ve 2</strong> konumlarına getirerek Doğru Parçası, Işın ve Doğru farkını keşfet.</p>' +
            '<div data-disc-svg></div>' +
            '<div class="ks-slider-row"><span>Durum: <strong data-disc-val>0 uç uzatıldı</strong></span><input type="range" min="0" max="2" step="1" value="0" data-disc-ext style="width:200px;accent-color:#D97706;"></div>' +
            '<div class="ks-note" data-disc-desc></div>' +
          '</div>' +
          '<div data-disc-missions></div>' +
        '</div>'
      );
      var drawLine = function () {
        var cur = labels[ext];
        doneL.add(cur.id);
        container.querySelector("[data-disc-svg]").innerHTML = global.VisualMathEngine
          ? global.VisualMathEngine.render("geometri", { alt_tip: cur.tip, nokta1: "A", nokta2: "B", dogru_adi: "d" }, cur.ad)
          : "";
        container.querySelector("[data-disc-val]").textContent = ext + " uç uzatıldı → " + cur.ad;
        container.querySelector("[data-disc-desc]").textContent = cur.aciklama;
        container.querySelector("[data-disc-missions]").innerHTML = buildMissionPanel(lMissions, doneL);
      };
      drawLine();
      container.querySelector("[data-disc-ext]").addEventListener("input", function (e) { ext = Number(e.target.value); playTone("step"); drawLine(); });
    }

    renderActiveExperiment();
  }

  /* ========================================================================
     İSTASYON 3: 🧩 KAVRAMA ETKİNLİĞİ (ÇOK TURLU · BÜYÜK FONT · ALKIŞLAYAN ÇOCUK)
     ======================================================================== */
  function renderMatchingGame(container, flashcards, topicTitle) {
    if (!container) return;
    var allPairs = Array.isArray(flashcards) && flashcards.length >= 2
      ? flashcards.map(function (fc, i) { return { id: i, left: fc.front, right: fc.back }; })
      : [
          { id: 0, left: "Doğru Parçası [AB]", right: "İki ucu sınırlı, cetvelle uzunluğu ölçülebilir." },
          { id: 1, left: "Işın [AB", right: "Bir ucu sabit, diğer ucu sonsuza kadar uzar." },
          { id: 2, left: "Dik Açı (90°)", right: "İki doğrunun dik kesişmesiyle oluşan açıdır." },
          { id: 3, left: "Paralel Doğrular (∥)", right: "Aralarındaki mesafe değişmez, hiç kesişmezler." },
          { id: 4, left: "Dar Açı (< 90°)", right: "Ölçüsü 0° ile 90° arasında olan açıdır." }
        ];

    var ROUND_SIZE = 5;
    var totalRounds = Math.max(1, Math.ceil(allPairs.length / ROUND_SIZE));
    var currentRound = 0;

    function getRoundPairs() {
      var start = currentRound * ROUND_SIZE;
      return allPairs.slice(start, start + ROUND_SIZE);
    }

    var pairs = getRoundPairs();
    var rightShuffled = pairs.slice().sort(function () { return Math.random() - 0.5; });
    var selectedLeft = null;
    var matchedIds = new Set();
    var mistakes = 0;
    var PRAISE_WORDS = ["Harikasın!", "Başardın!", "Mükemmel!"];
    var praiseIdx = 0;
    var praiseTimer = null;
    var mascotMood = "idle";
    var mascotWord = PRAISE_WORDS[0];
    var mascotMsg = "Soldan bir kavram seç, sonra sağdan doğru eşini bul! Sen yaparsın!";

    function stopPraiseCycle() {
      if (praiseTimer) { clearInterval(praiseTimer); praiseTimer = null; }
    }

    function startPraiseCycle() {
      stopPraiseCycle();
      praiseTimer = setInterval(function () {
        praiseIdx = (praiseIdx + 1) % PRAISE_WORDS.length;
        mascotWord = PRAISE_WORDS[praiseIdx];
        var pill = container.querySelector("[data-ks-word-pill]");
        var head = container.querySelector("[data-ks-praise-head]");
        if (pill) {
          pill.textContent = mascotWord;
          pill.classList.remove("ks-word-pop");
          void pill.offsetWidth;
          pill.classList.add("ks-word-pop");
        }
        if (head && mascotMood !== "idle") {
          head.textContent = "👏 " + mascotWord;
        }
      }, 1500);
    }

    function draw() {
      var done = matchedIds.size === pairs.length;
      var hasNextRound = currentRound < totalRounds - 1;
      var pct = Math.round((matchedIds.size / pairs.length) * 100);
      var confettiHtml = done
        ? '<div class="ks-confetti-wrap">' + Array.from({ length: 24 }).map(function (_, i) {
            var colors = ["#D97706", "#059669", "#2563EB", "#DC2626", "#7C3AED"];
            return '<span class="ks-confetti-piece" style="left:' + (2 + i * 4.1) + '%;background:' + colors[i % colors.length] + ';animation-delay:' + ((i % 6) * 0.1) + 's;"></span>';
          }).join("") + '</div>'
        : '';

      container.innerHTML =
        '<div class="ks-card" style="position:relative;overflow:hidden;">' +
          confettiHtml +
          '<div class="ks-head-row">' +
            '<div class="ks-head" style="font-size:1.22rem;">🧩 Kavrama &amp; Eşleştirme Etkinliği' + (totalRounds > 1 ? (' <span class="ks-pill" style="margin-left:6px;background:#0F172A;color:#FDE68A;">Tur ' + (currentRound + 1) + ' / ' + totalRounds + '</span>') : '') + '</div>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
              '<span class="ks-pill" style="background:#FEF3C7;color:#92400E;">⭐ +' + (matchedIds.size * 10) + ' XP</span>' +
              '<span class="ks-pill">' + matchedIds.size + ' / ' + pairs.length + ' Eşleşti (Toplam ' + allPairs.length + ' Kavram)</span>' +
            '</div>' +
          '</div>' +
          '<div style="height:10px;border-radius:999px;background:#FAF8F5;border:1px solid #E2DDD5;overflow:hidden;margin:10px 0 16px;">' +
            '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#0F172A,#D97706);transition:width .3s ease;"></div>' +
          '</div>' +

          '<div class="ks-match-grid">' +
            '<div class="ks-match-col">' +
              pairs.map(function (p, i) {
                var cls = "ks-m-item ks-m-lg" + (matchedIds.has(p.id) ? " matched" : (selectedLeft === p.id ? " active" : ""));
                return '<button type="button" class="' + cls + '" data-m-left="' + p.id + '"' + (matchedIds.has(p.id) ? ' disabled' : '') + '>' +
                  '<span class="ks-m-num">' + (currentRound * ROUND_SIZE + i + 1) + '</span><span>' + fmtMath(p.left) + '</span>' +
                '</button>';
              }).join("") +
            '</div>' +
            '<div class="ks-match-col">' +
              rightShuffled.map(function (p) {
                var cls = "ks-m-item ks-m-lg" + (matchedIds.has(p.id) ? " matched" : "");
                return '<button type="button" class="' + cls + '" data-m-right="' + p.id + '"' + (matchedIds.has(p.id) ? ' disabled' : '') + '>' +
                  '<span>' + fmtMath(p.right) + '</span>' +
                '</button>';
              }).join("") +
            '</div>' +
          '</div>' +

          '<div class="ks-mascot-stage' + (done ? ' is-celebrating' : (mascotMood === 'clap' ? ' is-clapping' : '')) + '">' +
            buildMascotSvg(done ? "celebrate" : mascotMood, mascotWord) +
            '<div class="ks-mascot-speech">' +
              '<strong data-ks-praise-head style="font-size:1.3rem;">' + (done ? ('🎉 ' + mascotWord + ' (+' + (pairs.length * 10) + ' XP)') : (mascotMood === 'clap' ? ('👏 ' + mascotWord) : '🧭 Zarif Rehber')) + '</strong>' +
              '<p style="font-size:1.02rem;">' + esc(done ? ('Bu turdaki tüm ' + pairs.length + ' kavramı ' + (mistakes === 0 ? 'sıfır hatayla' : mistakes + ' deneme ile') + ' başarıyla eşleştirdin! Alkışlar sana!') : mascotMsg) + '</p>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">' +
                (done && hasNextRound ? '<button type="button" class="ks-btn-navy" style="padding:10px 18px;font-size:0.95rem;" data-m-next-round>➡️ Sonraki Tur (' + (currentRound + 2) + '/' + totalRounds + ')</button>' : '') +
                (done ? '<button type="button" class="ks-btn-amber" style="padding:10px 18px;font-size:0.95rem;" data-m-reset>🔁 Baştan Oyna</button>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      if (mascotMood === "clap" || done) startPraiseCycle();
      else stopPraiseCycle();

      container.querySelector("[data-m-next-round]")?.addEventListener("click", function () {
        stopPraiseCycle();
        currentRound += 1;
        pairs = getRoundPairs();
        rightShuffled = pairs.slice().sort(function () { return Math.random() - 0.5; });
        matchedIds.clear();
        selectedLeft = null;
        mascotMood = "idle";
        mascotMsg = "Tur " + (currentRound + 1) + " başladı! Yeni kavramları eşleştir.";
        playTone("step");
        draw();
      });

      container.querySelector("[data-m-reset]")?.addEventListener("click", function () {
        stopPraiseCycle();
        currentRound = 0;
        pairs = getRoundPairs();
        matchedIds.clear();
        selectedLeft = null;
        mistakes = 0;
        praiseIdx = 0;
        mascotWord = PRAISE_WORDS[0];
        mascotMood = "idle";
        mascotMsg = "Yeni tur başladı! Soldan bir kavram seçerek devam et.";
        rightShuffled = pairs.slice().sort(function () { return Math.random() - 0.5; });
        draw();
      });

      container.querySelectorAll("[data-m-left]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          selectedLeft = Number(btn.dataset.mLeft);
          mascotMood = "idle";
          mascotMsg = "Güzel! Şimdi sağ sütundan bu kavramın doğru açıklamasını seç.";
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
            mascotWord = PRAISE_WORDS[(matchedIds.size - 1) % PRAISE_WORDS.length];
            praiseIdx = (matchedIds.size - 1) % PRAISE_WORDS.length;
            mascotMood = matchedIds.size === pairs.length ? "celebrate" : "clap";
            mascotMsg = mascotWord + " Doğru eşleştirmeyi buldun, böyle devam et!";
            playApplause();
            playTone(matchedIds.size === pairs.length ? "victory" : "match");
            draw();
          } else {
            mistakes += 1;
            mascotMood = "idle";
            mascotMsg = "Az kaldı! İki ifadeyi tekrar okuyup yeniden dene, yapabilirsin.";
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
