const test = require('node:test');
const assert = require('node:assert/strict');
const { getCurriculumTree, getGrades, getThemes, getSubTopics } = require('../lib/meb-curriculum');

test('MEB Müfredat Ağacı Doğrulama ve Sınıf Bütünlüğü (Ders Kitabı İçindekiler %100 Uyum)', () => {
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

  // 3. 5. Sınıf 1. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü
  const grade5Tema1Subs = getSubTopics(5, '1. Tema: Geometrik Şekiller').map(s => s.name);
  assert.equal(grade5Tema1Subs.length, 19, '5. sınıf 1. Tema MEB içindekiler sayfasındaki 19 alt konunun tamamını içermelidir');
  
  // Kitaptaki her bir alt başlığın varlığını doğrula
  const expectedGrade5Subs = [
    'Temel Geometrik Şekiller ve Özellikleri',
    'Nokta',
    'Çember',
    'Dikme',
    'Temel Geometrik Çizimlerin Özellikleri',
    'Açıları Ölçme',
    'Açı Nasıl Ölçülür?',
    'Doğruların Yolculuğu',
    'İki Doğrunun Kesişimi',
    'Düzlemde Açı Oluşturmayan Doğrular',
    'İki Doğrunun Çakışması',
    'Üç Doğrunun Paralelliği',
    'Üç Doğrunun Bir Noktada Kesişimi',
    'Üç Doğrunun İkişer İkişer Kesişimi',
    'İki Paralel Doğru ve Bir Kesen',
    'Doğrulardan Çokgenlere',
    'Çokgenlerin Temel Elemanları',
    'Üçgen',
    'Üçgen İnşası'
  ];

  for (const exp of expectedGrade5Subs) {
    assert.ok(grade5Tema1Subs.includes(exp), `Kitap görselindeki "${exp}" başlığı alt konularda bulunmalıdır`);
  }

  // 4. 5. Sınıf 2. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü
  const grade5Tema2Subs = getSubTopics(5, '2. Tema: Sayılar ve Nicelikler (1): Doğal Sayılar ve İşlemler').map(s => s.name);
  assert.deepEqual(grade5Tema2Subs, [
    'Doğal Sayılar ve İşlemler',
    'Çok Basamaklı Doğal Sayıları Okuma ve Yazma',
    'Gerçek Yaşam Problemlerini Çözebilme'
  ], '5. sınıf 2. Tema MEB içindekiler görseliyle birebir aynı 3 alt konuyu içermelidir');

  // 5. 5. Sınıf 4. Tema: Sadece Kesirler (Ondalık Gösterim ve Yüzdeler bağımsız konu olarak 5\'te yer almamalı)
  const grade5Tema4Subs = getSubTopics(5, '4. Tema: Sayılar ve Nicelikler (2): Kesirler').map(s => s.name);
  assert.equal(grade5Tema4Subs.length, 2, '5. sınıf 4. Tema MEB kitabındaki gibi tam 2 alt konudan oluşmalıdır');
  assert.ok(grade5Tema4Subs.includes('Kesirleri Farklı Biçimlerde Temsil Etme'), 'Kesirleri Farklı Biçimlerde Temsil Etme bulunmalıdır');
  assert.ok(grade5Tema4Subs.includes('Kesirleri Karşılaştırma'), 'Kesirleri Karşılaştırma bulunmalıdır');

  // 6. 5. Sınıf 5. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (9 alt konu)
  const grade5Tema5Subs = getSubTopics(5, '5. Tema: İstatistiksel Araştırma Süreci').map(s => s.name);
  assert.deepEqual(grade5Tema5Subs, [
    'İstatistiksel Araştırma Süreci',
    'İstatistik Nedir?',
    'İstatistiksel Araştırma Adımları',
    'Araştırma Sorusuna Uygun Anket Sorusu Yazma',
    'Veri Görselleştirme Araçları',
    'Sütun Grafiği',
    'Daire Grafiği',
    'İstatistik Okuryazarlığı',
    'Verilerin Değişebilirliği'
  ], '5. sınıf 5. Tema MEB içindekiler görseliyle birebir aynı 9 alt konuyu içermelidir');

  // 5. 6. Sınıf Maarif Modeli ve Gerçek Kitap Başlığı Doğrulaması
  const grade6Themes = getThemes(6);
  assert.ok(grade6Themes.includes('3. Tema: Sayılar ve Nicelikler (2)'), '6. sınıf kitabındaki "3. Tema: Sayılar ve Nicelikler (2)" tam adıyla bulunmalıdır');
  const grade6Tema3Subs = getSubTopics(6, '3. Tema: Sayılar ve Nicelikler (2)').map(s => s.name);
  assert.ok(grade6Tema3Subs.includes('Ondalık Gösterimlerde Basamak Değeri'), 'Ondalık Gösterimler 6. sınıfta yer almalıdır');
  assert.ok(grade6Tema3Subs.includes('Kesir ile Bölme İşlemi İlişkisi'), 'Kesir ile Bölme yer almalıdır');
  assert.ok(grade6Tema3Subs.includes('Uzunluk Ölçme Birimleri'), 'Uzunluk Ölçme yer almalıdır');

  // 6. Sınıf 4. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (8 alt konu)
  const grade6Tema4Subs = getSubTopics(6, '4. Tema: İstatistiksel Araştırma Süreci').map(s => s.name);
  assert.deepEqual(grade6Tema4Subs, [
    'Kategorik ve Nicel Veriye Dayanan Araştırma Sorusu Oluşturma',
    'Araştırma Sorularında Sağlanması Gereken Ölçütler',
    'İstatistiksel Araştırma Sürecinde Planlama',
    'Anket Sorusu Hazırlama',
    'Verileri Görselleştirme ve Özetleme',
    'Verileri Görselleştirme ve Özetleme (Merkezî Eğilim Ölçüleri)',
    'Sonuçları Yorumlama',
    'Sonuç veya Yorumları Tartışma'
  ], '6. sınıf 4. Tema MEB içindekiler görseliyle birebir aynı 8 alt konuyu içermelidir');

  // 6. Sınıf 6. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (3 alt konu: Bilinmeyen Nicelikler, Örüntüler, Algoritma)
  const grade6Tema6Subs = getSubTopics(6, '6. Tema: İşlemlerle Cebirsel Düşünme ve Değişimler').map(s => s.name);
  assert.deepEqual(grade6Tema6Subs, [
    'Bilinmeyen Nicelikler',
    'Örüntüler',
    'Algoritma'
  ], '6. sınıf 6. Tema MEB içindekiler görseliyle birebir aynı 3 alt konuyu içermelidir');

  // 6. Sınıf 7. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (6 alt konu)
  const grade6Tema7Subs = getSubTopics(6, '7. Tema: Geometrik Nicelikler').map(s => s.name);
  assert.deepEqual(grade6Tema7Subs, [
    'Alan Ölçme Birimleri',
    'Paralelkenar ve Üçgenin Alanı',
    'Gerçek Yaşam Problemleri',
    'Çemberin ve Çapının Uzunlukları Arasındaki İlişki',
    'Gerçek Yaşam Problemleri',
    'Çemberde Merkez Açı ve Merkez Açının Gördüğü Yayın Uzunluğu'
  ], '6. sınıf 7. Tema MEB içindekiler görseliyle birebir aynı 6 alt konuyu içermelidir');

  // 7. Sınıf 1. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (8 alt konu)
  const grade7Tema1Subs = getSubTopics(7, '1. Tema: Sayılar ve Nicelikler (1)').map(s => s.name);
  assert.deepEqual(grade7Tema1Subs, [
    'Tam Sayılar',
    'Rasyonel Sayılar',
    'Mutlak Değer',
    'Rasyonel Sayıların Farklı Temsilleri',
    'Rasyonel Sayılarda Karşılaştırma ve Sıralama',
    'Tam Sayılarla İşlemler ve Problem Çözme',
    'Rasyonel Sayılarla İşlemler ve Problem Çözme',
    'Çok Adımlı İşlemler'
  ], '7. sınıf 1. Tema MEB içindekiler görseliyle birebir aynı 8 alt konuyu içermelidir');

  // 7. Sınıf 2. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (6 alt konu)
  const grade7Tema2Subs = getSubTopics(7, '2. Tema: Geometrik Nicelikler (1)').map(s => s.name);
  assert.deepEqual(grade7Tema2Subs, [
    'Cisimlerin Farklı Yönlerden Görünümleri',
    'Dikdörtgenler Prizmasının Açınımı ve Yüzey Alanı',
    'Hacmi Eş Nesneler Aracılığıyla Yorumlama',
    'Dikdörtgenler Prizmasının Hacim Bağıntısını Elde Etme',
    'Hacim Ölçme Birimleri',
    'Dikdörtgenler Prizması ile Modellenen Cisimlerin Yüzey Alanları ve Hacimlerine Yönelik Problemler'
  ], '7. sınıf 2. Tema MEB içindekiler görseliyle birebir aynı 6 alt konuyu içermelidir');

  // 7. Sınıf 3. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (7 alt konu)
  const grade7Tema3Subs = getSubTopics(7, '3. Tema: İstatistiksel Araştırma Süreci').map(s => s.name);
  assert.deepEqual(grade7Tema3Subs, [
    'Kategorik ve Nicel Veri Dağılımları',
    'İstatistiksel Araştırma Süreci Adımları',
    'Araştırma Sorusunu Belirleme',
    'Verileri Toplama ve Analize Hazırlama',
    'Veri Analizi (Görselleştirme ve Özetleme)',
    'Veriyi Yorumlama ve Karar Verme',
    'İstatistiksel Araştırma Süreçlerinin İncelenmesi'
  ], '7. sınıf 3. Tema MEB içindekiler görseliyle birebir aynı 7 alt konuyu içermelidir');

  // 7. Sınıf 6. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (6 alt konu)
  const grade7Tema6Subs = getSubTopics(7, '6. Tema: Sayılar ve Nicelikler (2)').map(s => s.name);
  assert.deepEqual(grade7Tema6Subs, [
    'Oran',
    'Birimli Birimsiz Oran',
    'Denk Oran',
    'Birim Oran',
    'Orantı',
    'Doğru Orantı Problemleri'
  ], '7. sınıf 6. Tema MEB içindekiler görseliyle birebir aynı 6 alt konuyu içermelidir');

  // 7. Sınıf 7. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (4 alt konu)
  const grade7Tema7Subs = getSubTopics(7, '7. Tema: Veriden Olasılığa').map(s => s.name);
  assert.deepEqual(grade7Tema7Subs, [
    'Teorik Olasılık',
    'Tümleyen Olay',
    'Eşit Olasılıklı Olaylar',
    'Ayrık ve Ayrık Olmayan Olaylar'
  ], '7. sınıf 7. Tema MEB içindekiler görseliyle birebir aynı 4 alt konuyu içermelidir');

  // 7. Sınıf 8. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (5 alt konu)
  const grade7Tema8Subs = getSubTopics(7, '8. Tema: İşlemlerle Cebirsel Düşünme ve Değişimler').map(s => s.name);
  assert.deepEqual(grade7Tema8Subs, [
    'Cebirsel İfadelerle İşlemler',
    'Denklemler',
    'Eşitsizlikler',
    'İspat',
    'Algoritmayı Yapılandırma'
  ], '7. sınıf 8. Tema MEB içindekiler görseliyle birebir aynı 5 alt konuyu içermelidir');

  // 7. Sınıf 9. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (5 alt konu)
  const grade7Tema9Subs = getSubTopics(7, '9. Tema: Geometrik Nicelikler (2)').map(s => s.name);
  assert.deepEqual(grade7Tema9Subs, [
    'Dairenin Alanı',
    'Daire Diliminin Alanı',
    'Eşkenar Dörtgenin Alanı',
    'Yamuğun Alanı',
    'Daire, Daire Dilimi, Eşkenar Dörtgen ve Yamuğun Alanına İlişkin Problemler'
  ], '7. sınıf 9. Tema MEB içindekiler görseliyle birebir aynı 5 alt konuyu içermelidir');

  // 9. Sınıf 1. Tema MEB Kitap Görseli Birebir Eşleşme Kontrolü (4 alt konu)
  const grade9Tema1Subs = getSubTopics(9, '1. Tema: Sayılar').map(s => s.name);
  assert.deepEqual(grade9Tema1Subs, [
    'Gerçek Sayıların Üslü ve Köklü Gösterimleri ile Yapılan İşlemler',
    'Gerçek Sayı Aralıklarının Gösterimi ve Aralıklarla İlgili İşlemlerde Küme Sembollerinin Kullanımı',
    'Sayı Kümeleri ve İşlem Özellikleri',
    'Gerçek Sayıların İşlem Özelliklerini Cebirsel Olarak İfade Etme'
  ], '9. sınıf 1. Tema MEB içindekiler görseliyle birebir aynı 4 alt konuyu içermelidir');

  // 6. 10. Sınıf Maarif Modeli Numaralandırılmış Kitap Başlıkları Doğrulaması
  const grade10Themes = getThemes(10);
  assert.ok(grade10Themes.includes('1. Tema: Geometrik Şekiller'), '10. Sınıf 1. Tema Geometrik Şekiller olmalıdır');
  const grade10Tema1Subs = getSubTopics(10, '1. Tema: Geometrik Şekiller').map(s => s.name);
  assert.ok(grade10Tema1Subs.some(s => s.includes('1.1. Dik Üçgende Trigonometrik Oranlar')), '10. Sınıf 1.1 başlığı bulunmalıdır');
  assert.ok(grade10Tema1Subs.some(s => s.includes('1.4. Sinüs ve Kosinüs Teoremleri')), '10. Sınıf 1.4 Sinüs ve Kosinüs Teoremleri bulunmalıdır');

  // 7. Şablon Çöp Başlıklarının Temizlendiği Doğrulaması
  const forbiddenTitles = [
    'Hazır Mıyız?', 'Başlayalım', 'İzleme Testi', 'Ölçme ve Değerlendirme',
    'Öz Değerlendirme', 'Sıra Sizde', 'Cevap Anahtarı', 'Sözlük'
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
