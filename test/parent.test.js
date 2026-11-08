const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const {createParentRouter} = require('../routes/parent');

function withParentApi(sessionUser, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = {user: sessionUser};
    next();
  });
  const calls = {chatUserId: null, reportStudentId: null};
  app.use('/api/parent', createParentRouter({
    requireParent: (req, res, next) => {
      if (!req.session.user) return res.status(401).json({mesaj: 'Giriş yapmanız gerekiyor.'});
      if (req.session.user.role !== 'parent') return res.status(403).json({mesaj: 'Yetkisiz.'});
      next();
    },
    requireReportAccess: (req, res, next) => {
      if (!req.session.user) return res.status(401).json({mesaj: 'Giriş yapmanız gerekiyor.'});
      if (!['parent', 'admin'].includes(req.session.user.role)) return res.status(403).json({mesaj: 'Yetkisiz.'});
      next();
    },
    ParentModel: {
      findById: id => ({
        select: () => ({
          lean: async () => id === 'parent-1'
            ? {studentId: 'student-1', restricted: false}
            : null
        })
      })
    },
    UserModel: {
      findOne: query => ({
        select: () => ({
          lean: async () => {
            calls.reportStudentId = query._id;
            assert.equal(String(query._id), 'student-1');
            assert.equal(query.role, 'student');
            return {_id: 'student-1', name: 'Deniz Ada', role: 'student'};
          }
        })
      })
    },
    ChatMessageModel: {
      find: query => {
        calls.chatUserId = query.userId;
        const records = [
          {roomName: 'assistant', sender: 'user', message: 'Kesir nedir?', createdAt: new Date('2026-11-06T10:00:00Z')},
          {roomName: 'assistant', sender: 'ai', message: 'Birlikte bir ipucu bulalım.', createdAt: new Date('2026-11-06T10:01:00Z')},
          {roomName: 'meeting-123', sender: 'user', message: 'Bu canlı derste soru.', createdAt: new Date('2026-11-07T10:00:00Z')}
        ];
        let sorted = records;
        const cursor = {
          sort: () => { sorted = [...records].reverse(); return cursor; },
          limit: () => cursor,
          select: () => cursor,
          lean: () => cursor,
          exec: async () => sorted
        };
        assert.equal(query.userId, 'student-1');
        return cursor;
      }
    },
    LessonAttendanceModel: {
      find: query => {
        assert.equal(query.studentId, 'student-1');
        const cursor = {
          sort: () => cursor,
          limit: () => cursor,
          lean: () => cursor,
          exec: async () => [{
            meetingId: 'meeting-123',
            title: 'Kesirler',
            firstJoinedAt: new Date('2026-11-07T09:50:00Z'),
            lastJoinedAt: new Date('2026-11-07T10:00:00Z'),
            joinCount: 1
          }]
        };
        return cursor;
      }
    },
    getStudentCollection: () => ({
      findOne: async query => {
        assert.equal(query.linkedUserId, 'student-1');
        return {grade: 7, section: 'A'};
      }
    }),
    service: {
      getParentReport: async studentId => ({
        status: 200,
        data: {student_id: studentId, completed_assignments: 2, average_success_percent: 75}
      })
    }
  }));
  const server = app.listen(0);
  return new Promise((resolve, reject) => {
    server.once('listening', async () => {
      try {
        await callback(`http://127.0.0.1:${server.address().port}`, calls);
        server.close(() => resolve());
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

test('parent dashboard only reads the linked student and returns a bounded progress summary', async () => {
  await withParentApi({id: 'parent-1', role: 'parent'}, async (base, calls) => {
    const response = await fetch(`${base}/api/parent/dashboard`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const result = await response.json();
    assert.equal(calls.chatUserId, 'student-1');
    assert.deepEqual(result.student, {name: 'Deniz Ada', grade: 7, section: 'A'});
    assert.deepEqual(result.summary, {
      messageCount: 3,
      questionCount: 2,
      aiResponseCount: 1,
      hintCount: 1,
      lastActivityAt: '2026-11-07T10:00:00.000Z',
      liveLessonCount: 1
    });
    assert.equal(result.liveLessons[0].meetingId, 'meeting-123');
    assert.equal(result.liveLessons[0].title, 'Kesirler');
    assert.equal(result.liveLessons[0].joinCount, 1);
    assert.equal(result.recentMessages.length, 3);
    assert.equal(result.recentMessages[1].isHint, true);
  });
});

test('student sessions cannot call the parent dashboard', async () => {
  await withParentApi({id: 'student-1', role: 'student'}, async base => {
    const response = await fetch(`${base}/api/parent/dashboard`);
    assert.equal(response.status, 403);
  });
});

test('parent report always uses the linked student, ignoring a supplied student ID', async () => {
  await withParentApi({id: 'parent-1', role: 'parent'}, async (base, calls) => {
    const response = await fetch(`${base}/api/parent/report?student_id=aaaaaaaaaaaaaaaaaaaaaaaa`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(calls.reportStudentId, 'student-1');
    assert.equal((await response.json()).student_id, 'student-1');
  });
});

test('admin report requires an explicit valid student ID', async () => {
  await withParentApi({id: 'admin-1', role: 'admin'}, async base => {
    const response = await fetch(`${base}/api/parent/report`);
    assert.equal(response.status, 400);
  });
});
