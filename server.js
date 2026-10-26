// Kurulum:  npm install express cors mongodb dotenv
// Çalıştır: node server.js
const fs = require('fs');
const path = require('path');
// ".env" ya da "baglanti_adresi.env" adlı dosyadan hangisi varsa onu okur
const envDosyasi = ['.env', 'baglanti_adresi.env']
  .map(f => path.join(__dirname, f))
  .find(f => fs.existsSync(f));
require('dotenv').config({ path: envDosyasi });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

const PORT        = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;           // .env dosyasından okunur
const DB_ADI      = process.env.DB_ADI || 'etut_merkezi';
const KOLEKSIYON  = process.env.KOLEKSIYON || 'sinav_sonuclari';

if (!MONGODB_URI) {
  console.error('❌ .env dosyasında MONGODB_URI bulunamadı.');
  process.exit(1);
}

const app = express();
app.use(cors());                                       // file:// ile açılan sayfa da erişebilsin
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'))); // public/deneme-sinavi-optik.html
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/logo', express.static(path.join(__dirname, 'logo')));

const sitePages = [
  'index.html', 'asistan.html', 'canli.html', 'konu.html', 'mimari.html', 'panel.html', 'test.html',
  'ogrenci-paneli.html', 'ogretmen-paneli.html'
];
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
sitePages.forEach(page => {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, page)));
});
app.get('/favicon.svg', (req, res) => res.sendFile(path.join(__dirname, 'favicon.svg')));

let koleksiyon, anahtarKoleksiyon;

// Sunucu ve veritabanı ayakta mı?
app.get('/api/saglik', (req, res) => res.json({ mesaj: 'Sunucu çalışıyor', db: DB_ADI, koleksiyon: KOLEKSIYON }));

// Sınav sonucunu kaydet
app.post('/api/cevap-kaydet', async (req, res) => {
  try {
    const b = req.body || {};
    const gecerli = a => a === null || ['A', 'B', 'C', 'D', 'E'].includes(a);
    if (!Array.isArray(b.cevaplar) || b.cevaplar.length > 200 || !b.cevaplar.every(gecerli)) {
      return res.status(400).json({ mesaj: 'Geçersiz cevap listesi' });
    }

    const belge = {
      ogrenciAdi: String(b.ogrenciAdi || 'Bilinmiyor').slice(0, 100),
      sinavAdi: String(b.sinavAdi || '').slice(0, 150),
      cevaplar: b.cevaplar,
      isaretlenenSayisi: b.cevaplar.filter(Boolean).length,
      bosSayisi: b.cevaplar.filter(a => a === null).length,
      harcananSure: Number(b.harcananSure) || 0,
      bitisNedeni: String(b.bitisNedeni || '').slice(0, 50),
      kayitTarihi: new Date()
    };

    const sonuc = await koleksiyon.insertOne(belge);
    console.log(`📥 Kaydedildi: ${belge.ogrenciAdi} | işaretli: ${belge.isaretlenenSayisi} | boş: ${belge.bosSayisi} | id: ${sonuc.insertedId}`);
    res.json({ mesaj: 'Kaydedildi', id: sonuc.insertedId });
  } catch (err) {
    console.error('❌ Yazma hatası:', err);
    res.status(500).json({ mesaj: 'Veritabanına yazılamadı: ' + err.message });
  }
});

// Son 20 kaydı tarayıcıda görmek için: http://localhost:3000/api/sonuclar
app.get('/api/sonuclar', ogretmenKontrol, async (req, res) => {
  try {
    const liste = await koleksiyon.find().sort({ kayitTarihi: -1 }).limit(20).toArray();
    res.json(liste);
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

// ---------- Öğretmen paneli (şifre korumalı) ----------
const OGRETMEN_SIFRE = String(process.env.OGRETMEN_SIFRE || '').trim();

function ogretmenKontrol(req, res, next) {
  if (!OGRETMEN_SIFRE) {
    return res.status(503).json({ mesaj: 'Sunucuda OGRETMEN_SIFRE tanımlı değil (.env dosyasına ekleyin)' });
  }

  const gelen = Buffer.from(String(req.get('x-ogretmen-sifre') || ''), 'utf8');
  const dogru = Buffer.from(OGRETMEN_SIFRE, 'utf8');

  if (gelen.length !== dogru.length) {
    return res.status(401).json({ mesaj: 'Şifre hatalı' });
  }

  try {
    if (!crypto.timingSafeEqual(gelen, dogru)) {
      return res.status(401).json({ mesaj: 'Şifre hatalı' });
    }
  } catch (err) {
    return res.status(401).json({ mesaj: 'Şifre hatalı' });
  }

  next();
}

app.get('/api/ogretmen/dogrula', ogretmenKontrol, (req, res) => res.json({ mesaj: 'Giriş başarılı' }));

// Tüm sonuçlar + cevap anahtarları
app.get('/api/ogretmen/veri', ogretmenKontrol, async (req, res) => {
  try {
    const sonuclar = await koleksiyon.find().sort({ kayitTarihi: -1 }).limit(1000).toArray();
    const anahtarlar = {};
    (await anahtarKoleksiyon.find().toArray()).forEach(a => { anahtarlar[a.sinavAdi] = a.anahtar; });
    res.json({ sonuclar, anahtarlar });
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

// Cevap anahtarını kaydet / güncelle
app.put('/api/ogretmen/anahtar', ogretmenKontrol, async (req, res) => {
  try {
    const { sinavAdi, anahtar } = req.body || {};
    const gecerli = a => a === null || ['A', 'B', 'C', 'D', 'E'].includes(a);
    if (!sinavAdi || !Array.isArray(anahtar) || anahtar.length > 200 || !anahtar.every(gecerli)) {
      return res.status(400).json({ mesaj: 'Geçersiz cevap anahtarı' });
    }
    await anahtarKoleksiyon.updateOne(
      { sinavAdi: String(sinavAdi).slice(0, 150) },
      { $set: { anahtar, guncellenme: new Date() } },
      { upsert: true }
    );
    res.json({ mesaj: 'Anahtar kaydedildi' });
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

// Bir sonucu sil (deneme kayıtlarını temizlemek için)
app.delete('/api/ogretmen/sonuc/:id', ogretmenKontrol, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz kayıt no' });
    await koleksiyon.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ mesaj: 'Silindi' });
  } catch (err) {
    res.status(500).json({ mesaj: err.message });
  }
});

async function baslat() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  koleksiyon = client.db(DB_ADI).collection(KOLEKSIYON);
  anahtarKoleksiyon = client.db(DB_ADI).collection('cevap_anahtarlari');
  if (!OGRETMEN_SIFRE) console.warn('⚠️  OGRETMEN_SIFRE tanımlı değil: öğretmen paneli kapalı kalır.');
  console.log(`✅ MongoDB bağlantısı hazır → veritabanı: ${DB_ADI}, koleksiyon: ${KOLEKSIYON}`);
  app.listen(PORT, () => console.log(`🚀 Sunucu aktif: http://localhost:${PORT}`));
}

baslat().catch(err => {
  console.error('❌ Başlatılamadı:', err.message);
  process.exit(1);
});
