const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { questionCount, themeCount, skillsOf, validateCounts } = require('../assets/curriculum-tree-view');

test('sayılar yalnızca açık ve geçerli veri varsa gösterilir', () => {
  assert.equal(questionCount({}), null);
  assert.equal(questionCount({content_count: 0}), 0);
  assert.equal(questionCount({content_count: 14}), 14);
  for (const value of [-1, 1.5, '0', null]) assert.equal(questionCount({content_count: value}), null);
  assert.equal(themeCount({content_count: 14, children: []}), 14);
  assert.throws(() => validateCounts([{node_type: 'TEMA_UNITE', children: []}]), /geçersiz soru sayısı/);
  assert.doesNotThrow(() => validateCounts([{node_type: 'TEMA_UNITE', content_count: 0, children: []}]));
});

test('alt beceriler çocuk düğümler ve metadata üzerinden alınır', () => {
  const outcome = {children: [
    {node_type: 'ALT_BECERI', title: 'Örnek', metadata: {beceriler: ['Problem Çözme', 'Eleştirel Düşünme']}},
    {node_type: 'ALT_BECERI', title: 'Problem Çözme', metadata: {}},
    {node_type: 'ALT_BECERI', title: 'İletişim'},
    {node_type: 'KAZANIM_CIKTI', title: 'Hariç'}
  ]};
  assert.deepEqual(skillsOf(outcome), ['Problem Çözme', 'Eleştirel Düşünme', 'İletişim']);
  assert.deepEqual(skillsOf({}), []);
});

test('öğretmen paneli yeni bileşeni ve oturum yaşam döngüsünü bağlar', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ogretmen-paneli.html'), 'utf8');
  assert.match(html, /href="#maarif-tree"/);
  assert.match(html, /id="curriculumTreeView"/);
  assert.match(html, /assets\/curriculum-tree-view\.css/);
  assert.match(html, /assets\/curriculum-tree-view\.js/);
  assert.match(html, /curriculum-tree:open/);
  assert.match(html, /curriculum-tree:close/);
});

test('müfredat ağacı Express API üzerinden yüklenir ve ödev sepeti drag-drop olaylarını dinler', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'curriculum-tree-view.js'), 'utf8');
  assert.match(source, /fetch\('\/api\/v1\/curriculum\/tree', \{credentials: 'same-origin'\}\)/);
  assert.match(source, /button\.draggable = true/);
  assert.match(source, /addEventListener\('dragstart'/);
  assert.match(source, /application\/x-zarif-curriculum/);
  assert.match(source, /addEventListener\('dragover'/);
  assert.match(source, /addEventListener\('drop'/);
  assert.match(source, /fetch\('\/api\/v1\/assignments\/classes'/);
  assert.match(source, /fetch\('\/api\/v1\/assignments'/);
});
