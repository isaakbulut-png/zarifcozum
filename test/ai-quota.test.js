const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resetIfNewDay,
  resetIfNewMonth,
  getEffectiveMessageLimit,
  getEffectiveMonthlySokratikLimit,
  getEffectiveMonthlyOgretmenIkiziLimit,
  getEffectiveQuestionLimit,
  getEffectiveMonthlyQuestionLimit,
  canUserUseProModel,
  checkAndConsumeQuota,
  getQuotaStatus,
  resolveUserPlan
} = require('../middleware/aiQuota');

test('Öğretmen Başvuru Onayı - İncelemedeki veya reddedilen öğretmen AI kullanamaz', async () => {
  const pendingTeacher = {
    role: 'teacher',
    basvuruDurumu: 'inceleme_suruyor',
    ogretmenTipi: 'standart_ogretmen'
  };
  const resPending = await checkAndConsumeQuota(pendingTeacher, 'question', 1);
  assert.equal(resPending.allowed, false);
  assert.equal(resPending.status, 403);
  assert.equal(resPending.error, 'APPLICATION_PENDING');

  const rejectedTeacher = {
    role: 'teacher',
    basvuruDurumu: 'reddedildi',
    ogretmenTipi: 'standart_ogretmen'
  };
  const resRejected = await checkAndConsumeQuota(rejectedTeacher, 'message', 1);
  assert.equal(resRejected.allowed, false);
  assert.equal(resRejected.status, 403);
  assert.equal(resRejected.error, 'APPLICATION_PENDING');
});

test('Öğretmen Rol & Kota - Yalnızca Admin sınırsızdır, öğretmenler kotalıdır', () => {
  const admin = { role: 'admin' };
  assert.equal(getEffectiveMessageLimit(admin), Infinity);
  assert.equal(getEffectiveQuestionLimit(admin), Infinity);
  assert.equal(getEffectiveMonthlyQuestionLimit(admin), Infinity);
  assert.equal(canUserUseProModel(admin), true);

  const icerikUreticisi = { role: 'teacher', ogretmenTipi: 'icerik_ureticisi', basvuruDurumu: 'onaylandi' };
  assert.equal(getEffectiveMessageLimit(icerikUreticisi), 100);
  assert.equal(getEffectiveQuestionLimit(icerikUreticisi), 50);
  assert.equal(getEffectiveMonthlyQuestionLimit(icerikUreticisi), 200);
  assert.equal(canUserUseProModel(icerikUreticisi), true);

  const onayli = { role: 'teacher', ogretmenTipi: 'onayli_ogretmen', basvuruDurumu: 'onaylandi' };
  assert.equal(getEffectiveQuestionLimit(onayli), 15);
  assert.equal(getEffectiveMonthlyQuestionLimit(onayli), 200);
  assert.equal(getEffectiveMessageLimit(onayli), 40);
  assert.equal(canUserUseProModel(onayli), false);

  const standart = { role: 'teacher', ogretmenTipi: 'standart_ogretmen', basvuruDurumu: 'onaylandi' };
  assert.equal(getEffectiveQuestionLimit(standart), 3);
  assert.equal(getEffectiveMonthlyQuestionLimit(standart), 50);
  assert.equal(getEffectiveMessageLimit(standart), 10);
  assert.equal(canUserUseProModel(standart), false);
});

test('Öğrenci 3 Yıllık Paket Limitleri - Temel, Standart, VIP ve Free', () => {
  const freeStudent = { role: 'student', paketTipi: 'free' };
  assert.equal(getEffectiveMessageLimit(freeStudent), 3);
  assert.equal(getEffectiveMonthlySokratikLimit(freeStudent), 12);
  assert.equal(getEffectiveMonthlyOgretmenIkiziLimit(freeStudent), 0);
  assert.equal(getEffectiveQuestionLimit(freeStudent), 0);

  const temelStudent = { role: 'student', paketTipi: 'temel' };
  assert.equal(getEffectiveMessageLimit(temelStudent), 3);
  assert.equal(getEffectiveMonthlySokratikLimit(temelStudent), 90);
  assert.equal(getEffectiveMonthlyOgretmenIkiziLimit(temelStudent), 30);
  assert.equal(getEffectiveQuestionLimit(temelStudent), 0);

  const standartStudent = { role: 'student', paketTipi: 'standart' };
  assert.equal(getEffectiveMessageLimit(standartStudent), 10);
  assert.equal(getEffectiveMonthlySokratikLimit(standartStudent), 300);
  assert.equal(getEffectiveMonthlyOgretmenIkiziLimit(standartStudent), 150);
  assert.equal(getEffectiveQuestionLimit(standartStudent), 3);

  const vipStudent = { role: 'student', paketTipi: 'vip' };
  assert.equal(getEffectiveMessageLimit(vipStudent), 25);
  assert.equal(getEffectiveMonthlySokratikLimit(vipStudent), 750);
  assert.equal(getEffectiveMonthlyOgretmenIkiziLimit(vipStudent), 400);
  assert.equal(getEffectiveQuestionLimit(vipStudent), 10);
});

test('Öğrenci Paket Eşleme - Aktif abonelik planı paketTipini önceler', () => {
  const subUser = {
    role: 'student',
    paketTipi: 'free',
    subscriptionStatus: 'active',
    subscriptionPlan: 'vip',
    expiresAt: new Date(Date.now() + 86400000)
  };
  assert.equal(resolveUserPlan(subUser), 'vip');
  assert.equal(getEffectiveMessageLimit(subUser), 25);
  assert.equal(getEffectiveMonthlySokratikLimit(subUser), 750);
});

test('Öğretmen İkizi - Free pakette kilitli, Temel/Standart/VIP paketlerde kotalı', async () => {
  const now = new Date();
  const freeUser = { role: 'student', paketTipi: 'free', aylikOgretmenIkiziSayisi: 0, sonAylikSifirlamaTarihi: now };
  const resFree = await checkAndConsumeQuota(freeUser, 'ogretmen_ikizi', 1);
  assert.equal(resFree.allowed, false);
  assert.equal(resFree.status, 429);

  const temelUser = { role: 'student', paketTipi: 'temel', aylikOgretmenIkiziSayisi: 29, sonAylikSifirlamaTarihi: now };
  const resTemel = await checkAndConsumeQuota(temelUser, 'ogretmen_ikizi', 1);
  assert.equal(resTemel.allowed, true);
  assert.equal(resTemel.kalanAylik, 0);

  // Bir sonraki kullanımda aylık kota doldu
  const resTemelDoldu = await checkAndConsumeQuota(temelUser, 'ogretmen_ikizi', 1);
  assert.equal(resTemelDoldu.allowed, false);
  assert.equal(resTemelDoldu.status, 429);
});
