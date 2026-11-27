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
    after: 'Altına Ekle',
    before: 'Üstüne Ekle',
    prepend: 'İçine (Başına)',
    append: 'İçine (Sonuna)',
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
        delBtn.textContent = '🗑️ Kaldır';
        delBtn.onclick = async () => {
          if (!confirm('Bu medya yerleşimini sayfadan kaldırmak istediğinize emin misiniz?')) return;
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

    if (!form || !pageSelect || !window.SiteMediaTargets) return;

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
        if (!currentTargets.some(t => t.key === data.target.key)) {
          currentTargets.push(data.target);
          const opt = document.createElement('option');
          opt.value = data.target.key;
          opt.textContent = formatTargetOption(data.target);
          targetSelect.append(opt);
        }
        targetSelect.disabled = false;
        targetSelect.value = data.target.key;
        updateSubmitState();
        updateDescription();
        setMsg(msgEl, 'Hedef canlı önizlemeden seçildi. Dosyanızı seçip "Medyayı Yerleştir" butonuna tıklayın.', true);
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
        setMsg(msgEl, '✅ ' + (data.mesaj || 'Medya seçilen hedefe yerleştirildi.'), true);
        fileInput.value = '';
        previewSelectedLocalFile(null, 'image');
        loadCurrentPlacements();
      } catch (err) {
        setMsg(msgEl, err.message, false);
      } finally {
        updateSubmitState();
      }
    });

    loadCurrentPlacements();
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
