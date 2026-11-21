const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getCurriculumTree, getGrades, getThemes, getSubTopics } = require('../lib/meb-curriculum');

test('MEB Müfredat Ağacı Doğrulama ve Sınıf Bütünlüğü', () => {
  const tree = getCurriculumTree();
  const grades = getGrades();

  // 1. Tüm sınıflar mevcut olmalı (5-12)
  assert.deepEqual(grades, [5, 6, 7, 8, 9, 10, 11, 12], '5-12 sınıfların tamamı müfredat ağacında olmalıdır');

  // 2. 8. ve 12. Sınıf Eski Müfredat Koruma Kontrolü
  const grade8Themes = getThemes(8);
  assert.ok(grade8Themes.some(t => t.includes('Sayılar ve İşlemler')), '8. sınıf Sayılar ve İşlemler korunmalıdır');
  assert.ok(grade8Themes.some(t => t.includes('Cebir')), '8. sınıf Cebir korunmalıdır');
  assert.ok(grade8Themes.some(t => t.includes('Geometri')), '8. sınıf Geometri korunmalıdır');
  
  const grade8SubTopics = getSubTopics(8, '1. Tema: Sayılar ve İşlemler').map(s => s.name);
  assert.ok(grade8SubTopics.includes('Çarpanlar ve Katlar (EBOB - EKOK)'), '8. sınıf EBOB-EKOK korunmalıdır');
  assert.ok(grade8SubTopics.includes('Kareköklü İfadeler'), '8. sınıf Kareköklü İfadeler korunmalıdır');

  const grade12Themes = getThemes(12);
  assert.ok(grade12Themes.some(t => t.includes('Türev')), '12. sınıf Türev korunmalıdır');
  assert.ok(grade12Themes.some(t => t.includes('İntegral')), '12. sınıf İntegral korunmalıdır');
  assert.ok(grade12Themes.some(t => t.includes('Trigonometri')), '12. sınıf Trigonometri korunmalıdır');

  // 3. 6. Sınıf Maarif Modeli ve Gerçek Kitap Başlığı Doğrulaması (Kullanıcının özellikle belirttiği tema)
  const grade6Themes = getThemes(6);
  assert.ok(grade6Themes.includes('3. Tema: Sayılar ve Nicelikler (2)'), '6. sınıf kitabındaki "3. Tema: Sayılar ve Nicelikler (2)" tam adıyla bulunmalıdır');
  const grade6Tema3Subs = getSubTopics(6, '3. Tema: Sayılar ve Nicelikler (2)').map(s => s.name);
  assert.ok(grade6Tema3Subs.includes('Ondalık Gösterimlerde Basamak Değeri'), 'Ondalık Gösterimler yer almalıdır');
  assert.ok(grade6Tema3Subs.includes('Kesir ile Bölme İşlemi İlişkisi'), 'Kesir ile Bölme yer almalıdır');
  assert.ok(grade6Tema3Subs.includes('Standart Uzunluk Ölçme Birimleri'), 'Uzunluk Ölçme yer almalıdır');

  // 4. 10. Sınıf Maarif Modeli Doğrulaması
  const grade10Themes = getThemes(10);
  assert.ok(grade10Themes.includes('1. Tema: Geometrik Şekiller'), '10. Sınıf 1. Tema Geometrik Şekiller olmalıdır');
  assert.ok(grade10Themes.includes('2. Tema: İstatistiksel Araştırma Süreci'), '10. Sınıf 2. Tema İstatistiksel Araştırma Süreci olmalıdır');
  assert.ok(grade10Themes.includes('6. Tema: Analitik İnceleme'), '10. Sınıf 6. Tema Analitik İnceleme olmalıdır');

  // 5. Şablon / Kitap Çöp Başlıklarının Temizlendiği Doğrulaması
  const forbiddenTitles = [
    'Hazır Mıyız?', 'Başlayalım', 'İzleme Testi', 'Ölçme ve Değerlendirme',
    'Öz Değerlendirme', 'Sıra Sizde', 'Etkinlik', 'Cevap Anahtarı', 'Sözlük'
  ];

  for (const grade of grades) {
    const themes = getThemes(grade);
    for (const t of themes) {
      for (const forbidden of forbiddenTitles) {
        assert.ok(!t.includes(forbidden), `Tema başlığında "${forbidden}" bulunamaz (Sınıf ${grade}: ${t})`);
      }
      const subs = getSubTopics(grade, t);
      for (const s of subs) {
        for (const forbidden of forbiddenTitles) {
          assert.notEqual(s.name.trim(), forbidden, `Alt konu başlığı "${forbidden}" olamaz (Sınıf ${grade}, Tema ${t})`);
        }
      }
    }
  }
});
