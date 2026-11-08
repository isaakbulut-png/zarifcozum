const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {createStudentRecommendationsRouter} = require('../routes/student-recommendations');

test('öneriler yalnızca öğrencinin kendisi, bağlı velisi ve öğretmenine açıktır', async t => {
  const student = '111111111111111111111111';
  const other = '222222222222222222222222';
  const calls = [];
  const query = value => ({select: () => ({lean: async () => value})});
  const app = express();
  app.use((req, res, next) => {
    req.session = {user: {id: req.get('x-id'), role: req.get('x-role')}};
    next();
  });
  app.use('/api/student', createStudentRecommendationsRouter({
    requireRoles: (req, res, next) => ['student', 'parent', 'teacher'].includes(req.session.user.role) ? next() : res.sendStatus(403),
    ParentModel: {findById: id => query(id === 'parent' ? {studentId: student} : {studentId: student, restricted: true})},
    UserModel: {findOne: filter => query(filter._id === student ? {_id: student} : null)},
    getStudents: () => ({findOne: async filter => filter.teacherId === 'teacher' && filter.linkedUserId === student ? {} : null}),
    service: {getRecommendations: async id => {calls.push(id); return {status: 200, data: {student_id: id}};}}
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/student/recommendations`;
  const get = (role, id, queryString = '') => fetch(base + queryString, {headers: {'x-role': role, 'x-id': id}});
  assert.equal((await get('student', student)).status, 200);
  assert.equal((await get('student', student, `?student_id=${other}`)).status, 403);
  assert.equal((await get('parent', 'parent')).status, 200);
  assert.equal((await get('parent', 'parent', `?student_id=${other}`)).status, 403);
  assert.equal((await get('parent', 'restricted')).status, 403);
  assert.equal((await get('teacher', 'teacher', `?student_id=${student}`)).status, 200);
  assert.equal((await get('teacher', 'teacher', `?student_id=${other}`)).status, 404);
  assert.equal((await get('teacher', 'teacher')).status, 400);
  assert.equal((await get('admin', 'admin')).status, 403);
  assert.deepEqual(calls, [student, student, student]);
});
