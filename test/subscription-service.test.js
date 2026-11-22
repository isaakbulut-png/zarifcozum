const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const { checkAndDowngradeExpiredSubscription } = require('../lib/subscription-service');

test('Abonelik Servisi - activateUserSubscription ve downgrade akışı', async () => {
  const user = new User({
    name: 'Deneme Öğrenci',
    email: 'deneme.sub.' + Date.now() + '@example.com',
    role: 'student',
    parentConnectionCode: 'TST123',
    grade: 8,
    kayitliSinif: 8,
    parentContact: '05551234567',
    guardianConsentAccepted: true,
    subscriptionTier: 'free',
    subscriptionStatus: 'active'
  });

  assert.equal(user.subscriptionTier, 'free');
  assert.equal(user.getEffectivePlan(), 'free');

  // Süresi geçmiş bir VIP yapalım
  user.subscriptionTier = 'vip';
  user.subscriptionPlan = 'vip';
  user.paketTipi = 'vip';
  user.subscriptionStatus = 'active';
  user.subscriptionEndDate = new Date(Date.now() - 10000); // geçmiş tarih
  user.expiresAt = user.subscriptionEndDate;

  // save metodunu mocklayalım
  user.save = async () => user;

  // Downgrade kontrolü
  const downgraded = await checkAndDowngradeExpiredSubscription(user);
  assert.equal(downgraded, true);
  assert.equal(user.subscriptionTier, 'free');
  assert.equal(user.subscriptionStatus, 'expired');
  assert.equal(user.getEffectivePlan(), 'free');
});
