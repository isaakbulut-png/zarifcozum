/**
 * Türkiye Geneli Deneme Net ve Sıralama Hesaplama Motoru
 */

/**
 * Net sayısı hesaplama (Varsayılan MEB kuralı: 3 yanlış 1 doğruyu götürür)
 */
function calculateNet(correctCount, wrongCount, penaltyRatio = 3) {
  const correct = Math.max(0, Number(correctCount) || 0);
  const wrong = Math.max(0, Number(wrongCount) || 0);
  const net = correct - (wrong / penaltyRatio);
  return Math.max(0, parseFloat(net.toFixed(2)));
}

/**
 * Katılımcı sonuçları listesinde sıralama ve yüzdelik dilim atar.
 * @param {Array<{ studentId: string, netCount: number, score: number, city?: string }>} results
 * @returns {Array<Object>} Sıralanmış ve rank/percentile eklenmiş sonuçlar
 */
function rankParticipants(results) {
  if (!Array.isArray(results) || results.length === 0) return [];

  // Net sayısına ve puana göre azalan sırala
  const sorted = [...results].sort((a, b) => {
    if (b.netCount !== a.netCount) return b.netCount - a.netCount;
    return b.score - a.score;
  });

  const total = sorted.length;
  const cityCounters = new Map();

  return sorted.map((item, index) => {
    const generalRank = index + 1;
    const percentile = parseFloat(((generalRank / total) * 100).toFixed(2));

    const city = item.city || 'Belirtilmedi';
    const cityRank = (cityCounters.get(city) || 0) + 1;
    cityCounters.set(city, cityRank);

    return {
      ...item,
      turkiyeSirasi: generalRank,
      ilSirasi: cityRank,
      yuzdelikDilim: percentile,
      toplamKatilimci: total
    };
  });
}

/**
 * Öğrenci için detaylı Net Karnesi üretir.
 */
function generateNetKarnesi({ deneme, result, rankData = {} }) {
  return {
    denemeId: deneme._id ? deneme._id.toString() : deneme.id,
    denemeBasligi: deneme.title,
    grade: deneme.grade,
    toplamSoru: deneme.soruIds ? deneme.soruIds.length : (result.totalCount || 0),
    dogruSayisi: result.correctCount || 0,
    yanlisSayisi: result.wrongCount || 0,
    bosSayisi: result.blankCount || 0,
    netSayisi: result.netCount !== undefined ? result.netCount : calculateNet(result.correctCount, result.wrongCount),
    puan: result.score || 0,
    turkiyeSirasi: rankData.turkiyeSirasi || result.turkiyeSirasi || null,
    ilSirasi: rankData.ilSirasi || result.ilSirasi || null,
    yuzdelikDilim: rankData.yuzdelikDilim || result.yuzdelikDilim || null,
    toplamKatilimci: rankData.toplamKatilimci || deneme.totalParticipants || 1,
    ortalamaNet: deneme.averageNet || 0,
    teslimTarihi: result.submittedAt || result.createdAt || new Date()
  };
}

module.exports = {
  calculateNet,
  rankParticipants,
  generateNetKarnesi
};
