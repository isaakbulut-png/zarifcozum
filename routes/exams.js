const express = require('express');
const { ObjectId } = require('mongodb');
const Exam = require('../models/Exam');
const Soru = require('../models/Soru');

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function createExamsRouter({ requireStaff, requireStudent }) {
  const staff = express.Router();
  staff.use(requireStaff);

  /**
   * GET /api/exams
   * Öğretmen tarafından oluşturulan tüm sınavları listele
   */
  staff.get('/', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const skip = (page - 1) * limit;

      const exams = await Exam.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title grade examType unit_topic questions isPublished createdAt')
        .lean();

      const total = await Exam.countDocuments({});

      res.json({
        exams: exams.map(exam => ({
          id: exam._id.toString(),
          title: exam.title,
          grade: exam.grade,
          examType: exam.examType,
          unit_topic: exam.unit_topic,
          questionCount: exam.questions.length,
          isPublished: exam.isPublished,
          createdAt: exam.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('❌ Sınavlar listelenemedi:', err);
      res.status(500).json({ mesaj: 'Sınavlar listelenemedi.' });
    }
  });

  /**
   * POST /api/exams/generate
   * Otomatik soru seçimi ile sınav oluştur
   */
  staff.post('/generate', async (req, res) => {
    try {
      const { grade, examType, unit_topic, sub_topic, questionCount = 20, duration = 60, title } = req.body;

      // Validasyon
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ mesaj: 'grade 1 ile 12 arasında bir tam sayı olmalı.' });
      }

      if (!['konu_testi', 'deneme_sinavi'].includes(examType)) {
        return res.status(400).json({ mesaj: 'examType "konu_testi" veya "deneme_sinavi" olmalı.' });
      }

      if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
        return res.status(400).json({ mesaj: 'questionCount 1 ile 100 arasında olmalı.' });
      }

      if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
        return res.status(400).json({ mesaj: 'duration 1 ile 480 dakika arasında olmalı.' });
      }

      if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
        return res.status(400).json({ mesaj: 'title boş veya 200 karakterden fazla olamaz.' });
      }

      // Soru filtrelemesi
      const filter = { grade };
      if (unit_topic && typeof unit_topic === 'string') {
        filter.topic = unit_topic.trim();
      }

      // Toplam uygun soru sayısını kontrol et
      const totalMatching = await Soru.countDocuments(filter);

      if (totalMatching === 0) {
        return res.status(400).json({
          mesaj: `Seçilen kriterle hiç soru bulunamadı (Sınıf: ${grade}${unit_topic ? `, Tema: ${unit_topic}` : ''}).`,
          kod: 'NO_MATCHING_QUESTIONS',
          availableCount: 0
        });
      }

      const countToUse = Math.min(questionCount, totalMatching);

      if (countToUse < questionCount) {
        return res.status(400).json({
          mesaj: `Seçilen kriterle yalnızca ${countToUse} soru bulundu. ${countToUse} soruyla mı devam edeceksiniz?`,
          kod: 'INSUFFICIENT_QUESTIONS',
          availableCount: totalMatching,
          suggestedCount: countToUse
        });
      }

      // MongoDB aggregation ile tekrarsız soru seç
      const sorular = await Soru.aggregate([
        { $match: filter },
        { $sample: { size: countToUse } },
        { $project: { _id: 1, answer: 1 } }
      ]);

      // Tüm soruların cevabı dolumu kontrol et
      const exikCevaplar = sorular.filter(s => !s.answer);
      if (exikCevaplar.length > 0) {
        return res.status(400).json({
          mesaj: `${exikCevaplar.length} sorunun doğru cevabı girilmemiş. Önce cevapları tamamlayın.`,
          kod: 'MISSING_ANSWERS'
        });
      }

      const soru_ids = sorular.map(s => s._id);

      // Exam kaydı oluştur
      const exam = await Exam.create({
        title: title.trim(),
        grade,
        examType,
        unit_topic: unit_topic || null,
        sub_topic: sub_topic || null,
        questions: soru_ids,
        duration,
        totalPoints: soru_ids.length,
        createdBy: req.session.user.id
      });

      res.status(201).json({
        mesaj: 'Sınav oluşturuldu.',
        exam: {
          id: exam._id.toString(),
          title: exam.title,
          grade: exam.grade,
          examType: exam.examType,
          questionCount: exam.questions.length,
          duration: exam.duration,
          isPublished: exam.isPublished
        }
      });
    } catch (err) {
      console.error('❌ Sınav oluşturulamadı:', err);
      res.status(500).json({ mesaj: 'Sınav oluşturulamadı.' });
    }
  });

  /**
   * POST /api/exams/create-manual
   * Manuel soru seçimi ile sınav oluştur
   */
  staff.post('/create-manual', async (req, res) => {
    try {
      const { title, grade, examType, questionIds = [], duration = 60 } = req.body;

      // Validasyon
      if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
        return res.status(400).json({ mesaj: 'title boş veya 200 karakterden fazla olamaz.' });
      }

      if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ mesaj: 'grade 1 ile 12 arasında bir tam sayı olmalı.' });
      }

      if (!['konu_testi', 'deneme_sinavi'].includes(examType)) {
        return res.status(400).json({ mesaj: 'examType "konu_testi" veya "deneme_sinavi" olmalı.' });
      }

      if (!Array.isArray(questionIds) || questionIds.length < 1 || questionIds.length > 100) {
        return res.status(400).json({ mesaj: 'En az 1, en fazla 100 soru gereklidir.' });
      }

      if (!questionIds.every(id => typeof id === 'string' && OBJECT_ID.test(id))) {
        return res.status(400).json({ mesaj: 'Geçersiz soru ID\'leri.' });
      }

      if (new Set(questionIds).size !== questionIds.length) {
        return res.status(400).json({ mesaj: 'Yinelenmiş soru seçilemiş.' });
      }

      if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
        return res.status(400).json({ mesaj: 'duration 1 ile 480 dakika arasında olmalı.' });
      }

      // Seçilen soruları doğrula
      const sorular = await Soru.find({
        _id: { $in: questionIds.map(id => new ObjectId(id)) }
      })
        .select('answer')
        .lean();

      if (sorular.length !== questionIds.length) {
        return res.status(400).json({ mesaj: 'Seçilen soruların bir kısmı bulunamadı.' });
      }

      // Tüm soruların cevabı dolumu kontrol et
      const eksik = sorular.filter(soru => !soru.answer).length;
      if (eksik) {
        return res.status(400).json({ mesaj: `${eksik} sorunun doğru cevabı girilmemiş. Önce cevapları girin.` });
      }

      // Exam kaydı oluştur
      const exam = await Exam.create({
        title: title.trim(),
        grade,
        examType,
        questions: questionIds.map(id => new ObjectId(id)),
        duration,
        totalPoints: questionIds.length,
        createdBy: req.session.user.id
      });

      res.status(201).json({
        mesaj: 'Sınav oluşturuldu.',
        exam: {
          id: exam._id.toString(),
          title: exam.title,
          grade: exam.grade,
          examType: exam.examType,
          questionCount: exam.questions.length,
          duration: exam.duration,
          isPublished: exam.isPublished
        }
      });
    } catch (err) {
      console.error('❌ Sınav oluşturulamadı:', err);
      res.status(500).json({ mesaj: 'Sınav oluşturulamadı.' });
    }
  });

  /**
   * GET /api/exams/:id
   * Sınav detayı ve soruları getir (önizleme için)
   */
  staff.get('/:id', async (req, res) => {
    try {
      if (!OBJECT_ID.test(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz sınav numarası.' });
      }

      const exam = await Exam.findById(req.params.id)
        .populate('questions', 'imageUrl text options answer explanation rubric difficulty')
        .lean();

      if (!exam) {
        return res.status(404).json({ mesaj: 'Sınav bulunamadı.' });
      }

      res.json({
        exam: {
          id: exam._id.toString(),
          title: exam.title,
          grade: exam.grade,
          examType: exam.examType,
          unit_topic: exam.unit_topic,
          duration: exam.duration,
          isPublished: exam.isPublished,
          createdAt: exam.createdAt,
          questions: exam.questions.map((q, idx) => ({
            number: idx + 1,
            id: q._id.toString(),
            imageUrl: q.imageUrl,
            text: q.text,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            rubric: q.rubric,
            difficulty: q.difficulty
          }))
        }
      });
    } catch (err) {
      console.error('❌ Sınav detayı getirilemedi:', err);
      res.status(500).json({ mesaj: 'Sınav detayı getirilemedi.' });
    }
  });

  /**
   * PATCH /api/exams/:id
   * Sınav durumunu güncelle (yayınla/gizle)
   */
  staff.patch('/:id', async (req, res) => {
    try {
      const { isPublished } = req.body || {};

      if (typeof isPublished !== 'boolean') {
        return res.status(400).json({ mesaj: 'isPublished boolean olmalı.' });
      }

      if (!OBJECT_ID.test(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz sınav numarası.' });
      }

      const exam = await Exam.findByIdAndUpdate(
        req.params.id,
        { $set: { isPublished } },
        { new: true }
      ).select('title isPublished').lean();

      if (!exam) {
        return res.status(404).json({ mesaj: 'Sınav bulunamadı.' });
      }

      res.json({
        mesaj: exam.isPublished ? 'Sınav yayınlandı.' : 'Sınav yayından kaldırıldı.',
        isPublished: exam.isPublished
      });
    } catch (err) {
      console.error('❌ Sınav güncellenemedi:', err);
      res.status(500).json({ mesaj: 'Sınav güncellenemedi.' });
    }
  });

  /**
   * DELETE /api/exams/:id
   * Sınav sil
   */
  staff.delete('/:id', async (req, res) => {
    try {
      if (!OBJECT_ID.test(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz sınav numarası.' });
      }

      const deleted = await Exam.findByIdAndDelete(req.params.id).lean();
      if (!deleted) {
        return res.status(404).json({ mesaj: 'Sınav bulunamadı.' });
      }

      res.json({ mesaj: 'Sınav silindi.' });
    } catch (err) {
      console.error('❌ Sınav silinemedi:', err);
      res.status(500).json({ mesaj: 'Sınav silinemedi.' });
    }
  });

  /**
   * Student router - yayınlanan sınavları listele ve çöz
   */
  const student = express.Router();
  student.use(requireStudent);

  /**
   * GET /api/ogrenci/exams
   * Yayınlanan sınavları listele
   */
  student.get('/', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const skip = (page - 1) * limit;

      const exams = await Exam.find({ isPublished: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title grade examType unit_topic questions duration createdAt')
        .lean();

      const total = await Exam.countDocuments({ isPublished: true });

      res.json({
        exams: exams.map(exam => ({
          id: exam._id.toString(),
          title: exam.title,
          grade: exam.grade,
          examType: exam.examType,
          unit_topic: exam.unit_topic,
          questionCount: exam.questions.length,
          duration: exam.duration,
          createdAt: exam.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('❌ Sınavlar listelenemedi:', err);
      res.status(500).json({ mesaj: 'Sınavlar listelenemedi.' });
    }
  });

  /**
   * GET /api/ogrenci/exams/:id
   * Sınav detayı (soru cevapları ve açıklamalarıyla)
   */
  student.get('/:id', async (req, res) => {
    try {
      if (!OBJECT_ID.test(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz sınav numarası.' });
      }

      const exam = await Exam.findById(req.params.id)
        .where('isPublished').equals(true)
        .populate('questions', 'imageUrl text options answer explanation rubric difficulty')
        .lean();

      if (!exam) {
        return res.status(404).json({ mesaj: 'Sınav bulunamadı veya yayınlanmamış.' });
      }

      res.json({
        exam: {
          id: exam._id.toString(),
          title: exam.title,
          grade: exam.grade,
          examType: exam.examType,
          unit_topic: exam.unit_topic,
          duration: exam.duration,
          createdAt: exam.createdAt,
          questions: exam.questions.map((q, idx) => ({
            number: idx + 1,
            id: q._id.toString(),
            imageUrl: q.imageUrl,
            text: q.text,
            options: q.options,
            difficulty: q.difficulty
          }))
        }
      });
    } catch (err) {
      console.error('❌ Sınav detayı getirilemedi:', err);
      res.status(500).json({ mesaj: 'Sınav detayı getirilemedi.' });
    }
  });

  return { staff, student };
}

module.exports = { createExamsRouter };
