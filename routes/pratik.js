const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { konuVarMi } = require('../lib/mufredat');

const OZELLIKLER = ['asistan', 'test', 'kazanim', 'konu'];
const UCRETSIZ_KONU_SINIRI = 3;
const UCRETSIZ_SORU_SAYISI = 5;
const UYE_SORU_SAYILARI = [5, 10, 20];
const ZIYARETCI_CEREZI = 'zc_ziyaretci';
const UYELIK_ADRESI = '/Paketler.html';

function cerezOku(req, ad) {
  const eslesme = String(req.headers.cookie || '').split(';').map(parca => parca.trim())
    .find(parca => parca.startsWith(`${ad}=`));
  return eslesme ? decodeURIComponent(eslesme.slice(ad.length + 1)) : '';
}

function sarmala(isleyici) {
  return (req, res, next) => Promise.resolve(isleyici(req, res, next)).catch(next);
}

function createPratikRouter({
  getUsageCollection,
  getContentCollection,
  mufredat,
  uyeMi,
  soruUret,
  konuUret,
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

  router.use(limitleyici);

  function kimlik(req, res) {
    const kullanici = req.session?.user;
    if (kullanici?.id) return { anahtar: `u:${kullanici.id}`, girisYapti: true, kullanici };
    let ziyaretci = cerezOku(req, ZIYARETCI_CEREZI);
    if (!/^[a-f0-9]{32}$/.test(ziyaretci)) {
      ziyaretci = crypto.randomBytes(16).toString('hex');
      res.cookie(ZIYARETCI_CEREZI, ziyaretci, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/'
      });
    }
    return { anahtar: `a:${ziyaretci}`, girisYapti: false, kullanici: null };
  }

  async function kullanilanKonular(anahtar, ozellik) {
    const kayit = await getUsageCollection().findOne({ key: anahtar, ozellik });
    return kayit?.konular || [];
  }

  function yasakYaniti(res, girisYapti) {
    return res.status(403).json({
      kod: 'UYELIK_GEREKLI',
      mesaj: `Ücretsiz deneme hakkın doldu (${UCRETSIZ_KONU_SINIRI} konu). Sınırsız erişim için üyelik paketlerini incele.`,
      yonlendir: UYELIK_ADRESI,
      girisYapti
    });
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

  async function hakKullan(anahtar, ozellik, sinif, konu) {
    const onceki = await kullanilanKonular(anahtar, ozellik);
    if (onceki.some(oge => oge.sinif === sinif && oge.konu === konu)) return true;
    try {
      await getUsageCollection().updateOne(
        {
          key: anahtar,
          ozellik,
          [`konular.${UCRETSIZ_KONU_SINIRI - 1}`]: { $exists: false },
          konular: { $not: { $elemMatch: { sinif, konu } } }
        },
        { $push: { konular: { sinif, konu, at: new Date() } } },
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

  async function erisim(req, res, ozellik, sinif, konu) {
    const kim = kimlik(req, res);
    const uye = await uyeMi(kim.kullanici);
    if (uye) return { kim, uye, izin: true };
    const kullanilan = await kullanilanKonular(kim.anahtar, ozellik);
    const mevcut = kullanilan.some(oge => oge.sinif === sinif && oge.konu === konu);
    return { kim, uye, izin: mevcut || kullanilan.length < UCRETSIZ_KONU_SINIRI };
  }

  router.get('/durum', sarmala(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const kim = kimlik(req, res);
    const uye = await uyeMi(kim.kullanici);
    const ozellikler = {};
    for (const ozellik of OZELLIKLER) {
      const kullanilan = uye ? [] : await kullanilanKonular(kim.anahtar, ozellik);
      ozellikler[ozellik] = {
        kullanilan: kullanilan.map(({ sinif, konu }) => ({ sinif, konu })),
        kalan: uye ? null : Math.max(UCRETSIZ_KONU_SINIRI - kullanilan.length, 0)
      };
    }
    res.json({
      uye,
      girisYapti: kim.girisYapti,
      limitler: { konu: UCRETSIZ_KONU_SINIRI, soru: UCRETSIZ_SORU_SAYISI },
      uyelikAdresi: UYELIK_ADRESI,
      ozellikler
    });
  }));

  router.post('/sorular', sarmala(async (req, res) => {
    const ozellik = req.body?.ozellik;
    const secim = istekDogrula(req.body);
    if (!['asistan', 'test', 'kazanim'].includes(ozellik) || !secim) {
      return res.status(400).json({ mesaj: 'Sınıf veya konu seçimi geçersiz.' });
    }
    const { sinif, konu } = secim;
    const { kim, uye, izin } = await erisim(req, res, ozellik, sinif, konu);
    if (!izin) return yasakYaniti(res, kim.girisYapti);

    const istenen = Number(req.body?.adet);
    const adet = uye
      ? (UYE_SORU_SAYILARI.includes(istenen) ? istenen : Math.max(...UYE_SORU_SAYILARI))
      : UCRETSIZ_SORU_SAYISI;
    let sorular;
    try {
      sorular = await icerikGetir('sorular', sinif, konu, adet, () => soruUret({ sinif, konu, adet }));
    } catch (error) {
      return res.status(error.status || 502).json({ mesaj: error.message || 'Sorular hazırlanamadı.' });
    }
    if (!uye && !(await hakKullan(kim.anahtar, ozellik, sinif, konu))) return yasakYaniti(res, kim.girisYapti);

    const kullanilan = uye ? null : (await kullanilanKonular(kim.anahtar, ozellik)).length;
    res.json({
      sorular,
      uye,
      kalan: uye ? null : Math.max(UCRETSIZ_KONU_SINIRI - kullanilan, 0)
    });
  }));

  router.post('/konu', sarmala(async (req, res) => {
    const secim = istekDogrula(req.body);
    if (!secim) return res.status(400).json({ mesaj: 'Sınıf veya konu seçimi geçersiz.' });
    const { sinif, konu } = secim;
    const { kim, uye, izin } = await erisim(req, res, 'konu', sinif, konu);
    if (!izin) return yasakYaniti(res, kim.girisYapti);

    let anlatim;
    try {
      anlatim = await icerikGetir('konu', sinif, konu, 0, () => konuUret({ sinif, konu }));
    } catch (error) {
      return res.status(error.status || 502).json({ mesaj: error.message || 'Konu anlatımı hazırlanamadı.' });
    }
    if (!uye && !(await hakKullan(kim.anahtar, 'konu', sinif, konu))) return yasakYaniti(res, kim.girisYapti);

    const kullanilan = uye ? null : (await kullanilanKonular(kim.anahtar, 'konu')).length;
    res.json({
      sinif,
      konu,
      anlatim,
      uye,
      kalan: uye ? null : Math.max(UCRETSIZ_KONU_SINIRI - kullanilan, 0)
    });
  }));

  return router;
}

module.exports = { createPratikRouter, UCRETSIZ_KONU_SINIRI, UCRETSIZ_SORU_SAYISI };
