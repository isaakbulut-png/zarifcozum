const express = require('express');
const { ObjectId } = require('mongodb');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const TeacherPayout = require('../models/TeacherPayout');
const { adminRoleOf, yetkiKontrolEt, PRIMARY_ADMIN_EMAIL } = require('../lib/admin-rbac');
const { validateImage } = require('../lib/resim-dogrula');
const { PLANS } = require('../lib/subscription-plans');
const { normalizeFaqQuestion } = require('../lib/faq-service');
const { sanitizeFaqHtml } = require('../lib/rich-content');
const SiteMediaTargets = require('../assets/site-media-targets');
const {createLocalMediaStorage} = require('../lib/site-media-storage');
const { sendTeacherStatusEmail } = require('../lib/teacher-mail-notifier');

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
  'subscriptionRequired',
  'registrationEnabled'
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
  mediaStorage = createLocalMediaStorage({homepageDir: uploadDir, siteMediaDir: siteMediaUploadDir}),
  getAnnouncementCollection, getFaqModel, invalidateFaqCache,
  getQuizCollection, getLessonCollection, getSupportTicketCollection,
  getHomeworkCollection, getAssignmentCollection, getResultCollection,
  getAttemptCollection, getStudentCollection, getDenemeModel,
  SystemHealthLog = require('../models/SystemHealthLog'),
  healthChecker = require('../lib/system-health-checker')
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

  const { getAiUsageSummary, getAiAuditSummary } = require('../lib/ai-usage-tracker');
  const { PAKET_LIMITLERI, getEffectiveMessageLimit } = require('../middleware/aiQuota');

  router.get('/ai-maliyet-ozeti', allow('superadmin', 'editor', 'support'), async (req, res) => {
    try {
      const summary = await getAiUsageSummary();
      res.json(summary);
    } catch (error) {
      console.error('AI maliyet özeti alınamadı:', error);
      res.status(500).json({ mesaj: 'AI maliyet özeti alınamadı.' });
    }
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
    const key = `homepage/${filename}`;
    const publicPath = `/uploads/homepage/${filename}`;
    let saved = false;
    try {
      await mediaStorage.put(key, req.file.buffer);
      const homepageAssets = await SystemConfig.saveHomepageAsset(slot, publicPath);
      saved = true;
      await audit(req, 'homepage_asset.updated', 'homepage_asset', slot, {
        assetType: isAnimation ? 'animation' : 'image',
        filename
      });
      res.json({ mesaj: 'Ana sayfa medyası güncellendi.', homepageAssets });
    } catch (error) {
      if (!saved) await mediaStorage.remove(key).catch(unlinkError => {
        console.error('Yüklenen dosya temizlenemedi:', unlinkError);
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
    const key = `site-media/${filename}`;
    const publicPath = `/uploads/site-media/${filename}`;
    let saved = false;
    try {
      await mediaStorage.put(key, req.file.buffer);
      const placement = await SystemConfig.saveSiteMediaPlacement({
        pagePath, targetKey, assetType, url: publicPath
      });
      saved = true;
      await audit(req, 'site_media.updated', 'site_media', placement._id, {
        pagePath, targetKey, assetType, filename
      });
      res.status(201).json({mesaj: 'Medya seçilen sayfa ve hedefe yerleştirildi.', placement});
    } catch (error) {
      if (!saved) await mediaStorage.remove(key).catch(unlinkError => {
        console.error('Yüklenen medya temizlenemedi:', unlinkError);
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
          .select('name email role adminRole restricted restrictionReason subscriptionStatus subscriptionType subscriptionPlan paketTipi expiresAt createdAt')
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
        users: users.map(user => {
          const effectivePlan = user.subscriptionPlan || user.paketTipi || null;
          const isPlanActive = Boolean(user.subscriptionStatus === 'active' || (effectivePlan && ['temel', 'standart', 'vip'].includes(effectivePlan)));
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            adminRole: adminRoleOf(user),
            restricted: Boolean(user.restricted),
            restrictionReason: user.restrictionReason || null,
            subscriptionStatus: isPlanActive ? 'active' : (user.subscriptionStatus || 'free'),
            subscriptionType: user.subscriptionType || 'annual',
            subscriptionPlan: effectivePlan,
            paketTipi: user.paketTipi || effectivePlan || 'free',
            expiresAt: user.expiresAt || null,
            createdAt: user.createdAt
          };
        })
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
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz kullanıcı kimliği.' });
    }
    const body = req.body || {};
    const action = body.action;
    const rawPlan = body.plan;
    const revoke = action === 'revoke' || rawPlan === null || rawPlan === 'revoke' || rawPlan === 'free';

    let plan = rawPlan;
    if (revoke) {
      plan = null;
    }

    // Gün hesabı: Gönderilmişse days, yoksa durationMonths * 30, hiçbiri yoksa varsayılan 365 gün (1 yıl)
    let days = body.days;
    if (!days && body.durationMonths) {
      const dm = parseInt(body.durationMonths, 10);
      days = dm >= 12 ? 365 : dm * 30;
    }
    if (!days && !revoke) {
      days = 365;
    }

    if (!revoke && (!plan || !Object.hasOwn(PLANS, plan))) {
      return res.status(400).json({ mesaj: 'Geçerli bir paket seçin (temel, standart, vip).' });
    }
    if (!revoke && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      return res.status(400).json({ mesaj: 'Geçerli 1–3650 arası gün sayısı gönderin.' });
    }

    try {
      const target = await User.findById(req.params.id);
      if (!target || target.role !== 'student') {
        return res.status(404).json({ mesaj: 'Yalnızca öğrenci hesaplarına paket tanımlanabilir.' });
      }
      if (revoke) {
        target.subscriptionStatus = 'free';
        target.subscriptionPlan = null;
        target.subscriptionTier = 'free';
        target.subscriptionType = null;
        target.expiresAt = null;
        target.subscriptionEndDate = null;
        target.paketTipi = 'free';
      } else {
        target.subscriptionStatus = 'active';
        target.subscriptionPlan = plan;
        target.subscriptionTier = plan;
        target.subscriptionType = days >= 360 ? 'annual' : 'monthly';
        target.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        target.subscriptionEndDate = target.expiresAt;
        target.paketTipi = plan;
      }
      await target.save();
      await audit(req, revoke ? 'user.subscription.revoked' : 'user.subscription.granted', 'user',
        target._id.toString(), revoke ? {} : { plan, days });

      const planTitle = plan === 'vip' ? 'VIP' : plan === 'standart' ? 'Standart' : plan === 'temel' ? 'Temel' : '';
      res.json({
        mesaj: revoke ? `${target.name} adlı öğrencinin aboneliği kaldırıldı.` : `${target.name} adlı öğrenciye ${planTitle} Paket (${days} gün) başarıyla tanımlandı.`,
        plan: target.subscriptionPlan,
        paketTipi: target.paketTipi,
        subscriptionStatus: target.subscriptionStatus,
        expiresAt: target.expiresAt
      });
    } catch (error) {
      console.error('Kullanıcı aboneliği güncellenemedi:', error);
      res.status(500).json({ mesaj: 'Kullanıcı aboneliği güncellenemedi.' });
    }
  });

  router.put('/users/:id/role', allow('superadmin'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz kullanıcı kimliği.' });
    }
    const { role, adminRole } = req.body || {};
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ mesaj: 'Geçerli bir hesap rolü seçin (Öğrenci, Öğretmen veya Yönetici).' });
    }
    const cleanAdminRole = (!adminRole || adminRole === 'none') ? null : adminRole;
    if (cleanAdminRole && !['superadmin', 'editor', 'support'].includes(cleanAdminRole)) {
      return res.status(400).json({ mesaj: 'Geçerli bir yönetim rolü seçin.' });
    }
    if (role === 'student' && cleanAdminRole) {
      return res.status(400).json({ mesaj: 'Öğrenci hesaplarına yönetim rolü atanamaz.' });
    }

    try {
      const target = await User.findById(req.params.id).select('role adminRole name email');
      if (!target) {
        return res.status(404).json({ mesaj: 'Kullanıcı bulunamadı.' });
      }

      if (target.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL && (role !== 'admin' || cleanAdminRole !== 'superadmin')) {
        return res.status(403).json({ mesaj: 'Ana yönetici hesabının yetkileri değiştirilemez.' });
      }

      const wasSuperAdmin = adminRoleOf(target) === 'superadmin';
      const willBeSuperAdmin = role === 'admin'
        ? (!cleanAdminRole || cleanAdminRole === 'superadmin')
        : (cleanAdminRole === 'superadmin');

      if (wasSuperAdmin && !willBeSuperAdmin) {
        const superAdminCount = await User.countDocuments({
          $or: [{ adminRole: 'superadmin' }, { role: 'admin', adminRole: null }]
        });
        if (superAdminCount <= 1) {
          return res.status(409).json({ mesaj: 'Sistemde en az bir Süper Admin bulunmalıdır.' });
        }
      }

      target.role = role;
      target.adminRole = role === 'student' ? null : cleanAdminRole;
      await target.save();

      await audit(req, 'user.role.updated', 'user', target._id.toString(), {
        role: target.role,
        adminRole: target.adminRole
      });

      res.json({
        mesaj: 'Kullanıcı rolü başarıyla güncellendi.',
        role: target.role,
        adminRole: target.adminRole
      });
    } catch (error) {
      console.error('Kullanıcı rolü güncellenemedi:', error);
      res.status(500).json({ mesaj: 'Kullanıcı rolü güncellenemedi.' });
    }
  });

  router.put('/users/:id/admin-role', allow('superadmin'), async (req, res) => {
    const rawRole = req.body?.adminRole;
    const adminRole = (!rawRole || rawRole === 'none') ? null : rawRole;
    if (!ObjectId.isValid(req.params.id) ||
        (adminRole && !['superadmin', 'editor', 'support'].includes(adminRole))) {
      return res.status(400).json({ mesaj: 'Geçerli kullanıcı ve yönetim rolü seçin.' });
    }
    if (req.params.id === req.adminUser._id.toString() && !adminRole) {
      return res.status(400).json({ mesaj: 'Kendi yönetim rolünüzü değiştiremezsiniz.' });
    }
    try {
      const target = await User.findById(req.params.id).select('role adminRole name email');
      if (!target || !['admin', 'teacher'].includes(target.role)) {
        return res.status(404).json({ mesaj: 'Yalnızca yönetici veya öğretmen hesabına yönetim rolü atanabilir.' });
      }
      if (target.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL && adminRole !== 'superadmin') {
        return res.status(403).json({ mesaj: 'Ana yönetici hesabının yetkileri değiştirilemez.' });
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

  router.delete('/users/:id', allow('superadmin'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz kullanıcı kimliği.' });
    }
    if (req.params.id === req.adminUser._id.toString()) {
      return res.status(400).json({ mesaj: 'Kendi hesabınızı silemezsiniz.' });
    }
    try {
      const target = typeof User.findById(req.params.id)?.select === 'function'
        ? await User.findById(req.params.id).select('name email role adminRole')
        : await User.findById(req.params.id);
      if (!target) {
        return res.status(404).json({ mesaj: 'Kullanıcı bulunamadı.' });
      }

      if (adminRoleOf(target) === 'superadmin') {
        const superAdminCount = await User.countDocuments({
          $or: [{ adminRole: 'superadmin' }, { role: 'admin', adminRole: null }]
        });
        if (superAdminCount <= 1) {
          return res.status(409).json({ mesaj: 'Sistemdeki tek Süper Admin silinemez.' });
        }
      }

      const targetIdStr = target._id.toString();

      if (typeof User.findByIdAndDelete === 'function') {
        await User.findByIdAndDelete(req.params.id);
      } else if (typeof User.deleteOne === 'function') {
        await User.deleteOne({ _id: target._id });
      }

      // İlişkili test/öğrenci verilerini temizle
      if (typeof getAssignmentCollection === 'function') {
        await getAssignmentCollection()?.deleteMany({
          $or: [{ studentUserId: targetIdStr }, { teacherId: targetIdStr }]
        }).catch(() => {});
      }
      if (typeof getHomeworkCollection === 'function') {
        await getHomeworkCollection()?.deleteMany({ teacherId: targetIdStr }).catch(() => {});
      }
      if (typeof getResultCollection === 'function') {
        await getResultCollection()?.deleteMany({ studentId: targetIdStr }).catch(() => {});
      }
      if (typeof getAttemptCollection === 'function') {
        await getAttemptCollection()?.deleteMany({ studentId: targetIdStr }).catch(() => {});
      }
      if (typeof getStudentCollection === 'function') {
        await getStudentCollection()?.deleteMany({
          $or: [{ linkedUserId: targetIdStr }, { teacherId: targetIdStr }]
        }).catch(() => {});
      }

      await audit(req, 'user.deleted', 'user', targetIdStr, {
        name: target.name,
        email: target.email,
        role: target.role
      });

      res.json({ mesaj: 'Kullanıcı ve ilişkili verileri başarıyla silindi.', id: targetIdStr });
    } catch (error) {
      console.error('Kullanıcı silinemedi:', error);
      res.status(500).json({ mesaj: 'Kullanıcı silinemedi.' });
    }
  });

  router.post('/users/:id/clear-test-data', allow('superadmin'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz kullanıcı kimliği.' });
    }
    try {
      const target = typeof User.findById(req.params.id)?.select === 'function'
        ? await User.findById(req.params.id).select('name email role')
        : await User.findById(req.params.id);
      if (!target) {
        return res.status(404).json({ mesaj: 'Kullanıcı bulunamadı.' });
      }

      const targetIdStr = target._id.toString();
      let clearedAssignments = 0;
      let clearedResults = 0;

      if (typeof getAssignmentCollection === 'function') {
        const r1 = await getAssignmentCollection()?.deleteMany({ studentUserId: targetIdStr }).catch(() => ({ deletedCount: 0 }));
        clearedAssignments = r1?.deletedCount || 0;
      }
      if (typeof getResultCollection === 'function') {
        const r2 = await getResultCollection()?.deleteMany({ studentId: targetIdStr }).catch(() => ({ deletedCount: 0 }));
        clearedResults = r2?.deletedCount || 0;
      }
      if (typeof getAttemptCollection === 'function') {
        await getAttemptCollection()?.deleteMany({ studentId: targetIdStr }).catch(() => {});
      }

      await audit(req, 'user.test_data.cleared', 'user', targetIdStr, {
        clearedAssignments,
        clearedResults
      });

      res.json({
        mesaj: `Öğrencinin test içerikleri temizlendi (${clearedAssignments} ödev, ${clearedResults} test sonucu silindi).`,
        clearedAssignments,
        clearedResults
      });
    } catch (error) {
      console.error('Test verileri temizlenemedi:', error);
      res.status(500).json({ mesaj: 'Test verileri temizlenemedi.' });
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

  router.get('/announcement-banner', allow('superadmin', 'editor', 'support'), async (req, res) => {
    try {
      const banner = typeof SystemConfig.getAnnouncementBanner === 'function'
        ? await SystemConfig.getAnnouncementBanner()
        : { active: false, title: 'Önemli Bilgilendirme', message: '', type: 'warning' };
      res.json({ banner });
    } catch (error) {
      console.error('Pano ayarları alınamadı:', error);
      res.status(500).json({ mesaj: 'Pano ayarları alınamadı.' });
    }
  });

  router.post('/announcement-banner', allow('superadmin'), async (req, res) => {
    try {
      const { active, title, message, type } = req.body || {};
      const saved = typeof SystemConfig.saveAnnouncementBanner === 'function'
        ? await SystemConfig.saveAnnouncementBanner({ active, title, message, type })
        : { active: Boolean(active), title, message, type };

      await audit(req, 'announcement_banner.updated', 'system_config', 'visitor-access', {
        active: saved.active,
        title: saved.title
      });

      res.json({
        mesaj: saved.active ? 'Bilgilendirme panosu başarıyla yayınlandı.' : 'Bilgilendirme panosu yayından kaldırıldı.',
        banner: saved
      });
    } catch (error) {
      console.error('Pano kaydedilemedi:', error);
      res.status(500).json({ mesaj: 'Pano kaydedilemedi.' });
    }
  });

  router.get('/system-health/latest', allow('superadmin'), async (req, res) => {
    try {
      const latest = typeof SystemHealthLog.getLatest === 'function'
        ? await SystemHealthLog.getLatest()
        : null;
      res.json({ scan: latest });
    } catch (error) {
      console.error('Son sistem sağlığı taraması alınamadı:', error);
      res.status(500).json({ mesaj: 'Son sistem sağlığı taraması alınamadı.' });
    }
  });

  router.get('/system-health/alert', allow('superadmin', 'editor', 'support'), async (req, res) => {
    try {
      const alert = typeof SystemConfig.getSystemHealthAlert === 'function'
        ? await SystemConfig.getSystemHealthAlert()
        : { active: false, score: 100, status: 'healthy', errors: [], warnings: [] };
      res.json({ alert });
    } catch (error) {
      console.error('Sistem sağlığı uyarısı alınamadı:', error);
      res.status(500).json({ mesaj: 'Sistem sağlığı uyarısı alınamadı.' });
    }
  });

  router.get('/system-health/kvkk', allow('superadmin', 'editor', 'support'), async (req, res) => {
    try {
      const checkerFn = typeof healthChecker.checkKvkkAndCookieCompliance === 'function'
        ? healthChecker.checkKvkkAndCookieCompliance
        : require('../lib/kvkk-compliance-checker').checkKvkkAndCookieCompliance;
      const report = await checkerFn();
      res.json({ report });
    } catch (error) {
      console.error('KVKK ve çerez uyumluluk kontrolü başarısız:', error);
      res.status(500).json({ mesaj: 'KVKK ve çerez uyumluluk kontrolü başarısız: ' + error.message });
    }
  });

  router.post('/system-health/kvkk/scan', allow('superadmin'), async (req, res) => {
    try {
      const checkerFn = typeof healthChecker.checkKvkkAndCookieCompliance === 'function'
        ? healthChecker.checkKvkkAndCookieCompliance
        : require('../lib/kvkk-compliance-checker').checkKvkkAndCookieCompliance;
      const report = await checkerFn();
      await audit(req, 'system_health.kvkk_scan_performed', 'system_health', 'kvkk', {
        score: report.score,
        status: report.status
      });
      res.json({ mesaj: 'KVKK ve çerez uyumluluk taraması tamamlandı.', report });
    } catch (error) {
      console.error('KVKK taraması yürütülemedi:', error);
      res.status(500).json({ mesaj: 'KVKK taraması yürütülemedi: ' + error.message });
    }
  });

  router.get('/system-health/legal-audit', allow('superadmin', 'editor', 'support'), async (req, res) => {
    try {
      const auditorFn = typeof healthChecker.runLegalDocumentsAudit === 'function'
        ? healthChecker.runLegalDocumentsAudit
        : require('../lib/legal-documents-auditor').runLegalDocumentsAudit;
      const auditReport = await auditorFn();
      res.json({ auditReport });
    } catch (error) {
      console.error('Yasal metinler denetimi başarısız:', error);
      res.status(500).json({ mesaj: 'Yasal metinler denetimi başarısız: ' + error.message });
    }
  });

  router.post('/system-health/legal-audit/scan', allow('superadmin'), async (req, res) => {
    try {
      const auditorFn = typeof healthChecker.runLegalDocumentsAudit === 'function'
        ? healthChecker.runLegalDocumentsAudit
        : require('../lib/legal-documents-auditor').runLegalDocumentsAudit;
      const auditReport = await auditorFn();
      await audit(req, 'system_health.legal_audit_performed', 'system_health', 'legal_docs', {
        score: auditReport.score,
        status: auditReport.status
      });
      res.json({ mesaj: 'Yasal metinler denetimi başarıyla tamamlandı.', auditReport });
    } catch (error) {
      console.error('Yasal metinler denetimi yürütülemedi:', error);
      res.status(500).json({ mesaj: 'Yasal metinler denetimi yürütülemedi: ' + error.message });
    }
  });

  router.post('/system-health/alert/dismiss', allow('superadmin'), async (req, res) => {
    try {
      if (typeof SystemConfig.dismissSystemHealthAlert === 'function') {
        await SystemConfig.dismissSystemHealthAlert();
      }
      await audit(req, 'system_health.alert_dismissed', 'system_health', 'alert', {});
      res.json({ mesaj: 'Sistem sağlığı uyarısı kapatıldı.' });
    } catch (error) {
      console.error('Sistem sağlığı uyarısı kapatılamadı:', error);
      res.status(500).json({ mesaj: 'Sistem sağlığı uyarısı kapatılamadı.' });
    }
  });

  router.get('/system-health/logs', allow('superadmin'), async (req, res) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
      const logs = typeof SystemHealthLog.getLastLogs === 'function'
        ? await SystemHealthLog.getLastLogs(limit)
        : [];
      res.json({ logs });
    } catch (error) {
      console.error('Sistem sağlığı kayıtları alınamadı:', error);
      res.status(500).json({ mesaj: 'Sistem sağlığı kayıtları alınamadı.' });
    }
  });

  router.post('/system-health/scan', allow('superadmin'), async (req, res) => {
    try {
      const scannedBy = req.session?.user?.email || req.session?.user?.name || 'Süper Admin';
      const scanData = typeof healthChecker.runSystemHealthScan === 'function'
        ? await healthChecker.runSystemHealthScan(scannedBy)
        : { score: 100, status: 'healthy', summary: 'Simüle tarama tamamlandı.', checks: {}, warnings: [], errors: [], scannedBy };

      let savedLog = null;
      try {
        if (typeof SystemHealthLog.saveScan === 'function') {
          savedLog = await SystemHealthLog.saveScan(scanData);
        }
      } catch (dbErr) {
        console.warn('Sistem sağlığı logu veritabanına yazılamadı:', dbErr.message);
      }

      const hasErrors = scanData.status === 'error' || (Array.isArray(scanData.errors) && scanData.errors.length > 0);

      if (hasErrors) {
        try {
          if (typeof SystemConfig.saveSystemHealthAlert === 'function') {
            await SystemConfig.saveSystemHealthAlert({
              active: true,
              score: scanData.score,
              status: scanData.status,
              errors: scanData.errors,
              warnings: scanData.warnings
            });
          }
        } catch (confErr) {
          console.warn('Sistem sağlığı uyarısı kaydedilemedi:', confErr.message);
        }

        await audit(req, 'system_health.failure_detected', 'system_health', 'scan', {
          score: scanData.score,
          status: scanData.status,
          errors: scanData.errors
        });
      } else {
        try {
          if (typeof SystemConfig.dismissSystemHealthAlert === 'function') {
            await SystemConfig.dismissSystemHealthAlert();
          }
        } catch (_) {}
      }

      await audit(req, 'system_health.scan_performed', 'system_health', 'scan', {
        score: scanData.score,
        status: scanData.status
      });

      res.json({
        mesaj: 'Sistem taraması başarıyla tamamlandı.',
        scan: savedLog && typeof savedLog.toObject === 'function' ? savedLog.toObject() : scanData
      });
    } catch (error) {
      console.error('Sistem sağlığı taraması gerçekleştirilemedi:', error);
      res.status(500).json({ mesaj: 'Sistem sağlığı taraması gerçekleştirilemedi: ' + error.message });
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

  router.delete('/education/quizzes/:id', allow('superadmin', 'editor'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz test kimliği.' });
    }
    try {
      const quizIdObj = new ObjectId(req.params.id);
      const quizColl = typeof getQuizCollection === 'function' ? getQuizCollection() : null;
      if (!quizColl) return res.status(500).json({ mesaj: 'Test veritabanı bulunamadı.' });

      const quiz = await quizColl.findOne({ _id: quizIdObj });
      if (!quiz) return res.status(404).json({ mesaj: 'Test bulunamadı.' });

      await quizColl.deleteOne({ _id: quizIdObj });

      if (typeof getResultCollection === 'function') {
        await getResultCollection()?.deleteMany({ quizId: quizIdObj }).catch(() => {});
      }
      if (typeof getAttemptCollection === 'function') {
        await getAttemptCollection()?.deleteMany({ quizId: quizIdObj }).catch(() => {});
      }
      if (typeof getAssignmentCollection === 'function') {
        await getAssignmentCollection()?.deleteMany({ quizId: req.params.id }).catch(() => {});
      }

      await audit(req, 'quiz.deleted', 'quiz', req.params.id, { title: quiz.title });
      res.json({ mesaj: `"${quiz.title || 'Test'}" başarıyla silindi.` });
    } catch (error) {
      console.error('Test silinemedi:', error);
      res.status(500).json({ mesaj: 'Test silinemedi.' });
    }
  });

  router.get('/education/homeworks', allow('superadmin', 'editor'), async (req, res) => {
    try {
      const assignmentColl = typeof getAssignmentCollection === 'function' ? getAssignmentCollection() : null;
      if (!assignmentColl) return res.json({ homeworks: [] });

      const homeworkColl = typeof getHomeworkCollection === 'function' ? getHomeworkCollection() : null;
      const studentColl = typeof getStudentCollection === 'function' ? getStudentCollection() : null;

      const assignments = await assignmentColl.find({})
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();

      const homeworkIds = [...new Set(assignments.map(a => a.homeworkId?.toString()).filter(Boolean))].map(id => new ObjectId(id));
      const studentProfileIds = [...new Set(assignments.map(a => a.studentProfileId?.toString()).filter(Boolean))].map(id => new ObjectId(id));

      const [homeworkList, studentList] = await Promise.all([
        homeworkColl && homeworkIds.length ? homeworkColl.find({ _id: { $in: homeworkIds } }).toArray() : [],
        studentColl && studentProfileIds.length ? studentColl.find({ _id: { $in: studentProfileIds } }).toArray() : []
      ]);

      const homeworkMap = new Map(homeworkList.map(h => [h._id.toString(), h]));
      const studentMap = new Map(studentList.map(s => [s._id.toString(), s]));

      const items = assignments.map(a => {
        const hw = homeworkMap.get(a.homeworkId?.toString());
        const st = studentMap.get(a.studentProfileId?.toString());
        return {
          id: a._id.toString(),
          homeworkId: a.homeworkId?.toString() || '',
          title: hw?.title || 'Ödev Ataması',
          type: hw?.type || 'Ödev',
          grade: hw?.grade || st?.grade || '—',
          studentName: st ? `${st.firstName} ${st.lastName}` : (a.studentUserId || 'Öğrenci'),
          teacherId: a.teacherId?.toString() || hw?.teacherId?.toString() || '',
          status: a.status || 'Atandı',
          dueAt: a.dueAt || hw?.dueAt || null,
          createdAt: a.createdAt || hw?.createdAt || new Date()
        };
      });

      res.json({ homeworks: items });
    } catch (error) {
      console.error('Ödevler listelenemedi:', error);
      res.status(500).json({ mesaj: 'Ödevler listelenemedi.' });
    }
  });

  router.delete('/education/homeworks/:id', allow('superadmin', 'editor'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz ödev kimliği.' });
    }
    try {
      const idObj = new ObjectId(req.params.id);
      const assignmentColl = typeof getAssignmentCollection === 'function' ? getAssignmentCollection() : null;
      const homeworkColl = typeof getHomeworkCollection === 'function' ? getHomeworkCollection() : null;

      let deletedCount = 0;
      if (assignmentColl) {
        const res1 = await assignmentColl.deleteOne({ _id: idObj });
        deletedCount += res1.deletedCount;
        if (!res1.deletedCount) {
          const res2 = await assignmentColl.deleteMany({ homeworkId: idObj });
          deletedCount += res2.deletedCount;
        }
      }
      if (homeworkColl) {
        await homeworkColl.deleteOne({ _id: idObj }).catch(() => {});
      }

      await audit(req, 'homework.deleted', 'homework_assignment', req.params.id);
      res.json({ mesaj: 'Ödev ataması başarıyla silindi.' });
    } catch (error) {
      console.error('Ödev silinemedi:', error);
      res.status(500).json({ mesaj: 'Ödev silinemedi.' });
    }
  });

  router.delete('/education/exams/:id', allow('superadmin', 'editor'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz deneme kimliği.' });
    }
    try {
      const DenemeModel = typeof getDenemeModel === 'function' ? getDenemeModel() : null;
      if (DenemeModel) {
        await DenemeModel.findByIdAndDelete(req.params.id);
      }
      await audit(req, 'exam.deleted', 'deneme', req.params.id);
      res.json({ mesaj: 'Deneme sınavı başarıyla silindi.' });
    } catch (error) {
      console.error('Deneme sınavı silinemedi:', error);
      res.status(500).json({ mesaj: 'Deneme sınavı silinemedi.' });
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

  
  // ==========================================
  // AI DENETİM & KOTA YÖNETİMİ ENDPOINT'LERİ
  // ==========================================

  // 1. Ajan Performans ve Genel AI Denetim Özeti
  router.get('/ai-denetim-ozet', allow('superadmin', 'support'), async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    try {
      const AiUsageLog = require('../models/AiUsageLog');
      const SysConfig = SystemConfig || require('../models/SystemConfig');
      const [auditData, toplamOgrenci, aiEngelliSayisi, ozelLimitliSayisi, bonusluSayisi, rawKrediAyari] = await Promise.all([
        getAiAuditSummary(),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ aiErisimEngelli: true }),
        User.countDocuments({ ozelGunlukMesajLimiti: { $ne: null } }),
        User.countDocuments({ ekstraBonusKredi: { $gt: 0 } }),
        typeof SysConfig.getGeminiCreditSettings === 'function'
          ? SysConfig.getGeminiCreditSettings()
          : { initialCredit: 0.00, updatedAt: null }
      ]);

      const krediAyari = rawKrediAyari || { initialCredit: 0.00, updatedAt: null };
      const initialCredit = typeof krediAyari.initialCredit === 'number'
        ? krediAyari.initialCredit
        : typeof krediAyari.gemini_initial_credit === 'number'
          ? krediAyari.gemini_initial_credit
          : 0.00;
      const creditDate = krediAyari.updatedAt || krediAyari.gemini_credit_updated_at || null;

      let spentSinceUpdateTL = 0;
      let spentSinceUpdateUSD = 0;
      if (creditDate) {
        const sinceSpend = await AiUsageLog.aggregate([
          { $match: { tarih: { $gte: new Date(creditDate) }, cacheHit: false } },
          { $group: { _id: null, totalTL: { $sum: '$toplamMaliyetTL' }, totalUSD: { $sum: '$toplamMaliyetUSD' } } }
        ]);
        if (sinceSpend.length > 0) {
          spentSinceUpdateTL = sinceSpend[0].totalTL || 0;
          spentSinceUpdateUSD = sinceSpend[0].totalUSD || 0;
        }
      }
      const remainingCredit = Math.max(0, Number((initialCredit - spentSinceUpdateTL).toFixed(2)));

      res.json({
        genel: auditData.genel,
        ajanlar: auditData.ajanlar,
        kullaniciIstatistikleri: {
          toplamOgrenci,
          aiEngelliSayisi,
          ozelLimitliSayisi,
          bonusluSayisi
        },
        kredi: {
          initialCredit,
          remainingCredit,
          spentSinceUpdateTL: Number(spentSinceUpdateTL.toFixed(2)),
          spentSinceUpdateUSD: Number(spentSinceUpdateUSD.toFixed(4)),
          updatedAt: creditDate,
          isExhausted: remainingCredit <= 0,
          isLow: remainingCredit > 0 && remainingCredit < 10
        }
      });
    } catch (error) {
      console.error('AI denetim özeti alınamadı:', error);
      res.status(500).json({ mesaj: 'AI denetim özeti alınamadı: ' + error.message });
    }
  });

  // 1B. Gemini API Tanımlı Kredi Güncelleme (Sadece Süper Admin)
  router.post('/ai-kredi-guncelle', allow('superadmin'), async (req, res) => {
    try {
      const { initialCredit, credit } = req.body || {};
      const amount = initialCredit !== undefined ? initialCredit : credit;
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 0) {
        return res.status(400).json({ mesaj: 'Geçersiz kredi tutarı. Sıfır veya pozitif bir sayı giriniz.' });
      }

      const SysConfig = SystemConfig || require('../models/SystemConfig');
      if (typeof SysConfig.saveGeminiCredit !== 'function') {
        return res.status(500).json({ mesaj: 'Sistem ayar servisi bulunamadı.' });
      }

      const updated = await SysConfig.saveGeminiCredit(numAmount);
      const savedAmount = typeof updated?.initialCredit === 'number'
        ? updated.initialCredit
        : typeof updated?.gemini_initial_credit === 'number'
          ? updated.gemini_initial_credit
          : numAmount;
      const savedDate = updated?.updatedAt || updated?.gemini_credit_updated_at || new Date();

      await audit(req, 'gemini_credit.updated', 'system_config', 'gemini-credit', {
        initialCredit: savedAmount,
        updatedAt: savedDate
      });

      res.json({
        mesaj: `Gemini API başlangıç kredisi ${savedAmount.toFixed(2)} ₺ olarak güncellendi.`,
        kredi: {
          initialCredit: savedAmount,
          updatedAt: savedDate
        }
      });
    } catch (error) {
      console.error('Gemini kredi güncelleme hatası:', error);
      res.status(500).json({ mesaj: 'Kredi güncellenemedi: ' + error.message });
    }
  });

  // 2. Kullanıcı Bazlı AI Denetim Listesi
  const getAiUsersListHandler = async (req, res) => {
    try {
      const search = req.query.search || req.query.q || '';
      const role = req.query.role || req.query.rol || 'student';
      const paketTipi = req.query.paketTipi || req.query.paket || 'all';
      const sort = req.query.sort || req.query.sirala || 'maliyet_desc';
      const limit = req.query.limit || 50;
      const page = req.query.page || req.query.sayfa || 1;

      const filter = {};
      if (role && role !== 'all') {
        filter.role = role;
      }
      if (paketTipi && paketTipi !== 'all') {
        filter.paketTipi = paketTipi;
      }
      if (search && String(search).trim()) {
        const q = String(search).trim();
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ];
      }

      // Sıralama
      let sortQuery = { toplamMaliyetTL: -1, toplamHarcananToken: -1 };
      if (sort === 'token_desc') sortQuery = { toplamHarcananToken: -1 };
      else if (sort === 'mesaj_desc') sortQuery = { gunlukAiMesajSayisi: -1 };
      else if (sort === 'name_asc') sortQuery = { name: 1 };

      const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const skip = (pageNum - 1) * limitNum;

      const [users, totalCount] = await Promise.all([
        User.find(filter)
          .select('name email role ogretmenTipi paketTipi kayitliSinif seciliTelafiSinif gunlukAiMesajSayisi gunlukSoruUretimSayisi ozelGunlukMesajLimiti ozelGunlukSoruLimiti ozelAylikSoruLimiti ekstraBonusKredi ekstraSokratikKredi ekstraOgretmenIkiziKredi toplamHarcananToken toplamMaliyetTL aiErisimEngelli sonKotaSifirlamaTarihi')
          .sort(sortQuery)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(filter)
      ]);

      const formatted = users.map(u => {
        const { getEffectiveMessageLimit, getEffectiveQuestionLimit, canUserUseProModel } = require('../middleware/aiQuota');
        const pTipi = u.paketTipi || 'free';
        const oTip = u.ogretmenTipi || 'standart_ogretmen';
        const etkinLimit = getEffectiveMessageLimit(u);
        const etkinSoruLimiti = getEffectiveQuestionLimit(u);
        const gunlukKullanim = u.gunlukAiMesajSayisi || 0;
        const gunlukSoruKullanim = u.gunlukSoruUretimSayisi || 0;
        const isSinirsiz = u.role === 'admin' || (u.role === 'teacher' && oTip === 'icerik_ureticisi');

        return {
          id: u._id.toString(),
          name: u.name || 'İsimsiz Kullanıcı',
          email: u.email,
          role: u.role,
          ogretmenTipi: u.role === 'teacher' ? oTip : undefined,
          kayitliSinif: u.kayitliSinif || 8,
          seciliTelafiSinif: u.seciliTelafiSinif || null,
          ozelGunlukSoruLimiti: u.ozelGunlukSoruLimiti,
          ozelAylikSoruLimiti: u.ozelAylikSoruLimiti,
          gunlukSoruKullanim,
          etkinSoruLimiti,
          proModelIzni: canUserUseProModel(u),
          sinirsiz: isSinirsiz,
          paketTipi: pTipi,
          gunlukKullanim,
          ozelGunlukMesajLimiti: u.ozelGunlukMesajLimiti,
          etkinLimit,
          kalanHak: isSinirsiz ? 'Sınırsız' : Math.max(0, etkinLimit - gunlukKullanim),
          ekstraBonusKredi: u.ekstraBonusKredi || 0,
          ekstraSokratikKredi: u.ekstraSokratikKredi || 0,
          ekstraOgretmenIkiziKredi: u.ekstraOgretmenIkiziKredi || 0,
          toplamHarcananToken: u.toplamHarcananToken || 0,
          toplamMaliyetTL: Number((u.toplamMaliyetTL || 0).toFixed(2)),
          aiErisimEngelli: Boolean(u.aiErisimEngelli),
          sonKotaSifirlamaTarihi: u.sonKotaSifirlamaTarihi
        };
      });

      res.json({
        kullanicilar: formatted,
        toplam: totalCount,
        toplamKullanici: totalCount,
        sayfa: pageNum,
        page: pageNum,
        toplamSayfa: Math.ceil(totalCount / limitNum)
      });
    } catch (error) {
      console.error('AI kullanıcı listesi alınamadı:', error);
      res.status(500).json({ mesaj: 'Kullanıcı listesi alınamadı: ' + error.message });
    }
  };

  router.get('/ai-kullanicilar', allow('superadmin', 'support'), getAiUsersListHandler);
  router.get('/ai-kullanici-kotalari', allow('superadmin', 'support'), getAiUsersListHandler);

  // 3. Canlı Müdahale: Kullanıcı Kota, Bonus, Paket ve Erişim Güncelleme
  router.post('/kullanici-kota-guncelle', allow('superadmin', 'support'), async (req, res) => {
    try {
      const {
        userId,
        islem,
        ozelGunlukMesajLimiti,
        ozelGunlukSoruLimiti,
        ozelAylikSoruLimiti,
        bonusMiktar,
        paketTipi,
        ogretmenTipi,
        aiErisimEngelli,
        kayitliSinif,
        seciliTelafiSinif,
        ajan
      } = req.body;

      if (!userId) {
        return res.status(400).json({ mesaj: 'userId parametresi zorunludur.' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ mesaj: 'Kullanıcı bulunamadı.' });
      }

      let degisiklikDetayi = {};

      if (islem === 'limit_duzenle') {
        if (ozelGunlukMesajLimiti === null || ozelGunlukMesajLimiti === '' || ozelGunlukMesajLimiti === 'null') {
          user.ozelGunlukMesajLimiti = null;
          degisiklikDetayi.ozelGunlukMesajLimiti = 'Varsayılan paket limitine dönüldü';
        } else {
          const parsed = parseInt(ozelGunlukMesajLimiti, 10);
          if (isNaN(parsed) || parsed < 0) {
            return res.status(400).json({ mesaj: 'Geçersiz limit değeri.' });
          }
          user.ozelGunlukMesajLimiti = parsed;
          degisiklikDetayi.ozelGunlukMesajLimiti = parsed;
        }
      } else if (islem === 'ogretmen_tipi_guncelle') {
        if (!['icerik_ureticisi', 'onayli_ogretmen', 'standart_ogretmen'].includes(ogretmenTipi)) {
          return res.status(400).json({ mesaj: 'Geçersiz öğretmen tipi. (icerik_ureticisi, onayli_ogretmen, standart_ogretmen)' });
        }
        user.ogretmenTipi = ogretmenTipi;
        degisiklikDetayi.yeniOgretmenTipi = ogretmenTipi;
      } else if (islem === 'soru_limiti_duzenle') {
        if (ozelGunlukSoruLimiti === null || ozelGunlukSoruLimiti === '' || ozelGunlukSoruLimiti === 'null') {
          user.ozelGunlukSoruLimiti = null;
          degisiklikDetayi.ozelGunlukSoruLimiti = 'Varsayılan yetki limitine dönüldü';
        } else {
          const parsed = parseInt(ozelGunlukSoruLimiti, 10);
          if (isNaN(parsed) || parsed < 0) {
            return res.status(400).json({ mesaj: 'Geçersiz soru limiti değeri.' });
          }
          user.ozelGunlukSoruLimiti = parsed;
          degisiklikDetayi.ozelGunlukSoruLimiti = parsed;
        }
      } else if (islem === 'aylik_soru_limiti_duzenle') {
        if (ozelAylikSoruLimiti === null || ozelAylikSoruLimiti === '' || ozelAylikSoruLimiti === 'null') {
          user.ozelAylikSoruLimiti = null;
          degisiklikDetayi.ozelAylikSoruLimiti = 'Varsayılan aylık kotaya (200) dönüldü';
        } else {
          const parsed = parseInt(ozelAylikSoruLimiti, 10);
          if (isNaN(parsed) || parsed < 0) {
            return res.status(400).json({ mesaj: 'Geçersiz aylık soru limiti.' });
          }
          user.ozelAylikSoruLimiti = parsed;
          degisiklikDetayi.ozelAylikSoruLimiti = parsed;
        }
      } else if (islem === 'sinif_guncelle') {
        const sinifNum = parseInt(kayitliSinif, 10);
        if (isNaN(sinifNum) || sinifNum < 5 || sinifNum > 12) {
          return res.status(400).json({ mesaj: 'Kayıtlı sınıf 5 ile 12 arasında olmalıdır.' });
        }
        user.kayitliSinif = sinifNum;
        if (seciliTelafiSinif !== undefined) {
          const telafiNum = parseInt(seciliTelafiSinif, 10);
          user.seciliTelafiSinif = (!isNaN(telafiNum) && telafiNum >= 5 && telafiNum <= 12) ? telafiNum : null;
        }
        degisiklikDetayi.kayitliSinif = user.kayitliSinif;
        degisiklikDetayi.seciliTelafiSinif = user.seciliTelafiSinif;
      } else if (islem === 'bonus_ekle') {
        const miktar = parseInt(bonusMiktar, 10) || 20;
        user.ekstraBonusKredi = (user.ekstraBonusKredi || 0) + miktar;
        degisiklikDetayi.eklenenBonus = miktar;
        degisiklikDetayi.toplamBonus = user.ekstraBonusKredi;
      } else if (islem === 'ajan_bonusu_ekle') {
        const miktar = parseInt(bonusMiktar, 10) || 10;
        if (ajan === 'ogretmen_ikizi') {
          user.ekstraOgretmenIkiziKredi = (user.ekstraOgretmenIkiziKredi || 0) + miktar;
          degisiklikDetayi.eklenenOgretmenIkiziBonus = miktar;
        } else {
          user.ekstraSokratikKredi = (user.ekstraSokratikKredi || 0) + miktar;
          degisiklikDetayi.eklenenSokratikBonus = miktar;
        }
      } else if (islem === 'paket_degistir') {
        const validPlans = ['free', 'temel', 'standart', 'vip', 'baslangic', 'pro'];
        if (!validPlans.includes(paketTipi)) {
          return res.status(400).json({ mesaj: 'Geçersiz paket tipi. (free, temel, standart, vip)' });
        }
        user.paketTipi = paketTipi;
        if (['temel', 'standart', 'vip'].includes(paketTipi)) {
          user.subscriptionPlan = paketTipi;
          user.subscriptionStatus = 'active';
          if (!user.expiresAt || new Date(user.expiresAt) <= new Date()) {
            user.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          }
        } else if (paketTipi === 'free') {
          user.subscriptionPlan = null;
          user.subscriptionStatus = 'free';
        }
        degisiklikDetayi.yeniPaket = paketTipi;
      } else if (islem === 'erisim_toggle') {
        user.aiErisimEngelli = typeof aiErisimEngelli === 'boolean' ? aiErisimEngelli : !user.aiErisimEngelli;
        degisiklikDetayi.aiErisimEngelli = user.aiErisimEngelli;
      } else if (islem === 'kota_sifirla') {
        user.gunlukAiMesajSayisi = 0;
        user.gunlukSokratikSayisi = 0;
        user.gunlukSoruUretimSayisi = 0;
        user.sonKotaSifirlamaTarihi = new Date();
        degisiklikDetayi.mesaj = 'Bugünkü kullanım sayaçları sıfırlandı';
      } else {
        return res.status(400).json({ mesaj: 'Geçersiz işlem türü.' });
      }

      await user.save();

      // Admin log kaydı
      try {
        await AdminLog.create({
          actorId: req.session.user._id,
          actorName: req.session.user.name || 'Admin',
          action: 'ai_quota_update',
          entityType: 'user',
          entityId: user._id.toString(),
          details: { islem, ...degisiklikDetayi }
        });
      } catch (logErr) {
        console.warn('AdminLog kaydı yapılamadı:', logErr.message);
      }

      const pTipi = user.paketTipi || 'free';
      const tabanLimit = (PAKET_LIMITLERI[pTipi] || PAKET_LIMITLERI.free).maxMessages;
      const etkinLimit = typeof user.ozelGunlukMesajLimiti === 'number' ? user.ozelGunlukMesajLimiti : tabanLimit;

      res.json({
        basarili: true,
        mesaj: 'Kullanıcı AI kota ayarları başarıyla güncellendi.',
        kullanici: {
          id: user._id.toString(),
          name: user.name,
          paketTipi: pTipi,
          ozelGunlukMesajLimiti: user.ozelGunlukMesajLimiti,
          etkinLimit,
          gunlukKullanim: user.gunlukAiMesajSayisi,
          kalanHak: Math.max(0, etkinLimit - user.gunlukAiMesajSayisi),
          ekstraBonusKredi: user.ekstraBonusKredi,
          aiErisimEngelli: user.aiErisimEngelli
        }
      });
    } catch (error) {
      console.error('Kullanıcı kota güncelleme hatası:', error);
      res.status(500).json({ mesaj: 'Kullanıcı kotası güncellenemedi: ' + error.message });
    }
  });

  // 4. Başarılı Öğrencilere Toplu Bonus Dağıtımı (Ödül Motoru)
  router.post('/toplu-bonus-dagit', allow('superadmin', 'support'), async (req, res) => {
    try {
      const { kriter, miktar = 20, aciklama } = req.body;
      const bonusMiktar = parseInt(miktar, 10);
      if (isNaN(bonusMiktar) || bonusMiktar <= 0 || bonusMiktar > 500) {
        return res.status(400).json({ mesaj: 'Dağıtılacak bonus miktarı 1 ile 500 arasında olmalıdır.' });
      }

      let hedefSorgu = {};
      let kriterAciklamasi = '';

      if (kriter === 'haftalik_lig_ilk_3') {
        const top3 = await User.find({ role: 'student', haftalikPuan: { $gt: 0 } })
          .sort({ haftalikPuan: -1 })
          .limit(3)
          .select('_id')
          .lean();
        if (!top3.length) {
          return res.status(404).json({ mesaj: 'Haftalık ligde puanı olan öğrenci bulunamadı.' });
        }
        hedefSorgu = { _id: { $in: top3.map(u => u._id) } };
        kriterAciklamasi = 'Haftalık ligde ilk 3 dereceye giren öğrenciler';
      } else if (kriter === 'seri_7_gun') {
        hedefSorgu = { role: 'student', seriGunSayisi: { $gte: 7 } };
        kriterAciklamasi = '7 gün ve üzeri çalışma serisi (streak) yakalayan öğrenciler';
      } else if (kriter === 'deneme_yuzdelik_10') {
        hedefSorgu = { role: 'student', zarifPuan: { $gte: 100 } };
        kriterAciklamasi = 'Yüksek deneme ve platform puanına sahip öğrenciler';
      } else if (kriter === 'tum_ogrenciler') {
        hedefSorgu = { role: 'student', restricted: { $ne: true } };
        kriterAciklamasi = 'Tüm aktif kayıtlı öğrenciler';
      } else {
        return res.status(400).json({ mesaj: 'Geçersiz ödül kriteri. (haftalik_lig_ilk_3, seri_7_gun, deneme_yuzdelik_10, tum_ogrenciler)' });
      }

      const updateResult = await User.updateMany(hedefSorgu, {
        $inc: { ekstraBonusKredi: bonusMiktar }
      });

      try {
        await AdminLog.create({
          actorId: req.session.user._id,
          actorName: req.session.user.name || 'Admin',
          action: 'bulk_bonus_awarded',
          entityType: 'students',
          details: {
            kriter,
            kriterAciklamasi,
            miktar: bonusMiktar,
            etkilenenSayisi: updateResult.modifiedCount,
            aciklama
          }
        });
      } catch {}

      res.json({
        basarili: true,
        mesaj: `${kriterAciklamasi} kapsamındaki ${updateResult.modifiedCount} öğrenciye kişi başı +${bonusMiktar} bonus kredi başarıyla tanımlandı.`,
        etkilenenOgrenciSayisi: updateResult.modifiedCount,
        kisiBasiBonus: bonusMiktar,
        toplamDagitilanBonus: updateResult.modifiedCount * bonusMiktar
      });
    } catch (err) {
      console.error('Toplu bonus dağıtımı hatası:', err);
      res.status(500).json({ mesaj: 'Toplu bonus dağıtılamadı: ' + err.message });
    }
  });

  // 5. Türkiye Geneli Deneme Listeleme
  router.get('/turkiye-geneli-denemeler', allow('superadmin', 'editor'), async (req, res) => {
    try {
      const TurkiyeGeneliDeneme = require('../models/TurkiyeGeneliDeneme');
      const denemeler = await TurkiyeGeneliDeneme.find().sort({ startDate: -1 }).lean();
      res.json({ denemeler });
    } catch (err) {
      res.status(500).json({ mesaj: 'Türkiye Geneli Denemeler listelenemedi: ' + err.message });
    }
  });

  // 6. Yeni Türkiye Geneli Deneme Oluşturma
  router.post('/turkiye-geneli-deneme', allow('superadmin', 'editor'), async (req, res) => {
    try {
      const TurkiyeGeneliDeneme = require('../models/TurkiyeGeneliDeneme');
      const { title, grade, startDate, endDate, durationMinutes = 80, soruIds = [], description = '' } = req.body;
      if (!title || !grade || !startDate || !endDate) {
        return res.status(400).json({ mesaj: 'Deneme adı, sınıf (5-12), başlangıç ve bitiş tarihi zorunludur.' });
      }
      const deneme = await TurkiyeGeneliDeneme.create({
        title: title.trim(),
        grade: Number(grade),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        durationMinutes: Number(durationMinutes) || 80,
        soruIds,
        description: description.trim(),
        published: true,
        createdBy: req.session.user._id
      });
      res.status(201).json({ basarili: true, mesaj: 'Türkiye Geneli Deneme başarıyla oluşturuldu ve yayınlandı.', deneme });
    } catch (err) {
      res.status(500).json({ mesaj: 'Deneme oluşturulamadı: ' + err.message });
    }
  });

  // 7. Türkiye Geneli Sıralama ve Net Karnelerini Hesaplatma / Açıklama
  router.post('/turkiye-geneli-sirala/:id', allow('superadmin', 'editor'), async (req, res) => {
    try {
      const TurkiyeGeneliDeneme = require('../models/TurkiyeGeneliDeneme');
      const { rankParticipants, calculateNet } = require('../lib/turkiye-geneli-ranking');
      const mongoose = require('mongoose');
      const deneme = await TurkiyeGeneliDeneme.findById(req.params.id);
      if (!deneme) return res.status(404).json({ mesaj: 'Türkiye Geneli Deneme bulunamadı.' });

      const db = mongoose.connection.db;
      const sonuclar = db ? await db.collection('turkiye_geneli_sonuclar').find({ denemeId: deneme._id }).toArray() : [];
      if (!sonuclar || !sonuclar.length) {
        return res.status(400).json({ mesaj: 'Bu denemeye henüz katılım sağlayan öğrenci bulunmuyor.' });
      }

      const formatted = sonuclar.map(s => ({
        ...s,
        studentId: s.studentId ? s.studentId.toString() : '',
        netCount: s.netCount !== undefined ? s.netCount : calculateNet(s.correctCount, s.wrongCount),
        score: s.score || 0,
        city: s.city || 'Belirtilmedi'
      }));

      const ranked = rankParticipants(formatted);

      for (const item of ranked) {
        await db.collection('turkiye_geneli_sonuclar').updateOne(
          { _id: item._id },
          {
            $set: {
              turkiyeSirasi: item.turkiyeSirasi,
              ilSirasi: item.ilSirasi,
              yuzdelikDilim: item.yuzdelikDilim,
              toplamKatilimci: item.toplamKatilimci
            }
          }
        );
      }

      const totalNet = ranked.reduce((acc, curr) => acc + curr.netCount, 0);
      const avgNet = parseFloat((totalNet / ranked.length).toFixed(2));
      deneme.resultsAnnounced = true;
      deneme.totalParticipants = ranked.length;
      deneme.averageNet = avgNet;
      await deneme.save();

      res.json({
        basarili: true,
        mesaj: `${ranked.length} öğrencinin Türkiye ve il sıralamaları ile yüzdelik dilimleri başarıyla hesaplandı ve yayınlandı.`,
        toplamKatilimci: ranked.length,
        ortalamaNet: avgNet
      });
    } catch (err) {
      res.status(500).json({ mesaj: 'Sıralama hesaplanamadı: ' + err.message });
    }
  });

  
  // ==========================================
  // ÖĞRETMEN BAŞVURULARI VE ONAY AKIŞI
  // ==========================================

  // 1. Öğretmen Başvuruları Listesi
  router.get('/ogretmen-basvurulari', allow('superadmin', 'support'), async (req, res) => {
    try {
      const { durum = 'inceleme_suruyor' } = req.query;

      const filter = { role: 'teacher' };
      if (durum && durum !== 'all') {
        filter.basvuruDurumu = durum;
      }

      const [basvurular, bekleyenSayisi] = await Promise.all([
        User.find(filter)
          .select('name email phone telefon brans branch graduationInfo verificationDocumentUrl contractAccepted contractAcceptedAt okulKurumAdi basvuruNotu basvuruDurumu ogretmenTipi basvuruTarihi onayTarihi createdAt')
          .sort({ basvuruTarihi: -1, createdAt: -1 })
          .limit(200)
          .lean(),
        User.countDocuments({ role: 'teacher', basvuruDurumu: 'inceleme_suruyor' })
      ]);

      const formatted = basvurular.map(b => ({
        id: b._id.toString(),
        name: b.name || 'İsimsiz',
        email: b.email,
        phone: b.phone || b.telefon || '—',
        brans: b.branch || b.brans || 'Belirtilmedi',
        branch: b.branch || b.brans || 'Belirtilmedi',
        graduationInfo: b.graduationInfo || '—',
        verificationDocumentUrl: b.verificationDocumentUrl || null,
        contractAccepted: Boolean(b.contractAccepted),
        contractAcceptedAt: b.contractAcceptedAt || null,
        okulKurumAdi: b.okulKurumAdi || 'Belirtilmedi',
        basvuruNotu: b.basvuruNotu || '',
        basvuruDurumu: b.basvuruDurumu || 'inceleme_suruyor',
        ogretmenTipi: b.ogretmenTipi || 'standart_ogretmen',
        basvuruTarihi: b.basvuruTarihi || b.createdAt,
        onayTarihi: b.onayTarihi || null
      }));

      res.json({
        basvurular: formatted,
        bekleyenSayisi,
        toplam: formatted.length
      });
    } catch (error) {
      console.error('Öğretmen başvuruları alınamadı:', error);
      res.status(500).json({ mesaj: 'Öğretmen başvuruları alınamadı: ' + error.message });
    }
  });

  // 2. Öğretmen Başvuru Onayla / Reddet
  router.post('/ogretmen-basvuru-durum-guncelle', allow('superadmin', 'support'), async (req, res) => {
    try {
      const { userId, yeniDurum, ogretmenTipi } = req.body;

      if (!userId || !['onaylandi', 'reddedildi', 'inceleme_suruyor'].includes(yeniDurum)) {
        return res.status(400).json({ mesaj: 'userId ve geçerli yeniDurum zorunludur.' });
      }

      const user = await User.findById(userId);
      if (!user || user.role !== 'teacher') {
        return res.status(404).json({ mesaj: 'Öğretmen kullanıcısı bulunamadı.' });
      }

      user.basvuruDurumu = yeniDurum;

      if (yeniDurum === 'onaylandi') {
        user.ogretmenTipi = ['icerik_ureticisi', 'onayli_ogretmen', 'standart_ogretmen'].includes(ogretmenTipi)
          ? ogretmenTipi
          : 'onayli_ogretmen';
        user.onayTarihi = new Date();
        user.onaylayanAdminId = req.session.user._id ? req.session.user._id.toString() : 'admin';
      }

      await user.save();

      // Öğretmene otomatik durum bilgilendirme e-postası gönder
      if (['onaylandi', 'reddedildi'].includes(yeniDurum)) {
        sendTeacherStatusEmail({
          email: user.email,
          name: user.name,
          status: yeniDurum,
          teacherType: user.ogretmenTipi
        }).catch(err => {
          console.warn('[Admin] Öğretmen bildirim e-postası gönderilemedi:', err.message);
        });
      }

      // Admin log kaydı
      try {
        await AdminLog.create({
          actorId: req.session.user._id,
          actorName: req.session.user.name || 'Admin',
          action: yeniDurum === 'onaylandi' ? 'approve_teacher' : 'reject_teacher',
          entityType: 'user',
          entityId: user._id.toString(),
          details: { yeniDurum, ogretmenTipi: user.ogretmenTipi }
        });
      } catch (logErr) {}

      res.json({
        basarili: true,
        mesaj: yeniDurum === 'onaylandi'
          ? `"${user.name}" adlı öğretmen onaylandı ve ${user.ogretmenTipi} yetkisiyle aktif edildi.`
          : `"${user.name}" adlı öğretmenin başvurusu reddedildi.`,
        kullanici: {
          id: user._id.toString(),
          name: user.name,
          basvuruDurumu: user.basvuruDurumu,
          ogretmenTipi: user.ogretmenTipi
        }
      });
    } catch (error) {
      console.error('Öğretmen başvuru durum güncelleme hatası:', error);
      res.status(500).json({ mesaj: 'Başvuru güncellenemedi: ' + error.message });
    }
  });

  // ==========================================
  // ÖĞRETMEN MAAŞ VE HAKEDİŞ MASASI (YÖNTEM A)
  // ==========================================

  const receiptUploadDir = path.join(__dirname, '..', 'uploads', 'payout-receipts');
  try {
    if (!fs.existsSync(receiptUploadDir)) {
      fs.mkdirSync(receiptUploadDir, { recursive: true });
    }
  } catch (dirErr) {
    console.warn('[Admin] receiptUploadDir dizini oluşturulamadı:', dirErr.message);
  }

  const receiptStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, receiptUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `dekont-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
      cb(null, safeName);
    }
  });

  const receiptUpload = multer({
    storage: receiptStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        return cb(new Error('Yalnızca PDF, PNG veya JPG dekont dosyaları yüklenebilir.'));
      }
      cb(null, true);
    }
  });

  function getPeriodLabel(periodStr) {
    if (!periodStr || !periodStr.includes('-')) return periodStr || 'Cari Dönem';
    const [year, month] = periodStr.split('-');
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${monthName} ${year}`;
  }

  function generateRecentPeriods(count = 12) {
    const list = [];
    const date = new Date();
    for (let i = 0; i < count; i++) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const p = `${y}-${m}`;
      list.push({ period: p, label: getPeriodLabel(p) });
      date.setMonth(date.getMonth() - 1);
    }
    return list;
  }

  // 1. Hakediş Listesi & Finansal Özet
  router.get('/teacher-payouts', allow('superadmin', 'support'), async (req, res) => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const period = req.query.period || currentMonth;
      const statusFilter = req.query.status;
      const search = (req.query.search || '').trim().toLowerCase();

      const filter = { period };
      if (statusFilter && statusFilter !== 'all') {
        filter.status = statusFilter;
      }

      let payouts = await TeacherPayout.find(filter).sort({ teacherName: 1 }).lean();

      if (search) {
        payouts = payouts.filter(p =>
          (p.teacherName && p.teacherName.toLowerCase().includes(search)) ||
          (p.teacherEmail && p.teacherEmail.toLowerCase().includes(search)) ||
          (p.iban && p.iban.toLowerCase().includes(search))
        );
      }

      // İstatistik ve Finansal KPI Hesaplamaları
      const allPeriodPayouts = await TeacherPayout.find({ period }).lean();
      const summary = {
        totalTeachers: allPeriodPayouts.length,
        totalGross: allPeriodPayouts.reduce((acc, p) => acc + (p.grossAmount || 0), 0),
        totalWithholding: allPeriodPayouts.reduce((acc, p) => acc + (p.withholdingAmount || 0), 0),
        totalNet: allPeriodPayouts.reduce((acc, p) => acc + (p.netAmount || 0), 0),
        pendingCount: allPeriodPayouts.filter(p => p.status === 'bekliyor' || p.status === 'taslak').length,
        pendingAmount: allPeriodPayouts.filter(p => p.status === 'bekliyor' || p.status === 'taslak').reduce((acc, p) => acc + (p.netAmount || 0), 0),
        approvedCount: allPeriodPayouts.filter(p => p.status === 'onaylandi').length,
        approvedAmount: allPeriodPayouts.filter(p => p.status === 'onaylandi').reduce((acc, p) => acc + (p.netAmount || 0), 0),
        paidCount: allPeriodPayouts.filter(p => p.status === 'odendi').length,
        paidAmount: allPeriodPayouts.filter(p => p.status === 'odendi').reduce((acc, p) => acc + (p.netAmount || 0), 0),
        corporateCount: allPeriodPayouts.filter(p => p.taxType !== 'bireysel').length,
        invoicePendingCount: allPeriodPayouts.filter(p => p.taxType !== 'bireysel' && p.invoiceStatus === 'bekleniyor').length
      };

      const periods = generateRecentPeriods(12);

      res.json({
        basarili: true,
        currentPeriod: period,
        periodLabel: getPeriodLabel(period),
        payouts,
        summary,
        periods
      });
    } catch (err) {
      console.error('Teacher payouts list error:', err);
      res.status(500).json({ mesaj: 'Hakediş listesi alınamadı: ' + err.message });
    }
  });

  // 2. Dönem Hakedişlerini Hesapla / Oluştur
  router.post('/teacher-payouts/calculate', allow('superadmin'), async (req, res) => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const period = req.body.period || currentMonth;
      const periodLabel = getPeriodLabel(period);
      const forceRecalculate = Boolean(req.body.forceRecalculate);

      // Aktif ve onaylı öğretmenleri bul
      const teachers = await User.find({
        role: 'teacher',
        basvuruDurumu: { $in: ['onaylandi', 'inceleme_suruyor'] }
      }).lean();

      if (!teachers || teachers.length === 0) {
        return res.status(404).json({ mesaj: 'Sistemde kayıtlı öğretmen bulunamadı.' });
      }

      let createdCount = 0;
      let updatedCount = 0;
      let skippedLockedCount = 0;

      for (const t of teachers) {
        const existing = await TeacherPayout.findOne({ period, teacherId: t._id });

        // Kural 3: Kilitli ödemeler ASLA değiştirilemez
        if (existing && existing.isLocked) {
          skippedLockedCount++;
          continue;
        }

        const finance = t.teacherFinance || {};
        const taxType = finance.taxType || 'bireysel';
        const bankName = finance.bankName || 'Ziraat Bankası';
        const iban = finance.iban || 'TR000000000000000000000000';
        const accountHolder = finance.accountHolder || t.name;
        const taxOffice = finance.taxOffice || '';
        const taxNumber = finance.taxNumber || '';
        const hourlyRate = finance.hourlyRate || 450;

        // Varsayılan hesaplama (Örnek: 28 ders saati + soru üretim primi)
        const liveHours = existing ? existing.liveHours : 28;
        const contentBonus = existing ? existing.contentBonus : 1500;
        const grossAmount = existing && !forceRecalculate
          ? existing.grossAmount
          : Math.round((liveHours * hourlyRate) + contentBonus);

        // Kural 1: Vergi ve Kesinti Hesaplaması
        let withholdingRate = 0;
        let withholdingAmount = 0;
        let netAmount = grossAmount;
        let invoiceStatus = 'muaf';

        if (taxType === 'sahis_sirketi' || taxType === 'limited_sirket') {
          // Şirket: Stopaj kesintisi yok, fatura karşılığı ödeme yapılır
          withholdingRate = 0;
          withholdingAmount = 0;
          netAmount = grossAmount;
          invoiceStatus = existing?.invoiceUrl ? 'yuklendi' : 'bekleniyor';
        } else {
          // Bireysel: Gelir Vergisi Stopajı (%20)
          withholdingRate = 20;
          withholdingAmount = Math.round((grossAmount * withholdingRate) / 100);
          netAmount = grossAmount - withholdingAmount;
          invoiceStatus = 'muaf';
        }

        const payoutData = {
          teacherId: t._id,
          teacherName: t.name,
          teacherEmail: t.email,
          period,
          periodLabel,
          taxType,
          bankName,
          iban,
          accountHolder,
          taxOffice,
          taxNumber,
          liveHours,
          hourlyRate,
          contentCount: 15,
          contentBonus,
          grossAmount,
          withholdingRate,
          withholdingAmount,
          netAmount,
          currency: 'TRY',
          description: `${periodLabel} Ders Hakedişi`,
          invoiceStatus,
          status: existing ? existing.status : 'bekliyor',
          isLocked: false
        };

        if (existing) {
          Object.assign(existing, payoutData);
          await existing.save();
          updatedCount++;
        } else {
          await TeacherPayout.create(payoutData);
          createdCount++;
        }
      }

      await audit(req, 'teacher_payout.calculated', 'teacher_payout', period, {
        period,
        createdCount,
        updatedCount,
        skippedLockedCount
      });

      res.json({
        basarili: true,
        mesaj: `${periodLabel} dönemi hakedişleri hesaplandı. (${createdCount} yeni, ${updatedCount} güncellendi${skippedLockedCount > 0 ? `, ${skippedLockedCount} kilitli atlandı` : ''})`,
        createdCount,
        updatedCount,
        skippedLockedCount
      });
    } catch (err) {
      console.error('Teacher payout calculate error:', err);
      res.status(500).json({ mesaj: 'Hakedişler hesaplanamadı: ' + err.message });
    }
  });

  // 3. Tekil Hakediş Güncelleme (Düzenleme)
  router.put('/teacher-payouts/:id', allow('superadmin'), async (req, res) => {
    try {
      const payout = await TeacherPayout.findById(req.params.id);
      if (!payout) {
        return res.status(404).json({ mesaj: 'Hakediş kaydı bulunamadı.' });
      }

      // Kural 3: Kilitli ödemeler değiştirilemez
      if (payout.isLocked) {
        return res.status(403).json({
          mesaj: 'Bu hakediş ödenmiş ve kilitlenmiştir. Tutar ve parametreler değiştirilemez!'
        });
      }

      const {
        grossAmount,
        liveHours,
        hourlyRate,
        contentBonus,
        withholdingRate,
        taxType,
        bankName,
        iban,
        accountHolder,
        invoiceStatus,
        invoiceNo,
        description,
        notes
      } = req.body;

      if (taxType) payout.taxType = taxType;
      if (bankName) payout.bankName = bankName;
      if (iban) payout.iban = iban;
      if (accountHolder) payout.accountHolder = accountHolder;
      if (liveHours !== undefined) payout.liveHours = Number(liveHours);
      if (hourlyRate !== undefined) payout.hourlyRate = Number(hourlyRate);
      if (contentBonus !== undefined) payout.contentBonus = Number(contentBonus);
      if (description) payout.description = description;
      if (notes !== undefined) payout.notes = notes;
      if (invoiceNo !== undefined) payout.invoiceNo = invoiceNo;

      if (grossAmount !== undefined) {
        payout.grossAmount = Number(grossAmount);
      } else if (liveHours !== undefined || hourlyRate !== undefined || contentBonus !== undefined) {
        payout.grossAmount = Math.round((payout.liveHours * payout.hourlyRate) + payout.contentBonus);
      }

      // Kural 1: Vergi ve Kesinti Yeniden Hesaplama
      if (payout.taxType === 'sahis_sirketi' || payout.taxType === 'limited_sirket') {
        payout.withholdingRate = 0;
        payout.withholdingAmount = 0;
        payout.netAmount = payout.grossAmount;
        payout.invoiceStatus = invoiceStatus || (payout.invoiceUrl ? 'yuklendi' : 'bekleniyor');
      } else {
        const rate = withholdingRate !== undefined ? Number(withholdingRate) : (payout.withholdingRate || 20);
        payout.withholdingRate = rate;
        payout.withholdingAmount = Math.round((payout.grossAmount * rate) / 100);
        payout.netAmount = payout.grossAmount - payout.withholdingAmount;
        payout.invoiceStatus = 'muaf';
      }

      await payout.save();

      await audit(req, 'teacher_payout.updated', 'teacher_payout', payout._id.toString(), {
        teacherName: payout.teacherName,
        grossAmount: payout.grossAmount,
        netAmount: payout.netAmount,
        taxType: payout.taxType
      });

      res.json({
        basarili: true,
        mesaj: `"${payout.teacherName}" hakedişi güncellendi.`,
        payout
      });
    } catch (err) {
      console.error('Teacher payout update error:', err);
      res.status(500).json({ mesaj: 'Hakediş güncellenemedi: ' + err.message });
    }
  });

  // 4. Hakediş Onayla
  router.post('/teacher-payouts/:id/approve', allow('superadmin'), async (req, res) => {
    try {
      const payout = await TeacherPayout.findById(req.params.id);
      if (!payout) {
        return res.status(404).json({ mesaj: 'Hakediş kaydı bulunamadı.' });
      }

      if (payout.isLocked && payout.status === 'odendi') {
        return res.status(400).json({ mesaj: 'Bu kayıt zaten ödendi ve kilitlendi.' });
      }

      payout.status = 'onaylandi';
      payout.approvedBy = {
        adminId: req.adminUser._id.toString(),
        adminName: req.adminUser.name,
        approvedAt: new Date()
      };

      await payout.save();

      // Kural 3: Audit log kaydı
      await audit(req, 'teacher_payout.approved', 'teacher_payout', payout._id.toString(), {
        teacherName: payout.teacherName,
        netAmount: payout.netAmount,
        period: payout.period
      });

      res.json({
        basarili: true,
        mesaj: `"${payout.teacherName}" hakedişi onaylandı.`,
        payout
      });
    } catch (err) {
      console.error('Teacher payout approve error:', err);
      res.status(500).json({ mesaj: 'Hakediş onaylanamadı: ' + err.message });
    }
  });

  // 5. Hakediş Ödendi Olarak İşaretle & Kilitle (Kural 3 ve 4)
  router.post('/teacher-payouts/:id/pay', allow('superadmin'), async (req, res) => {
    try {
      const payout = await TeacherPayout.findById(req.params.id);
      if (!payout) {
        return res.status(404).json({ mesaj: 'Hakediş kaydı bulunamadı.' });
      }

      payout.status = 'odendi';
      payout.isLocked = true; // Kural 3: Kilitlenir!
      payout.paidAt = new Date();
      payout.paidBy = {
        adminId: req.adminUser._id.toString(),
        adminName: req.adminUser.name
      };

      if (!payout.approvedBy?.adminId) {
        payout.approvedBy = {
          adminId: req.adminUser._id.toString(),
          adminName: req.adminUser.name,
          approvedAt: new Date()
        };
      }

      await payout.save();

      // Kural 4: Öğretmene bildirim gönder
      try {
        await User.findByIdAndUpdate(payout.teacherId, {
          $push: {
            teacherNotifications: {
              title: '🎉 Hakediş Ödemeniz Onaylandı & Ödendi',
              message: `${payout.periodLabel} dönemi ${payout.netAmount.toLocaleString('tr-TR')} ₺ tutarındaki hakediş ödemeniz onaylanarak ${payout.iban} nolu banka hesabınıza havale/EFT ile iletilmiştir.`,
              type: 'payment',
              payoutId: payout._id.toString(),
              receiptUrl: payout.receiptUrl || null,
              read: false,
              createdAt: new Date()
            }
          }
        });
      } catch (notifyErr) {
        console.warn('Teacher notify error:', notifyErr.message);
      }

      // Kural 3: Audit log kaydı
      await audit(req, 'teacher_payout.paid', 'teacher_payout', payout._id.toString(), {
        teacherName: payout.teacherName,
        netAmount: payout.netAmount,
        iban: payout.iban,
        period: payout.period
      });

      res.json({
        basarili: true,
        mesaj: `"${payout.teacherName}" hakedişi "Ödendi" olarak kilitlendi.`,
        payout
      });
    } catch (err) {
      console.error('Teacher payout pay error:', err);
      res.status(500).json({ mesaj: 'Ödeme işlemi kaydedilemedi: ' + err.message });
    }
  });

  // 6. Dekont Yükleme (Kural 4)
  router.post('/teacher-payouts/:id/receipt', allow('superadmin'), receiptUpload.single('receipt'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ mesaj: 'Dekont dosyası seçilmedi.' });
      }

      const payout = await TeacherPayout.findById(req.params.id);
      if (!payout) {
        return res.status(404).json({ mesaj: 'Hakediş kaydı bulunamadı.' });
      }

      const fileUrl = `/uploads/payout-receipts/${req.file.filename}`;
      payout.receiptUrl = fileUrl;
      payout.receiptFileName = req.file.originalname;
      payout.receiptUploadedAt = new Date();
      payout.receiptUploadedBy = {
        adminId: req.adminUser._id.toString(),
        adminName: req.adminUser.name
      };

      // Dekont yüklenince durum otomatik 'odendi' olur ve kilitlenir
      payout.status = 'odendi';
      payout.isLocked = true;
      payout.paidAt = payout.paidAt || new Date();
      payout.paidBy = payout.paidBy?.adminId ? payout.paidBy : {
        adminId: req.adminUser._id.toString(),
        adminName: req.adminUser.name
      };

      await payout.save();

      // Kural 4: Öğretmene dekont bildirimi gönder
      try {
        await User.findByIdAndUpdate(payout.teacherId, {
          $push: {
            teacherNotifications: {
              title: '📄 Banka Dekontunuz Yüklendi',
              message: `${payout.periodLabel} dönemi hakediş ödemenize ait banka dekontu sisteme yüklenmiştir. Profilinizdeki Ödeme Geçmişi sekmesinden indirebilirsiniz.`,
              type: 'payment',
              receiptUrl: fileUrl,
              payoutId: payout._id.toString(),
              read: false,
              createdAt: new Date()
            }
          }
        });
      } catch (notifyErr) {
        console.warn('Teacher receipt notify error:', notifyErr.message);
      }

      // Kural 3: Audit log kaydı
      await audit(req, 'teacher_payout.receipt_uploaded', 'teacher_payout', payout._id.toString(), {
        teacherName: payout.teacherName,
        file: req.file.filename,
        netAmount: payout.netAmount
      });

      res.json({
        basarili: true,
        mesaj: `"${payout.teacherName}" dekontu başarıyla yüklendi ve ödeme kilitlendi.`,
        receiptUrl: fileUrl,
        payout
      });
    } catch (err) {
      console.error('Teacher receipt upload error:', err);
      res.status(500).json({ mesaj: 'Dekont yüklenemedi: ' + err.message });
    }
  });

  // 7. Toplu Onay ve Toplu Ödeme İşlemleri
  router.post('/teacher-payouts/batch-action', allow('superadmin'), async (req, res) => {
    try {
      const { action, ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ mesaj: 'İşlem yapılacak hakedişler seçilmedi.' });
      }

      if (!['approve', 'pay'].includes(action)) {
        return res.status(400).json({ mesaj: 'Geçersiz toplu işlem: ' + action });
      }

      const adminInfo = {
        adminId: req.adminUser._id.toString(),
        adminName: req.adminUser.name
      };

      let successCount = 0;
      for (const id of ids) {
        const payout = await TeacherPayout.findById(id);
        if (!payout) continue;

        if (action === 'approve') {
          if (!payout.isLocked) {
            payout.status = 'onaylandi';
            payout.approvedBy = { ...adminInfo, approvedAt: new Date() };
            await payout.save();
            await audit(req, 'teacher_payout.approved', 'teacher_payout', payout._id.toString(), {
              teacherName: payout.teacherName,
              netAmount: payout.netAmount
            });
            successCount++;
          }
        } else if (action === 'pay') {
          payout.status = 'odendi';
          payout.isLocked = true;
          payout.paidAt = new Date();
          payout.paidBy = adminInfo;
          if (!payout.approvedBy?.adminId) {
            payout.approvedBy = { ...adminInfo, approvedAt: new Date() };
          }
          await payout.save();

          // Öğretmene bildirim
          try {
            await User.findByIdAndUpdate(payout.teacherId, {
              $push: {
                teacherNotifications: {
                  title: '🎉 Hakediş Ödemeniz Yapıldı',
                  message: `${payout.periodLabel} dönemi ${payout.netAmount.toLocaleString('tr-TR')} ₺ tutarındaki ödemeniz banka hesabınıza havale edilmiştir.`,
                  type: 'payment',
                  payoutId: payout._id.toString(),
                  read: false,
                  createdAt: new Date()
                }
              }
            });
          } catch (nErr) {}

          await audit(req, 'teacher_payout.paid', 'teacher_payout', payout._id.toString(), {
            teacherName: payout.teacherName,
            netAmount: payout.netAmount,
            iban: payout.iban
          });
          successCount++;
        }
      }

      res.json({
        basarili: true,
        mesaj: `${successCount} öğretmenin hakedişi başarıyla ${action === 'approve' ? 'onaylandı' : 'ödendi ve kilitlendi'}.`,
        successCount
      });
    } catch (err) {
      console.error('Batch payout action error:', err);
      res.status(500).json({ mesaj: 'Toplu işlem başarısız: ' + err.message });
    }
  });

  // 8. Toplu Banka Excel/CSV Çıktısı (Kural 2)
  router.get('/teacher-payouts/export-eft', allow('superadmin'), async (req, res) => {
    try {
      const { period, ids } = req.query;
      const filter = {};
      if (period) filter.period = period;
      if (ids) {
        const idList = ids.split(',').filter(Boolean);
        if (idList.length > 0) filter._id = { $in: idList };
      }

      const records = await TeacherPayout.find(filter).sort({ teacherName: 1 }).lean();

      if (records.length === 0) {
        return res.status(404).json({ mesaj: 'Dışa aktarılacak hakediş kaydı bulunamadı.' });
      }

      // UTF-8 BOM ile Excel uyumluluğu
      let csv = '\uFEFF';
      // Banka Toplu EFT Formatı Başlıkları
      csv += 'Alıcı Adı Soyadı;IBAN;Ödenecek Net Tutar (TL);Para Birimi;Açıklama;Banka;Vergi Statüsü;Dönem;Durum\r\n';

      for (const p of records) {
        const name = (p.accountHolder || p.teacherName || '').replace(/;/g, ' ').trim();
        const iban = (p.iban || '').replace(/;/g, ' ').replace(/\s+/g, '').trim();
        const amount = Number(p.netAmount || 0).toFixed(2);
        const desc = (p.description || `${p.periodLabel} Ders Hakedişi`).replace(/;/g, ' ').trim();
        const bank = (p.bankName || 'Banka').replace(/;/g, ' ').trim();
        const taxLabel = p.taxType === 'bireysel' ? 'Bireysel (Stopajlı)' : 'Şirket (Faturalı)';
        const statusLabel = p.status === 'odendi' ? 'Ödendi' : p.status === 'onaylandi' ? 'Onaylandı' : 'Bekliyor';

        csv += `"${name}";"${iban}";${amount};TRY;"${desc}";"${bank}";"${taxLabel}";"${p.period}";"${statusLabel}"\r\n`;
      }

      const cleanPeriod = (period || 'Tum-Donemler').replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `ZarifCozum_Toplu_Banka_EFT_${cleanPeriod}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    } catch (err) {
      console.error('Export EFT error:', err);
      res.status(500).json({ mesaj: 'Banka EFT dosyası oluşturulamadı: ' + err.message });
    }
  });

  // 9. Hakediş İşlem Geçmişi (Audit Logs) (Kural 3)
  router.get('/teacher-payouts/audit-logs', allow('superadmin'), async (req, res) => {
    try {
      const logs = await AdminLog.find({ entityType: 'teacher_payout' })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json({
        basarili: true,
        logs: logs.map(l => ({
          id: l._id.toString(),
          actorName: l.actorName,
          action: l.action,
          details: l.details,
          entityId: l.entityId,
          createdAt: l.createdAt
        }))
      });
    } catch (err) {
      console.error('Payout audit logs error:', err);
      res.status(500).json({ mesaj: 'İşlem geçmişi alınamadı: ' + err.message });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
