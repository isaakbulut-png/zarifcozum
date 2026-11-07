const mongoose = require('mongoose');

const lessonAttendanceSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  meetingId: { type: String, required: true },
  title: { type: String, trim: true, maxlength: 200, default: 'Canlı ders' },
  firstJoinedAt: { type: Date, required: true },
  lastJoinedAt: { type: Date, required: true },
  joinCount: { type: Number, min: 1, default: 1 }
}, {
  versionKey: false,
  collection: 'lesson_attendances'
});

lessonAttendanceSchema.index(
  { studentId: 1, meetingId: 1 },
  { unique: true, name: 'uniq_student_lesson_attendance' }
);
lessonAttendanceSchema.index(
  { studentId: 1, lastJoinedAt: -1 },
  { name: 'student_lesson_attendance_history' }
);

module.exports = mongoose.models.LessonAttendance ||
  mongoose.model('LessonAttendance', lessonAttendanceSchema);
