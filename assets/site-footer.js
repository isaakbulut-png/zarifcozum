(() => {
  const footer = document.querySelector('footer.site-footer') || document.createElement('footer');
  footer.className = 'site-footer site-footer-rich';
  footer.innerHTML = `
    <div class="wrap">
      <div class="site-footer-columns">
        <section class="site-footer-brand">
          <a class="brand" href="/index.html">
            <img class="brand-logo" src="/assets/brand-mark-white.png" alt="">
            <span>ZarifÇözüm</span>
          </a>
          <p>Maarif Modeli matematik öğrenimi için konu, pratik ve öğrenci takibini tek platformda buluşturan eğitim deneyimi.</p>
        </section>
        <nav class="site-footer-group" aria-label="Platform bağlantıları">
          <h2>Platform</h2>
          <a href="/panel.html">Öğrenci Paneli</a>
          <a href="/Platform%20Ayr%C4%B1cal%C4%B1klar%C4%B1.html">Platform Ayrıcalıkları</a>
          <a href="/Paketler.html">Paketler</a>
          <a href="/index.html#sss">Sık Sorulan Sorular</a>
        </nav>
        <nav class="site-footer-group" aria-label="Öğrenme bağlantıları">
          <h2>Öğrenme</h2>
          <a href="/konu.html">Konu Anlatımları</a>
          <a href="/test.html">Kazanım Testleri</a>
          <a href="/canli.html">Canlı Dersler</a>
          <a href="/asistan.html">Öğrenme Asistanı</a>
          <a href="/deneme-sinavi-optik.html">Optik Deneme</a>
        </nav>
        <nav class="site-footer-group" aria-label="Kurum bağlantıları">
          <h2>Kurum</h2>
          <a href="/hakkimizda.html">Hakkımızda</a>
          <a href="/yasal.html#iletisim">İletişim</a>
          <a href="/kayit-giris.html">Üye Girişi</a>
          <a href="/kayit-giris.html?mode=register">Hesap Oluştur</a>
        </nav>
        <nav class="site-footer-group site-footer-legal" aria-label="Yasal bağlantılar">
          <h2>Yasal</h2>
          <a href="/yasal.html#uyelik-sozlesmesi">Üyelik Sözleşmesi</a>
          <a href="/yasal.html#kullanim-kosullari">Kullanım Şartları</a>
          <a href="/yasal.html#gizlilik-politikasi">Gizlilik Politikası</a>
          <a href="/yasal.html#kvkk-aydinlatma">KVKK Aydınlatma Metni</a>
          <a href="/yasal.html#cerez-politikasi">Çerez Politikası</a>
          <a href="/yasal.html#cerez-tercihleri">Çerez Tercihleri</a>
          <a href="/yasal.html#acik-riza">Açık Rıza Metni</a>
          <a href="/yasal.html#on-bilgilendirme">Ön Bilgilendirme Formu</a>
          <a href="/yasal.html#mesafeli-satis">Mesafeli Satış Sözleşmesi</a>
          <a href="/yasal.html#iptal-iade">İptal ve İade</a>
        </nav>
      </div>
      <div class="site-footer-bottom">
        <span>© ${new Date().getFullYear()} ZarifÇözüm. Tüm hakları saklıdır.</span>
        <a href="/yasal.html#kvkk-aydinlatma">Kişisel veriler ve gizlilik</a>
      </div>
    </div>`;

  if (!footer.isConnected) document.body.append(footer);

  if (!document.querySelector('[data-site-footer-styles]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/assets/site-footer.css';
    stylesheet.dataset.siteFooterStyles = '';
    document.head.append(stylesheet);
  }
})();
