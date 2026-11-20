const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createYaziliRouter } = require('../routes/yazili');
const YaziliProva = require('../models/YaziliProva');
const User = require('../models/User');

test('Yazılıya Hazırlık API - Paket Kotaları ve Sınıf Yetkilendirmesi', async (t) => {
  const originalFind = YaziliProva.find;
  const originalFindById = YaziliProva.findById;
  const originalCreate = YaziliProva.create;
  const originalUserFindById = User.findById;
  const originalUserUpdateOne = User.updateOne;

  t.after(() => {
    YaziliProva.find = originalFind;
    YaziliProva.findById = originalFindById;
    YaziliProva.create = originalCreate;
    User.findById = originalUserFindById;
    User.updateOne = originalUserUpdateOne;
  });

  const mockProvalar = [
    {
      _id: 'prova_8_1',
      title: '8. Sınıf 1. Dönem 1. Yazılı Senaryo 1',
      grade: 8,
      donem: '1_donem_1_yazili',
      senaryoNo: 1,
      aciklama: 'MEB Uyumlu',
      toplamPuan: 100,
      sorular: [{ soruNo: 1, metin: 'Soru 1', puan: 10 }]
    },
    {
      _id: 'prova_8_2',
      title: '8. Sınıf 1. Dönem 1. Yazılı Senaryo 2',
      grade: 8,
      donem: '1_donem_1_yazili',
      senaryoNo: 2,
      aciklama: 'MEB Uyumlu',
      toplamPuan: 100,
      sorular: [{ soruNo: 1, metin: 'Soru 1', puan: 10 }]
    },
    {
      _id: 'prova_8_3',
      title: '8. Sınıf 1. Dönem 1. Yazılı Senaryo 3',
      grade: 8,
      donem: '1_donem_1_yazili',
      senaryoNo: 3,
      aciklama: 'MEB Uyumlu',
      toplamPuan: 100,
      sorular: [{ soruNo: 1, metin: 'Soru 1', puan: 10 }]
    },
    {
      _id: 'prova_9_1',
      title: '9. Sınıf 1. Dönem 1. Yazılı Senaryo 1',
      grade: 9,
      donem: '1_donem_1_yazili',
      senaryoNo: 1,
      aciklama: 'MEB Uyumlu',
      toplamPuan: 100,
      sorular: [{ soruNo: 1, metin: 'Soru 1', puan: 10 }]
    }
  ];

  YaziliProva.findById = (id) => ({
    lean: () => Promise.resolve(mockProvalar.find(p => p._id === id) || null),
    then: (resolve) => resolve(mockProvalar.find(p => p._id === id) || null)
  });

  const app = express();
  app.use(express.json());

  // Test için dinamik oturum middleware
  let currentSessionUser = null;
  app.use((req, res, next) => {
    req.session = { user: currentSessionUser };
    next();
  });
  app.use('/api/yazili', createYaziliRouter());

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/yazili`;

  t.after(() => server.close());

  await t.test('1. Free paket yazılı provasına erişemez (403 YAZILI_UPGRADE_REQUIRED)', async () => {
    currentSessionUser = {
      id: 'usr_free',
      role: 'student',
      paketTipi: 'free',
      kayitliSinif: 8
    };

    const res = await fetch(`${baseUrl}/prova_8_1`);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.kod, 'YAZILI_UPGRADE_REQUIRED');
  });

  await t.test('2. Sınıf düzeyi yetkisizliği (8. sınıf öğrenci 9. sınıfa erişemez)', async () => {
    currentSessionUser = {
      id: 'usr_temel',
      role: 'student',
      paketTipi: 'temel',
      kayitliSinif: 8
    };

    const res = await fetch(`${baseUrl}/prova_9_1`);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.kod, 'GRADE_ACCESS_DENIED');
  });

  await t.test('3. Temel paket dönemlik 2 prova kotasını aşamaz', async () => {
    // Öğrenci bu dönem zaten 2 prova çözmüş olsun
    currentSessionUser = {
      id: 'usr_temel',
      role: 'student',
      paketTipi: 'temel',
      kayitliSinif: 8
    };

    User.findById = () => Promise.resolve({
      _id: 'usr_temel',
      erisenYaziliProvalar: [
        { yaziliId: 'prova_8_1', donem: '1_donem_1_yazili' },
        { yaziliId: 'prova_8_2', donem: '1_donem_1_yazili' }
      ]
    });

    // Daha önce çözdüğü provaya tekrar erişebilir
    const resAyni = await fetch(`${baseUrl}/prova_8_1`);
    assert.equal(resAyni.status, 200);

    // 3. yeni provaya erişmek istediğinde 403 YAZILI_LIMIT_EXCEEDED almalı
    const resUcuncu = await fetch(`${baseUrl}/prova_8_3`);
    assert.equal(resUcuncu.status, 403);
    const data = await resUcuncu.json();
    assert.equal(data.kod, 'YAZILI_LIMIT_EXCEEDED');
  });

  await t.test('4. Standart ve VIP paketler sınırsız erişir', async () => {
    currentSessionUser = {
      id: 'usr_standart',
      role: 'student',
      paketTipi: 'standart',
      kayitliSinif: 8
    };

    const resStandart = await fetch(`${baseUrl}/prova_8_3`);
    assert.equal(resStandart.status, 200);
    const data = await resStandart.json();
    assert.equal(data.prova.title, '8. Sınıf 1. Dönem 1. Yazılı Senaryo 3');

    // VIP öğrenci üst sınıfa da erişebilir
    currentSessionUser = {
      id: 'usr_vip',
      role: 'student',
      paketTipi: 'vip',
      kayitliSinif: 8
    };

    const resVip9 = await fetch(`${baseUrl}/prova_9_1`);
    assert.equal(resVip9.status, 200);
  });
});
