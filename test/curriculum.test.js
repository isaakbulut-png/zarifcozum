const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createCurriculumService } = require('../lib/curriculumService');
const { createCurriculumRouter } = require('../routes/curriculum');

async function listen(app, t) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('müfredat ağ geçidi rol kontrolü, iletimi ve servis hatalarını uygular', async t => {
  const upstream = express();
  upstream.use(express.json());
  const requests = [];
  upstream.use((req, res, next) => {
    requests.push({ path: req.path, auth: req.get('authorization'), query: req.query, body: req.body });
    next();
  });
  upstream.get('/api/v1/curriculum/tree', (req, res) => {
    if (req.query.parent_id === 'invalid') return res.status(422).json({ detail: 'invalid id' });
    if (req.query.parent_id === 'upstream-error') return res.status(500).json({ detail: 'secret' });
    return res.json([{ id: req.query.parent_id || 'root', content_count: 14, children: [{ content_count: 0 }] }]);
  });
  upstream.post('/api/v1/curriculum/nodes', (req, res) => res.status(201).json(req.body));
  const upstreamUrl = await listen(upstream, t);
  const token = 'a'.repeat(32);
  const service = createCurriculumService({ baseURL: upstreamUrl, token });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/curriculum', createCurriculumRouter({
    requireStaff: (req, res, next) => req.get('x-role') === 'teacher' ? next() : res.sendStatus(403),
    service
  }));
  const base = `${await listen(app, t)}/api/v1/curriculum`;
  assert.equal((await fetch(`${base}/tree`)).status, 403);
  assert.equal(requests.length, 0);
  const headers = { 'x-role': 'teacher', 'content-type': 'application/json' };
  const parentId = '507f1f77bcf86cd799439011';
  const tree = await fetch(`${base}/tree?parent_id=${parentId}`, { headers });
  assert.deepEqual(await tree.json(), [{ id: parentId, content_count: 14, children: [{ content_count: 0 }] }]);
  assert.equal(requests[0].auth, `Bearer ${token}`);
  assert.equal(requests[0].query.parent_id, parentId);
  const node = { parent_id: parentId, node_type: 'SINIF', title: '9', code: 'L.9' };
  const created = await fetch(`${base}/nodes`, { method: 'POST', headers, body: JSON.stringify(node) });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), node);
  const invalid = await fetch(`${base}/tree?parent_id=invalid`, { headers });
  assert.equal(invalid.status, 422);
  assert.deepEqual(await invalid.json(), { detail: 'invalid id' });
  const failed = await fetch(`${base}/tree?parent_id=upstream-error`, { headers });
  assert.equal(failed.status, 502);
  assert.doesNotMatch(JSON.stringify(await failed.json()), /secret/);
});

test('ana müfredat ağacının başarılı yanıtını kısa süre önbelleğe alır ve eşzamanlı istekleri birleştirir', async t => {
  let requests = 0;
  const tree = [{ id: 'root', children: [] }];
  const app = express();
  app.use('/api/v1/curriculum', createCurriculumRouter({
    requireStaff: (_req, _res, next) => next(),
    service: {
      getTree: async () => {
        requests++;
        await new Promise(resolve => setTimeout(resolve, 30));
        return { status: 200, data: tree };
      }
    }
  }));
  const base = `${await listen(app, t)}/api/v1/curriculum/tree`;

  const [first, concurrent] = await Promise.all([fetch(base), fetch(base)]);
  assert.deepEqual(await first.json(), tree);
  assert.deepEqual(await concurrent.json(), tree);
  assert.deepEqual(await (await fetch(base)).json(), tree);
  assert.equal(requests, 1);
});

test('429 yanıtı iletilir ancak başarılı ağaç önbelleğine alınmaz', async t => {
  let requests = 0;
  const app = express();
  app.use('/api/v1/curriculum', createCurriculumRouter({
    requireStaff: (_req, _res, next) => next(),
    service: {
      getTree: async () => {
        requests++;
        return requests === 1
          ? { status: 429, data: { mesaj: 'Daha sonra tekrar deneyin.' } }
          : { status: 200, data: [] };
      }
    }
  }));
  const base = `${await listen(app, t)}/api/v1/curriculum/tree`;

  const limited = await fetch(base);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { mesaj: 'Daha sonra tekrar deneyin.' });
  assert.deepEqual(await (await fetch(base)).json(), []);
  assert.equal(requests, 2);
});

test('servis anahtarı eksikse istek gönderilmez', async () => {
  const service = createCurriculumService({ token: '' });
  await assert.rejects(service.getTree(), { code: 'CURRICULUM_NOT_CONFIGURED' });
});

test('production ortamında müfredat servisi URLsi zorunlu ve localhost olamaz', async () => {
  const token = 'a'.repeat(32);
  const missingUrl = createCurriculumService({
    token,
    environment: { NODE_ENV: 'production' }
  });
  await assert.rejects(missingUrl.getTree(), { code: 'CURRICULUM_SERVICE_URL_NOT_CONFIGURED' });

  const loopbackUrl = createCurriculumService({
    baseURL: 'http://127.0.0.1:8000',
    token,
    environment: { NODE_ENV: 'production' }
  });
  await assert.rejects(loopbackUrl.getTree(), { code: 'CURRICULUM_SERVICE_URL_LOOPBACK' });

  const localhostUrl = createCurriculumService({
    baseURL: 'http://localhost.:8000',
    token,
    environment: { NODE_ENV: 'production' }
  });
  await assert.rejects(localhostUrl.getTree(), { code: 'CURRICULUM_SERVICE_URL_LOOPBACK' });
});

test('müfredat rotası bağlantı hatasında dahili adres veya kimlik bilgisi sızdırmadan 503 döndürür', async t => {
  const app = express();
  app.use('/api/v1/curriculum', createCurriculumRouter({
    requireStaff: (_req, _res, next) => next(),
    service: {
      getTree: async () => {
        throw Object.assign(new Error('private upstream details'), { code: 'ENOTFOUND' });
      }
    }
  }));
  const response = await fetch(`${await listen(app, t)}/api/v1/curriculum/tree`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    kod: 'CURRICULUM_SERVICE_UNREACHABLE',
    mesaj: 'Python müfredat servisine bağlanılamadı; internal URL ve portu kontrol edin.'
  });
});

test('manuel bağlantı yalnız geçerli düğüme yazılır ve test sahibiyle sınırlandırılır', async t => {
  const nodeId = '507f1f77bcf86cd799439011';
  const questionId = '507f1f77bcf86cd799439012';
  const records = [];
  const db = {collection: name => ({
    findOne: async filter => name === 'curriculum_nodes' && filter._id.toString() === nodeId ? {_id: filter._id} : null,
    updateOne: async (filter, update) => { records.push({name, filter, update}); return {matchedCount: 1}; }
  })};
  const app = express();
  app.use(express.json());
  app.use('/api/v1/curriculum', createCurriculumRouter({
    requireStaff: (req, res, next) => {
      if (req.get('x-role') !== 'teacher') return res.sendStatus(403);
      req.session = {user: {id: 'teacher-1'}};
      next();
    },
    getDb: () => db
  }));
  const base = `${await listen(app, t)}/api/v1/curriculum`;
  const put = (path, body, role = 'teacher') => fetch(base + path, {
    method: 'PUT', headers: {'x-role': role, 'content-type': 'application/json'}, body: JSON.stringify(body)
  });
  assert.equal((await put(`/links/questions/${questionId}`, {curriculum_node_id: nodeId}, 'student')).status, 403);
  assert.equal((await put(`/links/questions/${questionId}`, {curriculum_node_id: 'bad'})).status, 400);
  assert.equal((await put(`/links/questions/${questionId}`, {curriculum_node_id: '507f1f77bcf86cd799439099'})).status, 404);
  assert.equal((await put(`/links/questions/${questionId}`, {curriculum_node_id: nodeId})).status, 200);
  assert.equal(records[0].name, 'sorular');
  assert.equal(records[0].update.$set.curriculum_node_id.toString(), nodeId);
  assert.equal((await put(`/links/quizzes/${questionId}/questions/2`, {curriculum_node_id: nodeId})).status, 200);
  assert.equal(records[1].name, 'quizler');
  assert.equal(records[1].filter.createdBy, 'teacher-1');
  assert.deepEqual(records[1].filter['questions.2'], {$exists: true});
  assert.equal(records[1].update.$set['questions.2.curriculum_node_id'].toString(), nodeId);
  assert.equal((await put(`/links/quizzes/${questionId}/questions/2`, {curriculum_node_id: null})).status, 200);
  assert.deepEqual(records[2].update, {$unset: {'questions.2.curriculum_node_id': ''}});
  assert.equal((await put(`/links/quizzes/${questionId}/questions/50`, {curriculum_node_id: nodeId})).status, 400);
});
