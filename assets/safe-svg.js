(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.zarifSafeSvg = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const namespace = 'http://www.w3.org/2000/svg';
  const tags = {
    svg: ['viewBox', 'width', 'height'],
    g: [],
    path: ['d'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
    circle: ['cx', 'cy', 'r'],
    ellipse: ['cx', 'cy', 'rx', 'ry'],
    line: ['x1', 'y1', 'x2', 'y2'],
    polyline: ['points'],
    polygon: ['points'],
    text: ['x', 'y'],
    tspan: ['x', 'y', 'dx', 'dy']
  };
  const common = [
    'fill', 'stroke', 'stroke-width', 'opacity', 'font-size', 'text-anchor',
    'font-weight', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
    'font-family', 'transform', 'dx', 'dy'
  ];
  const numeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const color = /^(?:none|transparent|black|white|red|blue|green|gray|grey|orange|purple|yellow|#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8})$/i;

  function invalid() { throw new TypeError('SVG yalnızca güvenli temel şekiller ve geçerli değerler içermelidir.'); }

  // SVG <text> ve <tspan> içindeki ham LaTeX kodlarını temizleyen ve Unicode eşdeğerlerine dönüştüren filtre
  function sanitizeSvgText(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str;
    // $ işaretlerini temizle
    s = s.replace(/\$([^$]+)\$/g, '$1');
    s = s.replace(/\$/g, '');

    // LaTeX sembolleri -> Unicode
    s = s.replace(/\\perp\b/g, '⊥');
    s = s.replace(/\\parallel\b/g, '∥');
    s = s.replace(/\\angle\b/g, '∠');
    s = s.replace(/\\widehat\{([^}]+)\}/g, '$1̂');
    s = s.replace(/\\circ\b|\\degree\b|\^\\circ\b/g, '°');
    s = s.replace(/\^\{\\circ\}/g, '°');
    s = s.replace(/\\cdot\b/g, '·');
    s = s.replace(/\\times\b/g, '×');
    s = s.replace(/\\pm\b/g, '±');
    s = s.replace(/\\alpha\b/g, 'α');
    s = s.replace(/\\beta\b/g, 'β');
    s = s.replace(/\\theta\b/g, 'θ');
    s = s.replace(/\\pi\b/g, 'π');

    // Üslü ifadeler: örn: x^2 -> x², 3^{x-1} -> 3ˣ⁻¹
    const sup = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', 'x': 'ˣ', 'y': 'ʸ', 'n': 'ⁿ', 'k': 'ᵏ' };
    s = s.replace(/\^\{([^}]+)\}/g, (_, exp) => exp.split('').map(c => sup[c] || c).join(''));
    s = s.replace(/\^([0-9a-zA-Z+-])/g, (_, c) => sup[c] || `^${c}`);

    // Alt indisler: örn: y_K -> yₖ, x_1 -> x₁
    const sub = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'x': 'ₓ', 'y': 'ᵧ', 'k': 'ₖ', 'K': 'ₖ', 'A': 'ₐ', 'B': 'ᵦ', 'n': 'ₙ' };
    s = s.replace(/_\{([^}]+)\}/g, (_, exp) => exp.split('').map(c => sub[c] || c).join(''));
    s = s.replace(/_([0-9a-zA-Z])/g, (_, c) => sub[c] || `_${c}`);

    // Artakalan ters eğik çizgileri temizle
    s = s.replace(/\\([a-zA-Z]+)/g, '$1');

    return s;
  }

  function validate(input) {
    if (!input || JSON.stringify(input).length > 10000) invalid();
    let count = 0;
    function check(node, depth) {
      if (!node || typeof node !== 'object' || Array.isArray(node) ||
          Object.keys(node).some(key => !['tag', 'attrs', 'children', 'text'].includes(key)) ||
          !Object.hasOwn(tags, node.tag) || ++count > 100 || depth > 8 ||
          !node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs) ||
          !Array.isArray(node.children) || (depth === 0 ? node.tag !== 'svg' : node.tag === 'svg')) invalid();
      const attrs = {};
      for (const [key, value] of Object.entries(node.attrs)) {
        if (![...tags[node.tag], ...common].includes(key) || typeof value !== 'string' || value.length > 4096) invalid();
        if (key === 'd') {
          if (!/^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]+$/.test(value)) invalid();
        } else if (key === 'points' || key === 'viewBox') {
          const parts = value.trim().split(/[\s,]+/);
          if (!value.trim() || parts.length > 400 || (key === 'viewBox' && parts.length !== 4) ||
              parts.some(part => !numeric.test(part) || Math.abs(Number(part)) > 100000)) invalid();
          if (key === 'viewBox' && (Number(parts[2]) <= 0 || Number(parts[3]) <= 0)) invalid();
        } else if (key === 'fill' || key === 'stroke') {
          if (!color.test(value)) invalid();
        } else if (key === 'text-anchor') {
          if (!['start', 'middle', 'end'].includes(value)) invalid();
        } else if (key === 'font-weight') {
          if (!/^(?:normal|bold|bolder|lighter|[1-9]00)$/i.test(value)) invalid();
        } else if (key === 'stroke-linecap') {
          if (!['butt', 'round', 'square'].includes(value)) invalid();
        } else if (key === 'stroke-linejoin') {
          if (!['miter', 'round', 'bevel', 'arcs', 'miter-clip'].includes(value)) invalid();
        } else if (key === 'stroke-dasharray') {
          if (!/^[0-9\s,.-]+$/.test(value)) invalid();
        } else if (key === 'font-family') {
          if (!/^[a-zA-Z0-9\s,._-]+$/.test(value)) invalid();
        } else if (key === 'transform') {
          if (!/^[a-zA-Z0-9\s(),._+-]+$/.test(value)) invalid();
        } else if (!numeric.test(value) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > 100000) invalid();
        attrs[key] = value;
      }
      if (node.text !== undefined && (!['text', 'tspan'].includes(node.tag) || typeof node.text !== 'string' || node.text.length > 500)) invalid();
      if (node.tag === 'tspan' && node.children.length) invalid();
      if (!['svg', 'g', 'text'].includes(node.tag) && node.children.length) invalid();
      if (node.tag === 'text' && node.children.some(child => child.tag !== 'tspan')) invalid();

      const result = {tag: node.tag, attrs, children: node.children.map(child => check(child, depth + 1))};
      if (node.text !== undefined) result.text = sanitizeSvgText(node.text);
      return result;
    }
    return check(input, 0);
  }

  function parse(code) {
    if (typeof code !== 'string' || code.length > 10000 || /<!|<\?/.test(code)) invalid();
    const doc = new DOMParser().parseFromString(code, 'image/svg+xml');
    if (doc.querySelector('parsererror') || !doc.documentElement) invalid();
    function convert(element) {
      if ((element.namespaceURI !== namespace && element.namespaceURI !== null) || element.prefix) invalid();
      const attrs = {};
      for (const attr of element.attributes) {
        if (attr.name === 'xmlns' && attr.value === namespace) continue;
        if (attr.namespaceURI || attr.prefix) invalid();
        attrs[attr.name] = attr.value;
      }
      const children = [];
      let text = '';
      for (const child of element.childNodes) {
        if (child.nodeType === 1) children.push(convert(child));
        else if (child.nodeType === 3) text += child.nodeValue;
        else invalid();
      }
      if (!['text', 'tspan'].includes(element.localName) && text.trim()) invalid();
      const result = {tag: element.localName, attrs, children};
      if (['text', 'tspan'].includes(element.localName)) result.text = sanitizeSvgText(text);
      return result;
    }
    return validate(convert(doc.documentElement));
  }

  function render(target, input) {
    const data = validate(input);
    function create(node) {
      const element = document.createElementNS(namespace, node.tag);
      for (const [key, value] of Object.entries(node.attrs)) element.setAttribute(key, value);
      if (node.text !== undefined) element.textContent = sanitizeSvgText(node.text);
      node.children.forEach(child => element.append(create(child)));
      return element;
    }
    const svgEl = create(data);
    // ZarifÇözüm SVG Telif Metadata ve Silik Vektörel Filigran Katmanı
    try {
      const meta = document.createElementNS(namespace, 'metadata');
      meta.textContent = '© 2026 ZarifCozum. Tüm hakları saklıdır.';
      svgEl.prepend(meta);

      const vb = String(data.attrs?.viewBox || '0 0 420 200').trim().split(/[\s,]+/).map(Number);
      const cx = (vb[0] || 0) + ((vb[2] || 420) / 2);
      const cy = (vb[1] || 0) + ((vb[3] || 200) / 2);
      const wm = document.createElementNS(namespace, 'text');
      wm.setAttribute('x', String(Math.round(cx)));
      wm.setAttribute('y', String(Math.round(cy)));
      wm.setAttribute('text-anchor', 'middle');
      wm.setAttribute('font-family', 'Georgia, serif');
      wm.setAttribute('font-size', String(Math.max(14, Math.round((vb[2] || 420) / 16))));
      wm.setAttribute('font-weight', '700');
      wm.setAttribute('fill', '#3E2F26');
      wm.setAttribute('opacity', '0.06');
      wm.setAttribute('pointer-events', 'none');
      wm.setAttribute('transform', `rotate(-22 ${Math.round(cx)} ${Math.round(cy)})`);
      wm.textContent = '© ZarifÇözüm';
      svgEl.append(wm);
    } catch {}
    target.replaceChildren(svgEl);
  }

  return {validate, parse, render, sanitizeSvgText};
});
