// Kaynak: mufredat_donusturucu/kazanimlar/*.json içindeki unit_topic alanları (TYMM resmi ünite adları)
const SINIF_KONULARI = {
  5: [
    "Sayılar ve Nicelikler",
    "İşlemlerle Cebirsel Düşünme ve Değişimler",
    "Geometrik Şekiller",
    "Geometrik Nicelikler",
    "İstatistiksel Araştırma Süreci",
    "Veriden Olasılığa"
  ],
  6: [
    "Sayılar ve Nicelikler",
    "İşlemlerle Cebirsel Düşünme ve Değişimler",
    "Geometrik Şekiller",
    "Geometrik Nicelikler",
    "İstatistiksel Araştırma Süreci",
    "Veriden Olasılığa"
  ],
  7: [
    "Sayılar ve Nicelikler",
    "İşlemlerle Cebirsel Düşünme ve Değişimler",
    "Dönüşüm",
    "Geometrik Nicelikler",
    "Geometrik Şekiller",
    "İstatistiksel Araştırma Süreci",
    "Veriden Olasılığa"
  ],
  8: [
    "Sayılar ve İşlemler / Çarpanlar ve Katlar",
    "Sayılar ve İşlemler / Üslü İfadeler",
    "Sayılar ve İşlemler / Kareköklü İfadeler",
    "Cebir / Cebirsel İfadeler ve Özdeşlikler",
    "Cebir / Doğrusal Denklemler",
    "Cebir / Eşitsizlikler",
    "Geometri ve Ölçme / Üçgenler",
    "Geometri ve Ölçme / Dönüşüm Geometrisi",
    "Geometri ve Ölçme / Eşlik ve Benzerlik",
    "Geometri ve Ölçme / Geometrik Cisimler",
    "Veri İşleme / Veri Analizi",
    "Olasılık / Basit Olayların Olma Olasılığı"
  ],
  9: [
    "Sayılar",
    "Nicelikler ve Değişimler",
    "Geometrik Şekiller",
    "Eşlik ve Benzerlik",
    "Algoritma ve Bilişim",
    "İstatistiksel Araştırma Süreci",
    "Veriden Olasılığa"
  ],
  10: [
    "Geometrik Şekiller",
    "İstatistiksel Araştırma Süreci",
    "Sayılar",
    "Nicelikler ve Değişimler",
    "Sayma, Algoritma ve Bilişim",
    "Analitik İnceleme",
    "Veriden Olasılığa"
  ],
  11: [
    "İstatistiksel Araştırma Süreci",
    "Geometrik Şekiller",
    "Nicelikler ve Değişimler"
  ],
  12: [
    "Üstel Fonksiyon",
    "Logaritma Fonksiyonu",
    "Üstel, Logaritmik Denklemler ve Eşitsizlikler",
    "Gerçek Sayı Dizileri",
    "Toplam-Fark ve İki kat Açı Formülleri",
    "Trigonometrik Denklemler",
    "Analitik Düzlemde Temel Dönüşümler",
    "Limit ve Süreklilik",
    "Anlık Değişim Oranı ve Türev",
    "Türevin Uygulamaları",
    "Belirsiz İntegral",
    "Belirli İntegral ve Uygulamaları",
    "Çemberin Analitik İncelenmesi"
  ],
};

const TUM_KONULAR = new Set(Object.values(SINIF_KONULARI).flat());

module.exports = { SINIF_KONULARI, TUM_KONULAR };
