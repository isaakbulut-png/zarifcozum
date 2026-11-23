const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createMessagesRouter } = require('../routes/messages');

async function withServer(router, fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', router);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/messages`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('GET /api/messages tohum verilerini, veli ve öğrenci ayrımını ve okunmamış sayısını döndürür', async () => {
  await withServer(createMessagesRouter(), async (baseUrl) => {
    const res = await fetch(baseUrl);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.conversations));
    assert.ok(body.conversations.length >= 4);

    // Öğrenci ve Veli ayrımı doğrulaması
    const students = body.conversations.filter(c => c.roleType === 'student');
    const parents = body.conversations.filter(c => c.roleType === 'parent');
    assert.ok(students.length >= 2, 'En az 2 öğrenci konuşması olmalı');
    assert.ok(parents.length >= 2, 'En az 2 veli konuşması olmalı');

    // Veli konuşmalarında öğrenci adı ve veli ilişkisi doğrulaması
    parents.forEach(parent => {
      assert.ok(parent.studentName, 'Veli konuşmasında öğrenci adı olmalı');
      assert.match(parent.parentRelation || '', /Velisi/, 'Veli ilişkisi belirtilmeli');
    });

    // Okunmamış mesaj sayısı
    assert.equal(typeof body.unreadCount, 'number');
    assert.equal(body.unreadCount, body.conversations.filter(c => c.unread).length);
  });
});

test('POST /api/messages öğretmen yanıtı ekler, saati günceller ve okundu yapar', async () => {
  await withServer(createMessagesRouter(), async (baseUrl) => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv_1',
        text: 'Merhaba Zeynep, yarınki canlı derste bu soruyu detaylıca çözelim.'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message.sender, 'teacher');
    assert.equal(body.message.text, 'Merhaba Zeynep, yarınki canlı derste bu soruyu detaylıca çözelim.');
    assert.equal(body.conversation.unread, false);
  });
});

test('POST /api/messages/mark-read konuşmayı okundu olarak işaretler', async () => {
  await withServer(createMessagesRouter(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'conv_4' })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });
});

test('POST /api/messages/send-from-client veli ve öğrenciden gelen mesajları gelen kutusuna aktarır ve okunmamış yapar', async () => {
  await withServer(createMessagesRouter(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/send-from-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleType: 'parent',
        senderName: 'Kemal Can',
        studentName: 'Zehra Can',
        text: 'Hocam Zehra yarınki ders için hazırlıklarını tamamladı.'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.conversation.unread, true);
    assert.equal(body.conversation.roleType, 'parent');
    assert.equal(body.conversation.studentName, 'Zehra Can');
    assert.equal(body.conversation.parentRelation, "Zehra Can'in Velisi");
  });
});
