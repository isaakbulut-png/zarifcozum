(function () {
  const allowedTags = new Set([
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'ol', 'ul', 'li', 'blockquote', 'sub', 'sup'
  ]);
  const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'svg', 'math']);

  function copySafeNode(source, target) {
    if (source.nodeType === Node.TEXT_NODE) {
      target.append(document.createTextNode(source.nodeValue || ''));
      return;
    }
    if (source.nodeType !== Node.ELEMENT_NODE) return;

    const tag = source.tagName.toLowerCase();
    if (blockedTags.has(tag)) return;
    if (tag === 'span' && source.classList.contains('ql-formula')) {
      const latex = source.getAttribute('data-value') || '';
      const formula = document.createElement('span');
      if (latex.length <= 500 && window.katex) {
        window.katex.render(latex, formula, { throwOnError: false, trust: false });
      } else {
        formula.textContent = `\\(${latex.slice(0, 500)}\\)`;
      }
      target.append(formula);
      return;
    }
    if (!allowedTags.has(tag)) {
      for (const child of source.childNodes) copySafeNode(child, target);
      return;
    }
    const element = document.createElement(tag);
    for (const child of source.childNodes) copySafeNode(child, element);
    target.append(element);
  }

  window.zarifRichContent = {
    render(target, html) {
      if (!(target instanceof Element) || typeof html !== 'string' || html.length > 12000) return false;
      const template = document.createElement('template');
      template.innerHTML = html;
      const fragment = document.createDocumentFragment();
      for (const child of template.content.childNodes) copySafeNode(child, fragment);
      target.replaceChildren(fragment);
      return true;
    }
  };
})();
