const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

let cachedS3Client = null;

/**
 * Cloudflare R2 S3 İstemcisi
 * Render ortamında disk kalıcı olmadığından doğrudan R2 bucket'ını kullanır.
 */
function getR2Client() {
  if (cachedS3Client) return cachedS3Client;

  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_MEDIA_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_MEDIA_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const jurisdiction = (process.env.R2_MEDIA_JURISDICTION || '').trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.warn('[R2] Cloudflare R2 kimlik bilgileri eksik (.env).');
    return null;
  }

  const endpoint = `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  cachedS3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });

  return cachedS3Client;
}

/**
 * Üretilen görsel buffer'ını doğrudan Cloudflare R2 bucket'ına yükler.
 * Yerel diske kesinlikle dosya yazmaz.
 */
async function uploadToR2({ buffer, filename = null, contentType = 'image/png' }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Geçersiz görsel verisi.');
  }

  const s3 = getR2Client();
  if (!s3) {
    throw new Error('Cloudflare R2 istemcisi başlatılamadı. .env içindeki R2 ayarlarını kontrol edin.');
  }

  const bucket = process.env.R2_MEDIA_BUCKET || 'zarifcozum-public-media';
  const safeName = filename || `ill_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
  const key = `ai-illustrations/${safeName}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }));

  // *.r2.dev geliştirici alan adları Türkiye'de SSL/erişim hatası verebildiği için
  // yalnızca özel domain (örn. media.zarifcozum.com) varsa onu kullan, aksi halde
  // site içi kalıcı R2 akış rotası olan /uploads/ai-illustrations/... yolunu döndür.
  const rawPublicBase = (process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
  const useCustomDomain = rawPublicBase && !/\.r2\.dev$/i.test(rawPublicBase);
  const url = useCustomDomain ? `${rawPublicBase}/${key}` : `/uploads/${key}`;

  return {
    url,
    key,
    bucket,
    filename: safeName
  };
}

/**
 * Cloudflare R2 bucket'ından görsel akışını getirir.
 */
async function getFromR2(key) {
  const s3 = getR2Client();
  if (!s3) throw new Error('R2 istemcisi aktif değil.');

  const bucket = process.env.R2_MEDIA_BUCKET || 'zarifcozum-public-media';
  return s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key
  }));
}

/**
 * Google Imagen / Gemini API ile görsel üretip doğrudan Cloudflare R2'ye yükler.
 * Hata veya kota durumunda sistemi çökertmez (fail-safe), null döner.
 */
async function generateIllustration({ prompt, filename = null }) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return null;

  const apiKey = String(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[ImageGen] GEMINI_API_KEY bulunamadı, görsel üretimi atlandı.');
    return null;
  }

  const safeName = filename || `ill_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;

  const persistOrDataUrl = async (base64Data, mimeType = 'image/png') => {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const r2Result = await uploadToR2({ buffer, filename: safeName, contentType: mimeType });
      console.log(`[ImageGen] Görsel başarıyla R2'ye yüklendi: ${r2Result.key} (${r2Result.url})`);
      return r2Result.url;
    } catch (r2Err) {
      console.warn('[ImageGen] R2 yükleme atlandı, inline data URL döndürülüyor:', r2Err.message);
      return `data:${mimeType};base64,${base64Data}`;
    }
  };

  // 1. Strateji (Birincil): API anahtarında aktif Gemini Native Image modelleri (:generateContent)
  try {
    const geminiImageModels = [
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-lite-image',
      'gemini-2.5-flash-image'
    ];
    for (const model of geminiImageModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: String(prompt).trim() }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
          }),
          signal: AbortSignal.timeout(22000)
        });
        if (res.ok) {
          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const imgPart = parts.find(p => p.inlineData?.data);
          if (imgPart?.inlineData?.data) {
            return await persistOrDataUrl(imgPart.inlineData.data, imgPart.inlineData.mimeType || 'image/png');
          }
        } else {
          const errText = await res.text();
          console.warn(`[ImageGen] GeminiImage ${model} HTTP ${res.status}:`, errText.slice(0, 140));
        }
      } catch (gErr) {
        console.warn(`[ImageGen] GeminiImage ${model} hatası:`, gErr.message);
      }
    }
  } catch (error) {
    console.warn('[ImageGen] GeminiImage genel hata:', error.message);
  }

  return null;
}

/**
 * Verilen illüstrasyon listesindeki tüm promptları paralel üretip R2'ye kaydeder.
 */
async function processIllustrations(illustrations = []) {
  if (!Array.isArray(illustrations) || !illustrations.length) return [];

  const results = [];
  for (const item of illustrations) {
    const id = item.id || item.placeholder_id || 'IMG_1';
    const prompt = item.prompt || '';
    if (!prompt) continue;

    try {
      const imageUrl = await generateIllustration({ prompt });
      results.push({
        id,
        prompt,
        imageUrl: imageUrl || ''
      });
    } catch (err) {
      console.warn(`[ImageGen] Görsel işleme uyarısı (${id}):`, err.message);
      results.push({ id, prompt, imageUrl: '' });
    }
  }
  return results;
}

/**
 * İçerik metnindeki [[IMG_1]], [[IMG_2]] veya {{IMG_1}} yer tutucularını
 * üretilen R2 <img> etiketleriyle değiştirir; başarısız görsellerin etiketlerini temizler.
 */
function replaceIllustrationPlaceholders(content = '', illustrations = []) {
  let output = String(content || '');
  if (!illustrations || !illustrations.length) {
    return output.replace(/\[\[IMG_\d+\]\]/gi, '').replace(/\{\{IMG_\d+\}\}/gi, '');
  }

  for (const item of illustrations) {
    const id = item.id || item.placeholder_id || '';
    if (!id) continue;

    const pattern = new RegExp(`\\[\\[${id}\\]\\]|\\{\\{${id}\\}\\}`, 'gi');
    if (item.imageUrl) {
      const figureHtml = `
<figure class="ai-maarif-illustration" style="margin:20px auto;text-align:center;max-width:540px;">
  <img src="${item.imageUrl}" alt="${String(item.prompt || 'Maarif Modeli Eğitim İllüstrasyonu').replace(/"/g, '&quot;')}" class="ai-maarif-img" style="width:100%;height:auto;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.08);border:1px solid #e2e8f0;display:block;" loading="lazy" />
  <figcaption style="font-size:12px;color:#64748b;margin-top:6px;font-style:italic;">Eğitim İllüstrasyonu: ${String(item.prompt || '').slice(0, 90)}</figcaption>
</figure>`.trim();
      output = output.replace(pattern, figureHtml);
    } else {
      output = output.replace(pattern, '');
    }
  }

  // Kalan eşleşmemiş yer tutucuları temizle
  output = output.replace(/\[\[IMG_\d+\]\]/gi, '').replace(/\{\{IMG_\d+\}\}/gi, '');
  return output;
}

module.exports = {
  getR2Client,
  uploadToR2,
  getFromR2,
  generateIllustration,
  processIllustrations,
  replaceIllustrationPlaceholders
};
