const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { ObjectId } = require('mongodb');

const ODEv_DURUMLARI = ['Atandı', 'Görüntülendi', 'Devam ediyor', 'Teslim edildi', 'Geç teslim', 'Kontrol edildi', 'Eksik', 'Teslim edilmedi'];
const DOSYA_LIMITI = 4 * 1024 * 1024;
const studentFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: DOSYA_LIMITI, files: 1}
}).single('file');
const homeworkResourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: DOSYA_LIMITI, files: 1}
}).single('resource');

function objectId(value) {
  return typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function normalizeText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validGrade(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 12;
}

function cleanStudent({ _id, teacherId, studentNumber, firstName, lastName, grade, section, email, guardianContact, active, createdAt, updatedAt, linkedUserId }) {
  return {
    id: String(_id),
    studentNumber,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    grade,
    section,
    email: email || '',
    guardianContact: guardianContact || '',
    active: active !== false,
    linked: Boolean(linkedUserId),
    createdAt,
    updatedAt
  };
}

function fileType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

function invitationToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createTeacherStudentHomeworkRouters({
  requireTeacher,
  requireStudent,
  UserModel,
  getStudentCollection,
  getHomeworkCollection,
  getAssignmentCollection,
  getAuditCollection,
  getQuizCollection,
  getStudentQuizResultsCollection,
  getCurriculumAssignmentsCollection,
  notifyParent,
  pointsService
}) {
  const teacher = express.Router();
  const student = express.Router();

  const students = getStudentCollection;
  const homeworks = getHomeworkCollection;
  const assignments = getAssignmentCollection;
  const audit = getAuditCollection;
  const quizzes = getQuizCollection;

  teacher.use(requireTeacher);

  async function queueParentNotification(studentId, assignmentId) {
    if (typeof notifyParent !== 'function') {
      return {status: 'not_configured'};
    }
    try {
      const response = await notifyParent({
        student_id: String(studentId),
        event_id: `assignment-completed:${assignmentId}`,
        event_type: 'assignment_completed',
        title: 'Ödev tamamlandı',
        body: 'Öğrenciniz bir ödevi tamamladı.'
      });
      if (response?.status >= 400) throw new Error(`Notification service returned ${response.status}`);
      return response?.data || response;
    } catch (error) {
      console.error('Veli ödev bildirimi kuyruğa alınamadı:', error.code || error.message);
      return {status: 'unavailable'};
    }
  }

  async function recordAudit(req, action, entity, entityId, details = {}) {
    await audit().insertOne({
      teacherId: req.session.user.id,
      actorId: req.session.user.id,
      action,
      entity,
      entityId: String(entityId),
      details,
      createdAt: new Date()
    });
  }

  async function updateOverdueAssignments(homeworkIds) {
    if (!homeworkIds.length) return;
    await assignments().updateMany({
      homeworkId: {$in: homeworkIds},
      status: {$in: ['Atandı', 'Görüntülendi', 'Devam ediyor']},
      dueAt: {$lt: new Date()}
    }, {$set: {status: 'Teslim edilmedi', updatedAt: new Date()}});
  }

  async function teacherHomeworkRows(teacherId, requestedHomeworkId) {
    const filter = {teacherId};
    if (requestedHomeworkId) filter._id = requestedHomeworkId;
    const homeworkRows = await homeworks().find(filter).sort({createdAt: -1}).limit(300).toArray();
    const homeworkIds = homeworkRows.map(item => item._id);
    await updateOverdueAssignments(homeworkIds);
    const assignmentRows = homeworkIds.length
      ? await assignments().find({homeworkId: {$in: homeworkIds}}).toArray()
      : [];
    const rosterIds = [...new Set(assignmentRows.map(item => String(item.studentProfileId)))].map(objectId).filter(Boolean);
    const rosterRows = rosterIds.length
      ? await students().find({_id: {$in: rosterIds}, teacherId}).toArray()
      : [];
    const rosterById = new Map(rosterRows.map(item => [String(item._id), item]));
    const rowsByHomework = new Map();
    assignmentRows.forEach(row => {
      const key = String(row.homeworkId);
      if (!rowsByHomework.has(key)) rowsByHomework.set(key, []);
      rowsByHomework.get(key).push(row);
    });
    const enriched = homeworkRows.map(homework => {
      const rows = rowsByHomework.get(String(homework._id)) || [];
      const recipients = rows.map(row => {
        const profile = rosterById.get(String(row.studentProfileId));
        return {
          assignmentId: String(row._id),
          studentId: String(row.studentProfileId),
          studentName: profile ? `${profile.firstName} ${profile.lastName}` : 'Öğrenci',
          studentNumber: profile?.studentNumber || '',
          grade: profile?.grade || homework.grade,
          section: profile?.section || '',
          linked: Boolean(row.studentUserId),
          status: row.status,
          submittedAt: row.submittedAt || null,
          score: row.score ?? null,
          feedback: row.feedback || '',
          hasFile: Boolean(row.submissionFile),
          submissionText: row.submissionText || ''
        };
      });
      return {
        id: String(homework._id),
        title: homework.title,
        description: homework.description,
        grade: homework.grade,
        section: homework.section,
        topic: homework.topic,
        type: homework.type,
        hasResourceFile: Boolean(homework.resourceFile),
        dueAt: homework.dueAt,
        quizId: homework.quizId || null,
        status: homework.status,
        createdAt: homework.createdAt,
        recipientCount: recipients.length,
        counts: ODEv_DURUMLARI.reduce((counts, status) => {
          counts[status] = recipients.filter(row => row.status === status).length;
          return counts;
        }, {}),
        recipients
      };
    });
    return enriched;
  }

  teacher.get('/ogrenciler', asyncRoute(async (req, res) => {
    const filter = {teacherId: req.session.user.id};
    if (req.query.grade !== undefined && req.query.grade !== '') {
      if (!validGrade(req.query.grade)) return res.status(400).json({mesaj: 'Sınıf seviyesi 1–12 arasında olmalıdır.'});
      filter.grade = Number(req.query.grade);
    }
    if (typeof req.query.section === 'string' && req.query.section.trim()) {
      filter.section = req.query.section.trim().toLocaleUpperCase('tr-TR').slice(0, 12);
    }
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;
    const q = normalizeText(req.query.q, 100);
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        {firstName: {$regex: escaped, $options: 'i'}},
        {lastName: {$regex: escaped, $options: 'i'}},
        {studentNumber: {$regex: escaped, $options: 'i'}}
      ];
    }
    const rows = await students().find(filter).sort({grade: 1, section: 1, lastName: 1, firstName: 1}).limit(1000).toArray();
    const profiles = rows.map(cleanStudent);
    const profileIds = rows.map(row => row._id);
    const taskRows = profileIds.length ? await assignments().find({studentProfileId: {$in: profileIds}}).toArray() : [];
    const summary = new Map();
    taskRows.forEach(task => {
      const key = String(task.studentProfileId);
      const entry = summary.get(key) || {total: 0, completed: 0, pending: 0, overdue: 0, reviewed: 0};
      entry.total++;
      if (['Teslim edildi', 'Geç teslim', 'Kontrol edildi'].includes(task.status)) entry.completed++;
      if (['Atandı', 'Görüntülendi', 'Devam ediyor'].includes(task.status)) entry.pending++;
      if (task.status === 'Teslim edilmedi') entry.overdue++;
      if (task.status === 'Kontrol edildi') entry.reviewed++;
      summary.set(key, entry);
    });
    res.json({
      students: profiles.map(profile => ({...profile, homework: summary.get(profile.id) || {total: 0, completed: 0, pending: 0, overdue: 0, reviewed: 0}})),
      total: profiles.length,
      active: profiles.filter(profile => profile.active).length,
      inactive: profiles.filter(profile => !profile.active).length
    });
  }));

  teacher.post('/ogrenciler', asyncRoute(async (req, res) => {
    const firstName = normalizeText(req.body?.firstName, 80);
    const lastName = normalizeText(req.body?.lastName, 80);
    const studentNumber = normalizeText(req.body?.studentNumber, 30).toUpperCase();
    const section = normalizeText(req.body?.section, 12).toLocaleUpperCase('tr-TR');
    const email = normalizeText(req.body?.email, 254).toLowerCase();
    const guardianContact = normalizeText(req.body?.guardianContact, 160);
    const grade = Number(req.body?.grade);
    if (!firstName || !lastName || !/^[A-Z0-9-]{2,30}$/.test(studentNumber) || !validGrade(grade) || !section ||
        email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({mesaj: 'Ad, soyad, benzersiz öğrenci numarası, 1–12. sınıf ve şube gereklidir; e-posta biçimini de kontrol edin.'});
    }
    const teacherId = req.session.user.id;
    if (await students().findOne({teacherId, studentNumber})) {
      return res.status(409).json({mesaj: 'Bu öğrenci numarası bu öğretmenin listesinde zaten kayıtlı.'});
    }

    const rawInvitation = invitationToken();
    const now = new Date();
    const record = {
      teacherId, studentNumber, firstName, lastName, grade, section, email, guardianContact,
      active: true, linkedUserId: null, invitationCodeHash: hashToken(rawInvitation),
      invitationExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now, updatedAt: now
    };
    let inserted;
    try {
      inserted = await students().insertOne(record);
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({mesaj: 'Bu öğrenci numarası bu öğretmenin listesinde zaten kayıtlı.'});
      throw error;
    }
    try {
      await recordAudit(req, 'student.created', 'student', inserted.insertedId, {studentNumber, grade, section});
    } catch (error) {
      await students().deleteOne({_id: inserted.insertedId, teacherId});
      throw error;
    }
    res.status(201).json({
      mesaj: 'Öğrenci kaydedildi. Bu tek kullanımlık bağlantı kodunu öğrenciye güvenli biçimde iletin.',
      student: cleanStudent({_id: inserted.insertedId, ...record}),
      invitationCode: rawInvitation,
      invitationExpiresAt: record.invitationExpiresAt
    });
  }));

  teacher.get('/ogrenciler/:id', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({mesaj: 'Öğrenci numarası geçersiz.'});
    const profile = await students().findOne({_id: id, teacherId: req.session.user.id});
    if (!profile) return res.status(404).json({mesaj: 'Öğrenci bulunamadı.'});
    let assigned = await assignments().find({teacherId: req.session.user.id, studentProfileId: id}).sort({createdAt: -1}).toArray();
    await updateOverdueAssignments([...new Set(assigned.map(item => item.homeworkId))]);
    assigned = await assignments().find({teacherId: req.session.user.id, studentProfileId: id}).sort({createdAt: -1}).toArray();
    const homeworkIds = [...new Set(assigned.map(item => item.homeworkId))];
    const homeworkRows = homeworkIds.length ? await homeworks().find({_id: {$in: homeworkIds}, teacherId: req.session.user.id}).toArray() : [];
    const homeworkMap = new Map(homeworkRows.map(item => [String(item._id), item]));
    const activity = assigned.map(item => ({
      id: String(item._id),
      homeworkId: String(item.homeworkId),
      title: homeworkMap.get(String(item.homeworkId))?.title || 'Ödev',
      topic: homeworkMap.get(String(item.homeworkId))?.topic || '',
      dueAt: item.dueAt,
      status: item.status,
      submittedAt: item.submittedAt || null,
      score: item.score ?? null,
      feedback: item.feedback || '',
      submissionText: item.submissionText || '',
      hasFile: Boolean(item.submissionFile)
    }));
    let accountResults = [];
    if (profile.linkedUserId) {
      const teacherQuizzes = await quizzes().find({createdBy: req.session.user.id}).toArray();
      const quizIds = teacherQuizzes.map(quiz => quiz._id);
      if (quizIds.length) {
        accountResults = await getStudentQuizResultsCollection()
          .find({studentId: profile.linkedUserId, quizId: {$in: quizIds}})
          .sort({createdAt: -1}).limit(100).toArray();
      }
    }
    res.json({
      student: cleanStudent(profile),
      homework: activity,
      summary: {
        assigned: activity.length,
        submitted: activity.filter(item => ['Teslim edildi', 'Geç teslim', 'Kontrol edildi'].includes(item.status)).length,
        pending: activity.filter(item => ['Atandı', 'Görüntülendi', 'Devam ediyor'].includes(item.status)).length,
        overdue: activity.filter(item => item.status === 'Teslim edilmedi').length,
        reviewed: activity.filter(item => item.status === 'Kontrol edildi').length
      },
      quizResults: (accountResults || []).map(result => ({
        title: result.quizTitle || 'Test',
        score: result.score,
        createdAt: result.createdAt
      }))
    });
  }));

  teacher.post('/ogrenciler/:id/invitation', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({mesaj: 'Öğrenci numarası geçersiz.'});
    const rawInvitation = invitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await students().updateOne({
      _id: id,
      teacherId: req.session.user.id,
      active: true,
      linkedUserId: null
    }, {$set: {
      invitationCodeHash: hashToken(rawInvitation),
      invitationExpiresAt: expiresAt,
      updatedAt: new Date()
    }});
    if (!result.matchedCount) return res.status(404).json({mesaj: 'Etkin ve henüz bir hesaba bağlanmamış öğrenci bulunamadı.'});
    await recordAudit(req, 'student.invitation_issued', 'student', id, {expiresAt});
    res.status(201).json({
      mesaj: 'Yeni tek kullanımlık davet kodu oluşturuldu.',
      invitationCode: rawInvitation,
      invitationExpiresAt: expiresAt
    });
  }));

  teacher.put('/ogrenciler/:id', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({mesaj: 'Öğrenci numarası geçersiz.'});
    const current = await students().findOne({_id: id, teacherId: req.session.user.id});
    if (!current) return res.status(404).json({mesaj: 'Öğrenci bulunamadı.'});
    const firstName = normalizeText(req.body?.firstName, 80);
    const lastName = normalizeText(req.body?.lastName, 80);
    const studentNumber = normalizeText(req.body?.studentNumber, 30).toUpperCase();
    const grade = Number(req.body?.grade);
    const section = normalizeText(req.body?.section, 12).toLocaleUpperCase('tr-TR');
    const email = normalizeText(req.body?.email, 254).toLowerCase();
    const guardianContact = normalizeText(req.body?.guardianContact, 160);
    if (!firstName || !lastName || !/^[A-Z0-9-]{2,30}$/.test(studentNumber) || !validGrade(grade) || !section ||
        email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({mesaj: 'Öğrenci bilgileri geçersiz.'});
    }
    if (await students().findOne({teacherId: req.session.user.id, studentNumber, _id: {$ne: id}})) {
      return res.status(409).json({mesaj: 'Bu öğrenci numarası bu öğretmenin listesinde zaten kayıtlı.'});
    }
    const changes = {firstName, lastName, studentNumber, grade, section, email, guardianContact, updatedAt: new Date()};
    try {
      await students().updateOne({_id: id, teacherId: req.session.user.id}, {$set: changes});
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({mesaj: 'Bu öğrenci numarası bu öğretmenin listesinde zaten kayıtlı.'});
      throw error;
    }
    await recordAudit(req, 'student.updated', 'student', id, {studentNumber, grade, section});
    res.json({mesaj: 'Öğrenci bilgileri güncellendi.', student: cleanStudent({...current, ...changes})});
  }));

  teacher.patch('/ogrenciler/:id/status', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    const active = req.body?.active;
    if (!id || typeof active !== 'boolean') return res.status(400).json({mesaj: 'Öğrenci veya aktiflik durumu geçersiz.'});
    const result = await students().updateOne(
      {_id: id, teacherId: req.session.user.id},
      {$set: {active, updatedAt: new Date()}}
    );
    if (!result.matchedCount) return res.status(404).json({mesaj: 'Öğrenci bulunamadı.'});
    await recordAudit(req, active ? 'student.activated' : 'student.deactivated', 'student', id);
    res.json({mesaj: active ? 'Öğrenci yeniden etkinleştirildi.' : 'Öğrenci pasife alındı.'});
  }));

  teacher.get('/odevler', asyncRoute(async (req, res) => {
    const homework = await teacherHomeworkRows(req.session.user.id);
    const summary = homework.reduce((result, item) => {
      result.total++;
      ODEv_DURUMLARI.forEach(status => { result[status] += item.counts[status] || 0; });
      return result;
    }, {total: homework.length, ...Object.fromEntries(ODEv_DURUMLARI.map(status => [status, 0]))});
    res.json({homework, summary, statuses: ODEv_DURUMLARI});
  }));

  teacher.get('/odevler/:id', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({mesaj: 'Ödev numarası geçersiz.'});
    const [homework] = await teacherHomeworkRows(req.session.user.id, id);
    if (!homework) return res.status(404).json({mesaj: 'Ödev bulunamadı.'});
    res.json({homework});
  }));

  teacher.post('/odevler', (req, res, next) => {
    homeworkResourceUpload(req, res, error => {
      if (!error) return next();
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        mesaj: tooLarge ? 'Ödev PDF dosyası en fazla 4 MB olabilir.' : 'Yalnızca bir PDF dosyası ekleyin.'
      });
    });
  }, asyncRoute(async (req, res) => {
    const title = normalizeText(req.body?.title, 160);
    const description = normalizeText(req.body?.description, 3000);
    const topic = normalizeText(req.body?.topic, 180);
    const type = req.body?.type;
    const grade = Number(req.body?.grade);
    const section = normalizeText(req.body?.section, 12).toLocaleUpperCase('tr-TR');
    const dueAt = new Date(req.body?.dueAt);
    const rawStudentIds = Array.isArray(req.body?.studentIds)
      ? req.body.studentIds
      : typeof req.body?.studentIds === 'string' ? [req.body.studentIds] : [];
    const studentIds = [...new Set(rawStudentIds.filter(id => typeof id === 'string'))];
    const validTypes = ['online', 'pdf', 'written', 'project'];
    if (!title || !validGrade(grade) || !Number.isFinite(dueAt.getTime()) || dueAt <= new Date() ||
        !validTypes.includes(type) || description.length > 3000 || studentIds.length > 300) {
      return res.status(400).json({mesaj: 'Başlık, 1–12. sınıf, geçerli gelecek teslim tarihi ve ödev türü gereklidir.'});
    }
    if (type === 'online' && req.body?.quizId) {
      const quizId = objectId(req.body.quizId);
      if (!quizId) return res.status(400).json({mesaj: 'Bağlı test numarası geçersiz.'});
      const quiz = await quizzes().findOne({_id: quizId, createdBy: req.session.user.id});
      if (!quiz) return res.status(404).json({mesaj: 'Bağlanacak test bulunamadı veya bu öğretmene ait değil.'});
    }
    let resourceFile = null;
    if (req.file) {
      if (fileType(req.file.buffer) !== 'application/pdf') {
        return res.status(400).json({mesaj: 'Ödev kaynağı yalnızca doğrulanmış PDF olabilir.'});
      }
      const name = normalizeText(req.file.originalname, 120).replace(/[^\p{L}\p{N}._-]/gu, '_') || 'odev-kaynagi.pdf';
      resourceFile = {data: req.file.buffer, type: 'application/pdf', name, size: req.file.size};
    }
    if (type === 'pdf' && !resourceFile) {
      return res.status(400).json({mesaj: 'PDF türündeki ödevler için öğrenciye verilecek PDF dosyasını ekleyin.'});
    }

    const studentFilter = {
      teacherId: req.session.user.id,
      grade,
      active: true
    };
    if (section) studentFilter.section = section;
    if (studentIds.length) {
      const ids = studentIds.map(objectId);
      if (ids.some(id => !id)) return res.status(400).json({mesaj: 'Seçilen öğrenci kimliklerinden biri geçersiz.'});
      studentFilter._id = {$in: ids};
    }
    const recipients = await students().find(studentFilter).toArray();
    if (studentIds.length && recipients.length !== studentIds.length) {
      return res.status(400).json({mesaj: 'Seçilen öğrencilerden biri bu öğretmene ait, etkin veya belirtilen sınıfta değil.'});
    }
    if (!recipients.length) return res.status(400).json({mesaj: 'Bu sınıf ve şubede etkin öğrenci bulunamadı.'});

    const now = new Date();
    const homeworkRecord = {
      teacherId: req.session.user.id,
      title,
      description,
      grade,
      section,
      topic,
      type,
      quizId: req.body?.quizId ? String(req.body.quizId) : null,
      resourceFile,
      dueAt,
      status: 'Yayında',
      recipientCount: recipients.length,
      createdAt: now,
      updatedAt: now
    };
    const homeworkResult = await homeworks().insertOne(homeworkRecord);
    const homeworkId = homeworkResult.insertedId;
    const assignmentRecords = recipients.map(profile => ({
      teacherId: req.session.user.id,
      homeworkId,
      studentProfileId: profile._id,
      studentUserId: profile.linkedUserId || null,
      status: 'Atandı',
      dueAt,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      score: null,
      feedback: ''
    }));
    try {
      await assignments().insertMany(assignmentRecords, {ordered: true});
      await recordAudit(req, 'homework.published', 'homework', homeworkId, {
        title, grade, section, recipientCount: recipients.length, studentIds: recipients.map(item => String(item._id))
      });
    } catch (error) {
      await assignments().deleteMany({homeworkId});
      await homeworks().deleteOne({_id: homeworkId, teacherId: req.session.user.id});
      throw error;
    }
    const [created] = await teacherHomeworkRows(req.session.user.id, homeworkId);
    res.status(201).json({mesaj: `${recipients.length} öğrenciye ödev atandı.`, homework: created});
  }));

  teacher.patch('/odevler/atamalar/:assignmentId/review', asyncRoute(async (req, res) => {
    const id = objectId(req.params.assignmentId);
    const score = req.body?.score === null || req.body?.score === '' || req.body?.score === undefined
      ? null : Number(req.body.score);
    const feedback = normalizeText(req.body?.feedback, 2000);
    const status = req.body?.status;
    if (!id || !['Kontrol edildi', 'Eksik'].includes(status) ||
        score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) {
      return res.status(400).json({mesaj: 'Değerlendirme durumu, 0–100 arası puan ve geri bildirimi kontrol edin.'});
    }
    const assignment = await assignments().findOne({_id: id, teacherId: req.session.user.id});
    if (!assignment) return res.status(404).json({mesaj: 'Ödev ataması bulunamadı.'});
    if (!['Teslim edildi', 'Geç teslim', 'Eksik', 'Kontrol edildi'].includes(assignment.status)) {
      return res.status(409).json({mesaj: 'Henüz teslim edilmemiş bir ödev değerlendirilemez.'});
    }
    const updatedAt = new Date();
    await assignments().updateOne({_id: id, teacherId: req.session.user.id}, {
      $set: {status, score, feedback, reviewedAt: updatedAt, reviewedBy: req.session.user.id, updatedAt}
    });
    await recordAudit(req, 'homework.reviewed', 'homework_assignment', id, {status, score});
    res.json({mesaj: status === 'Eksik' ? 'Çalışma eksik olarak işaretlendi.' : 'Ödev değerlendirmesi kaydedildi.'});
  }));

  teacher.get('/odevler/atamalar/:assignmentId/file', asyncRoute(async (req, res) => {
    const id = objectId(req.params.assignmentId);
    if (!id) return res.status(400).json({mesaj: 'Ödev ataması geçersiz.'});
    const assignment = await assignments().findOne({_id: id, teacherId: req.session.user.id});
    if (!assignment?.submissionFile?.data) return res.status(404).json({mesaj: 'Teslim dosyası bulunamadı.'});
    res.set({
      'Content-Type': assignment.submissionFile.type,
      'Content-Length': String(assignment.submissionFile.size),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(assignment.submissionFile.name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(assignment.submissionFile.data);
  }));

  teacher.get('/odevler/:id/resource', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({mesaj: 'Ödev numarası geçersiz.'});
    const homework = await homeworks().findOne({_id: id, teacherId: req.session.user.id});
    if (!homework?.resourceFile?.data) return res.status(404).json({mesaj: 'Ödev PDF dosyası bulunamadı.'});
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(homework.resourceFile.size),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(homework.resourceFile.name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(homework.resourceFile.data);
  }));

  student.use(requireStudent);

  student.post('/profile/link', asyncRoute(async (req, res) => {
    const code = typeof req.body?.invitationCode === 'string' ? req.body.invitationCode.trim() : '';
    if (!/^[A-Za-z0-9_-]{32}$/.test(code)) return res.status(400).json({mesaj: 'Öğretmen davet kodu geçersiz.'});
    const profile = await students().findOne({
      invitationCodeHash: hashToken(code),
      invitationExpiresAt: {$gt: new Date()},
      active: true
    });
    if (!profile) return res.status(404).json({mesaj: 'Davet kodu bulunamadı, kullanılmış veya süresi dolmuş.'});
    const alreadyLinked = await students().findOne({
      teacherId: profile.teacherId,
      linkedUserId: req.session.user.id,
      active: true,
      _id: {$ne: profile._id}
    });
    if (alreadyLinked) return res.status(409).json({mesaj: 'Bu öğretmen hesabında bu öğrenci profili zaten bağlı.'});
    if (profile.email && profile.email !== normalizeText(req.session.user.email, 254).toLowerCase()) {
      const account = await UserModel.findById(req.session.user.id).select('email').lean();
      if (!account || account.email !== profile.email) {
        return res.status(403).json({mesaj: 'Bu davet farklı bir öğrenci e-posta adresiyle oluşturulmuş.'});
      }
    }
    const result = await students().updateOne({
      _id: profile._id,
      invitationCodeHash: hashToken(code),
      linkedUserId: null,
      active: true
    }, {$set: {
      linkedUserId: req.session.user.id,
      invitationCodeHash: null,
      invitationExpiresAt: null,
      linkedAt: new Date(),
      updatedAt: new Date()
    }});
    if (!result.modifiedCount) return res.status(409).json({mesaj: 'Davet kodu başka bir hesap tarafından kullanılmış.'});
    await assignments().updateMany(
      {studentProfileId: profile._id, teacherId: profile.teacherId, studentUserId: null},
      {$set: {studentUserId: req.session.user.id, updatedAt: new Date()}}
    );
    await audit().insertOne({
      teacherId: profile.teacherId,
      actorId: req.session.user.id,
      action: 'student.account_linked',
      entity: 'student',
      entityId: String(profile._id),
      createdAt: new Date()
    });
    res.json({mesaj: 'Öğrenci profili hesabınıza bağlandı.'});
  }));

  student.get('/profile', asyncRoute(async (req, res) => {
    const profiles = await students().find({linkedUserId: req.session.user.id, active: true}).toArray();
    res.json({students: profiles.map(profile => ({
      id: String(profile._id),
      firstName: profile.firstName,
      lastName: profile.lastName,
      studentNumber: profile.studentNumber,
      grade: profile.grade,
      section: profile.section
    }))});
  }));

  student.get('/homeworks', asyncRoute(async (req, res) => {
    const profiles = await students().find({linkedUserId: req.session.user.id, active: true}).toArray();
    if (!profiles.length) return res.json({students: [], homeworks: []});
    const profilesById = new Map(profiles.map(profile => [String(profile._id), profile]));
    const profileIds = profiles.map(profile => profile._id);
    const rows = await assignments().find({
      studentProfileId: {$in: profileIds},
      studentUserId: req.session.user.id
    }).sort({dueAt: 1}).toArray();
    await updateOverdueAssignments([...new Set(rows.map(item => item.homeworkId))]);
    const updatedRows = await assignments().find({
      studentProfileId: {$in: profileIds},
      studentUserId: req.session.user.id
    }).sort({dueAt: 1}).toArray();
    const homeworkIds = [...new Set(updatedRows.map(item => item.homeworkId))];
    const parents = homeworkIds.length ? await homeworks().find({_id: {$in: homeworkIds}}).toArray() : [];
    const parentById = new Map(parents.map(item => [String(item._id), item]));
    for (const assignment of updatedRows) {
      if (assignment.status === 'Atandı') {
        await assignments().updateOne(
          {_id: assignment._id, studentUserId: req.session.user.id, status: 'Atandı'},
          {$set: {status: 'Görüntülendi', viewedAt: new Date(), updatedAt: new Date()}}
        );
        assignment.status = 'Görüntülendi';
      }
    }
    res.json({
      students: profiles.map(profile => ({firstName: profile.firstName, grade: profile.grade, section: profile.section})),
      homeworks: updatedRows.map(assignment => {
        const homework = parentById.get(String(assignment.homeworkId));
        const profile = profilesById.get(String(assignment.studentProfileId));
        return {
          assignmentId: String(assignment._id),
          id: String(assignment._id),
          title: homework?.title || 'Ödev',
          description: homework?.description || '',
          topic: homework?.topic || '',
          grade: profile?.grade || homework?.grade,
          section: profile?.section || '',
          type: homework?.type || 'written',
          hasResourceFile: Boolean(homework?.resourceFile),
          dueAt: assignment.dueAt,
          status: assignment.status,
          submittedAt: assignment.submittedAt || null,
          score: assignment.score ?? null,
          feedback: assignment.feedback || '',
          submissionText: assignment.submissionText || '',
          hasFile: Boolean(assignment.submissionFile),
          quizId: homework?.quizId || null
        };
      })
    });
  }));

  student.post('/homeworks/:assignmentId/start', asyncRoute(async (req, res) => {
    const id = objectId(req.params.assignmentId);
    if (!id) return res.status(400).json({mesaj: 'Ödev ataması geçersiz.'});
    const result = await assignments().updateOne({
      _id: id,
      studentUserId: req.session.user.id,
      status: {$in: ['Görüntülendi', 'Atandı', 'Devam ediyor', 'Teslim edilmedi', 'Eksik']}
    }, {$set: {status: 'Devam ediyor', startedAt: new Date(), updatedAt: new Date()}});
    if (!result.matchedCount) return res.status(404).json({mesaj: 'Devam edebileceğiniz ödev bulunamadı.'});
    res.json({mesaj: 'Ödev çalışmaya başlandı.'});
  }));

  student.post('/homeworks/:assignmentId/quiz-submission', asyncRoute(async (req, res) => {
    const id = objectId(req.params.assignmentId);
    if (!id) return res.status(400).json({mesaj: 'Ödev ataması geçersiz.'});
    const assignment = await assignments().findOne({_id: id, studentUserId: req.session.user.id});
    if (!assignment) return res.status(404).json({mesaj: 'Ödev bulunamadı.'});
    const homework = await homeworks().findOne({_id: assignment.homeworkId, teacherId: assignment.teacherId});
    const quizId = objectId(req.body?.quizId);
    if (!homework || homework.type !== 'online' || !quizId || String(homework.quizId) !== String(quizId)) {
      return res.status(400).json({mesaj: 'Bu ödeve bağlı çevrimiçi test bulunamadı.'});
    }
    if (['Kontrol edildi', 'Teslim edildi', 'Geç teslim'].includes(assignment.status)) {
      return res.status(409).json({mesaj: 'Bu ödev için teslim zaten alınmış.'});
    }
    const quiz = await quizzes().findOne({_id: quizId, createdBy: assignment.teacherId});
    const resultId = objectId(req.body?.resultId);
    const completedResult = resultId && await getStudentQuizResultsCollection().findOne({
      _id: resultId, quizId, studentId: req.session.user.id
    });
    const answers = completedResult?.answers;
    if (!quiz || !Array.isArray(answers) || answers.length !== quiz.questions.length ||
        !answers.every((answer, index) => answer === null ||
          ['A', 'B', 'C', 'D'].includes(answer) && quiz.questions[index].options[answer])) {
      return res.status(400).json({mesaj: 'Test cevapları geçersiz.'});
    }
    const correctCount = answers.reduce(
      (count, answer, index) => count + (answer !== null && answer === quiz.questions[index].answer ? 1 : 0), 0
    );
    const totalCount = quiz.questions.length;
    const score = Math.round(correctCount * 100 / totalCount);
    const now = new Date();
    const status = now > new Date(assignment.dueAt) || assignment.status === 'Teslim edilmedi'
      ? 'Geç teslim' : 'Teslim edildi';
    const {updated, kazanilanPuan} = await pointsService.transaction(async session => {
      const updated = await assignments().updateOne({
        _id: id,
        studentUserId: req.session.user.id,
        status: {$nin: ['Kontrol edildi', 'Teslim edildi', 'Geç teslim']}
      }, {$set: {
        status,
        score,
        submissionText: `${quiz.title}: ${correctCount}/${totalCount} doğru`,
        quizAnswers: answers,
        submittedAt: now,
        updatedAt: now
      }}, {session});
      if (!updated.modifiedCount) return {updated, kazanilanPuan: 0};
      if (homework.curriculumAssignmentId) {
        const collection = getCurriculumAssignmentsCollection();
        await collection.updateOne({_id: homework.curriculumAssignmentId}, {
          $addToSet: {completed_student_ids: assignment.studentProfileId}
        }, {session});
        await collection.updateOne({
          _id: homework.curriculumAssignmentId,
          $expr: {$gte: [{$size: '$completed_student_ids'}, '$recipient_count']}
        }, {$set: {status: 'COMPLETED'}}, {session});
      }
      const keys = quiz.questions.flatMap((question, index) =>
        answers[index] !== null && answers[index] === question.answer ? [`quiz:${quizId}:${index}`] : []
      );
      const kazanilanPuan = await pointsService.award(session, req.session.user.id, keys);
      await audit().insertOne({
        teacherId: assignment.teacherId,
        actorId: req.session.user.id,
        action: status === 'Geç teslim' ? 'homework.quiz_submitted_late' : 'homework.quiz_submitted',
        entity: 'homework_assignment',
        entityId: String(id),
        details: {quizId: String(quizId), score},
        createdAt: now
      }, {session});
      return {updated, kazanilanPuan};
    });
    if (!updated.modifiedCount) return res.status(409).json({mesaj: 'Teslim durumu aynı anda değiştirildi; ödev listesini yenileyin.'});
    const notification = await queueParentNotification(req.session.user.id, id);
    res.status(201).json({mesaj: status, status, score, correctCount, totalCount, kazanilanPuan, notification});
  }));

  student.post('/homeworks/:assignmentId/submissions', (req, res, next) => {
    studentFileUpload(req, res, error => {
      if (!error) return next();
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        mesaj: tooLarge ? 'Teslim dosyası en fazla 4 MB olabilir.' : 'Yalnızca bir teslim dosyası yükleyin.'
      });
    });
  }, asyncRoute(async (req, res) => {
    const id = objectId(req.params.assignmentId);
    if (!id) return res.status(400).json({mesaj: 'Ödev ataması geçersiz.'});
    const text = normalizeText(req.body?.text, 10000);
    let file = null;
    if (req.file) {
      const type = fileType(req.file.buffer);
      if (!type) return res.status(400).json({mesaj: 'Yalnızca doğrulanmış PDF, PNG veya JPEG dosyaları kabul edilir.'});
      const safeName = normalizeText(req.file.originalname, 120).replace(/[^\p{L}\p{N}._-]/gu, '_') || 'odev-dosyasi';
      file = {data: req.file.buffer, type, name: safeName, size: req.file.size};
    }
    if (!text && !file) return res.status(400).json({mesaj: 'Bir çalışma açıklaması yazın veya dosya ekleyin.'});
    const assignment = await assignments().findOne({
      _id: id,
      studentUserId: req.session.user.id
    });
    if (!assignment) return res.status(404).json({mesaj: 'Ödev bulunamadı.'});
    if (['Kontrol edildi', 'Teslim edildi', 'Geç teslim'].includes(assignment.status)) {
      return res.status(409).json({mesaj: 'Bu ödev için teslim zaten alınmış.'});
    }
    const now = new Date();
    const late = now > new Date(assignment.dueAt) || assignment.status === 'Teslim edilmedi';
    const status = late ? 'Geç teslim' : 'Teslim edildi';
    const update = {$set: {
      status,
      submissionText: text,
      submissionFile: file,
      submittedAt: now,
      updatedAt: now
    }};
    const result = await assignments().updateOne({
      _id: id,
      studentUserId: req.session.user.id,
      status: {$nin: ['Kontrol edildi', 'Teslim edildi', 'Geç teslim']}
    }, update);
    if (!result.modifiedCount) return res.status(409).json({mesaj: 'Teslim durumu aynı anda değiştirildi; ödev listesini yenileyin.'});
    await audit().insertOne({
      teacherId: assignment.teacherId,
      actorId: req.session.user.id,
      action: status === 'Geç teslim' ? 'homework.submitted_late' : 'homework.submitted',
      entity: 'homework_assignment',
      entityId: String(id),
      createdAt: now
    });
    const notification = await queueParentNotification(req.session.user.id, id);
    res.status(201).json({mesaj: status, status, notification});
  }));

  student.get('/homeworks/:assignmentId/file', asyncRoute(async (req, res) => {
    const id = objectId(req.params.assignmentId);
    if (!id) return res.status(400).json({mesaj: 'Ödev ataması geçersiz.'});
    const assignment = await assignments().findOne({_id: id, studentUserId: req.session.user.id});
    if (!assignment?.submissionFile?.data) return res.status(404).json({mesaj: 'Teslim dosyası bulunamadı.'});
    res.set({
      'Content-Type': assignment.submissionFile.type,
      'Content-Length': String(assignment.submissionFile.size),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(assignment.submissionFile.name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(assignment.submissionFile.data);
  }));

  student.get('/homeworks/:assignmentId/resource', asyncRoute(async (req, res) => {
    const id = objectId(req.params.assignmentId);
    if (!id) return res.status(400).json({mesaj: 'Ödev ataması geçersiz.'});
    const assignment = await assignments().findOne({_id: id, studentUserId: req.session.user.id});
    if (!assignment) return res.status(404).json({mesaj: 'Ödev bulunamadı.'});
    const homework = await homeworks().findOne({_id: assignment.homeworkId, teacherId: assignment.teacherId});
    if (!homework?.resourceFile?.data) return res.status(404).json({mesaj: 'Ödev PDF dosyası bulunamadı.'});
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(homework.resourceFile.size),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(homework.resourceFile.name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(homework.resourceFile.data);
  }));

  const apiError = (error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Öğretmen/öğrenci ödev API hatası:', error);
    res.status(500).json({mesaj: 'İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.'});
  };
  teacher.use(apiError);
  student.use(apiError);

  return {teacher, student};
}

module.exports = {
  createTeacherStudentHomeworkRouters,
  ODEv_DURUMLARI,
  fileType,
  hashToken
};
