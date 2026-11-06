const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { ObjectId } = require('mongodb');
const { yetkiKontrolEt } = require('../lib/admin-rbac');
const { requireKonuLogin } = require('../lib/konu-erisimi');
const { validateImage } = require('../lib/resim-dogrula');

function createCozumluSorularRouters({ Model, User, AdminLog, getTopics }) {
  const publicRouter = express.Router();
  const admin = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4, fieldSize: 2048 }
  }).single('resim');
  const gradeOk = grade => Number.isInteger(grade) && grade >= 5 && grade <= 12;
  const text = (value, max) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
  const summary = item => ({
    id: item._id.toString(), grade: item.grade, unite: item.unite,
    konu: item.konu, baslik: item.baslik, createdAt: item.createdAt
  });
  const noCache = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
  publicRouter.use(noCache);
  admin.use(noCache, yetkiKontrolEt(['superadmin'], User));

  publicRouter.get('/sayilar', async (req, res) => {
    const grade = Number(req.query.grade);
    if (!gradeOk(grade)) return res.status(400).json({ mesaj: 'Geçerli bir sınıf seçin.' });
    try {
      const sayilar = await Model.aggregate([
        { $match: { grade } },
        { $group: { _id: { unite: '$unite', konu: '$konu' }, adet: { $sum: 1 } } }
      ]);
      res.json({ sayilar: sayilar.map(row => ({ ...row._id, adet: row.adet })) });
    } catch (error) {
      console.error('Çözümlü soru sayıları alınamadı:', error);
      res.status(500).json({ mesaj: 'Soru sayıları alınamadı.' });
    }
  });

  publicRouter.get('/', requireKonuLogin, async (req, res) => {
    const grade = Number(req.query.grade);
    const unite = text(req.query.unite, 300);
    const konu = text(req.query.konu, 300);
    if (!gradeOk(grade) || !unite || !konu) return res.status(400).json({ mesaj: 'Geçerli sınıf ve konu seçin.' });
    try {
      const rows = await Model.find({ grade, unite, konu }).sort({ createdAt: -1 }).lean();
      res.json({ sorular: rows.map(summary) });
    } catch (error) {
      console.error('Çözümlü sorular alınamadı:', error);
      res.status(500).json({ mesaj: 'Çözümlü sorular alınamadı.' });
    }
  });

  publicRouter.get('/:id/resim', requireKonuLogin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz soru.' });
    try {
      const item = await Model.findById(req.params.id).select('+image').lean();
      if (!item) return res.status(404).json({ mesaj: 'Soru bulunamadı.' });
      res.set('X-Content-Type-Options', 'nosniff');
      const image = Buffer.isBuffer(item.image) ? item.image : item.image.value(true);
      res.type(item.imageType).send(image);
    } catch (error) {
      console.error('Çözüm görseli alınamadı:', error);
      res.status(500).json({ mesaj: 'Çözüm görseli alınamadı.' });
    }
  });

  admin.get('/', async (req, res) => {
    const grade = Number(req.query.grade);
    if (!gradeOk(grade)) return res.status(400).json({ mesaj: 'Geçerli bir sınıf seçin.' });
    try {
      const rows = await Model.find({ grade }).sort({ createdAt: -1 }).lean();
      res.json({ sorular: rows.map(summary) });
    } catch (error) {
      console.error('Yönetici soru listesi alınamadı:', error);
      res.status(500).json({ mesaj: 'Soru listesi alınamadı.' });
    }
  });

  admin.post('/', (req, res, next) => upload(req, res, error => {
    if (!error) return next();
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({ mesaj: tooLarge ? 'Görsel en fazla 5 MB olabilir.' : 'Dosya yüklenemedi.' });
  }), async (req, res) => {
    const grade = Number(req.body?.grade);
    const unite = text(req.body?.unite, 300);
    const konu = text(req.body?.konu, 300);
    const baslik = text(req.body?.baslik, 160);
    const extension = path.extname(req.file?.originalname || '').toLowerCase();
    const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    if (!gradeOk(grade) || !unite || !konu || !baslik) return res.status(400).json({ mesaj: 'Sınıf, konu ve soru başlığı gereklidir.' });
    if (!req.file || !types[extension] || req.file.mimetype !== types[extension] || !validateImage(req.file.buffer, extension)) {
      return res.status(400).json({ mesaj: 'Geçerli bir JPG, PNG veya WebP görseli seçin.' });
    }
    try {
      const topics = await getTopics(grade);
      if (!topics.some(item => item.unite === unite && item.dosya_adi === konu)) {
        return res.status(400).json({ mesaj: 'Seçilen konu güncel müfredatta bulunamadı.' });
      }
      const item = await Model.create({ grade, unite, konu, baslik, image: req.file.buffer, imageType: types[extension], createdBy: req.adminUser._id.toString() });
      await AdminLog.create({ actorId: req.adminUser._id.toString(), actorName: req.adminUser.name,
        action: 'solved_question.created', entityType: 'solved_question', entityId: item._id.toString(), details: { grade, unite, konu, baslik } });
      res.status(201).json({ mesaj: 'Çözümlü soru eklendi.', soru: summary(item) });
    } catch (error) {
      console.error('Çözümlü soru veya işlem kaydı kaydedilemedi:', error);
      res.status(500).json({ mesaj: 'Soru veya işlem kaydı kaydedilemedi. Listeyi kontrol edin.' });
    }
  });

  admin.delete('/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz soru.' });
    try {
      const item = await Model.findByIdAndDelete(req.params.id).lean();
      if (!item) return res.status(404).json({ mesaj: 'Soru bulunamadı.' });
      await AdminLog.create({ actorId: req.adminUser._id.toString(), actorName: req.adminUser.name,
        action: 'solved_question.deleted', entityType: 'solved_question', entityId: item._id.toString(), details: { grade: item.grade, konu: item.konu, baslik: item.baslik } });
      res.json({ mesaj: 'Çözümlü soru silindi.' });
    } catch (error) {
      console.error('Çözümlü soru veya işlem kaydı silinemedi:', error);
      res.status(500).json({ mesaj: 'Soru veya işlem kaydı silinemedi. Listeyi kontrol edin.' });
    }
  });

  return { publicRouter, admin };
}

module.exports = { createCozumluSorularRouters };
