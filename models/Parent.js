const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const parentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  surname: { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: { type: String, required: true, trim: true, maxlength: 20, match: /^05\d{9}$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['parent'], default: 'parent', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  restricted: { type: Boolean, default: false, index: true },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false }
}, { timestamps: true, collection: 'parents' });

parentSchema.statics.createWithPassword = async function (parentData, password) {
  const passwordHash = await this.hashPassword(password);
  return this.create({ ...parentData, passwordHash });
};

parentSchema.statics.hashPassword = function (password) {
  return bcrypt.hash(password, 12);
};

parentSchema.methods.verifyPassword = function (password) {
  return Boolean(this.passwordHash) && bcrypt.compare(password, this.passwordHash);
};

parentSchema.methods.setPassword = async function (password) {
  this.passwordHash = await this.constructor.hashPassword(password);
};

module.exports = mongoose.models.Parent || mongoose.model('Parent', parentSchema);
