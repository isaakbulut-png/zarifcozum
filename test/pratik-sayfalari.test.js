const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('ana sayfadaki soru çözme bağlantısı konu pratiğine gider', () => {
  const homepage = read('index.html');
  assert.match(homepage, /href="deneme-sinavi-optik\.html"[^>]*>[\s\S]*?<strong>Soru çözme<\/strong>/);
  const practice = read('deneme-sinavi-optik.html');
  assert.match(practice, /ZarifPratik\.mount\([^;]*mod:\s*"test"/);
  assert.match(practice, /ogrenci-paneli\.html#denemeler/);
});

test('kazanım testi sayfası demo panel yerine gerçek kazanım bileşenini açar', () => {
  const page = read('test.html');
  assert.match(page, /ZarifPratik\.mount\([^;]*mod:\s*"kazanim"/);
  assert.match(page, /URLSearchParams\(location\.search\)\.get\("sinif"\)/);
  assert.match(page, /data-breadcrumb="Kazanım Testi"/);
  assert.match(page, /assets\/breadcrumb\.js/);
  assert.doesNotMatch(page, /data-shell=|assets\/app\.js|const Q = \[/);
  assert.equal((page.match(/src="\/assets\/site-footer\.js"/g) || []).length, 1);
});

test('tüm sınıf bağlantıları dinamik konu sayfasını açar', () => {
  const homepage = read('index.html');
  for (let grade = 5; grade <= 12; grade++) {
    assert.ok(homepage.includes(`href="konu.html?sinif=${grade}"`), `${grade}. sınıf bağlantısı eksik`);
  }
  const page = read('konu.html');
  assert.match(page, /ZarifPratik\.mount\([^;]*mod:\s*"konu"/);
  assert.match(page, /URLSearchParams\(location\.search\)\.get\("sinif"\)/);
  assert.doesNotMatch(page, /Asal Sayılar ve Asal Çarpanlar|data-shell=|assets\/app\.js/);
});
