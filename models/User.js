const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
