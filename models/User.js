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
  branch: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null
  },
  graduationInfo: {
    type: String,
    trim: true,
    maxlength: 300,
    default: null
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  avatarUrl: {
    type: String,
    default: null
  },
  photo: {
    type: String,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  verificationDocumentUrl: {
    type: String,
    trim: true,
    default: null
  },
  contractAccepted: {
    type: Boolean,
    default: false
  },
  contractAcceptedAt: {
    type: Date,
    default: null
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
  // Öğretmen Finans, Banka ve Vergi Bilgileri
  teacherFinance: {
    bankName: { type: String, default: '', trim: true },
    iban: { type: String, default: '', trim: true },
    accountHolder: { type: String, default: '', trim: true },
    taxType: { type: String, enum: ['bireysel', 'sahis_sirketi', 'limited_sirket'], default: 'bireysel' },
    taxOffice: { type: String, default: '', trim: true },
    taxNumber: { type: String, default: '', trim: true },
    billingAddress: { type: String, default: '', trim: true },
    hourlyRate: { type: Number, default: 450, min: 0 }
  },
  teacherNotifications: [{
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'payment' },
    receiptUrl: { type: String, default: null },
    payoutId: { type: String, default: null },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  ozelGunlukSoruLimiti: {
    type: Number,
    default: null
  },
  paketTipi: {
    type: String,
    enum: ['free', 'temel', 'standart', 'vip', 'baslangic', 'pro'],
    default: 'free',
    index: true
  },
  // Sınıf Düzeyi ve Telafi Alanları
  kayitliSinif: {
    type: Number,
    enum: [5, 6, 7, 8, 9, 10, 11, 12, null],
    default: null,
    index: true
  },
  grade: {
    type: Number,
    enum: [5, 6, 7, 8, 9, 10, 11, 12, null],
    default: null,
    index: true
  },
  parentContact: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null
  },
  guardianConsentAccepted: {
    type: Boolean,
    default: false
  },
  guardianConsentAt: {
    type: Date,
    default: null
  },
  seciliTelafiSinif: {
    type: Number,
    enum: [5, 6, 7, 8, 9, 10, 11, 12, null],
    default: null
  },
  // Çok Boyutlu Günlük ve Aylık AI Sayaçları
  gunlukAiMesajSayisi: {
    type: Number,
    default: 0
  },
  gunlukSokratikSayisi: {
    type: Number,
    default: 0
  },
  aylikSokratikSayisi: {
    type: Number,
    default: 0
  },
  aylikOgretmenIkiziSayisi: {
    type: Number,
    default: 0
  },
  gunlukSoruUretimSayisi: {
    type: Number,
    default: 0
  },
  aylikSoruUretimSayisi: {
    type: Number,
    default: 0
  },
  sonKotaSifirlamaTarihi: {
    type: Date,
    default: Date.now
  },
  sonAylikSifirlamaTarihi: {
    type: Date,
    default: Date.now
  },
  // Oyunlaştırma (Gamification)
  seriGunSayisi: {
    type: Number,
    default: 0,
    min: 0
  },
  sonCalismaTarihi: {
    type: Date,
    default: null
  },
  seriKorumaKalkani: {
    type: Boolean,
    default: false
  },
  kazanilanRozetler: [{
    id: String,
    ad: String,
    kategori: String,
    icon: String,
    kazanildiAt: {
      type: Date,
      default: Date.now
    }
  }],
  erisenYaziliProvalar: [{
    yaziliId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YaziliProva'
    },
    donem: {
      type: String
    },
    erisimTarihi: {
      type: Date,
      default: Date.now
    }
  }],
  ozelGunlukMesajLimiti: {
    type: Number,
    default: null
  },
  ozelAylikSoruLimiti: {
    type: Number,
    default: null
  },
  ekstraBonusKredi: {
    type: Number,
    default: 0
  },
  ekstraSokratikKredi: {
    type: Number,
    default: 0
  },
  ekstraOgretmenIkiziKredi: {
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
    enum: ['free', 'active', 'expired', 'cancelled'],
    default: 'active',
    index: true
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'temel', 'standart', 'vip'],
    default: 'free',
    index: true
  },
  subscriptionType: {
    type: String,
    enum: ['monthly', 'yearly', 'annual', null],
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
  subscriptionEndDate: {
    type: Date,
    default: null,
    index: true
  },
  dailyAiUsage: {
    count: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now }
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

userSchema.methods.isSubscriptionActive = function (now = new Date()) {
  if (this.role === 'admin') return true;
  if (this.subscriptionStatus !== 'active') return false;
  if (this.expiresAt && new Date(this.expiresAt) <= now) return false;
  return true;
};

userSchema.methods.getEffectivePlan = function (now = new Date()) {
  if (this.role === 'admin') return 'vip';
  if (this.isSubscriptionActive(now) && this.subscriptionPlan) {
    return this.subscriptionPlan;
  }
  // Fallback to paketTipi mapping
  if (this.paketTipi === 'vip' || this.paketTipi === 'pro') return 'vip';
  if (this.paketTipi === 'standart') return 'standart';
  if (this.paketTipi === 'temel' || this.paketTipi === 'baslangic') return 'temel';
  return 'free';
};

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
  // Sınıf (grade <-> kayitliSinif) senkronizasyonu
  if (this.grade && !this.kayitliSinif) this.kayitliSinif = this.grade;
  if (this.kayitliSinif && !this.grade) this.grade = this.kayitliSinif;

  // Paket / Tier senkronizasyonu (yükseltme ve tüm alanların çift yönlü eşleşmesi)
  const validTiers = ['temel', 'standart', 'vip'];
  if (this.isModified('subscriptionPlan') && validTiers.includes(this.subscriptionPlan)) {
    this.subscriptionTier = this.subscriptionPlan;
    this.paketTipi = this.subscriptionPlan;
  } else if (this.isModified('subscriptionTier') && ['free', ...validTiers].includes(this.subscriptionTier)) {
    if (this.subscriptionTier !== 'free') this.subscriptionPlan = this.subscriptionTier;
    this.paketTipi = this.subscriptionTier;
  } else if (this.isModified('paketTipi') && ['free', ...validTiers].includes(this.paketTipi)) {
    this.subscriptionTier = this.paketTipi;
    if (this.paketTipi !== 'free') this.subscriptionPlan = this.paketTipi;
  } else if (this.subscriptionPlan && validTiers.includes(this.subscriptionPlan) && (!this.subscriptionTier || this.subscriptionTier === 'free')) {
    this.subscriptionTier = this.subscriptionPlan;
    this.paketTipi = this.subscriptionPlan;
  } else if (this.subscriptionTier && this.subscriptionTier !== 'free') {
    if (!this.subscriptionPlan) this.subscriptionPlan = this.subscriptionTier;
    if (!this.paketTipi || this.paketTipi === 'free') this.paketTipi = this.subscriptionTier;
  }

  // Bitiş tarihi (subscriptionEndDate <-> expiresAt) senkronizasyonu
  if (this.isModified('expiresAt') && this.expiresAt) {
    this.subscriptionEndDate = this.expiresAt;
  } else if (this.isModified('subscriptionEndDate') && this.subscriptionEndDate) {
    this.expiresAt = this.subscriptionEndDate;
  } else if (this.subscriptionEndDate && !this.expiresAt) {
    this.expiresAt = this.subscriptionEndDate;
  } else if (this.expiresAt && !this.subscriptionEndDate) {
    this.subscriptionEndDate = this.expiresAt;
  }

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
