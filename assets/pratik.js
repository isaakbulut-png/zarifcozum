(function () {
  'use strict';

  const MUFREDAT = () => window.MATEMATIK_MUFREDATI || {};
  const BASLIKLAR = {
    konu: 'Konu anlatımları',
    asistan: 'Asistanla soru çöz',
    test: 'Test çöz',
    kazanim: 'Kazanım testi'
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
      : {};
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

  function mount(kok, { mod, sinif: baslangicSinifi } = {}) {
    if (!kok || !BASLIKLAR[mod]) return;
    kok.classList.add('zp');
    let durum = null;
    let sinif = Number(baslangicSinifi) >= 5 && Number(baslangicSinifi) <= 11 ? Number(baslangicSinifi) : 5;
    let yonlendirmeSayaci = null;

    function temizle() {
      clearInterval(yonlendirmeSayaci);
      kok.replaceChildren();
    }

    function durumSerit() {
      if (!durum) return el('div');
      if (durum.uye) return el('div', { class: 'zp-serit zp-uye' }, 'Üyelik aktif: sınırsız erişim');
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
      try { durum = await api('/durum'); } catch { durum = null; }
      temizle();
      const mufredat = MUFREDAT();
      const sinifSecici = el('div', { class: 'zp-siniflar', role: 'tablist' },
        [5, 6, 7, 8, 9, 10, 11].map(n => el('button', {
          type: 'button', class: 'zp-sinif' + (n === sinif ? ' aktif' : ''),
          onclick: () => { sinif = n; secimEkrani(); }
        }, n + '. sınıf')));
      const kullanilan = durum ? durum.ozellikler[mod].kullanilan : [];
      const unite = (mufredat[sinif] || []).map(u => el('div', { class: 'zp-unite' },
        el('h4', {}, u.title),
        el('div', { class: 'zp-konular' }, u.topics.map(konu => {
          const kilitli = durum && !durum.uye && durum.ozellikler[mod].kalan === 0 &&
            !kullanilan.some(k => k.sinif === sinif && k.konu === konu);
          return el('button', {
            type: 'button', class: 'zp-konu' + (kilitli ? ' kilitli' : ''),
            onclick: () => konuAc(konu)
          }, (kilitli ? '🔒 ' : '') + konu);
        }))));
      kok.append(el('div', { class: 'zp-kart' },
        el('h3', {}, BASLIKLAR[mod]), durumSerit(),
        el('p', { class: 'zp-kucuk' }, 'Sınıfını seç, sonra bir konu seç.'),
        sinifSecici, unite));
    }

    function konuAc(konu) {
      if (mod === 'konu') return anlatimAc(konu);
      return sorularAc(konu);
    }

    async function anlatimAc(konu) {
      yukleniyor('Konu anlatımı hazırlanıyor…');
      try {
        const veri = await api('/konu', { sinif, konu });
        if (durum && !veri.uye) durum.ozellikler.konu.kalan = veri.kalan;
        const a = veri.anlatim;
        temizle();
        kok.append(el('div', { class: 'zp-kart' },
          el('button', { class: 'zp-btn zp-ikincil', type: 'button', onclick: secimEkrani }, '← Konulara dön'),
          el('h3', {}, `${sinif}. sınıf · ${konu}`),
          el('p', {}, a.ozet),
          el('h4', {}, 'Temel kavramlar'), el('ul', {}, a.kavramlar.map(k => el('li', {}, k))),
          el('h4', {}, 'Örnek soru'), el('p', {}, a.ornekSoru),
          el('h4', {}, 'Çözüm'), el('p', { class: 'zp-cozum' }, a.ornekCozum),
          el('h4', {}, 'Sık yapılan hatalar'), el('ul', {}, a.sikHatalar.map(k => el('li', {}, k))),
          veri.uye ? '' : el('p', { class: 'zp-kucuk' }, `Ücretsiz deneme: ${veri.kalan} konu hakkın kaldı.`)));
      } catch (hata) { hataGoster(hata); }
    }

    async function sorularAc(konu) {
      yukleniyor('Sorular hazırlanıyor…');
      try {
        const veri = await api('/sorular', { ozellik: mod, sinif, konu });
        if (durum && !veri.uye) durum.ozellikler[mod].kalan = veri.kalan;
        mod === 'asistan' ? asistanCalistir(veri.sorular, konu) : testCalistir(veri.sorular, konu);
      } catch (hata) { hataGoster(hata); }
    }

    function soruKarti(soru, secili, onSec, dogruGoster) {
      return el('div', {},
        el('p', { class: 'zp-soru' }, soru.text),
        el('div', { class: 'zp-secenekler' }, ['A', 'B', 'C', 'D'].map(harf => {
          let sinifAd = 'zp-secenek';
          if (secili === harf) sinifAd += ' secili';
          if (dogruGoster) {
            if (harf === soru.answer) sinifAd += ' dogru';
            else if (secili === harf) sinifAd += ' yanlis';
          }
          return el('button', { type: 'button', class: sinifAd, onclick: () => onSec(harf) }, `${harf}) ${soru.options[harf]}`);
        })));
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
            durum && !durum.uye && durum.ozellikler[mod].kalan === 0
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
