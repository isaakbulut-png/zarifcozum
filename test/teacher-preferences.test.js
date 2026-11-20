const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createTeacherPreferencesRouter } = require('../routes/teacher-preferences');

function createUserModel() {
  const users = new Map([
    ['teacher-1', { _id: 'teacher-1', role: 'teacher', teacherPanelPreferences: null }]
  ]);
  return {
    users,
    findById(id) {
      return {
        select() {
          return { lean: async () => users.get(String(id)) || null };
        }
      };
    },
    async updateOne(filter, update) {
      const user = users.get(String(filter._id));
      if (!user || !filter.role.$in.includes(user.role)) return { matchedCount: 0 };
      user.teacherPanelPreferences = update.$set.teacherPanelPreferences;
      return { matchedCount: 1 };
    }
  };
}

async function setup() {
  const UserModel = createUserModel();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.get('x-role');
    req.session = { user: role ? { id: req.get('x-user') || 'teacher-1', role } : undefined };
    next();
  });
  const requireTeacher = (req, res, next) => {
    if (!['teacher', 'admin'].includes(req.session.user?.role)) {
      return res.status(req.session.user ? 403 : 401).json({ mesaj: 'Yetkisiz.' });
    }
    next();
  };
  app.use('/api/ogretmen/tercihler', createTeacherPreferencesRouter({ requireTeacher, UserModel }));
  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    UserModel,
    async request(path, { role = 'teacher', method = 'GET', body } = {}) {
      const headers = {};
      if (role) headers['x-role'] = role;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(base + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { response, data: await response.json() };
    },
    close: () => new Promise(resolve => server.close(resolve))
  };
}

test('öğretmen tercihleri hesaba yazılır ve sonraki okumada geri gelir', async () => {
  const app = await setup();
  try {
    const preferences = {
      displayName: 'Öğretmen Örnek', branch: 'Matematik', grades: [6, 8],
      notifications: false
    };
    const saved = await app.request('/api/ogretmen/tercihler', { method: 'PUT', body: preferences });
    assert.equal(saved.response.status, 200);
    assert.deepEqual(saved.data.preferences, preferences);

    const loaded = await app.request('/api/ogretmen/tercihler');
    assert.deepEqual(loaded.data.preferences, preferences);
  } finally {
    await app.close();
  }
});

test('öğretmen tercihleri hatalı değerleri ve öğrenci erişimini reddeder', async () => {
  const app = await setup();
  try {
    const invalid = await app.request('/api/ogretmen/tercihler', {
      method: 'PUT', body: { displayName: 'Öğretmen', branch: 'Matematik', grades: [13], notifications: true }
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(app.UserModel.users.get('teacher-1').teacherPanelPreferences, null);

    const forbidden = await app.request('/api/ogretmen/tercihler', { role: 'student' });
    assert.equal(forbidden.response.status, 403);
  } finally {
    await app.close();
  }
});
