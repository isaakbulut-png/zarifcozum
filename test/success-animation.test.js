const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>\s*(\(\(\) => \{\s*let animasyon;[\s\S]*?\}\)\(\);)\s*<\/script>/);
assert.ok(script, 'Success animation script must exist');

function setup({ reducedMotion = false, missingLottie = false } = {}) {
  const layer = { style: { display: 'none' } };
  const area = {};
  const errors = [];
  const timers = new Map();
  const animations = [];
  let timerId = 0;
  const window = {
    matchMedia: () => ({ matches: reducedMotion }),
    setTimeout: (callback, delay) => {
      timers.set(++timerId, { callback, delay });
      return timerId;
    },
    clearTimeout: id => timers.delete(id)
  };
  if (!missingLottie) {
    window.lottie = {
      loadAnimation(options) {
        const animation = {
          options, listeners: {}, destroyed: false,
          addEventListener(type, callback) { this.listeners[type] = callback; },
          destroy() { this.destroyed = true; }
        };
        animations.push(animation);
        return animation;
      }
    };
  }
  vm.runInNewContext(script[1], {
    window,
    document: { getElementById: id => id === 'basari-katmani' ? layer : area },
    console: { error: (...args) => errors.push(args) }
  });
  return { window, layer, area, timers, animations, errors };
}

test('success animation plays once and closes 1.5 seconds after completion', () => {
  const state = setup();
  state.window.tebrikAnimasyonunuBaslat();
  const animation = state.animations[0];
  assert.equal(state.layer.style.display, 'flex');
  assert.equal(animation.options.container, state.area);
  assert.equal(animation.options.path, '/assets/animations/success-confetti.json');
  assert.equal(animation.options.loop, false);
  assert.equal(animation.options.autoplay, true);
  assert.equal(state.timers.size, 0);
  animation.listeners.complete();
  const timer = [...state.timers.values()][0];
  assert.equal(timer.delay, 1500);
  timer.callback();
  assert.equal(state.layer.style.display, 'none');
  assert.equal(animation.destroyed, true);
});

test('restarting cancels the previous close and destroys the old animation', () => {
  const state = setup();
  state.window.tebrikAnimasyonunuBaslat();
  state.animations[0].listeners.complete();
  state.window.tebrikAnimasyonunuBaslat();
  assert.equal(state.timers.size, 0);
  assert.equal(state.animations[0].destroyed, true);
  assert.equal(state.layer.style.display, 'flex');
  assert.equal(state.animations.length, 2);
});

test('loading errors and reduced motion still close the layer', () => {
  for (const options of [{}, { missingLottie: true }, { reducedMotion: true }]) {
    const state = setup(options);
    state.window.tebrikAnimasyonunuBaslat();
    if (state.animations.length) state.animations[0].listeners.data_failed();
    const timer = [...state.timers.values()][0];
    assert.equal(timer.delay, 1500);
    timer.callback();
    assert.equal(state.layer.style.display, 'none');
    assert.equal(state.errors.length, options.reducedMotion ? 0 : 1);
  }
});
