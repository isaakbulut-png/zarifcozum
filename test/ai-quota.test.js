const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resetIfNewDay,
  getEffectiveMessageLimit,
  getEffectiveQuestionLimit,
  canUserUseProModel,
  checkAndConsumeQuota,
  getQuotaStatus
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

test('Öğretmen Rol & Kota - Limit hiyerarşisi ve Pro model izinleri', () => {
  const admin = { role: 'admin' };
  assert.equal(getEffectiveMessageLimit(admin), Infinity);
  assert.equal(getEffectiveQuestionLimit(admin), Infinity);
  assert.equal(canUserUseProModel(admin), true);

  const icerikUreticisi = { role: 'teacher', ogretmenTipi: 'icerik_ureticisi', basvuruDurumu: 'onaylandi' };
  assert.equal(getEffectiveMessageLimit(icerikUreticisi), Infinity);
  assert.equal(getEffectiveQuestionLimit(icerikUreticisi), Infinity);
  assert.equal(canUserUseProModel(icerikUreticisi), true);

  const onayli = { role: 'teacher', ogretmenTipi: 'onayli_ogretmen', basvuruDurumu: 'onaylandi' };
  assert.equal(getEffectiveQuestionLimit(onayli), 15);
  assert.equal(getEffectiveMessageLimit(onayli), 40);
  assert.equal(canUserUseProModel(onayli), false);

  const standart = { role: 'teacher', ogretmenTipi: 'standart_ogretmen', basvuruDurumu: 'onaylandi' };
  assert.equal(getEffectiveQuestionLimit(standart), 3);
  assert.equal(getEffectiveMessageLimit(standart), 10);
  assert.equal(canUserUseProModel(standart), false);
});
