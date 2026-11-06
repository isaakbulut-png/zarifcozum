const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { ObjectId, Binary } = require('mongodb');
const { createCozumluSorularRouters } = require('../routes/cozumlu-sorular');

function setup() {
  const rows = [];
  const logs = [];
  const query = value => ({ sort() { return this; }, select() { return this; }, lean: async () => value });
  const Model = {
    aggregate: async pipeline => {
      const byTopic = new Map();
      rows.filter(row => row.grade === pipeline[0].$match.grade).forEach(row => {
        const key = JSON.stringify([row.unite, row.konu]);
        const existing = byTopic.get(key) || { _id: { unite: row.unite, konu: row.konu }, adet: 0 };
        existing.adet++;
        byTopic.set(key, existing);
      });
      return [...byTopic.values()];
    },
    find: filter => query(rows.filter(row => Object.entries(filter).every(([key, value]) => row[key] === value))),
    findById: id => query(rows.find(row => row._id.toString() === id) || null),
    findByIdAndDelete: id => {
      const index = rows.findIndex(row => row._id.toString() === id);
      return query(index < 0 ? null : rows.splice(index, 1)[0]);
    },
    create: async data => {
      const row = { ...data, _id: new ObjectId(), createdAt: new Date() };
      rows.push(row);
      return row;
    }
  };
  const User = {
    findById: id => ({ select: async () => ({
      _id: id, name: 'Yönetici', role: id === 'student' ? 'student' : id === 'editor' ? 'teacher' : 'admin',
      adminRole: id === 'editor' ? 'editor' : undefined
    }) })
  };
  const routers = createCozumluSorularRouters({
    Model, User, AdminLog: { create: async log => logs.push(log) },
    getTopics: async grade => grade === 5 ? [{ unite: 'Sayılar', dosya_adi: 'Kesirler' }] : []
  });
  const app = express();
  app.use((req, res, next) => {
    const role = req.headers['x-test-user'];
    req.session = role ? { user: { id: role, role: role === 'admin' ? 'admin' : role === 'editor' ? 'teacher' : 'student' } } : {};
    next();
  });
  app.use('/api/cozumlu-sorular', routers.publicRouter);
  app.use('/api/admin/cozumlu-sorular', routers.admin);
  return { app, rows, logs };
}

async function withServer(callback) {
  const fixture = setup();
  const server = fixture.app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`, fixture); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function form(options = {}) {
  const data = new FormData();
  data.set('grade', options.grade || '5');
  data.set('unite', options.unite || 'Sayılar');
  data.set('konu', options.konu || 'Kesirler');
  data.set('baslik', 'Örnek soru');
  data.set('resim', new Blob([options.image || Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'soru.jpg');
  return data;
}

test('only superadmin uploads valid curriculum questions; members alone access contents and images', async () => {
  await withServer(async (base, { rows, logs }) => {
    const adminUrl = `${base}/api/admin/cozumlu-sorular`;
    const post = (who, data) => fetch(adminUrl, { method: 'POST', headers: who ? { 'x-test-user': who } : {}, body: data });
    assert.equal((await post(null, form())).status, 401);
    assert.equal((await post('editor', form())).status, 403);
    assert.equal((await post('student', form())).status, 403);
    assert.equal((await post('admin', form({ konu: 'Geçersiz' }))).status, 400);
    assert.equal((await post('admin', form({ grade: '6' }))).status, 400);
    assert.equal((await post('admin', form({ image: Buffer.from('not an image') }))).status, 400);
    const created = await post('admin', form());
    assert.equal(created.status, 201);
    const { soru } = await created.json();
    assert.equal(rows.length, 1);
    assert.equal(logs[0].action, 'solved_question.created');

    const counts = await (await fetch(`${base}/api/cozumlu-sorular/sayilar?grade=5`)).json();
    assert.deepEqual(counts.sayilar, [{ unite: 'Sayılar', konu: 'Kesirler', adet: 1 }]);
    const params = new URLSearchParams({ grade: '5', unite: 'Sayılar', konu: 'Kesirler' });
    const anonymous = await fetch(`${base}/api/cozumlu-sorular?${params}`);
    assert.equal(anonymous.status, 403);
    assert.equal((await anonymous.json()).kod, 'UYELIK_GEREKLI');
    const imageUrl = `${base}/api/cozumlu-sorular/${soru.id}/resim`;
    assert.equal((await fetch(imageUrl)).status, 403);
    const authenticated = { headers: { 'x-test-user': 'student' } };
    const list = await (await fetch(`${base}/api/cozumlu-sorular?${params}`, authenticated)).json();
    assert.equal(list.sorular[0].baslik, 'Örnek soru');
    assert.equal(list.sorular[0].image, undefined);
    const image = await fetch(imageUrl, authenticated);
    assert.equal(image.headers.get('content-type'), 'image/jpeg');
    assert.equal(image.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    rows[0].image = new Binary(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const binaryImage = await fetch(imageUrl, authenticated);
    assert.deepEqual(Buffer.from(await binaryImage.arrayBuffer()), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    assert.equal((await fetch(`${base}/api/cozumlu-sorular/sayilar?grade=4`)).status, 400);
    assert.deepEqual((await (await fetch(`${base}/api/cozumlu-sorular/sayilar?grade=6`)).json()).sayilar, []);
    assert.equal((await fetch(`${base}/api/cozumlu-sorular/not-an-id/resim`, authenticated)).status, 400);
    assert.equal((await post('admin', form({ image: Buffer.alloc(5 * 1024 * 1024 + 1) }))).status, 413);
    assert.equal((await fetch(`${adminUrl}/${soru.id}`, { method: 'DELETE', headers: { 'x-test-user': 'editor' } })).status, 403);
    assert.equal((await fetch(`${adminUrl}/${soru.id}`, { method: 'DELETE', headers: { 'x-test-user': 'admin' } })).status, 200);
    assert.equal(logs[1].action, 'solved_question.deleted');
    assert.equal((await fetch(imageUrl, authenticated)).status, 404);
  });
});
