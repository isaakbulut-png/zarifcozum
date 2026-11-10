const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const SiteMediaTargets = require('../assets/site-media-targets');

const root = path.join(__dirname, '..');

test('every configured visitor and panel page loads the shared media target scripts', () => {
  for (const page of SiteMediaTargets.PAGES) {
    const html = fs.readFileSync(path.join(root, page.path.slice(1)), 'utf8');
    assert.match(html, /\/assets\/site-media-targets\.js/, page.path);
    assert.match(html, /\/assets\/site-media\.js/, page.path);
  }
  assert.equal(SiteMediaTargets.normalizePagePath('/'), '/index.html');
  assert.equal(
    SiteMediaTargets.normalizePagePath('/Platform%20Ayr%C4%B1cal%C4%B1klar%C4%B1.html'),
    '/Platform Ayrıcalıkları.html'
  );
  assert.equal(SiteMediaTargets.normalizePagePath('/admin-paneli.html'), null);
});

function fakeElement({tag = 'BUTTON', id = '', label = '', context = 'Örnek bölüm'} = {}) {
  const contextElement = {
    querySelector: () => ({textContent: context}),
    getAttribute: () => ''
  };
  return {
    tagName: tag,
    id,
    innerText: label,
    textContent: label,
    parentElement: contextElement,
    closest: () => contextElement,
    getAttribute: name => name === 'aria-label' ? '' : name === 'title' ? '' : null
  };
}

test('button and link descriptors distinguish repeated labels and validate target keys', () => {
  const elements = [
    fakeElement({id: 'save', label: 'Kaydet'}),
    fakeElement({id: 'save', label: 'Kaydet'}),
    fakeElement({tag: 'A', id: 'help', label: 'Yardım'})
  ];
  const result = SiteMediaTargets.descriptors({querySelectorAll: () => elements});
  assert.equal(result.length, 3);
  assert.notEqual(result[0].key, result[1].key);
  assert.equal(SiteMediaTargets.validTargetKey(result[0].key), true);
  assert.equal(SiteMediaTargets.validTargetKey('<script>'), false);
  assert.equal(SiteMediaTargets.validTargetKey(JSON.stringify(['div', '', 'Geçersiz', '', 0])), false);
});

function mediaElement(tagName) {
  return {
    tagName,
    dataset: {},
    attributes: {},
    children: [],
    addEventListener(type, callback) { this.listeners = {...this.listeners, [type]: callback}; },
    append(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
    remove() { this.removed = true; }
  };
}

async function runMediaLoader(placement) {
  const targetElement = {
    insertAdjacentElement(position, element) {
      this.inserted = {position, element};
    }
  };
  const target = {key: JSON.stringify(['button', 'submit', 'Gönder', 'Test', 0]), element: targetElement};
  const errors = [];
  const motion = {matches: false, addEventListener(type, callback) { this.change = callback; }};
  const animation = {events: {}, addEventListener(type, callback) { this.events[type] = callback; }, pause() {}, play() {}};
  let lottieOptions;
  const created = [];
  const document = {
    head: {append() {}},
    createElement(tagName) {
      const element = mediaElement(tagName);
      created.push(element);
      return element;
    }
  };
  const window = {
    location: {pathname: '/index.html', search: ''},
    SiteMediaTargets: {
      normalizePagePath: () => '/index.html',
      entries: () => [target],
      validTargetKey: value => value === target.key
    },
    matchMedia: () => motion,
    lottie: {loadAnimation(options) { lottieOptions = options; return animation; }}
  };
  const source = fs.readFileSync(path.join(root, 'assets', 'site-media.js'), 'utf8');
  vm.runInNewContext(source, {
    window, document, URLSearchParams, console: {error: (...args) => errors.push(args)},
    fetch: async () => ({ok: true, json: async () => ({placements: placement ? [placement] : []})})
  });
  await new Promise(resolve => setImmediate(resolve));
  return {target, created, errors, motion, animation, lottieOptions};
}

test('shared loader inserts an image immediately after its selected button', async () => {
  const targetKey = JSON.stringify(['button', 'submit', 'Gönder', 'Test', 0]);
  const result = await runMediaLoader({
    targetKey, assetType: 'image', url: '/uploads/site-media/123.png'
  });
  assert.equal(result.target.element.inserted.position, 'afterend');
  const wrapper = result.target.element.inserted.element;
  assert.equal(wrapper.className, 'site-media-placement');
  assert.equal(wrapper.children[0].src, '/uploads/site-media/123.png');
  assert.equal(wrapper.children[0].alt, 'Sayfa görseli');
  assert.equal(result.errors.length, 0);
});

test('shared loader starts Lottie media with reduced-motion support', async () => {
  const targetKey = JSON.stringify(['button', 'submit', 'Gönder', 'Test', 0]);
  const result = await runMediaLoader({
    targetKey, assetType: 'animation', url: '/uploads/site-media/123.json'
  });
  assert.equal(result.lottieOptions.path, '/uploads/site-media/123.json');
  assert.equal(result.lottieOptions.autoplay, true);
  assert.equal(result.target.element.inserted.position, 'afterend');
  assert.equal(result.errors.length, 0);
});

