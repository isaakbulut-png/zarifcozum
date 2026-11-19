const mongoose = require('mongoose');

const contentLibrarySchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 250, trim: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'ai_question',
      'ai_test',
      'ai_exam',
      'ai_topic_summary',
      'ai_study_plan',
      'pdf_document',
      'teacher_upload'
    ],
    index: true
  },
  ders: { type: String, default: 'matematik', trim: true, lowercase: true, maxlength: 60, index: true },
  grade: { type: Number, min: 1, max: 12, default: 8, index: true },
  topic: { type: String, maxlength: 250, trim: true, default: 'Genel', index: true },
  difficulty: { type: String, lowercase: true, trim: true, enum: ['kolay', 'orta', 'zor', null], default: null, index: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['draft', 'approved', 'archived'],
    default: 'approved',
    index: true
  },
  r2Key: { type: String, default: null, index: true },
  r2Url: { type: String, default: null },
  pineconeId: { type: String, default: null, index: true },
  source: {
    type: String,
    enum: ['ai', 'ai_mentor', 'ai_wizard', 'teacher', 'teacher_upload', 'admin', 'admin_import', 'manual'],
    default: 'ai',
    index: true
  },
  createdBy: { type: String, required: true, index: true }
}, {
  timestamps: true,
  collection: 'content_library'
});

// Getter / setter aliases for seamless compatibility
contentLibrarySchema.virtual('contentType')
  .get(function() { return this.type; })
  .set(function(v) { this.type = v; });

contentLibrarySchema.virtual('lesson')
  .get(function() { return this.ders; })
  .set(function(v) { this.ders = v; });

contentLibrarySchema.virtual('body')
  .get(function() { return typeof this.content === 'string' ? this.content : JSON.stringify(this.content); })
  .set(function(v) { this.content = v; });

// Pre-validate hook to map aliases before mongoose validation
contentLibrarySchema.pre('validate', function() {
  if (this.difficulty && typeof this.difficulty === 'string') {
    this.difficulty = this.difficulty.trim().toLowerCase();
  }
  if (!this.type && this.get('contentType')) this.type = this.get('contentType');
  if (!this.ders && this.get('lesson')) this.ders = this.get('lesson');
  if (!this.content && this.get('body')) this.content = this.get('body');
  if (typeof this.grade === 'string') {
    const num = parseInt(this.grade, 10);
    this.grade = isNaN(num) ? 8 : num;
  }
});

contentLibrarySchema.index({ type: 1, grade: 1, topic: 1 });
contentLibrarySchema.index({ ders: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.ContentLibrary || mongoose.model('ContentLibrary', contentLibrarySchema);
