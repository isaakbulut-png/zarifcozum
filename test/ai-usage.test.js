const { describe, it } = require('node:test');
const assert = require('node:assert');
const { calculateCosts, recordAiUsage, getAiUsageSummary, PRICING_PER_MILLION } = require('../lib/ai-usage-tracker');
const AiUsageLog = require('../models/AiUsageLog');

describe('AI Maliyet & Kullanım Takip Sistemi', () => {
  it('Model birim fiyatlarını ve kur dönüşümünü doğru hesaplar', () => {
    // gemini-2.5-flash: 1M input $0.15, 1M output $0.60
    // 10,000 input tokens = $0.0015
    // 2,000 output tokens = $0.0012
    // total USD = $0.0027 -> with rate 35.0 = 0.0945 TL
    const costs = calculateCosts('gemini-2.5-flash', 10000, 2000);
    assert.equal(costs.totalCostUSD, 0.0027);
    assert.equal(costs.totalCostTL, 0.0945);
    assert.equal(costs.rate, 35.0);
  });

  it('gemini-2.5-flash-lite daha ekonomik fiyatlandırılır', () => {
    // gemini-2.5-flash-lite: 1M input $0.075, 1M output $0.30
    const costs = calculateCosts('gemini-2.5-flash-lite', 10000, 2000);
    assert.equal(costs.totalCostUSD, 0.00135);
    assert.ok(costs.totalCostUSD < 0.0027);
  });

  it('gemini-2.5-pro derin analiz fiyatlandırmasını uygular', () => {
    // gemini-2.5-pro: 1M input $1.25, 1M output $5.00
    const costs = calculateCosts('gemini-2.5-pro', 1000, 1000);
    assert.equal(costs.totalCostUSD, 0.00625);
  });
});
