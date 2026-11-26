/* ==========================================================================
   ZarifÇözüm — MEB Türkiye Yüzyılı Maarif Modeli Açık Uçlu Yazılı Havuzu
   5, 6, 7, 8. Sınıflar (1. Dönem 1. & 2. Yazılı tam 6'şar açık uçlu soru = 100 Puan)
   + 9–12. Sınıflar hazır MEB açık uçlu senaryo soruları
   ========================================================================== */
(function (global) {
  "use strict";

  var DONEMLER = [
    { id: "1_donem_1_yazili", ad: "1. Dönem 1. Yazılı", ay: "Kasım Sınavı", renk: "#3B281E" },
    { id: "1_donem_2_yazili", ad: "1. Dönem 2. Yazılı", ay: "Ocak Sınavı", renk: "#1E7550" },
    { id: "2_donem_1_yazili", ad: "2. Dönem 1. Yazılı", ay: "Nisan Sınavı", renk: "#C85A17" },
    { id: "2_donem_2_yazili", ad: "2. Dönem 2. Yazılı", ay: "Haziran Sınavı", renk: "#8C621B" }
  ];

  var SENARYOLAR = [
    { no: 1, ad: "Senaryo 1 (Temel Kazanımlar)", aciklama: "MEB örnek kitapçıklarına uygun temel kavram ve doğrudan işlem odaklı açık uçlu sorular." },
    { no: 2, ad: "Senaryo 2 (Beceri Temelli)", aciklama: "Günlük yaşam problem kurgulu, muhakeme ve modelleme becerisi ölçen açık uçlu sorular." },
    { no: 3, ad: "Senaryo 3 (Karma)", aciklama: "Temel kazanımlar ile yeni nesil beceri temelli soruları dengeli harmanlayan karma sınav." }
  ];

  var HAVUZ = {
    "5": {
      "1_donem_1_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.5.1.1", konu: "Çok Basamaklı Doğal Sayılar", puan: 15,
          metin: "Okunuşu 'Kırk iki milyon üç yüz yedi bin seksen beş' olan doğal sayıyı rakamlarla yazınız ve binler bölüğündeki rakamların sayı değerleri toplamını bulunuz.",
          ipucu: "Milyonlar | Binler | Birler şeklinde üçerli bölük çizgileri çiz; binler bölüğündeki 3 rakamı topla.",
          beklenenSonuc: ["10", "42307085", "42 307 085"],
          yontemAnahtar: ["42", "307", "085", "3+0+7"],
          cozumAdimlari: "Sayı: 42 307 085.\nBinler bölüğü: 307.\nRakamların sayı değerleri toplamı: 3 + 0 + 7 = 10."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.5.1.2", konu: "Doğal Sayılarla Dört İşlem", puan: 15,
          metin: "Bir kırtasiyeci tanesi 18 TL olan defterlerden 24 adet satmış ve kasasında gün başında bulunan 150 TL'nin üzerine eklemiştir. Kasada toplam kaç TL olmuştur?",
          ipucu: "Önce 24 × 18 işlemini yapıp defter gelirini bul, ardından 150 TL ile topla.",
          beklenenSonuc: ["582", "582 tl"],
          yontemAnahtar: ["432", "18", "24", "150"],
          cozumAdimlari: "Defter geliri: 24 × 18 = 432 TL.\nKasada toplam: 432 + 150 = 582 TL."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.5.1.3", konu: "Bölme İşlemi & Kalan Yorumlama", puan: 15,
          metin: "Bir bölme işleminde bölen 12, bölüm 15 ve kalan 7 olduğuna göre bölünen doğal sayı kaçtır?",
          ipucu: "Bölünen = (Bölen × Bölüm) + Kalan kuralını uygula.",
          beklenenSonuc: ["187"],
          yontemAnahtar: ["180", "12", "15", "7"],
          cozumAdimlari: "12 × 15 = 180.\nKalanı ekleyelim: 180 + 7 = 187."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.5.2.1", konu: "Temel Geometrik Kavramlar & Açılar", puan: 20,
          metin: "Bir üçgenin iki iç açısının ölçüsü 48° ve 67°'dir. Üçüncü iç açının ölçüsü kaç derecedir ve bu açı hangi açı çeşididir?",
          ipucu: "Üçgenin iç açıları toplamı 180°'dir. 48 + 67 toplamını 180'den çıkar.",
          beklenenSonuc: ["65", "65 derece", "65 dar"],
          yontemAnahtar: ["115", "180", "dar"],
          cozumAdimlari: "Verilen iki açı toplamı: 48° + 67° = 115°.\nÜçüncü açı: 180° − 115° = 65° (90°'den küçük olduğu için dar açıdır)."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.5.2.2", konu: "Dikdörtgenin Çevre Uzunluğu", puan: 15,
          metin: "Kısa kenarı 9 cm, uzun kenarı ise kısa kenarının 2 katından 3 cm fazla olan dikdörtgenin çevre uzunluğu kaç cm'dir?",
          ipucu: "Uzun kenarı bul: (9 × 2) + 3. Sonra Çevre = 2 × (kısa + uzun).",
          beklenenSonuc: ["60", "60 cm"],
          yontemAnahtar: ["21", "30", "2"],
          cozumAdimlari: "Uzun kenar: 9 × 2 + 3 = 21 cm.\nÇevre: 2 × (9 + 21) = 2 × 30 = 60 cm."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.5.2.3", konu: "Dikdörtgenin Alanı", puan: 20,
          metin: "Kenar uzunlukları 14 m ve 8 m olan dikdörtgen şeklindeki bir bahçenin tamamına metrekare fiyatı 25 TL olan çim ekilecektir. Toplam maliyet kaç TL olur?",
          ipucu: "Önce bahçenin alanını (14 × 8) m² olarak hesapla, sonra 25 ile çarp.",
          beklenenSonuc: ["2800", "2800 tl", "2.800"],
          yontemAnahtar: ["112", "25", "14", "8"],
          cozumAdimlari: "Bahçe alanı: 14 × 8 = 112 m².\nToplam maliyet: 112 × 25 = 2800 TL."
        }
      ],
      "1_donem_2_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.5.3.1", konu: "Denk Kesirler", puan: 15,
          metin: "3/5 kesrine denk olan ve paydası 30 olan kesrin payı kaçtır? İşlem adımlarını gösteriniz.",
          ipucu: "5'i kaçla çarparsan 30 eder? Payı da aynı sayıyla çarp.",
          beklenenSonuc: ["18", "18/30"],
          yontemAnahtar: ["6", "30", "3x6"],
          cozumAdimlari: "30 ÷ 5 = 6 olduğundan kesir 6 ile genişletilir.\nPay = 3 × 6 = 18 (Denk kesir: 18/30)."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.5.3.2", konu: "Kesirleri Sıralama", puan: 15,
          metin: "Ali bir kitabın 2/3'ünü, Ece 5/6'sını, Mert ise 7/12'sini okumuştur. En fazla okuyan öğrenci kimdir? Payda eşitleyerek gösteriniz.",
          ipucu: "Tüm kesirlerin paydasını 12'de eşitle: 2/3 = 8/12, 5/6 = 10/12.",
          beklenenSonuc: ["ece", "5/6", "10/12"],
          yontemAnahtar: ["8/12", "10/12", "12"],
          cozumAdimlari: "Ali = 8/12, Ece = 10/12, Mert = 7/12.\n10/12 > 8/12 > 7/12 olduğundan en fazla okuyan Ece'dir."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.5.3.3", konu: "Kesirlerle Toplama ve Çıkarma", puan: 20,
          metin: "Bir sürahideki suyun önce 1/4'ü, sonra 3/8'i içilmiştir. Sürahide suyun kaçta kaçı kalmıştır?",
          ipucu: "1/4 + 3/8 toplamını payda eşitleyerek bul, ardından 1 tamdan (8/8) çıkar.",
          beklenenSonuc: ["3/8"],
          yontemAnahtar: ["2/8", "5/8", "8/8"],
          cozumAdimlari: "İçilen su: 1/4 + 3/8 = 2/8 + 3/8 = 5/8.\nKalan su: 8/8 − 5/8 = 3/8."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.5.3.4", konu: "Birim Kesir & Çokluk Hesabı", puan: 15,
          metin: "72 TL harçlığının 5/9'unu harcayan Kerem'in geriye kaç TL'si kalmıştır?",
          ipucu: "72'yi 9'a bölerek 1/9'unu (8 TL) bul. Kalan kesir 4/9'dur.",
          beklenenSonuc: ["32", "32 tl"],
          yontemAnahtar: ["8", "40", "72"],
          cozumAdimlari: "1/9'u = 72 ÷ 9 = 8 TL.\nHarcanan: 5 × 8 = 40 TL.\nKalan: 72 − 40 = 32 TL."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.5.4.1", konu: "Ondalık Gösterim & Yüzdeler", puan: 15,
          metin: "3/4 kesrini önce ondalık gösterim, ardından yüzde (%) sembolü ile yazınız.",
          ipucu: "Paydayı 100 yapmak için 25 ile genişlet: 75/100.",
          beklenenSonuc: ["%75", "0,75", "75"],
          yontemAnahtar: ["25", "75/100", "0,75"],
          cozumAdimlari: "3/4 = (3×25)/(4×25) = 75/100.\nOndalık gösterim: 0,75 • Yüzde: %75."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.5.5.1", konu: "Sayı Örüntüleri", puan: 20,
          metin: "İlk terimi 7 olan ve her adımda 4 artan bir sayı örüntüsünün 6. terimi kaçtır?",
          ipucu: "7, 11, 15... şeklinde 6. adıma kadar ilerle.",
          beklenenSonuc: ["27"],
          yontemAnahtar: ["11", "15", "19", "23"],
          cozumAdimlari: "Terimler: 7, 11, 15, 19, 23, 27.\n6. terim = 27."
        }
      ]
    },

    "6": {
      "1_donem_1_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.6.1.1", konu: "Çarpanlar ve Asal Çarpanlar", puan: 15,
          metin: "72 doğal sayısının asal çarpanlarını algoritma yöntemiyle bulunuz ve üslü ifadelerin çarpımı şeklinde yazınız.",
          ipucu: "72'yi sırayla 2'ye ve 3'e bölerek asal çarpanlarına ayır.",
          beklenenSonuc: ["2^3.3^2", "2³.3²", "2 ve 3", "8.9"],
          yontemAnahtar: ["36", "18", "9", "2", "3"],
          cozumAdimlari: "72 ÷ 2 = 36, 36 ÷ 2 = 18, 18 ÷ 2 = 9, 9 ÷ 3 = 3, 3 ÷ 3 = 1.\n72 = 2³ · 3² (Asal çarpanlar: 2 ve 3)."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.6.1.2", konu: "Bölünebilme Kuralları", puan: 15,
          metin: "4A6 üç basamaklı sayısı 3 ile kalansız bölünebildiğine göre A yerine yazılabilecek rakamların toplamı kaçtır?",
          ipucu: "3 ile bölünebilme: 4 + A + 6 = 10 + A sayısı 3'ün katı olmalı.",
          beklenenSonuc: ["15"],
          yontemAnahtar: ["2", "5", "8", "10"],
          cozumAdimlari: "10 + A sayısı 3'ün katı olmalı ⇒ A ∈ {2, 5, 8}.\nToplam: 2 + 5 + 8 = 15."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.6.1.3", konu: "Ortak Bölen & Ortak Kat", puan: 20,
          metin: "18 ve 24 sayılarının en büyük ortak böleni (EBOB) ile en küçük ortak katının (EKOK) toplamı kaçtır?",
          ipucu: "18 ve 24'ün ortak bölenlerinin en büyüğü 6, en küçük ortak katı 72'dir.",
          beklenenSonuc: ["78"],
          yontemAnahtar: ["6", "72"],
          cozumAdimlari: "Ortak bölenlerin en büyüğü: 6.\nEn küçük ortak kat: 72.\nToplam: 6 + 72 = 78."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.6.2.1", konu: "Tam Sayılar & Mutlak Değer", puan: 15,
          metin: "|−14| + |+5| − |−9| işleminin sonucunu adım adım hesaplayınız.",
          ipucu: "Mutlak değer daima pozitif (veya 0) çıkar: |−14| = 14.",
          beklenenSonuc: ["10"],
          yontemAnahtar: ["14", "5", "9", "19"],
          cozumAdimlari: "|−14| = 14, |+5| = 5, |−9| = 9.\n14 + 5 − 9 = 19 − 9 = 10."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.6.2.2", konu: "Tam Sayıları Karşılaştırma", puan: 15,
          metin: "Bir şehrin sabah sıcaklığı −6°C, öğle sıcaklığı +4°C ölçülmüştür. Sıcaklık sabah ile öğle arasında kaç derece artmıştır?",
          ipucu: "Sayı doğrusunda −6'dan 0'a 6 birim, 0'dan +4'e 4 birim ilerle.",
          beklenenSonuc: ["10", "10 derece"],
          yontemAnahtar: ["6", "4", "10"],
          cozumAdimlari: "(+4) − (−6) = 4 + 6 = 10°C artmıştır."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.6.3.1", konu: "İşlem Önceliği", puan: 20,
          metin: "36 ÷ 4 + 3² · (7 − 5) işleminin sonucunu işlem önceliğine göre bulunuz.",
          ipucu: "Önce parantez (7−5=2) ve üs (3²=9), sonra çarpma/bölme, en son toplama.",
          beklenenSonuc: ["27"],
          yontemAnahtar: ["9", "2", "18"],
          cozumAdimlari: "36 ÷ 4 = 9 ve 3² · 2 = 9 · 2 = 18.\nToplam: 9 + 18 = 27."
        }
      ],
      "1_donem_2_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.6.3.2", konu: "Kesirlerle Çarpma", puan: 15,
          metin: "Bir bahçenin 3/4'ünün 2/5'ine domates ekilmiştir. Domates ekili alan tüm bahçenin kaçta kaçıdır? En sade biçimde yazınız.",
          ipucu: "Kesrin kesrini bulmak için iki kesri çarp: (3/4) × (2/5).",
          beklenenSonuc: ["3/10"],
          yontemAnahtar: ["6/20", "3/10"],
          cozumAdimlari: "(3 × 2) / (4 × 5) = 6/20 = 3/10."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.6.3.3", konu: "Kesirlerle Bölme", puan: 20,
          metin: "6 litre süt, her biri 3/4 litre alan şişelere tam olarak doldurulacaktır. Kaç şişe gerekir?",
          ipucu: "6 ÷ (3/4) = 6 × (4/3) şeklinde ters çevirip çarp.",
          beklenenSonuc: ["8", "8 şişe"],
          yontemAnahtar: ["4/3", "24/3"],
          cozumAdimlari: "6 ÷ (3/4) = 6 × (4/3) = 24 / 3 = 8 şişe."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.6.4.1", konu: "Ondalık Gösterim Yuvarlama", puan: 15,
          metin: "14,376 ondalık gösterimini onda birler ve yüzde birler basamağına yuvarlayınız.",
          ipucu: "Onda birler için 7'ye bak (≥5 yukarı), yüzde birler için 6'ya bak.",
          beklenenSonuc: ["14,4", "14,38"],
          yontemAnahtar: ["14,4", "14,38"],
          cozumAdimlari: "Onda birler basamağına yuvarlanmış: 14,4.\nYüzde birler basamağına yuvarlanmış: 14,38."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.6.4.2", konu: "Ondalık Gösterimlerle İşlemler", puan: 15,
          metin: "Metresi 12,5 TL olan kumaştan 4 metre alan bir terzi satıcıya 100 TL verirse kaç TL para üstü alır?",
          ipucu: "12,5 × 4 = 50 TL. 100 − 50 işlemini yap.",
          beklenenSonuc: ["50", "50 tl"],
          yontemAnahtar: ["50", "100"],
          cozumAdimlari: "Kumaş tutarı: 12,5 × 4 = 50 TL.\nPara üstü: 100 − 50 = 50 TL."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.6.5.1", konu: "Oran ve Birimli Oran", puan: 15,
          metin: "3 saatte 240 km yol giden bir aracın saatteki ortalama hızı (km/sa) kaçtır?",
          ipucu: "Yol / Zaman oranını kur: 240 ÷ 3.",
          beklenenSonuc: ["80", "80 km/sa"],
          yontemAnahtar: ["240", "3", "80"],
          cozumAdimlari: "Oran = 240 km / 3 saat = 80 km/sa."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.6.6.1", konu: "Cebirsel İfadeler", puan: 20,
          metin: "4x − 7 cebirsel ifadesinin x = 5 için sayısal değerini hesaplayınız.",
          ipucu: "x yerine 5 yaz: 4 × 5 − 7.",
          beklenenSonuc: ["13"],
          yontemAnahtar: ["20", "7", "13"],
          cozumAdimlari: "4 · 5 − 7 = 20 − 7 = 13."
        }
      ]
    },

    "7": {
      "1_donem_1_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.7.1.1", konu: "Tam Sayılarla Toplama/Çıkarma", puan: 15,
          metin: "(−12) + (+19) − (−5) işleminin sonucunu adım adım bulunuz.",
          ipucu: "−(−5) ifadesi +5'e dönüşür. Sonra soldan sağa topla.",
          beklenenSonuc: ["12", "+12"],
          yontemAnahtar: ["+5", "7", "12"],
          cozumAdimlari: "(−12) + (+19) = +7.\n(+7) − (−5) = 7 + 5 = +12."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.7.1.2", konu: "Tam Sayılarla Çarpma/Bölme", puan: 15,
          metin: "[(−6) · (+4)] ÷ (−3) işleminin sonucunu bulunuz.",
          ipucu: "Önce parantez içi (−24), sonra iki negatifin bölümü pozitiftir.",
          beklenenSonuc: ["8", "+8"],
          yontemAnahtar: ["-24", "8"],
          cozumAdimlari: "(−6) · (+4) = −24.\n(−24) ÷ (−3) = +8."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.7.1.3", konu: "Tam Sayıların Kuvvetleri", puan: 20,
          metin: "(−2)⁴ + (−3)³ − (−1)⁵ işleminin sonucunu hesaplayınız.",
          ipucu: "(−2)⁴ = +16, (−3)³ = −27, (−1)⁵ = −1.",
          beklenenSonuc: ["-10"],
          yontemAnahtar: ["16", "-27", "-1"],
          cozumAdimlari: "16 + (−27) − (−1) = −11 + 1 = −10."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.7.1.4", konu: "Tam Sayı Problemleri", puan: 15,
          metin: "20 soruluk bir testte her doğru +5 puan, her yanlış −2 puandır. 14 doğru ve 6 yanlış yapan bir öğrenci kaç puan alır?",
          ipucu: "(14 × 5) + (6 × −2) işlemini hesapla.",
          beklenenSonuc: ["58", "58 puan"],
          yontemAnahtar: ["70", "-12", "58"],
          cozumAdimlari: "Doğru puanı: 14 × 5 = +70.\nYanlış puanı: 6 × (−2) = −12.\nToplam: 70 − 12 = 58 puan."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.7.2.1", konu: "Rasyonel Sayıları Sıralama", puan: 15,
          metin: "−3/4, −1/2 ve −5/8 rasyonel sayılarını küçükten büyüğe sıralayınız.",
          ipucu: "Paydaları 8'de eşitle: −6/8, −4/8, −5/8.",
          beklenenSonuc: ["-3/4 < -5/8 < -1/2", "-3/4,-5/8,-1/2"],
          yontemAnahtar: ["-6/8", "-4/8", "-5/8"],
          cozumAdimlari: "−3/4 = −6/8, −1/2 = −4/8.\nSıralama: −3/4 < −5/8 < −1/2."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.7.2.2", konu: "Rasyonel Sayılarla İşlemler", puan: 20,
          metin: "(1 − 1/3) ÷ (2/9) işleminin sonucunu bulunuz.",
          ipucu: "Önce parantez içi: 1 − 1/3 = 2/3. Sonra 2/9'u ters çevirip çarp.",
          beklenenSonuc: ["3"],
          yontemAnahtar: ["2/3", "9/2", "3"],
          cozumAdimlari: "(2/3) ÷ (2/9) = (2/3) · (9/2) = 9/3 = 3."
        }
      ],
      "1_donem_2_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.7.3.1", konu: "Cebirsel İfadelerle İşlemler", puan: 15,
          metin: "3(2x − 4) + 2(x + 5) cebirsel ifadesinin en sade halini bulunuz.",
          ipucu: "Parantezleri dağıt: 6x − 12 + 2x + 10, sonra benzer terimleri topla.",
          beklenenSonuc: ["8x-2", "8x - 2"],
          yontemAnahtar: ["6x", "12", "2x", "10"],
          cozumAdimlari: "6x − 12 + 2x + 10 = 8x − 2."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.7.3.2", konu: "Birinci Dereceden Denklemler", puan: 20,
          metin: "4x − 7 = 2x + 11 denklemini sağlayan x değerini bulunuz.",
          ipucu: "x'leri sola, sayıları sağa topla: 4x − 2x = 11 + 7.",
          beklenenSonuc: ["9", "x=9"],
          yontemAnahtar: ["2x", "18", "9"],
          cozumAdimlari: "2x = 18 ⇒ x = 9."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.7.3.3", konu: "Denklem Kurma Problemleri", puan: 20,
          metin: "Bir sayının 3 katının 5 fazlası 38 olduğuna göre bu sayı kaçtır?",
          ipucu: "Denklemi kur: 3x + 5 = 38.",
          beklenenSonuc: ["11", "x=11"],
          yontemAnahtar: ["3x+5=38", "33", "11"],
          cozumAdimlari: "3x + 5 = 38 ⇒ 3x = 33 ⇒ x = 11."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.7.4.1", konu: "Oran ve Orantı", puan: 15,
          metin: "Aynı hızda çalışan 4 işçi bir işi 12 günde bitiriyorsa, 6 işçi aynı işi kaç günde bitirir?",
          ipucu: "İşçi sayısı artarsa gün azalır (ters orantı): 4 × 12 = 6 × x.",
          beklenenSonuc: ["8", "8 gün"],
          yontemAnahtar: ["48", "6", "8"],
          cozumAdimlari: "Ters orantı: 4 · 12 = 6 · x ⇒ 48 = 6x ⇒ x = 8 gün."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.7.4.2", konu: "Yüzde Problemleri", puan: 15,
          metin: "Etiket fiyatı 400 TL olan bir montta %20 indirim yapılmıştır. Montun indirimli satış fiyatı kaç TL'dir?",
          ipucu: "400'ün %20'si 80 TL'dir. 400'den 80 çıkar.",
          beklenenSonuc: ["320", "320 tl"],
          yontemAnahtar: ["80", "400", "320"],
          cozumAdimlari: "İndirim: 400 × 20 / 100 = 80 TL.\nSatış fiyatı: 400 − 80 = 320 TL."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.7.5.1", konu: "Çokgenlerin İç Açıları", puan: 15,
          metin: "Bir düzgün altıgenin bir iç açısının ölçüsü kaç derecedir?",
          ipucu: "Önce bir dış açıyı bul: 360° ÷ 6 = 60°. Sonra 180° − 60°.",
          beklenenSonuc: ["120", "120 derece"],
          yontemAnahtar: ["60", "360", "180", "120"],
          cozumAdimlari: "Bir dış açı: 360° / 6 = 60°.\nBir iç açı: 180° − 60° = 120°."
        }
      ]
    },

    "8": {
      "1_donem_1_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.8.1.1", konu: "EBOB Problemi", puan: 15,
          metin: "42 kg pirinç ve 56 kg bulgur birbirine karıştırılmadan eşit ağırlıklı en büyük paketlere konulacaktır. En az kaç paket gerekir?",
          ipucu: "EBOB(42, 56) = 14 kg. Her çuvalı 14'e bölüp paket sayılarını topla.",
          beklenenSonuc: ["7", "7 paket"],
          yontemAnahtar: ["14", "3", "4", "7"],
          cozumAdimlari: "EBOB(42, 56) = 14 kg.\nPaket sayısı: (42 ÷ 14) + (56 ÷ 14) = 3 + 4 = 7 paket."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.8.1.2", konu: "EKOK & Periyodik Problem", puan: 15,
          metin: "Biri 15, diğeri 20 dakikada bir çalan iki zil ilk kez saat 09.00'da birlikte çalmıştır. İkinci kez saat kaçta birlikte çalarlar?",
          ipucu: "EKOK(15, 20) = 60 dakika = 1 saat.",
          beklenenSonuc: ["10.00", "10:00"],
          yontemAnahtar: ["60", "1 saat", "10"],
          cozumAdimlari: "EKOK(15, 20) = 60 dk = 1 saat.\n09.00 + 1 saat = 10.00."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.8.1.3", konu: "Aralarında Asal Sayılar", puan: 15,
          metin: "Aralarında asal iki doğal sayının EKOK'u 90 ve sayılardan biri 9 olduğuna göre diğer sayı kaçtır?",
          ipucu: "Aralarında asal sayılarda EKOK = a · b.",
          beklenenSonuc: ["10"],
          yontemAnahtar: ["90", "9", "10"],
          cozumAdimlari: "9 · b = 90 ⇒ b = 10 (9 ve 10 aralarında asaldır)."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.8.2.1", konu: "Üslü İfadelerle İşlemler", puan: 20,
          metin: "(16³ · 4⁻²) / 2⁵ işleminin sonucunu 2 tabanında üslü ifade olarak bulunuz.",
          ipucu: "16³ = 2¹², 4⁻² = 2⁻⁴. Payda 2⁵.",
          beklenenSonuc: ["2^3", "2³", "8"],
          yontemAnahtar: ["2^12", "2^-4", "2^8", "8"],
          cozumAdimlari: "Pay: 2¹² · 2⁻⁴ = 2⁸.\nBölme: 2⁸ / 2⁵ = 2³ = 8."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.8.2.2", konu: "Bilimsel Gösterim", puan: 15,
          metin: "0,00045 · 10⁸ sayısının bilimsel gösterimini yazınız.",
          ipucu: "Virgülü 4 basamak sağa kaydırıp 4,5 yap; 10'un üssünü 4 azalt.",
          beklenenSonuc: ["4,5.10^4", "4.5*10^4", "4,5x10^4", "4,5 · 10⁴"],
          yontemAnahtar: ["4,5", "10^4", "4"],
          cozumAdimlari: "0,00045 = 4,5 · 10⁻⁴.\n4,5 · 10⁻⁴ · 10⁸ = 4,5 · 10⁴."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.8.3.1", konu: "Kareköklü İfadeler", puan: 20,
          metin: "√75 + √48 − √12 işleminin sonucunu a√b biçiminde bulunuz.",
          ipucu: "√75 = 5√3, √48 = 4√3, √12 = 2√3.",
          beklenenSonuc: ["7√3", "7kök3", "7kok3"],
          yontemAnahtar: ["5√3", "4√3", "2√3", "7"],
          cozumAdimlari: "5√3 + 4√3 − 2√3 = (5 + 4 − 2)√3 = 7√3."
        }
      ],
      "1_donem_2_yazili": [
        {
          soruNo: 1, kazanimKodu: "MAT.8.3.2", konu: "Kareköklü Çarpma/Bölme", puan: 15,
          metin: "(√18 · √8) / √4 işleminin sonucunu tam sayı olarak bulunuz.",
          ipucu: "√18 · √8 = √144 = 12, √4 = 2.",
          beklenenSonuc: ["6"],
          yontemAnahtar: ["144", "12", "2", "6"],
          cozumAdimlari: "√(18·8) = √144 = 12.\n12 / 2 = 6."
        },
        {
          soruNo: 2, kazanimKodu: "MAT.8.4.1", konu: "Daire Grafiği", puan: 15,
          metin: "Bir kütüphanedeki 180 kitabın 45 tanesi matematik kitabıdır. Daire grafiğinde matematik kitaplarının merkez açısı kaç derecedir?",
          ipucu: "(45 / 180) × 360° işlemini yap.",
          beklenenSonuc: ["90", "90 derece"],
          yontemAnahtar: ["1/4", "360", "90"],
          cozumAdimlari: "45 / 180 = 1/4.\nMerkez açı: 360° × (1/4) = 90°."
        },
        {
          soruNo: 3, kazanimKodu: "MAT.8.5.1", konu: "Basit Olayların Olasılığı", puan: 15,
          metin: "Bir torbada eş büyüklükte 5 sarı, 7 mavi ve 3 yeşil top vardır. Rastgele çekilen bir topun mavi olmama olasılığı kaçtır?",
          ipucu: "Toplam 15 top var. Mavi olmayanlar: 5 + 3 = 8 top.",
          beklenenSonuc: ["8/15"],
          yontemAnahtar: ["15", "8", "8/15"],
          cozumAdimlari: "Toplam top: 5 + 7 + 3 = 15.\nMavi olmayan: 5 + 3 = 8.\nOlasılık = 8/15."
        },
        {
          soruNo: 4, kazanimKodu: "MAT.8.6.1", konu: "Özdeşlikler", puan: 20,
          metin: "(x + 4)² − (x − 4)² ifadesinin en sade cebirsel eşitini bulunuz.",
          ipucu: "(x² + 8x + 16) − (x² − 8x + 16) açılımını yap.",
          beklenenSonuc: ["16x"],
          yontemAnahtar: ["8x", "16", "16x"],
          cozumAdimlari: "(x² + 8x + 16) − (x² − 8x + 16) = 16x."
        },
        {
          soruNo: 5, kazanimKodu: "MAT.8.6.2", konu: "İki Kare Farkı", puan: 15,
          metin: "a² − b² = 48 ve a − b = 6 olduğuna göre a + b toplamı kaçtır?",
          ipucu: "a² − b² = (a − b)(a + b) özdeşliğini kullan.",
          beklenenSonuc: ["8"],
          yontemAnahtar: ["48", "6", "8"],
          cozumAdimlari: "(a − b)(a + b) = 48 ⇒ 6 · (a + b) = 48 ⇒ a + b = 8."
        },
        {
          soruNo: 6, kazanimKodu: "MAT.8.6.3", konu: "Çarpanlara Ayırma", puan: 20,
          metin: "Bir karenin alanı (9x² + 24x + 16) cm² olduğuna göre bu karenin bir kenar uzunluğunu x cinsinden yazınız.",
          ipucu: "9x² = (3x)² ve 16 = 4² olduğuna göre tam kare özdeşliğini kullan.",
          beklenenSonuc: ["3x+4", "3x + 4"],
          yontemAnahtar: ["3x", "4", "(3x+4)^2"],
          cozumAdimlari: "9x² + 24x + 16 = (3x + 4)².\nBir kenar uzunluğu = 3x + 4 cm."
        }
      ]
    },

    /* 9-12. Sınıflar için de hazır MEB açık uçlu senaryo (boş ekran kalmaması için) */
    "9": {
      "1_donem_1_yazili": [
        { soruNo: 1, kazanimKodu: "MAT.9.1.1", konu: "Üslü Denklemler", puan: 20, metin: "3ˣ⁺¹ = 81 denklemini sağlayan x değerini bulunuz.", ipucu: "81 = 3⁴ yazarak üsleri eşitle.", beklenenSonuc: ["3", "x=3"], yontemAnahtar: ["3^4", "x+1=4"], cozumAdimlari: "3ˣ⁺¹ = 3⁴ ⇒ x + 1 = 4 ⇒ x = 3." },
        { soruNo: 2, kazanimKodu: "MAT.9.1.2", konu: "Köklü Eşlenik", puan: 20, metin: "6 / (√7 − 2) − 2√7 işleminin sonucunu bulunuz.", ipucu: "Pay ve paydayı (√7 + 2) ile genişlet.", beklenenSonuc: ["4"], yontemAnahtar: ["√7+2", "3", "4"], cozumAdimlari: "6(√7+2)/3 − 2√7 = 2√7 + 4 − 2√7 = 4." },
        { soruNo: 3, kazanimKodu: "MAT.9.2.1", konu: "Doğrusal Fonksiyonlar", puan: 20, metin: "f(x) = 3x − 5 doğrusal fonksiyonu için f(4) + f(−1) toplamını bulunuz.", ipucu: "Önce f(4) ve f(−1) değerlerini ayrı ayrı hesapla.", beklenenSonuc: ["-1"], yontemAnahtar: ["7", "-8", "-1"], cozumAdimlari: "f(4) = 7, f(−1) = −8.\n7 + (−8) = −1." },
        { soruNo: 4, kazanimKodu: "MAT.9.2.2", konu: "Grafik & Alan", puan: 20, metin: "f(x) = −2x + 8 doğrusu ile koordinat eksenleri arasında kalan üçgenin alanı kaç birimkaredir?", ipucu: "Eksenleri kestiği noktalar (0, 8) ve (4, 0).", beklenenSonuc: ["16"], yontemAnahtar: ["4", "8", "16"], cozumAdimlari: "Alan = (4 · 8) / 2 = 16 birimkare." },
        { soruNo: 5, kazanimKodu: "MAT.9.1.3", konu: "Mutlak Değer", puan: 20, metin: "|2x − 4| = 10 denkleminin kökler toplamı kaçtır?", ipucu: "2x − 4 = 10 ve 2x − 4 = −10 denklemlerini çöz.", beklenenSonuc: ["4"], yontemAnahtar: ["7", "-3", "4"], cozumAdimlari: "x₁ = 7 ve x₂ = −3.\nKökler toplamı: 7 + (−3) = 4." }
      ]
    },
    "10": {
      "1_donem_1_yazili": [
        { soruNo: 1, kazanimKodu: "MAT.10.1.1", konu: "Permütasyon", puan: 25, metin: "P(6, 2) + 4! işleminin sonucunu bulunuz.", ipucu: "P(6,2) = 6·5 = 30 ve 4! = 24.", beklenenSonuc: ["54"], yontemAnahtar: ["30", "24", "54"], cozumAdimlari: "30 + 24 = 54." },
        { soruNo: 2, kazanimKodu: "MAT.10.1.2", konu: "Kombinasyon", puan: 25, metin: "4 kız ve 5 erkek arasından 2 kız, 1 erkekten oluşan 3 kişilik ekip kaç farklı şekilde seçilebilir?", ipucu: "C(4,2) × C(5,1).", beklenenSonuc: ["30"], yontemAnahtar: ["6", "5", "30"], cozumAdimlari: "6 × 5 = 30." },
        { soruNo: 3, kazanimKodu: "MAT.10.1.3", konu: "Binom Açılımı", puan: 25, metin: "(x + 2)⁴ açılımında x²'li terimin katsayısı kaçtır?", ipucu: "C(4,2) · x² · 2².", beklenenSonuc: ["24"], yontemAnahtar: ["6", "4", "24"], cozumAdimlari: "6 · 4 = 24." },
        { soruNo: 4, kazanimKodu: "MAT.10.2.1", konu: "Pisagor & Alan", puan: 25, metin: "Hipotenüsü 13 cm ve bir dik kenarı 5 cm olan dik üçgenin alanı kaç cm²'dir?", ipucu: "5-12-13 özel üçgeninden diğer dik kenar 12 cm.", beklenenSonuc: ["30"], yontemAnahtar: ["12", "30"], cozumAdimlari: "Alan = (5 · 12) / 2 = 30 cm²." }
      ]
    },
    "11": {
      "1_donem_1_yazili": [
        { soruNo: 1, kazanimKodu: "MAT.11.1.1", konu: "Esas Ölçü", puan: 25, metin: "1150°'lik açının esas ölçüsü kaç derecedir?", ipucu: "1150'yi 360'a böl ve kalanı bul.", beklenenSonuc: ["70", "70 derece"], yontemAnahtar: ["1080", "70"], cozumAdimlari: "1150 − 3·360 = 70°." },
        { soruNo: 2, kazanimKodu: "MAT.11.1.2", konu: "Trigonometrik Özdeşlik", puan: 25, metin: "sin x + cos x = 1/2 ise sin x · cos x çarpımının değerini bulunuz.", ipucu: "İki tarafın karesini al ve sin²x + cos²x = 1 kullan.", beklenenSonuc: ["-3/8"], yontemAnahtar: ["1/4", "-3/4", "-3/8"], cozumAdimlari: "1 + 2sinx·cosx = 1/4 ⇒ sinx·cosx = −3/8." },
        { soruNo: 3, kazanimKodu: "MAT.11.2.1", konu: "İki Nokta Uzaklığı", puan: 25, metin: "A(−1, 2) ve B(5, 10) noktaları arasındaki uzaklık kaç birimdir?", ipucu: "√[(5−(−1))² + (10−2)²].", beklenenSonuc: ["10"], yontemAnahtar: ["6", "8", "10"], cozumAdimlari: "√(36 + 64) = √100 = 10 birim." },
        { soruNo: 4, kazanimKodu: "MAT.11.2.2", konu: "Doğru Eğimi", puan: 25, metin: "2x − 3y + 6 = 0 doğrusuna dik olan bir doğrunun eğimi kaçtır?", ipucu: "m₁ = 2/3 ve m₁ · m₂ = −1.", beklenenSonuc: ["-3/2"], yontemAnahtar: ["2/3", "-1", "-3/2"], cozumAdimlari: "m₂ = −3/2." }
      ]
    },
    "12": {
      "1_donem_1_yazili": [
        { soruNo: 1, kazanimKodu: "MAT.12.1.1", konu: "Logaritma", puan: 25, metin: "log₂(32) + log₃(27) − log₅(1) işleminin sonucunu bulunuz.", ipucu: "32 = 2⁵, 27 = 3³, log(1) = 0.", beklenenSonuc: ["8"], yontemAnahtar: ["5", "3", "0", "8"], cozumAdimlari: "5 + 3 − 0 = 8." },
        { soruNo: 2, kazanimKodu: "MAT.12.1.2", konu: "Logaritmik Denklem", puan: 25, metin: "log₃(x − 2) = 2 denklemini sağlayan x değeri kaçtır?", ipucu: "x − 2 = 3².", beklenenSonuc: ["11", "x=11"], yontemAnahtar: ["9", "11"], cozumAdimlari: "x − 2 = 9 ⇒ x = 11." },
        { soruNo: 3, kazanimKodu: "MAT.12.2.1", konu: "Aritmetik Dizi", puan: 25, metin: "İlk terimi 4 ve ortak farkı 3 olan aritmetik dizinin 10. terimi kaçtır?", ipucu: "a₁₀ = a₁ + 9d.", beklenenSonuc: ["31"], yontemAnahtar: ["27", "31"], cozumAdimlari: "a₁₀ = 4 + 9·3 = 31." },
        { soruNo: 4, kazanimKodu: "MAT.12.2.2", konu: "Geometrik Dizi", puan: 25, metin: "İlk terimi 2 ve ortak çarpanı 3 olan geometrik dizinin 4. terimi kaçtır?", ipucu: "a₄ = a₁ · r³.", beklenenSonuc: ["54"], yontemAnahtar: ["27", "54"], cozumAdimlari: "a₄ = 2 · 3³ = 54." }
      ]
    }
  };

  function getSorular(grade, donem, senaryoNo) {
    var g = String(grade || "5");
    var gradePool = HAVUZ[g] || HAVUZ["5"];
    var list = gradePool[donem] || gradePool["1_donem_1_yazili"] || Object.values(gradePool)[0];
    var cloned = list.map(function (q, idx) {
      return Object.assign({}, q, { soruNo: idx + 1 });
    });
    // Senaryo 2 veya 3 seçildiğinde soru sırasını ve etiketini çeşitlendir (toplam 100 puan korunur)
    if (Number(senaryoNo) === 2 && cloned.length > 2) {
      cloned = cloned.slice(1).concat(cloned.slice(0, 1)).map(function (q, i) { return Object.assign({}, q, { soruNo: i + 1 }); });
    } else if (Number(senaryoNo) === 3 && cloned.length > 3) {
      cloned = cloned.slice().reverse().map(function (q, i) { return Object.assign({}, q, { soruNo: i + 1 }); });
    }
    return cloned;
  }

  global.ZARIF_YAZILI_HAVUZU = {
    DONEMLER: DONEMLER,
    SENARYOLAR: SENARYOLAR,
    getSorular: getSorular
  };
})(window);
