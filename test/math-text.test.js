const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {format} = require('../assets/math-text');

test('üslü ifadeler güvenli üst simgeye dönüştürülür', () => {
  assert.equal(format('(-2/3)^3 = -8/27 ve (-1/3)^2 = 1/9'),
    '(-2/3)<sup>3</sup> = -8/27 ve (-1/3)<sup>2</sup> = 1/9');
  assert.equal(format('2^12 + x^-3 + y^{n+1} + z^(-2)'),
    '2<sup>12</sup> + x<sup>-3</sup> + y<sup>n+1</sup> + z<sup>-2</sup>');
  assert.equal(format('x^n + [a]^0 + ü^2'), 'x<sup>n</sup> + [a]<sup>0</sup> + ü<sup>2</sup>');
});

test('metin ve HTML güvenle korunur; belirsiz ifadeler kısmen dönüştürülmez', () => {
  assert.equal(format('<img src=x onerror="alert(1)"> 2^3 & 4'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; 2<sup>3</sup> &amp; 4');
  assert.equal(format('x^{n^2}, 2^3x, a^{} ve ^3'), 'x^{n^2}, 2^3x, a^{} ve ^3');
  assert.equal(format('Üs yok, 2² zaten gösterilmiş.'), 'Üs yok, 2² zaten gösterilmiş.');
});

test('tüm pratik sayfaları ve paneller biçimlendiriciyi önce yükler', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['asistan.html', 'asistanla-soru-coz.html', 'deneme-sinavi-optik.html',
    'konu.html', 'test.html', 'ogrenci-paneli.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(html.indexOf('assets/math-text.js') >= 0, file);
    assert.ok(html.indexOf('assets/math-text.js') < html.indexOf('assets/pratik.js'), file);
  }
  const student = fs.readFileSync(path.join(root, 'ogrenci-paneli.html'), 'utf8');
  assert.match(student, /zarifMathText\.format\(question\.text\)/);
  assert.match(student, /zarifMathText\.format\(question\.options\[letter\]\)/);
  assert.match(student, /zarifMathText\.format\(item\.explanation/);
  const teacher = fs.readFileSync(path.join(root, 'ogretmen-paneli.html'), 'utf8');
  assert.ok(teacher.indexOf('assets/math-text.js') < teacher.indexOf('zarifMathText.format(question.text)'));
  const practice = fs.readFileSync(path.join(root, 'assets', 'pratik.js'), 'utf8');
  assert.match(practice, /matematikMetni\(soru\.text\)/);
  assert.match(practice, /matematikMetni\(soru\.options\[harf\]\)/);
  assert.match(practice, /matematikMetni\(soru\.explanation/);
});
