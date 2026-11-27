/* ==========================================================================
   ZarifÇözüm — Özgün İçerik Koruma Paketi (1 + 2 + 3 Hibrit İmza)
   1) %4.5 opaklıkta arka plan ZarifÇözüm hologram filigranı
   2) Alt bölümde kurumsal yasal telif & özgünlük şeridi + doğrulama kodu
   3) Bakır-altın hologramlı "ZarifÇözüm Özgün Mührü" rozeti
   ========================================================================== */
(function () {
  'use strict';

  if (window.ZarifBrandSeal) return;

  const STYLE_ID = 'zcBrandSealStyles';

  function computeContentCode(seedText) {
    const str = String(seedText || 'zarifcozum');
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const hex = ((hash >>> 0) % 0xffff).toString(16).toUpperCase().padStart(4, '0');
    return `ZC-2026-${hex}`;
  }

  function buildWatermarkDataUri() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
      <g transform="translate(160,100) rotate(-20)" fill="#2b180d" fill-opacity="0.048" font-family="Inter,Segoe UI,sans-serif" text-anchor="middle">
        <circle cx="0" cy="-26" r="18" fill="none" stroke="#9a3412" stroke-opacity="0.065" stroke-width="2.2"/>
        <text x="0" y="-20" font-size="16" font-weight="900" fill="#9a3412" fill-opacity="0.075">Z</text>
        <text x="0" y="10" font-size="18" font-weight="800" letter-spacing="3">ZARİFÇÖZÜM</text>
        <text x="0" y="28" font-size="9.5" font-weight="700" letter-spacing="2.2">ÖZGÜN EĞİTİM İÇERİĞİ</text>
      </g>
    </svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const wmUri = buildWatermarkDataUri();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .zc-protected-surface {
        position: relative !important;
        overflow: hidden;
      }
      .zc-protected-surface::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image: ${wmUri};
        background-repeat: repeat;
        background-size: 320px 200px;
        z-index: 0;
      }
      .zc-protected-surface > *:not(.zc-seal-badge-wrap):not(.zc-copyright-bar) {
        position: relative;
        z-index: 1;
      }

      /* 3. Bakır-Altın Hologram Mühür Rozeti */
      .zc-seal-badge-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 11px 4px 8px;
        border-radius: 999px;
        background: linear-gradient(125deg, #2b180d 0%, #7c2d12 42%, #c2410c 72%, #2b180d 100%);
        background-size: 220% 220%;
        color: #fffbeb;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.03em;
        border: 1px solid rgba(251, 191, 36, 0.45);
        box-shadow: 0 2px 10px rgba(124, 45, 18, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.22);
        transition: background-position 0.5s ease, transform 0.2s ease;
        user-select: none;
        position: relative;
        z-index: 2;
      }
      .zc-seal-badge-wrap:hover {
        background-position: 100% 50%;
        transform: translateY(-1px);
      }
      .zc-seal-crest {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: linear-gradient(135deg, #fde68a 0%, #f59e0b 55%, #b45309 100%);
        color: #2b180d;
        font-size: 10.5px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      }
      .zc-seal-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        font-weight: 700;
        color: #fde68a;
        padding-left: 5px;
        border-left: 1px solid rgba(254, 243, 199, 0.28);
      }

      /* 2. Kurumsal Telif & Özgünlük Alt Şeridi */
      .zc-copyright-bar {
        position: relative;
        z-index: 2;
        margin-top: 14px;
        padding: 9px 14px;
        border-top: 1px solid rgba(180, 130, 88, 0.26);
        background: linear-gradient(90deg, rgba(250, 246, 241, 0.85) 0%, rgba(255, 247, 237, 0.72) 100%);
        border-radius: 0 0 12px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        font-size: 11px;
        color: #6b4f3a;
        line-height: 1.4;
      }
      .zc-copyright-left {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }
      .zc-copyright-left strong {
        color: #2b180d;
        font-weight: 800;
      }
      .zc-copyright-right {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        color: #9a3412;
        white-space: nowrap;
      }
      @media (max-width: 640px) {
        .zc-copyright-bar {
          font-size: 10px;
          padding: 8px 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createSealBadgeHtml(code) {
    return `<span class="zc-seal-badge-wrap" title="ZarifÇözüm Özgün Müfredat ve Telif Mührü">
      <span class="zc-seal-crest">Z</span>
      <span>ZarifÇözüm Özgün İçerik</span>
      <span class="zc-seal-code">${code}</span>
    </span>`;
  }

  function createCopyrightBarElement(code, compact) {
    const bar = document.createElement('div');
    bar.className = 'zc-copyright-bar';
    bar.setAttribute('data-zc-seal-bar', '1');
    const legalText = compact
      ? '© 2026 ZarifÇözüm — Özgün eğitim içeriğidir; izinsiz kopyalanamaz ve paylaşılamaz.'
      : '© 2026 ZarifÇözüm — Tüm hakları saklıdır. Bu içerik yalnızca ZarifÇözüm’e aittir; izinsiz kopyalanamaz, çoğaltılamaz ve ticari amaçla paylaşılamaz.';
    bar.innerHTML = `
      <div class="zc-copyright-left">
        <span>🛡️</span>
        <strong>ZarifÇözüm Özgün İçerik</strong>
        <span>· ${legalText}</span>
      </div>
      <div class="zc-copyright-right">
        <span>www.zarifcozum.com</span>
        <span style="padding:2px 7px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;font-family:ui-monospace,monospace;font-size:10px;">${code}</span>
      </div>
    `;
    return bar;
  }

  function stampElement(el, opts = {}) {
    if (!el || el.dataset.zcStamped === '1') return;
    injectStyles();
    el.dataset.zcStamped = '1';
    el.classList.add('zc-protected-surface');

    const seed = opts.seed || el.textContent?.slice(0, 120) || document.title;
    const code = computeContentCode(seed);

    if (opts.withBadge !== false && !el.querySelector('.zc-seal-badge-wrap')) {
      const badgeWrap = document.createElement('div');
      badgeWrap.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:8px;position:relative;z-index:2;';
      badgeWrap.innerHTML = createSealBadgeHtml(code);
      el.prepend(badgeWrap);
    }

    if (opts.withFooter !== false && !el.querySelector('[data-zc-seal-bar]')) {
      el.append(createCopyrightBarElement(code, Boolean(opts.compact)));
    }
  }

  // Otomatik tarama: Konu anlatımı sayfaları, AI soru kartları, yazılı stüdyosu ve test kartları
  const TARGET_RULES = [
    { selector: '[data-ai-question]', compact: true, withBadge: false, withFooter: true },
    { selector: '.ks-book-spread', compact: false, withBadge: true, withFooter: true },
    { selector: '.ks-station-body', compact: false, withBadge: false, withFooter: true },
    { selector: '#topicModalContent .lesson-page-card, .lesson-spread-card, .maarif-lesson-card', compact: false, withBadge: true, withFooter: true },
    { selector: '.yazili-question-card, .maarif-q-card', compact: true, withBadge: false, withFooter: true }
  ];

  function scanAndStamp(root = document) {
    for (const rule of TARGET_RULES) {
      root.querySelectorAll(rule.selector).forEach((el) => {
        if (el.dataset.zcStamped === '1') return;
        stampElement(el, rule);
      });
    }
  }

  function initObserver() {
    injectStyles();
    scanAndStamp(document);
    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => scanAndStamp(document), 220);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.ZarifBrandSeal = {
    computeContentCode,
    buildWatermarkDataUri,
    createSealBadgeHtml,
    stampElement,
    scanAndStamp
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
})();
