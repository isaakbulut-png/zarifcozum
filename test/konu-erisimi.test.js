const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAllowedGradesForStudent,
  canStudentAccessGrade
} = require('../lib/konu-erisimi');

test('Sınıf Düzeyi Yetkilendirmesi - VIP Paket 5-12 tüm sınıflara erişebilir', () => {
  const vipUser = { role: 'student', paketTipi: 'vip', kayitliSinif: 8 };
  assert.deepEqual(getAllowedGradesForStudent(vipUser), [5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(canStudentAccessGrade(vipUser, 5), true);
  assert.equal(canStudentAccessGrade(vipUser, 8), true);
  assert.equal(canStudentAccessGrade(vipUser, 12), true);
});

test('Sınıf Düzeyi Yetkilendirmesi - Standart Paket kayıtlı sınıf + 1 alt sınıf telafi', () => {
  const standartUser = { role: 'student', paketTipi: 'standart', kayitliSinif: 8 };
  assert.deepEqual(getAllowedGradesForStudent(standartUser), [8, 7]);
  assert.equal(canStudentAccessGrade(standartUser, 8), true);
  assert.equal(canStudentAccessGrade(standartUser, 7), true);
  assert.equal(canStudentAccessGrade(standartUser, 9), false);
  assert.equal(canStudentAccessGrade(standartUser, 6), false);
});

test('Sınıf Düzeyi Yetkilendirmesi - Temel Paket yalnızca seçili 1 sınıf düzeyi', () => {
  const temelUser = { role: 'student', paketTipi: 'temel', kayitliSinif: 8 };
  assert.deepEqual(getAllowedGradesForStudent(temelUser), [8]);
  assert.equal(canStudentAccessGrade(temelUser, 8), true);
  assert.equal(canStudentAccessGrade(temelUser, 7), false);
  assert.equal(canStudentAccessGrade(temelUser, 9), false);
});

test('Sınıf Düzeyi Yetkilendirmesi - Öğretmen ve Admin tüm sınıflara erişebilir', () => {
  const admin = { role: 'admin' };
  const teacher = { role: 'teacher' };
  assert.equal(canStudentAccessGrade(admin, 11), true);
  assert.equal(canStudentAccessGrade(teacher, 5), true);
  assert.equal(canStudentAccessGrade(teacher, 12), true);
});
