const test = require('node:test');
const assert = require('node:assert/strict');
const {
  recordKazanimOutcome,
  gelisimCache,
  getGelisimCache,
  setGelisimCache,
  invalidateStudentGelisimCache,
  getStudentWeakContext,
  mapResult
} = require('../routes/ogrenci-gelisim');

test('Kazanım istatistikleri güncellemesi - correctCount, totalAttempted ve accuracyRate atomik hesaplanır', async () => {
  const store = new Map();
  const mockCollection = {
    findOne: async filter => store.get(`${filter.studentUserId}:${filter.topic}`) || null,
    updateOne: async (filter, updateDoc) => {
      const key = `${filter.studentUserId}:${filter.topic}`;
      const existing = store.get(key) || {
        studentUserId: filter.studentUserId,
        topic: filter.topic,
        correctCount: 0,
        totalAttempted: 0
      };
      const correctInc = updateDoc.$inc.correctCount || 0;
      const totalInc = updateDoc.$inc.totalAttempted || 0;
      const updated = {
        ...existing,
        correctCount: (existing.correctCount || 0) + correctInc,
        totalAttempted: (existing.totalAttempted || 0) + totalInc,
        accuracyRate: updateDoc.$set.accuracyRate,
        status: updateDoc.$set.status,
        updatedAt: updateDoc.$set.updatedAt
      };
      store.set(key, updated);
      return { modifiedCount: 1, upsertedCount: existing ? 0 : 1 };
    }
  };

  // 1. Soru: Doğru çözüldü (1/1 -> %100)
  const res1 = await recordKazanimOutcome(mockCollection, {
    studentUserId: 'std123',
    grade: 8,
    unit: 'Çarpanlar ve Katlar',
    topic: 'EBOB-EKOK',
    isCorrect: true
  });
  assert.equal(res1.correctCount, 1);
  assert.equal(res1.totalAttempted, 1);
  assert.equal(res1.accuracyRate, 100);

  // 2. Soru: Yanlış çözüldü (1/2 -> %50)
  const res2 = await recordKazanimOutcome(mockCollection, {
    studentUserId: 'std123',
    grade: 8,
    unit: 'Çarpanlar ve Katlar',
    topic: 'EBOB-EKOK',
    isCorrect: false
  });
  assert.equal(res2.correctCount, 1);
  assert.equal(res2.totalAttempted, 2);
  assert.equal(res2.accuracyRate, 50);

  // 3. Soru: Doğru çözüldü (2/3 -> %67)
  const res3 = await recordKazanimOutcome(mockCollection, {
    studentUserId: 'std123',
    grade: 8,
    unit: 'Çarpanlar ve Katlar',
    topic: 'EBOB-EKOK',
    isCorrect: true
  });
  assert.equal(res3.correctCount, 2);
  assert.equal(res3.totalAttempted, 3);
  assert.equal(res3.accuracyRate, 67);
});

test('Önbellek (Cache) katmanı - 5 dakikalık TTL ve anında geçersiz kılma (invalidation)', () => {
  const studentId = 'test_student_cache_99';
  const ozetKey = `${studentId}:ozet`;
  const raporKey = `${studentId}:rapor`;
  const testlerKey = `${studentId}:testler`;

  setGelisimCache(ozetKey, { bugunDakika: 45, haftalikDakika: 120 }, 5 * 60 * 1000);
  setGelisimCache(raporKey, { zayif: [{ konu: 'Üslü İfadeler' }] }, 5 * 60 * 1000);
  setGelisimCache(testlerKey, { testler: [{ id: 't1' }] }, 5 * 60 * 1000);

  // Önbellekten 0 ms ile doğrudan okunmalı
  assert.deepEqual(getGelisimCache(ozetKey), { bugunDakika: 45, haftalikDakika: 120 });
  assert.deepEqual(getGelisimCache(raporKey), { zayif: [{ konu: 'Üslü İfadeler' }] });
  assert.deepEqual(getGelisimCache(testlerKey), { testler: [{ id: 't1' }] });

  // Yeni test bitince veya çalışma eklenince cache temizlenmeli
  invalidateStudentGelisimCache(studentId);

  assert.equal(getGelisimCache(ozetKey), null);
  assert.equal(getGelisimCache(raporKey), null);
  assert.equal(getGelisimCache(testlerKey), null);
});

test('AI Mentör zayıf konu köprüsü - en zayıf konuları ve başarı ortalamasını çeker', async () => {
  const studentId = 'test_std_ai_bridge';
  setGelisimCache(`${studentId}:rapor`, {
    zayif: [
      { konu: 'Kareköklü İfadeler' },
      { konu: 'Cebirsel İfadeler' },
      { konu: 'Olasılık' },
      { konu: 'Üçgenler' }
    ],
    testBasarisi: { ortalama: 64 }
  });

  const context = await getStudentWeakContext(studentId);
  assert.ok(context);
  assert.equal(context.zayifKonular.length, 3);
  assert.deepEqual(context.zayifKonular, ['Kareköklü İfadeler', 'Cebirsel İfadeler', 'Olasılık']);
  assert.equal(context.testOrtalama, 64);

  // Temizle
  invalidateStudentGelisimCache(studentId);
});

test('mapResult - answerDetails ve soru sürelerini eksiksiz taşır', () => {
  const row = {
    _id: 'res123',
    quizTitle: 'LGS Deneme 1',
    type: 'deneme',
    score: 80,
    correctCount: 4,
    totalCount: 5,
    answers: ['A', 'B', 'C', 'D', null],
    review: [{ answer: 'A' }, { answer: 'B' }, { answer: 'C' }, { answer: 'D' }, { answer: 'A' }],
    answerDetails: [
      { no: 1, answer: 'A', correctAnswer: 'A', correct: true, timeSpentSeconds: 45 },
      { no: 2, answer: 'B', correctAnswer: 'B', correct: true, timeSpentSeconds: 60 },
      { no: 3, answer: 'C', correctAnswer: 'C', correct: true, timeSpentSeconds: 30 },
      { no: 4, answer: 'D', correctAnswer: 'D', correct: true, timeSpentSeconds: 50 },
      { no: 5, answer: null, correctAnswer: 'A', correct: false, timeSpentSeconds: 15 }
    ]
  };

  const mapped = mapResult(row);
  assert.equal(mapped.dogru, 4);
  assert.equal(mapped.bos, 1);
  assert.equal(mapped.yanlis, 0);
  assert.equal(mapped.answerDetails.length, 5);
  assert.equal(mapped.answerDetails[0].timeSpentSeconds, 45);
});

test('Gemini API Kredisi ve Harcama Hesaplama - bakiye ve uyarı durumları', () => {
  function computeRemainingCredit(initialCredit, spentSinceUpdateTL) {
    const remaining = Math.max(0, Number((initialCredit - spentSinceUpdateTL).toFixed(2)));
    return {
      initialCredit,
      remainingCredit: remaining,
      isExhausted: remaining <= 0,
      isLow: remaining > 0 && remaining < 10
    };
  }

  // Durum 1: Yeterli bakiye (29.05 - 5.00 = 24.05)
  const c1 = computeRemainingCredit(29.05, 5.00);
  assert.equal(c1.remainingCredit, 24.05);
  assert.equal(c1.isExhausted, false);
  assert.equal(c1.isLow, false);

  // Durum 2: Düşük bakiye (< 10 TL) (12.00 - 4.50 = 7.50)
  const c2 = computeRemainingCredit(12.00, 4.50);
  assert.equal(c2.remainingCredit, 7.50);
  assert.equal(c2.isExhausted, false);
  assert.equal(c2.isLow, true);

  // Durum 3: Tükenmiş bakiye (<= 0 TL) (29.05 - 35.00 = 0)
  const c3 = computeRemainingCredit(29.05, 35.00);
  assert.equal(c3.remainingCredit, 0);
  assert.equal(c3.isExhausted, true);
  assert.equal(c3.isLow, false);
});
