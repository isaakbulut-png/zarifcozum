const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const pages = [
  'index.html',
  'hakkimizda.html',
  'Paketler.html',
  'Platform Ayrıcalıkları.html',
  'yasal.html'
];

test('all shared site navigation pages provide and load the mobile menu', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(html, /class="menu-toggle"/, `${page} must provide a menu button`);
    assert.match(html, /aria-controls="site-navigation"/, `${page} must connect the button to navigation`);
    assert.match(html, /<nav[^>]*id="site-navigation"/, `${page} must identify the navigation`);
    assert.match(html, /mobile-menu\.js/, `${page} must load the menu behavior`);
  }
});

test('mobile menu opens, closes from a link or Escape, and resets on desktop resize', () => {
  const source = fs.readFileSync(path.join(root, 'assets', 'mobile-menu.js'), 'utf8');
  const buttonHandlers = {};
  const navHandlers = {};
  const documentHandlers = {};
  const windowHandlers = {};
  const classes = new Set();
  const attributes = new Map([
    ['aria-expanded', 'false'],
    ['aria-label', 'Menüyü aç']
  ]);
  const button = {
    addEventListener: (type, handler) => { buttonHandlers[type] = handler; },
    getAttribute: name => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value)
  };
  const nav = {
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle: (name, force) => {
        if (force) classes.add(name);
        else classes.delete(name);
      }
    },
    addEventListener: (type, handler) => { navHandlers[type] = handler; }
  };
  const header = {
    querySelector: selector => selector === '.menu-toggle' ? button : nav
  };
  const document = {
    querySelectorAll: () => [header],
    addEventListener: (type, handler) => { documentHandlers[type] = handler; }
  };
  const window = {
    innerWidth: 800,
    addEventListener: (type, handler) => { windowHandlers[type] = handler; }
  };

  vm.runInNewContext(source, { document, window });

  buttonHandlers.click();
  assert.equal(classes.has('is-open'), true);
  assert.equal(attributes.get('aria-expanded'), 'true');
  assert.equal(attributes.get('aria-label'), 'Menüyü kapat');

  navHandlers.click({ target: { closest: () => ({}) } });
  assert.equal(classes.has('is-open'), false);
  assert.equal(attributes.get('aria-expanded'), 'false');

  buttonHandlers.click();
  documentHandlers.keydown({ key: 'Escape' });
  assert.equal(classes.has('is-open'), false);

  buttonHandlers.click();
  window.innerWidth = 1200;
  windowHandlers.resize();
  assert.equal(classes.has('is-open'), false);
  assert.equal(attributes.get('aria-expanded'), 'false');
});
