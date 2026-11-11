const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'assets', 'ogretmen-canli.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'ogretmen-paneli.html'), 'utf8');

test('the teacher sidebar contains the active lesson controls', () => {
  const sidebar = html.match(/<aside class="teacher-sidebar"[\s\S]*?<\/aside>/);
  assert.ok(sidebar);
  assert.match(sidebar[0], /id="sidebarAktifCanliIslemler" hidden/);
  assert.match(sidebar[0], /id="sidebarCanliSonlandir"[^>]*>Dersi sonlandır<\/button>/);
  assert.match(sidebar[0], /data-open-live> Dersi Zoom'da aç<\/button>/);
});

function setup(api, onSonlandir = async () => {}) {
  const window = { confirm: () => true };
  vm.runInNewContext(script, { window });
  const bilgi = { textContent: '' };
  const islemler = { hidden: true };
  const hata = { textContent: '' };
  const sonlandir = {
    disabled: false,
    addEventListener(event, callback) { this.click = callback; }
  };
  const sidebar = {
    bilgi: { textContent: '' }, islemler: { hidden: true }, hata: { textContent: '' },
    sonlandir: { disabled: false, addEventListener(event, callback) { this.click = callback; } }
  };
  const yonetim = window.ogretmenCanliYonetimi({
    api, gorunumler: [{ bilgi, islemler, hata, sonlandir }, sidebar], onSonlandir
  });
  return { window, bilgi, islemler, hata, sonlandir, sidebar, yonetim };
}

test('active lesson is displayed and can be ended from the teacher panel', async () => {
  const calls = [];
  let refreshed = false;
  const state = setup(async (url, options) => {
    calls.push({ url, method: options?.method });
    return url.endsWith('/ozet')
      ? { aktif: true, topic: 'Matematik', meetingNumber: '123' }
      : { mesaj: 'Canlı ders sonlandırıldı.' };
  }, async () => { refreshed = true; });
  await state.yonetim.yenile();
  assert.equal(state.islemler.hidden, false);
  assert.match(state.bilgi.textContent, /Matematik.*123/);
  assert.equal(state.sidebar.islemler.hidden, false);
  assert.match(state.sidebar.bilgi.textContent, /Matematik.*123/);
  await state.sidebar.sonlandir.click();
  assert.equal(calls[1].url, '/api/ogretmen/canli/sonlandir');
  assert.equal(calls[1].method, 'POST');
  assert.equal(state.islemler.hidden, true);
  assert.equal(state.sidebar.islemler.hidden, true);
  assert.equal(state.sonlandir.disabled, false);
  assert.equal(refreshed, true);
});

test('cancellation and API failures preserve the active lesson controls', async () => {
  let calls = 0;
  const state = setup(async url => {
    calls++;
    if (url.endsWith('/ozet')) return { aktif: true, topic: 'Ders', meetingNumber: '123' };
    throw new Error('Zoom hatası');
  });
  await state.yonetim.yenile();
  state.window.confirm = () => false;
  await state.sonlandir.click();
  assert.equal(calls, 1);
  state.window.confirm = () => true;
  await state.sonlandir.click();
  assert.equal(state.islemler.hidden, false);
  assert.equal(state.sonlandir.disabled, false);
  assert.match(state.hata.textContent, /Zoom hatası/);
  assert.match(state.sidebar.hata.textContent, /Zoom hatası/);
});

test('Zoom 404 sonrasında açık onayla aynı dersin site kaydı temizlenir', async () => {
  const calls = [];
  const state = setup(async (url, options) => {
    calls.push({url, options});
    if (calls.length === 1) {
      throw Object.assign(new Error('Zoom toplantısı bulunamadı'), {
        data: {kod: 'ZOOM_MEETING_NOT_FOUND', meetingId: '123'}
      });
    }
    return {mesaj: 'Sitedeki aktif ders kaydı sonlandırıldı.'};
  });
  await state.sonlandir.click();
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    zoomdaBittiginiOnayliyorum: true, meetingId: '123'
  });
  assert.equal(state.islemler.hidden, true);
  assert.match(state.bilgi.textContent, /Sitedeki aktif ders kaydı/);
});

test('Zoom 404 sonrası onay iptal edilirse kayıt temizleme isteği gönderilmez', async () => {
  let calls = 0;
  let confirmations = 0;
  const state = setup(async () => {
    calls++;
    throw Object.assign(new Error('Zoom toplantısı bulunamadı'), {
      data: {kod: 'ZOOM_MEETING_NOT_FOUND', meetingId: '123'}
    });
  });
  state.islemler.hidden = false;
  state.window.confirm = () => ++confirmations === 1;
  await state.sonlandir.click();
  assert.equal(calls, 1);
  assert.equal(state.islemler.hidden, false);
  assert.match(state.hata.textContent, /korunuyor/);
});

test('summary failure is shown and empty summary hides controls', async () => {
  let fail = true;
  const state = setup(async () => {
    if (fail) throw new Error('Bağlantı hatası');
    return { aktif: false };
  });
  await state.yonetim.yenile();
  assert.match(state.hata.textContent, /Bağlantı hatası/);
  fail = false;
  await state.yonetim.yenile();
  assert.equal(state.islemler.hidden, true);
  assert.equal(state.hata.textContent, '');
  assert.match(state.bilgi.textContent, /aktif canlı ders yok/);
});

test('a summary requested during termination cannot restore stale controls', async () => {
  let resolveEnd;
  let resolveSummary;
  const state = setup(url => {
    if (url.endsWith('/sonlandir')) return new Promise(resolve => { resolveEnd = resolve; });
    return new Promise(resolve => { resolveSummary = resolve; });
  });
  const ending = state.sonlandir.click();
  const refreshing = state.yonetim.yenile();
  resolveEnd({mesaj: 'Canlı ders sonlandırıldı.'});
  await ending;
  resolveSummary({ aktif: true, topic: 'Eski ders', meetingNumber: '123' });
  await refreshing;
  assert.equal(state.islemler.hidden, true);
  assert.equal(state.bilgi.textContent, 'Canlı ders sonlandırıldı.');
});

function audienceSetup(loadStudents = async () => ({
  students: [{id: 'student-1', name: 'Öğrenci', grade: 6, section: 'A', active: true, linked: true}]
})) {
  const section = html.slice(html.indexOf('  let canliOgrencileri = []'), html.indexOf('  const bugun = new Date();'));
  const elements = {};
  const calls = [];
  function element(id) {
    if (elements[id]) return elements[id];
    const handlers = {};
    return elements[id] = {
      id, handlers, value: '', options: [], textContent: '', disabled: false, hidden: false, open: false,
      get selectedOptions() { return this.options.filter(option => option.selected); },
      addEventListener(event, callback) { handlers[event] = callback; },
      click() { return handlers.click({currentTarget: this}); },
      replaceChildren(...options) { this.options = options; },
      appendChild(child) { child.parentElement = this; },
      focus() {}, removeAttribute() {},
      showModal() { this.open = true; },
      close() { this.open = false; }
    };
  }
  const window = {
    teacherPanelNavigation: {open: id => calls.push({navigation: id})},
    open: () => ({location: {replace: url => calls.push({zoom: url})}, close() {}})
  };
  const api = async (url, options) => {
    if (url.endsWith('/ogrenciler')) return loadStudents();
    calls.push({url, body: JSON.parse(options.body)});
    return {startUrl: 'https://zoom.example/start'};
  };
  function Option(text, value) { this.text = text; this.value = String(value); this.selected = false; }
  element('liveTargetMode').value = 'class';
  vm.runInNewContext(section, {
    $: element, api, Option, window, document: {addEventListener() {}},
    canliYonetim: {yenile() {}}
  });
  return {element, calls};
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('her iki anlık başlatma düğmesi seçim penceresini açar; geçersiz seçim istek göndermez', async () => {
  for (const button of ['sidebarQuickLive', 'canliBaslat']) {
    const page = audienceSetup();
    page.element(button).click();
    await settle();
    assert.equal(page.element('liveAudienceDialog').open, true);
    assert.equal(page.element('liveAudienceControls').parentElement.id, 'liveAudienceDialogContent');
    page.element('confirmLiveAudience').click();
    assert.match(page.element('liveAudienceStatus').textContent, /Sınıf/);
    assert.equal(page.calls.length, 0);
  }
});

test('iptal önceki seçimi korur ve bekleyen öğrenci listesi sonucu seçimi bozmaz', async () => {
  let resolveStudents;
  const page = audienceSetup(() => new Promise(resolve => { resolveStudents = resolve; }));
  page.element('liveGrade').value = '6';
  page.element('liveTargetMode').value = 'class';
  page.element('sidebarQuickLive').click();
  page.element('liveGrade').value = '7';
  page.element('cancelLiveAudience').click();
  resolveStudents({students: [{id: 'student-2', grade: 7, active: true}]});
  await settle();
  assert.equal(page.element('liveGrade').value, '6');
  assert.equal(page.element('liveAudienceControls').parentElement.id, 'liveAudienceHome');
  assert.equal(page.element('liveAudienceDialog').open, false);
  assert.equal(page.calls.length, 0);
});

test('onaylanan öğrenci hedefi gönderilir ve Zoom açılır', async () => {
  const page = audienceSetup();
  page.element('canliBaslat').click();
  await settle();
  page.element('liveGrade').value = '6';
  page.element('liveGrade').handlers.change();
  page.element('liveSection').value = 'A';
  page.element('liveSection').handlers.change();
  page.element('liveTargetMode').value = 'students';
  page.element('liveTargetMode').handlers.change();
  page.element('liveStudents').options[0].selected = true;
  page.element('confirmLiveAudience').click();
  await settle();
  const request = page.calls.find(call => call.url);
  assert.deepEqual(JSON.parse(JSON.stringify(request.body.audience)), {
    grade: 6, section: 'A', mode: 'students', studentIds: ['student-1']
  });
  assert.ok(page.calls.some(call => call.zoom === 'https://zoom.example/start'));
  assert.equal(page.element('liveAudienceControls').parentElement.id, 'liveAudienceHome');
});
