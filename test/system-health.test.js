const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdminRouter } = require('../routes/admin');
const { calculateMsUntilNextTime, executeScheduledScan } = require('../lib/system-health-scheduler');
const healthChecker = require('../lib/system-health-checker');

function withServer(router, sessionUser, fn) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (sessionUser) req.session = { user: sessionUser };
    next();
  });
  app.use(router);
  const server = app.listen(0);
  const port = server.address().port;
  return fn(`http://127.0.0.1:${port}`).finally(() => new Promise(res => server.close(res)));
}

test('system-health admin endpoints require superadmin role and return scans', async () => {
  const scans = [];
  const mockSystemHealthLog = {
    saveScan: async (doc) => {
      const saved = { ...doc, _id: 'scan-' + (scans.length + 1) };
      scans.push(saved);
      return { toObject: () => saved };
    },
    getLatest: async () => scans[scans.length - 1] || null,
    getLastLogs: async (limit) => scans.slice(-limit)
  };

  const mockHealthChecker = {
    runSystemHealthScan: async (scannedBy) => ({
      timestamp: new Date(),
      score: 98,
      status: 'healthy',
      summary: 'Sistem bileşenleri sağlıklı.',
      checks: {
        api: { status: 'healthy', durationMs: 25 },
        database: { status: 'healthy', postgres: { status: 'healthy' }, mongo: { status: 'healthy' } },
        r2: { status: 'healthy', durationMs: 120 },
        cloudinary: { status: 'healthy', durationMs: 240 },
        ssl: { status: 'healthy', daysLeft: 60 },
        domain: { status: 'healthy' },
        mediaCdn: { status: 'healthy', statusCode: 200 },
        pinecone: { status: 'healthy', durationMs: 140 },
        github: { status: 'healthy', durationMs: 180 },
        githubActions: { status: 'healthy', durationMs: 190 },
        gemini: { status: 'healthy', durationMs: 220 },
        cloudflare: { status: 'healthy', durationMs: 90 },
        googleCloud: { status: 'healthy', durationMs: 110 },
        performance: { averageMs: 128, grade: 'A+' }
      },
      warnings: [],
      errors: [],
      scannedBy
    })
  };

  const mockUser = {
    findById: (id) => ({
      select: async () => ({
        _id: { toString: () => id },
        name: 'Admin',
        email: id === 'super1' ? 'isaakbulut1@gmail.com' : 'user@example.com',
        role: 'admin',
        adminRole: id === 'editor1' ? 'editor' : (id === 'super1' ? 'superadmin' : 'support')
      })
    })
  };

  let activeAlert = null;
  const mockSystemConfig = {
    getSystemHealthAlert: async () => activeAlert || { active: false, score: 100, status: 'healthy', errors: [] },
    saveSystemHealthAlert: async (al) => {
      activeAlert = { ...al, updatedAt: new Date() };
      return activeAlert;
    },
    dismissSystemHealthAlert: async () => {
      activeAlert = { active: false, score: 100, status: 'healthy', errors: [] };
      return activeAlert;
    }
  };

  const router = createAdminRouter({
    User: mockUser,
    Payment: {},
    SystemConfig: mockSystemConfig,
    AdminLog: { create: async () => ({}) },
    SystemHealthLog: mockSystemHealthLog,
    healthChecker: mockHealthChecker,
    getFaqModel: () => ({ find: () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) })
  });

  // 1. Editor is rejected with 403
  await withServer(router, { id: 'editor1', role: 'admin' }, async base => {
    const res = await fetch(`${base}/system-health/latest`);
    assert.equal(res.status, 403);
    const postRes = await fetch(`${base}/system-health/scan`, { method: 'POST' });
    assert.equal(postRes.status, 403);
  });

  // 2. Superadmin can trigger scan
  await withServer(router, { id: 'super1', role: 'admin', email: 'isaakbulut1@gmail.com' }, async base => {
    // Initial latest is null
    const initialLatest = await (await fetch(`${base}/system-health/latest`)).json();
    assert.equal(initialLatest.scan, null);

    // Initial alert is inactive
    const alertRes0 = await (await fetch(`${base}/system-health/alert`)).json();
    assert.equal(alertRes0.alert.active, false);

    // Trigger scan
    const scanRes = await fetch(`${base}/system-health/scan`, { method: 'POST' });
    assert.equal(scanRes.status, 200);
    const scanData = await scanRes.json();
    assert.equal(scanData.scan.score, 98);
    assert.equal(scanData.scan.status, 'healthy');
    assert.equal(scans.length, 1);

    // Get latest now returns the scan
    const latestRes = await fetch(`${base}/system-health/latest`);
    assert.equal(latestRes.status, 200);
    const latestData = await latestRes.json();
    assert.equal(latestData.scan.score, 98);

    // Get logs returns the list
    const logsRes = await fetch(`${base}/system-health/logs?limit=30`);
    assert.equal(logsRes.status, 200);
    const logsData = await logsRes.json();
    assert.equal(logsData.logs.length, 1);
    assert.equal(logsData.logs[0].score, 98);

    // Dismiss alert endpoint works
    const dismissRes = await fetch(`${base}/system-health/alert/dismiss`, { method: 'POST' });
    assert.equal(dismissRes.status, 200);
  });
});

test('calculateMsUntilNextTime calculates delay to target 08:00 accurately', () => {
  const at0730 = new Date('2026-11-18T07:30:00.000');
  const ms1 = calculateMsUntilNextTime(8, 0, at0730);
  assert.equal(ms1, 30 * 60 * 1000); // 30 minutes

  const at0830 = new Date('2026-11-18T08:30:00.000');
  const ms2 = calculateMsUntilNextTime(8, 0, at0830);
  assert.equal(ms2, 23.5 * 60 * 60 * 1000); // 23.5 hours until tomorrow 08:00
});

test('executeScheduledScan handles failures, triggers audit log and sets dashboard alert', async () => {
  const auditLogs = [];
  let savedAlert = null;
  let savedScanLog = null;

  const mockFailChecker = {
    runSystemHealthScan: async () => ({
      score: 45,
      status: 'error',
      summary: 'Kritik servislerde kesinti var.',
      errors: ['Pinecone: API anahtarı geçersiz', 'Cloudflare R2: Bağlantı zaman aşımı'],
      warnings: [],
      checks: {},
      timestamp: new Date()
    })
  };

  const mockSystemHealthLog = {
    saveScan: async (doc) => {
      savedScanLog = doc;
      return { toObject: () => doc };
    }
  };

  const mockAdminLog = {
    create: async (entry) => {
      auditLogs.push(entry);
      return entry;
    }
  };

  const mockSystemConfig = {
    saveSystemHealthAlert: async (al) => {
      savedAlert = al;
      return al;
    },
    dismissSystemHealthAlert: async () => {
      savedAlert = null;
    }
  };

  let notifyCalled = false;
  const result = await executeScheduledScan({
    healthChecker: mockFailChecker,
    SystemHealthLog: mockSystemHealthLog,
    AdminLog: mockAdminLog,
    SystemConfig: mockSystemConfig,
    notifyAdmins: async () => { notifyCalled = true; }
  });

  assert.equal(result.hasErrors, true);
  assert.equal(result.scan.score, 45);
  assert.equal(savedScanLog.score, 45);
  assert.equal(notifyCalled, true);

  // 1. Audit Log created
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, 'system_health.failure_detected');
  assert.equal(auditLogs[0].entityType, 'system_health');

  // 2. Dashboard alert set to active
  assert.ok(savedAlert);
  assert.equal(savedAlert.active, true);
  assert.equal(savedAlert.errors.length, 2);

  // 3. When system is healthy, executeScheduledScan dismisses the alert
  const mockHealthyChecker = {
    runSystemHealthScan: async () => ({
      score: 96,
      status: 'healthy',
      summary: 'Her şey çalışıyor.',
      errors: [],
      warnings: [],
      checks: {},
      timestamp: new Date()
    })
  };

  const healthyResult = await executeScheduledScan({
    healthChecker: mockHealthyChecker,
    SystemHealthLog: mockSystemHealthLog,
    AdminLog: mockAdminLog,
    SystemConfig: mockSystemConfig
  });

  assert.equal(healthyResult.hasErrors, false);
  assert.equal(savedAlert, null);
});

test('healthChecker exports all 13 check functions', () => {
  assert.equal(typeof healthChecker.runSystemHealthScan, 'function');
  assert.equal(typeof healthChecker.checkApi, 'function');
  assert.equal(typeof healthChecker.checkDatabases, 'function');
  assert.equal(typeof healthChecker.checkCloudflareR2, 'function');
  assert.equal(typeof healthChecker.checkCloudinary, 'function');
  assert.equal(typeof healthChecker.checkSsl, 'function');
  assert.equal(typeof healthChecker.checkDomains, 'function');
  assert.equal(typeof healthChecker.checkCloudflareMedia, 'function');
  assert.equal(typeof healthChecker.checkPinecone, 'function');
  assert.equal(typeof healthChecker.checkGitHubApi, 'function');
  assert.equal(typeof healthChecker.checkGitHubActions, 'function');
  assert.equal(typeof healthChecker.checkGemini, 'function');
  assert.equal(typeof healthChecker.checkCloudflareApi, 'function');
  assert.equal(typeof healthChecker.checkGoogleCloud, 'function');
});
