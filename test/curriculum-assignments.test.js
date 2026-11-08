const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {createCurriculumAssignmentsRouter} = require('../routes/curriculum-assignments');

test('sınıf listesi ve gönderim oturum öğretmeniyle sınırlandırılır', async t => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use('/api/v1/assignments', createCurriculumAssignmentsRouter({
    requireTeacher: (req, res, next) => {
      if (req.get('x-role') !== 'teacher') return res.sendStatus(403);
      req.session = {user: {id: 'teacher-1'}};
      next();
    },
    getStudents: () => ({find: filter => {
      assert.deepEqual(filter, {teacherId: 'teacher-1', active: true});
      return {toArray: async () => [
        {grade: 9, section: 'A', linkedUserId: 'student'},
        {grade: 9, section: 'A'},
        {grade: 10, section: 'B', linkedUserId: 'student2'}
      ]};
    }}),
    service: {createAssignment: async body => {
      calls.push(body);
      return {status: 201, data: {question_count: 7, recipient_count: 2, unlinked_count: 1}};
    }}
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/assignments`;
  assert.equal((await fetch(`${base}/classes`)).status, 403);
  const headers = {'x-role': 'teacher', 'content-type': 'application/json'};
  const classes = await (await fetch(`${base}/classes`, {headers})).json();
  assert.deepEqual(classes.classes[0], {grade: 9, section: 'A', students: 2, linked: 1});
  const result = await fetch(base, {method: 'POST', headers, body: JSON.stringify({
    teacher_id: 'attacker', grade: 9, section: 'A', curriculum_node_ids: ['id'], due_date: '2027-01-01T00:00:00Z'
  })});
  assert.equal(result.status, 201);
  assert.equal(calls[0].teacher_id, 'teacher-1');
  assert.equal((await result.json()).question_count, 7);
});
