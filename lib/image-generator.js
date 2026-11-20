const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'ai-illustrations');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

/**
 * Google Imagen / Gemini API ile görsel üretip sunucuya PNG olarak kaydeder.
 * Hata veya kota durumunda sistemi çökertmez, null döner.
 */
async function generateIllustration({ prompt, filename = null }) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return null;

  ensureUploadsDir();

  const apiKey = String(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[ImageGen] GEMINI_API_KEY bulunamadı, görsel üretimi atlandı.');
    return null;
  }

  const safeName = filename || `ill_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
  const filePath = path.join(UPLOADS_DIR, safeName);
  const publicUrl = `/uploads/ai-illustrations/${safeName}`;

  // 1. Strateji: Google REST Predict API (imagen-3.0-generate-002)
  try {
    const candidateModels = [
      'imagen-3.0-generate-002',
      'imagen-3.0-fast-generate-001'
    ];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: String(prompt).trim() }],
            parameters: {
              sampleCount: 1,
              outputMimeType: 'image/png',
              aspectRatio: '4:3'
            }
          }),
          signal: AbortSignal.timeout(25000)
        });

        if (res.ok) {
          const data = await res.json();
          const base64Data = data?.predictions?.[0]?.bytesBase64Encoded;
          if (base64Data) {
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            return publicUrl;
          }
        } else {
          const errText = await res.text();
          console.warn(`[ImageGen] Model ${model} HTTP ${res.status}:`, errText.slice(0, 140));
        }
      } catch (innerErr) {
        console.warn(`[ImageGen] Model ${model} denemesinde hata:`, innerErr.message);
      }
    }
  } catch (error) {
    console.warn('[ImageGen] REST API görsel üretiminde genel hata:', error.message);
  }

  return null;
}

/**
 * Verilen illüstrasyon listesindeki tüm promptları paralel üretip dosyalara kaydeder.
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
 * üretilen <img> etiketleriyle değiştirir; başarısız görsellerin etiketlerini temizler.
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
  ensureUploadsDir,
  generateIllustration,
  processIllustrations,
  replaceIllustrationPlaceholders,
  UPLOADS_DIR
};
