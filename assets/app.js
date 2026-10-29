/* ZarifÇözüm demo — shared shell */
(function () {
  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>',
    test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
    bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/></svg>',
    arch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="15" width="18" height="5" rx="1"/><path d="M12 9v6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };
  window.MR_ICONS = icons;

  const nav = [
    { href: 'panel.html', label: 'Panel', icon: 'home' },
    { href: 'konu.html', label: 'Konular', icon: 'book' },
    { href: 'test.html', label: 'Testler', icon: 'test' },
    { href: 'canli.html', label: 'Canlı Ders', icon: 'live' },
    { href: 'asistan.html', label: 'Asistan', icon: 'bot' },
    { href: 'mimari.html', label: 'Mimari & İş Akışı', icon: 'arch' }
  ];
  const current = location.pathname.split('/').pop() || 'index.html';

  const side = document.querySelector('[data-shell="sidebar"]');
  if (side) {
    side.innerHTML = `
      <a class="brand" href="index.html"><img class="brand-logo" src="assets/brand-mark.png" alt="">ZarifÇözüm</a>
      <nav class="side-nav" aria-label="Uygulama">
        ${nav.map(n => `<a href="${n.href}" ${n.href === current ? 'aria-current="page"' : ''}>${icons[n.icon]}<span>${n.label}</span></a>`).join('')}
      </nav>
      <div class="side-user">
        <span class="avatar">EA</span>
        <div><strong>Elif A.</strong><br><span class="muted">6. Sınıf · Maarif Modeli</span></div>
      </div>`;
  }
  const tab = document.querySelector('[data-shell="tabbar"]');
  if (tab) {
    tab.innerHTML = nav.slice(0, 5).map(n => `<a href="${n.href}" ${n.href === current ? 'aria-current="page"' : ''}>${icons[n.icon]}<span>${n.label}</span></a>`).join('');
  }
  const top = document.querySelector('[data-shell="mobile-top"]');
  if (top) {
    top.innerHTML = `<a class="brand" href="index.html"><img class="brand-logo" src="assets/brand-mark.png" alt="">ZarifÇözüm</a><a href="mimari.html" class="chip">Mimari</a>`;
  }
})();
