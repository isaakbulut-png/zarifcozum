const test = require('node:test');
const assert = require('node:assert/strict');
const { dosyaAdiniCozumle, resimUrlOlustur, resimleriTara } = require('../lib/soru-senkron');

test('dosya adından ders ve sıra numarası çıkarılır', () => {
  assert.deepEqual(dosyaAdiniCozumle('matematik-soru1.png'), { ders: 'matematik', siraNo: 1 });
  assert.deepEqual(dosyaAdiniCozumle('fen-bilimleri-soru12.JPG'), { ders: 'fen-bilimleri', siraNo: 12 });
  assert.deepEqual(dosyaAdiniCozumle('soru-2.png'), { ders: 'genel', siraNo: 2 });
  assert.deepEqual(dosyaAdiniCozumle('rastgele.png'), { ders: 'genel', siraNo: null });
});

test('resim URL\'si https://zarifcozum.com biçiminde üretilir', () => {
  delete process.env.SITE_URL;
  assert.equal(resimUrlOlustur('matematik-soru1.png'), 'https://zarifcozum.com/images/sorular/matematik-soru1.png');
  assert.equal(resimUrlOlustur('soru 3.png'), 'https://zarifcozum.com/images/sorular/soru%203.png');
});

test('olmayan klasör boş liste döner', () => {
  assert.deepEqual(resimleriTara('Z:\\yok\\boyle\\klasor'), []);
});
