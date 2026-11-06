const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { requireKonuLogin } = require('../lib/konu-erisimi');

test('konu içeriği erişim koruması anonim istekleri reddeder ve oturumu doğrular', async () => {
  const app = express();
  app.use((req, res, next) => {
    req.session = { user: req.headers['x-test-role'] ? { id: '1', role: req.headers['x-test-role'] } : null };
    next();
  });
  app.get('/summary', requireKonuLogin, (req, res) => res.json({ summary: 'içerik' }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}/summary`;
    const guest = await fetch(url);
    assert.equal(guest.status, 403);
    assert.equal(guest.headers.get('cache-control'), 'no-store');
    assert.equal((await guest.json()).kod, 'UYELIK_GEREKLI');
    assert.equal((await fetch(url, { headers: { 'x-test-role': 'unknown' } })).status, 403);
    for (const role of ['student', 'teacher', 'admin']) {
      assert.equal((await fetch(url, { headers: { 'x-test-role': role } })).status, 200);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
