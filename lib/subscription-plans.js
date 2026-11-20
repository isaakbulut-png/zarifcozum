// ZarifÇözüm Yıllık Abonelik Paketleri (Ticari Satış Yapısı)
const PLAN_ORDER = Object.freeze(['temel', 'standart', 'vip']);

const PLANS = Object.freeze({
  temel: Object.freeze({
    id: 'temel',
    label: 'Temel Paket (Yıllık)',
    fiyatTL: 4990,
    amountMinor: 499000,
    period: 'yearly',
    description: 'Seçili 1 sınıf düzeyi, Sokratik Mentör (aylık 90 soru), renkli SVG şemalı konu anlatımı ve ayda 1 Türkiye Geneli deneme.'
  }),
  standart: Object.freeze({
    id: 'standart',
    label: 'Standart Paket (Yıllık)',
    fiyatTL: 8490,
    amountMinor: 849000,
    period: 'yearly',
    description: '1 sınıf + 1 alt sınıf telafi erişimi, Sokratik Mentör (aylık 300 soru), Öğretmen İkizi (150 hak), ayda 2 canlı ders ve 30 gün arşiv.'
  }),
  vip: Object.freeze({
    id: 'vip',
    label: 'VIP Paket (Yıllık)',
    fiyatTL: 14990,
    amountMinor: 1499000,
    period: 'yearly',
    description: '5-12 tüm sınıflara sınırsız erişim, Sokratik Mentör (aylık 750 soru), Öğretmen İkizi (400 hak), haftalık canlı dersler, tüm yıl arşiv ve veli SMS karnesi.'
  })
});

// Özelliğe erişim için gereken en düşük paket.
const FEATURE_MIN_PLAN = Object.freeze({
  konu: 'temel',
  test: 'temel',
  asistan: 'temel',
  yazili: 'temel',
  deneme_tg: 'temel',
  deneme_kurumsal: 'standart',
  canli: 'standart',
  video_arsiv_30gun: 'standart',
  telafi_sinif: 'standart',
  veli_eposta: 'standart',
  tum_siniflar: 'vip',
  video_arsiv_tumyili: 'vip',
  veli_sms: 'vip'
});

// Erişimin sayısal sınırlarının kalktığı en düşük paket.
const FEATURE_UNLIMITED_FROM = Object.freeze({
  test: 'standart',
  deneme_kurumsal: 'standart',
  tum_siniflar: 'vip'
});

const rank = plan => PLAN_ORDER.indexOf(plan);

function activePlan(user, now = new Date()) {
  if (!user) return null;
  if (user.role === 'admin') return 'vip';
  if (user.subscriptionStatus !== 'active') return null;
  if (user.expiresAt && new Date(user.expiresAt) <= now) return null;
  return PLAN_ORDER.includes(user.subscriptionPlan) ? user.subscriptionPlan : 'temel';
}

function featureDecision(user, feature, now = new Date()) {
  if (user?.role === 'admin') {
    return { izin: true, gerekliPlan: null, mevcutPlan: 'vip', limitYok: true };
  }
  const required = FEATURE_MIN_PLAN[feature];
  if (!required) return { izin: false, gerekliPlan: null, mevcutPlan: null, limitYok: false };
  const plan = activePlan(user, now);
  if (!plan || rank(plan) < rank(required)) {
    return { izin: false, gerekliPlan: required, mevcutPlan: plan, limitYok: false };
  }
  const unlimitedFrom = FEATURE_UNLIMITED_FROM[feature] || required;
  return { izin: true, gerekliPlan: required, mevcutPlan: plan, limitYok: rank(plan) >= rank(unlimitedFrom) };
}

module.exports = {
  PLAN_ORDER,
  PLANS,
  FEATURE_MIN_PLAN,
  FEATURE_UNLIMITED_FROM,
  activePlan,
  featureDecision
};
