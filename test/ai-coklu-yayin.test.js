const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createAIRouter} = require('../routes/ai');

const question = (answer = 'A', extra = {}) => ({
  text: ' Soru ', options: {A: ' 1 ', B: '2', C: '3', D: '4'},
  answer, explanation: ' Açıklama ', ...extra
});
const payload = {topic: 'Fonksiyonlar', grade: 9, difficulty: 'Orta', title: ' Test ', description: ' Açıklama '};

test('AI yayın API tek belgeye soruları kaydeder, eski istek ve doğrulamaları korur', async t => {
  const rows = [];
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = {user: {id: 'teacher-1'}}; next(); });
  app.use('/ai', createAIRouter({
    requireRole: () => (req, res, next) => req.get('role') === 'teacher' ? next() : res.sendStatus(403),
    getQuizCollection: () => ({insertOne: async doc => { rows.push(doc); return {insertedId: 'id-1'}; }}),
    AdminLog: {}
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const send = (body, role = 'teacher') => fetch(`http://127.0.0.1:${server.address().port}/ai/questions/publish`, {
    method: 'POST', headers: {'Content-Type': 'application/json', role}, body: JSON.stringify(body)
  });
  let response = await send({...payload, questions: [question()]}, 'student');
  assert.equal(response.status, 403);
  response = await send({...payload, questions: [
    question('B', {outcomeCode: 'MAT.9.1.1'}), question('D'), ...Array.from({length: 8}, () => question())
  ]});
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).quiz, {id: 'id-1', title: 'Test', soruSayisi: 10});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'ai');
  assert.equal(rows[0].published, true);
  assert.equal(rows[0].createdBy, 'teacher-1');
  assert.equal(rows[0].questions.length, 10);
  assert.deepEqual(rows[0].questions.slice(0, 2).map(q => q.answer), ['B', 'D']);
  assert.equal(rows[0].questions[0].outcomeCode, 'MAT.9.1.1');
  assert.equal(rows[0].questions[1].outcomeCode, undefined);
  assert.equal(rows[0].questions[0].text, 'Soru');
  assert.equal(rows[0].questions[0].options.A, '1');
  assert.equal(rows[0].questions[0].explanation, 'Açıklama');
  response = await send({...payload, question: question('C')});
  assert.equal(response.status, 201);
  assert.equal((await response.json()).quiz.soruSayisi, 1);
  assert.equal(rows[1].questions[0].answer, 'C');
  response = await send({...payload, question: question('A', {html: '<p>İçerik</p><script>alert(1)</script>'})});
  assert.equal(response.status, 201);
  assert.doesNotMatch(rows[2].questions[0].html, /script/);

  const invalid = [
    {questions: []}, {questions: Array(51).fill(question())}, {questions: 'invalid'},
    {questions: [question(), question('E')]},
    {questions: [question(), question('A', {outcomeCode: 'invalid'})]},
    {questions: [question('A', {text: ' '.repeat(2)})]},
    {questions: [question('A', {options: {A: '1', B: '2', C: '3', D: 'x'.repeat(301)}})]},
    {questions: [question('A', {svg: {tag: 'svg', attrs: {onload: 'alert(1)'}, children: []}})]},
    {questions: [question()], title: ' '.repeat(5)},
    {questions: [question()], topic: 'Geçersiz'}
  ];
  for (const bad of invalid) {
    response = await send({...payload, ...bad});
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  assert.equal(rows.length, 3);
});

test('öğretmen onaylıları tek test gönderir, tekrar tıklamayı ve yeniden denemeyi yönetir', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ogretmen-paneli.html'), 'utf8');
  const code = html.slice(html.indexOf("  $('aiQuestionForm').addEventListener('submit'"),
    html.indexOf("  $('announcementForm').addEventListener('submit'"));
  assert.ok(code.includes("quiz.topic + ' - Test 1'"));
  let submit, click, requests = [], resolvePublish, failRefresh = false, approved = true;
  const status = {};
  const inputs = [{disabled: false}, {disabled: false}];
  const cards = [
    {dataset: {aiQuestion: '0'}, querySelector: selector => selector === '[data-ai-approved]' ? {checked: approved} : {value: ' MAT.9.1.1 '}},
    {dataset: {aiQuestion: '1'}, querySelector: selector => selector === '[data-ai-approved]' ? {checked: false} : {value: ''}},
    {dataset: {aiQuestion: '2'}, querySelector: selector => selector === '[data-ai-approved]' ? {checked: approved} : {value: ''}}
  ];
  const button = {disabled: false, textContent: ''};
  const list = {
    innerHTML: '', replaceChildren() { this.innerHTML = ''; },
    addEventListener(name, callback) { click = callback; },
    querySelector: () => status,
    querySelectorAll: selector => selector === 'input' ? inputs : cards
  };
  const elements = {
    aiQuestionForm: {addEventListener(name, callback) { submit = callback; }},
    generateAiQuestions: {disabled: false}, aiQuestionList: list,
    aiGrade: {value: '9'}, aiTopic: {value: 'Fonksiyonlar'},
    aiDifficulty: {value: 'Orta'}, aiCount: {value: '3'},
    aiTestTitle: {value: 'Özel başlık'}
  };
  const draft = {...payload, soruSayisi: 3, questions: [question('A'), question('B'), question('D')]};
  const api = async (url, options) => {
    if (url === '/api/ai/questions') return {quiz: draft};
    if (url === '/api/ogretmen/yonetim') {
      if (failRefresh) throw new Error('liste hatası');
      return {};
    }
    requests.push(JSON.parse(options.body));
    return new Promise((resolve, reject) => { resolvePublish = {resolve, reject}; });
  };
  const context = {
    $: id => elements[id], api, durumYaz() {}, yonetimCiz() {},
    esc: value => String(value), aiDraft: null, aiPublishing: false, aiPublished: false, yonetim: {}
  };
  vm.runInNewContext(code, context);
  await submit({preventDefault() {}});
  assert.match(list.innerHTML, /data-ai-approved/);
  assert.match(list.innerHTML, /data-ai-outcome/);
  assert.match(list.innerHTML, /Fonksiyonlar - Test 1/);
  const event = {target: {closest: () => button}};
  elements.aiTestTitle.value = ' ';
  await click(event);
  assert.equal(requests.length, 0);
  elements.aiTestTitle.value = 'Özel başlık';
  approved = false;
  await click(event);
  assert.equal(requests.length, 0);
  approved = true;
  const first = click(event);
  await click(event);
  await submit({preventDefault() {}});
  assert.equal(requests.length, 1);
  assert.equal(button.disabled, true);
  assert.equal(elements.generateAiQuestions.disabled, true);
  assert.equal(requests[0].title, 'Özel başlık');
  assert.deepEqual(requests[0].questions.map(q => q.answer), ['A', 'D']);
  assert.equal(requests[0].questions[0].outcomeCode, 'MAT.9.1.1');
  resolvePublish.reject(new Error('başarısız'));
  await first;
  assert.equal(button.disabled, false);
  assert.equal(inputs[0].disabled, false);
  const retry = click(event);
  failRefresh = true;
  resolvePublish.resolve({mesaj: 'Yayınlandı'});
  await retry;
  assert.match(status.textContent, /listesi yenilenemedi/);
  await click(event);
  assert.equal(requests.length, 2);
  assert.equal(button.disabled, true);
  assert.equal(elements.generateAiQuestions.disabled, false);
});
