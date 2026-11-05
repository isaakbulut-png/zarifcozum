const express = require('express');
const { ObjectId } = require('mongodb');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicLesson({ _id, title, startsAt, status, duration }) {
  return {
    id: String(_id),
    title,
    startsAt,
    status,
    duration
  };
}

function meetingSummary(lesson) {
  return {
    topic: lesson.topic,
    meetingNumber: lesson.meetingNumber,
    password: lesson.password,
    joinUrl: lesson.joinUrl || '',
    startedAt: lesson.startedAt
  };
}

function createLiveLessonsRouter({
  requireTeacher,
  requireStudent,
  getScheduledCollection,
  getActiveCollection,
  createMeeting,
  getHostStartUrl,
  endMeeting
}) {
  const router = express.Router();

  async function activeMeeting() {
    const collection = getActiveCollection();
    const lesson = await collection.findOne({ _id: 'aktif' });
    if (lesson && lesson.expiresAt <= new Date()) {
      await collection.deleteOne({ _id: 'aktif' });
      return null;
    }
    return lesson;
  }

  router.get('/api/ogretmen/canli/planlar', requireTeacher, asyncRoute(async (req, res) => {
    const lessons = await getScheduledCollection().find({
      kind: 'live',
      createdBy: req.session.user.id
    }).sort({ startsAt: 1 }).limit(50).toArray();
    res.json({ dersler: lessons.map(publicLesson) });
  }));

  router.post('/api/ogretmen/canli/planla', requireTeacher, asyncRoute(async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const startsAt = new Date(req.body?.startsAt);
    const duration = Number(req.body?.duration ?? 60);
    if (!title || title.length > 200 || !Number.isFinite(startsAt.getTime()) ||
        startsAt <= new Date() || !Number.isInteger(duration) || duration < 5 || duration > 300) {
      return res.status(400).json({ mesaj: 'Ders adı, gelecekte bir tarih/saat ve 5–300 dakika süre girin.' });
    }

    const meeting = await createMeeting({ topic: title, startTime: startsAt, duration });
    if (!meeting?.id || !meeting.joinUrl) {
      const error = new Error('Zoom planlı ders bilgileri eksik döndü; ders kaydedilemedi.');
      error.status = 502;
      throw error;
    }
    const lesson = {
      kind: 'live',
      title,
      topic: meeting.topic || title,
      startsAt: meeting.startTime ? new Date(meeting.startTime) : startsAt,
      duration: meeting.duration || duration,
      meetingId: String(meeting.id),
      meetingNumber: String(meeting.id),
      password: meeting.password || '',
      joinUrl: meeting.joinUrl || '',
      hostUserId: process.env.ZOOM_HOST_USER_ID || '',
      status: 'scheduled',
      createdBy: req.session.user.id,
      createdAt: new Date()
    };
    const result = await getScheduledCollection().insertOne(lesson);
    res.status(201).json({
      mesaj: 'Canlı ders planlandı. Öğrenciler ders saatini panellerinden görebilir.',
      ders: publicLesson({ _id: result.insertedId, ...lesson })
    });
  }));

  router.post('/api/ogretmen/canli/planlar/:id/baslat', requireTeacher, asyncRoute(async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Ders kimliği geçersiz.' });
    const scheduled = getScheduledCollection();
    const lesson = await scheduled.findOne({ _id: new ObjectId(req.params.id), kind: 'live' });
    if (!lesson || lesson.createdBy !== req.session.user.id) {
      return res.status(404).json({ mesaj: 'Planlı canlı ders bulunamadı.' });
    }
    if (lesson.status !== 'scheduled') {
      return res.status(409).json({ mesaj: 'Bu canlı ders başlatılamaz; durumu değişmiş.' });
    }
    if (new Date(lesson.startsAt) > new Date()) {
      return res.status(409).json({ mesaj: 'Canlı ders, planlanan tarih ve saatte başlatılabilir.' });
    }
    if (await activeMeeting()) {
      return res.status(409).json({ mesaj: 'Zaten aktif bir canlı ders var.' });
    }

    const startedAt = new Date();
    const active = {
      _id: 'aktif',
      meetingId: lesson.meetingId,
      meetingNumber: lesson.meetingNumber,
      password: lesson.password,
      topic: lesson.topic,
      joinUrl: lesson.joinUrl,
      hostUserId: lesson.hostUserId,
      scheduledLessonId: lesson._id,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 8 * 60 * 60 * 1000)
    };
    const startUrl = await getHostStartUrl(lesson);
    if (!startUrl) {
      const error = new Error('Öğretmen için Zoom başlatma bağlantısı alınamadı.');
      error.status = 502;
      throw error;
    }
    await getActiveCollection().updateOne({ _id: 'aktif' }, { $set: active }, { upsert: true });
    await scheduled.updateOne({ _id: lesson._id }, { $set: { status: 'active', startedAt } });
    res.json({ mesaj: 'Canlı ders başlatıldı.', ...meetingSummary(active), startUrl });
  }));

  router.post('/api/ogretmen/canli/baslat', requireTeacher, asyncRoute(async (req, res) => {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    if (!topic || topic.length > 200) return res.status(400).json({ mesaj: 'Ders konusu 1–200 karakter olmalıdır.' });
    const existing = await activeMeeting();
    if (existing) {
      return res.status(409).json({ mesaj: 'Zaten aktif bir canlı ders var.', ...meetingSummary(existing) });
    }
    const meeting = await createMeeting({ topic });
    if (!meeting?.id || !meeting.joinUrl) {
      const error = new Error('Zoom toplantı bilgileri eksik döndü; canlı ders başlatılamadı.');
      error.status = 502;
      throw error;
    }
    const startedAt = new Date();
    const lesson = {
      _id: 'aktif',
      meetingId: String(meeting.id),
      meetingNumber: String(meeting.id),
      password: meeting.password || '',
      topic: meeting.topic || topic,
      joinUrl: meeting.joinUrl || '',
      hostUserId: process.env.ZOOM_HOST_USER_ID || '',
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 8 * 60 * 60 * 1000)
    };
    await getActiveCollection().updateOne({ _id: 'aktif' }, { $set: lesson }, { upsert: true });
    res.status(201).json({
      mesaj: 'Canlı ders oluşturuldu.',
      ...meetingSummary(lesson),
      startUrl: meeting.startUrl || ''
    });
  }));

  router.get('/api/ogretmen/canli/durum', requireTeacher, asyncRoute(async (req, res) => {
    const lesson = await activeMeeting();
    if (!lesson) return res.json({ aktif: false });
    res.json({
      aktif: true,
      ...meetingSummary(lesson),
      startUrl: await getHostStartUrl(lesson)
    });
  }));

  router.get('/api/canli/katilim', requireStudent, asyncRoute(async (req, res) => {
    const lesson = await activeMeeting();
    if (!lesson) return res.status(404).json({ mesaj: 'Şu anda aktif bir canlı ders yok.' });
    res.json(meetingSummary(lesson));
  }));

  router.post('/api/ogretmen/canli/sonlandir', requireTeacher, asyncRoute(async (req, res) => {
    const lesson = await activeMeeting();
    if (!lesson) return res.status(404).json({ mesaj: 'Aktif canlı ders bulunamadı.' });
    await endMeeting(lesson);
    if (lesson.scheduledLessonId) {
      await getScheduledCollection().updateOne(
        { _id: lesson.scheduledLessonId },
        { $set: { status: 'completed', endedAt: new Date() } }
      );
    }
    await getActiveCollection().deleteOne({ _id: 'aktif' });
    res.json({ mesaj: 'Canlı ders sonlandırıldı.' });
  }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Canlı ders işlemi başarısız:', error);
    res.status(error.status || 500).json({
      mesaj: error.message || 'Canlı ders işlemi başarısız.'
    });
  });

  return router;
}

module.exports = { createLiveLessonsRouter };
