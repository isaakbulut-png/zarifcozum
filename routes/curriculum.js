const express = require('express');
const { createCurriculumService } = require('../lib/curriculumService');
const { buildCurriculumTreeFromMongo, buildCurriculumTreeFromJson } = require('../lib/curriculumMongoTree');
const { ObjectId } = require('mongodb');

const TREE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika önbellek

function createCurriculumRouter({ requireStaff, service = createCurriculumService(), getDb }) {
  const router = express.Router();
  router.use(requireStaff);
  let cachedTree = null;
  let cachedTreeExpiresAt = 0;
  let treeRequest = null;

  async function getRootTree() {
    if (cachedTree && Date.now() < cachedTreeExpiresAt) return cachedTree;
    if (!treeRequest) {
      treeRequest = (async () => {
        // 1. Birincil ve en güvenilir kaynak: Yerel MongoDB veritabanı (soru sayıları dahil, sıfır gecikme, 429 hatası oluşturmaz)
        if (typeof getDb === 'function') {
          try {
            const db = getDb();
            if (db) {
              const data = await buildCurriculumTreeFromMongo(db, null);
              if (Array.isArray(data) && data.length > 0) {
                const response = { status: 200, data };
                cachedTree = response;
                cachedTreeExpiresAt = Date.now() + TREE_CACHE_TTL_MS;
                return response;
              }
            }
          } catch (dbErr) {
            console.warn('[Curriculum] MongoDB ağaç derleme uyarısı:', dbErr.message);
          }
        }

        // 2. Harici servis tanımlıysa kontrol et (yalnızca 2xx geçerli yanıtları kabul et)
        try {
          const response = await service.getTree();
          if (response && response.status >= 200 && response.status < 300 && Array.isArray(response.data) && response.data.length > 0) {
            cachedTree = response;
            cachedTreeExpiresAt = Date.now() + TREE_CACHE_TTL_MS;
            return response;
          }
          if (response?.status === 429) {
            console.warn('[Curriculum] Harici servis 429 (Hız sınırı) döndürdü, yerel MEB müfredat yedeğine geçiliyor.');
          }
        } catch (serviceErr) {
          console.warn('[Curriculum] Harici servis bağlantı uyarısı:', serviceErr.code || serviceErr.message);
        }

        // 3. Kesintisiz garanti yedeği: lib/meb-curriculum-tree.json (Tek Doğruluk Kaynağı)
        const fallbackData = buildCurriculumTreeFromJson(null);
        const fallbackResponse = { status: 200, data: fallbackData };
        cachedTree = fallbackResponse;
        cachedTreeExpiresAt = Date.now() + TREE_CACHE_TTL_MS;
        return fallbackResponse;
      })().finally(() => {
        treeRequest = null;
      });
    }
    return treeRequest;
  }

  async function getTreeWithFallback(parentId) {
    if (parentId === undefined || parentId === null) {
      return getRootTree();
    }
    if (typeof getDb === 'function') {
      try {
        const db = getDb();
        if (db) {
          const data = await buildCurriculumTreeFromMongo(db, parentId);
          if (Array.isArray(data) && data.length > 0) {
            return { status: 200, data };
          }
        }
      } catch (_) {}
    }
    try {
      const response = await service.getTree(parentId);
      if (response && response.status >= 200 && response.status < 300 && response.data) {
        return response;
      }
    } catch (_) {}
    return { status: 200, data: buildCurriculumTreeFromJson(parentId) };
  }

  async function forward(res, operation) {
    try {
      const response = await operation();
      if (!response || response.status < 200 || response.status >= 300) {
        if (response?.status === 401 || response?.status === 403) {
          return res.status(response.status).json(response.data || { mesaj: 'Yetkisiz erişim.' });
        }
        console.warn('Müfredat servisi 2xx döndürmedi (durum: ' + response?.status + '), yerel ağaç döndürülüyor.');
        const fallback = buildCurriculumTreeFromJson(null);
        return res.status(200).json(fallback);
      }
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.warn('Müfredat servisi hatası, yerel ağaç döndürülüyor:', error.message);
      const fallback = buildCurriculumTreeFromJson(null);
      return res.status(200).json(fallback);
    }
  }

  router.get('/tree', (req, res) => forward(res, () => getTreeWithFallback(req.query.parent_id)));
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
