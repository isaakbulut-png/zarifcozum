const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {ObjectId, BSON} = require('mongodb');
const {createLiveQuizHandlers, createStudentQuizSubmissionHandler} = require('../routes/quizler');
const {createMentorHintRouter} = require('../routes/mentor-ipucu');

test('canlı test atomik kontroller, sahiplik, ipuçları ve idempotent teslim uygular', async t => {
  const clone = value => BSON.deserialize(BSON.serialize(value));
  const quizId = new ObjectId();
  const quiz = {_id: quizId, title: 'Test', questions: [
    {text: 'Bir', options: {A: '1', B: '2'}, answer: 'A', outcomeCode: 'MAT.6.1.1'},
    {text: 'İki', options: {A: '1', B: '2'}, answer: 'B'}
  ]};
  const attempts = new Map(), results = new Map(), points = new Set(), calls = [];
  let queue = Promise.resolve();
  const collection = {
    async findOne(filter) {
      const doc = attempts.get(filter._id);
      return doc && (!filter.studentId || doc.studentId === filter.studentId) &&
        (!filter.status || doc.status === filter.status) ? clone(doc) : null;
    },
    async replaceOne(filter, value, options = {}) {
      const previous = attempts.get(filter._id);
      const matches = previous && previous.status === filter.status &&
        (!filter.resultId || String(previous.resultId) === String(filter.resultId)) &&
        (!filter.runId || (typeof filter.runId === 'string' ? previous.runId === filter.runId : !previous.runId));
      if (previous && !matches) {
        if (options.upsert) throw Object.assign(new Error('duplicate'), {code: 11000});
        return {modifiedCount: 0};
      }
      attempts.set(filter._id, clone(value));
      return previous ? {modifiedCount: 1} : {upsertedCount: 1};
    },
    async updateOne(filter, update, options = {}) {
      let doc = attempts.get(filter._id);
      if (!doc && options.upsert) {
        doc = {...update.$setOnInsert, _id: filter._id, legacyWrites: 1};
        attempts.set(filter._id, doc);
        return {modifiedCount: 0, upsertedCount: 1};
      }
      if (doc && filter.status && doc.status !== filter.status && options.upsert) {
        throw Object.assign(new Error('duplicate'), {code: 11000});
      }
      if (!doc || (filter.status && doc.status !== filter.status) ||
          (filter.studentId && doc.studentId !== filter.studentId) ||
          (filter.runId && (typeof filter.runId === 'string' ? doc.runId !== filter.runId : doc.runId !== undefined)) ||
          (filter.state && JSON.stringify(doc.state) !== JSON.stringify(filter.state))) return {modifiedCount: 0};
      for (const [field, value] of Object.entries(filter)) {
        const match = /^state\.(\d+)\.(checks|correct)$/.exec(field);
        if (match && doc.state[match[1]][match[2]] !== value) return {modifiedCount: 0};
      }
      for (const [field, value] of Object.entries(update.$set || {})) {
        const match = /^state\.(\d+)$/.exec(field);
        if (match) doc.state[match[1]] = value;
        else doc[field] = value;
      }
      return {modifiedCount: 1};
    }
  };
  const resultCollection = {
    async insertOne(doc) {
      const saved = {...doc, _id: doc._id || new ObjectId()};
      results.set(String(saved._id), clone(saved));
      return {insertedId: saved._id};
    },
    async findOne(filter) {
      const doc = filter._id ? results.get(String(filter._id)) :
        [...results.values()].find(item => item.liveAttemptId === filter.liveAttemptId &&
          String(item.quizId) === String(filter.quizId));
      return doc && doc.studentId === filter.studentId ? doc : null;
    }
  };
  const pointsService = {
    async transaction(fn) {
      const prior = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await prior;
      try { return await fn({}); } finally { release(); }
    },
    async award(session, student, keys) {
      let earned = 0;
      for (const key of keys) if (!points.has(`${student}:${key}`)) { points.add(`${student}:${key}`); earned += 10; }
      return earned;
    }
  };
  const deps = {getQuizCollection: () => ({findOne: async filter => String(filter._id) === String(quizId) ? quiz : null}),
    getAttemptCollection: () => collection, getResultCollection: () => resultCollection, pointsService};
  const handlers = createLiveQuizHandlers(deps);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {req.session = {user: {id: req.get('x-user') || 'owner', name: 'Student'}}; next();});
  app.post('/quiz/:id/attempt', handlers.start);
  app.post('/quiz/:id/attempt/check', handlers.check);
  app.post('/quiz/:id/attempt/finish', handlers.finish);
  app.post('/quiz/:id/teslim', createStudentQuizSubmissionHandler(deps));
  app.use('/hint', createMentorHintRouter({
    requireStudent: (req, res, next) => next(), limiter: (req, res, next) => next(),
    getAttempts: () => collection, getResults: () => resultCollection, getQuizzes: deps.getQuizCollection,
    generateHint: async payload => {calls.push(['exact', payload]); return 'exact';},
    generateGeneralHint: async payload => {calls.push(['general', payload]); return 'general';}
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const currentIds = {};
  const post = async (path, body = {}, user = 'owner') => {
    if (/\/attempt\/(check|finish)$/.test(path) && !Object.hasOwn(body, 'attemptId')) {
      body = {...body, attemptId: currentIds[user] || 'missing'};
    }
    if (/\/hint\/live\//.test(path) && !Object.hasOwn(body, 'attemptId')) {
      body = {...body, attemptId: currentIds[user] || 'missing'};
    }
    const response = await fetch(base + path, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'x-user': user}, body: JSON.stringify(body)
    });
    if (path.endsWith('/attempt') && response.ok) currentIds[user] = (await response.clone().json()).attempt.id;
    return response;
  };
  const prefix = `/quiz/${quizId}`;
  assert.equal((await post(`${prefix}/teslim`, {answers: ['A', 'B']})).status, 409);
  let response = await post(`${prefix}/attempt`);
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).attempt.questions, [
    {checks: 0, answer: null, correct: null}, {checks: 0, answer: null, correct: null}
  ]);
  assert.equal((await post(`${prefix}/attempt/finish`)).status, 409);
  assert.equal((await post(`${prefix}/attempt/finish`, {attemptId: ''})).status, 400);
  assert.equal((await post(`${prefix}/attempt/check`, {attemptId: '', index: 0, answer: 'A'})).status, 400);
  assert.equal((await post(`/hint/live/${quizId}/0`)).status, 404);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 0, answer: 'B'}, 'other')).status, 404);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 1.5, answer: 'A'})).status, 400);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 8, answer: 'A'})).status, 400);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 0, answer: 'Z'})).status, 400);
  response = await post(`${prefix}/attempt/check`, {index: 0, answer: 'B'});
  assert.deepEqual(await response.json(), {index: 0, checks: 1, answer: 'B', correct: false, remainingChecks: 1});
  response = await post(`${prefix}/attempt`);
  assert.deepEqual((await response.json()).attempt.questions[0], {checks: 1, answer: 'B', correct: false});
  assert.equal((await post(`/hint/live/${quizId}/0`)).status, 200);
  assert.equal((await post(`/hint/live/${quizId}/0`, {attemptId: 'stale'})).status, 404);
  assert.equal((await post(`/hint/live/${quizId}/0`, {}, 'other')).status, 404);
  assert.equal(calls[0][0], 'exact');
  const simultaneous = await Promise.all([
    post(`${prefix}/attempt/check`, {index: 0, answer: 'A'}),
    post(`${prefix}/attempt/check`, {index: 0, answer: 'B'})
  ]);
  assert.deepEqual(simultaneous.map(item => item.status).sort(), [200, 409]);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 0, answer: 'A'})).status, 409);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 1, answer: 'A'})).status, 200);
  assert.equal((await post(`/hint/live/${quizId}/1`)).status, 200);
  assert.equal(calls[1][0], 'general');
  assert.equal((await post(`${prefix}/teslim`, {answers: ['A', 'B']})).status, 409);
  response = await post(`${prefix}/attempt/check`, {index: 1, answer: 'B'});
  assert.equal((await response.json()).correct, true);
  const finishes = await Promise.all([post(`${prefix}/attempt/finish`), post(`${prefix}/attempt/finish`)]);
  assert.deepEqual(finishes.map(item => item.status), [200, 200]);
  const [first, second] = await Promise.all(finishes.map(item => item.json()));
  assert.deepEqual(first, second);
  assert.equal(first.kazanilanPuan, 20);
  assert.deepEqual(first.answers, ['A', 'B']);
  assert.equal(results.size, 1);
  const saved = results.get(first.id);
  assert.equal(saved.studentId, 'owner');
  assert.equal(String(saved.quizId), String(quizId));
  assert.equal(saved.liveAttemptId, currentIds.owner);
  assert.deepEqual(saved.answers, first.answers);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 1, answer: 'A'})).status, 409);
  assert.equal((await post(`/hint/live/${quizId}/1`)).status, 404);
  assert.equal((await post(`${prefix}/attempt`)).status, 200);
  assert.equal((await post(`${prefix}/teslim`, {answers: ['A', 'B']})).status, 409);

  assert.equal((await post(`${prefix}/attempt`, {}, 'other')).status, 201);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 0, answer: 'A'}, 'other')).status, 200);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 0, answer: 'B'}, 'other')).status, 409);
  assert.equal((await post(`/hint/live/${quizId}/0`, {}, 'other')).status, 404);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 1, answer: 'A'}, 'other')).status, 200);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 1, answer: 'A'}, 'other')).status, 200);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 1, answer: 'B'}, 'other')).status, 409);
  response = await post(`${prefix}/attempt/finish`, {}, 'other');
  const otherResult = await response.json();
  assert.equal(otherResult.kazanilanPuan, 10);
  assert.equal(otherResult.correctCount, 1);
  assert.deepEqual(otherResult.answers, ['A', 'A']);

  assert.equal((await post(`${prefix}/teslim`, {answers: ['A', 'B']}, 'legacy')).status, 409);
  assert.equal((await post(`${prefix}/attempt/finish`, {}, 'legacy')).status, 404);
  assert.equal((await post(`${prefix}/attempt`, {}, 'legacy')).status, 201);
  assert.equal((await post(`${prefix}/teslim`, {answers: ['A', 'B']}, 'legacy')).status, 409);

  const oldAttemptId = currentIds.other;
  const restarts = await Promise.all([
    post(`${prefix}/attempt`, {restart: true}, 'other'),
    post(`${prefix}/attempt`, {restart: true}, 'other')
  ]);
  const restartStates = await Promise.all(restarts.map(item => item.json()));
  assert.equal(restartStates[0].attempt.id, restartStates[1].attempt.id);
  assert.notEqual(currentIds.other, oldAttemptId);
  assert.equal((await post(`${prefix}/attempt/finish`, {attemptId: oldAttemptId}, 'other')).status, 200);
  assert.deepEqual(await (await post(`${prefix}/attempt/finish`, {attemptId: oldAttemptId}, 'other')).json(), otherResult);
  assert.equal((await post(`${prefix}/attempt/check`, {attemptId: oldAttemptId, index: 0, answer: 'A'}, 'other')).status, 409);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 0, answer: 'A'}, 'other')).status, 200);
  response = await post(`${prefix}/attempt`, {restart: true}, 'other');
  assert.equal((await response.json()).attempt.questions[0].checks, 1);
  assert.equal((await post(`${prefix}/attempt/check`, {index: 1, answer: 'B'}, 'other')).status, 200);
  const repeat = await Promise.all([post(`${prefix}/attempt/finish`, {}, 'other'), post(`${prefix}/attempt/finish`, {}, 'other')]);
  const repeatResults = await Promise.all(repeat.map(item => item.json()));
  assert.deepEqual(repeatResults[0], repeatResults[1]);
  assert.equal(repeatResults[0].kazanilanPuan, 10);
  assert.notEqual(repeatResults[0].id, otherResult.id);
  assert.equal((await post(`${prefix}/attempt/finish`, {attemptId: oldAttemptId}, 'owner')).status, 409);
});
