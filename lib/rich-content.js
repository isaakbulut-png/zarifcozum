const { htmlToText } = require('html-to-text');
const xss = require('xss');

const FAQ_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ol', 'ul', 'li', 'blockquote', 'sub', 'sup', 'span'
];

function sanitizeFaqHtml(value) {
  if (typeof value !== 'string' || value.length > 12000) {
    throw new TypeError('FAQ içeriği en fazla 12000 karakter olmalıdır.');
  }
  const html = xss(value, {
    whiteList: Object.fromEntries(FAQ_ALLOWED_TAGS.map(tag => [
      tag,
      tag === 'span' ? ['class', 'data-value'] : []
    ])),
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'svg', 'math'],
    allowCommentTag: false,
    onTagAttr: (tag, name, attributeValue) => {
      if (tag === 'span' && name === 'class' && attributeValue === 'ql-formula') {
        return 'class="ql-formula"';
      }
      if (tag === 'span' && name === 'data-value' && attributeValue.length <= 500) {
        return `data-value="${xss.escapeAttrValue(attributeValue)}"`;
      }
      return false;
    }
  }).trim();
  const text = htmlToText(html, {
    wordwrap: false,
    selectors: [{ selector: 'span.ql-formula', format: 'faqFormula' }],
    formatters: {
      faqFormula: (element, walk, builder) => {
        builder.addInline(`\\(${element.attribs['data-value']}\\)`, element);
      }
    }
  }).replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
  if (!html || !text || text.length > 5000) {
    throw new TypeError('FAQ yanıtı boş olamaz ve en fazla 5000 karakter olmalıdır.');
  }
  return { html, text };
}

module.exports = { FAQ_ALLOWED_TAGS, sanitizeFaqHtml };
