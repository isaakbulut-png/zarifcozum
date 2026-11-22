const User = require('../models/User');
const { checkAndDowngradeExpiredSubscription } = require('../lib/subscription-service');

/**
 * Belirli abonelik paketlerine sahip kullanıcıların erişebilmesini sağlayan Express middleware.
 * Kullanıcının abonelik süresi dolmuşsa otomatik olarak 'free' statüsüne düşürür.
 * 
 * @param {Array<string>} allowedPlans - İzin verilen paketler: ['temel', 'standart', 'vip'] vb.
 */
function requirePlan(allowedPlans = ['temel', 'standart', 'vip']) {
  return async (req, res, next) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ mesaj: 'Bu alana erişmek için giriş yapmalısınız.' });
    }

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ mesaj: 'Kullanıcı hesabı bulunamadı.' });
      }

      // Süresi geçmişse otomatik downgrade et
      await checkAndDowngradeExpiredSubscription(user);

      // Adminler her zaman tüm paket yetkilerine sahiptir
      if (user.role === 'admin' || user.adminRole === 'superadmin') {
        req.user = user;
        return next();
      }

      const effectivePlan = user.getEffectivePlan();
      const planHierarchy = { free: 0, temel: 1, standart: 2, vip: 3 };

      const userLevel = planHierarchy[effectivePlan] || 0;
      const minRequiredLevel = Math.min(...allowedPlans.map(p => planHierarchy[p] ?? 99));

      if (userLevel < minRequiredLevel) {
        return res.status(403).json({
          mesaj: 'Bu özelliğe erişebilmek için üyeliğinizi yükseltmeniz gerekmektedir.',
          requiredPlans: allowedPlans,
          currentPlan: effectivePlan,
          upgradeRequired: true
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('requirePlan middleware hatası:', error);
      res.status(500).json({ mesaj: 'Yetki kontrolü sırasında sunucu hatası oluştu.' });
    }
  };
}

module.exports = requirePlan;
