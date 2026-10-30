const express = require('express');
const { ObjectId } = require('mongodb');

const PAGE_SIZE = 25;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createAdminRouter({ requireAdmin, User, Payment, getAnnouncementCollection }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/overview', async (req, res) => {
    try {
      const [students, teachers, admins, activeSubs, paidPayments, pendingPayments, announcements] =
        await Promise.all([
          User.countDocuments({ role: 'student' }),
          User.countDocuments({ role: 'teacher' }),
          User.countDocuments({ role: 'admin' }),
          User.countDocuments({ subscriptionStatus: 'active' }),
          Payment.countDocuments({ status: 'paid' }),
          Payment.countDocuments({ status: 'pending' }),
          getAnnouncementCollection().countDocuments({})
        ]);
      res.json({ students, teachers, admins, activeSubs, paidPayments, pendingPayments, announcements });
    } catch (error) {
      console.error('Yönetici özeti alınamadı:', error);
      res.status(500).json({ mesaj: 'Özet verileri alınamadı.' });
    }
  });

  router.get('/users', async (req, res) => {
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
          .select('name email role subscriptionStatus subscriptionType expiresAt createdAt')
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
          subscriptionStatus: user.subscriptionStatus,
          subscriptionType: user.subscriptionType,
          expiresAt: user.expiresAt,
          createdAt: user.createdAt
        }))
      });
    } catch (error) {
      console.error('Kullanıcılar alınamadı:', error);
      res.status(500).json({ mesaj: 'Kullanıcılar alınamadı.' });
    }
  });

  router.get('/payments', async (req, res) => {
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

  router.get('/announcements', async (req, res) => {
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

  router.post('/announcements', async (req, res) => {
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

  router.delete('/announcements/:id', async (req, res) => {
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

  return router;
}

module.exports = { createAdminRouter };
