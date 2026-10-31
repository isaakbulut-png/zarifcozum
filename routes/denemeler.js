const express = require('express');
const { ObjectId } = require('mongodb');
const Deneme = require('../models/Deneme');
const Soru = require('../models/Soru');

const HARFLER = ['A', 'B', 'C', 'D', 'E'];
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// Silinmiş sorular atlanır; öğrenciye gösterilen ve puanlanan liste her zaman aynı kaynaktan gelir.
async function denemeSorulari(deneme) {
  const sorular = await Soru.find({ _id: { $in: deneme.soruIds } }).select('imageUrl answer').lean();
  const byId = new Map(sorular.map(soru => [soru._id.toString(), soru]));
  return deneme.soruIds.map(id => byId.get(id.toString())).filter(Boolean);
}

function createDenemelerRouters({ requireStaff, requireStudent, getResultCollection }) {
  const staff = express.Router();
  staff.use(requireStaff);

  staff.get('/', async (req, res) => {
    try {
      const denemeler = await Deneme.find({}).sort({ createdAt: -1 }).limit(100).lean();
      res.json({
        denemeler: denemeler.map(({ _id, title, description, soruIds, published, herkeseAcik, createdAt }) => ({
          id: _id.toString(), title, description, soruSayisi: soruIds.length, published, herkeseAcik: Boolean(herkeseAcik), createdAt
        }))
      });
    } catch (err) {
      console.error('❌ Denemeler listelenemedi:', err);
      res.status(500).json({ mesaj: 'Denemeler listelenemedi.' });
    }
  });

  staff.post('/', async (req, res) => {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const ids = req.body?.soruIds;
      if (!title || title.length > 150 || description.length > 500 ||
          !Array.isArray(ids) || ids.length < 1 || ids.length > 100 ||
          !ids.every(id => typeof id === 'string' && OBJECT_ID.test(id)) || new Set(ids).size !== ids.length) {
        return res.status(400).json({ mesaj: 'Deneme adı ve 1–100 benzersiz soru gereklidir.' });
      }
      const sorular = await Soru.find({ _id: { $in: ids } }).select('answer').lean();
      if (sorular.length !== ids.length) return res.status(400).json({ mesaj: 'Seçilen soruların bir kısmı bulunamadı.' });
      const eksik = sorular.filter(soru => !soru.answer).length;
      if (eksik) return res.status(400).json({ mesaj: `${eksik} sorunun doğru cevabı girilmemiş. Önce cevapları girin.` });

      const deneme = await Deneme.create({ title, description, soruIds: ids, createdBy: req.session.user.id });
      res.status(201).json({
        mesaj: 'Deneme yayınlandı.',
        deneme: { id: deneme._id.toString(), title, soruSayisi: ids.length }
      });
    } catch (err) {
      console.error('❌ Deneme oluşturulamadı:', err);
      res.status(500).json({ mesaj: 'Deneme oluşturulamadı.' });
    }
  });

  staff.patch('/:id', async (req, res) => {
    try {
      const { published, herkeseAcik } = req.body || {};
      const guncelleme = {};
      if (typeof published === 'boolean') guncelleme.published = published;
      if (typeof herkeseAcik === 'boolean') guncelleme.herkeseAcik = herkeseAcik;
      if (!OBJECT_ID.test(req.params.id) || !Object.keys(guncelleme).length) {
        return res.status(400).json({ mesaj: 'Geçersiz istek.' });
      }
      // Ana sayfadaki "Şimdi Dene" tek bir denemeye bağlıdır.
      if (herkeseAcik === true) {
        await Deneme.updateMany({ _id: { $ne: req.params.id }, herkeseAcik: true }, { $set: { herkeseAcik: false } });
      }
      const deneme = await Deneme.findByIdAndUpdate(req.params.id, { $set: guncelleme }, { new: true }).lean();
      if (!deneme) return res.status(404).json({ mesaj: 'Deneme bulunamadı.' });
      res.json({
        mesaj: typeof herkeseAcik === 'boolean'
          ? (deneme.herkeseAcik ? 'Deneme "Şimdi Dene" için herkese açıldı.' : 'Deneme herkese açık olmaktan çıkarıldı.')
          : (deneme.published ? 'Deneme yayınlandı.' : 'Deneme yayından kaldırıldı.'),
        published: deneme.published,
        herkeseAcik: Boolean(deneme.herkeseAcik)
      });
    } catch (err) {
      console.error('❌ Deneme güncellenemedi:', err);
      res.status(500).json({ mesaj: 'Deneme güncellenemedi.' });
    }
  });

  staff.delete('/:id', async (req, res) => {
    try {
      if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz deneme numarası.' });
      const silinen = await Deneme.findByIdAndDelete(req.params.id).lean();
      if (!silinen) return res.status(404).json({ mesaj: 'Deneme bulunamadı.' });
      res.json({ mesaj: 'Deneme silindi. Öğrenci sonuçları korunur.' });
    } catch (err) {
      console.error('❌ Deneme silinemedi:', err);
      res.status(500).json({ mesaj: 'Deneme silinemedi.' });
    }
  });

  const student = express.Router();
  student.use(requireStudent);

  student.get('/', async (req, res) => {
    try {
      const denemeler = await Deneme.find({ published: true }).sort({ createdAt: -1 }).limit(50).lean();
      const sonuclar = denemeler.length
        ? await getResultCollection().find({
          studentId: req.session.user.id,
          type: 'deneme',
          quizId: { $in: denemeler.map(d => new ObjectId(d._id.toString())) }
        }).toArray()
        : [];
      const byQuiz = new Map(sonuclar.map(sonuc => [sonuc.quizId.toString(), sonuc]));
      res.json({
        denemeler: denemeler.map(({ _id, title, description, soruIds, createdAt }) => {
          const sonuc = byQuiz.get(_id.toString());
          return {
            id: _id.toString(), title, description, soruSayisi: soruIds.length, createdAt,
            tamamlandi: Boolean(sonuc), score: sonuc ? sonuc.score : null
          };
        })
      });
    } catch (err) {
      console.error('❌ Öğrenci denemeleri alınamadı:', err);
      res.status(500).json({ mesaj: 'Denemeler alınamadı.' });
    }
  });

  // Doğru cevaplar bu yanıta asla eklenmez.
  student.get('/:id', async (req, res) => {
    try {
      if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz deneme numarası.' });
      const deneme = await Deneme.findOne({ _id: req.params.id, published: true }).lean();
      if (!deneme) return res.status(404).json({ mesaj: 'Deneme bulunamadı.' });
      const sorular = await denemeSorulari(deneme);
      if (!sorular.length) return res.status(404).json({ mesaj: 'Bu denemede soru kalmadı.' });
      res.json({
        id: deneme._id.toString(),
        title: deneme.title,
        description: deneme.description,
        secenekler: HARFLER,
        sorular: sorular.map((soru, index) => ({ no: index + 1, imageUrl: soru.imageUrl }))
      });
    } catch (err) {
      console.error('❌ Deneme açılamadı:', err);
      res.status(500).json({ mesaj: 'Deneme açılamadı.' });
    }
  });

  student.post('/:id/teslim', async (req, res) => {
    try {
      if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz deneme numarası.' });
      const deneme = await Deneme.findOne({ _id: req.params.id, published: true }).lean();
      if (!deneme) return res.status(404).json({ mesaj: 'Deneme bulunamadı.' });
      const sorular = await denemeSorulari(deneme);
      const answers = req.body?.answers;
      if (!sorular.length || !Array.isArray(answers) || answers.length !== sorular.length ||
          !answers.every(answer => answer === null || HARFLER.includes(answer))) {
        return res.status(400).json({ mesaj: 'Deneme cevapları geçersiz.' });
      }

      const correctCount = answers.reduce((sayi, answer, i) => sayi + (answer === sorular[i].answer ? 1 : 0), 0);
      const totalCount = sorular.length;
      const score = Math.round(correctCount * 100 / totalCount);
      // Upsert tek bir deneme için ikinci teslimi atomik olarak engeller.
      const yazim = await getResultCollection().updateOne(
        { quizId: new ObjectId(deneme._id.toString()), studentId: req.session.user.id, type: 'deneme' },
        {
          $setOnInsert: {
            quizTitle: deneme.title, studentName: req.session.user.name,
            answers, correctCount, totalCount, score, createdAt: new Date()
          }
        },
        { upsert: true }
      );
      if (!yazim.upsertedCount) return res.status(409).json({ mesaj: 'Bu denemeyi zaten tamamladınız.' });

      res.status(201).json({
        mesaj: 'Deneme sonucu kaydedildi.',
        score, correctCount, totalCount,
        review: sorular.map((soru, i) => ({ no: i + 1, secilen: answers[i], dogru: soru.answer }))
      });
    } catch (err) {
      console.error('❌ Deneme teslim edilemedi:', err);
      res.status(500).json({ mesaj: 'Deneme sonucu kaydedilemedi.' });
    }
  });

  // Girişsiz "Şimdi Dene": yalnızca öğretmenin işaretlediği tek deneme; sonuç kaydedilmez.
  const acik = express.Router();
  const istekler = new Map();
  acik.use((req, res, next) => {
    const simdi = Date.now();
    const kayit = (istekler.get(req.ip) || []).filter(t => simdi - t < 60_000);
    if (kayit.length >= 60) return res.status(429).json({ mesaj: 'Çok fazla istek. Biraz sonra tekrar deneyin.' });
    kayit.push(simdi);
    istekler.set(req.ip, kayit);
    if (istekler.size > 5000) istekler.clear();
    next();
  });

  async function acikDeneme() {
    const deneme = await Deneme.findOne({ herkeseAcik: true, published: true }).lean();
    if (!deneme) return null;
    const sorular = await denemeSorulari(deneme);
    return sorular.length ? { deneme, sorular } : null;
  }

  acik.get('/', async (req, res) => {
    try {
      const bulunan = await acikDeneme();
      if (!bulunan) return res.status(404).json({ mesaj: 'Şu an herkese açık deneme yok.' });
      const { deneme, sorular } = bulunan;
      res.json({
        title: deneme.title,
        description: deneme.description,
        secenekler: HARFLER,
        sorular: sorular.map((soru, index) => ({ no: index + 1, imageUrl: soru.imageUrl }))
      });
    } catch (err) {
      console.error('❌ Açık deneme alınamadı:', err);
      res.status(500).json({ mesaj: 'Deneme açılamadı.' });
    }
  });

  acik.post('/kontrol', async (req, res) => {
    try {
      const bulunan = await acikDeneme();
      if (!bulunan) return res.status(404).json({ mesaj: 'Şu an herkese açık deneme yok.' });
      const { sorular } = bulunan;
      const answers = req.body?.answers;
      if (!Array.isArray(answers) || answers.length !== sorular.length ||
          !answers.every(answer => answer === null || HARFLER.includes(answer))) {
        return res.status(400).json({ mesaj: 'Deneme cevapları geçersiz.' });
      }
      const correctCount = answers.reduce((sayi, answer, i) => sayi + (answer === sorular[i].answer ? 1 : 0), 0);
      res.json({
        score: Math.round(correctCount * 100 / sorular.length),
        correctCount,
        totalCount: sorular.length,
        review: sorular.map((soru, i) => ({ no: i + 1, secilen: answers[i], dogru: soru.answer }))
      });
    } catch (err) {
      console.error('❌ Açık deneme kontrol edilemedi:', err);
      res.status(500).json({ mesaj: 'Sonuç hesaplanamadı.' });
    }
  });

  return { staff, student, acik };
}

module.exports = { createDenemelerRouters };
