const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const User = require('../models/User');

const MAX_BODY_BYTES = '32kb';

class WebhookError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function safeEqualText(expected, supplied, encoding) {
  if (typeof supplied !== 'string' || !supplied) return false;
  if (encoding === 'hex' && !/^(?:[a-f0-9]{2})+$/i.test(supplied)) return false;
  if (encoding === 'base64' &&
      (!/^[A-Za-z0-9+/]+={0,2}$/.test(supplied) ||
       Buffer.from(supplied, 'base64').toString('base64') !== supplied)) return false;
  const expectedBytes = Buffer.from(expected, encoding);
  const suppliedBytes = Buffer.from(supplied, encoding);
  return expectedBytes.length === suppliedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, suppliedBytes);
}

function iyzicoSignature(body, secretKey) {
  const paymentId = String(body.iyziPaymentId ?? body.paymentId ?? '');
  if (!body.iyziEventType || !paymentId || !body.paymentConversationId || !body.status) {
    return null;
  }
  if (body.paymentId != null && body.iyziPaymentId != null &&
      String(body.paymentId) !== String(body.iyziPaymentId)) {
    return null;
  }
  const signedData = secretKey + body.iyziEventType + paymentId +
    body.paymentConversationId + body.status;
  return crypto.createHmac('sha256', secretKey).update(signedData, 'utf8').digest('hex');
}

function paytrSignature(body, merchantKey, merchantSalt) {
  if (!body.merchant_oid || !body.status || !body.total_amount) return null;
  const signedData = body.merchant_oid + merchantSalt + body.status + body.total_amount;
  return crypto.createHmac('sha256', merchantKey)
    .update(signedData, 'utf8')
    .digest('base64');
}

function addSubscriptionPeriod(start, subscriptionType) {
  const result = new Date(start);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + (subscriptionType === 'yearly' ? 12 : 1));
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0
  )).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function parseAmount(value) {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

async function updatePayment({ gateway, orderReference, paymentId, amountMinor, success, UserModel, PaymentModel, startSession }) {
  const session = await startSession();
  let outcome = 'processed';

  try {
    await session.withTransaction(async () => {
      const payment = await PaymentModel.findOne({ gateway, orderReference }).session(session);
      if (!payment) throw new WebhookError(404, 'Ödeme kaydı bulunamadı.');

      if (payment.status === 'paid' || payment.status === 'failed') {
        outcome = 'duplicate';
        return;
      }
      if (payment.status !== 'pending') {
        throw new WebhookError(409, 'Ödeme kaydı işlenemedi.');
      }
      if (amountMinor != null && payment.expectedAmountMinor !== amountMinor) {
        throw new WebhookError(400, 'Ödeme tutarı beklenen tutarla eşleşmiyor.');
      }

      if (!success) {
        payment.status = 'failed';
        payment.providerPaymentId = paymentId || payment.providerPaymentId;
        await payment.save({ session });
        return;
      }

      const user = await UserModel.findById(payment.userId).session(session);
      if (!user) throw new WebhookError(404, 'Ödeme kullanıcısı bulunamadı.');

      const now = new Date();
      const base = user.expiresAt && user.expiresAt > now ? user.expiresAt : now;
      user.subscriptionStatus = 'active';
      user.subscriptionType = payment.subscriptionType;
      user.expiresAt = addSubscriptionPeriod(base, payment.subscriptionType);
      user.paymentGateway = gateway;
      if (payment.providerCustomerId) {
        user.paymentGatewayCustomerId = payment.providerCustomerId;
      }
      payment.status = 'paid';
      payment.providerPaymentId = paymentId || payment.providerPaymentId;
      payment.paidAt = now;
      await user.save({ session });
      await payment.save({ session });
    });
    return outcome;
  } finally {
    await session.endSession();
  }
}

function createWebhookRouter({
  UserModel = User,
  PaymentModel = Payment,
  startSession = () => mongoose.startSession()
} = {}) {
  const router = express.Router();

  router.post('/iyzico', express.raw({
    type: 'application/json',
    limit: MAX_BODY_BYTES
  }), async (req, res) => {
    const secretKey = String(process.env.IYZICO_SECRET_KEY || '');
    if (!secretKey) {
      return res.status(503).json({ mesaj: 'iyzico webhook doğrulaması yapılandırılmamış.' });
    }

    let body;
    try {
      if (!Buffer.isBuffer(req.body)) throw new Error('JSON gövdesi bekleniyor.');
      body = JSON.parse(req.body.toString('utf8'));
    } catch (error) {
      return res.status(400).json({ mesaj: 'Webhook gövdesi geçersiz.' });
    }

    if (typeof body.iyziEventType === 'string' &&
        body.iyziEventType.startsWith('subscription.')) {
      return res.status(501).json({
        mesaj: 'iyzico abonelik webhook imza biçimi doğrulanamadığı için işlem reddedildi.'
      });
    }

    const signature = req.get('X-IYZ-SIGNATURE-V3');
    const expected = iyzicoSignature(body, secretKey);
    if (!expected || !safeEqualText(expected, signature, 'hex')) {
      return res.status(401).json({ mesaj: 'Webhook imzası geçersiz.' });
    }

    const paymentId = String(body.iyziPaymentId ?? body.paymentId);
    const success = body.status === 'SUCCESS';
    if (!success && body.status !== 'FAILURE') return res.status(200).json({ mesaj: 'Bildirim alındı.' });

    try {
      const outcome = await updatePayment({
        gateway: 'iyzico',
        orderReference: String(body.paymentConversationId),
        paymentId,
        success,
        UserModel,
        PaymentModel,
        startSession
      });
      res.status(200).json({ mesaj: outcome === 'duplicate' ? 'Bildirim daha önce işlendi.' : 'Bildirim işlendi.' });
    } catch (error) {
      if (error instanceof WebhookError) {
        return res.status(error.status).json({ mesaj: error.message });
      }
      console.error('iyzico webhook işlenemedi:', error.message);
      res.status(500).json({ mesaj: 'Webhook işlenemedi.' });
    }
  });

  router.post('/paytr', express.urlencoded({
    extended: false,
    limit: MAX_BODY_BYTES
  }), async (req, res) => {
    const merchantKey = String(process.env.PAYTR_MERCHANT_KEY || '');
    const merchantSalt = String(process.env.PAYTR_MERCHANT_SALT || '');
    if (!merchantKey || !merchantSalt) {
      return res.status(503).type('text/plain').send('Webhook configuration missing');
    }

    const expected = paytrSignature(req.body || {}, merchantKey, merchantSalt);
    const supplied = req.body?.hash;
    if (!expected || !safeEqualText(expected, supplied, 'base64')) {
      return res.status(401).type('text/plain').send('Unauthorized');
    }
    if (!['success', 'failed'].includes(req.body.status)) {
      return res.status(400).type('text/plain').send('Invalid status');
    }

    const amountMinor = parseAmount(req.body.total_amount);
    if (!amountMinor) return res.status(400).type('text/plain').send('Invalid amount');

    const currency = req.body.currency;
    if (currency && !['TL', 'TRY'].includes(String(currency).toUpperCase())) {
      return res.status(400).type('text/plain').send('Invalid currency');
    }

    try {
      const success = req.body.status === 'success';
      await updatePayment({
        gateway: 'paytr',
        orderReference: req.body.merchant_oid,
        amountMinor,
        success,
        UserModel,
        PaymentModel,
        startSession
      });
      res.status(200).type('text/plain').send('OK');
    } catch (error) {
      if (error instanceof WebhookError) {
        return res.status(error.status).type('text/plain').send(error.message);
      }
      console.error('PayTR webhook işlenemedi:', error.message);
      res.status(500).type('text/plain').send('Webhook processing failed');
    }
  });

  return router;
}

module.exports = {
  createWebhookRouter,
  iyzicoSignature,
  paytrSignature,
  addSubscriptionPeriod,
  parseAmount
};
