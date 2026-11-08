const express = require('express');
const { createCurriculumService } = require('../lib/curriculumService');
const { ObjectId } = require('mongodb');

function createCurriculumRouter({ requireStaff, service = createCurriculumService(), getDb }) {
  const router = express.Router();
  router.use(requireStaff);

  async function forward(res, operation) {
    try {
      const response = await operation();
      if (response.status < 200 || response.status >= 500 ||
          (response.status >= 300 && response.status < 400) || response.status === 401) {
        console.error('Müfredat servisi beklenmeyen durum döndürdü:', response.status);
        return res.status(502).json({ mesaj: 'Müfredat servisi yanıt veremedi.' });
      }
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('Müfredat servisine erişilemedi:', error.code || error.message);
      const configurationMessages = {
        CURRICULUM_NOT_CONFIGURED: 'CURRICULUM_SERVICE_TOKEN ayarı eksik veya geçersiz.',
        CURRICULUM_SERVICE_URL_NOT_CONFIGURED: 'Production ortamında CURRICULUM_SERVICE_URL ayarlanmalıdır.',
        CURRICULUM_SERVICE_URL_INVALID: 'CURRICULUM_SERVICE_URL geçerli bir HTTP(S) adresi olmalıdır.',
        CURRICULUM_SERVICE_URL_LOOPBACK: 'Production CURRICULUM_SERVICE_URL localhost adresi olamaz.'
      };
      if (configurationMessages[error.code]) {
        return res.status(503).json({
          kod: error.code,
          mesaj: configurationMessages[error.code]
        });
      }
      if (['ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND',
        'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(error.code)) {
        return res.status(503).json({
          kod: 'CURRICULUM_SERVICE_UNREACHABLE',
          mesaj: 'Python müfredat servisine bağlanılamadı; internal URL ve portu kontrol edin.'
        });
      }
      return res.status(503).json({
        kod: 'CURRICULUM_SERVICE_FAILURE',
        mesaj: 'Müfredat servisine erişilemiyor.'
      });
    }
  }

  router.get('/tree', (req, res) => forward(res, () => service.getTree(req.query.parent_id)));
  router.post('/nodes', (req, res) => forward(res, () => service.createNode(req.body)));

  async function link(req, res, kind) {
    const nodeId = req.body?.curriculum_node_id;
    if (!/^[a-f\d]{24}$/i.test(req.params.id) ||
        !(nodeId === null || (typeof nodeId === 'string' && /^[a-f\d]{24}$/i.test(nodeId))) ||
        (kind === 'quiz' && !/^(0|[1-9]\d*)$/.test(req.params.index))) {
      return res.status(400).json({ mesaj: 'Geçersiz soru veya müfredat düğümü.' });
    }
    if (kind === 'quiz' && (!Number.isSafeInteger(Number(req.params.index)) || Number(req.params.index) >= 50)) {
      return res.status(400).json({ mesaj: 'Geçersiz soru sırası.' });
    }
    try {
      const db = getDb();
      const target = nodeId === null ? null : new ObjectId(nodeId);
      if (target && !await db.collection('curriculum_nodes').findOne({
        _id: target, node_type: { $in: ['TEMA_UNITE', 'KAZANIM_CIKTI'] }
      }, { projection: { _id: 1 } })) {
        return res.status(404).json({ mesaj: 'Tema veya kazanım bulunamadı.' });
      }
      const filter = { _id: new ObjectId(req.params.id) };
      let field = 'curriculum_node_id';
      if (kind === 'quiz') {
        const index = Number(req.params.index);
        filter[`questions.${index}`] = { $exists: true };
        if (req.session.user.adminRole !== 'superadmin') filter.createdBy = req.session.user.id;
        field = `questions.${index}.curriculum_node_id`;
      }
      const update = target ? { $set: { [field]: target } } : { $unset: { [field]: '' } };
      const result = await db.collection(kind === 'quiz' ? 'quizler' : 'sorular').updateOne(filter, update);
      if (!result.matchedCount) return res.status(404).json({ mesaj: 'Soru bulunamadı veya yetkiniz yok.' });
      return res.json({ mesaj: target ? 'Müfredat bağlantısı kaydedildi.' : 'Müfredat bağlantısı kaldırıldı.' });
    } catch (error) {
      console.error('Müfredat bağlantısı kaydedilemedi:', error);
      return res.status(500).json({ mesaj: 'Müfredat bağlantısı kaydedilemedi.' });
    }
  }
  router.put('/links/questions/:id', (req, res) => link(req, res, 'question'));
  router.put('/links/quizzes/:id/questions/:index', (req, res) => link(req, res, 'quiz'));
  return router;
}

module.exports = { createCurriculumRouter };
