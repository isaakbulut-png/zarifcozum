const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  actorId: { type: String, required: true, maxlength: 100 },
  actorName: { type: String, required: true, maxlength: 100 },
  action: { type: String, required: true, maxlength: 100 },
  entityType: { type: String, required: true, maxlength: 100 },
  entityId: { type: String, default: '', maxlength: 200 },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, collection: 'admin_logs', versionKey: false });

adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.models.AdminLog || mongoose.model('AdminLog', adminLogSchema);
