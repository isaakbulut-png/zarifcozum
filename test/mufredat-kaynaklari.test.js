const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'mufredat_json');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('temel düzey çember sınırları yalnızca doğru program ve kazanımlara bağlıdır', () => {
  const twelfth = read(path.join(root, '12_sinif_matematik_mufredat.json'));
  const reference = read(path.join(root, 'referans', '2018_temel_duzey_11_sinif_cember.json'));
  const misplaced = twelfth.records.find(record => record.outcome_code === '12.7.1.2');

  assert.ok(misplaced);
  assert.deepEqual(misplaced.official_boundaries, []);
  assert.equal(reference.grade, 11);
  assert.match(reference.program_version, /2018.*Temel Düzey/);
  assert.equal(reference.record_count, reference.records.length);

  const expected = new Map([
    ['TD.11.4.1.1', 'Çap, yay, teğet, kiriş, kavramları verilir ancak bu kavramların özelliklerine girilmez'],
    ['TD.11.4.2.1', 'Sadece merkez ve çevre açı verilir']
  ]);
  for (const record of reference.records) {
    assert.equal(record.grade, 11);
    assert.equal(record.provenance.pdf_page, 45);
    assert.deepEqual(record.official_boundaries, [
      {statement: expected.get(record.outcome_code), source_page: 45}
    ]);
    assert.ok(expected.delete(record.outcome_code));
  }
  assert.equal(expected.size, 0);
});

test('doğrulanmış sınırlar ilgili kazanım ve kaynak sayfalarıyla saklanır', () => {
  const cases = [
    {grade: 5, code: 'MAT.5.5.1', page: 59, text: /dilimlerin açıları hesaplanmaz/},
    {grade: 6, code: 'MAT.6.1.8', page: 80, text: /metre-kilometre.*metre-desimetre/},
    {grade: 7, code: 'MAT.7.1.7', page: 128, text: /yalnızca doğru orantılı/},
    {grade: 7, code: 'MAT.7.6.1', page: 165, text: /bir verinin çıkarılması veya verilmemesi durumlarında.*hesaplamalara girilmeden/},
    {grade: 9, code: 'MAT.9.6.1', page: 77, text: /formülle hesaplanmaz.*teknolojik araçlarla/},
    {grade: 10, code: 'MAT.10.4.6', page: 111, text: /en fazla ikinci dereceden/},
    {grade: 11, code: 'MAT.11.3.7', page: 159, text: /bileşke işleminin ve ters fonksiyonun/}
  ];
  for (const {grade, code, page, text} of cases) {
    const data = read(path.join(root, `${grade}_sinif_matematik_mufredat.json`));
    const record = data.records.find(item => item.outcome_code === code);
    assert.ok(record, `${code} bulunamadı`);
    assert.ok(record.official_boundaries.some(item => item.source_page === page && text.test(item.statement)), code);
    assert.ok(record.provenance.source_url, `${code} kaynak adresi eksik`);
  }
});

test('8 ve 12. sınıfların mevcut program sürümü korunur', () => {
  for (const grade of [8, 12]) {
    const data = read(path.join(root, `${grade}_sinif_matematik_mufredat.json`));
    assert.match(data.program_version, /2018/);
    assert.equal(data.record_count, data.records.length);
  }
});
