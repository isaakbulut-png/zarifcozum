const express = require('express');

function isLikelyHint(message) {
  return /(ipucu|ipuç|deneyelim|birlikte|önce)/i.test(message);
}

function createParentRouter({
  requireParent,
  ParentModel,
  UserModel,
  ChatMessageModel,
  LessonAttendanceModel,
  getStudentCollection
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
        student: {
          name: student.name,
          grade: profile?.grade || null,
          section: profile?.section || ''
        },
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
        }))
      });
    } catch (error) {
      console.error('Veli paneli verileri alınamadı:', error);
      res.status(500).json({ mesaj: 'Veli paneli verileri alınamadı.' });
    }
  });

  return router;
}

module.exports = { createParentRouter };
