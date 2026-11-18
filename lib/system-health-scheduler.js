/**
 * ZarifÇözüm Otomatik Sistem Sağlığı Tarayıcısı (Scheduler)
 * Her gün saat 08:00'de otomatik sağlık taraması çalıştırır.
 * Servis hatası durumunda:
 * - Admin bildirimi oluşturur
 * - Dashboard üzerinde kırmızı uyarı işaretler
 * - Audit Log kaydı oluşturur
 */

function calculateMsUntilNextTime(targetHour = 8, targetMinute = 0, now = new Date()) {
  const next = new Date(now.getTime());
  next.setHours(targetHour, targetMinute, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return Math.max(0, next.getTime() - now.getTime());
}

async function executeScheduledScan({
  healthChecker = require('./system-health-checker'),
  SystemHealthLog = require('../models/SystemHealthLog'),
  AdminLog = require('../models/AdminLog'),
  SystemConfig = require('../models/SystemConfig'),
  notifyAdmins = null
} = {}) {
  const scannedBy = 'Otomatik Günlük Tarama (08:00)';
  let scan = null;

  try {
    if (typeof healthChecker.runSystemHealthScan === 'function') {
      scan = await healthChecker.runSystemHealthScan(scannedBy, true);
    } else {
      scan = {
        score: 100,
        status: 'healthy',
        summary: 'Tarayıcı simülasyonu çalıştı.',
        checks: {},
        warnings: [],
        errors: [],
        isScheduled: true,
        scannedBy,
        timestamp: new Date()
      };
    }
  } catch (scanErr) {
    console.error('[HealthScheduler] Tarama hatası:', scanErr);
    scan = {
      score: 0,
      status: 'error',
      summary: 'Otomatik tarama yürütülürken hata oluştu: ' + scanErr.message,
      checks: {},
      warnings: [],
      errors: [scanErr.message],
      isScheduled: true,
      scannedBy,
      timestamp: new Date()
    };
  }

  // 1. Sonucu veritabanına kaydet
  let savedLog = null;
  try {
    if (SystemHealthLog && typeof SystemHealthLog.saveScan === 'function') {
      savedLog = await SystemHealthLog.saveScan(scan);
    }
  } catch (logErr) {
    console.warn('[HealthScheduler] Tarama logu kaydedilemedi:', logErr.message);
  }

  const hasErrors = scan.status === 'error' || (Array.isArray(scan.errors) && scan.errors.length > 0);

  // 2. Bir servis hata verirse:
  if (hasErrors) {
    console.warn('[HealthScheduler] Sistem sağlığı uyarısı tespit edildi! Hatalar:', scan.errors);

    // a. Audit Log kaydı oluştur
    try {
      if (AdminLog && typeof AdminLog.create === 'function') {
        await AdminLog.create({
          actorId: 'system',
          actorName: 'Otomatik Sağlık Tarayıcısı',
          action: 'system_health.failure_detected',
          entityType: 'system_health',
          entityId: 'daily_scan',
          details: {
            score: scan.score,
            status: scan.status,
            errors: scan.errors,
            warnings: scan.warnings,
            summary: scan.summary,
            scannedAt: scan.timestamp
          }
        });
      }
    } catch (auditErr) {
      console.warn('[HealthScheduler] Audit log yazılamadı:', auditErr.message);
    }

    // b. Dashboard üzerinde kırmızı uyarı ve Admin bildirimi oluştur
    try {
      if (SystemConfig && typeof SystemConfig.saveSystemHealthAlert === 'function') {
        await SystemConfig.saveSystemHealthAlert({
          active: true,
          score: scan.score,
          status: scan.status,
          errors: scan.errors,
          warnings: scan.warnings
        });
      }
    } catch (configErr) {
      console.warn('[HealthScheduler] Sistem uyarısı SystemConfig içine kaydedilemedi:', configErr.message);
    }

    // c. Ek admin bildirim geri çağrımı (opsiyonel)
    if (typeof notifyAdmins === 'function') {
      try {
        await notifyAdmins(scan);
      } catch (notifyErr) {
        console.warn('[HealthScheduler] Admin bildirim geri çağrımı başarısız:', notifyErr.message);
      }
    }
  } else {
    // Sistem sağlıklı ise eski aktif hatayı kaldır
    try {
      if (SystemConfig && typeof SystemConfig.dismissSystemHealthAlert === 'function') {
        await SystemConfig.dismissSystemHealthAlert();
      }
    } catch (_) {}
  }

  return { scan, savedLog, hasErrors };
}

function startDailyHealthScheduler(deps = {}) {
  let timerId = null;
  let running = true;
  let nextRunTime = null;

  function scheduleNext() {
    if (!running) return;

    const msUntil0800 = calculateMsUntilNextTime(8, 0);
    nextRunTime = new Date(Date.now() + msUntil0800);
    console.log(`[HealthScheduler] Sonraki otomatik sağlık taraması: ${nextRunTime.toLocaleString('tr-TR')} (${Math.round(msUntil0800 / 1000 / 60)} dakika sonra)`);

    timerId = setTimeout(async () => {
      if (!running) return;
      try {
        console.log('[HealthScheduler] Saat 08:00 günlük sistem sağlığı taraması başlatılıyor...');
        await executeScheduledScan(deps);
        console.log('[HealthScheduler] Günlük sistem sağlığı taraması tamamlandı.');
      } catch (err) {
        console.error('[HealthScheduler] Planlanmış tarama yürütülürken istisna oluştu:', err);
      } finally {
        scheduleNext();
      }
    }, msUntil0800);

    if (timerId && typeof timerId.unref === 'function') {
      timerId.unref();
    }
  }

  scheduleNext();

  return {
    stop: () => {
      running = false;
      if (timerId) clearTimeout(timerId);
      timerId = null;
    },
    triggerNow: () => executeScheduledScan(deps),
    getNextRunTime: () => nextRunTime,
    isRunning: () => running
  };
}

module.exports = {
  calculateMsUntilNextTime,
  executeScheduledScan,
  startDailyHealthScheduler
};
