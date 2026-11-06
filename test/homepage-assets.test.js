const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>\s*(\(async function loadHomepageAssets\(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
assert.ok(script, 'Homepage media loader must exist');

function createElement() {
  const listeners = {};
  return {
    hidden: true,
    src: '',
    listeners,
    addEventListener(type, handler) { listeners[type] = handler; }
  };
}

async function loadAssets(assets, options = {}) {
  const hero = createElement();
  const feature = createElement();
  feature.hidden = false;
  feature.src = 'assets/brand-mark.png';
  const container = createElement();
  const classes = new Set();
  hero.closest = () => ({ classList: { add: value => classes.add(value) } });
  const elements = {
    'homepage-hero-image': hero,
    'homepage-feature-image': feature,
    'lottie-oyun-alani': container
  };
  const motion = {
    matches: !!options.reducedMotion,
    addEventListener(type, handler) { this[type] = handler; }
  };
  const animation = {
    events: {}, paused: 0, played: 0,
    addEventListener(type, handler) { this.events[type] = handler; },
    pause() { this.paused++; },
    play() { this.played++; }
  };
  let lottieOptions;
  const errors = [];
  await vm.runInNewContext(script[1], {
    document: { getElementById: id => elements[id] },
    window: {
      matchMedia: () => motion,
      lottie: { loadAnimation: value => { lottieOptions = value; return animation; } }
    },
    fetch: async () => {
      if (options.fetchError) throw new Error('offline');
      return { ok: true, json: async () => ({ homepageAssets: assets }) };
    },
    console: { error: (...args) => errors.push(args) }
  });
  return { hero, feature, container, classes, motion, animation, lottieOptions, errors };
}

test('homepage retains local fallback and original hero when assets are absent or API fails', async () => {
  assert.match(html, /id="homepage-feature-image"[^>]*src="assets\/brand-mark\.png"/);
  for (const options of [{}, { fetchError: true }]) {
    const result = await loadAssets(null, options);
    assert.equal(result.hero.hidden, true);
    assert.equal(result.feature.src, 'assets/brand-mark.png');
    assert.equal(result.container.hidden, true);
    assert.equal(result.lottieOptions, undefined);
    assert.equal(result.errors.length, options.fetchError ? 1 : 0);
  }
});

test('homepage uses matching uploads and restores fallback when an image fails', async () => {
  const result = await loadAssets({
    heroImage: '/uploads/homepage/123.png',
    featureImage: '/uploads/homepage/456.webp',
    animation: '/uploads/homepage/789.json'
  });
  assert.equal(result.hero.src, '/uploads/homepage/123.png');
  assert.equal(result.feature.src, '/uploads/homepage/456.webp');
  assert.equal(result.lottieOptions.path, '/uploads/homepage/789.json');
  assert.equal(result.lottieOptions.autoplay, true);
  result.hero.listeners.load();
  assert.equal(result.hero.hidden, false);
  assert.equal(result.classes.has('has-custom-image'), true);
  result.feature.listeners.error();
  assert.equal(result.feature.src, 'assets/brand-mark.png');
  result.animation.events.DOMLoaded();
  assert.equal(result.container.hidden, false);
});

test('homepage rejects wrong media extensions and responds to motion preference changes', async () => {
  const invalid = await loadAssets({
    heroImage: '/uploads/homepage/123.json',
    featureImage: '/uploads/homepage/456.json',
    animation: '/uploads/homepage/789.png'
  });
  assert.equal(invalid.hero.src, '');
  assert.equal(invalid.feature.src, 'assets/brand-mark.png');
  assert.equal(invalid.lottieOptions, undefined);

  const result = await loadAssets({ animation: '/uploads/homepage/789.json' }, { reducedMotion: true });
  assert.equal(result.lottieOptions.autoplay, false);
  result.motion.change({ matches: false });
  result.motion.change({ matches: true });
  assert.equal(result.animation.played, 1);
  assert.equal(result.animation.paused, 1);
  result.animation.events.data_failed();
  assert.equal(result.container.hidden, true);
  assert.equal(result.errors.length, 1);
});
