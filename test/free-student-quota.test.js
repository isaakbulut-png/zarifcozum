const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createPratikRouter } = require('../routes/pratik');

test('Free Öğrenci Kotası - Ücretsiz paketteki öğrenciye limitYok verilmez, konu ve soru kotaları uygulanır', async () => {
  // Mock dependencies
  let recordedUsage = [];
  const fakeCollection = {
    findOne: async () => null,
    find: () => ({ sort: () => ({ toArray: async () => [] }) }),
    updateOne: async () => ({}),
    deleteOne: async () => ({})
  };

  const router = createPratikRouter({
    getUsageCollection: () => fakeCollection,
    getContentCollection: () => fakeCollection,
    mufredat: [],
    // Free öğrenci: abone değil (uye = false)
    uyeMi: async (kullanici) => false,
    ozellikErisimi: async () => null,
    soruUret: async () => [],
    konuUret: async () => '',
    getVisitorSettings: async () => ({
      questionLimit: 10,
      topicLimit: 3,
      trialDurationDays: 30,
      summaryEnabled: true,
      practiceEnabled: true,
      assistantEnabled: true,
      fullTestEnabled: true
    })
  });

  const app = express();
  app.use(express.json());
  // Free öğrenci simüle ediliyor (Gülefza Akbulut gibi)
  app.use((req, res, next) => {
    req.session = {
      user: {
        id: '6ae0dd34fd27e76cd170f51c',
        name: 'Gülefza Akbulut',
        role: 'student',
        paketTipi: 'free',
        subscriptionStatus: 'free'
      }
    };
    next();
  });
  app.use('/api/pratik', router);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/pratik/durum`);
    const data = await res.json();

    // Kesin doğrulama: Free öğrenci asla üye veya limitsiz olamaz!
    assert.equal(data.girisYapti, true);
    assert.equal(data.uye, false, 'Free öğrenci uye=false olmalı');
    assert.equal(data.limitYok, false, 'Free öğrenci limitYok=false olmalı');
    assert.equal(data.ziyaretciHaklari.soru.limit, 10);
    assert.equal(data.limitler.konu, 3);
    assert.equal(data.ozellikler.konu.kalan, 3, 'Konu kotası 3 olmalı');
    assert.equal(data.ozellikler.asistan.kalan, 3, 'Asistan konu kotası 3 olmalı');
  } finally {
    server.close();
  }
});

test('Öğretmen ve Admin - Oturum açmış öğretmen/admin sınırsız erişime sahiptir', async () => {
  const fakeCollection = {
    findOne: async () => null,
    find: () => ({ sort: () => ({ toArray: async () => [] }) }),
    updateOne: async () => ({}),
    deleteOne: async () => ({})
  };

  const router = createPratikRouter({
    getUsageCollection: () => fakeCollection,
    getContentCollection: () => fakeCollection,
    mufredat: [],
    // Öğretmen: uye = true
    uyeMi: async (kullanici) => kullanici?.role === 'teacher' || kullanici?.role === 'admin',
    ozellikErisimi: async () => null,
    soruUret: async () => [],
    konuUret: async () => '',
    getVisitorSettings: async () => ({
      questionLimit: 10,
      topicLimit: 3,
      trialDurationDays: 30,
      summaryEnabled: true,
      practiceEnabled: true,
      assistantEnabled: true,
      fullTestEnabled: true
    })
  });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = {
      user: {
        id: 'teacher123',
        name: 'Tuğba Akbulut',
        role: 'teacher'
      }
    };
    next();
  });
  app.use('/api/pratik', router);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/pratik/durum`);
    const data = await res.json();

    assert.equal(data.girisYapti, true);
    assert.equal(data.uye, true);
    assert.equal(data.limitYok, true, 'Öğretmen limitYok=true olmalı');
  } finally {
    server.close();
  }
});
