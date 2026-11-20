const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateNet,
  rankParticipants,
  generateNetKarnesi
} = require('../lib/turkiye-geneli-ranking');

test('Türkiye Geneli - Net sayısı hesaplama (3 yanlış 1 doğru kuralı)', () => {
  assert.equal(calculateNet(20, 0), 20);
  assert.equal(calculateNet(18, 3), 17);
  assert.equal(calculateNet(15, 6), 13);
  assert.equal(calculateNet(2, 6), 0); // negatif net olamaz
});

test('Türkiye Geneli - Sıralama ve yüzdelik dilim motoru', () => {
  const participants = [
    { studentId: 'std-1', netCount: 15.0, score: 75, city: 'İstanbul' },
    { studentId: 'std-2', netCount: 19.0, score: 95, city: 'Ankara' },
    { studentId: 'std-3', netCount: 17.5, score: 87.5, city: 'İstanbul' },
    { studentId: 'std-4', netCount: 12.0, score: 60, city: 'İzmir' }
  ];

  const ranked = rankParticipants(participants);
  assert.equal(ranked.length, 4);

  // 1. Sıra: std-2 (19.0 net)
  assert.equal(ranked[0].studentId, 'std-2');
  assert.equal(ranked[0].turkiyeSirasi, 1);
  assert.equal(ranked[0].ilSirasi, 1);
  assert.equal(ranked[0].yuzdelikDilim, 25);

  // 2. Sıra: std-3 (17.5 net - İstanbul 1.si)
  assert.equal(ranked[1].studentId, 'std-3');
  assert.equal(ranked[1].turkiyeSirasi, 2);
  assert.equal(ranked[1].ilSirasi, 1);
  assert.equal(ranked[1].yuzdelikDilim, 50);

  // 3. Sıra: std-1 (15.0 net - İstanbul 2.si)
  assert.equal(ranked[2].studentId, 'std-1');
  assert.equal(ranked[2].turkiyeSirasi, 3);
  assert.equal(ranked[2].ilSirasi, 2);
  assert.equal(ranked[2].yuzdelikDilim, 75);
});

test('Türkiye Geneli - Net Karnesi veri yapısı', () => {
  const deneme = {
    id: 'tg-101',
    title: '8. Sınıf Türkiye Geneli Deneme 1',
    grade: 8,
    totalParticipants: 500,
    averageNet: 11.4
  };
  const result = {
    correctCount: 16,
    wrongCount: 3,
    blankCount: 1,
    score: 80,
    submittedAt: new Date()
  };
  const rankData = {
    turkiyeSirasi: 42,
    ilSirasi: 12,
    yuzdelikDilim: 8.4,
    toplamKatilimci: 500
  };

  const karne = generateNetKarnesi({ deneme, result, rankData });
  assert.equal(karne.denemeBasligi, '8. Sınıf Türkiye Geneli Deneme 1');
  assert.equal(karne.netSayisi, 15);
  assert.equal(karne.turkiyeSirasi, 42);
  assert.equal(karne.yuzdelikDilim, 8.4);
});
