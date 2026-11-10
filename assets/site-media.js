(() => {
  const targets = window.SiteMediaTargets;
  if (!targets) {
    console.error('Sayfa medya hedef kataloğu yüklenemedi.');
    return;
  }

  const pagePath = targets.normalizePagePath(window.location.pathname);
  if (!pagePath) return;

  if (new URLSearchParams(window.location.search).has('siteMediaDesigner')) {
    const announce = () => {
      window.parent.postMessage({
        type: 'site-media-targets',
        pagePath,
        targets: targets.descriptors(document)
      }, window.location.origin);
    };
    let activeElement = null;
    document.addEventListener('pointerover', event => {
      const element = event.target.closest?.('a[href], button');
      if (activeElement === element) return;
      activeElement?.classList.remove('site-media-target-hover');
      activeElement = element;
      activeElement?.classList.add('site-media-target-hover');
    }, true);
    document.addEventListener('click', event => {
      const element = event.target.closest?.('a[href], button');
      if (!element) return;
      const target = targets.entries(document).find(item => item.element === element);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.parent.postMessage({
        type: 'site-media-target-selected',
        pagePath,
        target: {
          tag: target.tag, id: target.id, label: target.label, context: target.context,
          occurrence: target.occurrence, key: target.key
        }
      }, window.location.origin);
    }, true);
    announce();
    new MutationObserver(announce).observe(document.body, {childList: true, subtree: true});
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
      image.addEventListener('error', () => {
        console.error('Sayfa görseli yüklenemedi:', placement.url);
        holder.remove();
      }, {once: true});
      holder.append(image);
    } else {
      const container = document.createElement('div');
      container.className = 'site-media-animation';
      container.setAttribute('role', 'img');
      container.setAttribute('aria-label', 'Sayfa animasyonu');
      holder.append(container);
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
        return;
      }
    }
    element.insertAdjacentElement('afterend', holder);
  }

  async function loadPlacements() {
    try {
      const response = await fetch(`/api/site-media?page=${encodeURIComponent(pagePath)}`, {
        credentials: 'same-origin', cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.mesaj || `Sayfa medyaları alınamadı (${response.status}).`);
      const entries = targets.entries(document);
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

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/assets/site-media.css';
  document.head.append(stylesheet);
  loadPlacements();
})();
