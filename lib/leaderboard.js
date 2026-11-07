const { ObjectId } = require('mongodb');

function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Öğrenci';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts.slice(1).map(part => `${Array.from(part)[0]}.`).join(' ')}`;
}

function createPointsService({getClient, getDb, userCollectionName}) {
  async function transaction(operation) {
    const session = getClient().startSession();
    try {
      return await session.withTransaction(() => operation(session));
    } finally {
      await session.endSession();
    }
  }

  async function award(session, studentId, questionKeys) {
    if (!ObjectId.isValid(studentId)) throw new TypeError('Öğrenci kimliği geçersiz.');
    const uniqueKeys = [...new Set(questionKeys)];
    let awarded = 0;
    for (const key of uniqueKeys) {
      const result = await getDb().collection('zarif_puan_sorulari').updateOne(
        {_id: `${studentId}:${key}`},
        {$setOnInsert: {studentId, questionKey: key, createdAt: new Date()}},
        {upsert: true, session}
      );
      awarded += result.upsertedCount;
    }
    if (awarded) {
      const update = await getDb().collection(userCollectionName).updateOne(
        {_id: new ObjectId(studentId), role: 'student'},
        {$inc: {zarifPuan: 10 * awarded, haftalikPuan: 10 * awarded}},
        {session}
      );
      if (!update.matchedCount) throw new Error('Puan verilecek öğrenci bulunamadı.');
    }
    return awarded * 10;
  }

  async function leaderboard() {
    const users = await getDb().collection(userCollectionName).aggregate([
      {$match: {role: 'student', restricted: {$ne: true}}},
      {$project: {name: 1, haftalikPuan: {$ifNull: ['$haftalikPuan', 0]}, mevcutLig: {$ifNull: ['$mevcutLig', 'Bronz']}}},
      {$sort: {haftalikPuan: -1, _id: 1}},
      {$limit: 10}
    ]).toArray();
    return users.map((user, index) => ({
      sira: index + 1,
      ad: maskName(user.name),
      haftalikPuan: user.haftalikPuan || 0,
      mevcutLig: user.mevcutLig || 'Bronz'
    }));
  }
  return {transaction, award, leaderboard};
}

module.exports = {createPointsService, maskName};
