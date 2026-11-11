const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { audienceClauses, studentLessonFilter, matchesAudience } = require('../lib/live-lesson-audience');

test('panel sorgusu ve katılım kontrolü aynı sınıf ve öğrenci hedeflerini uygular', () => {
  const profile = {_id: new ObjectId(), teacherId: 'teacher-1', grade: 6, section: 'A'};
  const clauses = audienceClauses([profile]);
  function queryMatches(lesson) {
    return clauses.some(clause => Object.entries(clause).every(([key, expected]) => {
      const actual = key.split('.').reduce((value, part) => value?.[part], lesson);
      if (expected?.$in) return expected.$in.includes(actual);
      return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
    }));
  }
  const lessons = [
    {createdBy: 'teacher-1', audience: {grade: 6, section: '', mode: 'class'}},
    {createdBy: 'teacher-1', audience: {grade: 6, section: 'A', mode: 'students', studentIds: [String(profile._id)]}},
    {createdBy: 'teacher-1', audience: {grade: 6, section: 'B', mode: 'class'}},
    {createdBy: 'teacher-2', audience: {grade: 6, section: 'A', mode: 'class'}},
    {createdBy: 'teacher-1', audience: {grade: 6, section: 'A', mode: 'students', studentIds: [String(new ObjectId())]}},
    {createdBy: 'teacher-1'}
  ];
  assert.deepEqual(lessons.map(lesson => matchesAudience(lesson, profile)), [true, true, false, false, false, false]);
  assert.deepEqual(lessons.map(queryMatches), [true, true, false, false, false, false]);
});

test('öğrenci ders listesi yalnız hedefli canlı dersleri ve uygun tarihleri sorgular', () => {
  const profile = {_id: new ObjectId(), teacherId: 'teacher-1', grade: 6, section: 'A'};
  const now = new Date('2026-01-01T00:00:00Z');
  const filter = studentLessonFilter([profile], now);
  const matches = (document, query) => Object.entries(query).every(([key, expected]) => {
    if (key === '$and') return expected.every(part => matches(document, part));
    if (key === '$or') return expected.some(part => matches(document, part));
    const actual = key.split('.').reduce((value, part) => value?.[part], document);
    if (expected?.$in) return expected.$in.includes(actual);
    if (expected?.$gte) return actual >= expected.$gte;
    return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
  });
  const target = {createdBy: 'teacher-1', audience: {grade: 6, section: 'A', mode: 'class'}};
  assert.equal(matches({...target, kind: 'live', status: 'scheduled', startsAt: now}, filter), true);
  assert.equal(matches({...target, kind: 'live', status: 'scheduled', startsAt: now}, studentLessonFilter([], now)), false);
  assert.equal(matches({...target, status: 'scheduled', startsAt: now}, filter), false);
  assert.equal(matches({kind: 'live', status: 'scheduled', startsAt: now}, filter), false);
  assert.equal(matches({...target, kind: 'live', status: 'completed', startsAt: new Date(0)}, filter), false);
});
