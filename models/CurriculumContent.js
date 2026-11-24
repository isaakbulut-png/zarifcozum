const mongoose = require('mongoose');

const illustrationSchema = new mongoose.Schema({
  id: { type: String, default: '' },
  prompt: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const lessonPageSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true, min: 1, max: 10 },
  title: { type: String, default: '', trim: true, maxlength: 200 },
  storyOrContext: { type: String, default: '' },
  keyRuleBox: { type: String, default: '' },
  visualSvg: { type: String, default: '' },
  commonMistakeBox: { type: String, default: '' },
  miniChallenge: { type: String, default: '' },
  content: { type: String, default: '' },
  svgDiagram: { type: String, default: '' }
}, { _id: false });

const referenceBookPageSchema = new mongoose.Schema({
  book: { type: String, default: '', trim: true },
  theme: { type: String, default: '', trim: true },
  page: { type: Number, default: 0 },
  r2_key: { type: String, default: '', trim: true },
  imageUrl: { type: String, default: '', trim: true },
  contentType: { type: String, default: '', trim: true },
  score: { type: Number, default: 0 }
}, { _id: false });

const flashcardSchema = new mongoose.Schema({
  front: { type: String, required: true, trim: true, maxlength: 500 },
  back: { type: String, required: true, trim: true, maxlength: 1000 },
  tip: { type: String, default: '', trim: true, maxlength: 300 }
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
  themeCode: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  themeTitle: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  subTopicTitle: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  order: {
    type: Number,
    default: 0,
    index: true
  },
  title: {
    type: String,
    trim: true,
    default: ''
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
    default: ''
  },
  lessonPages: {
    type: [lessonPageSchema],
    default: []
  },
  practicalNotes: {
    type: [String],
    default: []
  },
  flashcards: {
    type: [flashcardSchema],
    default: []
  },
  referenceBookPages: {
    type: [referenceBookPageSchema],
    default: []
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
  },
  createdByName: {
    type: String,
    default: ''
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
curriculumContentSchema.index({ grade: 1, status: 1, order: 1 });

module.exports = mongoose.models.CurriculumContent || mongoose.model('CurriculumContent', curriculumContentSchema);
