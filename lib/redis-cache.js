'use strict';

const crypto = require('crypto');

let sharedClient = null;
const memoryRateBuckets = new Map();

function setRedisClient(client) {
  sharedClient = client || null;
}

function getRedisClient() {
  return sharedClient;
}

function isRedisReady() {
  return Boolean(sharedClient && sharedClient.isReady);
}

/**
 * Normalize edilmiş metinden güvenli SHA-256 önbellek anahtarı üretir.
 */
function buildHashKey(prefix, parts) {
  const normalized = (Array.isArray(parts) ? parts : [parts])
    .map(v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `${prefix}:${hash}`;
}

/**
 * Redis'ten JSON veri okur. Redis kapalıysa veya hata oluşursa sessizce null döner.
 */
async function getCache(key) {
  if (!key || !isRedisReady()) return null;
  try {
    const raw = await sharedClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[Redis-Cache] getCache(${key}) atlandı:`, err.message);
    return null;
  }
}

/**
 * Redis'e TTL (saniye) ile JSON veri yazar. Redis kapalıysa veya hata oluşursa false döner.
 */
async function setCache(key, data, ttlSeconds = 3600) {
  if (!key || !isRedisReady()) return false;
  try {
    const ttl = Math.max(1, Math.floor(Number(ttlSeconds) || 3600));
    await sharedClient.set(key, JSON.stringify(data), { EX: ttl });
    return true;
  } catch (err) {
    console.warn(`[Redis-Cache] setCache(${key}) atlandı:`, err.message);
    return false;
  }
}

/**
 * Belirtilen önekle (prefix) başlayan anahtarları SCAN ile güvenli biçimde temizler.
 * Redis kapalıysa sessizce 0 döner.
 */
async function invalidatePattern(prefix) {
  if (!prefix || !isRedisReady()) return 0;
  try {
    const pattern = prefix.endsWith('*') ? prefix : `${prefix}*`;
    let deleted = 0;
    const keysToDelete = [];
    for await (const key of sharedClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      if (Array.isArray(key)) {
        keysToDelete.push(...key);
      } else if (key) {
        keysToDelete.push(key);
      }
      if (keysToDelete.length >= 200) break;
    }
    if (keysToDelete.length) {
      deleted = await sharedClient.del(keysToDelete);
    }
    return deleted;
  } catch (err) {
    console.warn(`[Redis-Cache] invalidatePattern(${prefix}) atlandı:`, err.message);
    return 0;
  }
}

/**
 * Hafif Redis + Bellek İçi (In-Memory Fallback) Hız Sınırlandırıcı (Rate Limiter)
 * Redis bağlıysa Upstash üzerinde atomik INCR + EXPIRE kullanır;
 * Redis kapalıysa veya hata verirse bellek içi pencereye otomatik düşer.
 */
function createRedisRateLimiter({
  prefix = 'rl:ai',
  windowSec = 60,
  maxRequests = 15,
  message = 'Çok fazla yapay zekâ isteği gönderdiniz. Lütfen bir dakika bekleyip tekrar deneyin.'
} = {}) {
  return async function redisRateLimiterMiddleware(req, res, next) {
    const userId = req.session?.user?.id || req.user?.id || '';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const identity = userId ? `u:${userId}` : `ip:${ip}`;
    const key = `${prefix}:${identity}`;

    // 1. Redis aktifse atomik sayaç kullan
    if (isRedisReady()) {
      try {
        const count = await sharedClient.incr(key);
        if (count === 1) {
          await sharedClient.expire(key, windowSec);
        }
        if (count > maxRequests) {
          res.set('Retry-After', String(windowSec));
          return res.status(429).json({
            mesaj: message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfterSec: windowSec
          });
        }
        return next();
      } catch (err) {
        console.warn('[Redis-RateLimit] Redis erişilemedi, bellek yedeğine düşülüyor:', err.message);
      }
    }

    // 2. Bellek içi (In-Memory) güvenli yedek
    const now = Date.now();
    const windowMs = windowSec * 1000;
    let bucket = memoryRateBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      memoryRateBuckets.set(key, bucket);
    }
    bucket.count += 1;

    // Bellek sızıntısını önlemek için periyodik temizlik
    if (memoryRateBuckets.size > 2000) {
      for (const [k, b] of memoryRateBuckets.entries()) {
        if (now >= b.resetAt) memoryRateBuckets.delete(k);
      }
    }

    if (bucket.count > maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        mesaj: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSec
      });
    }

    return next();
  };
}

module.exports = {
  setRedisClient,
  getRedisClient,
  isRedisReady,
  buildHashKey,
  getCache,
  setCache,
  invalidatePattern,
  createRedisRateLimiter
};
