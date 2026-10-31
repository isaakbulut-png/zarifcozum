const mongoose = require('mongoose');

const denemeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  // Soru sırası dizideki sıradır; öğrenciye bu sırayla gösterilir.
  soruIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Soru', required: true },
  published: { type: Boolean, default: true, index: true },
  herkeseAcik: { type: Boolean, default: false, index: true },
  createdBy: { type: String, default: null, maxlength: 60 }
}, { timestamps: true, collection: 'denemeler' });

module.exports = mongoose.models.Deneme || mongoose.model('Deneme', denemeSchema);
