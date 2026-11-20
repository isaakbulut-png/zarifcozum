const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true
  },
  examType: {
    type: String,
    enum: ['konu_testi', 'deneme_sinavi'],
    required: true,
    index: true
  },
  unit_topic: {
    type: String,
    trim: true,
    maxlength: 250,
    default: null,
    index: true
  },
  sub_topic: {
    type: String,
    trim: true,
    maxlength: 250,
    default: null
  },
  questions: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Soru',
    required: true,
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0 && arr.length <= 100,
      message: 'En az 1, en fazla 100 soru gereklidir.'
    }
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 480
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: false,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, { timestamps: true, collection: 'exams' });

examSchema.index({ grade: 1, examType: 1 });
examSchema.index({ createdBy: 1, isPublished: 1 });

module.exports = mongoose.models.Exam || mongoose.model('Exam', examSchema);
