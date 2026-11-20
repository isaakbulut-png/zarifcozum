const mongoose = require('mongoose');

const turkiyeGeneliDenemeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  grade: {
    type: Number,
    required: true,
    enum: [5, 6, 7, 8, 9, 10, 11, 12],
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  soruIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Soru'
  }],
  durationMinutes: {
    type: Number,
    default: 80,
    min: 10,
    max: 240
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  published: {
    type: Boolean,
    default: false,
    index: true
  },
  resultsAnnounced: {
    type: Boolean,
    default: false
  },
  totalParticipants: {
    type: Number,
    default: 0
  },
  averageNet: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

turkiyeGeneliDenemeSchema.index({ published: 1, grade: 1, startDate: 1 });

module.exports = mongoose.models.TurkiyeGeneliDeneme || mongoose.model('TurkiyeGeneliDeneme', turkiyeGeneliDenemeSchema);
