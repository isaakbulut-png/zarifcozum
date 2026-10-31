(() => {
  const HOME_URL = 'index.html';
  const isHome = document.body.classList.contains('homepage');
  if (isHome || document.querySelector('[data-site-breadcrumb]')) return;

  const label = (document.body.dataset.breadcrumb || document.title
    .split(/\s[|—–-]\s/)
    .map((part) => part.trim())
    .filter((part) => part && !/^(MatRota|ZarifÇözüm)$/i.test(part))
    .pop() || document.title).trim();

  const style = document.createElement('style');
  style.textContent = `
    .site-breadcrumb { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin: 0 0 1.25rem; padding: 0.25rem 0; font: 500 0.875rem/1.4 'General Sans', 'Helvetica Neue', Arial, sans-serif; color: #58685e; }
    .site-breadcrumb a { display: inline-flex; align-items: center; gap: 0.4rem; color: #58685e; text-decoration: none; }
    .site-breadcrumb a:hover { color: #267456; text-decoration: underline; text-underline-offset: 3px; }
    .site-breadcrumb a:focus-visible { outline: 2px solid #267456; outline-offset: 3px; border-radius: 4px; }
    .site-breadcrumb svg { width: 1rem; height: 1rem; }
    .site-breadcrumb .sep { color: #839087; }
    .site-breadcrumb .current { color: #1d2d25; font-weight: 600; }
  `;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.className = 'site-breadcrumb';
  nav.setAttribute('data-site-breadcrumb', '');
  nav.setAttribute('aria-label', 'Sayfa yolu');
  nav.innerHTML = `
    <a href="${HOME_URL}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Anasayfa</a>
    <span class="sep" aria-hidden="true">/</span>
    <span class="current" aria-current="page"></span>`;
  nav.querySelector('.current').textContent = label;

  const main = document.querySelector('main');
  if (!main) {
    document.body.prepend(nav);
    return;
  }
  const container = main.firstElementChild && main.firstElementChild.classList.contains('wrap')
    ? main.firstElementChild
    : main;
  const mobileTop = container.querySelector(':scope > .mobile-top');
  if (mobileTop) mobileTop.after(nav);
  else container.prepend(nav);
})();
