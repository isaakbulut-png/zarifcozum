const test = require('node:test');
const assert = require('node:assert/strict');
const { sendTeacherStatusEmail, createMailTransport } = require('../lib/teacher-mail-notifier');

test('sendTeacherStatusEmail eksik parametre durumunda basarisiz doner', async () => {
  const res = await sendTeacherStatusEmail({});
  assert.equal(res.sent, false);
  assert.equal(res.reason, 'missing_parameters');
});

test('sendTeacherStatusEmail SMTP tanimli degilse cokmez, kontrollu donus yapar', async () => {
  // Test sirasinda SMTP ayarlarini gecici olarak temizle
  const oldHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;

  try {
    const res = await sendTeacherStatusEmail({
      email: 'ogretmen@example.com',
      name: 'Test Öğretmen',
      status: 'onaylandi',
      teacherType: 'icerik_ureticisi'
    });

    assert.equal(res.sent, false);
    assert.equal(res.reason, 'smtp_not_configured');
  } finally {
    if (oldHost) process.env.SMTP_HOST = oldHost;
  }
});

test('sendTeacherStatusEmail reddedildi durumunda da kontrollu calisir', async () => {
  const oldHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;

  try {
    const res = await sendTeacherStatusEmail({
      email: 'ogretmen2@example.com',
      name: 'Örnek Öğretmen',
      status: 'reddedildi'
    });

    assert.equal(res.sent, false);
    assert.equal(res.reason, 'smtp_not_configured');
  } finally {
    if (oldHost) process.env.SMTP_HOST = oldHost;
  }
});
