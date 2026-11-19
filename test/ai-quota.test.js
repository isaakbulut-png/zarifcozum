const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resetIfNewDay,
  getEffectiveMessageLimit,
  getEffectiveQuestionLimit,
  canUserUseProModel,
  checkAndConsumeQuota,
  getQuotaStatus,
  OGRETMEN_LIMITLERI
} = require('../middleware/aiQuota');

test('Öğretmen Rol & Kota - Limit hiyerarşisi ve Pro model izinleri', () => {
  // Admin sınırsız ve Pro kullanabilir
  const admin = { role: 'admin' };
  assert.equal(getEffectiveMessageLimit(admin), Infinity);
  assert.equal(getEffectiveQuestionLimit(admin), Infinity);
  assert.equal(canUserUseProModel(admin), true);

  // İçerik üreticisi öğretmen sınırsız ve Pro kullanabilir
  const icerikUreticisi = { role: 'teacher', ogretmenTipi: 'icerik_ureticisi' };
  assert.equal(getEffectiveMessageLimit(icerikUreticisi), Infinity);
  assert.equal(getEffectiveQuestionLimit(icerikUreticisi), Infinity);
  assert.equal(canUserUseProModel(icerikUreticisi), true);

  // Onaylı öğretmen: 15 soru, 40 mesaj, Pro yasak
  const onayli = { role: 'teacher', ogretmenTipi: 'onayli_ogretmen' };
  assert.equal(getEffectiveQuestionLimit(onayli), 15);
  assert.equal(getEffectiveMessageLimit(onayli), 40);
  assert.equal(canUserUseProModel(onayli), false);

  // Onaylı öğretmen için admin özel soru limiti belirlediyse o geçerli
  const ozelOnayli = { role: 'teacher', ogretmenTipi: 'onayli_ogretmen', ozelGunlukSoruLimiti: 25, ozelGunlukMesajLimiti: 70 };
  assert.equal(getEffectiveQuestionLimit(ozelOnayli), 25);
  assert.equal(getEffectiveMessageLimit(ozelOnayli), 70);

  // Standart öğretmen: 3 soru, 10 mesaj, Pro yasak
  const standart = { role: 'teacher', ogretmenTipi: 'standart_ogretmen' };
  assert.equal(getEffectiveQuestionLimit(standart), 3);
  assert.equal(getEffectiveMessageLimit(standart), 10);
  assert.equal(canUserUseProModel(standart), false);
});

test('Öğretmen Rol & Kota - Tüketim ve Kota Aşımı Kontrolü', async () => {
  // Standart öğretmen 3 soru kotasını doldurmuşsa (bugün)
  const standart = {
    role: 'teacher',
    ogretmenTipi: 'standart_ogretmen',
    gunlukSoruUretimSayisi: 3,
    sonKotaSifirlamaTarihi: new Date()
  };

  const res = await checkAndConsumeQuota(standart, 'question', 1);
  assert.equal(res.allowed, false);
  assert.equal(res.status, 429);
  assert.equal(res.error, 'QUOTA_EXCEEDED');

  // İçerik üreticisi 100 soru da üretse engellenmez
  const icerikUreticisi = {
    role: 'teacher',
    ogretmenTipi: 'icerik_ureticisi',
    gunlukSoruUretimSayisi: 100,
    sonKotaSifirlamaTarihi: new Date()
  };
  const res2 = await checkAndConsumeQuota(icerikUreticisi, 'question', 10);
  assert.equal(res2.allowed, true);
  assert.equal(res2.sinirsiz, true);
});

test('Öğrenci Kota - Temel kurallar korunuyor', () => {
  assert.equal(getEffectiveMessageLimit({ role: 'student', paketTipi: 'free' }), 5);
  assert.equal(getEffectiveMessageLimit({ role: 'student', paketTipi: 'pro' }), 60);
  assert.equal(canUserUseProModel({ role: 'student' }), false);
});
