const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createSorularRouter } = require('../routes/sorular');
const { requireRole } = require('../routes/auth');
const Soru = require('../models/Soru');

function withServer(sessionUser, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: sessionUser }; next(); });
  app.use('/api/sorular', createSorularRouter({ requireStaff: requireRole('teacher', 'admin') }));
  const server = app.listen(0);
  return new Promise((resolve, reject) => {
    server.once('listening', async () => {
      try {
        await callback(`http://127.0.0.1:${server.address().port}/api/sorular`);
        server.close(() => resolve());
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

test('soru API anonim ve öğrenci oturumlarını reddeder', async () => {
  for (const user of [undefined, { id: '1', role: 'student' }]) {
    await withServer(user, async base => {
      assert.equal((await fetch(base)).status, user ? 403 : 401);
      assert.equal((await fetch(`${base}/tara`, { method: 'POST' })).status, user ? 403 : 401);
    });
  }
});

test('öğretmen ve admin soruları listeleyebilir', async () => {
  const original = Soru.find;
  const query = { sort: () => query, limit: () => query, lean: async () => [] };
  Soru.find = () => query;
  try {
    for (const role of ['teacher', 'admin']) {
      await withServer({ id: '1', role }, async base => {
        const response = await fetch(base);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { sorular: [] });
      });
    }
  } finally {
    Soru.find = original;
  }
});

test('geçersiz cevap veya soru numarası 400 döner', async () => {
  await withServer({ id: '1', role: 'teacher' }, async base => {
    const bad = await fetch(`${base}/507f1f77bcf86cd799439011/cevap`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'Z' })
    });
    assert.equal(bad.status, 400);
    const badId = await fetch(`${base}/abc/cevap`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'A' })
    });
    assert.equal(badId.status, 400);
  });
});
