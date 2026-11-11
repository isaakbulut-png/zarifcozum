const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'assets', 'ogretmen-gezinme.js'), 'utf8');

function setup(initialHash = '') {
  const handlers = {};
  const location = {hash: initialHash};
  const views = ['overview', 'students', 'assignments', 'student-results', 'student-results'].map(id => ({
    dataset: {panelView: id},
    hidden: false,
    querySelector: () => ({setAttribute() {}, focus() {}})
  }));
  const targets = {
    overview: views[0], students: views[1], assignments: views[2], 'student-results': views[3],
    'answer-key': views[4]
  };
  const links = ['overview', 'students', 'assignments'].map(id => ({
    hash: `#${id}`,
    current: false,
    setAttribute() { this.current = true; },
    removeAttribute() { this.current = false; }
  }));
  const layout = {addEventListener: (event, handler) => { handlers[event] = handler; }};
  const document = {
    querySelectorAll: selector => selector.startsWith('#panel') ? views : links,
    querySelector: () => layout,
    getElementById: id => targets[id] ? {closest: () => targets[id]} : null
  };
  const window = {
    addEventListener: (event, handler) => { handlers[event] = handler; },
    scrollTo() {}
  };
  const history = {pushState: (_state, _title, hash) => { location.hash = hash; }};
  vm.runInNewContext(script, {document, window, location, history});
  const visible = () => views.filter(view => !view.hidden).map(view => view.dataset.panelView);
  const click = (hash, options = {}) => {
    const event = {
      button: 0, target: {closest: () => ({hash})},
      preventDefault() { this.prevented = true; },
      ...options
    };
    handlers.click(event);
    return event;
  };
  return {window, location, links, handlers, visible, click};
}

test('menü bağlantısı yalnız ilgili görünümü açar ve etkin bağlantıyı günceller', () => {
  const page = setup();
  assert.deepEqual(page.visible(), ['overview']);
  assert.equal(page.click('#students').prevented, true);
  assert.equal(page.location.hash, '#students');
  assert.deepEqual(page.visible(), ['students']);
  assert.deepEqual(page.links.map(link => link.current), [false, true, false]);
  page.window.teacherPanelNavigation.open('assignments');
  assert.deepEqual(page.visible(), ['assignments']);
});

test('doğrudan bağlantılar ve tarayıcı geçmişi ilgili görünümü açar', () => {
  const page = setup('#answer-key');
  assert.deepEqual(page.visible(), ['student-results', 'student-results']);
  page.location.hash = '#students';
  page.handlers.popstate();
  assert.deepEqual(page.visible(), ['students']);
  page.location.hash = '#student-results';
  page.handlers.hashchange();
  assert.deepEqual(page.visible(), ['student-results', 'student-results']);
});

test('bilinmeyen bağlantılar ve yeni sekmede açma davranışı engellenmez', () => {
  const page = setup();
  assert.equal(page.click('#unknown').prevented, undefined);
  assert.equal(page.click('#students', {ctrlKey: true}).prevented, undefined);
  assert.deepEqual(page.visible(), ['overview']);
});
