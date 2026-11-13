// Kullanım: node uploadMufredat.js
// mufredat_donusturucu/kazanimlar klasöründeki tüm kazanımları vektörleştirip Pinecone 'meb-mufredat' index'ine yükler.
const fs = require('fs');
const path = require('path');
// server.js ile aynı: .env öncelikli, eksikler baglanti_adresi.env'den tamamlanır
for (const file of ['.env', 'baglanti_adresi.env']) {
  const envPath = path.join(__dirname, file);
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
}
const { GoogleGenAI } = require('@google/genai');
const { Pinecone } = require('@pinecone-database/pinecone');

const KLASOR = path.join(__dirname, 'mufredat_donusturucu', 'kazanimlar');
const INDEX_ADI = 'meb-mufredat';
// text-embedding-004 kapatıldı; aiService.mjs ile aynı model ve boyut kullanılmalı
const EMBEDDING_MODELI = 'gemini-embedding-001';
const EMBEDDING_BOYUT = 768;
const PARTI_BOYUTU = 50;

const sinirMetni = (b) => (b && typeof b === 'object' ? b.statement : b);
const asText = (v) => (Array.isArray(v) ? v.map(sinirMetni).filter(Boolean).join(' ') : sinirMetni(v) || '');

function kayitlariOku() {
  const dosyalar = fs.readdirSync(KLASOR).filter((f) => f.toLowerCase().endsWith('.json'));
  dosyalar.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const sonuc = [];
  for (const dosya of dosyalar) {
    const veri = JSON.parse(fs.readFileSync(path.join(KLASOR, dosya), 'utf8').replace(/^\uFEFF/, ''));
    const kayitlar = Array.isArray(veri) ? veri : veri.records || [];

    for (const k of kayitlar) {
      if (!k.outcome_code) continue;
      const text = [
        `Kazanım Kodu: ${k.outcome_code}`,
        `Kazanım Açıklaması: ${asText(k.official_description)}`,
        `Resmi Sınırlar: ${asText(k.official_boundaries) || 'Belirtilmemiş'}`,
      ].join('\n');

      const metadata = {
        text,
        grade: Number(k.grade ?? veri.grade),
        course: k.course || veri.course || 'Matematik',
        outcome_code: k.outcome_code,
        unit_topic: k.unit_topic || '',
        official_description: asText(k.official_description),
      };
      // aiService.mjs sınırları metadata'dan okur; boş dizi/metin yazılmaz
      const sinirlar = (Array.isArray(k.official_boundaries) ? k.official_boundaries : [k.official_boundaries])
        .map(sinirMetni)
        .filter(Boolean)
        .map(String);
      if (sinirlar.length) metadata.official_boundaries = sinirlar;

      sonuc.push({ id: `${k.outcome_code}`, text, metadata });
    }
    console.log(`${dosya}: ${kayitlar.length} kayıt okundu`);
  }
  return sonuc;
}

const MAKS_DENEME = 5;
const BEKLEME_MS = 2000;
// 429 dakikalık kota hatasında 2 sn yetmez; kota penceresinin açılması için daha uzun beklenir
const KOTA_BEKLEME_MS = 30000;

async function embedBekleyerek(ai, parti) {
  for (let deneme = 1; ; deneme++) {
    try {
      return await ai.models.embedContent({
        model: EMBEDDING_MODELI,
        contents: parti.map((k) => k.text),
        config: { outputDimensionality: EMBEDDING_BOYUT, taskType: 'RETRIEVAL_DOCUMENT' },
      });
    } catch (err) {
      const gecici = err.status === 503 || err.status === 429;
      if (!gecici || deneme >= MAKS_DENEME) throw err;
      const bekleme = err.status === 429 ? KOTA_BEKLEME_MS : BEKLEME_MS;
      console.log(`Hata ${err.status}, ${bekleme / 1000} sn sonra tekrar denenecek (${deneme}/${MAKS_DENEME})...`);
      await new Promise((r) => setTimeout(r, bekleme));
    }
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY) {
    throw new Error('GEMINI_API_KEY ve PINECONE_API_KEY ortam değişkenleri gerekli.');
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  const mevcut = (await pc.listIndexes()).indexes || [];
  if (!mevcut.some((i) => i.name === INDEX_ADI)) {
    console.log(`'${INDEX_ADI}' index'i bulunamadı, oluşturuluyor (${EMBEDDING_BOYUT} boyut, cosine)...`);
    await pc.createIndex({
      name: INDEX_ADI,
      dimension: EMBEDDING_BOYUT,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
      waitUntilReady: true,
    });
  }
  const index = pc.index(INDEX_ADI);

  const kayitlar = kayitlariOku();
  console.log(`Toplam ${kayitlar.length} kazanım yüklenecek.`);

  for (let i = 0; i < kayitlar.length; i += PARTI_BOYUTU) {
    const parti = kayitlar.slice(i, i + PARTI_BOYUTU);
    const emb = await embedBekleyerek(ai, parti);
    const records = parti.map((k, n) => ({
      id: k.id,
      values: emb.embeddings[n].values,
      metadata: k.metadata,
    }));
    await index.upsert({ records });
    console.log(`Yüklendi: ${Math.min(i + PARTI_BOYUTU, kayitlar.length)}/${kayitlar.length}`);
  }
  console.log('Tamamlandı.');
}

main().catch((err) => {
  console.error('Yükleme hatası:', err);
  process.exit(1);
});
