const AiUsageLog = require('../models/AiUsageLog');

// Google Gemini Token Fiyatlandırması (1 Milyon Token Başına USD)
const PRICING_PER_MILLION = {
  // Flash-Lite: Giriş $0.075 / 1M, Çıkış $0.30 / 1M
  'gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-3.1-flash-lite': { input: 0.075, output: 0.30 },

  // Flash: Giriş $0.15 / 1M, Çıkış $0.60 / 1M
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-3.5-flash': { input: 0.15, output: 0.60 },
  'gemini-3.8-flash': { input: 0.15, output: 0.60 },
  'gemini-flash-latest': { input: 0.15, output: 0.60 },

  // Pro: Giriş $1.25 / 1M, Çıkış $5.00 / 1M
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-4-argon': { input: 1.25, output: 5.00 },

  // Embedding
  'gemini-embedding-001': { input: 0.015, output: 0.00 }
};

function getUsdToTryRate() {
  const envVal = Number(process.env.USD_TO_TRY);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 35.0;
}

function calculateCosts(modelName, promptTokens = 0, candidateTokens = 0) {
  const key = String(modelName || '').toLowerCase().trim();
  const pricing = PRICING_PER_MILLION[key] || PRICING_PER_MILLION['gemini-2.5-flash'];
  const inputCostUSD = (promptTokens / 1_000_000) * pricing.input;
  const outputCostUSD = (candidateTokens / 1_000_000) * pricing.output;
  const totalCostUSD = inputCostUSD + outputCostUSD;
  const rate = getUsdToTryRate();
  const totalCostTL = totalCostUSD * rate;

  return {
    totalCostUSD: Number(totalCostUSD.toFixed(6)),
    totalCostTL: Number(totalCostTL.toFixed(4)),
    rate
  };
}

async function recordAiUsage({
  kullaniciId = null,
  kullaniciAdi = 'Kullanıcı',
  kullaniciRol = 'misafir',
  modul = 'AI Asistan',
  modelAdi = 'gemini-2.5-flash',
  promptTokens = 0,
  candidatesTokens = 0,
  cacheHit = false,
  durum = 'success',
  detay = {}
}) {
  try {
    const pTokens = Number(promptTokens) || 0;
    const cTokens = Number(candidatesTokens) || 0;
    const totalTokens = pTokens + cTokens;

    let totalCostUSD = 0;
    let totalCostTL = 0;
    let tahminiTasarrufUSD = 0;
    let tahminiTasarrufTL = 0;

    if (cacheHit) {
      // Önbellekten dönüldüğünde API maliyeti 0'dır, ancak kurtarılan tahmini maliyeti hesaplayalım
      const estimatedCount = Number(detay?.soruSayisi) || 5;
      const estimatedPromptTokens = 600;
      const estimatedCandidateTokens = estimatedCount * 450;
      const saved = calculateCosts(modelAdi, estimatedPromptTokens, estimatedCandidateTokens);
      tahminiTasarrufUSD = saved.totalCostUSD;
      tahminiTasarrufTL = saved.totalCostTL;
    } else {
      const costs = calculateCosts(modelAdi, pTokens, cTokens);
      totalCostUSD = costs.totalCostUSD;
      totalCostTL = costs.totalCostTL;
    }

    const logEntry = await AiUsageLog.create({
      tarih: new Date(),
      kullaniciId: kullaniciId ? String(kullaniciId) : null,
      kullaniciAdi: String(kullaniciAdi || 'Kullanıcı'),
      kullaniciRol: String(kullaniciRol || 'misafir'),
      modul: String(modul || 'AI Asistan'),
      modelAdi: String(modelAdi || 'gemini-2.5-flash'),
      girdiToken: pTokens,
      ciktiToken: cTokens,
      toplamToken: totalTokens,
      toplamMaliyetUSD: totalCostUSD,
      toplamMaliyetTL: totalCostTL,
      tahminiTasarrufUSD,
      tahminiTasarrufTL,
      cacheHit: Boolean(cacheHit),
      durum: cacheHit ? 'cache_hit' : durum,
      detay
    });

    return logEntry;
  } catch (err) {
    console.warn('[AiUsageTracker] Log kaydedilemedi:', err.message);
    return null;
  }
}

async function getAiUsageSummary() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [bugunAgg, buAyAgg, tasarrufAgg, modulAgg, modelAgg, sonIslemler] = await Promise.all([
    // 1. Bugünkü toplamlar
    AiUsageLog.aggregate([
      { $match: { tarih: { $gte: startOfDay }, cacheHit: false } },
      {
        $group: {
          _id: null,
          toplamUSD: { $sum: '$toplamMaliyetUSD' },
          toplamTL: { $sum: '$toplamMaliyetTL' },
          girdiToken: { $sum: '$girdiToken' },
          ciktiToken: { $sum: '$ciktiToken' },
          istekSayisi: { $sum: 1 }
        }
      }
    ]),

    // 2. Bu ayki toplamlar
    AiUsageLog.aggregate([
      { $match: { tarih: { $gte: startOfMonth }, cacheHit: false } },
      {
        $group: {
          _id: null,
          toplamUSD: { $sum: '$toplamMaliyetUSD' },
          toplamTL: { $sum: '$toplamMaliyetTL' },
          girdiToken: { $sum: '$girdiToken' },
          ciktiToken: { $sum: '$ciktiToken' },
          istekSayisi: { $sum: 1 }
        }
      }
    ]),

    // 3. Önbellek Tasarruf Toplamları
    AiUsageLog.aggregate([
      { $match: { cacheHit: true } },
      {
        $group: {
          _id: null,
          toplamTasarrufUSD: { $sum: '$tahminiTasarrufUSD' },
          toplamTasarrufTL: { $sum: '$tahminiTasarrufTL' },
          cacheHitSayisi: { $sum: 1 }
        }
      }
    ]),

    // 4. Modül Bazlı Harcama Dağılımı (Bu ay)
    AiUsageLog.aggregate([
      { $match: { tarih: { $gte: startOfMonth }, cacheHit: false } },
      {
        $group: {
          _id: '$modul',
          toplamTL: { $sum: '$toplamMaliyetTL' },
          toplamUSD: { $sum: '$toplamMaliyetUSD' },
          toplamToken: { $sum: '$toplamToken' },
          istekSayisi: { $sum: 1 }
        }
      },
      { $sort: { toplamTL: -1 } }
    ]),

    // 5. Model Bazlı Harcama Dağılımı (Bu ay)
    AiUsageLog.aggregate([
      { $match: { tarih: { $gte: startOfMonth }, cacheHit: false } },
      {
        $group: {
          _id: '$modelAdi',
          toplamTL: { $sum: '$toplamMaliyetTL' },
          toplamUSD: { $sum: '$toplamMaliyetUSD' },
          toplamToken: { $sum: '$toplamToken' },
          istekSayisi: { $sum: 1 }
        }
      },
      { $sort: { toplamTL: -1 } }
    ]),

    // 6. Son 50 İşlem Listesi
    AiUsageLog.find()
      .sort({ tarih: -1 })
      .limit(50)
      .lean()
  ]);

  const bugun = bugunAgg[0] || { toplamUSD: 0, toplamTL: 0, girdiToken: 0, ciktiToken: 0, istekSayisi: 0 };
  const buAy = buAyAgg[0] || { toplamUSD: 0, toplamTL: 0, girdiToken: 0, ciktiToken: 0, istekSayisi: 0 };
  const tasarruf = tasarrufAgg[0] || { toplamTasarrufUSD: 0, toplamTasarrufTL: 0, cacheHitSayisi: 0 };

  const ayToplamTL = buAy.toplamTL || 0;
  const modulDagilimi = modulAgg.map(m => ({
    modul: m._id,
    toplamTL: Number((m.toplamTL || 0).toFixed(4)),
    toplamUSD: Number((m.toplamUSD || 0).toFixed(6)),
    toplamToken: m.toplamToken || 0,
    istekSayisi: m.istekSayisi,
    yuzde: ayToplamTL > 0 ? Number(((m.toplamTL / ayToplamTL) * 100).toFixed(1)) : 0
  }));

  const modelDagilimi = modelAgg.map(m => ({
    modelAdi: m._id,
    toplamTL: Number((m.toplamTL || 0).toFixed(4)),
    toplamUSD: Number((m.toplamUSD || 0).toFixed(6)),
    toplamToken: m.toplamToken || 0,
    istekSayisi: m.istekSayisi
  }));

  const toplamIstek = (buAy.istekSayisi || 0) + (tasarruf.cacheHitSayisi || 0);

  return {
    dolarKuru: getUsdToTryRate(),
    bugun: {
      toplamUSD: Number((bugun.toplamUSD || 0).toFixed(4)),
      toplamTL: Number((bugun.toplamTL || 0).toFixed(2)),
      girdiToken: bugun.girdiToken || 0,
      ciktiToken: bugun.ciktiToken || 0,
      istekSayisi: bugun.istekSayisi || 0
    },
    buAy: {
      toplamUSD: Number((buAy.toplamUSD || 0).toFixed(4)),
      toplamTL: Number((buAy.toplamTL || 0).toFixed(2)),
      girdiToken: buAy.girdiToken || 0,
      ciktiToken: buAy.ciktiToken || 0,
      istekSayisi: buAy.istekSayisi || 0
    },
    tasarruf: {
      toplamTasarrufUSD: Number((tasarruf.toplamTasarrufUSD || 0).toFixed(4)),
      toplamTasarrufTL: Number((tasarruf.toplamTasarrufTL || 0).toFixed(2)),
      cacheHitSayisi: tasarruf.cacheHitSayisi || 0
    },
    toplamIstek,
    modulDagilimi,
    modelDagilimi,
    sonIslemler: sonIslemler.map(item => ({
      id: item._id.toString(),
      tarih: item.tarih,
      kullaniciAdi: item.kullaniciAdi || 'Kullanıcı',
      kullaniciRol: item.kullaniciRol || 'misafir',
      modul: item.modul,
      modelAdi: item.modelAdi,
      girdiToken: item.girdiToken || 0,
      ciktiToken: item.ciktiToken || 0,
      toplamToken: item.toplamToken || 0,
      toplamMaliyetUSD: item.toplamMaliyetUSD || 0,
      toplamMaliyetTL: item.toplamMaliyetTL || 0,
      tahminiTasarrufTL: item.tahminiTasarrufTL || 0,
      cacheHit: item.cacheHit || false,
      durum: item.durum || 'success'
    }))
  };
}

module.exports = {
  PRICING_PER_MILLION,
  calculateCosts,
  getUsdToTryRate,
  recordAiUsage,
  getAiUsageSummary
};
