const fs = require('fs');
const path = require('path');
const Soru = require('../models/Soru');

const RESIM_KLASORU = path.join(__dirname, '..', 'public', 'images', 'sorular');
const RESIM_UZANTILARI = /\.(png|jpe?g|webp)$/i;
// "matematik-soru1.png" -> ders: matematik, siraNo: 1 ; "soru-2.png" -> ders: genel, siraNo: 2
const DOSYA_ADI = /^(?:(.+?)-)?soru-?(\d+)\.[a-z0-9]+$/i;

function siteAdresi() {
  return String(process.env.SITE_URL || 'https://zarifcozum.com').trim().replace(/\/+$/, '');
}

function resimUrlOlustur(dosyaAdi) {
  return `${siteAdresi()}/images/sorular/${encodeURIComponent(dosyaAdi)}`;
}

function dosyaAdiniCozumle(dosyaAdi) {
  const eslesme = DOSYA_ADI.exec(dosyaAdi);
  return {
    ders: eslesme && eslesme[1] ? eslesme[1].toLocaleLowerCase('tr-TR') : 'genel',
    siraNo: eslesme ? Number(eslesme[2]) : null
  };
}

function resimleriTara(klasor = RESIM_KLASORU) {
  if (!fs.existsSync(klasor)) return [];
  return fs.readdirSync(klasor, { withFileTypes: true })
    .filter(girdi => girdi.isFile() && RESIM_UZANTILARI.test(girdi.name))
    .map(girdi => girdi.name)
    .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
}

async function sorulariSenkronla({ createdBy = 'script', kuru = false, klasor } = {}) {
  const dosyalar = resimleriTara(klasor);
  const sonuc = { toplam: dosyalar.length, eklenen: [], atlanan: [] };
  if (!dosyalar.length) return sonuc;

  const adaylar = dosyalar.map(imageFile => ({ imageFile, imageUrl: resimUrlOlustur(imageFile) }));
  const mevcut = new Set(
    (await Soru.find({ imageUrl: { $in: adaylar.map(a => a.imageUrl) } }).select('imageUrl').lean())
      .map(soru => soru.imageUrl)
  );
  const yeniler = adaylar.filter(a => !mevcut.has(a.imageUrl));
  sonuc.atlanan = adaylar.filter(a => mevcut.has(a.imageUrl)).map(a => a.imageFile);
  if (kuru || !yeniler.length) {
    sonuc.eklenen = yeniler.map(a => a.imageFile);
    return sonuc;
  }

  await Soru.createIndexes();
  // Upsert + benzersiz indeks: aynı anda iki çalıştırma olsa bile çift kayıt oluşmaz.
  const yazim = await Soru.bulkWrite(yeniler.map(aday => ({
    updateOne: {
      filter: { imageUrl: aday.imageUrl },
      update: { $setOnInsert: { ...aday, ...dosyaAdiniCozumle(aday.imageFile), answer: null, createdBy } },
      upsert: true
    }
  })), { ordered: false, timestamps: true });

  const upsertEdilen = new Set(Object.keys(yazim.upsertedIds || {}).map(Number));
  yeniler.forEach((aday, i) => (upsertEdilen.has(i) ? sonuc.eklenen : sonuc.atlanan).push(aday.imageFile));
  return sonuc;
}

module.exports = { sorulariSenkronla, resimleriTara, resimUrlOlustur, dosyaAdiniCozumle, RESIM_KLASORU };
