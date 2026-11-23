// Kurulum:  npm install
// Çalıştır: npm start
const fs = require('fs');
const path = require('path');
const http = require('http');
// .env önceliklidir; eksik değişkenler baglanti_adresi.env dosyasından tamamlanır.
for (const file of ['.env', 'baglanti_adresi.env']) {
  const envPath = path.join(__dirname, file);
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
}
const express = require('express');
const { Server: SocketIOServer } = require('socket.io');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { createClient } = require('redis');
const crypto = require('crypto');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { router: authRouter, requireRole, redirectForRole } = require('./routes/auth');
const { createAIRouter } = require('./routes/ai');
const { createContentLibraryRouter } = require('./routes/content-library');
const { createPaymentRouter } = require('./routes/payments');
const { createAdminRouter } = require('./routes/admin');
const { createSiteMediaFilesRouter } = require('./routes/site-media-files');
const { createConfiguredMediaStorage, createConfiguredPrivateDocumentStorage } = require('./lib/site-media-storage');
const SiteMediaTargets = require('./assets/site-media-targets');
const { createSorularRouter } = require('./routes/sorular');
const { createCozumluSorularRouters } = require('./routes/cozumlu-sorular');
const { createDenemelerRouters } = require('./routes/denemeler');
const { createExamsRouter } = require('./routes/exams');
const { requireKonuLogin } = require('./lib/konu-erisimi');
const { createTeacherStudentHomeworkRouters } = require('./routes/ogretmen-ogrenci-odev');
const { createMessagesRouter } = require('./routes/messages');
const { createGelisimRouters } = require('./routes/ogrenci-gelisim');
const { createPratikRouter } = require('./routes/pratik');
const { createYaziliRouter } = require('./routes/yazili');
const { createLiveLessonsRouter } = require('./routes/live-lessons');
const { studentLessonFilter, matchesAudience, studentProfiles: getStudentProfiles } = require('./lib/live-lesson-audience');
const { createParentRouter } = require('./routes/parent');
const { createZoomMeeting } = require('./lib/zoom');
const { uretSorular } = require('./lib/ai-icerik');
const { mufredatiYukle } = require('./lib/mufredat');
const { adminRoleOf } = require('./lib/admin-rbac');
const User = require('./models/User');
const Parent = require('./models/Parent');
const Payment = require('./models/Payment');
const TeacherPayout = require('./models/TeacherPayout');
const SystemConfig = require('./models/SystemConfig');
const ChatMessage = require('./models/ChatMessage');
const LessonAttendance = require('./models/LessonAttendance');
const { PLANS, featureDecision } = require('./lib/subscription-plans');
const AdminLog = require('./models/AdminLog');
const CozumluSoru = require('./models/CozumluSoru');
const Deneme = require('./models/Deneme');
const Exam = require('./models/Exam');
const { createWebhookRouter } = require('./routes/webhooks');
const { attachRealtimeChat } = require('./lib/realtime-chat');
const { normalizeAiChatRequest, createAiChatReply } = require('./lib/ai-chat');
const { aiQuotaMiddleware, getQuotaStatus } = require('./middleware/aiQuota');
const { createFaqService } = require('./lib/faq-service');
const { redisOptions } = require('./lib/redis-options');
const { studentQuestion } = require('./lib/quiz-content');
const { createTeacherQuizHandler, createStudentQuizSubmissionHandler, createLiveQuizHandlers } = require('./routes/quizler');
const { createPointsService } = require('./lib/leaderboard');
const { createLeaderboardRouter } = require('./routes/leaderboard');
const { createCurriculumRouter } = require('./routes/curriculum');
const { createCurriculumAssignmentsRouter } = require('./routes/curriculum-assignments');
const { createStudentRecommendationsRouter } = require('./routes/student-recommendations');
const { createCurriculumService } = require('./lib/curriculumService');
const { isParentPanelDemoEnabled } = require('./lib/parent-panel-demo');
const { createMentorHintRouter } = require('./routes/mentor-ipucu');
const AiFaq = require('./models/AiFaq');

const PORT = process.env.PORT || 3000;
const mediaStorage = createConfiguredMediaStorage(process.env, {
  homepageDir: path.join(__dirname, 'uploads', 'homepage'),
  siteMediaDir: path.join(__dirname, 'uploads', 'site-media')
});
const privateDocumentStorage = createConfiguredPrivateDocumentStorage(process.env);
const curriculumService = createCurriculumService();
const parentPanelDemoMode = isParentPanelDemoEnabled();
const MONGODB_URI = process.env.MONGODB_URI;           // .env dosyasından okunur
const DB_ADI      = process.env.DB_ADI || 'etut_merkezi';
const KOLEKSIYON  = process.env.KOLEKSIYON || 'sinav_sonuclari';
const SESSION_SECRET = String(process.env.SESSION_SECRET || '');
const ZOOM_ACCOUNT_ID = String(process.env.ZOOM_ACCOUNT_ID || '').trim();
const ZOOM_CLIENT_ID = String(process.env.ZOOM_CLIENT_ID || '').trim();
const ZOOM_CLIENT_SECRET = String(process.env.ZOOM_CLIENT_SECRET || '').trim();
if (!MONGODB_URI) {
  console.error('❌ .env dosyasında MONGODB_URI bulunamadı.');
  process.exit(1);
}
if (SESSION_SECRET.length < 32) {
  console.error('❌ SESSION_SECRET en az 32 karakter olmalıdır (.env dosyasına ekleyin).');
  process.exit(1);
}

const app = express();
const redisClient = process.env.REDIS_URL
  ? createClient(redisOptions(process.env.REDIS_URL))
  : null;
if (redisClient) {
  redisClient.on('error', error => console.error('Redis bağlantı hatası:', error));
}
const faqService = createFaqService({
  getFaqModel: () => AiFaq,
  redisClient
});
const generateAssistantReply = createAiChatReply({ findFaq: faqService.findAnswer });
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use('/api/webhooks', createWebhookRouter());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
const sessionStore = MongoStore.create({
  mongoUrl: MONGODB_URI,
  dbName: DB_ADI,
  collectionName: 'sessions',
  ttl: 8 * 60 * 60
});
const sessionMiddleware = session({
  name: 'zarifcozum.sid',
  secret: SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
});
app.use(sessionMiddleware);
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { maxHttpBufferSize: 64 * 1024 });
attachRealtimeChat(io, {
  sessionMiddleware,
  sessionStore,
  UserModel: User,
  SystemConfigModel: SystemConfig,
  isSubscriptionRequired: abonelikZorunluMu,
  getActiveCollection: () => canliDersKoleksiyonu,
  getStudentCollection: () => studentProfiles,
  ChatMessageModel: ChatMessage,
  LessonAttendanceModel: LessonAttendance,
  generateReply: generateAssistantReply
});
// Abonelik zorunluyken öğrenci özellikleri pakete göre açılır (bkz. lib/subscription-plans.js).
// Ödeme (/api/payments) ve oturum uçları bilerek dışarıda bırakılmıştır.
const PAKET_OZELLIK_YOLLARI = [
  ['/api/chat', 'asistan'],
  ['/api/mufredat-ozet', 'konu'],
  ['/api/canli/katilim', 'canli'],
  ['/api/ogrenci/denemeler', 'deneme'],
  ['/api/student', 'takip'],
  ['/api/ogrenci/quiz', 'takip'],
  ['/api/cevap-kaydet', 'takip'],
  ['/api/mentor-ipucu', 'asistan']
];
let abonelikZorunluOnbellek = { deger: false, zaman: 0 };
async function abonelikZorunluMu() {
  if (Date.now() - abonelikZorunluOnbellek.zaman > 15000) {
    const ayarlar = await SystemConfig.getVisitorSettings();
    abonelikZorunluOnbellek = { deger: Boolean(ayarlar.subscriptionRequired), zaman: Date.now() };
  }
  return abonelikZorunluOnbellek.deger;
}

function paketYaniti(res, karar) {
  const adlar = Object.fromEntries(Object.entries(PLANS).map(([anahtar, plan]) => [anahtar, plan.label]));
  const gerekli = adlar[karar.gerekliPlan] || karar.gerekliPlan;
  return res.status(karar.mevcutPlan ? 403 : 402).json({
    mesaj: karar.mevcutPlan
      ? `Bu özellik için ${gerekli} veya üzeri paket gerekir.`
      : 'Bu özellik için aktif aboneliğiniz olmalıdır.',
    kod: karar.mevcutPlan ? 'PLAN_UPGRADE_REQUIRED' : 'SUBSCRIPTION_REQUIRED',
    gerekliPlan: karar.gerekliPlan,
    mevcutPlan: karar.mevcutPlan,
    yonlendir: '/Paketler.html'
  });
}

// Yönetici tarafından kısıtlanan öğrenci/öğretmen hesapları, açık oturumları olsa bile hiçbir işlem yapamaz.
app.use(async (req, res, next) => {
  const sessionUser = req.session?.user;
  const isPageRequest = req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'));
  if (!sessionUser?.id || sessionUser.adminRole || sessionUser.role === 'admin' ||
      !(req.path.startsWith('/api') || isPageRequest)) return next();
  try {
    const account = await User.findById(sessionUser.id)
      .select('role restricted restrictionReason subscriptionStatus subscriptionPlan expiresAt').lean();
    if (account?.restricted) {
      return req.session.destroy(error => {
        if (error) console.error('Kısıtlı hesabın oturumu kapatılamadı:', error);
        res.clearCookie('zarifcozum.sid', { path: '/' });
        if (req.path.startsWith('/api')) {
          const neden = account.restrictionReason ? ` Neden: ${account.restrictionReason}` : '';
          return res.status(403).json({
            mesaj: `Hesabınız yönetici tarafından kısıtlanmıştır.${neden}`,
            kod: 'ACCOUNT_RESTRICTED'
          });
        }
        res.redirect('/kayit-giris.html');
      });
    }
    const kural = account?.role === 'student' && PAKET_OZELLIK_YOLLARI
      .find(([yol]) => req.path === yol || req.path.startsWith(`${yol}/`));
    if (kural && await abonelikZorunluMu()) {
      const karar = featureDecision(account, kural[1]);
      if (!karar.izin) return paketYaniti(res, karar);
    }
    return next();
  } catch (error) {
    console.error('Hesap kısıtlaması doğrulanamadı:', error);
    res.status(500).json({ mesaj: 'Hesap durumu doğrulanamadı.' });
  }
});
// Ücretli Gemini kotasını korur: yalnızca giriş yapmış kullanıcılar, kullanıcı başına sınırlı istek.
// Yerel testler (localhost) limitten muaftır.
const LOOPBACK_IPLER = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.session.user.id}`,
  skip: (req) => LOOPBACK_IPLER.has(req.ip),
  message: { success: false, error: 'Çok fazla istek gönderdiniz. Lütfen birkaç dakika sonra tekrar deneyin.' }
});
const mufredatKonulariLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla müfredat isteği gönderdiniz. Lütfen biraz sonra tekrar deneyin.' }
});

// aiService.mjs ES Module olduğundan CommonJS içinden dinamik import ile yüklenir
app.get('/api/mufredat-konulari', mufredatKonulariLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const grade = Number(req.query.grade);
  if (!Number.isInteger(grade) || grade < 5 || grade > 12) {
    return res.status(400).json({ mesaj: 'grade 5 ile 12 arasında bir tam sayı olmalı.' });
  }

  try {
    const { mufredatKonulariniGetir } = await import('./aiService.mjs');
    const konular = await mufredatKonulariniGetir(grade);
    res.json({ grade, konular });
  } catch (error) {
    console.error('/api/mufredat-konulari hatası:', error);
    res.status(502).json({ mesaj: 'Müfredat konuları şu anda alınamadı.' });
  }
});

app.get('/api/mufredat-ozet', mufredatKonulariLimiter, requireKonuLogin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const grade = Number(req.query.grade);
  const topic = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';
  if (!Number.isInteger(grade) || grade < 5 || grade > 12 || !topic || topic.length > 300) {
    return res.status(400).json({ mesaj: 'Geçerli bir grade (5-12) ve topic gerekli.' });
  }
  try {
    const { konuOzetiGetir } = await import('./aiService.mjs');
    res.json({ grade, topic, ozet: await konuOzetiGetir(grade, topic) });
  } catch (error) {
    console.error('/api/mufredat-ozet hatası:', error);
    res.status(502).json({ mesaj: 'Konu özeti şu anda alınamadı.' });
  }
});


// Öğrenci Anlık AI Kota Durumu
app.get('/api/student/ai-quota', requireRole('student', 'teacher', 'admin'), async (req, res) => {
  try {
    let targetId = req.session.user._id || req.session.user.id;
    const isStaff = req.session.user.role === 'admin' || req.session.user.role === 'teacher';
    if (isStaff && req.query.previewUserId) {
      targetId = req.query.previewUserId;
    }
    const user = await User.findById(targetId);
    const status = getQuotaStatus(user);
    if (isStaff && req.query.previewUserId && user) {
      status.sinirsiz = false; // Önizlemede öğrencinin gerçek kotasını göster
      status.isPreview = true;
      status.name = user.name;
    }
    res.json(status);
  } catch (error) {
    res.status(500).json({ mesaj: 'Kota bilgisi alınamadı.' });
  }
});

app.post('/api/chat', requireRole('student', 'teacher', 'admin'), chatLimiter, aiQuotaMiddleware('message'), async (req, res) => {
  try {
    const request = normalizeAiChatRequest(req.body, req.session?.user?.role, req.session?.user);

    // AI Mentör ile Zayıf Konu Köprüsü: Öğrencinin en zayıf 3 konusunu ve genel test başarısını bağlama ekle (0 ekstra token israfı)
    if (req.session?.user?.role === 'student' && req.session?.user?.id) {
      try {
        const { getStudentWeakContext } = require('./routes/ogrenci-gelisim');
        const weakContext = await getStudentWeakContext(req.session.user.id, () => kazanimIlerleme);
        if (weakContext && weakContext.zayifKonular?.length > 0) {
          request.userContext = request.userContext || {};
          request.userContext.zayifKonular = weakContext.zayifKonular;
          request.userContext.basariOrtalamasi = weakContext.testOrtalama;
        }
      } catch (wErr) {
        console.warn('Zayıf konu bağlamı eklenirken uyarı:', wErr.message);
      }
    }

    // Maliyetsiz Kısa Hafıza: Son 2 mesaj çiftini (4 mesaj) veritabanından alıp modele aktar
    if (!request.history || request.history.length === 0) {
      const pastMessages = await ChatMessage.find({ userId: req.session.user.id, roomName: 'assistant' })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean();
      if (pastMessages && pastMessages.length > 0) {
        request.history = pastMessages.reverse().map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.message
        }));
      }
    }

    const yanit = await generateAssistantReply(request);
    const createdAt = new Date();
    await ChatMessage.create([
      { userId: req.session.user.id, roomName: 'assistant', sender: 'user', message: request.ogrenciMesaji, createdAt },
      {
        userId: req.session.user.id, roomName: 'assistant', sender: 'ai',
        message: yanit.text, richHtml: yanit.html || undefined,
        createdAt: new Date(createdAt.getTime() + 1)
      }
    ]);
    // Auto-persist educational AI topic summaries or study plans to ContentLibrary
    try {
      const msgLower = (request.ogrenciMesaji || '').toLowerCase();
      let detectedType = null;
      if (msgLower.includes('calisma plani') || msgLower.includes('çalışma planı') || msgLower.includes('haftalık plan') || msgLower.includes('ders planı')) {
        detectedType = 'ai_study_plan';
      } else if (msgLower.includes('konu anlatım') || msgLower.includes('özetle') || msgLower.includes('konu özeti') || (request.konu && yanit.text && yanit.text.length > 250)) {
        detectedType = 'ai_topic_summary';
      }
      if (detectedType && yanit.text && yanit.text.length > 100) {
        const ContentLibrary = require('./models/ContentLibrary');
        const autoTitle = (request.konu ? `${request.konu} - ` : '') + (detectedType === 'ai_study_plan' ? 'Çalışma Planı' : 'Konu Özeti');
        ContentLibrary.create({
          title: autoTitle,
          contentType: detectedType,
          lesson: request.ders || 'Genel',
          grade: request.sinif || 'Genel',
          topic: request.konu || 'Genel',
          body: yanit.text,
          htmlContent: yanit.html || undefined,
          metadata: {
            prompt: request.ogrenciMesaji,
            generatedBy: 'AI Mentor'
          },
          source: 'ai_mentor',
          status: 'draft',
          createdBy: req.session.user.id
        }).catch(err => console.warn('ContentLibrary auto-log warn:', err.message));
      }
    } catch (_) {}
    res.json({ success: true, yanit: yanit.text, yanitHtml: yanit.html || undefined });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('/api/chat hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası oluştu.' });
  }
});
// app.use(authRouter); satırının hemen ÜSTÜNE ekleyin:
app.get('/planli-calisma.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'planli-calisma.html'));
});

app.get('/basari-odakli-sistem.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'basari-odakli-sistem.html'));
});
// panel.html eski demo panelidir; içeriği gerçek verilerle öğrenci paneline taşındı.
app.get('/panel.html', (req, res) => res.redirect(301, '/ogrenci-paneli.html'));
app.get('/asistan.html', (req, res) => res.redirect(302, '/ogrenci-paneli.html#ai-mentor-panel'));
app.use(authRouter);
app.use(express.static(path.join(__dirname, 'public'))); // public/deneme-sinavi-optik.html
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
  fallthrough: true
}));
if (mediaStorage.get) app.use('/uploads', createSiteMediaFilesRouter(mediaStorage));

// Cloudflare R2 AI İllüstrasyon Akışı (Render restartlarında veri kaybını önler, kalıcı R2 deposundan okur)
app.get('/uploads/ai-illustrations/:filename', async (req, res) => {
  const filename = req.params.filename;
  if (!/^[a-z0-9_.-]+\.(png|jpe?g|webp)$/i.test(filename)) {
    return res.status(400).send('Geçersiz görsel adı.');
  }

  try {
    const { getFromR2 } = require('./lib/image-generator');
    const object = await getFromR2(`ai-illustrations/${filename}`);
    if (!object || !object.Body) {
      return res.status(404).send('Görsel bulunamadı.');
    }

    res.set({
      'Content-Type': object.ContentType || 'image/png',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    if (Number.isSafeInteger(object.ContentLength)) {
      res.set('Content-Length', String(object.ContentLength));
    }

    const { pipeline } = require('node:stream/promises');
    await pipeline(object.Body, res);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).send('Görsel bulunamadı.');
    }
    console.error('[R2 AI Illustrations] Görsel getirme hatası:', err.message);
    res.status(503).send('Görsel deposuna ulaşılamadı.');
  }
});
app.use('/logo', express.static(path.join(__dirname, 'logo')));
app.use('/pages', express.static(path.join(__dirname, 'pages'), { extensions: ['html'] }));
app.get('/api/homepage-assets', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json({ homepageAssets: await SystemConfig.getHomepageAssets() });
  } catch (error) {
    console.error('Ana sayfa medya ayarları alınamadı:', error);
    res.status(500).json({ mesaj: 'Ana sayfa medya ayarları alınamadı.' });
  }
});
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    nodeVersion: process.version,
    memoryUsage: Math.round(process.memoryUsage().rss / (1024 * 1024))
  });
});
app.get('/api/announcement-banner', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const banner = await SystemConfig.getAnnouncementBanner();
    res.json({ banner, ...banner });
  } catch (error) {
    console.error('Bilgilendirme panosu alınamadı:', error);
    res.json({ banner: { active: false, title: 'Önemli Bilgilendirme', message: '', type: 'warning' }, active: false, title: 'Önemli Bilgilendirme', message: '', type: 'warning' });
  }
});
app.get('/api/site-media', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const pagePath = SiteMediaTargets.normalizePagePath(req.query.page);
  if (!pagePath) return res.status(400).json({mesaj: 'Sayfa medya hedefi geçersiz.'});
  try {
    const placements = await SystemConfig.getSiteMediaPlacements();
    res.json({
      placements: placements
        .filter(item => item.pagePath === pagePath)
        .map(({targetKey, assetType, url}) => ({targetKey, assetType, url}))
    });
  } catch (error) {
    console.error('Sayfa medyaları alınamadı:', error);
    res.status(500).json({mesaj: 'Sayfa medyaları alınamadı.'});
  }
});

const sitePages = [
  'index.html', 'dene.html', 'asistan.html', 'asistanla-soru-coz.html', 'canli.html', 'zoom-room.html', 'konu.html', 'mimari.html', 'panel.html', 'test.html', 'pratik.html', 'yasal.html',
  'ogrenci-paneli.html', 'ogretmen-paneli.html', 'ogretmen-profil-ayarlari.html', 'veli-panel.html', 'kayit-giris.html', 'hakkimizda.html', 'iletisim.html',
  'Platform Ayrıcalıkları.html',   'Paketler.html', 'deneme-sinavi-optik.html'
];
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
sitePages.forEach(page => {
  const route = page === 'Platform Ayrıcalıkları.html'
    ? /^\/Platform%20Ayr%C4%B1cal%C4%B1klar%C4%B1\.html$/i
    : `/${page}`;
  app.get(route, async (req, res, next) => {
    const role = ['ogrenci-paneli.html', 'asistanla-soru-coz.html'].includes(page) ? 'student'
      : ['ogretmen-paneli.html', 'ogretmen-profil-ayarlari.html'].includes(page) ? 'teacher'
      : page === 'veli-panel.html' ? 'parent'
      : null;
    if (role && req.query.siteMediaDesigner === '1' &&
        req.session.user?.role === 'admin' && req.session.user.adminRole === 'superadmin') {
      return res.sendFile(path.join(__dirname, page));
    }
    // Öğretmen giriş bağlantısı mevcut oturumu kapatıp parola ekranını gösterir.
    if (page === 'kayit-giris.html' && req.query.mode !== 'register') {
      const current = req.session.user?.role;
      const requested = req.query.role;
      if (requested === 'teacher' && req.session?.user) {
        return req.session.destroy(error => {
          if (error) {
            console.error('Öğretmen girişi öncesi oturum kapatılamadı:', error);
            return res.status(500).send('Güvenli giriş için mevcut oturum kapatılamadı.');
          }
          res.clearCookie('zarifcozum.sid', { path: '/' });
          next();
        });
      }
      const panel = current === 'student' ? '/ogrenci-paneli.html'
        : current === 'teacher' ? '/ogretmen-paneli.html'
        : current === 'parent' ? '/veli-panel.html'
        : null;
      if (panel && (!requested || requested === current)) return res.redirect(panel);
    }
    if (!role) return next();
    if (!req.session.user) return res.redirect(role === 'parent' ? '/kayit-giris.html?role=parent' : '/kayit-giris.html');
    let canOpen = req.session.user.role === role;
    if (role === 'parent') {
      if (req.session.user.role !== 'parent') {
        canOpen = false;
      } else {
        try {
          const parent = await Parent.findById(req.session.user.id).select('name surname restricted');
          canOpen = Boolean(parent && !parent.restricted);
          if (parent) {
            req.session.user = {
              ...req.session.user,
              name: `${parent.name} ${parent.surname}`.trim(),
              role: 'parent',
              adminRole: null
            };
          }
        } catch (error) {
          console.error('Veli paneli hesabı doğrulanamadı:', error);
          return res.status(500).send('Veli paneli hesabı doğrulanamadı.');
        }
      }
    } else if (role === 'student') {
      if (['student', 'admin'].includes(req.session.user.role) || req.session.user.adminRole) {
        canOpen = true;
      }
    } else if (role === 'teacher') {
      if (!['teacher', 'admin'].includes(req.session.user.role) && !req.session.user.adminRole) {
        canOpen = false;
      } else {
        try {
          const user = await User.findById(req.session.user.id).select('name role adminRole');
          const adminRole = adminRoleOf(user);
          canOpen = Boolean(user && (
            user.role === 'teacher' && (!adminRole || ['superadmin', 'editor'].includes(adminRole)) ||
            user.role === 'admin' && adminRole !== 'support'
          ));
          if (user) {
            req.session.user = { ...req.session.user, name: user.name, role: user.role, adminRole };
          }
        } catch (error) {
          console.error('Öğretmen paneli rolü doğrulanamadı:', error);
          return res.status(500).send('Öğretmen paneli yetkisi doğrulanamadı.');
        }
      }
    }
    if (!canOpen) {
      return res.redirect(
        req.session.user.adminRole || req.session.user.role === 'admin' ? '/admin-paneli.html'
          : redirectForRole(req.session.user.role, req.session.user.adminRole)
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
app.get(['/admin', '/yonetim', '/admin-giris.html'], async (req, res, next) => {
  if (req.session.user?.id) {
    try {
      const user = await User.findById(req.session.user.id).select('name email role adminRole');
      const adminRole = adminRoleOf(user);
      if (adminRole || user?.role === 'admin') {
        req.session.user = { ...req.session.user, name: user.name, email: user.email, role: user.role, adminRole: adminRole || 'superadmin' };
        return res.redirect('/admin-paneli.html');
      }
    } catch (e) {
      // Hata durumunda devam et
    }
  }
  next();
}, adminSayfasiGonder('admin-giris.html'));
app.get(['/admin-paneli', '/admin-paneli.html', '/admin-maliyet.html'], async (req, res, next) => {
  if (!req.session.user?.id) return res.redirect('/yonetim');
  try {
    const user = await User.findById(req.session.user.id).select('name email role adminRole');
    const adminRole = adminRoleOf(user);
    if (!adminRole && user?.role !== 'admin') return res.redirect('/yonetim');
    req.session.user = { ...req.session.user, name: user.name, email: user.email, role: user.role, adminRole: adminRole || 'superadmin' };
  } catch (error) {
    console.error('Yönetim paneli rolü doğrulanamadı:', error);
    return res.status(500).send('Yönetim paneli yetkisi doğrulanamadı.');
  }
  const targetPage = req.path.includes('admin-maliyet') ? 'admin-maliyet.html' : 'admin-paneli.html';
  adminSayfasiGonder(targetPage)(req, res);
});
app.get(['/favicon.ico', '/favicon.svg', '/favicon-32x32.png'], (req, res) => {
  const fileName = req.path.replace(/^\//, '');
  const publicPath = path.join(__dirname, 'public', fileName);
  if (fs.existsSync(publicPath)) return res.sendFile(publicPath);
  const rootPath = path.join(__dirname, fileName);
  if (fs.existsSync(rootPath)) return res.sendFile(rootPath);
  res.status(404).end();
});
app.get('/animasyon.js', (req, res) => {
  const assetPath = path.join(__dirname, 'assets', 'animasyon.js');
  if (fs.existsSync(assetPath)) return res.sendFile(assetPath);
  const rootPath = path.join(__dirname, 'animasyon.js');
  if (fs.existsSync(rootPath)) return res.sendFile(rootPath);
  res.status(404).end();
});

let koleksiyon, anahtarKoleksiyon, canliDersKoleksiyonu;
let planliDersKoleksiyonu, quizKoleksiyonu, quizSonucKoleksiyonu, quizAttemptKoleksiyonu, duyuruKoleksiyonu;
let mongoClient;
const pointsService = createPointsService({
  getClient: () => mongoClient,
  getDb: () => mongoClient.db(DB_ADI),
  userCollectionName: User.collection.name
});
let studentProfiles, homeworks, homeworkAssignments, homeworkAudits;
let calismaKayitlari, ogrenciHedefleri, kazanimIlerleme, ogretmenYorumlari, takvimOlaylari;
let pratikKullanim, pratikIcerik;
let supportTickets;
const ogrenciKontrol = requireRole('student');
const ogretmenKontrol = requireRole('teacher');
const veliKontrol = requireRole('parent');
app.use('/api/v1/curriculum', createCurriculumRouter({
  requireStaff: requireRole('teacher', 'admin'), getDb: () => mongoClient.db(DB_ADI)
}));
app.use('/api/v1/assignments', createCurriculumAssignmentsRouter({
  requireTeacher: ogretmenKontrol, getStudents: () => studentProfiles,
  getDb: () => mongoClient.db(DB_ADI)
}));
app.use('/api/student', createStudentRecommendationsRouter({
  requireRoles: requireRole('student', 'parent', 'teacher'),
  ParentModel: Parent, UserModel: User, getStudents: () => studentProfiles
}));
app.use('/api/leaderboard', createLeaderboardRouter({requireStudent: ogrenciKontrol, pointsService}));
app.use('/api/mentor-ipucu', createMentorHintRouter({
  requireStudent: ogrenciKontrol, limiter: chatLimiter,
  getResults: () => quizSonucKoleksiyonu,
  getQuizzes: () => quizKoleksiyonu,
  getAttempts: () => quizAttemptKoleksiyonu,
  generateHint: async payload => (await import('./aiService.mjs')).kazanimaOzelIpucu(payload),
  generateGeneralHint: async payload => (await import('./aiService.mjs')).genelSokratikIpucu(payload)
}));
app.use('/api/sorular', createSorularRouter({
  requireStaff: requireRole('teacher', 'admin'),
  AdminLog
}));
const cozumluSorular = createCozumluSorularRouters({
  Model: CozumluSoru, User, AdminLog,
  getTopics: async grade => (await import('./aiService.mjs')).mufredatKonulariniGetir(grade)
});
app.use('/api/cozumlu-sorular', cozumluSorular.publicRouter);
app.use('/api/admin/cozumlu-sorular', cozumluSorular.admin);
const denemeRouters = createDenemelerRouters({
  requireStaff: requireRole('teacher', 'admin'),
  requireStudent: ogrenciKontrol,
  getResultCollection: () => quizSonucKoleksiyonu,
  getProgressCollection: () => kazanimIlerleme,
  pointsService
});
app.use('/api/denemeler', denemeRouters.staff);
app.use('/api/ogrenci/denemeler', denemeRouters.student);
app.use('/api/acik-deneme', denemeRouters.acik);
const examRouters = createExamsRouter({
  requireStaff: requireRole('teacher', 'admin'),
  requireStudent: ogrenciKontrol
});
app.use('/api/exams', examRouters.staff);
app.use('/api/ogrenci/exams', examRouters.student);
app.use('/api/admin', createAdminRouter({
  User,
  Payment,
  SystemConfig,
  AdminLog,
  mediaStorage,
  getAnnouncementCollection: () => duyuruKoleksiyonu,
  getFaqModel: () => AiFaq,
  invalidateFaqCache: faqService.invalidate,
  getQuizCollection: () => quizKoleksiyonu,
  getLessonCollection: () => pratikIcerik,
  getSupportTicketCollection: () => supportTickets,
  getHomeworkCollection: () => homeworks,
  getAssignmentCollection: () => homeworkAssignments,
  getResultCollection: () => quizSonucKoleksiyonu,
  getAttemptCollection: () => quizAttemptKoleksiyonu,
  getStudentCollection: () => studentProfiles,
  getDenemeModel: () => Deneme
}));
app.use('/api/payments', createPaymentRouter({ requireStudent: ogrenciKontrol }));
app.use('/api/yazili', createYaziliRouter({ requireRole }));
app.use('/api/ai', createAIRouter({
  getQuizCollection: () => quizKoleksiyonu,
  requireRole,
  AdminLog
}));
app.use('/api/content-library', createContentLibraryRouter({
  requireStaff: requireRole('teacher', 'admin'),
  mediaStorage,
  privateDocumentStorage,
  AdminLog
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
  getStudentQuizResultsCollection: () => quizSonucKoleksiyonu,
  getCurriculumAssignmentsCollection: () => mongoClient.db(DB_ADI).collection('curriculum_assignments'),
  notifyParent: event => curriculumService.sendNotification(event),
  pointsService,
  privateDocumentStorage
});
const gelisimRouters = createGelisimRouters({
  requireTeacher: requireRole('teacher', 'admin'),
  requireStudent: ogrenciKontrol,
  getStudentCollection: () => studentProfiles,
  getAssignmentCollection: () => homeworkAssignments,
  getHomeworkCollection: () => homeworks,
  getResultCollection: () => quizSonucKoleksiyonu,
  getPlannedLessonCollection: () => planliDersKoleksiyonu,
  getStudyLogCollection: () => calismaKayitlari,
  getGoalCollection: () => ogrenciHedefleri,
  getProgressCollection: () => kazanimIlerleme,
  getCommentCollection: () => ogretmenYorumlari,
  getEventCollection: () => takvimOlaylari
});
app.use('/api/pratik', createPratikRouter({
  getUsageCollection: () => pratikKullanim,
  getContentCollection: () => pratikIcerik,
  getVisitorSettings: () => SystemConfig.getVisitorSettings(),
  mufredat: mufredatiYukle(),
  mufredatKonusuVarMi: async (grade, konu) => {
    const { mufredatKonulariniGetir } = await import('./aiService.mjs');
    const konular = await mufredatKonulariniGetir(grade);
    return konular.some(kayit => kayit.dosya_adi === konu);
  },
  uyeMi: async kullanici => {
    if (!kullanici) return false;
    if (kullanici.role === 'teacher' || kullanici.role === 'admin') return true;
    const kayit = await User.findById(kullanici.id).select('subscriptionStatus expiresAt').lean();
    return Boolean(kayit && kayit.subscriptionStatus === 'active' && (!kayit.expiresAt || kayit.expiresAt > new Date()));
  },
  ozellikErisimi: async (kullanici, ozellik) => {
    if (kullanici?.role !== 'student' || !(await abonelikZorunluMu())) return null;
    const kayit = await User.findById(kullanici.id).select('subscriptionStatus subscriptionPlan expiresAt').lean();
    return featureDecision(kayit, ozellik);
  },
  soruUret: uretSorular,
  konuUret: async ({ sinif, konu }) => {
    const { konuAnlatimiZenginlestir } = await import('./aiService.mjs');
    return konuAnlatimiZenginlestir(sinif, konu);
  }
}));
app.use('/api/ogretmen/gelisim', gelisimRouters.teacher);
app.use('/api/student/gelisim', gelisimRouters.student);
app.use('/api/ogretmen', teacherStudentHomeworkRouters.teacher);
app.use('/api/student', teacherStudentHomeworkRouters.student);
app.use('/api/parent', createParentRouter({
  requireParent: veliKontrol,
  requireReportAccess: requireRole('parent', 'admin'),
  ParentModel: Parent,
  UserModel: User,
  ChatMessageModel: ChatMessage,
  LessonAttendanceModel: LessonAttendance,
  getStudentCollection: () => studentProfiles,
  service: curriculumService,
  demoMode: parentPanelDemoMode
}));
app.use('/api/messages', createMessagesRouter({ getDb: () => mongoClient?.db?.(DB_ADI) }));

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
    hata.zoomStatus = yanit.status;
    throw hata;
  }
  return veri;
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

app.get(['/api/student/dashboard', '/api/ogrenci/icerik'], ogrenciKontrol, async (req, res) => {
  try {
    let effectiveStudentId = req.session.user.id;
    if ((req.session.user.role === 'admin' || req.session.user.adminRole) && req.query.previewUserId) {
      effectiveStudentId = req.query.previewUserId;
    }
    const profiles = await getStudentProfiles(studentProfiles, effectiveStudentId);
    const [dersler, quizler, duyurular, sonuclar, aktifDers, parentConnectionCode] = await Promise.all([
      planliDersKoleksiyonu.find(studentLessonFilter(profiles))
        .sort({ startsAt: 1 }).limit(50).toArray(),
      quizKoleksiyonu.find({
        source: { $ne: 'curriculum_assignment' },
        $or: [{ source: { $ne: 'ai' } }, { source: 'ai', published: true }]
      })
        .sort({ createdAt: -1 }).limit(50).toArray(),
      duyuruKoleksiyonu.find({
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gte: new Date() } }
        ]
      }).sort({ createdAt: -1 }).limit(20).toArray(),
      quizSonucKoleksiyonu.find({ studentId: effectiveStudentId })
        .sort({ createdAt: -1 }).limit(100).toArray(),
      aktifCanliDersiAl(),
      User.ensureParentConnectionCode(req.session.user.id)
    ]);
    const assignedRows = await homeworkAssignments.find({studentUserId: req.session.user.id}).toArray();
    const assignedHomeworks = assignedRows.length
      ? await homeworks.find({_id: {$in: assignedRows.map(row => row.homeworkId)}, type: 'online'}).toArray()
      : [];
    const assignedQuizIds = assignedHomeworks.map(row => row.quizId)
      .filter(id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id))
      .map(id => new ObjectId(id));
    if (assignedQuizIds.length) {
      quizler.push(...await quizKoleksiyonu.find({_id: {$in: assignedQuizIds}, source: 'curriculum_assignment'}).toArray());
    }
    const teacherIds = profiles.map(p => p.teacherId).filter(Boolean);
    const tamamlananQuizler = new Set(sonuclar.map(result => result.quizId.toString()));
    res.json({
      parentConnectionCode,
      aktifDers: aktifDers && profiles.some(profile => matchesAudience(aktifDers, profile)) ? {
        title: aktifDers.topic,
        startsAt: aktifDers.startedAt,
        link: '/canli.html'
      } : null,
      dersler: dersler.map(lesson => ({
        id: lesson._id.toString(),
        title: lesson.title,
        startsAt: lesson.startsAt,
        status: lesson.kind === 'live' ? lesson.status : 'scheduled',
        link: lesson.kind === 'live' ? '' : lesson.link
      })),
      quizler: quizler.map(({ _id, title, description, questions, createdAt, createdBy, teacherId }) => {
        const isAssigned = assignedQuizIds.some(id => id.toString() === _id.toString());
        const isTeacherAssigned = Boolean(
          isAssigned ||
          (createdBy && teacherIds.includes(createdBy)) ||
          (teacherId && teacherIds.includes(teacherId))
        );
        return {
          id: _id.toString(),
          title,
          description,
          soruSayisi: questions.length,
          createdAt,
          tamamlandi: tamamlananQuizler.has(_id.toString()),
          isTeacherAssigned,
          questions: questions.map(studentQuestion)
        };
      }),
      duyurular: duyurular.map(({ _id, message, createdAt, expiresAt, durationDays, createdBy }) => ({
        id: _id.toString(),
        message,
        createdAt,
        expiresAt: expiresAt || null,
        durationDays: durationDays || null,
        isTeacherAnnouncement: Boolean(createdBy && teacherIds.includes(createdBy)),
        isOwner: createdBy === req.session.user.id || req.session.user.role === 'admin'
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

const liveQuizHandlers = createLiveQuizHandlers({
  getQuizCollection: () => quizKoleksiyonu,
  getAttemptCollection: () => quizAttemptKoleksiyonu,
  getResultCollection: () => quizSonucKoleksiyonu,
  getHomeworkCollection: () => homeworks,
  getHomeworkAssignmentCollection: () => homeworkAssignments,
  getProgressCollection: () => kazanimIlerleme,
  pointsService
});
app.post('/api/ogrenci/quiz/:id/attempt', ogrenciKontrol, liveQuizHandlers.start);
app.post('/api/ogrenci/quiz/:id/attempt/check', ogrenciKontrol, liveQuizHandlers.check);
app.post('/api/ogrenci/quiz/:id/attempt/finish', ogrenciKontrol, liveQuizHandlers.finish);
app.post('/api/ogrenci/quiz/:id/teslim', ogrenciKontrol, createStudentQuizSubmissionHandler({
  getQuizCollection: () => quizKoleksiyonu,
  getResultCollection: () => quizSonucKoleksiyonu,
  getAttemptCollection: () => quizAttemptKoleksiyonu,
  pointsService
}));

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
      dersler: dersler.map(({ _id, title, startsAt, link, kind, status }) => ({
        id: _id.toString(),
        title,
        startsAt,
        link: kind === 'live' ? '' : link,
        kind: kind || 'scheduled',
        status: status || 'scheduled'
      })),
      quizler: quizler.map(({ _id, title, description, questions, createdAt, source, published }) => ({
        id: _id.toString(), title, description, soruSayisi: questions.length, createdAt,
        aiYayin: source === 'ai' && published === true
      })),
      duyurular: duyurular.map(({ _id, message, createdAt, expiresAt, durationDays, createdBy }) => ({
        id: _id.toString(),
        message,
        createdAt,
        expiresAt: expiresAt || null,
        durationDays: durationDays || null,
        isOwner: createdBy === req.session.user.id || req.session.user.role === 'admin'
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

app.post('/api/ogretmen/quizler', ogretmenKontrol, createTeacherQuizHandler(() => quizKoleksiyonu));

app.post('/api/ogretmen/duyurular', ogretmenKontrol, async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 1000) {
      return res.status(400).json({ mesaj: 'Duyuru 1–1000 karakter arasında olmalıdır.' });
    }
    const durationDays = req.body?.durationDays !== undefined ? parseInt(req.body.durationDays, 10) : 14;
    let expiresAt = null;
    if (durationDays > 0) {
      expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }
    const announcement = {
      message,
      durationDays: durationDays > 0 ? durationDays : null,
      expiresAt,
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

app.delete('/api/ogretmen/duyurular/:id', ogretmenKontrol, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ mesaj: 'Geçersiz duyuru numarası.' });
    }
    const query = { _id: new ObjectId(id) };
    if (req.session.user.role !== 'admin') {
      query.createdBy = req.session.user.id;
    }
    const result = await duyuruKoleksiyonu.deleteOne(query);
    if (!result.deletedCount) {
      return res.status(404).json({ mesaj: 'Duyuru bulunamadı veya silme yetkiniz yok.' });
    }
    res.json({ success: true, mesaj: 'Duyuru yayından kaldırıldı ve silindi.' });
  } catch (err) {
    console.error('❌ Duyuru silinemedi:', err);
    res.status(500).json({ mesaj: 'Duyuru silinemedi: ' + err.message });
  }
});

// start_url kısa ömürlüdür; her istekte Zoom'dan taze alınır.
async function ogretmenBaslatmaBaglantisiAl(ders) {
  const belirteci = await zoomErisimBelirteciAl();
  const toplanti = await zoomApiIstegiYap(belirteci, 'GET', `/meetings/${encodeURIComponent(ders.meetingId)}`);
  return toplanti.start_url || '';
}

app.use(createLiveLessonsRouter({
  requireTeacher: requireRole('teacher', 'admin'),
  requireStudent: ogrenciKontrol,
  getScheduledCollection: () => planliDersKoleksiyonu,
  getActiveCollection: () => canliDersKoleksiyonu,
  getStudentCollection: () => studentProfiles,
  createMeeting: createZoomMeeting,
  getHostStartUrl: ogretmenBaslatmaBaglantisiAl,
  endMeeting: async lesson => {
    const token = await zoomErisimBelirteciAl();
    await zoomApiIstegiYap(
      token,
      'PUT',
      `/meetings/${encodeURIComponent(lesson.meetingId)}/status`,
      { action: 'end' }
    );
  }
}));

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

// ---------- Öğretmen Finans, Hakediş ve Profil Ayarları API ----------

const teacherInvoicesDir = path.join(__dirname, 'uploads', 'teacher-invoices');
try {
  if (!fs.existsSync(teacherInvoicesDir)) {
    fs.mkdirSync(teacherInvoicesDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Server] teacherInvoicesDir oluşturulamadı:', e.message);
}

const teacherInvoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, teacherInvoicesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `fatura-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});

const teacherInvoiceUpload = multer({
  storage: teacherInvoiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return cb(new Error('Yalnızca PDF veya resim (PNG, JPG) formatında fatura yüklenebilir.'));
    }
    cb(null, true);
  }
});

// 1. Öğretmenin Kendi Hakediş & Ödeme Geçmişi (Kural 4)
app.get('/api/ogretmen/hakedisler', ogretmenKontrol, async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const payouts = await TeacherPayout.find({ teacherId })
      .sort({ period: -1 })
      .lean();

    res.json({
      basarili: true,
      payouts: payouts.map(p => ({
        id: p._id.toString(),
        period: p.period,
        periodLabel: p.periodLabel,
        grossAmount: p.grossAmount,
        withholdingRate: p.withholdingRate,
        withholdingAmount: p.withholdingAmount,
        netAmount: p.netAmount,
        taxType: p.taxType,
        bankName: p.bankName,
        iban: p.iban,
        status: p.status,
        receiptUrl: p.receiptUrl,
        receiptFileName: p.receiptFileName,
        paidAt: p.paidAt,
        invoiceStatus: p.invoiceStatus,
        invoiceUrl: p.invoiceUrl,
        invoiceNo: p.invoiceNo,
        description: p.description,
        notes: p.notes
      }))
    });
  } catch (err) {
    console.error('Öğretmen hakediş geçmişi hatası:', err);
    res.status(500).json({ mesaj: 'Hakediş geçmişi alınamadı: ' + err.message });
  }
});

// 2. Şirket Öğretmenleri İçin Fatura Yükleme (Kural 1)
app.post('/api/ogretmen/fatura-yukle', ogretmenKontrol, teacherInvoiceUpload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mesaj: 'Fatura dosyası seçilmedi.' });
    }

    const { payoutId, invoiceNo } = req.body;
    if (!payoutId) {
      return res.status(400).json({ mesaj: 'Hakediş dönemi (payoutId) belirtilmedi.' });
    }

    const payout = await TeacherPayout.findOne({
      _id: payoutId,
      teacherId: req.session.user._id
    });

    if (!payout) {
      return res.status(404).json({ mesaj: 'İlgili hakediş kaydı bulunamadı.' });
    }

    payout.invoiceUrl = `/uploads/teacher-invoices/${req.file.filename}`;
    payout.invoiceStatus = 'yuklendi';
    if (invoiceNo) payout.invoiceNo = invoiceNo.trim();
    payout.invoiceDate = new Date();

    await payout.save();

    res.json({
      basarili: true,
      mesaj: 'Faturanız başarıyla yüklendi ve onay için muhasebeye iletildi.',
      invoiceUrl: payout.invoiceUrl,
      invoiceStatus: payout.invoiceStatus
    });
  } catch (err) {
    console.error('Fatura yükleme hatası:', err);
    res.status(500).json({ mesaj: 'Fatura yüklenemedi: ' + err.message });
  }
});

// 3. Öğretmen Bildirimleri (Kural 4)
app.get('/api/ogretmen/bildirimler', ogretmenKontrol, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
      .select('teacherNotifications')
      .lean();

    const notifications = (user?.teacherNotifications || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({
      basarili: true,
      notifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (err) {
    res.status(500).json({ mesaj: 'Bildirimler alınamadı: ' + err.message });
  }
});

// 4. Öğretmen Bildirimi Okundu İşaretle
app.post('/api/ogretmen/bildirim-okundu', ogretmenKontrol, async (req, res) => {
  try {
    const { notificationId } = req.body;
    if (notificationId) {
      await User.updateOne(
        { _id: req.session.user._id, 'teacherNotifications._id': notificationId },
        { $set: { 'teacherNotifications.$.read': true } }
      );
    } else {
      await User.updateOne(
        { _id: req.session.user._id },
        { $set: { 'teacherNotifications.$[].read': true } }
      );
    }
    res.json({ basarili: true });
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

// 5. Öğretmen Profil ve Finans Ayarları Getir
app.get('/api/ogretmen/profil-ayarlari', ogretmenKontrol, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
      .select('name email phone telefon brans branch graduationInfo verificationDocumentUrl basvuruDurumu ogretmenTipi teacherFinance')
      .lean();

    if (!user) return res.status(404).json({ mesaj: 'Öğretmen profili bulunamadı.' });

    res.json({
      basarili: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || user.telefon || '',
        brans: user.branch || user.brans || '',
        graduationInfo: user.graduationInfo || '',
        verificationDocumentUrl: user.verificationDocumentUrl || null,
        basvuruDurumu: user.basvuruDurumu || 'inceleme_suruyor',
        ogretmenTipi: user.ogretmenTipi || 'standart_ogretmen',
        teacherFinance: user.teacherFinance || {
          bankName: '',
          iban: '',
          accountHolder: user.name || '',
          taxType: 'bireysel',
          taxOffice: '',
          taxNumber: '',
          billingAddress: '',
          hourlyRate: 450
        }
      }
    });
  } catch (err) {
    res.status(500).json({ mesaj: 'Profil ayarları alınamadı: ' + err.message });
  }
});

// 6. Öğretmen Profil ve Finans Ayarları Kaydet
app.post('/api/ogretmen/profil-ayarlari', ogretmenKontrol, async (req, res) => {
  try {
    const {
      name, phone, brans, graduationInfo,
      bankName, iban, accountHolder, taxType, taxOffice, taxNumber, billingAddress
    } = req.body;

    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(404).json({ mesaj: 'Kullanıcı bulunamadı.' });

    if (name) user.name = name.trim();
    if (phone) {
      user.phone = phone.trim();
      user.telefon = phone.trim();
    }
    if (brans) {
      user.brans = brans.trim();
      user.branch = brans.trim();
    }
    if (graduationInfo !== undefined) user.graduationInfo = graduationInfo.trim();

    user.teacherFinance = user.teacherFinance || {};
    if (bankName !== undefined) user.teacherFinance.bankName = bankName.trim();
    if (iban !== undefined) user.teacherFinance.iban = iban.replace(/\s+/g, '').toUpperCase().trim();
    if (accountHolder !== undefined) user.teacherFinance.accountHolder = accountHolder.trim();
    if (taxType && ['bireysel', 'sahis_sirketi', 'limited_sirket'].includes(taxType)) {
      user.teacherFinance.taxType = taxType;
    }
    if (taxOffice !== undefined) user.teacherFinance.taxOffice = taxOffice.trim();
    if (taxNumber !== undefined) user.teacherFinance.taxNumber = taxNumber.trim();
    if (billingAddress !== undefined) user.teacherFinance.billingAddress = billingAddress.trim();

    await user.save();

    res.json({
      basarili: true,
      mesaj: 'Profil ve hesap ayarlarınız başarıyla kaydedildi.',
      teacherFinance: user.teacherFinance
    });
  } catch (err) {
    res.status(500).json({ mesaj: 'Ayarlar kaydedilemedi: ' + err.message });
  }
});

async function baslat() {
  await mongoose.connect(MONGODB_URI, { dbName: DB_ADI });
  await SystemConfig.initializeVisitorSettings();
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  mongoClient = client;
  koleksiyon = client.db(DB_ADI).collection(KOLEKSIYON);
  anahtarKoleksiyon = client.db(DB_ADI).collection('cevap_anahtarlari');
  canliDersKoleksiyonu = client.db(DB_ADI).collection('canli_dersler');
  planliDersKoleksiyonu = client.db(DB_ADI).collection('planli_dersler');
  quizKoleksiyonu = client.db(DB_ADI).collection('quizler');
  quizSonucKoleksiyonu = client.db(DB_ADI).collection('quiz_sonuclari');
  quizAttemptKoleksiyonu = client.db(DB_ADI).collection('quiz_canli_deneme');
  duyuruKoleksiyonu = client.db(DB_ADI).collection('duyurular');
  studentProfiles = client.db(DB_ADI).collection('ogrenci_profilleri');
  homeworks = client.db(DB_ADI).collection('odevler');
  homeworkAssignments = client.db(DB_ADI).collection('odev_atamalari');
  homeworkAudits = client.db(DB_ADI).collection('ogrenci_odev_islem_gecmisi');
  calismaKayitlari = client.db(DB_ADI).collection('calisma_kayitlari');
  ogrenciHedefleri = client.db(DB_ADI).collection('ogrenci_hedefleri');
  kazanimIlerleme = client.db(DB_ADI).collection('kazanim_ilerleme');
  ogretmenYorumlari = client.db(DB_ADI).collection('ogretmen_yorumlari');
  takvimOlaylari = client.db(DB_ADI).collection('takvim_olaylari');
  pratikKullanim = client.db(DB_ADI).collection('pratik_kullanim');
  pratikIcerik = client.db(DB_ADI).collection('pratik_icerik');
  supportTickets = client.db(DB_ADI).collection('destek_talepleri');
  await Promise.all([
    client.db(DB_ADI).collection('zarif_puan_sorulari').createIndex(
      {studentId: 1, questionKey: 1}, {unique: true, name: 'uniq_student_question_points'}
    ),
    quizSonucKoleksiyonu.createIndex({studentId: 1, quizId: 1, liveAttemptId: 1}, {name: 'student_quiz_live_result'}),
    pratikKullanim.createIndex({key: 1, ozellik: 1}, {unique: true, name: 'uniq_pratik_usage'}),
    pratikKullanim.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expire_pratik_usage' }),
    pratikIcerik.createIndex({tur: 1, sinif: 1, konu: 1, adet: 1}, {unique: true, name: 'uniq_pratik_content'}),
    User.createIndexes(),
    AiFaq.createIndexes(),
    Parent.createIndexes(),
    ChatMessage.createIndexes(),
    LessonAttendance.createIndexes(),
    calismaKayitlari.createIndex({studentUserId: 1, day: -1}, {name: 'student_study_days'}),
    ogrenciHedefleri.createIndex({studentUserId: 1}, {unique: true, name: 'uniq_student_goal'}),
    kazanimIlerleme.createIndex({studentUserId: 1, grade: 1, unit: 1, topic: 1}, {unique: true, name: 'uniq_student_outcome'}),
    ogretmenYorumlari.createIndex({studentUserId: 1, createdAt: -1}, {name: 'student_teacher_comments'}),
    takvimOlaylari.createIndex({studentUserId: 1, startsAt: 1}, {name: 'student_calendar'}),
    studentProfiles.createIndex({teacherId: 1, studentNumber: 1}, {unique: true, name: 'uniq_teacher_student_number'}),
    studentProfiles.createIndex({linkedUserId: 1}, {name: 'student_profile_linked_user'}),
    homeworks.createIndex({teacherId: 1, createdAt: -1}, {name: 'teacher_homework_history'}),
    homeworkAssignments.createIndex({homeworkId: 1, studentProfileId: 1}, {unique: true, name: 'uniq_homework_student_assignment'}),
    homeworkAssignments.createIndex({studentUserId: 1, status: 1, dueAt: 1}, {name: 'student_homework_status'}),
    homeworkAudits.createIndex({teacherId: 1, createdAt: -1}, {name: 'teacher_student_homework_audit'})
  ]);
  try {
    const { seedCurriculumNodes } = require('./lib/seedCurriculumNodes');
    const currCount = await client.db(DB_ADI).collection('curriculum_nodes').countDocuments();
    if (currCount < 200) {
      console.log('Müfredat düğümleri eksik; otomatik yükleme başlatılıyor...');
      await seedCurriculumNodes(client.db(DB_ADI));
    }
  } catch (err) {
    console.warn('Müfredat ağacı otomatik yükleme atlandı:', err.message);
  }
  if (redisClient) {
    redisClient.connect().catch(error => {
      console.error('Redis bağlantısı kurulamadı; FAQ aramaları MongoDB üzerinden sürdürülecek:', error);
    });
  } else {
    console.warn('REDIS_URL tanımlı değil; FAQ aramaları MongoDB üzerinden yapılacak.');
  }
  console.log(`✅ MongoDB bağlantısı hazır → veritabanı: ${DB_ADI}, koleksiyon: ${KOLEKSIYON}`);
  try {
    const { startDailyHealthScheduler } = require('./lib/system-health-scheduler');
    startDailyHealthScheduler({
      healthChecker: require('./lib/system-health-checker'),
      SystemHealthLog: require('./models/SystemHealthLog'),
      AdminLog: require('./models/AdminLog'),
      SystemConfig: require('./models/SystemConfig')
    });
  } catch (schedErr) {
    console.warn('Otomatik sağlık tarayıcısı başlatılamadı:', schedErr.message);
  }
  httpServer.listen(PORT, () => {
    const adres = httpServer.address();
    console.log(typeof adres === 'string'
      ? `Sunucu ${adres} adresinde aktiftir.`
      : `Sunucu ${adres.port} portunda aktiftir.`);
  });
}

baslat().catch(err => {
  console.error('❌ Başlatılamadı:', err.message);
  process.exit(1);
});
