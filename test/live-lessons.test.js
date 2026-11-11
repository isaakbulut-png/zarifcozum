const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { ObjectId } = require('mongodb');
const { createLiveLessonsRouter } = require('../routes/live-lessons');
const { ZOOM_HOST_USER_ID } = require('../lib/zoom');

function same(left, right) {
  return String(left) === String(right);
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => value && value.$in
    ? value.$in.some(item => same(document[key], item))
    : same(document[key], value));
}

function collection() {
  const rows = [];
  return {
    rows,
    find(filter) {
      let found = rows.filter(row => matches(row, filter));
      const cursor = {
        sort() { return cursor; },
        limit(count) { found = found.slice(0, count); return cursor; },
        toArray: async () => found
      };
      return cursor;
    },
    async findOne(filter) { return rows.find(row => matches(row, filter)) || null; },
    async insertOne(document) {
      const insertedId = new ObjectId();
      rows.push({...document, _id: insertedId});
      return {insertedId};
    },
    async updateOne(filter, update, options = {}) {
      let row = rows.find(item => matches(item, filter));
      if (!row && options.upsert) {
        row = {...filter};
        rows.push(row);
      }
      if (!row) return {matchedCount: 0};
      Object.assign(row, update.$set || {});
      return {matchedCount: 1};
    },
    async deleteOne(filter) {
      const index = rows.findIndex(item => matches(item, filter));
      if (index < 0) return {deletedCount: 0};
      rows.splice(index, 1);
      return {deletedCount: 1};
    }
  };
}

async function setup(endMeeting = async () => {}) {
  const scheduled = collection();
  const active = collection();
  const students = collection();
  students.rows.push({
    _id: new ObjectId('507f1f77bcf86cd799439011'), teacherId: 'teacher-1',
    linkedUserId: 'teacher-1', grade: 6, section: 'A', active: true
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.get('x-role');
    req.session = {
      user: role ? {id: req.get('x-user') || 'teacher-1', role} : undefined
    };
    next();
  });
  const roleGuard = role => (req, res, next) => {
    if (req.session.user?.role !== role) return res.status(req.session.user ? 403 : 401).json({mesaj: 'Yetkisiz.'});
    next();
  };
  app.use(createLiveLessonsRouter({
    requireTeacher: roleGuard('teacher'),
    requireStudent: roleGuard('student'),
    getScheduledCollection: () => scheduled,
    getActiveCollection: () => active,
    getStudentCollection: () => students,
    createMeeting: async options => ({
      id: 'meeting-123',
      topic: options.topic,
      startTime: options.startTime?.toISOString(),
      duration: options.duration,
      joinUrl: 'https://zoom.example/join',
      startUrl: 'https://zoom.example/start',
      password: 'pass'
    }),
    getHostStartUrl: async () => 'https://zoom.example/start',
    endMeeting
  }));
  const server = await new Promise(resolve => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    scheduled,
    active,
    students,
    async request(path, role, method = 'GET', body, userId) {
      const requestHeaders = {'Content-Type': 'application/json'};
      if (role) requestHeaders['x-role'] = role;
      if (userId) requestHeaders['x-user'] = userId;
      const response = await fetch(base + path, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      return {response, data: await response.json()};
    },
    close: () => new Promise(resolve => server.close(resolve))
  };
}

const classAudience = {grade: 6, section: 'A', mode: 'class', studentIds: []};

test('Zoom toplantısı bulunamadığında yalnız açık onayla aynı dersin kaydı temizlenir', async () => {
  let calls = 0;
  const app = await setup(async () => {
    calls++;
    throw Object.assign(new Error('Meeting does not exist'), {zoomStatus: 404});
  });
  try {
    const lessonId = new ObjectId();
    app.scheduled.rows.push({_id: lessonId, status: 'active'});
    app.active.rows.push({
      _id: 'aktif', meetingId: 'meeting-123', scheduledLessonId: lessonId,
      expiresAt: new Date(Date.now() + 60_000)
    });

    const first = await app.request('/api/ogretmen/canli/sonlandir', 'teacher', 'POST');
    assert.equal(first.response.status, 409);
    assert.equal(first.data.kod, 'ZOOM_MEETING_NOT_FOUND');
    assert.equal(first.data.meetingId, 'meeting-123');
    assert.equal(app.active.rows.length, 1);
    assert.equal(app.scheduled.rows[0].status, 'active');

    const wrongMeeting = await app.request('/api/ogretmen/canli/sonlandir', 'teacher', 'POST', {
      zoomdaBittiginiOnayliyorum: true, meetingId: 'different'
    });
    assert.equal(wrongMeeting.response.status, 409);
    assert.equal(calls, 1);
    assert.equal(app.active.rows.length, 1);

    const confirmed = await app.request('/api/ogretmen/canli/sonlandir', 'teacher', 'POST', {
      zoomdaBittiginiOnayliyorum: true, meetingId: 'meeting-123'
    });
    assert.equal(confirmed.response.status, 200);
    assert.match(confirmed.data.mesaj, /Sitedeki aktif ders kaydı/);
    assert.equal(calls, 2);
    assert.equal(app.active.rows.length, 0);
    assert.equal(app.scheduled.rows[0].status, 'completed');
  } finally {
    await app.close();
  }
});

test('onay verilse bile diğer Zoom hatalarında aktif ders kaydı korunur', async () => {
  const app = await setup(async () => {
    throw Object.assign(new Error('Zoom bağlantı hatası'), {status: 502, zoomStatus: 503});
  });
  try {
    app.active.rows.push({
      _id: 'aktif', meetingId: 'meeting-123', expiresAt: new Date(Date.now() + 60_000)
    });
    const response = await app.request('/api/ogretmen/canli/sonlandir', 'teacher', 'POST', {
      zoomdaBittiginiOnayliyorum: true, meetingId: 'meeting-123'
    });
    assert.equal(response.response.status, 502);
    assert.equal(app.active.rows.length, 1);
  } finally {
    await app.close();
  }
});

test('scheduled Zoom lesson waits until its time and is joinable only after teacher starts it', async () => {
  const app = await setup();
  try {
    const startsAt = new Date(Date.now() + 60_000);
    const created = await app.request('/api/ogretmen/canli/planla', 'teacher', 'POST', {
      title: 'Kesirler canlı ders',
      startsAt: startsAt.toISOString(),
      duration: 45,
      audience: classAudience
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.ders.status, 'scheduled');
    assert.equal(created.data.ders.title, 'Kesirler canlı ders');
    assert.equal(app.scheduled.rows[0].hostUserId, ZOOM_HOST_USER_ID);

    const listed = await app.request('/api/ogretmen/canli/planlar', 'teacher');
    assert.equal(listed.response.status, 200);
    assert.equal(listed.data.dersler[0].id, created.data.ders.id);
    assert.equal('joinUrl' in listed.data.dersler[0], false);
    assert.equal('password' in listed.data.dersler[0], false);

    const waiting = await app.request('/api/canli/katilim', 'student');
    assert.equal(waiting.response.status, 404);
    const tooEarly = await app.request(
      `/api/ogretmen/canli/planlar/${created.data.ders.id}/baslat`,
      'teacher',
      'POST'
    );
    assert.equal(tooEarly.response.status, 409);

    app.scheduled.rows[0].startsAt = new Date(Date.now() - 1000);
    const started = await app.request(
      `/api/ogretmen/canli/planlar/${created.data.ders.id}/baslat`,
      'teacher',
      'POST'
    );
    assert.equal(started.response.status, 200);
    assert.equal(started.data.startUrl, 'https://zoom.example/start');
    assert.equal(app.active.rows[0].hostUserId, ZOOM_HOST_USER_ID);
    assert.deepEqual(app.active.rows[0].audience, classAudience);
    assert.equal(app.active.rows[0].createdBy, 'teacher-1');

    const joined = await app.request('/api/canli/katilim', 'student');
    assert.equal(joined.response.status, 200);
    assert.equal(joined.data.topic, 'Kesirler canlı ders');

    const ended = await app.request('/api/ogretmen/canli/sonlandir', 'teacher', 'POST');
    assert.equal(ended.response.status, 200);
    assert.equal(app.scheduled.rows[0].status, 'completed');
    assert.equal((await app.request('/api/canli/katilim', 'student')).response.status, 404);
  } finally {
    await app.close();
  }
});

test('teacher can start an immediate lesson and students can join it', async () => {
  const app = await setup();
  try {
    const empty = await app.request('/api/ogretmen/canli/ozet', 'teacher');
    assert.deepEqual(empty.data, { aktif: false });
    const forbidden = await app.request('/api/ogretmen/canli/ozet', 'student');
    assert.equal(forbidden.response.status, 403);
    const started = await app.request('/api/ogretmen/canli/baslat', 'teacher', 'POST', {
      topic: 'Anında canlı ders',
      audience: classAudience
    });
    assert.equal(started.response.status, 201);
    assert.equal(started.data.startUrl, 'https://zoom.example/start');
    assert.equal(app.active.rows[0].hostUserId, ZOOM_HOST_USER_ID);
    const summary = await app.request('/api/ogretmen/canli/ozet', 'teacher');
    assert.deepEqual(summary.data, {
      aktif: true, topic: 'Anında canlı ders', meetingNumber: 'meeting-123'
    });

    const joined = await app.request('/api/canli/katilim', 'student');
    assert.equal(joined.response.status, 200);
    assert.equal(joined.data.topic, 'Anında canlı ders');
    assert.equal(joined.data.joinUrl, 'https://zoom.example/join');
  } finally {
    await app.close();
  }
});

test('scheduled live lessons require a future time and can only be started by their teacher', async () => {
  const app = await setup();
  try {
    const invalid = await app.request('/api/ogretmen/canli/planla', 'teacher', 'POST', {
      title: 'Geçmiş ders',
      startsAt: new Date(Date.now() - 1000).toISOString(),
      duration: 45
    });
    assert.equal(invalid.response.status, 400);

    const created = await app.request('/api/ogretmen/canli/planla', 'teacher', 'POST', {
      title: 'Öğretmen dersi',
      startsAt: new Date(Date.now() + 60_000).toISOString(),
      duration: 60,
      audience: classAudience
    });
    const otherTeacher = await app.request(
      `/api/ogretmen/canli/planlar/${created.data.ders.id}/baslat`,
      'teacher',
      'POST',
      undefined,
      'teacher-2'
    );
    assert.equal(otherTeacher.response.status, 404);

    const anonymous = await app.request('/api/ogretmen/canli/planla', undefined, 'POST', {
      title: 'Yetkisiz',
      startsAt: new Date(Date.now() + 60_000).toISOString(),
      duration: 60
    });
    assert.equal(anonymous.response.status, 401);
  } finally {
    await app.close();
  }
});

test('hedef sınıf ve seçilen öğrenciler doğrulanır ve yetkisiz öğrenci katılamaz', async () => {
  const app = await setup();
  try {
    const first = app.students.rows[0];
    app.students.rows.push({
      _id: new ObjectId('507f1f77bcf86cd799439012'), teacherId: 'teacher-1',
      linkedUserId: 'student-2', grade: 6, section: 'A', active: true
    });
    app.students.rows.push({
      _id: new ObjectId('507f1f77bcf86cd799439014'), teacherId: 'teacher-2',
      linkedUserId: 'student-4', grade: 6, section: 'A', active: true
    });
    const audience = {...classAudience, mode: 'students', studentIds: [String(first._id)]};
    const invalid = await app.request('/api/ogretmen/canli/baslat', 'teacher', 'POST', {
      topic: 'Ders', audience: {...audience, studentIds: ['507f1f77bcf86cd799439014']}
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(app.active.rows.length, 0);
    const started = await app.request('/api/ogretmen/canli/baslat', 'teacher', 'POST', {
      topic: 'Ders', audience
    });
    assert.equal(started.response.status, 201);
    assert.equal((await app.request('/api/canli/katilim', 'student')).response.status, 200);
    const denied = await app.request('/api/canli/katilim', 'student', 'GET', undefined, 'student-2');
    assert.equal(denied.response.status, 404);
    assert.equal(denied.data.joinUrl, undefined);
    first.active = false;
    assert.equal((await app.request('/api/canli/katilim', 'student')).response.status, 404);
  } finally {
    await app.close();
  }
});

test('sınıf hedefi güncel öğrenci kayıtlarını kullanır ve eski hedefsiz dersler gizlenir', async () => {
  const app = await setup();
  try {
    app.active.rows.push({
      _id: 'aktif', meetingId: 'legacy', expiresAt: new Date(Date.now() + 60_000)
    });

    assert.equal((await app.request('/api/canli/katilim', 'student')).response.status, 404);
    app.active.rows.length = 0;
    const started = await app.request('/api/ogretmen/canli/baslat', 'teacher', 'POST', {
      topic: 'Sınıf dersi', audience: classAudience
    });
    assert.equal(started.response.status, 201);
    app.students.rows.push({
      _id: new ObjectId('507f1f77bcf86cd799439013'), teacherId: 'teacher-1',
      linkedUserId: 'student-3', grade: 6, section: 'A', active: true
    });
    assert.equal((await app.request('/api/canli/katilim', 'student', 'GET', undefined, 'student-3')).response.status, 200);
    app.students.rows[1].section = 'B';
    assert.equal((await app.request('/api/canli/katilim', 'student', 'GET', undefined, 'student-3')).response.status, 404);
  } finally {
    await app.close();
  }
});

test('hedefi olmayan eski planlı ders başlatılmaz', async () => {
  const app = await setup();
  try {
    const id = new ObjectId();
    app.scheduled.rows.push({
      _id: id, kind: 'live', createdBy: 'teacher-1',
      status: 'scheduled', startsAt: new Date(Date.now() - 1000)
    });
    const result = await app.request(`/api/ogretmen/canli/planlar/${id}/baslat`, 'teacher', 'POST');
    assert.equal(result.response.status, 409);
    assert.match(result.data.mesaj, /hedef kitlesi yok/);
    assert.equal(app.active.rows.length, 0);
  } finally {
    await app.close();
  }
});
