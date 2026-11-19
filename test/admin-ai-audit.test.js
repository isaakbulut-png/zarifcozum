const test = require('node:test');
const assert = require('node:assert/strict');
const { getAiAuditSummary, calculateCosts } = require('../lib/ai-usage-tracker');
const { PAKET_LIMITLERI, getEffectiveMessageLimit } = require('../middleware/aiQuota');

test('Admin AI Denetim - getAiAuditSummary fonksiyonel testi', async () => {
  const audit = await getAiAuditSummary();
  assert.ok(audit);
  assert.ok(audit.genel);
  assert.equal(typeof audit.genel.toplamKullanim, 'number');
  assert.equal(typeof audit.genel.toplamSistemMaliyetTL, 'number');
  assert.ok(Array.isArray(audit.ajanlar));
});

test('Admin AI Denetim - Kullanıcı Özel Limit & Bonus Kredi Mantığı', () => {
  // Free paket varsayılan 5
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'free' }), 5);
  // Özel limit 80 tanımlandığında paketi ezer
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'free', ozelGunlukMesajLimiti: 80 }), 80);
  // Özel limit 0 girilmişse 0 geçerli olur
  assert.equal(getEffectiveMessageLimit({ paketTipi: 'pro', ozelGunlukMesajLimiti: 0 }), 0);
});

test('Admin AI Denetim - Paket Değişikliği ve Hiyerarşi', () => {
  assert.equal(PAKET_LIMITLERI.free.maxMessages, 5);
  assert.equal(PAKET_LIMITLERI.baslangic.maxMessages, 25);
  assert.equal(PAKET_LIMITLERI.pro.maxMessages, 60);
});
