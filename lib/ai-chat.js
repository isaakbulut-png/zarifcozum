const MAX_MESSAGE_LENGTH = 4000;

function normalizeAiChatRequest(payload) {
  const ogrenciMesaji = typeof payload?.ogrenciMesaji === 'string'
    ? payload.ogrenciMesaji.trim()
    : '';
  if (!ogrenciMesaji) {
    const error = new Error('ogrenciMesaji gerekli.');
    error.status = 400;
    throw error;
  }
  if (ogrenciMesaji.length > MAX_MESSAGE_LENGTH) {
    const error = new Error(`ogrenciMesaji 1–${MAX_MESSAGE_LENGTH} karakter olmalıdır.`);
    error.status = 400;
    throw error;
  }

  const rawGrade = payload.grade;
  const sinif = rawGrade === undefined || rawGrade === null || rawGrade === ''
    ? undefined
    : Number(rawGrade);
  if (sinif !== undefined && !(Number.isInteger(sinif) && sinif >= 5 && sinif <= 12)) {
    const error = new Error('grade 5 ile 12 arasında bir tam sayı olmalı.');
    error.status = 400;
    throw error;
  }

  return {
    ogrenciMesaji,
    gorevTuru: typeof payload.gorevTuru === 'string' && payload.gorevTuru.trim()
      ? payload.gorevTuru.trim()
      : 'ai_mentor',
    sinif
  };
}

async function generateAiChatReply({ ogrenciMesaji, gorevTuru, sinif }) {
  const { zarifCozumAIServisi } = await import('../aiService.mjs');
  const yanit = await zarifCozumAIServisi(ogrenciMesaji, gorevTuru, sinif);
  if (typeof yanit !== 'string' || !yanit.trim()) {
    throw new Error('AI Mentör yanıtı şu anda üretilemedi.');
  }
  return yanit;
}

function createAiChatReply({ findFaq, generateReply = generateAiChatReply, logger = console }) {
  return async request => {
    try {
      const answer = await findFaq(request);
      if (answer) return { text: answer.text, html: answer.html };
    } catch (error) {
      logger.error('FAQ yanıtı alınamadı; yapay zekâ yanıtına geçiliyor:', error);
    }
    return { text: await generateReply(request), html: null };
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  normalizeAiChatRequest,
  generateAiChatReply,
  createAiChatReply
};
