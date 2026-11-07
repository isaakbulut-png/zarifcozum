const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {prepareQuestion, studentQuestion} = require('../lib/quiz-content');
const {validate} = require('../assets/safe-svg');
const {createTeacherQuizHandler} = require('../routes/quizler');

const svg = {
  tag: 'svg', attrs: {viewBox: '0 0 100 100'}, children: [
    {tag: 'circle', attrs: {cx: '50', cy: '50', r: '30', fill: 'none', stroke: '#123456'}, children: []},
    {tag: 'text', attrs: {x: '50', y: '50'}, children: [], text: 'A'}
  ]
};
const question = () => ({
  text: 'Alanı hesaplayın.',
  html: '<p>Alanı hesaplayın: <span class="ql-formula" data-value="x^2">x²</span></p>',
  svg,
  options: {A: '1', B: '2', C: '3', D: '4'},
  answer: 'B'
});

test('zengin soru sanitize edilir ve öğrenciye cevap anahtarı gönderilmez', () => {
  const saved = prepareQuestion({...question(), html: question().html + '<script>alert(1)</script><svg onload="alert(1)"></svg>'});
  assert.match(saved.html, /data-value="x\^2"/);
  assert.doesNotMatch(saved.html, /script|onload|<svg/);
  assert.match(saved.text, /x\^2/);
  assert.deepEqual(saved.svg, svg);
  assert.equal(saved.answer, 'B');
  const student = studentQuestion(saved);
  assert.equal(student.answer, undefined);
  assert.equal(student.html, saved.html);
  assert.deepEqual(student.svg, svg);
});

test('eski düz metin soruları değişmeden kullanılabilir', () => {
  const old = question();
  delete old.html;
  delete old.svg;
  const result = prepareQuestion(old);
  assert.deepEqual(studentQuestion(result), {text: old.text, options: old.options});
});

test('editörün boş formül düğümü LaTeX olarak saklanır', () => {
  const saved = prepareQuestion({...question(),
    html: '<p><span class="ql-formula" data-value="\\frac{a}{b}"></span></p>'});
  assert.equal(saved.text, '\\(\\frac{a}{b}\\)');
  assert.match(saved.html, /data-value="\\frac\{a\}\{b\}"/);
});

test('SVG betik, dış kaynak, olay işleyicileri ve aşırı karmaşıklığı reddeder', () => {
  for (const bad of [
    {tag: 'script', attrs: {}, children: []},
    {tag: 'foreignObject', attrs: {}, children: []},
    {tag: 'image', attrs: {href: 'https://example.com/a'}, children: []},
    {tag: 'circle', attrs: {onload: 'alert(1)'}, children: []},
    {tag: 'circle', attrs: {fill: 'url(https://example.com/a)'}, children: []},
    {tag: 'circle', attrs: {style: 'fill:red'}, children: []},
    {tag: 'circle', attrs: {r: 'Infinity'}, children: []}
  ]) assert.throws(() => validate({tag: 'svg', attrs: {}, children: [bad]}), TypeError);
  assert.throws(() => validate({tag: 'svg', attrs: {}, children: Array(101).fill(svg.children[0])}), TypeError);
  assert.throws(() => validate({...svg, attrs: {viewBox: '0 0 0 100'}}), TypeError);
});

test('test yayın API zengin içeriği saklar ve geçersiz SVG için 400 döndürür', async t => {
  const rows = [];
  const app = express();
  app.use(express.json({limit: '1mb'}));
  app.use((req, res, next) => {
    if (req.headers.authorization !== 'teacher') return res.status(403).json({mesaj: 'Yetkisiz'});
    req.session = {user: {id: 'teacher-1'}};
    next();
  });
  app.post('/api/ogretmen/quizler', createTeacherQuizHandler(() => ({
    async insertOne(doc) { rows.push(doc); return {insertedId: 'id-1'}; }
  })));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/ogretmen/quizler`;
  const send = (payload, auth = 'teacher') => fetch(url, {
    method: 'POST', headers: {'Content-Type': 'application/json', authorization: auth}, body: JSON.stringify(payload)
  });
  let response = await send({title: 'Test', questions: [question()]}, 'student');
  assert.equal(response.status, 403);
  response = await send({title: 'Test', questions: [question()]});
  assert.equal(response.status, 201);
  assert.equal(rows[0].createdBy, 'teacher-1');
  assert.deepEqual(rows[0].questions[0].svg, svg);
  assert.match(rows[0].questions[0].html, /ql-formula/);
  const bad = question();
  bad.svg = {tag: 'svg', attrs: {onload: 'alert(1)'}, children: []};
  response = await send({title: 'Test', questions: [bad]});
  assert.equal(response.status, 400);
  assert.equal(rows.length, 1);
});
