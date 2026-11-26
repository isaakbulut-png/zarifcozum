(() => {
  // Yönetim ve kullanıcı panellerinde footer kesinlikle gösterilmez
  const pathname = (window.location.pathname || '').toLowerCase();
  if (
    pathname.includes('admin-paneli') ||
    pathname.includes('ogretmen-paneli') ||
    pathname.includes('ogrenci-paneli') ||
    pathname.includes('veli-panel') ||
    pathname.includes('yonetim') ||
    document.querySelector('.admin-panel, .teacher-layout, .app-shell, #studentAvatar')
  ) {
    return;
  }

  const existing = document.querySelector('footer.site-footer, footer.km-footer, body > footer');
  const footer = existing || document.createElement('footer');
  footer.className = 'site-footer site-footer-rich';
  footer.removeAttribute('style');

  const year = new Date().getFullYear();

  footer.innerHTML = `
    <div class="zc-footer-container">
      <!-- Üst Hızlı Başlangıç Şeridi (Footer CTA Kartı) -->
      <section class="zc-footer-cta" aria-label="Hızlı Başlangıç">
        <div class="zc-footer-cta-copy">
          <h2>Matematiği Görerek ve Anlayarak Öğrenmeye Başla</h2>
          <p>5–12. sınıf MEB Türkiye Yüzyılı Maarif Modeli uyumlu konu anlatımları, AI Mentör ve etkileşimli keşif laboratuvarı tek platformda.</p>
        </div>
        <div class="zc-footer-cta-actions">
          <a class="zc-footer-btn-amber" href="/kayit-giris.html?mode=register">Ücretsiz Kayıt Ol →</a>
          <a class="zc-footer-btn-outline" href="/Paketler.html">Paketleri İncele</a>
        </div>
      </section>

      <!-- Sol Marka + Sağ 4 Düzenli Sütun -->
      <div class="zc-footer-main">
        <section class="zc-footer-brand">
          <a class="zc-footer-logo-link" href="/index.html">
            <img src="/assets/brand-mark.png" alt="ZarifÇözüm Logo">
            <span>ZarifÇözüm</span>
          </a>
          <p>Maarif Modeli matematik öğrenimi için konu, pratik, etkileşimli deney ve öğrenci takibini tek platformda buluşturan eğitim deneyimi.</p>
          <div class="zc-footer-badges">
            <span class="zc-footer-badge">✓ MEB Maarif Modeli Uyumlu</span>
            <span class="zc-footer-badge">🔒 256-Bit Güvenli Altyapı</span>
          </div>
        </section>

        <nav class="zc-footer-col" aria-label="Platform bağlantıları">
          <h3>Platform</h3>
          <a href="/panel.html">Öğrenci Paneli</a>
          <a href="/Platform%20Ayr%C4%B1cal%C4%B1klar%C4%B1.html">Platform Ayrıcalıkları</a>
          <a href="/Paketler.html">Paketler</a>
          <a href="/index.html#sss">Sık Sorulan Sorular</a>
        </nav>

        <nav class="zc-footer-col" aria-label="Öğrenme bağlantıları">
          <h3>Öğrenme</h3>
          <a href="/konu.html">Konu Anlatımları</a>
          <a href="/test.html">Kendini Dene / Testler</a>
          <a href="/pages/kesif-modu.html">Keşif Laboratuvarı</a>
          <a href="/canli.html">Canlı Dersler</a>
          <a href="/ogrenci-paneli.html#ai-mentor-panel">Öğrenme Asistanı</a>
          <a href="/deneme-sinavi-optik.html">Soru Pratiği ve Denemeler</a>
        </nav>

        <nav class="zc-footer-col" aria-label="Kurum bağlantıları">
          <h3>Kurum</h3>
          <a href="/hakkimizda.html">Hakkımızda</a>
          <a href="/iletisim.html">İletişim</a>
          <a href="/kayit-giris.html">Üye Girişi</a>
          <a href="/kayit-giris.html?mode=register">Hesap Oluştur</a>
        </nav>

        <nav class="zc-footer-col" aria-label="Yasal bağlantılar">
          <h3>Yasal</h3>
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
    </div>

    <!-- En Alt Bağımsız Taban Şeridi (Copyright Bar — #0F172A) -->
    <div class="zc-footer-copyright-bar">
      <div class="zc-footer-container">
        <div class="zc-footer-bottom">
          <span>© ${year} ZarifÇözüm. Tüm hakları saklıdır. Platformdaki tüm soru, test, görsel ve yapay zekâ destekli özgün eğitim içerikleri 5846 sayılı FSEK kapsamında ZarifÇözüm'e aittir; izinsiz çoğaltılamaz.</span>
          <a href="/yasal.html#art-07">Telif Hakları (5846 FSEK) &amp; KVKK</a>
        </div>
      </div>
    </div>`;

  if (!footer.isConnected) document.body.append(footer);

  if (!document.querySelector('[data-site-footer-styles]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/assets/site-footer.css?v=3';
    stylesheet.dataset.siteFooterStyles = '';
    document.head.append(stylesheet);
  }
})();
