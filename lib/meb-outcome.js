const { getCurriculumTree } = require('./meb-curriculum');

function parseOutcomeGrade(code) {
  if (typeof code !== 'string') return null;
  const match = /^MAT\.([5-9]|1[0-2])(?:\.\d+){2,4}$/.exec(code);
  return match ? Number(match[1]) : null;
}

async function findExactOutcome(index, code) {
  const grade = parseOutcomeGrade(code);
  if (!grade) throw new Error('Kazanım kodu geçersiz.');

  // 1. Önce Tek Doğruluk Kaynağımız olan meb-curriculum-tree.json üzerinden kazanımı bul (sıfır gecikme)
  try {
    const tree = getCurriculumTree();
    const gradeData = tree[grade] || tree[String(grade)];
    if (gradeData && gradeData.temalar) {
      for (const [unitTopic, temaObj] of Object.entries(gradeData.temalar)) {
        for (const sub of (temaObj.alt_konular || [])) {
          if (sub.outcome_code === code || sub.outcome_code?.toLowerCase() === code.toLowerCase()) {
            return {
              grade,
              unit_topic: unitTopic,
              sub_topic: sub.name,
              outcome_code: sub.outcome_code,
              official_boundary: sub.official_boundary || '',
              text: `Kazanım: ${sub.name}\nKod: ${sub.outcome_code}\nResmi Sınır: ${sub.official_boundary || 'Müfredat kazanımı'}`
            };
          }
        }
      }
    }
  } catch (_) {}

  // 2. Pinecone üzerinden açıkça "klavuz" namespace'i sorgula
  try {
    const klavuzNs = index && typeof index.namespace === 'function' ? index.namespace('klavuz') : index;
    if (klavuzNs && typeof klavuzNs.fetchByMetadata === 'function') {
      const result = await klavuzNs.fetchByMetadata({
        filter: {grade: {$eq: grade}, outcome_code: {$eq: code}},
        limit: 10
      });
      const records = Object.values(result.records || {}).filter(item =>
        item.metadata?.outcome_code === code && Number(item.metadata?.grade) === grade &&
        typeof item.metadata?.text === 'string' && item.metadata.text.trim());
      if (records.length >= 1) return records[0].metadata;
    }
  } catch (_) {}

  // 3. Fallback: Geçerli metadata yapısı
  return {
    grade,
    unit_topic: `${grade}. Sınıf Matematik`,
    sub_topic: code,
    outcome_code: code,
    official_boundary: 'Resmî MEB öğretim programı kazanım sınırlarına sadık kalın.',
    text: `Kazanım: ${code}\nSınıf: ${grade}`
  };
}

module.exports = {parseOutcomeGrade, findExactOutcome};
