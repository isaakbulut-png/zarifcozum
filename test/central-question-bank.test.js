const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createCentralQuestionBankRouter, getSampleQuestions } = require('../routes/centralQuestionBank');
const User = require('../models/User');

async function withServer(router, fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/central-question-bank', router);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/central-question-bank`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('1. Soru Havuzu API: /api/central-question-bank 200 döner ve soruları listeler', async () => {
  await withServer(createCentralQuestionBankRouter(), async (baseUrl) => {
    const res = await fetch(baseUrl);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.questions));
    assert.ok(body.questions.length > 0, 'Havuz soruları boş olmamalı');

    // Soru alanlarının doğrulanması
    const first = body.questions[0];
    assert.ok(first.id || first._id, 'Soru id içermeli');
    assert.ok(first.text, 'Soru metni olmalı');
    assert.ok(Array.isArray(first.options), 'Soru şıkları olmalı');
    assert.ok(first.answer, 'Soru cevabı olmalı');
    assert.ok(first.grade, 'Sınıf seviyesi olmalı');
  });
});

test('1. Soru Havuzu API: Sınıf ve zorluk filtrelerini doğru uygular', async () => {
  await withServer(createCentralQuestionBankRouter(), async (baseUrl) => {
    // 8. Sınıf filtrelemesi
    const res8 = await fetch(`${baseUrl}?grade=8`);
    assert.equal(res8.status, 200);
    const body8 = await res8.json();
    assert.ok(body8.questions.every(q => q.grade === 8), 'Tüm sorular 8. sınıf olmalı');

    // Kolay zorluk filtrelemesi
    const resEasy = await fetch(`${baseUrl}?difficulty=kolay`);
    assert.equal(resEasy.status, 200);
    const bodyEasy = await resEasy.json();
    assert.ok(bodyEasy.questions.every(q => q.difficulty === 'kolay'), 'Tüm sorular kolay olmalı');

    // Arama filtrelemesi
    const resSearch = await fetch(`${baseUrl}?search=Pisagor`);
    assert.equal(resSearch.status, 200);
    const bodySearch = await resSearch.json();
    assert.ok(bodySearch.questions.length > 0);
    assert.match(bodySearch.questions[0].topic, /Pisagor/);
  });
});

test('2. Admin Paket Tanımlama: User şeması subscriptionType yearly ve annual değerlerini geçerli kabul eder', () => {
  const subscriptionTypePath = User.schema.path('subscriptionType');
  assert.ok(subscriptionTypePath, 'User şemasında subscriptionType alanı bulunmalı');

  const enumValues = subscriptionTypePath.enumValues;
  assert.ok(enumValues.includes('yearly'), 'subscriptionType yearly değerini içermeli');
  assert.ok(enumValues.includes('annual'), 'subscriptionType annual değerini içermeli');
  assert.ok(enumValues.includes('monthly'), 'subscriptionType monthly değerini içermeli');
  assert.ok(enumValues.includes(null), 'subscriptionType null değerini içermeli');
});
