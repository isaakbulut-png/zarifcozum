import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import outcome from './lib/meb-outcome.js';

// .env öncelikli, eksikler baglanti_adresi.env'den tamamlanır
const kokDizin = path.dirname(fileURLToPath(import.meta.url));
for (const dosya of ['.env', 'baglanti_adresi.env']) {
  const envYolu = path.join(kokDizin, dosya);
  if (fs.existsSync(envYolu)) dotenv.config({ path: envYolu, quiet: true });
}

// Model Router (Yönlendirici): İstek türüne göre uygun modeli seçer (Ekonomik ve hızlı flash modelleri)
export const DISCOVERY_MODEL = process.env.AI_DISCOVERY_MODEL || 'gemini-2.5-flash';
export const STANDARD_MODEL = process.env.AI_FLASH_MODEL || 'gemini-2.5-flash';

export function resolveAIModel(gorevTuru) {
  if (gorevTuru === 'discovery_game') {
    return DISCOVERY_MODEL;
  }
  return STANDARD_MODEL;
}

// Google Gen AI ve Pinecone Başlatma
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 60000 },
});

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const INDEX_NAME = 'meb-mufredat';
const pineconeIndex = pc.index(INDEX_NAME);
const visualInstruction = `Matematiksel ifadeleri satır içinde $...$, ayrı satırda $$...$$ ile geçerli LaTeX olarak yaz.
Gerektiğinde şekli metinde doğrudan <svg>...</svg> ile göster. SVG yalnızca svg, g, path, rect, circle, ellipse, line, polyline, polygon, text etiketleri ve temel sayısal koordinatlar, viewBox, fill, stroke, stroke-width, opacity, font-size, text-anchor kullanabilir.
viewBox kullan, CSS, style, class, transform, bağlantı, animasyon, betik, dış kaynak, foreignObject veya SVG dışı HTML kullanma. Örnek: <svg viewBox="0 0 100 100"><polygon points="50,10 10,90 90,90" fill="none" stroke="#4F46E5" stroke-width="3"/></svg>.`;

export async function mufredatKonulariniGetir(grade) {
  const filter = { grade: { $eq: Number(grade) } };
  const konular = new Map();
  let paginationToken;

  do {
    const sonuc = await pineconeIndex.fetchByMetadata({
      filter,
      limit: 1000,
      ...(paginationToken ? { paginationToken } : {})
    });

    for (const kayit of Object.values(sonuc.records || {})) {
      const unite = typeof kayit.metadata?.unit_topic === 'string' ? kayit.metadata.unit_topic.trim() : '';
      const dosyaAdi = typeof kayit.metadata?.official_description === 'string'
        ? kayit.metadata.official_description.trim().replace(/^["']|["']$/g, '')
        : '';
      if (!unite || !dosyaAdi) continue;
      const anahtar = `${unite.toLocaleLowerCase('tr-TR')}\0${dosyaAdi.toLocaleLowerCase('tr-TR')}`;
      if (!konular.has(anahtar)) konular.set(anahtar, { unite, dosya_adi: dosyaAdi });
    }

    paginationToken = sonuc.pagination?.next;
  } while (paginationToken);

  return [...konular.values()].sort((a, b) =>
    a.unite.localeCompare(b.unite, 'tr') || a.dosya_adi.localeCompare(b.dosya_adi, 'tr'));
}

const ozetOnbellegi = new Map();

export async function konuOzetiGetir(grade, topic) {
  const anahtar = `${Number(grade)}\0${topic}`;
  if (ozetOnbellegi.has(anahtar)) return ozetOnbellegi.get(anahtar);

  const sonuc = await pineconeIndex.fetchByMetadata({
    filter: {
      grade: { $eq: Number(grade) },
      official_description: { $eq: topic }
    },
    limit: 10
  });
  const kayit = Object.values(sonuc.records || {}).find(k =>
    Number(k.metadata?.grade) === Number(grade) &&
    k.metadata?.official_description === topic);
  const hamMetin = typeof kayit?.metadata?.text === 'string'
    ? kayit.metadata.text.replace(/\s+/g, ' ').trim().slice(0, 4000)
    : '';
  if (!hamMetin) return '';

  const response = await aiClient.models.generateContent({
    model: resolveAIModel('konu_ozeti'),
    contents: [
      `Sınıf seviyesi: ${grade}. sınıf`,
      `Konu/kazanım: ${topic}`,
      'Ham müfredat metni:',
      hamMetin
    ].join('\n\n'),
    config: {
      systemInstruction: 'Sana resmi müfredat metni verilecek. Kazanım kodlarını, "Kazanım Açıklaması", "Resmi Sınırlar" gibi teknik etiketleri ve resmi dili kullanma. Bu konuda öğrencinin neler öğreneceğini öğrenci ve velilerin anlayacağı sade, akıcı Türkçe ile EN FAZLA 2-3 cümlelik kısa bir özet olarak yaz. Yalnızca özet metnini döndür; başlık, madde işareti, Markdown veya giriş cümlesi ekleme.',
      temperature: 0.4,
      maxOutputTokens: 300
    }
  });
  const ozet = response.text?.replace(/\s+/g, ' ').trim();
  if (!ozet) throw new Error('Yapay zekâ konu özeti üretemedi.');
  ozetOnbellegi.set(anahtar, ozet);

  try {
    const { recordAiUsage } = await import('./lib/ai-usage-tracker.js');
    recordAiUsage({
      modul: 'Konu Özeti',
      modelAdi: resolveAIModel('konu_ozeti'),
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      cacheHit: false,
      durum: 'success',
      detay: { grade, topic }
    });
  } catch {}

  return ozet;
}

export async function konuAnlatimiZenginlestir(grade, topic) {
  const sonuc = await pineconeIndex.fetchByMetadata({
    filter: {
      grade: { $eq: Number(grade) },
      official_description: { $eq: topic }
    },
    limit: 10
  });
  const kayit = Object.values(sonuc.records || {}).find(k =>
    Number(k.metadata?.grade) === Number(grade) &&
    k.metadata?.official_description === topic);
  const hamIcerik = typeof kayit?.metadata?.text === 'string'
    ? kayit.metadata.text.trim()
    : '';
  if (!hamIcerik) throw new Error('Bu sınıf ve konu için Pinecone’da ham müfredat içeriği bulunamadı.');

  const response = await aiClient.models.generateContent({
    model: resolveAIModel('ders_notu'),
    contents: [
      `Sınıf seviyesi: ${grade}. sınıf`,
      `Konu/kazanım: ${topic}`,
      'Pinecone’dan alınan ham müfredat içeriği:',
      hamIcerik
    ].join('\n\n'),
    config: {
      systemInstruction: `Sen uzman bir matematik öğretmenisin. Sana verilen ham müfredat özetini temel alarak; ilgili sınıf seviyesine uygun, pedagojik, bol günlük hayat örnekli, cana yakın, detaylı bir konu anlatımı üret. İçeriği Markdown formatında, tam olarak [SAYFA_1], [SAYFA_2], [SAYFA_3], [SAYFA_4] ve [SAYFA_5] etiketleriyle beş ayrı bölüme ayır. Her etiket ayrı bir satırda yer alsın, bölümlerin içeriği dolu ve kendi içinde anlamlı olsun; etiketlerin dışında giriş veya sonuç metni ekleme. Cevapları gereksiz uzatma, kısa, net ve pedagojik tut; SVG kodlarını en sade haliyle üret. ${visualInstruction}`,
      temperature: 0.6,
      maxOutputTokens: 2800
    }
  });
  const anlatim = response.text?.trim();
  if (!anlatim) throw new Error('Yapay zekâ konu anlatımı üretemedi.');
  const etiketler = [...anlatim.matchAll(/\[SAYFA_(\d+)\]/gi)];
  const bolumler = etiketler.map((etiket, i) => {
    const baslangic = etiket.index + etiket[0].length;
    const bitis = etiketler[i + 1]?.index ?? anlatim.length;
    return anlatim.slice(baslangic, bitis).trim();
  });
  const sayfaSayisi = Math.min(etiketler.length, 5);
  const sayfalarGecerli = sayfaSayisi >= 4 &&
    etiketler.slice(0, sayfaSayisi).every((etiket, i) => Number(etiket[1]) === i + 1) &&
    bolumler.slice(0, sayfaSayisi).every(Boolean);
  if (!sayfalarGecerli) throw new Error('Yapay zekâ konu anlatımını en az dört dolu, sıralı sayfaya bölemedi. Lütfen yeniden deneyin.');

  try {
    const { recordAiUsage } = await import('./lib/ai-usage-tracker.js');
    recordAiUsage({
      modul: 'Konu Anlatımı Zenginleştir',
      modelAdi: resolveAIModel('ders_notu'),
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      cacheHit: false,
      durum: 'success',
      detay: { grade, topic }
    });
  } catch {}

  return anlatim;
}

export async function kazanimaOzelIpucu({outcomeCode, question, selected}) {
  const metadata = await outcome.findExactOutcome(pineconeIndex, outcomeCode);
  const response = await aiClient.models.generateContent({
    model: resolveAIModel('mentor_ipucu'),
    contents: `Soru: ${question.text}\nÖğrencinin seçtiği cevap: ${selected}) ${question.options[selected]}`,
    config: {
      systemInstruction: `Sen bir matematik mentörüsün. Yalnızca aşağıdaki MEB kazanımına sadık kal, sorunun cevabını veya doğru şıkkını söyleme. Öğrencinin seçimini düşünmesine yardımcı olacak kısa, kişiselleştirilmiş bir ipucu ver. ${visualInstruction}\n[DOĞRULANMIŞ MEB KAZANIMI]\n${buildConstraintText(metadata)}`,
      temperature: 0.2
    }
  });
  if (!response.text?.trim()) throw new Error('Kazanım ipucu oluşturulamadı.');
  return response.text.trim();
}

export async function genelSokratikIpucu({question, selected}) {
  const response = await aiClient.models.generateContent({
    model: resolveAIModel('sohbet'),
    contents: `Soru: ${question.text}\nÖğrencinin seçtiği cevap: ${selected}) ${question.options[selected]}`,
    config: {
      systemInstruction: `Sen bir matematik mentörüsün. Cevabı veya doğru şıkkı söylemeden, öğrencinin seçimini sorgulamasına yardımcı olan kısa ve Sokratik bir ipucu ver. Bir kazanım veya kaynak doğrulandığını iddia etme. ${visualInstruction}`,
      temperature: 0.2
    }
  });
  if (!response.text?.trim()) throw new Error('İpucu oluşturulamadı.');
  return response.text.trim();
}

const KLAVUZ_NAMESPACE = 'klavuz';
const DERS_KITABI_NAMESPACE = 'ders_kitabi';

/**
 * Yeni yüklenen Pinecone metadata yapısına uygun kural metni oluşturur
 */
function buildConstraintText(metadata = {}, klavuzMatches = [], kitapMatches = []) {
  const { grade, unit_topic, text, outcome_code } = metadata;
  const parts = [];

  if (grade) parts.push(`Sınıf Seviyesi: ${grade}`);
  if (unit_topic) parts.push(`Ünite/Konu: ${unit_topic}`);
  if (outcome_code) parts.push(`Kazanım Kodu: ${outcome_code}`);
  if (text) parts.push(`Müfredat İçeriği ve Kazanım Sınırları:\n${text}`);

  const klavuzMetinleri = klavuzMatches
    .map((m) => m?.metadata?.text)
    .filter(Boolean)
    .slice(0, 2);
  if (klavuzMetinleri.length) {
    parts.push(`[MAARİF MODELİ KLAVUZ TALİMATLARI]\n${klavuzMetinleri.join('\n---\n')}`);
  }

  const kitapMetinleri = kitapMatches
    .map((m) => m?.metadata?.text)
    .filter(Boolean)
    .slice(0, 2);
  if (kitapMetinleri.length) {
    parts.push(`[MAARİF MODELİ DERS KİTABI ÖRNEKLERİ]\n${kitapMetinleri.join('\n---\n')}`);
  }

  return parts.length
    ? parts.join('\n\n')
    : "Genel 5-12. sınıf Türkiye Yüzyılı Maarif Modeli matematik müfredat sınırlarına ve pedagojisine sadık kal.";
}

/**
 * Öğrenci mesajına göre Pinecone'dan ilgili kazanımı, kılavuzu ve ders kitabı örneklerini bulur (RAG).
 */
async function getMebConstraints(ogrenciMesaji, grade) {
  const trimmed = String(ogrenciMesaji || '').trim();
  // 1. Kısa veya selamlama/onay mesajlarında RAG embedding & Pinecone sorgusunu atla (Sıfır Token/Sorgu)
  const isChitChatOrShort = trimmed.length < 15 ||
    /^(merhaba|selam|selamlar|günaydın|tünaydın|iyi günler|iyi akşamlar|teşekkür|sağ ol|anladım|tamam|evet|hayır|peki|harika)\b/i.test(trimmed);

  if (isChitChatOrShort) {
    return "Genel 5-12. sınıf Türkiye Yüzyılı Maarif Modeli matematik müfredat sınırlarına ve pedagojisine sadık kal.";
  }

  try {
    const embeddingResponse = await aiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: ogrenciMesaji,
      config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 }
    });
    
    // API yanıt yapısına göre vektör dizisini güvenli şekilde çekiyoruz
    const queryVector = embeddingResponse.embedding?.values || embeddingResponse.embeddings?.[0]?.values;
    
    if (!queryVector) {
      throw new Error("Vektör verisi Google API'den alınamadı.");
    }

    // 2. Pinecone Filtreleme Hazırlığı
    const filterQuery = {};
    if (grade) {
      filterQuery.grade = { $eq: Number(grade) };
    }

    const queryOptions = {
      vector: queryVector,
      topK: 2,
      includeMetadata: true,
      ...(grade && { filter: filterQuery }),
    };

    // 3. Pinecone'da kazanımları, kılavuz talimatlarını ve ders kitabı sayfalarını paralel aratıyoruz
    const [searchResults, klavuzResults, kitapResults] = await Promise.all([
      pineconeIndex.query(queryOptions),
      pineconeIndex.namespace(KLAVUZ_NAMESPACE).query(queryOptions).catch(() => ({ matches: [] })),
      pineconeIndex.namespace(DERS_KITABI_NAMESPACE).query(queryOptions).catch(() => ({ matches: [] })),
    ]);

    // Katı benzerlik eşiği (score >= 0.72): Alakasız veya düşük puanlı metinleri sisteme gömüp token harcama
    const MIN_SCORE = 0.72;
    const topKazanim = searchResults.matches?.[0];
    const ilkKazanim = (topKazanim && (topKazanim.score || 0) >= MIN_SCORE) ? (topKazanim.metadata || {}) : {};
    const klavuzMatches = (klavuzResults?.matches || []).filter(m => (m.score || 0) >= MIN_SCORE);
    const kitapMatches = (kitapResults?.matches || []).filter(m => (m.score || 0) >= MIN_SCORE);

    if (Object.keys(ilkKazanim).length > 0 || klavuzMatches.length > 0 || kitapMatches.length > 0) {
      return buildConstraintText(ilkKazanim, klavuzMatches, kitapMatches);
    }
    
    return "Genel 5-12. sınıf Türkiye Yüzyılı Maarif Modeli matematik müfredat sınırlarına ve pedagojisine sadık kal.";
  } catch (error) {
    console.error("❌ Pinecone veya Embedding arama hatası:", error);
    return "Müfredat sınırları okunamadı. Genel sınıf düzeyine ve Türkiye Yüzyılı Maarif Modeli pedagojisine sadık kal.";
  }
}

/**
 * Ana İşlem Merkezi: Soru üretimi ve AI Mentörlüğü tek koldan yönetir
 * @param {string} ogrenciMesaji - Kullanıcının chat mesajı veya soru üretme isteği
 * @param {string} gorevTuru - 'ai_mentor' veya 'soru_uretme'
 * @param {string|number} grade - Öğrencinin sınıf seviyesi (Örn: '5', '6', 9 vb.)
 * @param {Array} history - Son 2 tura ait temizlenmiş konuşma geçmişi ([{ role: 'user'|'model', text }])
 */
export async function zarifCozumAIServisi(ogrenciMesaji, gorevTuru = 'ai_mentor', grade, history = [], chosenModel, userContext = {}) {
  // 1. Adım: Pinecone'dan 768 boyutlu müfredat sınırını çek
  const mebSiniri = await getMebConstraints(ogrenciMesaji, grade);

  const ALLOWED_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
  let systemInstruction = "";
  let selectedModel = (chosenModel && ALLOWED_MODELS.includes(chosenModel))
    ? chosenModel
    : resolveAIModel(gorevTuru);

  // 2. Adım: Göreve göre yapay zekaya rol biçme
  if (gorevTuru === 'discovery_game') {
    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeli matematik müfredatına dayalı Keşif Oyunu (Discovery Game) tasarlayan uzman bir eğitim tasarımcısısın.
      Öğrencinin kavramı soru sorarak, hipotez kurarak ve deneyerek adım adım keşfetmesini sağlayan interaktif ve eğlenceli bir senaryo sun.
      Doğrudan cevabı veya formülü verme; yönlendirici adımlarla akıl yürütmesini sağla.
      Cevapları gereksiz uzatma, kısa, net ve pedagojik tut; SVG kodlarını en sade haliyle üret.
      ${visualInstruction}
      
      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  } else if (gorevTuru === 'ai_mentor') {
    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeline tamamen hakim, uzman bir Matematik AI Mentörüsün.
      Öğrenciye matematik sorusunun cevabını asla doğrudan söyleme.
      Yaptığı mantıksal veya işlemsel hatayı tespit et, hatayı kendisinin bulmasını sağlayacak pedagojik ipuçları (Sokratik yöntem) ver.
      Cevapları gereksiz uzatma, kısa, net ve pedagojik tut; SVG kodlarını en sade haliyle üret.
      ${visualInstruction}
      Sadece sana verilen resmi müfredat kazanım sınırları içinde kal, üst sınıf formülleri ve yöntemleri kesinlikle verme:
      
      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  } else if (gorevTuru === 'ogretmen_ikizi') {
    systemInstruction = `
      Sen öğrencinin "Anlamadım" dediği konuyu farklı açılardan kavratan uzman bir "AI Öğretmen İkizi"sin.
      Klasik ders kitabı tanımını ASLA papağan gibi tekrarlama!
      Öğrenciye konuyu şu 3 pedagojik yaklaşımla, sıcak ve cana yakın bir dille sun:
      1) GÜNLÜK HAYAT BENZETMESİ: Somut, akılda kalıcı bir metafor/örnek (yemek tarifi, spor, oyun, alışveriş vb.).
      2) GÖRSEL CANLANDIRMA: Gerekirse basit ve anlaşılır bir <svg>...</svg> şemasıyla mantığı görselleştir.
      3) KAVRATICI MİKRO SORU: Konunun can alıcı püf noktasını yoklayan, öğrencinin kolayca cevaplayabileceği 1 adet mini pekiştirme sorusu.
      Cevapları gereksiz uzatma, kısa, net ve pedagojik tut; SVG kodlarını en sade haliyle üret.
      ${visualInstruction}
      Yalnızca resmi müfredat kazanım sınırlarına sadık kal:
      
      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  } else if (gorevTuru === 'soru_cozum') {
    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeli pedagojisine uygun adım adım soru çözen uzman bir matematik öğretmenisin.
      Sorunun çözümünü doğrudan sonuca atlamadan;
      - 1. Adım: Verilenleri ve İsteneni Belirleme
      - 2. Adım: Matematiksel Strateji / Model Kurma
      - 3. Adım: İşlem Adımları (Gerekirse ${visualInstruction})
      - 4. Adım: Çözümün Sağlaması ve Püf Noktası
      şeklinde net, anlaşılır ve pedagojik başlıklarla açıkla. Üst sınıf kurallarını kullanma.
      Cevapları gereksiz uzatma, kısa, net ve pedagojik tut; SVG kodlarını en sade haliyle üret:
      
      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  } else if (gorevTuru === 'ai_koc') {
    const userPlan = userContext?.userPlan || 'temel';
    let planOzelligi = '';
    if (userPlan === 'vip') {
      planOzelligi = `
      [VIP MODU: GELİŞMİŞ SINAV STRATEJİ KOÇU & NET HEDEF SİMÜLASYONU]
      - Öğrenciye haftalık net hedef projeksiyonu ve simülasyonu sun (örn: "Şu an 12 nettesin, hedef 18 net için şu 2 kritik kazanımı kapatmalısın").
      - LGS / YKS ve okul denemelerine yönelik profesyonel zaman yönetimi, soru eleme ve sınav anı stratejisi taktikleri ver.
      - Çok adımlı stratejik çalışma döngüsü çiz.`;
    } else if (userPlan === 'standart') {
      planOzelligi = `
      [STANDART MODU: GÜNLÜK DİNAMİK REÇETE & KAZANIM TEŞHİSİ]
      - Öğrencinin bugünkü çalışma reçetesini 1-2 kritik MEB kazanımına odaklayarak reçetelendir.
      - Hangi konuda eksik kalındığını teşhis et ve eksik kapatma adımlarını reçete formatında listele.`;
    } else {
      planOzelligi = `
      [TEMEL MODU: HAFTALIK OTOMATİK ÇALIŞMA PLANI]
      - Öğrencinin sınıf seviyesine uygun, 7 günlük dengeli ve sürdürülebilir bir haftalık matematik çalışma planı çıkar.
      - Temel motivasyon ve çalışma alışkanlığı rehberliği sun.`;
    }

    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeli odaklı, pedagojik ve stratejik bir "Matematik AI Öğrenci Koçu"sun.
      ${planOzelligi}
      Öğrencinin motivasyonunu artır, hedef belirleme ve odaklanma konularında somut, uygulanabilir ve pozitif rehberlik yap.
      Klişe öğütler yerine öğrencinin sınıf düzeyine (${grade ? grade + '. sınıf' : 'ilgili sınıf'}) uygun somut mikro hedefler sun.
      Cevapları gereksiz uzatma; başlıklar, maddeler ve net adımlarla motive edici tut.
    `;
  } else if (gorevTuru === 'soru_uretme') {
    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeli matematik müfredat standartlarında özgün sorular yazan profesyonel bir yazarsın.
      Aşağıda belirtilen kazanım sınırlarına %100 uyumlu (Örn: içerikteki sayı sınırlarını veya yöntem kısıtlamalarını aşma), şıkları ve detaylı adımlı çözümü olan tamamen özgün bir matematik sorusu üret.
      Cevapları gereksiz uzatma, kısa, net ve pedagojik tut; SVG kodlarını en sade haliyle üret:
      
      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  }

  // 3. Adım: Kısa Hafıza (Son 2 tur geçmiş + SVG temizliği)
  let contentsPayload = ogrenciMesaji;
  if (Array.isArray(history) && history.length > 0) {
    const multiTurn = [];
    for (const h of history) {
      if (h && h.text && (h.role === 'user' || h.role === 'model')) {
        // SVG kodlarını temizle; maliyeti şişirmeyen özet etiket bırak
        const cleanText = String(h.text)
          .replace(/<svg[\s\S]*?<\/svg>/gi, '[Görsel Şema Çizildi]')
          .trim()
          .slice(0, 350);
        if (cleanText) {
          multiTurn.push({
            role: h.role,
            parts: [{ text: cleanText }]
          });
        }
      }
    }
    if (multiTurn.length > 0) {
      multiTurn.push({
        role: 'user',
        parts: [{ text: ogrenciMesaji }]
      });
      contentsPayload = multiTurn;
    }
  }

  // 4. Adım: Gemini'ı tetikleme (maxOutputTokens: 1200 ile maliyet koruması)
  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: contentsPayload,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Matematiksel netlik ve müfredata sadakat için yaratıcılığı düşük tutuyoruz
        maxOutputTokens: 1200,
      },
    });

    try {
      const modulLabels = {
        ai_mentor: 'Sokratik Mentör',
        ogretmen_ikizi: 'Öğretmen İkizi',
        soru_cozum: 'Adım Adım Çözüm',
        ai_koc: 'AI Koç',
        discovery_game: 'Keşif Oyunu'
      };
      const { recordAiUsage } = await import('./lib/ai-usage-tracker.js');
      recordAiUsage({
        kullaniciId: userContext?.userId || null,
        kullaniciAdi: userContext?.userName || 'Kullanıcı',
        kullaniciRol: userContext?.userRole || 'öğrenci',
        modul: modulLabels[gorevTuru] || 'AI Mentör',
        modelAdi: selectedModel,
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
        cacheHit: false,
        durum: 'success',
        detay: { grade }
      });
    } catch (logErr) {}

    return response.text;
  } catch (error) {
    console.error("❌ Gemini API Gerçek Hata Logu:", error);
    throw new Error('AI Mentör yanıtı şu anda üretilemedi.');
  }
}

/**
 * AI Soru Psikoloğu & Deneme Teşhis Motoru
 * Öğrencinin deneme/test sonucunu analiz eder; yanlışların bilgi eksikliğinden mi,
 * süre/zaman baskısından mı, yoksa dikkatsizlikten mi kaynaklandığını teşhis eder.
 * @param {Object} veri - { denemeBasligi, grade, totalCount, correctCount, wrongCount, blankCount, score, sorular, harcananSureDk }
 */
export async function denemePsikologuAnalizi(veri) {
  const {
    denemeBasligi = 'Deneme Sınavı',
    grade = 8,
    totalCount = 0,
    correctCount = 0,
    wrongCount = 0,
    blankCount = 0,
    score = 0,
    sorular = [],
    harcananSureDk = null,
  } = veri;

  const soruDetaylari = sorular.map((s, i) => {
    const durum = s.secilen === s.dogru ? 'DOĞRU' : (s.secilen === null || s.secilen === undefined ? 'BOŞ' : 'YANLIŞ');
    return `Soru ${s.no || i + 1}: ${durum} (Kazanım: ${s.outcomeCode || s.topic || 'Belirtilmemiş'}, Öğrenci Şıkkı: ${s.secilen || '-'}, Doğru: ${s.dogru || '-'})`;
  }).join('\n');

  const prompt = `Aşağıda ${grade}. sınıf öğrencisinin "${denemeBasligi}" deneme sınavı sonuç verileri yer almaktadır:
- Toplam Soru: ${totalCount}
- Doğru: ${correctCount}, Yanlış: ${wrongCount}, Boş: ${blankCount}
- Puan: ${score} / 100
${harcananSureDk ? `- Harcanan Süre: ${harcananSureDk} dakika` : ''}

Soru Bazlı Durum:
${soruDetaylari || 'Detay bulunmuyor.'}

Öğrencinin bu denemedeki hatalarını bir "Matematik Eğitim Psikoloğu & Ölçme Değerlendirme Uzmanı" gözüyle analiz et ve sadece şu JSON formatında yanıt ver:
{
  "ana_teshis": "BİLGİ_EKSİKLİĞİ | SÜRE_YÖNETİMİ | DİKKAT_VE_ODAKLANMA | DENGELİ",
  "teshis_basligi": "Öğrenciye hitap eden kısa ve motive edici başlık (örn: 'Süre Baskısı Son Sorularda Seni Zorlamış')",
  "detayli_analiz": "Hataların temel nedenini açıklayan, öğrenciyi yargılamayan, pedagojik ve samimi 2-3 paragraflık değerlendirme.",
  "tespit_edilen_eksik_kazanimlar": ["En çok hata yapılan 1-3 kritik konu veya kazanım adı"],
  "psikolojik_tavsiye": "Sınav anı kaygısı, süre paniği veya soruya yaklaşım tarzı için 1-2 somut taktik.",
  "hedef_eylem_plani": ["Hemen bugün yapılması önerilen 3 somut mikro adım"]
}`;

  try {
    const response = await aiClient.models.generateContent({
      model: resolveAIModel('ai_psikolog'),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const raw = (response.text || '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('❌ AI Soru Psikoloğu hatası:', err);
    return {
      ana_teshis: 'BİLGİ_EKSİKLİĞİ',
      teshis_basligi: 'Deneme Analizin Hazırlandı',
      detayli_analiz: `Denemede ${correctCount} doğru, ${wrongCount} yanlış ve ${blankCount} boş cevabın bulunuyor. Eksik olduğun konuları tespit edip üzerine giderek puanını hızla artırabilirsin.`,
      tespit_edilen_eksik_kazanimlar: [],
      psikolojik_tavsiye: 'Yanlış yaptığın sorularda pes etme; her hata aslında yeni bir öğrenme fırsatıdır.',
      hedef_eylem_plani: ['Yanlış yaptığın soruların çözümlerini AI Mentör ile adım adım incele.', 'Eksik konularla ilgili 10 pratik soru çöz.']
    };
  }
}
