// Maarif Modeli Konu Anlatım Üreticisi: Sınıf → Tema/Ünite → Alt Konu zincirleme menüsü.
// Ana panel betiğinden bağımsızdır; orada bir hata olsa bile menüler çalışır.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function tree() {
    const full = window.MEB_CURRICULUM_TREE;
    if (full && Object.keys(full).length) return full;
    const old = window.MATEMATIK_MUFREDATI || {};
    const out = {};
    Object.keys(old).forEach(grade => {
      out[grade] = {temalar: {}};
      (old[grade] || []).forEach(item => {
        const name = item.title || item.unit_topic || 'Genel';
        out[grade].temalar[name] = {
          alt_konular: (item.topics || []).map(t => typeof t === 'string' ? {name: t} : t)
        };
      });
    });
    return out;
  }

  function fill(select, placeholder, items, enabled) {
    select.replaceChildren(new Option(placeholder, ''));
    items.forEach(item => select.appendChild(new Option(item.label, item.value)));
    select.disabled = !enabled;
    select.value = '';
  }

  function updateBadge(grade) {
    const badge = $('currProgramBadge');
    if (!badge) return;
    const g = Number(grade);
    if (!g) { badge.hidden = true; return; }
    const legacy = g === 8 || g === 12;
    badge.textContent = legacy
      ? '📚 Aktif Müfredat: MEB Mevcut Öğretim Programı'
      : '📚 Aktif Müfredat: Türkiye Yüzyılı Maarif Modeli';
    badge.hidden = false;
  }

  function updateCurrTemalar() {
    const gradeSel = $('currGrade'), temaSel = $('currTema'), altSel = $('currAltKonu');
    if (!gradeSel || !temaSel || !altSel) return;
    const grade = gradeSel.value;
    updateBadge(grade);
    const data = tree()[grade];
    const temalar = data && data.temalar ? Object.keys(data.temalar) : [];
    const prev = temaSel.value;
    if (!grade || !temalar.length) {
      fill(temaSel, 'Önce sınıf seçin...', [], false);
      fill(altSel, 'Önce tema seçin...', [], false);
      return;
    }
    fill(temaSel, 'Tema / Ünite seçin...', temalar.map(t => ({label: t, value: t})), true);
    if (prev && temalar.includes(prev)) {
      temaSel.value = prev;
      updateCurrAltKonular();
    } else {
      fill(altSel, 'Önce tema seçin...', [], false);
    }
  }

  function updateCurrAltKonular() {
    const grade = $('currGrade')?.value;
    const tema = $('currTema')?.value;
    const altSel = $('currAltKonu');
    if (!altSel) return;
    const data = tree()[grade];
    const subs = data && data.temalar && data.temalar[tema] ? (data.temalar[tema].alt_konular || []) : [];
    if (!grade || !tema || !subs.length) {
      fill(altSel, 'Önce tema seçin...', [], false);
      return;
    }
    const prev = altSel.value;
    fill(altSel, 'Alt konu seçin...', subs.map(s => ({
      label: s.name + (s.outcome_code ? ` [${s.outcome_code}]` : ''),
      value: s.name
    })), true);
    if (prev && subs.some(s => s.name === prev)) altSel.value = prev;
  }

  window.updateCurrTemalar = updateCurrTemalar;
  window.updateCurrAltKonular = updateCurrAltKonular;

  function init() {
    const gradeSel = $('currGrade'), temaSel = $('currTema');
    if (!gradeSel || !temaSel) return;
    gradeSel.addEventListener('change', updateCurrTemalar);
    temaSel.addEventListener('change', updateCurrAltKonular);
    // Tarayıcı form geri yüklemesi 'change' tetiklemez; mevcut seçime göre doldur.
    updateCurrTemalar();
    window.addEventListener('pageshow', updateCurrTemalar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
