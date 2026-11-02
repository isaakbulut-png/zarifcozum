const SECENEKLER = ['A', 'B', 'C', 'D'];
const MODEL = () => String(process.env.AI_MODEL || 'gemini-3.8-flash').trim();

class IcerikHatasi extends Error {
  constructor(mesaj, status = 502) {
    super(mesaj);
    this.status = status;
  }
}

function soruSemasi() {
  return {
    type: 'OBJECT',
    properties: {
      questions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            text: { type: 'STRING' },
            options: {
              type: 'OBJECT',
              properties: Object.fromEntries(SECENEKLER.map(harf => [harf, { type: 'STRING' }])),
              required: SECENEKLER
            },
            answer: { type: 'STRING', enum: SECENEKLER },
            explanation: { type: 'STRING' }
          },
          required: ['text', 'options', 'answer', 'explanation']
        }
      }
    },
    required: ['questions']
  };
}

function konuSemasi() {
  return {
    type: 'OBJECT',
    properties: {
      ozet: { type: 'STRING' },
      kavramlar: { type: 'ARRAY', items: { type: 'STRING' } },
      ornekSoru: { type: 'STRING' },
      ornekCozum: { type: 'STRING' },
      sikHatalar: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['ozet', 'kavramlar', 'ornekSoru', 'ornekCozum', 'sikHatalar']
  };
}

function gecerliSoru(soru) {
  return soru && typeof soru.text === 'string' && soru.text.trim() && soru.text.length <= 1000 &&
    soru.options && SECENEKLER.every(harf =>
      typeof soru.options[harf] === 'string' && soru.options[harf].trim() && soru.options[harf].length <= 300) &&
    SECENEKLER.includes(soru.answer) &&
    (!soru.explanation || (typeof soru.explanation === 'string' && soru.explanation.length <= 1500));
}

async function gemini({ prompt, sema, fetchImpl = globalThis.fetch }) {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey) throw new IcerikHatasi('Yapay zekâ hizmeti henüz yapılandırılmamış.', 503);

  let response;
  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL())}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: sema, maxOutputTokens: 8192 }
        }),
        signal: AbortSignal.timeout(60000)
      }
    );
  } catch (error) {
    const zamanAsimi = error.name === 'TimeoutError' || error.name === 'AbortError';
    throw new IcerikHatasi(zamanAsimi ? 'İçerik üretimi zaman aşımına uğradı.' : 'Yapay zekâ hizmetine bağlanılamadı.', zamanAsimi ? 504 : 502);
  }
  if (!response.ok) {
    console.error(`Gemini hatası: HTTP ${response.status}`);
    throw new IcerikHatasi('İçerik şu anda hazırlanamadı. Lütfen biraz sonra tekrar deneyin.', response.status === 429 ? 503 : 502);
  }
  try {
    const yanit = JSON.parse(await response.text());
    const metin = yanit.candidates?.[0]?.content?.parts?.map(parca => parca.text || '').join('') || '';
    return JSON.parse(metin.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new IcerikHatasi('Yapay zekâ geçerli içerik döndürmedi.');
  }
}

async function uretSorular({ sinif, konu, adet, fetchImpl }) {
  const prompt = [
    `Türkiye Maarif Modeli ${sinif}. sınıf matematik dersi için özgün, pedagojik olarak doğru çoktan seçmeli sorular hazırla.`,
    `Konu: ${konu}. Tam olarak ${adet} soru üret; sorular kolaydan zora doğru ilerlesin ve ${sinif}. sınıf düzeyine uygun olsun.`,
    'Her soru dört seçenekli (A, B, C, D) olsun ve yalnızca bir doğru cevap içersin.',
    'Sayıları, işlemleri ve doğru seçeneği dikkatle doğrula; belirsiz veya birden fazla doğru cevabı olan soru yazma.',
    'Metinleri düz yazı olarak ver (HTML veya Markdown kullanma); üs için ^ işaretini kullanabilirsin.',
    'Açıklama alanında çözümün kısa ve anlaşılır adımlarını ver.',
    'Yalnızca istenen JSON şemasına uyan JSON döndür.'
  ].join('\n');
  const sonuc = await gemini({ prompt, sema: soruSemasi(), fetchImpl });
  if (!Array.isArray(sonuc.questions) || sonuc.questions.length !== adet || !sonuc.questions.every(gecerliSoru)) {
    throw new IcerikHatasi('Üretilen sorular doğrulanamadı. Lütfen yeniden deneyin.');
  }
  return sonuc.questions.map(soru => ({
    text: soru.text.trim(),
    options: Object.fromEntries(SECENEKLER.map(harf => [harf, soru.options[harf].trim()])),
    answer: soru.answer,
    explanation: String(soru.explanation || '').trim()
  }));
}

async function uretKonuAnlatimi({ sinif, konu, fetchImpl }) {
  const prompt = [
    `Türkiye Maarif Modeli ${sinif}. sınıf matematik dersi için kısa, özgün bir konu anlatımı hazırla.`,
    `Konu: ${konu}.`,
    'ozet: 3-5 cümlelik sade anlatım. kavramlar: 3-5 kısa madde (tanım veya kural). ornekSoru: bir örnek soru. ornekCozum: adım adım çözüm. sikHatalar: 2-3 sık yapılan hata.',
    'Metinleri düz yazı olarak ver (HTML veya Markdown kullanma). Yalnızca istenen JSON şemasına uyan JSON döndür.'
  ].join('\n');
  const sonuc = await gemini({ prompt, sema: konuSemasi(), fetchImpl });
  const metin = deger => typeof deger === 'string' && deger.trim() && deger.length <= 3000;
  const liste = deger => Array.isArray(deger) && deger.length > 0 && deger.length <= 8 && deger.every(metin);
  if (!metin(sonuc.ozet) || !liste(sonuc.kavramlar) || !metin(sonuc.ornekSoru) || !metin(sonuc.ornekCozum) || !liste(sonuc.sikHatalar)) {
    throw new IcerikHatasi('Üretilen konu anlatımı doğrulanamadı. Lütfen yeniden deneyin.');
  }
  return {
    ozet: sonuc.ozet.trim(),
    kavramlar: sonuc.kavramlar.map(madde => madde.trim()),
    ornekSoru: sonuc.ornekSoru.trim(),
    ornekCozum: sonuc.ornekCozum.trim(),
    sikHatalar: sonuc.sikHatalar.map(madde => madde.trim())
  };
}

module.exports = { uretSorular, uretKonuAnlatimi, IcerikHatasi, gecerliSoru };
