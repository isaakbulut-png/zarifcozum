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
const ZOOM_ACCOUNT_ID = String(process.env.ZOOM_ACCOUNT_ID || '').trim();
const ZOOM_CLIENT_ID = String(process.env.ZOOM_CLIENT_ID || '').trim();
const ZOOM_CLIENT_SECRET = String(process.env.ZOOM_CLIENT_SECRET || '').trim();
const ZOOM_HOST_USER_ID = String(process.env.ZOOM_HOST_USER_ID || '').trim();
const ZOOM_MEETING_SDK_CLIENT_ID = String(process.env.ZOOM_MEETING_SDK_CLIENT_ID || '').trim();
const ZOOM_MEETING_SDK_CLIENT_SECRET = String(process.env.ZOOM_MEETING_SDK_CLIENT_SECRET || '').trim();

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
  'index.html', 'asistan.html', 'canli.html', 'zoom-room.html', 'konu.html', 'mimari.html', 'panel.html', 'test.html',
  'ogrenci-paneli.html', 'ogretmen-paneli.html'
];
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
sitePages.forEach(page => {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, page)));
});
app.get('/favicon.svg', (req, res) => res.sendFile(path.join(__dirname, 'favicon.svg')));

let koleksiyon, anahtarKoleksiyon, canliDersKoleksiyonu;

// Sunucu ve veritabanı ayakta mı?
app.get('/api/saglik', (req, res) => res.json({ mesaj: 'Sunucu çalışıyor', db: DB_ADI, koleksiyon: KOLEKSIYON }));

function zoomAyarlariniKontrolEt(ayarlar) {
  const eksikler = ayarlar.filter(ayar => !ayar.deger).map(ayar => ayar.ad);
  if (eksikler.length) {
    const hata = new Error(`Zoom ayarları eksik: ${eksikler.join(', ')}`);
    hata.status = 503;
    throw hata;
  }
}

async function zoomErisimBelirteciAl() {
  zoomAyarlariniKontrolEt([
    { ad: 'ZOOM_ACCOUNT_ID', deger: ZOOM_ACCOUNT_ID },
    { ad: 'ZOOM_CLIENT_ID', deger: ZOOM_CLIENT_ID },
    { ad: 'ZOOM_CLIENT_SECRET', deger: ZOOM_CLIENT_SECRET }
  ]);

  const sorgu = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: ZOOM_ACCOUNT_ID
  });
  const yanit = await fetch(`https://zoom.us/oauth/token?${sorgu}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok || !veri.access_token) {
    const hata = new Error(`Zoom OAuth belirteci alınamadı (${yanit.status}).`);
    hata.status = 502;
    throw hata;
  }
  return veri.access_token;
}

async function zoomApiIstegiYap(belirteci, method, yol, govde) {
  const yanit = await fetch(`https://api.zoom.us/v2${yol}`, {
    method,
    headers: {
      Authorization: `Bearer ${belirteci}`,
      ...(govde ? { 'Content-Type': 'application/json' } : {})
    },
    ...(govde ? { body: JSON.stringify(govde) } : {})
  });
  const metin = await yanit.text();
  const veri = metin ? JSON.parse(metin) : {};
  if (!yanit.ok) {
    const detay = typeof veri.message === 'string' ? `: ${veri.message}` : '';
    const hata = new Error(`Zoom API isteği başarısız (${yanit.status})${detay}`);
    hata.status = 502;
    throw hata;
  }
  return veri;
}

function zoomImzasiOlustur(toplantiNo, rol) {
  zoomAyarlariniKontrolEt([
    { ad: 'ZOOM_MEETING_SDK_CLIENT_ID', deger: ZOOM_MEETING_SDK_CLIENT_ID },
    { ad: 'ZOOM_MEETING_SDK_CLIENT_SECRET', deger: ZOOM_MEETING_SDK_CLIENT_SECRET }
  ]);

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const baslik = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const icerik = Buffer.from(JSON.stringify({
    appKey: ZOOM_MEETING_SDK_CLIENT_ID,
    mn: String(toplantiNo),
    role: rol,
    iat,
    exp,
    tokenExp: exp
  })).toString('base64url');
  const imza = crypto
    .createHmac('sha256', ZOOM_MEETING_SDK_CLIENT_SECRET)
    .update(`${baslik}.${icerik}`)
    .digest('base64url');

  return `${baslik}.${icerik}.${imza}`;
}

async function aktifCanliDersiAl() {
  const ders = await canliDersKoleksiyonu.findOne({ _id: 'aktif' });
  if (!ders) return null;
  if (ders.expiresAt <= new Date()) {
    await canliDersKoleksiyonu.deleteOne({ _id: 'aktif' });
    return null;
  }
  return ders;
}

app.get('/api/canli/katilim', async (req, res) => {
  try {
    const ders = await aktifCanliDersiAl();
    if (!ders) return res.status(404).json({ mesaj: 'Şu anda aktif bir canlı ders yok.' });
    res.json({
      sdkKey: ZOOM_MEETING_SDK_CLIENT_ID,
      signature: zoomImzasiOlustur(ders.meetingNumber, 0),
      meetingNumber: ders.meetingNumber,
      password: ders.password,
      userName: 'Öğrenci'
    });
  } catch (err) {
    console.error('❌ Zoom öğrenci katılımı hazırlanamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

app.post('/api/ogretmen/canli/baslat', ogretmenKontrol, async (req, res) => {
  try {
    zoomAyarlariniKontrolEt([{ ad: 'ZOOM_HOST_USER_ID', deger: ZOOM_HOST_USER_ID }]);
    const konu = String(req.body?.topic || 'ZarifÇözüm Canlı Ders').trim().slice(0, 200);
    if (!konu) return res.status(400).json({ mesaj: 'Ders konusu boş olamaz.' });

    const mevcutDers = await aktifCanliDersiAl();
    if (mevcutDers) {
      return res.status(409).json({ mesaj: 'Zaten aktif bir canlı ders var.' });
    }

    const belirteci = await zoomErisimBelirteciAl();
    const toplanti = await zoomApiIstegiYap(
      belirteci,
      'POST',
      `/users/${encodeURIComponent(ZOOM_HOST_USER_ID)}/meetings`,
      {
        topic: konu,
        type: 1,
        settings: {
          join_before_host: false,
          waiting_room: true,
          mute_upon_entry: true,
          meeting_authentication: false
        }
      }
    );

    await canliDersKoleksiyonu.updateOne(
      { _id: 'aktif' },
      {
        $set: {
          meetingId: String(toplanti.id),
          meetingNumber: String(toplanti.id),
          password: toplanti.password || '',
          topic: toplanti.topic || konu,
          hostUserId: ZOOM_HOST_USER_ID,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
        }
      },
      { upsert: true }
    );
    res.status(201).json({ mesaj: 'Canlı ders oluşturuldu.', topic: toplanti.topic || konu });
  } catch (err) {
    console.error('❌ Zoom toplantısı oluşturulamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

app.post('/api/ogretmen/canli/katilim', ogretmenKontrol, async (req, res) => {
  try {
    zoomAyarlariniKontrolEt([
      { ad: 'ZOOM_HOST_USER_ID', deger: ZOOM_HOST_USER_ID },
      { ad: 'ZOOM_MEETING_SDK_CLIENT_ID', deger: ZOOM_MEETING_SDK_CLIENT_ID },
      { ad: 'ZOOM_MEETING_SDK_CLIENT_SECRET', deger: ZOOM_MEETING_SDK_CLIENT_SECRET }
    ]);
    const ders = await aktifCanliDersiAl();
    if (!ders) return res.status(404).json({ mesaj: 'Şu anda aktif bir canlı ders yok.' });

    const belirteci = await zoomErisimBelirteciAl();
    const zak = await zoomApiIstegiYap(
      belirteci,
      'GET',
      `/users/${encodeURIComponent(ZOOM_HOST_USER_ID)}/token?type=zak`
    );
    res.json({
      sdkKey: ZOOM_MEETING_SDK_CLIENT_ID,
      signature: zoomImzasiOlustur(ders.meetingNumber, 1),
      meetingNumber: ders.meetingNumber,
      password: ders.password,
      userName: 'Öğretmen',
      zak: zak.token
    });
  } catch (err) {
    console.error('❌ Zoom öğretmen katılımı hazırlanamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

app.post('/api/ogretmen/canli/sonlandir', ogretmenKontrol, async (req, res) => {
  try {
    const ders = await aktifCanliDersiAl();
    if (!ders) return res.status(404).json({ mesaj: 'Aktif canlı ders bulunamadı.' });

    const belirteci = await zoomErisimBelirteciAl();
    await zoomApiIstegiYap(
      belirteci,
      'PUT',
      `/meetings/${encodeURIComponent(ders.meetingId)}/status`,
      { action: 'end' }
    );
    await canliDersKoleksiyonu.deleteOne({ _id: 'aktif' });
    res.json({ mesaj: 'Canlı ders sonlandırıldı.' });
  } catch (err) {
    console.error('❌ Zoom toplantısı sonlandırılamadı:', err.message);
    res.status(err.status || 500).json({ mesaj: err.message });
  }
});

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
  canliDersKoleksiyonu = client.db(DB_ADI).collection('canli_dersler');
  if (!OGRETMEN_SIFRE) console.warn('⚠️  OGRETMEN_SIFRE tanımlı değil: öğretmen paneli kapalı kalır.');
  console.log(`✅ MongoDB bağlantısı hazır → veritabanı: ${DB_ADI}, koleksiyon: ${KOLEKSIYON}`);
  app.listen(PORT, () => console.log(`🚀 Sunucu aktif: http://localhost:${PORT}`));
}

baslat().catch(err => {
  console.error('❌ Başlatılamadı:', err.message);
  process.exit(1);
});
