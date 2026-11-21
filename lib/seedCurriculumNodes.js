const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');

function deterministicId(key) {
  const hash = crypto.createHash('sha256').update(`zarif_seed_curriculum_v2:${key}`).digest();
  return new ObjectId(hash.subarray(0, 12));
}

/**
 * seedCurriculumNodes:
 * Single Source of Truth: lib/meb-curriculum-tree.json
 * - Grades 8 and 12 (Eski sistem / LGS & YKS) are strictly preserved and untouched.
 * - Maarif Modeli grades (5, 6, 7, 9, 10, 11) are updated with real MEB textbook themes and subtopics.
 */
async function seedCurriculumNodes(db, options = {}) {
  const treePath = path.join(__dirname, 'meb-curriculum-tree.json');
  if (!fs.existsSync(treePath)) {
    console.warn('[Seed] meb-curriculum-tree.json bulunamadı.');
    return { totalNodes: 0 };
  }

  const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
  const collection = db.collection('curriculum_nodes');
  const grades = [5, 6, 7, 8, 9, 10, 11, 12];

  const nodes = [];

  // 1. Kademe Nodes
  const kademeOrtaokulId = deterministicId('kademe:ortaokul');
  nodes.push({
    _id: kademeOrtaokulId,
    parent_id: null,
    node_type: 'KADEME',
    title: 'Ortaokul (5-8. Sınıf)',
    code: 'MEB.KADEME.ORTAOKUL',
    order_index: 1,
    is_active: true,
    metadata: { kademe: 'ortaokul' }
  });

  const kademeLiseId = deterministicId('kademe:lise');
  nodes.push({
    _id: kademeLiseId,
    parent_id: null,
    node_type: 'KADEME',
    title: 'Ortaöğretim / Lise (9-12. Sınıf)',
    code: 'MEB.KADEME.LISE',
    order_index: 2,
    is_active: true,
    metadata: { kademe: 'lise' }
  });

  // 2. Sınıf Nodes
  const sinifIds = {};
  for (const grade of grades) {
    const parentId = grade <= 8 ? kademeOrtaokulId : kademeLiseId;
    const sinifId = deterministicId(`sinif:${grade}`);
    sinifIds[grade] = sinifId;
    nodes.push({
      _id: sinifId,
      parent_id: parentId,
      node_type: 'SINIF',
      title: `${grade}. Sınıf`,
      code: `MEB.SINIF.${grade}`,
      order_index: grade,
      is_active: true,
      metadata: { grade }
    });
  }

  // 3. Tema ve Alt Konu Nodes (from meb-curriculum-tree.json)
  for (const grade of grades) {
    const gradeData = tree[String(grade)] || tree[grade];
    if (!gradeData || !gradeData.temalar) continue;

    let unitIndex = 1;
    for (const [temaTitle, temaObj] of Object.entries(gradeData.temalar)) {
      const temaId = deterministicId(`tema:${grade}:${temaTitle}`);
      nodes.push({
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
        const kazanimId = deterministicId(`subtopic:${grade}:${temaTitle}:${sub.name}`);
        nodes.push({
          _id: kazanimId,
          parent_id: temaId,
          node_type: 'KAZANIM_CIKTI',
          title: sub.name,
          code: sub.outcome_code || `MAT.${grade}.${unitIndex}.${subIndex}`,
          order_index: subIndex,
          is_active: true,
          metadata: {
            grade,
            unit: temaTitle,
            sub_topic: sub.name,
            outcome_code: sub.outcome_code || '',
            official_boundary: sub.official_boundary || ''
          }
        });

        // Alt beceri / kazanım süreci düğümü
        const beceriId = deterministicId(`beceri:${grade}:${sub.outcome_code || sub.name}`);
        nodes.push({
          _id: beceriId,
          parent_id: kazanimId,
          node_type: 'ALT_BECERI',
          title: `${sub.name} - Matematiksel Alan ve Süreç Becerileri`,
          code: `${sub.outcome_code || `MAT.${grade}.${unitIndex}.${subIndex}`}.BECERI`,
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

  // Bulk upsert into MongoDB
  const bulkOps = nodes.map(node => ({
    updateOne: {
      filter: { _id: node._id },
      update: { $set: node },
      upsert: true
    }
  }));

  if (bulkOps.length > 0) {
    const result = await collection.bulkWrite(bulkOps);
    console.log(`Curriculum nodes seeded: ${nodes.length} düğüm işlendi (Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}).`);
  }

  await collection.createIndex({ parent_id: 1 });
  await collection.createIndex({ node_type: 1 });
  await collection.createIndex({ code: 1 }, { unique: true, sparse: true });

  return { totalNodes: nodes.length };
}

module.exports = { seedCurriculumNodes, deterministicId };
