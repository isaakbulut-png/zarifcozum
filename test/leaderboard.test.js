const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {ObjectId} = require('mongodb');
const {createPointsService, maskName} = require('../lib/leaderboard');
const {createLeaderboardRouter} = require('../routes/leaderboard');
const {createStudentQuizSubmissionHandler} = require('../routes/quizler');
const {schedule, runWeeklyLeagueJob} = require('../lib/weekly-league-job');
const User = require('../models/User');

function setup() {
  const studentId = new ObjectId();
  const records = new Map();
  const user = {_id: studentId, role: 'student', name: 'Ayşe Yılmaz', zarifPuan: 0, haftalikPuan: 0};
  const ledger = {async updateOne(filter, update) {
    if (records.has(filter._id)) return {upsertedCount: 0};
    records.set(filter._id, update.$setOnInsert);
    return {upsertedCount: 1};
  }};
  const users = {
    async updateOne(filter, update) {
      if (String(filter._id) !== String(studentId) || filter.role !== 'student') return {matchedCount: 0};
      user.zarifPuan += update.$inc.zarifPuan;
      user.haftalikPuan += update.$inc.haftalikPuan;
      return {matchedCount: 1};
    },
    aggregate(pipeline) {
      assert.deepEqual(pipeline[0], {$match: {role: 'student', restricted: {$ne: true}}});
      assert.deepEqual(pipeline[2], {$sort: {haftalikPuan: -1, _id: 1}});
      assert.deepEqual(pipeline[3], {$limit: 10});
      return {toArray: async () => [user]};
    }
  };
  const db = {collection: name => name === 'users' ? users : ledger};
  let ended = false;
  const client = {startSession: () => ({
    withTransaction: fn => fn(),
    endSession: async () => { ended = true; }
  })};
  return {studentId: String(studentId), records, user, service: createPointsService({
    getDb: () => db, getClient: () => client, userCollectionName: 'users'
  }), isEnded: () => ended};
}

test('kullanıcı puanları varsayılan olarak sıfır ve lig Bronz', () => {
  const user = new User({name: 'Öğrenci', email: 'test@example.invalid'});
  assert.equal(user.zarifPuan, 0);
  assert.equal(user.haftalikPuan, 0);
  assert.equal(user.mevcutLig, 'Bronz');
});

test('aynı öğrenci ve soru tekrar puanlanmaz, yeni doğru soru her iki puanı artırır', async () => {
  const {studentId, service, user, records, isEnded} = setup();
  assert.equal(await service.transaction(s => service.award(s, studentId, ['quiz:q:0', 'quiz:q:1', 'quiz:q:1'])), 20);
  assert.equal(await service.transaction(s => service.award(s, studentId, ['quiz:q:0', 'quiz:q:2'])), 10);
  assert.equal(user.zarifPuan, 30);
  assert.equal(user.haftalikPuan, 30);
  assert.equal(records.size, 3);
  assert.equal(isEnded(), true);
});

test('liderlik tablosu sınırlı alanlar ve maskeli ad döndürür', async () => {
  const {service} = setup();
  assert.equal(maskName('Ali Veli Yılmaz'), 'Ali V. Y.');
  assert.deepEqual(await service.leaderboard(), [{sira: 1, ad: 'Ayşe Y.', haftalikPuan: 0, mevcutLig: 'Bronz'}]);
});

test('liderlik tablosu yalnızca öğrenciye açılır', async t => {
  const {service} = setup();
  const app = express();
  app.use('/api/leaderboard', createLeaderboardRouter({
    requireStudent: (req, res, next) => req.headers.authorization === 'student' ? next() : res.sendStatus(403),
    pointsService: service
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/leaderboard`;
  assert.equal((await fetch(url)).status, 403);
  const response = await fetch(url, {headers: {authorization: 'student'}});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).leaderboard[0].ad, 'Ayşe Y.');
});

test('test tekrarında yalnızca daha önce puanlanmayan doğru sorular puan getirir', async t => {
  const {studentId, service, user} = setup();
  const quizId = new ObjectId();
  const quiz = {_id: quizId, title: 'Test', questions: [
    {answer: 'A', options: {A: '1', B: '2'}},
    {answer: 'B', options: {A: '1', B: '2'}}
  ]};
  const results = [];
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {req.session = {user: {id: studentId, name: 'Ayşe'}}; next();});
  app.post('/quiz/:id', createStudentQuizSubmissionHandler({
    getQuizCollection: () => ({findOne: async () => quiz}),
    getResultCollection: () => ({insertOne: async result => {results.push(result); return {insertedId: new ObjectId()};}}),
    pointsService: service
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/quiz/${quizId}`;
  const submit = answers => fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({answers})});
  let response = await submit(['A', 'A']);
  assert.equal((await response.json()).kazanilanPuan, 10);
  response = await submit(['A', 'B']);
  assert.equal((await response.json()).kazanilanPuan, 10);
  response = await submit(['A', 'B']);
  assert.equal((await response.json()).kazanilanPuan, 0);
  assert.equal(user.zarifPuan, 20);
  assert.equal(user.haftalikPuan, 20);
  assert.equal(results.length, 3);
});

test('haftalık görev taslağı otomatik çalışmaz ve kurallar olmadan sıfırlamaz', async () => {
  assert.deepEqual(schedule, {cron: '0 0 * * 1', timezone: 'Europe/Istanbul'});
  await assert.rejects(runWeeklyLeagueJob(), /Lig kuralları/);
});
