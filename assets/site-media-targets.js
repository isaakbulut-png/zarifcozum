(function (root, factory) {
  const targets = factory();
  if (typeof module === 'object' && module.exports) module.exports = targets;
  if (root) root.SiteMediaTargets = targets;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const PAGES = [
    {path: '/index.html', label: 'Ana sayfa'},
    {path: '/hakkimizda.html', label: 'Hakkımızda'},
    {path: '/Platform Ayrıcalıkları.html', label: 'Platform Ayrıcalıkları'},
    {path: '/Paketler.html', label: 'Paketler'},
    {path: '/mimari.html', label: 'Mimari'},
    {path: '/basari-odakli-sistem.html', label: 'Başarı Odaklı Sistem'},
    {path: '/planli-calisma.html', label: 'Planlı Çalışma'},
    {path: '/asistan.html', label: 'Asistan'},
    {path: '/asistanla-soru-coz.html', label: 'Asistanla Soru Çöz'},
    {path: '/canli.html', label: 'Canlı Ders'},
    {path: '/zoom-room.html', label: 'Canlı Ders Odası'},
    {path: '/konu.html', label: 'Konu Anlatımları'},
    {path: '/dene.html', label: 'Deneme'},
    {path: '/test.html', label: 'Kazanım Testi'},
    {path: '/deneme-sinavi-optik.html', label: 'Optik Deneme Sınavı'},
    {path: '/yasal.html', label: 'Yasal Bilgiler'},
    {path: '/ogrenci-paneli.html', label: 'Öğrenci Paneli'},
    {path: '/ogretmen-paneli.html', label: 'Öğretmen Paneli'},
    {path: '/veli-panel.html', label: 'Veli Paneli'},
    {path: '/pages/asistanla-soru-coz-tanitim.html', label: 'Asistanla Soru Çöz Tanıtımı'},
    {path: '/pages/cozumlu-sorular-tanitim.html', label: 'Çözümlü Sorular Tanıtımı'},
    {path: '/pages/deneme-sinavi-tanitim.html', label: 'Deneme Sınavı Tanıtımı'},
    {path: '/pages/ilerlemeni-takip-et-tanitim.html', label: 'İlerlemeni Takip Et Tanıtımı'},
    {path: '/pages/konu_anlatimlari.html', label: 'Konu Anlatımları Tanıtımı'},
    {path: '/pages/konulari-kesfet-tanitim.html', label: 'Konuları Keşfet Tanıtımı'},
    {path: '/pages/ogrenci-paneli-tanitim.html', label: 'Öğrenci Paneli Tanıtımı'},
    {path: '/pages/oran-oranti-mini-test.html', label: 'Oran Orantı Mini Test'},
    {path: '/pages/test-ve-etkinlikler-tanitim.html', label: 'Test ve Etkinlikler Tanıtımı'}
  ];

  function normalizePagePath(value) {
    if (typeof value !== 'string') return null;
    let path;
    try {
      path = decodeURIComponent(value);
    } catch {
      return null;
    }
    if (path === '/') path = '/index.html';
    if (!path.startsWith('/') || path.includes('\\') || path.includes('\0')) return null;
    return PAGES.some(page => page.path === path) ? path : null;
  }

  function textOf(element) {
    return String(element.getAttribute('aria-label') || element.getAttribute('title') ||
      element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  function contextOf(element) {
    const container = element.closest('section, article, nav, main, header, footer, form') || element.parentElement;
    const heading = container?.querySelector('h1, h2, h3, h4');
    return String(heading?.textContent || container?.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function entries(root) {
    const occurrences = new Map();
    return [...root.querySelectorAll('a[href], button')].map(element => {
      const tag = element.tagName.toLowerCase();
      const id = element.id || '';
      const label = textOf(element);
      const context = contextOf(element);
      const occurrenceKey = JSON.stringify([tag, id, label, context]);
      const occurrence = occurrences.get(occurrenceKey) || 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      return {
        tag, id, label, context, occurrence,
        key: JSON.stringify([tag, id, label, context, occurrence]), element
      };
    }).filter(target => target.label);
  }

  function descriptors(root) {
    return entries(root).map(({element, ...target}) => target);
  }

  function validTargetKey(value) {
    if (typeof value !== 'string' || value.length > 1000) return false;
    let parts;
    try {
      parts = JSON.parse(value);
    } catch {
      return false;
    }
    return Array.isArray(parts) && parts.length === 5 &&
      ['a', 'button'].includes(parts[0]) &&
      typeof parts[1] === 'string' && parts[1].length <= 120 &&
      typeof parts[2] === 'string' && parts[2].length > 0 && parts[2].length <= 160 &&
      typeof parts[3] === 'string' && parts[3].length <= 120 &&
      Number.isInteger(parts[4]) && parts[4] >= 0 && parts[4] <= 1000;
  }

  return {PAGES, normalizePagePath, entries, descriptors, validTargetKey};
});
