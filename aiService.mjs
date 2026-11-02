import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';

// server.js ile aynı: .env öncelikli, eksikler baglanti_adresi.env'den tamamlanır
const kokDizin = path.dirname(fileURLToPath(import.meta.url));
for (const dosya of ['.env', 'baglanti_adresi.env']) {
  const envYolu = path.join(kokDizin, dosya);
  if (fs.existsSync(envYolu)) dotenv.config({ path: envYolu, quiet: true });
}

const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 120000 }, // gemini-4-argon derin akıl yürütme yaptığı için 120 sn
});
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pc.index('meb-mufredat');

/**
 * MEB JSON şemasındaki parçalı metadata alanlarını tek bir kural metnine çevirir
 */
function buildConstraintText(metadata = {}) {
  const { outcome_code, grade, unit_topic, official_description, official_boundaries } = metadata;
  const asText = (v) => (Array.isArray(v) ? v.join(' ') : v);
  const parts = [];

  if (outcome_code) parts.push(`Kazanım Kodu: ${outcome_code}`);
  if (grade) parts.push(`Sınıf: ${grade}`);
  if (unit_topic) parts.push(`Ünite/Konu: ${unit_topic}`);
  if (official_description) parts.push(`Kazanım Açıklaması: ${asText(official_description)}`);
  if (official_boundaries) parts.push(`Resmi Sınırlar: ${asText(official_boundaries)}`);

  return parts.length
    ? parts.join('\n')
    : "Genel 5-12. sınıf MEB matematik müfredat sınırlarına ve pedagojisine sadık kal.";
}

/**
 * Öğrenci mesajına göre Pinecone'dan ilgili MEB kazanım sınırını bulan fonksiyon (RAG)
 */
async function getMebConstraints(ogrenciMesaji) {
  try {
    // Mesajı sayısal vektöre çeviriyoruz
    const embeddingResponse = await aiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: ogrenciMesaji,
      config: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' },
    });
    const queryVector = embeddingResponse.embeddings[0].values;

    // Pinecone'da en alakalı kazanımı aratıyoruz
    const searchResults = await pineconeIndex.query({
      vector: queryVector,
      topK: 1,
      includeMetadata: true,
    });

    if (searchResults.matches && searchResults.matches.length > 0) {
      return buildConstraintText(searchResults.matches[0].metadata);
    }
    return "Genel 5-12. sınıf MEB matematik müfredat sınırlarına ve pedagojisine sadık kal.";
  } catch (error) {
    console.error("Pinecone arama hatası:", error);
    return "Müfredat sınırları okunamadı. Genel sınıf düzeyine sadık kal.";
  }
}

/**
 * Ana İşlem Merkezi: Soru üretimi ve AI Mentörlüğü tek koldan yönetir
 * @param {string} ogrenciMesaji - Kullanıcının chat mesajı veya soru üretme isteği
 * @param {string} gorevTuru - 'ai_mentor' veya 'soru_uretme'
 */
export async function zarifCozumAIServisi(ogrenciMesaji, gorevTuru = 'ai_mentor') {
  // 1. Adım: Pinecone'dan müfredat sınırını çek
  const mebSiniri = await getMebConstraints(ogrenciMesaji);

  let systemInstruction = "";
  let selectedModel = "gemini-4-argon"; // Ücretli hattımızın en zeki akıl yürütme modeli

  // 2. Adım: Göreve göre yapay zekaya rol biçme
  if (gorevTuru === 'ai_mentor') {
    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeline tamamen hakim, uzman bir Matematik AI Mentörüsün.
      Öğrenciye matematik sorusunun cevabını asla doğrudan söyleme.
      Yaptığı mantıksal veya işlemsel hatayı tespit et, hatayı kendisinin bulmasını sağlayacak pedagojik ipuçları ver.
      Sadece şu resmi MEB kazanım sınırları içinde kal, üst sınıf formülleri verme:
      ${mebSiniri}
    `;
  } else if (gorevTuru === 'soru_uretme') {
    systemInstruction = `
      Sen MEB müfredat standartlarında özgün matematik soruları yazan profesyonel bir yazarsın.
      Aşağıda belirtilen kazanım sınırlarına %100 uyumlu (Örn: 4 basamak sınırı varsa aşma), şıkları ve detaylı adımlı çözümü olan özgün bir soru üret:
      ${mebSiniri}
    `;
  }

  // 3. Adım: Satın aldığınız ücretli API limitleriyle Gemini'ı tetikleme
  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: ogrenciMesaji,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Matematiksel netlik için yaratıcılığı düşük tutuyoruz
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gerçek Hata Logu:", error);
    return "Sistemimizde anlık bir yoğunluk yaşanmaktadır, lütfen birazdan tekrar deneyiniz.";
  }
}
