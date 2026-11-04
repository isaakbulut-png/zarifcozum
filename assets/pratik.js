(function () {
  'use strict';

  const MUFREDAT = () => window.MATEMATIK_MUFREDATI || {};
  const BASLIKLAR = {
    konu: 'Konu anlatımları',
    asistan: 'Asistanla soru çöz',
    test: 'Test çöz',
    kazanim: 'Kazanım testi'
  };
  const SECIM_MODLARI = {
    konu: {
      aciklama: 'Sınıfını ve çalışmak istediğin konuyu seç; konu anlatımı hazır olduğunda aç.',
      baslat: 'Konu anlatımını aç'
    },
    test: {
      aciklama: 'Konu pratiği: Her sorudan sonra doğru cevabı ve çözümü görerek adım adım çalış.',
      baslat: 'Pratiğe başla'
    },
    kazanim: {
      aciklama: 'Kazanım değerlendirmesi: Soruları tamamla; doğru cevapları ve çözümleri test sonunda incele.',
      baslat: 'Kazanım testini başlat'
    }
  };

  function el(tag, ozellikler, ...cocuklar) {
    const dugum = document.createElement(tag);
    Object.entries(ozellikler || {}).forEach(([ad, deger]) => {
      if (ad === 'class') dugum.className = deger;
      else if (ad.startsWith('on')) dugum.addEventListener(ad.slice(2), deger);
      else dugum.setAttribute(ad, deger);
    });
    cocuklar.flat().forEach(c => dugum.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return dugum;
  }

  async function api(yol, govde) {
    const secenekler = govde
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }
      : { cache: 'no-store' };
    const yanit = await fetch('/api/pratik' + yol, { credentials: 'same-origin', ...secenekler });
    const veri = await yanit.json().catch(() => ({}));
    if (!yanit.ok) {
      const hata = new Error(veri.mesaj || 'İşlem tamamlanamadı.');
      hata.kod = veri.kod;
      hata.yonlendir = veri.yonlendir;
      hata.girisYapti = veri.girisYapti;
      throw hata;
    }
    return veri;
  }

  async function pineconeKonulariniGetir(grade) {
    const yanit = await fetch(`/api/mufredat-konulari?grade=${encodeURIComponent(grade)}`, {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const veri = await yanit.json().catch(() => ({}));
    if (!yanit.ok) throw new Error(veri.mesaj || 'Müfredat konuları alınamadı.');
    if (!Array.isArray(veri.konular)) throw new Error('Müfredat konu yanıtı geçersiz.');

    const uniteHaritasi = new Map();
    veri.konular.forEach(konu => {
      if (typeof konu.unite !== 'string' || typeof konu.dosya_adi !== 'string') return;
      if (!uniteHaritasi.has(konu.unite)) uniteHaritasi.set(konu.unite, []);
      uniteHaritasi.get(konu.unite).push(konu.dosya_adi);
    });
    return [...uniteHaritasi].map(([title, topics]) => ({ title, topics }));
  }

  function markdownSatiri(dugum, metin) {
    const parcalar = metin.split(/(\*\*.+?\*\*|__.+?__|`[^`]+`|\*[^*]+\*)/g);
    parcalar.forEach(parca => {
      if ((parca.startsWith('**') && parca.endsWith('**')) ||
          (parca.startsWith('__') && parca.endsWith('__'))) {
        dugum.append(el('strong', {}, parca.slice(2, -2)));
      } else if (parca.startsWith('`') && parca.endsWith('`')) {
        dugum.append(el('code', {}, parca.slice(1, -1)));
      } else if (parca.startsWith('*') && parca.endsWith('*')) {
        dugum.append(el('em', {}, parca.slice(1, -1)));
      } else {
        dugum.append(document.createTextNode(parca));
      }
    });
  }

  function markdownGoster(metin) {
    const kok = el('div', { class: 'zp-anlatim' });
    let paragraf = [];
    let liste = null;
    let listeTuru = '';
    const paragrafiEkle = () => {
      if (!paragraf.length) return;
      const p = el('p');
      markdownSatiri(p, paragraf.join(' '));
      kok.append(p);
      paragraf = [];
    };
    const listeyiBitir = () => {
      liste = null;
      listeTuru = '';
    };

    String(metin).split(/\r?\n/).forEach(satir => {
      const temiz = satir.trim();
      if (!temiz) {
        paragrafiEkle();
        listeyiBitir();
        return;
      }
      const baslik = temiz.match(/^(#{1,4})\s+(.+)$/);
      if (baslik) {
        paragrafiEkle();
        listeyiBitir();
        const seviye = Math.min(baslik[1].length + 1, 4);
        const h = el(`h${seviye}`);
        markdownSatiri(h, baslik[2]);
        kok.append(h);
        return;
      }
      const madde = temiz.match(/^[-*]\s+(.+)$/);
      const numarali = temiz.match(/^\d+[.)]\s+(.+)$/);
      if (madde || numarali) {
        paragrafiEkle();
        const tur = madde ? 'ul' : 'ol';
        if (!liste || listeTuru !== tur) {
          listeyiBitir();
          liste = el(tur);
          listeTuru = tur;
          kok.append(liste);
        }
        const li = el('li');
        markdownSatiri(li, (madde || numarali)[1]);
        liste.append(li);
        return;
      }
      if (temiz.startsWith('> ')) {
        paragrafiEkle();
        listeyiBitir();
        const alinti = el('blockquote');
        markdownSatiri(alinti, temiz.slice(2));
        kok.append(alinti);
        return;
      }
      if (/^(-{3,}|\*{3,})$/.test(temiz)) {
        paragrafiEkle();
        listeyiBitir();
        kok.append(el('hr'));
        return;
      }
      listeyiBitir();
      paragraf.push(temiz);
    });
    paragrafiEkle();
    return kok;
  }

  function konuAnlatiminiMarkdownaCevir(anlatim) {
    if (typeof anlatim === 'string') return anlatim;
    return [
      '## Konu özeti', anlatim.ozet,
      '## Temel kavramlar', ...(anlatim.kavramlar || []).map(k => `- ${k}`),
      '## Örnek soru', anlatim.ornekSoru,
      '## Çözüm', anlatim.ornekCozum,
      '## Sık yapılan hatalar', ...(anlatim.sikHatalar || []).map(k => `- ${k}`)
    ].filter(Boolean).join('\n\n');
  }

  function anlatimSayfalari(metin) {
    const parcalar = String(metin).split(/\[SAYFA_(\d+)\]/gi);
    if (parcalar.length < 3) throw new Error('Konu anlatımı sayfalara ayrılamadı. Lütfen yeniden deneyin.');
    const sayfalar = [];
    for (let i = 1; i < parcalar.length; i += 2) {
      const icerik = parcalar[i + 1]?.trim();
      if (icerik) sayfalar.push({ numara: Number(parcalar[i]), icerik });
    }
    if (sayfalar.length < 4) throw new Error('Konu anlatımı dört sayfadan kısa geldi. Lütfen yeniden deneyin.');
    return sayfalar;
  }

  function mount(kok, { mod, sinif: baslangicSinifi } = {}) {
    if (!kok || !BASLIKLAR[mod]) return;
    kok.classList.add('zp');
    let durum = null;
    let sinif = Number(baslangicSinifi) >= 5 && Number(baslangicSinifi) <= 11 ? Number(baslangicSinifi) : 5;
    let yonlendirmeSayaci = null;
    let secimIstegi = 0;

    function temizle() {
      clearInterval(yonlendirmeSayaci);
      kok.replaceChildren();
    }

    function durumSerit() {
      if (!durum) return el('div');
      if (durum.uye) return el('div', { class: 'zp-serit zp-uye' }, 'Üyelik aktif: sınırsız erişim');
      if (durum.limitYok) return el('div', { class: 'zp-serit zp-uye' }, 'Öğrenci hesabı: sınırsız erişim');
      const kalan = durum.ozellikler[mod].kalan;
      return el('div', { class: 'zp-serit' },
        kalan > 0
          ? `Ücretsiz deneme: ${kalan} konu hakkın kaldı (her konuda ${durum.limitler.soru} soru).`
          : 'Ücretsiz deneme hakkın doldu.');
    }

    function paywall(hata) {
      temizle();
      const adres = hata.yonlendir || (durum && durum.uyelikAdresi) || '/Paketler.html';
      const giris = hata.girisYapti === false
        ? el('p', { class: 'zp-kucuk' }, 'Hesabın varsa ',
          el('a', { href: '/kayit-giris.html?returnTo=' + encodeURIComponent(location.pathname + location.search) }, 'giriş yap'), '.')
        : '';
      let saniye = 8;
      const sayac = el('span', {}, saniye);
      const iptal = el('button', { class: 'zp-btn zp-ikincil', type: 'button', onclick: () => { clearInterval(yonlendirmeSayaci); bilgi.textContent = 'Yönlendirme iptal edildi.'; } }, 'Yönlendirmeyi iptal et');
      const bilgi = el('p', { class: 'zp-kucuk' }, 'Üyelik sayfasına ', sayac, ' saniye içinde yönlendiriliyorsun.');
      kok.append(el('div', { class: 'zp-kart zp-paywall' },
        el('h3', {}, 'Ücretsiz deneme hakkın doldu'),
        el('p', {}, hata.message),
        el('a', { class: 'zp-btn', href: adres }, 'Üyelik paketlerini incele'),
        giris, bilgi, iptal,
        el('button', { class: 'zp-btn zp-ikincil', type: 'button', onclick: secimEkrani }, 'Geri dön')));
      yonlendirmeSayaci = setInterval(() => {
        saniye -= 1;
        sayac.textContent = saniye;
        if (saniye <= 0) { clearInterval(yonlendirmeSayaci); location.href = adres; }
      }, 1000);
    }

    function hataGoster(hata) {
      if (hata.kod === 'UYELIK_GEREKLI') return paywall(hata);
      temizle();
      kok.append(el('div', { class: 'zp-kart' }, el('p', { class: 'zp-hata' }, hata.message),
        el('button', { class: 'zp-btn', type: 'button', onclick: secimEkrani }, 'Geri dön')));
    }

    function yukleniyor(metin) {
      temizle();
      kok.append(el('div', { class: 'zp-kart zp-yukleniyor' }, metin || 'Hazırlanıyor…'));
    }

    async function secimEkrani() {
      const istekNo = ++secimIstegi;
      try { durum = await api('/durum'); } catch { durum = null; }
      if (istekNo !== secimIstegi) return;
      temizle();
      const mufredat = MUFREDAT();
      const sinifSecici = el('div', { class: 'zp-siniflar', role: 'tablist' },
        [5, 6, 7, 8, 9, 10, 11].map(n => el('button', {
          type: 'button', class: 'zp-sinif' + (n === sinif ? ' aktif' : ''),
          onclick: () => { sinif = n; secimEkrani(); }
        }, n + '. sınıf')));
      const kullanilan = durum ? durum.ozellikler[mod].kullanilan : [];
      let uniteListesi;
      if (mod === 'konu') {
        kok.append(el('div', { class: 'zp-kart zp-yukleniyor' }, `${sinif}. sınıf müfredatı yükleniyor…`));
        try {
          uniteListesi = await pineconeKonulariniGetir(sinif);
        } catch (hata) {
          if (istekNo !== secimIstegi) return;
          temizle();
          kok.append(el('div', { class: 'zp-kart' },
            el('p', { class: 'zp-hata', role: 'alert' }, hata.message),
            el('button', { class: 'zp-btn', type: 'button', onclick: secimEkrani }, 'Tekrar dene')));
          return;
        }
      } else {
        uniteListesi = mufredat[sinif] || [];
      }
      if (istekNo !== secimIstegi) return;
      let konuSecici;
      if (SECIM_MODLARI[mod]) {
        let seciliKonu = '';
        const konuPanelId = 'zp-konu-panel-' + mod;
        const konuSecim = el('button', {
          type: 'button',
          id: 'zp-konu-secimi-' + mod,
          class: 'zp-konu-secici',
          'aria-expanded': 'false',
          'aria-controls': konuPanelId,
          onclick: () => {
            const acik = konuPanel.hidden;
            konuPanel.hidden = !acik;
            konuSecim.setAttribute('aria-expanded', String(acik));
          },
          onkeydown: event => {
            if (event.key === 'Escape' && !konuPanel.hidden) {
              konuPanel.hidden = true;
              konuSecim.setAttribute('aria-expanded', 'false');
            }
          }
        }, 'Konu seçin…');
        const konuPanel = el('div', {
          id: konuPanelId,
          class: 'zp-konu-panel',
          hidden: ''
        });
        uniteListesi.forEach(u => {
          const grup = el('div', { class: 'zp-konu-grup' },
            el('h4', {}, u.title));
          u.topics.forEach(konu => {
            const kilitli = durum && !durum.limitYok && durum.ozellikler[mod].kalan === 0 &&
              !kullanilan.some(k => k.sinif === sinif && k.konu === konu);
            const secenek = el('button', {
              type: 'button',
              class: 'zp-konu-secim',
              onclick: () => {
                seciliKonu = konu;
                konuSecim.textContent = konu;
                baslat.disabled = false;
                konuPanel.hidden = true;
                konuSecim.setAttribute('aria-expanded', 'false');
                konuSecim.focus();
              }
            }, (kilitli ? '🔒 ' : '') + konu);
            if (kilitli) secenek.disabled = true;
            grup.append(secenek);
          });
          konuPanel.append(grup);
        });
        if (!uniteListesi.length) {
          konuPanel.append(el('p', { class: 'zp-konu-bos' }, 'Bu sınıf için konu bulunamadı.'));
        }
        const baslat = el('button', {
          type: 'button',
          class: 'zp-btn zp-baslat',
          disabled: '',
          onclick: () => { if (seciliKonu) konuAc(seciliKonu); }
        }, SECIM_MODLARI[mod].baslat);
        konuSecici = el('div', { class: 'zp-konu-alani' },
          el('label', { class: 'zp-konu-etiket', for: 'zp-konu-secimi-' + mod }, 'Konu seçimi'),
          konuSecim,
          konuPanel,
          baslat);
      } else {
        konuSecici = uniteListesi.map(u => el('div', { class: 'zp-unite' },
          el('h4', {}, u.title),
          el('div', { class: 'zp-konular' }, u.topics.map(konu => {
            const kilitli = durum && !durum.limitYok && durum.ozellikler[mod].kalan === 0 &&
              !kullanilan.some(k => k.sinif === sinif && k.konu === konu);
            return el('button', {
              type: 'button', class: 'zp-konu' + (kilitli ? ' kilitli' : ''),
              onclick: () => konuAc(konu)
            }, (kilitli ? '🔒 ' : '') + konu);
          }))));
      }
      kok.append(el('div', { class: 'zp-kart' },
        el('h3', {}, BASLIKLAR[mod]), durumSerit(),
        el('p', { class: 'zp-kucuk' }, SECIM_MODLARI[mod]
          ? SECIM_MODLARI[mod].aciklama
          : 'Sınıfını seç, sonra bir konu seç.'),
        sinifSecici,
        mod === 'konu' && uniteListesi.length === 0
          ? el('p', { class: 'zp-hata', role: 'status' }, 'Bu sınıf için Pinecone’da müfredat konusu bulunamadı.')
          : '',
        konuSecici));
    }

    function konuAc(konu) {
      if (mod === 'konu') return anlatimAc(konu);
      return sorularAc(konu);
    }

    async function anlatimAc(konu) {
      yukleniyor('Konu anlatımı hazırlanıyor…');
      try {
        const veri = await api('/konu', { sinif, konu });
        if (durum && !veri.limitYok) durum.ozellikler.konu.kalan = veri.kalan;
        const anlatim = konuAnlatiminiMarkdownaCevir(veri.anlatim);
        const sayfalar = anlatimSayfalari(anlatim);
        temizle();
        let aktifSayfa = 0;
        const gorunum = el('div', {
          class: 'zp-slayt-govde',
          role: 'region',
          'aria-label': 'Konu anlatımı sayfaları',
          'aria-live': 'polite'
        });
        const geri = el('button', {
          class: 'zp-slayt-ok',
          type: 'button',
          'aria-label': 'Önceki sayfaya git',
          onclick: () => sayfayaGit(aktifSayfa - 1, 'geri')
        }, '👈');
        const ileri = el('button', {
          class: 'zp-slayt-ok',
          type: 'button',
          'aria-label': 'Sonraki sayfaya git',
          onclick: () => sayfayaGit(aktifSayfa + 1, 'ileri')
        }, '👉');
        const sayac = el('p', { class: 'zp-slayt-sayac', 'aria-live': 'polite' });
        function sayfayiCiz(yon) {
          const sayfa = sayfalar[aktifSayfa];
          const icerik = markdownGoster(sayfa.icerik);
          icerik.classList.add('zp-anlatim-sayfa', yon === 'geri' ? 'zp-slayt-geri' : 'zp-slayt-ileri');
          gorunum.replaceChildren(icerik);
          geri.disabled = aktifSayfa === 0;
          ileri.disabled = aktifSayfa === sayfalar.length - 1;
          sayac.textContent = `Sayfa ${aktifSayfa + 1} / ${sayfalar.length}`;
        }
        function sayfayaGit(yeniSayfa, yon) {
          if (yeniSayfa < 0 || yeniSayfa >= sayfalar.length) return;
          aktifSayfa = yeniSayfa;
          sayfayiCiz(yon);
        }
        sayfayiCiz('ileri');
        kok.append(el('div', { class: 'zp-kart' },
          el('button', { class: 'zp-btn zp-ikincil', type: 'button', onclick: secimEkrani }, '← Konulara dön'),
          el('h3', {}, `${sinif}. sınıf · ${konu}`),
          el('div', { class: 'zp-slayt' }, geri, gorunum, ileri),
          sayac,
          veri.limitYok ? '' : el('p', { class: 'zp-kucuk' }, `Ücretsiz deneme: ${veri.kalan} konu hakkın kaldı.`)));
      } catch (hata) { hataGoster(hata); }
    }

    async function sorularAc(konu) {
      yukleniyor('Sorular hazırlanıyor…');
      try {
        const veri = await api('/sorular', { ozellik: mod, sinif, konu });
        if (durum && !veri.limitYok) durum.ozellikler[mod].kalan = veri.kalan;
        if (mod === 'asistan') asistanCalistir(veri.sorular, konu);
        else if (mod === 'test') pratikCalistir(veri.sorular, konu);
        else testCalistir(veri.sorular, konu);
      } catch (hata) { hataGoster(hata); }
    }

    function soruKarti(soru, secili, onSec, dogruGoster, kilitle = false) {
      const secenekler = el('div', { class: 'zp-secenekler' }, ['A', 'B', 'C', 'D'].map(harf => {
          let sinifAd = 'zp-secenek';
          if (secili === harf) sinifAd += ' secili';
          if (dogruGoster) {
            if (harf === soru.answer) sinifAd += ' dogru';
            else if (secili === harf) sinifAd += ' yanlis';
          }
          return el('button', { type: 'button', class: sinifAd, onclick: () => onSec(harf) }, `${harf}) ${soru.options[harf]}`);
        }));
      if (kilitle) secenekler.querySelectorAll('button').forEach(button => { button.disabled = true; });
      return el('div', {}, el('p', { class: 'zp-soru' }, soru.text), secenekler);
    }

    function pratikCalistir(sorular, konu) {
      const cevaplar = new Array(sorular.length).fill(null);
      let i = 0;
      function ciz() {
        temizle();
        const soru = sorular[i];
        const cevap = cevaplar[i];
        const dogru = cevap === soru.answer;
        kok.append(el('div', { class: 'zp-kart' },
          el('button', { class: 'zp-btn zp-ikincil', type: 'button', onclick: secimEkrani }, '← Konu seçimine dön'),
          el('h3', {}, `${sinif}. sınıf · ${konu}`),
          el('p', { class: 'zp-kucuk' }, `Pratik sorusu ${i + 1} / ${sorular.length}`),
          soruKarti(soru, cevap, harf => {
            if (cevaplar[i] === null) {
              cevaplar[i] = harf;
              ciz();
            }
          }, cevap !== null, cevap !== null),
          cevap !== null ? el('div', { class: dogru ? 'zp-dogru-mesaj' : 'zp-hata' },
            dogru ? 'Doğru cevap!' : `Bu kez olmadı. Doğru cevap: ${soru.answer}.`,
            el('p', { class: 'zp-cozum' }, soru.explanation || '')) : '',
          cevap !== null ? el('button', {
            class: 'zp-btn',
            type: 'button',
            onclick: () => { if (i < sorular.length - 1) { i += 1; ciz(); } else pratikBitir(); }
          }, i < sorular.length - 1 ? 'Sonraki soru' : 'Pratiği bitir') : ''));
      }
      function pratikBitir() {
        const dogru = sorular.filter((s, n) => cevaplar[n] === s.answer).length;
        const bos = cevaplar.filter(c => !c).length;
        temizle();
        kok.append(el('div', { class: 'zp-kart' },
          el('h3', {}, 'Pratik tamamlandı'),
          el('p', { class: 'zp-puan' }, `${dogru} doğru · ${sorular.length - dogru - bos} yanlış · ${bos} boş`),
          el('p', { class: 'zp-kucuk' }, 'Her sorunun çözümünü cevabından hemen sonra görebilirsin.'),
          el('div', { class: 'zp-aksiyon' },
            el('button', { class: 'zp-btn', type: 'button', onclick: () => pratikCalistir(sorular, konu) }, 'Aynı pratiği yeniden çöz'),
            el('button', { class: 'zp-btn zp-ikincil', type: 'button', onclick: secimEkrani }, 'Başka konu seç'))));
      }
      ciz();
    }

    function testCalistir(sorular, konu) {
      const cevaplar = new Array(sorular.length).fill(null);
      let i = 0;
      function ciz() {
        temizle();
        const soru = sorular[i];
        kok.append(el('div', { class: 'zp-kart' },
          el('h3', {}, `${sinif}. sınıf · ${konu}`),
          el('p', { class: 'zp-kucuk' }, `Soru ${i + 1} / ${sorular.length}`),
          soruKarti(soru, cevaplar[i], harf => { cevaplar[i] = harf; ciz(); }, false),
          el('div', { class: 'zp-aksiyon' },
            i > 0 ? el('button', { class: 'zp-btn zp-ikincil', type: 'button', onclick: () => { i -= 1; ciz(); } }, 'Önceki') : '',
            i < sorular.length - 1
              ? el('button', { class: 'zp-btn', type: 'button', onclick: () => { i += 1; ciz(); } }, 'Sonraki')
              : el('button', { class: 'zp-btn', type: 'button', onclick: bitir }, 'Testi bitir'))));
      }
      function bitir() {
        const dogru = sorular.filter((s, n) => cevaplar[n] === s.answer).length;
        const bos = cevaplar.filter(c => !c).length;
        temizle();
        kok.append(el('div', { class: 'zp-kart' },
          el('h3', {}, 'Sonuç'),
          el('p', { class: 'zp-puan' }, `${dogru} doğru · ${sorular.length - dogru - bos} yanlış · ${bos} boş`),
          sorular.map((s, n) => el('div', { class: 'zp-inceleme' },
            soruKarti(s, cevaplar[n], () => {}, true),
            el('p', { class: 'zp-cozum' }, s.explanation || ''))),
          el('div', { class: 'zp-aksiyon' },
            el('button', { class: 'zp-btn', type: 'button', onclick: secimEkrani }, 'Başka konu seç'),
            durum && !durum.limitYok && durum.ozellikler[mod].kalan === 0
              ? el('a', { class: 'zp-btn zp-ikincil', href: durum.uyelikAdresi }, 'Üyelik paketlerini incele') : '')));
      }
      ciz();
    }

    function asistanCalistir(sorular, konu) {
      let i = 0;
      let dogru = 0;
      function ciz(secili, deneme = 0) {
        temizle();
        const soru = sorular[i];
        const cozuldu = secili === soru.answer;
        const acikla = cozuldu || deneme >= 2;
        let mesaj = '';
        if (secili && !cozuldu) mesaj = deneme >= 2 ? 'Doğru cevap işaretlendi, çözüme bak.' : 'Tam olmadı. İpucu: soruyu adım adım yeniden oku ve tekrar dene.';
        if (cozuldu) mesaj = 'Doğru! Aferin.';
        kok.append(el('div', { class: 'zp-kart' },
          el('h3', {}, `${sinif}. sınıf · ${konu}`),
          el('p', { class: 'zp-kucuk' }, `Soru ${i + 1} / ${sorular.length}`),
          soruKarti(soru, secili, harf => { if (!acikla) ciz(harf, harf === soru.answer ? deneme : deneme + 1); }, acikla),
          mesaj ? el('p', { class: cozuldu ? 'zp-dogru-mesaj' : 'zp-hata' }, mesaj) : '',
          acikla ? el('p', { class: 'zp-cozum' }, soru.explanation || '') : '',
          acikla ? el('div', { class: 'zp-aksiyon' }, el('button', {
            class: 'zp-btn', type: 'button', onclick: () => {
              if (cozuldu && deneme === 0) dogru += 1;
              if (i < sorular.length - 1) { i += 1; ciz(); } else bitis();
            }
          }, i < sorular.length - 1 ? 'Sonraki soru' : 'Bitir')) : ''));
      }
      function bitis() {
        temizle();
        kok.append(el('div', { class: 'zp-kart' }, el('h3', {}, 'Çalışma tamamlandı'),
          el('p', { class: 'zp-puan' }, `İlk denemede ${dogru} / ${sorular.length} doğru`),
          el('button', { class: 'zp-btn', type: 'button', onclick: secimEkrani }, 'Başka konu seç')));
      }
      ciz();
    }

    secimEkrani();
  }

  window.ZarifPratik = { mount };
})();
