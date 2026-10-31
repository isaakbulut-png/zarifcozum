const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createDenemelerRouters } = require('../routes/denemeler');
const { requireRole } = require('../routes/auth');
const Deneme = require('../models/Deneme');
const Soru = require('../models/Soru');

const ID1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ID2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const DENEME_ID = 'cccccccccccccccccccccccc';

function lean(rows) {
  const q = { select: () => q, sort: () => q, limit: () => q, lean: async () => rows };
  return q;
}

function sahteSonucKoleksiyonu() {
  const kayitlar = [];
  return {
    kayitlar,
    find: filtre => ({ toArray: async () => kayitlar.filter(k => k.studentId === filtre.studentId) }),
    updateOne: async (filtre, guncelle) => {
      const var_ = kayitlar.find(k => k.studentId === filtre.studentId && String(k.quizId) === String(filtre.quizId));
      if (var_) return { upsertedCount: 0 };
      kayitlar.push({ ...filtre, ...guncelle.$setOnInsert });
      return { upsertedCount: 1 };
    }
  };
}

function withServer(user, callback, { sonuclar = sahteSonucKoleksiyonu() } = {}) {
  const { staff, student, acik } = createDenemelerRouters({
    requireStaff: requireRole('teacher', 'admin'),
    requireStudent: requireRole('student'),
    getResultCollection: () => sonuclar
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user }; next(); });
  app.use('/api/denemeler', staff);
  app.use('/api/ogrenci/denemeler', student);
  app.use('/api/acik-deneme', acik);
  const server = app.listen(0);
  return new Promise((resolve, reject) => {
    server.once('listening', async () => {
      try {
        await callback(`http://127.0.0.1:${server.address().port}`, sonuclar);
        server.close(() => resolve());
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

function stub(nesne, ad, deger) {
  const eski = nesne[ad];
  nesne[ad] = deger;
  return () => { nesne[ad] = eski; };
}

const json = (body, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('yönetim API öğrenci ve anonim oturumlarını reddeder; öğrenci API öğretmeni reddeder', async () => {
  await withServer(undefined, async base => assert.equal((await fetch(`${base}/api/denemeler`)).status, 401));
  await withServer({ id: 's1', role: 'student' }, async base => assert.equal((await fetch(`${base}/api/denemeler`)).status, 403));
  await withServer({ id: 't1', role: 'teacher' }, async base => assert.equal((await fetch(`${base}/api/ogrenci/denemeler`)).status, 403));
});

test('cevabı girilmemiş soruyla deneme oluşturulamaz', async () => {
  const geri = stub(Soru, 'find', () => lean([{ _id: ID1, answer: 'A' }, { _id: ID2, answer: null }]));
  try {
    await withServer({ id: 't1', role: 'teacher' }, async base => {
      const r = await fetch(`${base}/api/denemeler`, json({ title: 'D1', soruIds: [ID1, ID2] }));
      assert.equal(r.status, 400);
      assert.match((await r.json()).mesaj, /cevabı girilmemiş/);
      assert.equal((await fetch(`${base}/api/denemeler`, json({ title: 'D1', soruIds: [ID1, ID1] }))).status, 400);
      assert.equal((await fetch(`${base}/api/denemeler`, json({ title: '', soruIds: [ID1] }))).status, 400);
    });
  } finally { geri(); }
});

test('öğretmen ve admin cevapları tam sorularla deneme oluşturabilir', async () => {
  const geriFind = stub(Soru, 'find', () => lean([{ _id: ID1, answer: 'A' }, { _id: ID2, answer: 'C' }]));
  let olusan;
  const geriCreate = stub(Deneme, 'create', async doc => { olusan = doc; return { _id: DENEME_ID, ...doc }; });
  try {
    for (const role of ['teacher', 'admin']) {
      await withServer({ id: 'u1', role }, async base => {
        const r = await fetch(`${base}/api/denemeler`, json({ title: ' Deneme 1 ', soruIds: [ID2, ID1] }));
        assert.equal(r.status, 201);
      });
      assert.equal(olusan.title, 'Deneme 1');
      assert.deepEqual(olusan.soruIds, [ID2, ID1]);
    }
  } finally { geriFind(); geriCreate(); }
});

test('öğrenci deneme açarken doğru cevaplar yanıtta yer almaz', async () => {
  const geriDeneme = stub(Deneme, 'findOne', () => lean({ _id: DENEME_ID, title: 'D1', description: '', soruIds: [ID1, ID2] }));
  const geriSoru = stub(Soru, 'find', () => lean([
    { _id: ID1, imageUrl: 'https://res.cloudinary.com/a.png', answer: 'A' },
    { _id: ID2, imageUrl: 'https://res.cloudinary.com/b.png', answer: 'C' }
  ]));
  try {
    await withServer({ id: 's1', role: 'student', name: 'Ada' }, async base => {
      const r = await fetch(`${base}/api/ogrenci/denemeler/${DENEME_ID}`);
      assert.equal(r.status, 200);
      const govde = await r.json();
      assert.deepEqual(govde.sorular.map(s => s.imageUrl), ['https://res.cloudinary.com/a.png', 'https://res.cloudinary.com/b.png']);
      assert.ok(!JSON.stringify(govde).includes('"answer"') && !JSON.stringify(govde).includes('dogru'));
    });
  } finally { geriDeneme(); geriSoru(); }
});

test('teslim puanlanır, kaydedilir ve ikinci teslim 409 döner', async () => {
  const geriDeneme = stub(Deneme, 'findOne', () => lean({ _id: DENEME_ID, title: 'D1', soruIds: [ID1, ID2] }));
  const geriSoru = stub(Soru, 'find', () => lean([{ _id: ID1, imageUrl: 'a', answer: 'A' }, { _id: ID2, imageUrl: 'b', answer: 'C' }]));
  try {
    await withServer({ id: 's1', role: 'student', name: 'Ada' }, async (base, sonuclar) => {
      assert.equal((await fetch(`${base}/api/ogrenci/denemeler/${DENEME_ID}/teslim`, json({ answers: ['A'] }))).status, 400);
      assert.equal((await fetch(`${base}/api/ogrenci/denemeler/${DENEME_ID}/teslim`, json({ answers: ['A', 'Z'] }))).status, 400);
      const r = await fetch(`${base}/api/ogrenci/denemeler/${DENEME_ID}/teslim`, json({ answers: ['A', 'B'] }));
      assert.equal(r.status, 201);
      const govde = await r.json();
      assert.equal(govde.score, 50);
      assert.equal(govde.correctCount, 1);
      assert.deepEqual(govde.review, [{ no: 1, secilen: 'A', dogru: 'A' }, { no: 2, secilen: 'B', dogru: 'C' }]);
      assert.equal(sonuclar.kayitlar[0].type, 'deneme');
      assert.equal(sonuclar.kayitlar[0].studentId, 's1');
      assert.equal((await fetch(`${base}/api/ogrenci/denemeler/${DENEME_ID}/teslim`, json({ answers: ['A', 'C'] }))).status, 409);
    });
  } finally { geriDeneme(); geriSoru(); }
});

test('herkese açık deneme girişsiz açılır, cevap sızdırmaz, puanlanır ama kaydedilmez', async () => {
  const geriDeneme = stub(Deneme, 'findOne', () => lean({ _id: DENEME_ID, title: 'Açık', description: '', soruIds: [ID1, ID2] }));
  const geriSoru = stub(Soru, 'find', () => lean([
    { _id: ID1, imageUrl: 'https://res.cloudinary.com/a.png', answer: 'A' },
    { _id: ID2, imageUrl: 'https://res.cloudinary.com/b.png', answer: 'C' }
  ]));
  try {
    await withServer(undefined, async (base, sonuclar) => {
      const r = await fetch(`${base}/api/acik-deneme`);
      assert.equal(r.status, 200);
      const govde = await r.json();
      assert.equal(govde.sorular.length, 2);
      assert.ok(!JSON.stringify(govde).includes('"answer"'));
      const k = await fetch(`${base}/api/acik-deneme/kontrol`, json({ answers: ['A', 'B'] }));
      assert.equal(k.status, 200);
      assert.equal((await k.json()).correctCount, 1);
      assert.equal(sonuclar.kayitlar.length, 0);
      assert.equal((await fetch(`${base}/api/acik-deneme/kontrol`, json({ answers: ['A'] }))).status, 400);
    });
  } finally { geriDeneme(); geriSoru(); }
});

test('öğretmen bir denemeyi herkese açık yapınca diğerleri kapatılır', async () => {
  let kapatma;
  const geriMany = stub(Deneme, 'updateMany', async (filtre, guncelle) => { kapatma = { filtre, guncelle }; });
  const geriUpdate = stub(Deneme, 'findByIdAndUpdate', () => lean({ published: true, herkeseAcik: true }));
  try {
    await withServer({ id: 't1', role: 'teacher' }, async base => {
      const r = await fetch(`${base}/api/denemeler/${DENEME_ID}`, json({ herkeseAcik: true }, 'PATCH'));
      assert.equal(r.status, 200);
      assert.equal((await r.json()).herkeseAcik, true);
      assert.deepEqual(kapatma.guncelle, { $set: { herkeseAcik: false } });
    });
  } finally { geriMany(); geriUpdate(); }
});
