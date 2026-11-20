const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createSorularRouter } = require('../routes/sorular');
const { createRequireRole } = require('../routes/auth');
const Soru = require('../models/Soru');

function withServer(sessionUser, callback, yukleyici) {
  const UserModel = {
    findById: id => ({ select: async () => sessionUser ? { ...sessionUser, _id: { toString: () => id } } : null })
  };
  const requireRole = createRequireRole(UserModel);
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
  await withServer({ id: 'support-1', role: 'admin', adminRole: 'support' }, async base => {
    assert.equal((await fetch(base)).status, 403);
  });
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
    await withServer({ id: 'editor-1', role: 'admin', adminRole: 'editor' }, async base => {
      assert.equal((await fetch(base)).status, 200);
    });
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

test('soru tekil ve toplu silme API testleri', async () => {
  const origFindByIdAndDelete = Soru.findByIdAndDelete;
  const origFind = Soru.find;
  const origDeleteMany = Soru.deleteMany;

  Soru.findByIdAndDelete = id => ({ lean: async () => ({ _id: id, ders: 'matematik' }) });
  Soru.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439011' }, { _id: '507f1f77bcf86cd799439012' }] });
  Soru.deleteMany = async () => ({ deletedCount: 2 });

  try {
    await withServer({ id: 't1', role: 'teacher' }, async base => {
      // 1. Tekil silme
      const delRes = await fetch(`${base}/507f1f77bcf86cd799439011`, { method: 'DELETE' });
      assert.equal(delRes.status, 200);
      const delData = await delRes.json();
      assert.equal(delData.mesaj, 'Soru silindi.');

      // 2. Geçersiz ID ile silme
      const badRes = await fetch(`${base}/gecersiz-id`, { method: 'DELETE' });
      assert.equal(badRes.status, 400);

      // 3. Toplu silme
      const bulkRes = await fetch(`${base}/toplu-sil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'] })
      });
      assert.equal(bulkRes.status, 200);
      const bulkData = await bulkRes.json();
      assert.equal(bulkData.silinenSayisi, 2);

      // 4. Boş toplu silme
      const emptyBulk = await fetch(`${base}/toplu-sil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [] })
      });
      assert.equal(emptyBulk.status, 400);
    });
  } finally {
    Soru.findByIdAndDelete = origFindByIdAndDelete;
    Soru.find = origFind;
    Soru.deleteMany = origDeleteMany;
  }
});
