const express = require('express');
const { ObjectId } = require('mongodb');

const TZ = 'Europe/Istanbul';
const KAZANIM_DURUMLARI = ['tamamlandi', 'devam', 'eksik'];
const TAMAMLANAN_ODEV = ['Teslim edildi', 'Geç teslim', 'Kontrol edildi'];
const BEKLEYEN_ODEV = ['Atandı', 'Görüntülendi', 'Devam ediyor'];

function objectId(value) {
  return typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function metin(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function dayKey(date) {
  return new Date(date).toLocaleDateString('sv-SE', { timeZone: TZ });
}

function addDays(key, count) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function weekStart(key) {
  const weekday = (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(key, -weekday);
}

function calculateStreak(minutesByDay, todayKey) {
  let cursor = (minutesByDay.get(todayKey) || 0) > 0 ? todayKey : addDays(todayKey, -1);
  let streak = 0;
  while ((minutesByDay.get(cursor) || 0) > 0) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function mapResult(row) {
  const answers = Array.isArray(row.answers) ? row.answers : [];
  const bos = answers.filter(answer => answer === null || answer === undefined || answer === '').length;
  const total = row.totalCount || answers.length || 0;
  const dogru = row.correctCount || 0;
  return {
    id: String(row._id),
    title: row.quizTitle || 'Test',
    type: row.type === 'deneme' ? 'deneme' : 'kazanim',
    score: typeof row.score === 'number' ? row.score : null,
    dogru,
    yanlis: Math.max(total - dogru - bos, 0),
    bos,
    total,
    createdAt: row.createdAt
  };
}

function validKazanim(body) {
  const grade = Number(body?.grade);
  const unit = metin(body?.unit, 200);
  const topic = metin(body?.topic, 300);
  const status = typeof body?.status === 'string' ? body.status : '';
  if (!Number.isInteger(grade) || grade < 1 || grade > 12 || !unit || !topic ||
      ![...KAZANIM_DURUMLARI, 'yok'].includes(status)) return null;
  return { grade, unit, topic, status };
}

function createGelisimRouters({
  requireTeacher,
  requireStudent,
  getStudentCollection,
  getAssignmentCollection,
  getHomeworkCollection,
  getResultCollection,
  getPlannedLessonCollection,
  getStudyLogCollection,
  getGoalCollection,
  getProgressCollection,
  getCommentCollection,
  getEventCollection
}) {
  const teacher = express.Router();
  const student = express.Router();
  teacher.use(requireTeacher);
  student.use(requireStudent);

  async function linkedGrade(userId) {
    const profile = await getStudentCollection().findOne({ linkedUserId: userId, active: true });
    return profile ? profile.grade : null;
  }

  async function buildSummary(userId, now = new Date()) {
    const today = dayKey(now);
    const monday = weekStart(today);
    const [logs, goal, results, progress, assignments] = await Promise.all([
      getStudyLogCollection().find({ studentUserId: userId, day: { $gte: addDays(today, -366) } })
        .sort({ day: -1, createdAt: -1 }).limit(2000).toArray(),
      getGoalCollection().findOne({ studentUserId: userId }),
      getResultCollection().find({ studentId: userId }).sort({ createdAt: -1 }).limit(200).toArray(),
      getProgressCollection().find({ studentUserId: userId }).limit(2000).toArray(),
      getAssignmentCollection().find({ studentUserId: userId }).limit(1000).toArray()
    ]);

    const minutesByDay = new Map();
    logs.forEach(log => minutesByDay.set(log.day, (minutesByDay.get(log.day) || 0) + log.minutes));
    const week = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(monday, index);
      return { gun: day, dakika: minutesByDay.get(day) || 0, bugun: day === today, gelecek: day > today };
    });
    const scores = results.filter(row => typeof row.score === 'number').map(row => row.score);
    const last = scores.slice(0, 10);
    const previous = scores.slice(10, 20);
    const lastAverage = average(last);
    const previousAverage = average(previous);

    return {
      bugunDakika: minutesByDay.get(today) || 0,
      haftalikDakika: week.reduce((sum, day) => sum + day.dakika, 0),
      haftalikHedef: goal ? goal.weeklyMinutes : null,
      hafta: week,
      seri: calculateStreak(minutesByDay, today),
      testBasarisi: {
        ortalama: lastAverage,
        sayi: scores.length,
        degisim: lastAverage !== null && previousAverage !== null ? lastAverage - previousAverage : null
      },
      tamamlananKonu: progress.filter(row => row.status === 'tamamlandi').length,
      eksikKonu: progress.filter(row => row.status === 'eksik').length,
      odev: {
        toplam: assignments.length,
        tamamlanan: assignments.filter(row => TAMAMLANAN_ODEV.includes(row.status)).length,
        bekleyen: assignments.filter(row => BEKLEYEN_ODEV.includes(row.status)).length,
        geciken: assignments.filter(row => row.status === 'Teslim edilmedi').length
      },
      kayitlar: logs.slice(0, 15).map(log => ({
        id: String(log._id), gun: log.day, dakika: log.minutes, konu: log.topic || '', not: log.note || ''
      }))
    };
  }

  async function buildProgress(userId, grade) {
    const filter = { studentUserId: userId };
    if (grade) filter.grade = grade;
    const rows = await getProgressCollection().find(filter).limit(2000).toArray();
    return rows.map(row => ({
      grade: row.grade, unit: row.unit, topic: row.topic, status: row.status,
      updatedBy: row.updatedBy, updatedAt: row.updatedAt
    }));
  }

  async function buildTests(userId) {
    const rows = await getResultCollection().find({ studentId: userId }).sort({ createdAt: -1 }).limit(200).toArray();
    const tests = rows.map(mapResult);
    const byType = type => tests.filter(item => item.type === type && item.score !== null);
    return {
      testler: tests,
      ozet: {
        toplam: tests.length,
        kazanimOrtalama: average(byType('kazanim').map(item => item.score)),
        denemeOrtalama: average(byType('deneme').map(item => item.score)),
        dogru: tests.reduce((sum, item) => sum + item.dogru, 0),
        yanlis: tests.reduce((sum, item) => sum + item.yanlis, 0),
        bos: tests.reduce((sum, item) => sum + item.bos, 0)
      }
    };
  }

  async function buildCalendar(userId, now = new Date()) {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const [lessons, assignments, events] = await Promise.all([
      getPlannedLessonCollection().find({ startsAt: { $gte: from, $lte: to } }).sort({ startsAt: 1 }).limit(100).toArray(),
      getAssignmentCollection().find({ studentUserId: userId, dueAt: { $gte: from, $lte: to } }).limit(200).toArray(),
      getEventCollection().find({ studentUserId: userId, startsAt: { $gte: from, $lte: to } }).sort({ startsAt: 1 }).limit(200).toArray()
    ]);
    const homeworkIds = [...new Set(assignments.map(item => String(item.homeworkId)))].map(objectId).filter(Boolean);
    const homeworks = homeworkIds.length
      ? await getHomeworkCollection().find({ _id: { $in: homeworkIds } }).toArray()
      : [];
    const homeworkById = new Map(homeworks.map(item => [String(item._id), item]));

    const items = [
      ...lessons.map(lesson => ({
        id: String(lesson._id), kind: 'canli-ders', title: lesson.title, startsAt: lesson.startsAt,
        link: lesson.link, deletable: false
      })),
      ...assignments.map(item => ({
        id: String(item._id), kind: 'odev', title: homeworkById.get(String(item.homeworkId))?.title || 'Ödev',
        startsAt: item.dueAt, status: item.status, tamamlandi: TAMAMLANAN_ODEV.includes(item.status), deletable: false
      })),
      ...events.map(event => ({
        id: String(event._id), kind: event.kind, title: event.title, startsAt: event.startsAt,
        note: event.note || '', createdBy: event.createdBy, teacherId: event.teacherId || null,
        deletable: true
      }))
    ];
    return items.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  }

  async function buildReport(userId, now = new Date()) {
    const today = dayKey(now);
    const firstWeek = addDays(weekStart(today), -35);
    const [logs, results, assignments, progress, comments] = await Promise.all([
      getStudyLogCollection().find({ studentUserId: userId, day: { $gte: firstWeek } }).limit(2000).toArray(),
      getResultCollection().find({ studentId: userId }).sort({ createdAt: -1 }).limit(300).toArray(),
      getAssignmentCollection().find({ studentUserId: userId }).limit(1000).toArray(),
      getProgressCollection().find({ studentUserId: userId }).limit(2000).toArray(),
      getCommentCollection().find({ studentUserId: userId }).sort({ createdAt: -1 }).limit(50).toArray()
    ]);

    const weeks = Array.from({ length: 6 }, (_, index) => {
      const start = addDays(firstWeek, index * 7);
      const end = addDays(start, 6);
      const inWeek = value => value && dayKey(value) >= start && dayKey(value) <= end;
      const weekScores = results.filter(row => inWeek(row.createdAt) && typeof row.score === 'number').map(row => row.score);
      return {
        baslangic: start,
        dakika: logs.filter(log => log.day >= start && log.day <= end).reduce((sum, log) => sum + log.minutes, 0),
        testSayisi: weekScores.length,
        testOrtalama: average(weekScores),
        teslimEdilenOdev: assignments.filter(item => inWeek(item.submittedAt)).length
      };
    });

    const homeworkIds = [...new Set(assignments.filter(item => typeof item.score === 'number').map(item => String(item.homeworkId)))]
      .map(objectId).filter(Boolean);
    const homeworks = homeworkIds.length ? await getHomeworkCollection().find({ _id: { $in: homeworkIds } }).toArray() : [];
    const topicByHomework = new Map(homeworks.map(item => [String(item._id), item.topic || item.title || 'Genel çalışma']));
    const scoresByTopic = new Map();
    assignments.filter(item => typeof item.score === 'number').forEach(item => {
      const topic = topicByHomework.get(String(item.homeworkId)) || 'Genel çalışma';
      scoresByTopic.set(topic, [...(scoresByTopic.get(topic) || []), item.score]);
    });
    const topicScores = [...scoresByTopic].map(([topic, scores]) => ({ konu: topic, ortalama: average(scores), sayi: scores.length }));

    const guclu = [
      ...topicScores.filter(item => item.ortalama >= 80).map(item => ({ konu: item.konu, kaynak: `Ödev ortalaması %${item.ortalama}` })),
      ...progress.filter(item => item.status === 'tamamlandi').map(item => ({ konu: item.topic, kaynak: 'Kazanım tamamlandı' }))
    ].slice(0, 8);
    const zayif = [
      ...topicScores.filter(item => item.ortalama < 50).map(item => ({ konu: item.konu, kaynak: `Ödev ortalaması %${item.ortalama}` })),
      ...progress.filter(item => item.status === 'eksik').map(item => ({ konu: item.topic, kaynak: 'Eksik kazanım' }))
    ].slice(0, 8);

    return {
      haftalar: weeks,
      konuBasarisi: topicScores,
      guclu,
      zayif,
      yorumlar: comments.map(item => ({
        id: String(item._id), tur: item.type, metin: item.text, ogretmen: item.teacherName || 'Öğretmen',
        createdAt: item.createdAt, veliDurumu: item.guardianStatus || null, veliTarihi: item.guardianSentAt || null,
        ozet: item.snapshot || null
      }))
    };
  }

  async function buildAll(userId, grade) {
    const [ozet, kazanimlar, testler, takvim, rapor] = await Promise.all([
      buildSummary(userId), buildProgress(userId, grade), buildTests(userId), buildCalendar(userId), buildReport(userId)
    ]);
    return { ozet, kazanimlar, ...testler, takvim, rapor };
  }

  async function saveProgress(userId, kazanim, updatedBy) {
    const key = { studentUserId: userId, grade: kazanim.grade, unit: kazanim.unit, topic: kazanim.topic };
    if (kazanim.status === 'yok') {
      await getProgressCollection().deleteOne(key);
      return;
    }
    const existing = await getProgressCollection().findOne(key);
    const fields = { status: kazanim.status, updatedBy, updatedAt: new Date() };
    if (existing) await getProgressCollection().updateOne({ _id: existing._id }, { $set: fields });
    else await getProgressCollection().insertOne({ ...key, ...fields });
  }

  async function saveGoal(userId, minutes) {
    const existing = await getGoalCollection().findOne({ studentUserId: userId });
    const fields = { weeklyMinutes: minutes, updatedAt: new Date() };
    if (existing) await getGoalCollection().updateOne({ _id: existing._id }, { $set: fields });
    else await getGoalCollection().insertOne({ studentUserId: userId, ...fields });
  }

  function validGoal(value) {
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes >= 30 && minutes <= 4200 ? minutes : null;
  }

  // ---------- Öğrenci ----------
  student.get('/ozet', asyncRoute(async (req, res) => {
    const grade = await linkedGrade(req.session.user.id);
    res.json({ ...(await buildSummary(req.session.user.id)), sinif: grade });
  }));

  student.get('/kazanimlar', asyncRoute(async (req, res) => {
    const grade = Number(req.query.grade) || await linkedGrade(req.session.user.id);
    res.json({ sinif: grade, kazanimlar: await buildProgress(req.session.user.id, grade) });
  }));

  student.put('/kazanimlar', asyncRoute(async (req, res) => {
    const kazanim = validKazanim(req.body);
    if (!kazanim) return res.status(400).json({ mesaj: 'Sınıf, ünite, konu ve geçerli bir durum gereklidir.' });
    await saveProgress(req.session.user.id, kazanim, 'student');
    res.json({ mesaj: 'Kazanım durumu kaydedildi.' });
  }));

  student.get('/testler', asyncRoute(async (req, res) => res.json(await buildTests(req.session.user.id))));
  student.get('/takvim', asyncRoute(async (req, res) => res.json({ olaylar: await buildCalendar(req.session.user.id) })));
  student.get('/rapor', asyncRoute(async (req, res) => res.json(await buildReport(req.session.user.id))));

  student.post('/calisma', asyncRoute(async (req, res) => {
    const minutes = Number(req.body?.minutes);
    const today = dayKey(new Date());
    const day = metin(req.body?.day, 10) || today;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || day < addDays(today, -60)) {
      return res.status(400).json({ mesaj: 'Süre 1–600 dakika olmalı; tarih son 60 gün içinde ve gelecekte olmayan bir gün olmalıdır.' });
    }
    await getStudyLogCollection().insertOne({
      studentUserId: req.session.user.id, day, minutes,
      topic: metin(req.body?.topic, 200), note: metin(req.body?.note, 500), createdAt: new Date()
    });
    res.status(201).json({ mesaj: 'Çalışma süresi kaydedildi.' });
  }));

  student.delete('/calisma/:id', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({ mesaj: 'Kayıt numarası geçersiz.' });
    const result = await getStudyLogCollection().deleteOne({ _id: id, studentUserId: req.session.user.id });
    if (!result.deletedCount) return res.status(404).json({ mesaj: 'Kayıt bulunamadı.' });
    res.json({ mesaj: 'Kayıt silindi.' });
  }));

  student.put('/hedef', asyncRoute(async (req, res) => {
    const minutes = validGoal(req.body?.weeklyMinutes);
    if (!minutes) return res.status(400).json({ mesaj: 'Haftalık hedef 30–4200 dakika arasında olmalıdır.' });
    await saveGoal(req.session.user.id, minutes);
    res.json({ mesaj: 'Haftalık hedef kaydedildi.', weeklyMinutes: minutes });
  }));

  student.post('/hatirlatici', asyncRoute(async (req, res) => {
    const title = metin(req.body?.title, 150);
    const startsAt = new Date(req.body?.startsAt);
    if (!title || !Number.isFinite(startsAt.getTime())) {
      return res.status(400).json({ mesaj: 'Hatırlatıcı başlığı ve geçerli bir tarih/saat gereklidir.' });
    }
    await getEventCollection().insertOne({
      studentUserId: req.session.user.id, kind: 'hatirlatma', title, startsAt,
      note: metin(req.body?.note, 500), createdBy: 'student', createdAt: new Date()
    });
    res.status(201).json({ mesaj: 'Hatırlatıcı eklendi.' });
  }));

  student.delete('/hatirlatici/:id', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({ mesaj: 'Hatırlatıcı numarası geçersiz.' });
    const result = await getEventCollection().deleteOne({
      _id: id, studentUserId: req.session.user.id, createdBy: 'student'
    });
    if (!result.deletedCount) return res.status(404).json({ mesaj: 'Hatırlatıcı bulunamadı.' });
    res.json({ mesaj: 'Hatırlatıcı silindi.' });
  }));

  // ---------- Öğretmen ----------
  async function ownedLinkedProfile(req, res) {
    const id = objectId(req.params.id);
    if (!id) {
      res.status(400).json({ mesaj: 'Öğrenci numarası geçersiz.' });
      return null;
    }
    const profile = await getStudentCollection().findOne({ _id: id, teacherId: req.session.user.id });
    if (!profile) {
      res.status(404).json({ mesaj: 'Öğrenci bulunamadı.' });
      return null;
    }
    if (!profile.linkedUserId) {
      res.status(409).json({ mesaj: 'Öğrenci hesabını davet koduyla bağlamadan gelişim verisi girilemez.' });
      return null;
    }
    return profile;
  }

  teacher.get('/ogrenciler/:id', asyncRoute(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) return res.status(400).json({ mesaj: 'Öğrenci numarası geçersiz.' });
    const profile = await getStudentCollection().findOne({ _id: id, teacherId: req.session.user.id });
    if (!profile) return res.status(404).json({ mesaj: 'Öğrenci bulunamadı.' });
    if (!profile.linkedUserId) return res.json({ bagli: false, sinif: profile.grade });
    res.json({ bagli: true, sinif: profile.grade, ...(await buildAll(profile.linkedUserId, profile.grade)) });
  }));

  teacher.put('/ogrenciler/:id/kazanim', asyncRoute(async (req, res) => {
    const profile = await ownedLinkedProfile(req, res);
    if (!profile) return;
    const kazanim = validKazanim(req.body);
    if (!kazanim) return res.status(400).json({ mesaj: 'Sınıf, ünite, konu ve geçerli bir durum gereklidir.' });
    await saveProgress(profile.linkedUserId, kazanim, 'teacher');
    res.json({ mesaj: 'Kazanım durumu güncellendi.' });
  }));

  teacher.put('/ogrenciler/:id/hedef', asyncRoute(async (req, res) => {
    const profile = await ownedLinkedProfile(req, res);
    if (!profile) return;
    const minutes = validGoal(req.body?.weeklyMinutes);
    if (!minutes) return res.status(400).json({ mesaj: 'Haftalık hedef 30–4200 dakika arasında olmalıdır.' });
    await saveGoal(profile.linkedUserId, minutes);
    res.json({ mesaj: 'Haftalık hedef kaydedildi.' });
  }));

  teacher.post('/ogrenciler/:id/olaylar', asyncRoute(async (req, res) => {
    const profile = await ownedLinkedProfile(req, res);
    if (!profile) return;
    const kind = req.body?.kind;
    const title = metin(req.body?.title, 150);
    const startsAt = new Date(req.body?.startsAt);
    if (!['gorusme', 'sinav'].includes(kind) || !title || !Number.isFinite(startsAt.getTime())) {
      return res.status(400).json({ mesaj: 'Tür (görüşme/sınav), başlık ve geçerli bir tarih/saat gereklidir.' });
    }
    await getEventCollection().insertOne({
      studentUserId: profile.linkedUserId, studentProfileId: profile._id, teacherId: req.session.user.id,
      kind, title, startsAt, note: metin(req.body?.note, 500), createdBy: 'teacher', createdAt: new Date()
    });
    res.status(201).json({ mesaj: 'Takvim kaydı eklendi.' });
  }));

  teacher.delete('/olaylar/:eventId', asyncRoute(async (req, res) => {
    const id = objectId(req.params.eventId);
    if (!id) return res.status(400).json({ mesaj: 'Kayıt numarası geçersiz.' });
    const result = await getEventCollection().deleteOne({ _id: id, teacherId: req.session.user.id });
    if (!result.deletedCount) return res.status(404).json({ mesaj: 'Kayıt bulunamadı.' });
    res.json({ mesaj: 'Takvim kaydı silindi.' });
  }));

  teacher.post('/ogrenciler/:id/yorumlar', asyncRoute(async (req, res) => {
    const profile = await ownedLinkedProfile(req, res);
    if (!profile) return;
    const text = metin(req.body?.text, 2000);
    const type = req.body?.type === 'rapor' ? 'rapor' : 'yorum';
    if (!text) return res.status(400).json({ mesaj: 'Yorum veya rapor metni boş olamaz.' });
    const record = {
      teacherId: req.session.user.id, teacherName: req.session.user.name || 'Öğretmen',
      studentProfileId: profile._id, studentUserId: profile.linkedUserId,
      type, text, createdAt: new Date()
    };
    if (type === 'rapor') {
      const summary = await buildSummary(profile.linkedUserId);
      record.guardianStatus = 'bekliyor';
      record.snapshot = {
        haftalikDakika: summary.haftalikDakika, haftalikHedef: summary.haftalikHedef, seri: summary.seri,
        testOrtalama: summary.testBasarisi.ortalama, tamamlananKonu: summary.tamamlananKonu, odev: summary.odev
      };
    }
    await getCommentCollection().insertOne(record);
    res.status(201).json({ mesaj: type === 'rapor' ? 'Rapor kaydedildi.' : 'Yorum kaydedildi.' });
  }));

  teacher.patch('/yorumlar/:commentId/veli', asyncRoute(async (req, res) => {
    const id = objectId(req.params.commentId);
    if (!id) return res.status(400).json({ mesaj: 'Rapor numarası geçersiz.' });
    const result = await getCommentCollection().updateOne(
      { _id: id, teacherId: req.session.user.id, type: 'rapor' },
      { $set: { guardianStatus: 'iletildi', guardianSentAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ mesaj: 'Rapor bulunamadı.' });
    res.json({ mesaj: 'Rapor veliye iletildi olarak işaretlendi.' });
  }));

  teacher.delete('/yorumlar/:commentId', asyncRoute(async (req, res) => {
    const id = objectId(req.params.commentId);
    if (!id) return res.status(400).json({ mesaj: 'Kayıt numarası geçersiz.' });
    const result = await getCommentCollection().deleteOne({ _id: id, teacherId: req.session.user.id });
    if (!result.deletedCount) return res.status(404).json({ mesaj: 'Kayıt bulunamadı.' });
    res.json({ mesaj: 'Kayıt silindi.' });
  }));

  return { teacher, student };
}

module.exports = { createGelisimRouters, calculateStreak, weekStart, addDays, dayKey, mapResult };
