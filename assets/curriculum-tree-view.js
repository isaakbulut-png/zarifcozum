((root, factory) => {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.document) {
    const host = root.document.getElementById('curriculumTreeView');
    if (host) {
      const view = api.createCurriculumTreeView(host);
      root.addEventListener('curriculum-tree:open', () => view.load());
      root.addEventListener('curriculum-tree:close', () => view.clear());
    }
  }
})(typeof window !== 'undefined' ? window : null, () => {
  const childrenOf = node => Array.isArray(node && node.children) ? node.children : [];
  const nodesOfType = (node, type) => childrenOf(node).filter(child => child.node_type === type);

  function questionCount(node) {
    return Number.isSafeInteger(node && node.content_count) && node.content_count >= 0
      ? node.content_count : null;
  }

  function themeCount(theme) {
    return questionCount(theme);
  }

  function validateCounts(tree) {
    const pending = [...tree];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== 'object' || !Array.isArray(node.children)) {
        throw new Error('Müfredat servisinden geçersiz ağaç alındı.');
      }
      if (['TEMA_UNITE', 'KAZANIM_CIKTI'].includes(node.node_type) && questionCount(node) === null) {
        throw new Error('Müfredat servisinden geçersiz soru sayısı alındı.');
      }
      pending.push(...node.children);
    }
  }

  function skillsOf(node) {
    const skills = [];
    for (const child of nodesOfType(node, 'ALT_BECERI')) {
      const items = child.metadata && child.metadata.beceriler;
      if (Array.isArray(items) && items.some(item => typeof item === 'string' && item.trim())) {
        skills.push(...items.filter(item => typeof item === 'string' && item.trim()));
      } else {
        skills.push(child.title);
      }
    }
    return [...new Set(skills)];
  }

  function createCurriculumTreeView(host, options = {}) {
    const doc = host.ownerDocument;
    const fetchTree = options.fetchTree || (() => fetch('/api/v1/curriculum/tree', {credentials: 'same-origin'}));
    const state = {tree: [], grade: null, theme: null, outcome: null, request: 0};
    const el = (tag, className, text) => {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const message = (parent, text) => parent.appendChild(el('p', 'ctv-empty', text));

    function select(node, type) {
      if (type === 'grade') { state.grade = node; state.theme = null; state.outcome = null; }
      if (type === 'theme') { state.theme = node; state.outcome = null; }
      if (type === 'outcome') state.outcome = node;
      render();
      const selected = host.querySelector(`[data-selected-column="${type}"]`);
      if (selected) selected.focus({preventScroll: true});
      const grid = host.querySelector('.ctv-columns');
      const index = {grade: 1, theme: 2, outcome: 3}[type];
      if (grid && grid.scrollWidth > grid.clientWidth) {
        grid.scrollTo({left: grid.children[index].offsetLeft - grid.offsetLeft, behavior: 'auto'});
      }
    }

    function card(node, type, count) {
      const selected = state[type] && state[type].id === node.id;
      const button = el('button', `ctv-item${selected ? ' is-selected' : ''}${count === 0 ? ' is-empty' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(Boolean(selected)));
      if (selected) button.dataset.selectedColumn = type;
      const content = el('span', 'ctv-item-content');
      if (node.code && type !== 'grade') content.appendChild(el('span', 'ctv-code', node.code));
      content.appendChild(el('span', 'ctv-item-title', node.title));
      button.appendChild(content);
      if (type !== 'grade') {
        const badge = el('span', 'ctv-badge', `${count} Soru`);
        button.appendChild(badge);
      }
      button.addEventListener('click', () => select(node, type));
      return button;
    }

    function column(number, title, caption) {
      const section = el('section', 'ctv-column');
      const header = el('div', 'ctv-column-head');
      const label = el('div');
      label.appendChild(el('span', 'ctv-step', `0${number}`));
      label.appendChild(el('h3', '', title));
      header.appendChild(label);
      header.appendChild(el('p', '', caption));
      section.appendChild(header);
      return section;
    }

    function render() {
      host.replaceChildren();
      const intro = el('div', 'ctv-intro');
      intro.appendChild(el('p', '', 'Bir sınıf seçin, ardından tema ve kazanımları keşfedin.'));
      intro.appendChild(el('span', 'ctv-legend', 'Sarı: bağlı soru yok'));
      host.appendChild(intro);
      const grid = el('div', 'ctv-columns');
      grid.setAttribute('aria-label', 'Müfredat sütunları');
      grid.setAttribute('role', 'region');
      grid.tabIndex = 0;
      const grades = column(1, 'Kademe ve sınıf', 'Başlamak için bir sınıf seçin');
      const stages = state.tree.filter(node => node.node_type === 'KADEME');
      if (!stages.length) message(grades, 'Henüz kademe eklenmemiş.');
      for (const stage of stages) {
        const group = el('div', 'ctv-stage');
        group.appendChild(el('h4', 'ctv-stage-title', stage.title));
        const classes = nodesOfType(stage, 'SINIF');
        if (!classes.length) message(group, 'Bu kademede sınıf yok.');
        classes.forEach(grade => group.appendChild(card(grade, 'grade', null)));
        grades.appendChild(group);
      }
      const themes = column(2, 'Temalar', state.grade ? state.grade.title : 'Önce bir sınıf seçin');
      const themeNodes = nodesOfType(state.grade, 'TEMA_UNITE');
      if (!state.grade) message(themes, 'Sınıf seçtiğinizde temalar burada görünecek.');
      else if (!themeNodes.length) message(themes, 'Bu sınıfta henüz tema yok.');
      themeNodes.forEach(theme => themes.appendChild(card(theme, 'theme', themeCount(theme))));
      const outcomes = column(3, 'Öğrenme çıktıları', state.theme ? state.theme.title : 'Önce bir tema seçin');
      const outcomeNodes = nodesOfType(state.theme, 'KAZANIM_CIKTI');
      if (!state.theme) message(outcomes, 'Tema seçtiğinizde kazanımlar burada görünecek.');
      else if (!outcomeNodes.length) message(outcomes, 'Bu temada henüz kazanım yok.');
      outcomeNodes.forEach(outcome => outcomes.appendChild(card(outcome, 'outcome', questionCount(outcome))));
      const detail = column(4, 'Kazanım detayı', 'Beceriler ve içerik');
      if (!state.outcome) message(detail, 'Detayları görmek için bir kazanım seçin.');
      else {
        detail.appendChild(el('span', 'ctv-detail-code', state.outcome.code));
        detail.appendChild(el('h4', 'ctv-detail-title', state.outcome.title));
        detail.appendChild(el('h5', 'ctv-detail-heading', 'Alt beceriler'));
        const skills = skillsOf(state.outcome);
        if (!skills.length) message(detail, 'Bu kazanıma henüz alt beceri eklenmemiş.');
        else {
          const list = el('ul', 'ctv-skills');
          skills.forEach(skill => list.appendChild(el('li', '', skill)));
          detail.appendChild(list);
        }
        detail.appendChild(el('h5', 'ctv-detail-heading', 'Bağlı içerikler'));
        message(detail, `${questionCount(state.outcome)} bağlı soru. Soru detayları henüz listelenmiyor.`);
      }
      [grades, themes, outcomes, detail].forEach(columnElement => grid.appendChild(columnElement));
      host.appendChild(grid);
    }

    async function load() {
      const request = ++state.request;
      const loading = el('p', 'ctv-status', 'Müfredat yükleniyor…');
      loading.setAttribute('role', 'status');
      host.replaceChildren(loading);
      host.setAttribute('aria-busy', 'true');
      try {
        const response = await fetchTree();
        if (!response.ok) {
          if (response.status === 401) throw new Error('Oturumunuz sona erdi. Yeniden giriş yapın.');
          if (response.status === 403) throw new Error('Müfredatı görüntüleme yetkiniz bulunmuyor.');
          throw new Error(`Müfredat yüklenemedi (${response.status}).`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Müfredat servisinden geçersiz yanıt alındı.');
        validateCounts(data);
        if (request !== state.request) return;
        state.tree = data;
        state.grade = state.theme = state.outcome = null;
        render();
      } catch (error) {
        if (request !== state.request) return;
        console.error('Müfredat ağacı yüklenemedi:', error);
        host.replaceChildren();
        const status = el('div', 'ctv-error');
        status.setAttribute('role', 'alert');
        status.appendChild(el('p', '', error.message || 'Müfredat yüklenemedi.'));
        const retry = el('button', 'ctv-retry', 'Tekrar dene');
        retry.type = 'button';
        retry.addEventListener('click', load);
        status.appendChild(retry);
        host.appendChild(status);
      } finally {
        if (request === state.request) host.removeAttribute('aria-busy');
      }
    }

    function clear() {
      state.request++;
      state.tree = [];
      state.grade = state.theme = state.outcome = null;
      host.replaceChildren();
      host.removeAttribute('aria-busy');
    }
    return {load, clear};
  }

  return {createCurriculumTreeView, questionCount, themeCount, skillsOf, validateCounts};
});
