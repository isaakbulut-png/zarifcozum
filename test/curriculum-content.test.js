const test = require('node:test');
const assert = require('node:assert/strict');

const CurriculumContent = require('../models/CurriculumContent');
const {
  getR2Client,
  uploadToR2,
  replaceIllustrationPlaceholders
} = require('../lib/image-generator');

test('CurriculumContent Mongoose Model Şema ve İndeks Doğrulaması', () => {
  assert.ok(CurriculumContent, 'CurriculumContent modeli tanımlı olmalı');
  assert.ok(CurriculumContent.schema, 'CurriculumContent şeması tanımlı olmalı');

  const paths = CurriculumContent.schema.paths;
  assert.ok(paths.grade, 'grade alanı bulunmalı');
  assert.ok(paths.subject, 'subject alanı bulunmalı');
  assert.ok(paths.unit_topic, 'unit_topic alanı bulunmalı');
  assert.ok(paths.sub_topic, 'sub_topic alanı bulunmalı');
  assert.ok(paths.outcome_code, 'outcome_code alanı bulunmalı');
  assert.ok(paths.short_summary, 'short_summary alanı bulunmalı');
  assert.ok(paths.detailed_content, 'detailed_content alanı bulunmalı');
  assert.ok(paths.illustrations, 'illustrations alanı bulunmalı');
  assert.ok(paths.status, 'status alanı bulunmalı');

  // Enum kontrolü
  assert.deepEqual(paths.status.enumValues, ['draft', 'published']);

  // Model örneği oluşturma testi
  const sample = new CurriculumContent({
    grade: 5,
    subject: 'Matematik',
    unit_topic: 'Sayılar ve Nicelikler',
    sub_topic: 'Milyonlar',
    outcome_code: 'MAT.5.1.1',
    short_summary: 'Milyonlar basamağını tanıma ve okuma.',
    detailed_content: '[SAYFA_1]\n## Merak\n[SAYFA_2]\n## Mantık',
    status: 'published'
  });

  assert.equal(sample.grade, 5);
  assert.equal(sample.sub_topic, 'Milyonlar');
  assert.equal(sample.status, 'published');
});

test('lib/image-generator - Cloudflare R2 İstemci ve Placeholder Değiştirme Testi', () => {
  // 1. R2 İstemci fonksiyonu kontrolü
  assert.equal(typeof getR2Client, 'function');
  assert.equal(typeof uploadToR2, 'function');

  // 2. Başarılı görsel eşleştirme (R2 public URL / proxy formatı)
  const rawTextWithPlaceholder = 'Burada günlük hayat sahnesi yer alır:\n[[IMG_1]]\nİşte bu kadar.';
  const illustrations = [
    { id: 'IMG_1', prompt: 'Students measuring garden with ruler', imageUrl: '/uploads/ai-illustrations/ill_test_123.png' }
  ];

  const replaced = replaceIllustrationPlaceholders(rawTextWithPlaceholder, illustrations);
  assert.ok(replaced.includes('/uploads/ai-illustrations/ill_test_123.png'), 'R2 görsel URL doğru yerleşmeli');
  assert.ok(replaced.includes('<figure class="ai-maarif-illustration"'), 'figure etiketi eklenmeli');
  assert.ok(!replaced.includes('[[IMG_1]]'), 'Yer tutucu metinden temizlenmeli');

  // 3. Başarısız veya boş görsel durumunda (Fail-Safe) temizleme
  const failedIllustrations = [
    { id: 'IMG_2', prompt: 'Failed test image', imageUrl: '' }
  ];
  const rawWithFailed = 'Metin başı [[IMG_2]] metin sonu.';
  const cleaned = replaceIllustrationPlaceholders(rawWithFailed, failedIllustrations);
  assert.equal(cleaned.trim(), 'Metin başı  metin sonu.');
  assert.ok(!cleaned.includes('[[IMG_2]]'), 'Başarısız görsel etiketi tamamen temizlenmeli');
});

test('Maarif Modeli 5 Sayfa ve Çift Katmanlı Görsel Format Doğrulaması', () => {
  const sampleDetailedContent = `
[SAYFA_1]
## 1. Sayfa: Gerçek Hayat Keşfi
Güneş enerjisi santralinde panelleri yerleştirirken üçgenlerin açıları hesaplanır.
[[IMG_1]]

[SAYFA_2]
## 2. Sayfa: Kavram İnşası & Matematiksel Mantık
İkizkenar üçgende taban açıları birbirine daima eşittir:
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <polygon points="50,15 15,85 85,85" fill="#4F46E5" opacity="0.15" stroke="#4F46E5" stroke-width="2.5" />
</svg>

[SAYFA_3]
## 3. Sayfa: Çözümlü Rehberli Örnekler
Bir üçgenin tepe açısı $40^\\circ$ ise taban açıları:
$$(180^\\circ - 40^\\circ) / 2 = 70^\\circ$$

[SAYFA_4]
## 4. Sayfa: Karşılaştırmalı Analiz & Kavram Yanılgıları
<table>
  <tr><th>Yanlış Kanı</th><th>Bilimsel Gerçek</th></tr>
  <tr><td>Her üçgenin açıları eşittir</td><td>Sadece eşkenar üçgende geçerlidir</td></tr>
</table>

[SAYFA_5]
## 5. Sayfa: Kendini Dene Görevi
Kendi odandaki gönye veya üçgen bir nesneyi ölçerek açılarını hesapla.
`;

  // Sayfa ayrıştırma kontrolü
  const pages = sampleDetailedContent.split(/\[SAYFA_(\d+)\]/gi);
  assert.ok(pages.length >= 11, 'En az 5 sayfa (10+ parça) olmalı');

  // Tip A ve Tip B varlığı
  assert.ok(sampleDetailedContent.includes('<svg'), 'Tip A SVG çizimi bulunmalı');
  assert.ok(sampleDetailedContent.includes('<table'), 'Tip A HTML tablosu bulunmalı');
  assert.ok(sampleDetailedContent.includes('[[IMG_1]]'), 'Tip B illüstrasyon yer tutucusu bulunmalı');
});
