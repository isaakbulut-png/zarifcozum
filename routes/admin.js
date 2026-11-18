const express = require('express');
const { ObjectId } = require('mongodb');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const { adminRoleOf, yetkiKontrolEt, PRIMARY_ADMIN_EMAIL } = require('../lib/admin-rbac');
const { validateImage } = require('../lib/resim-dogrula');
const { PLANS } = require('../lib/subscription-plans');
const { normalizeFaqQuestion } = require('../lib/faq-service');
const { sanitizeFaqHtml } = require('../lib/rich-content');
const SiteMediaTargets = require('../assets/site-media-targets');
const {createLocalMediaStorage} = require('../lib/site-media-storage');

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

  return router;
}

module.exports = { createAdminRouter };
