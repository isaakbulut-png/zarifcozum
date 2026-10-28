const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { ObjectId } = require('mongodb');

const konular = new Set([
  'Sayılar ve Problemler',
  'Karmaşık Sayılar',
  'Polinomlar',
  'Üstel ve Logaritmik Fonksiyonlar',
  'Diziler',
  'Geometrik Şekiller ve Dönüşümler',
  'Türev ve Uygulamaları',
  'Katı Cisimler',
  'Sayılar ve Sayı Kümeleri',
  'Bölünebilme ve Asal Çarpanlar',
  'Gerçek Sayılar ve Aralıklar',
  'Üslü ve Köklü İfadeler',
  'Mutlak Değer',
  'Algoritma ve Bilişim',
  'İstatistiksel Araştırma',
  'Sayılar ve Cebirsel İşlemler',
  'Sayma Yöntemleri',
  'Çokgenler',
  'Analitik Düşünme ve Matematiksel Modelleme',
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

  router.post('/questions', requireRole('teacher'), soruUretmeSiniri, async (req, res) => {
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
              maxOutputTokens: 8192
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
      let mesaj = 'Yapay zeka soruları şu anda üretemedi. Lütfen daha sonra tekrar deneyin.';
      if (response.status === 429) {
        mesaj = 'Yapay zeka hizmeti şu anda yoğun. Biraz sonra tekrar deneyin.';
      } else if ([401, 403].includes(response.status)) {
        mesaj = 'Yapay zeka API anahtarı geçersiz veya yetkisiz. Sunucudaki AI_API_KEY ayarını kontrol edin.';
      } else if (response.status === 404) {
        mesaj = 'Yapay zeka modeli bulunamadı. Sunucudaki model yapılandırmasını kontrol edin.';
      } else if (response.status === 400) {
        mesaj = 'Yapay zeka isteği reddedildi. Sunucu günlüklerindeki Gemini hatasını kontrol edin.';
      } else if (response.status >= 500) {
        mesaj = 'Yapay zeka sağlayıcısı şu anda yanıt veremiyor. Biraz sonra tekrar deneyin.';
      }
      const status = response.status === 429 ? 503 : 502;
      return res.status(status).json({
        mesaj
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
      topic,
      difficulty,
      questions: result.questions.map(question => ({
        text: question.text.trim(),
        options: Object.fromEntries(secenekler.map(letter => [
          letter,
          question.options[letter].trim()
        ])),
        answer: question.answer,
        explanation: (question.explanation || '').trim()
      }))
    };

    res.json({
      quiz: {
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        soruSayisi: quiz.questions.length,
        questions: quiz.questions
      }
    });
  });

  router.post('/questions/publish', requireRole('teacher'), async (req, res) => {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const difficulty = typeof req.body?.difficulty === 'string' ? req.body.difficulty : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const question = req.body?.question;

    if (!konular.has(topic) || !zorluklar.has(difficulty) ||
        !title || title.length > 150 || description.length > 500 ||
        !isValidQuestion(question)) {
      return res.status(400).json({ mesaj: 'Test başlığı, konu, zorluk veya soru verileri geçersiz.' });
    }

    const quiz = {
      title,
      description,
      topic,
      difficulty,
      questions: [{
        text: question.text.trim(),
        options: Object.fromEntries(secenekler.map(letter => [
          letter,
          question.options[letter].trim()
        ])),
        answer: question.answer,
        explanation: (question.explanation || '').trim()
      }],
      source: 'ai',
      published: true,
      createdBy: req.session.user.id,
      createdAt: new Date()
    };

    try {
      const inserted = await getQuizCollection().insertOne(quiz);
      res.status(201).json({
        mesaj: 'Soru veritabanına eklendi ve öğrencilere yayınlandı.',
        quiz: { id: inserted.insertedId.toString(), title: quiz.title, soruSayisi: 1 }
      });
    } catch (error) {
      console.error('Yapay zeka sorusu yayınlanamadı:', error);
      res.status(500).json({ mesaj: 'Soru yayınlanamadı. Lütfen yeniden deneyin.' });
    }
  });

  router.delete('/questions/:id', requireRole('teacher'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz soru numarası.' });
    }

    try {
      const result = await getQuizCollection().deleteOne({
        _id: new ObjectId(req.params.id),
        source: 'ai',
        published: true
      });
      if (result.deletedCount === 0) {
        return res.status(404).json({ mesaj: 'Yayınlanmış yapay zeka sorusu bulunamadı.' });
      }
      res.json({ mesaj: 'Soru veritabanından silindi.' });
    } catch (error) {
      console.error('Yapay zeka sorusu silinemedi:', error);
      res.status(500).json({ mesaj: 'Soru silinemedi. Lütfen yeniden deneyin.' });
    }
  });

  return router;
}

module.exports = { createAIRouter };
