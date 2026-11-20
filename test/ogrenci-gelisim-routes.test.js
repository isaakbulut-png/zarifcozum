const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { ObjectId } = require('mongodb');
const { createGelisimRouters } = require('../routes/ogrenci-gelisim');

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(item => matches(document, item));
    const actual = document[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !(expected instanceof ObjectId)) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === '$exists') return (actual !== undefined) === value;
        if (operator === '$nin') return !value.some(item => String(actual) === String(item));
        if (operator === '$gte') return new Date(actual) >= value;
        if (operator === '$lte') return new Date(actual) <= value;
        return false;
      });
    }
    return String(actual) === String(expected);
  });
}

function collection() {
  const rows = [];
  return {
    rows,
    find(filter = {}) {
      let found = rows.filter(row => matches(row, filter));
      const cursor = {
        sort(order) {
          found.sort((left, right) => {
            const field = Object.keys(order)[0];
            return (new Date(left[field]) - new Date(right[field])) * order[field];
          });
          return cursor;
        },
        limit(count) { found = found.slice(0, count); return cursor; },
        toArray: async () => found
      };
      return cursor;
    },
    async findOne(filter) { return rows.find(row => matches(row, filter)) || null; },
    async insertOne(document) {
      const insertedId = new ObjectId();
      rows.push({ ...document, _id: insertedId });
      return { insertedId };
    },
    async deleteOne(filter) {
      const index = rows.findIndex(row => matches(row, filter));
      if (index < 0) return { deletedCount: 0 };
      rows.splice(index, 1);
      return { deletedCount: 1 };
    }
  };
}

async function setup() {
  const profiles = collection();
  const events = collection();
  const quizzes = collection();
  const noData = collection();
  profiles.rows.push({
    _id: new ObjectId(), teacherId: 'teacher-1', linkedUserId: 'student-1',
    grade: 6, active: true
  });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.get('x-role');
    req.session = { user: role ? { id: req.get('x-user') || `${role}-1`, role } : undefined };
    next();
  });
  const guard = role => (req, res, next) => {
    if (req.session.user?.role !== role) return res.status(req.session.user ? 403 : 401).json({ mesaj: 'Yetkisiz.' });
    next();
  };
  const routers = createGelisimRouters({
    requireTeacher: guard('teacher'),
    requireStudent: guard('student'),
    getStudentCollection: () => profiles,
    getAssignmentCollection: () => noData,
    getHomeworkCollection: () => noData,
    getResultCollection: () => noData,
    getPlannedLessonCollection: () => noData,
    getStudyLogCollection: () => noData,
    getGoalCollection: () => noData,
    getProgressCollection: () => noData,
    getCommentCollection: () => noData,
    getEventCollection: () => events,
    getQuizCollection: () => quizzes
  });
  app.use('/api/ogretmen/gelisim', routers.teacher);
  app.use('/api/student/gelisim', routers.student);
  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    events,
    quizzes,
    async request(path, { role, userId, method = 'GET', body } = {}) {
      const headers = {};
      if (role) headers['x-role'] = role;
      if (userId) headers['x-user'] = userId;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(base + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { response, data: await response.json() };
    },
    close: () => new Promise(resolve => server.close(resolve))
  };
}

test('öğretmen sınav planı bağlı öğrencinin takviminde görünür ve yalnız sahibi kaldırabilir', async () => {
  const app = await setup();
  try {
    const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const created = await app.request('/api/ogretmen/gelisim/sinavlar', {
      role: 'teacher', userId: 'teacher-1', method: 'POST',
      body: { title: 'Kesirler sınavı', grade: 6, date }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.sinav.title, 'Kesirler sınavı');

    const studentCalendar = await app.request('/api/student/gelisim/takvim', {
      role: 'student', userId: 'student-1'
    });
    assert.equal(studentCalendar.data.olaylar.length, 1);
    assert.equal(studentCalendar.data.olaylar[0].kind, 'sinav');
    assert.equal(studentCalendar.data.olaylar[0].title, 'Kesirler sınavı');

    const unrelatedStudentCalendar = await app.request('/api/student/gelisim/takvim', {
      role: 'student', userId: 'student-2'
    });
    assert.equal(unrelatedStudentCalendar.data.olaylar.length, 0);

    const otherTeacherSchedule = await app.request('/api/ogretmen/gelisim/sinavlar', {
      role: 'teacher', userId: 'teacher-2'
    });
    assert.equal(otherTeacherSchedule.data.sinavlar.length, 0);

    const forbiddenDelete = await app.request(`/api/ogretmen/gelisim/sinavlar/${created.data.sinav.id}`, {
      role: 'teacher', userId: 'teacher-2', method: 'DELETE'
    });
    assert.equal(forbiddenDelete.response.status, 404);
    assert.equal(app.events.rows.length, 1);

    const deleted = await app.request(`/api/ogretmen/gelisim/sinavlar/${created.data.sinav.id}`, {
      role: 'teacher', userId: 'teacher-1', method: 'DELETE'
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(app.events.rows.length, 0);
  } finally {
    await app.close();
  }
});

test('sınav planı geçersiz sınıfı ve bağlı öğrencisi olmayan sınıfı reddeder', async () => {
  const app = await setup();
  try {
    const invalidGrade = await app.request('/api/ogretmen/gelisim/sinavlar', {
      role: 'teacher', userId: 'teacher-1', method: 'POST',
      body: { title: 'Sınav', grade: 15, date: '2030-01-15' }
    });
    assert.equal(invalidGrade.response.status, 400);

    const unlinkedClass = await app.request('/api/ogretmen/gelisim/sinavlar', {
      role: 'teacher', userId: 'teacher-1', method: 'POST',
      body: { title: 'Sınav', grade: 7, date: '2030-01-15' }
    });
    assert.equal(unlinkedClass.response.status, 409);
    assert.equal(app.events.rows.length, 0);
  } finally {
    await app.close();
  }
});

test('sınav planı yalnız öğretmenin kendi testine bağlanabilir', async () => {
  const app = await setup();
  try {
    const quizId = new ObjectId();
    app.quizzes.rows.push({ _id: quizId, createdBy: 'teacher-1' });
    const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const created = await app.request('/api/ogretmen/gelisim/sinavlar', {
      role: 'teacher', userId: 'teacher-1', method: 'POST',
      body: { title: 'Bağlı testli sınav', grade: 6, date, quizId: String(quizId) }
    });
    assert.equal(created.response.status, 201);
    assert.equal(app.events.rows[0].quizId, String(quizId));

    const otherQuiz = new ObjectId();
    app.quizzes.rows.push({ _id: otherQuiz, createdBy: 'teacher-2' });
    const rejected = await app.request('/api/ogretmen/gelisim/sinavlar', {
      role: 'teacher', userId: 'teacher-1', method: 'POST',
      body: { title: 'Başkasının testi', grade: 6, date, quizId: String(otherQuiz) }
    });
    assert.equal(rejected.response.status, 404);
    assert.equal(app.events.rows.length, 1);
  } finally {
    await app.close();
  }
});
