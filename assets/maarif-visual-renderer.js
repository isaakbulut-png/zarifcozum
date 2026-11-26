/* ==========================================================================
   ZarifÇözüm — Deterministik MEB Maarif Modeli Matematik Görsel Motoru (UMD)
   Ham LLM SVG hatalarını ortadan kaldırır; 6 temel pedagojik diyagramı
   yayınevi kalitesinde, hatasız ve güvenli SVG olarak üretir.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ZarifVisualRenderer = factory();
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeParseData(spec) {
    if (!spec || typeof spec !== 'object') return {};
    if (spec.data && typeof spec.data === 'object') return spec.data;
    if (typeof spec.dataJson === 'string' && spec.dataJson.trim()) {
      try { return JSON.parse(spec.dataJson); } catch (_) { return {}; }
    }
    return spec;
  }

  /* 1. Bölük & Basamak Değeri Tablosu (5. Sınıf Doğal Sayılar) */
  function renderPlaceValueTable(title, d) {
    const rawNum = String(d.number || d.sayi || '42307085').replace(/\D/g, '');
    const padded = rawNum.padStart(9, ' ').slice(-9);
    const groups = [
      { name: 'MİLYONLAR BÖLÜĞÜ', bg: '#EFF6FF', border: '#2563EB', digits: padded.slice(0, 3) },
      { name: 'BİNLER BÖLÜĞÜ',    bg: '#FEF3C7', border: '#D97706', digits: padded.slice(3, 6) },
      { name: 'BİRLER BÖLÜĞÜ',    bg: '#ECFDF5', border: '#059669', digits: padded.slice(6, 9) }
    ];
    let body = '';
    groups.forEach((g, gi) => {
      const gx = 20 + gi * 160;
      body += `<rect x="${gx}" y="44" width="148" height="120" rx="10" fill="${g.bg}" stroke="${g.border}" stroke-width="2"/>`;
      body += `<text x="${gx + 74}" y="66" text-anchor="middle" font-size="10.5" font-weight="800" fill="${g.border}">${g.name}</text>`;
      for (let i = 0; i < 3; i++) {
        const ch = g.digits[i].trim();
        const bx = gx + 10 + i * 44;
        body += `<rect x="${bx}" y="80" width="38" height="52" rx="7" fill="#FFFFFF" stroke="${g.border}" stroke-width="1.5"/>`;
        body += `<text x="${bx + 19}" y="114" text-anchor="middle" font-size="22" font-weight="800" fill="#0F172A">${esc(ch || '—')}</text>`;
      }
    });
    return `<svg viewBox="0 0 510 190" xmlns="http://www.w3.org/2000/svg">
      <rect width="510" height="190" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <text x="255" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">${esc(title || 'Bölük ve Basamak Tablosu')}</text>
      ${body}
    </svg>`;
  }

  /* 2. Kesir Modeli (Çubuk veya Pasta Dilimi — 5-6. Sınıf) */
  function renderFractionModel(title, d) {
    const num = Math.max(1, Math.min(12, Number(d.numerator || d.pay || 3)));
    const den = Math.max(num, Math.min(12, Number(d.denominator || d.payda || 4)));
    const mode = d.style === 'pie' ? 'pie' : 'bar';

    if (mode === 'pie') {
      let slices = '';
      for (let i = 0; i < den; i++) {
        const a1 = (i / den) * 2 * Math.PI - Math.PI / 2;
        const a2 = ((i + 1) / den) * 2 * Math.PI - Math.PI / 2;
        const x1 = 250 + 70 * Math.cos(a1), y1 = 115 + 70 * Math.sin(a1);
        const x2 = 250 + 70 * Math.cos(a2), y2 = 115 + 70 * Math.sin(a2);
        const large = (a2 - a1) > Math.PI ? 1 : 0;
        const fill = i < num ? '#D97706' : '#F1F5F9';
        slices += `<path d="M250,115 L${x1.toFixed(1)},${y1.toFixed(1)} A70,70 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${fill}" stroke="#0F172A" stroke-width="2"/>`;
      }
      return `<svg viewBox="0 0 500 215" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="215" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <text x="250" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">${esc(title || 'Kesir Daire Modeli')}</text>
        ${slices}
        <text x="250" y="202" text-anchor="middle" font-size="13" font-weight="800" fill="#334155">Boyalı Bölge: ${num} / ${den} (${den} eş parçadan ${num} tanesi)</text>
      </svg>`;
    }

    const barW = 420;
    const cellW = barW / den;
    let cells = '';
    for (let i = 0; i < den; i++) {
      const x = 40 + i * cellW;
      const fill = i < num ? '#D97706' : '#F8FAFC';
      cells += `<rect x="${x.toFixed(1)}" y="70" width="${cellW.toFixed(1)}" height="64" fill="${fill}" stroke="#0F172A" stroke-width="2"/>`;
      cells += `<text x="${(x + cellW / 2).toFixed(1)}" y="108" text-anchor="middle" font-size="12" font-weight="800" fill="${i < num ? '#FFFFFF' : '#64748B'}">1/${den}</text>`;
    }
    return `<svg viewBox="0 0 500 185" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="185" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <text x="250" y="30" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">${esc(title || 'Kesir Şerit Modeli')}</text>
      ${cells}
      <text x="250" y="162" text-anchor="middle" font-size="13" font-weight="800" fill="#334155">Modellenen Kesir: ${num} / ${den}</text>
    </svg>`;
  }

  /* 3. Sayı Doğrusu */
  function renderNumberLine(title, d) {
    const min = Number.isFinite(Number(d.min)) ? Number(d.min) : 0;
    const max = Number.isFinite(Number(d.max)) ? Number(d.max) : 4;
    const span = Math.max(1, max - min);
    const steps = Math.min(10, Math.max(2, Number(d.steps || span)));
    const markers = Array.isArray(d.markers) ? d.markers : [];

    let ticks = '';
    for (let i = 0; i <= steps; i++) {
      const x = 50 + (i / steps) * 400;
      const val = Number((min + (i / steps) * span).toFixed(1));
      ticks += `<line x1="${x.toFixed(1)}" y1="92" x2="${x.toFixed(1)}" y2="108" stroke="#0F172A" stroke-width="2"/>`;
      ticks += `<text x="${x.toFixed(1)}" y="128" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${val}</text>`;
    }

    let pts = '';
    markers.forEach((m) => {
      const v = Number(m.value);
      if (!Number.isFinite(v)) return;
      const ratio = Math.max(0, Math.min(1, (v - min) / span));
      const x = 50 + ratio * 400;
      pts += `<circle cx="${x.toFixed(1)}" cy="100" r="7" fill="#D97706" stroke="#FFFFFF" stroke-width="2"/>`;
      pts += `<text x="${x.toFixed(1)}" y="80" text-anchor="middle" font-size="13" font-weight="800" fill="#B45309">${esc(m.label || v)}</text>`;
    });

    return `<svg viewBox="0 0 500 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="160" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <text x="250" y="28" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">${esc(title || 'Sayı Doğrusu Modeli')}</text>
      <line x1="32" y1="100" x2="468" y2="100" stroke="#0F172A" stroke-width="3"/>
      <polygon points="468,94 480,100 468,106" fill="#0F172A"/>
      <polygon points="32,94 20,100 32,106" fill="#0F172A"/>
      ${ticks}
      ${pts}
    </svg>`;
  }

  /* 4. Kareli Zemin Geometri (Dikdörtgen / Kare / Üçgen) */
  function renderGridGeometry(title, d) {
    const shape = String(d.shape || 'rectangle').toLowerCase();
    const wLabel = esc(d.widthLabel || d.uzunKenar || '12 cm');
    const hLabel = esc(d.heightLabel || d.kisaKenar || '8 cm');

    let grid = '';
    for (let x = 30; x <= 470; x += 22) grid += `<line x1="${x}" y1="42" x2="${x}" y2="218" stroke="#E2E8F0" stroke-width="1"/>`;
    for (let y = 42; y <= 218; y += 22) grid += `<line x1="30" y1="${y}" x2="470" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`;

    let fig = '';
    if (shape === 'triangle') {
      fig = `<polygon points="250,64 118,196 382,196" fill="rgba(217,119,6,0.16)" stroke="#0F172A" stroke-width="3" stroke-linejoin="round"/>
        <text x="250" y="56" text-anchor="middle" font-size="14" font-weight="800" fill="#0F172A">A</text>
        <text x="104" y="202" text-anchor="middle" font-size="14" font-weight="800" fill="#0F172A">B</text>
        <text x="396" y="202" text-anchor="middle" font-size="14" font-weight="800" fill="#0F172A">C</text>
        <text x="250" y="214" text-anchor="middle" font-size="12.5" font-weight="800" fill="#B45309">${wLabel}</text>`;
    } else {
      const rw = shape === 'square' ? 132 : 220;
      const rh = 132;
      const rx = 250 - rw / 2;
      const ry = 64;
      fig = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgba(5,150,105,0.14)" stroke="#059669" stroke-width="3"/>
        <text x="${rx - 12}" y="${ry - 4}" font-size="13" font-weight="800" fill="#0F172A">A</text>
        <text x="${rx + rw + 6}" y="${ry - 4}" font-size="13" font-weight="800" fill="#0F172A">B</text>
        <text x="${rx + rw + 6}" y="${ry + rh + 14}" font-size="13" font-weight="800" fill="#0F172A">C</text>
        <text x="${rx - 12}" y="${ry + rh + 14}" font-size="13" font-weight="800" fill="#0F172A">D</text>
        <text x="250" y="${ry - 8}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#059669">${wLabel}</text>
        <text x="${rx + rw + 14}" y="${ry + rh / 2 + 4}" font-size="12.5" font-weight="800" fill="#059669">${hLabel}</text>`;
    }

    return `<svg viewBox="0 0 500 236" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="236" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <text x="250" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">${esc(title || 'Birim Kareli Zemin Modeli')}</text>
      ${grid}
      ${fig}
    </svg>`;
  }

  /* 5. Sütun Grafiği (Veri İşleme) */
  function renderBarChart(title, d) {
    const items = Array.isArray(d.items) && d.items.length
      ? d.items.slice(0, 6)
      : [{ label: 'Pzt', value: 12 }, { label: 'Sal', value: 18 }, { label: 'Çar', value: 15 }, { label: 'Per', value: 24 }];
    const maxVal = Math.max(1, ...items.map(i => Number(i.value) || 0));
    const palette = ['#2563EB', '#D97706', '#059669', '#7C3AED', '#DC2626', '#0F172A'];
    const slotW = 380 / items.length;

    let bars = '';
    items.forEach((it, idx) => {
      const val = Number(it.value) || 0;
      const bh = Math.max(10, (val / maxVal) * 130);
      const bx = 70 + idx * slotW + slotW * 0.18;
      const bw = slotW * 0.64;
      const by = 186 - bh;
      const col = palette[idx % palette.length];
      bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="6" fill="${col}"/>`;
      bars += `<text x="${(bx + bw / 2).toFixed(1)}" y="${(by - 6).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#0F172A">${val}</text>`;
      bars += `<text x="${(bx + bw / 2).toFixed(1)}" y="204" text-anchor="middle" font-size="11.5" font-weight="700" fill="#475569">${esc(String(it.label || '').slice(0, 10))}</text>`;
    });

    return `<svg viewBox="0 0 500 222" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="222" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <text x="250" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">${esc(title || 'Sütun Grafiği')}</text>
      <line x1="60" y1="46" x2="60" y2="186" stroke="#0F172A" stroke-width="2"/>
      <line x1="60" y1="186" x2="460" y2="186" stroke="#0F172A" stroke-width="2"/>
      ${bars}
    </svg>`;
  }

  /* 6. Veri Tablosu Kartı */
  function renderDataTable(title, d) {
    const headers = Array.isArray(d.headers) && d.headers.length ? d.headers : ['Kategori', 'Miktar'];
    const rows = Array.isArray(d.rows) && d.rows.length ? d.rows.slice(0, 5) : [['Veri 1', '12'], ['Veri 2', '18']];
    const colW = 440 / headers.length;
    const hTotal = 78 + rows.length * 32;

    let cells = `<rect x="30" y="42" width="440" height="32" rx="6" fill="#0F172A"/>`;
    headers.forEach((h, i) => {
      cells += `<text x="${(30 + i * colW + colW / 2).toFixed(1)}" y="63" text-anchor="middle" font-size="12" font-weight="800" fill="#FFFFFF">${esc(h)}</text>`;
    });

    rows.forEach((row, rIdx) => {
      const y = 74 + rIdx * 32;
      cells += `<rect x="30" y="${y}" width="440" height="32" fill="${rIdx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'}" stroke="#E2E8F0" stroke-width="1"/>`;
      (Array.isArray(row) ? row : []).slice(0, headers.length).forEach((val, cIdx) => {
        cells += `<text x="${(30 + cIdx * colW + colW / 2).toFixed(1)}" y="${y + 21}" text-anchor="middle" font-size="12" font-weight="600" fill="#1E293B">${esc(val)}</text>`;
      });
    });

    return `<svg viewBox="0 0 500 ${hTotal + 16}" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="${hTotal + 16}" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <text x="250" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">${esc(title || 'Veri Tablosu')}</text>
      ${cells}
    </svg>`;
  }

  function renderToSvg(visualSpec) {
    if (!visualSpec || typeof visualSpec !== 'object') return '';
    const type = String(visualSpec.type || '').toLowerCase().trim();
    if (!type || type === 'none') return '';
    const title = visualSpec.title || '';
    const d = safeParseData(visualSpec);

    switch (type) {
      case 'place_value_table': return renderPlaceValueTable(title, d);
      case 'fraction_model':    return renderFractionModel(title, d);
      case 'number_line':       return renderNumberLine(title, d);
      case 'grid_geometry':     return renderGridGeometry(title, d);
      case 'bar_chart':         return renderBarChart(title, d);
      case 'data_table':        return renderDataTable(title, d);
      default: return '';
    }
  }

  /* Soru metninden otomatik akıllı visualSpec çıkarıcı (özellikle 5-6. sınıf fallback) */
  function inferVisualSpecFromText(text, topic, grade) {
    const t = String(text || '');
    const low = (t + ' ' + String(topic || '')).toLowerCase();

    const fracMatch = t.match(/\b([1-9])\s*\/\s*([2-9]|1[0-2])\b/);
    if (fracMatch || low.includes('kesir')) {
      const n = fracMatch ? Number(fracMatch[1]) : 3;
      const d = fracMatch ? Number(fracMatch[2]) : 4;
      return { type: 'fraction_model', title: 'Kesir Modeli', data: { numerator: Math.min(n, d), denominator: d, style: low.includes('pasta') || low.includes('pizza') ? 'pie' : 'bar' } };
    }

    const bigNum = t.match(/\b\d{1,3}(?:[\s.]\d{3}){2}\b/) || t.match(/\b\d{7,9}\b/);
    if (bigNum || low.includes('bölük') || low.includes('milyon')) {
      return { type: 'place_value_table', title: 'Bölük Tablosu', data: { number: bigNum ? bigNum[0] : '42307085' } };
    }

    if (low.includes('grafik') || low.includes('sütun') || low.includes('istatistik')) {
      return { type: 'bar_chart', title: 'Örnek Sütun Grafiği', data: {} };
    }

    if (low.includes('dikdörtgen') || low.includes('kare') || low.includes('çevre') || low.includes('alan')) {
      const nums = t.match(/\b\d{1,2}\s*(?:cm|m)\b/gi) || [];
      return {
        type: 'grid_geometry',
        title: low.includes('kare') ? 'Birim Kareli Zemin (Kare)' : 'Birim Kareli Zemin (Dikdörtgen)',
        data: {
          shape: low.includes('kare') ? 'square' : 'rectangle',
          widthLabel: nums[0] || '12 cm',
          heightLabel: nums[1] || '8 cm'
        }
      };
    }

    if (low.includes('üçgen')) {
      return { type: 'grid_geometry', title: 'Birim Kareli Zemin (Üçgen)', data: { shape: 'triangle', widthLabel: 'Taban' } };
    }

    if (low.includes('sayı doğrusu') || low.includes('sırala')) {
      return { type: 'number_line', title: 'Sayı Doğrusu', data: { min: 0, max: 4, steps: 8 } };
    }

    if (Number(grade) === 5) {
      return { type: 'data_table', title: 'Verilen Bilgiler Özeti', data: { headers: ['Adım', 'İnceleme'], rows: [['Verilenler', 'Soru metnini oku'], ['İstenen', 'Adım adım hesapla']] } };
    }

    return null;
  }

  return {
    renderToSvg: renderToSvg,
    inferVisualSpecFromText: inferVisualSpecFromText
  };
});
