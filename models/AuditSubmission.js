const mongoose = require('mongoose');

const auditSubmissionSchema = new mongoose.Schema({
  contentType: { type: String, enum: ['questions', 'lesson'], required: true, index: true },
  grade: { type: Number, required: true, min: 1, max: 12, index: true },
  topic: { type: String, default: 'Matematik', trim: true, maxlength: 220 },
  title: { type: String, default: '', trim: true, maxlength: 220 },
  submittedBy: { type: String, required: true, index: true },
  submittedByName: { type: String, default: 'Öğretmen', trim: true, maxlength: 120 },
  itemCount: { type: Number, default: 0 },
  payload: { type: mongoose.Schema.Types.Mixed, default: [] },
  auditReport: {
    overallScore: { type: Number, default: 0 },
    verdict: { type: String, enum: ['approved', 'needs_review', 'rejected'], default: 'needs_review' },
    refereeUsed: { type: Boolean, default: false },
    items: { type: mongoose.Schema.Types.Mixed, default: [] }
  },
  adminStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  adminNote: { type: String, default: '', maxlength: 600 },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'audit_submissions'
});

module.exports = mongoose.models.AuditSubmission || mongoose.model('AuditSubmission', auditSubmissionSchema);
