const mongoose = require('mongoose');

const draftQuestionItemSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 4000 },
  options: { type: mongoose.Schema.Types.Mixed, default: {} },
  answer: { type: String, default: null },
  explanation: { type: String, maxlength: 4000, default: '' },
  solution: { type: String, maxlength: 4000, default: '' },
  rubric: { type: mongoose.Schema.Types.Mixed, default: [] },
  outcomeCode: { type: String, maxlength: 60, default: '' },
  questionType: { type: String, default: 'open_ended' },
  svg: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  illustrasyon_promptu: { type: String, default: '' },
  curriculum_node_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' },
  similarityScore: { type: Number, min: 0, max: 100, default: 0 },
  similarQuestionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  approvedQuestionId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { _id: true });

const aiQuestionDraftSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200, trim: true },
  topic: { type: String, required: true, maxlength: 200, trim: true, index: true },
  grade: { type: Number, required: true, min: 1, max: 12, index: true },
  difficulty: {
    type: String,
    lowercase: true,
    trim: true,
    enum: ['kolay', 'orta', 'zor', null],
    default: 'orta',
    index: true
  },
  count: { type: Number, default: 1 },
  questions: [draftQuestionItemSchema],
  status: { type: String, enum: ['draft', 'approved', 'archived'], default: 'draft', index: true },
  source: { type: String, default: 'ai' },
  createdBy: { type: String, required: true, index: true }
}, {
  timestamps: true,
  collection: 'ai_question_drafts'
});

aiQuestionDraftSchema.pre('validate', function() {
  if (this.difficulty && typeof this.difficulty === 'string') {
    this.difficulty = this.difficulty.trim().toLowerCase();
  }
});

aiQuestionDraftSchema.index({ grade: 1, topic: 1, status: 1 });
aiQuestionDraftSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.models.AiQuestionDraft || mongoose.model('AiQuestionDraft', aiQuestionDraftSchema);
