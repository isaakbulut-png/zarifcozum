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
    async updateOne(f, g, options = {}) {
      const mevcut = kayitlar.get(anahtar(f));
      if (g.$inc) {
        const artim = g.$inc.soruSayisi;
        const sinir = f.soruSayisi.$lte;
        if (mevcut && mevcut.soruSayisi > sinir) throw Object.assign(new Error('limit'), { code: 11000 });
        if (mevcut) mevcut.soruSayisi += artim;
        else kayitlar.set(anahtar(f), { ...g.$setOnInsert, soruSayisi: artim });
        return { matchedCount: mevcut ? 1 : 0, upsertedCount: mevcut ? 0 : 1 };
      }
      if (!mevcut) {
        if (options.upsert) {
          kayitlar.set(anahtar(f), { ...g.$setOnInsert, key: f.key, ozellik: f.ozellik, konular: [g.$push.konular] });
          return { upsertedCount: 1 };
        }
        return { matchedCount: 0, upsertedCount: 0 };
      }
      const konuIndeksi = Object.keys(f).find(key => /^konular\.\d+$/.test(key));
      const konuSiniri = konuIndeksi ? Number(konuIndeksi.split('.')[1]) + 1 : 3;
      const dolu = mevcut.konular.length >= konuSiniri;
      const var_ = mevcut.konular.some(k => k.sinif === g.$push.konular.sinif && k.konu === g.$push.konular.konu);
      if (dolu || var_) throw Object.assign(new Error('dup'), { code: 11000 });
      mevcut.konular.push(g.$push.konular);
      return { matchedCount: 1, upsertedCount: 0 };
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

async function sunucu({
  uye = false,
  kullanici = null,
  ziyaretciHaklari,
  mufredatKonusuVarMi = async () => false,
  konuUret = async () => ({ ozet: 'o', kavramlar: ['k'], ornekSoru: 'q', ornekCozum: 'c', sikHatalar: ['h'] })
} = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: kullanici }; next(); });
  let uretimSayisi = 0;
  app.use('/api/pratik', createPratikRouter({
    getUsageCollection: (() => { const k = sahteKullanim(); return () => k; })(),
    getContentCollection: (() => { const k = sahteIcerik(); return () => k; })(),
    mufredat,
    uyeMi: async () => uye,
    ziyaretciHaklari,
    mufredatKonusuVarMi,
    soruUret: async ({ adet }) => {
      uretimSayisi += 1;
      return Array.from({ length: adet }, (_, i) => ({ text: `S${i}`, options: { A: '1', B: '2', C: '3', D: '4' }, answer: 'A', explanation: 'x' }));
    },
    konuUret,
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
    return { status: r.status, headers: r.headers, veri: await r.json() };
  }
  return { istek, kapat: () => srv.close(), uretim: () => uretimSayisi };
}

test('ziyaretçi 3 soru hakkına sahiptir ve tam kazanım testini başlatamaz', async () => {
  const s = await sunucu();
  try {
    const ilkDurum = await s.istek('/durum');
    assert.equal(ilkDurum.veri.ziyaretciHaklari.soru.kalan, 3);
    assert.equal(ilkDurum.veri.ziyaretciHaklari.ozetGorebilir, true);
    assert.equal(ilkDurum.veri.ozellikler.kazanim.acik, false);
    assert.match(ilkDurum.headers.get('set-cookie'), /Max-Age=2592000/i);

    const pratik = await s.istek('/sorular', { ozellik: 'test', sinif: 6, konu: konular[0] });
    assert.equal(pratik.status, 200);
    assert.equal(pratik.veri.sorular.length, 3);
    assert.equal(pratik.veri.soruHakki, 0);

    const tekrar = await s.istek('/sorular', { ozellik: 'asistan', sinif: 6, konu: konular[1] });
    assert.equal(tekrar.status, 403);
    assert.match(tekrar.veri.mesaj, /üye girişi yapın/);

    const kazanim = await s.istek('/sorular', { ozellik: 'kazanim', sinif: 6, konu: konular[1] });
    assert.equal(kazanim.status, 403);
    assert.equal(kazanim.veri.kod, 'UYELIK_GEREKLI');
    assert.equal(kazanim.veri.girisYapti, false);
    assert.equal(kazanim.veri.yonlendir, '/Paketler.html');

    const sonDurum = await s.istek('/durum');
    assert.equal(sonDurum.veri.ziyaretciHaklari.soru.kalan, 0);
  } finally { s.kapat(); }
});

test('eşzamanlı ziyaretçi istekleri soru hakkı sınırını aşamaz', async () => {
  const s = await sunucu();
  try {
    await s.istek('/durum');
    const yanitlar = await Promise.all([
      s.istek('/sorular', { ozellik: 'test', sinif: 6, konu: konular[0] }),
      s.istek('/sorular', { ozellik: 'asistan', sinif: 6, konu: konular[1] })
    ]);
    assert.deepEqual(yanitlar.map(yanit => yanit.status).sort(), [200, 403]);
    assert.equal((await s.istek('/durum')).veri.ziyaretciHaklari.soru.kalan, 0);
  } finally { s.kapat(); }
});

test('konu anlatımı da 3 konuyla sınırlıdır', async () => {
  const s = await sunucu();
  try {
    for (let i = 0; i < 3; i += 1) assert.equal((await s.istek('/konu', { sinif: 6, konu: konular[i] })).status, 200);
    assert.equal((await s.istek('/konu', { sinif: 6, konu: konular[3] })).status, 403);
  } finally { s.kapat(); }
});

test('Pinecone müfredat kazanımları yalnızca eşleşen sınıfta konu anlatımı için geçerlidir', async () => {
  const pineconeKonusu = 'Bir doğal sayının çarpan ve katlarına yönelik muhakeme yapabilme';
  const s = await sunucu({
    mufredatKonusuVarMi: async (grade, konu) => grade === 6 && konu === pineconeKonusu
  });
  try {
    assert.equal((await s.istek('/konu', { sinif: 6, konu: pineconeKonusu })).status, 200);
    assert.equal((await s.istek('/konu', { sinif: 7, konu: pineconeKonusu })).status, 400);
    assert.equal((await s.istek('/konu', { sinif: 6, konu: 'Geçersiz kazanım' })).status, 400);
  } finally { s.kapat(); }
});

test('ziyaretçi soru hakkı ve tam kazanım testi feature toggle ile değiştirilebilir', async () => {
  const s = await sunucu({ ziyaretciHaklari: { soru: 1, kazanim: true } });
  try {
    const durum = await s.istek('/durum');
    assert.equal(durum.veri.limitler.soru, 1);
    assert.equal(durum.veri.ziyaretciHaklari.kazanimTestiAcik, true);
    assert.equal(durum.veri.ozellikler.kazanim.acik, true);

    const test = await s.istek('/sorular', { ozellik: 'kazanim', sinif: 6, konu: konular[0] });
    assert.equal(test.status, 200);
    assert.equal(test.veri.sorular.length, 1);
    assert.equal(test.veri.soruHakki, 0);
  } finally { s.kapat(); }
});

test('ziyaretçi konu özeti erişimi toggle ile kapatılabilir', async () => {
  const s = await sunucu({ ziyaretciHaklari: { ozetGorebilir: false } });
  try {
    const durum = await s.istek('/durum');
    assert.equal(durum.veri.ozellikler.konu.acik, false);
    const ozet = await s.istek('/konu', { sinif: 6, konu: konular[0] });
    assert.equal(ozet.status, 403);
    assert.equal(ozet.veri.kod, 'UYELIK_GEREKLI');
  } finally { s.kapat(); }
});

test('ziyaretçi konu hakkı ayrı olarak ayarlanabilir', async () => {
  const s = await sunucu({ ziyaretciHaklari: { konu: 1 } });
  try {
    const ilkKonu = await s.istek('/konu', { sinif: 6, konu: konular[0] });
    assert.equal(ilkKonu.status, 200);
    assert.equal(ilkKonu.veri.kalan, 0);

    const ikinciKonu = await s.istek('/konu', { sinif: 6, konu: konular[1] });
    assert.equal(ikinciKonu.status, 403);
  } finally { s.kapat(); }
});

test('konu anlatımı rotası üretilen Markdown içeriğini öğrenciye döndürür', async () => {
  let uretilenSecim;
  const markdown = [
    '[SAYFA_1]\n# Dikdörtgenin çevresi\n\nGünlük hayattan **örneklerle** anlatım.',
    '[SAYFA_2]\n## Kenar uzunlukları\n\nİkinci sayfa içeriği.',
    '[SAYFA_3]\n## Çevreyi hesaplama\n\nÜçüncü sayfa içeriği.',
    '[SAYFA_4]\n## Alıştırmalar\n\nDördüncü sayfa içeriği.',
    '[SAYFA_5]\n## Özet\n\nBeşinci sayfa içeriği.'
  ].join('\n\n');
  const s = await sunucu({
    kullanici: { id: 'student-1', role: 'student' },
    konuUret: async secim => {
      uretilenSecim = secim;
      return markdown;
    }
  });
  try {
    const yanit = await s.istek('/konu', { sinif: 6, konu: konular[0] });
    assert.equal(yanit.status, 200);
    assert.deepEqual(uretilenSecim, { sinif: 6, konu: konular[0] });
    assert.equal(yanit.veri.anlatim, markdown);
  } finally { s.kapat(); }
});

test('üye deneme limiti olmadan tüm konulara erişir ve varsayılan 20 soru alır', async () => {
  const s = await sunucu({ uye: true, kullanici: { id: 'u1', role: 'student' } });
  try {
    for (const ozellik of ['test', 'kazanim', 'asistan']) {
      for (let i = 0; i < 5; i += 1) {
        const r = await s.istek('/sorular', { ozellik, sinif: 6, konu: konular[i] });
        assert.equal(r.status, 200);
        assert.equal(r.veri.sorular.length, 20);
        assert.equal(r.veri.kalan, null);
      }
    }
    for (let i = 0; i < 5; i += 1) {
      const r = await s.istek('/konu', { sinif: 6, konu: konular[i] });
      assert.equal(r.status, 200);
      assert.equal(r.veri.kalan, null);
    }
    const durum = await s.istek('/durum');
    assert.equal(durum.veri.uye, true);
    assert.equal(durum.veri.limitYok, true);
    assert.equal(durum.veri.ozellikler.test.kalan, null);
    assert.equal(durum.headers.get('cache-control'), 'no-store');
  } finally { s.kapat(); }
});

test('giriş yapmış öğrenci üyelik olmasa da tüm konulara ve sınırsız denemeye erişir', async () => {
  const s = await sunucu({ kullanici: { id: 'student-1', role: 'student' } });
  try {
    const durum = await s.istek('/durum');
    assert.equal(durum.veri.uye, false);
    assert.equal(durum.veri.limitYok, true);
    assert.equal(durum.veri.ozellikler.test.kalan, null);
    assert.deepEqual(durum.veri.ozellikler.test.kullanilan, []);

    for (const ozellik of ['test', 'kazanim', 'asistan']) {
      for (let i = 0; i < 5; i += 1) {
        const r = await s.istek('/sorular', { ozellik, sinif: 6, konu: konular[i] });
        assert.equal(r.status, 200);
        assert.equal(r.veri.sorular.length, 20);
        assert.equal(r.veri.limitYok, true);
        assert.equal(r.veri.kalan, null);
      }
    }
    for (let i = 0; i < 5; i += 1) {
      const r = await s.istek('/konu', { sinif: 6, konu: konular[i] });
      assert.equal(r.status, 200);
      assert.equal(r.veri.limitYok, true);
      assert.equal(r.veri.kalan, null);
    }
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
