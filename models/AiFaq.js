const mongoose = require('mongoose');

const aiFaqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 300 },
  normalizedQuestion: { type: String, required: true, maxlength: 300 },
  answerHtml: { type: String, required: true, maxlength: 12000 },
  answerText: { type: String, required: true, maxlength: 5000 },
  grade: { type: Number, min: 5, max: 12, default: null },
  scopeKey: { type: String, required: true, enum: ['all', '5', '6', '7', '8', '9', '10', '11', '12'] },
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'ai_faqs'
});

aiFaqSchema.index(
  { normalizedQuestion: 1, scopeKey: 1 },
  { unique: true, name: 'uniq_faq_question_scope' }
);
aiFaqSchema.index(
  { normalizedQuestion: 1, active: 1, grade: 1 },
  { name: 'faq_exact_match_lookup' }
);

module.exports = mongoose.models.AiFaq || mongoose.model('AiFaq', aiFaqSchema);
