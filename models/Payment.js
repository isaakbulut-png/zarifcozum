const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  gateway: {
    type: String,
    enum: ['iyzico', 'paytr'],
    required: true
  },
  orderReference: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expectedAmountMinor: {
    type: Number,
    required: true,
    min: 1,
    validate: Number.isSafeInteger
  },
  currency: {
    type: String,
    enum: ['TRY'],
    required: true,
    default: 'TRY'
  },
  subscriptionType: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    required: true,
    default: 'pending',
    index: true
  },
  providerPaymentId: {
    type: String,
    default: null,
    maxlength: 200
  },
  providerCustomerId: {
    type: String,
    default: null,
    maxlength: 200
  },
  providerSubscriptionId: {
    type: String,
    default: null,
    maxlength: 200
  },
  paidAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

paymentSchema.index({ gateway: 1, orderReference: 1 }, { unique: true });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
