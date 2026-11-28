/* ==========================================================================
   ZarifÇözüm — Admin Sayfa İçi Medya & Lottie Animasyon Tasarımcısı (v2)
   - Ana Sayfa Medya Yöneticisi (Lottie + Hero/Özellikler görseli)
   - Sayfa İçi Görsel Hedef Seçici (Tıkla & Seç canlı iframe + Konum/Boyut/Hizalama)
   - Canlı Lottie/Görsel dosya önizleme + Mevcut yerleşimleri tek tıkla kaldırma
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const POS_LABELS = {
    prepend: 'Kartın / Alanın İçine (Üste)',
    append: 'Kartın / Alanın İçine (Alta)',
    overlay: 'Kartın Üzerine (Köşe / Kaplama)',
    before: 'Öğenin Dışına (Üstüne)',
    after: 'Öğenin Dışına (Altına)',
    replace: 'Mevcut Öğenin Yerine'
  };

  const ALIGN_LABELS = {
    left: 'Sol',
    center: 'Orta',
    right: 'Sağ'
  };

  let localLottieInstance = null;
  let currentTargets = [];

  async function loadLottieLib() {
    if (window.lottie) return window.lottie;
    if (!window._zcAdminLottiePromise) {
      window._zcAdminLottiePromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
        s.onload = () => (window.lottie ? resolve(window.lottie) : reject(new Error('Lottie yüklenemedi.')));
        s.onerror = () => reject(new Error('Lottie CDN erişim hatası.'));
        document.head.appendChild(s);
      });
    }
    return window._zcAdminLottiePromise;
  }

  function formatTargetOption(t) {
    const kind = t.kind || t.tag || 'Alan';
    const ctx = t.context && t.context !== t.label ? ` · ${t.context.slice(0, 36)}` : '';
    const occ = t.occurrence > 0 ? ` (#${t.occurrence + 1})` : '';
    return `[${kind}] ${t.label.slice(0, 56)}${ctx}${occ}`;
  }

  function parseTargetKeyLabel(key) {
    try {
      const parts = JSON.parse(key);
      if (Array.isArray(parts) && parts.length === 5) {
        const kind = (window.SiteMediaTargets?.KIND_LABELS?.[parts[0]]) || parts[0];
        return `[${kind}] ${parts[2]}`;
      }
    } catch (_) {}
    return key;
  }

  function setMsg(el, text, isOk) {
    if (!el) return;
    el.className = isOk ? 'msg ok' : 'msg';
    el.textContent = text || '';
  }

  // 1. Ana Sayfa Medya & Animasyon Yöneticisi (Üst Bölüm)
  function wireHomepageAssetForms() {
    const animForm = $('homepageAnimationForm');
    if (animForm && !animForm.dataset.wired) {
      animForm.dataset.wired = '1';
      animForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = animForm.querySelector('input[type="file"]');
        const file = fileInput?.files?.[0];
        const msg = $('homepageAnimationMsg');
        const btn = $('uploadHomepageAnimation');
        if (!file) return setMsg(msg, 'Lütfen bir .json Lottie dosyası seçin.', false);

        const fd = new FormData();
        fd.append('file', file);
        fd.append('assetType', 'animation');
        fd.append('slot', 'animation');

        if (btn) btn.disabled = true;
        setMsg(msg, 'Animasyon yükleniyor...', true);
        try {
          const res = await fetch('/api/admin/homepage-assets/upload', {
            method: 'POST', credentials: 'same-origin', body: fd
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.mesaj || 'Animasyon yüklenemedi.');
          setMsg(msg, data.mesaj || 'Ana sayfa Lottie animasyonu güncellendi.', true);
          if ($('homepageAnimationPath') && data.homepageAssets?.animation) {
            $('homepageAnimationPath').textContent = `Mevcut animasyon: ${data.homepageAssets.animation}`;
          }
          fileInput.value = '';
        } catch (err) {
          setMsg(msg, err.message, false);
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }

    const removeAnimBtn = $('removeHomepageAnimation');
    if (removeAnimBtn && !removeAnimBtn.dataset.wired) {
      removeAnimBtn.dataset.wired = '1';
      removeAnimBtn.addEventListener('click', async () => {
        const msg = $('homepageAnimationMsg');
        const ok = window.zcConfirm
          ? await window.zcConfirm('Ana sayfadaki mevcut Lottie (.json) animasyonunu kaldırmak istediğinize emin misiniz?')
          : true;
        if (!ok) return;
        removeAnimBtn.disabled = true;
        setMsg(msg, 'Animasyon kaldırılıyor...', true);
        try {
          const res = await fetch('/api/admin/homepage-assets/animation', {
            method: 'DELETE', credentials: 'same-origin'
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.mesaj || 'Animasyon kaldırılamadı.');
          setMsg(msg, '✅ ' + (data.mesaj || 'Ana sayfa Lottie animasyonu kaldırıldı.'), true);
          if ($('homepageAnimationPath')) {
            $('homepageAnimationPath').textContent = 'Henüz animasyon yüklenmedi.';
          }
        } catch (err) {
          setMsg(msg, err.message, false);
        } finally {
          removeAnimBtn.disabled = false;
        }
      });
    }

    const imgForm = $('homepageImageForm');
    if (imgForm && !imgForm.dataset.wired) {
      imgForm.dataset.wired = '1';
      imgForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = imgForm.querySelector('input[type="file"]');
        const slot = $('homepageImageSlot')?.value || 'heroImage';
        const file = fileInput?.files?.[0];
        const msg = $('homepageImageMsg');
        const btn = $('uploadHomepageImage');
        if (!file) return setMsg(msg, 'Lütfen bir görsel dosyası seçin.', false);

        const fd = new FormData();
        fd.append('file', file);
        fd.append('assetType', 'image');
        fd.append('slot', slot);

        if (btn) btn.disabled = true;
        setMsg(msg, 'Görsel yükleniyor...', true);
        try {
          const res = await fetch('/api/admin/homepage-assets/upload', {
            method: 'POST', credentials: 'same-origin', body: fd
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.mesaj || 'Görsel yüklenemedi.');
          setMsg(msg, data.mesaj || 'Ana sayfa görseli güncellendi.', true);
          const previewId = slot === 'featureImage' ? 'homepageFeaturePreview' : 'homepageHeroPreview';
          const preview = $(previewId);
          if (preview && data.homepageAssets?.[slot]) {
            preview.hidden = false;
            preview.src = data.homepageAssets[slot];
          }
          fileInput.value = '';
        } catch (err) {
          setMsg(msg, err.message, false);
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
  }

  // 2. Yerel Dosya Canlı Önizleme (Lottie JSON veya Görsel)
  async function previewSelectedLocalFile(file, assetType) {
    const box = $('siteMediaLocalPreview');
    if (!box) return;
    if (localLottieInstance) {
      try { localLottieInstance.destroy(); } catch (_) {}
      localLottieInstance = null;
    }
    box.replaceChildren();
    if (!file) {
      box.hidden = true;
      return;
    }
    box.hidden = false;

    if (assetType === 'animation' || file.name.toLowerCase().endsWith('.json')) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const stage = document.createElement('div');
        stage.style.cssText = 'width:180px;height:140px;margin:0 auto;';
        box.append(stage);
        const lottie = await loadLottieLib();
        localLottieInstance = lottie.loadAnimation({
          container: stage,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: json
        });
      } catch (err) {
        box.innerHTML = `<span style="color:#b91c1c;font-size:12px;">Önizleme oluşturulamadı: ${err.message}</span>`;
      }
    } else {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Seçilen görsel önizleme';
      img.style.cssText = 'max-width:220px;max-height:140px;object-fit:contain;border-radius:8px;display:block;margin:0 auto;';
      img.onload = () => URL.revokeObjectURL(url);
      box.append(img);
    }
  }

  // 3. Mevcut Yerleşimleri Listele ve Tek Tıkla Kaldır
  async function loadCurrentPlacements() {
    const container = $('siteMediaCurrent');
    if (!container) return;
    try {
      const res = await fetch('/api/admin/site-media', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mesaj || 'Yerleşimler alınamadı.');
      const list = data.placements || [];
      container.replaceChildren();

      const heading = document.createElement('h4');
      heading.style.cssText = 'margin:20px 0 10px;font-size:0.95rem;color:#3a2618;';
      heading.textContent = `📌 Aktif Sayfa Yerleşimleri (${list.length})`;
      container.append(heading);

      if (!list.length) {
        const empty = document.createElement('p');
        empty.style.cssText = 'font-size:0.85rem;color:#6a5242;margin:0;';
        empty.textContent = 'Henüz hiçbir sayfaya özel görsel veya Lottie animasyonu yerleştirilmedi.';
        container.append(empty);
        return;
      }

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px;';

      list.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'site-media-current';
        card.style.cssText = 'background:#fff;border:1px solid #e7d9cc;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;';

        const pageObj = window.SiteMediaTargets?.PAGES?.find(pg => pg.path === p.pagePath);
        const pageLabel = pageObj ? `${pageObj.label} (${p.pagePath})` : p.pagePath;
        const posLabel = POS_LABELS[p.position || 'after'] || 'Altına Ekle';
        const alignLabel = ALIGN_LABELS[p.align || 'center'] || 'Orta';
        const widthVal = p.widthPx || 320;
        const badgeText = p.assetType === 'animation' ? '✨ Lottie (.json)' : '🖼️ Görsel';

        const meta = document.createElement('div');
        meta.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
            <strong style="font-size:0.85rem;color:#0f172a;">${pageLabel}</strong>
            <span style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;">${badgeText}</span>
          </div>
          <div style="font-size:0.8rem;color:#334155;margin-bottom:4px;"><strong>Hedef:</strong> ${parseTargetKeyLabel(p.targetKey)}</div>
          <div style="font-size:0.75rem;color:#64748b;">Konum: <strong>${posLabel}</strong> · Genişlik: <strong>${widthVal}px</strong> · Hizalama: <strong>${alignLabel}</strong></div>
        `;
        card.append(meta);

        if (p.assetType === 'image' && p.url) {
          const thumb = document.createElement('img');
          thumb.src = p.url;
          thumb.alt = 'Yerleştirilmiş görsel';
          thumb.style.cssText = 'max-width:100%;max-height:110px;object-fit:contain;border-radius:8px;background:#f8fafc;padding:4px;';
          card.append(thumb);
        }

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;margin-top:auto;padding-top:6px;border-top:1px solid #f1f5f9;';

        const viewLink = document.createElement('a');
        viewLink.href = p.pagePath;
        viewLink.target = '_blank';
        viewLink.className = 'btn light';
        viewLink.style.cssText = 'font-size:0.75rem;padding:5px 10px;text-decoration:none;';
        viewLink.textContent = '👁️ Sayfada Gör';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn light';
        delBtn.style.cssText = 'font-size:0.75rem;padding:5px 10px;color:#b91c1c;margin-left:auto;';
        delBtn.textContent = p.assetType === 'animation' ? '🗑️ Animasyonu Kaldır' : '🗑️ Görseli Kaldır';
        delBtn.onclick = async () => {
          if (!await window.zcConfirm('Bu medya yerleşimini sayfadan kaldırmak istediğinize emin misiniz?')) return;
          delBtn.disabled = true;
          try {
            const delRes = await fetch(`/api/admin/site-media/${encodeURIComponent(p._id)}`, {
              method: 'DELETE', credentials: 'same-origin'
            });
            const delData = await delRes.json().catch(() => ({}));
            if (!delRes.ok) throw new Error(delData.mesaj || 'Silinemedi.');
            loadCurrentPlacements();
          } catch (err) {
            alert('Hata: ' + err.message);
            delBtn.disabled = false;
          }
        };

        actions.append(viewLink, delBtn);
        card.append(actions);
        grid.append(card);
      });

      container.append(grid);
    } catch (err) {
      container.innerHTML = `<p class="msg">${err.message}</p>`;
    }
  }

  // 4. Sayfa İçi Buton & Medya Tasarımcısı (Alt Bölüm)
  function initSiteMediaDesigner() {
    const form = $('siteMediaForm');
    const pageSelect = $('siteMediaPage');
    const targetSelect = $('siteMediaTarget');
    const typeSelect = $('siteMediaType');
    const fileInput = $('siteMediaFile');
    const posSelect = $('siteMediaPosition');
    const widthInput = $('siteMediaWidth');
    const widthValLabel = $('siteMediaWidthVal');
    const alignSelect = $('siteMediaAlign');
    const submitBtn = $('uploadSiteMedia');
    const descEl = $('siteMediaTargetDescription');
    const msgEl = $('siteMediaMsg');
    const iframe = $('siteMediaTargetPreview');
    const previewHint = $('siteMediaPreviewHint');
    const textEditorBox = $('siteTextEditorBox');
    const textInput = $('siteTextEditorInput');
    const textColorInput = $('siteTextColor');
    const textColorResetBtn = $('siteTextColorReset');
    const textFontSelect = $('siteTextFontFamily');
    const textSizeInput = $('siteTextFontSize');
    const textSizeVal = $('siteTextFontSizeVal');
    const textWeightSelect = $('siteTextFontWeight');
    const saveTextBtn = $('saveSiteTextBtn');
    const textMsgEl = $('siteTextMsg');
    const textCurrentEl = $('siteTextCurrent');
    const paintSelectionBtn = $('paintSelectedTextBtn');
    const stripColorsBtn = $('stripTextColorsBtn');
    const resetTextPosBtn = $('resetTextPosBtn');
    const undoTextBtn = $('undoSiteTextBtn');
    let selectedTextColor = '';
    let textOffsetX = 0;
    let textOffsetY = 0;

    // Ctrl+Z / Ctrl+Y Geri Al & İleri Al Geçmiş Yığını
    let textHistory = [];
    let textHistoryIdx = -1;
    let textInputDebounce = null;

    const captureTextSnapshot = () => ({
      customText: textInput?.value || '',
      textColor: selectedTextColor || '',
      fontFamily: textFontSelect?.value || '',
      fontSize: textSizeInput?.value || '9',
      fontWeight: textWeightSelect?.value || '',
      offsetX: textOffsetX,
      offsetY: textOffsetY
    });

    const snapshotsEqual = (a, b) => a && b &&
      a.customText === b.customText &&
      a.textColor === b.textColor &&
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.offsetX === b.offsetX &&
      a.offsetY === b.offsetY;

    const updateUndoBtnState = () => {
      if (undoTextBtn) undoTextBtn.disabled = textHistoryIdx <= 0;
    };

    const pushTextHistory = () => {
      const snap = captureTextSnapshot();
      if (textHistoryIdx >= 0 && snapshotsEqual(textHistory[textHistoryIdx], snap)) return;
      textHistory = textHistory.slice(0, textHistoryIdx + 1);
      textHistory.push(snap);
      if (textHistory.length > 40) textHistory.shift();
      textHistoryIdx = textHistory.length - 1;
      updateUndoBtnState();
    };

    const resetTextHistory = () => {
      textHistory = [captureTextSnapshot()];
      textHistoryIdx = 0;
      updateUndoBtnState();
    };

    const applyTextSnapshot = (snap) => {
      if (!snap) return;
      if (textInput) textInput.value = snap.customText;
      selectedTextColor = snap.textColor || '';
      if (textColorInput && selectedTextColor) textColorInput.value = selectedTextColor;
      if (textFontSelect) textFontSelect.value = snap.fontFamily || '';
      if (textSizeInput) {
        textSizeInput.value = snap.fontSize || '9';
        const v = Number(textSizeInput.value || 0);
        if (textSizeVal) textSizeVal.textContent = v >= 10 ? `${v}px` : 'Varsayılan';
      }
      if (textWeightSelect) textWeightSelect.value = snap.fontWeight || '';
      textOffsetX = Number(snap.offsetX) || 0;
      textOffsetY = Number(snap.offsetY) || 0;
      document.querySelectorAll('[data-zc-color-swatch]').forEach(b => {
        b.style.outline = (selectedTextColor && b.dataset.zcColorSwatch === selectedTextColor) ? '2.5px solid #0f172a' : 'none';
        b.style.outlineOffset = '2px';
      });
      pushLiveTextPreview();
      updateUndoBtnState();
    };

    const undoTextChange = () => {
      if (textHistoryIdx <= 0) return false;
      textHistoryIdx -= 1;
      applyTextSnapshot(textHistory[textHistoryIdx]);
      setMsg(textMsgEl, `↶ Geri alındı (${textHistoryIdx + 1}/${textHistory.length}). Kalıcı olması için "💾 Yazıyı & Stili Kaydet"e tıklayın.`, true);
      return true;
    };

    const redoTextChange = () => {
      if (textHistoryIdx >= textHistory.length - 1) return false;
      textHistoryIdx += 1;
      applyTextSnapshot(textHistory[textHistoryIdx]);
      setMsg(textMsgEl, `↷ İleri alındı (${textHistoryIdx + 1}/${textHistory.length}).`, true);
      return true;
    };

    undoTextBtn?.addEventListener('click', undoTextChange);

    document.addEventListener('keydown', (e) => {
      if (!textEditorBox || textEditorBox.hidden) return;
      const key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 'z' && !e.shiftKey) {
        if (textHistoryIdx > 0) {
          e.preventDefault();
          undoTextChange();
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === 'y' || (key === 'z' && e.shiftKey))) {
        if (textHistoryIdx < textHistory.length - 1) {
          e.preventDefault();
          redoTextChange();
        }
      }
    });

    const pushLiveTextPreview = () => {
      if (!iframe?.contentWindow || !targetSelect.value) return;
      const sz = Number(textSizeInput?.value || 0);
      iframe.contentWindow.postMessage({
        type: 'site-media-preview-text',
        targetKey: targetSelect.value,
        customText: textInput?.value || '',
        textColor: selectedTextColor || null,
        resetColor: !selectedTextColor,
        fontFamily: textFontSelect?.value || null,
        resetFont: !textFontSelect?.value,
        fontSizePx: sz >= 10 ? sz : null,
        resetSize: sz < 10,
        fontWeight: textWeightSelect?.value || null,
        resetWeight: !textWeightSelect?.value,
        offsetX: textOffsetX,
        offsetY: textOffsetY
      }, window.location.origin);
    };

    const paintSelectedRange = (hexColor) => {
      if (!textInput || !hexColor) return false;
      const start = textInput.selectionStart;
      const end = textInput.selectionEnd;
      if (typeof start !== 'number' || typeof end !== 'number' || end <= start) return false;
      const val = textInput.value;
      const chosen = val.slice(start, end).replace(/\[\[#[0-9a-f]{3,8}\|([^\]]+)\]\]/gi, '$1');
      if (!chosen) return false;
      const wrapped = `[[${hexColor}|${chosen}]]`;
      textInput.value = val.slice(0, start) + wrapped + val.slice(end);
      textInput.focus();
      textInput.setSelectionRange(start, start + wrapped.length);
      pushTextHistory();
      pushLiveTextPreview();
      return true;
    };

    document.querySelectorAll('[data-zc-color-swatch]').forEach((sw) => {
      sw.addEventListener('mousedown', (e) => e.preventDefault()); // textarea seçimini koru
      sw.addEventListener('click', () => {
        const hex = sw.dataset.zcColorSwatch || '';
        if (textColorInput && hex) textColorInput.value = hex;
        // Metnin bir kısmı seçiliyse yalnızca seçili kısmı boya (çift renk!)
        if (hex && paintSelectedRange(hex)) {
          setMsg(textMsgEl, `🖍️ Seçili metin ${hex} ile boyandı. Kaydetmek için "💾 Yazıyı & Stili Kaydet"e tıklayın.`, true);
          return;
        }
        selectedTextColor = hex;
        document.querySelectorAll('[data-zc-color-swatch]').forEach(b => {
          b.style.outline = b === sw ? '2.5px solid #0f172a' : 'none';
          b.style.outlineOffset = '2px';
        });
        pushTextHistory();
        pushLiveTextPreview();
      });
    });

    paintSelectionBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    paintSelectionBtn?.addEventListener('click', () => {
      const hex = textColorInput?.value || selectedTextColor || '#f59e0b';
      if (!paintSelectedRange(hex)) {
        setMsg(textMsgEl, 'Önce yukarıdaki yazı kutusunda boyamak istediğiniz kelimeleri fareyle seçin.', false);
      } else {
        setMsg(textMsgEl, `🖍️ Seçili kısım ${hex} rengiyle boyandı!`, true);
      }
    });

    stripColorsBtn?.addEventListener('click', () => {
      if (!textInput) return;
      textInput.value = textInput.value.replace(/\[\[#[0-9a-f]{3,8}\|([^\]]+)\]\]/gi, '$1');
      pushTextHistory();
      pushLiveTextPreview();
      setMsg(textMsgEl, '🧹 Parçalı renk işaretleri temizlendi.', true);
    });

    resetTextPosBtn?.addEventListener('click', () => {
      textOffsetX = 0;
      textOffsetY = 0;
      pushTextHistory();
      pushLiveTextPreview();
      setMsg(textMsgEl, '↺ Yazı konumu sıfırlandı (0px, 0px). Kaydetmek için "💾 Yazıyı & Stili Kaydet"e tıklayın.', true);
    });

    const onColorPick = () => {
      selectedTextColor = textColorInput.value;
      document.querySelectorAll('[data-zc-color-swatch]').forEach(b => { b.style.outline = 'none'; });
      pushTextHistory();
      pushLiveTextPreview();
    };
    textColorInput?.addEventListener('input', onColorPick);
    textColorInput?.addEventListener('change', onColorPick);

    textColorResetBtn?.addEventListener('click', () => {
      selectedTextColor = '';
      document.querySelectorAll('[data-zc-color-swatch]').forEach(b => { b.style.outline = 'none'; });
      pushTextHistory();
      pushLiveTextPreview();
    });

    textFontSelect?.addEventListener('change', () => { pushTextHistory(); pushLiveTextPreview(); });
    textWeightSelect?.addEventListener('change', () => { pushTextHistory(); pushLiveTextPreview(); });
    textInput?.addEventListener('input', () => {
      pushLiveTextPreview();
      clearTimeout(textInputDebounce);
      textInputDebounce = setTimeout(pushTextHistory, 350);
    });
    textSizeInput?.addEventListener('input', () => {
      const v = Number(textSizeInput.value || 0);
      if (textSizeVal) textSizeVal.textContent = v >= 10 ? `${v}px` : 'Varsayılan';
      pushLiveTextPreview();
    });
    textSizeInput?.addEventListener('change', pushTextHistory);

    if (!form || !pageSelect || !window.SiteMediaTargets) return;

    const loadTextOverrides = async () => {
      if (!textCurrentEl) return;
      try {
        const res = await fetch('/api/admin/site-text', { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const list = data.overrides || [];
        textCurrentEl.replaceChildren();
        if (!list.length) return;

        const hdr = document.createElement('h4');
        hdr.style.cssText = 'margin:20px 0 10px;font-size:0.95rem;color:#3a2618;';
        hdr.textContent = `✏️ Aktif Metin Düzenlemeleri (${list.length})`;
        textCurrentEl.append(hdr);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px;';

        list.forEach((ov) => {
          const card = document.createElement('div');
          card.style.cssText = 'background:#fff;border:1px solid #e7d9cc;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;';
          const pageObj = window.SiteMediaTargets?.PAGES?.find(pg => pg.path === ov.pagePath);
          const pageLabel = pageObj ? `${pageObj.label} (${ov.pagePath})` : ov.pagePath;

          const meta = document.createElement('div');
          meta.innerHTML = `
            <div style="font-size:0.84rem;font-weight:700;color:#0f172a;margin-bottom:4px;">${pageLabel}</div>
            <div style="font-size:0.76rem;color:#64748b;margin-bottom:6px;"><strong>Orijinal Hedef:</strong> ${parseTargetKeyLabel(ov.targetKey)}</div>
            <div style="font-size:0.82rem;color:#1e293b;background:#faf6f1;padding:8px 10px;border-radius:8px;border:1px solid #eadfd4;"></div>
          `;
          meta.querySelector('div:last-child').textContent = ov.customText;
          card.append(meta);

          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:8px;margin-top:auto;padding-top:6px;border-top:1px solid #f1f5f9;';

          const viewLink = document.createElement('a');
          viewLink.href = ov.pagePath;
          viewLink.target = '_blank';
          viewLink.className = 'btn light';
          viewLink.style.cssText = 'font-size:0.75rem;padding:5px 10px;text-decoration:none;';
          viewLink.textContent = '👁️ Sayfada Gör';

          const revertBtn = document.createElement('button');
          revertBtn.type = 'button';
          revertBtn.className = 'btn light';
          revertBtn.style.cssText = 'font-size:0.75rem;padding:5px 10px;color:#b91c1c;margin-left:auto;';
          revertBtn.textContent = '↩️ Orijinale Dön';
          revertBtn.onclick = async () => {
            const ok = window.zcConfirm
              ? await window.zcConfirm('Bu metin düzenlemesini kaldırıp sayfanın orijinal yazısına dönmek istiyor musunuz?')
              : true;
            if (!ok) return;
            revertBtn.disabled = true;
            try {
              const r = await fetch(`/api/admin/site-text/${encodeURIComponent(ov._id)}`, {
                method: 'DELETE', credentials: 'same-origin'
              });
              const d = await r.json().catch(() => ({}));
              if (!r.ok) throw new Error(d.mesaj || 'Geri alınamadı.');
              loadTextOverrides();
            } catch (err) {
              alert('Hata: ' + err.message);
              revertBtn.disabled = false;
            }
          };
          actions.append(viewLink, revertBtn);
          card.append(actions);
          grid.append(card);
        });
        textCurrentEl.append(grid);
      } catch (_) {}
    };

    const syncTextEditor = (selected) => {
      if (!textEditorBox || !textInput || !saveTextBtn) return;
      const editableTags = ['h1', 'h2', 'h3', 'p', 'a', 'button'];
      if (selected && editableTags.includes(selected.tag)) {
        textEditorBox.hidden = false;
        textInput.value = selected.currentText || selected.label || '';
        textOffsetX = Number(selected.offsetX) || 0;
        textOffsetY = Number(selected.offsetY) || 0;
        saveTextBtn.disabled = false;
        resetTextHistory();
        setMsg(textMsgEl, '', true);
      } else {
        textEditorBox.hidden = true;
        saveTextBtn.disabled = true;
      }
    };

    const applySmartPosition = (selected) => {
      if (!posSelect || !selected) return;
      if (['article', 'section', 'div'].includes(selected.tag)) {
        if (posSelect.value === 'after' || posSelect.value === 'before') {
          posSelect.value = 'prepend';
        }
      }
    };

    saveTextBtn?.addEventListener('click', async () => {
      const customText = (textInput?.value || '').trim();
      if (!pageSelect.value || !targetSelect.value) {
        return setMsg(textMsgEl, 'Önce sayfa ve bir yazı/başlık hedefi seçin.', false);
      }
      if (!customText) {
        return setMsg(textMsgEl, 'Yazı boş bırakılamaz.', false);
      }
      saveTextBtn.disabled = true;
      setMsg(textMsgEl, 'Yazı kaydediliyor...', true);
      try {
        const sz = Number(textSizeInput?.value || 0);
        const res = await fetch('/api/admin/site-text', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pagePath: pageSelect.value,
            targetKey: targetSelect.value,
            customText,
            textColor: selectedTextColor || null,
            fontFamily: textFontSelect?.value || null,
            fontSizePx: sz >= 10 ? sz : null,
            fontWeight: textWeightSelect?.value || null,
            offsetX: textOffsetX,
            offsetY: textOffsetY
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.mesaj || 'Yazı kaydedilemedi.');
        setMsg(textMsgEl, '✅ Sayfa yazısı ve stili canlı olarak kaydedildi.', true);
        pushLiveTextPreview();
        loadTextOverrides();
      } catch (err) {
        setMsg(textMsgEl, err.message, false);
      } finally {
        saveTextBtn.disabled = false;
      }
    });

    // Sayfaları doldur
    if (pageSelect.options.length <= 1) {
      window.SiteMediaTargets.PAGES.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.path;
        opt.textContent = `${p.label} (${p.path})`;
        pageSelect.append(opt);
      });
    }

    const updateFileAccept = () => {
      if (!fileInput || !typeSelect) return;
      fileInput.accept = typeSelect.value === 'animation'
        ? '.json,application/json'
        : '.png,.jpg,.jpeg,.webp';
    };
    updateFileAccept();

    const updateSubmitState = () => {
      if (!submitBtn) return;
      submitBtn.disabled = !(pageSelect.value && targetSelect.value);
    };

    const updateDescription = () => {
      if (!descEl) return;
      const selected = currentTargets.find(t => t.key === targetSelect.value);
      if (!selected) {
        descEl.textContent = pageSelect.value
          ? 'Aşağıdaki canlı sayfa üzerinde fareyle gezerek istediğiniz butona, başlığa, karta veya bölüme tıklayın.'
          : '';
        return;
      }
      const posText = POS_LABELS[posSelect?.value || 'after'] || 'Altına Ekle';
      const wText = widthInput?.value || '320';
      const alText = ALIGN_LABELS[alignSelect?.value || 'center'] || 'Orta';
      descEl.innerHTML = `✅ Seçili Hedef: <strong>${formatTargetOption(selected)}</strong> → <em>${posText}</em> (${wText}px, ${alText} hizalı)`;
    };

    typeSelect?.addEventListener('change', () => {
      updateFileAccept();
      if (fileInput?.files?.[0]) previewSelectedLocalFile(fileInput.files[0], typeSelect.value);
    });

    fileInput?.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (f && f.name.toLowerCase().endsWith('.json') && typeSelect) {
        typeSelect.value = 'animation';
        updateFileAccept();
      } else if (f && /\.(png|jpe?g|webp)$/i.test(f.name) && typeSelect) {
        typeSelect.value = 'image';
        updateFileAccept();
      }
      previewSelectedLocalFile(f, typeSelect?.value || 'image');
    });

    widthInput?.addEventListener('input', () => {
      if (widthValLabel) widthValLabel.textContent = `${widthInput.value}px`;
      updateDescription();
    });
    posSelect?.addEventListener('change', updateDescription);
    alignSelect?.addEventListener('change', updateDescription);

    pageSelect.addEventListener('change', () => {
      const pagePath = pageSelect.value;
      currentTargets = [];
      targetSelect.innerHTML = '<option value="">Hedefler taranıyor...</option>';
      targetSelect.disabled = true;
      updateSubmitState();
      setMsg(msgEl, '', true);

      if (!pagePath) {
        targetSelect.innerHTML = '<option value="">Önce sayfa seçin</option>';
        if (iframe) { iframe.hidden = true; iframe.removeAttribute('src'); }
        if (previewHint) previewHint.hidden = true;
        updateDescription();
        return;
      }

      if (previewHint) previewHint.hidden = false;
      if (iframe) {
        iframe.hidden = false;
        iframe.style.width = '100%';
        iframe.style.height = '560px';
        iframe.style.border = '2px solid #e7d9cc';
        iframe.style.borderRadius = '12px';
        iframe.style.marginTop = '10px';
        iframe.style.background = '#fff';
        iframe.src = `${pagePath}?siteMediaDesigner=1`;
      }
      updateDescription();
    });

    targetSelect.addEventListener('change', () => {
      const selected = currentTargets.find(t => t.key === targetSelect.value);
      applySmartPosition(selected);
      syncTextEditor(selected);
      updateSubmitState();
      updateDescription();
      if (iframe?.contentWindow && targetSelect.value) {
        iframe.contentWindow.postMessage({
          type: 'site-media-highlight',
          targetKey: targetSelect.value
        }, window.location.origin);
      }
    });

    // Canlı iframe'den gelen hedef listesi ve tıklama seçimlerini dinle
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.pagePath !== pageSelect.value) return;

      if (data.type === 'site-media-targets' && Array.isArray(data.targets)) {
        const prevKey = targetSelect.value;
        currentTargets = data.targets;
        targetSelect.replaceChildren();
        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = `Bir hedef seçin (${currentTargets.length} alan bulundu)...`;
        targetSelect.append(defOpt);

        currentTargets.forEach((t) => {
          const opt = document.createElement('option');
          opt.value = t.key;
          opt.textContent = formatTargetOption(t);
          targetSelect.append(opt);
        });
        targetSelect.disabled = false;
        if (prevKey && currentTargets.some(t => t.key === prevKey)) {
          targetSelect.value = prevKey;
        }
        updateSubmitState();
        updateDescription();
      }

      if (data.type === 'site-media-target-selected' && data.target?.key) {
        const existingIdx = currentTargets.findIndex(t => t.key === data.target.key);
        if (existingIdx >= 0) {
          currentTargets[existingIdx] = { ...currentTargets[existingIdx], ...data.target };
        } else {
          currentTargets.push(data.target);
          const opt = document.createElement('option');
          opt.value = data.target.key;
          opt.textContent = formatTargetOption(data.target);
          targetSelect.append(opt);
        }
        targetSelect.disabled = false;
        targetSelect.value = data.target.key;
        applySmartPosition(data.target);
        syncTextEditor(data.target);
        updateSubmitState();
        updateDescription();
        const hintSuffix = ['article', 'section', 'div'].includes(data.target.tag)
          ? ' Konum otomatik olarak "Kartın / Alanın İçine (Üste)" ayarlandı.'
          : (['h1', 'h2', 'h3', 'p', 'a', 'button'].includes(data.target.tag)
            ? ' İsterseniz aşağıdan bu öğenin yazısını da doğrudan düzenleyebilirsiniz.'
            : '');
        setMsg(msgEl, 'Hedef canlı önizlemeden seçildi.' + hintSuffix, true);
      }

      if (data.type === 'site-text-moved' && data.targetKey) {
        textOffsetX = Number(data.offsetX) || 0;
        textOffsetY = Number(data.offsetY) || 0;
        pushTextHistory();
        const customText = (textInput?.value || '').trim();
        const sz = Number(textSizeInput?.value || 0);
        if (customText && pageSelect.value) {
          fetch('/api/admin/site-text', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pagePath: pageSelect.value,
              targetKey: data.targetKey,
              customText,
              textColor: selectedTextColor || null,
              fontFamily: textFontSelect?.value || null,
              fontSizePx: sz >= 10 ? sz : null,
              fontWeight: textWeightSelect?.value || null,
              offsetX: textOffsetX,
              offsetY: textOffsetY
            })
          })
            .then(() => {
              setMsg(textMsgEl, `✅ Yazı konumu kaydedildi (X: ${textOffsetX}px, Y: ${textOffsetY}px)`, true);
              loadTextOverrides();
            })
            .catch(err => setMsg(textMsgEl, 'Yazı konumu kaydedilemedi: ' + err.message, false));
        }
      }

      if (data.type === 'site-media-transform' && data.id) {
        fetch(`/api/admin/site-media/${encodeURIComponent(data.id)}/position`, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offsetX: data.offsetX,
            offsetY: data.offsetY,
            widthPx: data.widthPx
          })
        })
          .then(r => r.json().catch(() => ({})))
          .then(() => {
            setMsg(msgEl, `✅ Yeni konum kaydedildi (X: ${data.offsetX}px, Y: ${data.offsetY}px · Genişlik: ${data.widthPx}px)`, true);
            loadCurrentPlacements();
          })
          .catch(err => setMsg(msgEl, 'Konum kaydedilemedi: ' + err.message, false));
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = fileInput?.files?.[0];
      if (!pageSelect.value || !targetSelect.value) {
        return setMsg(msgEl, 'Lütfen önce sayfa ve hedef alan seçin.', false);
      }
      if (!file) {
        return setMsg(msgEl, 'Lütfen yüklenecek dosyayı seçin.', false);
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('pagePath', pageSelect.value);
      fd.append('targetKey', targetSelect.value);
      fd.append('assetType', typeSelect?.value || 'image');
      fd.append('position', posSelect?.value || 'after');
      fd.append('widthPx', widthInput?.value || '320');
      fd.append('align', alignSelect?.value || 'center');

      submitBtn.disabled = true;
      setMsg(msgEl, 'Medya yerleştiriliyor...', true);
      try {
        const res = await fetch('/api/admin/site-media/upload', {
          method: 'POST', credentials: 'same-origin', body: fd
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.mesaj || 'Medya yerleştirilemedi.');
        setMsg(msgEl, '✅ ' + (data.mesaj || 'Medya yerleştirildi.') + ' Aşağıdaki önizlemede fareyle tutup istediğiniz yere sürükleyebilirsiniz!', true);
        fileInput.value = '';
        previewSelectedLocalFile(null, 'image');
        loadCurrentPlacements();
        if (iframe && !iframe.hidden && pageSelect.value) {
          iframe.src = `${pageSelect.value}?siteMediaDesigner=1&_t=${Date.now()}`;
        }
      } catch (err) {
        setMsg(msgEl, err.message, false);
      } finally {
        updateSubmitState();
      }
    });

    loadCurrentPlacements();
    loadTextOverrides();
  }

  function boot() {
    wireHomepageAssetForms();
    initSiteMediaDesigner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
