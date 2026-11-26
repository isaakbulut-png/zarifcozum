const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { ObjectId } = require('mongodb');
const { prepareQuestion } = require('../lib/quiz-content');
const safeSvg = require('../assets/safe-svg');
const visualRenderer = require('../assets/maarif-visual-renderer');
const { normalizeBareMath } = require('../assets/math-text');
const Soru = require('../models/Soru');
const { canUserUseProModel, checkAndConsumeQuota } = require('../middleware/aiQuota');
const AiQuestionDraft = require('../models/AiQuestionDraft');
const ContentLibrary = require('../models/ContentLibrary');
const CurriculumContent = require('../models/CurriculumContent');
const { checkQuestionSimilarity, indexQuestionInPinecone } = require('../lib/content-similarity');
const { exportQuestions } = require('../lib/document-exporter');

const { SINIF_KONULARI, TUM_KONULAR } = require('../lib/konu-haritasi');
const { getCurriculumTree, findSubTopicMeta, SINIF_KONULARI_V2 } = require('../lib/meb-curriculum');

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
const konular = new Set([...eskiKonular, ...TUM_KONULAR, ...Object.values(SINIF_KONULARI_V2).flat()]);
const zorluklar = new Set(['Kolay', 'Orta', 'Zor']);
const seceneklerOrtaokul = ['A', 'B', 'C', 'D'];
const seceneklerLise = ['A', 'B', 'C', 'D', 'E'];
const secenekler = seceneklerLise;

function getSecenekler(grade) {
  const g = Number(grade);
  return g >= 9 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
}

const soruUretmeSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla soru üretme isteği. 15 dakika sonra tekrar deneyin.' }
});

function isValidQuestion(question, grade) {
  if (!question || typeof question.text !== 'string' || !question.text.trim()) return false;
  if (question.text.length > 3500) return false;

  // Açık Uçlu Maarif Modeli sorusu kontrolü: solution/explanation ve rubric
  const hasSolution = (typeof question.solution === 'string' && question.solution.trim().length > 0) ||
                      (typeof question.explanation === 'string' && question.explanation.trim().length > 0);
  const hasRubric = Array.isArray(question.rubric) && question.rubric.length > 0;
  if (hasSolution && (hasRubric || !question.options)) {
    return true;
  }

  // Çoktan seçmeli soru kontrolü
  const targetGrade = grade || question.grade || question.sinif;
  const activeSecenekler = getSecenekler(targetGrade);
  if (question.options && typeof question.options === 'object') {
    return activeSecenekler.every(letter =>
      typeof question.options[letter] === 'string' &&
      question.options[letter].trim().length > 0 &&
      question.options[letter].length <= 500
    ) && activeSecenekler.includes(question.answer);
  }

  return Boolean(hasSolution);
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
  // 5 Parçalı Profesyonel Soru Şeması normalizasyonu
  const bilgiKutusu = normalizeBareMath(question.bilgiKutusu || '');
  const senaryo = normalizeBareMath(question.senaryo || '');
  const soruKoku = normalizeBareMath(question.soruKoku || '');
  const rawCombinedText = (question.text && question.text.trim())
    ? question.text
    : [bilgiKutusu, senaryo, soruKoku].filter(Boolean).join('\n\n');
  const normalizedText = normalizeBareMath(rawCombinedText || '');
  const rawSolution = question.solution || question.explanation || '';
  const normalizedSolution = normalizeBareMath(rawSolution);
  const celdiriciAnalizi = normalizeBareMath(question.celdiriciAnalizi || '');
  const bilisselDuzey = String(question.bilisselDuzey || 'Uygulama').trim();
  
  const activeGrade = context.grade || question.grade || question.sinif;
  const activeSecenekler = getSecenekler(activeGrade);

  let normalizedOptions = null;
  if (question.options && typeof question.options === 'object') {
    normalizedOptions = {};
    for (const letter of activeSecenekler) {
      if (question.options[letter]) {
        normalizedOptions[letter] = normalizeBareMath(question.options[letter] || '');
      }
    }
  }

  // 1. Önce yapısal visualSpec'ten deterministik, hatasız SVG üret
  let cleanSvg = '';
  let resolvedVisualSpec = (question.visualSpec && typeof question.visualSpec === 'object' && question.visualSpec.type && question.visualSpec.type !== 'none')
    ? question.visualSpec
    : null;

  if (resolvedVisualSpec) {
    cleanSvg = visualRenderer.renderToSvg(resolvedVisualSpec) || '';
  }

  // 2. Ham SVG geldiyse kullan
  if (!cleanSvg && typeof question.svg === 'string' && question.svg.trim().startsWith('<svg')) {
    cleanSvg = question.svg.trim();
  } else if (!cleanSvg && question.svg && typeof question.svg === 'object') {
    cleanSvg = safeSvg.validate(question.svg);
  }

  // 3. Hâlâ görsel yoksa (özellikle 5-6. sınıf ve görsel konular) metinden akıllı deterministik görsel üret
  if (!cleanSvg) {
    const inferredSpec = visualRenderer.inferVisualSpecFromText(normalizedText, context.subTopic || context.unitTopic || context.topic, activeGrade);
    if (inferredSpec) {
      resolvedVisualSpec = inferredSpec;
      cleanSvg = visualRenderer.renderToSvg(inferredSpec) || '';
    }
  }
  if (!cleanSvg) {
    const fallbackSvg = generatePedagogicalSvg(normalizedText, context.subTopic || context.unitTopic || context.topic, activeGrade);
    if (fallbackSvg) cleanSvg = fallbackSvg;
  }

  // Analitik Değerlendirme Rubriği normalizasyonu
  let normalizedRubric = [];
  if (Array.isArray(question.rubric)) {
    normalizedRubric = question.rubric.map(r => ({
      criterion: normalizeBareMath(r.criterion || r.kriter || ''),
      points: Number(r.points || r.puan || 0)
    })).filter(r => r.criterion && r.points > 0);
  }

  const isMultipleChoice = normalizedOptions && activeSecenekler.every(l => Boolean(normalizedOptions[l]));
  const questionType = isMultipleChoice ? 'multiple_choice' : 'open_ended';

  return {
    text: normalizedText,
    bilgiKutusu,
    senaryo,
    soruKoku,
    bilisselDuzey,
    celdiriciAnalizi,
    solution: normalizedSolution,
    explanation: normalizedSolution,
    rubric: normalizedRubric,
    outcomeCode: question.outcomeCode || context.outcomeCode || '',
    unitTopic: context.unitTopic || '',
    subTopic: context.subTopic || context.topic || '',
    questionType,
    ...(normalizedOptions ? { options: normalizedOptions, answer: question.answer || 'A' } : { options: {} }),
    ...(resolvedVisualSpec ? { visualSpec: resolvedVisualSpec } : {}),
    ...(cleanSvg ? { svg: cleanSvg } : {})
  };
}

function openEndedSoruSemasi() {
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
              description: 'Türkiye Yüzyılı Maarif Modeli standartlarında, günlük yaşam senaryolu, ezbere dayalı olmayan, kavramsal muhakeme ve akıl yürütme ölçen açık uçlu soru metni. Tüm matematiksel ifadeler tek dolar $...$ içinde ve kaçırılmış LaTeX (\\\\frac, \\\\sqrt) ile yazılmalıdır.'
            },
            svg: {
              type: 'STRING',
              description: 'Görsel, şema veya tablo gerektiren sorularda geçerli ve sade <svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">...</svg> kodu; görsel gerekmiyorsa boş metin.'
            },
            solution: {
              type: 'STRING',
              description: 'Öğrencinin sergilemesi beklenen adım adım çözüm süreci, modelleme ve mantıksal gerekçelendirme. Tüm matematiksel ifadeler $...$ içine alınmalıdır.'
            },
            rubric: {
              type: 'ARRAY',
              description: 'Sorunun 100 puan üzerinden analitik değerlendirme rubriği ve puan dağılımı (2-4 kriter).',
              items: {
                type: 'OBJECT',
                properties: {
                  criterion: {
                    type: 'STRING',
                    description: 'Değerlendirilen çözüm adımı veya kavramsal beceri (örn: "Problem durumunu matematiksel olarak modelleme ve değişkenleri belirleme").'
                  },
                  points: {
                    type: 'INTEGER',
                    description: 'Bu kriterin puan karşılığı (örn: 25, 50).'
                  }
                },
                required: ['criterion', 'points']
              }
            },
            outcomeCode: {
              type: 'STRING',
              description: 'İlgili MEB kazanım kodu (örn: MAT.5.1.1).'
            }
          },
          required: ['text', 'solution', 'rubric']
        }
      }
    },
    required: ['questions']
  };
}

function soruSemasi(grade = 5) {
  const activeSecenekler = getSecenekler(grade);
  const secenekSemasi = {
    type: 'OBJECT',
    properties: Object.fromEntries(activeSecenekler.map(letter => [letter, {
      type: 'STRING',
      description: `${letter} seçeneği metni. Tüm matematiksel ifadeler tek dolar $ ... $ içinde ve geçerli kaçırılmış LaTeX ile yazılmalıdır (örn: "$3^{x-1}$", "$[AB] \\\\perp [AC]$").`
    }])),
    required: activeSecenekler
  };
  return {
    type: 'OBJECT',
    properties: {
      questions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            bilgiKutusu: {
              type: 'STRING',
              description: 'Opsiyonel MEB ön bilgi veya kural hatırlatma kutusu (kısa 1 cümle; gerekmiyorsa boş metin).'
            },
            senaryo: {
              type: 'STRING',
              description: 'Yaş grubuna uygun, kısa ve somut günlük hayat bağlam metni.'
            },
            soruKoku: {
              type: 'STRING',
              description: 'Tek bir net soru cümlesi (örn: "Buna göre ... kaçtır?").'
            },
            bilisselDuzey: {
              type: 'STRING',
              enum: ['Hatırlama', 'Anlama', 'Uygulama', 'Analiz', 'Değerlendirme']
            },
            text: {
              type: 'STRING',
              description: 'Senaryo ve soru kökünün tam birleşik metni. Tüm matematiksel ifadeler tek dolar $ ... $ içine alınmalı ve ters eğik çizgiler çift kaçırılmalıdır (\\\\frac, \\\\perp).'
            },
            visualSpec: {
              type: 'OBJECT',
              description: 'Deterministik SVG görsel motoru için yapısal görsel tarifi (5-6. sınıfta neredeyse her soruda doldurulmalıdır!).',
              properties: {
                type: {
                  type: 'STRING',
                  enum: ['none', 'place_value_table', 'fraction_model', 'number_line', 'grid_geometry', 'bar_chart', 'data_table']
                },
                title: { type: 'STRING', description: 'Görsel başlığı (örn: "Şekil 1: Bahçe Krokisi" veya "Tablo 1: Kitap Sayıları").' },
                dataJson: { type: 'STRING', description: 'Görsel türüne uygun JSON stringi. Örn fraction_model: {"numerator":3,"denominator":4,"style":"bar"}; place_value_table: {"number":"42307085"}; grid_geometry: {"shape":"rectangle","widthLabel":"12 cm","heightLabel":"8 cm"}; bar_chart: {"items":[{"label":"Pzt","value":12},{"label":"Sal","value":18}]}; data_table: {"headers":["Ürün","Fiyat"],"rows":[["Defter","25 TL"],["Kalem","12 TL"]]}; number_line: {"min":0,"max":4,"steps":8,"markers":[{"label":"A","value":1.5}]}' }
              },
              required: ['type', 'title', 'dataJson']
            },
            svg: {
              type: 'STRING',
              description: 'visualSpec none ise ve özel geometri çizimi gerekiyorsa geçerli <svg viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg">...</svg> kodu; aksi halde boş metin.'
            },
            options: secenekSemasi,
            answer: { type: 'STRING', enum: activeSecenekler },
            celdiriciAnalizi: {
              type: 'STRING',
              description: 'Yanlış seçeneklerin (çeldiricilerin) hangi tipik öğrenci hatasından veya kavram yanılgısından türetildiğinin kısa özeti.'
            },
            explanation: {
              type: 'STRING',
              description: 'Çözüm adımları ve Çeldirici Analizi: Doğru cevabın adım adım çözümü ile yanlış seçeneklerin (çeldiricilerin) öğrencilerin hangi kavram yanılgılarını veya işlem hatalarını ölçtüğü. Tüm matematiksel ifadeler $ ... $ içine alınmalı ve ters eğik çizgiler çift kaçırılmalıdır.'
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

  router.get('/konular', (req, res) => {
    res.json({
      tree: getCurriculumTree(),
      konular: SINIF_KONULARI_V2
    });
  });

  // Soru için AI Geometrik Şekil ve Çizim Üretici (3'lü Merkez - c maddesi)
  router.post('/cizim-uret', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        return res.status(400).json({ mesaj: 'Lütfen çizilmesini istediğiniz şekli tarif edin.' });
      }

      const lower = prompt.toLowerCase();
      let svg = null;

      // 1. Çember ve İç Üçgen / Teğet
      if ((lower.includes('çember') || lower.includes('daire')) && (lower.includes('üçgen') || lower.includes('teğet'))) {
        const rMatch = prompt.match(/(\d+)\s*(?:cm|birim)?/i);
        const rVal = rMatch ? rMatch[1] + ' cm' : '5 cm';
        svg = `<svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="300" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="250" cy="150" r="90" fill="#f8fafc" stroke="#2563eb" stroke-width="2.5"/>
  <circle cx="250" cy="150" r="4" fill="#1e293b"/>
  <text x="238" y="145" font-size="14" font-weight="bold" fill="#1e293b">O</text>
  <line x1="250" y1="150" x2="340" y2="150" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,3"/>
  <text x="285" y="142" font-size="12" font-weight="bold" fill="#dc2626">r = ${rVal}</text>
  <polygon points="250,60 172,195 328,195" fill="none" stroke="#16a34a" stroke-width="2.5"/>
  <circle cx="250" cy="60" r="4" fill="#16a34a"/>
  <circle cx="172" cy="195" r="4" fill="#16a34a"/>
  <circle cx="328" cy="195" r="4" fill="#16a34a"/>
  <text x="250" y="48" font-size="14" font-weight="bold" fill="#16a34a" text-anchor="middle">A</text>
  <text x="156" y="208" font-size="14" font-weight="bold" fill="#16a34a">B</text>
  <text x="336" y="208" font-size="14" font-weight="bold" fill="#16a34a">C</text>
  <text x="250" y="275" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">O Merkezli Çember ve İç Teğet Üçgen (r = ${rVal})</text>
</svg>`.trim();
      } else if (lower.includes('koordinat') || lower.includes('kartezyen') || lower.includes('parabol') || lower.includes('grafik') || lower.includes('doğru grafiği')) {
        svg = `<svg viewBox="0 0 500 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="280" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <line x1="50" y1="140" x2="450" y2="140" stroke="#1e293b" stroke-width="2"/>
  <polygon points="455,140 445,135 445,145" fill="#1e293b"/>
  <text x="460" y="145" font-size="14" font-weight="bold" fill="#1e293b">x</text>
  <line x1="250" y1="260" x2="250" y2="30" stroke="#1e293b" stroke-width="2"/>
  <polygon points="250,25 245,35 255,35" fill="#1e293b"/>
  <text x="255" y="32" font-size="14" font-weight="bold" fill="#1e293b">y</text>
  <circle cx="250" cy="140" r="3" fill="#1e293b"/>
  <text x="238" y="155" font-size="12" fill="#64748b">O</text>
  <line x1="120" y1="230" x2="380" y2="50" stroke="#2563eb" stroke-width="3"/>
  <text x="390" y="65" font-size="13" font-weight="bold" fill="#2563eb">d: y = ax + b</text>
  <text x="250" y="265" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">Kartezyen Koordinat Sistemi ve Doğru Grafiği</text>
</svg>`.trim();
      } else if (lower.includes('dik üçgen') || lower.includes('pisagor') || lower.includes('hipotenüs')) {
        svg = `<svg viewBox="0 0 500 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="280" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <polygon points="120,60 120,220 380,220" fill="#eff6ff" stroke="#2563eb" stroke-width="3" stroke-linejoin="round"/>
  <rect x="120" y="200" width="20" height="20" fill="none" stroke="#dc2626" stroke-width="2"/>
  <circle cx="130" cy="210" r="2.5" fill="#dc2626"/>
  <circle cx="120" cy="60" r="5" fill="#1e293b"/>
  <circle cx="120" cy="220" r="5" fill="#1e293b"/>
  <circle cx="380" cy="220" r="5" fill="#1e293b"/>
  <text x="105" y="55" font-size="16" font-weight="bold" fill="#1e293b">A</text>
  <text x="105" y="235" font-size="16" font-weight="bold" fill="#1e293b">B</text>
  <text x="395" y="225" font-size="16" font-weight="bold" fill="#1e293b">C</text>
  <text x="90" y="145" font-size="13" font-weight="bold" fill="#2563eb">c</text>
  <text x="250" y="240" font-size="13" font-weight="bold" fill="#2563eb">a</text>
  <text x="260" y="130" font-size="13" font-weight="bold" fill="#dc2626">b (Hipotenüs)</text>
  <text x="250" y="265" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">ABC Dik Üçgeni [m(B) = 90°]</text>
</svg>`.trim();
      } else {
        svg = generatePedagogicalSvg(prompt, prompt, 8);
      }

      if (!svg) {
        svg = generatePedagogicalSvg(prompt, 'geometri', 8);
      }

      res.json({ basarili: true, svg });
    } catch (err) {
      console.error('Cizim uretme hatasi:', err);
      res.status(500).json({ mesaj: 'Şekil üretilemedi: ' + err.message });
    }
  });

  router.post('/questions', requireRole('teacher'), soruUretmeSiniri, async (req, res) => {
    const grade = Number(req.body?.grade);
    const ders = typeof req.body?.ders === 'string' ? req.body.ders.trim() : 'Matematik';
    const unit_topic = typeof req.body?.unit_topic === 'string' ? req.body.unit_topic.trim() : (req.body?.tema || '');
    const sub_topic = typeof req.body?.sub_topic === 'string' ? req.body.sub_topic.trim() : (req.body?.alt_konu || req.body?.topic || '');
    const difficulty = typeof req.body?.difficulty === 'string' ? req.body.difficulty : 'Orta';
    const count = Number(req.body?.count) || 5;
    const rawWorkType = typeof req.body?.workType === 'string' ? req.body.workType.trim() : '';
    const TYMM_WORK_TYPES = {
      coktan_secmeli: {
        questionType: 'multiple_choice',
        label: 'Çoktan Seçmeli Öğrenme Çıktısı Testi',
        promptRule: 'ÇALIŞMA TÜRÜ — ÇOKTAN SEÇMELİ ÖĞRENME ÇIKTISI TESTİ: Her soru doğrudan seçili öğrenme çıktısını ve kavramsal anlamayı ölçen, çeldiricileri gerçek kavram yanılgılarından üretilmiş nitelikli çoktan seçmeli soru olsun.'
      },
      baglam_temelli: {
        questionType: 'multiple_choice',
        label: 'Bağlam Temelli Beceri Sorusu (TYMM)',
        promptRule: 'ÇALIŞMA TÜRÜ — BAĞLAM TEMELLİ BECERİ SORUSU (TYMM): Her soruyu gerçek yaşam bağlamı, tablo/grafik/model yorumlama, matematiksel muhakeme ve üst düzey problem çözme becerisi gerektiren özgün Maarif Modeli beceri sorusu olarak kurgula.'
      },
      acik_uclu: {
        questionType: 'open_ended',
        label: 'Açık Uçlu & Gerekçelendirme Sorusu (Rubrikli)',
        promptRule: 'ÇALIŞMA TÜRÜ — AÇIK UÇLU & GEREKÇELENDİRME SORUSU (RUBRİKLİ): Öğrencinin çözüm adımlarını, matematiksel gerekçesini ve karar mantığını açıklayarak yazmasını gerektiren açık uçlu sorular ve 100 puanlık analitik rubrik üret.'
      },
      tanilayici_hizli: {
        questionType: 'multiple_choice',
        label: 'Tanılayıcı Hızlı Araçlar (Doğru/Yanlış & Yapılandırılmış Grid)',
        promptRule: 'ÇALIŞMA TÜRÜ — TANILAYICI HIZLI ARAÇLAR (DOĞRU/YANLIŞ & YAPILANDIRILMIŞ GRİD): Kavram yanılgılarını hızla tespit eden, kısa öncüllü (I, II, III doğru/yanlış veya ızgara/kutucuk seçimli) biçimlendirici tanı soruları üret.'
      },
      performans_gorevi: {
        questionType: 'open_ended',
        label: 'Ünite Performans & Süreç Görevi',
        promptRule: 'ÇALIŞMA TÜRÜ — ÜNİTE PERFORMANS & SÜREÇ GÖREVİ: Öğrencinin adım adım modelleme, veri toplama, hesaplama ve değerlendirme yapacağı uygulamalı çalışma kâğıdı / performans görevi ve süreç değerlendirme rubriği üret.'
      }
    };
    const workTypeConfig = TYMM_WORK_TYPES[rawWorkType] || null;
    const workType = workTypeConfig ? rawWorkType : (req.body?.questionType === 'multiple_choice' ? 'coktan_secmeli' : 'acik_uclu');
    const questionType = workTypeConfig
      ? workTypeConfig.questionType
      : (req.body?.questionType === 'multiple_choice' ? 'multiple_choice' : 'open_ended');

    // Müfredat ve alt konu çözümlemesi
    const subMeta = findSubTopicMeta(grade, unit_topic, sub_topic);
    const resolvedUnit = subMeta?.unit_topic || unit_topic || 'Genel Konu';
    const resolvedSub = subMeta?.name || sub_topic || 'Genel';
    const outcomeCode = subMeta?.outcome_code || '';
    const officialBoundary = subMeta?.official_boundary || '';

    const validGrade = Number.isInteger(grade) && grade >= 5 && grade <= 12;
    const validCount = [1, 3, 5, 10, 15, 20].includes(count);

    if (!validGrade || !zorluklar.has(difficulty) || !validCount || !resolvedSub) {
      return res.status(400).json({ mesaj: 'Sınıf, konu, zorluk veya soru sayısı seçimi geçersiz.' });
    }

    const apiKey = String(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
    if (!apiKey) {
      console.error('GEMINI_API_KEY eksik. Ortam değişkenleri dosyasına veya hosting ayarlarına GEMINI_API_KEY ekleyin.');
      return res.status(503).json({ mesaj: 'Yapay zeka hizmeti henüz yapılandırılmamış. GEMINI_API_KEY değerini sunucu ortamına ekleyin.' });
    }

    // 1. Veritabanı Soru Havuzu Önbelleği (Question Pool Cache - 0 Token Tasarrufu)
    const forceFresh = Boolean(req.body?.forceFresh);
    let cachedPoolQuestions = [];

    if (!forceFresh) {
      try {
        const found = await Soru.find({
          grade,
          topic: resolvedSub,
          difficulty: difficulty.toLowerCase(),
          text: { $exists: true, $ne: '' }
        }).limit(count).lean();

        if (found && found.length > 0) {
          cachedPoolQuestions = found.map(s => {
            let opts = {};
            if (Array.isArray(s.options)) {
              s.options.forEach(o => { if (o && o.label) opts[o.label] = o.text || ''; });
            } else if (s.options && typeof s.options === 'object') {
              opts = s.options;
            }
            return {
              text: s.text,
              options: opts,
              answer: s.answer || null,
              solution: s.solution || s.explanation || '',
              explanation: s.explanation || s.solution || '',
              rubric: s.rubric || [],
              outcomeCode: s.outcomeCode || outcomeCode,
              questionType: s.questionType || (Object.keys(opts).length >= 4 ? 'multiple_choice' : 'open_ended'),
              svg: typeof s.svg === 'string' ? s.svg : (s.svg ? JSON.stringify(s.svg) : '')
            };
          }).filter(isValidQuestion);
        }
      } catch (cacheErr) {
        console.warn('[AI] Soru havuzu önbellek okuma hatası:', cacheErr.message);
      }
    }

    // Eğer havuzda istenen soru sayısının tamamı hazır varsa API'ye hiç gitme (0 Token, Anında Yanıt)
    if (cachedPoolQuestions.length >= count) {
      const preparedQuestions = cachedPoolQuestions.slice(0, count).map(q => prepareAIQuestion(q, {
        topic: resolvedSub,
        subTopic: resolvedSub,
        unitTopic: resolvedUnit,
        grade,
        outcomeCode
      }));
      const quiz = {
        title: `${resolvedUnit} / ${resolvedSub} — ${difficulty} seviye (Havuzdan)`,
        description: `${count} soruluk soru havuzu çalışma testi.`,
        topic: resolvedSub,
        unit_topic: resolvedUnit,
        sub_topic: resolvedSub,
        grade,
        difficulty,
        questions: preparedQuestions
      };

      let draftRecord = null;
      try {
        draftRecord = await AiQuestionDraft.create({
          title: quiz.title,
          topic: resolvedSub,
          grade,
          difficulty: String(difficulty || 'orta').toLowerCase(),
          count,
          questions: preparedQuestions.map(q => ({
            text: q.text,
            options: q.options || {},
            answer: q.answer || null,
            explanation: q.explanation || '',
            solution: q.solution || '',
            rubric: q.rubric || [],
            outcomeCode: q.outcomeCode || outcomeCode,
            questionType: q.questionType || 'open_ended',
            svg: q.svg || '',
            status: 'draft',
            similarityScore: 0,
            similarQuestionId: null
          })),
          status: 'draft',
          source: 'pool_cache',
          createdBy: req.session.user.id
        });
      } catch (draftErr) {
        console.warn('[AI] Havuz taslak kaydı hatası:', draftErr.message);
      }

      const draftId = draftRecord ? draftRecord._id.toString() : null;

      // AI Maliyet & Tasarruf Logu (Cache Hit)
      try {
        const { recordAiUsage } = require('../lib/ai-usage-tracker');
        recordAiUsage({
          kullaniciId: req.session.user?.id,
          kullaniciAdi: req.session.user?.name,
          kullaniciRol: req.session.user?.role || 'teacher',
          modul: 'Soru Sihirbazı',
          modelAdi: 'Havuz Önbelleği',
          cacheHit: true,
          durum: 'cache_hit',
          detay: { soruSayisi: count, topic: resolvedSub, grade, difficulty }
        });
      } catch (logErr) {}

      return res.json({
        fromCache: true,
        draftId,
        quiz: {
          id: draftId,
          draftId,
          title: quiz.title,
          description: quiz.description,
          topic: quiz.topic,
          unit_topic: quiz.unit_topic,
          sub_topic: quiz.sub_topic,
          grade: quiz.grade,
          difficulty: quiz.difficulty,
          soruSayisi: quiz.questions.length,
          questions: preparedQuestions
        }
      });
    }

    // Eksik kalan soru adedi kadar API'den talep et
    const neededCount = count - cachedPoolQuestions.length;

    // Hazır havuzdan karşılanamayan her yeni soru için öğretmen kotasını kontrol et
    if (neededCount > 0 && req.session.user) {
      try {
        const freshUser = await User.findById(req.session.user.id || req.session.user._id);
        const quotaCheck = await checkAndConsumeQuota(freshUser, 'question', neededCount);
        if (!quotaCheck.allowed) {
          return res.status(quotaCheck.status || 429).json({
            error: quotaCheck.error || 'QUOTA_EXCEEDED',
            mesaj: quotaCheck.message,
            limit: quotaCheck.limit,
            kullanilan: quotaCheck.kullanilan
          });
        }
      } catch (quotaErr) {
        console.warn('[AI] Kota kontrol hatası:', quotaErr.message);
      }
    }

    // 2. PINECONE KATI METADATA FİLTRELİ RAG SORGUSU
    let ragContext = '';
    try {
      const { getStrictMebContext } = await import('../aiService.mjs');
      ragContext = await getStrictMebContext({
        grade,
        unitTopic: resolvedUnit,
        subTopic: resolvedSub,
        ders
      });
    } catch (ragErr) {
      console.warn('[AI Questions] Strict RAG context uyarısı:', ragErr.message);
      ragContext = `[TÜRKİYE YÜZYILI MAARİF MODELİ RESMÎ MÜFREDAT KAZANIM VE SINIRLARI]\nSınıf: ${grade}. Sınıf\nDers: ${ders}\nTema / Ünite: ${resolvedUnit}\nAlt Konu: ${resolvedSub}\nKazanım: ${outcomeCode}\nResmi Sınırlar: ${officialBoundary}`;
    }

    // 3. TÜRKİYE YÜZYILI MAARİF MODELİ SİSTEM PROMPTU (MOD 2: TEST VE SORU ÜRETİMİ MODU)
    const isLise = grade >= 9;
    const secenekSayisiMetni = isLise
      ? '3. ÇOKTAN SEÇMELİ FORMAT (LİSE): Sorular KESİNLİKLE 5 seçenekli (A, B, C, D, E) ve tek bir doğru cevabı olan sorulardır.'
      : '3. ÇOKTAN SEÇMELİ FORMAT (ORTAOKUL): Sorular KESİNLİKLE 4 seçenekli (A, B, C, D) ve tek bir doğru cevabı olan sorulardır.';

    const kademePedagojisi = Number(grade) === 5
      ? [
          'ÖĞRENİM KADEMESİ: 5. SINIF ÖZEL PEDAGOJİ PROFİLİ (10–11 YAŞ — SOMUT İŞLEMLER DÖNEMİ)',
          '- KESİN YASAK BARİYERİ: Negatif tam sayılar, cebirsel bilinmeyenler ($x$, $y$ ile denklem kurma), oran-orantı formülleri, üslü/köklü ifadeler ve soyut sembolik gösterimler KESİNLİKLE YASAKTIR!',
          '- DİL VE UZUNLUK: En fazla 2–3 kısa, akıcı, 5. sınıf çocuğunun tek okuyuşta kavrayacağı günlük yaşam cümlesi kullan (kırtasiye, pastane, okul bahçesi, harçlık, kareli kağıt, park, kütüphane).',
          '- GÖRSEL ZORUNLULUĞU: 5. sınıf sorularının neredeyse TAMAMINDA "visualSpec" alanını gerçek soru verileriyle doldur (kesir için fraction_model, milyonlu sayılar için place_value_table, çevre/alan/şekil için grid_geometry, veri için bar_chart veya data_table, sıralama için number_line).',
          '- Çoktan seçmeli sorularda seçenek sayısını KESİNLİKLE 4 şıklı (A, B, C, D) oluştur.'
        ].join('\n')
      : Number(grade) === 6
      ? [
          'ÖĞRENİM KADEMESİ: 6. SINIF PEDAGOJİ PROFİLİ (11–12 YAŞ)',
          '- Çarpanlar-katlar, bölünebilme, tam sayılar, kesirler, oran ve temel cebirsel ifadeler düzeyinde kal; 7–8. sınıf denklem sistemleri veya köklü ifadelere girme.',
          '- Görsel destekli (visualSpec: fraction_model, number_line, data_table, bar_chart, grid_geometry) somut günlük hayat problemleri kurgula.',
          '- Çoktan seçmeli sorularda seçenek sayısını KESİNLİKLE 4 şıklı (A, B, C, D) oluştur.'
        ].join('\n')
      : !isLise
      ? [
          `ÖĞRENİM KADEMESİ: ${grade}. SINIF ORTAOKUL / ${Number(grade) === 8 ? 'LGS YENİ NESİL' : 'GEÇİŞ'} DÜZEYİ`,
          '- Günlük hayat bağlamı, bilgi kutusu (bilgiKutusu), tablo/grafik/geometri modeli (visualSpec) ve çok adımlı akıl yürütme ile beceri temelli sorular kurgula.',
          '- Çoktan seçmeli sorularda seçenek sayısını KESİNLİKLE 4 şıklı (A, B, C, D) oluştur.'
        ].join('\n')
      : [
          'ÖĞRENİM KADEMESİ: LİSE DÜZEYİ (9, 10, 11. Sınıflar ve 12. Sınıf YKS)',
          '- Soruları lise öğrencisinin bilişsel düzeyine uygun olgun bir dille; çocuksu ifadelerden uzak kurgula.',
          '- Çok adımlı akıl yürütme, fonksiyon/grafik yorumlama, matematiksel modelleme, veri analizi ve stratejik problem çözme becerilerini ölç.',
          '- Çoktan seçmeli sorularda seçenek sayısını KESİNLİKLE 5 şıklı (A, B, C, D, E) oluştur.'
        ].join('\n');

    const prompt = [
      'Sen, T.C. Millî Eğitim Bakanlığı (MEB) Türkiye Yüzyılı Maarif Modeli ve "Çoktan Seçmeli Soru Yazım Kılavuzu" kurallarına tam hakim bir Ölçme-Değerlendirme ve Matematik Soru Yazım Uzmanısın.',
      '',
      'TEMEL GÖREVİN:',
      `İstenen ${grade}. sınıf ve "${resolvedUnit} - ${resolvedSub}" konusu için tamamen MEB standartlarında, yaş grubuna uygun pedagojik kurguda, beceri temelli nitelikli matematik soruları üretmektir.`,
      `Ders: ${ders}`,
      `Tema / Ünite: ${resolvedUnit}`,
      `Alt Konu: ${resolvedSub}`,
      outcomeCode ? `Kazanım Kodu: ${outcomeCode}` : '',
      `Zorluk: ${difficulty}`,
      `Üretilecek Soru Sayısı: Tam olarak ${neededCount} soru üret.`,
      '',
      'PINECONE DOĞRULANMIŞ RESMÎ KAZANIM SINIRLARI (ZORUNLU - BU SINIRLARIN DIŞINA ÇIKMA):',
      '1. Yalnızca Pinecone bilgi tabanındaki ("ders_kitabi" ve "klavuz") güncel MEB dokümanlarına ve sana sağlanan RAG bağlamına bağlı kal.',
      '2. Soruyu doğrudan ilgili temanın "Öğrenme Çıktıları" ve "Süreç Bileşenleri"ne kilitle. Müfredattan kaldırılan eski konulardan veya üst sınıf kazanımlarından kesinlikle soru üretme. (8. sınıf LGS ve 12. sınıf YKS sınav gruplarında ilgili merkezi sınav müfredat sınırlarına uyulur.)',
      ragContext,
      '',
      'KADEME VE FORMAT STANDARTLARI:',
      kademePedagojisi,
      workTypeConfig ? workTypeConfig.promptRule : '',
      questionType === 'open_ended'
        ? 'AÇIK UÇLU FORMAT: Sorular çoktan seçmeli DEĞİLDİR. Öğrencinin çözüm sürecini, adımlarını ve mantığını yazarak sergilemesini gerektiren AÇIK UÇLU sorulardır.'
        : secenekSayisiMetni,
      '',
      'ÖLÇME-DEĞERLENDİRME VE SORU YAZIM İLKELERİ (KESİNLİKLE UYULMALIDIR):',
      '1. BAĞLAM TEMELLİ KURGU: Ezbere dayalı salt formül uygulatan kuru işlem soruları yazma. Günlük hayat senaryosu içeren, yorumlama ve ilişkilendirme becerilerini ölçen özgün kurgular oluştur.',
      '2. BÜTÜNCÜL YAKLAŞIM: Soruların kurgusuna matematiksel işlemin yanı sıra; ilgili temanın kavramsal becerilerini, görsel okuryazarlığı ve "Erdem-Değer-Eylem Çerçevesi"ni (adalet, tasarruf, sorumluluk, dürüstlük, iş birliği vb.) doğal bir şekilde yerleştir.',
      '3. SORU KÖKÜ VE DİL BİLGİSİ: Soru kökünü yalın, anlaşılır, açık bir Türkçeyle ve tek bir doğru cevaba ulaşılacak kesinlikte yaz. Olumsuz soru köklerini (değildir, olamaz, yanlıştır vb.) vurgulu belirt.',
      '4. SEÇENEKLER VE ÇELDİRİCİLER: Seçenekleri uzunluk, dil bilgisi ve yapı bakımından birbirine paralel kur. Yanlış seçenekleri (çeldiricileri) rastgele sayılardan değil, öğrencilerin o konuda sık yaptığı kavram yanılgılarından veya olası işlem hatalarından üret. Doğru cevabı tek ve tartışmasız kıl.',
      '5. ÇÖZÜM VE ÇELDİRİCİ ANALİZİ (explanation / solution): Doğru cevabın adım adım pedagojik çözümünü ve yanlış şıkların (çeldiricilerin) hangi kavram yanılgısını ölçtüğünü açıkça yaz.',
      questionType === 'open_ended' ? '6. ANALİTİK DEĞERLENDİRME RUBRİĞİ (rubric): Her soru için toplam 100 puan üzerinden 2-4 adımlı analitik puanlama kriterleri (criterion ve points) hazırla.' : '',
      '',
      'MATEMATİK VE GEOMETRİ FORMÜL KURALLARI (ZORUNLU):',
      Number(grade) === 5
        ? '- 5. sınıf düzeyinde kesinlikle $x, y$ bilinmeyenleri kullanma! Kesirleri ($\\frac{3}{4}$), açıları ($65^\\circ$) ve işlemleri tek dolar ($...$) içinde yaz.'
        : '- Soru metnindeki (text), seçeneklerdeki (options) ve çözümdeki (explanation/solution) TÜM matematiksel/geometrik ifadeleri, formülleri, değişkenleri ($x$, $y$), geometrik sembolleri ve sayıları tek dolar ($...$) içine alarak yaz.',
      '- JSON içinde geçerli olması için LaTeX komutlarındaki ters eğik çizgileri MUTLAKA çift ters eğik çizgi ile kaçır: "\\\\perp", "\\\\frac", "\\\\sqrt", "\\\\times", "\\\\cdot".',
      '',
      'YAPISAL GÖRSEL VE ŞEMA KURALI (visualSpec — YÜKSEK ÖNCELİK):',
      '- Görselleştirilebilecek HER soruda (özellikle 5, 6 ve 7. sınıflarda %80+ soruda) mutlaka "visualSpec" nesnesini gerçek soru sayılarıyla doldur!',
      '- Kullanılabilir türler: "place_value_table", "fraction_model", "number_line", "grid_geometry", "bar_chart", "data_table".',
      '- "bilgiKutusu" (varsa kısa kural/ön bilgi), "senaryo" (kısa olay metni), "soruKoku" (net soru cümlesi) ve "celdiriciAnalizi" alanlarını profesyonel yayınevi standardında doldur.',
      '',
      'Yalnızca istenen JSON şemasına uyan JSON döndür; Markdown bloğu veya fazladan açıklama metni ekleme.'
    ].filter(Boolean).join('\n');

    // Güvenli Ajan/Model Doğrulaması (İzin verilen güncel modeller)
    const ALLOWED_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-4-argon'];
    let requestedModel = typeof req.body?.selectedModel === 'string' ? req.body.selectedModel.trim() : '';
    if (requestedModel === 'gemini-2.5-flash') requestedModel = 'gemini-3.8-flash';
    if (requestedModel === 'gemini-2.5-flash-lite') requestedModel = 'gemini-3.1-flash-lite';
    let activeModel = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : 'gemini-3.8-flash';

    // Model İzni Denetimi: Pro modeller sadece Admin ve İçerik Üreticisi öğretmenlere açıktır
    if ((activeModel === 'gemini-2.5-pro' || activeModel === 'gemini-4-argon') && !canUserUseProModel(req.session.user)) {
      activeModel = 'gemini-3.8-flash'; // Yetkisiz öğretmen otomatik flash modeline düşürülür
    }

    // Model zinciri: Öğretmenin seçtiği model öncelikli; gerekirse güvenli güncel flash modellerine fallback
    const candidateModels = [...new Set([
      activeModel,
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite'
    ])].filter(Boolean);

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
              responseSchema: questionType === 'open_ended' ? openEndedSoruSemasi() : soruSemasi(grade),
              maxOutputTokens: 4096
            }
          }),
          signal: AbortSignal.timeout(22000)
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

    // AI Token & Maliyet Loglama
    try {
      const promptTokens = payload.usageMetadata?.promptTokenCount || 0;
      const candidatesTokens = payload.usageMetadata?.candidatesTokenCount || 0;
      const { recordAiUsage } = require('../lib/ai-usage-tracker');
      recordAiUsage({
        kullaniciId: req.session.user?.id,
        kullaniciAdi: req.session.user?.name,
        kullaniciRol: req.session.user?.role || 'teacher',
        modul: 'Soru Sihirbazı',
        modelAdi: activeModel,
        promptTokens,
        candidatesTokens,
        cacheHit: false,
        durum: 'success',
        detay: { soruSayisi: neededCount, topic: resolvedSub, unit_topic: resolvedUnit, grade, difficulty, questionType }
      });
    } catch (logErr) {}
  } catch (error) {
    console.error('Gemini Hatası:', error);
    return res.status(502).json({ mesaj: 'Yapay zeka geçerli soru verisi döndürmedi. Lütfen yeniden deneyin.' });
  }

  if (!Array.isArray(result.questions) || result.questions.length !== neededCount ||
      !result.questions.every(q => isValidQuestion(q, grade))) {
    console.error('Gemini yanıtı beklenen soru biçimini karşılamadı.');
    return res.status(502).json({ mesaj: 'Üretilen sorular doğrulanamadı. Lütfen yeniden deneyin.' });
  }

  let preparedQuestions;
  try {
    const allRawQuestions = [...cachedPoolQuestions, ...result.questions];
    preparedQuestions = allRawQuestions.map(q => prepareAIQuestion(q, {
      topic: resolvedSub,
      subTopic: resolvedSub,
      unitTopic: resolvedUnit,
      grade,
      outcomeCode
    }));
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return res.status(502).json({ mesaj: 'Üretilen sorular doğrulanamadı. Lütfen yeniden deneyin.' });
  }

  const quiz = {
    title: `${resolvedUnit} / ${resolvedSub} — ${difficulty} seviye ${questionType === 'open_ended' ? '(Maarif Modeli Açık Uçlu)' : ''} ${cachedPoolQuestions.length > 0 ? '(Havuz + Yapay Zeka)' : '(Yapay zeka)'}`.trim(),
    description: `${count} soruluk ${questionType === 'open_ended' ? 'açık uçlu Maarif Modeli' : ''} çalışma testi.`,
    topic: resolvedSub,
    unit_topic: resolvedUnit,
    sub_topic: resolvedSub,
    grade,
    difficulty,
    questionType,
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
      topic: resolvedSub,
      grade,
      difficulty: String(difficulty || 'orta').toLowerCase(),
      count,
      questions: preparedQuestions.map(q => ({
        text: q.text,
        options: q.options || {},
        answer: q.answer || null,
        explanation: q.explanation || '',
        solution: q.solution || '',
        rubric: q.rubric || [],
        outcomeCode: q.outcomeCode || outcomeCode,
        questionType: q.questionType || questionType,
        svg: q.svg || '',
        status: 'draft',
        similarityScore: q.similarityScore || 0,
        similarQuestionId: q.similarQuestionId || null
      })),
      status: 'draft',
      source: 'ai',
      createdBy: req.session.user.id
    });

    // 3. Kitle Kaynaklı Havuz Büyütme: Üretilen soruları tek tek onaylı soru olarak havuza ekle
    for (const q of preparedQuestions) {
      try {
        await ContentLibrary.create({
          title: `${resolvedSub} Sorusu (${grade}. Sınıf)`,
          type: 'soru',
          ders: 'matematik',
          grade,
          topic: resolvedSub,
          difficulty: String(difficulty || 'orta').toLowerCase(),
          content: {
            text: q.text,
            options: q.options || {},
            answer: q.answer || null,
            explanation: q.explanation || '',
            solution: q.solution || '',
            rubric: q.rubric || [],
            svg: q.svg || ''
          },
          metadata: {
            kazanim: resolvedSub,
            outcomeCode: q.outcomeCode || outcomeCode,
            unitTopic: resolvedUnit,
            source: 'ai_crowdsourced',
            teacherRole: req.session.user?.ogretmenTipi || 'standart_ogretmen'
          },
          status: 'approved',
          source: 'ai_crowdsourced',
          createdBy: req.session.user.id
        });
      } catch (crowdErr) {
        // Mükerrer veya sessiz geçiş
      }
    }

    // Merkezi İçerik Havuzuna taslak test kaydı
    await ContentLibrary.create({
      title: quiz.title,
      type: 'ai_test',
      ders: 'matematik',
      grade,
      topic: resolvedSub,
      difficulty: String(difficulty || 'orta').toLowerCase(),
      content: {
        description: quiz.description,
        questions: preparedQuestions,
        draftId: draftRecord._id
      },
      metadata: {
        questionCount: preparedQuestions.length,
        unitTopic: resolvedUnit,
        subTopic: resolvedSub,
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
      unit_topic: quiz.unit_topic,
      sub_topic: quiz.sub_topic,
      grade: quiz.grade,
      difficulty: quiz.difficulty,
      questionType: quiz.questionType,
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

  // ==========================================
  // MAARİF MODELİ KONU ANLATIM ÜRETİCİSİ ENDPOINTS
  // ==========================================

  // 1. Yapay Zeka ile Maarif Konu Anlatımı Üret
  router.post('/curriculum-content/generate', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const grade = Number(req.body?.grade);
      const ders = typeof req.body?.ders === 'string' ? req.body.ders.trim() : 'Matematik';
      const unit_topic = typeof req.body?.unit_topic === 'string' ? req.body.unit_topic.trim() : '';
      const sub_topic = typeof req.body?.sub_topic === 'string' ? req.body.sub_topic.trim() : '';
      const teacherNotes = typeof req.body?.teacherNotes === 'string' ? req.body.teacherNotes.trim() : '';
      const activeModel = req.body?.model || 'gemini-3.8-flash';

      if (!grade || grade < 5 || grade > 12 || !unit_topic || !sub_topic) {
        return res.status(400).json({ mesaj: 'Sınıf (5-12), tema ve alt konu seçimi zorunludur.' });
      }

      const { generateMaarifCurriculumContent } = await import('../aiService.mjs');
      const generated = await generateMaarifCurriculumContent({
        grade,
        unitTopic: unit_topic,
        subTopic: sub_topic,
        ders,
        teacherNotes,
        activeModel
      });

      // AI Token Kullanımını Kaydet
      try {
        const { recordAiUsage } = require('../lib/ai-usage-tracker');
        recordAiUsage({
          kullaniciId: req.session.user?.id,
          kullaniciAdi: req.session.user?.name,
          kullaniciRol: req.session.user?.role || 'teacher',
          modul: 'Konu Anlatım Üreticisi',
          modelAdi: generated.model || activeModel,
          promptTokens: generated.usage?.promptTokens || 0,
          candidatesTokens: generated.usage?.candidatesTokens || 0,
          cacheHit: false,
          durum: 'success',
          detay: { grade, ders, unit_topic, sub_topic }
        });
      } catch (logErr) {}

      res.json({
        success: true,
        data: {
          grade,
          subject: ders,
          themeCode: generated.themeCode || `MAT.${grade}.1`,
          themeTitle: generated.themeTitle || unit_topic,
          subTopicTitle: generated.subTopicTitle || sub_topic,
          unit_topic,
          sub_topic,
          outcome_code: generated.outcome_code,
          official_boundary: generated.official_boundary,
          title: generated.title,
          short_summary: generated.short_summary,
          lessonPages: generated.lessonPages || [],
          practicalNotes: generated.practicalNotes || [],
          flashcards: generated.flashcards || [],
          referenceBookPages: generated.referenceBookPages || [],
          ragSourceCount: generated.ragSourceCount || { books: 0, klavuz: 0 },
          detailed_content: generated.detailed_content,
          illustrations: generated.illustrations || [],
          teacherNotes
        }
      });
    } catch (err) {
      console.error('[AI] Konu anlatımı üretme hatası:', err);
      res.status(500).json({ mesaj: err.message || 'Konu anlatımı üretilemedi.' });
    }
  });

  // 2. Konu Anlatımını Kaydet & Yayınla (Öğrenci Paneline Aktar)
  router.post('/curriculum-content/publish', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const grade = Number(req.body?.grade);
      const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : (req.body?.ders || 'Matematik');
      const unit_topic = typeof req.body?.unit_topic === 'string' ? req.body.unit_topic.trim() : (typeof req.body?.themeTitle === 'string' ? req.body.themeTitle.trim() : '');
      const sub_topic = typeof req.body?.sub_topic === 'string' ? req.body.sub_topic.trim() : (typeof req.body?.subTopicTitle === 'string' ? req.body.subTopicTitle.trim() : '');
      const themeCode = typeof req.body?.themeCode === 'string' ? req.body.themeCode.trim() : '';
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : sub_topic;
      const order = Number(req.body?.order) || 0;
      const outcome_code = typeof req.body?.outcome_code === 'string' ? req.body.outcome_code.trim() : '';
      const short_summary = typeof req.body?.short_summary === 'string' ? req.body.short_summary.trim() : '';
      const lessonPages = Array.isArray(req.body?.lessonPages) ? req.body.lessonPages.map((p, idx) => ({
        pageNumber: Number(p?.pageNumber) || (idx + 1),
        title: String(p?.title || `${idx + 1}. Sayfa`).trim(),
        storyOrContext: String(p?.storyOrContext || ''),
        keyRuleBox: String(p?.keyRuleBox || ''),
        visualSvg: typeof p?.visualSvg === 'string' ? p.visualSvg.trim() : (typeof p?.svgDiagram === 'string' ? p.svgDiagram.trim() : ''),
        commonMistakeBox: String(p?.commonMistakeBox || ''),
        miniChallenge: String(p?.miniChallenge || ''),
        content: String(p?.content || ''),
        svgDiagram: typeof p?.svgDiagram === 'string' ? p.svgDiagram.trim() : (typeof p?.visualSvg === 'string' ? p.visualSvg.trim() : '')
      })) : [];
      const referenceBookPages = Array.isArray(req.body?.referenceBookPages) ? req.body.referenceBookPages.map(rp => ({
        book: String(rp?.book || '').trim(),
        theme: String(rp?.theme || '').trim(),
        page: Number(rp?.page) || 0,
        r2_key: String(rp?.r2_key || '').trim(),
        imageUrl: String(rp?.imageUrl || '').trim(),
        contentType: String(rp?.contentType || '').trim(),
        score: Number(rp?.score) || 0
      })).filter(rp => rp.book || rp.imageUrl) : [];
      const practicalNotes = Array.isArray(req.body?.practicalNotes)
        ? req.body.practicalNotes.map(n => String(n || '').trim()).filter(Boolean)
        : [];
      const flashcards = Array.isArray(req.body?.flashcards)
        ? req.body.flashcards.map(fc => ({
            front: String(fc?.front || '').trim(),
            back: String(fc?.back || '').trim(),
            tip: String(fc?.tip || '').trim()
          })).filter(fc => fc.front && fc.back)
        : [];

      let detailed_content = typeof req.body?.detailed_content === 'string' ? req.body.detailed_content : '';
      if (!detailed_content && lessonPages.length) {
        detailed_content = lessonPages
          .map(p => `[SAYFA_${p.pageNumber}]\n### ${p.title}\n\n${p.content}${p.svgDiagram ? '\n\n' + p.svgDiagram : ''}`)
          .join('\n\n');
      }

      const illustrations = Array.isArray(req.body?.illustrations) ? req.body.illustrations : [];
      const teacherNotes = typeof req.body?.teacherNotes === 'string' ? req.body.teacherNotes.trim() : '';
      const status = req.body?.status === 'draft' ? 'draft' : 'published';

      if (!grade || !unit_topic || !sub_topic || (!detailed_content && !lessonPages.length)) {
        return res.status(400).json({ mesaj: 'Sınıf, tema, alt konu ve içerik zorunludur.' });
      }

      const codeParts = outcome_code ? outcome_code.split('.') : [];
      const resolvedThemeCode = themeCode || (codeParts.length >= 3 ? codeParts.slice(0, 3).join('.') : `MAT.${grade}.1`);

      const filter = { grade, subject, unit_topic, sub_topic };
      const updateData = {
        themeCode: resolvedThemeCode,
        themeTitle: unit_topic,
        subTopicTitle: sub_topic,
        title,
        order,
        outcome_code,
        short_summary,
        detailed_content,
        lessonPages,
        practicalNotes,
        flashcards,
        referenceBookPages,
        illustrations,
        teacherNotes,
        status,
        createdBy: String(req.session.user?._id || req.session.user?.id || 'teacher'),
        createdByName: req.session.user?.name || 'Öğretmen'
      };

      const saved = await CurriculumContent.findOneAndUpdate(
        filter,
        updateData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      try {
        const { invalidatePattern } = require('../lib/redis-cache');
        await invalidatePattern('topics:published:');
      } catch {}

      res.json({
        success: true,
        mesaj: status === 'published' ? 'Konu anlatımı onaylandı ve öğrenci paneline yayınlandı.' : 'Taslak olarak kaydedildi.',
        data: saved
      });
    } catch (err) {
      console.error('[AI] Konu anlatımı yayınlama hatası:', err);
      res.status(500).json({ mesaj: 'Konu anlatımı kaydedilemedi: ' + err.message });
    }
  });

  // 2b. Öğretmenin Yayınladığı / Taslak Konu İçeriklerini Listele
  router.get('/curriculum-content/my-list', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const filter = {};
      if (req.query.grade && Number(req.query.grade) >= 5 && Number(req.query.grade) <= 12) {
        filter.grade = Number(req.query.grade);
      }
      if (req.query.status && ['draft', 'published'].includes(req.query.status)) {
        filter.status = req.query.status;
      }
      const items = await CurriculumContent.find(filter)
        .sort({ updatedAt: -1 })
        .limit(200)
        .select('grade themeCode themeTitle unit_topic subTopicTitle sub_topic title outcome_code status practicalNotes flashcards lessonPages updatedAt createdByName')
        .lean();

      res.json({
        success: true,
        items: items.map(it => ({
          id: String(it._id),
          grade: it.grade,
          themeCode: it.themeCode || `MAT.${it.grade}.1`,
          themeTitle: it.themeTitle || it.unit_topic,
          subTopicTitle: it.subTopicTitle || it.sub_topic,
          title: it.title || it.subTopicTitle || it.sub_topic,
          outcome_code: it.outcome_code || '',
          status: it.status || 'published',
          pageCount: Array.isArray(it.lessonPages) && it.lessonPages.length ? it.lessonPages.length : 5,
          notesCount: Array.isArray(it.practicalNotes) ? it.practicalNotes.length : 0,
          cardsCount: Array.isArray(it.flashcards) ? it.flashcards.length : 0,
          updatedAt: it.updatedAt,
          createdByName: it.createdByName || ''
        }))
      });
    } catch (err) {
      console.error('[AI] Konu listesi hatası:', err);
      res.status(500).json({ mesaj: 'Yayınlanan konular listelenemedi.' });
    }
  });

  // 2c. Tek Konu Getir (Düzenleme için)
  router.get('/curriculum-content/:id', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      const doc = await CurriculumContent.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ mesaj: 'Konu anlatımı bulunamadı.' });
      res.json({ success: true, data: doc });
    } catch (err) {
      res.status(500).json({ mesaj: 'Konu içeriği alınamadı.' });
    }
  });

  // 2d. Konu Sil
  router.delete('/curriculum-content/:id', requireRole('teacher', 'admin'), async (req, res) => {
    try {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      await CurriculumContent.findByIdAndDelete(req.params.id);
      res.json({ success: true, mesaj: 'Konu anlatımı silindi.' });
    } catch (err) {
      res.status(500).json({ mesaj: 'Konu anlatımı silinemedi.' });
    }
  });

  // 3. Konu Anlatımını Getir (Öğretmen, Öğrenci ve Admin için)
  router.get('/curriculum-content', requireRole('teacher', 'student', 'admin'), async (req, res) => {
    try {
      const grade = req.query?.grade ? Number(req.query.grade) : null;
      const unit_topic = typeof req.query?.unit_topic === 'string' ? req.query.unit_topic.trim() : '';
      const sub_topic = typeof req.query?.sub_topic === 'string' ? req.query.sub_topic.trim() : (req.query?.topic ? req.query.topic.trim() : '');
      const status = req.query?.status || 'published';

      const filter = { status };
      if (grade) filter.grade = grade;
      if (unit_topic) filter.unit_topic = unit_topic;
      if (sub_topic) filter.sub_topic = sub_topic;

      const found = await CurriculumContent.findOne(filter).lean();
      if (!found) {
        return res.json({ found: false, mesaj: 'İçerik bulunamadı.' });
      }

      res.json({ found: true, content: found });
    } catch (err) {
      console.error('[AI] Konu anlatımı okuma hatası:', err);
      res.status(500).json({ mesaj: 'İçerik sorgulanamadı.' });
    }
  });

  return router;
}

module.exports = { createAIRouter };
