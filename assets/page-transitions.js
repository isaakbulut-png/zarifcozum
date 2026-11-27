/* ==========================================================================
   ZarifÇözüm — Site Geneli Yumuşak Milisaniyelik Sayfa Geçiş Motoru
   - Modern tarayıcılarda yerel @view-transition (180ms yumuşak geçiş)
   - Tüm tarayıcılarda 150ms fade-in + mikro kayma (panel sekmeleri dahil)
   - Erişilebilirlik: prefers-reduced-motion desteğine tam saygı
   ========================================================================== */
(function () {
  'use strict';
  if (window.__zcPageTransitionsInit) return;
  window.__zcPageTransitionsInit = true;

  var style = document.createElement('style');
  style.id = 'zcPageTransitionsStyle';
  style.textContent = [
    '@view-transition { navigation: auto; }',
    '::view-transition-old(root) { animation: zcFadeOut 150ms cubic-bezier(0.22, 1, 0.36, 1) both; }',
    '::view-transition-new(root) { animation: zcFadeIn 190ms cubic-bezier(0.22, 1, 0.36, 1) both; }',
    '@keyframes zcFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }',
    '@keyframes zcFadeOut { from { opacity: 1; } to { opacity: 0; } }',
    'body.zc-pt-ready { animation: zcFadeIn 190ms cubic-bezier(0.22, 1, 0.36, 1) both; }',
    'body.zc-pt-leaving { opacity: 0; transition: opacity 130ms ease-out; pointer-events: none; }',
    '.panel-view.active, .panel-view:not([hidden]), section[id^="view-"]:not([hidden]) { animation: zcFadeIn 180ms cubic-bezier(0.22, 1, 0.36, 1); }',
    '@media (prefers-reduced-motion: reduce) {',
    '  ::view-transition-old(root), ::view-transition-new(root), body.zc-pt-ready, body.zc-pt-leaving, .panel-view, section[id^="view-"] { animation: none !important; transition: none !important; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  function markReady() {
    if (!document.body) return;
    document.body.classList.remove('zc-pt-leaving');
    document.body.classList.add('zc-pt-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady);
  } else {
    markReady();
  }

  // Tarayıcı geri/ileri (bfcache) dönüşlerinde görünürlüğü sıfırla
  window.addEventListener('pageshow', function () {
    if (document.body) document.body.classList.remove('zc-pt-leaving');
  });

  // Site içi link tıklamalarında yumuşak 130ms çıkış geçişi
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!link) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    var rawHref = link.getAttribute('href') || '';
    if (!rawHref || rawHref.charAt(0) === '#' || /^(?:mailto:|tel:|javascript:)/i.test(rawHref)) return;

    var dest;
    try { dest = new URL(link.href, window.location.href); } catch (_) { return; }
    if (dest.origin !== window.location.origin) return;
    if (dest.pathname === window.location.pathname && dest.search === window.location.search) return;

    // Yerel View Transitions API destekliyorsa tarayıcıya bırak (sıfır gecikme)
    if (CSS && CSS.supports && CSS.supports('view-transition-name: root') && 'onpagereveal' in window) {
      return;
    }

    e.preventDefault();
    if (document.body) document.body.classList.add('zc-pt-leaving');
    setTimeout(function () {
      window.location.href = dest.href;
    }, 125);
  });
})();
