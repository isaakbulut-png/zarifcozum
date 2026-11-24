const mongoose = require('mongoose');

const studentTopicProgressSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    index: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CurriculumContent',
    required: true,
    index: true
  },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true
  },
  themeCode: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  themeTitle: {
    type: String,
    trim: true,
    default: ''
  },
  subTopicTitle: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
    index: true
  },
  lastPage: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'student_topic_progress'
});

studentTopicProgressSchema.index({ studentId: 1, topicId: 1 }, { unique: true });
studentTopicProgressSchema.index({ studentId: 1, lastAccessedAt: -1 });

module.exports = mongoose.models.StudentTopicProgress || mongoose.model('StudentTopicProgress', studentTopicProgressSchema);
