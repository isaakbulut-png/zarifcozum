const express = require('express');
const YaziliProva = require('../models/YaziliProva');
const User = require('../models/User');
const { resolveUserPlan } = require('../middleware/aiQuota');
const { canStudentAccessGrade, getAllowedGradesForStudent } = require('../lib/konu-erisimi');

function createYaziliRouter({ requireRole } = {}) {
  const router = express.Router();

  const requireAuth = (req, res, next) => {
    const user = req.session?.user;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, mesaj: 'Oturum açmanız gerekmektedir.' });
    }
    next();
  };

  const requireStaff = (req, res, next) => {
    const user = req.session?.user;
    if (!user || !['admin', 'teacher'].includes(user.role)) {
      return res.status(403).json({ success: false, mesaj: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }
    next();
  };

  // 1. Öğrenci: Sınıfına ve Paketine Uygun Yazılı Provalarını Listele
  router.get('/', requireAuth, async (req, res) => {
    try {
      let user = req.session.user;
      if (user.role === 'admin' && req.query.previewUserId) {
        const previewTarget = await User.findById(req.query.previewUserId);
        if (previewTarget) user = previewTarget;
      }
      const { grade, donem } = req.query;
      const plan = resolveUserPlan(user);

      const filter = { published: true };

      // Sınıf filtresi ve yetkilendirmesi
      if (user.role === 'student') {
        const allowedGrades = getAllowedGradesForStudent(user);
        if (grade) {
          const reqGrade = parseInt(grade, 10);
          if (!allowedGrades.includes(reqGrade)) {
            return res.status(403).json({
              success: false,
              kod: 'GRADE_ACCESS_DENIED',
              mesaj: `${reqGrade}. sınıf yazılı provalarına erişim yetkiniz bulunmuyor.`
            });
          }
          filter.grade = reqGrade;
        } else {
          filter.grade = { $in: allowedGrades };
        }
      } else if (grade) {
        filter.grade = parseInt(grade, 10);
      }

      if (donem) {
        filter.donem = donem;
      }

      const provalar = await YaziliProva.find(filter)
        .select('title grade donem senaryoNo aciklama toplamPuan pdfUrl sorular published createdAt')
        .sort({ grade: 1, donem: 1, senaryoNo: 1 })
        .lean();

      // Öğrencinin dönemlik prova kullanım durumu
      let kullanilanProvaIds = [];
      if (user.role === 'student') {
        const userDoc = await User.findById(user.id).select('erisenYaziliProvalar').lean();
        kullanilanProvaIds = (userDoc?.erisenYaziliProvalar || []).map(p => p.yaziliId.toString());
      }

      const listesi = provalar.map(p => ({
        id: p._id.toString(),
        title: p.title,
        grade: p.grade,
        donem: p.donem,
        senaryoNo: p.senaryoNo || 1,
        aciklama: p.aciklama,
        toplamPuan: p.toplamPuan || 100,
        soruSayisi: Array.isArray(p.sorular) ? p.sorular.length : 0,
        pdfUrl: p.pdfUrl || null,
        erisimAcik: user.role !== 'student' || kullanilanProvaIds.includes(p._id.toString()),
        createdAt: p.createdAt
      }));

      const isRealAdmin = req.session.user?.role === 'admin' && !req.query.previewUserId;
      const donemlikLimit = (isRealAdmin || req.session.user?.role === 'teacher')
        ? 'sinirsiz'
        : (plan === 'vip' || plan === 'standart')
          ? 'sinirsiz'
          : (plan === 'temel' ? 2 : 0);

      res.json({
        success: true,
        mevcutPaket: isRealAdmin ? 'admin' : (req.session.user?.role === 'teacher' ? 'ogretmen' : plan),
        donemlikLimit,
        kullanilanHak: kullanilanProvaIds.length,
        provalar: listesi
      });
    } catch (error) {
      console.error('Yazılı provaları listelenirken hata:', error);
      res.status(500).json({ success: false, mesaj: 'Yazılı provaları alınamadı: ' + error.message });
    }
  });

  // 2. Admin / Öğretmen: Tüm Provaları Yönetim İçin Listele
  router.get('/admin/list', requireAuth, requireStaff, async (req, res) => {
    try {
      const provalar = await YaziliProva.find()
        .sort({ grade: 1, donem: 1, senaryoNo: 1 })
        .lean();

      res.json({
        success: true,
        provalar: provalar.map(p => ({
          ...p,
          id: p._id.toString(),
          soruSayisi: Array.isArray(p.sorular) ? p.sorular.length : 0
        }))
      });
    } catch (error) {
      res.status(500).json({ success: false, mesaj: error.message });
    }
  });

  // 3. Öğrenci / Öğretmen: Tekil Prova Detayı ve Soruları Görüntüle
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const user = req.session.user;
      const prova = await YaziliProva.findById(req.params.id);

      if (!prova) {
        return res.status(404).json({ success: false, mesaj: 'Yazılı provası bulunamadı.' });
      }

      // Öğrenci yetki ve kota kontrolü
      if (user.role === 'student') {
        if (!canStudentAccessGrade(user, prova.grade)) {
          return res.status(403).json({
            success: false,
            kod: 'GRADE_ACCESS_DENIED',
            mesaj: `${prova.grade}. sınıf yazılı provasına erişim yetkiniz bulunmamaktadır.`
          });
        }

        const plan = resolveUserPlan(user);
        if (plan === 'free') {
          return res.status(403).json({
            success: false,
            kod: 'YAZILI_UPGRADE_REQUIRED',
            mesaj: 'MEB açık uçlu yazılı provaları Temel, Standart ve VIP paketlerimize özeldir. Lütfen paketinizi yükseltin.'
          });
        }

        // Temel paket kontrolü (Dönemlik 2 prova sınırı)
        if (plan === 'temel') {
          const userDoc = await User.findById(user.id);
          const erisenler = userDoc?.erisenYaziliProvalar || [];
          const buProvaninKaydi = erisenler.find(e => e.yaziliId.toString() === prova._id.toString());

          if (!buProvaninKaydi) {
            // Bu dönemde kaç farklı prova çözmüş?
            const buDonemCozulenler = erisenler.filter(e => e.donem === prova.donem);
            if (buDonemCozulenler.length >= 2) {
              return res.status(403).json({
                success: false,
                kod: 'YAZILI_LIMIT_EXCEEDED',
                mesaj: `Temel pakette dönemlik 2 prova çözme hakkınız bulunmaktadır (${prova.donem} için 2 prova hakkınızı kullandınız). Tüm sınav dönemlerinde sınırsız yazılı provaları ve çözümlü etütler için Standart veya VIP pakete geçebilirsiniz.`
              });
            }

            // Hakkı var, bu provayı kaydet
            await User.updateOne(
              { _id: user.id },
              {
                $push: {
                  erisenYaziliProvalar: {
                    yaziliId: prova._id,
                    donem: prova.donem,
                    erisimTarihi: new Date()
                  }
                }
              }
            );
          }
        }
      }

      res.json({
        success: true,
        prova: {
          id: prova._id.toString(),
          title: prova.title,
          grade: prova.grade,
          donem: prova.donem,
          senaryoNo: prova.senaryoNo,
          aciklama: prova.aciklama,
          toplamPuan: prova.toplamPuan,
          pdfUrl: prova.pdfUrl,
          sorular: prova.sorular || []
        }
      });
    } catch (error) {
      console.error('Yazılı provası detayı alınamadı:', error);
      res.status(500).json({ success: false, mesaj: 'Prova detayları yüklenemedi: ' + error.message });
    }
  });

  // 4. Admin / Öğretmen: Yeni Yazılı Provası Ekle
  router.post('/', requireAuth, requireStaff, async (req, res) => {
    try {
      const { title, grade, donem, senaryoNo, aciklama, sorular, toplamPuan, pdfUrl, published } = req.body;

      if (!title || !grade || !donem) {
        return res.status(400).json({ success: false, mesaj: 'Başlık, sınıf (5-12) ve dönem zorunludur.' });
      }

      const prova = await YaziliProva.create({
        title: String(title).trim(),
        grade: Number(grade),
        donem,
        senaryoNo: Number(senaryoNo) || 1,
        aciklama: aciklama ? String(aciklama).trim() : undefined,
        sorular: Array.isArray(sorular) ? sorular : [],
        toplamPuan: Number(toplamPuan) || 100,
        pdfUrl: pdfUrl || null,
        published: published !== undefined ? Boolean(published) : true,
        createdBy: req.session.user.id
      });

      res.status(201).json({
        success: true,
        mesaj: 'Yazılı provası başarıyla oluşturuldu.',
        prova: {
          id: prova._id.toString(),
          title: prova.title,
          grade: prova.grade,
          donem: prova.donem
        }
      });
    } catch (error) {
      console.error('Yazılı prova ekleme hatası:', error);
      res.status(500).json({ success: false, mesaj: 'Yazılı provası eklenemedi: ' + error.message });
    }
  });

  // 5. Admin / Öğretmen: Yazılı Provası Güncelle
  router.put('/:id', requireAuth, requireStaff, async (req, res) => {
    try {
      const { title, grade, donem, senaryoNo, aciklama, sorular, toplamPuan, pdfUrl, published } = req.body;

      const updateData = {};
      if (title !== undefined) updateData.title = String(title).trim();
      if (grade !== undefined) updateData.grade = Number(grade);
      if (donem !== undefined) updateData.donem = donem;
      if (senaryoNo !== undefined) updateData.senaryoNo = Number(senaryoNo);
      if (aciklama !== undefined) updateData.aciklama = String(aciklama).trim();
      if (sorular !== undefined) updateData.sorular = Array.isArray(sorular) ? sorular : [];
      if (toplamPuan !== undefined) updateData.toplamPuan = Number(toplamPuan);
      if (pdfUrl !== undefined) updateData.pdfUrl = pdfUrl;
      if (published !== undefined) updateData.published = Boolean(published);

      const prova = await YaziliProva.findByIdAndUpdate(req.params.id, updateData, { new: true });
      if (!prova) {
        return res.status(404).json({ success: false, mesaj: 'Yazılı provası bulunamadı.' });
      }

      res.json({
        success: true,
        mesaj: 'Yazılı provası güncellendi.',
        prova
      });
    } catch (error) {
      res.status(500).json({ success: false, mesaj: 'Güncelleme başarısız: ' + error.message });
    }
  });

  // 6. Admin / Öğretmen: Yazılı Provası Sil
  router.delete('/:id', requireAuth, requireStaff, async (req, res) => {
    try {
      const silinen = await YaziliProva.findByIdAndDelete(req.params.id);
      if (!silinen) {
        return res.status(404).json({ success: false, mesaj: 'Yazılı provası bulunamadı.' });
      }
      res.json({ success: true, mesaj: 'Yazılı provası başarıyla silindi.' });
    } catch (error) {
      res.status(500).json({ success: false, mesaj: 'Silme işlemi başarısız: ' + error.message });
    }
  });

  return router;
}

module.exports = { createYaziliRouter };
