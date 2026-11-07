const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {ObjectId} = require('mongodb');
const {createMentorHintRouter} = require('../routes/mentor-ipucu');
const {prepareQuestion} = require('../lib/quiz-content');
const {findExactOutcome} = require('../lib/meb-outcome');

test('kazanım Pinecone sınıf ve tam kod ile eşleşmedikçe kabul edilmez', async () => {
  const metadata = {grade: 6, outcome_code: 'MAT.6.1.1', text: 'Sınırlar'};
  let filter;
  const index = {fetchByMetadata: async options => {
    filter = options.filter;
    return {records: {one: {metadata}}};
  }};
  assert.deepEqual(await findExactOutcome(index, 'MAT.6.1.1'), metadata);
  assert.deepEqual(filter, {grade: {$eq: 6}, outcome_code: {$eq: 'MAT.6.1.1'}});
  await assert.rejects(findExactOutcome(index, 'MAT.7.1.1'), /bulunamadı/);
  await assert.rejects(findExactOutcome(index, 'MAT.6.1'), /geçersiz/);
  const duplicate = {fetchByMetadata: async () => ({records: {one: {metadata}, two: {metadata}}})};
  await assert.rejects(findExactOutcome(duplicate, 'MAT.6.1.1'), /bulunamadı/);
});

test('kazanım kodu yalnızca geçerli biçimde saklanır', () => {
  const question = {text: 'Soru', options: {A: '1', B: '2', C: '3', D: '4'}, answer: 'A'};
  assert.equal(prepareQuestion({...question, outcomeCode: 'MAT.6.1.1'}).outcomeCode, 'MAT.6.1.1');
  assert.throws(() => prepareQuestion({...question, outcomeCode: 'MAT.6.1'}), TypeError);
});

test('ipucu yalnızca öğrenciye ait yanlış, kazanımlı soru için üretilir', async t => {
  const resultId = new ObjectId();
  const quizId = new ObjectId();
  const result = {_id: resultId, quizId, studentId: 'owner', answers: ['B', 'A', null]};
  const question = {text: 'Soru', options: {A: '1', B: '2'}, answer: 'A', outcomeCode: 'MAT.6.1.1'};
  const quiz = {_id: quizId, questions: [question, question, question]};
  const calls = [];
  const app = express();
  app.use((req, res, next) => {req.session = {user: {id: req.get('x-user')}}; next();});
  app.use('/hint', createMentorHintRouter({
    requireStudent: (req, res, next) => req.get('x-user') ? next() : res.sendStatus(401),
    limiter: (req, res, next) => next(),
    getResults: () => ({findOne: async filter => String(filter._id) === String(resultId) && filter.studentId === result.studentId ? result : null}),
    getQuizzes: () => ({findOne: async () => quiz}),
    generateHint: async payload => {calls.push(payload); return '$x^2$';}
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/hint/${resultId}`;
  const send = (index, user) => fetch(`${url}/${index}`, {method: 'POST', headers: user ? {'x-user': user} : {}});
  assert.equal((await send(0)).status, 401);
  assert.equal((await send(0, 'other')).status, 404);
  assert.equal((await send(1, 'owner')).status, 404);
  assert.equal((await send(2, 'owner')).status, 404);
  const response = await send(0, 'owner');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ipucu, '$x^2$');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].outcomeCode, 'MAT.6.1.1');
  assert.equal(calls[0].selected, 'B');
});
