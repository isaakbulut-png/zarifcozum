const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');

const { buildCurriculumTreeFromJson } = require('../lib/curriculumMongoTree');
const { createCurriculumRouter } = require('../routes/curriculum');
const curriculumTreeView = require('../assets/curriculum-tree-view');

test('buildCurriculumTreeFromJson: meb-curriculum-tree.json üzerinden eksiksiz ağaç üretimi', () => {
  const tree = buildCurriculumTreeFromJson(null);
  assert.ok(Array.isArray(tree), 'Ağaç dizi olmalı');
  assert.equal(tree.length, 2, '2 kademe olmalı (Ortaokul ve Lise)');

  const ortaokul = tree[0];
  const lise = tree[1];
  assert.equal(ortaokul.node_type, 'KADEME');
  assert.equal(lise.node_type, 'KADEME');

  const ortaokulSiniflar = ortaokul.children.map(c => c.title);
  assert.deepEqual(ortaokulSiniflar, ['5. Sınıf', '6. Sınıf', '7. Sınıf', '8. Sınıf']);

  const liseSiniflar = lise.children.map(c => c.title);
  assert.deepEqual(liseSiniflar, ['9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf']);

  // 9. Sınıf ve 10. Sınıf temalarını kontrol et
  const sinif9 = lise.children.find(c => c.title === '9. Sınıf');
  assert.ok(sinif9, '9. Sınıf bulunmalı');
  assert.ok(sinif9.children.length >= 7, '9. Sınıf en az 7 tema içermeli');

  const sinif10 = lise.children.find(c => c.title === '10. Sınıf');
  assert.ok(sinif10, '10. Sınıf bulunmalı');
  assert.ok(sinif10.children.length >= 6, '10. Sınıf en az 6 tema içermeli');

  // Kazanım ve soru sayısı doğrulaması
  for (const kademe of tree) {
    for (const sinif of kademe.children) {
      for (const tema of sinif.children) {
        assert.equal(typeof tema.content_count, 'number', `${tema.title} content_count sayı olmalı`);
        assert.ok(tema.content_count >= 0, `${tema.title} content_count negatif olamaz`);
        for (const kazanim of tema.children) {
          assert.equal(typeof kazanim.content_count, 'number', `${kazanim.title} content_count sayı olmalı`);
          assert.ok(kazanim.content_count >= 0, `${kazanim.title} content_count negatif olamaz`);
        }
      }
    }
  }
});

test('createCurriculumRouter: Harici servis 429 döndürdüğünde kullanıcıya 429 DEĞİL, 200 ve yerel ağaç döndürülmeli', async () => {
  // 429 Too Many Requests döndüren bir sahte harici servis simülasyonu
  const rateLimitedMockService = {
    getTree: async () => ({
      status: 429,
      data: { error: 'Too Many Requests', message: 'Rate limit exceeded' }
    }),
    createNode: async () => ({ status: 200, data: {} })
  };

  const app = express();
  app.use(express.json());
  const router = createCurriculumRouter({
    requireStaff: (req, res, next) => next(), // yetki kontrolünü geç
    service: rateLimitedMockService,
    getDb: () => null // DB yokken bile JSON garantisi test edilsin
  });
  app.use('/api/v1/curriculum', router);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/curriculum/tree`);
    assert.equal(res.status, 200, '429 durum kodu engellenmeli ve 200 dönmeli');
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Yanıt dizi formatında ağaç olmalı');
    assert.equal(data.length, 2, '2 kademe dönmeli');
    assert.equal(data[0].title, 'Ortaokul (5-8. Sınıf)');
    assert.equal(data[1].title, 'Ortaöğretim / Lise (9-12. Sınıf)');
  } finally {
    server.close();
  }
});

test('createCurriculumRouter: Harici servis çöktüğünde/hata fırlattığında kesintisiz 200 dönmeli', async () => {
  const crashingMockService = {
    getTree: async () => {
      const err = new Error('Connection refused');
      err.code = 'ECONNREFUSED';
      throw err;
    },
    createNode: async () => ({ status: 200, data: {} })
  };

  const app = express();
  app.use(express.json());
  const router = createCurriculumRouter({
    requireStaff: (req, res, next) => next(),
    service: crashingMockService,
    getDb: () => null
  });
  app.use('/api/v1/curriculum', router);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/curriculum/tree`);
    assert.equal(res.status, 200, 'Hata durumunda da 200 dönmeli');
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Yanıt dizi formatında ağaç olmalı');
    assert.equal(data.length, 2);
  } finally {
    server.close();
  }
});
