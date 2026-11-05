const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createAdminRouter } = require('../routes/admin');
const { DEFAULT_VISITOR_SETTINGS } = require('../models/SystemConfig');

function fakeQuery(rows) {
  const query = {
    select: () => query, sort: () => query, skip: () => query, limit: () => query,
    populate: () => query, lean: async () => rows
  };
  return query;
}

function buildRouter(announcements = [], visitorSettings = { ...DEFAULT_VISITOR_SETTINGS }) {
  const filters = [];
  const User = {
    countDocuments: async () => 3,
    findById: id => ({
      select: async () => ({
        _id: { toString: () => id }, name: 'Admin', email: 'admin@example.com',
        role: id === 'teacher' || id === '2' ? 'teacher'
          : id === 'student' || id === '1' ? 'student' : 'admin',
        adminRole: id === 'teacher' ? 'editor' : id === 'support' ? 'support' : undefined,
        save: async function () { return this; }
      })
    }),
    find: filter => {
      filters.push(filter);
      return fakeQuery([{ _id: { toString: () => 'u1' }, name: 'Ada', email: 'ada@example.com', role: 'student', createdAt: new Date() }]);
    }
  };
  const Payment = { countDocuments: async () => 1, find: () => fakeQuery([]) };
  const collection = {
    countDocuments: async () => announcements.length,
    insertOne: async doc => { announcements.push(doc); return { insertedId: 'a1' }; }
  };
  const SystemConfig = {
    getVisitorSettings: async () => ({ ...visitorSettings }),
    saveVisitorSettings: async updates => Object.assign(visitorSettings, updates)
  };
  const AdminLog = {
    create: async doc => ({ _id: { toString: () => 'log1' }, ...doc }),
    find: () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [] })
  };
  const listCollection = docs => ({
    find: () => ({
      project() { return this; }, sort() { return this; }, limit() { return this; },
      toArray: async () => docs
    })
  });
  return {
    filters,
    router: createAdminRouter({
      User, Payment, SystemConfig, AdminLog,
      getAnnouncementCollection: () => collection,
      getQuizCollection: () => listCollection([]),
      getLessonCollection: () => listCollection([]),
      getSupportTicketCollection: () => listCollection([])
    })
  };
}

function withServer(router, sessionUser, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: sessionUser }; next(); });
  app.use('/api/admin', router);
  const server = app.listen(0);
  return new Promise((resolve, reject) => {
    server.once('listening', async () => {
      try {
        await callback(`http://127.0.0.1:${server.address().port}/api/admin`);
        server.close(() => resolve());
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

test('admin API rejects anonymous, student and teacher sessions', async () => {
  for (const user of [undefined, { id: 'student', role: 'student' }, { id: 'teacher', role: 'teacher' }]) {
    await withServer(buildRouter().router, user, async base => {
      const response = await fetch(`${base}/overview`);
      assert.equal(response.status, user ? 403 : 401);
    });
  }
});

test('admin can read overview and escaped user search', async () => {
  const { router, filters } = buildRouter();
  await withServer(router, { id: 'admin', role: 'admin' }, async base => {
    const overview = await (await fetch(`${base}/overview`)).json();
    assert.equal(overview.students, 3);

    const response = await fetch(`${base}/users?q=${encodeURIComponent('.*(')}&role=student`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).users[0].email, 'ada@example.com');
    assert.equal(filters[0].role, 'student');
    assert.equal(filters[0].$or[0].name.source, '\\.\\*\\(');
  });
});

test('admin can publish announcements and validates input', async () => {
  const announcements = [];
  await withServer(buildRouter(announcements).router, { id: 'admin', role: 'admin' }, async base => {
    const post = body => fetch(`${base}/announcements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({ message: '  ' })).status, 400);
    assert.equal((await post({ message: 'Merhaba' })).status, 201);
    assert.equal(announcements[0].message, 'Merhaba');
    assert.equal(announcements[0].createdBy, 'admin');
  });
});

test('admin can read and update visitor access settings with validation', async () => {
  const settings = { ...DEFAULT_VISITOR_SETTINGS };
  await withServer(buildRouter([], settings).router, { id: 'admin', role: 'admin' }, async base => {
    const read = await fetch(`${base}/settings`);
    assert.equal(read.status, 200);
    assert.deepEqual((await read.json()).ziyaretciHaklari, DEFAULT_VISITOR_SETTINGS);

    const post = body => fetch(`${base}/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({ ziyaretciHaklari: { questionLimit: 501 } })).status, 400);
    assert.equal((await post({ ziyaretciHaklari: { fullTestEnabled: 'true' } })).status, 400);
    assert.equal((await post({ ziyaretciHaklari: { unknown: true } })).status, 400);

    const saved = await post({ ziyaretciHaklari: { questionLimit: 8, fullTestEnabled: true } });
    assert.equal(saved.status, 200);
    assert.equal(settings.questionLimit, 8);
    assert.equal(settings.fullTestEnabled, true);
    assert.equal(settings.topicLimit, DEFAULT_VISITOR_SETTINGS.topicLimit);
  });
});

test('editor and support roles are restricted to their allowed admin sections', async () => {
  const router = buildRouter().router;
  await withServer(router, { id: 'teacher', role: 'teacher', adminRole: 'editor' }, async base => {
    assert.equal((await fetch(`${base}/education/quizzes`)).status, 200);
    assert.equal((await fetch(`${base}/overview`)).status, 403);
    assert.equal((await fetch(`${base}/settings`)).status, 403);
    assert.equal((await fetch(`${base}/logs`)).status, 403);
  });
  await withServer(router, { id: 'support', role: 'admin', adminRole: 'support' }, async base => {
    const overviewResponse = await fetch(`${base}/overview`);
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json();
    assert.equal('paidPayments' in overview, false);
    assert.equal('activeSubs' in overview, false);
    assert.equal((await fetch(`${base}/users`)).status, 200);
    assert.equal((await fetch(`${base}/support/tickets`)).status, 200);
    assert.equal((await fetch(`${base}/payments`)).status, 403);
    assert.equal((await fetch(`${base}/education/quizzes`)).status, 403);
    assert.equal((await fetch(`${base}/logs`)).status, 403);
  });
});
