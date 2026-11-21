const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function deterministicId(key) {
  const hash = crypto.createHash('sha256').update(`zarif_seed_curriculum_v2:${key}`).digest();
  return new ObjectId(hash.subarray(0, 12));
}

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) {
    return new ObjectId(id);
  }
  return null;
}

function buildCurriculumTreeFromJson(parentId = null) {
  const treePath = path.join(__dirname, 'meb-curriculum-tree.json');
  if (!fs.existsSync(treePath)) return [];
  let tree = {};
  try {
    tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
  } catch (err) {
    console.warn('[CurriculumTree] meb-curriculum-tree.json okuma hatası:', err.message);
    return [];
  }

  const grades = [5, 6, 7, 8, 9, 10, 11, 12];
  const targetParent = parentId ? toObjectId(parentId) : null;
  const parentIdStr = targetParent ? targetParent.toString() : null;

  const kademeOrtaokulId = deterministicId('kademe:ortaokul').toString();
  const kademeLiseId = deterministicId('kademe:lise').toString();

  const byId = new Map();
  const documents = [];

  // Kademe Düğümleri
  documents.push({
    _id: kademeOrtaokulId,
    parent_id: null,
    node_type: 'KADEME',
    title: 'Ortaokul (5-8. Sınıf)',
    code: 'MEB.KADEME.ORTAOKUL',
    order_index: 1,
    is_active: true,
    metadata: { kademe: 'ortaokul' }
  });
  documents.push({
    _id: kademeLiseId,
    parent_id: null,
    node_type: 'KADEME',
    title: 'Ortaöğretim / Lise (9-12. Sınıf)',
    code: 'MEB.KADEME.LISE',
    order_index: 2,
    is_active: true,
    metadata: { kademe: 'lise' }
  });

  // Sınıf Düğümleri
  const sinifIds = {};
  for (const grade of grades) {
    const pId = grade <= 8 ? kademeOrtaokulId : kademeLiseId;
    const sinifId = deterministicId(`sinif:${grade}`).toString();
    sinifIds[grade] = sinifId;
    documents.push({
      _id: sinifId,
      parent_id: pId,
      node_type: 'SINIF',
      title: `${grade}. Sınıf`,
      code: `MEB.SINIF.${grade}`,
      order_index: grade,
      is_active: true,
      metadata: { grade }
    });
  }

  // Tema, Kazanım ve Beceri Düğümleri
  for (const grade of grades) {
    const gradeData = tree[String(grade)] || tree[grade];
    if (!gradeData || !gradeData.temalar) continue;

    let unitIndex = 1;
    for (const [temaTitle, temaObj] of Object.entries(gradeData.temalar)) {
      const temaId = deterministicId(`tema:${grade}:${temaTitle}`).toString();
      documents.push({
        _id: temaId,
        parent_id: sinifIds[grade],
        node_type: 'TEMA_UNITE',
        title: temaTitle,
        code: `MEB.MAT.${grade}.T${unitIndex}`,
        order_index: unitIndex,
        is_active: true,
        metadata: {
          brans: 'Matematik',
          grade,
          unitIndex,
          program: gradeData.program || (grade === 8 || grade === 12 ? '2018 Müfredatı' : 'Türkiye Yüzyılı Maarif Modeli')
        }
      });

      let subIndex = 1;
      const subTopics = temaObj.alt_konular || [];
      for (const sub of subTopics) {
        const kazanimId = deterministicId(`subtopic:${grade}:${temaTitle}:${sub.name}`).toString();
        const outcomeCode = sub.outcome_code || `MAT.${grade}.${unitIndex}.${subIndex}`;
        documents.push({
          _id: kazanimId,
          parent_id: temaId,
          node_type: 'KAZANIM_CIKTI',
          title: sub.name,
          code: outcomeCode,
          order_index: subIndex,
          is_active: true,
          metadata: {
            grade,
            unit: temaTitle,
            sub_topic: sub.name,
            outcome_code: outcomeCode,
            official_boundary: sub.official_boundary || ''
          }
        });

        const beceriId = deterministicId(`beceri:${grade}:${sub.outcome_code || sub.name}`).toString();
        documents.push({
          _id: beceriId,
          parent_id: kazanimId,
          node_type: 'ALT_BECERI',
          title: `${sub.name} - Matematiksel Alan ve Süreç Becerileri`,
          code: `${outcomeCode}.BECERI`,
          order_index: 1,
          is_active: true,
          metadata: {
            official_boundary: sub.official_boundary || '',
            beceriler: [
              'Matematiksel Muhakeme',
              'Problem Çözme',
              'Matematiksel Temsil',
              'İlişkilendirme',
              'İletişim'
            ]
          }
        });
        subIndex++;
      }
      unitIndex++;
    }
  }

  for (const doc of documents) {
    const isCountable = ['TEMA_UNITE', 'KAZANIM_CIKTI'].includes(doc.node_type);
    byId.set(doc._id, {
      id: doc._id,
      parent_id: doc.parent_id,
      node_type: doc.node_type,
      title: doc.title || '',
      code: doc.code || '',
      order_index: typeof doc.order_index === 'number' ? doc.order_index : 0,
      is_active: true,
      metadata: doc.metadata || {},
      content_count: isCountable ? 0 : null,
      children: []
    });
  }

  const roots = [];
  for (const doc of documents) {
    const node = byId.get(doc._id);
    const docParentStr = doc.parent_id;

    if (parentIdStr) {
      if (doc._id === parentIdStr) {
        roots.push(node);
      } else if (docParentStr && byId.has(docParentStr)) {
        byId.get(docParentStr).children.push(node);
      }
    } else {
      if (!docParentStr) {
        roots.push(node);
      } else if (byId.has(docParentStr)) {
        byId.get(docParentStr).children.push(node);
      }
    }
  }

  return roots;
}

async function buildCurriculumTreeFromMongo(db, parentId = null) {
  if (!db) return buildCurriculumTreeFromJson(parentId);
  try {
    const collection = db.collection('curriculum_nodes');
    const documents = await collection.find({ is_active: true }).toArray();
    if (!documents || !documents.length) return buildCurriculumTreeFromJson(parentId);

    const targetParent = parentId ? toObjectId(parentId) : null;
    const parentIdStr = targetParent ? targetParent.toString() : null;

    // Question counts
    const countableIds = documents
      .filter(doc => ['TEMA_UNITE', 'KAZANIM_CIKTI'].includes(doc.node_type))
      .map(doc => doc._id);

    const counts = new Map();
    countableIds.forEach(id => counts.set(id.toString(), 0));

    if (countableIds.length) {
      try {
        const soruCounts = await db.collection('sorular').aggregate([
          { $match: { curriculum_node_id: { $in: countableIds } } },
          { $group: { _id: '$curriculum_node_id', count: { $sum: 1 } } }
        ]).toArray();
        for (const r of soruCounts) {
          if (r._id) {
            counts.set(r._id.toString(), (counts.get(r._id.toString()) || 0) + (r.count || 0));
          }
        }
      } catch (_) {}

      try {
        const quizCounts = await db.collection('quizler').aggregate([
          { $match: { 'questions.curriculum_node_id': { $in: countableIds }, source: { $ne: 'curriculum_assignment' } } },
          { $unwind: '$questions' },
          { $match: { 'questions.curriculum_node_id': { $in: countableIds } } },
          { $group: { _id: '$questions.curriculum_node_id', count: { $sum: 1 } } }
        ]).toArray();
        for (const r of quizCounts) {
          if (r._id) {
            counts.set(r._id.toString(), (counts.get(r._id.toString()) || 0) + (r.count || 0));
          }
        }
      } catch (_) {}
    }

    // Build byId map
    const byId = new Map();
    for (const doc of documents) {
      const idStr = doc._id.toString();
      const isCountable = ['TEMA_UNITE', 'KAZANIM_CIKTI'].includes(doc.node_type);
      byId.set(idStr, {
        id: idStr,
        parent_id: doc.parent_id ? doc.parent_id.toString() : null,
        node_type: doc.node_type,
        title: doc.title || '',
        code: doc.code || '',
        order_index: typeof doc.order_index === 'number' ? doc.order_index : 0,
        is_active: doc.is_active !== false,
        metadata: doc.metadata || {},
        content_count: isCountable ? (counts.get(idStr) || 0) : null,
        children: []
      });
    }

    // Sibling sorting & child assembling
    const sortedDocs = [...documents].sort((a, b) => {
      const orderDiff = (a.order_index || 0) - (b.order_index || 0);
      if (orderDiff !== 0) return orderDiff;
      return a._id.toString().localeCompare(b._id.toString());
    });

    const roots = [];
    for (const doc of sortedDocs) {
      const node = byId.get(doc._id.toString());
      const docParentStr = doc.parent_id ? doc.parent_id.toString() : null;

      if (parentIdStr) {
        if (doc._id.toString() === parentIdStr) {
          roots.push(node);
        } else if (docParentStr && byId.has(docParentStr)) {
          byId.get(docParentStr).children.push(node);
        }
      } else {
        if (!docParentStr) {
          roots.push(node);
        } else if (byId.has(docParentStr)) {
          byId.get(docParentStr).children.push(node);
        }
      }
    }

    // Roll up question counts from outcomes to parent themes
    for (const doc of documents) {
      if (doc.node_type !== 'KAZANIM_CIKTI') continue;
      const outcomeCount = byId.get(doc._id.toString())?.content_count || 0;
      if (outcomeCount <= 0) continue;

      let pId = doc.parent_id ? doc.parent_id.toString() : null;
      while (pId && byId.has(pId)) {
        const parent = byId.get(pId);
        if (parent.node_type === 'TEMA_UNITE') {
          parent.content_count = (parent.content_count || 0) + outcomeCount;
        }
        pId = parent.parent_id;
      }
    }

    return roots;
  } catch (error) {
    console.warn('[CurriculumTree] buildCurriculumTreeFromMongo hatası, JSON yedeği kullanılıyor:', error.message);
    return buildCurriculumTreeFromJson(parentId);
  }
}

module.exports = {
  buildCurriculumTreeFromMongo,
  buildCurriculumTreeFromJson,
  toObjectId,
  deterministicId
};
