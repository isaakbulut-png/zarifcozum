/**
 * ZarifÇözüm - Sistem Sağlığı ve Güvenlik Kontrolü
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

  function SystemHealthApp() {
    const [scan, setScan] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    const fetchInitialData = useCallback(async () => {
      setInitialLoading(true);
      setErrorMsg(null);
      try {
        const [latestRes, logsRes] = await Promise.all([
          fetch('/api/admin/system-health/latest').then(r => r.json()),
          fetch('/api/admin/system-health/logs?limit=30').then(r => r.json())
        ]);
        if (latestRes && latestRes.scan) setScan(latestRes.scan);
        if (logsRes && logsRes.logs) setLogs(logsRes.logs);
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
            e('h2', { className: 'text-xl md:text-2xl font-bold text-slate-900 tracking-tight' }, 'Sistem Sağlığı ve Güvenlik Kontrolü'),
            e('p', { className: 'text-xs md:text-sm text-slate-500 mt-0.5' }, 'Render API, PostgreSQL, MongoDB, Cloudflare R2, Cloudinary, SSL ve CDN Canlı Teşhisi')
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
              onClick: () => setActiveTab('logs'),
              className: `px-3.5 py-1.5 rounded-lg transition ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`
            }, `📜 Son 30 Tarama (${logs.length})`)
          ),
          e('button', {
            type: 'button',
            onClick: handleStartScan,
            disabled: loading,
            className: 'flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer'
          },
            loading
              ? [e('span', { key: 'spin', className: 'inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' }), ' Taranıyor...']
              : ['🔄 Sistem Taraması Başlat']
          )
        )
      ),

      // Hata Bildirimi
      errorMsg ? e('div', { className: 'bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm flex items-center gap-3' },
        e('span', { className: 'text-xl' }, '⚠️'),
        e('span', null, errorMsg)
      ) : null,

      // Loading Animasyonu
      loading ? e('div', { className: 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 text-center animate-pulse' },
        e('div', { className: 'inline-block w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-3' }),
        e('h3', { className: 'text-base font-semibold text-amber-900' }, 'Tüm Servisler ve Altyapı Taranıyor...'),
        e('p', { className: 'text-xs text-amber-700 mt-1' }, 'Render backend, PostgreSQL SELECT 1, R2 okuma/yazma/silme döngüsü, Cloudinary API ve SSL sertifikası analiz ediliyor.')
      ) : null,

      // Başlangıç Yükleniyor
      initialLoading && !scan ? e('div', { className: 'bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm' },
        e('div', { className: 'w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3' }),
        e('p', { className: 'text-sm font-semibold text-slate-700' }, 'Sistem sağlık verileri yükleniyor...')
      ) : null,

      // Henüz Tarama Yoksa
      !initialLoading && !scan ? e('div', { className: 'bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm' },
        e('span', { className: 'text-4xl block mb-2' }, '🔍'),
        e('h3', { className: 'text-lg font-bold text-slate-800' }, 'Henüz Bir Sistem Taraması Yapılmadı'),
        e('p', { className: 'text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5' }, 'Tüm altyapı bileşenlerini, veritabanlarını, R2 depolamayı ve SSL sertifikasını test etmek için taramayı başlatın.'),
        e('button', {
          type: 'button',
          onClick: handleStartScan,
          className: 'px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition cursor-pointer'
        }, 'İlk Taramayı Başlat')
      ) : null,

      // 2. Anlık Durum Sekmesi
      activeTab === 'overview' && scan ? [
        // Skor ve Özet Kartı
        e('div', { key: 'score-row', className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
          // Skor Dairesi
          e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center' },
            e('span', { className: 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-2' }, 'Genel Sistem Puanı'),
            e('div', { className: `w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center ${getScoreBorder(scan.score)} shadow-inner` },
              e('span', { className: 'text-4xl font-extrabold tracking-tight' }, scan.score),
              e('span', { className: 'text-xs font-semibold text-slate-400' }, '/ 100')
            ),
            e('div', { className: 'mt-4' }, e(StatusBadge, { status: scan.status })),
            e('p', { className: 'text-xs text-slate-400 mt-2 font-mono' },
              `Son Tarama: ${new Date(scan.timestamp).toLocaleString('tr-TR')}`
            )
          ),

          // Özet ve Hızlı Kontrol Listesi
          e('div', { className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 lg:col-span-2 flex flex-col justify-between' },
            e('div', null,
              e('h3', { className: 'text-base font-bold text-slate-900 mb-1' }, 'Teşhis Özeti ve Servis Durumları'),
              e('p', { className: 'text-sm text-slate-600 mb-4' }, scan.summary),

              e('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2.5' },
                e('div', { className: 'flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium' },
                  e('span', null, scan.checks?.api?.status === 'healthy' ? '✅' : (scan.checks?.api?.status === 'warning' ? '⚠️' : '❌')),
                  e('span', { className: 'truncate' }, 'Backend API')
                ),
                e('div', { className: 'flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium' },
                  e('span', null, scan.checks?.database?.status === 'healthy' ? '✅' : (scan.checks?.database?.status === 'warning' ? '⚠️' : '❌')),
                  e('span', { className: 'truncate' }, 'Veritabanları')
                ),
                e('div', { className: 'flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium' },
                  e('span', null, scan.checks?.r2?.status === 'healthy' ? '✅' : (scan.checks?.r2?.status === 'warning' ? '⚠️' : '❌')),
                  e('span', { className: 'truncate' }, 'Cloudflare R2')
                ),
                e('div', { className: 'flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium' },
                  e('span', null, scan.checks?.cloudinary?.status === 'healthy' ? '✅' : (scan.checks?.cloudinary?.status === 'warning' ? '⚠️' : '❌')),
                  e('span', { className: 'truncate' }, 'Cloudinary')
                ),
                e('div', { className: 'flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium' },
                  e('span', null, scan.checks?.ssl?.status === 'healthy' ? '✅' : (scan.checks?.ssl?.status === 'warning' ? '⚠️' : '❌')),
                  e('span', { className: 'truncate' }, 'SSL Sertifikası')
                ),
                e('div', { className: 'flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium' },
                  e('span', null, scan.checks?.domain?.status === 'healthy' ? '✅' : (scan.checks?.domain?.status === 'warning' ? '⚠️' : '❌')),
                  e('span', { className: 'truncate' }, 'Domain & CDN')
                )
              )
            ),

            // Uyarı ve Not Kutuları
            e('div', { className: 'mt-4 pt-3 border-t border-slate-100 space-y-1.5' },
              scan.warnings && scan.warnings.length > 0
                ? scan.warnings.map((w, idx) => e('div', { key: idx, className: 'text-xs text-amber-800 bg-amber-50/80 p-2 rounded-lg flex items-center gap-2 border border-amber-200/50' },
                    e('span', null, '⚠️'),
                    e('span', null, w)
                  ))
                : null,
              scan.errors && scan.errors.length > 0
                ? scan.errors.map((err, idx) => e('div', { key: idx, className: 'text-xs text-rose-800 bg-rose-50/80 p-2 rounded-lg flex items-center gap-2 border border-rose-200/50' },
                    e('span', null, '❌'),
                    e('span', null, err)
                  ))
                : null
            )
          )
        ),

        // 6 Kritik Servis Kartı
        e('div', { key: 'services-grid', className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
          // 1. API
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between' },
            e('div', null,
              e('div', { className: 'flex items-center justify-between mb-3' },
                e('div', { className: 'flex items-center gap-2.5' },
                  e('span', { className: 'text-2xl' }, '⚡'),
                  e('div', null,
                    e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Backend API (Render)'),
                    e('span', { className: 'text-[11px] text-slate-400 font-mono' }, '/api/health')
                  )
                ),
                e(StatusBadge, { status: scan.checks?.api?.status })
              ),
              e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks?.api?.details)
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yanıt Süresi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks?.api?.durationMs || 0} ms`)
            )
          ),

          // 2. Veritabanları
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between' },
            e('div', null,
              e('div', { className: 'flex items-center justify-between mb-3' },
                e('div', { className: 'flex items-center gap-2.5' },
                  e('span', { className: 'text-2xl' }, '🗄️'),
                  e('div', null,
                    e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Veritabanı Servisleri'),
                    e('span', { className: 'text-[11px] text-slate-400' }, 'PostgreSQL & MongoDB')
                  )
                ),
                e(StatusBadge, { status: scan.checks?.database?.status })
              ),
              e('div', { className: 'space-y-2 mb-3' },
                e('div', { className: 'bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100' },
                  e('div', { className: 'flex justify-between items-center font-semibold text-slate-800' },
                    e('span', null, '🐘 PostgreSQL (SELECT 1):'),
                    e(StatusBadge, { status: scan.checks?.database?.postgres?.status })
                  ),
                  e('p', { className: 'text-[11px] text-slate-500 mt-1 leading-relaxed' }, scan.checks?.database?.postgres?.details)
                ),
                e('div', { className: 'bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100' },
                  e('div', { className: 'flex justify-between items-center font-semibold text-slate-800' },
                    e('span', null, '🍃 MongoDB Atlas:'),
                    e(StatusBadge, { status: scan.checks?.database?.mongo?.status })
                  ),
                  e('p', { className: 'text-[11px] text-slate-500 mt-1 leading-relaxed' }, scan.checks?.database?.mongo?.details)
                )
              )
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'MongoDB Ping:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks?.database?.mongo?.durationMs || 0} ms`)
            )
          ),

          // 3. Cloudflare R2
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between' },
            e('div', null,
              e('div', { className: 'flex items-center justify-between mb-3' },
                e('div', { className: 'flex items-center gap-2.5' },
                  e('span', { className: 'text-2xl' }, '📦'),
                  e('div', null,
                    e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Cloudflare R2 Depolama'),
                    e('span', { className: 'text-[11px] text-slate-400 font-mono' }, scan.checks?.r2?.bucket || 'S3 Bucket')
                  )
                ),
                e(StatusBadge, { status: scan.checks?.r2?.status })
              ),
              e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks?.r2?.details)
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yazma/Okuma/Silme:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks?.r2?.durationMs || 0} ms`)
            )
          ),

          // 4. Cloudinary
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between' },
            e('div', null,
              e('div', { className: 'flex items-center justify-between mb-3' },
                e('div', { className: 'flex items-center gap-2.5' },
                  e('span', { className: 'text-2xl' }, '🖼️'),
                  e('div', null,
                    e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Cloudinary Medya Servisi'),
                    e('span', { className: 'text-[11px] text-slate-400' }, 'Görsel Optimizasyonu & API')
                  )
                ),
                e(StatusBadge, { status: scan.checks?.cloudinary?.status })
              ),
              e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks?.cloudinary?.details)
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Yükleme/Silme Testi:'),
              e('span', { className: 'text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded' }, `${scan.checks?.cloudinary?.durationMs || 0} ms`)
            )
          ),

          // 5. SSL
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between' },
            e('div', null,
              e('div', { className: 'flex items-center justify-between mb-3' },
                e('div', { className: 'flex items-center gap-2.5' },
                  e('span', { className: 'text-2xl' }, '🔒'),
                  e('div', null,
                    e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'SSL / TLS Sertifikası'),
                    e('span', { className: 'text-[11px] text-slate-400 font-mono' }, scan.checks?.ssl?.domain || 'www.zarifcozum.com')
                  )
                ),
                e(StatusBadge, { status: scan.checks?.ssl?.status })
              ),
              e('p', { className: 'text-xs text-slate-600 mb-3' }, scan.checks?.ssl?.details)
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Kalan Geçerlilik:'),
              e('span', { className: `font-mono px-2 py-0.5 rounded ${scan.checks?.ssl?.daysLeft < 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}` },
                `${scan.checks?.ssl?.daysLeft || 0} gün`
              )
            )
          ),

          // 6. Domain & CDN
          e('div', { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between' },
            e('div', null,
              e('div', { className: 'flex items-center justify-between mb-3' },
                e('div', { className: 'flex items-center gap-2.5' },
                  e('span', { className: 'text-2xl' }, '🌐'),
                  e('div', null,
                    e('h4', { className: 'font-bold text-slate-900 text-sm' }, 'Domain & Cloudflare CDN'),
                    e('span', { className: 'text-[11px] text-slate-400' }, 'HTTPS Yönlendirme & Edge')
                  )
                ),
                e(StatusBadge, { status: scan.checks?.domain?.status })
              ),
              e('div', { className: 'space-y-1.5 text-xs text-slate-600 mb-3' },
                e('div', { className: 'flex justify-between' },
                  e('span', null, 'www.zarifcozum.com:'),
                  e('span', { className: 'font-mono text-emerald-700 font-semibold' },
                    `HTTP ${scan.checks?.domain?.mainDomain?.statusCode} (${scan.checks?.domain?.mainDomain?.durationMs || 0}ms)`
                  )
                ),
                e('div', { className: 'flex justify-between' },
                  e('span', null, 'media.zarifcozum.com:'),
                  e('span', { className: 'font-mono text-slate-600' },
                    `HTTP ${scan.checks?.domain?.mediaDomain?.statusCode}`
                  )
                ),
                e('div', { className: 'flex justify-between' },
                  e('span', null, 'HTTP > HTTPS Yönlendirme:'),
                  e('span', { className: 'text-emerald-700 font-semibold' },
                    scan.checks?.domain?.httpsRedirect?.redirected ? '301 Yönlendirildi ✅' : 'Doğrudan ⚠️'
                  )
                )
              )
            ),
            e('div', { className: 'flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100' },
              e('span', null, 'Cloudflare Cache:'),
              e('span', { className: 'text-slate-700 font-mono text-[11px]' }, scan.checks?.mediaCdn?.cfCacheStatus || 'DYNAMIC')
            )
          )
        ),

        // 3. Performans Göstergeleri
        e('div', { key: 'perf-box', className: 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80' },
          e('div', { className: 'flex items-center justify-between mb-4' },
            e('div', null,
              e('h3', { className: 'font-bold text-slate-900 text-base' }, 'Altyapı Performans ve Yanıt Süreleri'),
              e('p', { className: 'text-xs text-slate-500' }, 'Bileşen bazında milisaniye (ms) cinsinden yanıt ve işlem süreleri')
            ),
            e('div', { className: 'flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-xl border border-emerald-200 text-sm font-bold' },
              e('span', null, 'Performans Sınıfı:'),
              e('span', { className: 'text-base font-extrabold text-emerald-700' }, scan.checks?.performance?.grade || 'A+')
            )
          ),
          e('div', { className: 'grid grid-cols-2 md:grid-cols-5 gap-4' },
            e('div', { className: 'bg-slate-50 p-4 rounded-xl border border-slate-100 text-center' },
              e('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Backend API'),
              e('span', { className: 'text-xl font-bold font-mono text-slate-900' }, scan.checks?.performance?.apiMs || 0, ' ', e('span', { className: 'text-xs font-normal text-slate-400' }, 'ms'))
            ),
            e('div', { className: 'bg-slate-50 p-4 rounded-xl border border-slate-100 text-center' },
              e('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Veritabanı'),
              e('span', { className: 'text-xl font-bold font-mono text-slate-900' }, scan.checks?.performance?.dbMs || 0, ' ', e('span', { className: 'text-xs font-normal text-slate-400' }, 'ms'))
            ),
            e('div', { className: 'bg-slate-50 p-4 rounded-xl border border-slate-100 text-center' },
              e('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Cloudflare R2'),
              e('span', { className: 'text-xl font-bold font-mono text-slate-900' }, scan.checks?.performance?.r2Ms || 0, ' ', e('span', { className: 'text-xs font-normal text-slate-400' }, 'ms'))
            ),
            e('div', { className: 'bg-slate-50 p-4 rounded-xl border border-slate-100 text-center' },
              e('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Cloudinary'),
              e('span', { className: 'text-xl font-bold font-mono text-slate-900' }, scan.checks?.performance?.cloudinaryMs || 0, ' ', e('span', { className: 'text-xs font-normal text-slate-400' }, 'ms'))
            ),
            e('div', { className: 'bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center col-span-2 md:col-span-1' },
              e('span', { className: 'text-xs text-emerald-700 block mb-1 font-semibold' }, 'Ortalama Süre'),
              e('span', { className: 'text-xl font-bold font-mono text-emerald-900' }, scan.checks?.performance?.averageMs || 0, ' ', e('span', { className: 'text-xs font-normal text-emerald-600' }, 'ms'))
            )
          )
        )
      ] : null,

      // 4. Son 30 Tarama Kayıtları Sekmesi
      activeTab === 'logs' ? e('div', { key: 'logs-view', className: 'bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden' },
        e('div', { className: 'p-5 border-b border-slate-100 flex items-center justify-between' },
          e('div', null,
            e('h3', { className: 'font-bold text-slate-900 text-base' }, 'Son 30 Tarama Kayıtları'),
            e('p', { className: 'text-xs text-slate-500' }, 'MongoDB veritabanında kalıcı olarak saklanan sistem denetim kayıtları')
          ),
          e('span', { className: 'text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-lg font-medium' },
            `Toplam ${logs.length} Kayıt`
          )
        ),
        e('div', { className: 'overflow-x-auto' },
          e('table', { className: 'w-full text-left text-xs border-collapse' },
            e('thead', null,
              e('tr', { className: 'bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-wider font-bold' },
                e('th', { className: 'py-3.5 px-4' }, 'Tarih / Saat'),
                e('th', { className: 'py-3.5 px-4' }, 'Puan'),
                e('th', { className: 'py-3.5 px-4' }, 'Durum'),
                e('th', { className: 'py-3.5 px-4' }, 'Ort. Yanıt'),
                e('th', { className: 'py-3.5 px-4' }, 'Özet ve Uyarılar'),
                e('th', { className: 'py-3.5 px-4' }, 'Tarayan')
              )
            ),
            e('tbody', { className: 'divide-y divide-slate-100 text-slate-700 font-medium' },
              logs.length === 0
                ? e('tr', null,
                    e('td', { colSpan: 6, className: 'py-10 text-center text-slate-400' }, 'Henüz kayıtlı bir sistem taraması bulunmuyor.')
                  )
                : logs.map(item => e('tr', { key: item._id, className: 'hover:bg-slate-50/80 transition' },
                    e('td', { className: 'py-3 px-4 font-mono text-slate-600 whitespace-nowrap' },
                      new Date(item.timestamp || item.createdAt).toLocaleString('tr-TR')
                    ),
                    e('td', { className: 'py-3 px-4 font-bold text-sm' },
                      e('span', { className: item.score >= 90 ? 'text-emerald-700' : (item.score >= 70 ? 'text-amber-700' : 'text-rose-700') },
                        `${item.score} / 100`
                      )
                    ),
                    e('td', { className: 'py-3 px-4' }, e(StatusBadge, { status: item.status })),
                    e('td', { className: 'py-3 px-4 font-mono text-slate-500' },
                      item.checks && item.checks.performance && item.checks.performance.averageMs
                        ? `${item.checks.performance.averageMs} ms`
                        : '-'
                    ),
                    e('td', { className: 'py-3 px-4 max-w-xs truncate text-slate-600', title: item.summary },
                      item.warnings && item.warnings.length > 0
                        ? e('span', { className: 'text-amber-700 font-normal' }, `⚠️ ${item.warnings.join(', ')}`)
                        : (item.summary || 'Başarılı tarama')
                    ),
                    e('td', { className: 'py-3 px-4 text-slate-500 whitespace-nowrap' }, item.scannedBy || 'Süper Admin')
                  ))
            )
          )
        )
      ) : null
    );
  }

  // Global mount helper for admin-paneli.html
  global.initSystemHealthApp = function (containerId = 'system-health-root') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!global.React || !global.ReactDOM) {
      container.innerHTML = '<div class="p-6 text-center text-rose-600 font-medium">React veya ReactDOM kütüphanesi yüklenemedi.</div>';
      return;
    }

    if (global.ReactDOM.createRoot) {
      if (!global._systemHealthRoot) {
        global._systemHealthRoot = global.ReactDOM.createRoot(container);
      }
      global._systemHealthRoot.render(e(SystemHealthApp));
    } else {
      global.ReactDOM.render(e(SystemHealthApp), container);
    }
  };

  global.SystemHealthApp = SystemHealthApp;
})(typeof window !== 'undefined' ? window : this);
