const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  roomName: { type: String, required: true, maxlength: 128 },
  sender: { type: String, enum: ['user', 'ai'], required: true },
  message: { type: String, required: true, maxlength: 12000 },
  richHtml: { type: String, maxlength: 12000 },
  createdAt: { type: Date, default: Date.now, required: true }
}, {
  versionKey: false,
  collection: 'chat_messages'
});

chatMessageSchema.index(
  { userId: 1, roomName: 1, createdAt: -1, _id: -1 },
  { name: 'user_room_chat_history' }
);

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
