const mongoose = require('mongoose');

const systemHealthLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['healthy', 'warning', 'error'],
    required: true,
    default: 'healthy'
  },
  summary: {
    type: String,
    default: ''
  },
  checks: {
    api: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      durationMs: { type: Number, default: 0 },
      details: { type: String, default: '' },
      uptime: { type: Number, default: 0 },
      memoryRssMb: { type: Number, default: 0 }
    },
    database: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      postgres: {
        status: { type: String, enum: ['healthy', 'warning', 'error', 'unconfigured'], default: 'unconfigured' },
        configured: { type: Boolean, default: false },
        durationMs: { type: Number, default: 0 },
        details: { type: String, default: '' }
      },
      mongo: {
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        durationMs: { type: Number, default: 0 },
        details: { type: String, default: '' },
        dbName: { type: String, default: '' }
      }
    },
    r2: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      durationMs: { type: Number, default: 0 },
      details: { type: String, default: '' },
      bucket: { type: String, default: '' },
      endpoint: { type: String, default: '' }
    },
    cloudinary: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      durationMs: { type: Number, default: 0 },
      details: { type: String, default: '' },
      url: { type: String, default: '' }
    },
    ssl: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      domain: { type: String, default: 'www.zarifcozum.com' },
      validTo: { type: Date },
      validFrom: { type: Date },
      daysLeft: { type: Number, default: 0 },
      issuer: { type: String, default: '' },
      isExpiringSoon: { type: Boolean, default: false },
      details: { type: String, default: '' }
    },
    domain: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      mainDomain: {
        url: { type: String, default: 'https://www.zarifcozum.com' },
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        statusCode: { type: Number, default: 200 },
        durationMs: { type: Number, default: 0 },
        cfRay: { type: String, default: '' }
      },
      mediaDomain: {
        url: { type: String, default: 'https://media.zarifcozum.com' },
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        statusCode: { type: Number, default: 200 },
        durationMs: { type: Number, default: 0 },
        cfRay: { type: String, default: '' }
      },
      httpsRedirect: {
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        statusCode: { type: Number, default: 301 },
        redirected: { type: Boolean, default: true },
        location: { type: String, default: '' }
      }
    },
    mediaCdn: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      statusCode: { type: Number, default: 200 },
      durationMs: { type: Number, default: 0 },
      cfCacheStatus: { type: String, default: '' },
      cfRay: { type: String, default: '' },
      details: { type: String, default: '' }
    },
    performance: {
      apiMs: { type: Number, default: 0 },
      r2Ms: { type: Number, default: 0 },
      cloudinaryMs: { type: Number, default: 0 },
      dbMs: { type: Number, default: 0 },
      averageMs: { type: Number, default: 0 },
      grade: { type: String, default: 'A+' }
    }
  },
  warnings: [{ type: String }],
  errors: [{ type: String }],
  scannedBy: {
    type: String,
    default: 'Süper Admin'
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

systemHealthLogSchema.index({ createdAt: -1 });

systemHealthLogSchema.statics.saveScan = async function (scanData) {
  const doc = new this(scanData);
  return doc.save();
};

systemHealthLogSchema.statics.getLatest = async function () {
  return this.findOne().sort({ createdAt: -1 }).lean();
};

systemHealthLogSchema.statics.getLastLogs = async function (limit = 30) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id timestamp score status summary warnings errors checks.performance scannedBy createdAt')
    .lean();
};

module.exports = mongoose.models.SystemHealthLog || mongoose.model('SystemHealthLog', systemHealthLogSchema);
