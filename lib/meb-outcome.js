function parseOutcomeGrade(code) {
  if (typeof code !== 'string') return null;
  const match = /^MAT\.([5-9]|1[0-2])(?:\.\d+){2,4}$/.exec(code);
  return match ? Number(match[1]) : null;
}

async function findExactOutcome(index, code) {
  const grade = parseOutcomeGrade(code);
  if (!grade) throw new Error('Kazanım kodu geçersiz.');
  const result = await index.fetchByMetadata({
    filter: {grade: {$eq: grade}, outcome_code: {$eq: code}},
    limit: 10
  });
  const records = Object.values(result.records || {}).filter(item =>
    item.metadata?.outcome_code === code && Number(item.metadata?.grade) === grade &&
    typeof item.metadata?.text === 'string' && item.metadata.text.trim());
  if (records.length !== 1) throw new Error('Bu kazanım için doğrulanmış tek bir müfredat kaydı bulunamadı.');
  return records[0].metadata;
}

module.exports = {parseOutcomeGrade, findExactOutcome};
