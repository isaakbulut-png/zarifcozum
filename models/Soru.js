const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  label: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
  text: { type: String, required: true, maxlength: 1000 }
}, { _id: false });

const soruSchema = new mongoose.Schema({
  format: {
    type: String,
    enum: ['image', 'text_svg', 'hybrid'],
    default: 'image',
    index: true
  },
  // Resim tabanlı sorularda dolu; metin tabanlı sorularda boş kalabilir.
  imageUrl: { type: String, trim: true, maxlength: 500, sparse: true },
  imageFile: { type: String, trim: true, maxlength: 200, default: '' },
  // Metin ve SVG tabanlı AI soruları için
  text: { type: String, maxlength: 4000, default: '' },
  options: [optionSchema],
  explanation: { type: String, maxlength: 4000, default: '' },
  svg: { type: String, default: '' },
  grade: { type: Number, min: 5, max: 12, index: true },
  topic: { type: String, maxlength: 250, trim: true, index: true },
  difficulty: { type: String, enum: ['kolay', 'orta', 'zor', null], default: null, index: true },
  ders: { type: String, default: 'matematik', trim: true, lowercase: true, maxlength: 60, index: true },
  siraNo: { type: Number, default: null },
  // Cloudinary'e yüklenen resimlerde dolu; klasörden taranan kayıtlarda hiç yazılmaz (sparse indeks).
  cloudinaryPublicId: { type: String, maxlength: 200, index: { unique: true, sparse: true } },
  answer: { type: String, enum: ['A', 'B', 'C', 'D', 'E', null], default: null },
  curriculum_node_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  source: {
    type: String,
    enum: ['manual', 'ai_generated', 'script', 'teacher_upload'],
    default: 'manual',
    index: true
  },
  draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiQuestionDraft', default: null },
  pineconeId: { type: String, default: null },
  createdBy: { type: String, default: 'system', maxlength: 60 }
}, { timestamps: true, collection: 'sorular' });

// Otomatik seçenek eşleme: { A: '...', B: '...' } nesnesi verilirse [{ label: 'A', text: '...' }] dizisine dönüştürür.
soruSchema.pre('validate', function(next) {
  if (this.options && typeof this.options === 'object' && !Array.isArray(this.options)) {
    this.options = Object.entries(this.options).map(([label, text]) => ({ label, text: String(text) }));
  }
  next();
});

soruSchema.index({ grade: 1, topic: 1 });
soruSchema.index({ ders: 1, siraNo: 1 });

module.exports = mongoose.models.Soru || mongoose.model('Soru', soruSchema);
