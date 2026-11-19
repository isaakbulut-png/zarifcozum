const MAX_MESSAGE_LENGTH = 4000;

function checkQuickTemplateReply(ogrenciMesaji) {
  const trimmed = String(ogrenciMesaji || '').trim();
  if (!trimmed) return null;

  // 1. Salt Selamlaşma / Karşılama Filtresi (0 Token maliyeti)
  if (/^(merhaba|selam|selamlar|günaydın|tünaydın|iyi günler|iyi akşamlar|iyi geceler|hey)[\s!.,:)]*$/i.test(trimmed)) {
    return 'Merhaba! Ben ZarifÇözüm AI Mentörün. Hangi matematik konusunda veya sorusunda takıldın, birlikte adım adım bakalım?';
  }

  // 2. Salt Teşekkür / Onay Filtresi (0 Token maliyeti)
  if (/^(teşekkür(ler| ederim)?|sağ ol|sağolun|anladım|harika|çok sağol|tamamdır|peki)[\s!.,:)]*$/i.test(trimmed)) {
    return 'Rica ederim! Başka aklına takılan bir adım veya çözmek istediğin bir soru olursa buradayım. Başarılar!';
  }

  return null;
}

const ALLOWED_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

function normalizeAiChatRequest(payload, userRole, userSession) {
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

  const result = {
    ogrenciMesaji,
    gorevTuru: typeof payload.gorevTuru === 'string' && payload.gorevTuru.trim()
      ? payload.gorevTuru.trim()
      : 'ai_mentor',
    sinif
  };
  if (Array.isArray(payload.history)) {
    result.history = payload.history;
  }
  // Güvenlik: Yalnızca öğretmen ve yöneticiler model seçebilir; öğrenci istekleri daima standart modelde kalır
  const canChooseModel = userRole === 'teacher' || userRole === 'admin';
  if (payload?.selectedModel) {
    const raw = String(payload.selectedModel).trim();
    result.selectedModel = (canChooseModel && ALLOWED_MODELS.includes(raw))
      ? raw
      : 'gemini-2.5-flash';
  }
  if (userSession) {
    result.userContext = {
      userId: userSession.id || userSession._id,
      userName: userSession.name,
      userRole: userRole || 'öğrenci'
    };
  }
  return result;
}

async function generateAiChatReply({ ogrenciMesaji, gorevTuru, sinif, history = [], selectedModel, userContext = {} }) {
  const quickTemplate = checkQuickTemplateReply(ogrenciMesaji);
  if (quickTemplate) {
    try {
      const { recordAiUsage } = require('./ai-usage-tracker');
      recordAiUsage({
        kullaniciId: userContext?.userId || null,
        kullaniciAdi: userContext?.userName || 'Kullanıcı',
        kullaniciRol: userContext?.userRole || 'öğrenci',
        modul: 'Hızlı Selamlaşma / Teşekkür',
        modelAdi: 'Yerel Şablon (0 Token)',
        cacheHit: true,
        durum: 'cache_hit'
      });
    } catch {}
    return quickTemplate;
  }

  const { zarifCozumAIServisi } = await import('../aiService.mjs');
  const yanit = await zarifCozumAIServisi(ogrenciMesaji, gorevTuru, sinif, history, selectedModel, userContext);
  if (typeof yanit !== 'string' || !yanit.trim()) {
    throw new Error('AI Mentör yanıtı şu anda üretilemedi.');
  }
  return yanit;
}

function createAiChatReply({ findFaq, generateReply = generateAiChatReply, logger = console }) {
  return async request => {
    // 1. Hızlı selamlaşma/teşekkür şablonu (FAQ ve AI öncesi 0 maliyet)
    const quick = checkQuickTemplateReply(request.ogrenciMesaji);
    if (quick) return { text: quick, html: null };

    // 2. Sıkça Sorulan Sorular (FAQ)
    try {
      const answer = await findFaq(request);
      if (answer) return { text: answer.text, html: answer.html };
    } catch (error) {
      logger.error('FAQ yanıtı alınamadı; yapay zekâ yanıtına geçiliyor:', error);
    }

    // 3. Yapay zekâ üretimi
    return { text: await generateReply(request), html: null };
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  checkQuickTemplateReply,
  normalizeAiChatRequest,
  generateAiChatReply,
  createAiChatReply
};
