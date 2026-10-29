const crypto = require('crypto');
const express = require('express');
const net = require('net');
const { rateLimit } = require('express-rate-limit');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { requireRole } = require('./auth');

const SANDBOX_PLANS = Object.freeze({
  temel: Object.freeze({ label: 'Temel aylık demo üyeliği', amountMinor: 24900 }),
  standart: Object.freeze({ label: 'Standart aylık demo üyeliği', amountMinor: 49900 }),
  yogun: Object.freeze({ label: 'Yoğun aylık demo üyeliği', amountMinor: 89900 })
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla ödeme denemesi. Bir süre sonra tekrar deneyin.' }
});

function paytrToken(payload, merchantKey, merchantSalt) {
  const signedData = payload.merchant_id + payload.user_ip + payload.merchant_oid +
    payload.email + payload.payment_amount + payload.user_basket +
    payload.no_installment + payload.max_installment + payload.currency +
    payload.test_mode + merchantSalt;
  return crypto.createHmac('sha256', merchantKey)
    .update(signedData, 'utf8')
    .digest('base64');
}

function publicBaseUrl() {
  const value = String(process.env.APP_BASE_URL || '').trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' &&
      !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname))) {
    return null;
  }
  return url.origin;
}

function createPaymentRouter({
  UserModel = User,
  PaymentModel = Payment,
  fetchImpl = globalThis.fetch,
  requireStudent = requireRole('student')
} = {}) {
  const router = express.Router();

  router.get('/subscription', requireStudent, async (req, res) => {
    try {
      const user = await UserModel.findById(req.session.user.id)
        .select('subscriptionStatus subscriptionType expiresAt');
      if (!user) return res.status(404).json({ mesaj: 'Hesap bulunamadı.' });
      res.json({
        subscriptionStatus: user.subscriptionStatus,
        subscriptionType: user.subscriptionType,
        expiresAt: user.expiresAt
      });
    } catch (error) {
      console.error('Üyelik bilgisi alınamadı:', error.message);
      res.status(500).json({ mesaj: 'Üyelik bilgisi alınamadı.' });
    }
  });

  router.post('/paytr/checkout', requireStudent, checkoutLimiter, async (req, res) => {
    const planKey = typeof req.body?.plan === 'string' ? req.body.plan : '';
    const plan = SANDBOX_PLANS[planKey];
    if (!plan) return res.status(400).json({ mesaj: 'Geçersiz demo paketi.' });

    const merchantId = String(process.env.PAYTR_MERCHANT_ID || '').trim();
    const merchantKey = String(process.env.PAYTR_MERCHANT_KEY || '');
    const merchantSalt = String(process.env.PAYTR_MERCHANT_SALT || '');
    const baseUrl = publicBaseUrl();
    if (!merchantId || !/^\d+$/.test(merchantId) || !merchantKey || !merchantSalt || !baseUrl) {
      return res.status(503).json({
        mesaj: 'PayTR sandbox ayarları tamamlanmamış. Ödeme başlatılamadı.'
      });
    }

    const userIp = String(req.ip || '');
    if (!net.isIP(userIp)) {
      return res.status(400).json({ mesaj: 'PayTR için geçerli istemci IP adresi alınamadı.' });
    }
    if (typeof fetchImpl !== 'function') {
      return res.status(503).json({ mesaj: 'PayTR ödeme servisi kullanılamıyor.' });
    }

    let payment;
    try {
      const user = await UserModel.findById(req.session.user.id).select('name email role');
      if (!user || user.role !== 'student') {
        return res.status(404).json({ mesaj: 'Öğrenci hesabı bulunamadı.' });
      }
      if (typeof user.email !== 'string' ||
          !/^[\x20-\x7e]+$/.test(user.email) ||
          user.email.length > 100) {
        return res.status(400).json({
          mesaj: 'PayTR için hesap e-posta adresi ASCII karakterlerle güncellenmelidir.'
        });
      }

      const orderReference = `ZC${crypto.randomBytes(16).toString('hex')}`;
      const amount = (plan.amountMinor / 100).toFixed(2);
      const userBasket = Buffer.from(JSON.stringify([[plan.label, amount, 1]]))
        .toString('base64');
      const payload = {
        merchant_id: merchantId,
        user_ip: userIp,
        merchant_oid: orderReference,
        email: user.email,
        payment_amount: String(plan.amountMinor),
        currency: 'TL',
        user_basket: userBasket,
        no_installment: '1',
        max_installment: '0',
        test_mode: '1',
        debug_on: '1',
        timeout_limit: '30',
        lang: 'tr',
        user_name: String(user.name || 'Öğrenci').slice(0, 60),
        merchant_ok_url: `${baseUrl}/ogrenci-paneli.html?odeme=kontrol`,
        merchant_fail_url: `${baseUrl}/ogrenci-paneli.html?odeme=basarisiz`
      };
      payload.paytr_token = paytrToken(payload, merchantKey, merchantSalt);

      payment = await PaymentModel.create({
        gateway: 'paytr',
        orderReference,
        userId: user._id,
        expectedAmountMinor: plan.amountMinor,
        currency: 'TRY',
        subscriptionType: 'monthly',
        status: 'pending'
      });

      const response = await fetchImpl('https://www.paytr.com/odeme/api/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload),
        signal: AbortSignal.timeout(10000)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== 'success' ||
          typeof result.token !== 'string' || !/^[A-Za-z0-9]+$/.test(result.token)) {
        payment.status = 'failed';
        await payment.save();
        console.error('PayTR sandbox token isteği başarısız:', {
          status: response.status,
          reason: typeof result?.reason === 'string' ? result.reason : 'Geçersiz sağlayıcı yanıtı'
        });
        return res.status(502).json({ mesaj: 'PayTR ödeme formu şu anda oluşturulamadı.' });
      }

      res.status(201).json({
        orderReference,
        iframeUrl: `https://www.paytr.com/odeme/guvenli/${encodeURIComponent(result.token)}`
      });
    } catch (error) {
      if (payment?.status === 'pending') {
        payment.status = 'failed';
        await payment.save().catch(saveError => {
          console.error('PayTR başarısız checkout kaydı kapatılamadı:', saveError.message);
        });
      }
      console.error('PayTR sandbox checkout başlatılamadı:', error.message);
      res.status(502).json({ mesaj: 'PayTR ödeme akışı başlatılamadı. Lütfen tekrar deneyin.' });
    }
  });

  return router;
}

module.exports = { createPaymentRouter, paytrToken, SANDBOX_PLANS };
