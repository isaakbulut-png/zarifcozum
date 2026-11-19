const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { ObjectId } = require('mongodb');
const { prepareQuestion } = require('../lib/quiz-content');
const safeSvg = require('../assets/safe-svg');
const { normalizeBareMath } = require('../assets/math-text');
const Soru = require('../models/Soru');
const AiQuestionDraft = require('../models/AiQuestionDraft');
const ContentLibrary = require('../models/ContentLibrary');
const { checkQuestionSimilarity, indexQuestionInPinecone } = require('../lib/content-similarity');
const { exportQuestions } = require('../lib/document-exporter');

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

function generatePedagogicalSvg(questionText = '', topic = '', grade = 5) {
  const text = String(questionText || '');
  const lowerText = text.toLowerCase();
  const lowerTopic = String(topic || '').toLowerCase();

  const isVisualTopic = lowerTopic.includes('geometri') ||
    lowerTopic.includes('üçgen') ||
    lowerTopic.includes('dörtgen') ||
    lowerTopic.includes('açı') ||
    lowerTopic.includes('şekil') ||
    lowerTopic.includes('alan') ||
    lowerTopic.includes('çevre') ||
    lowerTopic.includes('doğru') ||
    lowerTopic.includes('kesir') ||
    lowerTopic.includes('veri');

  const textMentionsShape = /şekil|grafik|üçgen|çadır|açı|kenar|kare|dikdörtgen|çember|daire|doğru|tablo/i.test(lowerText);

  if (!isVisualTopic && !textMentionsShape) return null;

  // 1. Üçgen / Çadır sorusu
  if (lowerText.includes('üçgen') || lowerText.includes('çadır') || lowerTopic.includes('üçgen')) {
    let angleA = '40°';
    let angleB = '70°';
    let angleC = '70°';

    const numbers = text.match(/\b([1-9]\d{0,2})°?\b/g);
    if (numbers && numbers.length >= 2) {
      angleA = numbers[0].replace('°', '') + '°';
      angleB = numbers[1].replace('°', '') + '°';
      const aVal = parseInt(angleA);
      const bVal = parseInt(angleB);
      if (aVal + bVal < 180) {
        angleC = (180 - aVal - bVal) + '°';
      }
    }

    const hasTent = lowerText.includes('çadır');
    const subtitle = hasTent ? 'Çadır Ön Yüzeyi Modeli (ABC Üçgeni)' : 'Geometrik Çizim: ABC Üçgeni';

    return `<svg viewBox="0 0 500 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="280" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <polygon points="250,55 90,225 410,225" fill="#eff6ff" stroke="#2563eb" stroke-width="3" stroke-linejoin="round"/>
  ${hasTent ? '<line x1="250" y1="55" x2="250" y2="225" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,4"/>' : ''}
  <circle cx="250" cy="55" r="5" fill="#1e293b"/>
  <circle cx="90" cy="225" r="5" fill="#1e293b"/>
  <circle cx="410" cy="225" r="5" fill="#1e293b"/>
  <path d="M 235,75 A 25 25 0 0 0 265,75" fill="none" stroke="#dc2626" stroke-width="2"/>
  <path d="M 120,225 A 30 30 0 0 0 108,198" fill="none" stroke="#2563eb" stroke-width="2"/>
  <path d="M 380,225 A 30 30 0 0 1 392,198" fill="none" stroke="#16a34a" stroke-width="2"/>
  <text x="250" y="40" font-size="16" font-weight="bold" fill="#1e293b" text-anchor="middle">A</text>
  <text x="70" y="235" font-size="16" font-weight="bold" fill="#1e293b" text-anchor="middle">B</text>
  <text x="430" y="235" font-size="16" font-weight="bold" fill="#1e293b" text-anchor="middle">C</text>
  <text x="250" y="95" font-size="13" font-weight="bold" fill="#dc2626" text-anchor="middle">${angleA}</text>
  <text x="135" y="210" font-size="13" font-weight="bold" fill="#2563eb" text-anchor="middle">${angleB}</text>
  <text x="365" y="210" font-size="13" font-weight="bold" fill="#16a34a" text-anchor="middle">${angleC}</text>
  <text x="250" y="260" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">${subtitle}</text>
</svg>`.trim();
  }

  // 2. Dörtgen / Dikdörtgen / Kare
  if (lowerText.includes('dikdörtgen') || lowerText.includes('kare') || lowerText.includes('dörtgen')) {
    const isSquare = lowerText.includes('kare');
    const width = isSquare ? 180 : 260;
    const height = 150;
    const startX = 250 - (width / 2);
    const startY = 55;

    return `<svg viewBox="0 0 500 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="260" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="${startX}" y="${startY}" width="${width}" height="${height}" rx="4" fill="#f0fdf4" stroke="#16a34a" stroke-width="3"/>
  <circle cx="${startX}" cy="${startY}" r="5" fill="#1e293b"/>
  <circle cx="${startX + width}" cy="${startY}" r="5" fill="#1e293b"/>
  <circle cx="${startX + width}" cy="${startY + height}" r="5" fill="#1e293b"/>
  <circle cx="${startX}" cy="${startY + height}" r="5" fill="#1e293b"/>
  <text x="${startX - 15}" y="${startY - 5}" font-size="15" font-weight="bold" fill="#1e293b">A</text>
  <text x="${startX + width + 10}" y="${startY - 5}" font-size="15" font-weight="bold" fill="#1e293b">B</text>
  <text x="${startX + width + 10}" y="${startY + height + 15}" font-size="15" font-weight="bold" fill="#1e293b">C</text>
  <text x="${startX - 15}" y="${startY + height + 15}" font-size="15" font-weight="bold" fill="#1e293b">D</text>
  <text x="250" y="240" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">${isSquare ? 'Kare Şekli (ABCD)' : 'Dikdörtgen Şekli (ABCD)'}</text>
</svg>`.trim();
  }

  // 3. Sayı Doğrusu
  if (lowerText.includes('sayı doğrusu') || lowerText.includes('sayı doğrusunda')) {
    return `<svg viewBox="0 0 500 140" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="140" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <line x1="50" y1="70" x2="450" y2="70" stroke="#1e293b" stroke-width="3"/>
  <polygon points="45,70 55,64 55,76" fill="#1e293b"/>
  <polygon points="455,70 445,64 445,76" fill="#1e293b"/>
  <line x1="100" y1="60" x2="100" y2="80" stroke="#1e293b" stroke-width="2"/>
  <line x1="180" y1="60" x2="180" y2="80" stroke="#1e293b" stroke-width="2"/>
  <line x1="260" y1="60" x2="260" y2="80" stroke="#1e293b" stroke-width="2"/>
  <line x1="340" y1="60" x2="340" y2="80" stroke="#1e293b" stroke-width="2"/>
  <line x1="420" y1="60" x2="420" y2="80" stroke="#1e293b" stroke-width="2"/>
  <circle cx="260" cy="70" r="6" fill="#dc2626"/>
  <text x="100" y="102" font-size="14" fill="#334155" text-anchor="middle">0</text>
  <text x="180" y="102" font-size="14" fill="#334155" text-anchor="middle">1</text>
  <text x="260" y="102" font-size="14" font-weight="bold" fill="#dc2626" text-anchor="middle">2 (A)</text>
  <text x="340" y="102" font-size="14" fill="#334155" text-anchor="middle">3</text>
  <text x="420" y="102" font-size="14" fill="#334155" text-anchor="middle">4</text>
  <text x="250" y="32" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">Sayı Doğrusu Modeli</text>
</svg>`.trim();
  }

  // 4. Çember / Daire
  if (lowerText.includes('çember') || lowerText.includes('daire')) {
    return `<svg viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="240" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="250" cy="115" r="70" fill="#fef3c7" stroke="#d97706" stroke-width="3"/>
  <circle cx="250" cy="115" r="4" fill="#1e293b"/>
  <line x1="250" y1="115" x2="320" y2="115" stroke="#dc2626" stroke-width="2"/>
  <text x="240" y="110" font-size="14" font-weight="bold" fill="#1e293b">O</text>
  <text x="285" y="105" font-size="13" font-weight="bold" fill="#dc2626">r</text>
  <text x="250" y="215" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">O Merkezli Çember / Daire Modeli</text>
</svg>`.trim();
  }

  // 5. Genel Geometrik Şekiller fallback
  if (isVisualTopic) {
    return `<svg viewBox="0 0 500 220" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="220" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <polygon points="120,60 60,160 180,160" fill="#eff6ff" stroke="#2563eb" stroke-width="2.5"/>
  <rect x="220" y="70" width="90" height="90" rx="4" fill="#f0fdf4" stroke="#16a34a" stroke-width="2.5"/>
  <circle cx="400" cy="115" r="45" fill="#fef3c7" stroke="#d97706" stroke-width="2.5"/>
  <text x="120" y="185" font-size="13" font-weight="bold" fill="#2563eb" text-anchor="middle">Üçgen</text>
  <text x="265" y="185" font-size="13" font-weight="bold" fill="#16a34a" text-anchor="middle">Kare</text>
  <text x="400" y="185" font-size="13" font-weight="bold" fill="#d97706" text-anchor="middle">Çember</text>
  <text x="250" y="32" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">Geometrik Şekiller Görseli</text>
</svg>`.trim();
  }

  return null;
}

function prepareAIQuestion(question, context = {}) {
  // Matematik ve LaTeX ifadelerini normalize et
  const normalizedText = normalizeBareMath(question.text || '');
  const normalizedExplanation = normalizeBareMath(question.explanation || '');
  const normalizedOptions = {};
  if (question.options) {
    for (const letter of secenekler) {
      normalizedOptions[letter] = normalizeBareMath(question.options[letter] || '');
    }
  }

  let cleanSvg;
  if (typeof question.svg === 'string' && question.svg.trim()) {
    cleanSvg = question.svg.trim();
  } else if (question.svg && typeof question.svg === 'object') {
    cleanSvg = safeSvg.validate(question.svg);
  }

  // Otomatik görsel desteği: Eğer soru metni şekil/geometri içeriyorsa ve SVG boşsa fallback üret
  if (!cleanSvg) {
    const fallbackSvg = generatePedagogicalSvg(normalizedText, context.topic, context.grade);
    if (fallbackSvg) {
      cleanSvg = fallbackSvg;
    }
  }

  const { svg, ...rest } = question;
  const base = prepareQuestion(cleanSvg && typeof cleanSvg === 'object' ? { ...rest, text: normalizedText, options: normalizedOptions, svg: cleanSvg } : { ...rest, text: normalizedText, options: normalizedOptions });
  return {
    ...base,
    explanation: normalizedExplanation.trim(),
    ...(cleanSvg ? { svg: cleanSvg } : {})
  };
}

function soruSemasi() {
  const secenekSemasi = {
    type: 'OBJECT',
    properties: Object.fromEntries(secenekler.map(letter => [letter, {
      type: 'STRING',
      description: `${letter} seçeneği metni. Tüm matematiksel ifadeler tek dolar $ ... $ içinde ve geçerli kaçırılmış LaTeX ile yazılmalıdır (örn: "$3^{x-1}$", "$[AB] \\\\perp [AC]$").`
    }])),
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
            text: {
              type: 'STRING',
              description: 'Soru metni. Tüm matematiksel ifadeler, değişkenler ($x$, $y$), üslü/köklü sayılar ($3^{x-1}$, $\\sqrt{x}$), geometrik semboller ($ABC$, $[AB] \\perp [AC]$, $\\widehat{BAC}$) ve uzunluklar ($|AB| = 4$) mutlaka tek dolar $ ... $ içine alınmalı ve ters eğik çizgiler çift kaçırılmalıdır (\\\\perp).'
            },
            svg: {
              type: 'STRING',
              description: 'Görsel, şema veya tablo gerektiren sorularda geçerli ve renkli <svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">...</svg> kodu; görsel gerekmiyorsa boş metin. SVG içinde asla $ veya ham LaTeX kullanılmaz.'
            },
            options: secenekSemasi,
            answer: { type: 'STRING', enum: secenekler },
            explanation: {
              type: 'STRING',
              description: 'Çözüm adımları. Tüm matematiksel ifadeler $ ... $ içine alınmalı ve ters eğik çizgiler çift kaçırılmalıdır.'
            }
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
      'MATEMATİK VE GEOMETRİ FORMÜL KURALLARI (ZORUNLU):',
      '- Soru metnindeki (text), tüm seçeneklerdeki (options: A, B, C, D) ve açıklamadaki (explanation) TÜM matematiksel ve geometrik ifadeleri, değişkenleri ($x$, $y$), geometrik şekil ve açı sembollerini ($ABC$, $[AB] \\perp [AC]$, $\\widehat{BAC}$), üslü/köklü sayıları ($3^{x-1}$, $x^2$, $\\sqrt{16}$), alt indisli terimleri ($y_K$, $x_A$) ve uzunlukları ($|AB| = 4$) KESİNLİKLE tek dolar ($ ... $) işareti içine alarak yaz.',
      '- JSON formatında geçerli olması için LaTeX komutlarındaki ters eğik çizgileri (\\) MUTLAKA çift ters eğik çizgi ile kaçır (escape et): "\\\\perp", "\\\\parallel", "\\\\widehat", "\\\\frac", "\\\\sqrt", "\\\\circ", "\\\\times", "\\\\cdot". Kesinlikle tek ters eğik çizgi veya geçersiz JSON kaçış karakteri kullanma.',
      '- Kesinlikle dolar işareti olmadan çıplak LaTeX kodu ("3^{x-1}", "x_A", "\\perp") üretme.',
      'GÖRSEL VE ŞEMA KURALI (ZORUNLU):',
      '- "Geometrik Şekiller", "Üçgenler", "Dörtgenler", "Açılar", "Alan", "Çevre", "Sayı Doğrusu", "Veri Analizi / Grafikler", "Kesirler", "Doğal Sayılar (Basamak Tablosu / Abaküs)" gibi konularda veya sorunun metninde "Şekildeki...", "Yukarıdaki şemada...", "Verilen şekilde...", "grafikte", "tabloda" gibi ifadeler varsa "svg" ALANININ RENKLİ VE DOLU OLMASI KESİNLİKLE ZORUNLUDUR.',
      '- Soruda "Şekildeki ABC üçgeni..." yazıp "svg" alanını boş bırakmak KESİNLİKLE YASAKTIR. Soruda bahsedilen şekil, üçgen, açı, çadır, çokgen veya şema mutlaka "svg" alanında görselleştirilmelidir.',
      '- SVG içinde köşe harfleri (A, B, C), kenar uzunlukları, verilen açı dereceleri (örn: 40°, 70°), tepe noktası net ve okunaklı <text> etiketleriyle yerleştirilmelidir.',
      'SVG KURALLARI (ZORUNLU):',
      '- Kök etiket: <svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg"> (örn: viewBox="0 0 500 260").',
      '- Yalnızca şu güvenli etiketleri kullan: <svg>, <g>, <rect>, <circle>, <ellipse>, <line>, <polyline>, <polygon>, <path>, <text>, <tspan>. Asla <style>, <defs>, <linearGradient>, <image> veya HTML etiketleri kullanma.',
      '- SVG <text> veya <tspan> etiketleri içinde KaTeX ve ham LaTeX sözdizimi ($, \\, {, }, ^) KESİNLİKLE KULLANILMAZ.',
      '- Üslü ifadeler için: <text x="100" y="50">x<tspan dy="-6" font-size="10">2</tspan><tspan dy="6"> </tspan></text> yapısını veya doğrudan Unicode karakterlerini (², ³, ˣ) kullan.',
      '- Alt indisler için: <text x="100" y="50">y<tspan dy="4" font-size="10">K</tspan><tspan dy="-4"> </tspan></text> yapısını veya doğrudan Unicode karakterlerini (₁, ₂, ₖ) kullan.',
      '- Sayısal özniteliklere (width, height, x, y, cx, cy, r, rx, ry, x1, y1, x2, y2, stroke-width, font-size, dx, dy) ASLA "px" veya birim yazma; yalnızca saf sayı yaz (örn: width="500", font-size="14", stroke-width="2").',
      '- Renkler (fill, stroke): Canlı ve modern renkler kullan (örn: mavi #2563eb, yeşil #16a34a, turuncu #ea580c, sarı #f59e0b, mor #7c3aed, kırmızı #dc2626, nötr zemin #f8fafc, çerçeve #cbd5e1). Sadece hex (#...) veya temel isim (none, black, white, red, blue, green, gray, orange, purple, yellow) kabul edilir.',
      '- <text> etiketi içine metni doğrudan yaz (örn: <text x="100" y="50" fill="#1e293b" font-size="14" text-anchor="middle">Milyonlar Bölüğü</text>).',
      'Her soru dört seçenekli (A, B, C, D) olsun ve yalnızca bir doğru cevap içersin.',
      'Sayıları, işlemleri, şemadaki değerleri ve doğru seçeneği birbiriyle %100 tutarlı olacak şekilde dikkatle doğrula.',
      'Açıklama alanında çözümün kısa ve anlaşılır adımlarını ver.',
      'Yalnızca istenen JSON şemasına uyan JSON döndür; Markdown veya fazladan metin ekleme.'
    ].join('\n');

    // Çoklu model desteği ve otomatik geçiş (önce ultra hızlı lite, sonra diğerleri)
    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash'
    ].filter(Boolean);

    let response = null;
    let lastError = null;
    let lastStatus = null;

    for (const model of candidateModels) {
      try {
        const fetchRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
                maxOutputTokens: 4096
              }
            }),
            signal: AbortSignal.timeout(18000)
          }
        );

        if (fetchRes.ok) {
          response = fetchRes;
          break;
        } else {
          lastStatus = fetchRes.status;
          const errorBody = await fetchRes.text();
          console.warn(`[AI] Model ${model} HTTP ${fetchRes.status}:`, errorBody.slice(0, 160));
          if (fetchRes.status === 401 || fetchRes.status === 403) {
            lastStatus = fetchRes.status;
            break; // Yetkilendirme hatası modelden bağımsızdır
          }
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AI] Model ${model} çağrısında hata/zaman aşımı:`, err.message);
      }
    }

    if (!response || !response.ok) {
      if (lastError && (lastError.name === 'TimeoutError' || lastError.name === 'AbortError')) {
        return res.status(504).json({ mesaj: 'Soru üretimi zaman aşımına uğradı. Lütfen yeniden deneyin.' });
      }
      let mesaj = 'Yapay zeka soruları şu anda üretemedi. Lütfen daha sonra tekrar deneyin.';
      if (lastStatus === 429) {
        mesaj = 'Yapay zeka hizmeti şu anda yoğun. Biraz sonra tekrar deneyin.';
      } else if ([401, 403].includes(lastStatus)) {
        mesaj = 'Yapay zeka API anahtarı geçersiz veya yetkisiz. Sunucudaki GEMINI_API_KEY ayarını kontrol edin.';
      } else if (lastStatus === 404) {
        mesaj = 'Yapay zeka modeli bulunamadı. Sunucudaki model yapılandırmasını kontrol edin.';
      } else if (lastStatus === 400) {
        mesaj = 'Yapay zeka isteği reddedildi. Sunucu günlüklerindeki Gemini hatasını kontrol edin.';
      } else if (lastStatus >= 500) {
        mesaj = 'Yapay zeka sağlayıcısı şu anda yanıt veremiyor. Biraz sonra tekrar deneyin.';
      }
      const status = lastStatus === 429 ? 503 : (lastStatus === 401 || lastStatus === 403 ? 401 : 502);
      return res.status(status).json({ mesaj });
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
      preparedQuestions = result.questions.map(q => prepareAIQuestion(q, { topic, grade }));
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

    // Semantik Benzerlik ve Mükerrer Kontrolü
    try {
      const existing = await Soru.find({ grade }).select('text imageFile _id').limit(100).lean();
      for (const q of preparedQuestions) {
        const sim = await checkQuestionSimilarity(q.text, existing);
        q.similarityScore = sim.similarityScore;
        q.isDuplicate = sim.isDuplicate;
        q.similarQuestionId = sim.similarQuestionId;
      }
    } catch (simErr) {
      console.warn('[AI] Benzerlik kontrolü atlandı:', simErr.message);
    }

    // 1. MongoDB'ye Otomatik Taslak Kaydı (F5 Kaybını Önleme)
    let draftRecord = null;
    try {
      draftRecord = await AiQuestionDraft.create({
        title: quiz.title,
        topic,
        grade,
        difficulty: String(difficulty || 'orta').toLowerCase(),
        count,
        questions: preparedQuestions.map(q => ({
          text: q.text,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          svg: q.svg || '',
          status: 'draft',
          similarityScore: q.similarityScore || 0,
          similarQuestionId: q.similarQuestionId || null
        })),
        status: 'draft',
        source: 'ai',
        createdBy: req.session.user.id
      });

      // Merkezi İçerik Havuzuna taslak test kaydı
      await ContentLibrary.create({
        title: quiz.title,
        type: 'ai_test',
        ders: 'matematik',
        grade,
        topic,
        difficulty: String(difficulty || 'orta').toLowerCase(),
        content: {
          description: quiz.description,
          questions: preparedQuestions,
          draftId: draftRecord._id
        },
        metadata: {
          questionCount: preparedQuestions.length,
          draftId: draftRecord._id
        },
        status: 'draft',
        source: 'ai',
        createdBy: req.session.user.id
      });
    } catch (draftErr) {
      console.warn('[AI] Otomatik taslak kaydı hatası:', draftErr.message);
    }

    const draftId = draftRecord ? draftRecord._id.toString() : null;

    res.json({
      draftId,
      quiz: {
        id: draftId,
        draftId,
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        grade: quiz.grade,
        difficulty: quiz.difficulty,
        soruSayisi: quiz.questions.length,
        questions: preparedQuestions
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
      preparedQuestions = questions.map(q => prepareAIQuestion(q, { topic, grade }));
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

  // Taslakları Listele
  router.get('/questions/drafts', requireRole('teacher'), async (req, res) => {
    try {
      const filter = req.session.user.role === 'admin' ? {} : { createdBy: req.session.user.id };
      const drafts = await AiQuestionDraft.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      res.json({
        drafts: drafts.map(d => ({
          id: d._id.toString(),
          title: d.title,
          topic: d.topic,
          grade: d.grade,
          difficulty: d.difficulty,
          count: d.count,
          status: d.status,
          questionCount: d.questions?.length || 0,
          createdAt: d.createdAt
        }))
      });
    } catch (err) {
      res.status(500).json({ mesaj: 'Taslaklar listelenemedi.' });
    }
  });

  // Belirli Taslağı Getir
  router.get('/questions/drafts/:id', requireRole('teacher'), async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz taslak ID.' });
      const draft = await AiQuestionDraft.findById(req.params.id).lean();
      if (!draft) return res.status(404).json({ mesaj: 'Taslak bulunamadı.' });

      res.json({
        draft: {
          id: draft._id.toString(),
          title: draft.title,
          topic: draft.topic,
          grade: draft.grade,
          difficulty: draft.difficulty,
          status: draft.status,
          questions: draft.questions
        }
      });
    } catch (err) {
      res.status(500).json({ mesaj: 'Taslak alınamadı.' });
    }
  });

  // Taslaktaki Soruları Soru Bankasına Aktar
  router.post('/questions/drafts/:id/transfer-to-bank', requireRole('teacher'), async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz taslak ID.' });
      const draft = await AiQuestionDraft.findById(req.params.id);
      if (!draft) return res.status(404).json({ mesaj: 'Taslak bulunamadı.' });

      // İstemciden seçili soru indeksleri geldiyse filtrele
      const selectedIndices = Array.isArray(req.body?.questionIndices) && req.body.questionIndices.length > 0
        ? new Set(req.body.questionIndices.map(Number))
        : null;

      const rawDiff = String(draft.difficulty || 'orta').trim().toLowerCase();
      const normalizedDifficulty = ['kolay', 'orta', 'zor'].includes(rawDiff) ? rawDiff : 'orta';
      const userId = req.session?.user?.id || req.session?.user?._id || 'teacher';

      const transferred = [];
      const errors = [];

      for (let idx = 0; idx < draft.questions.length; idx++) {
        if (selectedIndices && !selectedIndices.has(idx)) continue;
        const q = draft.questions[idx];
        if (q.status === 'rejected') continue;

        try {
          const formattedOptions = Array.isArray(q.options)
            ? q.options
            : (q.options && typeof q.options === 'object'
              ? Object.entries(q.options).map(([label, text]) => ({ label: String(label).toUpperCase(), text: String(text || '') }))
              : []);

          const svgContent = typeof q.svg === 'string'
            ? q.svg
            : (q.svg && typeof q.svg === 'object' ? (safeSvg.validate(q.svg) || JSON.stringify(q.svg)) : '');

          const soru = await Soru.create({
            format: 'text_svg',
            text: q.text,
            options: formattedOptions,
            explanation: q.explanation || '',
            svg: svgContent,
            grade: Number(draft.grade) || 8,
            topic: draft.topic || 'Genel',
            difficulty: normalizedDifficulty,
            ders: 'matematik',
            answer: q.answer || 'A',
            source: 'ai_generated',
            draftId: draft._id,
            curriculum_node_id: q.curriculum_node_id || null,
            createdBy: userId
          });

          // Pinecone Vektör İndeksleme (arka planda)
          indexQuestionInPinecone(soru._id, q.text, {
            grade: draft.grade,
            topic: draft.topic,
            difficulty: normalizedDifficulty
          }).catch(err => console.warn('[AI] Pinecone indeksleme atlandı:', err.message));

          // Merkezi İçerik Havuzuna onaylı tekil soru kaydı
          await ContentLibrary.create({
            title: `[${draft.grade}. Sınıf] ${q.text.slice(0, 80)}...`,
            type: 'ai_question',
            ders: 'matematik',
            grade: Number(draft.grade) || 8,
            topic: draft.topic || 'Genel',
            difficulty: normalizedDifficulty,
            content: {
              text: q.text,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
              svg: svgContent,
              soruId: soru._id
            },
            status: 'approved',
            source: 'ai',
            createdBy: userId
          });

          q.status = 'approved';
          q.approvedQuestionId = soru._id;
          transferred.push(soru._id.toString());
        } catch (itemErr) {
          console.error(`[AI] Soru #${idx} aktarma hatası:`, itemErr);
          errors.push(`Soru #${idx + 1}: ${itemErr.message}`);
        }
      }

      if (transferred.length === 0 && errors.length > 0) {
        return res.status(500).json({
          mesaj: 'Sorular soru bankasına aktarılamadı: ' + errors[0]
        });
      }

      draft.status = 'approved';
      await draft.save();

      res.json({
        success: true,
        mesaj: `${transferred.length} soru Soru Bankasına başarıyla aktarıldı ve Pinecone'a indekslendi.`,
        transferredCount: transferred.length,
        transferredIds: transferred
      });
    } catch (err) {
      console.error('[AI] Soru bankasına aktarma hatası:', err);
      res.status(500).json({ mesaj: 'Sorular soru bankasına aktarılamadı: ' + (err.message || 'Bilinmeyen hata') });
    }
  });

  // Taslağı Doğrudan PDF veya DOCX Olarak Dışa Aktar (GET ve POST destekler)
  router.route('/questions/drafts/:id/export').all(requireRole('teacher'), async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz taslak ID.' });
      const draft = await AiQuestionDraft.findById(req.params.id).lean();
      if (!draft) return res.status(404).json({ mesaj: 'Taslak bulunamadı.' });

      const format = String(req.query?.format || req.body?.format || 'pdf').toLowerCase();
      const fileBuffer = exportQuestions(draft.questions, {
        title: draft.title,
        grade: draft.grade,
        topic: draft.topic,
        difficulty: draft.difficulty,
        format
      });

      const contentType = format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

      const filename = `soru-kitapcigi-${draft.grade}-sinif-${Date.now()}.${format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileBuffer);
    } catch (err) {
      console.error('[AI] Taslak export hatası:', err);
      res.status(500).json({ mesaj: 'Taslak dışa aktarılamadı.' });
    }
  });

  // Taslak Sil
  router.delete('/questions/drafts/:id', requireRole('teacher'), async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ mesaj: 'Geçersiz taslak ID.' });
      const del = await AiQuestionDraft.findByIdAndDelete(req.params.id);
      if (!del) return res.status(404).json({ mesaj: 'Taslak bulunamadı.' });
      res.json({ mesaj: 'Taslak silindi.' });
    } catch (err) {
      res.status(500).json({ mesaj: 'Taslak silinemedi.' });
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
