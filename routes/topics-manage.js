const express = require('express');
const mongoose = require('mongoose');
const CurriculumContent = require('../models/CurriculumContent');
const StudentTopicProgress = require('../models/StudentTopicProgress');

function isAdminUser(user) {
  return Boolean(user && (user.role === 'admin' || user.adminRole));
}

function canManageTopic(user, topic) {
  if (!user || !topic) return false;
  if (isAdminUser(user)) return true;
  const uid = String(user._id || user.id || '');
  return Boolean(uid && String(topic.createdBy || '') === uid);
}

function createTopicsManageRouter({ requireRole }) {
  const router = express.Router();

  // 1. Yayınlanan & Taslak Konuları Listele (Öğretmen kendi konularını, Admin tüm konuları görür)
  router.get('/manage', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const user = req.session.user;
      const admin = isAdminUser(user);
      const userId = String(user._id || user.id || '');

      const filter = {};
      if (!admin) {
        filter.createdBy = { $in: [userId, 'teacher'] };
      }
      if (req.query.grade && Number(req.query.grade) >= 5 && Number(req.query.grade) <= 12) {
        filter.grade = Number(req.query.grade);
      }
      if (req.query.status && ['published', 'draft'].includes(req.query.status)) {
        filter.status = req.query.status;
      }
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
          { title: rx },
          { themeTitle: rx },
          { unit_topic: rx },
          { subTopicTitle: rx },
          { sub_topic: rx },
          { outcome_code: rx },
          { createdByName: rx }
        ];
      }

      const docs = await CurriculumContent.find(filter)
        .sort({ updatedAt: -1 })
        .limit(300)
        .select('grade themeCode themeTitle unit_topic subTopicTitle sub_topic title outcome_code status lessonPages practicalNotes flashcards referenceBookPages createdBy createdByName createdAt updatedAt')
        .lean();

      res.json({
        basarili: true,
        isAdmin: admin,
        items: docs.map(d => ({
          id: String(d._id),
          grade: d.grade,
          themeCode: d.themeCode || `MAT.${d.grade}.1`,
          themeTitle: d.themeTitle || d.unit_topic || '',
          subTopicTitle: d.subTopicTitle || d.sub_topic || '',
          title: d.title || d.subTopicTitle || d.sub_topic || '',
          outcome_code: d.outcome_code || '',
          status: d.status || 'published',
          pageCount: Array.isArray(d.lessonPages) && d.lessonPages.length ? d.lessonPages.length : 5,
          notesCount: Array.isArray(d.practicalNotes) ? d.practicalNotes.length : 0,
          cardsCount: Array.isArray(d.flashcards) ? d.flashcards.length : 0,
          refBooksCount: Array.isArray(d.referenceBookPages) ? d.referenceBookPages.length : 0,
          createdBy: d.createdBy || '',
          createdByName: d.createdByName || 'Öğretmen',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        }))
      });
    } catch (err) {
      console.error('[TopicsManage] Liste hatası:', err);
      res.status(500).json({ mesaj: 'Konu listesi alınamadı: ' + err.message });
    }
  });

  // 2. Akıllı Üzerine Yazma Kontrolü (Aynı sınıf + alt konu veya kazanım kodu yayında mı?)
  router.get('/check-duplicate', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const grade = Number(req.query.grade);
      const unit_topic = typeof req.query.unit_topic === 'string' ? req.query.unit_topic.trim() : '';
      const sub_topic = typeof req.query.sub_topic === 'string' ? req.query.sub_topic.trim() : '';
      const outcome_code = typeof req.query.outcome_code === 'string' ? req.query.outcome_code.trim() : '';

      if (!grade || (!sub_topic && !outcome_code)) {
        return res.json({ exists: false });
      }

      const orConds = [];
      if (unit_topic && sub_topic) orConds.push({ unit_topic, sub_topic });
      if (sub_topic) orConds.push({ sub_topic });
      if (outcome_code) orConds.push({ outcome_code });

      const existing = await CurriculumContent.findOne({
        grade,
        status: 'published',
        $or: orConds
      }).select('_id title unit_topic sub_topic outcome_code updatedAt').lean();

      if (!existing) return res.json({ exists: false });
      res.json({
        exists: true,
        existing: {
          id: String(existing._id),
          title: existing.title || existing.sub_topic,
          unit_topic: existing.unit_topic,
          sub_topic: existing.sub_topic,
          outcome_code: existing.outcome_code || '',
          updatedAt: existing.updatedAt
        }
      });
    } catch (err) {
      res.status(500).json({ mesaj: 'Mükerrer kontrolü yapılamadı.' });
    }
  });

  // 3. Tek Konu Detayı (Önizleme / Düzenleme)
  router.get('/:id', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      const doc = await CurriculumContent.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ mesaj: 'Konu anlatımı bulunamadı.' });
      if (!canManageTopic(req.session.user, doc)) {
        return res.status(403).json({ mesaj: 'Bu konuyu görüntüleme yetkiniz yok.' });
      }
      res.json({ basarili: true, data: doc });
    } catch (err) {
      res.status(500).json({ mesaj: 'Konu detayı alınamadı.' });
    }
  });

  // 4. Konu Durum Değiştir (published <-> draft / Yayından Kaldır & Tekrar Yayınla)
  router.patch('/:id/status', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      const topic = await CurriculumContent.findById(req.params.id);
      if (!topic) return res.status(404).json({ mesaj: 'Konu anlatımı bulunamadı.' });
      if (!canManageTopic(req.session.user, topic)) {
        return res.status(403).json({ mesaj: 'Bu konunun durumunu değiştirme yetkiniz yok.' });
      }

      const requested = req.body?.status;
      const nextStatus = ['published', 'draft'].includes(requested)
        ? requested
        : (topic.status === 'published' ? 'draft' : 'published');

      topic.status = nextStatus;
      await topic.save();

      res.json({
        basarili: true,
        status: topic.status,
        mesaj: topic.status === 'published'
          ? 'Konu tekrar öğrenci paneline yayınlandı.'
          : 'Konu yayından kaldırıldı (taslağa çekildi).'
      });
    } catch (err) {
      console.error('[TopicsManage] Durum güncelleme hatası:', err);
      res.status(500).json({ mesaj: 'Durum güncellenemedi: ' + err.message });
    }
  });

  // 5. Konuyu ve Bağlı Öğrenci İlerleme Kayıtlarını Kalıcı Sil
  router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      const topic = await CurriculumContent.findById(req.params.id);
      if (!topic) return res.status(404).json({ mesaj: 'Konu anlatımı bulunamadı.' });
      if (!canManageTopic(req.session.user, topic)) {
        return res.status(403).json({ mesaj: 'Bu konuyu silme yetkiniz yok.' });
      }

      await Promise.all([
        CurriculumContent.findByIdAndDelete(topic._id),
        StudentTopicProgress.deleteMany({ topicId: topic._id })
      ]);

      res.json({
        basarili: true,
        mesaj: 'Konu anlatımı ve bağlı öğrenci ilerleme kayıtları kalıcı olarak silindi.'
      });
    } catch (err) {
      console.error('[TopicsManage] Silme hatası:', err);
      res.status(500).json({ mesaj: 'Konu silinemedi: ' + err.message });
    }
  });

  return router;
}

module.exports = { createTopicsManageRouter };
