const { createHash } = require('node:crypto');

const VERSION_KEY = 'faq:version';
const CACHE_TTL_SECONDS = 300;
const NOT_FOUND_TTL_SECONDS = 60;

function normalizeFaqQuestion(value) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function faqCacheKey(version, question, grade) {
  const digest = createHash('sha256')
    .update(`${grade ?? '*'}\0${question}`)
    .digest('hex');
  return `faq:v${version}:${digest}`;
}

function createFaqService({ getFaqModel, redisClient, logger = console }) {
  async function getVersion() {
    if (!redisClient?.isReady) return null;
    try {
      let version = await redisClient.get(VERSION_KEY);
      if (!version) {
        await redisClient.set(VERSION_KEY, '1', { NX: true });
        version = await redisClient.get(VERSION_KEY);
      }
      return version || '1';
    } catch (error) {
      logger.error('FAQ Redis sürümü okunamadı:', error);
      return null;
    }
  }

  async function findAnswer(request) {
    const question = normalizeFaqQuestion(request.ogrenciMesaji);
    const version = await getVersion();
    const key = version
      ? faqCacheKey(version, question, request.sinif)
      : null;

    if (key && redisClient.isReady) {
      try {
        const cached = await redisClient.get(key);
        if (cached !== null) {
          const entry = JSON.parse(cached);
          if (entry.notFound === true) return null;
          if (typeof entry.answer === 'string') {
            return { text: entry.answer, html: null };
          }
          if (typeof entry.answer?.text === 'string' &&
              typeof entry.answer.html === 'string') {
            return entry.answer;
          }
          logger.error('FAQ Redis önbelleğinde beklenmeyen yanıt biçimi.');
        }
      } catch (error) {
        logger.error('FAQ Redis önbelleği okunamadı:', error);
      }
    }

    const gradeFilter = request.sinif === undefined
      ? { grade: null }
      : { $or: [{ grade: null }, { grade: request.sinif }] };
    const entries = await getFaqModel()
      .find({ normalizedQuestion: question, active: true, ...gradeFilter })
      .select('answerHtml answerText grade')
      .lean();
    const matching = entries
      .filter(entry => entry.grade === null || entry.grade === undefined ||
        Number(entry.grade) === request.sinif)
      .sort((left, right) => Number(right.grade != null) - Number(left.grade != null));
    const answer = matching[0]
      ? { html: matching[0].answerHtml, text: matching[0].answerText }
      : null;

    if (key && redisClient.isReady) {
      try {
        await redisClient.set(
          key,
          JSON.stringify(answer ? { answer } : { notFound: true }),
          { EX: answer ? CACHE_TTL_SECONDS : NOT_FOUND_TTL_SECONDS }
        );
      } catch (error) {
        logger.error('FAQ Redis önbelleği yazılamadı:', error);
      }
    }
    return answer;
  }

  async function invalidate() {
    if (!redisClient?.isReady) return false;
    try {
      await redisClient.incr(VERSION_KEY);
      return true;
    } catch (error) {
      logger.error('FAQ Redis önbelleği geçersiz kılınamadı:', error);
      return false;
    }
  }

  return { findAnswer, invalidate };
}

module.exports = { createFaqService, normalizeFaqQuestion };
