const express = require('express');
const {createCurriculumService} = require('../lib/curriculumService');

function isLikelyHint(message) {
  return /(ipucu|ipuç|deneyelim|birlikte|önce)/i.test(message);
}

function demoDashboard(student) {
  const now = new Date();
  const earlier = new Date(now.getTime() - 60 * 60 * 1000);
  return {
    student,
    summary: {
      messageCount: 4,
      questionCount: 2,
      aiResponseCount: 2,
      hintCount: 1,
      lastActivityAt: now,
      liveLessonCount: 1
    },
    liveLessons: [{
      meetingId: 'demo-lesson',
      title: 'Örnek canlı ders',
      firstJoinedAt: earlier,
      lastActivityAt: now,
      joinCount: 1,
      messageCount: 2
    }],
    recentMessages: [
      {sender: 'user', message: 'Kesirleri nasıl karşılaştırabilirim?', roomName: 'assistant', createdAt: earlier, isHint: false},
      {sender: 'ai', message: 'Önce paydaları eşitlemeyi deneyelim.', roomName: 'assistant', createdAt: now, isHint: true}
    ],
    demo: true
  };
}

function demoReport(studentId, reason) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return {
    student_id: studentId,
    week_start: weekStart,
    week_end: weekEnd,
    completed_assignments: 3,
    average_success_percent: 78,
    critical_gaps: [
      {curriculum_node_id: 'demo-gap-1', title: 'Örnek kazanım: kesirleri karşılaştırma', code: 'DEMO.1', success_percent: 45},
      {curriculum_node_id: 'demo-gap-2', title: 'Örnek kazanım: problem çözme', code: 'DEMO.2', success_percent: 55}
    ],
    demo: true,
    demo_reason: reason
  };
}

function reportServiceFailure(res, studentId, error, demoMode) {
  console.error('Veli haftalık rapor servisi başarısız:', error.code || error.message || error);
  if (demoMode) {
    res.set('Cache-Control', 'private, no-store');
    return res.json(demoReport(studentId, error.code === 'CURRICULUM_NOT_CONFIGURED'
      ? 'service_not_configured' : 'service_unavailable'));
  }
  if (error.status === 404) {
    return res.status(404).json({
      kod: 'PARENT_REPORT_NOT_FOUND',
      mesaj: 'Bu öğrenci için haftalık karne bulunamadı.'
    });
  }

  const code = error.code === 'CURRICULUM_NOT_CONFIGURED'
    ? 'CURRICULUM_SERVICE_NOT_CONFIGURED'
    : error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED'
      ? 'CURRICULUM_SERVICE_UNREACHABLE'
      : 'CURRICULUM_REPORT_FAILED';
  const message = code === 'CURRICULUM_SERVICE_NOT_CONFIGURED'
    ? 'CURRICULUM_SERVICE_TOKEN eksik veya geçersiz; .env içinde en az 32 karakter olmalıdır.'
    : code === 'CURRICULUM_SERVICE_UNREACHABLE'
      ? 'Python servisine bağlanılamadı. 8000 portunda FastAPI servisini başlatın.'
      : 'Haftalık öğrenme karnesi alınamadı.';
  return res.status(code === 'CURRICULUM_REPORT_FAILED' ? 502 : 503)
    .json({kod: code, mesaj: message});
}

function createParentRouter({
  requireParent,
  requireReportAccess = requireParent,
  ParentModel,
  UserModel,
  ChatMessageModel,
  LessonAttendanceModel,
  getStudentCollection,
  service = createCurriculumService(),
  demoMode = false
}) {
  const router = express.Router();

  router.get('/dashboard', requireParent, async (req, res) => {
    try {
      const parent = await ParentModel.findById(req.session.user.id).select('studentId restricted').lean();
      if (!parent || parent.restricted) {
        return res.status(parent?.restricted ? 403 : 401).json({ mesaj: 'Veli hesabı doğrulanamadı.' });
      }

      const student = await UserModel.findOne({
        _id: parent.studentId,
        role: 'student',
        restricted: { $ne: true }
      }).select('name role').lean();
      if (!student) return res.status(404).json({ mesaj: 'Bağlı öğrenci hesabı bulunamadı.' });

      const [profile, records, attendance] = await Promise.all([
        getStudentCollection().findOne({ linkedUserId: String(student._id), active: true }),
        ChatMessageModel.find({ userId: String(student._id) })
          .sort({ createdAt: -1, _id: -1 })
          .limit(100)
          .select('roomName sender message createdAt')
          .lean()
          .exec(),
        LessonAttendanceModel.find({ studentId: String(student._id) })
          .sort({ lastJoinedAt: -1 })
          .limit(30)
          .lean()
          .exec()
      ]);
      const studentSummary = {
        name: student.name,
        grade: profile?.grade || null,
        section: profile?.section || ''
      };
      if (demoMode && records.length === 0 && attendance.length === 0) {
        res.set('Cache-Control', 'private, no-store');
        return res.json(demoDashboard(studentSummary));
      }

      const messages = records.reverse();
      const liveLessonsByRoom = new Map(attendance.map(record => [record.meetingId, {
        meetingId: record.meetingId,
        title: record.title || 'Canlı ders',
        firstJoinedAt: record.firstJoinedAt,
        lastActivityAt: record.lastJoinedAt,
        joinCount: record.joinCount,
        messageCount: 0
      }]));
      for (const record of records) {
        if (record.roomName === 'assistant') continue;
        const lesson = liveLessonsByRoom.get(record.roomName) || {
          meetingId: record.roomName,
          title: 'Canlı ders',
          firstJoinedAt: record.createdAt,
          lastActivityAt: record.createdAt,
          joinCount: 0,
          messageCount: 0
        };
        lesson.messageCount += 1;
        if (record.createdAt > lesson.lastActivityAt) lesson.lastActivityAt = record.createdAt;
        liveLessonsByRoom.set(record.roomName, lesson);
      }

      const userMessages = messages.filter(message => message.sender === 'user');
      const aiMessages = messages.filter(message => message.sender === 'ai');
      const hints = aiMessages.filter(message => isLikelyHint(message.message));
      res.set('Cache-Control', 'private, no-store');
      res.json({
        student: studentSummary,
        summary: {
          messageCount: messages.length,
          questionCount: userMessages.length,
          aiResponseCount: aiMessages.length,
          hintCount: hints.length,
          lastActivityAt: messages.at(-1)?.createdAt || null,
          liveLessonCount: liveLessonsByRoom.size
        },
        liveLessons: [...liveLessonsByRoom.values()]
          .sort((left, right) => new Date(right.lastActivityAt) - new Date(left.lastActivityAt)),
        recentMessages: messages.slice(-30).map(message => ({
          sender: message.sender,
          message: message.message,
          roomName: message.roomName,
          createdAt: message.createdAt,
          isHint: message.sender === 'ai' && isLikelyHint(message.message)
        })),
        demo: false
      });
    } catch (error) {
      console.error('Veli paneli verileri alınamadı:', error);
      res.status(500).json({ mesaj: 'Veli paneli verileri alınamadı.' });
    }
  });

  router.get('/report', requireReportAccess, async (req, res) => {
    try {
      let studentId;
      if (req.session.user.role === 'parent') {
        const parent = await ParentModel.findById(req.session.user.id)
          .select('studentId restricted')
          .lean();
        if (!parent || parent.restricted) {
          return res.status(parent?.restricted ? 403 : 401).json({mesaj: 'Veli hesabı doğrulanamadı.'});
        }
        studentId = String(parent.studentId);
      } else {
        studentId = typeof req.query.student_id === 'string' ? req.query.student_id : '';
        if (!/^[a-f\d]{24}$/i.test(studentId)) {
          return res.status(400).json({mesaj: 'Yönetici için geçerli student_id gereklidir.'});
        }
      }

      const student = await UserModel.findOne({
        _id: studentId,
        role: 'student',
        restricted: {$ne: true}
      }).select('_id').lean();
      if (!student) return res.status(404).json({mesaj: 'Bağlı öğrenci hesabı bulunamadı.'});

      let response;
      try {
        response = await service.getParentReport(String(student._id));
      } catch (error) {
        return reportServiceFailure(res, String(student._id), error, demoMode);
      }
      if (response.status !== 200) {
        return reportServiceFailure(res, String(student._id), {
          status: response.status,
          code: 'CURRICULUM_SERVICE_UNAVAILABLE',
          message: `Python servisi HTTP ${response.status} döndürdü.`
        }, demoMode);
      }
      const report = response.data;
      const noReportData = report.completed_assignments === 0 &&
        report.average_success_percent == null &&
        Array.isArray(report.critical_gaps) && report.critical_gaps.length === 0;
      if (demoMode && noReportData) {
        res.set('Cache-Control', 'private, no-store');
        return res.json(demoReport(String(student._id), 'empty_data'));
      }
      res.set('Cache-Control', 'private, no-store');
      return res.json({...report, demo: false});
    } catch (error) {
      console.error('Veli haftalık raporu alınamadı:', error.code || error.message);
      return res.status(500).json({kod: 'PARENT_REPORT_FAILED', mesaj: 'Haftalık öğrenme karnesi alınamadı.'});
    }
  });

  return router;
}

module.exports = { createParentRouter };
