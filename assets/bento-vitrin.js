/**
 * ZarifÇözüm — 3 Sekmeli Asimetrik Kategorili Bento Vitrin & Hibrit Önizleme Modalı
 */
(function (global) {
  'use strict';

  var CATEGORIES = {
    kesfet: {
      label: '✨ Keşfet ve Öğren',
      cards: [
        {
          id: 'ai-mentor',
          layout: 'is-wide is-featured',
          tag: '7/24 SOKRATİK REHBER',
          title: 'AI Mentör İle Adım Adım Keşfet',
          desc: 'Cevabı ezberletmek yerine Sokratik ipuçlarıyla çocuğunun kendi çözüm yolunu bulmasını sağlayan 4 modlu yapay zekâ asistanı.',
          ctaUrl: 'ogrenci-paneli.html#ai-mentor-panel',
          ctaLabel: 'AI Mentörü Panelde Aç →',
          bullets: [
            'Sokratik Mentör, Öğretmen İkizi, Adım Adım Çözüm ve AI Koç modları',
            'MEB Türkiye Yüzyılı Maarif Modeli ve ders kitabı bağlamı',
            'Zayıf konuları otomatik hatırlayan kişisel hafıza'
          ],
          snippet:
            '<div class="bvs-bubble user">3x + 5 = 20 denkleminde takıldım.</div>' +
            '<div class="bvs-bubble ai"><strong>Sokratik Mentör:</strong> Harika soru! Önce +5\'i yok etmek için iki taraftan kaç çıkarmalıyız?</div>' +
            '<div class="bvs-pill-row"><span class="bvs-pill dark">💡 İpucu Aktif</span><span class="bvs-pill">5–12. Sınıf</span></div>'
        },
        {
          id: 'video-dersler',
          layout: '',
          tag: 'MAARİF VİDEO ARŞİVİ',
          title: 'Video Dersler',
          desc: 'Kısa, odaklanmış ve kazanım bazlı konu anlatım & soru çözüm videoları.',
          ctaUrl: 'ogrenci-paneli.html#video-dersler',
          ctaLabel: 'Video Dersleri Gör →',
          bullets: [
            'Her tema için 10–15 dakikalık odaklı anlatımlar',
            'Standart (30 gün) ve VIP (tüm yıl) arşiv erişimi',
            'Sınıf ve konu bazlı hızlı filtreleme'
          ],
          snippet:
            '<div style="display:flex;align-items:center;justify-content:space-between;background:#3B281E;color:#fff;padding:10px 12px;border-radius:11px;">' +
              '<span style="font-size:0.78rem;font-weight:700;">▶ Çarpanlar &amp; Katlar</span>' +
              '<span style="font-size:0.7rem;color:#f3d285;font-weight:800;">14:20 HD</span>' +
            '</div>' +
            '<div class="bvs-bar"><span style="width:68%;"></span></div>'
        },
        {
          id: 'kesif-lab',
          layout: '',
          tag: '8 CANLI SİMÜLASYON',
          title: 'Keşif Laboratuvarı',
          desc: 'Kesirler, asal sayılar, denklem terazisi ve rampa eğimini dokunarak görselleştir.',
          ctaUrl: 'pages/kesif-modu.html',
          ctaLabel: 'Keşif Laboratuvarına Gir →',
          bullets: [
            '5, 6, 7 ve 8. sınıfa özel 8 etkileşimli matematik deneyi',
            'Her deney sonunda mini keşif görevi ve +25 Keşif XP',
            'Kurulum gerektirmeyen dokunmatik SVG simülasyonlar'
          ],
          snippet:
            '<div style="display:flex;gap:4px;">' +
              '<span style="flex:1;height:18px;border-radius:5px;background:#2B6CB0;"></span>' +
              '<span style="flex:1;height:18px;border-radius:5px;background:#2B6CB0;"></span>' +
              '<span style="flex:1;height:18px;border-radius:5px;background:#2B6CB0;"></span>' +
              '<span style="flex:1;height:18px;border-radius:5px;background:#EBF4FF;border:1px solid #bfdbfe;"></span>' +
            '</div>' +
            '<div class="bvs-pill-row"><span class="bvs-pill">3/4 = %75 ✓</span><span class="bvs-pill dark">+25 Keşif XP</span></div>'
        },
        {
          id: 'konu-ozetleri',
          layout: 'is-wide is-soft',
          tag: 'MEB DERS KİTABI REFERANSLI',
          title: 'Görsel Konu Özetleri & 3D Bilgi Kartları',
          desc: 'Altın kural kutuları, kavram yanılgısı uyarıları, ders kitabı sayfa referansları ve sesli 3D flip kartlarla kalıcı öğrenme.',
          ctaUrl: 'ogrenci-paneli.html#konu-anlatimlari',
          ctaLabel: 'Konu Çalışmaya Başla →',
          bullets: [
            'Yapısal bloklar: Keşif, Görsel Şema, Altın Kural ve Tuzak Uyarısı',
            '3D çevrilebilir bilgi kartları oyunu',
            'Konu sonunda doğrudan onaylı kazanım testine tek tıkla geçiş'
          ],
          snippet:
            '<div style="background:#FFFFFF;border:1px solid #EAE0D5;border-left:4px solid #C59B47;border-radius:11px;padding:10px 12px;">' +
              '<div style="font-size:0.7rem;font-weight:800;color:#8c6821;">💡 ALTIN KURAL</div>' +
              '<div style="font-size:0.8rem;font-weight:700;color:#2C221E;margin-top:2px;">Eşitliğin iki tarafına aynı işlem uygulandığında denge korunur.</div>' +
            '</div>' +
            '<div class="bvs-pill-row"><span class="bvs-pill">📖 MEB Sayfa 42</span><span class="bvs-pill dark">🗂️ 3D Bilgi Kartları</span></div>'
        }
      ]
    },
    pratik: {
      label: '🎯 Pratik ve Sınav',
      cards: [
        {
          id: 'soru-kazanim',
          layout: 'is-wide is-featured',
          tag: 'ÖĞRETMEN ONAYLI HAVUZ',
          title: 'Soru & Kazanım Testi Merkezi',
          desc: 'Sınıf ve konunu seç; 10, 20 veya 30 soruluk yalnızca öğretmen onaylı özgün sorulardan anında kişiselleştirilmiş test oluştur.',
          ctaUrl: 'ogrenci-paneli.html#kazanim-testi',
          ctaLabel: 'Kazanım Testi Oluştur →',
          bullets: [
            'Yalnızca öğretmenlerin "Onayla ve Yayınla" dediği gerçek sorular',
            'Fisher-Yates karıştırma ile her başlatmada farklı soru seti',
            'Test bitiminde D/Y/B özeti, çözüm inceleme ve canlı karne kaydı'
          ],
          snippet:
            '<div class="bvs-pill-row"><span class="bvs-pill dark">10 Soru</span><span class="bvs-pill">20 Soru</span><span class="bvs-pill">30 Soru</span></div>' +
            '<div style="font-size:0.78rem;color:#E4D7CA;margin-top:4px;">🛡️ Kesirler ve İşlemler · <strong style="color:#f3d285;">Onaylı Havuz Hazır</strong></div>' +
            '<div class="bvs-bar"><span style="width:82%;"></span></div>'
        },
        {
          id: 'yazili-hazirlik',
          layout: '',
          tag: 'MEB AÇIK UÇLU SENARYO',
          title: 'Yazılıya Hazırlık',
          desc: 'Okul sınavlarına özel açık uçlu MEB senaryo provaları ve rubrik değerlendirmesi.',
          ctaUrl: 'ogrenci-paneli.html#yaziliya-hazirlik',
          ctaLabel: 'Yazılı Provalarını Gör →',
          bullets: [
            '1. ve 2. Dönem MEB senaryolarına uyumlu açık uçlu sorular',
            'Adım adım puanlama rubriği ile sınav pratiği',
            'Sınıf seviyesine göre hazır çalışma kağıtları'
          ],
          snippet:
            '<div style="display:flex;justify-content:space-between;font-size:0.78rem;font-weight:800;color:#2C221E;"><span>1. Dönem 1. Yazılı</span><span style="color:#059669;">100 Puan</span></div>' +
            '<div class="bvs-pill-row"><span class="bvs-pill">Açık Uçlu</span><span class="bvs-pill dark">Rubrikli</span></div>'
        },
        {
          id: 'deneme-sinavlari',
          layout: '',
          tag: 'İL & TÜRKİYE GENELİ',
          title: 'Deneme Sınavları & Canlı Optik',
          desc: 'Tam ekran optik form salonu, 3Y/1D net hesabı ve tahmini TG yüzdelik dilimi.',
          ctaUrl: 'ogrenci-paneli.html#denemeler',
          ctaLabel: 'Deneme Merkezini Aç →',
          bullets: [
            'Türkiye Geneli ve İl Geneli dijital optik denemeler',
            'Ücretsiz üyeler için 1 adet açık Tanıtım Denemesi',
            'Anında net hesabı, il sıralaması ve konu dağılım karnesi'
          ],
          snippet:
            '<div class="bvs-opt-row"><span>1.</span><span class="bvs-dot">A</span><span class="bvs-dot on">B</span><span class="bvs-dot">C</span><span class="bvs-dot">D</span></div>' +
            '<div class="bvs-opt-row"><span>2.</span><span class="bvs-dot">A</span><span class="bvs-dot">B</span><span class="bvs-dot on">C</span><span class="bvs-dot">D</span></div>' +
            '<div class="bvs-pill-row"><span class="bvs-pill dark">TG %4,8 Dilim</span></div>'
        },
        {
          id: 'akilli-odevler',
          layout: 'is-wide is-soft',
          tag: 'ÖĞRETMEN ATAMALI',
          title: 'Akıllı Ödevler & Hedefli Tekrar',
          desc: 'Öğretmenin başarı analizine göre eksik konuların için doğrudan paneline atadığı görevleri takip et ve tamamladıkça XP kazan.',
          ctaUrl: 'ogrenci-paneli.html#student-tasks',
          ctaLabel: 'Ödevlerimi Görüntüle →',
          bullets: [
            'Öğretmen panelinden tek tıkla atanan hedefli çalışmalar',
            'Teslim tarihi ve tamamlama durumu takibi',
            'Veli paneliyle canlı senkronize ödev bildirimi'
          ],
          snippet:
            '<div style="display:flex;align-items:center;justify-content:space-between;background:#FFFFFF;border:1px solid #EAE0D5;padding:9px 12px;border-radius:10px;font-size:0.78rem;">' +
              '<strong>✓ Rasyonel Sayılar Tekrarı</strong><span style="color:#059669;font-weight:800;">Tamamlandı</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;background:#FFFFFF;border:1px solid #EAE0D5;padding:9px 12px;border-radius:10px;font-size:0.78rem;">' +
              '<strong>⏳ Denklem Çözme (15 Soru)</strong><span style="color:#D97706;font-weight:800;">Cuma</span>' +
            '</div>'
        }
      ]
    },
    gelisim: {
      label: '📊 Planlama ve Gelişim',
      cards: [
        {
          id: 'calisma-plani',
          layout: 'is-wide is-featured',
          tag: 'KİŞİSEL TAKVİM',
          title: 'Haftalık Çalışma Planı & Takvim',
          desc: 'Planlı Zoom dersleri, ödev teslim tarihleri ve kişisel hedeflerini tek bir haftalık programda düzenle.',
          ctaUrl: 'pages/kisisel-calisma-plani.html',
          ctaLabel: 'Çalışma Planımı Oluştur →',
          bullets: [
            'Ders takvimi ve kişisel hatırlatıcılar tek ekranda',
            'AI Koç ile 7 günlük dengeli çalışma programı üretimi',
            'Sınav dönemine göre otomatik hedef önceliklendirme'
          ],
          snippet:
            '<div class="bvs-pill-row"><span class="bvs-pill dark">Pzt ✓</span><span class="bvs-pill dark">Sal ✓</span><span class="bvs-pill dark">Çar ✓</span><span class="bvs-pill">Per</span><span class="bvs-pill">Cum</span></div>' +
            '<div style="font-size:0.78rem;color:#E4D7CA;">📅 Bugünün Hedefi: <strong style="color:#f3d285;">20 Soru + 1 Konu Tekrarı</strong></div>'
        },
        {
          id: 'basari-raporlari',
          layout: '',
          tag: 'CANLI GELİŞİM GRAFİĞİ',
          title: 'Başarı Raporları & Veli Takibi',
          desc: 'Haftalık başarı trendi, güçlü/geliştirilecek konular ve PDF indirilebilir veli karnesi.',
          ctaUrl: 'ogrenci-paneli.html#basari-raporlarim',
          ctaLabel: 'Başarı Raporlarını Gör →',
          bullets: [
            'Chart.js canlı haftalık başarı ve çalışma trendi',
            'Konu bazlı zayıf kazanım tespiti ve öneriler',
            'Veli panelinde tek tıkla yazdırılabilir gelişim raporu'
          ],
          snippet:
            '<svg viewBox="0 0 200 58" width="100%" height="56" aria-hidden="true">' +
              '<polyline points="8,48 48,38 88,42 128,24 168,18 192,10" fill="none" stroke="#C59B47" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
              '<circle cx="192" cy="10" r="4.5" fill="#3B281E"/>' +
            '</svg>' +
            '<div style="display:flex;justify-content:space-between;font-size:0.74rem;font-weight:800;color:#059669;"><span>Son 6 Hafta</span><span>%68 → %92 ↑</span></div>'
        },
        {
          id: 'canli-ders',
          layout: '',
          tag: 'HD ZOOM STÜDYO',
          title: 'Canlı Ders & Öğretmen Desteği',
          desc: 'Son 5 dakika geri sayımı, tek tıkla Zoom katılımı ve 15 dk kala otomatik veli bildirimi.',
          ctaUrl: 'ogrenci-paneli.html#live-lessons',
          ctaLabel: 'Canlı Ders Stüdyosunu Aç →',
          bullets: [
            'Öğretmen panelinden planlanan Zoom derslerine anında erişim',
            'Derse 15 dakika kala veli paneline otomatik hatırlatma',
            'Geçmiş canlı ders kayıtlarını tekrar izleme arşivi'
          ],
          snippet:
            '<div style="display:flex;align-items:center;justify-content:space-between;background:#3B281E;color:#fff;padding:9px 11px;border-radius:10px;">' +
              '<span style="font-size:0.74rem;font-weight:800;color:#93c5fd;">🎥 ZOOM HAZIR</span>' +
              '<span style="font-family:monospace;font-size:0.82rem;color:#f3d285;font-weight:800;">04:59</span>' +
            '</div>' +
            '<div class="bvs-pill-row"><span class="bvs-pill">🔔 15 Dk Veli Uyarısı</span></div>'
        },
        {
          id: 'xp-liderlik',
          layout: 'is-wide is-soft',
          tag: 'OYUNLAŞTIRMA & SERTİFİKA',
          title: 'XP, Haftalık Lig & Dijital Sertifika',
          desc: 'Çözdüğün her testle XP topla, 6 pedagojik rozeti aç, sınıf podyumunda yüksel ve imzalı aylık başarı sertifikanı PDF indir.',
          ctaUrl: 'ogrenci-paneli.html#liderlik-tablosu',
          ctaLabel: 'Lig & Sertifika Merkezini Gör →',
          bullets: [
            'İlk 3 Podyum ve sınıf bazlı İlk 10 Haftalık Liderlik Ligi',
            '6 özel pedagojik rozet ve seri koruma kalkanı',
            'VIP öğrencilere özel PDF indirilebilir dijital başarı sertifikası'
          ],
          snippet:
            '<div class="bvs-pill-row">' +
              '<span class="bvs-pill dark">⚡ 145 XP</span>' +
              '<span class="bvs-pill">🔥 7 Gün Seri</span>' +
              '<span class="bvs-pill">🥇 1. Sıra</span>' +
            '</div>' +
            '<div style="font-size:0.78rem;color:#6B5E57;font-weight:600;">📜 Aylık ZarifÇözüm Onay Mührlü Başarı Sertifikası</div>'
        }
      ]
    }
  };

  var activeCat = 'kesfet';

  function findCardById(id) {
    var keys = Object.keys(CATEGORIES);
    for (var i = 0; i < keys.length; i++) {
      var list = CATEGORIES[keys[i]].cards;
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === id) return { card: list[j], catLabel: CATEGORIES[keys[i]].label };
      }
    }
    return null;
  }

  function openHybridModal(cardId) {
    var found = findCardById(cardId);
    if (!found) return;
    var c = found.card;

    var existing = document.getElementById('bvPreviewModal');
    if (existing) existing.remove();

    var backdrop = document.createElement('div');
    backdrop.id = 'bvPreviewModal';
    backdrop.className = 'bv-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML =
      '<div class="bv-modal">' +
        '<div class="bv-modal-head">' +
          '<div>' +
            '<span style="font-size:0.72rem;font-weight:800;letter-spacing:0.06em;color:#f3d285;text-transform:uppercase;">' + found.catLabel + ' · ' + c.tag + '</span>' +
            '<h3>' + c.title + '</h3>' +
          '</div>' +
          '<button type="button" class="bv-modal-close" id="bvModalCloseBtn" aria-label="Kapat">✕</button>' +
        '</div>' +
        '<div class="bv-modal-body">' +
          '<p style="margin:0;font-size:0.92rem;color:#6B5E57;line-height:1.6;">' + c.desc + '</p>' +
          '<div class="bv-modal-preview">' +
            '<div style="font-size:0.72rem;font-weight:800;color:#8c6821;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">🖥️ Canlı Panel Önizlemesi</div>' +
            '<div class="bv-snippet" style="min-height:auto;background:#FAF6F0;">' + c.snippet + '</div>' +
          '</div>' +
          '<ul class="bv-modal-bullets">' +
            c.bullets.map(function (b) { return '<li><span style="color:#C59B47;font-weight:800;">✓</span><span>' + b + '</span></li>'; }).join('') +
          '</ul>' +
          '<div class="bv-modal-foot">' +
            '<button type="button" class="bv-inspect-btn" id="bvModalCancelBtn">Kapat</button>' +
            '<a class="bv-modal-cta" href="' + c.ctaUrl + '">' + c.ctaLabel + '</a>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);

    var close = function () { backdrop.remove(); };
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    backdrop.querySelector('#bvModalCloseBtn').addEventListener('click', close);
    backdrop.querySelector('#bvModalCancelBtn').addEventListener('click', close);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
  }

  function renderCategory(catKey, animate) {
    if (!CATEGORIES[catKey]) catKey = 'kesfet';
    activeCat = catKey;

    var grid = document.getElementById('bvGrid');
    if (!grid) return;

    document.querySelectorAll('.bv-tab[data-bv-cat]').forEach(function (btn) {
      var isAct = btn.dataset.bvCat === activeCat;
      btn.classList.toggle('is-active', isAct);
      btn.setAttribute('aria-selected', String(isAct));
    });

    var cards = CATEGORIES[activeCat].cards;
    grid.classList.remove('is-animating');
    grid.innerHTML = cards.map(function (c) {
      var isWide = c.layout.indexOf('is-wide') !== -1;
      if (isWide) {
        return '<article class="bv-card ' + c.layout + '">' +
          '<div class="bv-card-copy">' +
            '<div>' +
              '<span class="bv-tag">' + c.tag + '</span>' +
              '<h3>' + c.title + '</h3>' +
              '<p>' + c.desc + '</p>' +
            '</div>' +
            '<div class="bv-card-foot" style="justify-content:flex-start;">' +
              '<button type="button" class="bv-inspect-btn" data-bv-open="' + c.id + '">Canlı İncele →</button>' +
            '</div>' +
          '</div>' +
          '<div class="bv-snippet">' + c.snippet + '</div>' +
        '</article>';
      }
      return '<article class="bv-card ' + c.layout + '">' +
        '<div class="bv-snippet">' + c.snippet + '</div>' +
        '<div class="bv-card-copy">' +
          '<div>' +
            '<span class="bv-tag">' + c.tag + '</span>' +
            '<h3>' + c.title + '</h3>' +
            '<p>' + c.desc + '</p>' +
          '</div>' +
          '<div class="bv-card-foot">' +
            '<button type="button" class="bv-inspect-btn" data-bv-open="' + c.id + '">Canlı İncele →</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    if (animate) {
      void grid.offsetWidth;
      grid.classList.add('is-animating');
    }

    grid.querySelectorAll('[data-bv-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openHybridModal(btn.dataset.bvOpen);
      });
    });
  }

  function init() {
    var tabs = document.getElementById('bvTabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.bv-tab[data-bv-cat]');
      if (!btn || btn.dataset.bvCat === activeCat) return;
      renderCategory(btn.dataset.bvCat, true);
    });
    renderCategory('kesfet', false);
  }

  global.ZarifBentoVitrin = { selectCategory: renderCategory, openPreview: openHybridModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
