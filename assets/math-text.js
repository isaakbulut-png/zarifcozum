(function (root) {
  'use strict';

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function format(value) {
    const text = String(value ?? '');
    const exponent = /([\p{L}\p{N})\]])\^\s*(?:\{([+-]?\d+|[a-zA-Z](?:[+-]\d+)?)\}|\(([+-]?\d+)\)|([+-]?\d+|[a-zA-Z]))(?![\p{L}\p{N}{}^])/gu;
    let result = '';
    let start = 0;
    for (const match of text.matchAll(exponent)) {
      result += escapeHtml(text.slice(start, match.index));
      result += escapeHtml(match[1]) + '<sup>' + escapeHtml(match[2] || match[3] || match[4]) + '</sup>';
      start = match.index + match[0].length;
    }
    return result + escapeHtml(text.slice(start));
  }

  const api = {format};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.zarifMathText = api;
})(typeof window !== 'undefined' ? window : globalThis);
