const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { ObjectId } = require('mongodb');
const { buildCurriculumTreeFromMongo } = require('../lib/curriculumMongoTree');
const { createCurriculumRouter } = require('../routes/curriculum');
const { validateCounts } = require('../assets/curriculum-tree-view');

test('buildCurriculumTreeFromMongo doğru hiyerarşi oluşturur ve soru sayılarını temaya toplar', async () => {
  const kademeId = new ObjectId();
  const sinifId = new ObjectId();
  const temaId = new ObjectId();
  const kazanimId = new ObjectId();
  const beceriId = new ObjectId();

  const mockDocs = [
    { _id: kademeId, parent_id: null, node_type: 'KADEME', title: 'Lise', code: 'LISE', order_index: 1, is_active: true },
    { _id: sinifId, parent_id: kademeId, node_type: 'SINIF', title: '9. Sınıf', code: 'SINIF.9', order_index: 9, is_active: true },
    { _id: temaId, parent_id: sinifId, node_type: 'TEMA_UNITE', title: 'Sayılar', code: 'TEMA.1', order_index: 1, is_active: true },
    { _id: kazanimId, parent_id: temaId, node_type: 'KAZANIM_CIKTI', title: 'Üslü Sayılar', code: 'MAT.9.1.1', order_index: 1, is_active: true },
    { _id: beceriId, parent_id: kazanimId, node_type: 'ALT_BECERI', title: 'Problem Çözme', code: 'BECERI.1', order_index: 1, is_active: true }
  ];

  const mockDb = {
    collection: name => ({
      find: () => ({ toArray: async () => mockDocs }),
      aggregate: () => ({
        toArray: async () => name === 'sorular'
          ? [{ _id: kazanimId, count: 5 }]
          : [{ _id: kazanimId, count: 2 }]
      })
    })
  };

  const tree = await buildCurriculumTreeFromMongo(mockDb);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].node_type, 'KADEME');
  assert.equal(tree[0].children[0].node_type, 'SINIF');
  assert.equal(tree[0].children[0].children[0].node_type, 'TEMA_UNITE');

  const themeNode = tree[0].children[0].children[0];
  const outcomeNode = themeNode.children[0];

  assert.equal(outcomeNode.content_count, 7); // 5 soru + 2 quiz
  assert.equal(themeNode.content_count, 7); // temaya toplanmış olmalı

  assert.doesNotThrow(() => validateCounts(tree));
});

test('curriculum rotası mikroservis kapalıyken getDb varsa MongoDB fallback ile 200 döner', async t => {
  const kademeId = new ObjectId();
  const mockDocs = [
    { _id: kademeId, parent_id: null, node_type: 'KADEME', title: 'Ortaokul', code: 'ORTAOKUL', order_index: 1, is_active: true }
  ];

  const mockDb = {
    collection: () => ({
      find: () => ({ toArray: async () => mockDocs }),
      aggregate: () => ({ toArray: async () => [] })
    })
  };

  const failingService = {
    getTree: async () => {
      const err = new Error('CURRICULUM_SERVICE_TOKEN must contain at least 32 characters');
      err.code = 'CURRICULUM_NOT_CONFIGURED';
      throw err;
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/api/v1/curriculum', createCurriculumRouter({
    requireStaff: (req, res, next) => next(),
    service: failingService,
    getDb: () => mockDb
  }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/curriculum/tree`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.length, 1);
  assert.equal(data[0].code, 'ORTAOKUL');
});
