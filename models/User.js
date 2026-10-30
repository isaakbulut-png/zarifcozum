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
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    required: true,
    default: 'student'
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
  const passwordHash = await bcrypt.hash(password, 12);
  return this.create({ ...userData, passwordHash });
};

userSchema.methods.verifyPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
