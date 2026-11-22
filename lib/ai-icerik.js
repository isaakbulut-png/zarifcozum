const SECENEKLER_ORTAOKUL = ['A', 'B', 'C', 'D'];
const SECENEKLER_LISE = ['A', 'B', 'C', 'D', 'E'];
const SECENEKLER = SECENEKLER_ORTAOKUL;

function getSecenekler(sinif) {
  return Number(sinif) >= 9 ? SECENEKLER_LISE : SECENEKLER_ORTAOKUL;
}

const MODEL = () => String(process.env.AI_MODEL || 'gemini-3.1-flash-lite').trim();

class IcerikHatasi extends Error {
  constructor(mesaj, status = 502) {
    super(mesaj);
    this.status = status;
  }
}

function soruSemasi(sinif = 5) {
  const aktifSecenekler = getSecenekler(sinif);
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
              properties: Object.fromEntries(aktifSecenekler.map(harf => [harf, { type: 'STRING' }])),
              required: aktifSecenekler
            },
            answer: { type: 'STRING', enum: aktifSecenekler },
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

function gecerliSoru(soru, sinif = 5) {
  const aktifSecenekler = getSecenekler(sinif);
  return soru && typeof soru.text === 'string' && soru.text.trim() && soru.text.length <= 1000 &&
    soru.options && aktifSecenekler.every(harf =>
      typeof soru.options[harf] === 'string' && soru.options[harf].trim() && soru.options[harf].length <= 300) &&
    aktifSecenekler.includes(soru.answer) &&
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
          generationConfig: { responseMimeType: 'application/json', responseSchema: sema, maxOutputTokens: 2800 }
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
    try {
      const { recordAiUsage } = require('./ai-usage-tracker');
      recordAiUsage({
        modul: 'İçerik Havuzu',
        modelAdi: MODEL(),
        promptTokens: yanit.usageMetadata?.promptTokenCount || 0,
        candidatesTokens: yanit.usageMetadata?.candidatesTokenCount || 0,
        cacheHit: false,
        durum: 'success'
      });
    } catch {}
    const metin = yanit.candidates?.[0]?.content?.parts?.map(parca => parca.text || '').join('') || '';
    return JSON.parse(metin.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new IcerikHatasi('Yapay zekâ geçerli içerik döndürmedi.');
  }
}

async function uretSorular({ sinif, konu, adet, fetchImpl }) {
  const s = Number(sinif);
  const secenekler = getSecenekler(s);
  const isLise = s >= 9;

  const secenekKurali = isLise
    ? 'Her soru kesinlikle beş seçenekli (A, B, C, D, E) olsun ve yalnızca bir doğru cevap içersin.'
    : 'Her soru kesinlikle dört seçenekli (A, B, C, D) olsun ve yalnızca bir doğru cevap içersin.';

  const kademeKurali = isLise
    ? 'LİSE DÜZEYİ (9, 10, 11 ve 12. Sınıf): Yaş grubuna uygun olgun bir dil kullan; çok adımlı akıl yürütme, matematiksel modelleme, değişkenler arası bağıntı kurma ve analitik düşünme becerilerini ölç.'
    : 'ORTAOKUL DÜZEYİ (5, 6, 7 ve 8. Sınıf): Somutlaştırma, günlük hayat senaryoları ve somut modellemelerle öğrencinin keşfetme ve muhakeme becerisine hitap et.';

  const prompt = [
    'Sen T.C. Millî Eğitim Bakanlığı (MEB) Türkiye Yüzyılı Maarif Modeli ve "Çoktan Seçmeli Soru Yazım Kılavuzu" standartlarına tam hakim bir Matematik Soru Yazım Uzmanısın.',
    `Türkiye Maarif Modeli ${sinif}. sınıf matematik dersi için özgün, pedagojik olarak doğru çoktan seçmeli sorular hazırla.`,
    `Konu: ${konu}. Tam olarak ${adet} soru üret; sorular kolaydan zora doğru ilerlesin ve ${sinif}. sınıf düzeyine uygun olsun.`,
    secenekKurali,
    kademeKurali,
    'ÖLÇME-DEĞERLENDİRME İLKELERİ:',
    '- Ezbere dayalı salt işlem soruları yazma; günlük yaşam senaryosu içeren, kavramsal anlama ve Erdem-Değer-Eylem çerçevesini (adalet, tasarruf, sorumluluk, iş birliği vb.) yansıtan sorular oluştur.',
    '- Çeldiricileri rastgele sayılardan değil, öğrencilerin o konuda sık yaptığı kavram yanılgılarından veya olası işlem hatalarından üret.',
    '- Sayıları, işlemleri ve doğru seçeneği dikkatle doğrula; belirsiz veya birden fazla doğru cevabı olan soru yazma.',
    '- Metinleri düz yazı olarak ver (HTML veya Markdown kullanma); üs için ^ işaretini kullanabilirsin.',
    '- explanation alanında doğru cevabın adım adım çözümünü ve çeldiricilerin hangi kavram yanılgısını ölçtüğünü belirt.',
    'Yalnızca istenen JSON şemasına uyan JSON döndür.'
  ].join('\n');
  const sonuc = await gemini({ prompt, sema: soruSemasi(s), fetchImpl });
  if (!Array.isArray(sonuc.questions) || sonuc.questions.length !== adet || !sonuc.questions.every(q => gecerliSoru(q, s))) {
    throw new IcerikHatasi('Üretilen sorular doğrulanamadı. Lütfen yeniden deneyin.');
  }
  return sonuc.questions.map(soru => ({
    text: soru.text.trim(),
    options: Object.fromEntries(secenekler.map(harf => [harf, soru.options[harf].trim()])),
    answer: soru.answer,
    explanation: String(soru.explanation || '').trim()
  }));
}

async function uretKonuAnlatimi({ sinif, konu, fetchImpl }) {
  const isLise = Number(sinif) >= 9;
  const kademeKurali = isLise
    ? 'Lise Düzeyi: Yaş grubuna uygun olgun bir Maarif Modeli dili, analitik düşünme, matematiksel modelleme ve gerçek yaşam ilişkileri.'
    : 'Ortaokul Düzeyi: Somutlaştırma, merak uyandıran, keşfetmeye dayalı sıcak ve teşvik edici bir rehber dili.';

  const prompt = [
    'Sen T.C. Millî Eğitim Bakanlığı (MEB) Türkiye Yüzyılı Maarif Modeli pedagojisine tam uyumlu çalışan uzman bir Matematik Eğitimcisisin.',
    `Türkiye Maarif Modeli ${sinif}. sınıf matematik dersi için özgün, ezberletmeyen ve kavramsal anlamayı derinleştiren bir konu anlatımı hazırla.`,
    `Konu: ${konu}.`,
    kademeKurali,
    'ozet: 3-5 cümlelik sade, mantıksal temele dayanan anlatım. kavramlar: 3-5 kısa madde (tanım, modelleme veya kural). ornekSoru: günlük yaşam senaryolu bir örnek soru. ornekCozum: adım adım pedagojik çözüm. sikHatalar: 2-3 sık yapılan kavram yanılgısı veya işlem hatası.',
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
