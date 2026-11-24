/**
 * ZarifÇözüm Telif Hakkı ve İçerik Koruma Kalkanı (Copyright & Anti-Scraping Shield)
 * - Çapraz görsel filigran (© ZarifÇözüm, pointer-events: none, opacity: 0.05) + PDF/yazdırma filigranı
 * - Her soru / konu kartında telif mührü + benzersiz soru kodu (ZC-Q-[ID])
 * - Öğrenci ekranlarında metin seçimi (user-select: none), sağ tık ve Ctrl+C / Ctrl+P koruması
 *   (Öğretmenin onaylı PDF yazdırma ekranı hariç)
 */
(function (global) {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function isTeacherPrintExempt() {
    const p = (global.location?.pathname || '').toLowerCase();
    return p.includes('ogretmen-paneli') || p.includes('admin-paneli');
  }

  function injectShieldStyles() {
    if (document.getElementById('zcCopyrightShieldStyles')) return;
    const style = document.createElement('style');
    style.id = 'zcCopyrightShieldStyles';
    style.textContent = `
      .zc-protected-surface {
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
      }
      .zc-protected-surface input,
      .zc-protected-surface textarea,
      .zc-protected-surface select {
        user-select: text;
        -webkit-user-select: text;
      }
      .zc-watermark-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 2;
        opacity: 0.05;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        align-items: center;
        justify-items: center;
        gap: 28px;
        transform: rotate(-24deg) scale(1.25);
        user-select: none;
      }
      .zc-watermark-overlay span {
        font-family: Georgia, serif;
        font-size: 1.05rem;
        font-weight: 800;
        color: #3E2F26;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }
      .zc-copyright-stamp {
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px dashed rgba(62, 47, 38, 0.14);
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 0.69rem;
        color: #8c7b6e;
        letter-spacing: 0.01em;
        user-select: none;
      }
      .zc-copyright-stamp code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.68rem;
        padding: 1px 6px;
        border-radius: 5px;
        background: rgba(62, 47, 38, 0.07);
        color: #3E2F26;
        font-weight: 700;
      }
      @media print {
        body::after {
          content: "© ZarifÇözüm • 5846 Sayılı FSEK Kapsamında Korunmaktadır";
          position: fixed;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-family: Georgia, serif;
          font-size: 2.2rem;
          font-weight: 800;
          color: #3E2F26;
          opacity: 0.07;
          pointer-events: none;
          white-space: nowrap;
          z-index: 999999;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function showShieldNotice(msg) {
    let el = document.getElementById('zcShieldNoticeToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'zcShieldNoticeToast';
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:999999;background:#3E2F26;color:#FAF6F0;border:1px solid #C59B47;padding:10px 18px;border-radius:10px;font-size:0.82rem;font-weight:700;box-shadow:0 10px 28px rgba(0,0,0,0.28);pointer-events:none;transition:opacity .25s ease;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2400);
  }

  function formatQuestionCode(rawId) {
    const clean = String(rawId || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-8)
      .toUpperCase();
    return `ZC-Q-${clean || Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function watermarkHtml() {
    return `<div class="zc-watermark-overlay" aria-hidden="true">${'<span>© ZarifÇözüm</span>'.repeat(9)}</div>`;
  }

  function stampHtml(rawId) {
    const code = formatQuestionCode(rawId);
    return `<div class="zc-copyright-stamp"><span>© 2026 ZarifÇözüm • Özgün İçerik - İzinsiz Çoğaltılamaz</span><code>${esc(code)}</code></div>`;
  }

  function isProtectedArea(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest(
      '.zc-protected-surface, .stm-tf-card, #kcReaderModal, #kcReaderBody, #pratik-kazanim, #quizRunner, #yaziliFeed, .zp-soru-kart'
    ));
  }

  function bindAntiScrapingGuards() {
    if (isTeacherPrintExempt()) return;

    // 1. Sağ tık kısıtlaması (yalnızca korumalı soru/konu alanlarında)
    document.addEventListener('contextmenu', event => {
      const t = event.target && event.target.nodeType === 3 ? event.target.parentElement : event.target;
      if (isProtectedArea(t) && !t.closest('input, textarea')) {
        event.preventDefault();
        showShieldNotice('🔒 © 2026 ZarifÇözüm — İçerikler telif hakkı ile korunmaktadır.');
      }
    });

    // 2. Ctrl+C (kopyalama) ve Ctrl+P (izinsiz yazdırma) kısıtlaması
    document.addEventListener('keydown', event => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = String(event.key || '').toLowerCase();
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditing = activeTag === 'input' || activeTag === 'textarea';

      if (key === 'p') {
        event.preventDefault();
        showShieldNotice('🔒 Öğrenci ekranında izinsiz yazdırma/PDF alma kapalıdır (5846 FSEK).');
        return;
      }

      if (key === 'c' && !isEditing) {
        const target = event.target && event.target.nodeType === 3 ? event.target.parentElement : event.target;
        if (isProtectedArea(target) || document.querySelector('.stm-tf-modal.open, #kcReaderModal[style*="flex"]')) {
          event.preventDefault();
          showShieldNotice('🔒 Soru ve konu metinleri izinsiz kopyalanamaz (© ZarifÇözüm).');
        }
      }
    });
  }

  function init() {
    injectShieldStyles();
    bindAntiScrapingGuards();
  }

  global.ZarifCopyright = {
    VERSION: '1.0.0',
    formatQuestionCode,
    watermarkHtml,
    stampHtml
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
