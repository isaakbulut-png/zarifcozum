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
const { createPaymentRouter } = require('./routes/payments');
const { createAdminRouter } = require('./routes/admin');
const { createSorularRouter } = require('./routes/sorular');
const { createDenemelerRouters } = require('./routes/denemeler');
const { createTeacherStudentHomeworkRouters } = require('./routes/ogretmen-ogrenci-odev');
const User = require('./models/User');
const Payment = require('./models/Payment');
const { createWebhookRouter } = require('./routes/webhooks');

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
app.use('/api/webhooks', createWebhookRouter());
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

// DOSYA TANIMLAMA LİSTESİ: Yeni iki dosyanız bu listenin sonuna resmi olarak eklenmiştir.
const sitePages = [
  'index.html', 'dene.html', 'asistan.html', 'canli.html', 'zoom-room.html', 'konu.html', 'mimari.html', 'panel.html', 'test.html', 'yasal.html',
  'ogrenci-paneli.html', 'ogretmen-paneli.html', 'kayit-giris.html', 'hakkimizda.html',
  'Platform Ayrıcalıkları.html', 'Paketler.html', 'planli-calisma.html', 'basari-odakli-sistem.html'
];
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
sitePages.forEach(page => {
  const route = page === 'Platform Ayrıcalıkları.html'
    ? /^\/Platform%20Ayr%C4%B1cal%C4%B1klar%C4%B1\.html$/i
    : `/${page}`;
  app.get(route, (req, res, next) => {
    const role = page === 'ogrenci-paneli.html' ? 'student'
      : page === 'ogretmen-paneli.html' ? 'teacher'
      : null;
    if (page === 'kayit-giris.html' && req.query.mode !== 'register') {
      const current = req.session.user?.role;
      const requested = req.query.role;
      const panel = current === 'student' ? '/ogrenci-paneli.html'
        : current === 'teacher' ? '/ogretmen-paneli.html'
        : null;
      if (panel && (!requested || requested === current)) return res.redirect(panel);
    }
    if (!role) return next();
    if (!req.session.user) return res.redirect('/kayit-giris.html');
    const adminOgretmenPaneli = role === 'teacher' && req.session.user.role === 'admin';
    if (req.session.user.role !== role && !adminOgretmenPaneli) {
      return res.redirect(
        req.session.user.role === 'admin' ? '/admin-paneli.html'
          : req.session.user.role === 'teacher' ? '/ogretmen-paneli.html'
          : '/ogrenci-paneli.html'
      );
    }
    next();
  }, (req, res) => res.sendFile(path.join(__dirname, page)));
});

// Yönetici paneli: ana sayfada bağlantısı yoktur; yalnızca /yonetim adresinden ulaşılır.
function adminSayfasiGonder(dosya) {
  return (req, res) => {
    res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' });
    res.sendFile(path.join(__dirname, dosya));
  };
}
app.get(['/yonetim', '/admin-giris.html'], (req, res, next) => {
  if (req.session.user?.role === 'admin') return res.redirect('/admin-paneli.html');
  next();
}, adminSayfasiGonder('admin-giris.html'));
app.get('/admin-paneli.html', (req, res, next) => {
  if (req.session.user?.role !== 'admin') return res.redirect('/yonetim');
  next();
}, adminSayfasiGonder('admin-paneli.html'));
app.get('/favicon.svg', (req, res) => res.sendFile(path.join(__dirname, 'favicon.svg')));

let koleksiyon, anahtarKoleksiyon, canliDersKoleksiyonu;
let planliDersKoleksiyonu, quizKoleksiyonu, quizSonucKoleksiyonu, duyuruKoleksiyonu;
let studentProfiles, homeworks, homeworkAssignments, homeworkAudits;
const ogrenciKontrol = requireRole('student');
const ogretmenKontrol = requireRole('teacher');
app.use('/api/sorular', createSorularRouter({ requireStaff: requireRole('teacher', 'admin') }));
const denemeRouters = createDenemelerRouters({
  requireStaff: requireRole('teacher', 'admin'),
  requireStudent: ogrenciKontrol,
  getResultCollection: () => quizSonucKoleksiyonu
});
app.use('/api/denemeler', denemeRouters.staff);
app.use('/api/ogrenci/denemeler', denemeRouters.student);
app.use('/api/acik-deneme', denemeRouters.acik);
app.use('/api/admin', createAdminRouter({
  requireAdmin: requireRole('admin'),
  User,
  Payment,
  getAnnouncementCollection: () => duyuruKoleksiyonu
}));
app.use('/api/payments', createPaymentRouter({ requireStudent: ogrenciKontrol }));
app.use('/api/ai', createAIRouter({
  getQuizCollection: () => quizKoleksiyonu,
  requireRole
}));
const teacherStudentHomeworkRouters = createTeacherStudentHomeworkRouters({
  requireTeacher: requireRole('teacher', 'admin'),
  requireStudent: ogrenciKontrol,
  UserModel: User,
  getStudentCollection: () => studentProfiles,
  getHomeworkCollection: () => homeworks,
  getAssignmentCollection: () => homeworkAssignments,
  getAuditCollection: () => homeworkAudits,
  getQuizCollection: () => quizKoleksiyonu,
  getStudentQuizResultsCollection: () => quizSonucKoleksiyonu
});
app.use('/api/ogretmen', teacherStudentHomeworkRouters.teacher);
app.use('/api/student', teacherStudentHomeworkRouters.student);

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
  const yanit = await fetch(`https://zoom.us{sorgu}`, {
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
  const yanit = await fetch(`https://zoom.us{yol}`, {
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
