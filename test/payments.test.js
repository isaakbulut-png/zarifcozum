const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const test = require('node:test');
const { createPaymentRouter, paytrToken } = require('../routes/payments');

const ENV_KEYS = [
  'PAYTR_MERCHANT_ID',
  'PAYTR_MERCHANT_KEY',
  'PAYTR_MERCHANT_SALT',
  'APP_BASE_URL'
];

function setSandboxEnvironment() {
  const previous = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.PAYTR_MERCHANT_ID = '123456';
  process.env.PAYTR_MERCHANT_KEY = 'test-merchant-key';
  process.env.PAYTR_MERCHANT_SALT = 'test-merchant-salt';
  process.env.APP_BASE_URL = 'https://zarifcozum.com';
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function withPaymentServer(router, sessionUser, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: sessionUser };
    next();
  });
  app.use('/api/payments', router);
  const server = app.listen(0);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', async () => {
      try {
        await callback(`http://127.0.0.1:${server.address().port}/api/payments`);
        server.close(error => error ? reject(error) : resolve());
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

function fakeUserModel(user, onLookup = () => {}) {
  return {
    findById: id => {
      onLookup(id);
      return { select: async () => id === user._id ? user : null };
    }
  };
}

test('PayTR sandbox checkout signs the server-priced order and returns hosted iframe URL', async () => {
  const restoreEnvironment = setSandboxEnvironment();
  const user = {
    _id: 'student-id',
    role: 'student',
    name: 'Test Student',
    email: 'student@example.com'
  };
  let createdPayment;
  let receivedPayload;
  const router = createPaymentRouter({
    UserModel: fakeUserModel(user),
    PaymentModel: {
      create: async payment => {
        createdPayment = { ...payment, save: async function () {} };
        return createdPayment;
      }
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://www.paytr.com/odeme/api/get-token');
      receivedPayload = Object.fromEntries(new URLSearchParams(options.body));
      return { ok: true, status: 200, json: async () => ({ status: 'success', token: 'sandboxToken123' }) };
    }
  });

  try {
    await withPaymentServer(router, { id: 'student-id', role: 'student' }, async baseUrl => {
      const response = await fetch(`${baseUrl}/paytr/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'temel', amount: 1, subscriptionType: 'yearly' })
      });
      assert.equal(response.status, 201);
      const result = await response.json();
      assert.equal(result.iframeUrl, 'https://www.paytr.com/odeme/guvenli/sandboxToken123');
      assert.match(result.orderReference, /^ZC[a-f0-9]{32}$/);
      assert.equal(receivedPayload.merchant_oid, result.orderReference);
      assert.equal(receivedPayload.payment_amount, '24900');
      assert.equal(receivedPayload.currency, 'TL');
      assert.equal(receivedPayload.test_mode, '1');
      assert.equal(
        receivedPayload.paytr_token,
        paytrToken(receivedPayload, process.env.PAYTR_MERCHANT_KEY, process.env.PAYTR_MERCHANT_SALT)
      );
      assert.equal(createdPayment.expectedAmountMinor, 24900);
      assert.equal(createdPayment.subscriptionType, 'monthly');
      assert.equal(createdPayment.status, 'pending');
      assert.equal(createdPayment.userId, user._id);
      assert.equal('cardNumber' in createdPayment, false);
      assert.equal('cvv' in createdPayment, false);
    });
  } finally {
    restoreEnvironment();
  }
});

test('invalid plans and unauthenticated requests cannot start checkout', async () => {
  const restoreEnvironment = setSandboxEnvironment();
  let databaseLookups = 0;
  let providerCalls = 0;
  const router = createPaymentRouter({
    UserModel: fakeUserModel({ _id: 'student-id', role: 'student' }, () => databaseLookups++),
    PaymentModel: { create: async () => { throw new Error('unexpected payment creation'); } },
    fetchImpl: async () => { providerCalls++; }
  });

  try {
    await withPaymentServer(router, { id: 'student-id', role: 'student' }, async baseUrl => {
      const invalid = await fetch(`${baseUrl}/paytr/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'custom', amount: 1 })
      });
      assert.equal(invalid.status, 400);
      assert.equal(databaseLookups, 0);
      assert.equal(providerCalls, 0);
    });
    await withPaymentServer(router, null, async baseUrl => {
      const anonymous = await fetch(`${baseUrl}/paytr/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'temel' })
      });
      assert.equal(anonymous.status, 401);
    });
  } finally {
    restoreEnvironment();
  }
});

test('provider token failure closes the pending payment and returns an error', async () => {
  const restoreEnvironment = setSandboxEnvironment();
  const user = {
    _id: 'student-id',
    role: 'student',
    name: 'Test Student',
    email: 'student@example.com'
  };
  let createdPayment;
  const router = createPaymentRouter({
    UserModel: fakeUserModel(user),
    PaymentModel: {
      create: async payment => {
        createdPayment = { ...payment, save: async function () {} };
        return createdPayment;
      }
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'failed', reason: 'sandbox credentials invalid' })
    })
  });

  try {
    await withPaymentServer(router, { id: 'student-id', role: 'student' }, async baseUrl => {
      const response = await fetch(`${baseUrl}/paytr/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'standart' })
      });
      assert.equal(response.status, 502);
      assert.equal(createdPayment.status, 'failed');
    });
  } finally {
    restoreEnvironment();
  }
});

test('PayTR token helper matches the documented HMAC format', () => {
  const payload = {
    merchant_id: '123456',
    user_ip: '203.0.113.10',
    merchant_oid: 'ZC123',
    email: 'student@example.com',
    payment_amount: '24900',
    user_basket: 'W1siVGVzdCIsIjI0OS4wMCIsMV1d',
    no_installment: '1',
    max_installment: '0',
    currency: 'TL',
    test_mode: '1'
  };
  const data = Object.values(payload).join('') + 'sandbox-salt';
  const expected = crypto.createHmac('sha256', 'sandbox-key')
    .update(data)
    .digest('base64');
  assert.equal(paytrToken(payload, 'sandbox-key', 'sandbox-salt'), expected);
});
