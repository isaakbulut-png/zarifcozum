const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createSorularRouter } = require('../routes/sorular');
const { requireRole } = require('../routes/auth');
const Soru = require('../models/Soru');

function withServer(sessionUser, callback, yukleyici) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: sessionUser }; next(); });
  app.use('/api/sorular', createSorularRouter({ requireStaff: requireRole('teacher', 'admin'), ...(yukleyici && { yukleyici }) }));
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

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

function sahteYukleyici(yuklenenler = [], yapilandirildi = true) {
  return {
    KLASOR: 'zarifcozum/sorular',
    yapilandirildi: () => yapilandirildi,
    icerikKimligi: () => 'abc123',
    cloudinaryaYukle: async (buffer, publicId) => {
      yuklenenler.push(publicId);
      return { url: `https://res.cloudinary.com/demo/image/upload/zarifcozum/sorular/${publicId}.png`, publicId: `zarifcozum/sorular/${publicId}` };
    }
  };
}

function resimFormu(buffer, alanlar = {}) {
  const form = new FormData();
  form.append('resim', new Blob([buffer], { type: 'image/png' }), 'x.png');
  Object.entries(alanlar).forEach(([k, v]) => form.append(k, v));
  return form;
}

test('resim yüklenince Cloudinary URL\'si Soru kaydına yazılır', async () => {
  const yuklenenler = [];
  const originalFindOne = Soru.findOne;
  const originalCreate = Soru.create;
  let kaydedilen;
  Soru.findOne = () => ({ lean: async () => null });
  Soru.create = async doc => { kaydedilen = doc; return { _id: 'id1', createdAt: new Date(), ...doc }; };
  try {
    await withServer({ id: 'u1', role: 'teacher' }, async base => {
      const response = await fetch(`${base}/yukle`, { method: 'POST', body: resimFormu(PNG, { ders: 'Matematik', siraNo: '3', answer: 'b' }) });
      assert.equal(response.status, 201);
    }, sahteYukleyici(yuklenenler));
    assert.deepEqual(yuklenenler, ['abc123']);
    assert.equal(kaydedilen.imageUrl, 'https://res.cloudinary.com/demo/image/upload/zarifcozum/sorular/abc123.png');
    assert.equal(kaydedilen.cloudinaryPublicId, 'zarifcozum/sorular/abc123');
    assert.equal(kaydedilen.ders, 'matematik');
    assert.equal(kaydedilen.siraNo, 3);
    assert.equal(kaydedilen.answer, 'B');
  } finally {
    Soru.findOne = originalFindOne;
    Soru.create = originalCreate;
  }
});

test('aynı resim ikinci kez yüklenmez (409) ve Cloudinary çağrılmaz', async () => {
  const yuklenenler = [];
  const originalFindOne = Soru.findOne;
  Soru.findOne = () => ({ lean: async () => ({ _id: 'id1', imageUrl: 'u', ders: 'genel' }) });
  try {
    await withServer({ id: 'u1', role: 'admin' }, async base => {
      assert.equal((await fetch(`${base}/yukle`, { method: 'POST', body: resimFormu(PNG) })).status, 409);
    }, sahteYukleyici(yuklenenler));
    assert.deepEqual(yuklenenler, []);
  } finally {
    Soru.findOne = originalFindOne;
  }
});

test('resim olmayan dosya, büyük dosya ve yapılandırma eksikliği reddedilir', async () => {
  await withServer({ id: 'u1', role: 'teacher' }, async base => {
    const sahte = await fetch(`${base}/yukle`, { method: 'POST', body: resimFormu(Buffer.from('<svg onload=alert(1)>')) });
    assert.equal(sahte.status, 400);
    const buyuk = await fetch(`${base}/yukle`, { method: 'POST', body: resimFormu(Buffer.alloc(5 * 1024 * 1024 + 10, 1)) });
    assert.equal(buyuk.status, 413);
    const dosyasiz = await fetch(`${base}/yukle`, { method: 'POST', body: new FormData() });
    assert.equal(dosyasiz.status, 400);
  }, sahteYukleyici());
  await withServer({ id: 'u1', role: 'teacher' }, async base => {
    assert.equal((await fetch(`${base}/yukle`, { method: 'POST', body: resimFormu(PNG) })).status, 503);
  }, sahteYukleyici([], false));
  await withServer({ id: 's1', role: 'student' }, async base => {
    assert.equal((await fetch(`${base}/yukle`, { method: 'POST', body: resimFormu(PNG) })).status, 403);
  }, sahteYukleyici());
});
