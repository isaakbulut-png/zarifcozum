const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateStreak, weekStart, addDays, mapResult } = require('../routes/ogrenci-gelisim');

test('addDays ve weekStart pazartesi başlangıcını verir', () => {
  assert.equal(addDays('2025-03-01', 1), '2025-03-02');
  assert.equal(weekStart('2025-03-05'), '2025-03-03');
  assert.equal(weekStart('2025-03-09'), '2025-03-03');
  assert.equal(weekStart('2025-03-03'), '2025-03-03');
});

test('calculateStreak bugün çalışılmadıysa dünden sayar', () => {
  const map = new Map([['2025-03-04', 30], ['2025-03-03', 20], ['2025-03-01', 10]]);
  assert.equal(calculateStreak(map, '2025-03-05'), 2);
  map.set('2025-03-05', 15);
  assert.equal(calculateStreak(map, '2025-03-05'), 3);
  assert.equal(calculateStreak(new Map(), '2025-03-05'), 0);
});

test('mapResult doğru, yanlış ve boş sayılarını hesaplar', () => {
  const result = mapResult({
    _id: 'x', quizTitle: 'Deneme 1', type: 'deneme', score: 60,
    correctCount: 3, totalCount: 5, answers: ['A', 'B', null, 'C', 'D'], createdAt: new Date()
  });
  assert.equal(result.type, 'deneme');
  assert.equal(result.dogru, 3);
  assert.equal(result.bos, 1);
  assert.equal(result.yanlis, 1);
});
