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

module.exports = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);
module.exports.DEFAULT_VISITOR_SETTINGS = DEFAULT_VISITOR_SETTINGS;
module.exports.DEFAULT_ANNOUNCEMENT_BANNER = DEFAULT_ANNOUNCEMENT_BANNER;
