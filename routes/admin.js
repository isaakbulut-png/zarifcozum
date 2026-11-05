const express = require('express');
const { ObjectId } = require('mongodb');
const { adminRoleOf, yetkiKontrolEt } = require('../lib/admin-rbac');

const PAGE_SIZE = 25;
const VISITOR_SETTING_FIELDS = new Set([
  'questionLimit',
  'topicLimit',
  'trialDurationDays',
  'summaryEnabled',
  'practiceEnabled',
  'assistantEnabled',
  'fullTestEnabled'
]);
const VISITOR_SETTING_RANGES = {
  questionLimit: [0, 500],
  topicLimit: [0, 100],
  trialDurationDays: [1, 3650]
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createAdminRouter({
  User, Payment, SystemConfig, AdminLog,
  getAnnouncementCollection, getQuizCollection, getLessonCollection, getSupportTicketCollection
}) {
  const router = express.Router();
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
          .select('name email role adminRole subscriptionStatus subscriptionType expiresAt createdAt')
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
          ...(req.adminRole === 'superadmin' && {
            subscriptionStatus: user.subscriptionStatus,
            subscriptionType: user.subscriptionType,
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
