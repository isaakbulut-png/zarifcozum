/**
 * ZarifÇözüm - Sistem Sağlığı ve Güvenlik Kontrolü
 * KVKK & Çerez Uyumluluğu Modülü
 * React 18 + Tailwind UI Motoru
 */
(function (global) {
  'use strict';

  const { useState, useEffect, useCallback, createElement: e } = global.React || {};

  function StatusBadge({ status }) {
    if (status === 'healthy') {
      return e('span', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' },
        e('span', { className: 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse' }),
        '✅ Sağlıklı'
      );
    }
    if (status === 'warning') {
      return e('span', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm' },
        e('span', { className: 'w-2 h-2 rounded-full bg-amber-500' }),
        '⚠️ Uyarı'
      );
    }
    if (status === 'error') {
      return e('span', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm' },
        e('span', { className: 'w-2 h-2 rounded-full bg-rose-500' }),
        '❌ Hata'
      );
    }
    return e('span', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200' },
      e('span', { className: 'w-2 h-2 rounded-full bg-slate-400' }),
      '⚪ Yapılandırılmadı'
    );
  }

  function ComplianceBadge({ status }) {
    if (status === 'compliant') {
      return e('span', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' },
        e('span', { className: 'w-2 h-2 rounded-full bg-emerald-500' }),
        '✅ Uyumlu'
      );
    }
    if (status === 'partial') {
      return e('span', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm' },
        e('span', { className: 'w-2 h-2 rounded-full bg-amber-500' }),
        '⚠️ Kısmen Uyumlu'
      );
    }
    return e('span', { className: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm' },
      e('span', { className: 'w-2 h-2 rounded-full bg-rose-500' }),
      '❌ Uyumsuz'
    );
  }

  function formatTime(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return '—';
    }
  }

  function getDocumentIcon(id) {
    switch (id) {
      case 'uyelik-sozlesmesi': return '📝';
      case 'kullanim-kosullari': return '📜';
      case 'gizlilik-politikasi': return '🛡️';
      case 'kvkk-aydinlatma': return '⚖️';
      case 'cerez-politikasi': return '🍪';
      case 'acik-riza': return '✍️';
      case 'on-bilgilendirme': return '📋';
      case 'mesafeli-satis': return '🛒';
      case 'iptal-iade': return '🔄';
      default: return '📄';
    }
  }

  function ServiceMeta({ item }) {
    if (!item) return null;
    return e('div', { className: 'space-y-1 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500' },
      item.lastError ? e('div', { className: 'text-rose-600 bg-rose-50/80 px-2 py-0.5 rounded font-mono truncate', title: item.lastError },
        '⚠️ Hata: ' + item.lastError
      ) : null,
      e('div', { className: 'flex justify-between items-center text-slate-400' },
        e('span', null, 'Son Başarılı Kontrol:'),
        e('span', { className: 'font-mono text-slate-600' }, formatTime(item.lastSuccessAt))
      )
    );
  }

  function SystemHealthApp() {
    const [scan, setScan] = useState(null);
    const [logs, setLogs] = useState([]);
    const [kvkkReport, setKvkkReport] = useState(null);
    const [legalAuditReport, setLegalAuditReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [kvkkLoading, setKvkkLoading] = useState(false);
    const [legalLoading, setLegalLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [activeKvkkSubTab, setActiveKvkkSubTab] = useState('legal_docs');

    const fetchInitialData = useCallback(async () => {
      setInitialLoading(true);
      setErrorMsg(null);
      try {
        const [latestRes, logsRes, kvkkRes, legalRes] = await Promise.all([
          fetch('/api/admin/system-health/latest').then(r => r.json()).catch(() => ({})),
          fetch('/api/admin/system-health/logs?limit=30').then(r => r.json()).catch(() => ({})),
          fetch('/api/admin/system-health/kvkk').then(r => r.json()).catch(() => ({})),
          fetch('/api/admin/system-health/legal-audit').then(r => r.json()).catch(() => ({}))
        ]);
        if (latestRes && latestRes.scan) setScan(latestRes.scan);
        if (logsRes && logsRes.logs) setLogs(logsRes.logs);
        if (kvkkRes && kvkkRes.report) setKvkkReport(kvkkRes.report);
        if (legalRes && legalRes.auditReport) setLegalAuditReport(legalRes.auditReport);
      } catch (err) {
        setErrorMsg('Sistem verileri alınamadı: ' + (err.message || 'Hata'));
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
        if (logsRes && logsRes.logs) setLogs(logsRes.logs);
      } catch (err) {
        setErrorMsg('Tarama sırasında hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
      } finally {
        setLoading(false);
      }
    };

    const handleRunKvkkScan = async () => {
      setKvkkLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/admin/system-health/kvkk/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mesaj || 'KVKK taraması tamamlanamadı.');
        setKvkkReport(data.report);
      } catch (err) {
        setErrorMsg('KVKK tarama hatası: ' + (err.message || 'Bilinmeyen hata'));
      } finally {
        setKvkkLoading(false);
      }
    };

    const handleRunLegalAudit = async () => {
      setLegalLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/admin/system-health/legal-audit/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mesaj || 'Yasal metinler denetimi tamamlanamadı.');
        if (data.auditReport) setLegalAuditReport(data.auditReport);
      } catch (err) {
        setErrorMsg('Yasal metinler denetim hatası: ' + (err.message || 'Bilinmeyen hata'));
      } finally {
        setLegalLoading(false);
      }
    };

    const getScoreBorder = (score) => {
      if (score >= 90) return 'text-emerald-600 border-emerald-500';
      if (score >= 70) return 'text-amber-600 border-amber-500';
      return 'text-rose-600 border-rose-500';
    };

    return e('div', { className: 'space-y-6 max-w-7xl mx-auto' },
      // 1. Üst Aksiyon ve Başlık Kartı
      e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4' },
        e('div', { className: 'flex items-center gap-3.5' },
          e('div', { className: 'w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-600/20 text-2xl' },
            '🛡️'
          ),
          e('div', null,
            e('div', { className: 'flex items-center gap-2' },
              e('h2', { className: 'text-xl md:text-2xl font-bold text-slate-900 tracking-tight' }, 'Sistem Sağlığı ve Güvenlik Kontrolü'),
              e('span', { className: 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200' },
                '⏰ Otomatik Tarama: Her gün 08:00'
              )
            ),
            e('p', { className: 'text-xs md:text-sm text-slate-500 mt-0.5' }, 'Render, Veritabanları, Cloudflare, SSL, Çerez Politikası & 6698 Sayılı KVKK Canlı Teşhisi')
          )
        ),
        e('div', { className: 'flex flex-wrap items-center gap-3 w-full md:w-auto' },
          e('div', { className: 'flex bg-slate-100 p-1 rounded-xl text-xs font-semibold' },
            e('button', {
              type: 'button',
              onClick: () => setActiveTab('overview'),
              className: `px-3.5 py-1.5 rounded-lg transition ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`
            }, '📊 Anlık Durum'),
            e('button', {
              type: 'button',
              onClick: () => setActiveTab('kvkk'),
              className: `px-3.5 py-1.5 rounded-lg transition ${activeTab === 'kvkk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`
            }, '🍪 KVKK & Çerez Uyumluluğu'),
            e('button', {
              type: 'button',
              onClick: () => setActiveTab('logs'),
              className: `px-3.5 py-1.5 rounded-lg transition ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`
            }, `📜 Son 30 Tarama (${logs.length})`)
          ),

          activeTab === 'kvkk' ? e('button', {
            type: 'button',
            onClick: activeKvkkSubTab === 'legal_docs' ? handleRunLegalAudit : handleRunKvkkScan,
            disabled: activeKvkkSubTab === 'legal_docs' ? legalLoading : kvkkLoading,
            className: 'flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer'
          },
            (activeKvkkSubTab === 'legal_docs' ? legalLoading : kvkkLoading) ? [
              e('span', { key: 'spin', className: 'inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' }),
              e('span', { key: 'txt' }, 'Denetleniyor...')
            ] : [
              e('span', { key: 'ico' }, activeKvkkSubTab === 'legal_docs' ? '📜' : '🍪'),
              e('span', { key: 'txt' }, activeKvkkSubTab === 'legal_docs' ? 'Yasal Metinleri Denetle' : 'KVKK Taraması Çalıştır')
            ]
          ) : e('button', {
            type: 'button',
            onClick: handleStartScan,
            disabled: loading,
            className: 'flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer'
          },
            loading ? [
              e('span', { key: 'spin', className: 'inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' }),
              e('span', { key: 'txt' }, 'Sistem Taranıyor...')
            ] : [
              e('span', { key: 'ico' }, '🔄'),
              e('span', { key: 'txt' }, 'Sistem Taraması Başlat')
            ]
          )
        )
      ),

      // Kritik Servis Hata Uyarısı
      scan && (scan.status === 'error' || (scan.errors && scan.errors.length > 0)) ? e('div', {
        className: 'bg-rose-50 border-2 border-rose-500 text-rose-900 rounded-2xl p-5 shadow-sm flex items-start gap-4'
      },
        e('span', { className: 'text-3xl' }, '🚨'),
        e('div', { className: 'flex-1' },
          e('h3', { className: 'font-bold text-base text-rose-900' }, 'Kritik Servis Uyarısı! Sistem Müdahalesi Gerekli'),
          e('p', { className: 'text-xs text-rose-700 mt-1' }, 'Aşağıdaki servislerde hata veya kesinti tespit edildi. Otomatik bildirim ve audit kaydı oluşturuldu:'),
          e('ul', { className: 'mt-2 space-y-1 list-disc list-inside text-xs font-semibold text-rose-800' },
            (scan.errors || []).map((err, idx) => e('li', { key: idx }, err))
          )
        )
      ) : null,

      errorMsg ? e('div', { className: 'bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm flex items-center gap-2 font-medium' },
        e('span', null, '⚠️'),
        e('span', null, errorMsg)
      ) : null,

      loading ? e('div', { className: 'bg-amber-50/80 border border-amber-200 p-6 rounded-2xl text-center space-y-2 animate-pulse' },
        e('div', { className: 'w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto' }),
        e('h4', { className: 'text-sm font-bold text-amber-900' }, 'Tüm Sistem ve Harici API Bileşenleri Taranıyor...'),
        e('p', { className: 'text-xs text-amber-700' }, 'Render, PostgreSQL, MongoDB, R2, Cloudinary, SSL, CDN, Pinecone, GitHub, Gemini ve Google Cloud canlı olarak test ediliyor.')
      ) : null,

      // OVERVIEW TAB
      activeTab === 'overview' && scan ? e('div', { className: 'space-y-6' },
        e('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
          // Puan Kartı
          e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center' },
            e('span', { className: 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-2' }, 'Genel Sistem Durumu'),
            e('div', { className: `w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center ${getScoreBorder(scan.score)} shadow-inner` },
              e('span', { className: 'text-4xl font-black tracking-tight' }, scan.score),
              e('span', { className: 'text-xs font-bold text-slate-400' }, '/ 100')
            ),
            e('div', { className: 'mt-4' }, e(StatusBadge, { status: scan.status })),
            e('span', { className: 'text-[11px] text-slate-400 mt-2 font-medium' },
              'Son Tarama: ' + new Date(scan.timestamp).toLocaleString('tr-TR'),
              scan.isScheduled ? e('span', { className: 'ml-1 text-blue-600 font-bold' }, '(Otomatik 08:00)') : null
            )
          ),

          // Özet Listesi ve Checklist (13 Servis)
          e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 lg:col-span-2 flex flex-col justify-between' },
            e('div', null,
              e('h3', { className: 'text-base font-bold text-slate-900 mb-1' }, 'Teşhis Özeti ve Servis Durumları'),
              e('p', { className: 'text-xs text-slate-600 mb-4' }, scan.summary),
              e('div', { className: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs font-semibold' },
                [
                  { name: 'Backend API', st: scan.checks.api.status },
                  { name: 'PostgreSQL / Mongo', st: scan.checks.database.status },
                  { name: 'Cloudflare R2', st: scan.checks.r2.status },
                  { name: 'Cloudinary', st: scan.checks.cloudinary.status },
                  { name: 'SSL / TLS', st: scan.checks.ssl.status },
                  { name: 'Domain & CDN', st: scan.checks.domain.status },
                  { name: 'Pinecone Vektör', st: scan.checks.pinecone?.status || 'unconfigured' },
                  { name: 'GitHub API', st: scan.checks.github?.status || 'unconfigured' },
                  { name: 'GitHub Actions', st: scan.checks.githubActions?.status || 'unconfigured' },
                  { name: 'Google AI Studio', st: scan.checks.gemini?.status || 'unconfigured' },
                  { name: 'Cloudflare Edge', st: scan.checks.cloudflare?.status || 'unconfigured' },
                  { name: 'Google Cloud', st: scan.checks.googleCloud?.status || 'unconfigured' }
                ].map((item, idx) => e('div', { key: idx, className: 'flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100' },
                  e('span', null, item.st === 'healthy' ? '✅' : (item.st === 'warning' ? '⚠️' : '❌')),
                  e('span', { className: 'truncate text-[11px] text-slate-700' }, item.name)
                ))
              )
            ),
            (scan.warnings && scan.warnings.length > 0) || (scan.errors && scan.errors.length > 0) ? e('div', { className: 'mt-4 pt-4 border-t border-slate-100 space-y-1.5' },
              (scan.warnings || []).map((w, i) => e('div', { key: 'w-' + i, className: 'text-xs text-amber-800 bg-amber-50 p-2 rounded-lg flex items-center gap-2' },
                e('span', null, '⚠️'),
                e('span', null, w)
              )),
              (scan.errors || []).map((err, i) => e('div', { key: 'e-' + i, className: 'text-xs text-rose-800 bg-rose-50 p-2 rounded-lg flex items-center gap-2 font-medium' },
                e('span', null, '❌'),
                e('span', null, err)
              ))
            ) : null
          )
        ),

        // Servis Kartları (13 Servis)
        e('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
          // 1. API
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '⚡'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Backend API (Render)'),
                  e('span', { className: 'text-[11px] text-slate-400 font-mono' }, '/api/health')
                )
              ),
              e(StatusBadge, { status: scan.checks.api.status })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.api.details),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yanıt Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.api.durationMs} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.api })
          ),

          // 2. Veritabanı
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '🗄️'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Veritabanı Servisleri'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'PostgreSQL & MongoDB')
                )
              ),
              e(StatusBadge, { status: scan.checks.database.status })
            ),
            e('div', { className: 'space-y-2 mb-3' },
              e('div', { className: 'bg-slate-50 p-2 rounded-lg text-xs' },
                e('div', { className: 'flex justify-between items-center font-medium' },
                  e('span', null, '🐘 PostgreSQL:'),
                  e(StatusBadge, { status: scan.checks.database.postgres.status })
                ),
                e('p', { className: 'text-[11px] text-slate-500 mt-1' }, scan.checks.database.postgres.details)
              ),
              e('div', { className: 'bg-slate-50 p-2 rounded-lg text-xs' },
                e('div', { className: 'flex justify-between items-center font-medium' },
                  e('span', null, '🍃 MongoDB Atlas:'),
                  e(StatusBadge, { status: scan.checks.database.mongo.status })
                ),
                e('p', { className: 'text-[11px] text-slate-500 mt-1' }, scan.checks.database.mongo.details)
              )
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'MongoDB Ping:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.database.mongo.durationMs} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.database.mongo })
          ),

          // 3. R2
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '📦'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Cloudflare R2 Depolama'),
                  e('span', { className: 'text-[11px] text-slate-400' }, scan.checks.r2.bucket || 'S3 Bucket')
                )
              ),
              e(StatusBadge, { status: scan.checks.r2.status })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.r2.details),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'R/W/D Döngü Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.r2.durationMs} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.r2 })
          ),

          // 4. Cloudinary
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '🖼️'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Cloudinary Medya API'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'Görsel Yönetim Servisi')
                )
              ),
              e(StatusBadge, { status: scan.checks.cloudinary.status })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.cloudinary.details),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yükleme & Silme:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.cloudinary.durationMs} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.cloudinary })
          ),

          // 5. SSL
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '🔒'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'SSL / TLS Sertifikası'),
                  e('span', { className: 'text-[11px] text-slate-400' }, scan.checks.ssl.domain)
                )
              ),
              e(StatusBadge, { status: scan.checks.ssl.status })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.ssl.details),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Kalan Süre:'),
              e('span', { className: `font-mono px-2 py-0.5 rounded ${scan.checks.ssl.daysLeft < 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}` }, `${scan.checks.ssl.daysLeft} gün`)
            ),
            e(ServiceMeta, { item: scan.checks.ssl })
          ),

          // 6. Domain
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '🌐'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Domain & HTTPS Yönlendirme'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'DNS & Edge Router')
                )
              ),
              e(StatusBadge, { status: scan.checks.domain.status })
            ),
            e('div', { className: 'space-y-1.5 text-xs text-slate-600 mb-3' },
              e('div', { className: 'flex justify-between' },
                e('span', null, 'www.zarifcozum.com:'),
                e('span', { className: 'font-mono text-emerald-700 font-bold' }, `HTTP ${scan.checks.domain.mainDomain.statusCode} (${scan.checks.domain.mainDomain.durationMs}ms)`)
              ),
              e('div', { className: 'flex justify-between' },
                e('span', null, 'media.zarifcozum.com:'),
                e('span', { className: 'font-mono text-slate-600' }, `HTTP ${scan.checks.domain.mediaDomain.statusCode}`)
              ),
              e('div', { className: 'flex justify-between' },
                e('span', null, 'HTTP > HTTPS:'),
                e('span', { className: 'text-emerald-700 font-bold' }, scan.checks.domain.httpsRedirect.redirected ? '301 Yönlendirildi ✅' : 'Doğrudan ⚠️')
              )
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Cloudflare CDN:'),
              e('span', { className: 'text-slate-700 font-mono text-[11px]' }, scan.checks.mediaCdn.cfCacheStatus || 'DYNAMIC')
            ),
            e(ServiceMeta, { item: scan.checks.mediaCdn })
          ),

          // 7. Pinecone
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '🌲'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Pinecone Vektör DB'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'Semantik Arama & Müfredat')
                )
              ),
              e(StatusBadge, { status: scan.checks.pinecone?.status || 'unconfigured' })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.pinecone?.details),
            scan.checks.pinecone?.quota ? e('div', { className: 'bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3' },
              e('span', { className: 'font-semibold text-slate-700' }, 'İndeksler: '),
              (scan.checks.pinecone.quota.indexes || []).join(', ') || 'Yok'
            ) : null,
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yanıt Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.pinecone?.durationMs || 0} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.pinecone })
          ),

          // 8. GitHub API
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '🐙'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'GitHub REST API'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'Depo & Sürüm Yönetimi')
                )
              ),
              e(StatusBadge, { status: scan.checks.github?.status || 'unconfigured' })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.github?.details),
            scan.checks.github?.quota ? e('div', { className: 'bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 flex justify-between items-center' },
              e('span', null, 'API Kota Durumu:'),
              e('span', { className: 'font-mono font-bold text-slate-800' }, `${scan.checks.github.quota.rateLimitRemaining} / ${scan.checks.github.quota.rateLimitLimit} req`)
            ) : null,
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yanıt Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.github?.durationMs || 0} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.github })
          ),

          // 9. GitHub Actions
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '⚙️'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'GitHub Actions (CI/CD)'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'Workflow & Otomatik Dağıtım')
                )
              ),
              e(StatusBadge, { status: scan.checks.githubActions?.status || 'unconfigured' })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.githubActions?.details),
            scan.checks.githubActions?.quota ? e('div', { className: 'bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 space-y-1' },
              e('div', { className: 'flex justify-between' },
                e('span', null, 'Son İş Akışı:'),
                e('span', { className: 'font-semibold text-slate-800 truncate max-w-[140px]' }, scan.checks.githubActions.quota.latestWorkflowName || '—')
              ),
              e('div', { className: 'flex justify-between' },
                e('span', null, 'Sonuç:'),
                e('span', { className: 'font-bold text-emerald-700' }, scan.checks.githubActions.quota.latestConclusion || 'success')
              )
            ) : null,
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'API Yanıt Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.githubActions?.durationMs || 0} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.githubActions })
          ),

          // 10. Gemini
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '✨'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Google AI Studio (Gemini)'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'Yapay Zekâ Soru & Asistan')
                )
              ),
              e(StatusBadge, { status: scan.checks.gemini?.status || 'unconfigured' })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.gemini?.details),
            scan.checks.gemini?.quota ? e('div', { className: 'bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 flex justify-between items-center' },
              e('span', null, 'Kullanılabilir Model:'),
              e('span', { className: 'font-mono font-bold text-indigo-700' }, `${scan.checks.gemini.quota.modelsCount || 0} Model`)
            ) : null,
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'API Yanıt Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.gemini?.durationMs || 0} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.gemini })
          ),

          // 11. Cloudflare Edge
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '☁️'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Cloudflare Edge & Trace'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'WAF & DDoS Kalkanı')
                )
              ),
              e(StatusBadge, { status: scan.checks.cloudflare?.status || 'unconfigured' })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.cloudflare?.details),
            scan.checks.cloudflare?.quota ? e('div', { className: 'bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 flex justify-between items-center' },
              e('span', null, 'Edge Lokasyonu (Colo):'),
              e('span', { className: 'font-mono font-bold text-slate-800' }, scan.checks.cloudflare.quota.colo || 'AMS')
            ) : null,
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Edge Gecikmesi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.cloudflare?.durationMs || 0} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.cloudflare })
          ),

          // 12. Google Cloud
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition' },
            e('div', { className: 'flex items-center justify-between mb-3' },
              e('div', { className: 'flex items-center gap-2' },
                e('span', { className: 'text-xl' }, '🔑'),
                e('div', null,
                  e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Google Cloud Servisleri'),
                  e('span', { className: 'text-[11px] text-slate-400' }, 'OAuth 2.0 & OpenID Kimlik')
                )
              ),
              e(StatusBadge, { status: scan.checks.googleCloud?.status || 'unconfigured' })
            ),
            e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks.googleCloud?.details),
            scan.checks.googleCloud?.quota ? e('div', { className: 'bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 mb-3 space-y-1' },
              e('div', { className: 'flex justify-between' },
                e('span', null, 'OAuth Client ID:'),
                e('span', { className: 'font-mono text-emerald-700 font-bold' }, scan.checks.googleCloud.quota.clientIdVerified ? 'Tanımlı ✅' : 'Eksik ⚠️')
              ),
              e('div', { className: 'flex justify-between' },
                e('span', null, 'OpenID Discovery:'),
                e('span', { className: 'font-mono text-slate-700' }, scan.checks.googleCloud.quota.openidDiscovery || 'accounts.google.com')
              )
            ) : null,
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yanıt Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks.googleCloud?.durationMs || 0} ms`)
            ),
            e(ServiceMeta, { item: scan.checks.googleCloud })
          )
        ),

        // Performans Dökümü
        e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80' },
          e('div', { className: 'flex items-center justify-between mb-4' },
            e('div', null,
              e('h3', { className: 'font-bold text-slate-900 text-base' }, 'Altyapı Performans ve Yanıt Süreleri'),
              e('p', { className: 'text-xs text-slate-500' }, 'Bileşen bazında milisaniye (ms) cinsinden yanıt ve işlem süreleri')
            ),
            e('div', { className: 'flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 text-sm font-bold' },
              e('span', null, 'Performans:'),
              e('span', { className: 'text-lg' }, scan.checks.performance.grade)
            )
          ),
          e('div', { className: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3' },
            [
              { label: 'Backend API', val: scan.checks.performance.apiMs },
              { label: 'Veritabanı', val: scan.checks.performance.dbMs },
              { label: 'Cloudflare R2', val: scan.checks.performance.r2Ms },
              { label: 'Cloudinary', val: scan.checks.performance.cloudinaryMs },
              { label: 'Pinecone', val: scan.checks.performance.pineconeMs || 0 },
              { label: 'Google AI', val: scan.checks.performance.geminiMs || 0 },
              { label: 'Ortalama', val: scan.checks.performance.averageMs, highlight: true }
            ].map((p, i) => e('div', {
              key: i,
              className: `${p.highlight ? 'bg-emerald-50 border-emerald-200 col-span-2 md:col-span-1' : 'bg-slate-50 border-slate-100'} p-3 rounded-xl border text-center`
            },
              e('span', { className: `text-[11px] ${p.highlight ? 'text-emerald-700 font-bold' : 'text-slate-500'} block mb-1` }, p.label),
              e('span', { className: `text-lg font-bold font-mono ${p.highlight ? 'text-emerald-900' : 'text-slate-900'}` },
                p.val,
                e('span', { className: 'text-[10px] font-normal text-slate-500 ml-0.5' }, 'ms')
              )
            ))
          )
        )
      ) : null,

      // KVKK & YASAL METİNLER TAB
      activeTab === 'kvkk' ? e('div', { className: 'space-y-6' },
        // Sub-Tab Seçici: 9 Temel Yasal Metin vs Çerez & Teknik Uyumluluk
        e('div', { className: 'flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm' },
          e('div', { className: 'flex bg-slate-100 p-1 rounded-xl text-xs font-bold w-full sm:w-auto' },
            e('button', {
              type: 'button',
              onClick: () => setActiveKvkkSubTab('legal_docs'),
              className: `flex-1 sm:flex-none px-4 py-2 rounded-lg transition ${activeKvkkSubTab === 'legal_docs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`
            }, '📜 9 Temel Yasal Metin & Sözleşme Denetimi'),
            e('button', {
              type: 'button',
              onClick: () => setActiveKvkkSubTab('cookies'),
              className: `flex-1 sm:flex-none px-4 py-2 rounded-lg transition ${activeKvkkSubTab === 'cookies' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`
            }, '🍪 Çerez & Teknik Uyumluluk (10 Kontrol)')
          ),
          activeKvkkSubTab === 'legal_docs' ? e('button', {
            type: 'button',
            onClick: handleRunLegalAudit,
            disabled: legalLoading,
            className: 'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer'
          }, legalLoading ? 'Denetleniyor...' : '📜 Yasal Metinleri Yeniden Denetle') : e('button', {
            type: 'button',
            onClick: handleRunKvkkScan,
            disabled: kvkkLoading,
            className: 'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer'
          }, kvkkLoading ? 'Taranıyor...' : '🍪 Çerez Taramasını Yenile')
        ),

        // SUB-VIEW 1: 9 Temel Yasal Metin Denetimi
        activeKvkkSubTab === 'legal_docs' ? (legalAuditReport ? [
          // Puan & Özet Kartı
          e('div', { key: 'legal-header', className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
            e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center' },
              e('span', { className: 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-2' }, 'Sözleşme & Yasal Metin Uyumluluk'),
              e('div', { className: `w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center ${getScoreBorder(legalAuditReport.score)} shadow-inner` },
                e('span', { className: 'text-4xl font-black tracking-tight' }, legalAuditReport.score),
                e('span', { className: 'text-xs font-bold text-slate-400' }, '/ 100')
              ),
              e('div', { className: 'mt-4' }, e(ComplianceBadge, { status: legalAuditReport.status })),
              e('span', { className: 'text-[11px] text-slate-400 mt-2 font-medium' },
                'Son Denetim: ' + new Date(legalAuditReport.timestamp).toLocaleString('tr-TR')
              )
            ),
            e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 lg:col-span-2 flex flex-col justify-between' },
              e('div', null,
                e('div', { className: 'flex items-center justify-between mb-2' },
                  e('h3', { className: 'text-base font-bold text-slate-900' }, 'Yasal Metinler ve Sözleşmeler Mevzuat Teşhisi'),
                  e('span', { className: 'px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200' }, '9 Temel Belge Tam Denetlendi')
                ),
                e('p', { className: 'text-xs text-slate-600 mb-4' }, legalAuditReport.summary),
                e('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-3' },
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5' }, 'Denetlenen Belge'),
                    e('span', { className: 'text-base font-extrabold text-slate-800' }, `${legalAuditReport.stats.totalDocuments} Belge`),
                    e('p', { className: 'text-[10px] text-slate-500 mt-0.5' }, 'Üyelik, KVKK, Satış, İade vb.')
                  ),
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5' }, 'Eksik Yasal Alan'),
                    e('span', { className: `text-base font-extrabold ${legalAuditReport.stats.totalMissing > 0 ? 'text-rose-700' : 'text-emerald-700'}` }, `${legalAuditReport.stats.totalMissing} Alan`),
                    e('p', { className: 'text-[10px] text-slate-500 mt-0.5' }, 'Zorunlu yasal maddeler')
                  ),
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5' }, 'Placeholder / Taslak'),
                    e('span', { className: `text-base font-extrabold ${legalAuditReport.stats.totalPlaceholders > 0 ? 'text-purple-700' : 'text-emerald-700'}` }, `${legalAuditReport.stats.totalPlaceholders} Adet`),
                    e('p', { className: 'text-[10px] text-slate-500 mt-0.5' }, 'Doldurulmamış [...] alanlar')
                  ),
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5' }, 'Şirket Künye Eksiği'),
                    e('span', { className: `text-base font-extrabold ${legalAuditReport.stats.totalCompanyNeeded > 0 ? 'text-amber-800' : 'text-emerald-700'}` }, `${legalAuditReport.stats.totalCompanyNeeded} Bilgi`),
                    e('p', { className: 'text-[10px] text-slate-500 mt-0.5' }, 'MERSİS, VKN, Tam Unvan')
                  ),
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5' }, 'KVKK Mevzuat Açığı'),
                    e('span', { className: `text-base font-extrabold ${legalAuditReport.stats.totalKvkkIssues > 0 ? 'text-rose-700' : 'text-emerald-700'}` }, `${legalAuditReport.stats.totalKvkkIssues} Madde`),
                    e('p', { className: 'text-[10px] text-slate-500 mt-0.5' }, 'm.10/m.11 başvuru usulü')
                  ),
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5' }, 'Çelişkili / Hatalı İfade'),
                    e('span', { className: `text-base font-extrabold ${legalAuditReport.stats.totalContradictions > 0 ? 'text-orange-800' : 'text-emerald-700'}` }, `${legalAuditReport.stats.totalContradictions} Risk`),
                    e('p', { className: 'text-[10px] text-slate-500 mt-0.5' }, 'Cayma hakkı ve iade uyumu')
                  )
                )
              ),
              e('div', { className: 'mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2' },
                e('span', null, 'Dayanak Mevzuat: 6698 s. KVKK, 6502 s. TKHK, Mesafeli Sözleşmeler Yönetmeliği'),
                e('span', { className: 'font-semibold text-indigo-700' }, `Ortalama Sistem Uyumluluğu: %${legalAuditReport.stats.averageScore}`)
              )
            )
          ),

          // 9 Belge Kartları Listesi
          e('div', { key: 'legal-docs-list', className: 'space-y-6' },
            e('div', null,
              e('h3', { className: 'font-bold text-slate-900 text-lg' }, '9 Temel Yasal Metin Ayrıntılı Denetim Raporu'),
              e('p', { className: 'text-xs text-slate-500' }, 'Her metin için eksik alanlar, placeholder\'lar, şirket bilgileri, KVKK uyumu, çelişkiler ve iyileştirme tavsiyeleri')
            ),
            legalAuditReport.documents.map(doc => e('div', {
              key: doc.id,
              className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition'
            },
              // Başlık
              e('div', { className: 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100' },
                e('div', { className: 'flex items-start gap-3' },
                  e('span', { className: 'text-2xl mt-0.5' }, getDocumentIcon(doc.id)),
                  e('div', null,
                    e('div', { className: 'flex items-center gap-2 flex-wrap' },
                      e('h4', { className: 'font-bold text-slate-900 text-base' }, doc.title),
                      e('a', {
                        href: `/yasal.html#${doc.sectionId}`,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'text-[11px] font-mono text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 transition'
                      }, `yasal.html#${doc.sectionId} ↗`)
                    ),
                    e('p', { className: 'text-xs text-slate-500 mt-0.5' }, `${doc.name} • ${doc.stats.wordCount} kelime • ${doc.stats.charCount} karakter`)
                  )
                ),
                e('div', { className: 'flex items-center gap-3' },
                  e('div', { className: `px-3 py-1.5 rounded-xl border flex items-center gap-2 ${getScoreBorder(doc.score)} bg-slate-50` },
                    e('span', { className: 'text-xs font-bold' }, 'Uygunluk:'),
                    e('span', { className: 'text-sm font-black' }, `${doc.score}/100`)
                  ),
                  e(ComplianceBadge, { status: doc.status })
                )
              ),

              // 6 Kriter Tablosu
              e('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5' },
                // 1. Eksik Alanlar
                e('div', { className: 'bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between' },
                  e('div', null,
                    e('div', { className: 'flex items-center justify-between mb-2' },
                      e('span', { className: 'text-xs font-bold text-slate-800 flex items-center gap-1.5' },
                        e('span', { className: 'w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]' }, '1'),
                        'Eksik Alanlar'
                      ),
                      e('span', { className: `text-[10px] font-bold px-2 py-0.5 rounded ${doc.missingFields.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}` },
                        doc.missingFields.length > 0 ? `${doc.missingFields.length} Eksik` : 'Eksiksiz'
                      )
                    ),
                    doc.missingFields.length > 0 ? e('ul', { className: 'space-y-1.5 text-xs text-rose-700 mt-2' },
                      doc.missingFields.map((f, i) => e('li', { key: i, className: 'flex items-start gap-1.5' },
                        e('span', { className: 'text-rose-500 font-bold' }, '•'),
                        e('span', null, f)
                      ))
                    ) : e('p', { className: 'text-xs text-emerald-700 font-medium mt-2' }, '✅ Zorunlu yasal maddeler eksiksiz mevcut.')
                  )
                ),

                // 2. Placeholder Alanları
                e('div', { className: 'bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between' },
                  e('div', null,
                    e('div', { className: 'flex items-center justify-between mb-2' },
                      e('span', { className: 'text-xs font-bold text-slate-800 flex items-center gap-1.5' },
                        e('span', { className: 'w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]' }, '2'),
                        'Placeholder Alanları'
                      ),
                      e('span', { className: `text-[10px] font-bold px-2 py-0.5 rounded ${doc.placeholders.length > 0 ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}` },
                        doc.placeholders.length > 0 ? `${doc.placeholders.length} Taslak` : 'Temiz'
                      )
                    ),
                    doc.placeholders.length > 0 ? e('ul', { className: 'space-y-1.5 text-xs text-purple-700 mt-2' },
                      doc.placeholders.map((p, i) => e('li', { key: i, className: 'flex items-start gap-1.5 font-mono' },
                        e('span', { className: 'text-purple-500 font-bold' }, '•'),
                        e('span', null, p)
                      ))
                    ) : e('p', { className: 'text-xs text-emerald-700 font-medium mt-2' }, '✅ Taslak placeholder veya doldurulmamış alan yok.')
                  )
                ),

                // 3. Şirket Bilgisi Gerektirenler
                e('div', { className: 'bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between' },
                  e('div', null,
                    e('div', { className: 'flex items-center justify-between mb-2' },
                      e('span', { className: 'text-xs font-bold text-slate-800 flex items-center gap-1.5' },
                        e('span', { className: 'w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]' }, '3'),
                        'Şirket Bilgisi Gereken'
                      ),
                      e('span', { className: `text-[10px] font-bold px-2 py-0.5 rounded ${doc.companyInfoNeeded.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}` },
                        doc.companyInfoNeeded.length > 0 ? `${doc.companyInfoNeeded.length} Gerekli` : 'Tanımlı'
                      )
                    ),
                    doc.companyInfoNeeded.length > 0 ? e('ul', { className: 'space-y-1.5 text-xs text-amber-800 mt-2' },
                      doc.companyInfoNeeded.map((c, i) => e('li', { key: i, className: 'flex items-start gap-1.5' },
                        e('span', { className: 'text-amber-600 font-bold' }, '•'),
                        e('span', null, c)
                      ))
                    ) : e('p', { className: 'text-xs text-emerald-700 font-medium mt-2' }, '✅ Şirket künye ve unvan bilgileri eksiksiz tanımlı.')
                  )
                ),

                // 4. KVKK Mevzuat Eksikleri
                e('div', { className: 'bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between' },
                  e('div', null,
                    e('div', { className: 'flex items-center justify-between mb-2' },
                      e('span', { className: 'text-xs font-bold text-slate-800 flex items-center gap-1.5' },
                        e('span', { className: 'w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]' }, '4'),
                        'KVKK Mevzuat Eksikleri'
                      ),
                      e('span', { className: `text-[10px] font-bold px-2 py-0.5 rounded ${doc.kvkkIssues.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}` },
                        doc.kvkkIssues.length > 0 ? `${doc.kvkkIssues.length} Madde` : 'KVKK Uyumlu'
                      )
                    ),
                    doc.kvkkIssues.length > 0 ? e('ul', { className: 'space-y-1.5 text-xs text-rose-700 mt-2' },
                      doc.kvkkIssues.map((k, i) => e('li', { key: i, className: 'flex items-start gap-1.5' },
                        e('span', { className: 'text-rose-500 font-bold' }, '•'),
                        e('span', null, k)
                      ))
                    ) : e('p', { className: 'text-xs text-emerald-700 font-medium mt-2' }, '✅ 6698 sayılı KVKK temel gereksinimlerine uygun.')
                  )
                ),

                // 5. Hatalı veya Çelişkili İfadeler
                e('div', { className: 'bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between' },
                  e('div', null,
                    e('div', { className: 'flex items-center justify-between mb-2' },
                      e('span', { className: 'text-xs font-bold text-slate-800 flex items-center gap-1.5' },
                        e('span', { className: 'w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]' }, '5'),
                        'Hatalı / Çelişkili İfadeler'
                      ),
                      e('span', { className: `text-[10px] font-bold px-2 py-0.5 rounded ${doc.contradictions.length > 0 ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-700'}` },
                        doc.contradictions.length > 0 ? `${doc.contradictions.length} Risk` : 'Çelişki Yok'
                      )
                    ),
                    doc.contradictions.length > 0 ? e('ul', { className: 'space-y-1.5 text-xs text-orange-800 mt-2' },
                      doc.contradictions.map((ct, i) => e('li', { key: i, className: 'flex items-start gap-1.5' },
                        e('span', { className: 'text-orange-600 font-bold' }, '•'),
                        e('span', null, ct)
                      ))
                    ) : e('p', { className: 'text-xs text-emerald-700 font-medium mt-2' }, '✅ Tüketici ve borçlar hukuku çelişkisi bulunmuyor.')
                  )
                ),

                // 6. ZarifÇözüm Uygunluğu & İyileştirme
                e('div', { className: 'bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between' },
                  e('div', null,
                    e('div', { className: 'flex items-center justify-between mb-2' },
                      e('span', { className: 'text-xs font-bold text-slate-800 flex items-center gap-1.5' },
                        e('span', { className: 'w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]' }, '6'),
                        'ZarifÇözüm Uygunluğu'
                      ),
                      e('span', { className: 'text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800' }, `${doc.score} / 100`)
                    ),
                    doc.recommendations.length > 0 ? e('ul', { className: 'space-y-1.5 text-xs text-slate-700 mt-2' },
                      doc.recommendations.map((r, i) => e('li', { key: i, className: 'flex items-start gap-1.5' },
                        e('span', { className: 'text-indigo-600 font-bold' }, '→'),
                        e('span', null, r)
                      ))
                    ) : e('p', { className: 'text-xs text-emerald-700 font-medium mt-2' }, '✅ Sistem işleyişi ile tam uyumlu metin.')
                  )
                )
              )
            ))
          ),

          // Konsolide Eylem Planı
          e('div', { key: 'legal-recs', className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80' },
            e('div', { className: 'flex items-center gap-2.5 mb-3' },
              e('span', { className: 'text-2xl' }, '📋'),
              e('div', null,
                e('h3', { className: 'font-bold text-slate-900 text-base' }, 'Konsolide Öncelikli Hukuki Eylem Planı'),
                e('p', { className: 'text-xs text-slate-500' }, 'Yasal metinlerin ve sözleşmelerin mevzuata %100 uyumu için tamamlanması gereken 5 temel adım')
              )
            ),
            e('div', { className: 'space-y-2.5 mt-4' },
              (legalAuditReport.recommendations || []).map((rec, idx) => e('div', {
                key: idx,
                className: 'flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700'
              },
                e('span', { className: 'flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-[11px]' }, idx + 1),
                e('p', { className: 'leading-relaxed mt-0.5' }, rec)
              ))
            )
          )
        ] : e('div', { className: 'bg-white rounded-2xl p-12 text-center border border-slate-200' },
          e('span', { className: 'text-4xl block mb-2' }, '📜'),
          e('h3', { className: 'text-base font-bold text-slate-900 mb-1' }, '9 Temel Yasal Metin ve Sözleşme Denetimi'),
          e('p', { className: 'text-xs text-slate-500 max-w-md mx-auto mb-4' },
            'Üyelik, Kullanım Şartları, Gizlilik, KVKK, Çerez, Açık Rıza, Ön Bilgilendirme, Mesafeli Satış ve İptal/İade metinleri henüz taranmadı.'
          ),
          e('button', {
            type: 'button',
            onClick: handleRunLegalAudit,
            disabled: legalLoading,
            className: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer'
          }, legalLoading ? 'Denetleniyor...' : 'Yasal Metinleri Şimdi Denetle')
        )) : null,

        // SUB-VIEW 2: Çerez ve Teknik KVKK (10 Kontrol)
        activeKvkkSubTab === 'cookies' ? (kvkkReport ? [
          // 1. KVKK Başlık ve Genel Puan Kartı
          e('div', { key: 'cookie-header', className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
            e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center' },
              e('span', { className: 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-2' }, 'KVKK Uyumluluk Puanı'),
              e('div', { className: `w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center ${getScoreBorder(kvkkReport.score)} shadow-inner` },
                e('span', { className: 'text-4xl font-black tracking-tight' }, kvkkReport.score),
                e('span', { className: 'text-xs font-bold text-slate-400' }, '/ 100')
              ),
              e('div', { className: 'mt-4' }, e(ComplianceBadge, { status: kvkkReport.status })),
              e('span', { className: 'text-[11px] text-slate-400 mt-2 font-medium' },
                'Son Denetim: ' + new Date(kvkkReport.timestamp).toLocaleString('tr-TR')
              )
            ),
            e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 lg:col-span-2 flex flex-col justify-between' },
              e('div', null,
                e('div', { className: 'flex items-center justify-between mb-2' },
                  e('h3', { className: 'text-base font-bold text-slate-900' }, 'Mevzuat Uyumluluk Özeti'),
                  e('div', { className: 'flex items-center gap-1.5 text-xs font-semibold' },
                    e('span', { className: 'px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200' }, `${kvkkReport.counts.compliant} Uyumlu`),
                    kvkkReport.counts.partial > 0 ? e('span', { className: 'px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200' }, `${kvkkReport.counts.partial} Kısmen`) : null,
                    kvkkReport.counts.nonCompliant > 0 ? e('span', { className: 'px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200' }, `${kvkkReport.counts.nonCompliant} Uyumsuz`) : null
                  )
                ),
                e('p', { className: 'text-xs text-slate-600 mb-4' }, kvkkReport.summary),
                e('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-3' },
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1' }, 'Çerez Rıza Yönetimi'),
                    e('span', { className: 'text-sm font-bold text-slate-800' }, '4 / 4 Kriter'),
                    e('p', { className: 'text-[11px] text-slate-500 mt-0.5' }, 'Banner, depolama, tercih değiştirme ve consent mode')
                  ),
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1' }, 'Çerez Güvenliği'),
                    e('span', { className: 'text-sm font-bold text-slate-800' }, '3 / 3 Kriter'),
                    e('p', { className: 'text-[11px] text-slate-500 mt-0.5' }, 'HttpOnly, Secure ve SameSite koruma parametreleri')
                  ),
                  e('div', { className: 'bg-slate-50 p-3 rounded-xl border border-slate-100' },
                    e('span', { className: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1' }, 'Aydınlatma & Şeffaflık'),
                    e('span', { className: 'text-sm font-bold text-slate-800' }, '3 / 3 Kriter'),
                    e('p', { className: 'text-[11px] text-slate-500 mt-0.5' }, 'Gizlilik, KVKK m.10/11 ve Çerez Politikası metinleri')
                  )
                )
              ),
              e('div', { className: 'mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500' },
                e('span', null, 'Yasal Dayanak: 6698 sayılı KVKK & 2002/58/EC e-Privacy Çerez Direktifi'),
                e('span', { className: 'font-semibold text-emerald-700' }, '10 / 10 Madde Denetlendi')
              )
            )
          ),

          // 2. 10 Kriter Kartları
          e('div', { key: 'cookie-cards', className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            kvkkReport.items.map(item => e('div', {
              key: item.id,
              className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between'
            },
              e('div', null,
                e('div', { className: 'flex items-start justify-between gap-3 mb-2.5' },
                  e('div', null,
                    e('span', { className: 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 mb-1' }, item.category),
                    e('h4', { className: 'font-bold text-slate-900 text-sm' }, item.title)
                  ),
                  e('div', { className: 'flex items-center gap-2' },
                    e('span', { className: 'font-mono text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200' }, `${item.score}/10`),
                    e(ComplianceBadge, { status: item.status })
                  )
                ),
                e('p', { className: 'text-xs text-slate-600 leading-relaxed mb-3' }, item.details),
                item.risk ? e('div', { className: 'bg-rose-50/80 border border-rose-200 text-rose-800 rounded-xl p-2.5 text-xs mb-2' },
                  e('span', { className: 'font-bold block mb-0.5' }, '⚠️ Tespit Edilen Risk:'),
                  e('span', null, item.risk)
                ) : null,
                item.recommendation ? e('div', { className: 'bg-amber-50/80 border border-amber-200 text-amber-800 rounded-xl p-2.5 text-xs' },
                  e('span', { className: 'font-bold block mb-0.5' }, '💡 Öneri & Çözüm:'),
                  e('span', null, item.recommendation)
                ) : null
              )
            ))
          ),

          // 3. Öneriler Paneli
          e('div', { key: 'cookie-recs', className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80' },
            e('div', { className: 'flex items-center gap-2.5 mb-3' },
              e('span', { className: 'text-2xl' }, '💡'),
              e('div', null,
                e('h3', { className: 'font-bold text-slate-900 text-base' }, 'Eksik ve Riskli Alanlar İçin Öneriler'),
                e('p', { className: 'text-xs text-slate-500' }, 'Sistemin hukuki ve teknik uyumluluğunu en üst seviyeye taşımak için tavsiyeler')
              )
            ),
            e('div', { className: 'space-y-2.5 mt-4' },
              (kvkkReport.recommendations || []).map((rec, idx) => e('div', {
                key: idx,
                className: 'flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700'
              },
                e('span', { className: 'flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[11px]' }, idx + 1),
                e('p', { className: 'leading-relaxed mt-0.5' }, rec)
              ))
            )
          )
        ] : e('div', { className: 'bg-white rounded-2xl p-12 text-center border border-slate-200' },
          e('span', { className: 'text-4xl block mb-2' }, '🍪'),
          e('h3', { className: 'text-base font-bold text-slate-900 mb-1' }, 'KVKK ve Çerez Uyumluluk Raporu'),
          e('p', { className: 'text-xs text-slate-500 max-w-md mx-auto mb-4' },
            'Sitenin çerez bannerı, rıza kaydı, Consent Mode kurgusu, çerez güvenlik bayrakları ve yasal metinleri henüz denetlenmedi.'
          ),
          e('button', {
            type: 'button',
            onClick: handleRunKvkkScan,
            disabled: kvkkLoading,
            className: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer'
          }, kvkkLoading ? 'Taranıyor...' : 'Taramayı Şimdi Başlat')
        )) : null
      ) : null,

      // LOGS TAB: Son 30 Tarama
      activeTab === 'logs' ? e('div', { className: 'bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden' },
        e('div', { className: 'p-5 border-b border-slate-100 flex items-center justify-between' },
          e('div', null,
            e('h3', { className: 'font-bold text-slate-900 text-base' }, 'Son 30 Tarama Kayıtları'),
            e('p', { className: 'text-xs text-slate-500' }, 'Veritabanında saklanan geçmiş sistem taramaları')
          ),
          e('span', { className: 'text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-medium' }, `Toplam ${logs.length} Kayıt`)
        ),
        e('div', { className: 'overflow-x-auto' },
          e('table', { className: 'w-full text-left text-xs border-collapse' },
            e('thead', null,
              e('tr', { className: 'bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-wider font-bold' },
                e('th', { className: 'py-3 px-4' }, 'Tarih / Saat'),
                e('th', { className: 'py-3 px-4' }, 'Tür'),
                e('th', { className: 'py-3 px-4' }, 'Puan'),
                e('th', { className: 'py-3 px-4' }, 'Durum'),
                e('th', { className: 'py-3 px-4' }, 'Ort. Süre'),
                e('th', { className: 'py-3 px-4' }, 'Teşhis & Uyarılar'),
                e('th', { className: 'py-3 px-4' }, 'Tarayan')
              )
            ),
            e('tbody', { className: 'divide-y divide-slate-100 text-slate-700 font-medium' },
              logs.length === 0 ? e('tr', null,
                e('td', { colSpan: 7, className: 'py-8 text-center text-slate-400' }, 'Henüz kayıtlı bir sistem taraması bulunmuyor.')
              ) : logs.map(item => e('tr', { key: item._id, className: 'hover:bg-slate-50/80 transition' },
                e('td', { className: 'py-3 px-4 font-mono text-slate-600 whitespace-nowrap' },
                  new Date(item.timestamp || item.createdAt).toLocaleString('tr-TR')
                ),
                e('td', { className: 'py-3 px-4' },
                  item.isScheduled ? e('span', { className: 'px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200' }, 'Otomatik 08:00') : e('span', { className: 'px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700' }, 'Manuel')
                ),
                e('td', { className: 'py-3 px-4 font-bold text-sm' },
                  e('span', { className: item.score >= 90 ? 'text-emerald-700' : (item.score >= 70 ? 'text-amber-700' : 'text-rose-700') },
                    `${item.score} / 100`
                  )
                ),
                e('td', { className: 'py-3 px-4' }, e(StatusBadge, { status: item.status })),
                e('td', { className: 'py-3 px-4 font-mono text-slate-500' },
                  item.checks && item.checks.performance && item.checks.performance.averageMs ? `${item.checks.performance.averageMs} ms` : '-'
                ),
                e('td', { className: 'py-3 px-4 max-w-xs truncate text-slate-600', title: item.summary },
                  item.warnings && item.warnings.length > 0 ? e('span', { className: 'text-amber-700 font-normal' }, `⚠️ ${item.warnings.join(', ')}`) : (item.summary || 'Başarılı tarama')
                ),
                e('td', { className: 'py-3 px-4 text-slate-500 whitespace-nowrap' }, item.scannedBy || 'Süper Admin')
              ))
            )
          )
        )
      ) : null,

      initialLoading && !scan && !kvkkReport ? e('div', { className: 'bg-white rounded-2xl p-12 text-center border border-slate-200' },
        e('div', { className: 'w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3' }),
        e('p', { className: 'text-sm font-semibold text-slate-700' }, 'Sistem sağlığı ve KVKK durumu yükleniyor...')
      ) : null
    );
  }

  global.initSystemHealthApp = function (containerId) {
    const container = document.getElementById(containerId);
    if (!container || !global.ReactDOM || !global.React) return;

    if (container._reactRoot) {
      container._reactRoot.render(e(SystemHealthApp));
    } else {
      const root = global.ReactDOM.createRoot(container);
      container._reactRoot = root;
      root.render(e(SystemHealthApp));
    }
  };

})(window);
