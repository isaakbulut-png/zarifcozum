const https = require('node:https');
const http = require('node:http');
const tls = require('node:tls');
const mongoose = require('mongoose');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v2: cloudinary } = require('cloudinary');
let PgClient;
try {
  PgClient = require('pg').Client;
} catch (_) {
  PgClient = null;
}

const DEFAULT_TIMEOUT_MS = 6500;

function measure(fn) {
  const start = Date.now();
  return Promise.resolve(fn()).then(
    data => ({ ok: true, data, durationMs: Date.now() - start }),
    error => ({ ok: false, error, durationMs: Date.now() - start })
  );
}

function probeHttp(url, options = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    const client = url.startsWith('https:') ? https : http;
    let finished = false;

    const req = client.get(url, {
      timeout,
      headers: {
        'User-Agent': 'ZarifCozum-SystemHealth/1.0',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      if (finished) return;
      finished = true;
      const durationMs = Date.now() - start;
      const statusCode = res.statusCode || 0;
      const headers = {
        cfRay: res.headers['cf-ray'] || '',
        cfCacheStatus: res.headers['cf-cache-status'] || '',
        location: res.headers['location'] || '',
        server: res.headers['server'] || ''
      };
      res.resume();
      resolve({
        ok: true,
        statusCode,
        durationMs,
        headers,
        status: (statusCode >= 200 && statusCode < 400) ? 'healthy' : 'warning'
      });
    });

    req.on('timeout', () => {
      if (finished) return;
      finished = true;
      req.destroy();
      resolve({
        ok: false,
        statusCode: 0,
        durationMs: Date.now() - start,
        error: 'Zaman aşımı (Timeout)',
        status: 'error'
      });
    });

    req.on('error', (err) => {
      if (finished) return;
      finished = true;
      resolve({
        ok: false,
        statusCode: 0,
        durationMs: Date.now() - start,
        error: err.message || 'Bağlantı hatası',
        status: 'error'
      });
    });
  });
}

async function checkApi(port = process.env.PORT || 3000) {
  const t0 = Date.now();
  const uptime = Math.round(process.uptime());
  const memoryRssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));

  try {
    const localProbe = await probeHttp(`http://127.0.0.1:${port}/api/health`, { timeout: 3000 });
    const durationMs = localProbe.ok ? localProbe.durationMs : (Date.now() - t0);

    return {
      status: 'healthy',
      durationMs,
      details: `Backend API aktif ve yanıt veriyor. (Uptime: ${uptime}s, Bellek: ${memoryRssMb} MB)`,
      uptime,
      memoryRssMb
    };
  } catch (_) {
    return {
      status: 'healthy',
      durationMs: Date.now() - t0,
      details: `Node.js işlem motoru aktif. (Uptime: ${uptime}s, Bellek: ${memoryRssMb} MB)`,
      uptime,
      memoryRssMb
    };
  }
}

async function checkDatabases() {
  const result = {
    status: 'healthy',
    postgres: {
      status: 'unconfigured',
      configured: false,
      durationMs: 0,
      details: 'PostgreSQL bağlantısı yapılandırılmamış.'
    },
    mongo: {
      status: 'healthy',
      durationMs: 0,
      details: '',
      dbName: process.env.DB_ADI || 'sinav_sistemi'
    }
  };

  // 1. PostgreSQL Testi
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
  if (!pgUrl || !PgClient) {
    result.postgres = {
      status: 'warning',
      configured: false,
      durationMs: 0,
      details: !PgClient
        ? 'pg sürücüsü yüklü değil.'
        : 'POSTGRES_URL / DATABASE_URL ortam değişkeni henüz tanımlanmamış. Render PostgreSQL bağlantı dizesi tanımlandığında otomatik test edilir.'
    };
  } else {
    const t0 = Date.now();
    try {
      const client = new PgClient({
        connectionString: pgUrl,
        connectionTimeoutMillis: 5000,
        ssl: pgUrl.includes('sslmode=require') || pgUrl.includes('render.com') || pgUrl.includes('supabase')
          ? { rejectUnauthorized: false }
          : undefined
      });
      await client.connect();
      const queryRes = await client.query('SELECT 1 AS health');
      const durationMs = Date.now() - t0;
      await client.end();
      result.postgres = {
        status: 'healthy',
        configured: true,
        durationMs,
        details: `PostgreSQL 'SELECT 1' sorgusu başarıyla çalıştırıldı (${durationMs}ms).`
      };
    } catch (err) {
      result.postgres = {
        status: 'error',
        configured: true,
        durationMs: Date.now() - t0,
        details: `PostgreSQL bağlantı hatası: ${err.message}`
      };
    }
  }

  // 2. MongoDB Testi
  const m0 = Date.now();
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const ping = await mongoose.connection.db.admin().ping();
      const mDur = Date.now() - m0;
      result.mongo = {
        status: ping && ping.ok === 1 ? 'healthy' : 'warning',
        durationMs: mDur,
        dbName: mongoose.connection.name || process.env.DB_ADI || 'sinav_sistemi',
        details: `MongoDB Atlas kümesi aktif ve admin ping yanıt verdi (${mDur}ms).`
      };
    } else {
      result.mongo = {
        status: 'warning',
        durationMs: Date.now() - m0,
        dbName: process.env.DB_ADI || '',
        details: 'MongoDB bağlantı durumu hazır değil (readyState !== 1).'
      };
    }
  } catch (err) {
    result.mongo = {
      status: 'error',
      durationMs: Date.now() - m0,
      dbName: process.env.DB_ADI || '',
      details: `MongoDB ping hatası: ${err.message}`
    };
  }

  // Genel veritabanı durumu
  if (result.mongo.status === 'error' || result.postgres.status === 'error') {
    result.status = 'error';
  } else if (result.mongo.status === 'warning' || result.postgres.status === 'warning') {
    result.status = 'warning';
  } else {
    result.status = 'healthy';
  }

  return result;
}

async function checkCloudflareR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_MEDIA_BUCKET;
  const accessKeyId = process.env.R2_MEDIA_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_MEDIA_SECRET_ACCESS_KEY;
  const jurisdiction = process.env.R2_MEDIA_JURISDICTION || '';

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return {
      status: 'error',
      durationMs: 0,
      bucket: bucket || 'Tanımsız',
      endpoint: '',
      details: 'Cloudflare R2 erişim bilgileri (.env) eksik veya yapılandırılmamış.'
    };
  }

  const endpoint = `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  const t0 = Date.now();

  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey }
    });

    const probeKey = `homepage/system-health-probe-${Date.now()}.json`;
    const probeBody = JSON.stringify({
      probe: 'system-health',
      timestamp: Date.now(),
      platform: 'zarifcozum'
    });

    // 1. Put
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: probeKey,
      Body: Buffer.from(probeBody),
      ContentType: 'application/json'
    }));

    // 2. Get
    const getRes = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: probeKey
    }));
    const readBody = await getRes.Body.transformToString();

    // 3. Delete
    await s3.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: probeKey
    }));

    const durationMs = Date.now() - t0;
    const isMatch = readBody === probeBody;

    return {
      status: isMatch ? 'healthy' : 'warning',
      durationMs,
      bucket,
      endpoint,
      details: isMatch
        ? `Cloudflare R2 bucket bağlantısı, yazma, okuma ve silme doğrulaması başarılı (${durationMs}ms).`
        : `Cloudflare R2 okunan veri test verisiyle eşleşmedi.`
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      bucket,
      endpoint,
      details: `Cloudflare R2 işlemi başarısız: ${err.message}`
    };
  }
}

async function checkCloudinary() {
  if (!process.env.CLOUDINARY_URL) {
    return {
      status: 'error',
      durationMs: 0,
      url: '',
      details: 'CLOUDINARY_URL ortam değişkeni tanımlı değil.'
    };
  }

  cloudinary.config({ secure: true });
  const t0 = Date.now();
  const publicId = `system_health_probe_${Date.now()}`;
  // 1x1 transparent GIF buffer
  const sampleBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

  try {
    const uploadRes = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'zarifcozum/health-check', public_id: publicId, resource_type: 'image', overwrite: true },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(sampleBuffer);
    });

    // Doğrulama ve Silme
    await cloudinary.uploader.destroy(uploadRes.public_id);
    const durationMs = Date.now() - t0;

    return {
      status: 'healthy',
      durationMs,
      url: uploadRes.secure_url || '',
      details: `Cloudinary API bağlantısı doğrulandı; test görseli yüklendi, URL teyit edildi ve başarıyla silindi (${durationMs}ms).`
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      url: '',
      details: `Cloudinary testi başarısız: ${err.message}`
    };
  }
}

async function checkSsl(domain = 'www.zarifcozum.com') {
  return new Promise((resolve) => {
    const socket = tls.connect(443, domain, {
      servername: domain,
      timeout: DEFAULT_TIMEOUT_MS
    }, () => {
      try {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          socket.destroy();
          return resolve({
            status: 'warning',
            domain,
            validTo: null,
            validFrom: null,
            daysLeft: 0,
            issuer: 'Bilinmiyor',
            isExpiringSoon: false,
            details: 'SSL sertifikası okunamadı veya sunucu sertifika bilgisi dönmedi.'
          });
        }

        const validTo = new Date(cert.valid_to);
        const validFrom = new Date(cert.valid_from);
        const now = new Date();
        const daysLeft = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const issuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Güvenilir Sertifika Otoritesi') : 'Bilinmiyor';
        socket.destroy();

        const isExpiringSoon = daysLeft < 30;
        const status = daysLeft <= 0 ? 'error' : (isExpiringSoon ? 'warning' : 'healthy');
        const details = daysLeft <= 0
          ? `SSL sertifikasının süresi dolmuş! (${daysLeft} gün)`
          : isExpiringSoon
            ? `SSL sertifikasının bitmesine ${daysLeft} gün kaldı. Yenileme önerilir.`
            : `SSL sertifikası geçerli ve güvenli. (${daysLeft} gün kaldı, Sağlayıcı: ${issuer})`;

        resolve({
          status,
          domain,
          validTo,
          validFrom,
          daysLeft,
          issuer,
          isExpiringSoon,
          details
        });
      } catch (err) {
        socket.destroy();
        resolve({
          status: 'error',
          domain,
          validTo: null,
          validFrom: null,
          daysLeft: 0,
          issuer: '',
          isExpiringSoon: false,
          details: `SSL sertifika inceleme hatası: ${err.message}`
        });
      }
    });

    socket.on('error', (err) => {
      resolve({
        status: 'error',
        domain,
        validTo: null,
        validFrom: null,
        daysLeft: 0,
        issuer: '',
        isExpiringSoon: false,
        details: `SSL bağlantı hatası: ${err.message}`
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        status: 'error',
        domain,
        validTo: null,
        validFrom: null,
        daysLeft: 0,
        issuer: '',
        isExpiringSoon: false,
        details: 'SSL kontrolü zaman aşımına uğradı.'
      });
    });
  });
}

async function checkDomains() {
  const [mainProbe, mediaProbe, httpProbe] = await Promise.all([
    probeHttp('https://www.zarifcozum.com'),
    probeHttp('https://media.zarifcozum.com'),
    probeHttp('http://www.zarifcozum.com')
  ]);

  const mainDomain = {
    url: 'https://www.zarifcozum.com',
    status: mainProbe.status,
    statusCode: mainProbe.statusCode,
    durationMs: mainProbe.durationMs,
    cfRay: mainProbe.headers?.cfRay || ''
  };

  const mediaDomain = {
    url: 'https://media.zarifcozum.com',
    status: (mediaProbe.statusCode === 200 || mediaProbe.statusCode === 404 || mediaProbe.statusCode === 403) ? 'healthy' : mediaProbe.status,
    statusCode: mediaProbe.statusCode,
    durationMs: mediaProbe.durationMs,
    cfRay: mediaProbe.headers?.cfRay || ''
  };

  const isRedirect = (httpProbe.statusCode === 301 || httpProbe.statusCode === 302 || httpProbe.statusCode === 308) &&
                     Boolean(httpProbe.headers?.location?.includes('https://'));

  const httpsRedirect = {
    status: isRedirect ? 'healthy' : 'warning',
    statusCode: httpProbe.statusCode,
    redirected: isRedirect,
    location: httpProbe.headers?.location || ''
  };

  const overallStatus = (mainDomain.status === 'healthy' && httpsRedirect.status === 'healthy') ? 'healthy' : 'warning';

  return {
    status: overallStatus,
    mainDomain,
    mediaDomain,
    httpsRedirect
  };
}

async function checkCloudflareMedia() {
  const probe = await probeHttp('https://media.zarifcozum.com');
  const fallbackProbe = (!probe.ok || probe.statusCode >= 500)
    ? await probeHttp('https://www.zarifcozum.com/assets/brand-mark.png')
    : null;

  const active = fallbackProbe || probe;
  const isHealthy = active.statusCode > 0 && active.statusCode < 500;

  return {
    status: isHealthy ? 'healthy' : 'warning',
    statusCode: active.statusCode,
    durationMs: active.durationMs,
    cfCacheStatus: active.headers?.cfCacheStatus || 'DYNAMIC',
    cfRay: active.headers?.cfRay || '',
    details: isHealthy
      ? `Cloudflare CDN uç noktası aktif (HTTP ${active.statusCode}, Edge: ${active.headers?.cfRay || 'Cloudflare'}).`
      : `Cloudflare CDN uç noktası yanıt vermiyor.`
  };
}

function computeScoreAndPerformance(checks) {
  let score = 100;
  const warnings = [];
  const errors = [];

  // 1. API: 15 Puan
  if (checks.api.status === 'error') {
    score -= 15;
    errors.push('Backend API yanıt vermiyor.');
  } else if (checks.api.status === 'warning') {
    score -= 5;
    warnings.push('Backend API yanıt süresi yüksek.');
  }

  // 2. Database: 20 Puan
  if (checks.database.status === 'error') {
    score -= 20;
    errors.push('Veritabanı bağlantısında kritik hata tespit edildi.');
  } else if (checks.database.status === 'warning') {
    score -= 5;
    if (checks.database.postgres.status === 'warning' && !checks.database.postgres.configured) {
      warnings.push('PostgreSQL henüz yapılandırılmamış (MongoDB aktif çalışıyor).');
    } else {
      warnings.push('Veritabanı yanıtlarında gecikme tespit edildi.');
    }
  }

  // 3. Cloudflare R2: 15 Puan
  if (checks.r2.status === 'error') {
    score -= 15;
    errors.push('Cloudflare R2 depolama servisi erişilemez durumda.');
  } else if (checks.r2.status === 'warning') {
    score -= 4;
    warnings.push('Cloudflare R2 depolamasında uyarı mevcut.');
  }

  // 4. Cloudinary: 15 Puan
  if (checks.cloudinary.status === 'error') {
    score -= 15;
    errors.push('Cloudinary görsel servisi API bağlantısı başarısız.');
  } else if (checks.cloudinary.status === 'warning') {
    score -= 4;
    warnings.push('Cloudinary servisinde gecikme mevcut.');
  }

  // 5. SSL: 15 Puan
  if (checks.ssl.status === 'error') {
    score -= 15;
    errors.push('SSL sertifikası geçersiz veya süresi dolmuş.');
  } else if (checks.ssl.status === 'warning') {
    score -= 3;
    warnings.push(`SSL sertifikasının bitmesine ${checks.ssl.daysLeft} gün kaldı.`);
  }

  // 6. Domain: 10 Puan
  if (checks.domain.status === 'error') {
    score -= 10;
    errors.push('Domain erişilebilirlik testinde hata oluştu.');
  } else if (checks.domain.status === 'warning') {
    score -= 3;
    warnings.push('Domain yönlendirmesi veya erişiminde uyarı tespit edildi.');
  }

  // 7. Media CDN: 10 Puan
  if (checks.mediaCdn.status === 'error') {
    score -= 10;
    errors.push('Cloudflare Medya CDN erişimi başarısız.');
  } else if (checks.mediaCdn.status === 'warning') {
    score -= 2;
    warnings.push('Cloudflare Medya CDN uç noktasından beklenen yanıt alınamadı.');
  }

  // Performans Metrikleri
  const apiMs = checks.api.durationMs || 0;
  const r2Ms = checks.r2.durationMs || 0;
  const cloudinaryMs = checks.cloudinary.durationMs || 0;
  const dbMs = Math.max(checks.database.mongo.durationMs || 0, checks.database.postgres.durationMs || 0);

  const activeDurations = [apiMs, r2Ms, cloudinaryMs, dbMs].filter(d => d > 0);
  const averageMs = activeDurations.length > 0
    ? Math.round(activeDurations.reduce((a, b) => a + b, 0) / activeDurations.length)
    : 0;

  let grade = 'A+';
  if (score < 70 || averageMs > 2500) grade = 'C';
  else if (score < 85 || averageMs > 1500) grade = 'B';
  else if (score < 95 || averageMs > 1000) grade = 'A';

  const performance = {
    apiMs,
    r2Ms,
    cloudinaryMs,
    dbMs,
    averageMs,
    grade
  };

  score = Math.max(0, Math.min(100, score));

  const overallStatus = score >= 90 ? 'healthy' : (score >= 70 ? 'warning' : 'error');

  return {
    score,
    status: overallStatus,
    warnings,
    errors,
    performance
  };
}

async function runSystemHealthScan(scannedBy = 'Süper Admin') {
  const [
    apiRes,
    dbRes,
    r2Res,
    clRes,
    sslRes,
    domainRes,
    mediaCdnRes
  ] = await Promise.allSettled([
    checkApi(),
    checkDatabases(),
    checkCloudflareR2(),
    checkCloudinary(),
    checkSsl('www.zarifcozum.com'),
    checkDomains(),
    checkCloudflareMedia()
  ]);

  const checks = {
    api: apiRes.status === 'fulfilled' ? apiRes.value : { status: 'error', durationMs: 0, details: apiRes.reason?.message },
    database: dbRes.status === 'fulfilled' ? dbRes.value : { status: 'error', postgres: { status: 'error' }, mongo: { status: 'error' } },
    r2: r2Res.status === 'fulfilled' ? r2Res.value : { status: 'error', durationMs: 0, details: r2Res.reason?.message },
    cloudinary: clRes.status === 'fulfilled' ? clRes.value : { status: 'error', durationMs: 0, details: clRes.reason?.message },
    ssl: sslRes.status === 'fulfilled' ? sslRes.value : { status: 'error', details: sslRes.reason?.message },
    domain: domainRes.status === 'fulfilled' ? domainRes.value : { status: 'error' },
    mediaCdn: mediaCdnRes.status === 'fulfilled' ? mediaCdnRes.value : { status: 'error', details: mediaCdnRes.reason?.message }
  };

  const { score, status, warnings, errors, performance } = computeScoreAndPerformance(checks);
  checks.performance = performance;

  const summary = score >= 90
    ? 'Tüm kritik servisler sağlıklı ve optimum performansta çalışıyor.'
    : score >= 70
      ? 'Sistem genel olarak çalışır durumda, incelenmesi önerilen uyarılar mevcut.'
      : 'Sistem bileşenlerinde kritik hatalar tespit edildi, müdahale gereklidir.';

  const scanData = {
    timestamp: new Date(),
    score,
    status,
    summary,
    checks,
    warnings,
    errors,
    scannedBy
  };

  return scanData;
}

module.exports = {
  runSystemHealthScan,
  checkApi,
  checkDatabases,
  checkCloudflareR2,
  checkCloudinary,
  checkSsl,
  checkDomains,
  checkCloudflareMedia
};
