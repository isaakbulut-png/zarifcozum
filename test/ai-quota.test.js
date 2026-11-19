const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resetIfNewDay,
  getEffectiveMessageLimit,
  checkAndConsumeQuota,
  getQuotaStatus
} = require('../middleware/aiQuota');

test('AI Kota - getEffectiveMessageLimit paket ve özel limit hiyerarşisi', () => {
  // Free paket
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'free' }), 5);
  // Baslangic paket
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'baslangic' }), 25);
  // Pro paket
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'pro' }), 60);

  // Ozel gunluk limit paketi ezer
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'free', ozelGunlukMesajLimiti: 100 }), 100);
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'pro', ozelGunlukMesajLimiti: 2 }), 2);
  // null veya tanımsız ise pakete geri düşer
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'free', ozelGunlukMesajLimiti: null }), 5);
});

test('AI Kota - resetIfNewDay eski günleri sıfırlar, aynı günü korur', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const user = {
    gunlukAiMesajSayisi: 12,
    gunlukSoruUretimSayisi: 4,
    sonKotaSifirlamaTarihi: yesterday
  };

  const didReset = resetIfNewDay(user);
  assert.equal(didReset, true);
  assert.equal(user.gunlukAiMesajSayisi, 0);
  assert.equal(user.gunlukSoruUretimSayisi, 0);

  // Aynı gün tekrar çağrıldığında sıfırlanmaz
  const didResetAgain = resetIfNewDay(user);
  assert.equal(didResetAgain, false);
});

test('AI Kota - aiErisimEngelli durumu istekleri 403 ile bloklar', async () => {
  const user = {
    role: 'student',
    aiErisimEngelli: true,
    paketTipi: 'pro'
  };

  const res = await checkAndConsumeQuota(user, 'message');
  assert.equal(res.allowed, false);
  assert.equal(res.status, 403);
  assert.equal(res.error, 'AI_ACCESS_BLOCKED');
});

test('AI Kota - Teacher ve Admin rolleri öğrenci mesaj kotasından muaftır', async () => {
  const teacher = {
    role: 'teacher',
    aiErisimEngelli: false,
    gunlukAiMesajSayisi: 9999
  };
  const admin = {
    role: 'admin',
    aiErisimEngelli: false,
    gunlukAiMesajSayisi: 9999
  };

  assert.equal((await checkAndConsumeQuota(teacher, 'message')).allowed, true);
  assert.equal((await checkAndConsumeQuota(admin, 'message')).allowed, true);
});
