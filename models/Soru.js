const mongoose = require('mongoose');

const soruSchema = new mongoose.Schema({
  // Mükerrer kaydı veritabanı seviyesinde engelleyen benzersiz anahtar.
  imageUrl: { type: String, required: true, unique: true, trim: true, maxlength: 500 },
  imageFile: { type: String, required: true, trim: true, maxlength: 200 },
  ders: { type: String, default: 'genel', trim: true, lowercase: true, maxlength: 60, index: true },
  siraNo: { type: Number, default: null },
  answer: { type: String, enum: ['A', 'B', 'C', 'D', 'E', null], default: null },
  createdBy: { type: String, default: 'script', maxlength: 60 }
}, { timestamps: true, collection: 'sorular' });

module.exports = mongoose.models.Soru || mongoose.model('Soru', soruSchema);
