(() => {
  const targets = window.SiteMediaTargets;
  if (!targets) {
    console.error('Sayfa medya hedef kataloğu yüklenemedi.');
    return;
  }

  const pagePath = targets.normalizePagePath(window.location.pathname);
  if (!pagePath) return;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/assets/site-media.css?v=2';
  document.head.append(stylesheet);

  if (new URLSearchParams(window.location.search).has('siteMediaDesigner')) {
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
      const el = node.closest(targets.TARGET_SELECTOR);
      if (!el || el.closest('.site-media-placement') || el.id === 'siteMediaHoverBadge') return null;
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
      const found = findTargetForNode(event.target);
      if (!found) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selectedElement?.classList.remove('site-media-target-selected');
      selectedElement = found.element;
      selectedElement.classList.add('site-media-target-selected');
      window.parent.postMessage({
        type: 'site-media-target-selected',
        pagePath,
        target: {
          tag: found.tag, kind: found.kind, id: found.id, label: found.label,
          context: found.context, occurrence: found.occurrence, key: found.key,
          currentText: (found.element.innerText || found.element.textContent || '').trim()
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
        if (found?.element && typeof event.data.customText === 'string') {
          found.element.textContent = event.data.customText;
        }
      }
    });

    announce();
    let announceTimer = null;
    new MutationObserver(() => {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(announce, 250);
    }).observe(document.body, {childList: true, subtree: true});
    return;
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

    holder.dataset.align = align;
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

  async function renderPlacement(placement, element) {
    const holder = document.createElement('div');
    holder.className = 'site-media-placement';
    holder.dataset.siteMediaKey = placement.targetKey;
    if (placement.assetType === 'image') {
      const image = document.createElement('img');
      image.src = placement.url;
      image.alt = 'Sayfa görseli';
      image.loading = 'lazy';
      image.className = 'site-media-image';
      applyLayoutStyles(holder, image, placement);
      image.addEventListener('error', () => {
        console.error('Sayfa görseli yüklenemedi:', placement.url);
        holder.remove();
      }, {once: true});
      holder.append(image);
      insertHolder(element, holder, placement.position);
    } else {
      const container = document.createElement('div');
      container.className = 'site-media-animation';
      container.setAttribute('role', 'img');
      container.setAttribute('aria-label', 'Sayfa animasyonu');
      applyLayoutStyles(holder, container, placement);
      holder.append(container);
      insertHolder(element, holder, placement.position);
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
        if (!targets.validTargetKey(override.targetKey) || typeof override.customText !== 'string') continue;
        const target = entries.find(item => item.key === override.targetKey);
        if (target && target.element) {
          target.element.textContent = override.customText;
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

  loadPlacements();
})();
