// Paket fiyatları ve özellik-paket eşlemesi tek yerde tutulur; fiyat değişikliği için yalnızca amountMinor güncellenir.
const PLAN_ORDER = Object.freeze(['temel', 'standart', 'vip']);

const PLANS = Object.freeze({
  temel: Object.freeze({ label: 'Temel', amountMinor: 24900 }),
  standart: Object.freeze({ label: 'Standart', amountMinor: 49900 }),
  vip: Object.freeze({ label: 'VIP', amountMinor: 89900 })
});

// Özelliğe erişim için gereken en düşük paket.
const FEATURE_MIN_PLAN = Object.freeze({
  konu: 'temel',
  test: 'temel',
  deneme: 'standart',
  takip: 'standart',
  asistan: 'vip',
  kazanim: 'vip',
  canli: 'vip'
});

// Erişimin sayısal sınırlarının kalktığı en düşük paket (belirtilmeyen özellikte erişimle birlikte kalkar).
const FEATURE_UNLIMITED_FROM = Object.freeze({
  test: 'standart'
});

const rank = plan => PLAN_ORDER.indexOf(plan);

function activePlan(user, now = new Date()) {
  if (!user || user.subscriptionStatus !== 'active') return null;
  if (user.expiresAt && new Date(user.expiresAt) <= now) return null;
  return PLAN_ORDER.includes(user.subscriptionPlan) ? user.subscriptionPlan : 'temel';
}

function featureDecision(user, feature, now = new Date()) {
  const required = FEATURE_MIN_PLAN[feature];
  if (!required) return { izin: false, gerekliPlan: null, mevcutPlan: null, limitYok: false };
  const plan = activePlan(user, now);
  if (!plan || rank(plan) < rank(required)) {
    return { izin: false, gerekliPlan: required, mevcutPlan: plan, limitYok: false };
  }
  const unlimitedFrom = FEATURE_UNLIMITED_FROM[feature] || required;
  return { izin: true, gerekliPlan: required, mevcutPlan: plan, limitYok: rank(plan) >= rank(unlimitedFrom) };
}

module.exports = { PLAN_ORDER, PLANS, FEATURE_MIN_PLAN, FEATURE_UNLIMITED_FROM, activePlan, featureDecision };
