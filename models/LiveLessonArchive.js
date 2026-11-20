const mongoose = require('mongoose');

const liveLessonArchiveSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  topic: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  grade: {
    type: Number,
    required: true,
    enum: [5, 6, 7, 8, 9, 10, 11, 12],
    index: true
  },
  videoUrl: {
    type: String,
    required: true,
    trim: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  durationMinutes: {
    type: Number,
    default: 45
  },
  recordedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  teacherName: {
    type: String,
    default: 'Matematik Öğretmeni'
  },
  published: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true });

liveLessonArchiveSchema.index({ published: 1, grade: 1, recordedAt: -1 });

module.exports = mongoose.models.LiveLessonArchive || mongoose.model('LiveLessonArchive', liveLessonArchiveSchema);
