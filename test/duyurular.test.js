const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { ObjectId } = require('mongodb');

test('Duyuru Sistemi - Hibrit Model: Süre Kontrolü, Otomatik Gizlenme ve Silme', async (t) => {
  // Mock collection
  let duyurularStore = [];

  const mockDuyuruKoleksiyonu = {
    insertOne: async (doc) => {
      const _id = new ObjectId();
      const inserted = { _id, ...doc };
      duyurularStore.push(inserted);
      return { insertedId: _id };
    },
    deleteOne: async (query) => {
      const initialLength = duyurularStore.length;
      duyurularStore = duyurularStore.filter(item => {
        if (query._id && item._id.toString() !== query._id.toString()) return true;
        if (query.createdBy && item.createdBy !== query.createdBy) return true;
        return false;
      });
      return { deletedCount: initialLength - duyurularStore.length };
    },
    find: (filter = {}) => ({
      sort: () => ({
        limit: (n) => ({
          toArray: async () => {
            let res = [...duyurularStore];
            if (filter.$or) {
              const now = new Date();
              res = res.filter(item => {
                if (!item.expiresAt) return true;
                return new Date(item.expiresAt) >= now;
              });
            }
            return res.slice(0, n);
          }
        })
      })
    })
  };

  const app = express();
  app.use(express.json());

  let currentSessionUser = null;
  app.use((req, res, next) => {
    req.session = { user: currentSessionUser };
    next();
  });

  const ogretmenKontrol = (req, res, next) => {
    if (!req.session?.user || !['teacher', 'admin'].includes(req.session.user.role)) {
      return res.status(403).json({ mesaj: 'Yetkisiz erişim' });
    }
    next();
  };

  // POST endpoint
  app.post('/api/ogretmen/duyurular', ogretmenKontrol, async (req, res) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!message || message.length > 1000) {
        return res.status(400).json({ mesaj: 'Duyuru 1–1000 karakter arasında olmalıdır.' });
      }
      const durationDays = req.body?.durationDays !== undefined ? parseInt(req.body.durationDays, 10) : 14;
      let expiresAt = null;
      if (durationDays > 0) {
        expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      }
      const announcement = {
        message,
        durationDays: durationDays > 0 ? durationDays : null,
        expiresAt,
        createdBy: req.session.user.id,
        createdAt: new Date()
      };
      const result = await mockDuyuruKoleksiyonu.insertOne(announcement);
      res.status(201).json({
        mesaj: 'Duyuru yayınlandı.',
        duyuru: { id: result.insertedId.toString(), ...announcement }
      });
    } catch (err) {
      res.status(500).json({ mesaj: 'Hata' });
    }
  });

  // DELETE endpoint
  app.delete('/api/ogretmen/duyurular/:id', ogretmenKontrol, async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ mesaj: 'Geçersiz duyuru numarası.' });
      }
      const query = { _id: new ObjectId(id) };
      if (req.session.user.role !== 'admin') {
        query.createdBy = req.session.user.id;
      }
      const result = await mockDuyuruKoleksiyonu.deleteOne(query);
      if (!result.deletedCount) {
        return res.status(404).json({ mesaj: 'Duyuru bulunamadı veya silme yetkiniz yok.' });
      }
      res.json({ success: true, mesaj: 'Duyuru yayından kaldırıldı ve silindi.' });
    } catch (err) {
      res.status(500).json({ mesaj: 'Hata' });
    }
  });

  // Student list endpoint (filters expired)
  app.get('/api/student/announcements', async (req, res) => {
    const list = await mockDuyuruKoleksiyonu.find({
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gte: new Date() } }
      ]
    }).sort().limit(20).toArray();
    res.json({ duyurular: list });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => server.close());

  await t.test('1. Öğretmen 7 günlük süreli ve süresiz duyuru oluşturabilir', async () => {
    currentSessionUser = { id: 'teacher_1', role: 'teacher' };

    // 7 günlük duyuru
    const res1 = await fetch(`${baseUrl}/api/ogretmen/duyurular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '1. Hafta Ödevi Hatırlatması', durationDays: 7 })
    });
    assert.equal(res1.status, 201);
    const data1 = await res1.json();
    assert.equal(data1.duyuru.durationDays, 7);
    assert.ok(data1.duyuru.expiresAt);

    // Süresiz duyuru (durationDays: 0)
    const res2 = await fetch(`${baseUrl}/api/ogretmen/duyurular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Genel Kurallar', durationDays: 0 })
    });
    assert.equal(res2.status, 201);
    const data2 = await res2.json();
    assert.equal(data2.duyuru.durationDays, null);
    assert.equal(data2.duyuru.expiresAt, null);
  });

  await t.test('2. Süresi dolmuş duyuru öğrenci akışında otomatik filtrelenir', async () => {
    // Geçmiş tarihli süresi dolmuş bir duyuru ekle
    await mockDuyuruKoleksiyonu.insertOne({
      message: 'Geçmiş Sınav Duyurusu',
      durationDays: 7,
      expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 saat önce dolmuş
      createdBy: 'teacher_1',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    });

    const res = await fetch(`${baseUrl}/api/student/announcements`);
    const data = await res.json();
    const messages = data.duyurular.map(d => d.message);

    assert.ok(messages.includes('1. Hafta Ödevi Hatırlatması'));
    assert.ok(messages.includes('Genel Kurallar'));
    assert.ok(!messages.includes('Geçmiş Sınav Duyurusu'), 'Süresi dolan duyuru öğrenciye gösterilmemeli');
  });

  await t.test('3. Öğretmen sadece kendi yayınladığı duyuruyu silebilir', async () => {
    currentSessionUser = { id: 'teacher_1', role: 'teacher' };
    const myItem = duyurularStore.find(d => d.message === '1. Hafta Ödevi Hatırlatması');
    assert.ok(myItem);

    // Başka öğretmen silmeye çalışırsa 404 döner
    currentSessionUser = { id: 'teacher_2', role: 'teacher' };
    const resFail = await fetch(`${baseUrl}/api/ogretmen/duyurular/${myItem._id}`, { method: 'DELETE' });
    assert.equal(resFail.status, 404);

    // Kendi öğretmeni silerse 200 döner
    currentSessionUser = { id: 'teacher_1', role: 'teacher' };
    const resSuccess = await fetch(`${baseUrl}/api/ogretmen/duyurular/${myItem._id}`, { method: 'DELETE' });
    assert.equal(resSuccess.status, 200);

    const deletedItem = duyurularStore.find(d => d._id.toString() === myItem._id.toString());
    assert.equal(deletedItem, undefined);
  });

  await t.test('4. Admin herhangi bir duyuruyu silebilir', async () => {
    currentSessionUser = { id: 'admin_1', role: 'admin' };
    const remainingItem = duyurularStore[0];
    assert.ok(remainingItem);

    const res = await fetch(`${baseUrl}/api/ogretmen/duyurular/${remainingItem._id}`, { method: 'DELETE' });
    assert.equal(res.status, 200);
  });
});
