/**
 * Canlı Döviz Kuru Servisi (USD/TRY)
 * 
 * Piyasa kurlarını otomatik çeker, önbelleğe alır ve periyodik günceller.
 * Varsayılan / Fallback Kur: 50.46 TL (veya .env'den USD_TO_TRY)
 */

const DEFAULT_USD_TO_TRY = 50.46;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 dakika

// Başlangıç durumu
const envRate = Number(process.env.USD_TO_TRY);
let state = {
  rate: Number.isFinite(envRate) && envRate > 0 ? envRate : DEFAULT_USD_TO_TRY,
  updatedAt: null,
  source: Number.isFinite(envRate) && envRate > 0 ? 'Ortam Değişkeni (.env)' : 'Varsayılan Referans',
  isLive: false
};

const LIVE_APIS = [
  'https://api.exchangerate-api.com/v4/latest/USD',
  'https://open.er-api.com/v6/latest/USD'
];

/**
 * Canlı kur API'lerini sırayla dener ve önbelleği günceller.
 */
async function fetchLiveExchangeRate() {
  for (const url of LIVE_APIS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) continue;

      const data = await response.json();
      const tryRate = Number(data?.rates?.TRY);

      if (Number.isFinite(tryRate) && tryRate > 0) {
        state.rate = Number(tryRate.toFixed(4));
        state.updatedAt = new Date();
        state.source = url.includes('exchangerate-api') ? 'Piyasa (ExchangeRate API)' : 'Piyasa (ER-API)';
        state.isLive = true;
        return state.rate;
      }
    } catch (_) {
      // Bir sonraki API kaynağına geç
    }
  }

  // API erişilemezse mevcut kuru koru
  if (!state.updatedAt) {
    state.updatedAt = new Date();
  }
  return state.rate;
}

/**
 * Önbellekteki kuru döner (Senkron)
 */
function getUsdToTryRateSync() {
  // Önbellek eskiyse arka planda tazelemeyi tetikle
  if (!state.updatedAt || (Date.now() - new Date(state.updatedAt).getTime()) > CACHE_TTL_MS) {
    fetchLiveExchangeRate().catch(() => {});
  }
  return state.rate;
}

/**
 * Canlı kuru gerekirse yenileyip asenkron olarak döner
 */
async function getLiveUsdToTryRate(force = false) {
  const isExpired = !state.updatedAt || (Date.now() - new Date(state.updatedAt).getTime()) > CACHE_TTL_MS;
  if (force || isExpired) {
    await fetchLiveExchangeRate();
  }
  return state.rate;
}

/**
 * Detaylı kur durum bilgisini döner
 */
function getCurrencyRateInfo() {
  return {
    rate: state.rate,
    updatedAt: state.updatedAt,
    source: state.source,
    isLive: state.isLive
  };
}

// 30 dakikada bir otomatik periyodik güncelleme (arka plan işi)
if (typeof setInterval === 'function') {
  const interval = setInterval(() => {
    fetchLiveExchangeRate().catch(() => {});
  }, CACHE_TTL_MS);
  if (interval.unref) interval.unref();
}

// Uygulama başlarken arka planda ilk canlı kuru çek
fetchLiveExchangeRate().catch(() => {});

module.exports = {
  DEFAULT_USD_TO_TRY,
  getUsdToTryRate: getUsdToTryRateSync,
  getUsdToTryRateSync,
  getLiveUsdToTryRate,
  getCurrencyRateInfo,
  fetchLiveExchangeRate
};
