const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ObjectId } = require('mongodb');
const test = require('node:test');
const { createAdminRouter } = require('../routes/admin');
const { DEFAULT_VISITOR_SETTINGS } = require('../models/SystemConfig');
const SiteMediaTargets = require('../assets/site-media-targets');

function fakeQuery(rows) {
  const query = {
    select: () => query, sort: () => query, skip: () => query, limit: () => query,
    populate: () => query, lean: async () => rows
  };
  return query;
}

function buildRouter(announcements = [], visitorSettings = { ...DEFAULT_VISITOR_SETTINGS }, options = {}) {
  const filters = [];
  const faqs = [];
  const homepageAssets = { animation: null, heroImage: null, featureImage: null };
  const siteMediaPlacements = [];
  const auditLogs = [];
  let faqInvalidations = 0;
  const User = {
    countDocuments: async () => 3,
    findById: id => ({
      select: async () => ({
        _id: { toString: () => id }, name: 'Admin', email: 'admin@example.com',
        role: id === 'teacher' || id === '2' ? 'teacher'
          : id === 'student' || id === '1' ? 'student' : 'admin',
        adminRole: id === 'teacher' ? 'editor' : id === 'support' ? 'support' : undefined,
        save: async function () { return this; }
      })
    }),
    find: filter => {
      filters.push(filter);
      return fakeQuery([{ _id: { toString: () => 'u1' }, name: 'Ada', email: 'ada@example.com', role: 'student', createdAt: new Date() }]);
    }
  };
  const Payment = { countDocuments: async () => 1, find: () => fakeQuery([]) };
  const collection = {
    countDocuments: async () => announcements.length,
    insertOne: async doc => { announcements.push(doc); return { insertedId: 'a1' }; }
  };
  const faqModel = {
    find: filter => {
      const entries = faqs.filter(entry =>
        (!filter.normalizedQuestion || entry.normalizedQuestion === filter.normalizedQuestion) &&
        (filter.active === undefined || entry.active === filter.active) &&
        (filter.grade === undefined || filter.grade === null && entry.grade === null ||
          filter.$or?.some(condition =>
            condition.grade === null ? entry.grade === null : entry.grade === condition.grade)));
      const cursor = {
        select() { return cursor; },
        sort() { return cursor; },
        limit() { return cursor; },
        lean: async () => entries
      };
      return cursor;
    },
    findOne: filter => ({
      select() {
        return { lean: async () => faqs.find(entry =>
          entry.normalizedQuestion === filter.normalizedQuestion && entry.scopeKey === filter.scopeKey) || null };
      }
    }),
    create: async doc => {
      if (faqs.some(entry => entry.normalizedQuestion === doc.normalizedQuestion &&
          entry.scopeKey === doc.scopeKey)) {
        throw Object.assign(new Error('duplicate key'), { code: 11000 });
      }
      const created = {
        _id: new ObjectId(),
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      faqs.push(created);
      return created;
    },
    findByIdAndUpdate: async (id, update) => {
      const entry = faqs.find(item => item._id.equals(id));
      if (!entry) return null;
      Object.assign(entry, update.$set);
      return entry;
    },
    deleteOne: async filter => {
      const index = faqs.findIndex(entry => entry._id.equals(filter._id));
      if (index < 0) return { deletedCount: 0 };
      faqs.splice(index, 1);
      return { deletedCount: 1 };
    }
  };
  const SystemConfig = {
    getVisitorSettings: async () => ({ ...visitorSettings }),
    saveVisitorSettings: async updates => Object.assign(visitorSettings, updates),
    getHomepageAssets: async () => ({ ...homepageAssets }),
    saveHomepageAsset: async (slot, url) => {
      homepageAssets[slot] = url;
      return { ...homepageAssets };
    },
    getSiteMediaPlacements: async () => [...siteMediaPlacements],
    saveSiteMediaPlacement: async placement => {
      const current = siteMediaPlacements.find(item =>
        item.pagePath === placement.pagePath && item.targetKey === placement.targetKey);
      if (current) Object.assign(current, placement);
      else siteMediaPlacements.push({_id: `placement-${siteMediaPlacements.length + 1}`, ...placement});
      return {...siteMediaPlacements.find(item =>
        item.pagePath === placement.pagePath && item.targetKey === placement.targetKey)};
    }
  };
  const AdminLog = {
    create: async doc => {
      auditLogs.push(doc);
      return { _id: { toString: () => 'log1' }, ...doc };
    },
    find: () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [] })
  };
  const listCollection = docs => ({
    find: () => ({
      project() { return this; }, sort() { return this; }, limit() { return this; },
      toArray: async () => docs
    })
  });
  return {
    filters,
    homepageAssets,
    siteMediaPlacements,
    faqs,
    auditLogs,
    get faqInvalidations() { return faqInvalidations; },
    router: createAdminRouter({
      User, Payment, SystemConfig, AdminLog, uploadDir: options.uploadDir,
      siteMediaUploadDir: options.siteMediaUploadDir,
      mediaStorage: options.mediaStorage,
      getAnnouncementCollection: () => collection,
      getFaqModel: () => faqModel,
      invalidateFaqCache: async () => { faqInvalidations += 1; },
      getQuizCollection: () => listCollection([]),
      getLessonCollection: () => listCollection([]),
      getSupportTicketCollection: () => listCollection([])
    })
  };
}

function withServer(router, sessionUser, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: sessionUser }; next(); });
  app.use('/api/admin', router);
  const server = app.listen(0);
  return new Promise((resolve, reject) => {
    server.once('listening', async () => {
      try {
        await callback(`http://127.0.0.1:${server.address().port}/api/admin`);
        server.close(() => resolve());
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

test('admin API rejects anonymous, student and teacher sessions', async () => {
  for (const user of [undefined, { id: 'student', role: 'student' }, { id: 'teacher', role: 'teacher' }]) {
    await withServer(buildRouter().router, user, async base => {
      const response = await fetch(`${base}/overview`);
      assert.equal(response.status, user ? 403 : 401);
    });
  }
});

test('admin can read overview and escaped user search', async () => {
  const { router, filters } = buildRouter();
  await withServer(router, { id: 'admin', role: 'admin' }, async base => {
    const overview = await (await fetch(`${base}/overview`)).json();
    assert.equal(overview.students, 3);

    const response = await fetch(`${base}/users?q=${encodeURIComponent('.*(')}&role=student`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).users[0].email, 'ada@example.com');
    assert.equal(filters[0].role, 'student');
    assert.equal(filters[0].$or[0].name.source, '\\.\\*\\(');
  });
});

test('admin can publish announcements and validates input', async () => {
  const announcements = [];
  await withServer(buildRouter(announcements).router, { id: 'admin', role: 'admin' }, async base => {
    const post = body => fetch(`${base}/announcements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({ message: '  ' })).status, 400);
    assert.equal((await post({ message: 'Merhaba' })).status, 201);
    assert.equal(announcements[0].message, 'Merhaba');
    assert.equal(announcements[0].createdBy, 'admin');
  });
});

test('superadmin can manage exact-match FAQ entries and invalidates their cache', async () => {
  const context = buildRouter();
  await withServer(context.router, { id: 'admin', role: 'admin' }, async base => {
    const send = (url, method, body) => fetch(`${base}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    assert.equal((await send('/faqs', 'POST', { question: '', answer: 'Yanıt' })).status, 400);
    const created = await send('/faqs', 'POST', {
      question: 'Kesir nedir?',
      answerHtml: '<p>Bir bütünün <strong>eş parçalarından</strong> biridir.</p>',
      grade: '5',
      active: true
    });
    assert.equal(created.status, 201);
    const faq = (await created.json()).faq;
    assert.equal(context.faqs[0].normalizedQuestion, 'kesir nedir');
    assert.equal(context.faqs[0].answerText, 'Bir bütünün eş parçalarından biridir.');
    assert.equal(context.faqInvalidations, 1);

    assert.equal((await send('/faqs', 'POST', {
      question: 'KESİR NEDİR',
      answerHtml: '<p>Çift kayıt</p>',
      grade: 5
    })).status, 409);

    const updated = await send(`/faqs/${faq.id}`, 'PUT', {
      question: 'Kesir nedir?',
      answerHtml: '<p>Güncel yanıt</p>',
      grade: 5,
      active: false
    });
    assert.equal(updated.status, 200);
    assert.equal(context.faqs[0].answerText, 'Güncel yanıt');
    assert.equal(context.faqInvalidations, 2);

    const list = await send('/faqs', 'GET');
    const items = (await list.json()).faqs;
    assert.equal(items.length, 1);
    assert.equal(items[0].active, false);

    assert.equal((await send(`/faqs/${faq.id}`, 'DELETE')).status, 200);
    assert.equal(context.faqs.length, 0);
    assert.equal(context.faqInvalidations, 3);
  });
});

test('admin can read and update visitor access settings with validation', async () => {
  const settings = { ...DEFAULT_VISITOR_SETTINGS };
  await withServer(buildRouter([], settings).router, { id: 'admin', role: 'admin' }, async base => {
    const read = await fetch(`${base}/settings`);
    assert.equal(read.status, 200);
    assert.deepEqual((await read.json()).ziyaretciHaklari, DEFAULT_VISITOR_SETTINGS);

    const post = body => fetch(`${base}/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({ ziyaretciHaklari: { questionLimit: 501 } })).status, 400);
    assert.equal((await post({ ziyaretciHaklari: { fullTestEnabled: 'true' } })).status, 400);
    assert.equal((await post({ ziyaretciHaklari: { unknown: true } })).status, 400);

    const saved = await post({ ziyaretciHaklari: { questionLimit: 8, fullTestEnabled: true } });
    assert.equal(saved.status, 200);
    assert.equal(settings.questionLimit, 8);
    assert.equal(settings.fullTestEnabled, true);
    assert.equal(settings.topicLimit, DEFAULT_VISITOR_SETTINGS.topicLimit);
  });
});

test('superadmin can upload validated homepage images and Lottie animations', async () => {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zarifcozum-home-assets-'));
  const { router, homepageAssets, auditLogs } = buildRouter([], undefined, { uploadDir });
  const png = await fs.readFile(path.join(__dirname, '..', 'assets', 'brand-mark.png'));
  const animation = Buffer.from(JSON.stringify({
    v: '5.12.2', fr: 30, ip: 0, op: 60, w: 250, h: 250, layers: [{ ty: 4 }]
  }));
  try {
    await withServer(router, { id: 'admin', role: 'admin' }, async base => {
      const upload = (assetType, slot, file, name, mimeType) => {
        const form = new FormData();
        form.append('assetType', assetType);
        form.append('slot', slot);
        form.append('file', new Blob([file], { type: mimeType }), name);
        return fetch(`${base}/homepage-assets/upload`, { method: 'POST', body: form });
      };

      const imageResponse = await upload('image', 'heroImage', png, 'hero.png', 'image/png');
      assert.equal(imageResponse.status, 200);
      assert.match(homepageAssets.heroImage, /^\/uploads\/homepage\/[a-f0-9-]+\.png$/);
      const imageName = path.basename(homepageAssets.heroImage);
      assert.deepEqual(await fs.readFile(path.join(uploadDir, imageName)), png);

      const animationResponse = await upload(
        'animation', 'animation', animation, 'math.json', 'application/json'
      );
      assert.equal(animationResponse.status, 200);
      assert.match(homepageAssets.animation, /^\/uploads\/homepage\/[a-f0-9-]+\.json$/);

      assert.equal((await upload('image', 'heroImage', 'not an image', 'fake.png', 'image/png')).status, 400);
      assert.equal((await upload('image', 'heroImage', png.subarray(0, 20), 'truncated.png', 'image/png')).status, 400);
      assert.equal((await upload('image', 'heroImage', 'svg content', 'fake.svg', 'image/svg+xml')).status, 400);
      assert.equal((await upload(
        'animation', 'animation', '{"layers":[]}', 'invalid.json', 'application/json'
      )).status, 400);
      assert.equal((await upload(
        'animation', 'animation',
        JSON.stringify({ v: '5.12.2', fr: 30, ip: 0, op: 60, w: 250, h: 250, layers: [{ x: 'alert(1)' }] }),
        'expression.json',
        'application/json'
      )).status, 400);
      assert.equal((await upload(
        'image', 'heroImage', Buffer.alloc(8 * 1024 * 1024 + 1), 'large.png', 'image/png'
      )).status, 413);
      assert.equal((await upload(
        'animation', 'animation', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.json', 'application/json'
      )).status, 413);
      assert.equal(auditLogs.length, 2);

      const settings = await (await fetch(`${base}/homepage-assets`)).json();
      assert.deepEqual(settings.homepageAssets, homepageAssets);
    });
  } finally {
    await fs.rm(uploadDir, { recursive: true, force: true });
  }
});

test('superadmin can place validated media on a selected site page and target', async () => {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zarifcozum-site-media-'));
  const siteMediaUploadDir = path.join(uploadDir, 'site-media');
  const {router, siteMediaPlacements, auditLogs} = buildRouter([], undefined, {
    uploadDir: path.join(uploadDir, 'homepage'),
    siteMediaUploadDir
  });
  const png = await fs.readFile(path.join(__dirname, '..', 'assets', 'brand-mark.png'));
  const targetKey = JSON.stringify(['a', 'package-demo', 'Öğrenci demosunu aç', 'Paket yapısını incele', 0]);
  assert.equal(SiteMediaTargets.validTargetKey(targetKey), true);

  try {
    await withServer(router, {id: 'admin', role: 'admin'}, async base => {
      const upload = (pagePath, target, file = png) => {
        const form = new FormData();
        form.set('pagePath', pagePath);
        form.set('targetKey', target);
        form.set('assetType', 'image');
        form.set('file', new Blob([file], {type: 'image/png'}), 'placement.png');
        return fetch(`${base}/site-media/upload`, {method: 'POST', body: form});
      };

      const first = await upload('/Paketler.html', targetKey);
      assert.equal(first.status, 201);
      const firstPlacement = (await first.json()).placement;
      assert.equal(firstPlacement.pagePath, '/Paketler.html');
      assert.equal(firstPlacement.targetKey, targetKey);
      assert.match(firstPlacement.url, /^\/uploads\/site-media\/[a-f0-9-]+\.png$/);
      assert.deepEqual(await fs.readFile(path.join(siteMediaUploadDir, path.basename(firstPlacement.url))), png);

      const second = await upload('/Paketler.html', targetKey);
      assert.equal(second.status, 201);
      assert.equal(siteMediaPlacements.length, 1);
      assert.notEqual(siteMediaPlacements[0].url, firstPlacement.url);
      assert.equal((await (await fetch(`${base}/site-media`)).json()).placements.length, 1);
      assert.equal((await upload('/admin-paneli.html', targetKey)).status, 400);
      assert.equal((await upload('/Paketler.html', '<script>alert(1)</script>')).status, 400);
      assert.equal(auditLogs.length, 2);
    });
  } finally {
    await fs.rm(uploadDir, {recursive: true, force: true});
  }
});

test('admin media uploads use the configured storage and report storage failures', async () => {
  const files = new Map();
  const mediaStorage = {
    put: async (key, buffer) => { files.set(key, buffer); },
    remove: async key => { files.delete(key); }
  };
  const {router, homepageAssets, siteMediaPlacements} = buildRouter([], undefined, {mediaStorage});
  const png = await fs.readFile(path.join(__dirname, '..', 'assets', 'brand-mark.png'));
  await withServer(router, {id: 'admin', role: 'admin'}, async base => {
    const form = new FormData();
    form.set('assetType', 'image');
    form.set('slot', 'heroImage');
    form.set('file', new Blob([png], {type: 'image/png'}), 'hero.png');
    assert.equal((await fetch(`${base}/homepage-assets/upload`, {method: 'POST', body: form})).status, 200);
    assert.deepEqual(files.get(homepageAssets.heroImage.replace('/uploads/', '')), png);

    const placement = new FormData();
    placement.set('pagePath', '/Paketler.html');
    placement.set('targetKey', JSON.stringify(['a', 'id', 'Hedef', '', 0]));
    placement.set('assetType', 'image');
    placement.set('file', new Blob([png], {type: 'image/png'}), 'placement.png');
    assert.equal((await fetch(`${base}/site-media/upload`, {method: 'POST', body: placement})).status, 201);
    assert.deepEqual(files.get(siteMediaPlacements[0].url.replace('/uploads/', '')), png);
  });

  const unavailable = buildRouter([], undefined, {mediaStorage: {
    put: async () => { throw new Error('test storage unavailable'); },
    remove: async () => {}
  }});
  await withServer(unavailable.router, {id: 'admin', role: 'admin'}, async base => {
    const form = new FormData();
    form.set('assetType', 'image');
    form.set('slot', 'heroImage');
    form.set('file', new Blob([png], {type: 'image/png'}), 'hero.png');
    const response = await fetch(`${base}/homepage-assets/upload`, {method: 'POST', body: form});
    assert.equal(response.status, 500);
    assert.equal(unavailable.homepageAssets.heroImage, null);
  });
});

test('editor and support roles are restricted to their allowed admin sections', async () => {
  const router = buildRouter().router;
  await withServer(router, { id: 'teacher', role: 'teacher', adminRole: 'editor' }, async base => {
    assert.equal((await fetch(`${base}/education/quizzes`)).status, 200);
    assert.equal((await fetch(`${base}/faqs`)).status, 403);
    assert.equal((await fetch(`${base}/overview`)).status, 403);
    assert.equal((await fetch(`${base}/settings`)).status, 403);
    assert.equal((await fetch(`${base}/logs`)).status, 403);
  });
  await withServer(router, { id: 'support', role: 'admin', adminRole: 'support' }, async base => {
    const overviewResponse = await fetch(`${base}/overview`);
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json();
    assert.equal('paidPayments' in overview, false);
    assert.equal('activeSubs' in overview, false);
    assert.equal((await fetch(`${base}/users`)).status, 200);
    assert.equal((await fetch(`${base}/support/tickets`)).status, 200);
    assert.equal((await fetch(`${base}/payments`)).status, 403);
    assert.equal((await fetch(`${base}/faqs`)).status, 403);
    assert.equal((await fetch(`${base}/education/quizzes`)).status, 403);
    assert.equal((await fetch(`${base}/logs`)).status, 403);
  });
});
