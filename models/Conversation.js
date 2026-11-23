const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student', 'parent'], required: true },
  relatedStudentName: { type: String, default: '' }
}, { _id: false });

const messageItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  senderId: { type: String, required: true },
  senderRole: { type: String, enum: ['teacher', 'student', 'parent'], required: true },
  text: { type: String, required: true, maxlength: 4000 },
  timestamp: { type: String, required: true }, // ISO 8601
  isRead: { type: Boolean, default: false }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  participants: { type: [participantSchema], default: [] },
  messages: { type: [messageItemSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, {
  versionKey: false,
  collection: 'conversations'
});

conversationSchema.index({ 'participants.userId': 1 });
conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
