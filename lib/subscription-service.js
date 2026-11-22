const User = require('../models/User');

/**
 * Kullanıcının abonelik paketini aktive eder veya yeniler.
 * Webhook (PayTR / iyzico) ve Admin manuel atamaları tarafından kullanılır.
 * 
 * @param {string|ObjectId} userId - Kullanıcı ID'si
 * @param {'temel'|'standart'|'vip'|'free'} tier - Abonelik paketi
 * @param {number} durationDays - Gün cinsinden abonelik süresi (örn: 30 gün)
 * @param {object} options - Ek parametreler (gateway, customerId, paymentAmount vb.)
 */
async function activateUserSubscription(userId, tier, durationDays = 30, options = {}) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  const validTiers = ['free', 'temel', 'standart', 'vip'];
  const normalizedTier = String(tier || 'free').toLowerCase();
  if (!validTiers.includes(normalizedTier)) {
    throw new Error(`Geçersiz paket tipi: ${tier}`);
  }

  const now = new Date();
  let endDate = null;

  if (normalizedTier !== 'free' && durationDays > 0) {
    // Eğer kullanıcının mevcut aktif bir aboneliği varsa ve süresi henüz dolmamışsa üzerine ekle
    const currentEnd = user.subscriptionEndDate || user.expiresAt;
    const baseDate = (currentEnd && new Date(currentEnd) > now) ? new Date(currentEnd) : now;
    endDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  user.subscriptionTier = normalizedTier;
  user.subscriptionPlan = normalizedTier === 'free' ? null : normalizedTier;
  user.paketTipi = normalizedTier;
  user.subscriptionStatus = normalizedTier === 'free' ? 'free' : 'active';
  user.subscriptionEndDate = endDate;
  user.expiresAt = endDate;

  if (options.gateway) {
    user.paymentGateway = options.gateway;
  }
  if (options.customerId) {
    user.paymentGatewayCustomerId = options.customerId;
  }

  await user.save();
  return user;
}

/**
 * Kullanıcının abonelik süresini kontrol eder; süresi dolmuşsa otomatik olarak 'free' statüsüne düşürür.
 * 
 * @param {Document} user - User Mongoose dökümanı
 * @returns {boolean} - Düşürme (downgrade) yapıldıysa true
 */
async function checkAndDowngradeExpiredSubscription(user) {
  if (!user || user.role === 'admin') return false;

  const now = new Date();
  const endDate = user.subscriptionEndDate || user.expiresAt;

  if (user.subscriptionStatus === 'active' && endDate && new Date(endDate) <= now) {
    user.subscriptionStatus = 'expired';
    user.subscriptionTier = 'free';
    user.subscriptionPlan = null;
    user.paketTipi = 'free';
    await user.save();
    return true;
  }
  return false;
}

module.exports = {
  activateUserSubscription,
  checkAndDowngradeExpiredSubscription
};
