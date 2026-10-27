const express = require('express');
const { rateLimit } = require('express-rate-limit');

const konular = new Set([
  'Sayılar ve Problemler',
  'Denklemler ve Eşitsizlikler',
  'Fonksiyonlar',
  'Permütasyon ve Olasılık',
  'Trigonometri',
  'Logaritma',
  'Limit ve Süreklilik',
  'Türev',
  'İntegral',
  'Üçgenler',
  'Çember ve Daire',
  'Analitik Geometri'
]);
const zorluklar = new Set(['Kolay', 'Orta', 'Zor']);
const secenekler = ['A', 'B', 'C', 'D'];
const soruUretmeSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla soru üretme isteği. 15 dakika sonra tekrar deneyin.' }
});

function isValidQuestion(question) {
  return question &&
    typeof question.text === 'string' &&
    question.text.trim().length > 0 &&
    question.text.length <= 1000 &&
    question.options &&
    secenekler.every(letter =>
      typeof question.options[letter] === 'string' &&
      question.options[letter].trim().length > 0 &&
      question.options[letter].length <= 300
    ) &&
    secenekler.includes(question.answer) &&
    (!question.explanation ||
      typeof question.explanation === 'string' && question.explanation.length <= 1000);
}

function soruSemasi() {
  const secenekSemasi = {
    type: 'OBJECT',
    properties: Object.fromEntries(secenekler.map(letter => [letter, { type: 'STRING' }])),
    required: secenekler
  };
  return {
    type: 'OBJECT',
    properties: {
      questions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            text: { type: 'STRING' },
            options: secenekSemasi,
            answer: { type: 'STRING', enum: secenekler },
            explanation: { type: 'STRING' }
          },
          required: ['text', 'options', 'answer', 'explanation']
        }
      }
    },
    required: ['questions']
  };
}

function createAIRouter({ getQuizCollection, requireRole }) {
  const router = express.Router();

  router.post('/questions', soruUretmeSiniri, requireRole('student'), async (req, res) => {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const difficulty = typeof req.body?.difficulty === 'string' ? req.body.difficulty : '';
    const count = Number(req.body?.count);

    if (!konular.has(topic) || !zorluklar.has(difficulty) ||
        ![5, 10, 20].includes(count)) {
      return res.status(400).json({ mesaj: 'Konu, zorluk veya soru sayısı seçimi geçersiz.' });
    }

    const apiKey = String(process.env.AI_API_KEY || '').trim();
    if (!apiKey) {
      console.error('AI_API_KEY eksik. Kullanılan ortam değişkenleri dosyasına veya hosting ayarlarına AI_API_KEY ekleyin.');
      return res.status(503).json({ mesaj: 'Yapay zeka hizmeti henüz yapılandırılmamış. AI_API_KEY değerini sunucu ortamına ekleyin.' });
    }

    const prompt = [
      'Türkçe eğitim platformu için özgün, pedagojik olarak doğru matematik soruları hazırla.',
      `Konu: ${topic}. Zorluk: ${difficulty}. Tam olarak ${count} soru üret.`,
      'Her soru dört seçenekli (A, B, C, D) olsun ve yalnızca bir doğru cevap içersin.',
      'Sayıları, işlemleri ve doğru seçeneği dikkatle doğrula; belirsiz veya birden fazla doğru cevabı olan soru yazma.',
      'Açıklama alanında çözümün kısa ve anlaşılır adımlarını ver.',
      'Yalnızca istenen JSON şemasına uyan JSON döndür; Markdown veya başka metin ekleme.'
    ].join('\n');

    let response;
    try {
      response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: soruSemasi(),
              maxOutputTokens: 8192,
              temperature: 0.4
            }
          }),
          signal: AbortSignal.timeout(60000)
        }
      );
    } catch (error) {
      console.error('Gemini Hatası:', error);
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return res.status(504).json({ mesaj: 'Soru üretimi zaman aşımına uğradı. Lütfen yeniden deneyin.' });
      }
      return res.status(502).json({ mesaj: 'Yapay zeka hizmetine bağlanılamadı.' });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Gemini Hatası: HTTP ${response.status}`, errorBody);
      const status = response.status === 429 ? 503 : 502;
      return res.status(status).json({
        mesaj: response.status === 429
          ? 'Yapay zeka hizmeti şu anda yoğun. Biraz sonra tekrar deneyin.'
          : 'Yapay zeka soruları şu anda üretemedi. Lütfen daha sonra tekrar deneyin.'
      });
    }

    let result;
    try {
      const responseText = await response.text();
      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        console.error('Gemini Hatası: API yanıtı JSON olarak okunamadı.', error);
        return res.status(502).json({ mesaj: 'Yapay zeka geçerli soru verisi döndürmedi. Lütfen yeniden deneyin.' });
      }
      const text = payload.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('');
      if (!text) throw new Error('Model yanıtında soru verisi bulunamadı.');
      const sanitizedText = text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      result = JSON.parse(sanitizedText);
    } catch (error) {
      console.error('Gemini Hatası:', error);
      return res.status(502).json({ mesaj: 'Yapay zeka geçerli soru verisi döndürmedi. Lütfen yeniden deneyin.' });
    }

    if (!Array.isArray(result.questions) || result.questions.length !== count ||
        !result.questions.every(isValidQuestion)) {
      console.error('Gemini yanıtı beklenen soru biçimini karşılamadı.');
      return res.status(502).json({ mesaj: 'Üretilen sorular doğrulanamadı. Lütfen yeniden deneyin.' });
    }

    const quiz = {
      title: `${topic} — ${difficulty} seviye (Yapay zeka)`,
      description: `${count} soruluk yapay zeka destekli çalışma testi.`,
      questions: result.questions.map(question => ({
        text: question.text.trim(),
        options: Object.fromEntries(secenekler.map(letter => [
          letter,
          question.options[letter].trim()
        ])),
        answer: question.answer,
        explanation: (question.explanation || '').trim()
      })),
      source: 'ai',
      createdBy: req.session.user.id,
      createdAt: new Date()
    };

    try {
      const inserted = await getQuizCollection().insertOne(quiz);
      res.status(201).json({
        quiz: {
          id: inserted.insertedId.toString(),
          title: quiz.title,
          description: quiz.description,
          soruSayisi: quiz.questions.length,
          questions: quiz.questions.map(({ text, options }) => ({ text, options }))
        }
      });
    } catch (error) {
      console.error('Yapay zeka testi kaydedilemedi:', error);
      res.status(500).json({ mesaj: 'Üretilen test kaydedilemedi. Lütfen yeniden deneyin.' });
    }
  });

  return router;
}

module.exports = { createAIRouter };
