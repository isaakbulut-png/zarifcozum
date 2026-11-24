'use strict';

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

let cachedClient = null;
const keyListCache = { keys: null, fetchedAt: 0 };
const bookJsonCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 dakika

function getR2Client() {
  if (cachedClient) return cachedClient;

  const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(process.env.R2_BOOKS_ACCESS_KEY_ID || process.env.R2_MEDIA_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.R2_BOOKS_SECRET_ACCESS_KEY || process.env.R2_MEDIA_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const jurisdiction = String(process.env.R2_BOOKS_JURISDICTION || process.env.R2_MEDIA_JURISDICTION || '').trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const endpoint = `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });
  return cachedClient;
}

function getBooksBucket() {
  return String(
    process.env.R2_BOOKS_BUCKET ||
    process.env.R2_BUCKET_NAME ||
    process.env.R2_MEDIA_BUCKET ||
    'zarifcozum-public-media'
  ).trim();
}

function normalizeTr(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function streamToString(body) {
  if (!body) return '';
  if (typeof body.transformToString === 'function') {
    return body.transformToString('utf8');
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function listJsonBookKeys(s3, bucket) {
  const now = Date.now();
  if (keyListCache.keys && (now - keyListCache.fetchedAt) < CACHE_TTL_MS) {
    return keyListCache.keys;
  }

  const prefix = String(process.env.R2_BOOKS_PREFIX || '').trim();
  const keys = [];
  let continuationToken = undefined;

  for (let page = 0; page < 5; page++) {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      MaxKeys: 500,
      ContinuationToken: continuationToken
    }));
    const contents = Array.isArray(res.Contents) ? res.Contents : [];
    for (const obj of contents) {
      if (obj && obj.Key && /\.json$/i.test(obj.Key)) {
        keys.push(obj.Key);
      }
    }
    if (!res.IsTruncated || !res.NextContinuationToken) break;
    continuationToken = res.NextContinuationToken;
  }

  keyListCache.keys = keys;
  keyListCache.fetchedAt = now;
  return keys;
}

function keyMatchesGrade(key, grade) {
  const g = String(Number(grade));
  const norm = normalizeTr(key);
  const patterns = [
    new RegExp(`(^|[^0-9])${g}([^0-9]|$)`),
    new RegExp(`sinif\\s*${g}`),
    new RegExp(`grade\\s*${g}`),
    new RegExp(`mat\\s*${g}`)
  ];
  return patterns.some(re => re.test(norm));
}

function extractEntriesFromBookJson(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.pages)) return parsed.pages;
  if (Array.isArray(parsed.sayfalar)) return parsed.sayfalar;
  if (Array.isArray(parsed.units)) return parsed.units;
  if (Array.isArray(parsed.temalar)) return parsed.temalar;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.content)) return parsed.content;
  return [parsed];
}

function entryToText(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  const parts = [];
  const fields = [
    'title', 'baslik', 'tema', 'theme', 'unite', 'unit', 'konu', 'subTopic',
    'text', 'metin', 'content', 'icerik', 'aciklama', 'etkinlik', 'ornek',
    'tanim', 'gorsel_betimleme', 'visualDescription'
  ];
  for (const f of fields) {
    if (typeof entry[f] === 'string' && entry[f].trim()) {
      parts.push(entry[f].trim());
    } else if (Array.isArray(entry[f])) {
      const joined = entry[f].map(v => (typeof v === 'string' ? v : entryToText(v))).filter(Boolean).join(' ');
      if (joined) parts.push(joined);
    }
  }
  return parts.join('\n').trim();
}

function scoreRelevance(text, keywords) {
  if (!text || !keywords.length) return 0;
  const norm = normalizeTr(text);
  let score = 0;
  for (const kw of keywords) {
    if (kw.length < 3) continue;
    if (norm.includes(kw)) score += kw.length >= 6 ? 3 : 1;
  }
  return score;
}

/**
 * Cloudflare R2'deki JSON ders kitabı dosyalarından ilgili sınıf, tema ve alt konuya ait
 * gerçek MEB etkinliklerini, kavram tanımlarını ve örneklerini çeker.
 */
async function fetchR2BookContext({ grade, unitTopic = '', subTopic = '', maxChars = 4200 } = {}) {
  const g = Number(grade);
  if (!Number.isFinite(g) || g < 5 || g > 12) {
    return { r2BookContext: '', matchedKeys: [], snippetCount: 0 };
  }

  const s3 = getR2Client();
  if (!s3) {
    return { r2BookContext: '', matchedKeys: [], snippetCount: 0 };
  }

  try {
    const bucket = getBooksBucket();
    const allJsonKeys = await listJsonBookKeys(s3, bucket);
    const gradeKeys = allJsonKeys.filter(k => keyMatchesGrade(k, g)).slice(0, 4);
    if (!gradeKeys.length) {
      return { r2BookContext: '', matchedKeys: [], snippetCount: 0 };
    }

    const keywords = Array.from(new Set(
      normalizeTr(`${unitTopic} ${subTopic}`).split(' ').filter(w => w.length >= 3)
    ));

    const scoredSnippets = [];

    for (const key of gradeKeys) {
      let parsed = null;
      const cached = bookJsonCache.get(key);
      if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
        parsed = cached.data;
      } else {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const raw = await streamToString(obj.Body);
        if (!raw) continue;
        parsed = JSON.parse(raw);
        bookJsonCache.set(key, { data: parsed, fetchedAt: Date.now() });
      }

      const entries = extractEntriesFromBookJson(parsed);
      entries.forEach((entry, idx) => {
        const text = entryToText(entry);
        if (!text || text.length < 25) return;
        const score = scoreRelevance(text, keywords);
        if (score > 0) {
          const pageNo = entry.page || entry.sayfa || entry.pageNumber || (idx + 1);
          scoredSnippets.push({
            key,
            pageNo,
            score,
            text: text.slice(0, 1100)
          });
        }
      });
    }

    scoredSnippets.sort((a, b) => b.score - a.score);
    const topSnippets = scoredSnippets.slice(0, 5);

    if (!topSnippets.length) {
      return { r2BookContext: '', matchedKeys: gradeKeys, snippetCount: 0 };
    }

    let r2BookContext = '';
    for (const s of topSnippets) {
      const block = `[R2 MEB JSON Kitap · ${s.key} · Sayfa ${s.pageNo}]\n${s.text}\n\n`;
      if ((r2BookContext.length + block.length) > maxChars) break;
      r2BookContext += block;
    }

    return {
      r2BookContext: r2BookContext.trim(),
      matchedKeys: gradeKeys,
      snippetCount: topSnippets.length
    };
  } catch (err) {
    console.warn('[R2 Books] JSON ders kitabı bağlamı okunamadı (Pinecone yedeğiyle devam ediliyor):', err.message);
    return { r2BookContext: '', matchedKeys: [], snippetCount: 0 };
  }
}

module.exports = {
  fetchR2BookContext,
  keyMatchesGrade,
  extractEntriesFromBookJson
};
