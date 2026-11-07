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
    text: ['x', 'y']
  };
  const common = ['fill', 'stroke', 'stroke-width', 'opacity', 'font-size', 'text-anchor'];
  const numeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const color = /^(?:none|transparent|black|white|red|blue|green|gray|grey|orange|purple|yellow|#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8})$/i;

  function invalid() { throw new TypeError('SVG yalnızca güvenli temel şekiller ve geçerli değerler içermelidir.'); }
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
        } else if (!numeric.test(value) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > 100000) invalid();
        attrs[key] = value;
      }
      if (node.text !== undefined && (node.tag !== 'text' || typeof node.text !== 'string' || node.text.length > 500)) invalid();
      if (node.tag === 'text' && node.children.length) invalid();
      if (!['svg', 'g'].includes(node.tag) && node.tag !== 'text' && node.children.length) invalid();
      const result = {tag: node.tag, attrs, children: node.children.map(child => check(child, depth + 1))};
      if (node.text !== undefined) result.text = node.text;
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
      if (element.localName !== 'text' && text.trim()) invalid();
      const result = {tag: element.localName, attrs, children};
      if (element.localName === 'text') result.text = text;
      return result;
    }
    return validate(convert(doc.documentElement));
  }
  function render(target, input) {
    const data = validate(input);
    function create(node) {
      const element = document.createElementNS(namespace, node.tag);
      for (const [key, value] of Object.entries(node.attrs)) element.setAttribute(key, value);
      if (node.text !== undefined) element.textContent = node.text;
      node.children.forEach(child => element.append(create(child)));
      return element;
    }
    target.replaceChildren(create(data));
  }
  return {validate, parse, render};
});
