const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {ObjectId} = require('mongodb');
const {createLiveQuizHandlers} = require('../routes/quizler');

test('müfredat ödevi testi yalnızca atanmış öğrenci tarafından başlatılır', async t => {
  const quizId = new ObjectId(), homeworkId = new ObjectId();
  const quiz = {_id: quizId, source: 'curriculum_assignment', createdBy: 'teacher', title: 'Ödev',
    questions: [{text: 'Soru', options: {A: 'a', B: 'b', C: 'c', D: 'd'}, answer: 'A'}]};
  const attempts = new Map();
  const handlers = createLiveQuizHandlers({
    getQuizCollection: () => ({findOne: async () => quiz}),
    getHomeworkCollection: () => ({findOne: async filter => filter.quizId === String(quizId) ? {_id: homeworkId} : null}),
    getHomeworkAssignmentCollection: () => ({findOne: async filter => filter.studentUserId === 'assigned' ? {_id: new ObjectId()} : null}),
    getAttemptCollection: () => ({
      findOne: async filter => attempts.get(filter._id),
      replaceOne: async (filter, doc) => {attempts.set(filter._id, doc); return {upsertedCount: 1};}
    }),
    getResultCollection: () => ({}), pointsService: {}
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {req.session = {user: {id: req.get('x-user'), name: 'Öğrenci'}}; next();});
  app.post('/quiz/:id/attempt', handlers.start);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/quiz/${quizId}/attempt`;
  const start = user => fetch(url, {method: 'POST', headers: {'x-user': user, 'content-type': 'application/json'}, body: '{}'});
  assert.equal((await start('other')).status, 404);
  assert.equal((await start('assigned')).status, 201);
  assert.equal((await start('other')).status, 404);
});
