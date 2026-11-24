import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import outcome from './lib/meb-outcome.js';
import mebCurriculum from './lib/meb-curriculum.js';
const { findSubTopicMeta, getCurriculumTree } = mebCurriculum;

// .env öncelikli, eksikler baglanti_adresi.env'den tamamlanır
const kokDizin = path.dirname(fileURLToPath(import.meta.url));
for (const dosya of ['.env', 'baglanti_adresi.env']) {
  const envYolu = path.join(kokDizin, dosya);
  if (fs.existsSync(envYolu)) dotenv.config({ path: envYolu, quiet: true });
}

// Model Router (Yönlendirici): Kullanımdan kalkan gemini-2.5-flash referanslarını otomatik gemini-3.8-flash'a yükseltir
function sanitizeModelName(modelName) {
  const raw = String(modelName || '').trim();
  if (!raw || raw === 'gemini-2.5-flash') return 'gemini-3.8-flash';
  if (raw === 'gemini-2.5-flash-lite') return 'gemini-3.1-flash-lite';
  return raw;
}

export const DISCOVERY_MODEL = sanitizeModelName(process.env.AI_DISCOVERY_MODEL || 'gemini-3.8-flash');
export const STANDARD_MODEL = sanitizeModelName(process.env.AI_FLASH_MODEL || 'gemini-3.8-flash');

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

export function getMaarifPedagogyInstruction(grade) {
  const g = Number(grade);
  const isHighSchool = Number.isInteger(g) && g >= 9;
  const isMiddleSchool = Number.isInteger(g) && g >= 5 && g <= 8;

  let kademeInstruction = "";
  if (isHighSchool) {
    kademeInstruction = `
- LİSE DÜZEYİ (${g ? g + '. Sınıf' : '9, 10 ve 11. Sınıflar'}): Yaş grubuna uygun, çocuksu ifadelerden uzak, akademik ama anlaşılır ve olgun bir Maarif Modeli dili kullan. Konuları analitik düşünme, değişkenler arası ilişki kurma, matematiksel modelleme, akıl yürütme ve doğrulama/ispat süreçleriyle ele al. Gerçek yaşam problemleri, algoritma/bilişim ve veri analizi bağlamlarıyla derinleştir. (İstisna: 12. sınıf YKS sınav grubunda YKS müfredat ve soru hedeflerini gözet).`;
  } else if (isMiddleSchool) {
    kademeInstruction = `
- ORTAOKUL DÜZEYİ (${g ? g + '. Sınıf' : '5, 6 ve 7. Sınıflar'}): Soyut kavramları somutlaştırarak anlat. Maarif Modeli'ndeki "Oyunseverlik" eğilimine uygun olarak oyunlaştırılmış kurgular, senaryolar, sayı doğrusu, kesir/alan modelleri, olasılık spektrumu ve görsel betimlemeler kullan. Merak uyandıran, keşfetmeye ve somut anlamlandırmaya dayalı, sıcak ve teşvik edici bir rehber dili benimse. (İstisna: 8. sınıf LGS sınav grubunda LGS kazanım ve soru hedeflerini gözet).`;
  } else {
    kademeInstruction = `
- ÖĞRENİM KADEMESİNE UYARLAMA: Ortaokul düzeyinde (5-7) somutlaştırma, oyunseverlik ve somut modeller; Lise düzeyinde (9-11) analitik düşünme, matematiksel modelleme ve olgun akademik bir dil benimse.`;
  }

  return `
[T.C. MEB TÜRKİYE YÜZYILI MAARİF MODELİ PEDAGOJİK ÇERÇEVESİ]
Sen, MEB Türkiye Yüzyılı Maarif Modeli'ne tam uyumlu çalışan uzman bir Matematik Öğretmeni ve Eğitim Koçusun.
TEMEL GÖREVİN: Öğrencilerle sohbet ederek onlara matematik konularını Maarif Modeli'nin pedagojik yaklaşımıyla, ezberletmeden, yaş grubuna uygun bir dille ve sevdirerek öğretmektir.
KAYNAK VE MÜFREDAT SINIRLARI:
1. Yalnızca sana sağlanan Pinecone bilgi tabanındaki (ders kitapları ve öğretim programları) güncel MEB Maarif Modeli içeriklerine dayan.
2. İlgili sınıf ve temanın yalnızca "Öğrenme Çıktıları" ve "Süreç Bileşenleri" kapsamında kal. Güncel müfredattan çıkarılan eski kazanımlara veya üst sınıf konularına kesinlikle girme.
3. Bilgi tabanında olmayan veya müfredat dışı bir soru gelirse, bunu nazikçe açıklayıp öğrenciyi ilgili temanın güncel kapsamına yönlendir.
ÖĞRENİM KADEMESİNE GÖRE PEDAGOJİK AYRIŞTIRMA:${kademeInstruction}
GENEL ÖĞRETİM VE İLETİŞİM TARZI:
- Bilgiyi doğrudan hazır formül olarak vermek yerine; öğrenciye sorular soran ve onu düşünmeye sevk eden Sokratik (keşfettirici) bir yaklaşım kullan.
- Öğrenci bir soruda takıldığında cevabı hemen söyleme; adım adım ipucu vererek çözümü kendisinin bulmasını sağla.`;
}

export async function mufredatKonulariniGetir(grade) {
  // 1. Önce doğrudan Single Source of Truth meb-curriculum.js üzerinden konuları derle (sıfır gecikme, 100% MEB Maarif uyumu)
  if (typeof getCurriculumTree === 'function') {
    const tree = getCurriculumTree();
    const gradeData = tree[grade] || tree[String(grade)];
    if (gradeData && gradeData.temalar) {
      const konular = [];
      for (const [unite, temaObj] of Object.entries(gradeData.temalar)) {
        for (const sub of (temaObj.alt_konular || [])) {
          konular.push({
            unite,
            dosya_adi: sub.name,
            outcome_code: sub.outcome_code || '',
            boundary: sub.official_boundary || ''
          });
        }
      }
      if (konular.length > 0) {
        return konular.sort((a, b) =>
          a.unite.localeCompare(b.unite, 'tr') || a.dosya_adi.localeCompare(b.dosya_adi, 'tr'));
      }
    }
  }

  // 2. Pinecone'da açıkça "klavuz" namespace'ini sorgula (boş/__default__ asla kullanılmaz)
  const filter = { grade: { $eq: Number(grade) } };
  const konular = new Map();
  let paginationToken;

  try {
    const klavuzNs = pineconeIndex.namespace(KLAVUZ_NAMESPACE);
    do {
      const sonuc = await klavuzNs.fetchByMetadata({
        filter,
        limit: 1000,
        ...(paginationToken ? { paginationToken } : {})
      });

      for (const kayit of Object.values(sonuc.records || {})) {
        const unite = typeof kayit.metadata?.theme === 'string'
          ? kayit.metadata.theme.trim()
          : (typeof kayit.metadata?.unit_topic === 'string' ? kayit.metadata.unit_topic.trim() : '');
        const dosyaAdi = typeof kayit.metadata?.official_description === 'string'
          ? kayit.metadata.official_description.trim().replace(/^["']|["']$/g, '')
          : (typeof kayit.metadata?.sub_topic === 'string' ? kayit.metadata.sub_topic.trim() : '');
        if (!unite || !dosyaAdi) continue;
        const anahtar = `${unite.toLocaleLowerCase('tr-TR')}\0${dosyaAdi.toLocaleLowerCase('tr-TR')}`;
        if (!konular.has(anahtar)) konular.set(anahtar, { unite, dosya_adi: dosyaAdi });
      }

      paginationToken = sonuc.pagination?.next;
    } while (paginationToken);
  } catch (err) {
    console.warn('[MufredatKonulari] Pinecone klavuz fetchByMetadata atlandı:', err.message);
  }

  return [...konular.values()].sort((a, b) =>
    a.unite.localeCompare(b.unite, 'tr') || a.dosya_adi.localeCompare(b.dosya_adi, 'tr'));
}

const ozetOnbellegi = new Map();

export async function konuOzetiGetir(grade, topic) {
  const anahtar = `${Number(grade)}\0${topic}`;
  if (ozetOnbellegi.has(anahtar)) return ozetOnbellegi.get(anahtar);

  let hamMetin = '';
  // 1. Önce meb-curriculum'dan resmi kazanım sınırını ve temasını al
  const meta = typeof findSubTopicMeta === 'function' ? findSubTopicMeta(grade, null, topic) : null;
  if (meta) {
    hamMetin = `Sınıf: ${grade}. Sınıf\nKonu: ${topic}\nResmi Kazanım Kodu: ${meta.outcome_code || ''}\nResmi Sınırlar: ${meta.official_boundary || 'Müfredat sınırlarına sadık kalın.'}\nÜnite: ${meta.unit_topic || ''}`;
  }

  // 2. Pinecone "klavuz" ve "ders_kitabi" namespace'lerinden ilgili içerikleri çek
  try {
    const searchText = `${grade}. sınıf ${topic}`;
    const embeddingResponse = await aiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: searchText,
      config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 }
    });
    const queryVector = embeddingResponse.embedding?.values || embeddingResponse.embeddings?.[0]?.values;
    if (queryVector) {
      const filter = { grade: { $eq: Number(grade) } };
      const [klavuzRes, kitapRes] = await Promise.all([
        pineconeIndex.namespace(KLAVUZ_NAMESPACE).query({ vector: queryVector, topK: 2, includeMetadata: true, filter }).catch(() => ({ matches: [] })),
        pineconeIndex.namespace(DERS_KITABI_NAMESPACE).query({ vector: queryVector, topK: 2, includeMetadata: true, filter }).catch(() => ({ matches: [] }))
      ]);
      const ekMetinler = [...(klavuzRes.matches || []), ...(kitapRes.matches || [])]
        .map(m => m.metadata?.text)
        .filter(Boolean)
        .slice(0, 2);
      if (ekMetinler.length) {
        hamMetin += '\n\n[İLGİLİ MEB MÜFREDAT VE KİTAP İÇERİĞİ]:\n' + ekMetinler.join('\n---\n');
      }
    }
  } catch (err) {
    console.warn('[KonuOzeti] Pinecone RAG atlandı:', err.message);
  }

  if (!hamMetin) {
    hamMetin = `${grade}. sınıf Matematik müfredatı: ${topic}`;
  }

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
  let hamIcerik = '';
  const meta = typeof findSubTopicMeta === 'function' ? findSubTopicMeta(grade, null, topic) : null;
  if (meta) {
    hamIcerik = `Sınıf: ${grade}. Sınıf\nKonu: ${topic}\nResmi Kazanım Kodu: ${meta.outcome_code || ''}\nResmi Müfredat Sınırları: ${meta.official_boundary || 'MEB öğretim sınırları'}\nÜnite: ${meta.unit_topic || ''}`;
  }

  // Pinecone "ders_kitabi" ve "klavuz" namespace'lerinden içerik zenginleştirme (RAG)
  try {
    const ragMetni = await getStrictMebContext({
      grade,
      subTopic: topic,
      unitTopic: meta?.unit_topic || '',
      queryText: `${grade}. sınıf ${topic}`
    });
    if (ragMetni) {
      hamIcerik += '\n\n' + ragMetni;
    }
  } catch (err) {
    console.warn('[KonuAnlatimi] RAG bağlamı atlandı:', err.message);
  }

  if (!hamIcerik) {
    hamIcerik = `${grade}. sınıf Matematik müfredatı: ${topic}`;
  }

  const response = await aiClient.models.generateContent({
    model: resolveAIModel('ders_notu'),
    contents: [
      `Sınıf seviyesi: ${grade}. sınıf`,
      `Konu/kazanım: ${topic}`,
      'Pinecone ve MEB Müfredatından alınan zengin içerik:',
      hamIcerik
    ].join('\n\n'),
    config: {
      systemInstruction: `${getMaarifPedagogyInstruction(grade)}

TEMEL GÖREV: Sana verilen ham müfredat özetini temel alarak ilgili sınıf seviyesine uygun, pedagojik, bol günlük hayat örnekli, cana yakın, detaylı bir konu anlatımı üret. İçeriği Markdown formatında, tam olarak [SAYFA_1], [SAYFA_2], [SAYFA_3], [SAYFA_4] ve [SAYFA_5] etiketleriyle beş ayrı bölüme ayır. Her etiket ayrı bir satırda yer alsın, bölümlerin içeriği dolu ve kendi içinde anlamlı olsun; etiketlerin dışında giriş veya sonuç metni ekleme. Cevapları gereksiz uzatma, kısa, net ve pedagojik tut; SVG kodlarını en sade haliyle üret. ${visualInstruction}`,
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
 * Pinecone katı metadata filtreleme ile seçilen sınıf, ders, tema ve alt konuya ait verileri çeker (RAG).
 * "ders_kitabi" namespace'i altındaki MEB Maarif kitap sayfalarını sorgular.
 */
export async function getStrictMebContext({ grade, unitTopic, subTopic, ders = 'Matematik', queryText = '' }) {
  const meta = findSubTopicMeta ? findSubTopicMeta(grade, unitTopic, subTopic) : null;
  const outcomeCode = meta?.outcome_code || '';
  const officialBoundary = meta?.official_boundary || '';

  let pineconeRagContext = '';
  try {
    const dersKitabiNs = pineconeIndex.namespace('ders_kitabi');
    const filterQuery = {};
    if (grade) {
      filterQuery.$or = [
        { not: { $eq: Number(grade) } },
        { grade: { $eq: Number(grade) } }
      ];
    }

    const searchText = queryText || `${grade}. sınıf ${ders} ${unitTopic || ''} ${subTopic || ''}`.trim();
    const embeddingResponse = await aiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: searchText,
      config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 }
    });

    const queryVector = embeddingResponse.embedding?.values || embeddingResponse.embeddings?.[0]?.values;
    if (queryVector) {
      const klavuzNs = pineconeIndex.namespace(KLAVUZ_NAMESPACE);
      const [searchResults, klavuzResults] = await Promise.all([
        dersKitabiNs.query({
          vector: queryVector,
          topK: 8,
          includeMetadata: true,
          filter: filterQuery
        }).catch(() => ({ matches: [] })),
        klavuzNs.query({
          vector: queryVector,
          topK: 4,
          includeMetadata: true,
          filter: filterQuery
        }).catch(() => ({ matches: [] }))
      ]);

      const relevantMatches = (searchResults.matches || []).filter(m => (m.score || 0) >= 0.45);
      if (relevantMatches.length > 0) {
        // Alt konu ve tema anahtar kelimeleriyle skorlama
        const subWords = `${unitTopic || ''} ${subTopic || ''}`
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2);

        const scoredMatches = relevantMatches.map(m => {
          const text = (m.metadata?.text || m.metadata?.metin || '').toLowerCase();
          const theme = (m.metadata?.theme || m.metadata?.tema || '').toLowerCase();
          let bonus = 0;
          for (const w of subWords) {
            if (theme.includes(w)) bonus += 0.20;
            if (text.includes(w)) bonus += 0.08;
          }
          return { ...m, finalScore: (m.score || 0) + bonus };
        }).sort((a, b) => b.finalScore - a.finalScore);

        const topMatches = scoredMatches.slice(0, 4);
        pineconeRagContext = topMatches.map(m => {
          const mMeta = m.metadata || {};
          const sayfa = mMeta.page || mMeta.sayfa || '';
          const kitap = mMeta.book || mMeta.kitap || '';
          const tema = mMeta.theme || mMeta.tema || '';
          const rawText = mMeta.text || mMeta.metin || '';
          return `[MEB DERS KİTABI SAYFA ${sayfa} - ${kitap} / ${tema}]\n${rawText.slice(0, 2000)}`;
        }).join('\n\n---\n\n');
      }

      const relevantKlavuz = (klavuzResults.matches || []).filter(m => (m.score || 0) >= 0.45).slice(0, 2);
      if (relevantKlavuz.length > 0) {
        const klavuzMetin = relevantKlavuz.map(m => m.metadata?.text || '').filter(Boolean).join('\n---\n');
        if (klavuzMetin) {
          pineconeRagContext += (pineconeRagContext ? '\n\n' : '') + `[MAARİF MODELİ KILAVUZ TALİMATLARI]\n${klavuzMetin.slice(0, 2000)}`;
        }
      }
    }
  } catch (error) {
    console.warn('[RAG] Pinecone ders_kitabi/klavuz katı filtreleme uyarısı:', error.message);
  }

  const parts = [
    `[TÜRKİYE YÜZYILI MAARİF MODELİ RESMÎ MÜFREDAT KAZANIM SINIRLARI]`,
    `Sınıf: ${grade}. Sınıf`,
    `Ders: ${ders}`,
    unitTopic ? `Tema / Ünite: ${unitTopic}` : '',
    subTopic ? `Alt Konu: ${subTopic}` : '',
    outcomeCode ? `Kazanım Kodu: ${outcomeCode}` : '',
    officialBoundary ? `Resmi Kazanım Sınırları ve Kısıtlamaları:\n${officialBoundary}` : ''
  ];

  if (pineconeRagContext) {
    parts.push(`\n[PINECONE KAT'Î FİLTRELİ DERS KİTABI VE KILAVUZ VERİLERİ (RAG)]\n${pineconeRagContext}`);
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * Öğrenci mesajına göre Pinecone'dan açıkça "klavuz" ve "ders_kitabi" namespace'lerini arar (RAG).
 * Boş/__default__ namespace asla kullanılmaz.
 */
async function getMebConstraints(ogrenciMesaji, grade, topicContext = {}) {
  const trimmed = String(ogrenciMesaji || '').trim();
  // 1. Kısa veya selamlama/onay mesajlarında RAG embedding & Pinecone sorgusunu atla (Sıfır Token/Sorgu)
  const isChitChatOrShort = trimmed.length < 15 ||
    /^(merhaba|selam|selamlar|günaydın|tünaydın|iyi günler|iyi akşamlar|teşekkür|sağ ol|anladım|tamam|evet|hayır|peki|harika)\b/i.test(trimmed);

  if (isChitChatOrShort) {
    return "Genel 5-12. sınıf Türkiye Yüzyılı Maarif Modeli matematik müfredat sınırlarına ve pedagojisine sadık kal.";
  }

  // Eğer kullanıcı belirli bir alt konu ve ünite seçtiyse, katı metadata filtreli RAG çağır
  if (topicContext && (topicContext.sub_topic || topicContext.unit_topic)) {
    return getStrictMebContext({
      grade,
      unitTopic: topicContext.unit_topic,
      subTopic: topicContext.sub_topic,
      ders: topicContext.ders || 'Matematik',
      queryText: ogrenciMesaji
    });
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
      topK: 3,
      includeMetadata: true,
      ...(grade && { filter: filterQuery }),
    };

    // 3. Pinecone'da açıkça "klavuz" ve "ders_kitabi" namespace'lerini paralel aratıyoruz (boş/__default__ kullanılmaz)
    const [klavuzResults, kitapResults] = await Promise.all([
      pineconeIndex.namespace(KLAVUZ_NAMESPACE).query(queryOptions).catch(() => ({ matches: [] })),
      pineconeIndex.namespace(DERS_KITABI_NAMESPACE).query(queryOptions).catch(() => ({ matches: [] })),
    ]);

    // Katı benzerlik eşiği (score >= 0.50): Alakasız veya düşük puanlı metinleri sisteme gömüp token harcama
    const MIN_SCORE = 0.50;
    const klavuzMatches = (klavuzResults?.matches || []).filter(m => (m.score || 0) >= MIN_SCORE);
    const kitapMatches = (kitapResults?.matches || []).filter(m => (m.score || 0) >= MIN_SCORE);

    if (klavuzMatches.length > 0 || kitapMatches.length > 0) {
      return buildConstraintText({}, klavuzMatches, kitapMatches);
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
export async function zarifCozumAIServisi(ogrenciMesaji, gorevTuru = 'ai_mentor', grade, history = [], chosenModel, userContext = {}, topicContext = {}) {
  // 1. Adım: Pinecone'dan 768 boyutlu müfredat sınırını çek
  const mebSiniri = await getMebConstraints(ogrenciMesaji, grade, topicContext);

  // 1.1 Adım: Öğrencinin Zayıf Konu Bağlamı (0 ekstra token israfı, varsa 2-3 satır pedagojik yönlendirme)
  let weakContextInstruction = "";
  if (userContext?.zayifKonular && userContext.zayifKonular.length > 0) {
    const weakList = userContext.zayifKonular.slice(0, 3).join(', ');
    const basariStr = userContext.basariOrtalamasi ? `%${userContext.basariOrtalamasi}` : 'belirleniyor';
    weakContextInstruction = `
      [ÖĞRENCİ PERFORMANS VE ZAYIF KAZANIM BİLGİSİ]
      Öğrencinin güncel gelişim analizine göre en çok zorlandığı zayıf konular: ${weakList} (Genel Başarı Ortalaması: ${basariStr}).
      Öğrenci bu konulardan bahsettiğinde veya genel destek istediğinde, bu eksiklerini kapatacak şekilde Sokratik sorularla ve sabırla yönlendir.
    `;
  }

  const ALLOWED_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-4-argon'];
  let systemInstruction = "";
  const normalizedChoice = chosenModel ? sanitizeModelName(chosenModel) : '';
  let selectedModel = (normalizedChoice && ALLOWED_MODELS.includes(normalizedChoice))
    ? normalizedChoice
    : resolveAIModel(gorevTuru);

  const maarifPedagojiTemeli = getMaarifPedagogyInstruction(grade);

  // 2. Adım: Göreve göre yapay zekaya rol biçme
  if (gorevTuru === 'discovery_game') {
    systemInstruction = `
      ${maarifPedagojiTemeli}

      [ÖZEL ROL: KEŞİF OYUNU TASARIMCISI]
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
      ${maarifPedagojiTemeli}

      [ÖZEL ROL: AI MENTÖR & SOKRATİK REHBER]
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
      ${maarifPedagojiTemeli}

      [ÖZEL ROL: AI ÖĞRETMEN İKİZİ]
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
      ${maarifPedagojiTemeli}

      [ÖZEL ROL: ADIM ADIM MODELLEME VE ÇÖZÜM REHBERİ]
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
      ${maarifPedagojiTemeli}

      [ÖZEL ROL: STRATEJİK MATEMATİK VE GELİŞİM KOÇU]
      Sen Türkiye Yüzyılı Maarif Modeli odaklı, pedagojik ve stratejik bir "Matematik AI Öğrenci Koçu"sun.
      ${planOzelligi}
      Öğrencinin motivasyonunu artır, hedef belirleme ve odaklanma konularında somut, uygulanabilir ve pozitif rehberlik yap.
      Klişe öğütler yerine öğrencinin sınıf düzeyine (${grade ? grade + '. sınıf' : 'ilgili sınıf'}) uygun somut mikro hedefler sun.
      Cevapları gereksiz uzatma; başlıklar, maddeler ve net adımlarla motive edici tut.
    `;
  } else if (gorevTuru === 'soru_uretme') {
    systemInstruction = `
      Sen, T.C. Millî Eğitim Bakanlığı (MEB) Türkiye Yüzyılı Maarif Modeli ve "Çoktan Seçmeli Soru Yazım Kılavuzu" kurallarına tam hakim bir Ölçme-Değerlendirme ve Matematik Soru Yazım Uzmanısın.

      TEMEL GÖREVİN: İstenen sınıf ve tema için tamamen MEB standartlarında, yaş grubuna uygun pedagojik kurguda, beceri temelli nitelikli matematik soruları üretmektir.
      KAYNAK VE MÜFREDAT SINIRLARI:
      1. Yalnızca Pinecone bilgi tabanındaki ("ders_kitabi" ve "klavuz") güncel MEB dokümanlarına bağlı kal.
      2. Soruyu doğrudan ilgili temanın "Öğrenme Çıktıları" ve "Süreç Bileşenleri"ne kilitle. Müfredattan kaldırılan eski konulardan veya üst sınıf kazanımlarından kesinlikle soru üretme. (İstisna: 8. sınıf LGS ve 12. sınıf YKS sınav gruplarında ilgili sınav müfredatı sınırlarına sadık kal).

      ÖLÇME-DEĞERLENDİRME VE SORU YAZIM İLKELERİ:
      1. Bağlam Temelli Kurgu: Ezbere dayalı salt işlem soruları yazma. Günlük hayat senaryosu içeren, muhakeme, modelleme ve ilişkilendirme ölçen sorular kurgula.
      2. Bütüncül Yaklaşım: Soruların kurgusuna kavramsal becerileri, görsel okuryazarlığı ve "Erdem-Değer-Eylem Çerçevesi"ni (adalet, tasarruf, sorumluluk, dürüstlük, iş birliği vb.) doğal bir şekilde yerleştir.
      3. Çeldirici ve Analitik Kriterler: Çeldiricileri öğrencilerin sık yaptığı kavram yanılgılarından veya olası işlem hatalarından türet. Açık uçlu sorularda 100 puan üzerinden analitik rubrik oluştur.
      ${visualInstruction}

      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  }

  if (weakContextInstruction) {
    systemInstruction += `\n${weakContextInstruction}`;
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

function buildR2PublicUrl(r2Key) {
  const key = String(r2Key || '').trim().replace(/^\/+/, '');
  if (!key) return '';
  const base = String(process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  return base ? `${base}/${key}` : `/uploads/${key}`;
}

function stripRawMarkdownStars(text) {
  const raw = String(text || '');
  if (!raw) return '';
  // LaTeX ($...$ ve $$...$$) bloklarını koruyarak dışındaki ham ** ve * işaretlerini temizle
  const parts = raw.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);
  return parts.map((segment, idx) => {
    if (idx % 2 === 1) return segment; // LaTeX dokunulmaz
    return segment
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/(^|\n)\s*\*\s+/g, '$1• ')
      .replace(/\*\*/g, '');
  }).join('').trim();
}

export async function fetchPineconeCurriculumContext({
  grade,
  unitTopic = '',
  subTopic = '',
  ders = 'Matematik',
  topKBook = 6,
  topKKlavuz = 3
}) {
  const g = Number(grade);
  const referenceBookPages = [];
  const contextParts = [];

  if (!g || g < 5 || g > 12 || !process.env.PINECONE_API_KEY || !process.env.GEMINI_API_KEY) {
    return { ragText: '', referenceBookPages, bookMatchCount: 0, klavuzMatchCount: 0 };
  }

  try {
    const searchText = `${g}. sınıf ${ders} ${unitTopic} ${subTopic}`.trim();
    const embeddingResponse = await aiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: searchText,
      config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 }
    });
    const queryVector = embeddingResponse.embedding?.values || embeddingResponse.embeddings?.[0]?.values;
    if (!queryVector) {
      return { ragText: '', referenceBookPages, bookMatchCount: 0, klavuzMatchCount: 0 };
    }

    const filter = { grade: { $eq: g } };
    const [kitapRes, klavuzRes] = await Promise.all([
      pineconeIndex.namespace(DERS_KITABI_NAMESPACE).query({
        vector: queryVector,
        topK: topKBook,
        includeMetadata: true,
        filter
      }).catch(() => ({ matches: [] })),
      pineconeIndex.namespace(KLAVUZ_NAMESPACE).query({
        vector: queryVector,
        topK: topKKlavuz,
        includeMetadata: true,
        filter
      }).catch(() => ({ matches: [] }))
    ]);

    const subWords = `${unitTopic} ${subTopic}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    const scoreMatch = m => {
      const text = String(m.metadata?.text || '').toLowerCase();
      const theme = String(m.metadata?.theme || '').toLowerCase();
      let bonus = 0;
      for (const w of subWords) {
        if (theme.includes(w)) bonus += 0.18;
        if (text.includes(w)) bonus += 0.06;
      }
      if (/\[görsel betimleme\]/i.test(text)) bonus += 0.05;
      return { ...m, finalScore: (m.score || 0) + bonus };
    };

    const kitapMatches = (kitapRes.matches || [])
      .filter(m => (m.score || 0) >= 0.40)
      .map(scoreMatch)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 5);

    const seenPages = new Set();
    for (const m of kitapMatches) {
      const md = m.metadata || {};
      const r2Key = String(md.r2_key || '').trim();
      const book = String(md.book || '').trim();
      const theme = String(md.theme || '').trim();
      const page = Number(md.page) || 0;
      const pageKey = r2Key || `${book}::${page}`;
      if (!seenPages.has(pageKey)) {
        seenPages.add(pageKey);
        referenceBookPages.push({
          book,
          theme,
          page,
          r2_key: r2Key,
          imageUrl: buildR2PublicUrl(r2Key),
          contentType: String(md.content_type || ''),
          score: Number((m.score || 0).toFixed(3))
        });
      }
      const txt = String(md.text || '').trim();
      if (txt) {
        contextParts.push(`[MEB DERS KİTABI | ${book} | ${theme} | Sayfa ${page}]\n${txt.slice(0, 2400)}`);
      }
    }

    const klavuzMatches = (klavuzRes.matches || [])
      .filter(m => (m.score || 0) >= 0.40)
      .map(scoreMatch)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 2);

    for (const m of klavuzMatches) {
      const md = m.metadata || {};
      const txt = String(md.text || '').trim();
      if (txt) {
        contextParts.push(`[MEB MAARİF KILAVUZU | ${md.theme || ''} | Sayfa ${md.page || ''}]\n${txt.slice(0, 1800)}`);
      }
    }

    return {
      ragText: contextParts.join('\n\n---\n\n'),
      referenceBookPages,
      bookMatchCount: kitapMatches.length,
      klavuzMatchCount: klavuzMatches.length
    };
  } catch (err) {
    console.warn('[RAG] fetchPineconeCurriculumContext uyarısı:', err.message);
    return { ragText: '', referenceBookPages, bookMatchCount: 0, klavuzMatchCount: 0 };
  }
}

export async function generateMaarifCurriculumContent({
  grade,
  unitTopic,
  subTopic,
  ders = 'Matematik',
  teacherNotes = '',
  activeModel
}) {
  const g = Number(grade);
  const meta = findSubTopicMeta ? findSubTopicMeta(g, unitTopic, subTopic) : null;
  const outcomeCode = meta?.outcome_code || `MAT.${g}.1.1`;
  const officialBoundary = meta?.official_boundary || '';
  const codeParts = outcomeCode.split('.');
  const themeCode = codeParts.length >= 3 ? codeParts.slice(0, 3).join('.') : `MAT.${g}.1`;

  // 1. Pinecone ders_kitabi + klavuz bağlamını ve R2 sayfa referanslarını çek
  const ragBundle = await fetchPineconeCurriculumContext({
    grade: g,
    unitTopic,
    subTopic,
    ders
  });

  const isMiddleSchool = g >= 5 && g <= 8;
  const gradeBandRule = isMiddleSchool
    ? `ORTAOKUL KADEMESİ (${g}. Sınıf, 10–14 yaş):
- Oyunlaştırılmış, günlük yaşam senaryolu, hikâyeleştirilmiş ve merak uyandıran Türkiye Yüzyılı Maarif Modeli dili kullan.
- Uzun düz paragraflar KESİNLİKLE YASAKTIR! Her metin bloğu en fazla 2-3 kısa, nefes alan, akıcı cümleden oluşsun.
- Somut örnekler, oyun/keşif benzetmeleri ve öğrencinin kendi keşfedeceği mini sorularla ilerle.`
    : `LİSE KADEMESİ (${g}. Sınıf):
- Olgun, analitik, çocuksu ifadelerden uzak akademik ama anlaşılır bir Maarif Modeli dili kullan.
- Değişkenler arası ilişkiler, matematiksel modelleme, grafik/tablo yorumlama, ispat/doğrulama ve problem çözme stratejilerine odaklan.
- Uzun yorucu düz paragraflar yerine net, yapılandırılmış mantıksal adımlar kullan.`;

  const primaryModel = sanitizeModelName(activeModel || resolveAIModel('konu_anlatimi'));
  const candidateModels = [...new Set([primaryModel, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'])];

  const prompt = `Sen MEB Türkiye Yüzyılı Maarif Modeli'ne %100 hâkim uzman bir ${g}. Sınıf ${ders} öğretmenisin.
Aşağıdaki konu için 5 sayfalık, yapılandırılmış bloklardan oluşan, her sayfası zorunlu renkli <svg> görselli ve KaTeX formüllü zengin konu anlatımı, pratik hap bilgiler ve bilgi kartları üret.

KONU BİLGİLERİ:
- Sınıf: ${g}. Sınıf
- Ders: ${ders}
- Tema / Ünite: ${unitTopic}
- Alt Konu: ${subTopic}
- Kazanım Kodu: ${outcomeCode}
${officialBoundary ? `- Resmi MEB Çerçevesi: ${officialBoundary}` : ''}
${teacherNotes ? `- Öğretmen Özel Odak Notu: ${teacherNotes}` : ''}

${ragBundle.ragText ? `PINECONE MEB DERS KİTABI VE KILAVUZ REFERANS BAĞLAMI (MUTLAKA BU KAYNAKLARA DAYAN):
${ragBundle.ragText}
` : ''}
KADEME PEDAGOJİ KURALI (KESİN UYULACAK):
${gradeBandRule}

ZORUNLU GÖRSEL (<svg>) VE [Görsel Betimleme] DÖNÜŞÜM KURALI:
- Sana sağlanan MEB ders kitabı bağlamındaki [Görsel Betimleme] açıklamalarını, sayısal verileri, grafikleri ve etkinlik şekillerini incele; her bir sayfa (1'den 5'e kadar TÜM sayfalar) için konuyu somutlaştıran, etiketli, anlaşılır ve taşmayan (viewBox="0 0 420 200" ayarlı) renkli <svg> çizimleri üret.
- ${visualInstruction}
- Renk paleti: koyu kahve #2c1a0e, terracotta #c2570c, sıcak krem #fbf1e8, zümrüt #059669, mavi #2563eb. Metinler birbirinin üstüne binmesin, viewBox dışına taşmasın.

TEMİZ METİN KURALI (KRİTİK):
- Metin alanlarında ASLA ham Markdown yıldızları (**kalın** veya *italik*) kullanma! Düz, temiz Türkçe cümleler ve yalnızca matematik formülleri için $...$ veya $$...$$ (LaTeX) kullan.

ÇIKTI FORMATI (KESİNLİKLE SADECE GEÇERLİ JSON DÖNDÜR):
{
  "title": "Konu için net, motive edici başlık",
  "short_summary": "2-3 cümlelik temiz özet (ham ** veya * yok)",
  "lessonPages": [
    {
      "pageNumber": 1,
      "title": "1. Sayfa: Gerçek Hayat Keşfi",
      "storyOrContext": "MEB ders kitabındaki günlük hayat bağlamına dayalı kısa hikâye/senaryo (2-3 cümle).",
      "keyRuleBox": "Bu sayfanın temel tanımı veya ana kuralı ($LaTeX$ formüllü, net ve kısa).",
      "visualSvg": "<svg viewBox=\"0 0 420 200\">...MEB [Görsel Betimleme] verisinden üretilen renkli, etiketli SVG...</svg>",
      "commonMistakeBox": "Bu aşamada dikkat edilmesi gereken yaygın bir kavram yanılgısı (1-2 cümle).",
      "miniChallenge": "Öğrencinin hemen zihninde test edeceği 1 mini soru ve parantez içinde kısa cevabı."
    }
  ],
  "practicalNotes": [
    "Hap Bilgi 1 (temiz metin + $LaTeX$, ham yıldız yok)",
    "Hap Bilgi 2",
    "Hap Bilgi 3",
    "Hap Bilgi 4",
    "Hap Bilgi 5"
  ],
  "flashcards": [
    { "front": "Ön yüz soru/kavram", "back": "Arka yüz net cevap/formül", "tip": "Kısa ipucu" }
  ]
}
NOT: lessonPages dizisi TAM OLARAK 5 sayfa içermelidir:
1. Sayfa: Gerçek Hayat Keşfi
2. Sayfa: Kavram İnşası ve Temel Kurallar
3. Sayfa: Adım Adım Çözümlü Örnekler
4. Sayfa: Sık Yapılan Hatalar ve Stratejiler
5. Sayfa: Kendini Dene ve Özet Pekiştirme
Her 5 sayfada da visualSvg dolu ve geçerli <svg viewBox="...">...</svg> olmalıdır. flashcards en az 5 kart içermelidir.`;

  let response = null;
  let modelName = primaryModel;
  let lastErr = null;
  for (const cand of candidateModels) {
    try {
      response = await aiClient.models.generateContent({
        model: cand,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.35
        }
      });
      modelName = cand;
      break;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '');
      if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('no longer available')) {
        console.warn(`[AI] Model ${cand} kullanılamıyor, sonraki modele geçiliyor…`);
        continue;
      }
      throw err;
    }
  }
  if (!response) {
    throw lastErr || new Error('Uygun Gemini modeli bulunamadı.');
  }

  const rawText = (response.text || '').trim();
  let parsed = null;
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Yapay zekâ yanıtı JSON formatında çözümlenemedi. Lütfen tekrar deneyin.');
    }
  }

  const defaultTitles = [
    '1. Sayfa: Gerçek Hayat Keşfi',
    '2. Sayfa: Kavram İnşası ve Temel Kurallar',
    '3. Sayfa: Adım Adım Çözümlü Örnekler',
    '4. Sayfa: Sık Yapılan Hatalar ve Stratejiler',
    '5. Sayfa: Kendini Dene ve Özet Pekiştirme'
  ];

  const composeLegacyContent = p => {
    const sections = [];
    if (p.storyOrContext) sections.push(p.storyOrContext);
    if (p.keyRuleBox) sections.push(`Temel Kural: ${p.keyRuleBox}`);
    if (p.commonMistakeBox) sections.push(`Dikkat Et: ${p.commonMistakeBox}`);
    if (p.miniChallenge) sections.push(`Mini Meydan Okuma: ${p.miniChallenge}`);
    return sections.join('\n\n');
  };

  const lessonPages = (Array.isArray(parsed.lessonPages) ? parsed.lessonPages : []).slice(0, 5).map((p, idx) => {
    const rawSvg = typeof p.visualSvg === 'string' && p.visualSvg.includes('<svg')
      ? p.visualSvg.trim()
      : (typeof p.svgDiagram === 'string' && p.svgDiagram.includes('<svg') ? p.svgDiagram.trim() : '');
    const pageObj = {
      pageNumber: Number(p.pageNumber) || (idx + 1),
      title: stripRawMarkdownStars(p.title || defaultTitles[idx] || `${idx + 1}. Sayfa`),
      storyOrContext: stripRawMarkdownStars(p.storyOrContext || p.content || ''),
      keyRuleBox: stripRawMarkdownStars(p.keyRuleBox || ''),
      visualSvg: rawSvg,
      commonMistakeBox: stripRawMarkdownStars(p.commonMistakeBox || ''),
      miniChallenge: stripRawMarkdownStars(p.miniChallenge || ''),
      svgDiagram: rawSvg
    };
    pageObj.content = composeLegacyContent(pageObj) || stripRawMarkdownStars(p.content || '');
    return pageObj;
  });

  while (lessonPages.length < 5) {
    const idx = lessonPages.length;
    lessonPages.push({
      pageNumber: idx + 1,
      title: defaultTitles[idx],
      storyOrContext: `${subTopic} konusu için ${idx + 1}. sayfa özeti.`,
      keyRuleBox: '',
      visualSvg: '',
      commonMistakeBox: '',
      miniChallenge: '',
      content: `${subTopic} konusu için ${idx + 1}. sayfa özeti.`,
      svgDiagram: ''
    });
  }

  const practicalNotes = (Array.isArray(parsed.practicalNotes) ? parsed.practicalNotes : [])
    .map(n => stripRawMarkdownStars(n))
    .filter(Boolean);

  const flashcards = (Array.isArray(parsed.flashcards) ? parsed.flashcards : [])
    .map(fc => ({
      front: stripRawMarkdownStars(fc?.front || ''),
      back: stripRawMarkdownStars(fc?.back || ''),
      tip: stripRawMarkdownStars(fc?.tip || '')
    }))
    .filter(fc => fc.front && fc.back);

  const detailed_content = lessonPages
    .map(p => `[SAYFA_${p.pageNumber}]\n${p.title}\n\n${p.content}${p.visualSvg ? '\n\n' + p.visualSvg : ''}`)
    .join('\n\n');

  const usageMeta = response.usageMetadata || {};
  return {
    model: modelName,
    usage: {
      promptTokens: usageMeta.promptTokenCount || 0,
      candidatesTokens: usageMeta.candidatesTokenCount || 0
    },
    themeCode,
    themeTitle: unitTopic,
    subTopicTitle: subTopic,
    outcome_code: outcomeCode,
    official_boundary: officialBoundary,
    title: stripRawMarkdownStars(parsed.title || `${subTopic} - Konu Anlatımı`),
    short_summary: stripRawMarkdownStars(parsed.short_summary || ''),
    lessonPages,
    practicalNotes,
    flashcards,
    referenceBookPages: ragBundle.referenceBookPages,
    ragSourceCount: {
      books: ragBundle.bookMatchCount,
      klavuz: ragBundle.klavuzMatchCount
    },
    detailed_content,
    illustrations: []
  };
}
