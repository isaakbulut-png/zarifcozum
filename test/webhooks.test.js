const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const test = require('node:test');
const {
  createWebhookRouter,
  iyzicoSignature,
  paytrSignature,
  addSubscriptionPeriod,
  parseAmount
} = require('../routes/webhooks');

async function withWebhookServer(router, callback) {
  const server = express().use('/api/webhooks', router).listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    await callback(`http://127.0.0.1:${server.address().port}/api/webhooks`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function fakeSession() {
  return {
    withTransaction: callback => callback(),
    endSession: async () => {}
  };
}

function fakeModels({ payment, user, onLookup = () => {} }) {
  return {
    PaymentModel: {
      findOne: filter => ({
        session: async () => {
          onLookup(filter);
          return payment && payment.gateway === filter.gateway &&
            payment.orderReference === filter.orderReference ? payment : null;
        }
      })
    },
    UserModel: {
      findById: id => ({
        session: async () => id === user._id ? user : null
      })
    }
  };
}

function paymentRecord(gateway, orderReference, expectedAmountMinor = 1250) {
  return {
    gateway,
    orderReference,
    userId: 'user-id',
    expectedAmountMinor,
    subscriptionType: 'monthly',
    status: 'pending',
    save: async () => {}
  };
}

function userRecord() {
  return {
    _id: 'user-id',
    subscriptionStatus: 'free',
    subscriptionType: null,
    expiresAt: null,
    save: async () => {}
  };
}

test('iyzico V3 signature follows the documented field order', () => {
  const body = {
    iyziEventType: 'API_AUTH',
    iyziPaymentId: '12345',
    paymentId: '12345',
    paymentConversationId: 'order-1',
    status: 'SUCCESS'
  };
  const secret = 'test-secret';
  const message = secret + body.iyziEventType + body.iyziPaymentId +
    body.paymentConversationId + body.status;
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');
  assert.equal(iyzicoSignature(body, secret), expected);
  assert.equal(iyzicoSignature({ ...body, paymentId: 'other' }, secret), null);
});

test('PayTR signature uses merchant_oid + salt + status + total_amount', () => {
  const body = { merchant_oid: 'order-2', status: 'success', total_amount: '1250' };
  const key = 'merchant-key';
  const salt = 'merchant-salt';
  const expected = crypto.createHmac('sha256', key)
    .update(body.merchant_oid + salt + body.status + body.total_amount)
    .digest('base64');
  assert.equal(paytrSignature(body, key, salt), expected);
});

test('invalid iyzico signatures are rejected before database access', async () => {
  const original = process.env.IYZICO_SECRET_KEY;
  process.env.IYZICO_SECRET_KEY = 'test-secret';
  let databaseLookups = 0;
  const router = createWebhookRouter({
    ...fakeModels({
      payment: null,
      user: userRecord(),
      onLookup: () => databaseLookups++
    }),
    startSession: fakeSession
  });
  const body = {
    iyziEventType: 'API_AUTH',
    iyziPaymentId: '12345',
    paymentId: '12345',
    paymentConversationId: 'order-1',
    status: 'SUCCESS'
  };

  try {
    await withWebhookServer(router, async baseUrl => {
      const response = await fetch(`${baseUrl}/iyzico`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-IYZ-SIGNATURE-V3': 'invalid'
        },
        body: JSON.stringify(body)
      });
      assert.equal(response.status, 401);
      assert.equal(databaseLookups, 0);
    });
  } finally {
    if (original === undefined) delete process.env.IYZICO_SECRET_KEY;
    else process.env.IYZICO_SECRET_KEY = original;
  }
});

test('iyzico subscription callbacks fail closed without touching payment data', async () => {
  const original = process.env.IYZICO_SECRET_KEY;
  process.env.IYZICO_SECRET_KEY = 'test-secret';
  let databaseLookups = 0;
  const router = createWebhookRouter({
    ...fakeModels({
      payment: null,
      user: userRecord(),
      onLookup: () => databaseLookups++
    }),
    startSession: fakeSession
  });

  try {
    await withWebhookServer(router, async baseUrl => {
      const response = await fetch(`${baseUrl}/iyzico`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iyziEventType: 'subscription.order.success' })
      });
      assert.equal(response.status, 501);
      assert.equal(databaseLookups, 0);
    });
  } finally {
    if (original === undefined) delete process.env.IYZICO_SECRET_KEY;
    else process.env.IYZICO_SECRET_KEY = original;
  }
});

test('valid iyzico V3 success activates the matching pending payment', async () => {
  const original = process.env.IYZICO_SECRET_KEY;
  process.env.IYZICO_SECRET_KEY = 'test-secret';
  const payment = paymentRecord('iyzico', 'order-iyzico');
  const user = userRecord();
  const router = createWebhookRouter({
    ...fakeModels({ payment, user }),
    startSession: fakeSession
  });
  const body = {
    iyziEventType: 'API_AUTH',
    iyziPaymentId: '12345',
    paymentId: '12345',
    paymentConversationId: 'order-iyzico',
    status: 'SUCCESS'
  };
  const signature = iyzicoSignature(body, process.env.IYZICO_SECRET_KEY);
  const startedAt = Date.now();

  try {
    await withWebhookServer(router, async baseUrl => {
      const response = await fetch(`${baseUrl}/iyzico`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-IYZ-SIGNATURE-V3': signature
        },
        body: JSON.stringify(body)
      });
      assert.equal(response.status, 200);
      assert.equal(payment.status, 'paid');
      assert.equal(payment.providerPaymentId, '12345');
      assert.equal(user.subscriptionStatus, 'active');
      assert.equal(user.paymentGateway, 'iyzico');
      assert.ok(user.expiresAt >= addSubscriptionPeriod(new Date(startedAt), 'monthly'));
      assert.ok(user.expiresAt <= addSubscriptionPeriod(new Date(), 'monthly'));
    });
  } finally {
    if (original === undefined) delete process.env.IYZICO_SECRET_KEY;
    else process.env.IYZICO_SECRET_KEY = original;
  }
});

test('valid PayTR success activates once and extends the membership', async () => {
  const originalKey = process.env.PAYTR_MERCHANT_KEY;
  const originalSalt = process.env.PAYTR_MERCHANT_SALT;
  process.env.PAYTR_MERCHANT_KEY = 'merchant-key';
  process.env.PAYTR_MERCHANT_SALT = 'merchant-salt';
  const payment = paymentRecord('paytr', 'order-3');
  const user = userRecord();
  const models = fakeModels({ payment, user });
  const router = createWebhookRouter({ ...models, startSession: fakeSession });
  const form = {
    merchant_oid: 'order-3',
    status: 'success',
    total_amount: '1250',
    currency: 'TL'
  };
  form.hash = paytrSignature(form, process.env.PAYTR_MERCHANT_KEY, process.env.PAYTR_MERCHANT_SALT);
  const startedAt = Date.now();

  try {
    await withWebhookServer(router, async baseUrl => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(`${baseUrl}/paytr`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(form)
        });
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'OK');
      }
      assert.equal(payment.status, 'paid');
      assert.equal(user.subscriptionStatus, 'active');
      assert.equal(user.subscriptionType, 'monthly');
      assert.equal(user.paymentGateway, 'paytr');
      assert.ok(user.expiresAt >= addSubscriptionPeriod(new Date(startedAt), 'monthly'));
      assert.ok(user.expiresAt <= addSubscriptionPeriod(new Date(), 'monthly'));
    });
  } finally {
    if (originalKey === undefined) delete process.env.PAYTR_MERCHANT_KEY;
    else process.env.PAYTR_MERCHANT_KEY = originalKey;
    if (originalSalt === undefined) delete process.env.PAYTR_MERCHANT_SALT;
    else process.env.PAYTR_MERCHANT_SALT = originalSalt;
  }
});

test('invalid PayTR signatures are rejected before database access', async () => {
  const originalKey = process.env.PAYTR_MERCHANT_KEY;
  const originalSalt = process.env.PAYTR_MERCHANT_SALT;
  process.env.PAYTR_MERCHANT_KEY = 'merchant-key';
  process.env.PAYTR_MERCHANT_SALT = 'merchant-salt';
  let databaseLookups = 0;
  const router = createWebhookRouter({
    ...fakeModels({
      payment: null,
      user: userRecord(),
      onLookup: () => databaseLookups++
    }),
    startSession: fakeSession
  });
  const form = {
    merchant_oid: 'order-invalid',
    status: 'success',
    total_amount: '1250',
    hash: 'not-a-valid-signature'
  };

  try {
    await withWebhookServer(router, async baseUrl => {
      const response = await fetch(`${baseUrl}/paytr`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form)
      });
      assert.equal(response.status, 401);
      assert.equal(databaseLookups, 0);
    });
  } finally {
    if (originalKey === undefined) delete process.env.PAYTR_MERCHANT_KEY;
    else process.env.PAYTR_MERCHANT_KEY = originalKey;
    if (originalSalt === undefined) delete process.env.PAYTR_MERCHANT_SALT;
    else process.env.PAYTR_MERCHANT_SALT = originalSalt;
  }
});

test('amount parsing rejects non-integer and unsafe totals', () => {
  assert.equal(parseAmount('1250'), 1250);
  assert.equal(parseAmount('12.50'), null);
  assert.equal(parseAmount('9007199254740992'), null);
});
