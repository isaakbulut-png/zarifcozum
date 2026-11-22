const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');

test('User schema yeni ogretmen basvuru alanlarini destekler', () => {
  const user = new User({
    name: 'Ahmet Öğretmen',
    email: 'ahmet.ogretmen@example.com',
    role: 'teacher',
    branch: 'Lise Matematik (9-12)',
    brans: 'Lise Matematik (9-12)',
    graduationInfo: 'ODTÜ Matematik Öğretmenliği / 7 Yıl Deneyim',
    verificationDocumentUrl: '/uploads/teacher-docs/doc-sample123.pdf',
    contractAccepted: true,
    contractAcceptedAt: new Date(),
    basvuruDurumu: 'inceleme_suruyor',
    ogretmenTipi: 'standart_ogretmen'
  });

  assert.equal(user.role, 'teacher');
  assert.equal(user.branch, 'Lise Matematik (9-12)');
  assert.equal(user.graduationInfo, 'ODTÜ Matematik Öğretmenliği / 7 Yıl Deneyim');
  assert.equal(user.verificationDocumentUrl, '/uploads/teacher-docs/doc-sample123.pdf');
  assert.equal(user.contractAccepted, true);
  assert.ok(user.contractAcceptedAt instanceof Date);
  assert.equal(user.basvuruDurumu, 'inceleme_suruyor');
});
