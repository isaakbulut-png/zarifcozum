const { ObjectId } = require('mongodb');

function audienceClauses(profiles) {
  const clauses = [];
  for (const profile of profiles) {
    if (!profile.teacherId || !Number.isInteger(profile.grade) || typeof profile.section !== 'string' || !profile._id) continue;
    const base = {
      createdBy: profile.teacherId,
      'audience.grade': profile.grade,
      'audience.section': { $in: ['', profile.section] }
    };
    clauses.push({ ...base, 'audience.mode': 'class' });
    clauses.push({ ...base, 'audience.mode': 'students', 'audience.studentIds': String(profile._id) });
  }
  return clauses;
}

function studentLessonFilter(profiles, now = new Date()) {
  const clauses = audienceClauses(profiles);
  return {
    kind: 'live',
    $and: [
      { $or: [{ startsAt: { $gte: now } }, { status: 'scheduled' }] },
      { $or: clauses.length ? clauses : [{ _id: { $in: [] } }] }
    ]
  };
}

function matchesAudience(lesson, profile) {
  const audience = lesson?.audience;
  if (!audience || !lesson.createdBy || lesson.createdBy !== profile.teacherId ||
      !Number.isInteger(audience.grade) || audience.grade !== profile.grade ||
      typeof audience.section !== 'string' || (audience.section && audience.section !== profile.section)) return false;
  if (audience.mode === 'class') return true;
  return audience.mode === 'students' && Array.isArray(audience.studentIds) &&
    audience.studentIds.includes(String(profile._id));
}

async function studentProfiles(collection, userId) {
  return collection.find({ linkedUserId: userId, active: true }).toArray();
}

async function studentCanAccess(collection, userId, lesson) {
  const profiles = await studentProfiles(collection, userId);
  return profiles.some(profile => matchesAudience(lesson, profile));
}

async function validateAudience(collection, teacherId, input) {
  const grade = Number(input?.grade);
  const section = typeof input?.section === 'string' ? input.section.trim().toLocaleUpperCase('tr-TR') : null;
  const mode = input?.mode;
  const ids = input?.studentIds;
  if (!Number.isInteger(grade) || grade < 1 || grade > 12 || section === null || section.length > 12 ||
      !['class', 'students'].includes(mode) || !Array.isArray(ids) || ids.length > 300 ||
      ids.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) ||
      new Set(ids.map(id => id.toLowerCase())).size !== ids.length ||
      (mode === 'students' && !ids.length) || (mode === 'class' && ids.length)) {
    throw Object.assign(new Error('Geçerli bir sınıf ve öğrenci hedefi seçin.'), { status: 400 });
  }
  const filter = { teacherId, grade, active: true };
  if (section) filter.section = section;
  if (mode === 'students') filter._id = { $in: ids.map(id => new ObjectId(id)) };
  const profiles = await collection.find(filter).toArray();
  if (!profiles.length || (mode === 'students' && profiles.length !== ids.length)) {
    throw Object.assign(new Error('Seçilen sınıfta etkin öğrenci bulunamadı veya öğrenci seçimi geçersiz.'), { status: 400 });
  }
  return { grade, section, mode, studentIds: mode === 'students' ? ids.map(id => id.toLowerCase()) : [] };
}

module.exports = { audienceClauses, studentLessonFilter, matchesAudience, studentProfiles, studentCanAccess, validateAudience };
