/* ==========================================================================
   ZarifÇözüm — Evrensel Mobil Hamburger Menü & Akordeon Çekmece (mobile-nav.js)
   - Tüm genel sayfalardaki üst menüyü ≤ 992px ekranlarda temiz Hamburger Menüye çevirir
   - Panel sayfalarında (öğrenci/öğretmen/admin/veli) panel yan menüsüyle çakışmaz
   ========================================================================== */
(function () {
  'use strict';
  if (window.__zcMobileNavInit) return;
  window.__zcMobileNavInit = true;

  var path = (window.location.pathname || '').toLowerCase();
  var isPanelPage = /(?:ogrenci-paneli|ogretmen-paneli|admin-paneli|veli-panel|panel\.html|admin-giris|admin-maliyet|zoom-room)/.test(path);
  if (isPanelPage) return;

  function initMobileNav() {
    var header = document.querySelector('header.site-header, header.topbar, header.header, header.zc-kesif-header, header.km-navbar, header');
    if (!header) return;

    document.body.classList.add('zc-has-mob-nav');

    // Aynı sayfada eski mobil toggle varsa gizle, tek temiz hamburger kullan
    var existingToggles = header.querySelectorAll('.menu-toggle, .mobile-menu-btn, .hamburger, #mobileMenuBtn');
    existingToggles.forEach(function (el) { el.style.display = 'none'; });

    // Hamburger butonu oluştur (sağ üst)
    if (!header.querySelector('.zc-mob-burger')) {
      var burger = document.createElement('button');
      burger.type = 'button';
      burger.className = 'zc-mob-burger';
      burger.setAttribute('aria-label', 'Mobil menüyü aç');
      burger.setAttribute('aria-expanded', 'false');
      burger.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
          '<line x1="4" y1="6" x2="20" y2="6"/>' +
          '<line x1="4" y1="12" x2="20" y2="12"/>' +
          '<line x1="4" y1="18" x2="20" y2="18"/>' +
        '</svg>';

      // Header içinde kapsayıcı inner/wrap varsa onun içine koy, yoksa header'a ekle
      var inner = header.querySelector('.nav-inner, .header-inner, .topbar-inner, .container, .wrap');
      (inner || header).appendChild(burger);

      // Backdrop + Off-Canvas Drawer oluştur
      var backdrop = document.createElement('div');
      backdrop.className = 'zc-mob-backdrop';

      var drawer = document.createElement('aside');
      drawer.className = 'zc-mob-drawer';
      drawer.setAttribute('aria-label', 'Mobil Navigasyon');
      drawer.innerHTML =
        '<div class="zc-mob-head">' +
          '<div class="zc-mob-brand">Zarif<span>Çözüm</span></div>' +
          '<button type="button" class="zc-mob-close" aria-label="Menüyü kapat">✕</button>' +
        '</div>' +
        '<div class="zc-mob-body">' +
          '<a class="zc-mob-link" href="/index.html"><span>🏠 Anasayfa</span><span>→</span></a>' +
          '<a class="zc-mob-link" href="/index.html#nasil-calisir"><span>⚙️ Nasıl Çalışır</span><span>→</span></a>' +
          '<a class="zc-mob-link" href="/index.html#sss"><span>❓ Sıkça Sorulan Sorular</span><span>→</span></a>' +
          '<a class="zc-mob-link" href="/hakkimizda.html"><span>📘 Hakkımızda</span><span>→</span></a>' +
          '<a class="zc-mob-link" href="/Platform%20Ayr%C4%B1cal%C4%B1klar%C4%B1.html"><span>✨ Platform Ayrıcalıkları</span><span>→</span></a>' +
          '<a class="zc-mob-link" href="/Paketler.html"><span>💎 Paketler</span><span>→</span></a>' +
          '<a class="zc-mob-link" href="/iletisim.html"><span>📩 İletişim</span><span>→</span></a>' +

          '<div class="zc-mob-acc open" id="zcMobLoginAcc">' +
            '<button type="button" class="zc-mob-acc-btn" id="zcMobLoginAccBtn" aria-expanded="true">' +
              '<span>🔐 Giriş Yap</span><span data-acc-arrow>▲</span>' +
            '</button>' +
            '<div class="zc-mob-acc-list">' +
              '<a class="zc-mob-role-link" href="/kayit-giris.html?rol=ogrenci"><span>🎓</span><span>Öğrenci Girişi</span></a>' +
              '<a class="zc-mob-role-link" href="/kayit-giris.html?rol=ogretmen"><span>👩‍🏫</span><span>Öğretmen Girişi</span></a>' +
              '<a class="zc-mob-role-link" href="/kayit-giris.html?rol=veli"><span>👨‍👩‍👧</span><span>Veli Girişi</span></a>' +
            '</div>' +
          '</div>' +

          '<a class="zc-mob-cta" href="/kayit-giris.html?mod=kayit">🚀 Ücretsiz Kayıt Ol</a>' +
        '</div>';

      document.body.appendChild(backdrop);
      document.body.appendChild(drawer);

      function openMenu() {
        backdrop.classList.add('open');
        drawer.classList.add('open');
        burger.setAttribute('aria-expanded', 'true');
        document.documentElement.style.overflow = 'hidden';
      }
      function closeMenu() {
        backdrop.classList.remove('open');
        drawer.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.documentElement.style.overflow = '';
      }

      burger.addEventListener('click', openMenu);
      backdrop.addEventListener('click', closeMenu);
      drawer.querySelector('.zc-mob-close').addEventListener('click', closeMenu);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

      drawer.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMenu);
      });

      var acc = drawer.querySelector('#zcMobLoginAcc');
      var accBtn = drawer.querySelector('#zcMobLoginAccBtn');
      accBtn.addEventListener('click', function () {
        var isOpen = acc.classList.toggle('open');
        accBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        var arrow = accBtn.querySelector('[data-acc-arrow]');
        if (arrow) arrow.textContent = isOpen ? '▲' : '▼';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
