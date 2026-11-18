const express = require('express');
const multer = require('multer');
const { ObjectId } = require('mongodb');
const ContentLibrary = require('../models/ContentLibrary');
const Soru = require('../models/Soru');
const AiQuestionDraft = require('../models/AiQuestionDraft');
const { exportQuestions, exportContentItems } = require('../lib/document-exporter');
const { checkQuestionSimilarity, indexQuestionInPinecone } = require('../lib/content-similarity');

function createContentLibraryRouter({ requireStaff, mediaStorage, privateDocumentStorage, AdminLog }) {
  const router = express.Router();
  router.use(requireStaff);

  const uploadPdf = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 }
  }).single('pdf');

  // 1. Liste ve Filtreleme
  router.get('/', async (req, res) => {
    try {
      const { ders, topic, grade, difficulty, type, source, status, search, limit = 50, skip = 0 } = req.query;
      const filter = {};

      if (ders && ders !== 'all') filter.ders = ders.toLowerCase();
      if (topic && topic !== 'all') filter.topic = new RegExp(topic.trim(), 'i');
      if (grade && grade !== 'all') filter.grade = Number(grade);
      if (difficulty && difficulty !== 'all') filter.difficulty = difficulty;
      if (type && type !== 'all') filter.type = type;
      if (source && source !== 'all') filter.source = source;
      if (status && status !== 'all') filter.status = status;
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [{ title: regex }, { topic: regex }];
      }

      const total = await ContentLibrary.countDocuments(filter);
      const items = await ContentLibrary.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Math.min(Number(limit), 100))
        .lean();

      res.json({
        total,
        items: items.map(item => ({
          id: item._id.toString(),
          title: item.title,
          type: item.type,
          ders: item.ders,
          grade: item.grade,
          topic: item.topic,
          difficulty: item.difficulty,
          status: item.status,
          source: item.source,
          r2Key: item.r2Key,
          r2Url: item.r2Url,
          metadata: item.metadata,
          content: item.content,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
      });
    } catch (err) {
      console.error('[ContentLibrary] Liste hatası:', err);
      res.status(500).json({ mesaj: 'İçerik havuzu listelenemedi.' });
    }
  });

  // 2. İstatistikler ve Özet
  router.get('/stats', async (req, res) => {
    try {
      const [totalCount, draftCount, approvedCount, typeStats, draftQuestionsCount] = await Promise.all([
        ContentLibrary.countDocuments({}),
        ContentLibrary.countDocuments({ status: 'draft' }),
        ContentLibrary.countDocuments({ status: 'approved' }),
        ContentLibrary.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
        AiQuestionDraft.countDocuments({ status: 'draft' })
      ]);

      const typeMap = {};
      typeStats.forEach(t => { typeMap[t._id] = t.count; });

      res.json({
        totalCount,
        draftCount,
        approvedCount,
        draftQuestionsCount,
        typeMap
      });
    } catch (err) {
      console.error('[ContentLibrary] İstatistik hatası:', err);
      res.status(500).json({ mesaj: 'İstatistikler alınamadı.' });
    }
  });

  // 3. Tekil İçerik Getir
  router.get('/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz içerik ID.' });
      const item = await ContentLibrary.findById(req.params.id).lean();
      if (!item) return res.status(404).json({ mesaj: 'İçerik bulunamadı.' });
      res.json({ item });
    } catch (err) {
      res.status(500).json({ mesaj: 'İçerik alınamadı.' });
    }
  });

  // 4. Yeni İçerik Ekle
  router.post('/', async (req, res) => {
    try {
      const title = req.body.title;
      const type = req.body.type || req.body.contentType;
      const content = req.body.content || req.body.body;
      const ders = req.body.ders || req.body.lesson || 'matematik';
      const grade = req.body.grade;
      const topic = req.body.topic;
      const difficulty = req.body.difficulty;
      const metadata = req.body.metadata || {};
      const status = req.body.status || 'approved';
      const source = req.body.source || 'teacher';

      if (!title || !type || !content) {
        return res.status(400).json({ mesaj: 'Başlık, içerik türü ve içerik zorunludur.' });
      }

      const item = await ContentLibrary.create({
        title: title.trim(),
        type,
        ders: String(ders).toLowerCase(),
        grade: grade ? Number(grade) : undefined,
        topic: topic ? topic.trim() : undefined,
        difficulty: difficulty || null,
        content,
        metadata,
        status,
        source,
        createdBy: req.session.user.id
      });

      res.status(201).json({ mesaj: 'İçerik havuza eklendi.', id: item._id.toString(), item });
    } catch (err) {
      console.error('[ContentLibrary] Ekleme hatası:', err);
      res.status(500).json({ mesaj: 'İçerik kaydedilemedi.' });
    }
  });

  // 5. Durum Güncelleme / Onaylama
  router.put('/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz ID.' });
      const updates = {};
      const { status, title, topic, difficulty, grade } = req.body;

      if (status) updates.status = status;
      if (title) updates.title = title.trim();
      if (topic) updates.topic = topic.trim();
      if (difficulty) updates.difficulty = difficulty;
      if (grade) updates.grade = Number(grade);

      const updated = await ContentLibrary.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
      if (!updated) return res.status(404).json({ mesaj: 'İçerik bulunamadı.' });

      res.json({ mesaj: 'İçerik güncellendi.', item: updated });
    } catch (err) {
      res.status(500).json({ mesaj: 'İçerik güncellenemedi.' });
    }
  });

  // 6. Silme
  router.delete('/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz ID.' });
      const deleted = await ContentLibrary.findByIdAndDelete(req.params.id).lean();
      if (!deleted) return res.status(404).json({ mesaj: 'İçerik bulunamadı.' });
      res.json({ mesaj: 'İçerik havuzdan silindi.' });
    } catch (err) {
      res.status(500).json({ mesaj: 'İçerik silinemedi.' });
    }
  });

  // 7. PDF Dokümanı Yükle ve Kütüphaneye Ekle (Cloudflare R2 veya dosya deposu)
  router.post('/upload-pdf', (req, res, next) => {
    uploadPdf(req, res, err => {
      if (!err) return next();
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({ mesaj: tooLarge ? 'PDF en fazla 15 MB olabilir.' : 'Dosya yüklenemedi.' });
    });
  }, async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ mesaj: 'Bir PDF dosyası seçin.' });
      if (req.file.buffer.length < 5 || req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ mesaj: 'Yalnızca geçerli PDF dosyaları kabul edilir.' });
      }

      const title = (req.body?.title || req.file.originalname).slice(0, 160).trim();
      const grade = req.body?.grade ? Number(req.body.grade) : undefined;
      const topic = req.body?.topic ? String(req.body.topic).trim() : 'Genel';
      const docType = req.body?.docType || 'Çalışma kâğıdı';

      const fileKey = `library/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      let r2Url = null;

      const storage = privateDocumentStorage || mediaStorage;
      if (storage && typeof storage.put === 'function') {
        await storage.put(fileKey, req.file.buffer);
        r2Url = `/api/content-library/download/${encodeURIComponent(fileKey)}`;
      }

      const doc = await ContentLibrary.create({
        title,
        type: 'pdf_document',
        ders: 'matematik',
        grade,
        topic,
        content: `PDF Dokümanı: ${req.file.originalname}`,
        metadata: {
          originalName: req.file.originalname,
          fileSize: req.file.size,
          docType,
          fileKey
        },
        status: 'approved',
        r2Key: fileKey,
        r2Url,
        source: 'teacher',
        createdBy: req.session.user.id
      });

      res.status(201).json({ mesaj: 'PDF dokümanı kütüphaneye başarıyla kaydedildi.', item: doc });
    } catch (err) {
      console.error('[ContentLibrary] PDF yükleme hatası:', err);
      res.status(500).json({ mesaj: 'PDF kütüphaneye yüklenemedi.' });
    }
  });

  // 8. R2 / Depo İndirme
  router.get('/download/:key', async (req, res) => {
    try {
      const key = req.params.key;
      const storage = privateDocumentStorage || mediaStorage;
      if (!storage || typeof storage.get !== 'function') {
        return res.status(503).json({ mesaj: 'Dosya depolama servisi yapılandırılmamış.' });
      }

      const streamOrBuffer = await storage.get(key);
      if (!streamOrBuffer) return res.status(404).json({ mesaj: 'Dosya bulunamadı.' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${key.split('/').pop()}"`);

      if (Buffer.isBuffer(streamOrBuffer)) {
        res.send(streamOrBuffer);
      } else if (streamOrBuffer.pipe) {
        streamOrBuffer.pipe(res);
      } else {
        res.status(500).send('Dosya okunamadı.');
      }
    } catch (err) {
      res.status(500).json({ mesaj: 'Dosya indirilemedi.' });
    }
  });

  // 9. Dışa Aktar (PDF veya DOCX Olarak İndir)
  router.post('/export', async (req, res) => {
    try {
      const { ids, format = 'pdf', title = 'ZarifÇözüm İçerik Havuzu' } = req.body;
      let items = [];

      if (Array.isArray(ids) && ids.length > 0) {
        items = await ContentLibrary.find({ _id: { $in: ids.filter(ObjectId.isValid) } }).lean();
      } else {
        items = await ContentLibrary.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(20).lean();
      }

      if (items.length === 0) {
        return res.status(400).json({ mesaj: 'Dışa aktarılacak içerik bulunamadı.' });
      }

      const exportFormat = String(format).toLowerCase() === 'docx' ? 'docx' : 'pdf';
      const fileBuffer = exportContentItems(items, { title, format: exportFormat });

      const contentType = exportFormat === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

      const filename = `zarifcozum-icerik-havuzu-${Date.now()}.${exportFormat}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileBuffer);
    } catch (err) {
      console.error('[ContentLibrary] Export hatası:', err);
      res.status(500).json({ mesaj: 'İçerikler dışa aktarılamadı.' });
    }
  });

  // 10. Seçili İçerikleri Cloudflare R2'ye Arşivle
  router.post('/:id/archive-r2', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz ID.' });
      const item = await ContentLibrary.findById(req.params.id);
      if (!item) return res.status(404).json({ mesaj: 'İçerik bulunamadı.' });

      const storage = privateDocumentStorage || mediaStorage;
      if (!storage || typeof storage.put !== 'function') {
        return res.status(503).json({ mesaj: 'Cloudflare R2 depolama servisi yapılandırılmamış.' });
      }

      const pdfBuffer = exportContentItems([item], { title: item.title, format: 'pdf' });
      const r2Key = `content-archive/${item._id.toString()}-${Date.now()}.pdf`;

      await storage.put(r2Key, pdfBuffer);

      item.r2Key = r2Key;
      item.r2Url = `/api/content-library/download/${encodeURIComponent(r2Key)}`;
      item.status = 'archived';
      await item.save();

      res.json({ success: true, mesaj: 'İçerik Cloudflare R2 üzerine başarıyla arşivlendi.', r2Key, r2Url: item.r2Url });
    } catch (err) {
      console.error('[ContentLibrary] R2 arşivleme hatası:', err);
      res.status(500).json({ mesaj: 'Cloudflare R2 arşivleme işlemi başarısız.' });
    }
  });

  return router;
}

module.exports = { createContentLibraryRouter };
