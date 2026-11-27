const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { konuVarMi } = require('../lib/mufredat');
const { DEFAULT_VISITOR_SETTINGS } = require('../models/SystemConfig');
const { requireKonuLogin } = require('../lib/konu-erisimi');

const OZELLIKLER = ['asistan', 'test', 'kazanim', 'konu'];
const UYE_SORU_SAYILARI = [5, 10, 20];
const ZIYARETCI_CEREZI = 'zc_ziyaretci';
const UYELIK_ADRESI = '/Paketler.html';
const UYELIK_GEREKLI_MESAJI = 'Sınırınıza ulaştınız, devam etmek için lütfen üye girişi yapın.';
const birGunMs = 24 * 60 * 60 * 1000;

function haklariEsle(settings) {
  return {
    soru: settings.questionLimit,
    konu: settings.topicLimit,
    denemeSuresiGun: settings.trialDurationDays,
    ozetGorebilir: settings.summaryEnabled,
    test: settings.practiceEnabled,
    asistan: settings.assistantEnabled,
    kazanim: settings.fullTestEnabled
  };
}

function cerezOku(req, ad) {
  const eslesme = String(req.headers.cookie || '').split(';').map(parca => parca.trim())
    .find(parca => parca.startsWith(`${ad}=`));
  return eslesme ? eslesme.slice(ad.length + 1) : '';
}

function sarmala(isleyici) {
  return (req, res, next) => Promise.resolve(isleyici(req, res, next)).catch(next);
}

function createPratikRouter({
  getUsageCollection,
  getContentCollection,
  mufredat,
  uyeMi,
  ozellikErisimi = async () => null,
  soruUret,
  konuUret,
  mufredatKonusuVarMi = async () => false,
  getVisitorSettings = async () => DEFAULT_VISITOR_SETTINGS,
  limitleyici = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { mesaj: 'Çok fazla istek gönderildi. Biraz sonra tekrar deneyin.' }
  })
}) {
  const router = express.Router();
  const uretimde = new Map();

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(limitleyici);

  function kimlik(req, res, denemeSuresiGun) {
    const kullanici = req.session?.user;
    if (kullanici?.id) return { anahtar: `u:${kullanici.id}`, girisYapti: true, kullanici };
    let ziyaretci = cerezOku(req, ZIYARETCI_CEREZI);
    if (!/^[a-f0-9]{32}$/.test(ziyaretci)) ziyaretci = crypto.randomBytes(16).toString('hex');
    res.cookie(ZIYARETCI_CEREZI, ziyaretci, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: denemeSuresiGun * birGunMs,
      path: '/'
    });
    return { anahtar: `a:${ziyaretci}`, girisYapti: false, kullanici: null };
  }

  async function kullanimKaydi(anahtar, ozellik, denemeSuresiGun) {
    const collection = getUsageCollection();
    const filtre = { key: anahtar, ozellik };
    const kayit = await collection.findOne(filtre);
    if (!kayit) return null;
    const konuTarihi = kayit.konular?.find(konu => konu.at)?.at;
    const baslangic = kayit.createdAt || konuTarihi;
    const expiresAt = baslangic
      ? new Date(new Date(baslangic).getTime() + denemeSuresiGun * birGunMs)
      : kayit.expiresAt;
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      await collection.deleteOne(filtre);
      return null;
    }
    if (expiresAt && new Date(expiresAt).getTime() !== new Date(kayit.expiresAt).getTime()) {
      await collection.updateOne(filtre, { $set: { expiresAt } });
    }
    return kayit;
  }

  async function kullanilanKonular(anahtar, ozellik, haklar) {
    const kayit = await kullanimKaydi(anahtar, ozellik, haklar.denemeSuresiGun);
    return kayit?.konular || [];
  }

  function yasakYaniti(res, girisYapti, mesaj = UYELIK_GEREKLI_MESAJI, karar = null) {
    if (karar && !karar.izin) {
      return res.status(karar.mevcutPlan ? 403 : 402).json({
        kod: karar.mevcutPlan ? 'PLAN_UPGRADE_REQUIRED' : 'SUBSCRIPTION_REQUIRED',
        mesaj: karar.mevcutPlan
          ? 'Bu özellik için paketinizi yükseltmeniz gerekir.'
          : 'Bu özellik için aktif aboneliğiniz olmalıdır.',
        gerekliPlan: karar.gerekliPlan,
        mevcutPlan: karar.mevcutPlan,
        yonlendir: UYELIK_ADRESI,
        girisYapti
      });
    }
    return res.status(403).json({
      kod: 'UYELIK_GEREKLI',
      mesaj,
      yonlendir: UYELIK_ADRESI,
      girisYapti
    });
  }

  async function kullanilanSoruSayisi(anahtar, haklar) {
    const kayit = await kullanimKaydi(anahtar, 'sorular', haklar.denemeSuresiGun);
    return kayit?.soruSayisi || 0;
  }

  async function soruHakkiKullan(anahtar, adet, haklar) {
    try {
      const sonuc = await getUsageCollection().updateOne(
        {
          key: anahtar,
          ozellik: 'sorular',
          soruSayisi: { $lte: haklar.soru - adet },
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
        },
        {
          $inc: { soruSayisi: adet },
          $setOnInsert: {
            key: anahtar,
            ozellik: 'sorular',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + haklar.denemeSuresiGun * birGunMs)
          }
        },
        { upsert: true }
      );
      return sonuc.matchedCount === 1 || sonuc.upsertedCount === 1;
    } catch (error) {
      if (error?.code === 11000) return false;
      throw error;
    }
  }

  async function soruHakkiIadeEt(anahtar, adet) {
    await getUsageCollection().updateOne(
      { key: anahtar, ozellik: 'sorular' },
      { $inc: { soruSayisi: -adet } }
    );
  }

  async function icerikGetir(tur, sinif, konu, adet, uret) {
    const filtre = { tur, sinif, konu, adet };
    const kayit = await getContentCollection().findOne(filtre);
    if (kayit) return kayit.icerik;

    const anahtar = JSON.stringify(filtre);
    if (!uretimde.has(anahtar)) {
      uretimde.set(anahtar, (async () => {
        const icerik = await uret();
        await getContentCollection().updateOne(filtre, { $setOnInsert: { ...filtre, icerik, createdAt: new Date() } }, { upsert: true });
        return icerik;
      })().finally(() => uretimde.delete(anahtar)));
    }
    return uretimde.get(anahtar);
  }

  async function hakKullan(anahtar, ozellik, sinif, konu, haklar) {
    const onceki = await kullanilanKonular(anahtar, ozellik, haklar);
    if (onceki.some(oge => oge.sinif === sinif && oge.konu === konu)) return true;
    try {
      await getUsageCollection().updateOne(
        {
          key: anahtar,
          ozellik,
          [`konular.${haklar.konu - 1}`]: { $exists: false },
          konular: { $not: { $elemMatch: { sinif, konu } } },
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
        },
        {
          $push: { konular: { sinif, konu, at: new Date() } },
          $setOnInsert: {
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + haklar.denemeSuresiGun * birGunMs)
          }
        },
        { upsert: true }
      );
      return true;
    } catch (error) {
      if (error?.code === 11000) return false;
      throw error;
    }
  }

  function istekDogrula(govde) {
    const sinif = Number(govde?.sinif);
    const konu = typeof govde?.konu === 'string' ? govde.konu : '';
    if (!Number.isInteger(sinif) || !konuVarMi(mufredat, sinif, konu)) return null;
    return { sinif, konu };
  }

  async function konuIcinIstekDogrula(govde) {
    const secim = istekDogrula(govde);
    if (secim) return secim;

    const sinif = Number(govde?.sinif);
    const konu = typeof govde?.konu === 'string' ? govde.konu : '';
    if (!Number.isInteger(sinif) || sinif < 5 || sinif > 12 || !konu.trim()) return null;
    return await mufredatKonusuVarMi(sinif, konu) ? { sinif, konu } : null;
  }

  async function erisim(req, res, ozellik, sinif, konu, haklar) {
    const kim = kimlik(req, res, haklar.denemeSuresiGun);
    const uye = kim.girisYapti && Boolean(await uyeMi(kim.kullanici));
    const karar = kim.girisYapti ? await ozellikErisimi(kim.kullanici, ozellik) : null;
    if (karar && !karar.izin) return { kim, uye, limitYok: false, izin: false, karar };
    const limitYok = kim.girisYapti && (karar ? karar.limitYok : uye);
    if (limitYok) return { kim, uye, limitYok, izin: true };
    const ziyaretciIzinli = karar ? true : ozellik === 'konu'
      ? haklar.ozetGorebilir
      : Boolean(haklar[ozellik]);
    if (!ziyaretciIzinli) return { kim, uye, limitYok, izin: false };
    const kullanilan = await kullanilanKonular(kim.anahtar, ozellik, haklar);
    const mevcut = kullanilan.some(oge => oge.sinif === sinif && oge.konu === konu);
    return { kim, uye, limitYok, izin: mevcut || kullanilan.length < haklar.konu };
  }

  // Öğretmenin sepetten 4 Maarif modülüne (sınıf veya belirli öğrenciler için) yayınladığı testler
  router.post('/maarif-yayinla', sarmala(async (req, res) => {
    const user = req.session?.user;
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ mesaj: 'Bu işlem için öğretmen yetkisi gerekir.' });
    }
    const ContentLibrary = require('../models/ContentLibrary');
    const grade = Number(req.body?.grade) || 5;
    const workType = String(req.body?.workType || 'coktan_secmeli').trim();
    const workTypeLabel = String(req.body?.workTypeLabel || 'Öğrenme Çıktısı Testi').trim();
    const title = String(req.body?.title || `${grade}. Sınıf ${workTypeLabel}`).trim().slice(0, 180);
    const topicTitle = String(req.body?.topicTitle || title).trim().slice(0, 180);
    const targetStudentIds = Array.isArray(req.body?.targetStudentIds)
      ? req.body.targetStudentIds.map(id => String(id).trim()).filter(Boolean)
      : [];
    const targetStudentNames = Array.isArray(req.body?.targetStudentNames)
      ? req.body.targetStudentNames.map(n => String(n).trim()).filter(Boolean)
      : [];
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!questions.length) {
      return res.status(400).json({ mesaj: 'Yayınlanacak en az bir soru bulunmalıdır.' });
    }

    const doc = await ContentLibrary.create({
      title,
      type: 'maarif_published_test',
      ders: 'matematik',
      grade,
      topic: topicTitle,
      difficulty: String(req.body?.difficulty || 'orta').toLowerCase(),
      content: {
        title,
        topicTitle,
        grade,
        workType,
        workTypeLabel,
        targetStudentIds,
        targetStudentNames,
        questions,
        publishedAt: new Date().toISOString()
      },
      status: 'approved',
      source: 'teacher_published',
      createdBy: String(user.id || user._id || 'teacher')
    });

    res.status(201).json({
      success: true,
      id: String(doc._id),
      mesaj: `${title} başarıyla yayınlandı.`
    });
  }));

  router.get('/maarif-yayinlar', sarmala(async (req, res) => {
    const sinif = Number(req.query?.sinif);
    const workType = String(req.query?.workType || '').trim();
    const ContentLibrary = require('../models/ContentLibrary');
    const filter = { type: 'maarif_published_test', status: 'approved' };
    if (Number.isInteger(sinif) && sinif >= 5 && sinif <= 12) {
      filter.grade = sinif;
    }

    const docs = await ContentLibrary.find(filter)
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    const user = req.session?.user;
    const isStudent = user && user.role === 'student';
    const studentId = isStudent ? String(user.id || user._id || '') : '';

    const items = docs
      .map(d => {
        const c = (d.content && typeof d.content === 'object') ? d.content : {};
        return {
          id: String(d._id),
          title: c.title || d.title || 'Maarif Çalışması',
          topicTitle: c.topicTitle || d.topic || d.title || 'Genel',
          grade: Number(c.grade || d.grade) || 5,
          workType: c.workType || 'coktan_secmeli',
          workTypeLabel: c.workTypeLabel || 'Öğrenme Çıktısı Testi',
          targetStudentIds: Array.isArray(c.targetStudentIds) ? c.targetStudentIds : [],
          targetStudentNames: Array.isArray(c.targetStudentNames) ? c.targetStudentNames : [],
          questions: Array.isArray(c.questions) ? c.questions : [],
          questionCount: Array.isArray(c.questions) ? c.questions.length : 0,
          status: 'published',
          createdAt: d.createdAt
        };
      })
      .filter(it => {
        if (workType && it.workType !== workType) return false;
        if (isStudent && it.targetStudentIds.length > 0) {
          return it.targetStudentIds.includes(studentId);
        }
        return true;
      });

    res.json({ success: true, items, studentId });
  }));

  router.get('/konular', sarmala(async (req, res) => {
    const sinif = Number(req.query?.sinif);
    if (!Number.isInteger(sinif) || sinif < 5 || sinif > 12) {
      return res.json({ success: true, konular: [] });
    }
    const Soru = require('../models/Soru');
    const docs = await Soru.find({ grade: sinif })
      .select('topic questionType')
      .lean();

    const counts = new Map();
    const bump = (name) => {
      const clean = String(name || '').trim();
      if (!clean) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    };

    docs.forEach(d => {
      const raw = String(d.topic || '').trim();
      if (!raw) return;
      bump(raw);
      // "1. Tema: Geometrik Şekiller > Açıları Ölçme" gibi alt konu kayıtlarını ana temaya da say
      const parent = raw.split(/\s*(?:>|—| - )\s*/)[0].trim();
      if (parent && parent !== raw) {
        bump(parent);
      }
    });

    const konular = Array.from(counts.entries())
      .map(([konu, soruSayisi]) => ({ konu, title: konu, soruSayisi, count: soruSayisi }))
      .sort((a, b) => b.soruSayisi - a.soruSayisi);

    res.json({ success: true, konular });
  }));

  router.get('/sorular', sarmala(async (req, res) => {
    const sinif = Number(req.query?.sinif);
    const konu = String(req.query?.konu || '').trim();
    if (!Number.isInteger(sinif) || sinif < 5 || sinif > 12) {
      return res.json({ success: true, sorular: [] });
    }
    const Soru = require('../models/Soru');
    const filter = { grade: sinif };
    if (konu) {
      const escaped = konu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const strippedTheme = konu.replace(/^\d+\.\s*Tema:\s*/i, '').trim();
      const escapedStripped = strippedTheme ? strippedTheme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
      filter.$or = [
        { topic: { $regex: escaped, $options: 'i' } },
        ...(escapedStripped && escapedStripped !== escaped
          ? [{ topic: { $regex: escapedStripped, $options: 'i' } }]
          : [])
      ];
    }
    const docs = await Soru.find(filter)
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const sorular = docs.map(d => {
      let optsObj = {};
      if (Array.isArray(d.options)) {
        d.options.forEach(o => {
          if (o && o.label) optsObj[String(o.label).toUpperCase()] = String(o.text || '');
        });
      } else if (d.options && typeof d.options === 'object') {
        optsObj = d.options;
      }
      return {
        id: String(d._id),
        text: d.text || '',
        options: optsObj,
        answer: d.answer || 'A',
        explanation: d.explanation || d.solution || '',
        solution: d.solution || d.explanation || '',
        rubric: Array.isArray(d.rubric) ? d.rubric : [],
        svg: typeof d.svg === 'string' ? d.svg : '',
        imageUrl: d.imageUrl || '',
        outcomeCode: d.outcomeCode || '',
        questionType: d.questionType || 'multiple_choice',
        topic: d.topic || konu,
        difficulty: d.difficulty || 'orta'
      };
    });

    res.json({ success: true, sorular });
  }));

  router.get('/durum', sarmala(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const haklar = haklariEsle(await getVisitorSettings());
    const kim = kimlik(req, res, haklar.denemeSuresiGun);
    const uye = kim.girisYapti && Boolean(await uyeMi(kim.kullanici));
    const kararlar = {};
    for (const ozellik of OZELLIKLER) {
      kararlar[ozellik] = kim.girisYapti ? await ozellikErisimi(kim.kullanici, ozellik) : null;
    }
    const sinirYok = ozellik => kim.girisYapti &&
      (kararlar[ozellik] ? kararlar[ozellik].limitYok : uye);
    const limitYok = sinirYok('test');
    const soruKullanilan = limitYok ? 0 : await kullanilanSoruSayisi(kim.anahtar, haklar);
    const ozellikler = {};
    for (const ozellik of OZELLIKLER) {
      const karar = kararlar[ozellik];
      const ozellikLimitYok = sinirYok(ozellik);
      const kullanilan = ozellikLimitYok ? [] : await kullanilanKonular(kim.anahtar, ozellik, haklar);
      ozellikler[ozellik] = {
        kullanilan: kullanilan.map(({ sinif, konu }) => ({ sinif, konu })),
        kalan: ozellikLimitYok ? null : Math.max(haklar.konu - kullanilan.length, 0),
        acik: karar ? karar.izin : ozellikLimitYok ||
          (ozellik === 'konu' ? kim.girisYapti && haklar.ozetGorebilir : Boolean(haklar[ozellik])),
        ...(karar && !karar.izin && { gerekliPlan: karar.gerekliPlan })
      };
    }
    res.json({
      uye,
      limitYok,
      girisYapti: kim.girisYapti,
      limitler: { konu: haklar.konu, soru: haklar.soru },
      ziyaretciHaklari: {
        soru: {
          limit: haklar.soru,
          kullanilan: soruKullanilan,
          kalan: limitYok ? null : Math.max(haklar.soru - soruKullanilan, 0)
        },
        ozetGorebilir: kim.girisYapti && haklar.ozetGorebilir,
        kazanimTestiAcik: haklar.kazanim
      },
      uyelikAdresi: UYELIK_ADRESI,
      ozellikler
    });
  }));

  router.post('/sorular', sarmala(async (req, res) => {
    const haklar = haklariEsle(await getVisitorSettings());
    const ozellik = req.body?.ozellik;
    const secim = istekDogrula(req.body);
    if (!['asistan', 'test', 'kazanim'].includes(ozellik) || !secim) {
      return res.status(400).json({ mesaj: 'Sınıf veya konu seçimi geçersiz.' });
    }
    const { sinif, konu } = secim;
    const { kim, uye, limitYok, izin, karar } = await erisim(req, res, ozellik, sinif, konu, haklar);
    if (!izin) return yasakYaniti(res, kim.girisYapti, undefined, karar);

    const istenen = Number(req.body?.adet);
    const soruKullanilan = limitYok ? 0 : await kullanilanSoruSayisi(kim.anahtar, haklar);
    const soruKalan = limitYok ? null : Math.max(haklar.soru - soruKullanilan, 0);
    if (!limitYok && soruKalan === 0) return yasakYaniti(res, kim.girisYapti);
    const adet = limitYok
      ? (UYE_SORU_SAYILARI.includes(istenen) ? istenen : Math.max(...UYE_SORU_SAYILARI))
      : Math.min(soruKalan, haklar.soru);
    let sorular;
    try {
      sorular = await icerikGetir('sorular', sinif, konu, adet, () => soruUret({ sinif, konu, adet }));
    } catch (error) {
      return res.status(error.status || 502).json({ mesaj: error.message || 'Sorular hazırlanamadı.' });
    }
    if (!limitYok && !(await soruHakkiKullan(kim.anahtar, adet, haklar))) return yasakYaniti(res, kim.girisYapti);
    if (!limitYok && !(await hakKullan(kim.anahtar, ozellik, sinif, konu, haklar))) {
      await soruHakkiIadeEt(kim.anahtar, adet);
      return yasakYaniti(res, kim.girisYapti);
    }

    const kullanilan = limitYok ? null : (await kullanilanKonular(kim.anahtar, ozellik, haklar)).length;
    const guncelSoruSayisi = limitYok ? null : await kullanilanSoruSayisi(kim.anahtar, haklar);
    res.json({
      sorular,
      uye,
      limitYok,
      kalan: limitYok ? null : Math.max(haklar.konu - kullanilan, 0),
      soruHakki: limitYok ? null : Math.max(haklar.soru - guncelSoruSayisi, 0)
    });
  }));

  router.post('/konu', requireKonuLogin, sarmala(async (req, res) => {
    const haklar = haklariEsle(await getVisitorSettings());
    const secim = await konuIcinIstekDogrula(req.body);
    if (!secim) return res.status(400).json({ mesaj: 'Sınıf veya konu seçimi geçersiz.' });
    const { sinif, konu } = secim;
    const { kim, uye, limitYok, izin, karar } = await erisim(req, res, 'konu', sinif, konu, haklar);
    if (!izin) return yasakYaniti(res, kim.girisYapti, undefined, karar);

    let anlatim;
    try {
      // 1. Önce Maarif Modeli yayınlanmış zengin içerik havuzunu (CurriculumContent) kontrol et
      const CurriculumContent = require('../models/CurriculumContent');
      const published = await CurriculumContent.findOne({
        grade: sinif,
        sub_topic: konu,
        status: 'published'
      }).lean();

      if (published && published.detailed_content) {
        anlatim = published.detailed_content;
      } else {
        anlatim = await icerikGetir('konu-slides-v4', sinif, konu, 0, () => konuUret({ sinif, konu }));
      }
    } catch (error) {
      return res.status(error.status || 502).json({ mesaj: error.message || 'Konu anlatımı hazırlanamadı.' });
    }
    if (!limitYok && !(await hakKullan(kim.anahtar, 'konu', sinif, konu, haklar))) return yasakYaniti(res, kim.girisYapti);

    const kullanilan = limitYok ? null : (await kullanilanKonular(kim.anahtar, 'konu', haklar)).length;
    res.json({
      sinif,
      konu,
      anlatim,
      uye,
      limitYok,
      kalan: limitYok ? null : Math.max(haklar.konu - kullanilan, 0)
    });
  }));

  return router;
}

module.exports = {
  createPratikRouter
};
