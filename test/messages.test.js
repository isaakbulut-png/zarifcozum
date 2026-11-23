const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const Conversation = require('../models/Conversation');
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

test('Veri Modeli: Mongoose Conversation şeması istenen tüm alanları ve kuralları içerir', async () => {
  const schema = Conversation.schema;
  assert.ok(schema.path('conversationId'), 'conversationId alanı bulunmalı');
  assert.equal(schema.path('conversationId').instance, 'String');

  // participants yapısı kontrolü
  const participantsType = schema.path('participants');
  assert.ok(participantsType, 'participants dizisi bulunmalı');

  // messages yapısı kontrolü
  const messagesType = schema.path('messages');
  assert.ok(messagesType, 'messages dizisi bulunmalı');

  // Örnek döküman doğrulaması
  const sampleDoc = new Conversation({
    conversationId: 'conv_teacher1_parent5',
    participants: [
      { userId: 'teacher_1', name: 'Ahmet Yılmaz', role: 'teacher' },
      { userId: 'parent_5', name: 'Ayşe Yılmaz', role: 'parent', relatedStudentName: 'Kerem Yılmaz' }
    ],
    messages: [
      {
        id: 'msg_101',
        senderId: 'parent_5',
        senderRole: 'parent',
        text: 'Hocam Kerem ödevlerini tamamladı mı?',
        timestamp: new Date().toISOString(),
        isRead: false
      }
    ]
  });

  await sampleDoc.validate();
  assert.equal(sampleDoc.conversationId, 'conv_teacher1_parent5');
  assert.equal(sampleDoc.participants[1].relatedStudentName, 'Kerem Yılmaz');
  assert.equal(sampleDoc.messages[0].isRead, false);
});

test('GET /api/messages tohum verilerini, veli ve öğrenci ayrımını ve okunmamış sayısını döndürür', async () => {
  await withServer(createMessagesRouter(), async (baseUrl) => {
    const res = await fetch(baseUrl);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.conversations));
    assert.ok(body.conversations.length >= 4);

    // Her konuşmanın veri modeline uygunluk kontrolü
    body.conversations.forEach(conv => {
      assert.ok(conv.conversationId || conv.id, 'Her konuşmanın ID si olmalı');
      assert.ok(Array.isArray(conv.messages), 'Her konuşmanın messages dizisi olmalı');
      conv.messages.forEach(msg => {
        assert.ok(msg.id, 'Mesaj ID si olmalı');
        assert.ok(msg.senderRole || msg.sender, 'Mesaj gönderen rolü olmalı');
        assert.ok(typeof msg.text === 'string', 'Mesaj metni olmalı');
        assert.equal(typeof msg.isRead, 'boolean', 'isRead boolean olmalı');
      });
    });

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
  });
});

test('POST /api/messages öğretmen yanıtı ekler, saati günceller ve okundu yapar', async () => {
  await withServer(createMessagesRouter(), async (baseUrl) => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv_teacher1_student1',
        text: 'Merhaba Zeynep, yarınki canlı derste bu soruyu detaylıca çözelim.',
        senderRole: 'teacher',
        senderId: 'teacher_1'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message.senderRole, 'teacher');
    assert.equal(body.message.text, 'Merhaba Zeynep, yarınki canlı derste bu soruyu detaylıca çözelim.');
    assert.equal(body.conversation.unread, false);
  });
});

test('Veli -> Öğretmen Mesajı ve Okunmamış Sayacı Entegrasyonu', async () => {
  await withServer(createMessagesRouter(), async (baseUrl) => {
    // 1. Veli Kerem Yılmaz adına öğretmene mesaj gönderir
    const sendRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv_teacher1_parent_ayse',
        senderId: 'parent_ayse',
        senderName: 'Ayşe Yılmaz',
        senderRole: 'parent',
        relatedStudentName: 'Kerem Yılmaz',
        text: 'Ahmet Hocam, Kerem hafta sonu pekiştirme testlerini tamamladı.'
      })
    });

    assert.equal(sendRes.status, 200);
    const sendBody = await sendRes.json();
    assert.equal(sendBody.success, true);
    assert.equal(sendBody.message.senderRole, 'parent');
    assert.equal(sendBody.message.isRead, false);

    // 2. Öğretmen için GET /api/messages çağrıldığında bu konuşma okunmamış (unread: true) olmalıdır
    const teacherGetRes = await fetch(`${baseUrl}?role=teacher`);
    const teacherData = await teacherGetRes.json();
    const targetConv = teacherData.conversations.find(c => (c.conversationId || c.id) === 'conv_teacher1_parent_ayse');
    assert.ok(targetConv, 'Konuşma bulunmalı');
    assert.equal(targetConv.unread, true, 'Öğretmen için okunmamış görünmeli');
    assert.equal(targetConv.studentName, 'Kerem Yılmaz');

    // 3. Öğretmen konuşmayı açıp okundu işaretler
    const markRes = await fetch(`${baseUrl}/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv_teacher1_parent_ayse',
        readerRole: 'teacher'
      })
    });
    assert.equal(markRes.status, 200);

    // 4. Tekrar kontrol edildiğinde konuşma okundu olmalıdır
    const reGetRes = await fetch(`${baseUrl}?role=teacher`);
    const reData = await reGetRes.json();
    const updatedConv = reData.conversations.find(c => (c.conversationId || c.id) === 'conv_teacher1_parent_ayse');
    assert.equal(updatedConv.unread, false, 'Okundu işaretlendikten sonra unread false olmalı');
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
