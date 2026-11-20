const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdminRouter } = require('../routes/admin');
const mongoose = require('mongoose');

test('Admin Paket Tanımlama API - Süperadmin Öğrenci Paket Yükseltme ve İptal', async (t) => {
  const mockUsers = new Map();
  const mockStudentId = new mongoose.Types.ObjectId().toString();

  const mockUserDoc = {
    _id: new mongoose.Types.ObjectId(mockStudentId),
    name: 'Gülefza Akbulut',
    email: 'uzmkullanici@gmail.com',
    role: 'student',
    paketTipi: 'free',
    subscriptionStatus: 'free',
    subscriptionPlan: null,
    subscriptionType: null,
    expiresAt: null,
    save: async function () {
      mockUsers.set(mockStudentId, { ...this });
      return this;
    }
  };
  mockUsers.set(mockStudentId, mockUserDoc);

  const MockUserModel = {
    findById: (id) => {
      const exec = async () => {
        const u = mockUsers.get(id ? id.toString() : '');
        if (!u) return null;
        return {
          ...u,
          save: async function () {
            mockUsers.set(id.toString(), { ...this });
            return this;
          }
        };
      };
      return {
        select: () => exec(),
        then: (resolve, reject) => exec().then(resolve, reject)
      };
    }
  };

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Admin Test',
    role: 'admin',
    adminRole: 'superadmin'
  };
  mockUsers.set('admin_123', adminUser);

  const MockAdminLog = {
    create: async () => ({})
  };

  const app = express();
  app.use(express.json());
  // Mock session as superadmin
  app.use((req, res, next) => {
    req.session = {
      user: {
        id: 'admin_123',
        role: 'admin',
        adminRole: 'superadmin'
      }
    };
    next();
  });

  const adminRouter = createAdminRouter({
    User: MockUserModel,
    Payment: {},
    SystemConfig: {},
    AdminLog: MockAdminLog
  });

  app.use('/api/admin', adminRouter);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test('1. Ön yüzden durationMonths: 12 ile VIP ver seçildiğinde paket başarıyla VIP ve aktif olur', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/${mockStudentId}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'grant', plan: 'vip', durationMonths: 12 })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.mesaj, /VIP Paket/);
    assert.equal(body.plan, 'vip');
    assert.equal(body.paketTipi, 'vip');
    assert.equal(body.subscriptionStatus, 'active');

    const updated = mockUsers.get(mockStudentId);
    assert.equal(updated.subscriptionPlan, 'vip');
    assert.equal(updated.paketTipi, 'vip');
    assert.equal(updated.subscriptionStatus, 'active');
    assert.ok(updated.expiresAt);
  });

  await t.test('2. Standart paket days: 365 ile tanımlanabilir', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/${mockStudentId}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'standart', days: 365 })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.plan, 'standart');
    assert.equal(body.paketTipi, 'standart');

    const updated = mockUsers.get(mockStudentId);
    assert.equal(updated.subscriptionPlan, 'standart');
    assert.equal(updated.paketTipi, 'standart');
  });

  await t.test('3. action: revoke ile abonelik kaldırıldığında free pakete döner', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/${mockStudentId}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke' })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.mesaj, /aboneliği kaldırıldı/);

    const updated = mockUsers.get(mockStudentId);
    assert.equal(updated.subscriptionStatus, 'free');
    assert.equal(updated.subscriptionPlan, null);
    assert.equal(updated.paketTipi, 'free');
    assert.equal(updated.expiresAt, null);
  });
});
