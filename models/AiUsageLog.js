const mongoose = require('mongoose');

const aiUsageLogSchema = new mongoose.Schema({
  tarih: { type: Date, default: Date.now, index: true },
  kullaniciId: { type: String, default: null, index: true },
  kullaniciAdi: { type: String, default: 'Kullanıcı' },
  kullaniciRol: { type: String, default: 'misafir', index: true }, // student, teacher, admin, misafir
  modul: { type: String, required: true, index: true }, // Sokratik Mentör, Soru Sihirbazı, Öğretmen İkizi, vb.
  modelAdi: { type: String, required: true, index: true }, // gemini-2.5-flash-lite, gemini-2.5-flash, gemini-2.5-pro vb.
  girdiToken: { type: Number, default: 0 },
  ciktiToken: { type: Number, default: 0 },
  toplamToken: { type: Number, default: 0 },
  toplamMaliyetUSD: { type: Number, default: 0 },
  toplamMaliyetTL: { type: Number, default: 0 },
  tahminiTasarrufUSD: { type: Number, default: 0 },
  tahminiTasarrufTL: { type: Number, default: 0 },
  cacheHit: { type: Boolean, default: false, index: true },
  durum: { type: String, default: 'success', enum: ['success', 'error', 'cache_hit'] },
  detay: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'ai_usage_logs'
});

aiUsageLogSchema.index({ tarih: -1 });
aiUsageLogSchema.index({ modul: 1, tarih: -1 });
aiUsageLogSchema.index({ modelAdi: 1, tarih: -1 });

module.exports = mongoose.models.AiUsageLog || mongoose.model('AiUsageLog', aiUsageLogSchema);
