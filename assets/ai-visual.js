(function () {
  const tokenPattern = /<figure\b[\s\S]*?<\/figure\s*>|<table\b[\s\S]*?<\/table\s*>|<svg\b[\s\S]*?<\/svg\s*>|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/gi;

  function append(target, text) {
    const source = String(text);
    let last = 0;
    for (const match of source.matchAll(tokenPattern)) {
      target.append(document.createTextNode(source.slice(last, match.index)));
      const token = match[0];
      if (/^<figure\b/i.test(token) || /^<table\b/i.test(token)) {
        const container = document.createElement('div');
        container.className = /^<figure\b/i.test(token) ? 'ai-rendered-figure' : 'ai-rendered-table overflow-x-auto';
        container.innerHTML = token;
        target.append(container);
      } else if (/^<svg\b/i.test(token)) {
        const figure = document.createElement('span');
        figure.className = 'ai-svg';
        try {
          if (!window.zarifSafeSvg) throw new Error('SVG doğrulayıcısı yüklenemedi.');
          window.zarifSafeSvg.render(figure, window.zarifSafeSvg.parse(token));
        } catch (error) {
          console.warn('AI şekli doğrulanamadı:', error.message);
          figure.textContent = '[Şekil güvenli biçimde görüntülenemedi.]';
        }
        target.append(figure);
      } else {
        const block = token.startsWith('$$') || token.startsWith('\\[');
        const length = token.startsWith('$') && !block ? 1 : 2;
        const latex = token.slice(length, -length).trim();
        const formula = document.createElement('span');
        if (window.katex && latex.length <= 2000) {
          window.katex.render(latex, formula, {displayMode: block, throwOnError: false, trust: false});
        } else {
          formula.textContent = token;
        }
        target.append(formula);
      }
      last = match.index + token.length;
    }
    target.append(document.createTextNode(source.slice(last)));
  }
  window.zarifAiVisual = {append};
})();
