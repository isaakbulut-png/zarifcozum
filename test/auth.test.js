const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const test = require('node:test');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { router } = require('../routes/auth');

function withServer(sessionUser, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: sessionUser };
    next();
  });
  app.use(router);
  const server = app.listen(0);
  return new Promise((resolve, reject) => {
    server.once('listening', async () => {
      try {
        await callback(`http://127.0.0.1:${server.address().port}`);
        server.close(() => resolve());
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

function stub(target, name, value) {
  const original = target[name];
  target[name] = value;
  return () => { target[name] = original; };
}

const post = body => ({
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(body)
});

test('Google client config exposes only its public client ID', async () => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'public-client-id';
  try {
    await withServer(undefined, async base => {
      const response = await fetch(`${base}/auth/config`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {googleClientId: 'public-client-id'});
      assert.equal(response.headers.get('cache-control'), 'no-store');
    });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previous;
  }
});

test('password change requires a session, verifies an existing password and updates it', async () => {
  await withServer(undefined, async base => {
    const response = await fetch(`${base}/change-password`, post({
      password: 'a-new-password',
      passwordConfirmation: 'a-new-password'
    }));
    assert.equal(response.status, 401);
  });

  const user = {
    passwordHash: 'old-hash',
    resetPasswordToken: 'old-token',
    resetPasswordExpires: new Date(),
    verifyPassword: async value => value === 'correct-current',
    setPassword: async value => { user.passwordHash = `hash:${value}`; },
    save: async () => {}
  };
  const restore = stub(User, 'findById', () => ({select: async () => user}));
  try {
    await withServer({id: 'student-1', role: 'student'}, async base => {
      const invalid = await fetch(`${base}/change-password`, post({
        currentPassword: 'wrong-current',
        password: 'a-new-password',
        passwordConfirmation: 'a-new-password'
      }));
      assert.equal(invalid.status, 400);

      const response = await fetch(`${base}/change-password`, post({
        currentPassword: 'correct-current',
        password: 'a-new-password',
        passwordConfirmation: 'a-new-password'
      }));
      assert.equal(response.status, 200);
      assert.equal(user.passwordHash, 'hash:a-new-password');
      assert.equal(user.resetPasswordToken, undefined);
      assert.equal(user.resetPasswordExpires, undefined);
    });
  } finally {
    restore();
  }
});

test('Google-only accounts can set a password from their authenticated session', async () => {
  const user = {
    passwordHash: undefined,
    setPassword: async value => { user.passwordHash = `hash:${value}`; },
    save: async () => {}
  };
  const restore = stub(User, 'findById', () => ({select: async () => user}));
  try {
    await withServer({id: 'google-student-1', role: 'student'}, async base => {
      const response = await fetch(`${base}/change-password`, post({
        password: 'a-new-password',
        passwordConfirmation: 'a-new-password'
      }));
      assert.equal(response.status, 200);
      assert.equal(user.passwordHash, 'hash:a-new-password');
    });
  } finally {
    restore();
  }
});

test('password reset consumes a matching one-time token', async () => {
  const token = 'a'.repeat(64);
  const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = {
    resetPasswordToken: expectedHash,
    resetPasswordExpires: new Date(Date.now() + 60_000),
    setPassword: async value => { user.passwordHash = `hash:${value}`; },
    save: async () => {}
  };
  const restore = stub(User, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.resetPasswordToken, expectedHash);
    assert.ok(filter.resetPasswordExpires.$gt instanceof Date);
    assert.equal(typeof update.$set.passwordHash, 'string');
    assert.deepEqual(update.$unset, {resetPasswordToken: 1, resetPasswordExpires: 1});
    assert.equal(options.new, true);
    user.passwordHash = update.$set.passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    return user;
  });
  try {
    await withServer(undefined, async base => {
      const response = await fetch(`${base}/reset-password`, post({
        email: 'student@example.com',
        token,
        password: 'a-new-password',
        passwordConfirmation: 'a-new-password'
      }));
      assert.equal(response.status, 200);
      assert.equal(await User.prototype.verifyPassword.call(user, 'a-new-password'), true);
      assert.equal(user.resetPasswordToken, undefined);
      assert.equal(user.resetPasswordExpires, undefined);
    });
  } finally {
    restore();
  }
});

test('password reset emails use hashed, expiring tokens without revealing account existence', async () => {
  const env = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    APP_BASE_URL: process.env.APP_BASE_URL
  };
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer',
    SMTP_PASSWORD: 'mail-password',
    SMTP_FROM: 'ZarifCozum <noreply@example.test>',
    APP_BASE_URL: 'https://zarifcozum.example'
  });

  let knownAccount = true;
  let sentMessage;
  const user = {
    resetPasswordToken: undefined,
    resetPasswordExpires: undefined,
    save: async () => {}
  };
  const restoreFind = stub(User, 'findOne', async () => knownAccount ? user : null);
  const restoreTransport = stub(nodemailer, 'createTransport', () => ({
    sendMail: async message => { sentMessage = message; }
  }));
  try {
    await withServer(undefined, async base => {
      const request = () => fetch(`${base}/forgot-password`, post({email: 'student@example.com'}));
      const knownResponse = await request();
      assert.equal(knownResponse.status, 200);
      const knownBody = await knownResponse.json();
      const emailedUrl = new URL(sentMessage.text.split(': ').pop());
      const token = emailedUrl.searchParams.get('token');
      assert.equal(emailedUrl.origin, 'https://zarifcozum.example');
      assert.equal(emailedUrl.searchParams.get('mode'), 'reset');
      assert.equal(user.resetPasswordToken, crypto.createHash('sha256').update(token).digest('hex'));
      assert.ok(user.resetPasswordExpires > new Date());

      sentMessage = undefined;
      knownAccount = false;
      const unknownResponse = await request();
      assert.equal(unknownResponse.status, 200);
      assert.deepEqual(await unknownResponse.json(), knownBody);
      assert.equal(sentMessage, undefined);
    });
  } finally {
    restoreFind();
    restoreTransport();
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
