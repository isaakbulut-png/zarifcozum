const { sanitizeFaqHtml } = require('./rich-content');
const safeSvg = require('../assets/safe-svg');

function prepareQuestion(question) {
  if (!question || typeof question.text !== 'string' || !question.text.trim() ||
      question.text.trim().length > 1000 || !question.options ||
      !['A', 'B', 'C', 'D'].every(letter => typeof question.options[letter] === 'string' &&
        question.options[letter].trim().length > 0 && question.options[letter].trim().length <= 300) ||
      !['A', 'B', 'C', 'D'].includes(question.answer)) {
    throw new TypeError('Test başlığı ve 1–50 geçerli soru gereklidir.');
  }
  const result = {
    text: question.text.trim(),
    options: Object.fromEntries(['A', 'B', 'C', 'D'].map(letter => [letter, question.options[letter].trim()])),
    answer: question.answer
  };
  if (question.html !== undefined) {
    let content;
    try {
      content = sanitizeFaqHtml(question.html);
    } catch (error) {
      if (error instanceof TypeError) throw new TypeError('Soru içeriği boş olamaz ve HTML en fazla 12000 karakter olmalıdır.');
      throw error;
    }
    if (content.text.length > 1000) throw new TypeError('Soru metni en fazla 1000 karakter olmalıdır.');
    result.text = content.text;
    result.html = content.html;
  }
  if (question.svg !== undefined && question.svg !== null) result.svg = safeSvg.validate(question.svg);
  return result;
}

function studentQuestion({text, options, html, svg}) {
  const result = {text, options};
  if (html !== undefined) result.html = html;
  if (svg !== undefined) result.svg = svg;
  return result;
}

module.exports = {prepareQuestion, studentQuestion};
