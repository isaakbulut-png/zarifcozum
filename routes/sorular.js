const express = require('express');
const { ObjectId } = require('mongodb');
const Soru = require('../models/Soru');
const { sorulariSenkronla } = require('../lib/soru-senkron');

function createSorularRouter({ requireStaff }) {
  const router = express.Router();
  router.use(requireStaff);

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
