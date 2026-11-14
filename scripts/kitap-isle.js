// Kullanım: node scripts/kitap-isle.js --pdf "<pdf_yolu>" --grade 5 [--book "<kitap_adi>"] [--start 1] [--end 3] [--no-r2] [--no-pinecone]
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { GoogleGenAI } = require('@google/genai');
const { Pinecone } = require('@pinecone-database/pinecone');

for (const file of ['.env', 'baglanti_adresi.env']) {
  const envPath = path.join(__dirname, '..', file);
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
}

const INDEX_ADI = 'meb-mufredat';
const DERS_KITABI_NAMESPACE = 'ders_kitabi';
const VISION_MODEL = 'gemini-4-argon';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_BOYUT = 768;

function parseArgs(argv) {
  const opts = { start: 1, end: null, r2: true, pinecone: true, concurrency: 6 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pdf') opts.pdf = argv[++i];
    else if (a === '--grade') opts.grade = Number(argv[++i]);
    else if (a === '--book') opts.book = argv[++i];
    else if (a === '--start') opts.start = Number(argv[++i]);
    else if (a === '--end') opts.end = Number(argv[++i]);
    else if (a === '--concurrency') opts.concurrency = Math.max(1, Number(argv[++i]) || 5);
    else if (a === '--no-r2') opts.r2 = false;
    else if (a === '--no-pinecone') opts.pinecone = false;
  }
  if (!opts.pdf || !opts.grade) {
    throw new Error('Kullanım: node scripts/kitap-isle.js --pdf "<yol>" --grade 5 [--start 1 --end 3]');
  }
  return opts;
}

function slugify(str) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  return String(str)
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c] || c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function findPython() {
  const venvPy = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
  return fs.existsSync(venvPy) ? venvPy : 'python';
}

function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_PRIVATE_BUCKET;
  const accessKeyId = process.env.R2_PRIVATE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PRIVATE_SECRET_ACCESS_KEY;
  const jurisdiction = process.env.R2_PRIVATE_JURISDICTION || '';
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('R2_PRIVATE_* ortam değişkenleri eksik.');
  }
  const endpoint = `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  return {
    bucket,
    client: new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } }),
  };
}

async function analyzePageWithVision(ai, imageBuffer, grade, bookTitle, pageNo) {
  const buildPrompt = (paraphrase) => `Bu görsel Türkiye Yüzyılı Maarif Modeli ${grade}. sınıf matematik ders kitabının ("${bookTitle}") ${pageNo}. sayfasıdır.
${paraphrase
  ? 'Sayfadaki konuyu, etkinlik adımlarını, soruları ve sayısal verileri kendi cümlelerinle yeniden ifade ederek yapılandırılmış ders notu halinde çıkar'
  : 'Sayfadaki TÜM öğretici içeriği hiçbir soruyu, konuşma balonunu, etkinliği veya şekli atlamadan çıkar'} ve sadece geçerli JSON döndür:
{
  "theme": "Varsa sayfadaki tema/ünite başlığı (yoksa boş string)",
  "content_type": "konu_anlatimi | etkinlik | ornek_soru | degerlendirme | kapak_icindekiler",
  "text": "Sayfadaki ${paraphrase ? 'tüm bilgi, etkinlik ve soruların sayısal değerleri koruyarak açık Türkçe anlatımı' : 'birebir tüm metinler, konuşma balonları, etkinlik adımları, sorular'}. Matematik sembollerini ve kesir/üslü ifadeleri mutlaka geçerli LaTeX ($...$ veya $$...$$) ile yaz; tabloları Markdown tablosu olarak koru.",
  "visual_description": "Sayfadaki tüm geometrik şekillerin, açıölçerlerin, sayı doğrularının, grafiklerin ve görsel senaryoların (ör. noktalar, harfler, açılar, ölçüler) ayrıntılı matematiksel betimlemesi. Görsel yoksa boş string."
}`;

  let paraphrase = false;
  for (let deneme = 1; deneme <= 5; deneme++) {
    try {
      const response = await ai.models.generateContent({
        model: VISION_MODEL,
        contents: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBuffer.toString('base64'),
            },
          },
          buildPrompt(paraphrase),
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: paraphrase ? 0.3 : 0.1,
        },
      });

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === 'RECITATION' && !paraphrase) {
        paraphrase = true;
        throw new Error(`Sayfa ${pageNo} RECITATION filtresine takıldı, özet/yeniden-ifade moduna geçiliyor`);
      }

      const raw = (response.text || '').trim();
      try {
        return JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
          paraphrase = true;
          throw new Error(`Sayfa ${pageNo} için JSON ayrıştırılamadı (${finishReason || 'boş yanıt'}).`);
        }
        return JSON.parse(match[0]);
      }
    } catch (err) {
      if (deneme >= 5) throw err;
      const bekleme = err?.status === 429 ? 20000 : 3000;
      console.warn(`Sayfa ${pageNo} deneme ${deneme} hatası (${err.status || err.message}), ${bekleme / 1000} sn bekleniyor...`);
      await new Promise((r) => setTimeout(r, bekleme));
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pdfPath = path.resolve(opts.pdf);
  const bookTitle = opts.book || path.basename(pdfPath).replace(/(\.pdf)+$/i, '').trim();
  const bookSlug = slugify(bookTitle);
  const outFile = path.join(__dirname, '..', 'mufredat_donusturucu', 'kitaplar', `${opts.grade}-sinif`, `${bookSlug}.json`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zarif-kitap-'));

  try {
    console.log(`PDF görsellere çevriliyor (${opts.start}-${opts.end || 'son'})...`);
    const pyScript = path.join(__dirname, '..', 'mufredat_donusturucu', 'pdf_sayfa_gorsel.py');
    const pyArgs = [pyScript, pdfPath, tempDir, '--baslangic', String(opts.start)];
    if (opts.end != null) pyArgs.push('--bitis', String(opts.end));
    const pyOut = execFileSync(findPython(), pyArgs, { encoding: 'utf8' });
    const { total_pages, pages } = JSON.parse(pyOut);
    console.log(`Toplam ${total_pages} sayfa; işlenecek: ${pages.length} sayfa.`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const r2 = opts.r2 ? createR2Client() : null;

    let existing = { grade: opts.grade, book: bookTitle, book_slug: bookSlug, total_pages, records: [] };
    if (fs.existsSync(outFile)) {
      existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    }
    const byPage = new Map((existing.records || []).map((r) => [r.page, r]));

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const islenecekler = pages.filter((p) => {
      if (byPage.has(p.page)) {
        console.log(`Sayfa ${p.page} zaten işlenmiş, atlanıyor.`);
        return false;
      }
      return true;
    });

    for (let i = 0; i < islenecekler.length; i += opts.concurrency) {
      const grup = islenecekler.slice(i, i + opts.concurrency);
      await Promise.all(grup.map(async (p) => {
        const imgBuf = fs.readFileSync(p.image_path);
        const r2Key = `ders-kitaplari/${opts.grade}-sinif/${bookSlug}/sayfa-${String(p.page).padStart(4, '0')}.png`;

        if (r2) {
          await r2.client.send(new PutObjectCommand({
            Bucket: r2.bucket,
            Key: r2Key,
            Body: imgBuf,
            ContentType: 'image/png',
            CacheControl: 'private, max-age=31536000',
          }));
        }

        const parsed = await analyzePageWithVision(ai, imgBuf, opts.grade, bookTitle, p.page);
        const record = {
          page: p.page,
          grade: opts.grade,
          book: bookTitle,
          r2_key: r2 ? r2Key : '',
          theme: parsed.theme || '',
          content_type: parsed.content_type || 'konu_anlatimi',
          text: parsed.text || '',
          visual_description: parsed.visual_description || '',
        };
        byPage.set(p.page, record);
        console.log(`Sayfa ${p.page} işlendi (${record.content_type})${r2 ? ` -> R2: ${r2Key}` : ''}`);
      }));

      existing.records = [...byPage.values()].sort((a, b) => a.page - b.page);
      fs.writeFileSync(outFile, JSON.stringify(existing, null, 2), 'utf8');
    }

    existing.records = [...byPage.values()].sort((a, b) => a.page - b.page);
    fs.writeFileSync(outFile, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`JSON kaydedildi: ${outFile}`);

    if (opts.pinecone) {
      const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
      const ns = pc.index(INDEX_ADI).namespace(DERS_KITABI_NAMESPACE);
      const bookHash = crypto.createHash('sha1').update(bookSlug).digest('hex').slice(0, 8);
      const yuklenecek = pages
        .map((p) => byPage.get(p.page))
        .filter((r) => r && r.content_type !== 'kapak_icindekiler' && (r.text.length + r.visual_description.length) >= 30);

      const PARTI = 40;
      for (let i = 0; i < yuklenecek.length; i += PARTI) {
        const grup = yuklenecek.slice(i, i + PARTI);
        const metinler = grup.map((r) => [
          `Sınıf: ${r.grade}. Sınıf`,
          `Kitap: ${r.book}`,
          r.theme ? `Tema: ${r.theme}` : '',
          `Sayfa: ${r.page} (${r.content_type})`,
          r.text,
          r.visual_description ? `[Görsel Betimleme]: ${r.visual_description}` : '',
        ].filter(Boolean).join('\n'));

        const emb = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: metinler,
          config: { outputDimensionality: EMBEDDING_BOYUT, taskType: 'RETRIEVAL_DOCUMENT' },
        });

        const records = grup.map((r, idx) => ({
          id: `kitap_${r.grade}_${bookHash}_p${r.page}`,
          values: emb.embeddings[idx].values,
          metadata: {
            text: metinler[idx].slice(0, 3500),
            grade: r.grade,
            book: r.book,
            page: r.page,
            theme: r.theme || '',
            content_type: r.content_type,
            r2_key: r.r2_key || '',
            doc_type: 'ders_kitabi',
          },
        }));
        await ns.upsert({ records });
        console.log(`Pinecone (${DERS_KITABI_NAMESPACE}) yüklendi: ${Math.min(i + PARTI, yuklenecek.length)}/${yuklenecek.length}`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
