(() => {
  const form = document.querySelector('[data-cookie-preferences]');
  if (!form) return;

  const analytics = form.elements.namedItem('analytics');
  const marketing = form.elements.namedItem('marketing');
  const status = form.querySelector('[data-cookie-status]');
  const storageKey = 'zarifcozum.cookiePreferences';

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function savePreferences(allowOptional) {
    const preferences = {
      necessary: true,
      analytics: allowOptional ? analytics.checked : false,
      marketing: allowOptional ? marketing.checked : false,
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      analytics.checked = preferences.analytics;
      marketing.checked = preferences.marketing;
      showStatus('Tercihleriniz bu tarayıcıya kaydedildi.');
    } catch (error) {
      console.error('Çerez tercihleri kaydedilemedi:', error);
      showStatus('Tercihler kaydedilemedi. Tarayıcı depolama izinlerini kontrol edin.', true);
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      analytics.checked = saved.analytics === true;
      marketing.checked = saved.marketing === true;
    }
  } catch (error) {
    console.error('Kaydedilmiş çerez tercihleri okunamadı:', error);
    showStatus('Önceki tercihler okunamadı; yeni tercihinizi kaydedebilirsiniz.', true);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    savePreferences(true);
  });

  form.querySelector('[data-cookie-reject]').addEventListener('click', () => {
    savePreferences(false);
  });
})();
