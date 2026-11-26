/* ==========================================================================
   ZarifÇözüm — 5–12. Sınıf MEB Türkiye Yüzyılı Maarif Modeli Müfredat Verileri
   Her sınıfta 6 konu (İlk 2 konu ücretsiz: özet, püf noktası/formül, günlük hayat,
   2 adım adım örnek; 3–6. konular kilitli) + Her sınıf için 5 soruluk mini test
   (5–8. sınıflar 4 şıklı, 9–12. sınıflar 5 şıklı, adım adım çözümlü).
   ========================================================================== */
(function (global) {
  "use strict";

  var MUFREDAT_VERILERI = {
    "5": {
      sinif: "5",
      baslik: "5. Sınıf Matematik",
      mufredatEtiketi: "MEB Türkiye Yüzyılı Maarif Modeli • 5. Sınıf",
      sikSayisi: 4,
      konular: [
        {
          id: "5-1",
          ucretsiz: true,
          baslik: "Çok Basamaklı Doğal Sayılar ve Bölükler",
          kazanim: "Milyonlu sayıları okuma, basamak değeri ve çözümleme.",
          ozet: "7, 8 ve 9 basamaklı doğal sayıları kolay okuyup yazabilmek için rakamlar sağdan sola doğru üçerli gruplara (bölüklere) ayrılır: Birler Bölüğü, Binler Bölüğü ve Milyonlar Bölüğü. Her rakamın bulunduğu basamağa göre aldığı değere basamak değeri denir.",
          pufNoktasi: [
            { baslik: "Bölük Dizilimi", formul: "Milyonlar | Binler | Birler", aciklama: "Her bölükte en fazla 3 rakam bulunur; okurken bölük adı söylenir (birler bölüğü hariç)." },
            { baslik: "Basamak Değeri", formul: "Basamak Değeri = Rakam × Basamak Adı", aciklama: "Örn: 45 308 120 sayısında 3'ün basamak değeri 300 000'dir." }
          ],
          gunlukHayat: {
            baslik: "🌍 Günlük Hayattan Örnek: Türkiye Nüfusu ve Stadyum Kapasitesi",
            metin: "Bir ülkenin nüfusu '85 372 377' şeklinde yazıldığında bölükler sayesinde bir bakışta 'Seksen beş milyon üç yüz yetmiş iki bin üç yüz yetmiş yedi' diye okuyabiliriz."
          },
          ornekler: [
            {
              soru: "64 075 819 sayısının binler bölüğündeki rakamların sayı değerleri toplamı ile milyonlar bölüğündeki sayının farkı kaçtır?",
              adimlar: [
                "Sayıyı bölüklere ayıralım: 64 (Milyonlar) | 075 (Binler) | 819 (Birler).",
                "Binler bölüğündeki rakamların sayı değerleri toplamı: 0 + 7 + 5 = 12.",
                "Milyonlar bölüğündeki sayı 64'tür. Farkı: 64 − 12 = 52."
              ],
              cevap: "52"
            },
            {
              soru: "Okunuşu 'Otuz iki milyon dört yüz bin yetmiş beş' olan sayının yüz binler ve onlar basamağındaki rakamların basamak değerleri toplamı kaçtır?",
              adimlar: [
                "Sayıyı bölüklere göre yazalım: 32 400 075.",
                "Yüz binler basamağında 4 vardır → 4 × 100 000 = 400 000.",
                "Onlar basamağında 7 vardır → 7 × 10 = 70. Toplam: 400 070."
              ],
              cevap: "400 070"
            }
          ]
        },
        {
          id: "5-2",
          ucretsiz: true,
          baslik: "Kesirler ve Denk Kesir Modelleri",
          kazanim: "Birim kesirler, tam sayılı kesirler ve sayı doğrusunda gösterim.",
          ozet: "Bir bütünün eş parçalarından yalnızca birini gösteren kesirlere birim kesir (1/2, 1/5, 1/8) denir. Payı ve paydası sıfırdan farklı aynı doğal sayı ile çarpıldığında (genişletme) veya bölündüğünde (sadeleştirme) kesrin değeri değişmez; denk kesirler elde edilir.",
          pufNoktasi: [
            { baslik: "Birim Kesir Karşılaştırma", formul: "Payda büyüdükçe birim kesir küçülür", aciklama: "Örn: 1/3 > 1/5 > 1/10 (Bütün ne kadar çok parçaya bölünürse her parça o kadar küçülür)." },
            { baslik: "Denk Kesir Kuralı", formul: "a / b = (a · k) / (b · k)", aciklama: "Örn: 2/3 kesrini 4 ile genişletirsek 8/12 denk kesrini elde ederiz." }
          ],
          gunlukHayat: {
            baslik: "🍕 Günlük Hayattan Örnek: Pizza Dilimleri",
            metin: "Aynı boyuttaki bir pizzanın yarısını (1/2) yemekle, 8 eş dilime bölünmüş aynı pizzadan 4 dilim (4/8) yemek tamamen aynı miktardır. Çünkü 1/2 ve 4/8 denk kesirlerdir."
          },
          ornekler: [
            {
              soru: "3/4 kesrine denk olan ve paydası 20 olan kesrin payı kaçtır?",
              adimlar: [
                "Payda 4'ten 20'ye çıkmış: 20 ÷ 4 = 5 (kesir 5 ile genişletilmiş).",
                "Payı da aynı sayıyla çarpalım: 3 × 5 = 15.",
                "Denk kesir 15/20 olduğundan pay 15'tir."
              ],
              cevap: "15"
            },
            {
              soru: "17/5 bileşik kesrini tam sayılı kesre dönüştürünüz.",
              adimlar: [
                "Payı paydaya bölelim: 17 ÷ 5 = 3 (bölüm) ve kalan = 2.",
                "Bölüm tam kısma, kalan paya, bölen paydaya yazılır.",
                "Sonuç: 3 tam 2/5."
              ],
              cevap: "3 tam 2/5"
            }
          ]
        },
        { id: "5-3", ucretsiz: false, baslik: "Ondalık Gösterim ve Yüzdeler", kazanim: "Paydası 10, 100, 1000 olan kesirlerin ondalık ve yüzde (%) gösterimi ile günlük yaşam problemleri." },
        { id: "5-4", ucretsiz: false, baslik: "Temel Geometrik Kavramlar ve Açılar", kazanim: "Doğru, ışın, doğru parçası, dar-dik-geniş açılar ve açı ölçer kullanımı." },
        { id: "5-5", ucretsiz: false, baslik: "Üçgen ve Dörtgenlerin Çevresi", kazanim: "Çokgenlerin temel elemanları, üçgen çeşitleri ve çevre uzunluğu hesaplama." },
        { id: "5-6", ucretsiz: false, baslik: "Veri Toplama ve Değerlendirme", kazanim: "Araştırma sorusu oluşturma, sıklık tablosu ve sütun grafiği yorumlama." }
      ],
      miniTest: [
        {
          konu: "Çok Basamaklı Doğal Sayılar",
          soru: "Bir kütüphane arşivinde 'Yedi milyon kırk beş bin dokuz' kitap kaydı vardır. Bu sayının rakamla yazılışı hangisidir?",
          siklar: ["7 450 009", "7 045 009", "7 045 090", "70 045 009"],
          dogru: 1,
          cozumAdimlari: [
            "Milyonlar bölüğü: 7",
            "Binler bölüğü: 045 (üç basamak tamamlamak için başına 0 konur)",
            "Birler bölüğü: 009 → Birleştirince 7 045 009 elde edilir."
          ]
        },
        {
          konu: "Çok Basamaklı Doğal Sayılar",
          soru: "48 632 510 sayısındaki 6 rakamının basamak değeri kaçtır?",
          siklar: ["6 000", "60 000", "600 000", "6 000 000"],
          dogru: 2,
          cozumAdimlari: [
            "Bölükleri ayıralım: 48 | 632 | 510.",
            "6 rakamı yüz binler basamağında yer alır.",
            "Basamak değeri: 6 × 100 000 = 600 000."
          ]
        },
        {
          konu: "Kesirler ve Denk Kesirler",
          soru: "Eşit büyüklükteki 4 pastadan Ali 1/3'ünü, Ece 1/6'sını, Mert 1/2'sini ve Zeynep 1/5'ini yemiştir. En fazla pasta yiyen kimdir?",
          siklar: ["Ali", "Ece", "Mert", "Zeynep"],
          dogru: 2,
          cozumAdimlari: [
            "Tüm kesirler birim kesirdir (payları 1).",
            "Birim kesirlerde paydası en küçük olan kesir en büyüktür.",
            "2 < 3 < 5 < 6 olduğundan 1/2 en büyüktür (Mert)."
          ]
        },
        {
          konu: "Kesirler ve Denk Kesirler",
          soru: "18/24 kesrinin en sade hali aşağıdakilerden hangisidir?",
          siklar: ["2/3", "3/4", "4/6", "9/12"],
          dogru: 1,
          cozumAdimlari: [
            "18 ve 24 sayılarının ikisini de bölen en büyük sayı 6'dır.",
            "18 ÷ 6 = 3 ve 24 ÷ 6 = 4.",
            "En sade denk kesir 3/4 olur."
          ]
        },
        {
          konu: "Kesirler ve Denk Kesirler",
          soru: "2 tam 3/4 kesrinin bileşik kesir olarak yazılışı hangisidir?",
          siklar: ["9/4", "10/4", "11/4", "14/4"],
          dogru: 2,
          cozumAdimlari: [
            "Tam kısım ile payda çarpılır: 2 × 4 = 8.",
            "Çıkan sonuca pay eklenir: 8 + 3 = 11.",
            "Payda aynen yazılır: 11/4."
          ]
        }
      ]
    },

    "6": {
      sinif: "6",
      baslik: "6. Sınıf Matematik",
      mufredatEtiketi: "MEB Türkiye Yüzyılı Maarif Modeli • 6. Sınıf",
      sikSayisi: 4,
      konular: [
        {
          id: "6-1",
          ucretsiz: true,
          baslik: "Çarpanlar, Katlar ve Bölünebilme Kuralları",
          kazanim: "Asal sayılar, asal çarpanlara ayırma ve 2, 3, 4, 5, 9, 10 ile bölünebilme.",
          ozet: "Bir doğal sayıyı kalansız bölen her doğal sayı o sayının çarpanıdır. 1'den büyük olup sadece 1'e ve kendisine bölünebilen sayılara asal sayı denir. Bölünebilme kuralları sayesinde büyük sayıları bölme işlemi yapmadan test edebiliriz.",
          pufNoktasi: [
            { baslik: "3 ve 9 ile Bölünebilme", formul: "Rakamlar Toplamı = 3k (veya 9k)", aciklama: "Örn: 738 → 7+3+8=18 olduğundan hem 3'e hem 9'a tam bölünür." },
            { baslik: "4 ile Bölünebilme", formul: "Son iki basamak 00 veya 4'ün katı", aciklama: "Örn: 5 124 sayısının son iki basamağı 24, 4'ün katıdır." }
          ],
          gunlukHayat: {
            baslik: "🚌 Günlük Hayattan Örnek: Otobüs Sefer Saatleri",
            metin: "Biri 15 dakikada, diğeri 20 dakikada bir kalkan iki belediye otobüsü aynı anda duraktan ayrıldıktan sonra ilk kez 60 dakika (ortak kat) sonra tekrar birlikte hareket eder."
          },
          ornekler: [
            {
              soru: "5A4 üç basamaklı sayısı 9 ile kalansız bölünebildiğine göre A rakamı kaçtır?",
              adimlar: [
                "9 ile bölünebilme kuralı gereği rakamlar toplamı 9'un katı olmalıdır.",
                "5 + A + 4 = 9 + A.",
                "A bir rakam olduğundan 0 veya 9 olabilir (en küçük pozitif/tek rakam incelemesinde 0 ve 9)."
              ],
              cevap: "A = 0 veya A = 9"
            },
            {
              soru: "60 sayısını asal çarpanlarının çarpımı şeklinde yazınız.",
              adimlar: [
                "60 ÷ 2 = 30, 30 ÷ 2 = 15.",
                "15 ÷ 3 = 5, 5 ÷ 5 = 1.",
                "Üslü gösterim: 60 = 2² · 3 · 5."
              ],
              cevap: "2² · 3 · 5"
            }
          ]
        },
        {
          id: "6-2",
          ucretsiz: true,
          baslik: "Tam Sayılar ve Mutlak Değer",
          kazanim: "Pozitif-negatif tam sayılar, yönlü sayılar ve sıfıra olan uzaklık.",
          ozet: "Sıfırın üstündeki/sağındaki değerler pozitif (+), sıfırın altındaki/solundaki değerler negatif (−) tam sayılarla ifade edilir. Bir tam sayının sayı doğrusunda 0'a (başlangıç noktasına) olan uzaklığına mutlak değer denir ve |a| ile gösterilir.",
          pufNoktasi: [
            { baslik: "Mutlak Değer Kuralı", formul: "|−a| = +a   ve   |0| = 0", aciklama: "Uzaklık negatif olamayacağı için mutlak değer sonucu asla eksi çıkmaz." },
            { baslik: "Sıralama Kuralı", formul: "Sayı doğrusunda sağdaki her zaman büyüktür", aciklama: "Örn: −3 > −10 (Çünkü −3, 0'a daha yakındır)." }
          ],
          gunlukHayat: {
            baslik: "🌡️ Günlük Hayattan Örnek: Termometre ve Asansör",
            metin: "Kışın Erzurum'da sıcaklığın sıfırın altında 8 derece olması −8°C, bir binada zemin katın 2 kat altındaki otopark ise −2. kat olarak gösterilir."
          },
          ornekler: [
            {
              soru: "−12, +4, −3, 0, |−9| sayılarını küçükten büyüğe doğru sıralayınız.",
              adimlar: [
                "Önce mutlak değeri hesaplayalım: |−9| = +9.",
                "Negatif sayılar soldadır: −12 < −3 < 0.",
                "Pozitif sayıları ekleyelim: −12 < −3 < 0 < +4 < |−9|."
              ],
              cevap: "−12 < −3 < 0 < +4 < |−9|"
            },
            {
              soru: "|x| = 7 eşitliğini sağlayan x tam sayılarının sayı doğrusu üzerindeki aralarındaki uzaklık kaç birimdir?",
              adimlar: [
                "0'a uzaklığı 7 birim olan iki tam sayı vardır: x = −7 ve x = +7.",
                "−7'den 0'a 7 birim, 0'dan +7'ye 7 birim uzaklık vardır.",
                "Toplam uzaklık: 7 + 7 = 14 birim."
              ],
              cevap: "14 birim"
            }
          ]
        },
        { id: "6-3", ucretsiz: false, baslik: "Kesirlerle İşlemler", kazanim: "Kesirlerle toplama, çıkarma, çarpma, bölme ve çok adımlı gerçek yaşam problemleri." },
        { id: "6-4", ucretsiz: false, baslik: "Oran ve Birimli Oran", kazanim: "İki çokluğun birbirine oranı, birimli ve birimsiz oran kavramları." },
        { id: "6-5", ucretsiz: false, baslik: "Cebirsel İfadeler", kazanim: "Değişken, katsayı, sabit terim ve sözel ifadeyi cebirsel olarak yazma." },
        { id: "6-6", ucretsiz: false, baslik: "Alan Ölçme (Paralelkenar ve Üçgen)", kazanim: "Üçgen ve paralelkenarın yüksekliklerini çizme ve alan bağıntılarını kullanma." }
      ],
      miniTest: [
        {
          konu: "Çarpanlar ve Bölünebilme",
          soru: "34A üç basamaklı sayısı hem 2 hem de 3 ile kalansız bölünebildiğine göre A yerine yazılabilecek en büyük rakam kaçtır?",
          siklar: ["2", "5", "6", "8"],
          dogru: 3,
          cozumAdimlari: [
            "2 ile bölünebildiği için A çift olmalıdır: {0, 2, 4, 6, 8}.",
            "3 ile bölünebilme: 3 + 4 + A = 7 + A sayısı 3'ün katı olmalı → A ∈ {2, 5, 8}.",
            "İki koşulu sağlayan çift rakamlar 2 ve 8'dir. En büyüğü 8'dir."
          ]
        },
        {
          konu: "Asal Sayılar",
          soru: "42 sayısının kaç tane farklı asal çarpanı vardır?",
          siklar: ["2", "3", "4", "6"],
          dogru: 1,
          cozumAdimlari: [
            "42'yi asal çarpanlarına ayıralım: 42 = 2 × 21 = 2 × 3 × 7.",
            "Farklı asal çarpanlar: 2, 3 ve 7.",
            "Toplam 3 farklı asal çarpanı vardır."
          ]
        },
        {
          konu: "Tam Sayılar",
          soru: "Bir denizaltı deniz seviyesinin 35 metre altında, bir martı ise deniz seviyesinin 12 metre üstündedir. İkisi arasındaki dikey uzaklık kaç metredir?",
          siklar: ["23", "35", "47", "52"],
          dogru: 2,
          cozumAdimlari: [
            "Denizaltının konumu: −35 m, martının konumu: +12 m.",
            "Deniz seviyesine uzaklıkları toplarız: |−35| + |+12| = 35 + 12.",
            "Toplam dikey uzaklık 47 metredir."
          ]
        },
        {
          konu: "Mutlak Değer",
          soru: "|−15| − |+6| + |−2| işleminin sonucu kaçtır?",
          siklar: ["7", "11", "19", "23"],
          dogru: 1,
          cozumAdimlari: [
            "Mutlak değerleri bulalım: |−15| = 15, |+6| = 6, |−2| = 2.",
            "İşlemi sırayla yapalım: 15 − 6 = 9.",
            "9 + 2 = 11."
          ]
        },
        {
          konu: "Tam Sayıları Sıralama",
          soru: "−6 ile +4 arasında kaç tane tam sayı vardır?",
          siklar: ["8", "9", "10", "11"],
          dogru: 1,
          cozumAdimlari: [
            "−6 ve +4 dahil değildir.",
            "Aradaki tam sayılar: −5, −4, −3, −2, −1, 0, +1, +2, +3.",
            "Sayıldığında toplam 9 tam sayı vardır."
          ]
        }
      ]
    },

    "7": {
      sinif: "7",
      baslik: "7. Sınıf Matematik",
      mufredatEtiketi: "MEB Türkiye Yüzyılı Maarif Modeli • 7. Sınıf",
      sikSayisi: 4,
      konular: [
        {
          id: "7-1",
          ucretsiz: true,
          baslik: "Tam Sayılarla Çarpma ve Bölme İşlemleri",
          kazanim: "İşaret kuralları, işlem önceliği ve tam sayı problemleri.",
          ozet: "Tam sayılarla çarpma ve bölme yaparken önce işaretler belirlenir: Aynı işaretli iki tam sayının çarpımı/bölümü pozitif (+), zıt işaretli iki tam sayının çarpımı/bölümü negatiftir (−). Çok adımlı işlemlerde parantez, üs, çarpma/bölme ve toplama/çıkarma sırası izlenir.",
          pufNoktasi: [
            { baslik: "İşaret Çarpım Tablosu", formul: "(+)(+) = +  |  (−)(−) = +  |  (+)(−) = −", aciklama: "Aynı işaretler dost (+), farklı işaretler düşman (−) kuralıyla kolayca hatırlanır." },
            { baslik: "Negatif Tabanlı Üs", formul: "(−2)⁴ = +16  ama  −2⁴ = −16", aciklama: "Parantez dışındaki çift kuvvet işareti pozitif yapar." }
          ],
          gunlukHayat: {
            baslik: "🏔️ Günlük Hayattan Örnek: Yükseklik ve Sıcaklık Değişimi",
            metin: "Her 200 metre yukarı çıkıldığında hava sıcaklığı 1°C düşüyorsa (−1°C), 1000 metre tırmanan bir dağcı 5 × (−1) = −5°C sıcaklık değişimi yaşar."
          },
          ornekler: [
            {
              soru: "(−4) · (+6) + (−24) ÷ (−3) işleminin sonucu kaçtır?",
              adimlar: [
                "Önce çarpma ve bölme işlemlerini yapalım: (−4) · (+6) = −24.",
                "Bölme: (−24) ÷ (−3) = +8 (aynı işaretli olduğundan pozitif).",
                "Toplama: (−24) + (+8) = −16."
              ],
              cevap: "−16"
            },
            {
              soru: "(−3)² − (−2)³ işleminin sonucu kaçtır?",
              adimlar: [
                "(−3)² = (−3)·(−3) = +9.",
                "(−2)³ = (−2)·(−2)·(−2) = −8.",
                "(+9) − (−8) = 9 + 8 = +17."
              ],
              cevap: "+17"
            }
          ]
        },
        {
          id: "7-2",
          ucretsiz: true,
          baslik: "Rasyonel Sayılar ve Sayı Doğrusu",
          kazanim: "Rasyonel sayıları sıralama ve ondalık gösterimle ilişkilendirme.",
          ozet: "a ve b tam sayı, b ≠ 0 olmak üzere a/b şeklinde yazılabilen sayılara rasyonel sayılar (ℚ) denir. Her tam sayı paydası 1 olan bir rasyonel sayıdır. Negatif rasyonel sayıları sıralarken önce pozitif gibi sıralayıp ardından yönü tersine çeviririz.",
          pufNoktasi: [
            { baslik: "Negatif Sıralama", formul: "1/2 > 1/3  ⇒  −1/2 < −1/3", aciklama: "Negatif sayılarda sıfıra yakın olan sayı her zaman daha büyüktür." },
            { baslik: "Ondalık Dönüşüm", formul: "Paydayı 10, 100 veya 1000 yap", aciklama: "Örn: −3/4 = −75/100 = −0,75." }
          ],
          gunlukHayat: {
            baslik: "⚖️ Günlük Hayattan Örnek: Hassas Ölçümler",
            metin: "Mutfak terazisinde 0,25 kg (1/4 kg) un veya hava durumunda −1,5°C (−3/2°C) ölçümü günlük hayatta kullandığımız rasyonel sayılardır."
          },
          ornekler: [
            {
              soru: "−2/3, −5/6 ve −1/2 rasyonel sayılarını küçükten büyüğe sıralayınız.",
              adimlar: [
                "Paydaları 6'da eşitleyelim: −4/6, −5/6 ve −3/6.",
                "Payı en küçük (sıfırdan en uzak negatif) olan −5/6 en küçüktür.",
                "Sıralama: −5/6 < −2/3 < −1/2."
              ],
              cevap: "−5/6 < −2/3 < −1/2"
            },
            {
              soru: "−7/4 rasyonel sayısının ondalık gösterimini bulunuz.",
              adimlar: [
                "Paydayı 100 yapmak için 25 ile genişletelim: (−7 × 25) / (4 × 25) = −175/100.",
                "Ondalık biçimde yazalım: −1,75."
              ],
              cevap: "−1,75"
            }
          ]
        },
        { id: "7-3", ucretsiz: false, baslik: "Birinci Dereceden Bir Bilinmeyenli Denklemler", kazanim: "Eşitliğin korunumu ilkesiyle denklem kurma ve çözme." },
        { id: "7-4", ucretsiz: false, baslik: "Oran-Orantı ve Yüzde Problemleri", kazanim: "Doğru ve ters orantı, kâr-zarar, indirim ve faizsiz yüzde hesaplamaları." },
        { id: "7-5", ucretsiz: false, baslik: "Doğrular ve Açılar", kazanim: "Açıortay, paralel iki doğrunun bir kesenle yaptığı açılar ve çokgenler." },
        { id: "7-6", ucretsiz: false, baslik: "Çember ve Daire", kazanim: "Merkez açı, çember parçası uzunluğu ve daire diliminin alanı." }
      ],
      miniTest: [
        {
          konu: "Tam Sayılarla İşlemler",
          soru: "Bir derin dondurucunun sıcaklığı her saatte 3°C düşmektedir. Başlangıçta +4°C olan dondurucu 5 saat sonra kaç °C olur?",
          siklar: ["−11°C", "−15°C", "−19°C", "+19°C"],
          dogru: 0,
          cozumAdimlari: [
            "5 saatteki toplam değişim: 5 × (−3) = −15°C.",
            "Başlangıç sıcaklığına ekleyelim: (+4) + (−15) = −11°C."
          ]
        },
        {
          konu: "Tam Sayılarla İşlemler",
          soru: "[(−18) ÷ (+3)] · (−2) işleminin sonucu kaçtır?",
          siklar: ["−12", "−6", "+6", "+12"],
          dogru: 3,
          cozumAdimlari: [
            "Köşeli parantez içi: (−18) ÷ (+3) = −6.",
            "Şimdi çarpma: (−6) · (−2) = +12 (iki negatifin çarpımı pozitiftir)."
          ]
        },
        {
          konu: "Tam Sayılarda Kuvvet",
          soru: "(−1)¹⁰ + (−2)³ işleminin sonucu kaçtır?",
          siklar: ["−9", "−7", "+7", "+9"],
          dogru: 1,
          cozumAdimlari: [
            "(−1)¹⁰ = +1 (çift kuvvet).",
            "(−2)³ = −8 (tek kuvvet).",
            "(+1) + (−8) = −7."
          ]
        },
        {
          konu: "Rasyonel Sayılar",
          soru: "Sayı doğrusunda −2 ile −1 arası 4 eş parçaya bölünmüştür. −1'in hemen solundaki ilk nokta hangi rasyonel sayıdır?",
          siklar: ["−5/4", "−7/4", "−3/4", "−1/4"],
          dogru: 0,
          cozumAdimlari: [
            "−1'den sola doğru her adım −1/4 kadardır.",
            "−1 = −4/4 olduğuna göre bir adım sol: −4/4 − 1/4 = −5/4."
          ]
        },
        {
          konu: "Rasyonel Sayılar",
          soru: "Aşağıdaki rasyonel sayılardan hangisi en büyüktür?",
          siklar: ["−1/2", "−1/3", "−1/4", "−1/5"],
          dogru: 3,
          cozumAdimlari: [
            "Pozitif olsalardı 1/2 > 1/3 > 1/4 > 1/5 olurdu.",
            "Negatif oldukları için sıralama ters döner: −1/5 > −1/4 > −1/3 > −1/2.",
            "0'a en yakın olan −1/5 en büyüktür."
          ]
        }
      ]
    },

    "8": {
      sinif: "8",
      baslik: "8. Sınıf Matematik (LGS)",
      mufredatEtiketi: "MEB Müfredatı & LGS Yeni Nesil Hazırlık • 8. Sınıf",
      sikSayisi: 4,
      konular: [
        {
          id: "8-1",
          ucretsiz: true,
          baslik: "EBOB - EKOK ve Aralarında Asal Sayılar",
          kazanim: "LGS tarzı periyodik problem kurguları ve asal çarpan algoritması.",
          ozet: "İki sayıyı bölen en büyük sayı EBOB (bütünden eş parçalara bölme problemleri), iki sayının ortak katlarının en küçüğü EKOK (parçadan bütüne / nöbet / zil problemleri) olarak kullanılır. 1'den başka ortak böleni olmayan sayılar aralarında asaldır.",
          pufNoktasi: [
            { baslik: "Altın Eşitlik", formul: "EBOB(a, b) · EKOK(a, b) = a · b", aciklama: "Aralarında asal sayılarda EBOB = 1 ve EKOK = a · b olur." },
            { baslik: "LGS İpucu", formul: "Parçala → EBOB   |   Birleştir/Tekrarla → EKOK", aciklama: "Eşit aralıklı ağaç dikme veya bidonlara paylaştırma EBOB; birlikte çalan ziller EKOK sorusudur." }
          ],
          gunlukHayat: {
            baslik: "🏥 Günlük Hayattan Örnek: Hastane Nöbet Çizelgesi",
            metin: "Bir doktor 6 günde bir, diğer doktor 8 günde bir nöbet tutuyorsa; birlikte nöbet tuttuktan sonra EKOK(6, 8) = 24 gün sonra tekrar aynı gün nöbet tutarlar."
          },
          ornekler: [
            {
              soru: "48 litre zeytinyağı ve 60 litre ayçiçek yağı birbirine karıştırılmadan eşit hacimli en büyük şişelere doldurulacaktır. En az kaç şişe gerekir?",
              adimlar: [
                "Bütünden eş parçalara bölündüğü için EBOB(48, 60) bulunur.",
                "EBOB(48, 60) = 12 litre (her şişenin hacmi).",
                "Şişe sayısı: (48 ÷ 12) + (60 ÷ 12) = 4 + 5 = 9 şişe."
              ],
              cevap: "9 şişe"
            },
            {
              soru: "Aralarında asal iki sayının EKOK'u 72 ve sayılardan biri 8 ise diğer sayı kaçtır?",
              adimlar: [
                "Aralarında asal sayıların EKOK'u çarpımlarına eşittir: a · b = 72.",
                "8 · b = 72 ⇒ b = 72 ÷ 8 = 9.",
                "8 ve 9 ardışık olduklarından aralarında asaldır."
              ],
              cevap: "9"
            }
          ]
        },
        {
          id: "8-2",
          ucretsiz: true,
          baslik: "Üslü İfadeler ve Bilimsel Gösterim",
          kazanim: "Negatif üs, üssün üssü ve çok büyük/küçük sayıların bilimsel gösterimi.",
          ozet: "Negatif üs tabanı çarpmaya göre ters çevirir (a⁻ⁿ = 1/aⁿ). Bilimsel gösterimde sayı a · 10ⁿ biçiminde yazılır ve 1 ≤ |a| < 10 şartını mutlaka sağlar.",
          pufNoktasi: [
            { baslik: "Üssün Üssü & Çarpma", formul: "(aᵐ)ⁿ = aᵐ·ⁿ   |   aᵐ · aⁿ = aᵐ⁺ⁿ", aciklama: "Tabanlar aynıysa bölmede üsler çıkarılır: aᵐ / aⁿ = aᵐ⁻ⁿ." },
            { baslik: "Bilimsel Gösterim", formul: "a · 10ⁿ   (1 ≤ a < 10)", aciklama: "Virgül sola kayarsa 10'un üssü artar, sağa kayarsa azalır." }
          ],
          gunlukHayat: {
            baslik: "🔭 Günlük Hayattan Örnek: Dünya–Güneş Uzaklığı ve Virüs Boyutu",
            metin: "Dünya ile Güneş arası yaklaşık 150 000 000 km = 1,5 · 10⁸ km; bir mikroorganizmanın çapı ise 0,000003 m = 3 · 10⁻⁶ m olarak bilimsel gösterimle ifade edilir."
          },
          ornekler: [
            {
              soru: "(8⁴ · 4⁻³) / 2⁵ işleminin sonucu kaçtır?",
              adimlar: [
                "Tüm sayıları 2 tabanına çevirelim: 8⁴ = (2³)⁴ = 2¹² ve 4⁻³ = (2²)⁻³ = 2⁻⁶.",
                "Pay: 2¹² · 2⁻⁶ = 2⁶.",
                "Bölme: 2⁶ / 2⁵ = 2¹ = 2."
              ],
              cevap: "2"
            },
            {
              soru: "0,00032 · 10⁷ sayısının bilimsel gösterimini yazınız.",
              adimlar: [
                "0,00032 sayısını 3,2 yapmak için virgülü 4 basamak sağa kaydırırız.",
                "Virgül 4 sağa kaydığı için 10'un üssü 4 azalır: 7 − 4 = 3.",
                "Sonuç: 3,2 · 10³."
              ],
              cevap: "3,2 · 10³"
            }
          ]
        },
        { id: "8-3", ucretsiz: false, baslik: "Kareköklü İfadeler", kazanim: "Tam kare sayılar, a√b gösterimi, kareköklü sayılarla dört işlem ve gerçek sayılar." },
        { id: "8-4", ucretsiz: false, baslik: "Veri Analizi ve Olasılık", kazanim: "Çizgi, sütun, daire grafiği dönüşümleri ve basit olayların olma olasılığı." },
        { id: "8-5", ucretsiz: false, baslik: "Cebirsel İfadeler ve Özdeşlikler", kazanim: "İki kare farkı, tam kare özdeşlikleri ve çarpanlara ayırma." },
        { id: "8-6", ucretsiz: false, baslik: "Doğrusal Denklemler ve Eğim", kazanim: "Koordinat sistemi, doğrusal ilişki grafikleri ve eğim problemleri." }
      ],
      miniTest: [
        {
          konu: "EBOB - EKOK",
          soru: "İki zil sırasıyla 18 ve 24 dakikada bir çalmaktadır. İlk kez saat 08.00'de birlikte çalan bu iki zil, ikinci kez saat kaçta birlikte çalar?",
          siklar: ["09.00", "09.12", "09.24", "09.36"],
          dogru: 1,
          cozumAdimlari: [
            "Tekrar birlikte çalma süresi EKOK(18, 24) ile bulunur.",
            "EKOK(18, 24) = 72 dakika = 1 saat 12 dakika.",
            "08.00 + 1 saat 12 dakika = 09.12."
          ]
        },
        {
          konu: "Aralarında Asal Sayılar",
          soru: "(a − 2) ve (b + 1) aralarında asal sayılardır. (a − 2)/(b + 1) = 15/25 olduğuna göre a + b kaçtır?",
          siklar: ["7", "8", "9", "10"],
          dogru: 2,
          cozumAdimlari: [
            "15/25 kesrini en sade haline getirelim: 15/25 = 3/5 (3 ve 5 aralarında asal).",
            "a − 2 = 3 ⇒ a = 5 ve b + 1 = 5 ⇒ b = 4.",
            "a + b = 5 + 4 = 9."
          ]
        },
        {
          konu: "Üslü İfadeler",
          soru: "25⁴ · 8³ çarpımı kaç basamaklı bir sayıdır?",
          siklar: ["8", "9", "10", "11"],
          dogru: 1,
          cozumAdimlari: [
            "25⁴ = (5²)⁴ = 5⁸ ve 8³ = (2³)³ = 2⁹.",
            "5⁸ · 2⁹ = 2 · (2⁸ · 5⁸) = 2 · 10⁸.",
            "2'nin yanında 8 tane sıfır vardır → 1 + 8 = 9 basamaklıdır."
          ]
        },
        {
          konu: "Bilimsel Gösterim",
          soru: "Bir ağaç yılda ortalama 12 000 gram karbondioksit emmektedir. 500 ağacın 1 yılda emdiği karbondioksit miktarının gram cinsinden bilimsel gösterimi hangisidir?",
          siklar: ["6 · 10⁵", "6 · 10⁶", "6 · 10⁷", "0,6 · 10⁷"],
          dogru: 1,
          cozumAdimlari: [
            "Toplam miktar: 12 000 × 500 = 6 000 000 gram.",
            "6 000 000 = 6 · 10⁶.",
            "1 ≤ 6 < 10 sağlandığı için bilimsel gösterim 6 · 10⁶'dır."
          ]
        },
        {
          konu: "Üslü İfadeler",
          soru: "3ˣ = 5 ise 9ˣ⁺¹ ifadesinin değeri kaçtır?",
          siklar: ["45", "125", "225", "450"],
          dogru: 2,
          cozumAdimlari: [
            "9ˣ⁺¹ = 9ˣ · 9¹ = (3²)ˣ · 9 = (3ˣ)² · 9.",
            "3ˣ = 5 yerine yazalım: 5² · 9 = 25 · 9 = 225."
          ]
        }
      ]
    },

    "9": {
      sinif: "9",
      baslik: "9. Sınıf Matematik",
      mufredatEtiketi: "MEB Lise Maarif Modeli • 9. Sınıf",
      sikSayisi: 5,
      konular: [
        {
          id: "9-1",
          ucretsiz: true,
          baslik: "Gerçek Sayıların Üslü ve Köklü Gösterimleri",
          kazanim: "Sayı kümeleri, gerçek sayı aralıkları ve köklü ifadelerin eşleniği.",
          ozet: "Gerçek sayılar kümesi (ℝ), rasyonel (ℚ) ve irrasyonel (ℚ') sayıların birleşimidir. Köklü ifadeler rasyonel üslerle (ⁿ√aᵐ = aᵐ/ⁿ) ifade edilir ve paydadaki kökü yok etmek için eşlenik ile genişletme yapılır.",
          pufNoktasi: [
            { baslik: "Eşlenik Çarpımı", formul: "(√a − √b)(√a + √b) = a − b", aciklama: "İki kare farkı özdeşliği sayesinde kökten kurtulunur." },
            { baslik: "Rasyonel Üs", formul: "ⁿ√(aᵐ) = a^(m/n)", aciklama: "Örn: ³√(8²) = 8^(2/3) = (2³)^(2/3) = 2² = 4." }
          ],
          gunlukHayat: {
            baslik: "📐 Günlük Hayattan Örnek: A4 Kağıt Oranı (√2)",
            metin: "Standart bir A4 kağıdının uzun kenarının kısa kenarına oranı tam olarak √2'dir (irrasyonel sayı). Bu sayede kağıt ortadan ikiye katlandığında elde edilen A5 kağıdı da aynı oranı korur."
          },
          ornekler: [
            {
              soru: "4 / (√5 − 1) ifadesinin paydasını rasyonel yaparak en sade halini bulunuz.",
              adimlar: [
                "Pay ve paydayı eşlenik olan (√5 + 1) ile çarpalım.",
                "Payda: (√5 − 1)(√5 + 1) = 5 − 1 = 4.",
                "4(√5 + 1) / 4 = √5 + 1."
              ],
              cevap: "√5 + 1"
            },
            {
              soru: "5ˣ⁻¹ = 1/125 denklemini sağlayan x gerçek sayısı kaçtır?",
              adimlar: [
                "1/125 = 1/5³ = 5⁻³ şeklinde yazalım.",
                "Tabanlar eşit olduğundan üsler eşittir: x − 1 = −3.",
                "x = −2."
              ],
              cevap: "x = −2"
            }
          ]
        },
        {
          id: "9-2",
          ucretsiz: true,
          baslik: "Doğrusal Fonksiyonlar ve Grafik Yorumlama",
          kazanim: "Değişim oranı, fonksiyon kavramı ve nitel özellikleri.",
          ozet: "f: ℝ → ℝ, f(x) = ax + b biçimindeki fonksiyonlara doğrusal fonksiyon denir. a katsayısı fonksiyonun sabit değişim oranını (eğimini) verir; a > 0 iken artan, a < 0 iken azalandır.",
          pufNoktasi: [
            { baslik: "Değişim Oranı (Eğim)", formul: "a = [f(x₂) − f(x₁)] / (x₂ − x₁)", aciklama: "x değerindeki 1 birimlik artışa karşılık f(x)'teki değişimdir." },
            { baslik: "Fonksiyonun Sıfırı", formul: "f(x) = 0 ⇒ x = −b / a", aciklama: "Grafiğin x eksenini kestiği noktadır." }
          ],
          gunlukHayat: {
            baslik: "🚕 Günlük Hayattan Örnek: Taksimetre Ücreti",
            metin: "Açılış ücreti 30 TL ve kilometre başına 20 TL yazan bir taksinin ücreti f(x) = 20x + 30 doğrusal fonksiyonuyla modellenir."
          },
          ornekler: [
            {
              soru: "f doğrusal bir fonksiyon olup f(1) = 5 ve f(4) = 14 olduğuna göre f(7) kaçtır?",
              adimlar: [
                "Değişim oranı (eğim): a = (14 − 5) / (4 − 1) = 9 / 3 = 3.",
                "f(x) = 3x + b ve f(1) = 5 ⇒ 3(1) + b = 5 ⇒ b = 2.",
                "f(7) = 3(7) + 2 = 23."
              ],
              cevap: "23"
            },
            {
              soru: "f(x) = −2x + 10 fonksiyonunun grafiği ile eksenler arasında kalan üçgenin alanı kaç birimkaredir?",
              adimlar: [
                "x = 0 için y = 10 → (0, 10).",
                "y = 0 için −2x + 10 = 0 ⇒ x = 5 → (5, 0).",
                "Dik üçgenin alanı: (5 · 10) / 2 = 25 birimkare."
              ],
              cevap: "25 birimkare"
            }
          ]
        },
        { id: "9-3", ucretsiz: false, baslik: "Algoritma ve Bilişimsel Düşünme", kazanim: "Akış şemaları, sözde kod, mantıksal bağlaçlar ve algoritmik problem çözme." },
        { id: "9-4", ucretsiz: false, baslik: "Üçgenlerde Eşlik ve Benzerlik", kazanim: "KEN, AKE, AAA benzerlik teoremleri ve Tales bağıntıları." },
        { id: "9-5", ucretsiz: false, baslik: "Trigonometrik Oranlar (Dik Üçgen)", kazanim: "Dar açıların sinüs, kosinüs, tanjant ve kotanjant değerleri." },
        { id: "9-6", ucretsiz: false, baslik: "İstatistiksel Araştırma Süreci", kazanim: "Nicel/nitel veri analizi, dağılım grafikleri ve yorumlama." }
      ],
      miniTest: [
        {
          konu: "Köklü İfadeler",
          soru: "6 / (√7 − 2) − 2√7 işleminin sonucu kaçtır?",
          siklar: ["2", "4", "6", "√7", "4 + √7"],
          dogru: 1,
          cozumAdimlari: [
            "6 / (√7 − 2) kesrini (√7 + 2) ile genişletelim.",
            "Payda: 7 − 4 = 3 → 6(√7 + 2) / 3 = 2(√7 + 2) = 2√7 + 4.",
            "(2√7 + 4) − 2√7 = 4."
          ]
        },
        {
          konu: "Üslü İfadeler",
          soru: "2ˣ = 3 ve 3ʸ = 16 olduğuna göre x · y çarpımı kaçtır?",
          siklar: ["2", "3", "4", "6", "8"],
          dogru: 2,
          cozumAdimlari: [
            "3 = 2ˣ ifadesini 3ʸ = 16 denkleminde yerine yazalım.",
            "(2ˣ)ʸ = 2⁴ ⇒ 2^(x·y) = 2⁴.",
            "Tabanlar eşit olduğundan x · y = 4."
          ]
        },
        {
          konu: "Doğrusal Fonksiyonlar",
          soru: "f(x) = (m − 2)x + 5 fonksiyonu sabit fonksiyon ise f(2026) + m toplamı kaçtır?",
          siklar: ["5", "6", "7", "8", "10"],
          dogru: 2,
          cozumAdimlari: [
            "Sabit fonksiyonda x'li terimin katsayısı 0'dır: m − 2 = 0 ⇒ m = 2.",
            "Bu durumda f(x) = 5 olur, yani f(2026) = 5.",
            "Toplam: 5 + 2 = 7."
          ]
        },
        {
          konu: "Doğrusal Fonksiyonlar",
          soru: "Bir depoda 120 litre su vardır ve musluk saatte 15 litre su boşaltmaktadır. Depodaki suyun zamana (t saat) bağlı fonksiyonu hangisidir?",
          siklar: ["f(t) = 120 + 15t", "f(t) = 120 − 15t", "f(t) = 15t − 120", "f(t) = 120t − 15", "f(t) = 105t"],
          dogru: 1,
          cozumAdimlari: [
            "Başlangıç miktarı (t = 0) 120 litredir.",
            "Her saat 15 litre azaldığı için değişim oranı −15'tir.",
            "Model: f(t) = 120 − 15t."
          ]
        },
        {
          konu: "Gerçek Sayı Aralıkları",
          soru: "A = [−3, 4) ve B = (1, 7] aralıkları için A ∩ B kesişim kümesinde kaç tam sayı vardır?",
          siklar: ["1", "2", "3", "4", "5"],
          dogru: 1,
          cozumAdimlari: [
            "Kesişimde sol uçların büyüğü (1 açık), sağ uçların küçüğü (4 açık) alınır: (1, 4).",
            "(1, 4) aralığındaki tam sayılar: 2 ve 3.",
            "Toplam 2 tam sayı vardır."
          ]
        }
      ]
    },

    "10": {
      sinif: "10",
      baslik: "10. Sınıf Matematik",
      mufredatEtiketi: "MEB Lise Maarif Modeli • 10. Sınıf",
      sikSayisi: 5,
      konular: [
        {
          id: "10-1",
          ucretsiz: true,
          baslik: "Sayma Yöntemleri ve Permütasyon",
          kazanim: "Toplama ve çarpma yoluyla sayma, faktöriyel ve sıralama problemleri.",
          ozet: "Birbirinden bağımsız ardışık seçimler çarpma yoluyla, ayrık seçenekler toplama yoluyla sayılır. n farklı nesnenin r'li sıralamalarının sayısına permütasyon denir: P(n, r) = n! / (n − r)!.",
          pufNoktasi: [
            { baslik: "Permütasyon Formülü", formul: "P(n, r) = n! / (n − r)!", aciklama: "Sıralama önemliyse permütasyon kullanılır (örn: yarışmada 1., 2., 3. seçimi)." },
            { baslik: "Faktöriyel Kuralı", formul: "0! = 1   |   n! = n · (n − 1)!", aciklama: "Örn: 5! = 5·4·3·2·1 = 120." }
          ],
          gunlukHayat: {
            baslik: "🔐 Günlük Hayattan Örnek: Telefon Kilidi ve Plaka Sayısı",
            metin: "Rakamları birbirinden farklı 4 haneli bir PIN kodu oluştururken 10 × 9 × 8 × 7 = 5 040 farklı sıralama (permütasyon) elde edilir."
          },
          ornekler: [
            {
              soru: "A şehrinden B şehrine 3, B şehrinden C şehrine 4 farklı yol vardır. A'dan C'ye B üzerinden kaç farklı şekilde gidilip dönülebilir (giderken kullanılan yollar dönüşte kullanılmamak şartıyla)?",
              adimlar: [
                "Gidiş: 3 × 4 = 12 farklı yol.",
                "Dönüşte her aralıkta 1 yol eksilir: 3 × 2 = 6 farklı yol.",
                "Toplam: 12 × 6 = 72."
              ],
              cevap: "72"
            },
            {
              soru: "ANNE kelimesinin harfleriyle anlamlı ya da anlamsız kaç farklı 4 harfli kelime yazılabilir?",
              adimlar: [
                "Tekrarlı permütasyon: Toplam 4 harf var, 'N' harfi 2 kez tekrar ediyor.",
                "Formül: 4! / 2! = 24 / 2 = 12."
              ],
              cevap: "12"
            }
          ]
        },
        {
          id: "10-2",
          ucretsiz: true,
          baslik: "Kombinasyon ve Binom Açılımı",
          kazanim: "Alt küme seçimi ve Pascal üçgeni uygulamaları.",
          ozet: "Sıralamanın önemsiz olduğu sadece seçim/grup oluşturma problemlerinde kombinasyon C(n, r) = n! / [r!(n − r)!] kullanılır. (x + y)ⁿ ifadesinin açılımındaki katsayılar kombinasyon değerlerinden (Pascal üçgeninden) gelir.",
          pufNoktasi: [
            { baslik: "Kombinasyon Simetrisi", formul: "C(n, r) = C(n, n − r)", aciklama: "Örn: C(10, 8) = C(10, 2) = (10·9)/2 = 45." },
            { baslik: "Binom Genel Terim", formul: "C(n, r) · xⁿ⁻ʳ · yʳ", aciklama: "(x + y)ⁿ açılımında (n + 1) terim vardır." }
          ],
          gunlukHayat: {
            baslik: "🏀 Günlük Hayattan Örnek: Takım ve Komisyon Seçimi",
            metin: "10 kişilik bir sınıftan 3 kişilik bir gezi komisyonu seçerken kimin önce seçildiği önemli olmadığı için C(10, 3) = 120 farklı ekip kurulabilir."
          },
          ornekler: [
            {
              soru: "4 kız ve 5 erkek öğrenci arasından 2 kız ve 1 erkekten oluşan 3 kişilik bir ekip kaç farklı şekilde seçilebilir?",
              adimlar: [
                "4 kızdan 2 kız seçimi: C(4, 2) = (4·3)/2 = 6.",
                "5 erkekten 1 erkek seçimi: C(5, 1) = 5.",
                "Çarpma kuralı: 6 × 5 = 30 farklı ekip."
              ],
              cevap: "30"
            },
            {
              soru: "(x + 2)⁴ açılımında x²'li terimin katsayısı kaçtır?",
              adimlar: [
                "Genel terim: C(4, r) · x⁴⁻ʳ · 2ʳ.",
                "x² için 4 − r = 2 ⇒ r = 2.",
                "C(4, 2) · 2² = 6 · 4 = 24."
              ],
              cevap: "24"
            }
          ]
        },
        { id: "10-3", ucretsiz: false, baslik: "Basit Olayların Olasılıkları", kazanim: "Örnek uzay, ayrık/ayrık olmayan olaylar ve kombinasyonlu olasılık problemleri." },
        { id: "10-4", ucretsiz: false, baslik: "İkinci Dereceden Fonksiyonlar (Parabol)", kazanim: "Tepe noktası, simetri ekseni ve parabol grafiği çizimi." },
        { id: "10-5", ucretsiz: false, baslik: "Çokgenler ve Dörtgenler", kazanim: "Yamuk, paralelkenar, eşkenar dörtgen, dikdörtgen ve kare özellikleri." },
        { id: "10-6", ucretsiz: false, baslik: "Katı Cisimler", kazanim: "Dik prizmalar ve dik piramitlerin yüzey alanı ile hacim hesaplamaları." }
      ],
      miniTest: [
        {
          konu: "Sayma Yöntemleri",
          soru: "A = {1, 2, 3, 4, 5} kümesinin elemanlarıyla rakamları farklı kaç tane 3 basamaklı tek sayı yazılabilir?",
          siklar: ["24", "30", "36", "48", "60"],
          dogru: 2,
          cozumAdimlari: [
            "Tek sayı olduğu için birler basamağı {1, 3, 5} → 3 seçenek.",
            "Rakamları farklı olduğu için yüzler basamağına kalan 4 rakamdan biri → 4 seçenek.",
            "Onlar basamağına kalan 3 rakamdan biri → 3 seçenek. Toplam: 4 × 3 × 3 = 36."
          ]
        },
        {
          konu: "Permütasyon",
          soru: "3 farklı matematik ve 2 farklı fizik kitabı bir rafa matematik kitapları yan yana olacak şekilde kaç farklı biçimde dizilebilir?",
          siklar: ["12", "24", "36", "48", "120"],
          dogru: 2,
          cozumAdimlari: [
            "3 matematik kitabını tek paket gibi düşünelim: 1 paket + 2 fizik = 3 nesne → 3! = 6.",
            "Matematik kitapları kendi aralarında 3! = 6 şekilde yer değiştirir.",
            "Toplam: 6 × 6 = 36."
          ]
        },
        {
          konu: "Kombinasyon",
          soru: "Bir düzlemde herhangi üçü doğrusal olmayan 7 noktadan kaç farklı üçgen çizilebilir?",
          siklar: ["21", "28", "35", "42", "70"],
          dogru: 2,
          cozumAdimlari: [
            "Her üçgen için 3 nokta seçilmelidir: C(7, 3).",
            "C(7, 3) = (7 · 6 · 5) / (3 · 2 · 1) = 35."
          ]
        },
        {
          konu: "Binom Açılımı",
          soru: "(2x − 1)⁵ açılımının katsayılar toplamı kaçtır?",
          siklar: ["−1", "0", "1", "32", "243"],
          dogru: 2,
          cozumAdimlari: [
            "Katsayılar toplamı için değişken yerine 1 yazılır: x = 1.",
            "(2·1 − 1)⁵ = 1⁵ = 1."
          ]
        },
        {
          konu: "Kombinasyon",
          soru: "C(n, 2) = 15 eşitliğini sağlayan n pozitif tam sayısı kaçtır?",
          siklar: ["4", "5", "6", "7", "8"],
          dogru: 2,
          cozumAdimlari: [
            "C(n, 2) = n(n − 1) / 2 = 15.",
            "n(n − 1) = 30 ⇒ 6 · 5 = 30 olduğundan n = 6."
          ]
        }
      ]
    },

    "11": {
      sinif: "11",
      baslik: "11. Sınıf Matematik",
      mufredatEtiketi: "MEB Lise Maarif Modeli & AYT Temeli • 11. Sınıf",
      sikSayisi: 5,
      konular: [
        {
          id: "11-1",
          ucretsiz: true,
          baslik: "Trigonometri: Yönlü Açılar ve Birim Çember",
          kazanim: "Radyan-derece dönüşümü, esas ölçü ve trigonometrik özdeşlikler.",
          ozet: "Merkezi orijin ve yarıçapı 1 birim olan birim çemberde saat yönünün tersi pozitif (+), saat yönü negatif (−) yöndür. Bir açının [0°, 360°) aralığındaki denk açısına esas ölçü denir. Birim çember üzerindeki her nokta (cos α, sin α) koordinatlarıyla ifade edilir.",
          pufNoktasi: [
            { baslik: "Derece – Radyan", formul: "D / 180 = R / π", aciklama: "π radyan = 180° (örn: π/3 = 60°, π/4 = 45°)." },
            { baslik: "Temel Özdeşlikler", formul: "sin²x + cos²x = 1   |   tan x · cot x = 1", aciklama: "−1 ≤ sin x ≤ 1 ve −1 ≤ cos x ≤ 1." }
          ],
          gunlukHayat: {
            baslik: "🎡 Günlük Hayattan Örnek: Dönme Dolap ve Ses Dalgaları",
            metin: "Bir dönme dolaptaki kabinin zamana göre yerden yüksekliği sinüs ve kosinüs fonksiyonlarıyla periyodik olarak modellenir."
          },
          ornekler: [
            {
              soru: "1150°'lik açının esas ölçüsü kaç derecedir?",
              adimlar: [
                "1150'yi 360'a bölelim: 360 × 3 = 1080.",
                "Kalan: 1150 − 1080 = 70°.",
                "Esas ölçü 70°'dir."
              ],
              cevap: "70°"
            },
            {
              soru: "sin x + cos x = 1/2 olduğuna göre sin x · cos x çarpımı kaçtır?",
              adimlar: [
                "Her iki tarafın karesini alalım: sin²x + 2sin x·cos x + cos²x = 1/4.",
                "sin²x + cos²x = 1 olduğundan: 1 + 2sin x·cos x = 1/4.",
                "2sin x·cos x = −3/4 ⇒ sin x·cos x = −3/8."
              ],
              cevap: "−3/8"
            }
          ]
        },
        {
          id: "11-2",
          ucretsiz: true,
          baslik: "Analitik Geometri: Noktanın ve Doğrunun Analitiği",
          kazanim: "İki nokta arası uzaklık, eğim ve doğru denklemleri.",
          ozet: "Koordinat düzleminde iki nokta arasındaki uzaklık Pisagor teoreminden elde edilir. Bir doğrunun x ekseniyle yaptığı pozitif yönlü açının tanjantı o doğrunun eğimini (m) verir; paralel doğruların eğimleri eşit, dik doğruların eğimleri çarpımı −1'dir.",
          pufNoktasi: [
            { baslik: "İki Nokta Uzaklığı", formul: "|AB| = √[(x₂ − x₁)² + (y₂ − y₁)²]", aciklama: "Orta nokta: ((x₁+x₂)/2, (y₁+y₂)/2)." },
            { baslik: "Eğim & Doğru Denklemi", formul: "m = (y₂ − y₁)/(x₂ − x₁)  |  y − y₁ = m(x − x₁)", aciklama: "d₁ ⊥ d₂ ⇔ m₁ · m₂ = −1." }
          ],
          gunlukHayat: {
            baslik: "🗺️ Günlük Hayattan Örnek: GPS ve Harita Mesafesi",
            metin: "Navigasyon uygulamaları haritadaki iki konumun (x₁, y₁) ve (x₂, y₂) koordinatlarını kullanarak kuş uçuşu mesafeyi analitik geometri formülüyle hesaplar."
          },
          ornekler: [
            {
              soru: "A(−1, 2) ve B(5, 10) noktaları arasındaki uzaklık kaç birimdir?",
              adimlar: [
                "Δx = 5 − (−1) = 6 ve Δy = 10 − 2 = 8.",
                "|AB| = √(6² + 8²) = √(36 + 64) = √100.",
                "|AB| = 10 birim."
              ],
              cevap: "10 birim"
            },
            {
              soru: "A(2, 3) noktasından geçen ve eğimi 4 olan doğrunun denklemini yazınız.",
              adimlar: [
                "Formül: y − y₁ = m(x − x₁).",
                "y − 3 = 4(x − 2) ⇒ y − 3 = 4x − 8.",
                "y = 4x − 5."
              ],
              cevap: "y = 4x − 5"
            }
          ]
        },
        { id: "11-3", ucretsiz: false, baslik: "Fonksiyonlarda Uygulamalar", kazanim: "Fonksiyon dönüşümleri (öteleme, simetri), artanlık-azalanlık ve parabol uygulamaları." },
        { id: "11-4", ucretsiz: false, baslik: "İkinci Dereceden Denklem ve Eşitsizlik Sistemleri", kazanim: "İşaret tablosu oluşturma ve eşitsizlik sistemlerinin çözüm kümesi." },
        { id: "11-5", ucretsiz: false, baslik: "Çember ve Dairenin Analitiği", kazanim: "Çemberde kiriş, teğet, açı ve alan bağıntıları." },
        { id: "11-6", ucretsiz: false, baslik: "Uzay Geometri", kazanim: "Silindir, koni ve kürenin yüzey alanı ile hacim problemleri." }
      ],
      miniTest: [
        {
          konu: "Trigonometri",
          soru: "−400°'lik açının esas ölçüsü kaç derecedir?",
          siklar: ["40°", "140°", "220°", "320°", "340°"],
          dogru: 3,
          cozumAdimlari: [
            "Negatif açıya 360°'nin katları eklenerek [0°, 360°) aralığına getirilir.",
            "−400° + 2 · 360° = −400° + 720° = 320°."
          ]
        },
        {
          konu: "Trigonometri",
          soru: "sin²x / (1 − cos x) − cos x ifadesinin en sade hali nedir?",
          siklar: ["0", "1", "sin x", "cos x", "2"],
          dogru: 1,
          cozumAdimlari: [
            "sin²x = 1 − cos²x = (1 − cos x)(1 + cos x) yazalım.",
            "(1 − cos x) sadeleşir, geriye (1 + cos x) kalır.",
            "(1 + cos x) − cos x = 1."
          ]
        },
        {
          konu: "Analitik Geometri",
          soru: "A(2, −3) ve B(6, 5) noktalarının orta noktasının koordinatları hangisidir?",
          siklar: ["(4, 1)", "(4, −1)", "(3, 1)", "(8, 2)", "(2, 4)"],
          dogru: 0,
          cozumAdimlari: [
            "Orta nokta x: (2 + 6) / 2 = 4.",
            "Orta nokta y: (−3 + 5) / 2 = 1.",
            "Koordinatlar (4, 1) bulunur."
          ]
        },
        {
          konu: "Doğrunun Analitiği",
          soru: "2x − 3y + 6 = 0 doğrusuna dik olan bir doğrunun eğimi kaçtır?",
          siklar: ["2/3", "−2/3", "3/2", "−3/2", "−2"],
          dogru: 3,
          cozumAdimlari: [
            "Verilen doğrunun eğimi: m₁ = −a/b = −2/(−3) = 2/3.",
            "Dik doğrular için m₁ · m₂ = −1 ⇒ (2/3) · m₂ = −1.",
            "m₂ = −3/2."
          ]
        },
        {
          konu: "Analitik Geometri",
          soru: "A(1, 2), B(3, 6) ve C(5, k) noktaları doğrusal olduğuna göre k kaçtır?",
          siklar: ["8", "9", "10", "11", "12"],
          dogru: 2,
          cozumAdimlari: [
            "Doğrusal noktaların eğimleri eşittir: m(AB) = m(BC).",
            "m(AB) = (6 − 2)/(3 − 1) = 4/2 = 2.",
            "(k − 6)/(5 − 3) = 2 ⇒ k − 6 = 4 ⇒ k = 10."
          ]
        }
      ]
    },

    "12": {
      sinif: "12",
      baslik: "12. Sınıf Matematik (YKS)",
      mufredatEtiketi: "MEB Müfredatı • YKS (TYT / AYT) Hazırlık • 12. Sınıf",
      sikSayisi: 5,
      konular: [
        {
          id: "12-1",
          ucretsiz: true,
          baslik: "Üstel ve Logaritmik Fonksiyonlar",
          kazanim: "Logaritmanın özellikleri, taban değiştirme ve logaritmik denklemler.",
          ozet: "Üstel fonksiyon y = aˣ (a > 0, a ≠ 1) bire bir ve örtendir; ters fonksiyonu x = logₐ(y) logaritma fonksiyonudur. Taban değiştirme kuralı logₐ(b) = log_c(b) / log_c(a) AYT'de karmaşık ifadeleri sadeleştirmede anahtar rol oynar.",
          pufNoktasi: [
            { baslik: "Taban Değiştirme & Çarpım", formul: "logₐ(b) · log_b(c) = logₐ(c)", aciklama: "Zincirleme çarpımda çapraz terimler sadeleşir." },
            { baslik: "Kuvvet Başa Geçer", formul: "log_(aⁿ)(bᵐ) = (m / n) · logₐ(b)", aciklama: "Üstün kuvveti paya, tabanın kuvveti paydaya gelir." }
          ],
          gunlukHayat: {
            baslik: "🌋 Günlük Hayattan Örnek: Richter Deprem Ölçeği ve pH",
            metin: "Depremlerin büyüklüğü 10 tabanlı logaritmayla ölçülür: 7 büyüklüğündeki bir deprem, 6 büyüklüğündeki bir depremden 10 kat daha büyük sismik dalga genliğine sahiptir."
          },
          ornekler: [
            {
              soru: "log₂(3) · log₃(5) · log₅(16) çarpımının değeri kaçtır?",
              adimlar: [
                "Taban değiştirme zinciriyle 3'ler ve 5'ler sadeleşir: log₂(16).",
                "16 = 2⁴ olduğundan log₂(2⁴) = 4."
              ],
              cevap: "4"
            },
            {
              soru: "log₂(x − 1) + log₂(x + 1) = 3 denkleminin çözüm kümesini bulunuz.",
              adimlar: [
                "Aynı tabanda toplama çarpmaya dönüşür: log₂[(x − 1)(x + 1)] = 3.",
                "x² − 1 = 2³ = 8 ⇒ x² = 9 ⇒ x = 3 veya x = −3.",
                "Tanım kümesi gereği x − 1 > 0 olmalı; −3 elenir, tek kök x = 3."
              ],
              cevap: "Ç = {3}"
            }
          ]
        },
        {
          id: "12-2",
          ucretsiz: true,
          baslik: "Diziler: Aritmetik ve Geometrik Diziler",
          kazanim: "Genel terim bulma, ilk n terim toplamı ve indirgemeli diziler.",
          ozet: "Tanım kümesi pozitif tam sayılar (ℤ⁺) olan fonksiyonlara dizi denir. Ardışık terimleri farkı sabit (d) olan dizilere aritmetik dizi, oranı sabit (r) olan dizilere geometrik dizi denir.",
          pufNoktasi: [
            { baslik: "Aritmetik Dizi Toplamı", formul: "Sₙ = (n / 2) · (a₁ + aₙ)", aciklama: "Genel terim: aₙ = a₁ + (n − 1)d." },
            { baslik: "Geometrik Dizi", formul: "aₙ = a₁ · rⁿ⁻¹   |   aₖ² = aₖ₋ₚ · aₖ₊ₚ", aciklama: "Ortadaki terimin karesi eşit uzaklıktaki iki terimin çarpımına eşittir." }
          ],
          gunlukHayat: {
            baslik: "📈 Günlük Hayattan Örnek: Bileşik Büyüme ve Tasarruf Planı",
            metin: "Her ay bir önceki aydan 200 TL fazla biriktirmek aritmetik dizi, her yıl %10 büyüyen bir yatırım fonu ise geometrik dizi oluşturur."
          },
          ornekler: [
            {
              soru: "Bir aritmetik dizide a₄ = 11 ve a₁₀ = 29 ise bu dizinin ilk terimi (a₁) kaçtır?",
              adimlar: [
                "Ortak fark: d = (29 − 11) / (10 − 4) = 18 / 6 = 3.",
                "a₄ = a₁ + 3d ⇒ 11 = a₁ + 3(3) = a₁ + 9.",
                "a₁ = 2."
              ],
              cevap: "2"
            },
            {
              soru: "Pozitif terimli bir geometrik dizide a₂ = 6 ve a₅ = 48 ise a₁ kaçtır?",
              adimlar: [
                "a₅ / a₂ = r³ ⇒ 48 / 6 = 8 ⇒ r³ = 8 ⇒ r = 2.",
                "a₂ = a₁ · r ⇒ 6 = a₁ · 2 ⇒ a₁ = 3."
              ],
              cevap: "3"
            }
          ]
        },
        { id: "12-3", ucretsiz: false, baslik: "Limit ve Süreklilik", kazanim: "Sağdan-soldan limit, 0/0 belirsizliği ve fonksiyonların süreklilik şartları." },
        { id: "12-4", ucretsiz: false, baslik: "Türev ve Maksimum-Minimum Problemleri", kazanim: "Türev alma kuralları, teğet eğimi, ekstremum noktalar ve optimizasyon." },
        { id: "12-5", ucretsiz: false, baslik: "İntegral ve Alan Hesabı", kazanim: "Belirsiz/belirli integral, değişken değiştirme ve eğri altında kalan alan." },
        { id: "12-6", ucretsiz: false, baslik: "Dönüşüm Geometrisi", kazanim: "Analitik düzlemde öteleme, dönme ve simetri dönüşümleri." }
      ],
      miniTest: [
        {
          konu: "Logaritma",
          soru: "log₄(8) + log₉(27) toplamının değeri kaçtır?",
          siklar: ["2", "5/2", "3", "7/2", "4"],
          dogru: 2,
          cozumAdimlari: [
            "log₄(8) = log_(2²)(2³) = 3/2.",
            "log₉(27) = log_(3²)(3³) = 3/2.",
            "Toplam: 3/2 + 3/2 = 3."
          ]
        },
        {
          konu: "Logaritmik Denklemler",
          soru: "ln(2x − 3) = 0 denklemini sağlayan x değeri kaçtır?",
          siklar: ["1", "3/2", "2", "5/2", "e"],
          dogru: 2,
          cozumAdimlari: [
            "ln(A) = 0 olması için A = e⁰ = 1 olmalıdır.",
            "2x − 3 = 1 ⇒ 2x = 4 ⇒ x = 2."
          ]
        },
        {
          konu: "Aritmetik Diziler",
          soru: "İlk terimi 3 ve ortak farkı 2 olan bir aritmetik dizinin ilk 10 teriminin toplamı (S₁₀) kaçtır?",
          siklar: ["100", "110", "120", "130", "140"],
          dogru: 2,
          cozumAdimlari: [
            "a₁₀ = a₁ + 9d = 3 + 9(2) = 21.",
            "S₁₀ = (10 / 2) · (a₁ + a₁₀) = 5 · (3 + 21) = 5 · 24 = 120."
          ]
        },
        {
          konu: "Geometrik Diziler",
          soru: "Pozitif terimli bir geometrik dizide a₃ · a₇ = 64 olduğuna göre a₅ kaçtır?",
          siklar: ["4", "6", "8", "12", "16"],
          dogru: 2,
          cozumAdimlari: [
            "İndislerin ortalaması: (3 + 7)/2 = 5 olduğundan a₅² = a₃ · a₇.",
            "a₅² = 64 ve dizi pozitif terimli olduğundan a₅ = 8."
          ]
        },
        {
          konu: "İndirgemeli Diziler",
          soru: "a₁ = 4 ve her n ≥ 1 için aₙ₊₁ = aₙ + 3 olarak tanımlanan dizinin 8. terimi (a₈) kaçtır?",
          siklar: ["22", "24", "25", "27", "28"],
          dogru: 2,
          cozumAdimlari: [
            "Her adımda 3 eklendiği için ortak farkı d = 3 olan bir aritmetik dizidir.",
            "a₈ = a₁ + 7d = 4 + 7(3) = 4 + 21 = 25."
          ]
        }
      ]
    }
  };

  /* AI Mentör Kayıtsız Tek Soruluk Demo & Haftalık Plan Önizleme */
  var AI_DEMO = {
    "5": {
      soru: "45 307 820 sayısının binler bölüğündeki rakamların toplamı ile milyonlar bölüğündeki sayının toplamı kaçtır?",
      adimlar: [
        { rol: "🤖 İpucu 1", metin: "Sayıyı sağdan sola üçerli gruplara ayırarak Milyonlar ve Binler bölüklerini bulalım.", aciklama: "45 (Milyonlar) | 307 (Binler) | 820 (Birler)." },
        { rol: "🤖 İpucu 2", metin: "Binler bölüğündeki 3, 0 ve 7 rakamlarını toplayıp 45'e ekleyelim.", aciklama: "3 + 0 + 7 = 10; 45 + 10 = 55." },
        { rol: "✅ Sonuç", metin: "Harika! Bölük mantığını kullanarak cevaba kolayca ulaştın.", aciklama: "Cevap: 55" }
      ]
    },
    "default": {
      soru: "3x − 5 = 16 denklemini sağlayan x değerini adım adım bulalım.",
      adimlar: [
        { rol: "🤖 İpucu 1", metin: "x'i yalnız bırakmak için eşitliğin her iki tarafına hangi sayıyı eklemeliyiz?", aciklama: "Her iki tarafa +5 ekleyelim: 3x = 16 + 5 ⇒ 3x = 21." },
        { rol: "🤖 İpucu 2", metin: "Çok iyi! Şimdi 3x = 21 eşitliğinde x'i bulmak için iki tarafı kaça bölmeliyiz?", aciklama: "İki tarafı 3'e bölelim: x = 21 ÷ 3 = 7." },
        { rol: "✅ Sonuç", metin: "Tebrikler! Sağlaması: 3(7) − 5 = 16.", aciklama: "Cevap: x = 7" }
      ]
    }
  };

  var HAFTALIK_PLAN = [
    { gun: "Pazartesi", gorev: "1. Ünite Konu Özeti, Formül Kartı & 2 Çözümlü Örnek", sure: "25 dk" },
    { gun: "Çarşamba", gorev: "Kendini Dene: 5 Soruluk Mini Kontrol + Adım Adım Çözüm", sure: "20 dk" },
    { gun: "Cuma", gorev: "2. Ünite Görsel Anlatım & Günlük Hayat Uygulaması", sure: "30 dk" },
    { gun: "Pazar", gorev: "Haftalık 20 Soruluk Tarama & Gelişim Karnesi", sure: "35 dk" }
  ];

  global.MUFREDAT_VERILERI = MUFREDAT_VERILERI;
  global.ZarifMufredatYardimci = {
    getSinif: function (sinif) {
      var s = String(sinif || "5");
      return MUFREDAT_VERILERI[s] || MUFREDAT_VERILERI["5"];
    },
    getAiDemo: function (sinif) {
      return AI_DEMO[String(sinif)] || AI_DEMO["default"];
    },
    HAFTALIK_PLAN: HAFTALIK_PLAN
  };
})(window);
