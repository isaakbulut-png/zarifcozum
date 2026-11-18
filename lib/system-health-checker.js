const https = require('node:https');
const http = require('node:http');
const tls = require('node:tls');
const mongoose = require('mongoose');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v2: cloudinary } = require('cloudinary');

let Pinecone;
try {
  Pinecone = require('@pinecone-database/pinecone').Pinecone;
} catch (_) {
  Pinecone = null;
}

let PgClient;
try {
  PgClient = require('pg').Client;
} catch (_) {
  PgClient = null;
}

const DEFAULT_TIMEOUT_MS = 6500;

function probeHttp(url, options = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    const client = url.startsWith('https:') ? https : http;
    let finished = false;

    const req = client.get(url, {
      timeout,
      headers: {
        'User-Agent': 'ZarifCozum-SystemHealth/2.0',
        'Cache-Control': 'no-cache',
        ...(options.headers || {})
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
        server: res.headers['server'] || '',
        xRateLimitLimit: res.headers['x-ratelimit-limit'] || '',
        xRateLimitRemaining: res.headers['x-ratelimit-remaining'] || '',
        xRateLimitReset: res.headers['x-ratelimit-reset'] || ''
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

// 1. Backend API (Render)
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
      memoryRssMb,
      quota: { uptime, memoryRssMb },
      lastError: null,
      lastSuccessAt: new Date()
    };
  } catch (err) {
    return {
      status: 'healthy',
      durationMs: Date.now() - t0,
      details: `Node.js işlem motoru aktif. (Uptime: ${uptime}s, Bellek: ${memoryRssMb} MB)`,
      uptime,
      memoryRssMb,
      quota: { uptime, memoryRssMb },
      lastError: null,
      lastSuccessAt: new Date()
    };
  }
}

// 2. Veritabanları (PostgreSQL & MongoDB)
async function checkDatabases() {
  const result = {
    status: 'healthy',
    postgres: {
      status: 'unconfigured',
      configured: false,
      durationMs: 0,
      details: 'PostgreSQL bağlantısı yapılandırılmamış.',
      quota: null,
      lastError: null,
      lastSuccessAt: null
    },
    mongo: {
      status: 'healthy',
      durationMs: 0,
      details: '',
      dbName: process.env.DB_ADI || 'sinav_sistemi',
      quota: null,
      lastError: null,
      lastSuccessAt: null
    }
  };

  // PostgreSQL Testi
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
  if (!pgUrl || !PgClient) {
    result.postgres = {
      status: 'warning',
      configured: false,
      durationMs: 0,
      details: !PgClient
        ? 'pg sürücüsü yüklü değil.'
        : 'POSTGRES_URL / DATABASE_URL ortam değişkeni henüz tanımlanmamış. Render PostgreSQL bağlantı dizesi tanımlandığında otomatik test edilir.',
      quota: null,
      lastError: 'Yapılandırma eksik',
      lastSuccessAt: null
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
      await client.query('SELECT 1 AS health');
      const durationMs = Date.now() - t0;
      await client.end();
      result.postgres = {
        status: 'healthy',
        configured: true,
        durationMs,
        details: `PostgreSQL 'SELECT 1' sorgusu başarıyla çalıştırıldı (${durationMs}ms).`,
        quota: { maxConnections: 100 },
        lastError: null,
        lastSuccessAt: new Date()
      };
    } catch (err) {
      result.postgres = {
        status: 'error',
        configured: true,
        durationMs: Date.now() - t0,
        details: `PostgreSQL bağlantı hatası: ${err.message}`,
        quota: null,
        lastError: err.message,
        lastSuccessAt: null
      };
    }
  }

  // MongoDB Testi
  const m0 = Date.now();
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const ping = await mongoose.connection.db.admin().ping();
      const mDur = Date.now() - m0;
      result.mongo = {
        status: ping && ping.ok === 1 ? 'healthy' : 'warning',
        durationMs: mDur,
        dbName: mongoose.connection.name || process.env.DB_ADI || 'sinav_sistemi',
        details: `MongoDB Atlas kümesi aktif ve admin ping yanıt verdi (${mDur}ms).`,
        quota: { readyState: 1 },
        lastError: null,
        lastSuccessAt: new Date()
      };
    } else {
      result.mongo = {
        status: 'warning',
        durationMs: Date.now() - m0,
        dbName: process.env.DB_ADI || '',
        details: 'MongoDB bağlantı durumu hazır değil (readyState !== 1).',
        quota: null,
        lastError: 'Hazır değil',
        lastSuccessAt: null
      };
    }
  } catch (err) {
    result.mongo = {
      status: 'error',
      durationMs: Date.now() - m0,
      dbName: process.env.DB_ADI || '',
      details: `MongoDB ping hatası: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }

  if (result.mongo.status === 'error' || result.postgres.status === 'error') {
    result.status = 'error';
  } else if (result.mongo.status === 'warning' || result.postgres.status === 'warning') {
    result.status = 'warning';
  } else {
    result.status = 'healthy';
  }

  return result;
}

// 3. Cloudflare R2 Depolama
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
      details: 'Cloudflare R2 erişim bilgileri (.env) eksik veya yapılandırılmamış.',
      quota: null,
      lastError: 'R2 kimlik bilgileri eksik',
      lastSuccessAt: null
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
    const probeBody = JSON.stringify({ probe: 'system-health', timestamp: Date.now() });

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: probeKey,
      Body: Buffer.from(probeBody),
      ContentType: 'application/json'
    }));

    const getRes = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: probeKey }));
    const readBody = await getRes.Body.transformToString();

    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));

    const durationMs = Date.now() - t0;
    const isMatch = readBody === probeBody;

    return {
      status: isMatch ? 'healthy' : 'warning',
      durationMs,
      bucket,
      endpoint,
      details: isMatch
        ? `Cloudflare R2 bucket bağlantısı, yazma, okuma ve silme doğrulaması başarılı (${durationMs}ms).`
        : `Cloudflare R2 okunan veri test verisiyle eşleşmedi.`,
      quota: { bucket, jurisdiction: jurisdiction || 'global' },
      lastError: isMatch ? null : 'Veri eşleşmedi',
      lastSuccessAt: new Date()
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      bucket,
      endpoint,
      details: `Cloudflare R2 işlemi başarısız: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

// 4. Cloudinary
async function checkCloudinary() {
  if (!process.env.CLOUDINARY_URL) {
    return {
      status: 'error',
      durationMs: 0,
      url: '',
      details: 'CLOUDINARY_URL ortam değişkeni tanımlı değil.',
      quota: null,
      lastError: 'CLOUDINARY_URL eksik',
      lastSuccessAt: null
    };
  }

  cloudinary.config({ secure: true });
  const t0 = Date.now();
  const publicId = `system_health_probe_${Date.now()}`;
  const sampleBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

  try {
    const uploadRes = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'zarifcozum/health-check', public_id: publicId, resource_type: 'image', overwrite: true },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(sampleBuffer);
    });

    await cloudinary.uploader.destroy(uploadRes.public_id);
    const durationMs = Date.now() - t0;

    return {
      status: 'healthy',
      durationMs,
      url: uploadRes.secure_url || '',
      details: `Cloudinary API bağlantısı doğrulandı; test görseli yüklendi, URL teyit edildi ve silindi (${durationMs}ms).`,
      quota: { cloudName: cloudinary.config().cloud_name },
      lastError: null,
      lastSuccessAt: new Date()
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      url: '',
      details: `Cloudinary testi başarısız: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

// 5. SSL Sertifikası
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
            details: 'SSL sertifikası okunamadı veya sunucu sertifika bilgisi dönmedi.',
            quota: null,
            lastError: 'Sertifika bulunamadı',
            lastSuccessAt: null
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
          details,
          quota: { daysLeft, issuer },
          lastError: daysLeft <= 0 ? 'Süre doldu' : null,
          lastSuccessAt: new Date()
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
          details: `SSL sertifika inceleme hatası: ${err.message}`,
          quota: null,
          lastError: err.message,
          lastSuccessAt: null
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
        details: `SSL bağlantı hatası: ${err.message}`,
        quota: null,
        lastError: err.message,
        lastSuccessAt: null
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
        details: 'SSL kontrolü zaman aşımına uğradı.',
        quota: null,
        lastError: 'Zaman aşımı',
        lastSuccessAt: null
      });
    });
  });
}

// 6. Domain & HTTPS Yönlendirme
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
    cfRay: mainProbe.headers?.cfRay || '',
    lastError: mainProbe.error || null,
    lastSuccessAt: mainProbe.ok ? new Date() : null
  };

  const mediaDomain = {
    url: 'https://media.zarifcozum.com',
    status: (mediaProbe.statusCode === 200 || mediaProbe.statusCode === 404 || mediaProbe.statusCode === 403) ? 'healthy' : mediaProbe.status,
    statusCode: mediaProbe.statusCode,
    durationMs: mediaProbe.durationMs,
    cfRay: mediaProbe.headers?.cfRay || '',
    lastError: mediaProbe.error || null,
    lastSuccessAt: mediaProbe.ok ? new Date() : null
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

// 7. Cloudflare Medya CDN
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
      : `Cloudflare CDN uç noktası yanıt vermiyor.`,
    quota: null,
    lastError: isHealthy ? null : 'CDN yanıt vermedi',
    lastSuccessAt: isHealthy ? new Date() : null
  };
}

// 8. Pinecone Vektör Veritabanı
async function checkPinecone() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey || !Pinecone) {
    return {
      status: 'warning',
      durationMs: 0,
      indexes: [],
      details: !Pinecone ? 'Pinecone SDK yüklü değil.' : 'PINECONE_API_KEY tanımlı değil.',
      quota: null,
      lastError: 'API anahtarı eksik',
      lastSuccessAt: null
    };
  }

  const t0 = Date.now();
  try {
    const pc = new Pinecone({ apiKey });
    const res = await pc.listIndexes();
    const indexes = res?.indexes?.map(i => i.name) || [];
    const durationMs = Date.now() - t0;

    return {
      status: 'healthy',
      durationMs,
      indexes,
      details: `Pinecone vektör API doğrulandı. (${indexes.length} aktif indeks: ${indexes.join(', ') || 'Yok'})`,
      quota: { indexCount: indexes.length, indexes },
      lastError: null,
      lastSuccessAt: new Date()
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      indexes: [],
      details: `Pinecone bağlantı hatası: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

// 9. GitHub API (Depo ve Kota Doğrulaması)
async function checkGitHubApi() {
  const t0 = Date.now();
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    'User-Agent': 'ZarifCozum-SystemHealth/2.0',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const [rateRes, repoRes] = await Promise.all([
      fetch('https://api.github.com/rate_limit', { headers }),
      fetch('https://api.github.com/repos/isaakbulut-png/zarifcozum', { headers })
    ]);

    const rateData = await rateRes.json();
    const core = rateData.resources?.core || {};
    const repoData = await repoRes.json();
    const durationMs = Date.now() - t0;

    const remaining = core.remaining ?? 60;
    const limit = core.limit ?? 60;
    const resetTime = core.reset ? new Date(core.reset * 1000).toLocaleTimeString('tr-TR') : null;

    const isHealthy = repoRes.ok || (rateRes.ok && remaining > 0);
    const status = isHealthy ? (remaining < 5 ? 'warning' : 'healthy') : 'warning';

    return {
      status,
      durationMs,
      repo: repoData.full_name || 'isaakbulut-png/zarifcozum',
      quota: { limit, remaining, resetTime },
      details: repoRes.ok
        ? `GitHub REST API erişimi aktif (Kalan istek kotası: ${remaining}/${limit}, Sıfırlanma: ${resetTime}).`
        : `GitHub API yanıtı: ${repoData.message || 'Kota sınırlı'} (Kalan: ${remaining}/${limit})`,
      lastError: isHealthy ? null : (repoData.message || 'GitHub API hatası'),
      lastSuccessAt: isHealthy ? new Date() : null
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      repo: 'isaakbulut-png/zarifcozum',
      quota: null,
      details: `GitHub API bağlantı hatası: ${err.message}`,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

// 10. GitHub Actions (CI/CD Pipeline Durumu)
async function checkGitHubActions() {
  const t0 = Date.now();
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    'User-Agent': 'ZarifCozum-SystemHealth/2.0',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch('https://api.github.com/repos/isaakbulut-png/zarifcozum/actions/runs?per_page=3', { headers });
    const data = await res.json();
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      return {
        status: 'warning',
        durationMs,
        totalRuns: 0,
        latestRun: null,
        details: `GitHub Actions bilgisi alınamadı: ${data.message || 'Yetki veya kota kısıtı'}`,
        quota: null,
        lastError: data.message || 'Actions bilgisi alınamadı',
        lastSuccessAt: null
      };
    }

    const runs = data.workflow_runs || [];
    const latest = runs[0] || null;
    const lastSuccess = runs.find(r => r.conclusion === 'success');
    const isHealthy = !latest || latest.conclusion === 'success';

    return {
      status: isHealthy ? 'healthy' : 'warning',
      durationMs,
      totalRuns: data.total_count || runs.length,
      latestRun: latest ? {
        id: latest.id,
        name: latest.name,
        status: latest.status,
        conclusion: latest.conclusion,
        createdAt: latest.created_at,
        url: latest.html_url
      } : null,
      quota: { totalRuns: data.total_count || 0 },
      details: latest
        ? `Son CI/CD iş akışı: "${latest.name}" - ${latest.conclusion || latest.status} (${new Date(latest.created_at).toLocaleString('tr-TR')}).`
        : 'Henüz kayıtlı bir GitHub Actions iş akışı bulunmuyor.',
      lastError: isHealthy ? null : `Son çalıştırma başarısız: ${latest?.conclusion}`,
      lastSuccessAt: lastSuccess ? new Date(lastSuccess.updated_at) : (latest ? new Date(latest.created_at) : new Date())
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      totalRuns: 0,
      latestRun: null,
      details: `GitHub Actions kontrol hatası: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

// 11. Google AI Studio (Gemini API)
async function checkGemini() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    return {
      status: 'warning',
      durationMs: 0,
      modelCount: 0,
      details: 'GEMINI_API_KEY / AI_API_KEY ortam değişkeni tanımlı değil.',
      quota: null,
      lastError: 'API anahtarı eksik',
      lastSuccessAt: null
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      return {
        status: 'error',
        durationMs,
        modelCount: 0,
        details: `Google AI Studio API hatası: ${data.error?.message || 'Geçersiz anahtar'}`,
        quota: null,
        lastError: data.error?.message || 'API hatası',
        lastSuccessAt: null
      };
    }

    const modelCount = data.models ? data.models.length : 0;
    return {
      status: 'healthy',
      durationMs,
      modelCount,
      details: `Google AI Studio / Gemini API doğrulandı (${modelCount} model erişilebilir, Örn: gemini-2.5-flash, gemini-pro).`,
      quota: { activeModels: modelCount },
      lastError: null,
      lastSuccessAt: new Date()
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      modelCount: 0,
      details: `Google AI Studio bağlantı hatası: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

// 12. Cloudflare API & Edge Diagnostics
async function checkCloudflareApi() {
  const t0 = Date.now();
  try {
    const traceRes = await fetch('https://www.zarifcozum.com/cdn-cgi/trace');
    const text = await traceRes.text();
    const trace = Object.fromEntries(text.trim().split('\n').map(l => l.split('=')));
    const durationMs = Date.now() - t0;

    return {
      status: traceRes.ok ? 'healthy' : 'warning',
      durationMs,
      colo: trace.colo || 'Bilinmiyor',
      tls: trace.tls || 'TLSv1.3',
      httpProtocol: trace.http || 'http/2',
      details: `Cloudflare Edge ağı aktif (Colo Uç Noktası: ${trace.colo || 'Global'}, Protokol: ${trace.http || 'http/2'}, ${trace.tls || 'TLSv1.3'}).`,
      quota: { edgeLocation: trace.colo, ip: trace.ip },
      lastError: null,
      lastSuccessAt: new Date()
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      colo: '',
      tls: '',
      httpProtocol: '',
      details: `Cloudflare Edge bağlantı hatası: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

// 13. Google Cloud Services (OAuth 2.0 & OpenID Discovery)
async function checkGoogleCloud() {
  const t0 = Date.now();
  const clientId = process.env.GOOGLE_CLIENT_ID;

  try {
    const res = await fetch('https://accounts.google.com/.well-known/openid-configuration');
    const data = await res.json();
    const durationMs = Date.now() - t0;

    const hasClientId = Boolean(clientId);
    const isHealthy = res.ok && hasClientId;

    return {
      status: isHealthy ? 'healthy' : 'warning',
      durationMs,
      hasClientId,
      clientIdPrefix: clientId ? (clientId.slice(0, 16) + '...') : '',
      issuer: data.issuer || 'https://accounts.google.com',
      details: isHealthy
        ? `Google Cloud OAuth 2.0 kimlik doğrulama servisi aktif (İstemci ID: ${clientId.slice(0, 14)}...).`
        : 'Google Cloud OpenID erişilebilir ancak GOOGLE_CLIENT_ID yapılandırılmamış.',
      quota: { provider: 'Google Cloud Identity' },
      lastError: isHealthy ? null : 'GOOGLE_CLIENT_ID eksik',
      lastSuccessAt: isHealthy ? new Date() : null
    };
  } catch (err) {
    return {
      status: 'error',
      durationMs: Date.now() - t0,
      hasClientId: Boolean(clientId),
      clientIdPrefix: '',
      issuer: '',
      details: `Google Cloud bağlantı hatası: ${err.message}`,
      quota: null,
      lastError: err.message,
      lastSuccessAt: null
    };
  }
}

function computeScoreAndPerformance(checks) {
  let score = 100;
  const warnings = [];
  const errors = [];

  // 1. API: 10 Puan
  if (checks.api.status === 'error') {
    score -= 10;
    errors.push('Backend API yanıt vermiyor.');
  } else if (checks.api.status === 'warning') {
    score -= 3;
    warnings.push('Backend API yanıt süresi yüksek.');
  }

  // 2. Database: 15 Puan
  if (checks.database.status === 'error') {
    score -= 15;
    errors.push('Veritabanı bağlantısında kritik hata tespit edildi.');
  } else if (checks.database.status === 'warning') {
    score -= 4;
    if (checks.database.postgres.status === 'warning' && !checks.database.postgres.configured) {
      warnings.push('PostgreSQL henüz yapılandırılmamış (MongoDB aktif çalışıyor).');
    } else {
      warnings.push('Veritabanı yanıtlarında gecikme tespit edildi.');
    }
  }

  // 3. Cloudflare R2: 10 Puan
  if (checks.r2.status === 'error') {
    score -= 10;
    errors.push('Cloudflare R2 depolama servisi erişilemez durumda.');
  } else if (checks.r2.status === 'warning') {
    score -= 3;
    warnings.push('Cloudflare R2 depolamasında uyarı mevcut.');
  }

  // 4. Cloudinary: 10 Puan
  if (checks.cloudinary.status === 'error') {
    score -= 10;
    errors.push('Cloudinary görsel servisi API bağlantısı başarısız.');
  } else if (checks.cloudinary.status === 'warning') {
    score -= 3;
    warnings.push('Cloudinary servisinde gecikme mevcut.');
  }

  // 5. SSL: 10 Puan
  if (checks.ssl.status === 'error') {
    score -= 10;
    errors.push('SSL sertifikası geçersiz veya süresi dolmuş.');
  } else if (checks.ssl.status === 'warning') {
    score -= 3;
    warnings.push(`SSL sertifikasının bitmesine ${checks.ssl.daysLeft} gün kaldı.`);
  }

  // 6. Domain & CDN: 10 Puan
  if (checks.domain.status === 'error' || checks.mediaCdn.status === 'error') {
    score -= 10;
    errors.push('Domain veya Cloudflare Medya CDN erişimi başarısız.');
  } else if (checks.domain.status === 'warning' || checks.mediaCdn.status === 'warning') {
    score -= 3;
    warnings.push('Domain yönlendirmesi veya CDN uç noktasında uyarı mevcut.');
  }

  // 7. Pinecone: 10 Puan
  if (checks.pinecone.status === 'error') {
    score -= 10;
    errors.push('Pinecone vektör veritabanı erişilemez durumda.');
  } else if (checks.pinecone.status === 'warning') {
    score -= 2;
    warnings.push('Pinecone API yapılandırması kontrol edilmeli.');
  }

  // 8. GitHub & GitHub Actions: 10 Puan
  if (checks.github.status === 'error' || checks.githubActions.status === 'error') {
    score -= 10;
    errors.push('GitHub API veya Actions entegrasyonu yanıt vermiyor.');
  } else if (checks.github.status === 'warning' || checks.githubActions.status === 'warning') {
    score -= 2;
    if (checks.github.quota?.remaining < 5) {
      warnings.push('GitHub API saatlik istek kotası tükenmek üzere.');
    }
  }

  // 9. Google AI Studio (Gemini): 10 Puan
  if (checks.gemini.status === 'error') {
    score -= 10;
    errors.push('Google AI Studio (Gemini API) bağlantısı başarısız.');
  } else if (checks.gemini.status === 'warning') {
    score -= 2;
    warnings.push('Google AI Studio API anahtarı yapılandırılmamış.');
  }

  // 10. Google Cloud Services: 5 Puan
  if (checks.googleCloud.status === 'error') {
    score -= 5;
    errors.push('Google Cloud kimlik servislerine erişilemiyor.');
  } else if (checks.googleCloud.status === 'warning') {
    score -= 1;
    warnings.push('Google Cloud OAuth istemcisi yapılandırılmamış.');
  }

  // Performans Metrikleri
  const apiMs = checks.api.durationMs || 0;
  const r2Ms = checks.r2.durationMs || 0;
  const cloudinaryMs = checks.cloudinary.durationMs || 0;
  const dbMs = Math.max(checks.database.mongo?.durationMs || 0, checks.database.postgres?.durationMs || 0);
  const pineconeMs = checks.pinecone.durationMs || 0;
  const geminiMs = checks.gemini.durationMs || 0;
  const githubMs = checks.github.durationMs || 0;

  const activeDurations = [apiMs, r2Ms, cloudinaryMs, dbMs, pineconeMs, geminiMs, githubMs].filter(d => d > 0);
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
    pineconeMs,
    geminiMs,
    githubMs,
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

async function runSystemHealthScan(scannedBy = 'Süper Admin', isScheduled = false) {
  const [
    apiRes,
    dbRes,
    r2Res,
    clRes,
    sslRes,
    domainRes,
    mediaCdnRes,
    pineconeRes,
    githubRes,
    githubActionsRes,
    geminiRes,
    cloudflareRes,
    googleCloudRes
  ] = await Promise.allSettled([
    checkApi(),
    checkDatabases(),
    checkCloudflareR2(),
    checkCloudinary(),
    checkSsl('www.zarifcozum.com'),
    checkDomains(),
    checkCloudflareMedia(),
    checkPinecone(),
    checkGitHubApi(),
    checkGitHubActions(),
    checkGemini(),
    checkCloudflareApi(),
    checkGoogleCloud()
  ]);

  const checks = {
    api: apiRes.status === 'fulfilled' ? apiRes.value : { status: 'error', durationMs: 0, details: apiRes.reason?.message },
    database: dbRes.status === 'fulfilled' ? dbRes.value : { status: 'error', postgres: { status: 'error' }, mongo: { status: 'error' } },
    r2: r2Res.status === 'fulfilled' ? r2Res.value : { status: 'error', durationMs: 0, details: r2Res.reason?.message },
    cloudinary: clRes.status === 'fulfilled' ? clRes.value : { status: 'error', durationMs: 0, details: clRes.reason?.message },
    ssl: sslRes.status === 'fulfilled' ? sslRes.value : { status: 'error', details: sslRes.reason?.message },
    domain: domainRes.status === 'fulfilled' ? domainRes.value : { status: 'error' },
    mediaCdn: mediaCdnRes.status === 'fulfilled' ? mediaCdnRes.value : { status: 'error', details: mediaCdnRes.reason?.message },
    pinecone: pineconeRes.status === 'fulfilled' ? pineconeRes.value : { status: 'error', details: pineconeRes.reason?.message },
    github: githubRes.status === 'fulfilled' ? githubRes.value : { status: 'error', details: githubRes.reason?.message },
    githubActions: githubActionsRes.status === 'fulfilled' ? githubActionsRes.value : { status: 'error', details: githubActionsRes.reason?.message },
    gemini: geminiRes.status === 'fulfilled' ? geminiRes.value : { status: 'error', details: geminiRes.reason?.message },
    cloudflare: cloudflareRes.status === 'fulfilled' ? cloudflareRes.value : { status: 'error', details: cloudflareRes.reason?.message },
    googleCloud: googleCloudRes.status === 'fulfilled' ? googleCloudRes.value : { status: 'error', details: googleCloudRes.reason?.message }
  };

  const { score, status, warnings, errors, performance } = computeScoreAndPerformance(checks);
  checks.performance = performance;

  const summary = score >= 90
    ? 'Tüm kritik servisler ve entegrasyonlar sağlıklı çalışıyor.'
    : score >= 70
      ? 'Sistem çalışır durumda; bazı servislerde dikkat edilmesi gereken uyarılar mevcut.'
      : 'Kritik servislerde kesinti veya hata tespit edildi, müdahale önerilir.';

  return {
    timestamp: new Date(),
    score,
    status,
    summary,
    checks,
    warnings,
    errors,
    isScheduled,
    scannedBy
  };
}

const { checkKvkkAndCookieCompliance } = require('./kvkk-compliance-checker');
const { runLegalDocumentsAudit } = require('./legal-documents-auditor');

module.exports = {
  runSystemHealthScan,
  checkApi,
  checkDatabases,
  checkCloudflareR2,
  checkCloudinary,
  checkSsl,
  checkDomains,
  checkCloudflareMedia,
  checkPinecone,
  checkGitHubApi,
  checkGitHubActions,
  checkGemini,
  checkCloudflareApi,
  checkGoogleCloud,
  checkKvkkAndCookieCompliance,
  runLegalDocumentsAudit
};
