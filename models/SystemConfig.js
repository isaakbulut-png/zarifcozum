const mongoose = require('mongoose');
const {createHash} = require('node:crypto');

const DEFAULT_VISITOR_SETTINGS = Object.freeze({
  questionLimit: 3,
  topicLimit: 3,
  trialDurationDays: 30,
  summaryEnabled: true,
  practiceEnabled: true,
  assistantEnabled: true,
  fullTestEnabled: false,
  subscriptionRequired: false,
  registrationEnabled: true
});

const DEFAULT_ANNOUNCEMENT_BANNER = Object.freeze({
  active: false,
  title: 'Önemli Bilgilendirme',
  message: '',
  type: 'warning',
  updatedAt: new Date(0)
});

const DEFAULT_SYSTEM_HEALTH_ALERT = Object.freeze({
  active: false,
  score: 100,
  status: 'healthy',
  errors: [],
  warnings: [],
  updatedAt: new Date(0)
});

const systemConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'visitor-access' },
  questionLimit: { type: Number, min: 0, max: 500, default: DEFAULT_VISITOR_SETTINGS.questionLimit },
  topicLimit: { type: Number, min: 0, max: 100, default: DEFAULT_VISITOR_SETTINGS.topicLimit },
  trialDurationDays: { type: Number, min: 1, max: 3650, default: DEFAULT_VISITOR_SETTINGS.trialDurationDays },
  summaryEnabled: { type: Boolean, default: DEFAULT_VISITOR_SETTINGS.summaryEnabled },
  practiceEnabled: { type: Boolean, default: DEFAULT_VISITOR_SETTINGS.practiceEnabled },
  assistantEnabled: { type: Boolean, default: DEFAULT_VISITOR_SETTINGS.assistantEnabled },
  fullTestEnabled: { type: Boolean, default: DEFAULT_VISITOR_SETTINGS.fullTestEnabled },
  subscriptionRequired: { type: Boolean, default: DEFAULT_VISITOR_SETTINGS.subscriptionRequired },
  registrationEnabled: { type: Boolean, default: DEFAULT_VISITOR_SETTINGS.registrationEnabled },
  homepageAssets: {
    animation: { type: String, default: null },
    heroImage: { type: String, default: null },
    featureImage: { type: String, default: null }
  },
  announcementBanner: {
    active: { type: Boolean, default: false },
    title: { type: String, default: 'Önemli Bilgilendirme' },
    message: { type: String, default: '' },
    type: { type: String, enum: ['warning', 'danger', 'info', 'success'], default: 'warning' },
    updatedAt: { type: Date, default: Date.now }
  },
  systemHealthAlert: {
    active: { type: Boolean, default: false },
    score: { type: Number, default: 100 },
    status: { type: String, default: 'healthy' },
    errors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  gemini_initial_credit: { type: Number, default: 0.00 },
  gemini_credit_updated_at: { type: Date, default: null },
  pagePath: {type: String, default: null},
  targetKey: {type: String, default: null},
  assetType: {type: String, enum: ['image', 'animation', null], default: null},
  url: {type: String, default: null},
  position: {type: String, enum: ['after', 'before', 'prepend', 'append', 'replace', 'overlay', null], default: 'after'},
  widthPx: {type: Number, min: 32, max: 900, default: 320},
  align: {type: String, enum: ['left', 'center', 'right', null], default: 'center'},
  customText: {type: String, maxlength: 2000, default: null}
}, { timestamps: true, collection: 'system_configs', versionKey: false });

systemConfigSchema.statics.getVisitorSettings = async function () {
  const settings = await this.findById('visitor-access').lean();
  if (!settings) return { ...DEFAULT_VISITOR_SETTINGS };
  return Object.fromEntries(Object.keys(DEFAULT_VISITOR_SETTINGS).map(field => [
    field,
    settings[field] ?? DEFAULT_VISITOR_SETTINGS[field]
  ]));
};

systemConfigSchema.statics.initializeVisitorSettings = function () {
  return this.findOneAndUpdate(
    { _id: 'visitor-access' },
    { $setOnInsert: { _id: 'visitor-access', ...DEFAULT_VISITOR_SETTINGS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

systemConfigSchema.statics.saveVisitorSettings = function (settings) {
  return this.findOneAndUpdate(
    { _id: 'visitor-access' },
    { $set: settings, $setOnInsert: { _id: 'visitor-access' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
};

systemConfigSchema.statics.getHomepageAssets = async function () {
  const settings = await this.findById('homepage-assets').lean();
  return {
    animation: settings?.homepageAssets?.animation || null,
    heroImage: settings?.homepageAssets?.heroImage || null,
    featureImage: settings?.homepageAssets?.featureImage || null
  };
};

systemConfigSchema.statics.saveHomepageAsset = async function (slot, url) {
  if (!['animation', 'heroImage', 'featureImage'].includes(slot)) {
    throw new TypeError('Geçersiz ana sayfa medya alanı.');
  }
  await this.findOneAndUpdate(
    { _id: 'homepage-assets' },
    { $set: { [`homepageAssets.${slot}`]: url }, $setOnInsert: { _id: 'homepage-assets' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return this.getHomepageAssets();
};

systemConfigSchema.statics.getSiteMediaPlacements = function () {
  return this.find({_id: /^site-media-/})
    .select('_id pagePath targetKey assetType url position widthPx align updatedAt')
    .sort({pagePath: 1, updatedAt: -1})
    .lean();
};

systemConfigSchema.statics.saveSiteMediaPlacement = async function ({
  pagePath, targetKey, assetType, url, position = 'after', widthPx = 320, align = 'center'
}) {
  const id = `site-media-${createHash('sha256').update(`${pagePath}\0${targetKey}`).digest('hex')}`;
  const cleanPos = ['after', 'before', 'prepend', 'append', 'replace', 'overlay'].includes(position) ? position : 'after';
  const cleanWidth = Number.isFinite(Number(widthPx)) ? Math.max(32, Math.min(900, Math.round(Number(widthPx)))) : 320;
  const cleanAlign = ['left', 'center', 'right'].includes(align) ? align : 'center';
  await this.findOneAndUpdate(
    {_id: id},
    {
      $set: {pagePath, targetKey, assetType, url, position: cleanPos, widthPx: cleanWidth, align: cleanAlign},
      $setOnInsert: {_id: id}
    },
    {upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true}
  );
  return this.findById(id).select('_id pagePath targetKey assetType url position widthPx align updatedAt').lean();
};

systemConfigSchema.statics.deleteSiteMediaPlacement = async function (id) {
  if (typeof id !== 'string' || !/^site-media-[a-f0-9]{64}$/i.test(id)) return null;
  return this.findByIdAndDelete(id).lean();
};

systemConfigSchema.statics.getSiteTextOverrides = function () {
  return this.find({_id: /^site-text-/})
    .select('_id pagePath targetKey customText updatedAt')
    .sort({pagePath: 1, updatedAt: -1})
    .lean();
};

systemConfigSchema.statics.saveSiteTextOverride = async function ({pagePath, targetKey, customText}) {
  const id = `site-text-${createHash('sha256').update(`${pagePath}\0${targetKey}`).digest('hex')}`;
  const cleanText = String(customText || '').trim().slice(0, 2000);
  await this.findOneAndUpdate(
    {_id: id},
    {$set: {pagePath, targetKey, customText: cleanText}, $setOnInsert: {_id: id}},
    {upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true}
  );
  return this.findById(id).select('_id pagePath targetKey customText updatedAt').lean();
};

systemConfigSchema.statics.deleteSiteTextOverride = async function (id) {
  if (typeof id !== 'string' || !/^site-text-[a-f0-9]{64}$/i.test(id)) return null;
  return this.findByIdAndDelete(id).lean();
};

systemConfigSchema.statics.getAnnouncementBanner = async function () {
  const settings = await this.findById('visitor-access').lean();
  const banner = settings?.announcementBanner;
  if (!banner) return { ...DEFAULT_ANNOUNCEMENT_BANNER };
  return {
    active: Boolean(banner.active),
    title: banner.title || DEFAULT_ANNOUNCEMENT_BANNER.title,
    message: banner.message || '',
    type: banner.type || 'warning',
    updatedAt: banner.updatedAt || new Date()
  };
};

systemConfigSchema.statics.saveAnnouncementBanner = async function ({ active, title, message, type } = {}) {
  const cleanTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : 'Önemli Bilgilendirme';
  const cleanMsg = typeof message === 'string' ? message.trim().slice(0, 2000) : '';
  const cleanType = ['warning', 'danger', 'info', 'success'].includes(type) ? type : 'warning';
  const banner = {
    active: Boolean(active),
    title: cleanTitle,
    message: cleanMsg,
    type: cleanType,
    updatedAt: new Date()
  };
  await this.findOneAndUpdate(
    { _id: 'visitor-access' },
    { $set: { announcementBanner: banner }, $setOnInsert: { _id: 'visitor-access' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return banner;
};

systemConfigSchema.statics.getSystemHealthAlert = async function () {
  const settings = await this.findById('visitor-access').lean();
  const alert = settings?.systemHealthAlert;
  if (!alert) return { ...DEFAULT_SYSTEM_HEALTH_ALERT };
  return {
    active: Boolean(alert.active),
    score: typeof alert.score === 'number' ? alert.score : 100,
    status: alert.status || 'healthy',
    errors: Array.isArray(alert.errors) ? alert.errors : [],
    warnings: Array.isArray(alert.warnings) ? alert.warnings : [],
    updatedAt: alert.updatedAt || new Date()
  };
};

systemConfigSchema.statics.saveSystemHealthAlert = async function ({ active, score, status, errors = [], warnings = [] } = {}) {
  const alert = {
    active: Boolean(active),
    score: typeof score === 'number' ? score : 100,
    status: status || (active ? 'error' : 'healthy'),
    errors: Array.isArray(errors) ? errors : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    updatedAt: new Date()
  };
  await this.findOneAndUpdate(
    { _id: 'visitor-access' },
    { $set: { systemHealthAlert: alert }, $setOnInsert: { _id: 'visitor-access' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return alert;
};

systemConfigSchema.statics.dismissSystemHealthAlert = async function () {
  return this.saveSystemHealthAlert({
    active: false,
    score: 100,
    status: 'healthy',
    errors: [],
    warnings: []
  });
};

systemConfigSchema.statics.getGeminiCreditSettings = async function () {
  let config = await this.findById('visitor-access').lean();
  if (typeof config?.gemini_initial_credit !== 'number') {
    config = await this.findById('gemini-credit').lean();
  }
  if (typeof config?.gemini_initial_credit !== 'number') {
    config = await this.findOne({ gemini_initial_credit: { $exists: true, $gt: 0 } }).lean();
  }
  const initialCredit = typeof config?.gemini_initial_credit === 'number' ? config.gemini_initial_credit : 0.00;
  const updatedAt = config?.gemini_credit_updated_at || null;
  return {
    initialCredit,
    updatedAt,
    gemini_initial_credit: initialCredit,
    gemini_credit_updated_at: updatedAt
  };
};

systemConfigSchema.statics.saveGeminiCredit = async function (initialCredit) {
  const amount = Number(parseFloat(initialCredit).toFixed(2));
  const now = new Date();
  const validAmount = isNaN(amount) ? 0.00 : amount;

  // Ana sistem konfigürasyon belgesi (visitor-access) üzerinde güncelle
  await this.findOneAndUpdate(
    { _id: 'visitor-access' },
    {
      $set: {
        gemini_initial_credit: validAmount,
        gemini_credit_updated_at: now
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // İkincil uyumluluk kaydı olarak gemini-credit belgesini de güncelle
  try {
    await this.updateOne(
      { _id: 'gemini-credit' },
      {
        $set: {
          gemini_initial_credit: validAmount,
          gemini_credit_updated_at: now
        }
      },
      { upsert: true }
    );
  } catch (_) {}

  return {
    initialCredit: validAmount,
    updatedAt: now,
    gemini_initial_credit: validAmount,
    gemini_credit_updated_at: now
  };
};

module.exports = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);
module.exports.DEFAULT_VISITOR_SETTINGS = DEFAULT_VISITOR_SETTINGS;
module.exports.DEFAULT_ANNOUNCEMENT_BANNER = DEFAULT_ANNOUNCEMENT_BANNER;
module.exports.DEFAULT_SYSTEM_HEALTH_ALERT = DEFAULT_SYSTEM_HEALTH_ALERT;
