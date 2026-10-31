const express = require('express');
const multer = require('multer');
const { ObjectId } = require('mongodb');
const Soru = require('../models/Soru');
const { sorulariSenkronla } = require('../lib/soru-senkron');
const cloudinaryYukleyici = require('../lib/cloudinary-yukle');

const MAKS_BOYUT = 5 * 1024 * 1024;

// Dosyanın gerçekten PNG/JPEG/WEBP olduğunu ilk baytlardan doğrular (uzantıya/MIME'a güvenmez).
function resimTuru(buffer) {
  if (buffer.length > 12 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function createSorularRouter({ requireStaff, yukleyici = cloudinaryYukleyici }) {
  const router = express.Router();
  router.use(requireStaff);

  // Dosya diske yazılmaz; bellekte tutulup doğrudan Cloudinary'e aktarılır.
  const yukle = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAKS_BOYUT, files: 1 }
  }).single('resim');

  const gorunum = ({ _id, imageUrl, imageFile, ders, siraNo, answer, createdAt }) => (
    { id: _id.toString(), imageUrl, imageFile, ders, siraNo, answer, createdAt }
  );

  router.get('/', async (req, res) => {
    try {
      const filtre = typeof req.query.ders === 'string' && req.query.ders.trim()
        ? { ders: req.query.ders.trim().toLocaleLowerCase('tr-TR') } : {};
      const sorular = await Soru.find(filtre).sort({ ders: 1, siraNo: 1, imageFile: 1 }).limit(500).lean();
      res.json({ sorular: sorular.map(gorunum) });
    } catch (err) {
      console.error('❌ Sorular listelenemedi:', err);
      res.status(500).json({ mesaj: 'Sorular listelenemedi.' });
    }
  });

  // public/images/sorular klasöründeki yeni resimleri veritabanına ekler.
  router.post('/tara', async (req, res) => {
    try {
      const sonuc = await sorulariSenkronla({ createdBy: req.session.user.id });
      res.json({ mesaj: `${sonuc.eklenen.length} yeni soru eklendi.`, ...sonuc });
    } catch (err) {
      console.error('❌ Soru taraması başarısız:', err);
      res.status(500).json({ mesaj: 'Soru taraması yapılamadı.' });
    }
  });

  // Öğretmen/admin bir resim yükler: multer yakalar -> Cloudinary'e gider -> kalıcı URL Mongo'ya yazılır.
  router.post('/yukle', (req, res, next) => {
    yukle(req, res, error => {
      if (!error) return next();
      const boyut = error.code === 'LIMIT_FILE_SIZE';
      res.status(boyut ? 413 : 400).json({ mesaj: boyut ? 'Resim en fazla 5 MB olabilir.' : 'Dosya yüklenemedi.' });
    });
  }, async (req, res) => {
    try {
      if (!yukleyici.yapilandirildi()) {
        return res.status(503).json({ mesaj: 'Resim yükleme (Cloudinary) henüz yapılandırılmadı.' });
      }
      if (!req.file) return res.status(400).json({ mesaj: 'Bir resim dosyası seçin (alan adı: resim).' });
      const tur = resimTuru(req.file.buffer);
      if (!tur) return res.status(400).json({ mesaj: 'Yalnızca PNG, JPG veya WEBP yüklenebilir.' });

      const ders = typeof req.body?.ders === 'string' && req.body.ders.trim()
        ? req.body.ders.trim().toLocaleLowerCase('tr-TR').slice(0, 60) : 'genel';
      const siraNo = Number.isInteger(Number(req.body?.siraNo)) && Number(req.body?.siraNo) > 0
        ? Number(req.body.siraNo) : null;
      const answer = req.body?.answer ? String(req.body.answer).toUpperCase() : null;
      if (![null, 'A', 'B', 'C', 'D', 'E'].includes(answer)) {
        return res.status(400).json({ mesaj: 'Doğru cevap A–E arasında olmalıdır.' });
      }

      const publicId = yukleyici.icerikKimligi(req.file.buffer);
      const tamId = `${yukleyici.KLASOR}/${publicId}`;
      const mevcut = await Soru.findOne({ cloudinaryPublicId: tamId }).lean();
      if (mevcut) return res.status(409).json({ mesaj: 'Bu resim zaten yüklenmiş.', soru: gorunum(mevcut) });

      const yuklenen = await yukleyici.cloudinaryaYukle(req.file.buffer, publicId);
      const soru = await Soru.create({
        imageUrl: yuklenen.url,
        imageFile: `${ders}-${publicId}.${tur}`,
        cloudinaryPublicId: yuklenen.publicId,
        ders, siraNo, answer,
        createdBy: req.session.user.id
      });
      res.status(201).json({ mesaj: 'Soru resmi yüklendi.', soru: gorunum(soru) });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ mesaj: 'Bu resim zaten kayıtlı.' });
      console.error('❌ Soru resmi yüklenemedi:', err);
      res.status(500).json({ mesaj: 'Soru resmi yüklenemedi.' });
    }
  });

  router.put('/:id/cevap', async (req, res) => {
    try {
      const answer = req.body?.answer;
      if (!ObjectId.isValid(req.params.id) || ![null, 'A', 'B', 'C', 'D', 'E'].includes(answer)) {
        return res.status(400).json({ mesaj: 'Geçersiz soru veya cevap.' });
      }
      const soru = await Soru.findByIdAndUpdate(req.params.id, { $set: { answer } }, { new: true }).lean();
      if (!soru) return res.status(404).json({ mesaj: 'Soru bulunamadı.' });
      res.json({ mesaj: 'Cevap kaydedildi.', soru: gorunum(soru) });
    } catch (err) {
      console.error('❌ Cevap kaydedilemedi:', err);
      res.status(500).json({ mesaj: 'Cevap kaydedilemedi.' });
    }
  });

  return router;
}

module.exports = { createSorularRouter };
