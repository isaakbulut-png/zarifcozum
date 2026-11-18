import React, { useState, useEffect, useCallback } from 'react';

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unconfigured';

export interface ServiceItemCheck {
  status: HealthStatus;
  durationMs: number;
  details: string;
  quota?: any;
  lastError?: string | null;
  lastSuccessAt?: string | null;
}

export interface ApiCheck extends ServiceItemCheck {
  uptime: number;
  memoryRssMb: number;
}

export interface PostgresCheck extends ServiceItemCheck {
  configured: boolean;
}

export interface MongoCheck extends ServiceItemCheck {
  dbName: string;
}

export interface DatabaseCheck {
  status: HealthStatus;
  postgres: PostgresCheck;
  mongo: MongoCheck;
}

export interface R2Check extends ServiceItemCheck {
  bucket: string;
  endpoint: string;
}

export interface CloudinaryCheck extends ServiceItemCheck {
  url: string;
}

export interface SslCheck extends ServiceItemCheck {
  domain: string;
  validTo: string | null;
  validFrom: string | null;
  daysLeft: number;
  issuer: string;
  isExpiringSoon: boolean;
}

export interface DomainItem {
  url: string;
  status: HealthStatus;
  statusCode: number;
  durationMs: number;
  cfRay?: string;
}

export interface DomainCheck {
  status: HealthStatus;
  mainDomain: DomainItem;
  mediaDomain: DomainItem;
  httpsRedirect: {
    status: HealthStatus;
    statusCode: number;
    redirected: boolean;
    location: string;
  };
}

export interface MediaCdnCheck extends ServiceItemCheck {
  statusCode: number;
  cfCacheStatus: string;
  cfRay: string;
}

export interface PerformanceMetrics {
  apiMs: number;
  r2Ms: number;
  cloudinaryMs: number;
  dbMs: number;
  pineconeMs?: number;
  geminiMs?: number;
  githubMs?: number;
  averageMs: number;
  grade: 'A+' | 'A' | 'B' | 'C';
}

export interface SystemHealthScan {
  _id?: string;
  timestamp: string;
  score: number;
  status: HealthStatus;
  summary: string;
  checks: {
    api: ApiCheck;
    database: DatabaseCheck;
    r2: R2Check;
    cloudinary: CloudinaryCheck;
    ssl: SslCheck;
    domain: DomainCheck;
    mediaCdn: MediaCdnCheck;
    pinecone: ServiceItemCheck;
    github: ServiceItemCheck;
    githubActions: ServiceItemCheck;
    gemini: ServiceItemCheck;
    cloudflare: ServiceItemCheck;
    googleCloud: ServiceItemCheck;
    performance: PerformanceMetrics;
  };
  warnings: string[];
  errors: string[];
  isScheduled?: boolean;
  scannedBy: string;
}

export interface SystemHealthLogItem {
  _id: string;
  timestamp: string;
  score: number;
  status: HealthStatus;
  summary: string;
  warnings: string[];
  errors: string[];
  isScheduled?: boolean;
  checks?: {
    performance?: PerformanceMetrics;
  };
  scannedBy: string;
  createdAt: string;
}

export const SystemHealth: React.FC = () => {
  const [scan, setScan] = useState<SystemHealthScan | null>(null);
  const [logs, setLogs] = useState<SystemHealthLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  const fetchInitialData = useCallback(async () => {
    setInitialLoading(true);
    setErrorMsg(null);
    try {
      const [latestRes, logsRes] = await Promise.all([
        fetch('/api/admin/system-health/latest').then(r => r.json()),
        fetch('/api/admin/system-health/logs?limit=30').then(r => r.json())
      ]);

      if (latestRes.scan) setScan(latestRes.scan);
      if (logsRes.logs) setLogs(logsRes.logs);
    } catch (err: any) {
      setErrorMsg('Sistem verileri yüklenemedi: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleStartScan = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/system-health/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mesaj || 'Tarama başarısız oldu.');

      setScan(data.scan);
      const logsRes = await fetch('/api/admin/system-health/logs?limit=30').then(r => r.json());
      if (logsRes.logs) setLogs(logsRes.logs);
    } catch (err: any) {
      setErrorMsg('Tarama sırasında hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ✅ Sağlıklı
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            ⚠️ Uyarı
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            ❌ Hata
          </span>
        );
      case 'unconfigured':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            ⚪ Yapılandırılmadı
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 border-emerald-500';
    if (score >= 70) return 'text-amber-600 border-amber-500';
    return 'text-rose-600 border-rose-500';
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return '—';
    }
  };

  const renderServiceMeta = (item?: ServiceItemCheck) => {
    if (!item) return null;
    return (
      <div className="space-y-1 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        {item.lastError && (
          <div className="text-rose-600 bg-rose-50/80 px-2 py-0.5 rounded font-mono truncate" title={item.lastError}>
            ⚠️ Hata: {item.lastError}
          </div>
        )}
        <div className="flex justify-between items-center text-slate-400">
          <span>Son Başarılı Kontrol:</span>
          <span className="font-mono text-slate-600">{formatTime(item.lastSuccessAt)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="system-health-dashboard font-sans text-slate-800 space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Top Header Bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20 text-xl">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Sistem Sağlığı ve Güvenlik Kontrolü</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  ⏰ Otomatik Tarama: Her gün 08:00
                </span>
              </div>
              <p className="text-sm text-slate-500">Render, PostgreSQL, MongoDB, Cloudflare R2, Cloudinary, SSL, CDN, Pinecone, GitHub, Gemini &amp; Google Cloud</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              📊 Anlık Durum
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              📜 Son 30 Tarama ({logs.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleStartScan}
            disabled={loading}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Sistem Taranıyor...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Sistem Taraması Başlat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Critical Failure Warning Banner */}
      {scan && (scan.status === 'error' || scan.errors.length > 0) && (
        <div className="bg-rose-50 border-2 border-rose-500 text-rose-900 rounded-2xl p-5 shadow-sm flex items-start gap-4">
          <span className="text-3xl">🚨</span>
          <div className="flex-1">
            <h3 className="font-bold text-base text-rose-900">Kritik Servis Uyarısı! Sistem Müdahalesi Gerekli</h3>
            <p className="text-xs text-rose-700 mt-1">Aşağıdaki servislerde hata veya kesinti tespit edildi. Otomatik bildirim ve audit kaydı oluşturuldu:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-xs font-semibold text-rose-800">
              {scan.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-6 text-center animate-pulse">
          <div className="inline-block w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <h3 className="text-base font-semibold text-amber-900">Tüm Servisler ve API Uç Noktaları Taranıyor...</h3>
          <p className="text-xs text-amber-700 mt-1">Render API, PostgreSQL, MongoDB, R2, Cloudinary, SSL, CDN, Pinecone, GitHub, Gemini, Cloudflare ve Google Cloud kontrolleri çalıştırılıyor.</p>
        </div>
      )}

      {activeTab === 'overview' && scan && (
        <>
          {/* Score & Summary Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Box */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Genel Sistem Durumu</span>
              <div className={`w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center ${getScoreColor(scan.score)} shadow-inner`}>
                <span className="text-4xl font-extrabold tracking-tight">{scan.score}</span>
                <span className="text-xs font-semibold text-slate-500">/ 100</span>
              </div>
              <div className="mt-4">
                {getStatusBadge(scan.status)}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Son Tarama: {new Date(scan.timestamp).toLocaleString('tr-TR')}
                {scan.isScheduled && <span className="ml-1 text-blue-600 font-semibold">(Otomatik 08:00)</span>}
              </p>
            </div>

            {/* Quick Status List & Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Teşhis Özeti ve Servis Durumları</h3>
                <p className="text-sm text-slate-600 mb-4">{scan.summary}</p>

                {/* Grid checklist (13 services) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.api.status === 'healthy' ? '✅' : '⚠️'}</span>
                    <span className="truncate">Backend API</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.database.status === 'healthy' ? '✅' : '⚠️'}</span>
                    <span className="truncate">PostgreSQL / Mongo</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.r2.status === 'healthy' ? '✅' : '⚠️'}</span>
                    <span className="truncate">Cloudflare R2</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.cloudinary.status === 'healthy' ? '✅' : '⚠️'}</span>
                    <span className="truncate">Cloudinary</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.ssl.status === 'healthy' ? '✅' : '⚠️'}</span>
                    <span className="truncate">SSL / TLS</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.domain.status === 'healthy' ? '✅' : '⚠️'}</span>
                    <span className="truncate">Domain &amp; CDN</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.pinecone?.status === 'healthy' ? '✅' : (scan.checks.pinecone?.status === 'warning' ? '⚠️' : '❌')}</span>
                    <span className="truncate">Pinecone</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.github?.status === 'healthy' ? '✅' : (scan.checks.github?.status === 'warning' ? '⚠️' : '❌')}</span>
                    <span className="truncate">GitHub API</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.githubActions?.status === 'healthy' ? '✅' : (scan.checks.githubActions?.status === 'warning' ? '⚠️' : '❌')}</span>
                    <span className="truncate">GitHub Actions</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.gemini?.status === 'healthy' ? '✅' : (scan.checks.gemini?.status === 'warning' ? '⚠️' : '❌')}</span>
                    <span className="truncate">Google AI Studio</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.cloudflare?.status === 'healthy' ? '✅' : (scan.checks.cloudflare?.status === 'warning' ? '⚠️' : '❌')}</span>
                    <span className="truncate">Cloudflare API</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium">
                    <span>{scan.checks.googleCloud?.status === 'healthy' ? '✅' : (scan.checks.googleCloud?.status === 'warning' ? '⚠️' : '❌')}</span>
                    <span className="truncate">Google Cloud</span>
                  </div>
                </div>
              </div>

              {/* Warnings and Notes */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                {scan.warnings.length > 0 && (
                  <div className="space-y-1">
                    {scan.warnings.map((w, i) => (
                      <div key={i} className="text-xs text-amber-700 bg-amber-50/70 p-2 rounded-lg flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
                {scan.errors.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {scan.errors.map((e, i) => (
                      <div key={i} className="text-xs text-rose-700 bg-rose-50/70 p-2 rounded-lg flex items-center gap-2">
                        <span>❌</span>
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service Cards Grid (13 Detailed Services) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. API Kontrolü */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Backend API (Render)</h4>
                    <span className="text-[11px] text-slate-400">/api/health</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.api.status)}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.api.details}</p>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Yanıt Süresi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.api.durationMs} ms</span>
              </div>
              {renderServiceMeta(scan.checks.api)}
            </div>

            {/* 2. Veritabanı Kontrolü */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🗄️</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Veritabanı Servisleri</h4>
                    <span className="text-[11px] text-slate-400">PostgreSQL &amp; MongoDB</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.database.status)}
              </div>
              <div className="space-y-2 mb-3">
                <div className="bg-slate-50 p-2 rounded-lg text-xs">
                  <div className="flex justify-between font-medium">
                    <span>🐘 PostgreSQL:</span>
                    <span>{getStatusBadge(scan.checks.database.postgres.status)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{scan.checks.database.postgres.details}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg text-xs">
                  <div className="flex justify-between font-medium">
                    <span>🍃 MongoDB Atlas:</span>
                    <span>{getStatusBadge(scan.checks.database.mongo.status)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{scan.checks.database.mongo.details}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>MongoDB Ping:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.database.mongo.durationMs} ms</span>
              </div>
              {renderServiceMeta(scan.checks.database.mongo)}
            </div>

            {/* 3. Cloudflare R2 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📦</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Cloudflare R2 Depolama</h4>
                    <span className="text-[11px] text-slate-400">{scan.checks.r2.bucket || 'S3 Bucket'}</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.r2.status)}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.r2.details}</p>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>R/W/D Döngü Süresi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.r2.durationMs} ms</span>
              </div>
              {renderServiceMeta(scan.checks.r2)}
            </div>

            {/* 4. Cloudinary */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🖼️</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Cloudinary Medya API</h4>
                    <span className="text-[11px] text-slate-400">Görsel Yönetim Servisi</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.cloudinary.status)}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.cloudinary.details}</p>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Yükleme &amp; Silme:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.cloudinary.durationMs} ms</span>
              </div>
              {renderServiceMeta(scan.checks.cloudinary)}
            </div>

            {/* 5. SSL Sertifikası */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">SSL / TLS Sertifikası</h4>
                    <span className="text-[11px] text-slate-400">{scan.checks.ssl.domain}</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.ssl.status)}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.ssl.details}</p>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Kalan Geçerlilik:</span>
                <span className={`font-mono px-2 py-0.5 rounded ${scan.checks.ssl.daysLeft < 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                  {scan.checks.ssl.daysLeft} gün
                </span>
              </div>
              {renderServiceMeta(scan.checks.ssl)}
            </div>

            {/* 6. Domain & HTTPS Yönlendirmesi */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🌐</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Domain &amp; HTTPS Yönlendirme</h4>
                    <span className="text-[11px] text-slate-400">DNS &amp; Cloudflare Edge</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.domain.status)}
              </div>
              <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                <div className="flex justify-between">
                  <span>www.zarifcozum.com:</span>
                  <span className="font-mono text-emerald-700 font-semibold">HTTP {scan.checks.domain.mainDomain.statusCode} ({scan.checks.domain.mainDomain.durationMs}ms)</span>
                </div>
                <div className="flex justify-between">
                  <span>media.zarifcozum.com:</span>
                  <span className="font-mono text-slate-600">HTTP {scan.checks.domain.mediaDomain.statusCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>HTTP &gt; HTTPS:</span>
                  <span className="text-emerald-700 font-semibold">{scan.checks.domain.httpsRedirect.redirected ? '301 Yönlendirildi ✅' : 'Doğrudan ⚠️'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Cloudflare CDN:</span>
                <span className="text-slate-700 font-mono text-[11px]">{scan.checks.mediaCdn.cfCacheStatus || 'DYNAMIC'}</span>
              </div>
              {renderServiceMeta(scan.checks.mediaCdn)}
            </div>

            {/* 7. Pinecone Vektör Veritabanı */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🌲</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Pinecone Vektör DB</h4>
                    <span className="text-[11px] text-slate-400">Semantik Arama &amp; Müfredat</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.pinecone?.status || 'unconfigured')}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.pinecone?.details}</p>
              {scan.checks.pinecone?.quota && (
                <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3">
                  <span className="font-semibold text-slate-700">İndeksler:</span> {(scan.checks.pinecone.quota.indexes || []).join(', ') || 'Yok'}
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Yanıt Süresi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.pinecone?.durationMs || 0} ms</span>
              </div>
              {renderServiceMeta(scan.checks.pinecone)}
            </div>

            {/* 8. GitHub API */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🐙</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">GitHub REST API</h4>
                    <span className="text-[11px] text-slate-400">Depo &amp; Sürüm Yönetimi</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.github?.status || 'unconfigured')}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.github?.details}</p>
              {scan.checks.github?.quota && (
                <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 flex justify-between items-center">
                  <span>API Kota Durumu:</span>
                  <span className="font-mono font-bold text-slate-800">{scan.checks.github.quota.rateLimitRemaining} / {scan.checks.github.quota.rateLimitLimit} req</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Yanıt Süresi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.github?.durationMs || 0} ms</span>
              </div>
              {renderServiceMeta(scan.checks.github)}
            </div>

            {/* 9. GitHub Actions (CI/CD) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">⚙️</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">GitHub Actions (CI/CD)</h4>
                    <span className="text-[11px] text-slate-400">Workflow &amp; Otomatik Dağıtım</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.githubActions?.status || 'unconfigured')}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.githubActions?.details}</p>
              {scan.checks.githubActions?.quota && (
                <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 space-y-1">
                  <div className="flex justify-between">
                    <span>Son İş Akışı:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[140px]">{scan.checks.githubActions.quota.latestWorkflowName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sonuç:</span>
                    <span className="font-bold text-emerald-700">{scan.checks.githubActions.quota.latestConclusion || 'success'}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>API Yanıt Süresi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.githubActions?.durationMs || 0} ms</span>
              </div>
              {renderServiceMeta(scan.checks.githubActions)}
            </div>

            {/* 10. Google AI Studio (Gemini) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">✨</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Google AI Studio (Gemini)</h4>
                    <span className="text-[11px] text-slate-400">Yapay Zekâ Soru &amp; Asistan</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.gemini?.status || 'unconfigured')}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.gemini?.details}</p>
              {scan.checks.gemini?.quota && (
                <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 flex justify-between items-center">
                  <span>Kullanılabilir Model Sayısı:</span>
                  <span className="font-mono font-bold text-indigo-700">{scan.checks.gemini.quota.modelsCount || 0} Model</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>API Yanıt Süresi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.gemini?.durationMs || 0} ms</span>
              </div>
              {renderServiceMeta(scan.checks.gemini)}
            </div>

            {/* 11. Cloudflare Edge & Ray */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">☁️</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Cloudflare API &amp; Edge</h4>
                    <span className="text-[11px] text-slate-400">WAF, DDoS &amp; Ray Trace</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.cloudflare?.status || 'unconfigured')}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.cloudflare?.details}</p>
              {scan.checks.cloudflare?.quota && (
                <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 flex justify-between items-center">
                  <span>Edge Lokasyonu (Colo):</span>
                  <span className="font-mono font-bold text-slate-800">{scan.checks.cloudflare.quota.colo || 'Edge'}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Edge Gecikmesi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.cloudflare?.durationMs || 0} ms</span>
              </div>
              {renderServiceMeta(scan.checks.cloudflare)}
            </div>

            {/* 12. Google Cloud Services */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🔑</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Google Cloud Servisleri</h4>
                    <span className="text-[11px] text-slate-400">OAuth 2.0 &amp; OpenID Kimlik</span>
                  </div>
                </div>
                {getStatusBadge(scan.checks.googleCloud?.status || 'unconfigured')}
              </div>
              <p className="text-xs text-slate-600 mb-3">{scan.checks.googleCloud?.details}</p>
              {scan.checks.googleCloud?.quota && (
                <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 space-y-1">
                  <div className="flex justify-between">
                    <span>OAuth Client ID:</span>
                    <span className="font-mono text-emerald-700 font-semibold">{scan.checks.googleCloud.quota.clientIdVerified ? 'Tanımlı ✅' : 'Eksik ⚠️'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OpenID Discovery:</span>
                    <span className="font-mono text-slate-700">{scan.checks.googleCloud.quota.openidDiscovery || 'accounts.google.com'}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                <span>Yanıt Süresi:</span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">{scan.checks.googleCloud?.durationMs || 0} ms</span>
              </div>
              {renderServiceMeta(scan.checks.googleCloud)}
            </div>
          </div>

          {/* Performance Breakdown Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Altyapı Performans ve Yanıt Süreleri</h3>
                <p className="text-xs text-slate-500">Bileşen bazında milisaniye (ms) cinsinden yanıt ve işlem süreleri</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 text-sm font-bold">
                <span>Performans Sınıfı:</span>
                <span className="text-lg">{scan.checks.performance.grade}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">Backend API</span>
                <span className="text-lg font-bold font-mono text-slate-900">{scan.checks.performance.apiMs} <span className="text-[10px] font-normal">ms</span></span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">Veritabanı</span>
                <span className="text-lg font-bold font-mono text-slate-900">{scan.checks.performance.dbMs} <span className="text-[10px] font-normal">ms</span></span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">Cloudflare R2</span>
                <span className="text-lg font-bold font-mono text-slate-900">{scan.checks.performance.r2Ms} <span className="text-[10px] font-normal">ms</span></span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">Cloudinary</span>
                <span className="text-lg font-bold font-mono text-slate-900">{scan.checks.performance.cloudinaryMs} <span className="text-[10px] font-normal">ms</span></span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">Pinecone</span>
                <span className="text-lg font-bold font-mono text-slate-900">{scan.checks.performance.pineconeMs || 0} <span className="text-[10px] font-normal">ms</span></span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">Google AI</span>
                <span className="text-lg font-bold font-mono text-slate-900">{scan.checks.performance.geminiMs || 0} <span className="text-[10px] font-normal">ms</span></span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center col-span-2 md:col-span-1">
                <span className="text-[11px] text-emerald-700 block mb-1">Ortalama</span>
                <span className="text-lg font-bold font-mono text-emerald-900">{scan.checks.performance.averageMs} <span className="text-[10px] font-normal">ms</span></span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Logs Tab: Last 30 Scans */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Son 30 Tarama Kayıtları</h3>
              <p className="text-xs text-slate-500">Veritabanında saklanan geçmiş sistem taramaları</p>
            </div>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">Toplam {logs.length} Kayıt</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-3 px-4">Tarih / Saat</th>
                  <th className="py-3 px-4">Tür</th>
                  <th className="py-3 px-4">Puan</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4">Ort. Süre</th>
                  <th className="py-3 px-4">Teşhis &amp; Uyarılar</th>
                  <th className="py-3 px-4">Tarayan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">Henüz kayıtlı bir sistem taraması bulunmuyor.</td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(item.timestamp || item.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="py-3 px-4">
                        {item.isScheduled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Otomatik 08:00</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">Manuel</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-sm">
                        <span className={item.score >= 90 ? 'text-emerald-700' : (item.score >= 70 ? 'text-amber-700' : 'text-rose-700')}>
                          {item.score} / 100
                        </span>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {item.checks?.performance?.averageMs ? `${item.checks.performance.averageMs} ms` : '-'}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={item.summary}>
                        {item.warnings && item.warnings.length > 0 ? (
                          <span className="text-amber-700 font-normal">⚠️ {item.warnings.join(', ')}</span>
                        ) : (
                          item.summary || 'Başarılı tarama'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{item.scannedBy || 'Süper Admin'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {initialLoading && !scan && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-semibold text-slate-700">Sistem sağlığı durumu yükleniyor...</p>
        </div>
      )}
    </div>
  );
};

export default SystemHealth;
