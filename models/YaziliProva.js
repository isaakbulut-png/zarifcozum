const mongoose = require('mongoose');

const yaziliSoruSchema = new mongoose.Schema({
  soruNo: {
    type: Number,
    required: true
  },
  metin: {
    type: String,
    required: true
  },
  resimUrl: {
    type: String,
    default: null
  },
  puan: {
    type: Number,
    default: 10
  },
  kazanimKodu: {
    type: String,
    default: null
  },
  cozumMetni: {
    type: String,
    default: ''
  },
  cozumVideoUrl: {
    type: String,
    default: null
  }
}, { _id: false });

const yaziliProvaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 250
  },
  grade: {
    type: Number,
    required: true,
    enum: [5, 6, 7, 8, 9, 10, 11, 12],
    index: true
  },
  donem: {
    type: String,
    required: true,
    enum: ['1_donem_1_yazili', '1_donem_2_yazili', '2_donem_1_yazili', '2_donem_2_yazili'],
    index: true
  },
  senaryoNo: {
    type: Number,
    default: 1
  },
  aciklama: {
    type: String,
    default: 'MEB Ortak Sınav Formatına ve Yeni Maarif Modeline Tam Uyumlu Açık Uçlu Soru Senaryosu.'
  },
  sorular: [yaziliSoruSchema],
  toplamPuan: {
    type: Number,
    default: 100
  },
  pdfUrl: {
    type: String,
    default: null
  },
  published: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

yaziliProvaSchema.index({ published: 1, grade: 1, donem: 1 });

module.exports = mongoose.models.YaziliProva || mongoose.model('YaziliProva', yaziliProvaSchema);
