const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { ObjectId } = require('mongodb');
const { prepareQuestion } = require('../lib/quiz-content');
const safeSvg = require('../assets/safe-svg');

const { SINIF_KONULARI, TUM_KONULAR } = require('../lib/konu-haritasi');

// Eski taslak/kayıtlar bozulmasın diye önceki serbest konu adları da geçerli sayılır.
const eskiKonular = [
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
];
const konular = new Set([...eskiKonular, ...TUM_KONULAR]);
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
    question.text.length <= 1500 &&
    question.options &&
    secenekler.every(letter =>
      typeof question.options[letter] === 'string' &&
      question.options[letter].trim().length > 0 &&
      question.options[letter].length <= 300
    ) &&
    secenekler.includes(question.answer) &&
    (!question.explanation ||
      (typeof question.explanation === 'string' && question.explanation.length <= 1000)) &&
    (question.svg === undefined || question.svg === null ||
      (typeof question.svg === 'string' && question.svg.length <= 10000) ||
      (typeof question.svg === 'object' && !Array.isArray(question.svg)));
}

function prepareAIQuestion(question) {
  let cleanSvg;
  if (typeof question.svg === 'string' && question.svg.trim()) {
    cleanSvg = question.svg.trim();
  } else if (question.svg && typeof question.svg === 'object') {
    cleanSvg = safeSvg.validate(question.svg);
  }
  const { svg, ...rest } = question;
  const base = prepareQuestion(cleanSvg && typeof cleanSvg === 'object' ? { ...rest, svg: cleanSvg } : rest);
  return {
    ...base,
    explanation: typeof question.explanation === 'string' ? question.explanation.trim() : '',
    ...(cleanSvg ? { svg: cleanSvg } : {})
  };
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
            svg: {
              type: 'STRING',
              description: 'Görsel, şema veya tablo gerektiren sorularda geçerli ve renkli <svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">...</svg> kodu; görsel gerekmiyorsa boş metin.'
            },
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

function createAIRouter({ getQuizCollection, requireRole, AdminLog }) {
  const router = express.Router();

  router.get('/konular', requireRole('teacher'), (req, res) => {
    res.json({ konular: SINIF_KONULARI });
  });

  router.post('/questions', requireRole('teacher'), soruUretmeSiniri, async (req, res) => {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const difficulty = typeof req.body?.difficulty === 'string' ? req.body.difficulty : '';
    const count = Number(req.body?.count);
    const grade = Number(req.body?.grade);

    if (!SINIF_KONULARI[grade]?.includes(topic) || !zorluklar.has(difficulty) ||
        ![1, 5, 10, 15, 20].includes(count)) {
      return res.status(400).json({ mesaj: 'Sınıf, konu, zorluk veya soru sayısı seçimi geçersiz.' });
    }

    const apiKey = String(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
    if (!apiKey) {
      console.error('GEMINI_API_KEY eksik. Ortam değişkenleri dosyasına veya hosting ayarlarına GEMINI_API_KEY ekleyin.');
      return res.status(503).json({ mesaj: 'Yapay zeka hizmeti henüz yapılandırılmamış. GEMINI_API_KEY değerini sunucu ortamına ekleyin.' });
    }

    const prompt = [
      'Türkçe eğitim platformu için özgün, pedagojik olarak doğru, yeni nesil matematik soruları hazırla.',
      `Sınıf düzeyi: ${grade}. sınıf (MEB Türkiye Yüzyılı Maarif Modeli). Konu: ${topic}. Zorluk: ${difficulty}. Tam olarak ${count} soru üret.`,
      `Sorular yalnızca ${grade}. sınıf kazanımları ve ön koşulları içinde kalsın; üst sınıf konu veya formüllerini kullanma.`,
      'GÖRSEL VE ŞEMA KURALI: Basamak ve bölük tabloları, abaküs, sayı doğrusu, modelleme, geometrik şekiller, kesir modelleri, veri tabloları veya şema içeren yeni nesil sorularda "svg" alanına pedagojik, canlı renkli ve net bir SVG kodu ekle. Şema gerektirmeyen sorularda "svg" alanını boş string ("") yap.',
      'SVG KURALLARI (ZORUNLU):',
      '- Kök etiket: <svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg"> (örn: viewBox="0 0 520 220").',
      '- Yalnızca şu güvenli etiketleri kullan: <svg>, <g>, <rect>, <circle>, <ellipse>, <line>, <polyline>, <polygon>, <path>, <text>. Asla <style>, <defs>, <linearGradient>, <tspan>, <image> veya HTML etiketleri kullanma.',
      '- Sayısal özniteliklere (width, height, x, y, cx, cy, r, rx, ry, x1, y1, x2, y2, stroke-width, font-size) ASLA "px" veya birim yazma; yalnızca saf sayı yaz (örn: width="520", font-size="14", stroke-width="2").',
      '- Renkler (fill, stroke): Canlı ve modern renkler kullan (örn: mavi #2563eb, yeşil #16a34a, turuncu #ea580c, sarı #f59e0b, mor #7c3aed, kırmızı #dc2626, nötr zemin #f8fafc, çerçeve #cbd5e1). Sadece hex (#...) veya temel isim (none, black, white, red, blue, green, gray, orange, purple, yellow) kabul edilir.',
      '- <text> etiketi içine metni doğrudan yaz (örn: <text x="100" y="50" fill="#1e293b" font-size="14" text-anchor="middle">Milyonlar Bölüğü</text>).',
      'Her soru dört seçenekli (A, B, C, D) olsun ve yalnızca bir doğru cevap içersin.',
      'Sayıları, işlemleri, şemadaki değerleri ve doğru seçeneği birbiriyle %100 tutarlı olacak şekilde dikkatle doğrula.',
      'Açıklama alanında çözümün kısa ve anlaşılır adımlarını ver.',
      'Yalnızca istenen JSON şemasına uyan JSON döndür; Markdown veya fazladan metin ekleme.'
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
        mesaj = 'Yapay zeka API anahtarı geçersiz veya yetkisiz. Sunucudaki GEMINI_API_KEY ayarını kontrol edin.';
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

    let preparedQuestions;
    try {
      preparedQuestions = result.questions.map(prepareAIQuestion);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return res.status(502).json({ mesaj: 'Üretilen sorular doğrulanamadı. Lütfen yeniden deneyin.' });
    }

    const quiz = {
      title: `${topic} — ${difficulty} seviye (Yapay zeka)`,
      description: `${count} soruluk yapay zeka destekli çalışma testi.`,
      topic,
      grade,
      difficulty,
      questions: preparedQuestions
    };

    res.json({
      quiz: {
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        grade: quiz.grade,
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
    const questions = req.body?.questions !== undefined ? req.body.questions : [req.body?.question];
    const grade = req.body?.grade === undefined ? null : Number(req.body.grade);

    if (!konular.has(topic) || !zorluklar.has(difficulty) ||
        (grade !== null && !SINIF_KONULARI[grade]) ||
        !title || title.length > 150 || description.length > 500 ||
        !Array.isArray(questions) || questions.length < 1 || questions.length > 50 ||
        !questions.every(isValidQuestion)) {
      return res.status(400).json({ mesaj: 'Test başlığı, konu, zorluk veya soru verileri geçersiz.' });
    }

    let preparedQuestions;
    try {
      preparedQuestions = questions.map(prepareAIQuestion);
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ mesaj: error.message });
      throw error;
    }

    const quiz = {
      title,
      description,
      topic,
      ...(grade !== null && { grade }),
      difficulty,
      questions: preparedQuestions,
      source: 'ai',
      published: true,
      createdBy: req.session.user.id,
      createdAt: new Date()
    };

    try {
      const inserted = await getQuizCollection().insertOne(quiz);
      res.status(201).json({
        mesaj: questions.length === 1
          ? 'Soru veritabanına eklendi ve öğrencilere yayınlandı.'
          : 'Test veritabanına eklendi ve öğrencilere yayınlandı.',
        quiz: { id: inserted.insertedId.toString(), title: quiz.title, soruSayisi: questions.length }
      });
    } catch (error) {
      console.error('Yapay zeka sorusu yayınlanamadı:', error);
      res.status(500).json({ mesaj: 'Soru yayınlanamadı. Lütfen yeniden deneyin.' });
    }
  });

  router.delete('/questions/:id', requireRole('teacher'), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ mesaj: 'Geçersiz test numarası.' });
    }

    try {
      const result = await getQuizCollection().deleteOne({
        _id: new ObjectId(req.params.id),
        source: 'ai',
        published: true
      });
      if (result.deletedCount === 0) {
        return res.status(404).json({ mesaj: 'Yayınlanmış yapay zeka testi bulunamadı.' });
      }
      await AdminLog.create({
        actorId: req.session.user.id,
        actorName: req.session.user.name || 'Öğretmen',
        action: 'question.deleted',
        entityType: 'ai_question',
        entityId: req.params.id,
        details: { source: 'ai' }
      });
      res.json({ mesaj: 'Test veritabanından silindi.' });
    } catch (error) {
      console.error('Yapay zeka testi silinemedi veya işlem kaydı oluşturulamadı:', error);
      res.status(500).json({ mesaj: 'Test silinemedi veya işlem kaydı oluşturulamadı.' });
    }
  });

  return router;
}

module.exports = { createAIRouter };
