const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const test = require('node:test');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Parent = require('../models/Parent');
const SystemConfig = require('../models/SystemConfig');
const { createRequireRole, redirectForRole, router } = require('../routes/auth');

function withServer(sessionUser, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = {
      user: sessionUser,
      regenerate(callback) { this.user = undefined; callback(); },
      save(callback) { callback(); },
      destroy(callback) { callback(); }
    };
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

test('role redirects keep editor teachers in the teacher panel', () => {
  assert.equal(redirectForRole('teacher', 'editor'), '/ogretmen-paneli.html');
  assert.equal(redirectForRole('teacher', null), '/ogretmen-paneli.html');
  assert.equal(redirectForRole('admin', 'support'), '/admin-paneli.html');
  assert.equal(redirectForRole('student', null), '/ogrenci-paneli.html');
  assert.equal(redirectForRole('parent', null), '/veli-panel.html');
});

test('student accounts receive a unique-format six-character parent code', async () => {
  const restore = stub(User, 'exists', async () => null);
  try {
    const student = new User({
      name: 'Deniz',
      email: 'deniz@example.com',
      role: 'student'
    });
    await student.validate();
    assert.match(student.parentConnectionCode, /^[A-Z0-9]{6}$/);
    assert.equal(User.schema.path('parentConnectionCode').options.unique, true);
    assert.equal(User.schema.path('parentConnectionCode').options.select, false);
  } finally {
    restore();
  }
});

test('parent registration validates the connection code and creates a parent session', async () => {
  const student = {_id: {toString: () => 'student-id'}};
  const parent = {
    _id: {toString: () => 'parent-id'},
    name: 'Ayşe',
    surname: 'Yılmaz',
    email: 'ayse@example.com',
    phone: '05551112233'
  };
  const restoreUserFind = stub(User, 'findOne', filter => ({
    select: async () => filter.parentConnectionCode === 'ZRF123' && filter.role === 'student'
      ? student
      : null
  }));
  const restoreParentFind = stub(Parent, 'findOne', () => ({select: async () => null}));
  const restoreCreate = stub(Parent, 'createWithPassword', async (data, password) => {
    assert.deepEqual(data, {
      name: 'Ayşe',
      surname: 'Yılmaz',
      email: 'ayse@example.com',
      phone: '05551112233',
      studentId: student._id
    });
    assert.equal(password, 'parent-password');
    return parent;
  });
  const restoreSettings = stub(SystemConfig, 'getVisitorSettings', async () => ({
    registrationEnabled: true
  }));
  try {
    await withServer(undefined, async base => {
      const invalid = await fetch(`${base}/parent/register`, post({
        name: 'Ayşe',
        surname: 'Yılmaz',
        email: 'ayse@example.com',
        phone: '0555 111 22 33',
        password: 'parent-password',
        passwordConfirmation: 'parent-password',
        parentConnectionCode: 'bad'
      }));
      assert.equal(invalid.status, 400);

      const response = await fetch(`${base}/parent/register`, post({
        name: 'Ayşe',
        surname: 'Yılmaz',
        email: 'ayse@example.com',
        phone: '0555 111 22 33',
        password: 'parent-password',
        passwordConfirmation: 'parent-password',
        parentConnectionCode: 'zrf123'
      }));
      assert.equal(response.status, 201);
      const result = await response.json();
      assert.equal(result.user.role, 'parent');
      assert.equal(result.redirectTo, '/veli-panel.html');
    });
  } finally {
    restoreSettings();
    restoreCreate();
    restoreParentFind();
    restoreUserFind();
  }
});

test('closed registration blocks new password and parent accounts', async () => {
  const restore = stub(SystemConfig, 'getVisitorSettings', async () => ({
    registrationEnabled: false
  }));
  try {
    await withServer(undefined, async base => {
      const student = await fetch(`${base}/register`, post({
        name: 'Deniz',
        email: 'deniz@example.com',
        phone: '05551112233',
        password: 'student-password',
        passwordConfirmation: 'student-password',
        role: 'student'
      }));
      assert.equal(student.status, 403);
      assert.deepEqual(await student.json(), {mesaj: 'Yeni üyelik kayıtları şu anda kapalıdır.'});

      const parent = await fetch(`${base}/parent/register`, post({
        name: 'Ayşe',
        surname: 'Yılmaz',
        email: 'ayse@example.com',
        phone: '05551112233',
        password: 'parent-password',
        passwordConfirmation: 'parent-password',
        parentConnectionCode: 'ZRF123'
      }));
      assert.equal(parent.status, 403);
    });
  } finally {
    restore();
  }
});

test('closed registration blocks new Google accounts but permits existing Google login', async () => {
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restoreSettings = stub(SystemConfig, 'getVisitorSettings', async () => ({
    registrationEnabled: false
  }));
  const restoreVerify = stub(OAuth2Client.prototype, 'verifyIdToken', async () => ({
    getPayload: () => ({
      sub: 'google-subject',
      email: 'student@example.com',
      email_verified: true,
      iss: 'accounts.google.com',
      name: 'Student'
    })
  }));
  let existingUser = null;
  const restoreFindUser = stub(User, 'findOne', filter => ({
    select: async () => filter.googleId && existingUser ? existingUser : null
  }));
  const restoreParentExists = stub(Parent, 'exists', async () => false);
  try {
    await withServer(undefined, async base => {
      const registration = await fetch(`${base}/auth/google`, post({
        credential: 'verified-test-token',
        intent: 'register',
        role: 'student'
      }));
      assert.equal(registration.status, 403);

      existingUser = {
        _id: {toString: () => 'student-id'},
        name: 'Student',
        email: 'student@example.com',
        role: 'student',
        restricted: false
      };
      const login = await fetch(`${base}/auth/google`, post({
        credential: 'verified-test-token',
        intent: 'login'
      }));
      assert.equal(login.status, 200);
      assert.equal((await login.json()).user.id, 'student-id');
    });
  } finally {
    restoreParentExists();
    restoreFindUser();
    restoreVerify();
    restoreSettings();
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
  }
});

test('closed registration does not prevent password login', async () => {
  const restoreSettings = stub(SystemConfig, 'getVisitorSettings', async () => ({
    registrationEnabled: false
  }));
  const user = {
    _id: {toString: () => 'student-id'},
    name: 'Student',
    email: 'student@example.com',
    role: 'student',
    restricted: false,
    verifyPassword: async password => password === 'student-password'
  };
  const restoreFindUser = stub(User, 'findOne', () => ({select: async () => user}));
  try {
    await withServer(undefined, async base => {
      const login = await fetch(`${base}/login`, post({
        email: 'student@example.com',
        password: 'student-password'
      }));
      assert.equal(login.status, 200);
      assert.equal((await login.json()).user.id, 'student-id');
    });
  } finally {
    restoreFindUser();
    restoreSettings();
  }
});

test('parent login uses parent credentials and redirects to the parent panel', async () => {
  const parent = {
    _id: {toString: () => 'parent-id'},
    name: 'Ayşe',
    surname: 'Yılmaz',
    email: 'ayse@example.com',
    role: 'parent',
    restricted: false,
    verifyPassword: async password => password === 'parent-password'
  };
  const restore = stub(Parent, 'findOne', () => ({select: async () => parent}));
  try {
    await withServer(undefined, async base => {
      const response = await fetch(`${base}/parent/login`, post({
        email: 'ayse@example.com',
        password: 'parent-password'
      }));
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.user.role, 'parent');
      assert.equal(result.user.name, 'Ayşe Yılmaz');
      assert.equal(result.redirectTo, '/veli-panel.html');
    });
  } finally {
    restore();
  }
});

test('role guard resolves parent sessions from the Parent collection', async () => {
  let userLookups = 0;
  const guard = createRequireRole({
    findById: () => { userLookups += 1; return {select: async () => null}; }
  }, {
    findById: id => ({
      select: async () => id === 'parent-id'
        ? {_id: {toString: () => id}, name: 'Ayşe', surname: 'Yılmaz', restricted: false}
        : null
    })
  })('parent');
  const req = {session: {user: {id: 'parent-id', role: 'parent'}}};
  let nextCalled = false;
  const res = {
    status() { return this; },
    json(body) { throw new Error(body.mesaj); }
  };
  await guard(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(userLookups, 0);
  assert.equal(req.session.user.name, 'Ayşe Yılmaz');
  assert.equal(req.session.user.role, 'parent');
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
    _id: { toString: () => 'student-1' },
    name: 'Student',
    role: 'student',
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

      const mismatch = await fetch(`${base}/change-password`, post({
        currentPassword: 'correct-current',
        password: 'a-new-password',
        passwordConfirmation: 'a-different-password'
      }));
      assert.equal(mismatch.status, 400);
      assert.deepEqual(await mismatch.json(), {mesaj: 'Aynı şifreyi girmediniz.'});

      const response = await fetch(`${base}/change-password`, post({
        currentPassword: 'correct-current',
        password: 'a-new-password',
        passwordConfirmation: 'a-new-password'
      }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {mesaj: 'Şifre başarı ile değiştirildi.'});
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
    _id: { toString: () => 'google-student-1' },
    name: 'Student',
    role: 'student',
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
  const restoreParentFind = stub(Parent, 'findOne', async () => null);
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
    restoreParentFind();
    restoreTransport();
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
