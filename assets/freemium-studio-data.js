/* ==========================================================================
   ZarifÇözüm — Freemium Konu Stüdyosu & Kendini Dene (5-12. Sınıf Veri Havuzu)
   Her sınıfta ilk 2 ünite tamamen açık (özet, formül, 2 çözümlü örnek, 5 soruluk mini test),
   3. üniteden itibaren üyelere özel kilitli önizleme.
   ========================================================================== */
(function (global) {
  "use strict";

  var GRADE_META = {
    "5": { label: "5. Sınıf Matematik", badge: "MEB Türkiye Yüzyılı Maarif Modeli • Ortaokul Başlangıç", tag: "Ortaokul" },
    "6": { label: "6. Sınıf Matematik", badge: "MEB Türkiye Yüzyılı Maarif Modeli • Temel Kavramlar", tag: "Ortaokul" },
    "7": { label: "7. Sınıf Matematik", badge: "MEB Türkiye Yüzyılı Maarif Modeli • Cebir ve Geometri", tag: "Ortaokul" },
    "8": { label: "8. Sınıf Matematik (LGS)", badge: "MEB Müfredatı & LGS Yeni Nesil Hazırlık", tag: "LGS" },
    "9": { label: "9. Sınıf Matematik", badge: "MEB Türkiye Yüzyılı Maarif Modeli • Lise Temeli", tag: "Lise" },
    "10": { label: "10. Sınıf Matematik", badge: "MEB Türkiye Yüzyılı Maarif Modeli • TYT Temeli", tag: "Lise" },
    "11": { label: "11. Sınıf Matematik", badge: "MEB Müfredatı • AYT Hazırlık", tag: "AYT" },
    "12": { label: "12. Sınıf Matematik (YKS)", badge: "MEB Müfredatı • TYT & AYT Tam Hazırlık", tag: "YKS" }
  };

  /* Her sınıfın ilk 2 açık konusu için zengin içerik + 2 adım adım örnek + 5 soruluk mini test */
  var OPEN_TOPICS = {
    "5": [
      {
        summary: "Nokta, doğru, ışın, doğru parçası ve açı kavramları geometrinin yapı taşlarıdır. İki ışının başlangıç noktasında birleşmesiyle oluşan açılar dar (0°–90°), dik (90°), geniş (90°–180°) ve doğru açı (180°) olarak sınıflandırılır.",
        highlights: ["Noktanın boyutu yoktur, büyük harfle gösterilir.", "Dik açı tam 90°'dir ve köşede küçük kare ile gösterilir.", "Üçgenin iç açıları toplamı her zaman 180°'dir."],
        formulas: [
          { title: "Açı Çeşitleri", expr: "Dar < 90°  |  Dik = 90°  |  Geniş > 90°", note: "Doğru açı tam 180°'dir." },
          { title: "Üçgen İç Açıları", expr: "m(A) + m(B) + m(C) = 180°", note: "İki açı biliniyorsa 3. açı 180°'den çıkarılarak bulunur." },
          { title: "Çokgen Köşe & Kenar", expr: "Kenar Sayısı = Köşe Sayısı = İç Açı Sayısı", note: "Örneğin beşgenin 5 kenarı ve 5 köşesi vardır." }
        ],
        examples: [
          {
            question: "Bir üçgenin iki iç açısının ölçüsü 55° ve 70°'dir. Üçüncü açının ölçüsü kaç derecedir?",
            steps: [
              "Üçgenin iç açıları toplamı her zaman 180°'dir.",
              "Verilen iki açıyı toplayalım: 55° + 70° = 125°.",
              "180°'den 125°'yi çıkaralım: 180° − 125° = 55°."
            ],
            answer: "55° (İkizkenar dar açılı üçgen)"
          },
          {
            question: "Bir doğru açı (180°) iki komşu açıya ayrılıyor. Açılardan biri 64° ise diğer açı kaç derecedir ve çeşidi nedir?",
            steps: [
              "Doğru açının toplam ölçüsü 180°'dir.",
              "Bilinmeyen açıyı bulmak için: 180° − 64° = 116°.",
              "116° sayısı 90° ile 180° arasında olduğundan geniş açıdır."
            ],
            answer: "116° (Geniş açı)"
          }
        ],
        quiz: [
          { q: "Ölçüsü 89° olan bir açı hangi açı çeşidine girer?", opts: ["Dar açı", "Dik açı", "Geniş açı", "Doğru açı"], ans: 0, exp: "0° ile 90° arasındaki tüm açılar dar açıdır." },
          { q: "İki açısı 40° ve 65° olan üçgenin üçüncü açısı kaç derecedir?", opts: ["65°", "75°", "85°", "95°"], ans: 1, exp: "40 + 65 = 105; 180 − 105 = 75° bulunur." },
          { q: "Başlangıç noktası belli olup bir yönde sonsuza uzanan geometrik şekil hangisidir?", opts: ["Doğru parçası", "Doğru", "Işın", "Çember"], ans: 2, exp: "Işının bir ucu kapalı (başlangıç noktası), diğer ucu sonsuza gider." },
          { q: "Dik açının ölçüsü ile en küçük dar açının (tam sayı) toplamı kaç derecedir?", opts: ["90°", "91°", "92°", "100°"], ans: 1, exp: "Dik açı 90°, en küçük tam sayı dar açı 1°'dir. Toplam 91°." },
          { q: "Bir dörtgenin kaç kenarı ve kaç köşesi vardır?", opts: ["3 kenar, 3 köşe", "4 kenar, 4 köşe", "5 kenar, 5 köşe", "4 kenar, 3 köşe"], ans: 1, exp: "Dörtgenlerin 4 kenarı, 4 köşesi ve 4 iç açısı bulunur." }
        ]
      },
      {
        summary: "Çok basamaklı doğal sayılar sağdan sola doğru üçerli gruplara (bölüklere) ayrılır: Birler, Binler ve Milyonlar bölüğü. Doğal sayılarla dört işlem problemlerinde verilenler ve istenenler adım adım modellenir.",
        highlights: ["Bölükler sağdan sola 3'erli ayrılır.", "Bir rakamın basamak değeri = Rakam × Basamak adı.", "Toplama ve çarpmada tahmini sonuç için en yakın onluğa/yüzlüğe yuvarlama kullanılır."],
        formulas: [
          { title: "Bölük Yapısı", expr: "Milyonlar | Binler | Birler", note: "Örn: 42 508 130 → Kırk iki milyon beş yüz sekiz bin yüz otuz" },
          { title: "Bölme Sağlaması", expr: "Bölünen = (Bölen × Bölüm) + Kalan", note: "Kalan her zaman bölenden küçük olmalıdır." }
        ],
        examples: [
          {
            question: "45 307 820 sayısının binler bölüğündeki rakamların toplamı kaçtır?",
            steps: [
              "Sayıyı bölüklere ayıralım: 45 (Milyonlar) | 307 (Binler) | 820 (Birler).",
              "Binler bölüğündeki rakamlar 3, 0 ve 7'dir.",
              "Rakamları toplayalım: 3 + 0 + 7 = 10."
            ],
            answer: "10"
          },
          {
            question: "Bir bölme işleminde bölen 14, bölüm 12 ve kalan 5 ise bölünen sayı kaçtır?",
            steps: [
              "Kural: Bölünen = (Bölen × Bölüm) + Kalan.",
              "Önce çarpma işlemini yapalım: 14 × 12 = 168.",
              "Kalanı ekleyelim: 168 + 5 = 173."
            ],
            answer: "173"
          }
        ],
        quiz: [
          { q: "7 045 210 sayısının milyonlar bölüğünde hangi sayı vardır?", opts: ["70", "7", "45", "210"], ans: 1, exp: "7 | 045 | 210 şeklinde ayrılır; milyonlar bölüğü 7'dir." },
          { q: "354 820 sayısındaki 5 rakamının basamak değeri kaçtır?", opts: ["500", "5 000", "50 000", "500 000"], ans: 2, exp: "5 rakamı on binler basamağındadır: 5 × 10 000 = 50 000." },
          { q: "Bir bölme işleminde bölen 9 ise kalan en fazla kaç olabilir?", opts: ["7", "8", "9", "10"], ans: 1, exp: "Kalan bölenden küçük olmak zorundadır; en fazla 9 − 1 = 8 olur." },
          { q: "240 × 15 işleminin sonucu kaçtır?", opts: ["3 200", "3 400", "3 600", "3 800"], ans: 2, exp: "240 × 10 = 2400 ve 240 × 5 = 1200; toplam 3600." },
          { q: "Okunuşu 'On iki milyon kırk bin beş' olan sayı hangisidir?", opts: ["12 400 005", "12 040 005", "12 004 005", "12 040 050"], ans: 1, exp: "Milyonlar: 12, Binler: 040, Birler: 005 → 12 040 005." }
        ]
      }
    ],
    "6": [
      {
        summary: "Bir doğal sayıyı kalansız bölen sayılara o sayının çarpanları (bölenleri) denir. Sadece 1'e ve kendisine bölünebilen 1'den büyük doğal sayılar asal sayılardır (2, 3, 5, 7, 11, ...).",
        highlights: ["En küçük ve tek çift asal sayı 2'dir.", "3 ile bölünebilme: Rakamlar toplamı 3'ün katı olmalı.", "5 ile bölünebilme: Birler basamağı 0 veya 5 olmalı."],
        formulas: [
          { title: "Asal Sayılar", expr: "2, 3, 5, 7, 11, 13, 17, 19, 23...", note: "1 asal sayı değildir." },
          { title: "Bölünebilme Kuralları", expr: "6'ya bölünme ⇔ 2 ve 3'e tam bölünme", note: "9'a bölünme için rakamlar toplamı 9'un katı olmalıdır." }
        ],
        examples: [
          {
            question: "36 sayısının asal çarpanlarını bulunuz.",
            steps: [
              "36'yı en küçük asal sayı olan 2'ye bölelim: 36 ÷ 2 = 18.",
              "18 ÷ 2 = 9 (artık 2'ye bölünmez, sıradaki asal 3'e geçelim).",
              "9 ÷ 3 = 3 ve 3 ÷ 3 = 1. Kullanılan farklı asallar: 2 ve 3."
            ],
            answer: "2 ve 3"
          },
          {
            question: "4A2 üç basamaklı sayısı 3 ile kalansız bölünebildiğine göre A yerine yazılabilecek rakamlar toplamı kaçtır?",
            steps: [
              "3 ile bölünebilme kuralı: 4 + A + 2 = 6 + A sayısı 3'ün katı olmalı.",
              "A yerine 0, 3, 6 ve 9 yazılabilir.",
              "Toplamları: 0 + 3 + 6 + 9 = 18."
            ],
            answer: "18"
          }
        ],
        quiz: [
          { q: "Aşağıdakilerden hangisi asal sayıdır?", opts: ["1", "21", "29", "39"], ans: 2, exp: "29 yalnızca 1'e ve kendisine bölünür." },
          { q: "24 sayısının kaç tane doğal sayı çarpanı vardır?", opts: ["6", "7", "8", "10"], ans: 2, exp: "1, 2, 3, 4, 6, 8, 12, 24 → toplam 8 çarpan." },
          { q: "540 sayısı aşağıdakilerden hangisine kalansız bölünemez?", opts: ["2", "3", "5", "8"], ans: 3, exp: "540 ÷ 8 = 67 kalan 4 olduğundan 8'e tam bölünmez." },
          { q: "12 ve 18 sayılarının en büyük ortak böleni (ortak bölenlerin en büyüğü) kaçtır?", opts: ["3", "6", "9", "36"], ans: 1, exp: "İkisini de bölen en büyük sayı 6'dır." },
          { q: "İki basamaklı en küçük asal sayı kaçtır?", opts: ["10", "11", "13", "17"], ans: 1, exp: "11 sadece 1 ve 11'e bölünür." }
        ]
      },
      {
        summary: "Bir olayın gerçekleşme ihtimali deneysel (gözleme dayalı) veya teorik olarak incelenir. Bir olayın olasılığı her zaman 0 (imkânsız) ile 1 (kesin) arasında bir değer alır.",
        highlights: ["İmkânsız olayın olasılığı 0'dır.", "Kesin olayın olasılığı 1'dir.", "Deney sayısı arttıkça deneysel olasılık teorik olasılığa yaklaşır."],
        formulas: [
          { title: "Olasılık Formülü", expr: "P(A) = İstenen Durum / Tüm Durumlar", note: "0 ≤ P(A) ≤ 1" }
        ],
        examples: [
          {
            question: "Bir torbada 3 kırmızı, 5 mavi top vardır. Rastgele çekilen bir topun kırmızı olma olasılığı nedir?",
            steps: [
              "Toplam top sayısı: 3 + 5 = 8.",
              "İstenen durum (kırmızı top): 3.",
              "Olasılık = 3 / 8."
            ],
            answer: "3/8"
          },
          {
            question: "Hilesiz bir zar atıldığında üst yüze çift sayı gelme olasılığı kaçtır?",
            steps: [
              "Zarın tüm yüzleri: {1, 2, 3, 4, 5, 6} → 6 durum.",
              "Çift sayılar: {2, 4, 6} → 3 durum.",
              "Olasılık = 3/6 = 1/2."
            ],
            answer: "1/2"
          }
        ],
        quiz: [
          { q: "Hilesiz bir madeni para atıldığında yazı gelme olasılığı nedir?", opts: ["1/4", "1/3", "1/2", "1"], ans: 2, exp: "2 olası sonuçtan 1'i yazıdır: 1/2." },
          { q: "Bir zar atıldığında 7 gelme olasılığı kaçtır?", opts: ["0", "1/6", "1/7", "1"], ans: 0, exp: "Zarda 7 yoktur; imkânsız olayın olasılığı 0'dır." },
          { q: "4 sarı, 6 yeşil bilye bulunan kutudan yeşil gelme olasılığı kaçtır?", opts: ["2/5", "3/5", "1/2", "4/6"], ans: 1, exp: "6 / 10 sadeleşince 3/5 olur." },
          { q: "Aşağıdaki sayılardan hangisi bir olayın olasılık değeri olamaz?", opts: ["0", "0,75", "1", "1,2"], ans: 3, exp: "Olasılık 1'den büyük olamaz." },
          { q: "10 kez atılan bir para 7 kez tura geldiyse deneysel tura olasılığı nedir?", opts: ["1/2", "3/10", "7/10", "7/3"], ans: 2, exp: "Gözlenen sonuç / toplam deneme = 7/10." }
        ]
      }
    ],
    "7": [
      {
        summary: "Tam sayılar pozitif (+), negatif (−) tam sayılar ve 0'dan oluşur. Aynı işaretli tam sayıların çarpımı ve bölümü pozitif, zıt işaretli tam sayıların çarpımı ve bölümü negatiftir.",
        highlights: ["Sayı doğrusunda sağa gidildikçe sayılar büyür.", "(−) · (−) = (+) ve (+) · (−) = (−).", "Mutlak değer bir sayının 0'a olan uzaklığıdır, negatif olamaz."],
        formulas: [
          { title: "İşaret Çarpımı", expr: "(+)(+) = +  |  (−)(−) = +  |  (+)(−) = −", note: "Bölme işleminde de aynı işaret kuralı geçerlidir." },
          { title: "Mutlak Değer", expr: "|−a| = a  (a ≥ 0)", note: "Örn: |−12| = 12" }
        ],
        examples: [
          {
            question: "(−8) + (+13) − (−4) işleminin sonucu kaçtır?",
            steps: [
              "Önce çıkarma işlemini toplamaya çevirelim: −(−4) = +4.",
              "İşlem: (−8) + (+13) + (+4) olur.",
              "−8 + 13 = +5; +5 + 4 = +9."
            ],
            answer: "+9"
          },
          {
            question: "(−6) · (+4) ÷ (−3) işleminin sonucu kaçtır?",
            steps: [
              "Soldan sağa önce çarpma: (−6) · (+4) = −24.",
              "Şimdi bölme: (−24) ÷ (−3).",
              "İki negatif sayının bölümü pozitiftir: +8."
            ],
            answer: "+8"
          }
        ],
        quiz: [
          { q: "(−12) + (+5) işleminin sonucu kaçtır?", opts: ["−17", "−7", "+7", "+17"], ans: 1, exp: "Büyük mutlak değerin işareti alınır: −(12 − 5) = −7." },
          { q: "(−4) · (−7) işleminin sonucu kaçtır?", opts: ["−28", "−11", "+11", "+28"], ans: 3, exp: "İki negatif sayının çarpımı pozitiftir: +28." },
          { q: "|−9| + |+3| toplamı kaçtır?", opts: ["6", "−6", "12", "−12"], ans: 2, exp: "|−9| = 9 ve |+3| = 3; 9 + 3 = 12." },
          { q: "En büyük negatif tam sayı ile en küçük pozitif tam sayının çarpımı kaçtır?", opts: ["−1", "0", "1", "−2"], ans: 0, exp: "(−1) · (+1) = −1." },
          { q: "(−36) ÷ (+4) işleminin sonucu kaçtır?", opts: ["+9", "−9", "−8", "+8"], ans: 1, exp: "Zıt işaretli sayıların bölümü negatiftir: −9." }
        ]
      },
      {
        summary: "Doğrular ve açılar konusunda paralel iki doğrunun bir kesenle yaptığı yöndeş, iç ters ve dış ters açılar birbirine eşittir. Çokgenlerin iç açıları toplamı (n − 2) · 180° formülüyle hesaplanır.",
        highlights: ["Yöndeş açılar aynı yöne bakar ve ölçüleri eşittir.", "İç ters açılar 'Z kuralı' ile kolayca tanınır.", "Tüm dışbükey çokgenlerin dış açıları toplamı 360°'dir."],
        formulas: [
          { title: "Çokgen İç Açılar Toplamı", expr: "(n − 2) · 180°", note: "n: kenar sayısı" },
          { title: "Düzgün Çokgen Bir Dış Açı", expr: "360° / n", note: "Örn: Düzgün altıgende 360°/6 = 60°." }
        ],
        examples: [
          {
            question: "Bir düzgün beşgenin bir iç açısı kaç derecedir?",
            steps: [
              "Önce bir dış açısını bulalım: 360° ÷ 5 = 72°.",
              "Bir iç açı ile bir dış açının toplamı 180°'dir.",
              "İç açı = 180° − 72° = 108°."
            ],
            answer: "108°"
          },
          {
            question: "Bir köşesinden 4 köşegen çizilebilen çokgenin iç açıları toplamı kaç derecedir?",
            steps: [
              "Bir köşeden çizilen köşegen sayısı (n − 3)'tür.",
              "n − 3 = 4 ⇒ n = 7 (yedigen).",
              "İç açılar toplamı = (7 − 2) · 180° = 5 · 180° = 900°."
            ],
            answer: "900°"
          }
        ],
        quiz: [
          { q: "Bir altıgenin iç açıları toplamı kaç derecedir?", opts: ["540°", "720°", "900°", "1080°"], ans: 1, exp: "(6 − 2) · 180° = 4 · 180° = 720°." },
          { q: "Bir düzgün sekizgenin bir dış açısı kaç derecedir?", opts: ["36°", "45°", "60°", "72°"], ans: 1, exp: "360° / 8 = 45°." },
          { q: "Tüm dışbükey çokgenlerin dış açıları toplamı kaç derecedir?", opts: ["180°", "270°", "360°", "540°"], ans: 2, exp: "Kenar sayısından bağımsız olarak her zaman 360°'dir." },
          { q: "Paralel iki doğrunun bir kesenle yaptığı iç ters açılardan biri 68° ise diğeri kaç derecedir?", opts: ["68°", "112°", "22°", "90°"], ans: 0, exp: "İç ters açılar birbirine eşittir: 68°." },
          { q: "Bir dış açısı 40° olan düzgün çokgen kaç kenarlıdır?", opts: ["8", "9", "10", "12"], ans: 1, exp: "360° / 40° = 9 kenarlıdır." }
        ]
      }
    ],
    "8": [
      {
        summary: "LGS'nin temel taşları olan Çarpanlar-Katlar (EBOB/EKOK), Üslü İfadeler ve Kareköklü İfadeler bu ünitede yer alır. Parçadan bütüne gidilirken EKOK, bütünden eş parçalara bölünürken EBOB kullanılır.",
        highlights: ["Aralarında asal iki sayının EBOB'u 1, EKOK'u çarpımlarıdır.", "aᵐ · aⁿ = aᵐ⁺ⁿ ve (aᵐ)ⁿ = aᵐ·ⁿ.", "Tam kare sayılar kök dışına tam sayı olarak çıkar."],
        formulas: [
          { title: "EBOB × EKOK Kuralı", expr: "EBOB(a, b) · EKOK(a, b) = a · b", note: "İki pozitif tam sayı için her zaman geçerlidir." },
          { title: "Üslü Çarpma & Bölme", expr: "aᵐ · aⁿ = aᵐ⁺ⁿ   |   aᵐ / aⁿ = aᵐ⁻ⁿ", note: "Tabanlar eşitse üsler toplanır/çıkarılır." },
          { title: "Karekök Dışına Çıkarma", expr: "√(a² · b) = a√b  (a ≥ 0)", note: "Örn: √72 = √(36·2) = 6√2" }
        ],
        examples: [
          {
            question: "24 ve 36 sayılarının EBOB ve EKOK değerlerinin toplamı kaçtır?",
            steps: [
              "24 = 2³ · 3 ve 36 = 2² · 3² şeklinde asal çarpanlara ayıralım.",
              "EBOB(24, 36) = 2² · 3 = 12.",
              "EKOK(24, 36) = 2³ · 3² = 72. Toplam: 12 + 72 = 84."
            ],
            answer: "84"
          },
          {
            question: "√48 + √27 − √12 işleminin sonucu kaçtır?",
            steps: [
              "Her köklü ifadeyi a√b biçiminde yazalım: √48 = 4√3, √27 = 3√3, √12 = 2√3.",
              "Katsayıları toplayıp çıkaralım: (4 + 3 − 2)√3.",
              "Sonuç: 5√3."
            ],
            answer: "5√3"
          }
        ],
        quiz: [
          { q: "EBOB(18, 24) kaçtır?", opts: ["3", "6", "9", "12"], ans: 1, exp: "18 ve 24'ü bölen en büyük doğal sayı 6'dır." },
          { q: "2⁵ · 2⁻² işleminin sonucu kaçtır?", opts: ["4", "8", "16", "32"], ans: 1, exp: "Üsler toplanır: 2^(5−2) = 2³ = 8." },
          { q: "√50 sayısı aşağıdakilerden hangisine eşittir?", opts: ["2√5", "5√2", "25√2", "10√5"], ans: 1, exp: "√(25·2) = 5√2." },
          { q: "Aralarında asal iki sayının EKOK'u 60 ve sayılardan biri 12 ise diğer sayı kaçtır?", opts: ["4", "5", "6", "10"], ans: 1, exp: "Aralarında asal sayıların EKOK'u çarpımlarıdır: 60 ÷ 12 = 5." },
          { q: "0,00045 sayısının bilimsel gösterimi hangisidir?", opts: ["4,5 · 10⁻⁴", "4,5 · 10⁻⁵", "45 · 10⁻⁵", "0,45 · 10⁻³"], ans: 0, exp: "Virgül 4 basamak sağa kaydırılır: 4,5 · 10⁻⁴." }
        ]
      },
      {
        summary: "Veri analizi konusunda veriler çizgi, sütun ve daire grafiklerine dönüştürülür. Daire grafiğinde tüm verilerin toplamı 360°'lik merkez açıya karşılık gelir.",
        highlights: ["Daire grafiğinde bütün 360°'dir.", "Zamana bağlı değişim en iyi çizgi grafiği ile gösterilir.", "Orantı kurarak veri miktarından merkez açı kolayca bulunur."],
        formulas: [
          { title: "Daire Grafiği Merkez Açısı", expr: "Merkez Açı = (Veri / Toplam) · 360°", note: "Örn: 1/4 oran = 90°." }
        ],
        examples: [
          {
            question: "Bir sınıftaki 36 öğrencinin 12'si futbol, 9'u basketbol, 15'i voleybol oynamaktadır. Daire grafiğinde basketbolun merkez açısı kaç derecedir?",
            steps: [
              "Toplam öğrenci sayısı 36 olduğundan 360° ÷ 36 = 10° (her 1 öğrenci 10°).",
              "Basketbol oynayan 9 öğrenci vardır.",
              "Merkez açı = 9 × 10° = 90°."
            ],
            answer: "90°"
          },
          {
            question: "Bir daire grafiğinde 72° ile gösterilen bir ürün, toplam üretimin yüzde kaçıdır?",
            steps: [
              "Tüm daire 360° ve %100'e eşittir.",
              "72 / 360 sadeleşirse 1 / 5 bulunur.",
              "1 / 5 = %20'dir."
            ],
            answer: "%20"
          }
        ],
        quiz: [
          { q: "Bir daire grafiğinde %25'lik dilim kaç derecelik merkez açı ile gösterilir?", opts: ["45°", "60°", "90°", "120°"], ans: 2, exp: "360°'nin %25'i (1/4'ü) 90°'dir." },
          { q: "Bir haftalık hava sıcaklığı değişimini göstermek için en uygun grafik hangisidir?", opts: ["Daire grafiği", "Çizgi grafiği", "Sütun grafiği", "Histogram"], ans: 1, exp: "Zamana bağlı artış/azalış en iyi çizgi grafiğinde görülür." },
          { q: "Toplam 72 kitabın 18'i matematik kitabıdır. Daire grafiğinde matematik kitaplarının açısı kaç derecedir?", opts: ["60°", "72°", "90°", "108°"], ans: 2, exp: "(18 / 72) · 360° = (1/4) · 360° = 90°." },
          { q: "Daire grafiğinde 144°'lik dilim 24 kişiyi gösteriyorsa toplam kişi sayısı kaçtır?", opts: ["48", "54", "60", "72"], ans: 2, exp: "144° / 24 = 6° (1 kişi). 360° / 6° = 60 kişi." },
          { q: "Bir veri grubunun yüzde 10'u daire grafiğinde kaç dereceye karşılık gelir?", opts: ["10°", "18°", "36°", "72°"], ans: 2, exp: "360° · 10 / 100 = 36°." }
        ]
      }
    ],
    "9": [
      {
        summary: "Gerçek sayılar kümesi rasyonel ve irrasyonel sayıların birleşimidir. Üslü ve köklü ifadelerin özellikleri, sayı aralıkları ve mutlak değer lise matematiğinin temel dilini oluşturur.",
        highlights: ["ℝ = ℚ ∪ ℚ' (Gerçek sayılar).", "Açık aralık (a, b) uç noktaları içermez; kapalı aralık [a, b] içerir.", "Eşlenik ile çarpma paydadaki kökü rasyonelleştirir."],
        formulas: [
          { title: "Kök Eşleniği", expr: "(√a − √b)(√a + √b) = a − b", note: "İki kare farkı özdeşliğinden gelir." },
          { title: "Üslü Denklem", expr: "aˣ = aʸ ⇒ x = y  (a ≠ −1, 0, 1)", note: "Tabanlar eşitse üsler eşittir." }
        ],
        examples: [
          {
            question: "3ˣ⁺¹ = 81 denklemini sağlayan x değeri kaçtır?",
            steps: [
              "81 sayısını 3 tabanında yazalım: 81 = 3⁴.",
              "3ˣ⁺¹ = 3⁴ olduğundan tabanlar eşittir.",
              "x + 1 = 4 ⇒ x = 3."
            ],
            answer: "x = 3"
          },
          {
            question: "6 / √3 kesrinin paydasını rasyonel yapınız.",
            steps: [
              "Pay ve paydayı √3 ile genişletelim: (6√3) / (√3 · √3).",
              "Payda √3 · √3 = 3 olur.",
              "6√3 / 3 = 2√3."
            ],
            answer: "2√3"
          }
        ],
        quiz: [
          { q: "Aşağıdakilerden hangisi irrasyonel sayıdır?", opts: ["√16", "0,25", "√7", "−3/5"], ans: 2, exp: "√7 iki tam sayının oranı şeklinde yazılamaz." },
          { q: "2ˣ⁻² = 32 ise x kaçtır?", opts: ["5", "6", "7", "8"], ans: 2, exp: "32 = 2⁵ ⇒ x − 2 = 5 ⇒ x = 7." },
          { q: "[−2, 5) aralığında kaç tane tam sayı vardır?", opts: ["6", "7", "8", "5"], ans: 1, exp: "−2, −1, 0, 1, 2, 3, 4 → toplam 7 tam sayı." },
          { q: "|x − 3| = 5 denkleminin kökler toplamı kaçtır?", opts: ["3", "5", "6", "8"], ans: 2, exp: "x − 3 = 5 ⇒ x = 8 ve x − 3 = −5 ⇒ x = −2; toplam 6." },
          { q: "10 / √5 ifadesinin eşiti nedir?", opts: ["2√5", "5√2", "√5", "2"], ans: 0, exp: "10√5 / 5 = 2√5." }
        ]
      },
      {
        summary: "Doğrusal fonksiyonlar f(x) = ax + b biçimindedir ve grafikleri bir doğrudur. Eğim (a) değişim oranını, sabit terim (b) ise y eksenini kesim noktasını belirler.",
        highlights: ["a > 0 ise fonksiyon artan, a < 0 ise azalandır.", "x = 0 için y eksenini kestiği nokta bulunur.", "y = 0 için x eksenini kestiği nokta (sıfırı) bulunur."],
        formulas: [
          { title: "Doğrusal Fonksiyon", expr: "f(x) = ax + b", note: "a: eğim, b: y-eksenini kestiği nokta" }
        ],
        examples: [
          {
            question: "f(x) = 3x − 6 fonksiyonunun eksenleri kestiği noktaları bulunuz.",
            steps: [
              "y eksenini kestiği nokta için x = 0: f(0) = −6 → (0, −6).",
              "x eksenini kestiği nokta için f(x) = 0: 3x − 6 = 0 ⇒ x = 2 → (2, 0).",
              "Doğru (2, 0) ve (0, −6) noktalarından geçer."
            ],
            answer: "(2, 0) ve (0, −6)"
          },
          {
            question: "f(x) = 2x + 5 için f(4) − f(1) değeri kaçtır?",
            steps: [
              "f(4) = 2(4) + 5 = 13.",
              "f(1) = 2(1) + 5 = 7.",
              "13 − 7 = 6."
            ],
            answer: "6"
          }
        ],
        quiz: [
          { q: "f(x) = 4x − 3 ise f(2) kaçtır?", opts: ["3", "5", "7", "8"], ans: 1, exp: "4(2) − 3 = 8 − 3 = 5." },
          { q: "f(x) = −2x + 8 fonksiyonunun sıfırı (x eksenini kestiği nokta) kaçtır?", opts: ["−4", "2", "4", "8"], ans: 2, exp: "−2x + 8 = 0 ⇒ x = 4." },
          { q: "f(x) = 5x + 1 doğrusal fonksiyonunun eğimi kaçtır?", opts: ["1", "5", "6", "−5"], ans: 1, exp: "x'in katsayısı eğimdir: 5." },
          { q: "f(x) = ax + 2 ve f(3) = 11 ise a kaçtır?", opts: ["2", "3", "4", "5"], ans: 1, exp: "3a + 2 = 11 ⇒ 3a = 9 ⇒ a = 3." },
          { q: "Aşağıdakilerden hangisi azalan bir doğrusal fonksiyondur?", opts: ["f(x) = 3x + 1", "f(x) = x − 5", "f(x) = −4x + 7", "f(x) = 5"], ans: 2, exp: "Eğimi negatif (−4 < 0) olan fonksiyon azalandır." }
        ]
      }
    ],
    "10": [
      {
        summary: "Dik üçgende Pisagor teoremi ve trigonometrik oranlar (sin, cos, tan, cot) ile üçgenin kenarları ve açıları arasında güçlü ilişkiler kurulur.",
        highlights: ["Pisagor: a² + b² = c² (hipotenüs en uzun kenardır).", "3-4-5, 5-12-13, 8-15-17 özel dik üçgenlerdir.", "sin²α + cos²α = 1 temel trigonometrik özdeşliktir."],
        formulas: [
          { title: "Pisagor Teoremi", expr: "a² + b² = c²", note: "c hipotenüs uzunluğudur." },
          { title: "Temel Trigonometri", expr: "sin α = Karşı / Hipotenüs  |  cos α = Komşu / Hipotenüs", note: "tan α = sin α / cos α" }
        ],
        examples: [
          {
            question: "Dik kenarları 6 cm ve 8 cm olan dik üçgenin hipotenüsü kaç cm'dir?",
            steps: [
              "Pisagor bağıntısı: c² = 6² + 8².",
              "c² = 36 + 64 = 100.",
              "c = √100 = 10 cm (3-4-5 üçgeninin 2 katı)."
            ],
            answer: "10 cm"
          },
          {
            question: "Dar açılı bir dik üçgende sin α = 3/5 ise cos α kaçtır?",
            steps: [
              "sin²α + cos²α = 1 özdeşliğini kullanalım.",
              "(3/5)² + cos²α = 1 ⇒ cos²α = 1 − 9/25 = 16/25.",
              "α dar açı olduğundan cos α = 4/5."
            ],
            answer: "4/5"
          }
        ],
        quiz: [
          { q: "Dik kenarları 5 cm ve 12 cm olan dik üçgenin hipotenüsü kaç cm'dir?", opts: ["13", "14", "15", "17"], ans: 0, exp: "5² + 12² = 25 + 144 = 169 = 13²." },
          { q: "sin 30° değeri kaçtır?", opts: ["1/2", "√2/2", "√3/2", "1"], ans: 0, exp: "30-60-90 üçgeninde 30° karşısı hipotenüsün yarısıdır." },
          { q: "tan 45° + cos 60° toplamı kaçtır?", opts: ["1", "3/2", "2", "5/2"], ans: 1, exp: "1 + 1/2 = 3/2." },
          { q: "sin²40° + cos²40° toplamı kaçtır?", opts: ["0", "1/2", "1", "2"], ans: 2, exp: "Her açı için sin²α + cos²α = 1'dir." },
          { q: "Hipotenüsü 10 cm ve bir dik kenarı 6 cm olan üçgenin alanı kaç cm²'dir?", opts: ["24", "30", "48", "60"], ans: 0, exp: "Diğer dik kenar 8 cm'dir; Alan = (6 · 8)/2 = 24." }
        ]
      },
      {
        summary: "İstatistiksel araştırma sürecinde iki kategorik değişken arasındaki ilişki iki yönlü sıklık tabloları ve koşullu göreli sıklıklar yardımıyla analiz edilir.",
        highlights: ["Satır ve sütun toplamları genel toplamı verir.", "Koşullu olasılık/sıklık belirli bir alt gruba odaklanır.", "Veri yorumlamada örneklem büyüklüğü önemlidir."],
        formulas: [
          { title: "Göreli Sıklık", expr: "Göreli Sıklık = Alt Grup Sayısı / Toplam", note: "Yüzde olarak ifade edilebilir." }
        ],
        examples: [
          {
            question: "Bir ankete katılan 80 öğrencinin 50'si spor yapıyor, spor yapanların 30'u kız öğrencidir. Spor yapanlar arasında kız öğrencilerin oranı yüzde kaçtır?",
            steps: [
              "Koşul grubu: Spor yapanlar = 50 kişi.",
              "Bu gruptaki kız öğrenci sayısı: 30 kişi.",
              "Oran: 30 / 50 = 60 / 100 = %60."
            ],
            answer: "%60"
          },
          {
            question: "200 kişilik bir okulda 40 öğrenci satranç kulübündedir. Satranç kulübünün göreli sıklığı nedir?",
            steps: [
              "Göreli sıklık = 40 / 200.",
              "Sadeleştirelim: 1 / 5 = 0,20 (%20)."
            ],
            answer: "0,20 (%20)"
          }
        ],
        quiz: [
          { q: "50 kişilik grupta 15 kişi gözlük takıyorsa göreli sıklık yüzde kaçtır?", opts: ["%15", "%25", "%30", "%35"], ans: 2, exp: "15 / 50 = 30 / 100 = %30." },
          { q: "İki kategorik değişkenin ilişkisini özetleyen tablo türü hangisidir?", opts: ["İki yönlü sıklık tablosu", "Çizgi grafiği", "Kutu grafiği", "Sayı doğrusu"], ans: 0, exp: "İki kategorik değişken satır ve sütunlarda eşleştirilir." },
          { q: "40 kız, 60 erkek öğrencinin bulunduğu grupta kızların oranı nedir?", opts: ["0,3", "0,4", "0,5", "0,6"], ans: 1, exp: "40 / 100 = 0,4." },
          { q: "Bir anketin tüm göreli sıklıklarının toplamı kaçtır?", opts: ["0", "0,5", "1", "10"], ans: 2, exp: "Tüm kategorilerin oranları toplamı 1 (%100) eder." },
          { q: "25 deneyde 20 başarı elde edildiyse başarı yüzdesi kaçtır?", opts: ["%75", "%80", "%85", "%90"], ans: 1, exp: "20 / 25 = 80 / 100 = %80." }
        ]
      }
    ],
    "11": [
      {
        summary: "İstatistiksel araştırma sürecinde merkezî eğilim (aritmetik ortalama, medyan, mod) ve yayılım ölçüleri (açıklık, standart sapma) ile veri dağılımları karşılaştırılır.",
        highlights: ["Medyan sıralı veride tam ortadaki değerdir.", "Mod en çok tekrar eden değerdir.", "Standart sapma küçükse veriler ortalamaya yakındır (homojen)."],
        formulas: [
          { title: "Aritmetik Ortalama", expr: "x̄ = (x₁ + x₂ + ... + xₙ) / n", note: "Verilerin toplamı / veri sayısı" },
          { title: "Açıklık (Ranj)", expr: "R = En Büyük Değer − En Küçük Değer", note: "Yayılımın en hızlı göstergesidir." }
        ],
        examples: [
          {
            question: "4, 7, 7, 10, 12 veri grubunun aritmetik ortalaması ve medyanı kaçtır?",
            steps: [
              "Veriler zaten küçükten büyüğe sıralıdır. Ortadaki (3.) terim medyan = 7.",
              "Toplam: 4 + 7 + 7 + 10 + 12 = 40.",
              "Aritmetik ortalama: 40 ÷ 5 = 8."
            ],
            answer: "Ortalama = 8, Medyan = 7"
          },
          {
            question: "Bir sınıfta iki sınavın ortalamaları eşit ancak 1. sınavın standart sapması 4, 2. sınavın standart sapması 11 ise hangi sınav daha homojendir?",
            steps: [
              "Standart sapma verilerin ortalamadan uzaklığını ölçer.",
              "4 < 11 olduğundan 1. sınavda notlar birbirine daha yakındır."
            ],
            answer: "1. sınav daha homojendir"
          }
        ],
        quiz: [
          { q: "3, 5, 8, 8, 11 veri grubunun modu (tepe değeri) kaçtır?", opts: ["5", "7", "8", "11"], ans: 2, exp: "En sık tekrar eden değer 8'dir." },
          { q: "10, 14, 18, 22 sayılarının aritmetik ortalaması kaçtır?", opts: ["15", "16", "17", "18"], ans: 1, exp: "(10+14+18+22)/4 = 64/4 = 16." },
          { q: "5, 9, 12, 15, 29 veri grubunun açıklığı kaçtır?", opts: ["12", "17", "24", "29"], ans: 2, exp: "29 − 5 = 24." },
          { q: "2, 4, 6, 8, 10 veri grubunun medyanı kaçtır?", opts: ["4", "5", "6", "7"], ans: 2, exp: "Sıralı 5 verinin tam ortasındaki değer 6'dır." },
          { q: "Tüm verileri aynı sayı (ör. 7, 7, 7, 7) olan bir grubun standart sapması kaçtır?", opts: ["0", "1", "7", "4"], ans: 0, exp: "Ortalamadan sapma yoktur, standart sapma 0'dır." }
        ]
      },
      {
        summary: "Çemberde açılar, kirişler, teğetler ve çemberin çevresi/dairenin alanı analitik ve geometrik özelliklerle incelenir.",
        highlights: ["Merkez açı gördüğü yaya eşittir.", "Çevre açı gördüğü yayın yarısına eşittir.", "Çapı gören çevre açı daima 90°'dir."],
        formulas: [
          { title: "Dairenin Alanı & Çevresi", expr: "Ç = 2πr   |   A = πr²", note: "r: yarıçap" }
        ],
        examples: [
          {
            question: "Bir çemberde 80°'lik yayı gören çevre açı kaç derecedir?",
            steps: [
              "Çevre açı gördüğü yayın ölçüsünün yarısına eşittir.",
              "80° ÷ 2 = 40°."
            ],
            answer: "40°"
          },
          {
            question: "Yarıçapı 6 cm olan bir dairenin 60°'lik diliminin alanı kaç π cm²'dir?",
            steps: [
              "Tam daire alanı: π · 6² = 36π.",
              "60° / 360° = 1/6 dilim.",
              "Dilim alanı = 36π / 6 = 6π."
            ],
            answer: "6π cm²"
          }
        ],
        quiz: [
          { q: "Çapı gören çevre açının ölçüsü kaç derecedir?", opts: ["45°", "60°", "90°", "180°"], ans: 2, exp: "Çap 180°'lik yay görür; yarısı 90°'dir." },
          { q: "Merkez açısı 70° olan yayın çevre açısı kaç derecedir?", opts: ["35°", "70°", "105°", "140°"], ans: 0, exp: "Yay 70° olduğundan çevre açı 70°/2 = 35°." },
          { q: "Yarıçapı 5 cm olan dairenin alanı kaç π cm²'dir?", opts: ["10π", "15π", "25π", "50π"], ans: 2, exp: "A = πr² = 25π." },
          { q: "Çevresi 12π cm olan çemberin yarıçapı kaç cm'dir?", opts: ["3", "4", "6", "12"], ans: 2, exp: "2πr = 12π ⇒ r = 6." },
          { q: "Bir çemberde 50°'lik çevre açının gördüğü yay kaç derecedir?", opts: ["25°", "50°", "100°", "150°"], ans: 2, exp: "Yay = 2 · 50° = 100°." }
        ]
      }
    ],
    "12": [
      {
        summary: "Üstel fonksiyon f(x) = aˣ (a > 0, a ≠ 1) bire bir ve örtendir; tersi logaritma fonksiyonudur: y = aˣ ⇔ x = logₐ(y). AYT'nin en yüksek net getiren konularından biridir.",
        highlights: ["logₐ(1) = 0 ve logₐ(a) = 1.", "logₐ(x · y) = logₐx + logₐy.", "Tanım kümesi için logaritmanın içi kesinlikle pozitif (> 0) olmalıdır."],
        formulas: [
          { title: "Üstel – Logaritma Geçişi", expr: "aˣ = b  ⇔  x = logₐ(b)", note: "a > 0, a ≠ 1, b > 0" },
          { title: "Çarpım & Bölüm Kuralı", expr: "logₐ(x·y) = logₐx + logₐy", note: "logₐ(x/y) = logₐx − logₐy" }
        ],
        examples: [
          {
            question: "log₂(32) + log₃(27) − log₅(1) işleminin sonucu kaçtır?",
            steps: [
              "32 = 2⁵ ⇒ log₂(32) = 5.",
              "27 = 3³ ⇒ log₃(27) = 3 ve log₅(1) = 0.",
              "5 + 3 − 0 = 8."
            ],
            answer: "8"
          },
          {
            question: "log₃(x − 2) = 2 denklemini sağlayan x değeri kaçtır?",
            steps: [
              "Üstel biçime geçelim: x − 2 = 3².",
              "x − 2 = 9 ⇒ x = 11.",
              "Kontrol: 11 − 2 = 9 > 0 olduğundan geçerlidir."
            ],
            answer: "x = 11"
          }
        ],
        quiz: [
          { q: "log₂(16) değeri kaçtır?", opts: ["2", "3", "4", "8"], ans: 2, exp: "2⁴ = 16 olduğundan sonuç 4." },
          { q: "log₁₀(1000) + log₇(1) toplamı kaçtır?", opts: ["2", "3", "4", "10"], ans: 1, exp: "3 + 0 = 3." },
          { q: "log₂(x) = 5 ise x kaçtır?", opts: ["10", "25", "32", "64"], ans: 2, exp: "x = 2⁵ = 32." },
          { q: "log₆(2) + log₆(3) toplamı kaçtır?", opts: ["0", "1", "2", "6"], ans: 1, exp: "log₆(2 · 3) = log₆(6) = 1." },
          { q: "ln(e⁴) ifadesinin değeri kaçtır?", opts: ["1", "2", "4", "e"], ans: 2, exp: "ln(e⁴) = 4 · ln(e) = 4." }
        ]
      },
      {
        summary: "Tanım kümesi pozitif tam sayılar (ℤ⁺) olan fonksiyonlara dizi denir. Ardışık terimleri arasındaki farkı sabit olan diziler aritmetik, oranı sabit olan diziler geometrik dizidir.",
        highlights: ["Aritmetik dizide genel terim: aₙ = a₁ + (n − 1)d.", "Geometrik dizide genel terim: aₙ = a₁ · rⁿ⁻¹.", "İlk n terim toplamı formülleri AYT sorularında sık kullanılır."],
        formulas: [
          { title: "Aritmetik Dizi", expr: "aₙ = a₁ + (n − 1)·d", note: "d: ortak fark" },
          { title: "Geometrik Dizi", expr: "aₙ = a₁ · rⁿ⁻¹", note: "r: ortak çarpan" }
        ],
        examples: [
          {
            question: "İlk terimi 4 ve ortak farkı 3 olan aritmetik dizinin 10. terimi kaçtır?",
            steps: [
              "Formül: aₙ = a₁ + (n − 1)·d.",
              "a₁₀ = 4 + (10 − 1)·3 = 4 + 27.",
              "a₁₀ = 31."
            ],
            answer: "31"
          },
          {
            question: "İlk terimi 2 ve ortak çarpanı 3 olan geometrik dizinin 4. terimi kaçtır?",
            steps: [
              "Formül: aₙ = a₁ · rⁿ⁻¹.",
              "a₄ = 2 · 3³ = 2 · 27 = 54."
            ],
            answer: "54"
          }
        ],
        quiz: [
          { q: "Genel terimi aₙ = 3n + 2 olan dizinin 5. terimi kaçtır?", opts: ["15", "17", "19", "21"], ans: 1, exp: "3(5) + 2 = 17." },
          { q: "İlk terimi 5, ortak farkı 4 olan aritmetik dizinin 6. terimi kaçtır?", opts: ["21", "25", "29", "30"], ans: 1, exp: "a₆ = 5 + 5·4 = 25." },
          { q: "İlk terimi 3, ortak çarpanı 2 olan geometrik dizinin 5. terimi kaçtır?", opts: ["24", "32", "48", "96"], ans: 2, exp: "a₅ = 3 · 2⁴ = 3 · 16 = 48." },
          { q: "Bir aritmetik dizide a₃ = 10 ve a₇ = 26 ise ortak fark (d) kaçtır?", opts: ["2", "3", "4", "5"], ans: 2, exp: "(26 − 10) / (7 − 3) = 16 / 4 = 4." },
          { q: "aₙ = (−1)ⁿ · n dizisinin 3. terimi kaçtır?", opts: ["−3", "3", "−1", "1"], ans: 0, exp: "(−1)³ · 3 = −3." }
        ]
      }
    ]
  };

  /* AI Mentör Tek Soruluk Kayıtsız Demo (Kart 2 için) */
  var AI_MENTOR_DEMO = {
    "5": {
      question: "Bir dikdörtgenin kısa kenarı 8 cm, uzun kenarı ise kısa kenarının 2 katından 3 cm eksiktir. Bu dikdörtgenin çevresi kaç cm'dir?",
      steps: [
        { role: "🤖 İpucu 1", text: "Önce uzun kenarı bulalım: Kısa kenarın (8 cm) 2 katı kaç eder? Ondan 3 çıkarırsan ne bulursun?", reveal: "Uzun kenar = (8 × 2) − 3 = 16 − 3 = 13 cm." },
        { role: "🤖 İpucu 2", text: "Harika! Şimdi dikdörtgenin çevresi için bir kısa + bir uzun kenarı toplayıp 2 ile çarpalım.", reveal: "Çevre = 2 × (8 + 13) = 2 × 21 = 42 cm." },
        { role: "✅ Sonuç", text: "Tebrikler! Formülü ezberlemeden adım adım 42 cm sonucuna ulaştın.", reveal: "Cevap: 42 cm" }
      ]
    },
    "default": {
      question: "2x + 7 = 19 denklemini sağlayan x değerini adım adım bulalım.",
      steps: [
        { role: "🤖 İpucu 1", text: "Amacımız x'i tek bırakmak. Eşitliğin solundaki +7'yi yok etmek için her iki taraftan hangi sayıyı çıkarmalıyız?", reveal: "Her iki taraftan 7 çıkaralım: 2x = 19 − 7 ⇒ 2x = 12." },
        { role: "🤖 İpucu 2", text: "Çok güzel! Şimdi 2x = 12 eşitliğinde x'i bulmak için iki tarafı kaça bölmeliyiz?", reveal: "Her iki tarafı 2'ye bölelim: x = 12 ÷ 2 = 6." },
        { role: "✅ Sonuç", text: "Harika gidiyorsun! Kontrol edelim: 2(6) + 7 = 19. Doğru çözüm!", reveal: "Cevap: x = 6" }
      ]
    }
  };

  /* Haftalık Çalışma Planı Önizlemesi (Kart 3 için) */
  var WEEKLY_PREVIEW = [
    { day: "Pazartesi", task: "1. Ünite Konu Özeti & 2 Çözümlü Örnek", mins: "25 dk", tag: "Konu" },
    { day: "Çarşamba", task: "Kendini Dene: 5 Soruluk Mini Kontrol + AI İpucu", mins: "20 dk", tag: "Pratik" },
    { day: "Cuma", task: "2. Ünite Video Ders & Kazanım Pekiştirme", mins: "30 dk", tag: "Kazanım" },
    { day: "Pazar", task: "Haftalık 20 Soruluk Tarama & Gelişim Karnesi", mins: "35 dk", tag: "Karne" }
  ];

  function getGradeUnits(grade) {
    var g = String(grade || "5");
    var raw = (global.MATEMATIK_MUFREDATI && global.MATEMATIK_MUFREDATI[g]) || [];
    var openData = OPEN_TOPICS[g] || OPEN_TOPICS["5"];

    return raw.map(function (unit, idx) {
      var isOpen = idx < 2;
      var rich = isOpen ? (openData[idx] || openData[0]) : null;
      return {
        index: idx,
        title: unit.title || (idx + 1) + ". Ünite",
        unitTopic: unit.unit_topic || unit.title,
        subtopics: Array.isArray(unit.topics) ? unit.topics : [],
        isOpen: isOpen,
        summary: rich ? rich.summary : "",
        highlights: rich ? rich.highlights : [],
        formulas: rich ? rich.formulas : [],
        examples: rich ? rich.examples : [],
        quiz: rich ? rich.quiz : []
      };
    });
  }

  global.ZarifFreemiumData = {
    GRADE_META: GRADE_META,
    WEEKLY_PREVIEW: WEEKLY_PREVIEW,
    getGradeUnits: getGradeUnits,
    getAiDemo: function (grade) {
      return AI_MENTOR_DEMO[String(grade)] || AI_MENTOR_DEMO["default"];
    }
  };
})(window);
