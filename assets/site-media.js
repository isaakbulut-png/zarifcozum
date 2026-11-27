(() => {
  const targets = window.SiteMediaTargets;
  if (!targets) {
    console.error('Sayfa medya hedef kataloğu yüklenemedi.');
    return;
  }

  const pagePath = targets.normalizePagePath(window.location.pathname);
  if (!pagePath) return;

  const isDesigner = new URLSearchParams(window.location.search).has('siteMediaDesigner');

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/assets/site-media.css?v=3';
  document.head.append(stylesheet);

  function applyTextStyle(el, override) {
    if (!el || !override) return;
    if (typeof override.customText === 'string' && override.customText.trim()) {
      el.textContent = override.customText;
    }
    if (override.textColor) el.style.color = override.textColor;
    else if (override.resetColor) el.style.removeProperty('color');

    if (override.fontFamily) el.style.fontFamily = override.fontFamily;
    else if (override.resetFont) el.style.removeProperty('font-family');

    if (override.fontSizePx) el.style.fontSize = `${override.fontSizePx}px`;
    else if (override.resetSize) el.style.removeProperty('font-size');

    if (override.fontWeight) el.style.fontWeight = String(override.fontWeight);
    else if (override.resetWeight) el.style.removeProperty('font-weight');
  }

  async function loadLottie() {
    if (window.lottie) return window.lottie;
    if (!window.siteMediaLottiePromise) {
      window.siteMediaLottiePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
        script.onload = () => window.lottie ? resolve(window.lottie) : reject(new Error('Lottie oynatıcısı yüklenemedi.'));
        script.onerror = () => reject(new Error('Lottie oynatıcısı indirilemedi.'));
        document.head.append(script);
      });
    }
    return window.siteMediaLottiePromise;
  }

  function validMedia(placement) {
    if (!placement || typeof placement.url !== 'string') return false;
    if (placement.assetType === 'image') {
      return /^\/uploads\/site-media\/[a-f0-9-]+\.(?:png|jpe?g|webp)$/i.test(placement.url);
    }
    return placement.assetType === 'animation' &&
      /^\/uploads\/site-media\/[a-f0-9-]+\.json$/i.test(placement.url);
  }

  function applyLayoutStyles(holder, mediaEl, placement) {
    const widthPx = Number.isFinite(Number(placement.widthPx))
      ? Math.max(32, Math.min(900, Math.round(Number(placement.widthPx))))
      : 320;
    const align = ['left', 'center', 'right'].includes(placement.align) ? placement.align : 'center';
    const offsetX = Number.isFinite(Number(placement.offsetX)) ? Math.round(Number(placement.offsetX)) : 0;
    const offsetY = Number.isFinite(Number(placement.offsetY)) ? Math.round(Number(placement.offsetY)) : 0;

    holder.dataset.align = align;
    holder.dataset.offsetX = String(offsetX);
    holder.dataset.offsetY = String(offsetY);
    holder.dataset.widthPx = String(widthPx);

    mediaEl.style.width = `min(100%, ${widthPx}px)`;
    if (placement.assetType === 'animation') {
      mediaEl.style.height = `min(${Math.round(widthPx * 0.85)}px, 70vw)`;
    }
    if (align === 'left') {
      mediaEl.style.marginInline = '0 auto';
    } else if (align === 'right') {
      mediaEl.style.marginInline = 'auto 0';
    } else {
      mediaEl.style.marginInline = 'auto';
    }

    if (offsetX !== 0 || offsetY !== 0) {
      mediaEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      mediaEl.style.position = 'relative';
      mediaEl.style.zIndex = '10';
    } else {
      mediaEl.style.transform = '';
    }
  }

  function insertHolder(element, holder, position) {
    const voidTags = new Set(['IMG', 'INPUT', 'BR', 'HR']);
    const isVoid = voidTags.has(element.tagName);
    const pos = ['after', 'before', 'prepend', 'append', 'replace', 'overlay'].includes(position) ? position : 'after';

    if (pos === 'overlay') {
      const targetBox = isVoid ? element.parentElement : element;
      if (targetBox) {
        if (getComputedStyle(targetBox).position === 'static') {
          targetBox.style.position = 'relative';
        }
        holder.classList.add('site-media-overlay');
        targetBox.append(holder);
        return;
      }
    }
    if (pos === 'replace') {
      element.style.display = 'none';
      element.insertAdjacentElement('afterend', holder);
      return;
    }
    if (pos === 'before') {
      element.insertAdjacentElement('beforebegin', holder);
      return;
    }
    if (pos === 'prepend') {
      element.insertAdjacentElement(isVoid ? 'beforebegin' : 'afterbegin', holder);
      return;
    }
    if (pos === 'append') {
      element.insertAdjacentElement(isVoid ? 'afterend' : 'beforeend', holder);
      return;
    }
    element.insertAdjacentElement('afterend', holder);
  }

  function attachDesignerDragAndResize(holder, mediaEl, placement) {
    if (!isDesigner || !placement.id) return;
    holder.classList.add('is-designer-draggable');
    mediaEl.classList.add('site-media-drag-box');

    const pill = document.createElement('div');
    pill.className = 'site-media-drag-pill';
    pill.textContent = '✋ Tut & Sürükle';
    mediaEl.append(pill);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'site-media-resize-handle';
    resizeHandle.title = 'Boyutlandırmak için sürükle';
    resizeHandle.textContent = '⤡';
    mediaEl.append(resizeHandle);

    let mode = null; // 'drag' | 'resize'
    let startClientX = 0;
    let startClientY = 0;
    let startX = Number(holder.dataset.offsetX) || 0;
    let startY = Number(holder.dataset.offsetY) || 0;
    let startW = Number(holder.dataset.widthPx) || 320;
    let curX = startX;
    let curY = startY;
    let curW = startW;

    const notifyParent = () => {
      window.parent.postMessage({
        type: 'site-media-transform',
        pagePath,
        id: placement.id,
        offsetX: curX,
        offsetY: curY,
        widthPx: curW
      }, window.location.origin);
    };

    resizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mode = 'resize';
      startClientX = e.clientX;
      startW = Number(holder.dataset.widthPx) || 320;
      curW = startW;
      resizeHandle.setPointerCapture(e.pointerId);
    });

    mediaEl.addEventListener('pointerdown', (e) => {
      if (e.target === resizeHandle) return;
      e.preventDefault();
      e.stopPropagation();
      mode = 'drag';
      startClientX = e.clientX;
      startClientY = e.clientY;
      startX = Number(holder.dataset.offsetX) || 0;
      startY = Number(holder.dataset.offsetY) || 0;
      curX = startX;
      curY = startY;
      mediaEl.classList.add('is-dragging');
      mediaEl.setPointerCapture(e.pointerId);
    });

    const onMove = (e) => {
      if (!mode) return;
      e.preventDefault();
      e.stopPropagation();
      if (mode === 'drag') {
        curX = Math.max(-1600, Math.min(1600, Math.round(startX + (e.clientX - startClientX))));
        curY = Math.max(-1600, Math.min(1600, Math.round(startY + (e.clientY - startClientY))));
        holder.dataset.offsetX = String(curX);
        holder.dataset.offsetY = String(curY);
        mediaEl.style.transform = `translate(${curX}px, ${curY}px)`;
        mediaEl.style.position = 'relative';
        mediaEl.style.zIndex = '50';
        pill.textContent = `✋ X: ${curX >= 0 ? '+' : ''}${curX}px · Y: ${curY >= 0 ? '+' : ''}${curY}px`;
      } else if (mode === 'resize') {
        curW = Math.max(48, Math.min(820, Math.round(startW + (e.clientX - startClientX))));
        holder.dataset.widthPx = String(curW);
        mediaEl.style.width = `min(100%, ${curW}px)`;
        if (placement.assetType === 'animation') {
          mediaEl.style.height = `min(${Math.round(curW * 0.85)}px, 70vw)`;
        }
        pill.textContent = `⤡ Genişlik: ${curW}px`;
      }
    };

    const onUp = (e) => {
      if (!mode) return;
      e.preventDefault();
      e.stopPropagation();
      mode = null;
      mediaEl.classList.remove('is-dragging');
      pill.textContent = `💾 Kaydedildi (${curX}px, ${curY}px · ${curW}px)`;
      notifyParent();
    };

    mediaEl.addEventListener('pointermove', onMove);
    mediaEl.addEventListener('pointerup', onUp);
    resizeHandle.addEventListener('pointermove', onMove);
    resizeHandle.addEventListener('pointerup', onUp);
  }

  async function renderPlacement(placement, element) {
    const holder = document.createElement('div');
    holder.className = 'site-media-placement';
    holder.dataset.siteMediaKey = placement.targetKey;
    if (placement.id) holder.dataset.siteMediaId = placement.id;

    if (placement.assetType === 'image') {
      const wrap = document.createElement('div');
      wrap.className = 'site-media-image-wrap';
      const image = document.createElement('img');
      image.src = placement.url;
      image.alt = 'Sayfa görseli';
      image.loading = 'lazy';
      image.draggable = false;
      image.className = 'site-media-image';
      image.style.width = '100%';
      image.addEventListener('error', () => {
        console.error('Sayfa görseli yüklenemedi:', placement.url);
        holder.remove();
      }, {once: true});
      wrap.append(image);
      applyLayoutStyles(holder, wrap, placement);
      holder.append(wrap);
      insertHolder(element, holder, placement.position);
      attachDesignerDragAndResize(holder, wrap, placement);
    } else {
      const container = document.createElement('div');
      container.className = 'site-media-animation';
      container.setAttribute('role', 'img');
      container.setAttribute('aria-label', 'Sayfa animasyonu');
      applyLayoutStyles(holder, container, placement);
      holder.append(container);
      insertHolder(element, holder, placement.position);
      attachDesignerDragAndResize(holder, container, placement);
      try {
        const lottie = await loadLottie();
        const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const animation = lottie.loadAnimation({
          container, renderer: 'svg', loop: true, autoplay: !motionPreference.matches, path: placement.url
        });
        motionPreference.addEventListener('change', event => {
          if (event.matches) animation.pause();
          else animation.play();
        });
        animation.addEventListener('data_failed', () => {
          console.error('Sayfa Lottie animasyonu yüklenemedi:', placement.url);
          holder.remove();
        });
      } catch (error) {
        console.error('Sayfa Lottie animasyonu başlatılamadı:', error);
        holder.remove();
      }
    }
  }

  async function loadPlacements() {
    try {
      const response = await fetch(`/api/site-media?page=${encodeURIComponent(pagePath)}`, {
        credentials: 'same-origin', cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.mesaj || `Sayfa medyaları alınamadı (${response.status}).`);
      const entries = targets.entries(document);
      for (const override of result.textOverrides || []) {
        if (!targets.validTargetKey(override.targetKey)) continue;
        const target = entries.find(item => item.key === override.targetKey);
        if (target && target.element) {
          applyTextStyle(target.element, override);
        }
      }
      for (const placement of result.placements || []) {
        if (!targets.validTargetKey(placement.targetKey) || !validMedia(placement)) {
          console.error('Geçersiz sayfa medya yerleşimi atlandı.', placement);
          continue;
        }
        const target = entries.find(item => item.key === placement.targetKey);
        if (!target) {
          console.error('Sayfa medya hedefi bulunamadı:', placement.targetKey);
          continue;
        }
        await renderPlacement(placement, target.element);
      }
    } catch (error) {
      console.error('Sayfa medyaları yüklenemedi:', error);
    }
  }

  if (isDesigner) {
    const badge = document.createElement('div');
    badge.id = 'siteMediaHoverBadge';
    badge.hidden = true;
    document.body.append(badge);

    const announce = () => {
      window.parent.postMessage({
        type: 'site-media-targets',
        pagePath,
        targets: targets.descriptors(document)
      }, window.location.origin);
    };

    let activeElement = null;
    let selectedElement = null;

    const findTargetForNode = (node) => {
      if (!node || !node.closest) return null;
      if (node.closest('.site-media-placement') || node.id === 'siteMediaHoverBadge') return null;
      const el = node.closest(targets.TARGET_SELECTOR);
      if (!el || el.closest('.site-media-placement')) return null;
      return targets.entries(document).find(item => item.element === el) || null;
    };

    document.addEventListener('pointerover', event => {
      const found = findTargetForNode(event.target);
      const element = found?.element || null;
      if (activeElement === element) return;
      activeElement?.classList.remove('site-media-target-hover');
      activeElement = element;
      if (activeElement && found) {
        activeElement.classList.add('site-media-target-hover');
        badge.textContent = `🎯 ${found.kind}: ${found.label.slice(0, 60)}`;
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }, true);

    document.addEventListener('pointermove', event => {
      if (!badge.hidden) {
        badge.style.left = `${Math.min(window.innerWidth - 260, event.clientX + 14)}px`;
        badge.style.top = `${Math.max(8, event.clientY - 34)}px`;
      }
    }, true);

    document.addEventListener('click', event => {
      if (event.target.closest?.('.site-media-placement')) return;
      const found = findTargetForNode(event.target);
      if (!found) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selectedElement?.classList.remove('site-media-target-selected');
      selectedElement = found.element;
      selectedElement.classList.add('site-media-target-selected');
      const cs = getComputedStyle(found.element);
      window.parent.postMessage({
        type: 'site-media-target-selected',
        pagePath,
        target: {
          tag: found.tag, kind: found.kind, id: found.id, label: found.label,
          context: found.context, occurrence: found.occurrence, key: found.key,
          currentText: (found.element.innerText || found.element.textContent || '').trim(),
          computedFontSize: parseInt(cs.fontSize, 10) || 16
        }
      }, window.location.origin);
    }, true);

    window.addEventListener('message', event => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'site-media-highlight' && event.data.targetKey) {
        const found = targets.entries(document).find(item => item.key === event.data.targetKey);
        selectedElement?.classList.remove('site-media-target-selected');
        selectedElement = found?.element || null;
        if (selectedElement) {
          selectedElement.classList.add('site-media-target-selected');
          selectedElement.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
      }
      if (event.data?.type === 'site-media-preview-text' && event.data.targetKey) {
        const found = targets.entries(document).find(item => item.key === event.data.targetKey);
        if (found?.element) {
          applyTextStyle(found.element, event.data);
        }
      }
    });

    announce();
    loadPlacements();
    let announceTimer = null;
    new MutationObserver(() => {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(announce, 350);
    }).observe(document.body, {childList: true, subtree: true});
    return;
  }

  loadPlacements();
})();
