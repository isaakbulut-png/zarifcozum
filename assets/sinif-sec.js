/**
 * ZarifÇözüm — Anasayfa "Sınıfını seç" İnteraktif Vitrin Kontrolcüsü
 * 5. sınıftan 12. sınıfa kadar sayfa yenilemeden yumuşak animasyonla vitrini günceller.
 */
(function (global) {
  'use strict';

  var sinifVerileri = {
    5: {
      sinif: 5,
      bg: '#FDF3EB',
      accent: '#C85A17',
      etiket: '5. SINIF • MAARİF MODELİ',
      baslik: 'Matematiği Korkmadan, Keşfederek Sevmeye Başla',
      aciklama: 'Çocuğunuzun ortaokul matematik yolculuğunu sağlam temellerle destekleyin. Türkiye Yüzyılı Maarif Modeli\'ne uygun görsel konu özetleri ve oyunlaştırılmış pratiklerle matematiği somut ve keyifli hâle getirin.',
      ozellikler: [
        { icon: 'book-open', text: 'Görsel ve Etkileşimli Konu Özetleri' },
        { icon: 'check-circle-2', text: 'Adım Adım Çözümlü Pratik Sorular' },
        { icon: 'flame', text: 'XP ve Günlük Seri ile Oyunlaştırılmış Takip' }
      ],
      ikincilCta: { label: '🧪 5. Sınıf Keşif Laboratuvarı', href: 'pages/matematigi-kesfet.html?sinif=5' },
      floatingKartlar: ['145 XP • 5 Gün Seri 🔥', 'Maarif Modeli %100 Uyumlu', 'AI Mentör: 7/24 Destek'],
      gorselBaslik: 'Ortaokul Başlangıç Stüdyosu',
      gorselAlt: 'Sayılar, Kesirler ve Geometrik Şekiller'
    },
    6: {
      sinif: 6,
      bg: '#FDF0EE',
      accent: '#B83B2B',
      etiket: '6. SINIF • MAARİF MODELİ',
      baslik: 'Kavramları Somutlaştır, Analitik Düşünme Becerisi Kazan',
      aciklama: 'Çocuğunuzun kesirler, cebirsel ifadeler ve veri analizi gibi temel konularda mantık kurmasını sağlayın. Uzman öğretmenlerin hazırladığı konu anlatımları ve kazanım testleriyle eksiksiz ilerleyin.',
      ozellikler: [
        { icon: 'layers', text: 'Mantık Odaklı Formül ve Konu Kartları' },
        { icon: 'sparkles', text: 'Anında Çözüm Gösteren Soru Pratiği' },
        { icon: 'bar-chart-3', text: 'Konu Sonu Kazanım Testi ve Başarı Karnesi' }
      ],
      ikincilCta: { label: '🧪 6. Sınıf Keşif Laboratuvarı', href: 'pages/matematigi-kesfet.html?sinif=6' },
      floatingKartlar: ['Adım Adım Çözüm Desteği', 'Başarı Grafiği & Karne', 'MEB Maarif Uyumlu'],
      gorselBaslik: 'Kavram & Mantık Atölyesi',
      gorselAlt: 'Çarpanlar, Kesirler ve Cebirsel İfadeler'
    },
    7: {
      sinif: 7,
      bg: '#F8F0F6',
      accent: '#8E3B78',
      etiket: '7. SINIF • MAARİF MODELİ (YENİ)',
      baslik: 'Yeni Nesil Sorulara Geçişte Güçlü Bir Altyapı Kur',
      aciklama: 'Çocuğunuzun rasyonel sayılar ve denklemlerle hız kazanmasını, okuduğunu anlama ve yorumlama becerisini geliştirmesini sağlayın. Gelecek yılın sınav temposuna şimdiden özgüvenle hazırlanın.',
      ozellikler: [
        { icon: 'compass', text: 'Yeni Nesil Beceri Temelli Soru Pratiği' },
        { icon: 'play-circle', text: 'Maarif Modeli Uyumlu Video Dersler' },
        { icon: 'calendar-check', text: 'Haftalık Kişisel Çalışma Takvimi' }
      ],
      ikincilCta: { label: '🧪 7. Sınıf Keşif Laboratuvarı', href: 'pages/matematigi-kesfet.html?sinif=7' },
      floatingKartlar: ['Beceri Temelli Sorular', 'AI Mentör 7/24 Yanında', 'Yeni Maarif Programı'],
      gorselBaslik: 'Yeni Nesil Problem Kampı',
      gorselAlt: 'Rasyonel Sayılar, Oran-Orantı ve Denklemler'
    },
    8: {
      sinif: 8,
      bg: '#F9EFEF',
      accent: '#962828',
      etiket: '8. SINIF • LGS HAZIRLIK PROGRAMI',
      baslik: 'LGS Yolculuğunda Eksiksiz Konu Hakimiyeti ve Net Artışı',
      aciklama: 'Çocuğunuzun LGS sürecini plansız stresten uzak, ölçülebilir hedeflerle yönetin. MEB müfredatıyla birebir uyumlu konu özetleri, yeni nesil soru çözümleri ve deneme analizleriyle hedef liseye adım adım yaklaşın.',
      ozellikler: [
        { icon: 'target', text: 'LGS Tarzı Yeni Nesil Soru Çözümleri' },
        { icon: 'bot', text: 'AI Mentör ile Takıldığı Soruda Anında Destek' },
        { icon: 'trending-up', text: 'Kazanım Bazlı Eksik Kapatma ve Başarı Analizi' }
      ],
      ikincilCta: { label: '🧪 8. Sınıf Keşif Laboratuvarı', href: 'pages/matematigi-kesfet.html?sinif=8' },
      floatingKartlar: ['Hedef LGS • Net Takibi 🎯', 'AI Mentör: Birlikte Çözelim', 'Türkiye Geneli Deneme'],
      gorselBaslik: 'LGS Strateji & Net Merkezi',
      gorselAlt: 'Üslü-Kareköklü İfadeler ve Olasılık'
    },
    9: {
      sinif: 9,
      bg: '#EEF6F7',
      accent: '#1B6B78',
      etiket: '9. SINIF • LİSE MAARİF MODELİ',
      baslik: 'Lise Matematiğine Sağlam Başla, Yazılılarda Fark Yarat',
      aciklama: 'Lisenin ilk yılında değişen müfredata ve soyut kavramlara kolayca adapte ol. Türkiye Yüzyılı Maarif Modeli\'ne özel hazırlanan konu anlatımları ve yazılıya hazırlık modülleriyle ortalamanı yüksek tut.',
      ozellikler: [
        { icon: 'award', text: 'Lise Maarif Müfredatına Tam Uyum' },
        { icon: 'file-text', text: 'Okul Sınavlarına Özel Yazılıya Hazırlık' },
        { icon: 'calendar-days', text: 'Kişiselleştirilebilir Haftalık Ders Programı' }
      ],
      ikincilCta: { label: 'Çalışma Planımı Oluştur', href: 'pages/kisisel-calisma-plani.html' },
      floatingKartlar: ['Yazılıya Hazırlık Modülü', 'Maarif Modeli Lise', 'AI Mentör: 7/24 Çözüm'],
      gorselBaslik: 'Lise Matematik Temeli',
      gorselAlt: 'Gerçek Sayılar, Kümeler ve Üçgenler'
    },
    10: {
      sinif: 10,
      bg: '#EFF7F3',
      accent: '#1E7550',
      etiket: '10. SINIF • LİSE MAARİF MODELİ',
      baslik: 'Fonksiyonlar ve Geometri Temelini Güçlendir, Geleceğe Hazırlan',
      aciklama: 'Üniversite sınavının bel kemiğini oluşturan 10. sınıf konularını ezberlemeden, mantığını kavrayarak öğren. Konu pratikleri ve kazanım testleriyle hem okul başarını hem TYT temelini sağlamlaştır.',
      ozellikler: [
        { icon: 'lightbulb', text: 'Formüllerin Mantığını Öğreten Konu Özetleri' },
        { icon: 'pen-tool', text: 'Sınırsız Konu Pratiği ve Çözüm Adımları' },
        { icon: 'pie-chart', text: 'Detaylı Performans ve Gelişim Raporları' }
      ],
      ikincilCta: { label: 'Kazanım Testini Başlat', href: 'ogrenci-paneli.html#kazanim-testi' },
      floatingKartlar: ['TYT Temeli Güçleniyor', 'Kazanım Testi Karnesi', 'MEB Maarif Uyumlu'],
      gorselBaslik: 'Fonksiyon & Geometri Üssü',
      gorselAlt: 'Fonksiyonlar, Polinomlar ve Çokgenler'
    },
    11: {
      sinif: 11,
      bg: '#EFF3FA',
      accent: '#2B59A8',
      etiket: '11. SINIF • MAARİF MODELİ (YENİ)',
      baslik: 'AYT Matematiğin Kalbine Odaklan, Rakiplerinin Önüne Geç',
      aciklama: 'Trigonometri ve analitik geometri gibi belirleyici konularda derinlemesine uzmanlaş. 11. sınıf konularını zamanında bitirerek 12. sınıfa büyük bir avantaj ve özgüvenle başla.',
      ozellikler: [
        { icon: 'compass', text: 'AYT Odaklı Derinlemesine Konu Anlatımları' },
        { icon: 'bot', text: 'AI Mentör ile 7/24 Kişisel Soru Koçluğu' },
        { icon: 'calendar-range', text: 'Akıllı Haftalık Çalışma Planı Oluşturucu' }
      ],
      ikincilCta: { label: 'Çalışma Planımı Oluştur', href: 'pages/kisisel-calisma-plani.html' },
      floatingKartlar: ['AYT Avantajı • 11. Sınıf', 'AI Mentör 7/24 Aktif ✨', 'Trigonometri & Analitik'],
      gorselBaslik: 'AYT İleri Matematik Stüdyosu',
      gorselAlt: 'Trigonometri, Analitik Geometri ve Çember'
    },
    12: {
      sinif: 12,
      bg: '#F1F1F9',
      accent: '#35358A',
      etiket: '12. SINIF • YKS (TYT - AYT) STRATEJİSİ',
      baslik: 'Hedefine Odaklan: TYT-AYT Matematikte Maksimum Net',
      aciklama: 'Sınav yılındaki her dakikanı verimli kullan. Eksik olduğun kazanımları nokta atışı tespit et, AI Mentör ile takıldığın soruları anında çöz ve kişisel çalışma takviminle hayalindeki üniversiteye ulaş.',
      ozellikler: [
        { icon: 'zap', text: 'TYT & AYT Hızlı Tekrar ve Formül Kartları' },
        { icon: 'bot', text: 'AI Mentör ile Anında Adım Adım Soru Çözümü' },
        { icon: 'rocket', text: 'Eksik Kapatma Odaklı Haftalık Çalışma Planı' }
      ],
      ikincilCta: { label: 'Çalışma Planımı Oluştur', href: 'pages/kisisel-calisma-plani.html' },
      floatingKartlar: ['Hedef Üniversite • YKS 🚀', 'Kişisel Çalışma Takvimi', 'TYT - AYT Net Analizi'],
      gorselBaslik: 'YKS Zirve Hazırlık Merkezi',
      gorselAlt: 'Logaritma, Diziler, Limit, Türev ve İntegral'
    }
  };

  var activeGrade = 5;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderGrade(grade, animate) {
    var data = sinifVerileri[grade] || sinifVerileri[5];
    activeGrade = data.sinif;

    var showcase = document.getElementById('gsShowcase');
    var grid = document.getElementById('gsShowcaseGrid');
    if (!showcase || !grid) return;

    showcase.style.setProperty('--gs-bg', data.bg);
    showcase.style.setProperty('--gs-accent', data.accent);

    // Tab aktif durumu
    document.querySelectorAll('.gs-tab[data-gs-grade]').forEach(function (btn) {
      var g = Number(btn.dataset.gsGrade);
      var isAct = g === data.sinif;
      btn.classList.toggle('is-active', isAct);
      btn.setAttribute('aria-selected', String(isAct));
      btn.setAttribute('tabindex', isAct ? '0' : '-1');
      if (isAct) {
        btn.style.setProperty('--tab-accent', data.accent);
      }
    });

    var heroSrc = 'assets/img/sinif-' + data.sinif + '-hero.jpg';
    var floatCards = data.floatingKartlar || [];

    grid.classList.remove('is-animating');
    grid.innerHTML =
      '<div class="gs-content-col">' +
        '<div class="gs-badge"><span class="gs-badge-dot"></span><span>' + esc(data.etiket) + '</span></div>' +
        '<h3 class="gs-title">' + esc(data.baslik) + '</h3>' +
        '<p class="gs-desc">' + esc(data.aciklama) + '</p>' +
        '<ul class="gs-features">' +
          data.ozellikler.map(function (f) {
            return '<li class="gs-feature-item">' +
              '<span class="gs-feature-ico"><i data-lucide="' + esc(f.icon) + '"></i></span>' +
              '<span>' + esc(f.text) + '</span>' +
            '</li>';
          }).join('') +
        '</ul>' +
        '<div class="gs-cta-row">' +
          '<a class="gs-btn-primary" href="konu.html?sinif=' + data.sinif + '">' +
            '<span>' + data.sinif + '. Sınıf Konularını Keşfet</span>' +
            '<i data-lucide="arrow-right" style="width:17px;height:17px;"></i>' +
          '</a>' +
          '<a class="gs-btn-secondary" href="' + esc(data.ikincilCta.href) + '">' +
            '<span>' + esc(data.ikincilCta.label) + '</span>' +
          '</a>' +
        '</div>' +
      '</div>' +

      '<div class="gs-visual-stage">' +
        (floatCards[0] ? '<div class="gs-float-card pos-top"><span class="gs-float-dot"></span><span>' + esc(floatCards[0]) + '</span></div>' : '') +
        (floatCards[2] ? '<div class="gs-float-card pos-mid"><span>' + esc(floatCards[2]) + '</span></div>' : '') +
        (floatCards[1] ? '<div class="gs-float-card pos-bottom"><span class="gs-float-dot"></span><span>' + esc(floatCards[1]) + '</span></div>' : '') +

        '<div class="gs-visual-frame">' +
          '<img class="gs-hero-img" src="' + heroSrc + '" alt="' + data.sinif + '. Sınıf Matematik İllüstrasyonu" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
          '<div class="gs-svg-fallback" style="display:none;">' +
            '<svg width="240" height="44" viewBox="0 0 240 44" fill="none" style="position:absolute;top:14px;right:14px;opacity:0.18;" aria-hidden="true">' +
              '<circle cx="210" cy="22" r="18" stroke="' + data.accent + '" stroke-width="2.5"/>' +
              '<path d="M12 34 L44 10 L76 34 Z" stroke="' + data.accent + '" stroke-width="2.5"/>' +
              '<path d="M105 22 Q130 4 155 22 T205 22" stroke="#D4A359" stroke-width="2.5"/>' +
            '</svg>' +
            '<div class="gs-svg-orb"><strong>' + data.sinif + '</strong><span>Sınıf</span></div>' +
            '<div class="gs-svg-caption">' + esc(data.gorselBaslik) + '</div>' +
            '<div class="gs-svg-sub">' + esc(data.gorselAlt) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (animate) {
      void grid.offsetWidth;
      grid.classList.add('is-animating');
    }

    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  function init() {
    var tabbar = document.getElementById('gsTabbar');
    if (!tabbar) return;

    tabbar.addEventListener('click', function (e) {
      var btn = e.target.closest('.gs-tab[data-gs-grade]');
      if (!btn) return;
      var g = Number(btn.dataset.gsGrade);
      if (g !== activeGrade) {
        renderGrade(g, true);
      }
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });

    tabbar.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var next = e.key === 'ArrowRight' ? (activeGrade >= 12 ? 5 : activeGrade + 1) : (activeGrade <= 5 ? 12 : activeGrade - 1);
      renderGrade(next, true);
      var targetBtn = tabbar.querySelector('.gs-tab[data-gs-grade="' + next + '"]');
      if (targetBtn) targetBtn.focus();
    });

    renderGrade(5, false);
  }

  global.sinifVerileri = sinifVerileri;
  global.ZarifSinifSec = { selectGrade: function (g) { renderGrade(Number(g) || 5, true); } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
