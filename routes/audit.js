const express = require('express');
const { ObjectId } = require('mongodb');
const AuditSubmission = require('../models/AuditSubmission');
const { auditContent } = require('../lib/content-auditor');

function createAuditRouter({ requireRole, AdminLog }) {
  const router = express.Router();

  // 1. Öğretmen: Soru veya Konu Setini 2 Katmanlı Denetime Gönder
  router.post('/submit', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const contentType = req.body?.contentType === 'lesson' ? 'lesson' : 'questions';
      const grade = Number(req.body?.grade) || 5;
      const topic = String(req.body?.topic || 'Matematik').trim().slice(0, 220);
      const title = String(req.body?.title || `${grade}. Sınıf — ${topic}`).trim().slice(0, 220);
      const items = Array.isArray(req.body?.items) ? req.body.items : [];

      if (!items.length) {
        return res.status(400).json({ mesaj: 'Denetime gönderilecek en az bir soru veya sayfa bulunmalıdır.' });
      }

      const report = await auditContent({ contentType, grade, topic, items });

      const user = req.session?.user || {};
      const doc = await AuditSubmission.create({
        contentType,
        grade,
        topic,
        title,
        submittedBy: String(user.id || user._id || 'teacher'),
        submittedByName: String(user.name || user.email || 'Öğretmen'),
        itemCount: items.length,
        payload: items.slice(0, 12),
        auditReport: report,
        adminStatus: 'pending'
      });

      res.status(201).json({
        success: true,
        submissionId: String(doc._id),
        report
      });
    } catch (err) {
      console.error('[ZarifDenetim] Denetim hatası:', err);
      res.status(500).json({ mesaj: err.message || 'Denetim çalıştırılamadı.' });
    }
  });

  // 2. Admin / Öğretmen: Denetim Kuyruğunu Listele
  router.get('/queue', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const user = req.session?.user || {};
      const isAdmin = user.role === 'admin';
      const status = String(req.query?.status || '').trim();
      const filter = isAdmin ? {} : { submittedBy: String(user.id || user._id || '') };
      if (['pending', 'approved', 'rejected'].includes(status)) {
        filter.adminStatus = status;
      }

      const list = await AuditSubmission.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      res.json({
        success: true,
        items: list.map(d => ({
          id: String(d._id),
          contentType: d.contentType,
          grade: d.grade,
          topic: d.topic,
          title: d.title,
          submittedByName: d.submittedByName,
          itemCount: d.itemCount,
          auditReport: d.auditReport,
          adminStatus: d.adminStatus,
          adminNote: d.adminNote || '',
          createdAt: d.createdAt,
          reviewedAt: d.reviewedAt
        }))
      });
    } catch (err) {
      res.status(500).json({ mesaj: 'Denetim kuyruğu alınamadı.' });
    }
  });

  // 3. Admin: Denetim Kaydını Onayla veya Reddet
  router.post('/:id/decision', requireRole('admin'), async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz denetim ID.' });
      const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
      const adminNote = String(req.body?.adminNote || '').trim().slice(0, 600);
      const user = req.session?.user || {};

      const updated = await AuditSubmission.findByIdAndUpdate(
        req.params.id,
        {
          adminStatus: decision,
          adminNote,
          reviewedBy: String(user.name || user.email || 'Admin'),
          reviewedAt: new Date()
        },
        { new: true }
      ).lean();

      if (!updated) return res.status(404).json({ mesaj: 'Denetim kaydı bulunamadı.' });

      if (AdminLog) {
        try {
          await AdminLog.create({
            actorId: String(user.id || user._id || 'admin'),
            actorName: String(user.name || 'Admin'),
            action: `audit.${decision}`,
            entityType: 'audit_submission',
            entityId: String(updated._id),
            details: { title: updated.title, score: updated.auditReport?.overallScore || 0, adminNote }
          });
        } catch (_) {}
      }

      res.json({ success: true, item: updated });
    } catch (err) {
      res.status(500).json({ mesaj: 'Karar kaydedilemedi.' });
    }
  });

  return router;
}

module.exports = createAuditRouter;
