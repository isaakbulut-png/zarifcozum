const { ObjectId } = require('mongodb');

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) {
    return new ObjectId(id);
  }
  return null;
}

async function buildCurriculumTreeFromMongo(db, parentId = null) {
  const collection = db.collection('curriculum_nodes');
  const documents = await collection.find({ is_active: true }).toArray();
  if (!documents.length) return [];

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
}

module.exports = {
  buildCurriculumTreeFromMongo,
  toObjectId
};
