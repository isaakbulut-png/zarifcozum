const mongoose = require('mongoose');

const serviceItemSchema = {
  status: { type: String, enum: ['healthy', 'warning', 'error', 'unconfigured'], default: 'healthy' },
  durationMs: { type: Number, default: 0 },
  details: { type: String, default: '' },
  quota: { type: mongoose.Schema.Types.Mixed, default: null },
  lastError: { type: String, default: null },
  lastSuccessAt: { type: Date, default: null }
};

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
    // 1. Temel Altyapı
    api: {
      ...serviceItemSchema,
      uptime: { type: Number, default: 0 },
      memoryRssMb: { type: Number, default: 0 }
    },
    database: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      postgres: {
        status: { type: String, enum: ['healthy', 'warning', 'error', 'unconfigured'], default: 'unconfigured' },
        configured: { type: Boolean, default: false },
        durationMs: { type: Number, default: 0 },
        details: { type: String, default: '' },
        lastError: { type: String, default: null },
        lastSuccessAt: { type: Date, default: null }
      },
      mongo: {
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        durationMs: { type: Number, default: 0 },
        details: { type: String, default: '' },
        dbName: { type: String, default: '' },
        lastError: { type: String, default: null },
        lastSuccessAt: { type: Date, default: null }
      }
    },
    r2: {
      ...serviceItemSchema,
      bucket: { type: String, default: '' },
      endpoint: { type: String, default: '' }
    },
    cloudinary: {
      ...serviceItemSchema,
      url: { type: String, default: '' }
    },
    ssl: {
      ...serviceItemSchema,
      domain: { type: String, default: 'www.zarifcozum.com' },
      validTo: { type: Date },
      validFrom: { type: Date },
      daysLeft: { type: Number, default: 0 },
      issuer: { type: String, default: '' },
      isExpiringSoon: { type: Boolean, default: false }
    },
    domain: {
      status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
      mainDomain: {
        url: { type: String, default: 'https://www.zarifcozum.com' },
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        statusCode: { type: Number, default: 200 },
        durationMs: { type: Number, default: 0 },
        cfRay: { type: String, default: '' },
        lastError: { type: String, default: null },
        lastSuccessAt: { type: Date, default: null }
      },
      mediaDomain: {
        url: { type: String, default: 'https://media.zarifcozum.com' },
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        statusCode: { type: Number, default: 200 },
        durationMs: { type: Number, default: 0 },
        cfRay: { type: String, default: '' },
        lastError: { type: String, default: null },
        lastSuccessAt: { type: Date, default: null }
      },
      httpsRedirect: {
        status: { type: String, enum: ['healthy', 'warning', 'error'], default: 'healthy' },
        statusCode: { type: Number, default: 301 },
        redirected: { type: Boolean, default: true },
        location: { type: String, default: '' }
      }
    },
    mediaCdn: {
      ...serviceItemSchema,
      statusCode: { type: Number, default: 200 },
      cfCacheStatus: { type: String, default: '' },
      cfRay: { type: String, default: '' }
    },

    // 2. Yeni Gelişmiş Servisler
    pinecone: {
      ...serviceItemSchema,
      indexes: [{ type: String }]
    },
    github: {
      ...serviceItemSchema,
      repo: { type: String, default: 'isaakbulut-png/zarifcozum' }
    },
    githubActions: {
      ...serviceItemSchema,
      totalRuns: { type: Number, default: 0 },
      latestRun: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    gemini: {
      ...serviceItemSchema,
      modelCount: { type: Number, default: 0 }
    },
    cloudflare: {
      ...serviceItemSchema,
      colo: { type: String, default: '' },
      tls: { type: String, default: '' },
      httpProtocol: { type: String, default: '' }
    },
    googleCloud: {
      ...serviceItemSchema,
      hasClientId: { type: Boolean, default: false },
      clientIdPrefix: { type: String, default: '' },
      issuer: { type: String, default: '' }
    },

    // 3. Performans
    performance: {
      apiMs: { type: Number, default: 0 },
      r2Ms: { type: Number, default: 0 },
      cloudinaryMs: { type: Number, default: 0 },
      dbMs: { type: Number, default: 0 },
      pineconeMs: { type: Number, default: 0 },
      geminiMs: { type: Number, default: 0 },
      githubMs: { type: Number, default: 0 },
      averageMs: { type: Number, default: 0 },
      grade: { type: String, default: 'A+' }
    }
  },
  warnings: [{ type: String }],
  errors: [{ type: String }],
  isScheduled: {
    type: Boolean,
    default: false
  },
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
    .select('_id timestamp score status summary warnings errors checks.performance isScheduled scannedBy createdAt')
    .lean();
};

module.exports = mongoose.models.SystemHealthLog || mongoose.model('SystemHealthLog', systemHealthLogSchema);
