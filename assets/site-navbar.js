/**
 * ZarifÇözüm Ortak Modern Üst Menü (Sticky Glassmorphism Navbar)
 * Tüm genel sayfalardaki <header class="site-header"> öğesini standartlaştırır,
 * rol seçimli "Giriş Yap ▾" açılır menüsünü ve mobil drawer'ı yönetir.
 */
(function (global) {
  'use strict';

  function isHomePage() {
    var path = (global.location.pathname || '').toLowerCase();
    return path === '/' || path.endsWith('/index.html') || path === 'index.html';
  }

  function buildNavMarkup() {
    var home = isHomePage();
    var p = (global.location.pathname || '').toLowerCase();
    var navItems = [
      { label: 'Nasıl Çalışır', href: home ? '#nasil' : 'index.html#nasil', key: 'nasil' },
      { label: 'SSS', href: home ? '#sss' : 'index.html#sss', key: 'sss' },
      { label: 'Hakkımızda', href: 'hakkimizda.html', key: 'hakkimizda' },
      { label: 'Platform Ayrıcalıkları', href: 'Platform%20Ayr%C4%B1cal%C4%B1klar%C4%B1.html', key: 'ayricalik' },
      { label: 'Paketler', href: home ? '#paketler' : 'Paketler.html', key: 'paketler' },
      { label: 'İletişim', href: 'iletisim.html', key: 'iletisim' }
    ];

    var isActive = function (key) {
      if (key === 'hakkimizda' && p.indexOf('hakkimizda') !== -1) return true;
      if (key === 'iletisim' && p.indexOf('iletisim') !== -1) return true;
      if (key === 'paketler' && p.indexOf('paketler') !== -1) return true;
      if (key === 'ayricalik' && (p.indexOf('ayr') !== -1 || p.indexOf('platform') !== -1)) return true;
      return false;
    };

    var linksHtml = navItems.map(function (it) {
      return '<a class="zc-nav-link' + (isActive(it.key) ? ' is-active' : '') + '" href="' + it.href + '">' + it.label + '</a>';
    }).join('');

    var rolesHtml =
      '<a class="zc-role-item" href="kayit-giris.html?role=student">' +
        '<span class="zc-role-ico">🎓</span>' +
        '<span class="zc-role-copy"><strong>Öğrenci Girişi</strong><small>Dersler, testler ve AI Mentör</small></span>' +
      '</a>' +
      '<a class="zc-role-item" href="kayit-giris.html?role=teacher">' +
        '<span class="zc-role-ico">👨‍🏫</span>' +
        '<span class="zc-role-copy"><strong>Öğretmen Girişi</strong><small>Soru üretimi ve sınıf yönetimi</small></span>' +
      '</a>' +
      '<a class="zc-role-item" href="kayit-giris.html?role=parent">' +
        '<span class="zc-role-ico">👨‍👩‍👧</span>' +
        '<span class="zc-role-copy"><strong>Veli Girişi</strong><small>Gelişim takibi ve karne raporları</small></span>' +
      '</a>';

    return (
      '<div class="zc-nav-inner">' +
        '<a class="zc-nav-brand" href="index.html" aria-label="ZarifÇözüm Ana Sayfa">' +
          '<img class="zc-nav-logo" src="assets/brand-mark.png" alt="ZarifÇözüm Logo">' +
          '<span class="zc-nav-brand-text">' +
            '<span class="zc-nav-brand-name">ZarifÇözüm</span>' +
            '<span class="zc-nav-brand-sub">Yapay Zekâ Destekli Matematik</span>' +
          '</span>' +
        '</a>' +

        '<nav class="zc-nav-links" aria-label="Ana Navigasyon">' + linksHtml + '</nav>' +

        '<div class="zc-nav-actions">' +
          '<div class="zc-login-dropdown" id="zcLoginDropdown">' +
            '<button type="button" class="zc-login-trigger" id="zcLoginTrigger" aria-haspopup="true" aria-expanded="false">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
              '<span>Giriş Yap</span>' +
              '<span class="zc-login-caret">▾</span>' +
            '</button>' +
            '<div class="zc-login-menu" role="menu" aria-label="Rol Seçimli Giriş">' + rolesHtml + '</div>' +
          '</div>' +
          '<a class="zc-cta-register" href="kayit-giris.html?mode=register">Ücretsiz Kayıt Ol →</a>' +
        '</div>' +

        '<button type="button" class="zc-mobile-toggle" id="zcMobileToggle" aria-expanded="false" aria-label="Menüyü Aç/Kapat">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
        '</button>' +
      '</div>' +

      '<div class="zc-mobile-drawer" id="zcMobileDrawer">' +
        '<div class="zc-mob-links">' +
          navItems.map(function (it) { return '<a href="' + it.href + '">' + it.label + '</a>'; }).join('') +
        '</div>' +
        '<div class="zc-mob-roles-title">Giriş Yap — Rolünüzü Seçin</div>' +
        '<div class="zc-mob-roles">' + rolesHtml + '</div>' +
        '<a class="zc-cta-register zc-mob-cta" href="kayit-giris.html?mode=register">Ücretsiz Kayıt Ol →</a>' +
      '</div>'
    );
  }

  function bindInteractions(header) {
    var dd = header.querySelector('#zcLoginDropdown');
    var trigger = header.querySelector('#zcLoginTrigger');
    var mobBtn = header.querySelector('#zcMobileToggle');
    var mobDrawer = header.querySelector('#zcMobileDrawer');

    if (dd && trigger) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var next = !dd.classList.contains('is-open');
        dd.classList.toggle('is-open', next);
        trigger.setAttribute('aria-expanded', String(next));
      });

      document.addEventListener('click', function (e) {
        if (!dd.contains(e.target)) {
          dd.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          dd.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          if (mobDrawer) mobDrawer.classList.remove('is-open');
          if (mobBtn) mobBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (mobBtn && mobDrawer) {
      mobBtn.addEventListener('click', function () {
        var next = !mobDrawer.classList.contains('is-open');
        mobDrawer.classList.toggle('is-open', next);
        mobBtn.setAttribute('aria-expanded', String(next));
      });

      mobDrawer.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobDrawer.classList.remove('is-open');
          mobBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function init() {
    var header = document.querySelector('header.site-header, header.zc-navbar');
    if (!header) return;
    header.classList.add('zc-navbar');
    header.innerHTML = buildNavMarkup();
    bindInteractions(header);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
