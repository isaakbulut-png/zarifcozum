const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdminRouter } = require('../routes/admin');

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

  const router = createAdminRouter({
    User: mockUser,
    Payment: {},
    SystemConfig: {},
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
  });
});
