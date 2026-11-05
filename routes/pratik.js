const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { konuVarMi } = require('../lib/mufredat');

const OZELLIKLER = ['asistan', 'test', 'kazanim', 'konu'];
const ZIYARETCI_SORU_HAKKI = 3;
const ZIYARETCI_KONU_HAKKI = 3;
const ZIYARETCI_OZET_GOREBILIR = true;
const ZIYARETCI_TEST_KULLANABILIR = true;
const ZIYARETCI_ASISTAN_KULLANABILIR = true;
const ZIYARETCI_KAZANIM_TESTI_KULLANABILIR = false;
const UYE_SORU_SAYILARI = [5, 10, 20];
const ZIYARETCI_CEREZI = 'zc_ziyaretci';
const ZIYARETCI_CEREZ_SURESI = 30 * 24 * 60 * 60 * 1000;
const UYELIK_ADRESI = '/Paketler.html';
const UYELIK_GEREKLI_MESAJI = 'Sınırınıza ulaştınız, devam etmek için lütfen üye girişi yapın.';

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
  soruUret,
  konuUret,
  mufredatKonusuVarMi = async () => false,
  ziyaretciHaklari = {},
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
  const haklar = {
    soru: ZIYARETCI_SORU_HAKKI,
    konu: ZIYARETCI_KONU_HAKKI,
    ozetGorebilir: ZIYARETCI_OZET_GOREBILIR,
    test: ZIYARETCI_TEST_KULLANABILIR,
    asistan: ZIYARETCI_ASISTAN_KULLANABILIR,
    kazanim: ZIYARETCI_KAZANIM_TESTI_KULLANABILIR,
    ...ziyaretciHaklari
  };

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
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
        maxAge: ZIYARETCI_CEREZ_SURESI,
        path: '/'
      });
    }
    return { anahtar: `a:${ziyaretci}`, girisYapti: false, kullanici: null };
  }

  async function kullanilanKonular(anahtar, ozellik) {
    const kayit = await getUsageCollection().findOne({ key: anahtar, ozellik });
    return kayit?.konular || [];
  }

  function yasakYaniti(res, girisYapti, mesaj = UYELIK_GEREKLI_MESAJI) {
    return res.status(403).json({
      kod: 'UYELIK_GEREKLI',
      mesaj,
      yonlendir: UYELIK_ADRESI,
      girisYapti
    });
  }

  async function kullanilanSoruSayisi(anahtar) {
    const kayit = await getUsageCollection().findOne({ key: anahtar, ozellik: 'sorular' });
    return kayit?.soruSayisi || 0;
  }

  async function soruHakkiKullan(anahtar, adet) {
    try {
      const sonuc = await getUsageCollection().updateOne(
        {
          key: anahtar,
          ozellik: 'sorular',
          soruSayisi: { $lte: haklar.soru - adet }
        },
        {
          $inc: { soruSayisi: adet },
          $setOnInsert: {
            key: anahtar,
            ozellik: 'sorular',
            expiresAt: new Date(Date.now() + ZIYARETCI_CEREZ_SURESI)
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
          [`konular.${haklar.konu - 1}`]: { $exists: false },
          konular: { $not: { $elemMatch: { sinif, konu } } }
        },
        {
          $push: { konular: { sinif, konu, at: new Date() } },
          $setOnInsert: { expiresAt: new Date(Date.now() + ZIYARETCI_CEREZ_SURESI) }
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

  async function erisim(req, res, ozellik, sinif, konu) {
    const kim = kimlik(req, res);
    const uye = await uyeMi(kim.kullanici);
    const limitYok = uye || kim.kullanici?.role === 'student';
    if (limitYok) return { kim, uye, limitYok, izin: true };
    const ziyaretciIzinli = ozellik === 'konu'
      ? haklar.ozetGorebilir
      : Boolean(haklar[ozellik]);
    if (!ziyaretciIzinli) return { kim, uye, limitYok, izin: false };
    const kullanilan = await kullanilanKonular(kim.anahtar, ozellik);
    const mevcut = kullanilan.some(oge => oge.sinif === sinif && oge.konu === konu);
    return { kim, uye, limitYok, izin: mevcut || kullanilan.length < haklar.konu };
  }

  router.get('/durum', sarmala(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const kim = kimlik(req, res);
    const uye = await uyeMi(kim.kullanici);
    const limitYok = uye || kim.kullanici?.role === 'student';
    const soruKullanilan = limitYok ? 0 : await kullanilanSoruSayisi(kim.anahtar);
    const ozellikler = {};
    for (const ozellik of OZELLIKLER) {
      const kullanilan = limitYok ? [] : await kullanilanKonular(kim.anahtar, ozellik);
      ozellikler[ozellik] = {
        kullanilan: kullanilan.map(({ sinif, konu }) => ({ sinif, konu })),
        kalan: limitYok ? null : Math.max(haklar.konu - kullanilan.length, 0),
        acik: limitYok || (ozellik === 'konu' ? haklar.ozetGorebilir : Boolean(haklar[ozellik]))
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
        ozetGorebilir: haklar.ozetGorebilir,
        kazanimTestiAcik: haklar.kazanim
      },
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
    const { kim, uye, limitYok, izin } = await erisim(req, res, ozellik, sinif, konu);
    if (!izin) return yasakYaniti(res, kim.girisYapti);

    const istenen = Number(req.body?.adet);
    const soruKullanilan = limitYok ? 0 : await kullanilanSoruSayisi(kim.anahtar);
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
    if (!limitYok && !(await hakKullan(kim.anahtar, ozellik, sinif, konu))) return yasakYaniti(res, kim.girisYapti);
    if (!limitYok && !(await soruHakkiKullan(kim.anahtar, adet))) return yasakYaniti(res, kim.girisYapti);

    const kullanilan = limitYok ? null : (await kullanilanKonular(kim.anahtar, ozellik)).length;
    const guncelSoruSayisi = limitYok ? null : await kullanilanSoruSayisi(kim.anahtar);
    res.json({
      sorular,
      uye,
      limitYok,
      kalan: limitYok ? null : Math.max(haklar.konu - kullanilan, 0),
      soruHakki: limitYok ? null : Math.max(haklar.soru - guncelSoruSayisi, 0)
    });
  }));

  router.post('/konu', sarmala(async (req, res) => {
    const secim = await konuIcinIstekDogrula(req.body);
    if (!secim) return res.status(400).json({ mesaj: 'Sınıf veya konu seçimi geçersiz.' });
    const { sinif, konu } = secim;
    const { kim, uye, limitYok, izin } = await erisim(req, res, 'konu', sinif, konu);
    if (!izin) return yasakYaniti(res, kim.girisYapti);

    let anlatim;
    try {
      anlatim = await icerikGetir('konu-slides-v3', sinif, konu, 0, () => konuUret({ sinif, konu }));
    } catch (error) {
      return res.status(error.status || 502).json({ mesaj: error.message || 'Konu anlatımı hazırlanamadı.' });
    }
    if (!limitYok && !(await hakKullan(kim.anahtar, 'konu', sinif, konu))) return yasakYaniti(res, kim.girisYapti);

    const kullanilan = limitYok ? null : (await kullanilanKonular(kim.anahtar, 'konu')).length;
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
  createPratikRouter,
  ZIYARETCI_SORU_HAKKI,
  ZIYARETCI_KONU_HAKKI,
  ZIYARETCI_OZET_GOREBILIR,
  ZIYARETCI_TEST_KULLANABILIR,
  ZIYARETCI_ASISTAN_KULLANABILIR,
  ZIYARETCI_KAZANIM_TESTI_KULLANABILIR
};
