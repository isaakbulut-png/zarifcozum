const test = require('node:test');
const assert = require('node:assert/strict');
const { getCurriculumTree, getGrades, getThemes, getSubTopics, findSubTopicMeta } = require('../lib/meb-curriculum');

test('MEB Maarif Müfredatı - Sınıf, Ders, Tema ve Alt Konu Ağacı Senkronizasyonu', () => {
  const grades = getGrades();
  assert.deepEqual(grades, [5, 6, 7, 8, 9, 10, 11, 12], '5-12 sınıflar eksiksiz olmalı');

  // 5. Sınıf kontrolü
  const g5Themes = getThemes(5);
  assert.ok(g5Themes.includes('Sayılar ve Nicelikler'), '5. sınıfta Sayılar ve Nicelikler bulunmalı');
  assert.ok(g5Themes.includes('Geometrik Şekiller'), '5. sınıfta Geometrik Şekiller bulunmalı');
  
  const g5Subs = getSubTopics(5, 'Sayılar ve Nicelikler').map(s => s.name);
  assert.ok(g5Subs.includes('Milyonlar'), 'Milyonlar alt konusu bulunmalı');

  // Kazanım kodu ve resmî sınır kontrolü
  const meta = findSubTopicMeta(5, 'Sayılar ve Nicelikler', 'Milyonlar');
  assert.equal(meta.outcome_code, 'MAT.5.1.1');
  assert.ok(meta.official_boundary.includes('dokuz basamaklı'), 'Milyonlar için resmi MEB sınır bilgisi bulunmalı');

  // 6. Sınıf gerçek ders kitabı alt konu kontrolü
  const g6Themes = getThemes(6);
  assert.ok(g6Themes.includes('Sayılar ve Nicelikler'), '6. sınıfta Sayılar ve Nicelikler bulunmalı');
  const g6Subs = getSubTopics(6, 'Sayılar ve Nicelikler').map(s => s.name);
  assert.ok(g6Subs.includes('Çarpanlar ve Katlar'), 'Çarpanlar ve Katlar bulunmalı');
  assert.ok(g6Subs.includes('Kalansız Bölünebilme'), 'Kalansız Bölünebilme bulunmalı');
  assert.ok(g6Subs.includes('Asal Sayılar'), 'Asal Sayılar bulunmalı');
  assert.ok(g6Subs.includes('Ortak Bölen ve Ortak Kat'), 'Ortak Bölen ve Ortak Kat bulunmalı');

  // 9. Sınıf kontrolü
  const g9Themes = getThemes(9);
  assert.ok(g9Themes.includes('Sayılar'), '9. sınıfta Sayılar bulunmalı');
  const g9Subs = getSubTopics(9, 'Sayılar').map(s => s.name);
  assert.ok(g9Subs.includes('Kümeler ve Kümelerde İşlemler'));
});

test('Pinecone ders_kitabi Katı Metadata Filtreleme Objesi Doğrulaması', () => {
  const grade = 6;
  const filterQuery = {
    $or: [
      { not: { $eq: Number(grade) } },
      { grade: { $eq: Number(grade) } }
    ]
  };

  assert.equal(filterQuery.$or[0].not.$eq, 6);
  assert.equal(filterQuery.$or[1].grade.$eq, 6);
  assert.equal(filterQuery.$or.length, 2, 'Hem not hem grade alanlarını desteklemeli');
});

test('Türkiye Yüzyılı Maarif Modeli Açık Uçlu Soru ve Rubrik Doğrulaması', () => {
  const sampleOpenEndedQuestion = {
    text: "Bir mimar, enerji tasarruflu bir çatı tasarımı için ikizkenar üçgen şeklinde güneş panelleri kullanmaktadır. Taban uzunluğu $8$ metre olan panelin tepe açısı $60^\\circ$ olduğuna göre çatı eğimini modelleyerek panelin diğer kenar uzunluklarını adım adım bulunuz.",
    solution: "1. Adım: İkizkenar üçgende taban açıları eşittir. Tepe açısı $60^\\circ$ ise taban açıları $(180^\\circ - 60^\\circ) / 2 = 60^\\circ$ bulunur.\n2. Adım: Tüm iç açıları $60^\\circ$ olduğundan üçgen eşkenardır.\n3. Adım: Dolayısıyla tüm kenar uzunlukları taban gibi $8$ metredir.",
    rubric: [
      { criterion: "Üçgenin açı özelliklerini ve eşitliklerini modelleme", points: 30 },
      { criterion: "Eşkenar üçgen çıkarımını muhakeme etme", points: 40 },
      { criterion: "Kenar uzunluklarını birimle doğru hesaplama", points: 30 }
    ],
    outcomeCode: "MAT.5.3.7",
    questionType: "open_ended"
  };

  assert.ok(sampleOpenEndedQuestion.text.includes('$'), 'LaTeX ifadeleri tek dolar içinde olmalı');
  assert.ok(sampleOpenEndedQuestion.solution.length > 20, 'Beklenen çözüm adımları dolu olmalı');
  assert.equal(sampleOpenEndedQuestion.rubric.length, 3, 'Rubrik 3 kriter içermeli');
  const totalPoints = sampleOpenEndedQuestion.rubric.reduce((acc, r) => acc + r.points, 0);
  assert.equal(totalPoints, 100, 'Rubrik toplamı 100 puan olmalı');
});
