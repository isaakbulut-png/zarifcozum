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
  url: {type: String, default: null}
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
    .select('_id pagePath targetKey assetType url')
    .sort({pagePath: 1})
    .lean();
};

systemConfigSchema.statics.saveSiteMediaPlacement = async function ({pagePath, targetKey, assetType, url}) {
  const id = `site-media-${createHash('sha256').update(`${pagePath}\0${targetKey}`).digest('hex')}`;
  await this.findOneAndUpdate(
    {_id: id},
    {$set: {pagePath, targetKey, assetType, url}, $setOnInsert: {_id: id}},
    {upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true}
  );
  return this.findById(id).select('_id pagePath targetKey assetType url').lean();
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
  const config = await this.findById('gemini-credit').lean();
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
  const config = await this.findOneAndUpdate(
    { _id: 'gemini-credit' },
    {
      $set: {
        gemini_initial_credit: isNaN(amount) ? 0.00 : amount,
        gemini_credit_updated_at: now
      },
      $setOnInsert: { _id: 'gemini-credit' }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  const savedAmount = typeof config?.gemini_initial_credit === 'number' ? config.gemini_initial_credit : amount;
  const savedDate = config?.gemini_credit_updated_at || now;
  return {
    initialCredit: savedAmount,
    updatedAt: savedDate,
    gemini_initial_credit: savedAmount,
    gemini_credit_updated_at: savedDate
  };
};

module.exports = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);
module.exports.DEFAULT_VISITOR_SETTINGS = DEFAULT_VISITOR_SETTINGS;
module.exports.DEFAULT_ANNOUNCEMENT_BANNER = DEFAULT_ANNOUNCEMENT_BANNER;
module.exports.DEFAULT_SYSTEM_HEALTH_ALERT = DEFAULT_SYSTEM_HEALTH_ALERT;
