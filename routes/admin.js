const express = require('express');
const { ObjectId } = require('mongodb');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const { adminRoleOf, yetkiKontrolEt } = require('../lib/admin-rbac');
const { validateImage } = require('../lib/resim-dogrula');
const { PLANS } = require('../lib/subscription-plans');
const { normalizeFaqQuestion } = require('../lib/faq-service');
const { sanitizeFaqHtml } = require('../lib/rich-content');
const SiteMediaTargets = require('../assets/site-media-targets');

const PAGE_SIZE = 25;
const MAX_ANIMATION_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Map([
  ['.json', new Set(['application/json', 'text/json'])],
  ['.png', new Set(['image/png'])],
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.webp', new Set(['image/webp'])]
]);
const VISITOR_SETTING_FIELDS = new Set([
  'questionLimit',
  'topicLimit',
  'trialDurationDays',
  'summaryEnabled',
  'practiceEnabled',
  'assistantEnabled',
  'fullTestEnabled',
  'subscriptionRequired'
]);
const VISITOR_SETTING_RANGES = {
  questionLimit: [0, 500],
  topicLimit: [0, 100],
  trialDurationDays: [1, 3650]
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateAnimation(buffer) {
  let animation;
  try {
    animation = JSON.parse(buffer.toString('utf8'));
  } catch {
    return 'Animasyon dosyası geçerli bir JSON değil.';
  }
  if (!animation || typeof animation !== 'object' || Array.isArray(animation) ||
      typeof animation.v !== 'string' ||
      !Number.isFinite(animation.fr) || animation.fr <= 0 || animation.fr > 120 ||
      !Number.isFinite(animation.ip) || !Number.isFinite(animation.op) ||
      animation.op <= animation.ip || (animation.op - animation.ip) / animation.fr > 600 ||
      !Number.isInteger(animation.w) || animation.w < 1 || animation.w > 4096 ||
      !Number.isInteger(animation.h) || animation.h < 1 || animation.h > 4096 ||
      !Array.isArray(animation.layers) || animation.layers.length < 1 || animation.layers.length > 300) {
    return 'JSON dosyası geçerli ve sınırlar içindeki bir Lottie animasyonu değil.';
  }

  let nodeCount = 0;
  const inspect = (value, depth = 0) => {
    if (!value || typeof value !== 'object') return null;
    if (depth > 40 || ++nodeCount > 100000) return 'Animasyon JSON yapısı çok karmaşık.';
    for (const [key, child] of Object.entries(value)) {
      if (key === 'x' && typeof child === 'string' && child.trim()) {
        return 'Lottie ifadeleri içeren animasyonlara izin verilmiyor.';
      }
      if ((key === 'p' || key === 'u') && typeof child === 'string' && child.trim()) {
        return 'Harici görsel kullanan animasyonlara izin verilmiyor.';
      }
      if (key === 'ty' && child === 2) {
        return 'Görsel katmanı içeren Lottie dosyaları desteklenmiyor.';
      }
      const error = inspect(child, depth + 1);
      if (error) return error;
    }
    return null;
  };
  return inspect(animation);
}

function createAdminRouter({
  User, Payment, SystemConfig, AdminLog,
  uploadDir = path.join(__dirname, '..', 'uploads', 'homepage'),
  siteMediaUploadDir = path.join(__dirname, '..', 'uploads', 'site-media'),
  getAnnouncementCollection, getFaqModel, invalidateFaqCache,
  getQuizCollection, getLessonCollection, getSupportTicketCollection
}) {
  const router = express.Router();
  const mediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 3, fieldSize: 1024 },
    fileFilter: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const allowedMimes = ALLOWED_MEDIA_TYPES.get(extension);
      if (!allowedMimes || !allowedMimes.has(file.mimetype)) {
        return callback(new Error('Yalnızca .json, .png, .jpg ve .webp dosyaları yüklenebilir.'));
      }
      callback(null, true);
    }
  });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const allow = (...roles) => yetkiKontrolEt(roles, User);
  const audit = (req, action, entityType, entityId, details = {}) => AdminLog.create({
    actorId: req.adminUser._id.toString(),
    actorName: req.adminUser.name,
    action,
    entityType,
    entityId,
    details
  });

  router.get('/homepage-assets', allow('superadmin'), async (req, res) => {
    try {
      res.json({ homepageAssets: await SystemConfig.getHomepageAssets() });
    } catch (error) {
      console.error('Ana sayfa medya ayarları alınamadı:', error);
      res.status(500).json({ mesaj: 'Ana sayfa medya ayarları alınamadı.' });
    }
  });

  router.post('/homepage-assets/upload', allow('superadmin'), (req, res, next) => {
    mediaUpload.single('file')(req, res, error => {
      if (!error) return next();
      const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({
        mesaj: status === 413 ? 'Dosya boyutu izin verilen sınırı aşıyor.' : error.message
      });
    });
  }, async (req, res) => {
    if (!req.file) return res.status(400).json({ mesaj: 'Yüklenecek dosyayı seçin.' });
    const extension = path.extname(req.file.originalname).toLowerCase();
    const isAnimation = extension === '.json';
    const slot = req.body?.slot;
    if ((isAnimation && (req.body?.assetType !== 'animation' || slot !== 'animation')) ||
        (!isAnimation && (req.body?.assetType !== 'image' || !['heroImage', 'featureImage'].includes(slot)))) {
      return res.status(400).json({ mesaj: 'Dosya türü ve ana sayfa alanı eşleşmiyor.' });
    }
    if (req.file.size > (isAnimation ? MAX_ANIMATION_BYTES : MAX_IMAGE_BYTES)) {
      return res.status(413).json({ mesaj: 'Dosya boyutu izin verilen sınırı aşıyor.' });
    }
    if (isAnimation) {
      const errorMessage = validateAnimation(req.file.buffer);
      if (errorMessage) return res.status(400).json({ mesaj: errorMessage });
    } else if (!validateImage(req.file.buffer, extension)) {
      return res.status(400).json({ mesaj: 'Dosyanın içeriği seçilen görsel türüyle eşleşmiyor.' });
    }

    const filename = `${randomUUID()}${extension}`;
    const destination = path.join(uploadDir, filename);
    const publicPath = `/uploads/homepage/${filename}`;
    let saved = false;
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(destination, req.file.buffer, { flag: 'wx' });
      const homepageAssets = await SystemConfig.saveHomepageAsset(slot, publicPath);
      saved = true;
      await audit(req, 'homepage_asset.updated', 'homepage_asset', slot, {
        assetType: isAnimation ? 'animation' : 'image',
        filename
      });
      res.json({ mesaj: 'Ana sayfa medyası güncellendi.', homepageAssets });
    } catch (error) {
      if (!saved) await fs.unlink(destination).catch(unlinkError => {
        if (unlinkError.code !== 'ENOENT') console.error('Yüklenen dosya temizlenemedi:', unlinkError);
      });
      console.error('Ana sayfa medyası kaydedilemedi:', error);
      res.status(500).json({ mesaj: 'Ana sayfa medyası kaydedilemedi.' });
    }
  });

  router.get('/site-media', allow('superadmin'), async (req, res) => {
    try {
      res.json({placements: await SystemConfig.getSiteMediaPlacements()});
    } catch (error) {
      console.error('Sayfa medya yerleşimleri alınamadı:', error);
      res.status(500).json({mesaj: 'Sayfa medya yerleşimleri alınamadı.'});
    }
  });

  router.post('/site-media/upload', allow('superadmin'), (req, res, next) => {
    mediaUpload.single('file')(req, res, error => {
      if (!error) return next();
      const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({
        mesaj: status === 413 ? 'Dosya boyutu izin verilen sınırı aşıyor.' : error.message
      });
    });
  }, async (req, res) => {
    if (!req.file) return res.status(400).json({mesaj: 'Yüklenecek dosyayı seçin.'});
    const pagePath = SiteMediaTargets.normalizePagePath(req.body?.pagePath);
    const targetKey = req.body?.targetKey;
    const assetType = req.body?.assetType;
    const extension = path.extname(req.file.originalname).toLowerCase();
    const isAnimation = assetType === 'animation';
    if (!pagePath || !SiteMediaTargets.validTargetKey(targetKey) ||
        !['image', 'animation'].includes(assetType) ||
        (isAnimation && extension !== '.json') ||
        (!isAnimation && !['.png', '.jpg', '.jpeg', '.webp'].includes(extension))) {
      return res.status(400).json({mesaj: 'Sayfa, hedef ve medya türü eşleşmiyor.'});
    }
    if (req.file.size > (isAnimation ? MAX_ANIMATION_BYTES : MAX_IMAGE_BYTES)) {
      return res.status(413).json({mesaj: 'Dosya boyutu izin verilen sınırı aşıyor.'});
    }
    if (isAnimation) {
      const errorMessage = validateAnimation(req.file.buffer);
      if (errorMessage) return res.status(400).json({mesaj: errorMessage});
    } else if (!validateImage(req.file.buffer, extension)) {
      return res.status(400).json({mesaj: 'Dosyanın içeriği seçilen görsel türüyle eşleşmiyor.'});
    }

    const filename = `${randomUUID()}${extension}`;
    const destination = path.join(siteMediaUploadDir, filename);
    const publicPath = `/uploads/site-media/${filename}`;
    let saved = false;
    try {
      await fs.mkdir(siteMediaUploadDir, {recursive: true});
      await fs.writeFile(destination, req.file.buffer, {flag: 'wx'});
      const placement = await SystemConfig.saveSiteMediaPlacement({
        pagePath, targetKey, assetType, url: publicPath
      });
      saved = true;
      await audit(req, 'site_media.updated', 'site_media', placement._id, {
        pagePath, targetKey, assetType, filename
      });
      res.status(201).json({mesaj: 'Medya seçilen sayfa ve hedefe yerleştirildi.', placement});
    } catch (error) {
      if (!saved) await fs.unlink(destination).catch(unlinkError => {
        if (unlinkError.code !== 'ENOENT') console.error('Yüklenen medya temizlenemedi:', unlinkError);
      });
      console.error('Sayfa medyası kaydedilemedi:', error);
      res.status(500).json({mesaj: 'Sayfa medyası kaydedilemedi.'});
    }
  });

  router.get('/me', allow('superadmin', 'editor', 'support'), (req, res) => {
    res.json({
      user: {
        id: req.adminUser._id.toString(),
        name: req.adminUser.name,
        email: req.adminUser.email,
        role: req.adminUser.role,
        adminRole: req.adminRole
      }
    });
  });

  router.get('/overview', allow('superadmin', 'support'), async (req, res) => {
    try {
      const [students, teachers, admins, announcements] = await Promise.all([
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'teacher' }),
        User.countDocuments({ role: 'admin' }),
        getAnnouncementCollection().countDocuments({})
      ]);
      const overview = { students, teachers, admins, announcements };
      if (req.adminRole === 'superadmin') {
        const [activeSubs, paidPayments, pendingPayments] = await Promise.all([
          User.countDocuments({ subscriptionStatus: 'active' }),
          Payment.countDocuments({ status: 'paid' }),
          Payment.countDocuments({ status: 'pending' })
        ]);
        Object.assign(overview, { activeSubs, paidPayments, pendingPayments });
      }
      res.json(overview);
    } catch (error) {
      console.error('Yönetici özeti alınamadı:', error);
      res.status(500).json({ mesaj: 'Özet verileri alınamadı.' });
    }
  });

  router.get('/settings', allow('superadmin'), async (req, res) => {
    try {
      res.json({ ziyaretciHaklari: await SystemConfig.getVisitorSettings() });
    } catch (error) {
      console.error('Ziyaretçi hakları alınamadı:', error);
      res.status(500).json({ mesaj: 'Ziyaretçi ayarları alınamadı.' });
    }
  });

  router.post('/settings', allow('superadmin'), async (req, res) => {
    const body = req.body?.ziyaretciHaklari;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ mesaj: 'Ziyaretçi ayarları geçerli biçimde gönderilmelidir.' });
    }
    const fields = Object.keys(body);
    if (!fields.length || fields.some(field => !VISITOR_SETTING_FIELDS.has(field))) {
      return res.status(400).json({ mesaj: 'Bilinmeyen veya boş ziyaretçi ayarı.' });
    }
    for (const [field, value] of Object.entries(body)) {
      if (Object.hasOwn(VISITOR_SETTING_RANGES, field)) {
        const [min, max] = VISITOR_SETTING_RANGES[field];
        if (!Number.isInteger(value) || value < min || value > max) {
          return res.status(400).json({ mesaj: `${field} ${min} ile ${max} arasında tam sayı olmalıdır.` });
        }
      } else if (typeof value !== 'boolean') {
        return res.status(400).json({ mesaj: `${field} true veya false olmalıdır.` });
      }
    }
    try {
      const ziyaretciHaklari = await SystemConfig.saveVisitorSettings(body);
      await audit(req, 'visitor_settings.updated', 'system_config', 'visitor-access', {
        changedFields: fields
      });
      res.json({ mesaj: 'Ziyaretçi ayarları kaydedildi.', ziyaretciHaklari });
    } catch (error) {
      console.error('Ziyaretçi ayarları kaydedilemedi:', error);
      res.status(500).json({ mesaj: 'Ziyaretçi ayarları kaydedilemedi.' });
    }
  });

  router.get('/users', allow('superadmin', 'support'), async (req, res) => {
    try {
      const filter = {};
      if (['student', 'teacher', 'admin'].includes(req.query.role)) filter.role = req.query.role;
      const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
      if (search) {
        const pattern = new RegExp(escapeRegExp(search), 'i');
        filter.$or = [{ name: pattern }, { email: pattern }];
      }
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const [users, total] = await Promise.all([
        User.find(filter)
          .select('name email role adminRole restricted restrictionReason subscriptionStatus subscriptionType subscriptionPlan expiresAt createdAt')
          .sort({ createdAt: -1 })
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .lean(),
        User.countDocuments(filter)
      ]);
      res.json({
        page,
        pageSize: PAGE_SIZE,
        total,
        users: users.map(user => ({
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          adminRole: adminRoleOf(user),
          restricted: Boolean(user.restricted),
          restrictionReason: user.restrictionReason || null,
          ...(req.adminRole === 'superadmin' && {
            subscriptionStatus: user.subscriptionStatus,
            subscriptionType: user.subscriptionType,
            subscriptionPlan: user.subscriptionPlan || null,
            expiresAt: user.expiresAt
          }),
          createdAt: user.createdAt
        }))
      });
    } catch (error) {
      console.error('Kullanıcılar alınamadı:', error);
      res.status(500).json({ mesaj: 'Kullanıcılar alınamadı.' });
    }
  });

  router.put('/users/:id/restriction', allow('superadmin', 'support'), async (req, res) => {
    const restricted = req.body?.restricted;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!ObjectId.isValid(req.params.id) || typeof restricted !== 'boolean') {
      return res.status(400).json({ mesaj: 'Geçerli kullanıcı ve kısıtlama durumu gönderin.' });
    }
    if (restricted && (!reason || reason.length > 300)) {
      return res.status(400).json({ mesaj: 'Kısıtlama nedeni 1–300 karakter olmalıdır.' });
    }
    try {
      const target = await User.findById(req.params.id).select('role adminRole name');
      if (!target || !['student', 'teacher'].includes(target.role) || adminRoleOf(target)) {
        return res.status(404).json({ mesaj: 'Yalnızca öğrenci veya öğretmen hesapları kısıtlanabilir.' });
      }
      target.restricted = restricted;
      target.restrictedAt = restricted ? new Date() : null;
      target.restrictionReason = restricted ? reason : null;
      await target.save();
      await audit(req, restricted ? 'user.restricted' : 'user.restriction.removed', 'user', target._id.toString(),
        restricted ? { reason } : {});
      res.json({
        mesaj: restricted ? 'Kullanıcı kısıtlandı.' : 'Kullanıcı kısıtlaması kaldırıldı.',
        restricted
      });
    } catch (error) {
      console.error('Kullanıcı kısıtlaması güncellenemedi:', error);
      res.status(500).json({ mesaj: 'Kullanıcı kısıtlaması güncellenemedi.' });
    }
  });

  router.put('/users/:id/subscription', allow('superadmin'), async (req, res) => {
    const plan = req.body?.plan;
    const days = req.body?.days;
    const revoke = plan === null;
    if (!ObjectId.isValid(req.params.id) || (!revoke && !Object.hasOwn(PLANS, plan)) ||
        (!revoke && (!Number.isInteger(days) || days < 1 || days > 3650))) {
      return res.status(400).json({ mesaj: 'Geçerli paket ve 1–3650 arası gün sayısı gönderin.' });
    }
    try {
      const target = await User.findById(req.params.id).select('role name');
      if (!target || target.role !== 'student') {
        return res.status(404).json({ mesaj: 'Yalnızca öğrenci hesaplarına paket tanımlanabilir.' });
      }
      if (revoke) {
        target.subscriptionStatus = 'free';
        target.subscriptionPlan = null;
        target.subscriptionType = null;
        target.expiresAt = null;
      } else {
        target.subscriptionStatus = 'active';
        target.subscriptionPlan = plan;
        target.subscriptionType = 'monthly';
        target.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
      await target.save();
      await audit(req, revoke ? 'user.subscription.revoked' : 'user.subscription.granted', 'user',
        target._id.toString(), revoke ? {} : { plan, days });
      res.json({ mesaj: revoke ? 'Abonelik kaldırıldı.' : 'Paket tanımlandı.' });
    } catch (error) {
      console.error('Kullanıcı aboneliği güncellenemedi:', error);
      res.status(500).json({ mesaj: 'Kullanıcı aboneliği güncellenemedi.' });
    }
  });

  router.put('/users/:id/admin-role', allow('superadmin'), async (req, res) => {
    const adminRole = req.body?.adminRole;
    if (!ObjectId.isValid(req.params.id) ||
        !['superadmin', 'editor', 'support'].includes(adminRole)) {
      return res.status(400).json({ mesaj: 'Geçerli kullanıcı ve yönetim rolü seçin.' });
    }
    if (req.params.id === req.adminUser._id.toString()) {
      return res.status(400).json({ mesaj: 'Kendi yönetim rolünüzü değiştiremezsiniz.' });
    }
    try {
      const target = await User.findById(req.params.id).select('role adminRole name');
      if (!target || !['admin', 'teacher'].includes(target.role)) {
        return res.status(404).json({ mesaj: 'Yalnızca yönetici veya öğretmen hesabına yönetim rolü atanabilir.' });
      }
      if (adminRoleOf(target) === 'superadmin' && adminRole !== 'superadmin') {
        const superAdminCount = await User.countDocuments({
          $or: [{ adminRole: 'superadmin' }, { role: 'admin', adminRole: null }]
        });
        if (superAdminCount <= 1) {
          return res.status(409).json({ mesaj: 'Sistemde en az bir Süper Admin bulunmalıdır.' });
        }
      }
      target.adminRole = adminRole;
      await target.save();
      await audit(req, 'user.admin_role.updated', 'user', target._id.toString(), { adminRole });
      res.json({ mesaj: 'Yönetim rolü güncellendi.', adminRole });
    } catch (error) {
      console.error('Yönetim rolü güncellenemedi:', error);
      res.status(500).json({ mesaj: 'Yönetim rolü güncellenemedi.' });
    }
  });

  router.get('/payments', allow('superadmin'), async (req, res) => {
    try {
      const filter = {};
      if (['pending', 'paid', 'failed'].includes(req.query.status)) filter.status = req.query.status;
      const payments = await Payment.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('userId', 'name email')
        .lean();
      res.json({
        payments: payments.map(payment => ({
          id: payment._id.toString(),
          gateway: payment.gateway,
          orderReference: payment.orderReference,
          userName: payment.userId?.name || '—',
          userEmail: payment.userId?.email || '—',
          amount: payment.expectedAmountMinor / 100,
          currency: payment.currency,
          subscriptionType: payment.subscriptionType,
          plan: payment.plan || null,
          status: payment.status,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt
        }))
      });
    } catch (error) {
      console.error('Ödemeler alınamadı:', error);
      res.status(500).json({ mesaj: 'Ödemeler alınamadı.' });
    }
  });

  router.get('/announcements', allow('superadmin'), async (req, res) => {
    try {
      const items = await getAnnouncementCollection().find({}).sort({ createdAt: -1 }).limit(100).toArray();
      res.json({
        duyurular: items.map(({ _id, message, createdAt }) => ({
          id: _id.toString(), message, createdAt
        }))
      });
    } catch (error) {
      console.error('Duyurular alınamadı:', error);
      res.status(500).json({ mesaj: 'Duyurular alınamadı.' });
    }
  });

  router.post('/announcements', allow('superadmin'), async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 1000) {
      return res.status(400).json({ mesaj: 'Duyuru 1–1000 karakter arasında olmalıdır.' });
    }
    try {
      const announcement = { message, createdBy: req.session.user.id, createdAt: new Date() };
      const result = await getAnnouncementCollection().insertOne(announcement);
      res.status(201).json({
        mesaj: 'Duyuru yayınlandı.',
        duyuru: { id: result.insertedId.toString(), message, createdAt: announcement.createdAt }
      });
    } catch (error) {
      console.error('Duyuru kaydedilemedi:', error);
      res.status(500).json({ mesaj: 'Duyuru yayınlanamadı.' });
    }
  });

  router.delete('/announcements/:id', allow('superadmin'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz duyuru no.' });
    try {
      const result = await getAnnouncementCollection().deleteOne({ _id: new ObjectId(req.params.id) });
      if (!result.deletedCount) return res.status(404).json({ mesaj: 'Duyuru bulunamadı.' });
      res.json({ mesaj: 'Duyuru silindi.' });
    } catch (error) {
      console.error('Duyuru silinemedi:', error);
      res.status(500).json({ mesaj: 'Duyuru silinemedi.' });
    }
  });

  router.get('/faqs', allow('superadmin'), async (req, res) => {
    try {
      const entries = await getFaqModel().find({})
        .select('question answerHtml grade active createdAt updatedAt')
        .sort({ updatedAt: -1, createdAt: -1 }).limit(500).lean();
      res.json({
        faqs: entries.map(({ _id, question, answerHtml, grade, active, createdAt, updatedAt }) => ({
          id: _id.toString(), question, answerHtml, grade: grade ?? null,
          active: active !== false, createdAt, updatedAt
        }))
      });
    } catch (error) {
      console.error('FAQ kayıtları alınamadı:', error);
      res.status(500).json({ mesaj: 'FAQ kayıtları alınamadı.' });
    }
  });

  router.post('/faqs', allow('superadmin'), async (req, res) => {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const rawAnswerHtml = typeof req.body?.answerHtml === 'string' ? req.body.answerHtml : '';
    const grade = req.body?.grade === '' || req.body?.grade == null ? null : Number(req.body.grade);
    const active = req.body?.active !== false;
    const normalizedQuestion = normalizeFaqQuestion(question);
    if (!question || question.length > 300 || !normalizedQuestion ||
        (grade !== null && (!Number.isInteger(grade) || grade < 5 || grade > 12)) ||
        typeof req.body?.active !== 'undefined' && typeof req.body.active !== 'boolean') {
      return res.status(400).json({ mesaj: 'Soru (1–300), yanıt (1–5000), sınıf veya yayın durumu geçersiz.' });
    }
    let answer;
    try {
      answer = sanitizeFaqHtml(rawAnswerHtml);
    } catch (error) {
      return res.status(400).json({ mesaj: error.message });
    }
    try {
      const { html: answerHtml, text: answerText } = answer;
      const scopeKey = grade === null ? 'all' : String(grade);
      const existing = await getFaqModel().findOne({ normalizedQuestion, scopeKey }).select('_id').lean();
      if (existing) return res.status(409).json({ mesaj: 'Bu soru aynı sınıf kapsamıyla zaten kayıtlı.' });
      const now = new Date();
      const faq = {
        question, normalizedQuestion, answerHtml, answerText, grade, scopeKey,
        active, createdBy: req.session.user.id
      };
      const created = await getFaqModel().create(faq);
      await invalidateFaqCache?.();
      await audit(req, 'faq.created', 'faq', created._id.toString(), { grade });
      res.status(201).json({
        mesaj: 'FAQ kaydedildi.',
        faq: {
          id: created._id.toString(), question, answerHtml, grade, active,
          createdAt: created.createdAt, updatedAt: created.updatedAt
        }
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ mesaj: 'Bu soru aynı sınıf kapsamıyla zaten kayıtlı.' });
      console.error('FAQ kaydedilemedi:', error);
      res.status(500).json({ mesaj: 'FAQ kaydedilemedi.' });
    }
  });

  router.put('/faqs/:id', allow('superadmin'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz FAQ no.' });
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const rawAnswerHtml = typeof req.body?.answerHtml === 'string' ? req.body.answerHtml : '';
    const grade = req.body?.grade === '' || req.body?.grade == null ? null : Number(req.body.grade);
    const active = req.body?.active !== false;
    const normalizedQuestion = normalizeFaqQuestion(question);
    if (!question || question.length > 300 || !normalizedQuestion ||
        (grade !== null && (!Number.isInteger(grade) || grade < 5 || grade > 12)) ||
        typeof req.body?.active !== 'undefined' && typeof req.body.active !== 'boolean') {
      return res.status(400).json({ mesaj: 'Soru (1–300), yanıt (1–5000), sınıf veya yayın durumu geçersiz.' });
    }
    let answer;
    try {
      answer = sanitizeFaqHtml(rawAnswerHtml);
    } catch (error) {
      return res.status(400).json({ mesaj: error.message });
    }
    try {
      const { html: answerHtml, text: answerText } = answer;
      const id = new ObjectId(req.params.id);
      const updated = await getFaqModel().findByIdAndUpdate(id, {
        $set: {
          question, normalizedQuestion, answerHtml, answerText, grade,
          scopeKey: grade === null ? 'all' : String(grade),
          active
        }
      }, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ mesaj: 'FAQ bulunamadı.' });
      await invalidateFaqCache?.();
      await audit(req, 'faq.updated', 'faq', req.params.id, { grade, active });
      res.json({ mesaj: 'FAQ güncellendi.' });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ mesaj: 'Bu soru aynı sınıf kapsamıyla zaten kayıtlı.' });
      console.error('FAQ güncellenemedi:', error);
      res.status(500).json({ mesaj: 'FAQ güncellenemedi.' });
    }
  });

  router.delete('/faqs/:id', allow('superadmin'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz FAQ no.' });
    try {
      const result = await getFaqModel().deleteOne({ _id: new ObjectId(req.params.id) });
      if (!result.deletedCount) return res.status(404).json({ mesaj: 'FAQ bulunamadı.' });
      await invalidateFaqCache?.();
      await audit(req, 'faq.deleted', 'faq', req.params.id);
      res.json({ mesaj: 'FAQ silindi.' });
    } catch (error) {
      console.error('FAQ silinemedi:', error);
      res.status(500).json({ mesaj: 'FAQ silinemedi.' });
    }
  });

  router.get('/education/quizzes', allow('superadmin', 'editor'), async (req, res) => {
    try {
      const quizzes = await getQuizCollection().find({})
        .project({ title: 1, description: 1, questions: 1, source: 1, published: 1, createdAt: 1 })
        .sort({ createdAt: -1 }).limit(200).toArray();
      res.json({
        quizzes: quizzes.map(({ _id, title, description, questions, source, published, createdAt }) => ({
          id: _id.toString(),
          title: title || 'Başlıksız test',
          description: description || '',
          questionCount: Array.isArray(questions) ? questions.length : 0,
          source: source || 'manual',
          published: source === 'ai' ? published === true : published !== false,
          createdAt
        }))
      });
    } catch (error) {
      console.error('Yönetim testleri alınamadı:', error);
      res.status(500).json({ mesaj: 'Testler alınamadı.' });
    }
  });

  router.get('/education/lessons', allow('superadmin', 'editor'), async (req, res) => {
    try {
      const lessons = await getLessonCollection().find({ tur: 'konu-slides-v3' })
        .project({ sinif: 1, konu: 1, createdAt: 1 })
        .sort({ createdAt: -1 }).limit(200).toArray();
      res.json({
        lessons: lessons.map(({ _id, sinif, konu, createdAt }) => ({
          id: _id.toString(), sinif, konu, createdAt
        }))
      });
    } catch (error) {
      console.error('Konu anlatımları alınamadı:', error);
      res.status(500).json({ mesaj: 'Konu anlatımları alınamadı.' });
    }
  });

  router.get('/support/tickets', allow('superadmin', 'support'), async (req, res) => {
    try {
      const tickets = await getSupportTicketCollection().find({})
        .project({ subject: 1, name: 1, email: 1, status: 1, createdAt: 1, message: 1 })
        .sort({ createdAt: -1 }).limit(200).toArray();
      res.json({
        tickets: tickets.map(({ _id, subject, name, email, status, createdAt, message }) => ({
          id: _id.toString(),
          subject: subject || 'Destek talebi',
          name: name || '',
          email: email || '',
          status: status || 'open',
          createdAt,
          message: typeof message === 'string' ? message.slice(0, 2000) : ''
        }))
      });
    } catch (error) {
      console.error('Destek talepleri alınamadı:', error);
      res.status(500).json({ mesaj: 'Destek talepleri alınamadı.' });
    }
  });

  router.get('/logs', allow('superadmin'), async (req, res) => {
    try {
      const logs = await AdminLog.find({}).sort({ createdAt: -1 }).limit(200).lean();
      res.json({
        logs: logs.map(({ _id, actorId, actorName, action, entityType, entityId, details, createdAt }) => ({
          id: _id.toString(), actorId, actorName, action, entityType, entityId, details, createdAt
        }))
      });
    } catch (error) {
      console.error('Yönetim kayıtları alınamadı:', error);
      res.status(500).json({ mesaj: 'Yönetim kayıtları alınamadı.' });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
