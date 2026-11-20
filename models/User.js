const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const PARENT_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createParentConnectionCode() {
  return Array.from({ length: 6 }, () =>
    PARENT_CODE_CHARACTERS[crypto.randomInt(PARENT_CODE_CHARACTERS.length)]
  ).join('');
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
    match: /^05\d{9}$/
  },
  parentConnectionCode: {
    type: String,
    match: /^[A-Z0-9]{6}$/,
    sparse: true,
    unique: true,
    select: false
  },
  passwordHash: {
    type: String,
    default: undefined,
    select: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    select: false
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    required: true,
    default: 'student'
  },
  zarifPuan: { type: Number, default: 0, min: 0 },
  haftalikPuan: { type: Number, default: 0, min: 0 },
  mevcutLig: { type: String, default: 'Bronz' },
  adminRole: {
    type: String,
    enum: ['superadmin', 'editor', 'support', null],
    default: null,
    index: true
  },
  restricted: {
    type: Boolean,
    default: false,
    index: true
  },
  restrictedAt: {
    type: Date,
    default: null
  },
  restrictionReason: {
    type: String,
    trim: true,
    maxlength: 300,
    default: null
  },
  // Yapay Zekâ Kota ve Denetim Alanları
  // Öğretmen Rol & Yetki Seviyesi
  // Öğretmen Başvuru ve Onay Akışı Alanları
  basvuruDurumu: {
    type: String,
    enum: ['inceleme_suruyor', 'onaylandi', 'reddedildi'],
    default: function() {
      // Öğrenciler ve adminler doğrudan onaylıdır, öğretmenler incelemeyle başlar
      return this.role === 'teacher' ? 'inceleme_suruyor' : 'onaylandi';
    },
    index: true
  },
  brans: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null
  },
  teacherPanelPreferences: {
    type: new mongoose.Schema({
      displayName: { type: String, trim: true, maxlength: 100, default: '' },
      branch: { type: String, trim: true, maxlength: 80, default: '' },
      grades: { type: [Number], default: [] },
      notifications: { type: Boolean, default: true }
    }, { _id: false }),
    default: undefined
  },
  okulKurumAdi: {
    type: String,
    trim: true,
    maxlength: 200,
    default: null
  },
  telefon: {
    type: String,
    trim: true,
    maxlength: 25,
    default: null
  },
  basvuruNotu: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: null
  },
  basvuruTarihi: {
    type: Date,
    default: Date.now,
    index: true
  },
  onaylayanAdminId: {
    type: String,
    default: null
  },
  onayTarihi: {
    type: Date,
    default: null
  },
  ogretmenTipi: {
    type: String,
    enum: ['icerik_ureticisi', 'onayli_ogretmen', 'standart_ogretmen'],
    default: 'standart_ogretmen',
    index: true
  },
  ozelGunlukSoruLimiti: {
    type: Number,
    default: null
  },
  paketTipi: {
    type: String,
    enum: ['free', 'baslangic', 'pro'],
    default: 'free',
    index: true
  },
  gunlukAiMesajSayisi: {
    type: Number,
    default: 0
  },
  gunlukSoruUretimSayisi: {
    type: Number,
    default: 0
  },
  sonKotaSifirlamaTarihi: {
    type: Date,
    default: Date.now
  },
  ozelGunlukMesajLimiti: {
    type: Number,
    default: null
  },
  ekstraBonusKredi: {
    type: Number,
    default: 0
  },
  toplamHarcananToken: {
    type: Number,
    default: 0
  },
  toplamMaliyetTL: {
    type: Number,
    default: 0
  },
  aiErisimEngelli: {
    type: Boolean,
    default: false,
    index: true
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'active', 'expired'],
    default: 'free',
    index: true
  },
  subscriptionType: {
    type: String,
    enum: ['monthly', 'yearly', null],
    default: null
  },
  subscriptionPlan: {
    type: String,
    enum: ['temel', 'standart', 'vip', null],
    default: null
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  paymentGatewayCustomerId: {
    type: String,
    default: null,
    select: false,
    maxlength: 200
  },
  paymentGateway: {
    type: String,
    enum: ['iyzico', 'paytr', null],
    default: null
  }
}, { timestamps: true });

userSchema.index({ role: 1, haftalikPuan: -1, _id: 1 }, { name: 'student_weekly_leaderboard' });

userSchema.statics.createWithPassword = async function (userData, password) {
  const passwordHash = await this.hashPassword(password);
  return this.create({ ...userData, passwordHash });
};

userSchema.statics.hashPassword = function (password) {
  return bcrypt.hash(password, 12);
};

userSchema.methods.verifyPassword = function (password) {
  return Boolean(this.passwordHash) && bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await this.constructor.hashPassword(password);
};

userSchema.pre('validate', async function () {
  if (this.role !== 'student' || this.parentConnectionCode) return;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createParentConnectionCode();
    const existing = await this.constructor.exists({ parentConnectionCode: code });
    if (!existing) {
      this.parentConnectionCode = code;
      return;
    }
  }
  throw new Error('Veli bağlantı kodu üretilemedi.');
});

userSchema.statics.ensureParentConnectionCode = async function (userId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const user = await this.findById(userId).select('role +parentConnectionCode');
    if (!user || user.role !== 'student') return null;
    if (user.parentConnectionCode) return user.parentConnectionCode;

    const code = createParentConnectionCode();
    try {
      const updated = await this.findOneAndUpdate(
        { _id: user._id, role: 'student', parentConnectionCode: { $exists: false } },
        { $set: { parentConnectionCode: code } },
        { new: true, runValidators: true }
      ).select('+parentConnectionCode');
      if (updated?.parentConnectionCode) return updated.parentConnectionCode;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new Error('Veli bağlantı kodu oluşturulamadı. Lütfen yeniden deneyin.');
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
