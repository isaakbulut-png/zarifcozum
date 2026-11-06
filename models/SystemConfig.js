const mongoose = require('mongoose');

const DEFAULT_VISITOR_SETTINGS = Object.freeze({
  questionLimit: 3,
  topicLimit: 3,
  trialDurationDays: 30,
  summaryEnabled: true,
  practiceEnabled: true,
  assistantEnabled: true,
  fullTestEnabled: false
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
  homepageAssets: {
    animation: { type: String, default: null },
    heroImage: { type: String, default: null },
    featureImage: { type: String, default: null }
  }
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

module.exports = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);
module.exports.DEFAULT_VISITOR_SETTINGS = DEFAULT_VISITOR_SETTINGS;
