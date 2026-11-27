/* ==========================================================================
   ZarifÇözüm — Evrensel Matematik Görsel Motoru (VisualMathEngine.js — UMD)
   5–12. Sınıf TYMM, LGS ve YKS matematik kazanımları için parametrik,
   sıfır hatalı, ölçeklenebilir inline <svg> ve temiz HTML tablo motoru.

   Desteklenen 7 Görsel Türü:
     1. "geometri"           -> Açıölçer (0°-180° iletki), açı, üçgen, dörtgen, çember
     2. "sayi_dogrusu_kesir" -> Kesir (daire/dikdörtgen), sayı doğrusu, Venn şeması, bölük tablosu
     3. "fonksiyon_grafik"   -> X-Y koordinat düzlemi, doğru, parabol, trigonometri, eğri/integral
     4. "veri_grafigi"       -> Sütun, çizgi, daire grafiği
     5. "cebir_model"        -> Eşit kollu denklem terazisi, cebir karoları
     6. "tablo"              -> Gerçek sayısal veri karşılaştırması için temiz HTML tablosu
     7. "yok"                -> Boş döner (asla uydurma veri üretmez)

   Marka Paleti: #FAF8F5 (fildişi), #0F172A (gece mavisi), #D97706 (kehribar)
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var api = factory();
    root.VisualMathEngine = api;
    // Geriye dönük uyumluluk için ZarifVisualRenderer köprüsü
    root.ZarifVisualRenderer = api;
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  var COLORS = {
    ivory: '#FAF8F5',
    surface: '#FFFFFF',
    navy: '#0F172A',
    slate: '#334155',
    muted: '#64748B',
    border: '#E2DDD5',
    grid: '#E2E8F0',
    amber: '#D97706',
    amberSoft: 'rgba(217, 119, 6, 0.18)',
    blue: '#2563EB',
    blueSoft: 'rgba(37, 99, 235, 0.14)',
    emerald: '#059669',
    emeraldSoft: 'rgba(5, 150, 105, 0.14)',
    crimson: '#DC2626',
    crimsonSoft: 'rgba(220, 38, 38, 0.14)',
    violet: '#7C3AED'
  };

  var CHART_PALETTE = ['#2563EB', '#D97706', '#059669', '#7C3AED', '#DC2626', '#0F172A', '#0891B2'];

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(val, fallback) {
    var n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function parseParams(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') {
      var trimmed = raw.trim();
      if (!trimmed) return {};
      try {
        var parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (_) {
        return {};
      }
    }
    if (typeof raw === 'object') {
      if (raw.data && typeof raw.data === 'object') return raw.data;
      if (typeof raw.dataJson === 'string' && raw.dataJson.trim()) {
        return parseParams(raw.dataJson);
      }
      return raw;
    }
    return {};
  }

  function svgHeader(w, h, title) {
    var titleEl = title
      ? '<text x="' + (w / 2) + '" y="24" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(title) + '</text>'
      : '';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img" style="width:100%;max-width:' + w + 'px;height:auto;display:block;margin:0 auto;">' +
      '<rect width="' + w + '" height="' + h + '" rx="14" fill="' + COLORS.ivory + '" stroke="' + COLORS.border + '" stroke-width="1.5"/>' +
      titleEl;
  }

  /* ========================================================================
     1. GEOMETRİ: Açıölçer (0°-180°), Açı, Üçgen, Dörtgen, Çember
     ======================================================================== */
  function renderProtractor(p, title) {
    var cx = 240, cy = 228, R = 152;
    var startDeg = clamp(num(p.baslangic_derece != null ? p.baslangic_derece : p.startDeg, 0), 0, 179);
    var endDeg = p.bitis_derece != null
      ? clamp(num(p.bitis_derece, 65), 1, 180)
      : clamp(startDeg + num(p.aci_derece != null ? p.aci_derece : (p.derece != null ? p.derece : p.angle), 65), 1, 180);
    if (endDeg <= startDeg) endDeg = clamp(startDeg + 60, 1, 180);
    var measured = Math.round(endDeg - startDeg);

    var vertexLabel = esc(p.kose || p.vertex || 'O');
    var ray1Label = esc(p.kol1 || p.ray1 || 'A');
    var ray2Label = esc(p.kol2 || p.ray2 || 'B');
    var showMeasure = p.olcu_goster === true;

    var out = svgHeader(480, 272, title || 'Açıölçer (İletki) Modeli');

    // İletki yarım daire gövdesi
    out += '<path d="M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy + ' Z" fill="#FFFFFF" stroke="' + COLORS.navy + '" stroke-width="2"/>';
    out += '<path d="M ' + (cx - R * 0.62) + ' ' + cy + ' A ' + (R * 0.62) + ' ' + (R * 0.62) + ' 0 0 1 ' + (cx + R * 0.62) + ' ' + cy + ' Z" fill="' + COLORS.ivory + '" stroke="' + COLORS.grid + '" stroke-width="1.2"/>';

    // 0° - 180° derece çizgileri ve etiketleri
    for (var d = 0; d <= 180; d += 5) {
      var rad = (d * Math.PI) / 180;
      var isMajor = d % 10 === 0;
      var isMid = d % 5 === 0 && !isMajor;
      var rOuter = R;
      var rInner = isMajor ? R - 14 : (isMid ? R - 8 : R - 5);
      var x1 = cx + rOuter * Math.cos(rad);
      var y1 = cy - rOuter * Math.sin(rad);
      var x2 = cx + rInner * Math.cos(rad);
      var y2 = cy - rInner * Math.sin(rad);
      out += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + (isMajor ? COLORS.navy : COLORS.muted) + '" stroke-width="' + (isMajor ? 1.5 : 0.9) + '"/>';

      if (d % 20 === 0 || d === 90) {
        var rLbl = R - 26;
        var lx = cx + rLbl * Math.cos(rad);
        var ly = cy - rLbl * Math.sin(rad) + 3.5;
        out += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="9.5" font-weight="700" fill="' + (d === 90 ? COLORS.amber : COLORS.slate) + '">' + d + '°</text>';
      }
    }

    // 90° dikey referans çizgisi (silik kesikli)
    out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - R + 32) + '" stroke="' + COLORS.grid + '" stroke-width="1.2" stroke-dasharray="4,4"/>';

    // Taranan açı dilimi (kehribar yarı saydam)
    var rArc = 58;
    var rad1 = (startDeg * Math.PI) / 180;
    var rad2 = (endDeg * Math.PI) / 180;
    var ax1 = cx + rArc * Math.cos(rad1), ay1 = cy - rArc * Math.sin(rad1);
    var ax2 = cx + rArc * Math.cos(rad2), ay2 = cy - rArc * Math.sin(rad2);
    out += '<path d="M ' + cx + ' ' + cy + ' L ' + ax1.toFixed(1) + ' ' + ay1.toFixed(1) + ' A ' + rArc + ' ' + rArc + ' 0 0 0 ' + ax2.toFixed(1) + ' ' + ay2.toFixed(1) + ' Z" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.amber + '" stroke-width="2"/>';

    // Işın 1 (startDeg)
    var rayLen = R + 20;
    var r1x = cx + rayLen * Math.cos(rad1), r1y = cy - rayLen * Math.sin(rad1);
    out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + r1x.toFixed(1) + '" y2="' + r1y.toFixed(1) + '" stroke="' + COLORS.blue + '" stroke-width="3.2" stroke-linecap="round"/>';
    out += '<circle cx="' + (cx + (R - 4) * Math.cos(rad1)).toFixed(1) + '" cy="' + (cy - (R - 4) * Math.sin(rad1)).toFixed(1) + '" r="4" fill="' + COLORS.blue + '"/>';
    out += '<text x="' + (cx + (rayLen + 14) * Math.cos(rad1)).toFixed(1) + '" y="' + (cy - (rayLen + 14) * Math.sin(rad1) + 5).toFixed(1) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.blue + '">' + ray1Label + '</text>';

    // Işın 2 (endDeg)
    var r2x = cx + rayLen * Math.cos(rad2), r2y = cy - rayLen * Math.sin(rad2);
    out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + r2x.toFixed(1) + '" y2="' + r2y.toFixed(1) + '" stroke="' + COLORS.amber + '" stroke-width="3.2" stroke-linecap="round"/>';
    out += '<circle cx="' + (cx + (R - 4) * Math.cos(rad2)).toFixed(1) + '" cy="' + (cy - (R - 4) * Math.sin(rad2)).toFixed(1) + '" r="4" fill="' + COLORS.amber + '"/>';
    out += '<text x="' + (cx + (rayLen + 15) * Math.cos(rad2)).toFixed(1) + '" y="' + (cy - (rayLen + 15) * Math.sin(rad2) + 4).toFixed(1) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.amber + '">' + ray2Label + '</text>';

    // Açı yayının ortasına ? veya derece etiketi
    var midRad = ((startDeg + endDeg) / 2) * Math.PI / 180;
    var lblDist = rArc + 18;
    var mx = cx + lblDist * Math.cos(midRad), my = cy - lblDist * Math.sin(midRad) + 4;
    var arcText = showMeasure ? (measured + '°') : '?';
    out += '<rect x="' + (mx - 20).toFixed(1) + '" y="' + (my - 13).toFixed(1) + '" width="40" height="19" rx="6" fill="#FFFFFF" stroke="' + COLORS.amber + '" stroke-width="1.3"/>';
    out += '<text x="' + mx.toFixed(1) + '" y="' + my.toFixed(1) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="11.5" font-weight="800" fill="' + COLORS.navy + '">' + arcText + '</text>';

    // Merkez (Köşe) noktası
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
    out += '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + vertexLabel + '</text>';

    out += '</svg>';
    return out;
  }

  function renderAngle(p, title) {
    var deg = clamp(num(p.aci_derece != null ? p.aci_derece : (p.derece != null ? p.derece : p.angle), 60), 5, 180);
    var vLbl = esc(p.kose || p.vertex || 'B');
    var r1Lbl = esc(p.kol1 || p.ray1 || 'A');
    var r2Lbl = esc(p.kol2 || p.ray2 || 'C');
    var angleLbl = p.etiket != null ? esc(p.etiket) : (p.olcu_goster === false ? '?' : (deg + '°'));

    var cx = deg > 110 ? 240 : 155;
    var cy = 195;
    var len = 155;
    var rad = (deg * Math.PI) / 180;
    var x2 = cx + len * Math.cos(rad);
    var y2 = cy - len * Math.sin(rad);

    var out = svgHeader(460, 240, title || 'Açı Modeli');

    // Açı yayı veya 90° dik açı karesi
    if (Math.abs(deg - 90) < 0.5) {
      out += '<rect x="' + cx + '" y="' + (cy - 28) + '" width="28" height="28" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.amber + '" stroke-width="2"/>';
      out += '<circle cx="' + (cx + 14) + '" cy="' + (cy - 14) + '" r="2.5" fill="' + COLORS.amber + '"/>';
    } else {
      var rArc = 46;
      var ax = cx + rArc * Math.cos(rad);
      var ay = cy - rArc * Math.sin(rad);
      out += '<path d="M ' + cx + ' ' + cy + ' L ' + (cx + rArc) + ' ' + cy + ' A ' + rArc + ' ' + rArc + ' 0 0 0 ' + ax.toFixed(1) + ' ' + ay.toFixed(1) + ' Z" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.amber + '" stroke-width="2"/>';
    }

    // Işınlar
    out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + len) + '" y2="' + cy + '" stroke="' + COLORS.navy + '" stroke-width="3.2" stroke-linecap="round"/>';
    out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + COLORS.blue + '" stroke-width="3.2" stroke-linecap="round"/>';

    // Etiketler
    var mid = (deg / 2) * Math.PI / 180;
    out += '<text x="' + (cx + 66 * Math.cos(mid)).toFixed(1) + '" y="' + (cy - 66 * Math.sin(mid) + 4).toFixed(1) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="13.5" font-weight="800" fill="' + COLORS.amber + '">' + angleLbl + '</text>';
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="4.5" fill="' + COLORS.navy + '"/>';
    out += '<text x="' + (cx - 14) + '" y="' + (cy + 16) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + vLbl + '</text>';
    out += '<text x="' + (cx + len + 14) + '" y="' + (cy + 5) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + r1Lbl + '</text>';
    out += '<text x="' + (x2 + 14 * Math.cos(rad)).toFixed(1) + '" y="' + (y2 - 14 * Math.sin(rad) + 4).toFixed(1) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.blue + '">' + r2Lbl + '</text>';

    out += '</svg>';
    return out;
  }

  function renderTriangle(p, title) {
    var koseler = Array.isArray(p.koseler) && p.koseler.length === 3 ? p.koseler : ['A', 'B', 'C'];
    var kenarlar = p.kenarlar || {};
    var acilar = p.acilar || {};
    var isRight = p.dik_ucgen === true || String(acilar[koseler[1]] || acilar.B || '').indexOf('90') >= 0;

    var pts = isRight
      ? [{ x: 130, y: 66 }, { x: 130, y: 196 }, { x: 350, y: 196 }]
      : [{ x: 230, y: 58 }, { x: 115, y: 196 }, { x: 355, y: 196 }];

    var out = svgHeader(460, 240, title || 'Üçgen Modeli');
    out += '<polygon points="' + pts[0].x + ',' + pts[0].y + ' ' + pts[1].x + ',' + pts[1].y + ' ' + pts[2].x + ',' + pts[2].y + '" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.navy + '" stroke-width="2.8" stroke-linejoin="round"/>';

    if (isRight) {
      out += '<rect x="130" y="174" width="22" height="22" fill="#FFFFFF" stroke="' + COLORS.amber + '" stroke-width="2"/>';
      out += '<circle cx="141" cy="185" r="2.2" fill="' + COLORS.amber + '"/>';
    }

    // Köşe harfleri
    out += '<text x="' + pts[0].x + '" y="' + (pts[0].y - 10) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[0]) + '</text>';
    out += '<text x="' + (pts[1].x - 14) + '" y="' + (pts[1].y + 12) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[1]) + '</text>';
    out += '<text x="' + (pts[2].x + 14) + '" y="' + (pts[2].y + 12) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[2]) + '</text>';

    // Kenar uzunlukları
    var taban = kenarlar.taban || kenarlar.BC || kenarlar[koseler[1] + koseler[2]] || p.taban || '';
    var sol = kenarlar.sol || kenarlar.AB || kenarlar[koseler[0] + koseler[1]] || p.sol_kenar || '';
    var sag = kenarlar.sag || kenarlar.AC || kenarlar[koseler[0] + koseler[2]] || p.sag_kenar || '';
    if (taban) out += '<text x="' + ((pts[1].x + pts[2].x) / 2) + '" y="' + (pts[1].y + 20) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="12.5" font-weight="800" fill="' + COLORS.blue + '">' + esc(taban) + '</text>';
    if (sol) out += '<text x="' + ((pts[0].x + pts[1].x) / 2 - 22) + '" y="' + ((pts[0].y + pts[1].y) / 2) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="12.5" font-weight="800" fill="' + COLORS.blue + '">' + esc(sol) + '</text>';
    if (sag) out += '<text x="' + ((pts[0].x + pts[2].x) / 2 + 24) + '" y="' + ((pts[0].y + pts[2].y) / 2) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="12.5" font-weight="800" fill="' + COLORS.blue + '">' + esc(sag) + '</text>';

    // İç açı etiketleri
    var a0 = acilar[koseler[0]] || acilar.A || '';
    var a1 = acilar[koseler[1]] || acilar.B || '';
    var a2 = acilar[koseler[2]] || acilar.C || '';
    if (a0) out += '<text x="' + (pts[0].x + (isRight ? 20 : 0)) + '" y="' + (pts[0].y + 34) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" font-weight="800" fill="' + COLORS.amber + '">' + esc(a0) + '</text>';
    if (a1 && !isRight) out += '<text x="' + (pts[1].x + 34) + '" y="' + (pts[1].y - 12) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" font-weight="800" fill="' + COLORS.amber + '">' + esc(a1) + '</text>';
    if (a2) out += '<text x="' + (pts[2].x - 36) + '" y="' + (pts[2].y - 12) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" font-weight="800" fill="' + COLORS.amber + '">' + esc(a2) + '</text>';

    out += '</svg>';
    return out;
  }

  function renderQuad(p, title) {
    var sekil = String(p.sekil || p.shape || 'dikdortgen').toLowerCase();
    var koseler = Array.isArray(p.koseler) && p.koseler.length === 4 ? p.koseler : ['A', 'B', 'C', 'D'];
    var wLbl = esc(p.uzun_kenar || p.widthLabel || p.genislik || '');
    var hLbl = esc(p.kisa_kenar || p.heightLabel || p.yukseklik || '');
    var kareli = p.kareli !== false;

    var out = svgHeader(460, 236, title || 'Dörtgen Modeli');
    if (kareli) {
      for (var gx = 32; gx <= 428; gx += 22) out += '<line x1="' + gx + '" y1="42" x2="' + gx + '" y2="216" stroke="' + COLORS.grid + '" stroke-width="1"/>';
      for (var gy = 42; gy <= 216; gy += 22) out += '<line x1="32" y1="' + gy + '" x2="428" y2="' + gy + '" stroke="' + COLORS.grid + '" stroke-width="1"/>';
    }

    if (sekil === 'paralelkenar' || sekil === 'yamuk') {
      var pts = sekil === 'yamuk'
        ? '165,64 295,64 350,192 110,192'
        : '150,64 350,64 310,192 110,192';
      out += '<polygon points="' + pts + '" fill="' + COLORS.emeraldSoft + '" stroke="' + COLORS.emerald + '" stroke-width="2.8"/>';
      out += '<text x="150" y="54" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[0]) + '</text>';
      out += '<text x="315" y="54" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[1]) + '</text>';
      out += '<text x="355" y="206" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[2]) + '</text>';
      out += '<text x="105" y="206" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[3]) + '</text>';
      if (wLbl) out += '<text x="230" y="212" text-anchor="middle" font-size="12.5" font-weight="800" fill="' + COLORS.emerald + '">' + wLbl + '</text>';
      if (hLbl) {
        out += '<line x1="165" y1="64" x2="165" y2="192" stroke="' + COLORS.amber + '" stroke-width="2" stroke-dasharray="5,4"/>';
        out += '<text x="186" y="132" font-size="12" font-weight="800" fill="' + COLORS.amber + '">' + hLbl + '</text>';
      }
    } else {
      var rw = (sekil === 'kare' || sekil === 'square') ? 132 : 220;
      var rh = 132;
      var rx = 230 - rw / 2;
      var ry = 64;
      out += '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="' + COLORS.emeraldSoft + '" stroke="' + COLORS.emerald + '" stroke-width="2.8"/>';
      out += '<text x="' + (rx - 12) + '" y="' + (ry - 4) + '" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[0]) + '</text>';
      out += '<text x="' + (rx + rw + 6) + '" y="' + (ry - 4) + '" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[1]) + '</text>';
      out += '<text x="' + (rx + rw + 6) + '" y="' + (ry + rh + 14) + '" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[2]) + '</text>';
      out += '<text x="' + (rx - 12) + '" y="' + (ry + rh + 14) + '" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(koseler[3]) + '</text>';
      if (wLbl) out += '<text x="230" y="' + (ry - 8) + '" text-anchor="middle" font-size="12.5" font-weight="800" fill="' + COLORS.emerald + '">' + wLbl + '</text>';
      if (hLbl) out += '<text x="' + (rx + rw + 14) + '" y="' + (ry + rh / 2 + 4) + '" font-size="12.5" font-weight="800" fill="' + COLORS.emerald + '">' + hLbl + '</text>';
    }

    out += '</svg>';
    return out;
  }

  function renderCircle(p, title) {
    var cx = 230, cy = 130, r = 78;
    var rLbl = esc(p.yaricap || p.r || '');
    var merkez = esc(p.merkez || 'O');
    var deg = num(p.merkez_aci || p.aci_derece, 0);

    var out = svgHeader(460, 236, title || 'Çember ve Daire Modeli');
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#FFFFFF" stroke="' + COLORS.navy + '" stroke-width="2.6"/>';

    if (deg > 0 && deg < 360) {
      var rad = (deg * Math.PI) / 180;
      var x2 = cx + r * Math.cos(rad);
      var y2 = cy - r * Math.sin(rad);
      var large = deg > 180 ? 1 : 0;
      out += '<path d="M ' + cx + ' ' + cy + ' L ' + (cx + r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 ' + large + ' 0 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.amber + '" stroke-width="2"/>';
      var mid = (deg / 2) * Math.PI / 180;
      out += '<text x="' + (cx + 38 * Math.cos(mid)).toFixed(1) + '" y="' + (cy - 38 * Math.sin(mid) + 4).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + COLORS.amber + '">' + deg + '°</text>';
    } else {
      out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="' + COLORS.blue + '" stroke-width="2.6"/>';
    }

    out += '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + COLORS.navy + '"/>';
    out += '<text x="' + (cx - 12) + '" y="' + (cy + 14) + '" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + merkez + '</text>';
    if (rLbl) out += '<text x="' + (cx + r / 2) + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="12.5" font-weight="800" fill="' + COLORS.blue + '">' + rLbl + '</text>';

    out += '</svg>';
    return out;
  }

  function renderLineOrRay(p, title, kind) {
    var n1 = esc(p.nokta1 || p.baslangic || (Array.isArray(p.noktalar) && p.noktalar[0]) || 'A');
    var n2 = esc(p.nokta2 || p.bitis || (Array.isArray(p.noktalar) && p.noktalar[1]) || 'B');
    var dogruAd = esc(p.dogru_adi || p.etiket || '');
    var uzunluk = esc(p.uzunluk || '');
    var kareli = p.kareli !== false;

    var out = svgHeader(460, 210, title || (kind === 'isin' ? 'Işın Modeli' : (kind === 'dogru_parcasi' ? 'Doğru Parçası Modeli' : 'Doğru Modeli')));
    if (kareli) {
      for (var gx = 32; gx <= 428; gx += 22) out += '<line x1="' + gx + '" y1="42" x2="' + gx + '" y2="188" stroke="' + COLORS.grid + '" stroke-width="1"/>';
      for (var gy = 42; gy <= 188; gy += 22) out += '<line x1="32" y1="' + gy + '" x2="428" y2="' + gy + '" stroke="' + COLORS.grid + '" stroke-width="1"/>';
    }

    var y = 114;
    if (kind === 'dogru') {
      out += '<line x1="68" y1="' + y + '" x2="392" y2="' + y + '" stroke="' + COLORS.blue + '" stroke-width="3.4"/>';
      out += '<polygon points="68,' + (y - 6) + ' 54,' + y + ' 68,' + (y + 6) + '" fill="' + COLORS.blue + '"/>';
      out += '<polygon points="392,' + (y - 6) + ' 406,' + y + ' 392,' + (y + 6) + '" fill="' + COLORS.blue + '"/>';
      out += '<circle cx="152" cy="' + y + '" r="5" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
      out += '<circle cx="308" cy="' + y + '" r="5" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
      out += '<text x="152" y="' + (y - 14) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + n1 + '</text>';
      out += '<text x="308" y="' + (y - 14) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + n2 + '</text>';
      if (dogruAd) out += '<text x="396" y="' + (y - 14) + '" text-anchor="end" font-size="13" font-style="italic" font-weight="800" fill="' + COLORS.amber + '">' + dogruAd + '</text>';
    } else if (kind === 'isin') {
      out += '<line x1="112" y1="' + y + '" x2="386" y2="' + y + '" stroke="' + COLORS.amber + '" stroke-width="3.4"/>';
      out += '<polygon points="386,' + (y - 6.5) + ' 402,' + y + ' 386,' + (y + 6.5) + '" fill="' + COLORS.amber + '"/>';
      out += '<circle cx="112" cy="' + y + '" r="6" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
      out += '<circle cx="272" cy="' + y + '" r="4.5" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="1.5"/>';
      out += '<text x="112" y="' + (y - 15) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + n1 + '</text>';
      out += '<text x="272" y="' + (y - 15) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + n2 + '</text>';
    } else {
      out += '<line x1="110" y1="' + y + '" x2="350" y2="' + y + '" stroke="' + COLORS.emerald + '" stroke-width="3.6" stroke-linecap="round"/>';
      out += '<circle cx="110" cy="' + y + '" r="6" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
      out += '<circle cx="350" cy="' + y + '" r="6" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
      out += '<text x="110" y="' + (y - 15) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + n1 + '</text>';
      out += '<text x="350" y="' + (y - 15) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + n2 + '</text>';
      if (uzunluk) {
        out += '<rect x="196" y="' + (y + 12) + '" width="68" height="22" rx="6" fill="#FFFFFF" stroke="' + COLORS.emerald + '" stroke-width="1.4"/>';
        out += '<text x="230" y="' + (y + 27) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + COLORS.emerald + '">' + uzunluk + '</text>';
      }
    }
    out += '</svg>';
    return out;
  }

  function renderDikme(p, title) {
    var nokta = esc(p.nokta || p.ust_nokta || 'A');
    var dogruAd = esc(p.dogru_adi || 'd');
    var ayak = esc(p.dikme_ayagi || 'H');
    var karsilastir = p.egik_yollar !== false;

    var out = svgHeader(460, 232, title || 'Noktadan Doğruya Dikme ve En Kısa Yol');
    for (var gx = 32; gx <= 428; gx += 22) out += '<line x1="' + gx + '" y1="42" x2="' + gx + '" y2="210" stroke="' + COLORS.grid + '" stroke-width="1"/>';
    for (var gy = 42; gy <= 210; gy += 22) out += '<line x1="32" y1="' + gy + '" x2="428" y2="' + gy + '" stroke="' + COLORS.grid + '" stroke-width="1"/>';

    var ax = 230, ay = 64, dy = 174;
    // d doğrusu
    out += '<line x1="56" y1="' + dy + '" x2="404" y2="' + dy + '" stroke="' + COLORS.navy + '" stroke-width="3"/>';
    out += '<polygon points="56,' + (dy - 5) + ' 44,' + dy + ' 56,' + (dy + 5) + '" fill="' + COLORS.navy + '"/>';
    out += '<polygon points="404,' + (dy - 5) + ' 416,' + dy + ' 404,' + (dy + 5) + '" fill="' + COLORS.navy + '"/>';
    out += '<text x="410" y="' + (dy - 10) + '" text-anchor="end" font-size="13" font-style="italic" font-weight="800" fill="' + COLORS.navy + '">' + dogruAd + '</text>';

    // Eğik karşılaştırma yolları (B ve C noktaları)
    if (karsilastir) {
      out += '<line x1="' + ax + '" y1="' + ay + '" x2="120" y2="' + dy + '" stroke="' + COLORS.muted + '" stroke-width="2" stroke-dasharray="5,4"/>';
      out += '<line x1="' + ax + '" y1="' + ay + '" x2="340" y2="' + dy + '" stroke="' + COLORS.muted + '" stroke-width="2" stroke-dasharray="5,4"/>';
      out += '<circle cx="120" cy="' + dy + '" r="4.5" fill="' + COLORS.slate + '"/>';
      out += '<text x="120" y="' + (dy + 18) + '" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.slate + '">K</text>';
      out += '<circle cx="340" cy="' + dy + '" r="4.5" fill="' + COLORS.slate + '"/>';
      out += '<text x="340" y="' + (dy + 18) + '" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.slate + '">M</text>';
    }

    // Dikme (AH) ve 90° dik açı karesi
    out += '<line x1="' + ax + '" y1="' + ay + '" x2="' + ax + '" y2="' + dy + '" stroke="' + COLORS.amber + '" stroke-width="3.2"/>';
    out += '<rect x="' + ax + '" y="' + (dy - 18) + '" width="18" height="18" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.amber + '" stroke-width="1.8"/>';
    out += '<circle cx="' + (ax + 9) + '" cy="' + (dy - 9) + '" r="2" fill="' + COLORS.amber + '"/>';

    out += '<circle cx="' + ax + '" cy="' + ay + '" r="5.5" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
    out += '<text x="' + ax + '" y="' + (ay - 10) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + COLORS.navy + '">' + nokta + '</text>';
    out += '<circle cx="' + ax + '" cy="' + dy + '" r="5" fill="' + COLORS.amber + '" stroke="#FFFFFF" stroke-width="1.8"/>';
    out += '<text x="' + ax + '" y="' + (dy + 18) + '" text-anchor="middle" font-size="13.5" font-weight="800" fill="' + COLORS.amber + '">' + ayak + '</text>';
    out += '</svg>';
    return out;
  }

  function renderParallelIntersecting(p, title) {
    var mod = String(p.durum || p.mode || 'paralel').toLowerCase();
    var l1 = esc(p.dogru1 || 'd₁');
    var l2 = esc(p.dogru2 || 'd₂');
    var out = svgHeader(460, 224, title || (mod === 'dik' ? 'Dik Doğrular' : (mod === 'kesisen' ? 'Kesişen Doğrular' : 'Paralel Doğrular')));
    for (var gx = 32; gx <= 428; gx += 22) out += '<line x1="' + gx + '" y1="42" x2="' + gx + '" y2="202" stroke="' + COLORS.grid + '" stroke-width="1"/>';
    for (var gy = 42; gy <= 202; gy += 22) out += '<line x1="32" y1="' + gy + '" x2="428" y2="' + gy + '" stroke="' + COLORS.grid + '" stroke-width="1"/>';

    if (mod === 'dik') {
      out += '<line x1="76" y1="130" x2="384" y2="130" stroke="' + COLORS.blue + '" stroke-width="3"/>';
      out += '<line x1="230" y1="54" x2="230" y2="196" stroke="' + COLORS.amber + '" stroke-width="3"/>';
      out += '<rect x="230" y="110" width="20" height="20" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.amber + '" stroke-width="2"/>';
      out += '<circle cx="240" cy="120" r="2.2" fill="' + COLORS.amber + '"/>';
      out += '<text x="386" y="122" text-anchor="end" font-size="13" font-weight="800" fill="' + COLORS.blue + '">' + l1 + '</text>';
      out += '<text x="242" y="64" font-size="13" font-weight="800" fill="' + COLORS.amber + '">' + l2 + '</text>';
    } else if (mod === 'kesisen') {
      out += '<line x1="88" y1="184" x2="372" y2="68" stroke="' + COLORS.blue + '" stroke-width="3"/>';
      out += '<line x1="88" y1="68" x2="372" y2="184" stroke="' + COLORS.amber + '" stroke-width="3"/>';
      out += '<circle cx="230" cy="126" r="5" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
      out += '<text x="230" y="108" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">O</text>';
      out += '<text x="376" y="72" font-size="13" font-weight="800" fill="' + COLORS.blue + '">' + l1 + '</text>';
      out += '<text x="376" y="186" font-size="13" font-weight="800" fill="' + COLORS.amber + '">' + l2 + '</text>';
    } else {
      out += '<line x1="74" y1="92" x2="386" y2="92" stroke="' + COLORS.blue + '" stroke-width="3.2"/>';
      out += '<line x1="74" y1="158" x2="386" y2="158" stroke="' + COLORS.amber + '" stroke-width="3.2"/>';
      out += '<text x="392" y="96" font-size="13" font-weight="800" fill="' + COLORS.blue + '">' + l1 + '</text>';
      out += '<text x="392" y="162" font-size="13" font-weight="800" fill="' + COLORS.amber + '">' + l2 + '</text>';
      out += '<text x="230" y="130" text-anchor="middle" font-size="12" font-weight="800" fill="' + COLORS.slate + '">' + l1 + ' ∥ ' + l2 + '</text>';
    }
    out += '</svg>';
    return out;
  }

  function renderSolid3D(p, title) {
    var sekil = String(p.sekil || p.cisim || 'silindir').toLowerCase();
    var rLbl = esc(p.yaricap || p.taban || '');
    var hLbl = esc(p.yukseklik || p.h || '');
    var out = svgHeader(460, 236, title || 'Katı Cisim Modeli');

    if (sekil === 'koni') {
      out += '<ellipse cx="230" cy="186" rx="74" ry="22" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      out += '<line x1="156" y1="186" x2="230" y2="56" stroke="' + COLORS.navy + '" stroke-width="2.6"/>';
      out += '<line x1="304" y1="186" x2="230" y2="56" stroke="' + COLORS.navy + '" stroke-width="2.6"/>';
      out += '<line x1="230" y1="56" x2="230" y2="186" stroke="' + COLORS.amber + '" stroke-width="2" stroke-dasharray="5,4"/>';
      if (hLbl) out += '<text x="244" y="130" font-size="12.5" font-weight="800" fill="' + COLORS.amber + '">' + hLbl + '</text>';
      if (rLbl) out += '<text x="268" y="200" font-size="12.5" font-weight="800" fill="' + COLORS.blue + '">' + rLbl + '</text>';
    } else if (sekil === 'prizma' || sekil === 'kup') {
      out += '<rect x="148" y="92" width="124" height="104" fill="' + COLORS.blueSoft + '" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      out += '<polygon points="148,92 196,56 320,56 272,92" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      out += '<polygon points="272,92 320,56 320,160 272,196" fill="' + COLORS.emeraldSoft + '" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      if (rLbl) out += '<text x="210" y="214" text-anchor="middle" font-size="12.5" font-weight="800" fill="' + COLORS.blue + '">' + rLbl + '</text>';
      if (hLbl) out += '<text x="334" y="120" font-size="12.5" font-weight="800" fill="' + COLORS.amber + '">' + hLbl + '</text>';
    } else {
      // Silindir
      out += '<ellipse cx="230" cy="184" rx="70" ry="20" fill="' + COLORS.blueSoft + '" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      out += '<rect x="160" y="74" width="140" height="110" fill="' + COLORS.blueSoft + '" stroke="none"/>';
      out += '<line x1="160" y1="74" x2="160" y2="184" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      out += '<line x1="300" y1="74" x2="300" y2="184" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      out += '<ellipse cx="230" cy="74" rx="70" ry="20" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.navy + '" stroke-width="2.4"/>';
      out += '<line x1="230" y1="74" x2="300" y2="74" stroke="' + COLORS.amber + '" stroke-width="2.2"/>';
      if (rLbl) out += '<text x="266" y="68" text-anchor="middle" font-size="12" font-weight="800" fill="' + COLORS.amber + '">' + rLbl + '</text>';
      if (hLbl) out += '<text x="316" y="134" font-size="12.5" font-weight="800" fill="' + COLORS.navy + '">' + hLbl + '</text>';
    }
    out += '</svg>';
    return out;
  }

  function renderGeometri(p, title) {
    var alt = String(p.alt_tip || p.subtype || p.sekil || p.shape || '').toLowerCase().trim();
    if (alt === 'aciolcer' || alt === 'iletki' || alt === 'protractor') return renderProtractor(p, title);
    if (alt === 'aci' || alt === 'angle') return renderAngle(p, title);
    if (alt === 'dogru' || alt === 'nokta_dogru' || alt === 'line') return renderLineOrRay(p, title, 'dogru');
    if (alt === 'isin' || alt === 'ray') return renderLineOrRay(p, title, 'isin');
    if (alt === 'dogru_parcasi' || alt === 'segment') return renderLineOrRay(p, title, 'dogru_parcasi');
    if (alt === 'dikme' || alt === 'en_kisa_yol' || alt === 'perpendicular') return renderDikme(p, title);
    if (alt === 'paralel_kesisen' || alt === 'paralel' || alt === 'kesisen' || alt === 'dik_dogrular') return renderParallelIntersecting(p, title);
    if (alt === 'kati_cisim' || alt === 'silindir' || alt === 'prizma' || alt === 'koni' || alt === 'kup') return renderSolid3D(p, title);
    if (alt === 'ucgen' || alt === 'triangle') return renderTriangle(p, title);
    if (alt === 'cember' || alt === 'daire' || alt === 'circle') return renderCircle(p, title);
    if (alt === 'dortgen' || alt === 'dikdortgen' || alt === 'kare' || alt === 'paralelkenar' || alt === 'yamuk' || alt === 'rectangle' || alt === 'square') {
      return renderQuad(p, title);
    }
    if (p.aci_derece != null || p.baslangic_derece != null || p.bitis_derece != null) {
      return p.iletki === false ? renderAngle(p, title) : renderProtractor(p, title);
    }
    if (p.yaricap != null || p.merkez_aci != null) return renderCircle(p, title);
    if (p.koseler && p.koseler.length === 3) return renderTriangle(p, title);
    if (p.uzun_kenar || p.kisa_kenar || p.widthLabel || p.heightLabel) return renderQuad(p, title);
    // Tanınmayan geometrik tipte ASLA yanlış ABCD dikdörtgeni çizme!
    return '';
  }

  /* ========================================================================
     2. SAYI DOĞRUSU, KESİR, VENN ŞEMASI, BÖLÜK TABLOSU
     ======================================================================== */
  function renderFraction(p, title, mode) {
    var den = clamp(Math.round(num(p.payda != null ? p.payda : p.denominator, 4)), 2, 12);
    var pay = clamp(Math.round(num(p.pay != null ? p.pay : p.numerator, 3)), 0, den);
    var etiketGoster = p.etiket_goster !== false;

    if (mode === 'pie') {
      var cx = 230, cy = 122, r = 68;
      var slices = '';
      for (var i = 0; i < den; i++) {
        var a1 = (i / den) * 2 * Math.PI - Math.PI / 2;
        var a2 = ((i + 1) / den) * 2 * Math.PI - Math.PI / 2;
        var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        var large = (a2 - a1) > Math.PI ? 1 : 0;
        var fill = i < pay ? COLORS.amber : '#FFFFFF';
        slices += '<path d="M ' + cx + ' ' + cy + ' L ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z" fill="' + fill + '" stroke="' + COLORS.navy + '" stroke-width="2"/>';
      }
      var footer = etiketGoster
        ? '<text x="230" y="212" text-anchor="middle" font-family="Inter,sans-serif" font-size="12.5" font-weight="800" fill="' + COLORS.slate + '">' + den + ' eş parçadan ' + pay + ' tanesi boyalı</text>'
        : '';
      return svgHeader(460, 226, title || 'Kesir Daire Modeli') + slices + footer + '</svg>';
    }

    var barW = 396;
    var cellW = barW / den;
    var cells = '';
    for (var j = 0; j < den; j++) {
      var x = 32 + j * cellW;
      var fillBar = j < pay ? COLORS.amber : '#FFFFFF';
      cells += '<rect x="' + x.toFixed(1) + '" y="68" width="' + cellW.toFixed(1) + '" height="62" fill="' + fillBar + '" stroke="' + COLORS.navy + '" stroke-width="2"/>';
      if (den <= 10) {
        cells += '<text x="' + (x + cellW / 2).toFixed(1) + '" y="104" text-anchor="middle" font-family="Inter,sans-serif" font-size="11.5" font-weight="800" fill="' + (j < pay ? '#FFFFFF' : COLORS.muted) + '">1/' + den + '</text>';
      }
    }
    var footerBar = etiketGoster
      ? '<text x="230" y="158" text-anchor="middle" font-family="Inter,sans-serif" font-size="12.5" font-weight="800" fill="' + COLORS.slate + '">' + den + ' eş parçadan ' + pay + ' tanesi boyalı</text>'
      : '';
    return svgHeader(460, 178, title || 'Kesir Şerit Modeli') + cells + footerBar + '</svg>';
  }

  function renderNumberLine(p, title) {
    var minV = num(p.min, 0);
    var maxV = num(p.max, 4);
    if (maxV <= minV) maxV = minV + 4;
    var span = maxV - minV;
    var steps = clamp(Math.round(num(p.adim != null ? p.adim : p.steps, span <= 10 ? span : 8)), 2, 12);
    var points = Array.isArray(p.noktalar) ? p.noktalar : (Array.isArray(p.markers) ? p.markers : []);
    var interval = p.aralik && typeof p.aralik === 'object' ? p.aralik : null;

    var out = svgHeader(480, 160, title || 'Sayı Doğrusu');
    out += '<line x1="36" y1="98" x2="444" y2="98" stroke="' + COLORS.navy + '" stroke-width="2.8"/>';
    out += '<polygon points="444,92 456,98 444,104" fill="' + COLORS.navy + '"/>';
    out += '<polygon points="36,92 24,98 36,104" fill="' + COLORS.navy + '"/>';

    for (var i = 0; i <= steps; i++) {
      var x = 52 + (i / steps) * 376;
      var val = Number((minV + (i / steps) * span).toFixed(2));
      out += '<line x1="' + x.toFixed(1) + '" y1="90" x2="' + x.toFixed(1) + '" y2="106" stroke="' + COLORS.navy + '" stroke-width="2"/>';
      out += '<text x="' + x.toFixed(1) + '" y="126" text-anchor="middle" font-family="Inter,sans-serif" font-size="11.5" font-weight="700" fill="' + COLORS.slate + '">' + val + '</text>';
    }

    if (interval) {
      var a = clamp((num(interval.baslangic, minV) - minV) / span, 0, 1);
      var b = clamp((num(interval.bitis, maxV) - minV) / span, 0, 1);
      var ix1 = 52 + a * 376, ix2 = 52 + b * 376;
      out += '<line x1="' + ix1.toFixed(1) + '" y1="98" x2="' + ix2.toFixed(1) + '" y2="98" stroke="' + COLORS.amber + '" stroke-width="7" stroke-linecap="round"/>';
      out += '<circle cx="' + ix1.toFixed(1) + '" cy="98" r="6" fill="' + (interval.baslangic_dahil === false ? '#FFFFFF' : COLORS.amber) + '" stroke="' + COLORS.amber + '" stroke-width="2.5"/>';
      out += '<circle cx="' + ix2.toFixed(1) + '" cy="98" r="6" fill="' + (interval.bitis_dahil === false ? '#FFFFFF' : COLORS.amber) + '" stroke="' + COLORS.amber + '" stroke-width="2.5"/>';
    }

    points.forEach(function (m) {
      var v = num(m.deger != null ? m.deger : m.value, NaN);
      if (!Number.isFinite(v)) return;
      var ratio = clamp((v - minV) / span, 0, 1);
      var px = 52 + ratio * 376;
      out += '<circle cx="' + px.toFixed(1) + '" cy="98" r="6.5" fill="' + COLORS.amber + '" stroke="#FFFFFF" stroke-width="2"/>';
      out += '<text x="' + px.toFixed(1) + '" y="76" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(m.etiket || m.label || v) + '</text>';
    });

    out += '</svg>';
    return out;
  }

  function renderVenn(p, title) {
    var kA = esc(p.kume_a || 'A');
    var kB = esc(p.kume_b || 'B');
    var sA = esc(p.sadece_a != null ? p.sadece_a : '');
    var kes = esc(p.kesisim != null ? p.kesisim : '');
    var sB = esc(p.sadece_b != null ? p.sadece_b : '');
    var dis = esc(p.disarida != null ? p.disarida : '');

    var out = svgHeader(460, 224, title || 'Venn Şeması');
    out += '<rect x="34" y="42" width="392" height="164" rx="10" fill="#FFFFFF" stroke="' + COLORS.slate + '" stroke-width="1.6"/>';
    out += '<text x="46" y="60" font-family="Inter,sans-serif" font-size="12" font-weight="800" fill="' + COLORS.slate + '">E</text>';
    out += '<circle cx="182" cy="126" r="62" fill="' + COLORS.blueSoft + '" stroke="' + COLORS.blue + '" stroke-width="2.4"/>';
    out += '<circle cx="278" cy="126" r="62" fill="' + COLORS.amberSoft + '" stroke="' + COLORS.amber + '" stroke-width="2.4"/>';
    out += '<text x="144" y="62" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.blue + '">' + kA + '</text>';
    out += '<text x="316" y="62" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.amber + '">' + kB + '</text>';
    if (sA) out += '<text x="155" y="131" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + sA + '</text>';
    if (kes) out += '<text x="230" y="131" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + kes + '</text>';
    if (sB) out += '<text x="305" y="131" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + sB + '</text>';
    if (dis) out += '<text x="398" y="192" text-anchor="end" font-size="12.5" font-weight="800" fill="' + COLORS.slate + '">' + dis + '</text>';
    out += '</svg>';
    return out;
  }

  function renderPlaceValue(p, title) {
    var rawNum = String(p.sayi || p.number || '').replace(/\D/g, '');
    if (!rawNum) return '';
    var padded = rawNum.padStart(9, ' ').slice(-9);
    var groups = [
      { name: 'MİLYONLAR BÖLÜĞÜ', bg: '#EFF6FF', border: COLORS.blue, digits: padded.slice(0, 3) },
      { name: 'BİNLER BÖLÜĞÜ',    bg: '#FEF3C7', border: COLORS.amber, digits: padded.slice(3, 6) },
      { name: 'BİRLER BÖLÜĞÜ',    bg: '#ECFDF5', border: COLORS.emerald, digits: padded.slice(6, 9) }
    ];
    var out = svgHeader(500, 186, title || 'Bölük ve Basamak Tablosu');
    groups.forEach(function (g, gi) {
      var gx = 18 + gi * 158;
      out += '<rect x="' + gx + '" y="44" width="148" height="122" rx="10" fill="' + g.bg + '" stroke="' + g.border + '" stroke-width="2"/>';
      out += '<text x="' + (gx + 74) + '" y="65" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="800" fill="' + g.border + '">' + g.name + '</text>';
      for (var i = 0; i < 3; i++) {
        var ch = g.digits[i].trim();
        var bx = gx + 10 + i * 44;
        out += '<rect x="' + bx + '" y="80" width="38" height="52" rx="7" fill="#FFFFFF" stroke="' + g.border + '" stroke-width="1.4"/>';
        out += '<text x="' + (bx + 19) + '" y="114" text-anchor="middle" font-family="Inter,sans-serif" font-size="21" font-weight="800" fill="' + COLORS.navy + '">' + esc(ch || '—') + '</text>';
      }
    });
    out += '</svg>';
    return out;
  }

  function renderSayiDogrusuKesir(p, title) {
    var alt = String(p.alt_tip || p.subtype || p.style || '').toLowerCase().trim();
    if (alt === 'venn') return renderVenn(p, title);
    if (alt === 'boluk_tablosu' || alt === 'place_value_table' || p.sayi || p.number) return renderPlaceValue(p, title);
    if (alt === 'kesir_daire' || alt === 'pie') return renderFraction(p, title, 'pie');
    if (alt === 'kesir_dikdortgen' || alt === 'kesir' || alt === 'bar' || p.pay != null || p.numerator != null) {
      return renderFraction(p, title, (p.stil === 'daire' || p.style === 'pie') ? 'pie' : 'bar');
    }
    return renderNumberLine(p, title);
  }

  /* ========================================================================
     3. FONKSİYON / KOORDİNAT GRAFİĞİ (Doğru, Parabol, Trigonometri, Eğri)
     ======================================================================== */
  function renderFonksiyonGrafik(p, title) {
    var w = 460, h = 280;
    var xMin = num(p.x_min, -5), xMax = num(p.x_max, 5);
    var yMin = num(p.y_min, -4), yMax = num(p.y_max, 6);
    if (xMax <= xMin) { xMin = -5; xMax = 5; }
    if (yMax <= yMin) { yMin = -4; yMax = 6; }

    var padL = 46, padR = 26, padT = 38, padB = 30;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;

    function toX(x) { return padL + ((x - xMin) / (xMax - xMin)) * plotW; }
    function toY(y) { return padT + ((yMax - y) / (yMax - yMin)) * plotH; }

    var out = svgHeader(w, h, title || 'Koordinat Düzlemi ve Grafik');
    out += '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" fill="#FFFFFF" stroke="' + COLORS.grid + '" stroke-width="1"/>';

    // Grid çizgileri
    var xStep = Math.max(1, Math.round((xMax - xMin) / 10));
    var yStep = Math.max(1, Math.round((yMax - yMin) / 8));
    for (var gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx += xStep) {
      var sx = toX(gx);
      out += '<line x1="' + sx.toFixed(1) + '" y1="' + padT + '" x2="' + sx.toFixed(1) + '" y2="' + (padT + plotH) + '" stroke="' + COLORS.grid + '" stroke-width="1"/>';
    }
    for (var gy = Math.ceil(yMin); gy <= Math.floor(yMax); gy += yStep) {
      var sy = toY(gy);
      out += '<line x1="' + padL + '" y1="' + sy.toFixed(1) + '" x2="' + (padL + plotW) + '" y2="' + sy.toFixed(1) + '" stroke="' + COLORS.grid + '" stroke-width="1"/>';
    }

    // X ve Y eksenleri
    var ox = clamp(toX(0), padL, padL + plotW);
    var oy = clamp(toY(0), padT, padT + plotH);
    out += '<line x1="' + padL + '" y1="' + oy.toFixed(1) + '" x2="' + (padL + plotW + 6) + '" y2="' + oy.toFixed(1) + '" stroke="' + COLORS.navy + '" stroke-width="2"/>';
    out += '<line x1="' + ox.toFixed(1) + '" y1="' + (padT + plotH) + '" x2="' + ox.toFixed(1) + '" y2="' + (padT - 6) + '" stroke="' + COLORS.navy + '" stroke-width="2"/>';
    out += '<text x="' + (padL + plotW + 12) + '" y="' + (oy + 4).toFixed(1) + '" font-size="12" font-weight="800" fill="' + COLORS.navy + '">x</text>';
    out += '<text x="' + (ox - 10).toFixed(1) + '" y="' + (padT - 8) + '" font-size="12" font-weight="800" fill="' + COLORS.navy + '">y</text>';

    // Eksen etiketleri
    for (var lx = Math.ceil(xMin); lx <= Math.floor(xMax); lx += xStep) {
      if (lx === 0) continue;
      out += '<text x="' + toX(lx).toFixed(1) + '" y="' + (oy + 14).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="' + COLORS.muted + '">' + lx + '</text>';
    }
    for (var ly = Math.ceil(yMin); ly <= Math.floor(yMax); ly += yStep) {
      if (ly === 0) continue;
      out += '<text x="' + (ox - 8).toFixed(1) + '" y="' + (toY(ly) + 3.5).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="' + COLORS.muted + '">' + ly + '</text>';
    }

    var alt = String(p.alt_tip || p.subtype || 'parabol').toLowerCase();
    var fn = null;
    if (alt === 'dogru' || alt === 'line') {
      var m = num(p.m != null ? p.m : p.egim, 1);
      var n = num(p.n != null ? p.n : p.y_kesen, 0);
      fn = function (x) { return m * x + n; };
    } else if (alt === 'trigonometri' || alt === 'sin' || alt === 'cos') {
      var amp = num(p.genlik, 2);
      var freq = num(p.frekans, 1);
      var isCos = alt === 'cos' || String(p.fonksiyon || '').toLowerCase() === 'cos';
      fn = function (x) { return amp * (isCos ? Math.cos(freq * x) : Math.sin(freq * x)); };
    } else if (alt === 'egri' && Array.isArray(p.noktalar) && p.noktalar.length >= 2) {
      var ptsStr = p.noktalar.map(function (pt) {
        return toX(num(pt[0], 0)).toFixed(1) + ',' + toY(num(pt[1], 0)).toFixed(1);
      }).join(' ');
      out += '<polyline points="' + ptsStr + '" fill="none" stroke="' + COLORS.amber + '" stroke-width="2.8" stroke-linejoin="round"/>';
    } else {
      var a = num(p.a, 1), b = num(p.b, 0), c = num(p.c, -2);
      fn = function (x) { return a * x * x + b * x + c; };
    }

    if (fn) {
      // Opsiyonel integral taralı alan
      if (Array.isArray(p.integral_aralik) && p.integral_aralik.length === 2) {
        var ia = num(p.integral_aralik[0], 0), ib = num(p.integral_aralik[1], 2);
        var areaPts = [toX(ia).toFixed(1) + ',' + oy.toFixed(1)];
        for (var k = 0; k <= 40; k++) {
          var ax = ia + (k / 40) * (ib - ia);
          var ay = clamp(fn(ax), yMin, yMax);
          areaPts.push(toX(ax).toFixed(1) + ',' + toY(ay).toFixed(1));
        }
        areaPts.push(toX(ib).toFixed(1) + ',' + oy.toFixed(1));
        out += '<polygon points="' + areaPts.join(' ') + '" fill="' + COLORS.amberSoft + '" stroke="none"/>';
      }

      var curvePts = [];
      for (var s = 0; s <= 120; s++) {
        var x = xMin + (s / 120) * (xMax - xMin);
        var y = fn(x);
        if (y >= yMin - 0.5 && y <= yMax + 0.5) {
          curvePts.push(toX(x).toFixed(1) + ',' + toY(clamp(y, yMin, yMax)).toFixed(1));
        }
      }
      if (curvePts.length >= 2) {
        out += '<polyline points="' + curvePts.join(' ') + '" fill="none" stroke="' + COLORS.blue + '" stroke-width="2.8"/>';
      }
    }

    // İşaretlenecek özel noktalar
    var isaretler = Array.isArray(p.isaretli_noktalar) ? p.isaretli_noktalar : [];
    isaretler.forEach(function (pt) {
      var px = num(pt.x, NaN), py = num(pt.y, NaN);
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      out += '<circle cx="' + toX(px).toFixed(1) + '" cy="' + toY(py).toFixed(1) + '" r="4.5" fill="' + COLORS.amber + '" stroke="#FFFFFF" stroke-width="1.5"/>';
      if (pt.etiket) {
        out += '<text x="' + (toX(px) + 8).toFixed(1) + '" y="' + (toY(py) - 6).toFixed(1) + '" font-size="11" font-weight="800" fill="' + COLORS.navy + '">' + esc(pt.etiket) + '</text>';
      }
    });

    if (p.etiket) {
      out += '<text x="' + (padL + plotW - 6) + '" y="' + (padT + 18) + '" text-anchor="end" font-size="12" font-weight="800" fill="' + COLORS.blue + '">' + esc(p.etiket) + '</text>';
    }

    out += '</svg>';
    return out;
  }

  /* ========================================================================
     4. VERİ GRAFİĞİ (Sütun, Çizgi, Daire) — ASLA UYDURMA VERİ ÜRETMEZ
     ======================================================================== */
  function renderVeriGrafigi(p, title) {
    var items = Array.isArray(p.veriler) ? p.veriler : (Array.isArray(p.items) ? p.items : []);
    items = items.filter(function (it) {
      return it && (it.etiket != null || it.label != null) && Number.isFinite(Number(it.deger != null ? it.deger : it.value));
    }).slice(0, 7);
    if (!items.length) return '';

    var alt = String(p.alt_tip || p.subtype || 'sutun').toLowerCase().trim();

    if (alt === 'daire' || alt === 'pie') {
      var total = items.reduce(function (s, it) { return s + Math.max(0, Number(it.deger != null ? it.deger : it.value)); }, 0);
      if (total <= 0) return '';
      var cx = 148, cy = 128, r = 74, acc = -Math.PI / 2;
      var slices = '', legend = '';
      items.forEach(function (it, idx) {
        var v = Math.max(0, Number(it.deger != null ? it.deger : it.value));
        var ang = (v / total) * 2 * Math.PI;
        var a2 = acc + ang;
        var x1 = cx + r * Math.cos(acc), y1 = cy + r * Math.sin(acc);
        var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        var large = ang > Math.PI ? 1 : 0;
        var col = CHART_PALETTE[idx % CHART_PALETTE.length];
        slices += '<path d="M ' + cx + ' ' + cy + ' L ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z" fill="' + col + '" stroke="#FFFFFF" stroke-width="2"/>';
        var ly = 64 + idx * 24;
        var lbl = String(it.etiket || it.label).slice(0, 18);
        legend += '<rect x="258" y="' + (ly - 10) + '" width="12" height="12" rx="3" fill="' + col + '"/>';
        legend += '<text x="276" y="' + ly + '" font-family="Inter,sans-serif" font-size="11.5" font-weight="700" fill="' + COLORS.navy + '">' + esc(lbl) + ': ' + v + '</text>';
        acc = a2;
      });
      return svgHeader(460, 224, title || 'Daire Grafiği') + slices + legend + '</svg>';
    }

    var maxV = Math.max(1, Math.max.apply(null, items.map(function (i) { return Number(i.deger != null ? i.deger : i.value); })));
    var slotW = 368 / items.length;
    var out = svgHeader(480, 224, title || (alt === 'cizgi' ? 'Çizgi Grafiği' : 'Sütun Grafiği'));
    out += '<line x1="60" y1="46" x2="60" y2="184" stroke="' + COLORS.navy + '" stroke-width="2"/>';
    out += '<line x1="60" y1="184" x2="444" y2="184" stroke="' + COLORS.navy + '" stroke-width="2"/>';

    if (alt === 'cizgi' || alt === 'line') {
      var pts = [];
      items.forEach(function (it, idx) {
        var val = Number(it.deger != null ? it.deger : it.value);
        var x = 60 + idx * slotW + slotW / 2;
        var y = 184 - (val / maxV) * 124;
        pts.push(x.toFixed(1) + ',' + y.toFixed(1));
      });
      out += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + COLORS.amber + '" stroke-width="3"/>';
      items.forEach(function (it, idx) {
        var val = Number(it.deger != null ? it.deger : it.value);
        var x = 60 + idx * slotW + slotW / 2;
        var y = 184 - (val / maxV) * 124;
        out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="' + COLORS.navy + '" stroke="#FFFFFF" stroke-width="2"/>';
        out += '<text x="' + x.toFixed(1) + '" y="' + (y - 9).toFixed(1) + '" text-anchor="middle" font-size="11.5" font-weight="800" fill="' + COLORS.navy + '">' + val + '</text>';
        out += '<text x="' + x.toFixed(1) + '" y="203" text-anchor="middle" font-size="11" font-weight="700" fill="' + COLORS.slate + '">' + esc(String(it.etiket || it.label).slice(0, 10)) + '</text>';
      });
    } else {
      items.forEach(function (it, idx) {
        var val = Number(it.deger != null ? it.deger : it.value);
        var bh = Math.max(8, (val / maxV) * 126);
        var bx = 66 + idx * slotW + slotW * 0.16;
        var bw = slotW * 0.68;
        var by = 184 - bh;
        var col = CHART_PALETTE[idx % CHART_PALETTE.length];
        out += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="6" fill="' + col + '"/>';
        out += '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by - 6).toFixed(1) + '" text-anchor="middle" font-size="11.5" font-weight="800" fill="' + COLORS.navy + '">' + val + '</text>';
        out += '<text x="' + (bx + bw / 2).toFixed(1) + '" y="203" text-anchor="middle" font-size="11" font-weight="700" fill="' + COLORS.slate + '">' + esc(String(it.etiket || it.label).slice(0, 10)) + '</text>';
      });
    }

    out += '</svg>';
    return out;
  }

  /* ========================================================================
     5. CEBİR MODELİ (Eşit Kollu Denklem Terazisi & Cebir Karoları)
     ======================================================================== */
  function renderCebirModel(p, title) {
    var alt = String(p.alt_tip || p.subtype || 'terazi').toLowerCase().trim();
    if (alt === 'karo' || alt === 'tiles') {
      var karolar = Array.isArray(p.karolar) ? p.karolar : ['x', 'x', '+1', '+1', '+1'];
      var outK = svgHeader(460, 170, title || 'Cebir Karoları Modeli');
      var cx = 36;
      karolar.slice(0, 10).forEach(function (k) {
        var s = String(k).trim();
        var isX2 = s.indexOf('x^2') >= 0 || s.indexOf('x²') >= 0;
        var isX = !isX2 && s.toLowerCase().indexOf('x') >= 0;
        var isNeg = s.indexOf('-') === 0;
        var wBox = isX2 ? 64 : (isX ? 46 : 30);
        var hBox = isX2 ? 64 : (isX ? 64 : 30);
        var bg = isNeg ? COLORS.crimsonSoft : (isX2 ? COLORS.blueSoft : (isX ? COLORS.amberSoft : COLORS.emeraldSoft));
        var stroke = isNeg ? COLORS.crimson : (isX2 ? COLORS.blue : (isX ? COLORS.amber : COLORS.emerald));
        outK += '<rect x="' + cx + '" y="' + (98 - hBox / 2) + '" width="' + wBox + '" height="' + hBox + '" rx="6" fill="' + bg + '" stroke="' + stroke + '" stroke-width="2"/>';
        outK += '<text x="' + (cx + wBox / 2) + '" y="' + (103) + '" text-anchor="middle" font-size="13" font-weight="800" fill="' + COLORS.navy + '">' + esc(s) + '</text>';
        cx += wBox + 10;
      });
      outK += '</svg>';
      return outK;
    }

    var sol = Array.isArray(p.sol_kefe) ? p.sol_kefe : ['x', 'x', '3'];
    var sag = Array.isArray(p.sag_kefe) ? p.sag_kefe : ['11'];
    var out = svgHeader(460, 224, title || 'Eşit Kollu Denklem Terazisi');

    // Taban ve destek
    out += '<polygon points="200,204 260,204 230,148" fill="' + COLORS.navy + '"/>';
    out += '<line x1="92" y1="148" x2="368" y2="148" stroke="' + COLORS.navy + '" stroke-width="5" stroke-linecap="round"/>';
    out += '<circle cx="230" cy="148" r="6" fill="' + COLORS.amber + '" stroke="#FFFFFF" stroke-width="2"/>';

    // Sol ve sağ kefeler
    out += '<path d="M 60 144 Q 116 164 172 144 Z" fill="' + COLORS.slate + '"/>';
    out += '<path d="M 288 144 Q 344 164 400 144 Z" fill="' + COLORS.slate + '"/>';

    function drawWeights(arr, centerX) {
      var totalW = arr.length * 36 + Math.max(0, arr.length - 1) * 6;
      var sx = centerX - totalW / 2;
      arr.slice(0, 4).forEach(function (item, idx) {
        var str = String(item);
        var isVar = /[a-zA-Z]/.test(str);
        var bx = sx + idx * 42;
        out += '<rect x="' + bx.toFixed(1) + '" y="106" width="36" height="36" rx="7" fill="' + (isVar ? COLORS.amber : COLORS.blue) + '" stroke="#FFFFFF" stroke-width="2"/>';
        out += '<text x="' + (bx + 18).toFixed(1) + '" y="129" text-anchor="middle" font-size="13" font-weight="800" fill="#FFFFFF">' + esc(str) + '</text>';
      });
    }
    drawWeights(sol, 116);
    drawWeights(sag, 344);
    out += '</svg>';
    return out;
  }

  /* ========================================================================
     6. TEMİZ HTML TABLOSU — ASLA UYDURMA "Veri 1: 12" ÜRETMEZ
     ======================================================================== */
  function renderHtmlTable(p, title) {
    var headers = Array.isArray(p.basliklar) ? p.basliklar : (Array.isArray(p.headers) ? p.headers : []);
    var rows = Array.isArray(p.satirlar) ? p.satirlar : (Array.isArray(p.rows) ? p.rows : []);

    // Boş veya uydurma placeholder tablo verilerini kesinlikle reddet
    if (!headers.length || !rows.length) return '';
    var flat = rows.map(function (r) { return Array.isArray(r) ? r.join(' ') : String(r); }).join(' ');
    if (/veri\s*1/i.test(flat) && /veri\s*2/i.test(flat)) return '';

    var ths = headers.map(function (h) {
      return '<th style="padding:10px 14px;background:#0F172A;color:#FFFFFF;font-weight:700;font-size:12.5px;text-align:center;border:1px solid #1E293B;">' + esc(h) + '</th>';
    }).join('');

    var trs = rows.slice(0, 8).map(function (row, idx) {
      var cells = (Array.isArray(row) ? row : [row]).slice(0, headers.length).map(function (val) {
        return '<td style="padding:9px 14px;color:#0F172A;font-size:13px;font-weight:600;text-align:center;border:1px solid #E2DDD5;">' + esc(val) + '</td>';
      }).join('');
      return '<tr style="background:' + (idx % 2 === 0 ? '#FAF8F5' : '#FFFFFF') + ';">' + cells + '</tr>';
    }).join('');

    return '<div class="vme-table-wrap" style="background:#FFFFFF;border:1.5px solid #E2DDD5;border-radius:12px;padding:12px 14px;overflow-x:auto;margin:8px 0;">' +
      (title ? '<div style="font-size:13px;font-weight:800;color:#0F172A;text-align:center;margin-bottom:8px;">' + esc(title) + '</div>' : '') +
      '<table class="vme-table" style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;">' +
      '<thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  }

  /* ========================================================================
     ANA RENDER API (7 Görsel Türü + Geriye Dönük Legacy Köprü)
     ======================================================================== */
  function render(gorselTipi, gorselParametreleri, baslik) {
    var tip = String(gorselTipi || '').toLowerCase().trim();
    if (!tip || tip === 'yok' || tip === 'none') return '';
    var p = parseParams(gorselParametreleri);
    var title = baslik || p.baslik || p.title || '';

    // Yeni 7 standart tür
    if (tip === 'geometri') return renderGeometri(p, title);
    if (tip === 'sayi_dogrusu_kesir') return renderSayiDogrusuKesir(p, title);
    if (tip === 'fonksiyon_grafik') return renderFonksiyonGrafik(p, title);
    if (tip === 'veri_grafigi') return renderVeriGrafigi(p, title);
    if (tip === 'cebir_model') return renderCebirModel(p, title);
    if (tip === 'tablo') return renderHtmlTable(p, title);

    // Geriye dönük eski visualSpec tipleri
    if (tip === 'place_value_table') return renderPlaceValue(p, title);
    if (tip === 'fraction_model') return renderFraction(p, title, p.style === 'pie' ? 'pie' : 'bar');
    if (tip === 'number_line') return renderNumberLine(p, title);
    if (tip === 'grid_geometry') return renderGeometri(p, title);
    if (tip === 'bar_chart') return renderVeriGrafigi(p, title);
    if (tip === 'data_table') return renderHtmlTable(p, title);

    return '';
  }

  function renderToSvg(visualSpec) {
    if (!visualSpec || typeof visualSpec !== 'object') return '';
    return render(
      visualSpec.gorsel_tipi || visualSpec.type,
      visualSpec.gorsel_parametreleri || visualSpec.data || visualSpec.dataJson || visualSpec,
      visualSpec.gorsel_baslik || visualSpec.title || ''
    );
  }

  function renderFromQuestion(q) {
    if (!q || typeof q !== 'object') return '';
    if (q.gorsel_tipi && q.gorsel_tipi !== 'yok') {
      var out = render(q.gorsel_tipi, q.gorsel_parametreleri, q.gorsel_baslik || '');
      if (out) return out;
    }
    if (q.visualSpec && typeof q.visualSpec === 'object') {
      var outSpec = renderToSvg(q.visualSpec);
      if (outSpec) return outSpec;
    }
    if (typeof q.visualHtml === 'string' && q.visualHtml.trim()) return q.visualHtml.trim();
    if (typeof q.svg === 'string' && q.svg.trim().indexOf('<svg') === 0) return q.svg.trim();
    return '';
  }

  /* ========================================================================
     DÜRÜST METİN TABANLI FALLBACK (ASLA UYDURMA TABLO ÜRETMEZ!)
     Sadece metinde somut açı/kesir/bölük/şekil verisi varsa parametrik çizer.
     ======================================================================== */
  function inferVisualSpecFromText(text, topic, grade) {
    var t = String(text || '');
    var low = (t + ' ' + String(topic || '')).toLowerCase();

    // 1. Temel Geometri: Işın, Doğru Parçası, Dikme, Paralel/Kesişen Doğrular, Açı/Açıölçer
    if (low.indexOf('dikme') >= 0 || low.indexOf('en kısa yol') >= 0) {
      return { gorsel_tipi: 'geometri', gorsel_baslik: 'Dikme ve En Kısa Yol', gorsel_parametreleri: { alt_tip: 'dikme' } };
    }
    if (low.indexOf('ışın') >= 0) {
      return { gorsel_tipi: 'geometri', gorsel_baslik: 'Işın Modeli', gorsel_parametreleri: { alt_tip: 'isin', nokta1: 'A', nokta2: 'B' } };
    }
    if (low.indexOf('doğru parçası') >= 0) {
      var segLen = t.match(/\b\d{1,3}\s*(?:cm|m)\b/i);
      return { gorsel_tipi: 'geometri', gorsel_baslik: 'Doğru Parçası Modeli', gorsel_parametreleri: { alt_tip: 'dogru_parcasi', nokta1: 'A', nokta2: 'B', uzunluk: segLen ? segLen[0] : '' } };
    }
    if (low.indexOf('paralel') >= 0) {
      return { gorsel_tipi: 'geometri', gorsel_baslik: 'Paralel Doğrular', gorsel_parametreleri: { alt_tip: 'paralel_kesisen', durum: 'paralel' } };
    }
    if (low.indexOf('silindir') >= 0 || low.indexOf('koni') >= 0 || low.indexOf('prizma') >= 0) {
      var cisim = low.indexOf('koni') >= 0 ? 'koni' : (low.indexOf('prizma') >= 0 ? 'prizma' : 'silindir');
      return { gorsel_tipi: 'geometri', gorsel_baslik: 'Katı Cisim Modeli', gorsel_parametreleri: { alt_tip: 'kati_cisim', sekil: cisim } };
    }
    if (low.indexOf('açıölçer') >= 0 || low.indexOf('iletki') >= 0 || low.indexOf('açı') >= 0) {
      var degMatch = t.match(/\b(\d{1,3})\s*(?:°|\^\\circ|derece)/i);
      var deg = degMatch ? clamp(Number(degMatch[1]), 10, 175) : 65;
      var useProtractor = low.indexOf('açıölçer') >= 0 || low.indexOf('iletki') >= 0 || low.indexOf('ölçme') >= 0;
      return {
        gorsel_tipi: 'geometri',
        gorsel_baslik: useProtractor ? 'Açıölçer (İletki) Modeli' : 'Açı Modeli',
        gorsel_parametreleri: {
          alt_tip: useProtractor ? 'aciolcer' : 'aci',
          aci_derece: deg,
          olcu_goster: !useProtractor
        }
      };
    }

    // 2. Kesir
    var fracMatch = t.match(/\b([1-9])\s*\/\s*([2-9]|1[0-2])\b/);
    if (fracMatch) {
      var n = Number(fracMatch[1]), d = Number(fracMatch[2]);
      return {
        gorsel_tipi: 'sayi_dogrusu_kesir',
        gorsel_baslik: 'Kesir Modeli',
        gorsel_parametreleri: {
          alt_tip: (low.indexOf('pizza') >= 0 || low.indexOf('pasta') >= 0) ? 'kesir_daire' : 'kesir_dikdortgen',
          pay: Math.min(n, d),
          payda: d
        }
      };
    }

    // 3. Milyonlar / Bölük Tablosu
    var bigNum = t.match(/\b\d{1,3}(?:[\s.]\d{3}){2}\b/) || t.match(/\b\d{7,9}\b/);
    if (bigNum && (low.indexOf('bölük') >= 0 || low.indexOf('milyon') >= 0 || low.indexOf('basamak') >= 0)) {
      return {
        gorsel_tipi: 'sayi_dogrusu_kesir',
        gorsel_baslik: 'Bölük ve Basamak Tablosu',
        gorsel_parametreleri: { alt_tip: 'boluk_tablosu', sayi: bigNum[0] }
      };
    }

    // 4. Üçgen / Dikdörtgen / Kare / Çember
    if (low.indexOf('üçgen') >= 0) {
      return {
        gorsel_tipi: 'geometri',
        gorsel_baslik: 'Üçgen Modeli',
        gorsel_parametreleri: { alt_tip: 'ucgen', dik_ucgen: low.indexOf('dik üçgen') >= 0 }
      };
    }
    if (low.indexOf('çember') >= 0 || low.indexOf('yarıçap') >= 0) {
      return {
        gorsel_tipi: 'geometri',
        gorsel_baslik: 'Çember Modeli',
        gorsel_parametreleri: { alt_tip: 'cember' }
      };
    }
    if (low.indexOf('dikdörtgen') >= 0 || low.indexOf('kare') >= 0) {
      var dims = t.match(/\b\d{1,3}\s*(?:cm|m)\b/gi) || [];
      return {
        gorsel_tipi: 'geometri',
        gorsel_baslik: low.indexOf('kare') >= 0 ? 'Kare Modeli' : 'Dikdörtgen Modeli',
        gorsel_parametreleri: {
          alt_tip: 'dortgen',
          sekil: low.indexOf('kare') >= 0 ? 'kare' : 'dikdortgen',
          uzun_kenar: dims[0] || '',
          kisa_kenar: dims[1] || ''
        }
      };
    }

    // 5. Fonksiyon / Parabol / Koordinat
    if (low.indexOf('parabol') >= 0 || low.indexOf('fonksiyon') >= 0 || low.indexOf('türev') >= 0 || low.indexOf('integral') >= 0) {
      return {
        gorsel_tipi: 'fonksiyon_grafik',
        gorsel_baslik: 'Fonksiyon Grafiği',
        gorsel_parametreleri: { alt_tip: low.indexOf('doğrusal') >= 0 ? 'dogru' : 'parabol', a: 1, b: 0, c: -2 }
      };
    }

    // Uydurma tablo YOK — görsel net değilse boş dön!
    return null;
  }

  return {
    render: render,
    renderToSvg: renderToSvg,
    renderFromQuestion: renderFromQuestion,
    inferVisualSpecFromText: inferVisualSpecFromText,
    COLORS: COLORS
  };
});
