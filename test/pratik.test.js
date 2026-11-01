const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createPratikRouter } = require('../routes/pratik');
const { mufredatiYukle } = require('../lib/mufredat');

const mufredat = mufredatiYukle();
const konular = mufredat[6].flatMap(unite => unite.topics);

function sahteKullanim() {
  const kayitlar = new Map();
  const anahtar = f => `${f.key}|${f.ozellik}`;
  return {
    async findOne(f) { return kayitlar.get(anahtar(f)) || null; },
    async updateOne(f, g) {
      const mevcut = kayitlar.get(anahtar(f));
      if (!mevcut) {
        kayitlar.set(anahtar(f), { key: f.key, ozellik: f.ozellik, konular: [g.$push.konular] });
        return;
      }
      const dolu = mevcut.konular.length >= 3;
      const var_ = mevcut.konular.some(k => k.sinif === g.$push.konular.sinif && k.konu === g.$push.konular.konu);
      if (dolu || var_) throw Object.assign(new Error('dup'), { code: 11000 });
      mevcut.konular.push(g.$push.konular);
    }
  };
}

function sahteIcerik() {
  const harita = new Map();
  return {
    async findOne(f) { return harita.get(JSON.stringify(f)) || null; },
    async updateOne(f, g) { harita.set(JSON.stringify(f), { icerik: g.$setOnInsert.icerik }); }
  };
}

async function sunucu({ uye = false, kullanici = null } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: kullanici }; next(); });
  let uretimSayisi = 0;
  app.use('/api/pratik', createPratikRouter({
    getUsageCollection: (() => { const k = sahteKullanim(); return () => k; })(),
    getContentCollection: (() => { const k = sahteIcerik(); return () => k; })(),
    mufredat,
    uyeMi: async () => uye,
    soruUret: async ({ adet }) => {
      uretimSayisi += 1;
      return Array.from({ length: adet }, (_, i) => ({ text: `S${i}`, options: { A: '1', B: '2', C: '3', D: '4' }, answer: 'A', explanation: 'x' }));
    },
    konuUret: async () => ({ ozet: 'o', kavramlar: ['k'], ornekSoru: 'q', ornekCozum: 'c', sikHatalar: ['h'] }),
    limitleyici: (req, res, next) => next()
  }));
  const srv = await new Promise(coz => { const s = app.listen(0, () => coz(s)); });
  const taban = `http://127.0.0.1:${srv.address().port}/api/pratik`;
  let cerez = '';
  async function istek(yol, govde) {
    const r = await fetch(taban + yol, {
      method: govde ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: govde ? JSON.stringify(govde) : undefined
    });
    const set = r.headers.get('set-cookie');
    if (set) cerez = set.split(';')[0];
    return { status: r.status, veri: await r.json() };
  }
  return { istek, kapat: () => srv.close(), uretim: () => uretimSayisi };
}

test('ücretsiz kullanıcı özellik başına 3 konu ve 5 soru alır, 4. konuda üyeliğe yönlendirilir', async () => {
  const s = await sunucu();
  try {
    for (let i = 0; i < 3; i += 1) {
      const r = await s.istek('/sorular', { ozellik: 'test', sinif: 6, konu: konular[i] });
      assert.equal(r.status, 200);
      assert.equal(r.veri.sorular.length, 5);
    }
    const tekrar = await s.istek('/sorular', { ozellik: 'test', sinif: 6, konu: konular[0] });
    assert.equal(tekrar.status, 200);
    const dorduncu = await s.istek('/sorular', { ozellik: 'test', sinif: 6, konu: konular[3] });
    assert.equal(dorduncu.status, 403);
    assert.equal(dorduncu.veri.kod, 'UYELIK_GEREKLI');
    assert.equal(dorduncu.veri.yonlendir, '/Paketler.html');
    const baska = await s.istek('/sorular', { ozellik: 'asistan', sinif: 6, konu: konular[3] });
    assert.equal(baska.status, 200);
  } finally { s.kapat(); }
});

test('konu anlatımı da 3 konuyla sınırlıdır', async () => {
  const s = await sunucu();
  try {
    for (let i = 0; i < 3; i += 1) assert.equal((await s.istek('/konu', { sinif: 6, konu: konular[i] })).status, 200);
    assert.equal((await s.istek('/konu', { sinif: 6, konu: konular[3] })).status, 403);
  } finally { s.kapat(); }
});

test('üye sınırsızdır ve 10 soru isteyebilir', async () => {
  const s = await sunucu({ uye: true, kullanici: { id: 'u1', role: 'student' } });
  try {
    for (let i = 0; i < 5; i += 1) {
      const r = await s.istek('/sorular', { ozellik: 'kazanim', sinif: 6, konu: konular[i], adet: 10 });
      assert.equal(r.status, 200);
      assert.equal(r.veri.sorular.length, 10);
    }
    assert.equal((await s.istek('/durum')).veri.uye, true);
  } finally { s.kapat(); }
});

test('geçersiz sınıf veya konu 400 döner', async () => {
  const s = await sunucu();
  try {
    assert.equal((await s.istek('/sorular', { ozellik: 'test', sinif: 4, konu: konular[0] })).status, 400);
    assert.equal((await s.istek('/sorular', { ozellik: 'test', sinif: 6, konu: 'yok' })).status, 400);
    assert.equal((await s.istek('/sorular', { ozellik: 'x', sinif: 6, konu: konular[0] })).status, 400);
  } finally { s.kapat(); }
});
