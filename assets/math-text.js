(function (root) {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  // 1. Çıplak (dolar işareti içine alınmamış) LaTeX ve matematiksel ifadeleri $...$ içine alan ön temizleyici
  function normalizeBareMath(str) {
    if (!str || typeof str !== 'string') return '';

    // Halihazırda $...$ veya $$...$$ içinde olan kısımları ayır
    const parts = [];
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
    let lastIdx = 0;
    let match;
    while ((match = mathRegex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ isMath: false, text: str.slice(lastIdx, match.index) });
      }
      parts.push({ isMath: true, text: match[0] });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) {
      parts.push({ isMath: false, text: str.slice(lastIdx) });
    }

    return parts.map(part => {
      if (part.isMath) return part.text;
      let t = part.text;

      // a) [AB] \perp [AC] veya benzeri geometrik diklik/paralellik
      t = t.replace(/(\[[A-Z]{1,3}\]\s*\\perp\s*\[[A-Z]{1,3}\])/g, '$$$1$$');

      // b) Çıplak LaTeX komutları: örn \perp, \parallel, \widehat{BAC}, \frac{a}{b}, \sqrt{x}, \degree, \angle, \alpha vb.
      t = t.replace(/(\\[a-zA-Z]+(?:\{[^}\n]*\})*)/g, '$$$1$$');

      // c) Çıplak alt indisli değişkenler: örn: y_K, x_A, y_{K}
      t = t.replace(/(\b[a-zA-Z]_[A-Z0-9]\b|\b[a-zA-Z]_\{[a-zA-Z0-9+-]+\})/g, '$$$1$$');

      // d) Çıplak karmaşık üslü ifadeler: örn: 3^{x-1}, x^{2y+1} (içinde + veya - olan çoklu ifadeler)
      t = t.replace(/(\b[0-9a-zA-Z]\^\{[a-zA-Z0-9]+[+-][a-zA-Z0-9]+\})/g, '$$$1$$');

      // e) Geometrik uzunluk: |AB| = 4, |BC| = 5
      t = t.replace(/(\|[A-Z]{2}\|\s*=\s*\d+)/g, '$$$1$$');

      // f) Çift bitişik dolarları temizle
      t = t.replace(/\$\s*\$/g, '');

      return t;
    }).join('');
  }

  // 2. KaTeX kütüphanesi hazır olmadığında sembolleri temiz HTML/Unicode olarak biçimlendiren yedek motor
  function formatMathFallback(formula) {
    let s = formula;
    s = s.replace(/\\perp\b/g, '⊥');
    s = s.replace(/\\parallel\b/g, '∥');
    s = s.replace(/\\angle\b/g, '∠');
    s = s.replace(/\\widehat\{([^}]+)\}/g, '<span style="text-decoration:overline">$1</span>');
    s = s.replace(/\\circ\b/g, '°');
    s = s.replace(/\\degree\b/g, '°');
    s = s.replace(/\\cdot\b/g, '·');
    s = s.replace(/\\times\b/g, '×');
    s = s.replace(/\\leq\b|\\le\b/g, '≤');
    s = s.replace(/\\geq\b|\\ge\b/g, '≥');
    s = s.replace(/\\neq\b/g, '≠');
    s = s.replace(/\\pm\b/g, '±');
    s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
    s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
    s = s.replace(/\\sqrt\s*([0-9a-zA-Z]+)/g, '√$1');

    // Üs ve indisler
    s = s.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
    s = s.replace(/\^([0-9a-zA-Z])/g, '<sup>$1</sup>');
    s = s.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
    s = s.replace(/_([0-9a-zA-Z])/g, '<sub>$1</sub>');

    return escapeHtml(s)
      .replace(/&lt;sup&gt;(.*?)&lt;\/sup&gt;/g, '<sup>$1</sup>')
      .replace(/&lt;sub&gt;(.*?)&lt;\/sub&gt;/g, '<sub>$1</sub>')
      .replace(/&lt;span style=&quot;text-decoration:overline&quot;&gt;(.*?)&lt;\/span&gt;/g, '<span style="text-decoration:overline">$1</span>');
  }

  // 3. Klasik üslü ifade dönüştürücü (mevcut test spesifikasyonu ile %100 birebir)
  function formatLegacyExponent(text) {
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

  // 4. Ana Biçimlendirici Fonksiyon
  function format(value) {
    const raw = String(value ?? '');
    const katexAvail = typeof root !== 'undefined' && root.katex && typeof root.katex.renderToString === 'function';

    // KaTeX yoksa ve metinde $ veya \ bulunmuyorsa klasik dönüştürücü çalışır
    if (!katexAvail && !/\$|\\/.test(raw)) {
      return formatLegacyExponent(raw);
    }

    // Çıplak matematik ifadelerini $...$ ile zenginleştir
    const text = normalizeBareMath(raw);

    const hasMath = /\$[^$]+\$/.test(text);
    if (!hasMath && !katexAvail) {
      return formatLegacyExponent(text);
    }

    const mathBlockRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
    let result = '';
    let start = 0;
    let match;

    while ((match = mathBlockRegex.exec(text)) !== null) {
      if (match.index > start) {
        result += formatLegacyExponent(text.slice(start, match.index));
      }

      const token = match[0];
      const isDisplay = token.startsWith('$$');
      const formula = isDisplay ? token.slice(2, -2).trim() : token.slice(1, -1).trim();

      if (katexAvail) {
        try {
          result += root.katex.renderToString(formula, {
            displayMode: isDisplay,
            throwOnError: false,
            trust: false
          });
        } catch (e) {
          result += escapeHtml(formula);
        }
      } else {
        result += formatMathFallback(formula);
      }

      start = match.index + token.length;
    }

    if (start < text.length) {
      result += formatLegacyExponent(text.slice(start));
    }

    return result;
  }

  const api = { format, normalizeBareMath, escapeHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.zarifMathText = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
