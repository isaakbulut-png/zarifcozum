const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const {ObjectId} = require('mongodb');
const {createTeacherStudentHomeworkRouters, hashToken} = require('../routes/ogretmen-ogrenci-odev');

function equal(left, right) {
  if (left instanceof Date || right instanceof Date) return new Date(left).getTime() === new Date(right).getTime();
  return String(left) === String(right);
}

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(item => matches(document, item));
    const actual = document[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !ObjectId.isValid(expected)) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === '$in') return value.some(item => equal(actual, item));
        if (operator === '$ne') return !equal(actual, value);
        if (operator === '$nin') return !value.some(item => equal(actual, item));
        if (operator === '$gt') return actual > value;
        if (operator === '$lt') return actual < value;
        if (operator === '$regex') return new RegExp(value, expected.$options || '').test(String(actual || ''));
        if (operator === '$options') return true;
        return false;
      });
    }
    return equal(actual, expected);
  });
}

function memoryCollection() {
  const rows = [];
  return {
    rows,
    find(filter = {}) {
      let found = rows.filter(row => matches(row, filter));
      const cursor = {
        sort(order) {
          found.sort((left, right) => {
            for (const [field, direction] of Object.entries(order)) {
              const a = left[field] instanceof Date ? left[field].getTime() : left[field];
              const b = right[field] instanceof Date ? right[field].getTime() : right[field];
              if (a < b) return -direction;
              if (a > b) return direction;
            }
            return 0;
          });
          return cursor;
        },
        limit(count) { found = found.slice(0, count); return cursor; },
        toArray: async () => found
      };
      return cursor;
    },
    async findOne(filter) { return rows.find(row => matches(row, filter)) || null; },
    async insertOne(document) {
      const insertedId = document._id || new ObjectId();
      rows.push({...document, _id: insertedId});
      return {insertedId};
    },
    async insertMany(documents) {
      for (const document of documents) rows.push({...document, _id: document._id || new ObjectId()});
      return {insertedCount: documents.length};
    },
    async updateOne(filter, update) {
      const row = rows.find(item => matches(item, filter));
      if (!row) return {matchedCount: 0, modifiedCount: 0};
      Object.assign(row, update.$set || {});
      return {matchedCount: 1, modifiedCount: 1};
    },
    async updateMany(filter, update) {
      const found = rows.filter(item => matches(item, filter));
      found.forEach(row => Object.assign(row, update.$set || {}));
      return {matchedCount: found.length, modifiedCount: found.length};
    },
    async deleteOne(filter) {
      const index = rows.findIndex(row => matches(row, filter));
      if (index < 0) return {deletedCount: 0};
      rows.splice(index, 1);
      return {deletedCount: 1};
    },
    async deleteMany(filter) {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index--) {
        if (matches(rows[index], filter)) rows.splice(index, 1);
      }
      return {deletedCount: before - rows.length};
    }
  };
}

function setup() {
  const collections = {
    students: memoryCollection(),
    homeworks: memoryCollection(),
    assignments: memoryCollection(),
    audits: memoryCollection(),
    quizzes: memoryCollection(),
    results: memoryCollection()
  };
  const UserModel = {
    findById: () => ({select: () => ({lean: async () => null})})
  };
  const roleGuard = role => (req, res, next) => {
    if (req.session?.user?.role !== role) return res.status(req.session?.user ? 403 : 401).json({mesaj: 'Yetkisiz.'});
    next();
  };
  const routers = createTeacherStudentHomeworkRouters({
    requireTeacher: roleGuard('teacher'),
    requireStudent: roleGuard('student'),
    UserModel,
    getStudentCollection: () => collections.students,
    getHomeworkCollection: () => collections.homeworks,
    getAssignmentCollection: () => collections.assignments,
    getSubmissionCollection: () => collections.assignments,
    getAuditCollection: () => collections.audits,
    getQuizCollection: () => collections.quizzes,
    getStudentQuizResultsCollection: () => collections.results,
    pointsService: {transaction: operation => operation({}), award: async () => 0}
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.get('x-role');
    const id = req.get('x-user') || 'teacher-1';
    req.session = {user: role ? {id, role} : undefined};
    next();
  });
  app.use('/api/ogretmen', routers.teacher);
  app.use('/api/student', routers.student);
  const server = app.listen(0);
  const base = new Promise(resolve => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)));
  return {collections, base, close: () => new Promise(resolve => server.close(resolve))};
}

function teacherHeaders() {
  return {'x-role': 'teacher', 'x-user': 'teacher-1'};
}

function studentHeaders(id) {
  return {'x-role': 'student', 'x-user': id};
}

function jsonOptions(method, body, headers = {}) {
  return {method, headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)};
}

async function addStudent(base, name, number, section = 'A') {
  const response = await fetch(`${base}/api/ogretmen/ogrenciler`, jsonOptions('POST', {
    firstName: name,
    lastName: 'Öğrenci',
    studentNumber: number,
    grade: 5,
    section
  }, teacherHeaders()));
  return {response, data: await response.json()};
}

async function linkProfile(base, code, id) {
  return fetch(`${base}/api/student/profile/link`, jsonOptions('POST', {invitationCode: code}, studentHeaders(id)));
}

test('student profiles are teacher-scoped and invitation codes are one-time hashed credentials', async () => {
  const workspace = setup();
  try {
    const base = await workspace.base;
    const first = await addStudent(base, 'Ada', '1001');
    assert.equal(first.response.status, 201);
    assert.equal(workspace.collections.students.rows[0].invitationCodeHash, hashToken(first.data.invitationCode));
    assert.notEqual(workspace.collections.students.rows[0].invitationCodeHash, first.data.invitationCode);

    const duplicate = await addStudent(base, 'Başka', '1001');
    assert.equal(duplicate.response.status, 409);
    const anotherTeacherStudent = await fetch(`${base}/api/ogretmen/ogrenciler`, jsonOptions('POST', {
      firstName: 'Ada',
      lastName: 'Öğrenci',
      studentNumber: '1001',
      grade: 5,
      section: 'A'
    }, {'x-role': 'teacher', 'x-user': 'teacher-2'}));
    assert.equal(anotherTeacherStudent.status, 201);
    assert.equal((await fetch(`${base}/api/ogretmen/ogrenciler/${first.data.student.id}`, {
      headers: {'x-role': 'teacher', 'x-user': 'teacher-2'}
    })).status, 404);

    const invitation = await fetch(
      `${base}/api/ogretmen/ogrenciler/${encodeURIComponent(first.data.student.id)}/invitation`,
      {method: 'POST', headers: teacherHeaders()}
    );
    assert.equal(invitation.status, 201);
    const renewed = await invitation.json();
    assert.notEqual(renewed.invitationCode, first.data.invitationCode);
    assert.equal((await linkProfile(base, first.data.invitationCode, 'student-1')).status, 404);
    assert.equal((await linkProfile(base, renewed.invitationCode, 'student-1')).status, 200);
    assert.equal((await linkProfile(base, renewed.invitationCode, 'student-2')).status, 404);
    assert.equal((await fetch(`${base}/api/ogretmen/ogrenciler`, {headers: {'x-role': 'student'}})).status, 403);
  } finally {
    await workspace.close();
  }
});

test('class assignments create individual records and track on-time, late, and reviewed submissions', async () => {
  const workspace = setup();
  try {
    const base = await workspace.base;
    const first = await addStudent(base, 'Ada', '2001');
    const second = await addStudent(base, 'Ece', '2002');
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await fetch(`${base}/api/ogretmen/odevler`, jsonOptions('POST', {
      title: 'Kesirler',
      grade: 5,
      section: 'A',
      dueAt: dueAt.toISOString(),
      topic: 'Kesirler',
      type: 'written',
      description: 'Soruları çözün.'
    }, teacherHeaders()));
    assert.equal(created.status, 201);
    assert.equal(workspace.collections.assignments.rows.length, 2);
    assert.equal((await created.json()).homework.recipientCount, 2);

    const lateStudentId = 'student-late';
    assert.equal((await linkProfile(base, first.data.invitationCode, 'student-ontime')).status, 200);
    assert.equal((await linkProfile(base, second.data.invitationCode, lateStudentId)).status, 200);
    const studentHomework = await fetch(`${base}/api/student/homeworks`, {headers: studentHeaders('student-ontime')});
    const homeworkData = await studentHomework.json();
    const onTimeAssignment = homeworkData.homeworks[0].assignmentId;
    assert.equal(homeworkData.homeworks[0].status, 'Görüntülendi');
    assert.equal((await fetch(`${base}/api/student/homeworks/${onTimeAssignment}/start`, {
      method: 'POST', headers: studentHeaders('student-ontime')
    })).status, 200);
    const submitted = await fetch(`${base}/api/student/homeworks/${onTimeAssignment}/submissions`, {
      method: 'POST',
      headers: {'x-role': 'student', 'x-user': 'student-ontime'},
      body: (() => { const data = new FormData(); data.set('text', 'Çözümlerim hazır.'); return data; })()
    });
    assert.equal(submitted.status, 201);
    assert.equal((await submitted.json()).status, 'Teslim edildi');

    const lateAssignment = workspace.collections.assignments.rows.find(row => String(row.studentProfileId) === second.data.student.id);
    lateAssignment.dueAt = new Date(Date.now() - 60_000);
    const overdueList = await fetch(`${base}/api/student/homeworks`, {headers: studentHeaders(lateStudentId)});
    const overdueData = await overdueList.json();
    assert.equal(overdueData.homeworks[0].status, 'Teslim edilmedi');
    const lateDelivery = await fetch(`${base}/api/student/homeworks/${overdueData.homeworks[0].assignmentId}/submissions`, {
      method: 'POST',
      headers: studentHeaders(lateStudentId),
      body: (() => { const data = new FormData(); data.set('text', 'Geç teslim edilen çalışma.'); return data; })()
    });
    assert.equal(lateDelivery.status, 201);
    assert.equal((await lateDelivery.json()).status, 'Geç teslim');

    const teacherList = await (await fetch(`${base}/api/ogretmen/odevler`, {headers: teacherHeaders()})).json();
    const recipients = teacherList.homework[0].recipients;
    const review = await fetch(`${base}/api/ogretmen/odevler/atamalar/${recipients.find(item => item.status === 'Teslim edildi').assignmentId}/review`, jsonOptions('PATCH', {
      status: 'Kontrol edildi', score: 90, feedback: 'Güzel çalışma.'
    }, teacherHeaders()));
    assert.equal(review.status, 200);
    const detail = await (await fetch(`${base}/api/ogretmen/odevler/${teacherList.homework[0].id}`, {
      headers: teacherHeaders()
    })).json();
    assert.equal(detail.homework.counts['Kontrol edildi'], 1);
    assert.equal(detail.homework.counts['Geç teslim'], 1);
  } finally {
    await workspace.close();
  }
});

test('PDF homework resources and student submission files are private to assigned accounts', async () => {
  const workspace = setup();
  try {
    const base = await workspace.base;
    const createdStudent = await addStudent(base, 'Deniz', '3001');
    await addStudent(base, 'Bora', '3002');
    const assignmentForm = new FormData();
    assignmentForm.set('title', 'PDF çalışma kâğıdı');
    assignmentForm.set('grade', '5');
    assignmentForm.set('section', 'A');
    assignmentForm.set('dueAt', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    assignmentForm.set('topic', 'Kesirler');
    assignmentForm.set('type', 'pdf');
    assignmentForm.set('description', 'PDF dosyasını çözün.');
    assignmentForm.append('studentIds', createdStudent.data.student.id);
    assignmentForm.set('resource', new Blob(['%PDF-1.4\nworksheet'], {type: 'application/pdf'}), 'calisma.pdf');
    const createdHomework = await fetch(`${base}/api/ogretmen/odevler`, {
      method: 'POST', headers: teacherHeaders(), body: assignmentForm
    });
    assert.equal(createdHomework.status, 201);
    const homework = (await createdHomework.json()).homework;
    assert.equal(homework.hasResourceFile, true);
    assert.equal(homework.recipientCount, 1);
    assert.equal((await linkProfile(base, createdStudent.data.invitationCode, 'student-file-owner')).status, 200);
    const task = (await (await fetch(`${base}/api/student/homeworks`, {headers: studentHeaders('student-file-owner')})).json()).homeworks[0];
    assert.equal((await fetch(`${base}/api/student/homeworks/${task.assignmentId}/resource`, {
      headers: studentHeaders('another-student')
    })).status, 404);
    assert.equal((await fetch(`${base}/api/student/homeworks/${task.assignmentId}/resource`, {
      headers: studentHeaders('student-file-owner')
    })).status, 200);

    const submission = new FormData();
    submission.set('text', 'Çözüm PDF’im.');
    submission.set('file', new Blob(['%PDF-1.4\nsolution'], {type: 'application/pdf'}), 'cozum.pdf');
    assert.equal((await fetch(`${base}/api/student/homeworks/${task.assignmentId}/submissions`, {
      method: 'POST', headers: studentHeaders('student-file-owner'), body: submission
    })).status, 201);
    assert.equal((await fetch(`${base}/api/student/homeworks/${task.assignmentId}/file`, {
      headers: studentHeaders('another-student')
    })).status, 404);
  } finally {
    await workspace.close();
  }
});

test('linked online tests are graded automatically and complete only their assigned homework', async () => {
  const workspace = setup();
  try {
    const base = await workspace.base;
    const student = await addStudent(base, 'Mert', '4001');
    const quizId = new ObjectId();
    workspace.collections.quizzes.rows.push({
      _id: quizId,
      title: 'Kesirler testi',
      createdBy: 'teacher-1',
      questions: [
        {text: '1/2 + 1/2 = ?', options: {A: '1', B: '2', C: '3', D: '4'}, answer: 'A'},
        {text: '1/3 + 1/3 = ?', options: {A: '1/2', B: '2/3', C: '1', D: '2'}, answer: 'B'}
      ]
    });
    const created = await fetch(`${base}/api/ogretmen/odevler`, jsonOptions('POST', {
      title: 'Kesirler çevrimiçi testi',
      grade: 5,
      section: 'A',
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      type: 'online',
      quizId: String(quizId)
    }, teacherHeaders()));
    assert.equal(created.status, 201);
    assert.equal((await linkProfile(base, student.data.invitationCode, 'online-test-student')).status, 200);
    const assigned = (await (await fetch(`${base}/api/student/homeworks`, {
      headers: studentHeaders('online-test-student')
    })).json()).homeworks[0];
    const response = await fetch(`${base}/api/student/homeworks/${assigned.assignmentId}/quiz-submission`, jsonOptions('POST', {
      quizId: String(quizId),
      answers: ['A', 'B']
    }, studentHeaders('online-test-student')));
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.score, 100);
    assert.equal(result.status, 'Teslim edildi');
    assert.equal(workspace.collections.assignments.rows[0].score, 100);
    assert.equal((await fetch(`${base}/api/student/homeworks/${assigned.assignmentId}/quiz-submission`, jsonOptions('POST', {
      quizId: String(quizId),
      answers: ['A', 'B']
    }, studentHeaders('online-test-student')))).status, 409);
  } finally {
    await workspace.close();
  }
});
