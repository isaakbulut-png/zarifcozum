/* ==========================================================================
   ZarifÇözüm — Özel Temalı Onay, Giriş ve Bildirim Pencere Sistemi (v1)
   - Tarayıcının standart confirm(), prompt(), alert() pencerelerini ZarifÇözüm'ün
     sıcak, şık ve profesyonel tasarım diliyle değiştirir.
   - Numaralı seçenek içeren prompt() metinlerini otomatik tıklanabilir kartlara çevirir.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__zcDialogsInstalled) return;
  window.__zcDialogsInstalled = true;

  const STYLE_ID = 'zcDialogsStyle';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .zc-dlg-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(27, 16, 10, 0.56);
        backdrop-filter: blur(7px);
        -webkit-backdrop-filter: blur(7px);
        opacity: 0;
        transition: opacity 0.18s ease;
        font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .zc-dlg-overlay.is-open {
        opacity: 1;
      }
      .zc-dlg-card {
        width: 100%;
        max-width: 470px;
        background: #ffffff;
        border: 1px solid #eadfd4;
        border-radius: 20px;
        box-shadow: 0 28px 70px rgba(27, 16, 10, 0.28), 0 4px 16px rgba(27, 16, 10, 0.08);
        overflow: hidden;
        transform: translateY(10px) scale(0.96);
        transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .zc-dlg-overlay.is-open .zc-dlg-card {
        transform: translateY(0) scale(1);
      }
      .zc-dlg-topbar {
        height: 4px;
        background: linear-gradient(90deg, #2b180d 0%, #c2410c 55%, #f59e0b 100%);
      }
      .zc-dlg-topbar.tone-danger {
        background: linear-gradient(90deg, #991b1b 0%, #dc2626 60%, #f87171 100%);
      }
      .zc-dlg-topbar.tone-success {
        background: linear-gradient(90deg, #065f46 0%, #059669 60%, #34d399 100%);
      }
      .zc-dlg-body {
        padding: 24px 26px 20px;
      }
      .zc-dlg-head {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 14px;
      }
      .zc-dlg-icon {
        flex: 0 0 46px;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        background: #fff7ed;
        border: 1px solid #fed7aa;
        color: #c2410c;
      }
      .zc-dlg-icon.tone-danger {
        background: #fef2f2;
        border-color: #fecaca;
        color: #dc2626;
      }
      .zc-dlg-icon.tone-success {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #059669;
      }
      .zc-dlg-brand {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #9a6b4c;
        margin-bottom: 2px;
      }
      .zc-dlg-title {
        margin: 0;
        font-size: 17px;
        font-weight: 800;
        color: #1f140d;
        line-height: 1.3;
      }
      .zc-dlg-message {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: #475569;
        white-space: pre-line;
        word-break: break-word;
      }
      .zc-dlg-choices {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }
      .zc-dlg-choice {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        text-align: left;
        padding: 11px 14px;
        border-radius: 12px;
        border: 1.5px solid #e7ddd3;
        background: #faf6f1;
        color: #1f140d;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.14s ease;
      }
      .zc-dlg-choice:hover {
        border-color: #ea580c;
        background: #fff7ed;
        transform: translateY(-1px);
      }
      .zc-dlg-choice.is-selected {
        border-color: #c2410c;
        background: #fff7ed;
        box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15);
      }
      .zc-dlg-choice-num {
        flex: 0 0 26px;
        height: 26px;
        border-radius: 999px;
        background: #2b180d;
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .zc-dlg-choice.is-selected .zc-dlg-choice-num {
        background: #c2410c;
      }
      .zc-dlg-input-wrap {
        margin-top: 14px;
      }
      .zc-dlg-input {
        width: 100%;
        padding: 11px 14px;
        border-radius: 12px;
        border: 1.5px solid #d6c8bc;
        background: #ffffff;
        color: #0f172a;
        font-size: 14px;
        font-family: inherit;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .zc-dlg-input:focus {
        border-color: #c2410c;
        box-shadow: 0 0 0 3.5px rgba(194, 65, 12, 0.14);
      }
      .zc-dlg-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 14px 26px 20px;
        background: #fcfaf7;
        border-top: 1px solid #f1e8df;
      }
      .zc-dlg-btn {
        padding: 10px 20px;
        border-radius: 11px;
        font-size: 13.5px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        border: 1.5px solid transparent;
        transition: all 0.15s ease;
      }
      .zc-dlg-btn-cancel {
        background: #ffffff;
        border-color: #dfd3c7;
        color: #57463b;
      }
      .zc-dlg-btn-cancel:hover {
        background: #f5efe9;
        color: #1f140d;
      }
      .zc-dlg-btn-ok {
        background: linear-gradient(135deg, #2b180d 0%, #5c321a 100%);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(43, 24, 13, 0.22);
      }
      .zc-dlg-btn-ok:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
      .zc-dlg-btn-ok.tone-danger {
        background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.24);
      }
      .zc-dlg-btn-ok.tone-success {
        background: linear-gradient(135deg, #047857 0%, #059669 100%);
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.24);
      }
    `;
    document.head.appendChild(style);
  }

  function detectMeta(mode, rawMessage, opts = {}) {
    const text = String(rawMessage ?? '').trim();
    const lower = text.toLowerCase();

    let tone = opts.tone || 'brand';
    let icon = opts.icon || '✨';
    let title = opts.title || '';

    const isDanger = /silmek|silinecek|silinsin|kaldır|reddet|temizle|sıfırla|kilitle|kalıcı|iptal|❌|hata:|silinemedi|yüklenemedi|alınamadı|aktarılamadı|üretilemedi/.test(lower);
    const isSuccess = /✅|başarıyla|tebrikler|oluşturuldu|eklendi|onaylandı|hazır/.test(lower);

    if (!opts.tone) {
      if (isDanger) tone = 'danger';
      else if (isSuccess) tone = 'success';
    }

    if (!opts.icon) {
      if (tone === 'danger') icon = mode === 'alert' ? '⚠️' : '🗑️';
      else if (tone === 'success') icon = '✅';
      else if (mode === 'prompt') icon = '✏️';
      else if (mode === 'confirm') icon = '🛡️';
      else icon = '💡';
    }

    if (!title) {
      if (mode === 'confirm') {
        title = tone === 'danger' ? 'İşlem Onayı Gerekli' : 'Onaylıyor musunuz?';
      } else if (mode === 'prompt') {
        const firstLine = text.split(/\r?\n/)[0].replace(/^[^\wĞÜŞİÖÇğüşıöç]+/, '').trim();
        title = firstLine.length > 0 && firstLine.length <= 52 ? firstLine : 'Bilgi Girişi';
      } else {
        title = tone === 'success' ? 'İşlem Tamamlandı' : (tone === 'danger' ? 'Uyarı / Hata' : 'Bilgilendirme');
      }
    }

    return { tone, icon, title, text };
  }

  // Numaralı seçenekleri (1 - ..., 1: ..., 1) ...) tıklanabilir kartlara ayır
  function parsePromptChoices(text) {
    const lines = String(text || '').split(/\r?\n/);
    const choices = [];
    const keptLines = [];
    const choiceRe = /^\s*([1-9])\s*[-:).]\s+(.+)$/;

    for (const line of lines) {
      const m = line.match(choiceRe);
      if (m) {
        choices.push({ value: m[1], label: m[2].trim() });
      } else {
        keptLines.push(line);
      }
    }

    if (choices.length >= 2) {
      return {
        bodyText: keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        choices
      };
    }
    return { bodyText: text, choices: [] };
  }

  // Sıralı kuyruk: aynı anda birden fazla pencere çağrılırsa üst üste binmez
  let queue = Promise.resolve();

  function enqueueDialog(renderFn) {
    const run = queue.then(renderFn, renderFn);
    queue = run.then(() => {}, () => {});
    return run;
  }

  function showDialog(mode, rawMessage, defaultValue = '', opts = {}) {
    return enqueueDialog(() => new Promise((resolve) => {
      injectStyles();
      const { tone, icon, title, text } = detectMeta(mode, rawMessage, opts);

      const overlay = document.createElement('div');
      overlay.className = 'zc-dlg-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const card = document.createElement('div');
      card.className = 'zc-dlg-card';

      const topbar = document.createElement('div');
      topbar.className = `zc-dlg-topbar tone-${tone}`;

      const body = document.createElement('div');
      body.className = 'zc-dlg-body';

      const head = document.createElement('div');
      head.className = 'zc-dlg-head';

      const iconEl = document.createElement('div');
      iconEl.className = `zc-dlg-icon tone-${tone}`;
      iconEl.textContent = icon;

      const titleWrap = document.createElement('div');
      const brand = document.createElement('div');
      brand.className = 'zc-dlg-brand';
      brand.textContent = 'ZarifÇözüm';
      const titleEl = document.createElement('h3');
      titleEl.className = 'zc-dlg-title';
      titleEl.textContent = title;
      titleWrap.append(brand, titleEl);
      head.append(iconEl, titleWrap);
      body.append(head);

      let inputEl = null;
      let displayText = text;
      let choices = [];

      if (mode === 'prompt') {
        const parsed = parsePromptChoices(text);
        displayText = parsed.bodyText;
        choices = parsed.choices;
      }

      if (displayText) {
        const msgEl = document.createElement('p');
        msgEl.className = 'zc-dlg-message';
        msgEl.textContent = displayText;
        body.append(msgEl);
      }

      if (mode === 'prompt' && choices.length > 0) {
        const choicesWrap = document.createElement('div');
        choicesWrap.className = 'zc-dlg-choices';
        choices.forEach((ch) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'zc-dlg-choice';
          if (String(defaultValue) === ch.value) btn.classList.add('is-selected');
          btn.innerHTML = `<span class="zc-dlg-choice-num">${ch.value}</span><span></span>`;
          btn.querySelector('span:last-child').textContent = ch.label;
          btn.addEventListener('click', () => {
            choicesWrap.querySelectorAll('.zc-dlg-choice').forEach(b => b.classList.remove('is-selected'));
            btn.classList.add('is-selected');
            if (inputEl) inputEl.value = ch.value;
          });
          btn.addEventListener('dblclick', () => {
            if (inputEl) inputEl.value = ch.value;
            finish(ch.value);
          });
          choicesWrap.append(btn);
        });
        body.append(choicesWrap);
      }

      if (mode === 'prompt') {
        const wrap = document.createElement('div');
        wrap.className = 'zc-dlg-input-wrap';
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'zc-dlg-input';
        inputEl.value = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '';
        inputEl.placeholder = choices.length ? 'Yukarıdan seçin veya numara yazın...' : 'Değer yazın...';
        wrap.append(inputEl);
        body.append(wrap);
      }

      const footer = document.createElement('div');
      footer.className = 'zc-dlg-footer';

      const closeOverlay = () => {
        overlay.classList.remove('is-open');
        document.removeEventListener('keydown', onKeyDown, true);
        setTimeout(() => overlay.remove(), 170);
      };

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        closeOverlay();
        resolve(val);
      };

      if (mode !== 'alert') {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'zc-dlg-btn zc-dlg-btn-cancel';
        cancelBtn.textContent = opts.cancelText || 'Vazgeç';
        cancelBtn.onclick = () => finish(mode === 'prompt' ? null : false);
        footer.append(cancelBtn);
      }

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = `zc-dlg-btn zc-dlg-btn-ok tone-${tone}`;
      okBtn.textContent = opts.confirmText || (mode === 'confirm' ? (tone === 'danger' ? 'Evet, Onayla' : 'Onayla') : 'Tamam');
      okBtn.onclick = () => {
        if (mode === 'prompt') finish(inputEl ? inputEl.value : '');
        else if (mode === 'confirm') finish(true);
        else finish(undefined);
      };
      footer.append(okBtn);

      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(mode === 'prompt' ? null : (mode === 'confirm' ? false : undefined));
        } else if (e.key === 'Enter' && (!document.activeElement || document.activeElement.tagName !== 'TEXTAREA')) {
          e.preventDefault();
          okBtn.click();
        }
      };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && mode === 'alert') {
          finish(undefined);
        }
      });

      card.append(topbar, body, footer);
      overlay.append(card);
      document.body.append(overlay);
      document.addEventListener('keydown', onKeyDown, true);

      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        } else {
          okBtn.focus();
        }
      });
    }));
  }

  window.zcConfirm = (message, opts) => showDialog('confirm', message, '', opts);
  window.zcPrompt = (message, defaultValue = '', opts) => showDialog('prompt', message, defaultValue, opts);
  window.zcAlert = (message, opts) => showDialog('alert', message, '', opts);

  // Mevcut tüm alert() çağrılarını otomatik olarak ZarifÇözüm temalı pencereye yükselt
  window.__nativeAlert = window.alert;
  window.alert = (message) => {
    window.zcAlert(message);
  };
})();
