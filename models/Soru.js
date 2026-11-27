const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  label: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
  text: { type: String, required: true, maxlength: 1000 }
}, { _id: false });

const soruSchema = new mongoose.Schema({
  format: {
    type: String,
    enum: ['image', 'text_svg', 'hybrid', 'open_ended'],
    default: 'image',
    index: true
  },
  // Resim tabanlı sorularda dolu; metin tabanlı sorularda boş kalabilir.
  imageUrl: { type: String, trim: true, maxlength: 500, sparse: true },
  imageFile: { type: String, trim: true, maxlength: 200, default: '' },
  // Metin ve SVG tabanlı AI soruları için
  text: { type: String, maxlength: 4000, default: '' },
  options: { type: mongoose.Schema.Types.Mixed, default: [] },
  explanation: { type: String, maxlength: 4000, default: '' },
  solution: { type: String, maxlength: 4000, default: '' },
  rubric: { type: mongoose.Schema.Types.Mixed, default: [] },
  outcomeCode: { type: String, maxlength: 60, default: '' },
  questionType: { type: String, enum: ['open_ended', 'multiple_choice'], default: 'open_ended', index: true },
  svg: { type: mongoose.Schema.Types.Mixed, default: '' },
  grade: { type: Number, min: 1, max: 12, index: true },
  topic: { type: String, maxlength: 250, trim: true, index: true },
  difficulty: { type: String, lowercase: true, trim: true, enum: ['kolay', 'orta', 'zor', null], default: null, index: true },
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
  createdBy: { type: String, default: 'system', maxlength: 60 },
  copyrightOwner: { type: String, default: 'ZarifÇözüm', immutable: true },
  license: { type: String, default: 'All Rights Reserved', immutable: true }
}, { timestamps: true, collection: 'sorular' });

// Otomatik seçenek, zorluk ve boş imageUrl temizliği
soruSchema.pre('validate', function() {
  if (this.difficulty && typeof this.difficulty === 'string') {
    this.difficulty = this.difficulty.trim().toLowerCase();
  }
  if (this.imageUrl === null || this.imageUrl === '') {
    this.imageUrl = undefined;
  }
  if (this.options && typeof this.options === 'object' && !Array.isArray(this.options)) {
    this.options = Object.entries(this.options).map(([label, text]) => ({ label, text: String(text) }));
  }
});

soruSchema.index({ grade: 1, topic: 1 });
soruSchema.index({ ders: 1, siraNo: 1 });

// Eski non-sparse unique imageUrl_1 indeksini güvenli partial unique indekse yükseltir
let imageUrlIndexCleaned = false;
soruSchema.statics.ensureCleanImageUrlIndex = async function(force = false) {
  if (imageUrlIndexCleaned && !force) return;
  try {
    const indexes = await this.collection.indexes();
    const legacy = indexes.find(idx => idx.name === 'imageUrl_1' && idx.unique && !idx.partialFilterExpression);
    if (legacy) {
      await this.collection.dropIndex('imageUrl_1');
      await this.collection.createIndex(
        { imageUrl: 1 },
        {
          name: 'imageUrl_1',
          unique: true,
          partialFilterExpression: { imageUrl: { $type: 'string', $gt: '' } }
        }
      );
      console.log('[Soru] Eski imageUrl_1 unique indeksi güvenli partialFilterExpression ile yenilendi.');
    }
    imageUrlIndexCleaned = true;
  } catch (err) {
    console.warn('[Soru] imageUrl_1 indeks kontrol uyarısı:', err.message);
  }
};

module.exports = mongoose.models.Soru || mongoose.model('Soru', soruSchema);
