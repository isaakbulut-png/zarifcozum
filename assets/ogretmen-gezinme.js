(() => {
  const views = [...document.querySelectorAll('#panel [data-panel-view]')];
  const links = [...document.querySelectorAll('#teacherSidebar nav a[href^="#"]')];

  function viewForHash(hash) {
    const id = hash.replace(/^#/, '');
    const target = document.getElementById(id);
    return target?.closest('[data-panel-view]')?.dataset.panelView || null;
  }

  function show(id, focus = false) {
    const selected = views.find(view => view.dataset.panelView === id) || views[0];
    if (!selected) return;
    views.forEach(view => { view.hidden = view.dataset.panelView !== selected.dataset.panelView; });
    links.forEach(link => {
      if (viewForHash(link.hash) === selected.dataset.panelView) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (focus) {
      const heading = selected.querySelector('h1, h2, h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({preventScroll: true});
      }
      window.scrollTo({top: 0, behavior: 'auto'});
    }
  }

  function open(id) {
    const view = viewForHash(`#${id}`);
    if (!view) return;
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    show(view, true);
  }

  window.teacherPanelNavigation = {open};
  document.querySelector('.teacher-layout').addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link || !viewForHash(link.hash)) return;
    event.preventDefault();
    open(link.hash.slice(1));
  });
  window.addEventListener('hashchange', () => show(viewForHash(location.hash), true));
  window.addEventListener('popstate', () => show(viewForHash(location.hash), true));
  show(viewForHash(location.hash));
})();
