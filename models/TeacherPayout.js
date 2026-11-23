const mongoose = require('mongoose');

const teacherPayoutSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  teacherName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  teacherEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  period: {
    type: String, // 'YYYY-MM', örn: '2026-11'
    required: true,
    index: true
  },
  periodLabel: {
    type: String, // 'Kasım 2026'
    required: true
  },
  // Vergi Statüsü ve Banka Bilgileri
  taxType: {
    type: String,
    enum: ['bireysel', 'sahis_sirketi', 'limited_sirket'],
    default: 'bireysel',
    index: true
  },
  bankName: {
    type: String,
    trim: true,
    default: ''
  },
  iban: {
    type: String,
    trim: true,
    default: ''
  },
  accountHolder: {
    type: String,
    trim: true,
    default: ''
  },
  taxOffice: {
    type: String,
    trim: true,
    default: ''
  },
  taxNumber: {
    type: String,
    trim: true,
    default: ''
  },
  // Hakediş Kırılımları
  liveHours: {
    type: Number,
    default: 0,
    min: 0
  },
  hourlyRate: {
    type: Number,
    default: 450,
    min: 0
  },
  contentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  contentBonus: {
    type: Number,
    default: 0,
    min: 0
  },
  grossAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  withholdingRate: {
    type: Number,
    default: 20, // Bireysel için %20 stopaj
    min: 0,
    max: 100
  },
  withholdingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'TRY'
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Kural 1: Fatura Takibi (Şirketler için)
  invoiceStatus: {
    type: String,
    enum: ['bekleniyor', 'yuklendi', 'onaylandi', 'muaf'],
    default: 'muaf'
  },
  invoiceUrl: {
    type: String,
    default: null
  },
  invoiceNo: {
    type: String,
    trim: true,
    default: ''
  },
  invoiceDate: {
    type: Date,
    default: null
  },
  // Kural 3: Onay ve Kilit Durumu
  status: {
    type: String,
    enum: ['taslak', 'bekliyor', 'onaylandi', 'odendi', 'iptal'],
    default: 'bekliyor',
    index: true
  },
  isLocked: {
    type: Boolean,
    default: false,
    index: true
  },
  approvedBy: {
    adminId: { type: String, default: null },
    adminName: { type: String, default: null },
    approvedAt: { type: Date, default: null }
  },
  paidAt: {
    type: Date,
    default: null
  },
  paidBy: {
    adminId: { type: String, default: null },
    adminName: { type: String, default: null }
  },
  // Kural 4: Dekont Dosyası ve Bildirim
  receiptUrl: {
    type: String,
    default: null
  },
  receiptFileName: {
    type: String,
    default: null
  },
  receiptUploadedAt: {
    type: Date,
    default: null
  },
  receiptUploadedBy: {
    adminId: { type: String, default: null },
    adminName: { type: String, default: null }
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'teacher_payouts'
});

teacherPayoutSchema.index({ period: 1, teacherId: 1 }, { unique: true });
teacherPayoutSchema.index({ status: 1, period: 1 });

module.exports = mongoose.models.TeacherPayout || mongoose.model('TeacherPayout', teacherPayoutSchema);
