const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');

function deterministicId(key) {
  const hash = crypto.createHash('sha256').update(`zarif_seed_curriculum_v2:${key}`).digest();
  return new ObjectId(hash.subarray(0, 12));
}

async function seedCurriculumNodes(db) {
  const kazanimDir = path.join(__dirname, '..', 'mufredat_donusturucu', 'kazanimlar');
  const grades = [5, 6, 7, 8, 9, 10, 11, 12];
  const collection = db.collection('curriculum_nodes');

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

  // 3. Tema, Kazanım ve Alt Beceri Nodes
  for (const grade of grades) {
    const filePath = path.join(kazanimDir, `${grade}_sinif_matematik_mufredat.json`);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const unitMap = new Map();

    for (const record of data.records) {
      const unitTitle = (record.unit_topic || 'Genel').trim();
      if (!unitMap.has(unitTitle)) {
        unitMap.set(unitTitle, []);
      }
      unitMap.get(unitTitle).push(record);
    }

    let unitIndex = 1;
    for (const [unitTitle, records] of unitMap.entries()) {
      const temaId = deterministicId(`tema:${grade}:${unitTitle}`);
      const cleanPrefix = /^\d+\.\s*(Tema|Ünite)/i.test(unitTitle) ? '' : `${unitIndex}. Tema · `;
      const fullTemaTitle = `${cleanPrefix}${unitTitle}`;

      nodes.push({
        _id: temaId,
        parent_id: sinifIds[grade],
        node_type: 'TEMA_UNITE',
        title: fullTemaTitle,
        code: `MEB.MAT.${grade}.T${unitIndex}`,
        order_index: unitIndex,
        is_active: true,
        metadata: { brans: 'Matematik', grade, unitIndex, raw_title: unitTitle }
      });

      let outcomeIndex = 1;
      for (const record of records) {
        const kazanimId = deterministicId(`kazanim:${record.outcome_code}`);
        nodes.push({
          _id: kazanimId,
          parent_id: temaId,
          node_type: 'KAZANIM_CIKTI',
          title: record.official_description.trim(),
          code: record.outcome_code,
          order_index: outcomeIndex,
          is_active: true,
          metadata: {
            grade,
            unit: unitTitle,
            boundaries: record.official_boundaries || [],
            cautions: record.editorial_cautions || [],
            textbooks: record.textbook_sources || []
          }
        });

        // Alt Beceri Düğümü
        const beceriId = deterministicId(`beceri:${record.outcome_code}`);
        nodes.push({
          _id: beceriId,
          parent_id: kazanimId,
          node_type: 'ALT_BECERI',
          title: 'Matematiksel Alan ve Süreç Becerileri',
          code: `${record.outcome_code}.BECERI`,
          order_index: 1,
          is_active: true,
          metadata: {
            beceriler: [
              'Matematiksel Muhakeme',
              'Problem Çözme',
              'Matematiksel Temsil',
              'İlişkilendirme',
              'İletişim'
            ]
          }
        });

        outcomeIndex++;
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

  // Ensure index on parent_id and node_type
  await collection.createIndex({ parent_id: 1 });
  await collection.createIndex({ node_type: 1 });
  await collection.createIndex({ code: 1 }, { unique: true, sparse: true });

  return { totalNodes: nodes.length };
}

module.exports = { seedCurriculumNodes, deterministicId };
