const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  grade: { type: Number, required: true, min: 5, max: 12, index: true },
  unite: { type: String, required: true, maxlength: 300 },
  konu: { type: String, required: true, maxlength: 300 },
  baslik: { type: String, required: true, maxlength: 160 },
  image: { type: Buffer, required: true, select: false },
  imageType: { type: String, required: true, enum: ['image/png', 'image/jpeg', 'image/webp'] },
  createdBy: { type: String, required: true }
}, { timestamps: true, collection: 'cozumlu_sorular' });

schema.index({ grade: 1, unite: 1, konu: 1 });
module.exports = mongoose.models.CozumluSoru || mongoose.model('CozumluSoru', schema);
