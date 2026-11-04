import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';

// .env öncelikli, eksikler baglanti_adresi.env'den tamamlanır
const kokDizin = path.dirname(fileURLToPath(import.meta.url));
for (const dosya of ['.env', 'baglanti_adresi.env']) {
  const envYolu = path.join(kokDizin, dosya);
  if (fs.existsSync(envYolu)) dotenv.config({ path: envYolu, quiet: true });
}

// Google Gen AI ve Pinecone Başlatma
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 120000 }, // gemini-4-argon veya akıl yürütme modelleri için 120 sn idealdir
});

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const INDEX_NAME = "zarifcozum-maarif-modeli"; // Yeni oluşturduğumuz canlı indeks adı
const pineconeIndex = pc.index(INDEX_NAME);

export async function mufredatKonulariniGetir(grade) {
  const filter = {
    $or: [
      { sinif_seviyesi: { $eq: String(grade) } },
      { sinif_seviyesi: { $eq: grade } },
      { grade: { $eq: grade } },
      { grade: { $eq: String(grade) } }
    ]
  };
  const konular = new Map();
  let paginationToken;

  do {
    const sonuc = await pineconeIndex.fetchByMetadata({
      filter,
      limit: 1000,
      ...(paginationToken ? { paginationToken } : {})
    });

    for (const kayit of Object.values(sonuc.records || {})) {
      const unite = typeof kayit.metadata?.unite === 'string' ? kayit.metadata.unite.trim() : '';
      const dosyaAdi = typeof kayit.metadata?.dosya_adi === 'string' ? kayit.metadata.dosya_adi.trim() : '';
      if (!unite || !dosyaAdi) continue;
      const anahtar = `${unite.toLocaleLowerCase('tr-TR')}\0${dosyaAdi.toLocaleLowerCase('tr-TR')}`;
      if (!konular.has(anahtar)) konular.set(anahtar, { unite, dosya_adi: dosyaAdi });
    }

    paginationToken = sonuc.pagination?.next;
  } while (paginationToken);

  return [...konular.values()].sort((a, b) =>
    a.unite.localeCompare(b.unite, 'tr') || a.dosya_adi.localeCompare(b.dosya_adi, 'tr'));
}

/**
 * Yeni yüklenen Pinecone metadata yapısına uygun kural metni oluşturur
 */
function buildConstraintText(metadata = {}) {
  const { sinif_seviyesi, unite, ham_icerik } = metadata;
  const parts = [];

  if (sinif_seviyesi) parts.push(`Sınıf Seviyesi: ${sinif_seviyesi}`);
  if (unite) parts.push(`Ünite/Konu: ${unite}`);
  if (ham_icerik) parts.push(`Müfredat İçeriği ve Kazanım Sınırları:\n${ham_icerik}`);

  return parts.length
    ? parts.join('\n\n')
    : "Genel 5-12. sınıf Türkiye Yüzyılı Maarif Modeli matematik müfredat sınırlarına ve pedagojisine sadık kal.";
}

/**
 * Öğrenci mesajına göre Pinecone'dan text-embedding-004 kullanarak ilgili kazanımı bulur (RAG)
 */
async function getMebConstraints(ogrenciMesaji, grade) {
  try {
    // 1. Yeni 'text-embedding-004' modeli ile vektör oluşturma
    // Bu model sabit olarak 768 boyutlu (dimension) çıktı üretir
    const embeddingResponse = await aiClient.models.embedContent({
      model: 'text-embedding-004',
      contents: ogrenciMesaji,
      config: { taskType: 'RETRIEVAL_QUERY' }
    });
    
    // API yanıt yapısına göre vektör dizisini güvenli şekilde çekiyoruz
    const queryVector = embeddingResponse.embedding?.values || embeddingResponse.embeddings?.[0]?.values;
    
    if (!queryVector) {
      throw new Error("Vektör verisi Google API'den alınamadı.");
    }

    // 2. Pinecone Filtreleme Hazırlığı
    // Eğer sınıf seviyesi (grade) geldiyse, aramayı sadece o sınıfın kazanımlarıyla daraltıyoruz
    const filterQuery = {};
    if (grade) {
      filterQuery.sinif_seviyesi = { $eq: String(grade).trim() }; // Metadata'daki veri tipine göre string/sayı uyumu
    }

    // 3. Pinecone'da en alakalı 2 kazanımı aratıyoruz
    const searchResults = await pineconeIndex.query({
      vector: queryVector,
      topK: 2,
      includeMetadata: true,
      ...(grade && { filter: filterQuery }),
    });

    if (searchResults.matches && searchResults.matches.length > 0) {
      // En yüksek puanlı/alakalı ilk eşleşmenin metadatasını kural olarak döndürüyoruz
      return buildConstraintText(searchResults.matches[0].metadata);
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
 */
export async function zarifCozumAIServisi(ogrenciMesaji, gorevTuru = 'ai_mentor', grade) {
  // 1. Adım: Pinecone'dan yeni 768 boyutlu müfredat sınırını çek
  const mebSiniri = await getMebConstraints(ogrenciMesaji, grade);

  let systemInstruction = "";
  let selectedModel = "gemini-4-argon"; // Ücretli hattınızın en zeki akıl yürütme modeli

  // 2. Adım: Göreve göre yapay zekaya rol biçme
  if (gorevTuru === 'ai_mentor') {
    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeline tamamen hakim, uzman bir Matematik AI Mentörüsün.
      Öğrenciye matematik sorusunun cevabını asla doğrudan söyleme.
      Yaptığı mantıksal veya işlemsel hatayı tespit et, hatayı kendisinin bulmasını sağlayacak pedagojik ipuçları (Sokratik yöntem) ver.
      Sadece sana verilen resmi müfredat kazanım sınırları içinde kal, üst sınıf formülleri ve yöntemleri kesinlikle verme:
      
      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  } else if (gorevTuru === 'soru_uretme') {
    systemInstruction = `
      Sen Türkiye Yüzyılı Maarif Modeli matematik müfredat standartlarında özgün sorular yazan profesyonel bir yazarsın.
      Aşağıda belirtilen kazanım sınırlarına %100 uyumlu (Örn: içerikteki sayı sınırlarını veya yöntem kısıtlamalarını aşma), şıkları ve detaylı adımlı çözümü olan tamamen özgün bir matematik sorusu üret:
      
      [RESMİ MÜFREDAT BAĞLAMI]
      ${mebSiniri}
    `;
  }

  // 3. Adım: Gemini'ı tetikleme
  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: ogrenciMesaji,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Matematiksel netlik ve müfredata sadakat için yaratıcılığı düşük tutuyoruz
      },
    });

    return response.text;
  } catch (error) {
    console.error("❌ Gemini API Gerçek Hata Logu:", error);
    return "Sistemimizde anlık bir yoğunluk yaşanmaktadır, lütfen birazdan tekrar deneyiniz.";
  }
}
