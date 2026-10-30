const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createAdminRouter } = require('../routes/admin');
const { requireRole } = require('../routes/auth');

function fakeQuery(rows) {
  const query = {
    select: () => query, sort: () => query, skip: () => query, limit: () => query,
    populate: () => query, lean: async () => rows
  };
  return query;
}

function buildRouter(announcements = []) {
  const filters = [];
  const User = {
    countDocuments: async () => 3,
    find: filter => { filters.push(filter); return fakeQuery([{ _id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'student' }]); }
  };
  const Payment = { countDocuments: async () => 1, find: () => fakeQuery([]) };
  const collection = {
    countDocuments: async () => announcements.length,
    insertOne: async doc => { announcements.push(doc); return { insertedId: 'a1' }; }
  };
  return {
    filters,
    router: createAdminRouter({
      requireAdmin: requireRole('admin'), User, Payment, getAnnouncementCollection: () => collection
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
  for (const user of [undefined, { id: '1', role: 'student' }, { id: '2', role: 'teacher' }]) {
    await withServer(buildRouter().router, user, async base => {
      const response = await fetch(`${base}/overview`);
      assert.equal(response.status, user ? 403 : 401);
    });
  }
});

test('admin can read overview and escaped user search', async () => {
  const { router, filters } = buildRouter();
  await withServer(router, { id: '9', role: 'admin' }, async base => {
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
  await withServer(buildRouter(announcements).router, { id: '9', role: 'admin' }, async base => {
    const post = body => fetch(`${base}/announcements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({ message: '  ' })).status, 400);
    assert.equal((await post({ message: 'Merhaba' })).status, 201);
    assert.equal(announcements[0].message, 'Merhaba');
    assert.equal(announcements[0].createdBy, '9');
  });
});
