const mongoose = require('mongoose');

const illustrationSchema = new mongoose.Schema({
  id: { type: String, default: '' },
  prompt: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const curriculumContentSchema = new mongoose.Schema({
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true
  },
  subject: {
    type: String,
    required: true,
    default: 'Matematik',
    trim: true,
    index: true
  },
  unit_topic: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  sub_topic: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  outcome_code: {
    type: String,
    trim: true,
    default: ''
  },
  short_summary: {
    type: String,
    default: '',
    maxlength: 3000
  },
  detailed_content: {
    type: String,
    required: true,
    default: ''
  },
  illustrations: [illustrationSchema],
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published',
    index: true
  },
  teacherNotes: {
    type: String,
    default: '',
    maxlength: 2000
  },
  createdBy: {
    type: String,
    default: 'teacher',
    index: true
  }
}, {
  timestamps: true,
  collection: 'curriculum_contents'
});

// Tekil bileşik indeks: Aynı sınıf, ders, tema ve alt konu için tekil veya upsert edilebilir kayıt
curriculumContentSchema.index(
  { grade: 1, subject: 1, unit_topic: 1, sub_topic: 1 },
  { unique: true }
);

module.exports = mongoose.models.CurriculumContent || mongoose.model('CurriculumContent', curriculumContentSchema);
