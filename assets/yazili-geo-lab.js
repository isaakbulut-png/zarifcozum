/* ==========================================================================
   ZarifÇözüm — İnteraktif Geometri & Matematik Laboratuvarı (yazili-geo-lab.js)
   3 Gerçek Etkileşimli Araç:
     1. "aciolcer" -> Sürüklenebilir & Döndürülebilir 0°-180° İletki
     2. "pergel"   -> Yarıçap Ayarlı İnteraktif Pergel & Çember Çizici
     3. "cokgen"   -> Tıklamalı Çokgen & Köşegen Çizim Tahtası
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

  function playTone(kind) {
    if (global.ZarifYaziliSound && typeof global.ZarifYaziliSound.play === "function") {
      global.ZarifYaziliSound.play(kind);
    }
  }

  /* ========================================================================
     1. SÜRÜKLENEBİLİR & DÖNDÜRÜLEBİLİR AÇIÖLÇER (İLETKİ)
     ======================================================================== */
  function mountProtractorLab(container, cfg, onInteract) {
    var deg = Math.max(15, Math.min(175, Number(cfg.hedefAci) || 65));
    var kose = esc(cfg.kose || "B");
    var kol1 = esc(cfg.kol1 || "A");
    var kol2 = esc(cfg.kol2 || "C");
    var guideText = cfg.rehber || ("Açıölçeri sürükleyerek merkezindeki (+) işaretini " + kose + " köşesine yerleştir. Döndürme düğmeleriyle 0° çizgisini ışınla çakıştır ve dereceyi oku.");

    // Köşe koordinatları
    var vx = deg > 110 ? 235 : 145;
    var vy = 225;
    var rayLen = 148;
    var rad = (deg * Math.PI) / 180;
    var x2 = vx + rayLen * Math.cos(rad);
    var y2 = vy - rayLen * Math.sin(rad);

    // İletki başlangıç konumu (köşeden biraz uzakta ki öğrenci sürüklesin)
    var st = { px: 280, py: 265, rot: 0, dragging: false, dx: 0, dy: 0 };

    // 0°-180° iletki SVG çizimi (merkez 0,0)
    var R = 118;
    var ticks = "";
    for (var d = 0; d <= 180; d += 5) {
      var rRad = (d * Math.PI) / 180;
      var maj = d % 10 === 0;
      var rIn = maj ? R - 13 : R - 7;
      ticks += '<line x1="' + (R * Math.cos(rRad)).toFixed(1) + '" y1="' + (-R * Math.sin(rRad)).toFixed(1) + '" x2="' + (rIn * Math.cos(rRad)).toFixed(1) + '" y2="' + (-rIn * Math.sin(rRad)).toFixed(1) + '" stroke="' + (maj ? "#0F172A" : "#64748B") + '" stroke-width="' + (maj ? 1.4 : 0.8) + '"/>';
      if (d % 20 === 0 || d === 90) {
        var rL = R - 24;
        ticks += '<text x="' + (rL * Math.cos(rRad)).toFixed(1) + '" y="' + (-rL * Math.sin(rRad) + 3.5).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="800" fill="' + (d === 90 ? "#D97706" : "#334155") + '">' + d + '°</text>';
      }
    }

    var grid = "";
    for (var gx = 20; gx <= 460; gx += 22) grid += '<line x1="' + gx + '" y1="16" x2="' + gx + '" y2="296" stroke="#ECE6DC" stroke-width="1"/>';
    for (var gy = 16; gy <= 296; gy += 22) grid += '<line x1="20" y1="' + gy + '" x2="460" y2="' + gy + '" stroke="#ECE6DC" stroke-width="1"/>';

    container.innerHTML =
      '<div class="yz-geo-card">' +
        '<div class="yz-geo-topbar">' +
          '<span class="yz-geo-badge">📐 İnteraktif Açıölçer (İletki)</span>' +
          '<button type="button" class="yz-geo-help-btn" data-geo-help>💡 Ne yapmalıyım?</button>' +
        '</div>' +
        '<div class="yz-geo-guide" data-geo-guide style="display:none;">' +
          '<strong>Sıradaki Adım:</strong> ' + esc(guideText) +
          '<button type="button" class="yz-geo-guide-ok" data-geo-guide-ok>Anladım</button>' +
        '</div>' +
        '<div class="yz-geo-stage">' +
          '<svg class="yz-geo-svg" viewBox="0 0 480 310" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="480" height="310" rx="12" fill="#FAF8F5"/>' +
            grid +
            // Hedef açı ışınları
            '<line x1="' + vx + '" y1="' + vy + '" x2="' + (vx + rayLen) + '" y2="' + vy + '" stroke="#0F172A" stroke-width="3.2" stroke-linecap="round"/>' +
            '<line x1="' + vx + '" y1="' + vy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#2563EB" stroke-width="3.2" stroke-linecap="round"/>' +
            '<circle cx="' + vx + '" cy="' + vy + '" r="5" fill="#0F172A"/>' +
            '<text x="' + (vx - 14) + '" y="' + (vy + 16) + '" font-size="14" font-weight="800" fill="#0F172A">' + kose + '</text>' +
            '<text x="' + (vx + rayLen + 10) + '" y="' + (vy + 5) + '" font-size="14" font-weight="800" fill="#0F172A">' + kol1 + '</text>' +
            '<text x="' + (x2 + 12 * Math.cos(rad)).toFixed(1) + '" y="' + (y2 - 12 * Math.sin(rad) + 4).toFixed(1) + '" font-size="14" font-weight="800" fill="#2563EB">' + kol2 + '</text>' +
            // Sürüklenebilir iletki grubu
            '<g data-protractor style="cursor:grab;" transform="translate(' + st.px + ',' + st.py + ') rotate(' + st.rot + ')">' +
              '<path d="M ' + (-R) + ' 0 A ' + R + ' ' + R + ' 0 0 1 ' + R + ' 0 Z" fill="rgba(255,255,255,0.78)" stroke="#0F172A" stroke-width="2"/>' +
              '<path d="M ' + (-R * 0.56) + ' 0 A ' + (R * 0.56) + ' ' + (R * 0.56) + ' 0 0 1 ' + (R * 0.56) + ' 0 Z" fill="rgba(250,248,245,0.55)" stroke="#CBD5E1" stroke-width="1"/>' +
              '<line x1="' + (-R) + '" y1="0" x2="' + R + '" y2="0" stroke="#D97706" stroke-width="1.6"/>' +
              '<line x1="0" y1="0" x2="0" y2="' + (-R + 28) + '" stroke="#CBD5E1" stroke-dasharray="4,3"/>' +
              ticks +
              '<circle cx="0" cy="0" r="6" fill="rgba(217,119,6,0.22)" stroke="#D97706" stroke-width="2"/>' +
              '<line x1="-6" y1="0" x2="6" y2="0" stroke="#D97706" stroke-width="2"/>' +
              '<line x1="0" y1="-6" x2="0" y2="6" stroke="#D97706" stroke-width="2"/>' +
            '</g>' +
          '</svg>' +
        '</div>' +
        '<div class="yz-geo-controls">' +
          '<div class="yz-geo-btn-group">' +
            '<button type="button" class="yz-geo-ctrl" data-rot="-5">↺ -5°</button>' +
            '<button type="button" class="yz-geo-ctrl" data-rot="-1">↺ -1°</button>' +
            '<button type="button" class="yz-geo-ctrl" data-rot="1">↻ +1°</button>' +
            '<button type="button" class="yz-geo-ctrl" data-rot="5">↻ +5°</button>' +
            '<button type="button" class="yz-geo-ctrl yz-geo-snap" data-snap>🎯 Köşeye Hizala</button>' +
          '</div>' +
          '<button type="button" class="yz-geo-ctrl" data-reset>↩ Sıfırla</button>' +
        '</div>' +
      '</div>';

    var svg = container.querySelector(".yz-geo-svg");
    var prot = container.querySelector("[data-protractor]");
    var guide = container.querySelector("[data-geo-guide]");

    function updateTransform() {
      prot.setAttribute("transform", "translate(" + st.px.toFixed(1) + "," + st.py.toFixed(1) + ") rotate(" + st.rot + ")");
    }

    function clientToSvg(evt) {
      var pt = svg.createSVGPoint();
      var src = evt.touches ? evt.touches[0] : evt;
      pt.x = src.clientX;
      pt.y = src.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    function onStart(evt) {
      evt.preventDefault();
      var p = clientToSvg(evt);
      st.dragging = true;
      st.dx = p.x - st.px;
      st.dy = p.y - st.py;
      prot.style.cursor = "grabbing";
    }

    function onMove(evt) {
      if (!st.dragging) return;
      evt.preventDefault();
      var p = clientToSvg(evt);
      st.px = Math.max(40, Math.min(440, p.x - st.dx));
      st.py = Math.max(60, Math.min(290, p.y - st.dy));
      // Köşeye yaklaşınca yumuşak mıknatıs (snap)
      if (Math.hypot(st.px - vx, st.py - vy) < 16) {
        st.px = vx;
        st.py = vy;
      }
      updateTransform();
    }

    function onEnd() {
      if (!st.dragging) return;
      st.dragging = false;
      prot.style.cursor = "grab";
      if (Math.hypot(st.px - vx, st.py - vy) < 4) {
        playTone("snap");
        if (onInteract) onInteract({ aligned: true });
      }
    }

    prot.addEventListener("mousedown", onStart);
    prot.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);

    container.querySelectorAll("[data-rot]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        st.rot = (st.rot + Number(btn.dataset.rot)) % 360;
        updateTransform();
        playTone("click");
      });
    });

    container.querySelector("[data-snap]")?.addEventListener("click", function () {
      st.px = vx;
      st.py = vy;
      st.rot = 0;
      updateTransform();
      playTone("snap");
      if (onInteract) onInteract({ aligned: true });
    });

    container.querySelector("[data-reset]")?.addEventListener("click", function () {
      st.px = 280;
      st.py = 265;
      st.rot = 0;
      updateTransform();
      playTone("click");
    });

    container.querySelector("[data-geo-help]")?.addEventListener("click", function () {
      guide.style.display = guide.style.display === "none" ? "flex" : "none";
      playTone("click");
    });
    container.querySelector("[data-geo-guide-ok]")?.addEventListener("click", function () {
      guide.style.display = "none";
      playTone("click");
    });
  }

  /* ========================================================================
     2. İNTERAKTİF PERGEL & ÇEMBER ÇİZİCİ
     ======================================================================== */
  function mountCompassLab(container, cfg, onDrawComplete) {
    var targetCm = Number(cfg.hedefYaricap) || 3;
    var merkezAd = esc(cfg.merkez || "B");
    var refLen = Number(cfg.referansUzunluk) || 3;
    var pxPerCm = 28;
    var cx = 290, cy = 158;
    var st = { radiusCm: 1.5, drawnCircles: [] };

    var grid = "";
    for (var gx = 20; gx <= 460; gx += pxPerCm) grid += '<line x1="' + gx + '" y1="16" x2="' + gx + '" y2="296" stroke="#ECE6DC" stroke-width="1"/>';
    for (var gy = 16; gy <= 296; gy += pxPerCm) grid += '<line x1="20" y1="' + gy + '" x2="460" y2="' + gy + '" stroke="#ECE6DC" stroke-width="1"/>';

    var refX1 = 48, refX2 = 48 + refLen * pxPerCm, refY = 250;

    container.innerHTML =
      '<div class="yz-geo-card">' +
        '<div class="yz-geo-topbar">' +
          '<span class="yz-geo-badge">🧭 İnteraktif Pergel &amp; Çember Çizici</span>' +
          '<button type="button" class="yz-geo-help-btn" data-geo-help>💡 Ne yapmalıyım?</button>' +
        '</div>' +
        '<div class="yz-geo-guide" data-geo-guide style="display:none;">' +
          '<strong>Sıradaki Adım:</strong> Pergel açıklığını kaydırıcı ile ' + targetCm + ' cm olacak şekilde ayarla ve "Çemberi Çiz" butonuna bas.' +
          '<button type="button" class="yz-geo-guide-ok" data-geo-guide-ok>Anladım</button>' +
        '</div>' +
        '<div class="yz-geo-stage">' +
          '<svg class="yz-geo-svg" viewBox="0 0 480 310" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="480" height="310" rx="12" fill="#FAF8F5"/>' +
            grid +
            // Referans doğru parçası KL
            '<line x1="' + refX1 + '" y1="' + refY + '" x2="' + refX2 + '" y2="' + refY + '" stroke="#0F172A" stroke-width="3"/>' +
            '<circle cx="' + refX1 + '" cy="' + refY + '" r="4.5" fill="#0F172A"/>' +
            '<circle cx="' + refX2 + '" cy="' + refY + '" r="4.5" fill="#0F172A"/>' +
            '<text x="' + refX1 + '" y="' + (refY - 10) + '" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">K</text>' +
            '<text x="' + refX2 + '" y="' + (refY - 10) + '" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">L</text>' +
            '<text x="' + ((refX1 + refX2) / 2) + '" y="' + (refY + 18) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#D97706">' + refLen + ' cm</text>' +
            // Çizilen çemberler grubu
            '<g data-drawn-circles></g>' +
            // Pergel önizleme kolu
            '<g data-compass-preview></g>' +
            // Merkez B noktası
            '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#0F172A" stroke="#FFFFFF" stroke-width="2"/>' +
            '<text x="' + (cx - 14) + '" y="' + (cy - 8) + '" font-size="14" font-weight="800" fill="#0F172A">' + merkezAd + '</text>' +
          '</svg>' +
        '</div>' +
        '<div class="yz-geo-controls">' +
          '<label class="yz-geo-slider-wrap">Pergel açıklığı: <strong data-radius-readout>1.5 cm</strong>' +
            '<input type="range" min="1" max="4.5" step="0.5" value="1.5" data-radius-slider>' +
          '</label>' +
          '<div class="yz-geo-btn-group">' +
            '<button type="button" class="yz-geo-ctrl yz-geo-primary" data-draw-circle>🔵 Çemberi Çiz</button>' +
            '<button type="button" class="yz-geo-ctrl" data-undo-circle>↩ Geri Al</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var previewG = container.querySelector("[data-compass-preview]");
    var drawnG = container.querySelector("[data-drawn-circles]");
    var slider = container.querySelector("[data-radius-slider]");
    var readout = container.querySelector("[data-radius-readout]");
    var guide = container.querySelector("[data-geo-guide]");

    function renderCompassPreview() {
      var rPx = st.radiusCm * pxPerCm;
      previewG.innerHTML =
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + rPx.toFixed(1) + '" fill="none" stroke="#D97706" stroke-width="1.6" stroke-dasharray="5,4"/>' +
        '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + rPx).toFixed(1) + '" y2="' + cy + '" stroke="#D97706" stroke-width="2.4"/>' +
        '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + rPx / 2).toFixed(1) + '" y2="' + (cy - 54) + '" stroke="#334155" stroke-width="3"/>' +
        '<line x1="' + (cx + rPx).toFixed(1) + '" y1="' + cy + '" x2="' + (cx + rPx / 2).toFixed(1) + '" y2="' + (cy - 54) + '" stroke="#334155" stroke-width="3"/>' +
        '<circle cx="' + (cx + rPx / 2).toFixed(1) + '" cy="' + (cy - 54) + '" r="6" fill="#0F172A" stroke="#D97706" stroke-width="2"/>';
    }

    function renderDrawn() {
      drawnG.innerHTML = st.drawnCircles.map(function (c) {
        var rPx = c * pxPerCm;
        return '<circle cx="' + cx + '" cy="' + cy + '" r="' + rPx.toFixed(1) + '" fill="rgba(37,99,235,0.08)" stroke="#2563EB" stroke-width="2.8"/>' +
          '<text x="' + (cx + rPx / 2) + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="11.5" font-weight="800" fill="#2563EB">r = ' + c + ' cm</text>';
      }).join("");
    }

    renderCompassPreview();

    slider.addEventListener("input", function () {
      st.radiusCm = Number(slider.value);
      readout.textContent = st.radiusCm.toFixed(1).replace(".0", "") + " cm";
      renderCompassPreview();
    });

    container.querySelector("[data-draw-circle]")?.addEventListener("click", function () {
      st.drawnCircles = [st.radiusCm];
      renderDrawn();
      playTone("draw");
      if (onDrawComplete) onDrawComplete({ radiusCm: st.radiusCm, matched: Math.abs(st.radiusCm - targetCm) < 0.05 });
    });

    container.querySelector("[data-undo-circle]")?.addEventListener("click", function () {
      st.drawnCircles.pop();
      renderDrawn();
      playTone("click");
    });

    container.querySelector("[data-geo-help]")?.addEventListener("click", function () {
      guide.style.display = guide.style.display === "none" ? "flex" : "none";
      playTone("click");
    });
    container.querySelector("[data-geo-guide-ok]")?.addEventListener("click", function () {
      guide.style.display = "none";
      playTone("click");
    });
  }

  /* ========================================================================
     3. İNTERAKTİF ÇOKGEN & KÖŞEGEN ÇİZİM TAHTASI
     ======================================================================== */
  function mountPolygonLab(container, cfg, onDrawComplete) {
    var sides = Math.max(4, Math.min(7, Number(cfg.kenarSayisi) || 5));
    var labels = ["A", "B", "C", "D", "E", "F", "G"].slice(0, sides);
    var cx = 240, cy = 158, r = 98;
    var pts = labels.map(function (lbl, i) {
      var ang = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
      return { lbl: lbl, x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    });

    var st = { selectedIdx: null, segments: [], extendLines: false };

    container.innerHTML =
      '<div class="yz-geo-card">' +
        '<div class="yz-geo-topbar">' +
          '<span class="yz-geo-badge">⬠ İnteraktif Çokgen &amp; Köşegen Tahtası</span>' +
          '<button type="button" class="yz-geo-help-btn" data-geo-help>💡 Ne yapmalıyım?</button>' +
        '</div>' +
        '<div class="yz-geo-guide" data-geo-guide style="display:none;">' +
          '<strong>Sıradaki Adım:</strong> Köşegen çizmek için komşu olmayan iki köşeye sırayla dokun (ör. A ve C). "Doğruları Uzat" ile kenar doğrularını görebilirsin.' +
          '<button type="button" class="yz-geo-guide-ok" data-geo-guide-ok>Anladım</button>' +
        '</div>' +
        '<div class="yz-geo-stage">' +
          '<svg class="yz-geo-svg" viewBox="0 0 480 310" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="480" height="310" rx="12" fill="#FAF8F5"/>' +
            '<g data-ext-lines></g>' +
            '<polygon points="' + pts.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ") + '" fill="rgba(217,119,6,0.12)" stroke="#0F172A" stroke-width="2.6"/>' +
            '<g data-diagonals></g>' +
            '<g data-vertices></g>' +
          '</svg>' +
        '</div>' +
        '<div class="yz-geo-controls">' +
          '<div class="yz-geo-btn-group">' +
            '<button type="button" class="yz-geo-ctrl" data-extend>↔ Doğruları Uzat</button>' +
            '<button type="button" class="yz-geo-ctrl" data-clear-diag>🗑️ Çizdiklerimi Sil</button>' +
          '</div>' +
          '<button type="button" class="yz-geo-ctrl" data-undo-diag>↩ Geri Al</button>' +
        '</div>' +
      '</div>';

    var extG = container.querySelector("[data-ext-lines]");
    var diagG = container.querySelector("[data-diagonals]");
    var vertG = container.querySelector("[data-vertices]");
    var guide = container.querySelector("[data-geo-guide]");

    function renderAll() {
      // Uzatılmış kenar doğruları
      if (st.extendLines) {
        var ex = "";
        for (var i = 0; i < sides; i++) {
          var p1 = pts[i], p2 = pts[(i + 1) % sides];
          var dx = p2.x - p1.x, dy = p2.y - p1.y;
          ex += '<line x1="' + (p1.x - dx * 0.7).toFixed(1) + '" y1="' + (p1.y - dy * 0.7).toFixed(1) + '" x2="' + (p2.x + dx * 0.7).toFixed(1) + '" y2="' + (p2.y + dy * 0.7).toFixed(1) + '" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="5,4"/>';
        }
        extG.innerHTML = ex;
      } else {
        extG.innerHTML = "";
      }

      // Çizilen köşegenler
      diagG.innerHTML = st.segments.map(function (seg) {
        var a = pts[seg[0]], b = pts[seg[1]];
        return '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>';
      }).join("");

      // Tıklanabilir köşeler
      vertG.innerHTML = pts.map(function (p, idx) {
        var isSel = st.selectedIdx === idx;
        var lx = cx + (r + 22) * ((p.x - cx) / r);
        var ly = cy + (r + 22) * ((p.y - cy) / r) + 5;
        return '<g data-vidx="' + idx + '" style="cursor:pointer;">' +
          '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (isSel ? 10 : 7) + '" fill="' + (isSel ? "#D97706" : "#0F172A") + '" stroke="#FFFFFF" stroke-width="2.2"/>' +
          '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#0F172A">' + p.lbl + '</text>' +
        '</g>';
      }).join("");

      vertG.querySelectorAll("[data-vidx]").forEach(function (node) {
        node.addEventListener("click", function () {
          var idx = Number(node.getAttribute("data-vidx"));
          if (st.selectedIdx === null) {
            st.selectedIdx = idx;
            playTone("click");
          } else if (st.selectedIdx === idx) {
            st.selectedIdx = null;
          } else {
            var a = Math.min(st.selectedIdx, idx);
            var b = Math.max(st.selectedIdx, idx);
            var diff = b - a;
            var isAdjacent = diff === 1 || diff === sides - 1;
            if (!isAdjacent && !st.segments.some(function (s) { return s[0] === a && s[1] === b; })) {
              st.segments.push([a, b]);
              playTone("draw");
              if (onDrawComplete) {
                onDrawComplete({
                  diagonals: st.segments.map(function (s) { return labels[s[0]] + labels[s[1]]; })
                });
              }
            } else {
              playTone("click");
            }
            st.selectedIdx = null;
          }
          renderAll();
        });
      });
    }

    renderAll();

    container.querySelector("[data-extend]")?.addEventListener("click", function () {
      st.extendLines = !st.extendLines;
      renderAll();
      playTone("click");
    });
    container.querySelector("[data-clear-diag]")?.addEventListener("click", function () {
      st.segments = [];
      st.selectedIdx = null;
      renderAll();
      playTone("click");
    });
    container.querySelector("[data-undo-diag]")?.addEventListener("click", function () {
      st.segments.pop();
      renderAll();
      playTone("click");
    });
    container.querySelector("[data-geo-help]")?.addEventListener("click", function () {
      guide.style.display = guide.style.display === "none" ? "flex" : "none";
      playTone("click");
    });
    container.querySelector("[data-geo-guide-ok]")?.addEventListener("click", function () {
      guide.style.display = "none";
      playTone("click");
    });
  }

  function mount(container, question, onInteract) {
    if (!container || !question) return false;
    var tool = question.interaktifArac;
    if (tool && typeof tool === "object") {
      if (tool.tip === "aciolcer") { mountProtractorLab(container, tool, onInteract); return true; }
      if (tool.tip === "pergel") { mountCompassLab(container, tool, onInteract); return true; }
      if (tool.tip === "cokgen") { mountPolygonLab(container, tool, onInteract); return true; }
    }
    return false;
  }

  global.ZarifGeoLab = { mount: mount };
})(window);
