// Kurulum:  npm install
// Çalıştır: npm start
const fs = require('fs');
const path = require('path');
// .env önceliklidir; eksik değişkenler baglanti_adresi.env dosyasından tamamlanır.
for (const file of ['.env', 'baglanti_adresi.env']) {
  const envPath = path.join(__dirname, file);
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
}
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { router: authRouter, requireRole } = require('./routes/auth');
const { createAIRouter } = require('./routes/ai');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;           // .env dosyasından okunur
const DB_ADI      = process.env.DB_ADI || 'etut_merkezi';
const KOLEKSIYON  = process.env.KOLEKSIYON || 'sinav_sonuclari';
const SESSION_SECRET = String(process.env.SESSION_SECRET || '');
const ZOOM_ACCOUNT_ID = String(process.env.ZOOM_ACCOUNT_ID || '').trim();
const ZOOM_CLIENT_ID = String(process.env.ZOOM_CLIENT_ID || '').trim();
const ZOOM_CLIENT_SECRET = String(process.env.ZOOM_CLIENT_SECRET || '').trim();
const ZOOM_HOST_USER_ID = String(process.env.ZOOM_HOST_USER_ID || '').trim();
const ZOOM_MEETING_SDK_CLIENT_ID = String(process.env.ZOOM_MEETING_SDK_CLIENT_ID || '').trim();
const ZOOM_MEETING_SDK_CLIENT_SECRET = String(process.env.ZOOM_MEETING_SDK_CLIENT_SECRET || '').trim();

if (!MONGODB_URI) {
  console.error('❌ .env dosyasında MONGODB_URI bulunamadı.');
  process.exit(1);
}
if (SESSION_SECRET.length < 32) {
  console.error('❌ SESSION_SECRET en az 32 karakter olmalıdır (.env dosyasına ekleyin).');
  process.exit(1);
}

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(cors());                                       // file:// ile açılan sayfa da erişebilsin
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'zarifcozum.sid',
  secret: SESSION_SECRET,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    dbName: DB_ADI,
    collectionName: 'sessions',
    ttl: 8 * 60 * 60
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(authRouter);
app.use(express.static(path.join(__dirname, 'public'))); // public/deneme-sinavi-optik.html
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/logo', express.static(path.join(__dirname, 'logo')));

const sitePages = [
  'index.html', 'asistan.html', 'canli.html', 'zoom-room.html', 'konu.html', 'mimari.html', 'panel.html', 'test.html',
  'ogrenci-paneli.html', 'ogretmen-paneli.html', 'kayit-giris.html'
];
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
sitePages.forEach(page => {
  app.get(`/${page}`, (req, res, next) => {
    const role = page === 'ogrenci-paneli.html' ? 'student'
      : page === 'ogretmen-paneli.html' ? 'teacher'
      : null;
    if (!role) return next();
    if (!req.session.user) return res.redirect('/kayit-giris.html');
    if (req.session.user.role !== role) {
      return res.redirect(req.session.user.role === 'teacher'
        ? '/ogretmen-paneli.html'
        : '/ogrenci-paneli.html');
    }
    next();
  }, (req, res) => res.sendFile(path.join(__dirname, page)));
});
app.get('/favicon.svg', (req, res) => res.sendFile(path.join(__dirname, 'favicon.svg')));

let koleksiyon, anahtarKoleksiyon, canliDersKoleksiyonu;
let planliDersKoleksiyonu, quizKoleksiyonu, quizSonucKoleksiyonu, duyuruKoleksiyonu;
const ogrenciKontrol = requireRole('student');
const ogretmenKontrol = requireRole('teacher');
app.use('/api/ai', createAIRouter({
  getQuizCollection: () => quizKoleksiyonu,
  requireRole
}));

// Sunucu ve veritabanı ayakta mı?
app.get('/api/saglik', (req, res) => res.json({ mesaj: 'Sunucu çalışıyor', db: DB_ADI, koleksiyon: KOLEKSIYON }));

function zoomAyarlariniKontrolEt(ayarlar) {
  const eksikler = ayarlar.filter(ayar => !ayar.deger).map(ayar => ayar.ad);
  if (eksikler.length) {
    const hata = new Error(`Zoom ayarları eksik: ${eksikler.join(', ')}`);
    hata.status = 503;
    throw hata;
  }
}

async function zoomErisimBelirteciAl() {
  zoomAyarlariniKontrolEt([
    { ad: 'ZOOM_ACCOUNT_ID', deger: ZOOM_ACCOUNT_ID },
    { ad: 'ZOOM_CLIENT_ID', deger: ZOOM_CLIENT_ID },
    { ad: 'ZOOM_CLIENT_SECRET', deger: ZOOM_CLIENT_SECRET }
  ]);

  const sorgu = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: ZOOM_ACCOUNT_ID
  });
  const yanit = await fetch(`https://zoom.us/oauth/token?${sorgu}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok || !veri.access_token) {
    const hata = new Error(`Zoom OAuth belirteci alınamadı (${yanit.status}).`);
    hata.status = 502;
    throw hata;
  }
  return veri.access_token;
}

async function zoomApiIstegiYap(belirteci, method, yol, govde) {
  const yanit = await fetch(`https://api.zoom.us/v2${yol}`, {
    method,
    headers: {
      Authorization: `Bearer ${belirteci}`,
      ...(govde ? { 'Content-Type': 'application/json' } : {})
    },
    ...(govde ? { body: JSON.stringify(govde) } : {})
  });
  const metin = await yanit.text();
  const veri = metin ? JSON.parse(metin) : {};
  if (!yanit.ok) {
    const detay = typeof veri.message === 'string' ? `: ${veri.message}` : '';
    const hata = new Error(`Zoom API isteği başarısız (${yanit.status})${detay}`);
    hata.status = 502;
    throw hata;
  }
  return veri;
}

function zoomImzasiOlustur(toplantiNo, rol) {
  zoomAyarlariniKontrolEt([
    { ad: 'ZOOM_MEETING_SDK_CLIENT_ID', deger: ZOOM_MEETING_SDK_CLIENT_ID },
    { ad: 'ZOOM_MEETING_SDK_CLIENT_SECRET', deger: ZOOM_MEETING_SDK_CLIENT_SECRET }
  ]);

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const baslik = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const icerik = Buffer.from(JSON.stringify({
    appKey: ZOOM_MEETING_SDK_CLIENT_ID,
    mn: String(toplantiNo),
    role: rol,
    iat,
    exp,
    tokenExp: exp
  })).toString('base64url');
  const imza = crypto
    .createHmac('sha256', ZOOM_MEETING_SDK_CLIENT_SECRET)
    .update(`${baslik}.${icerik}`)
    .digest('base64url');

  return `${baslik}.${icerik}.${imza}`;
}

async function aktifCanliDersiAl() {
  const ders = await canliDersKoleksiyonu.findOne({ _id: 'aktif' });
  if (!ders) return null;
  if (ders.expiresAt <= new Date()) {
    await canliDersKoleksiyonu.deleteOne({ _id: 'aktif' });
    return null;
  }
  return ders;
}

app.get('/api/canli/katilim', ogrenciKontrol, async (req, res) => {
  try {
    const ders = await aktifCanliDersiAl();
    if (!ders) return res.status(404).json({ mesaj: 'Şu anda aktif bir canlı ders yok.' });
    res.json({
      sdkKey: ZOOM_MEETING_SDK_CLIENT_ID,
      signature: zoomImzasiOlustur(ders.meetingNumber, 0),
      meetingNumber: ders.meetingNumber,
      password: ders.password,
      userName: 'Öğrenci'
    });
  } catch (err) {
    console.error('❌ Zoom öğrenci katılımı hazırlanamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

app.get(['/api/student/dashboard', '/api/ogrenci/icerik'], ogrenciKontrol, async (req, res) => {
  try {
    const [dersler, quizler, duyurular, sonuclar, aktifDers] = await Promise.all([
      planliDersKoleksiyonu.find({ startsAt: { $gte: new Date() } })
        .sort({ startsAt: 1 }).limit(50).toArray(),
      quizKoleksiyonu.find({
        $or: [{ source: { $ne: 'ai' } }, { source: 'ai', published: true }]
      })
        .sort({ createdAt: -1 }).limit(50).toArray(),
      duyuruKoleksiyonu.find({}).sort({ createdAt: -1 }).limit(20).toArray(),
      quizSonucKoleksiyonu.find({ studentId: req.session.user.id })
        .sort({ createdAt: -1 }).limit(100).toArray(),
      aktifCanliDersiAl()
    ]);
    const tamamlananQuizler = new Set(sonuclar.map(result => result.quizId.toString()));
    res.json({
      aktifDers: aktifDers ? {
        title: aktifDers.topic,
        startsAt: aktifDers.startedAt,
        link: '/canli.html'
      } : null,
      dersler: dersler.map(({ _id, title, startsAt, link }) => ({
        id: _id.toString(), title, startsAt, link
      })),
      quizler: quizler.map(({ _id, title, description, questions, createdAt }) => ({
        id: _id.toString(), title, description,
        soruSayisi: questions.length, createdAt,
        tamamlandi: tamamlananQuizler.has(_id.toString()),
        questions: questions.map(({ text, options }) => ({ text, options }))
      })),
      duyurular: duyurular.map(({ _id, message, createdAt }) => ({
        id: _id.toString(), message, createdAt
      })),
      sonuclar: sonuclar.map(({ _id, quizId, quizTitle, score, correctCount, totalCount, createdAt }) => ({
        id: _id.toString(), quizId: quizId.toString(), quizTitle, score, correctCount, totalCount, createdAt
      }))
    });
  } catch (err) {
    console.error('❌ Öğrenci içerikleri alınamadı:', err);
    res.status(500).json({ mesaj: 'Öğrenci içerikleri alınamadı.' });
  }
});

app.post('/api/ogrenci/quiz/:id/teslim', ogrenciKontrol, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz test numarası.' });
    const quiz = await quizKoleksiyonu.findOne({ _id: new ObjectId(req.params.id) });
    if (!quiz) return res.status(404).json({ mesaj: 'Test bulunamadı.' });
    if (quiz.source === 'ai' && quiz.published !== true) {
      return res.status(404).json({ mesaj: 'Test bulunamadı.' });
    }
    const answers = req.body?.answers;
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length ||
        !answers.every((answer, index) => answer === null ||
          ['A', 'B', 'C', 'D'].includes(answer) && quiz.questions[index].options[answer])) {
      return res.status(400).json({ mesaj: 'Test cevapları geçersiz.' });
    }

    const correctCount = answers.reduce(
      (count, answer, index) => count + (answer === quiz.questions[index].answer ? 1 : 0), 0
    );
    const totalCount = quiz.questions.length;
    const score = Math.round(correctCount * 100 / totalCount);
    const result = await quizSonucKoleksiyonu.insertOne({
      quizId: quiz._id,
      quizTitle: quiz.title,
      studentId: req.session.user.id,
      studentName: req.session.user.name,
      answers,
      correctCount,
      totalCount,
      score,
      createdAt: new Date()
    });
    res.status(201).json({
      mesaj: 'Test sonucu kaydedildi.',
      id: result.insertedId,
      score,
      correctCount,
      totalCount,
      review: quiz.questions.map(({ answer, explanation }) => ({
        answer,
        explanation: explanation || ''
      }))
    });
  } catch (err) {
    console.error('❌ Öğrenci testi kaydedilemedi:', err);
    res.status(500).json({ mesaj: 'Test sonucu kaydedilemedi.' });
  }
});

app.get('/api/ogretmen/yonetim', ogretmenKontrol, async (req, res) => {
  try {
    const [dersler, quizler, duyurular, quizSonuclari, eskiSonuclar, anahtarlar] = await Promise.all([
      planliDersKoleksiyonu.find({}).sort({ startsAt: 1 }).limit(100).toArray(),
      quizKoleksiyonu.find({
        $or: [{ source: { $ne: 'ai' } }, { source: 'ai', published: true }]
      }).sort({ createdAt: -1 }).limit(100).toArray(),
      duyuruKoleksiyonu.find({}).sort({ createdAt: -1 }).limit(50).toArray(),
      quizSonucKoleksiyonu.find({}).sort({ createdAt: -1 }).limit(500).toArray(),
      koleksiyon.find().sort({ kayitTarihi: -1 }).limit(500).toArray(),
      anahtarKoleksiyon.find().toArray()
    ]);
    const keysByExam = new Map(anahtarlar.map(item => [item.sinavAdi, item.anahtar]));
    const legacyResults = eskiSonuclar.map(item => {
      const answerKey = keysByExam.get(item.sinavAdi) || [];
      const scorable = answerKey.filter(Boolean).length;
      const correctCount = (item.cevaplar || []).reduce(
        (count, answer, index) => count + (answer && answer === answerKey[index] ? 1 : 0), 0
      );
      return {
        id: item._id.toString(),
        studentName: item.ogrenciAdi,
        testTitle: item.sinavAdi || 'Deneme sınavı',
        score: scorable ? Math.round(correctCount * 100 / scorable) : null,
        createdAt: item.kayitTarihi,
        type: 'legacy'
      };
    });
    res.json({
      dersler: dersler.map(({ _id, title, startsAt, link }) => ({
        id: _id.toString(), title, startsAt, link
      })),
      quizler: quizler.map(({ _id, title, description, questions, createdAt }) => ({
        id: _id.toString(), title, description, soruSayisi: questions.length, createdAt
      })),
      duyurular: duyurular.map(({ _id, message, createdAt }) => ({
        id: _id.toString(), message, createdAt
      })),
      sonuclar: [
        ...quizSonuclari.map(({ _id, studentName, quizTitle, score, createdAt }) => ({
          id: _id.toString(), studentName, testTitle: quizTitle, score, createdAt, type: 'quiz'
        })),
        ...legacyResults
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  } catch (err) {
    console.error('❌ Öğretmen yönetim verisi alınamadı:', err);
    res.status(500).json({ mesaj: 'Yönetim verileri alınamadı.' });
  }
});

app.post('/api/ogretmen/dersler', ogretmenKontrol, async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const link = typeof req.body?.link === 'string' ? req.body.link.trim() : '';
    const startsAt = new Date(req.body?.startsAt);
    let parsedLink;
    try { parsedLink = new URL(link); } catch { parsedLink = null; }
    if (!title || title.length > 150 || !Number.isFinite(startsAt.getTime()) ||
        !parsedLink || parsedLink.protocol !== 'https:') {
      return res.status(400).json({ mesaj: 'Ders adı, geçerli tarih/saat ve HTTPS bağlantısı gereklidir.' });
    }
    const lesson = {
      title,
      startsAt,
      link: parsedLink.toString(),
      createdBy: req.session.user.id,
      createdAt: new Date()
    };
    const result = await planliDersKoleksiyonu.insertOne(lesson);
    res.status(201).json({ mesaj: 'Ders oluşturuldu.', ders: { id: result.insertedId.toString(), ...lesson } });
  } catch (err) {
    console.error('❌ Planlı ders kaydedilemedi:', err);
    res.status(500).json({ mesaj: 'Ders kaydedilemedi.' });
  }
});

app.post('/api/ogretmen/quizler', ogretmenKontrol, async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const questions = req.body?.questions;
    if (!title || title.length > 150 || description.length > 500 ||
        !Array.isArray(questions) || questions.length < 1 || questions.length > 50 ||
        !questions.every(question =>
          typeof question?.text === 'string' && question.text.trim().length > 0 &&
          question.text.trim().length <= 1000 &&
          question.options && ['A', 'B', 'C', 'D'].every(letter =>
            typeof question.options[letter] === 'string' &&
            question.options[letter].trim().length > 0 &&
            question.options[letter].trim().length <= 300
          ) &&
          ['A', 'B', 'C', 'D'].includes(question.answer)
        )) {
      return res.status(400).json({ mesaj: 'Test başlığı ve 1–50 geçerli soru gereklidir.' });
    }
    const quiz = {
      title,
      description,
      questions: questions.map(question => ({
        text: question.text.trim(),
        options: Object.fromEntries(['A', 'B', 'C', 'D'].map(letter =>
          [letter, question.options[letter].trim()]
        )),
        answer: question.answer
      })),
      createdBy: req.session.user.id,
      createdAt: new Date()
    };
    const result = await quizKoleksiyonu.insertOne(quiz);
    res.status(201).json({
      mesaj: 'Test yayınlandı.',
      quiz: { id: result.insertedId.toString(), title, soruSayisi: quiz.questions.length }
    });
  } catch (err) {
    console.error('❌ Test oluşturulamadı:', err);
    res.status(500).json({ mesaj: 'Test oluşturulamadı.' });
  }
});

app.post('/api/ogretmen/duyurular', ogretmenKontrol, async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 1000) {
      return res.status(400).json({ mesaj: 'Duyuru 1–1000 karakter arasında olmalıdır.' });
    }
    const announcement = {
      message,
      createdBy: req.session.user.id,
      createdAt: new Date()
    };
    const result = await duyuruKoleksiyonu.insertOne(announcement);
    res.status(201).json({
      mesaj: 'Duyuru yayınlandı.',
      duyuru: { id: result.insertedId.toString(), ...announcement }
    });
  } catch (err) {
    console.error('❌ Duyuru kaydedilemedi:', err);
    res.status(500).json({ mesaj: 'Duyuru yayınlanamadı.' });
  }
});

app.post('/api/ogretmen/canli/baslat', ogretmenKontrol, async (req, res) => {
  try {
    zoomAyarlariniKontrolEt([{ ad: 'ZOOM_HOST_USER_ID', deger: ZOOM_HOST_USER_ID }]);
    const konu = String(req.body?.topic || 'ZarifÇözüm Canlı Ders').trim().slice(0, 200);
    if (!konu) return res.status(400).json({ mesaj: 'Ders konusu boş olamaz.' });

    const mevcutDers = await aktifCanliDersiAl();
    if (mevcutDers) {
      return res.status(409).json({ mesaj: 'Zaten aktif bir canlı ders var.' });
    }

    const belirteci = await zoomErisimBelirteciAl();
    const toplanti = await zoomApiIstegiYap(
      belirteci,
      'POST',
      `/users/${encodeURIComponent(ZOOM_HOST_USER_ID)}/meetings`,
      {
        topic: konu,
        type: 1,
        settings: {
          join_before_host: false,
          waiting_room: true,
          mute_upon_entry: true,
          meeting_authentication: false
        }
      }
    );

    await canliDersKoleksiyonu.updateOne(
      { _id: 'aktif' },
      {
        $set: {
          meetingId: String(toplanti.id),
          meetingNumber: String(toplanti.id),
          password: toplanti.password || '',
          topic: toplanti.topic || konu,
          hostUserId: ZOOM_HOST_USER_ID,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
        }
      },
      { upsert: true }
    );
    res.status(201).json({ mesaj: 'Canlı ders oluşturuldu.', topic: toplanti.topic || konu });
  } catch (err) {
    console.error('❌ Zoom toplantısı oluşturulamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

app.post('/api/ogretmen/canli/katilim', ogretmenKontrol, async (req, res) => {
  try {
    zoomAyarlariniKontrolEt([
      { ad: 'ZOOM_HOST_USER_ID', deger: ZOOM_HOST_USER_ID },
      { ad: 'ZOOM_MEETING_SDK_CLIENT_ID', deger: ZOOM_MEETING_SDK_CLIENT_ID },
      { ad: 'ZOOM_MEETING_SDK_CLIENT_SECRET', deger: ZOOM_MEETING_SDK_CLIENT_SECRET }
    ]);
    const ders = await aktifCanliDersiAl();
    if (!ders) return res.status(404).json({ mesaj: 'Şu anda aktif bir canlı ders yok.' });

    const belirteci = await zoomErisimBelirteciAl();
    const zak = await zoomApiIstegiYap(
      belirteci,
      'GET',
      `/users/${encodeURIComponent(ZOOM_HOST_USER_ID)}/token?type=zak`
    );
    res.json({
      sdkKey: ZOOM_MEETING_SDK_CLIENT_ID,
      signature: zoomImzasiOlustur(ders.meetingNumber, 1),
      meetingNumber: ders.meetingNumber,
      password: ders.password,
      userName: 'Öğretmen',
      zak: zak.token
    });
  } catch (err) {
    console.error('❌ Zoom öğretmen katılımı hazırlanamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

app.post('/api/ogretmen/canli/sonlandir', ogretmenKontrol, async (req, res) => {
  try {
    const ders = await aktifCanliDersiAl();
    if (!ders) return res.status(404).json({ mesaj: 'Aktif canlı ders bulunamadı.' });

    const belirteci = await zoomErisimBelirteciAl();
    await zoomApiIstegiYap(
      belirteci,
      'PUT',
      `/meetings/${encodeURIComponent(ders.meetingId)}/status`,
      { action: 'end' }
    );
    await canliDersKoleksiyonu.deleteOne({ _id: 'aktif' });
    res.json({ mesaj: 'Canlı ders sonlandırıldı.' });
  } catch (err) {
    console.error('❌ Zoom toplantısı sonlandırılamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

// Sınav sonucunu kaydet
app.post('/api/cevap-kaydet', ogrenciKontrol, async (req, res) => {
  try {
    const b = req.body || {};
    const gecerli = a => a === null || ['A', 'B', 'C', 'D', 'E'].includes(a);
    if (!Array.isArray(b.cevaplar) || b.cevaplar.length > 200 || !b.cevaplar.every(gecerli)) {
      return res.status(400).json({ mesaj: 'Geçersiz cevap listesi' });
    }

    const belge = {
      ogrenciAdi: req.session.user.name,
      ogrenciId: req.session.user.id,
      sinavAdi: String(b.sinavAdi || '').slice(0, 150),
      cevaplar: b.cevaplar,
      isaretlenenSayisi: b.cevaplar.filter(Boolean).length,
      bosSayisi: b.cevaplar.filter(a => a === null).length,
      harcananSure: Number(b.harcananSure) || 0,
      bitisNedeni: String(b.bitisNedeni || '').slice(0, 50),
      kayitTarihi: new Date()
    };

    const sonuc = await koleksiyon.insertOne(belge);
    console.log(`📥 Kaydedildi: ${belge.ogrenciAdi} | işaretli: ${belge.isaretlenenSayisi} | boş: ${belge.bosSayisi} | id: ${sonuc.insertedId}`);
    res.json({ mesaj: 'Kaydedildi', id: sonuc.insertedId });
  } catch (err) {
    console.error('❌ Yazma hatası:', err);
    res.status(500).json({ mesaj: 'Veritabanına yazılamadı: ' + err.message });
  }
});

// Son 20 kaydı tarayıcıda görmek için: http://localhost:3000/api/sonuclar
app.get('/api/sonuclar', ogretmenKontrol, async (req, res) => {
  try {
    const liste = await koleksiyon.find().sort({ kayitTarihi: -1 }).limit(20).toArray();
    res.json(liste);
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

// ---------- Öğretmen paneli (oturum ve rol korumalı) ----------
app.get('/api/ogretmen/dogrula', ogretmenKontrol, (req, res) => res.json({ mesaj: 'Giriş başarılı' }));

// Tüm sonuçlar + cevap anahtarları
app.get('/api/ogretmen/veri', ogretmenKontrol, async (req, res) => {
  try {
    const sonuclar = await koleksiyon.find().sort({ kayitTarihi: -1 }).limit(1000).toArray();
    const anahtarlar = {};
    (await anahtarKoleksiyon.find().toArray()).forEach(a => { anahtarlar[a.sinavAdi] = a.anahtar; });
    res.json({ sonuclar, anahtarlar });
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

// Cevap anahtarını kaydet / güncelle
app.put('/api/ogretmen/anahtar', ogretmenKontrol, async (req, res) => {
  try {
    const { sinavAdi, anahtar } = req.body || {};
    const gecerli = a => a === null || ['A', 'B', 'C', 'D', 'E'].includes(a);
    if (!sinavAdi || !Array.isArray(anahtar) || anahtar.length > 200 || !anahtar.every(gecerli)) {
      return res.status(400).json({ mesaj: 'Geçersiz cevap anahtarı' });
    }
    await anahtarKoleksiyon.updateOne(
      { sinavAdi: String(sinavAdi).slice(0, 150) },
      { $set: { anahtar, guncellenme: new Date() } },
      { upsert: true }
    );
    res.json({ mesaj: 'Anahtar kaydedildi' });
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

// Bir sonucu sil (deneme kayıtlarını temizlemek için)
app.delete('/api/ogretmen/sonuc/:id', ogretmenKontrol, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz kayıt no' });
    await koleksiyon.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ mesaj: 'Silindi' });
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

async function baslat() {
  await mongoose.connect(MONGODB_URI, { dbName: DB_ADI });
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  koleksiyon = client.db(DB_ADI).collection(KOLEKSIYON);
  anahtarKoleksiyon = client.db(DB_ADI).collection('cevap_anahtarlari');
  canliDersKoleksiyonu = client.db(DB_ADI).collection('canli_dersler');
  planliDersKoleksiyonu = client.db(DB_ADI).collection('planli_dersler');
  quizKoleksiyonu = client.db(DB_ADI).collection('quizler');
  quizSonucKoleksiyonu = client.db(DB_ADI).collection('quiz_sonuclari');
  duyuruKoleksiyonu = client.db(DB_ADI).collection('duyurular');
  console.log(`✅ MongoDB bağlantısı hazır → veritabanı: ${DB_ADI}, koleksiyon: ${KOLEKSIYON}`);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

baslat().catch(err => {
  console.error('❌ Başlatılamadı:', err.message);
  process.exit(1);
});
