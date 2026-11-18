const { GoogleGenAI } = require('@google/genai');
let Pinecone;
try {
  Pinecone = require('@pinecone-database/pinecone').Pinecone;
} catch {
  Pinecone = null;
}

const INDEX_ADI = process.env.PINECONE_INDEX || 'meb-mufredat';
const EMBEDDING_MODELI = 'gemini-embedding-001';
const EMBEDDING_BOYUT = 768;

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function calculateJaccardSimilarity(textA, textB) {
  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

let genAIClient = null;
function getGenAI() {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!genAIClient) genAIClient = new GoogleGenAI({ apiKey });
  return genAIClient;
}

let pineconeClient = null;
function getPinecone() {
  const apiKey = String(process.env.PINECONE_API_KEY || '').trim();
  if (!apiKey || !Pinecone) return null;
  if (!pineconeClient) pineconeClient = new Pinecone({ apiKey });
  return pineconeClient;
}

async function createEmbedding(text) {
  const ai = getGenAI();
  if (!ai || !text || text.trim().length === 0) return null;
  try {
    const res = await ai.models.embedContent({
      model: EMBEDDING_MODELI,
      contents: text.trim(),
      config: { outputDimensionality: EMBEDDING_BOYUT, taskType: 'RETRIEVAL_DOCUMENT' }
    });
    return res.embedding?.values || null;
  } catch (err) {
    console.warn('[ContentSimilarity] Embedding oluşturulamadı:', err.message);
    return null;
  }
}

async function checkQuestionSimilarity(questionText, existingQuestions = []) {
  if (!questionText || typeof questionText !== 'string') {
    return { isDuplicate: false, similarityScore: 0, similarQuestionId: null };
  }

  // 1. Pinecone Vector Arama (Varsa)
  const pc = getPinecone();
  if (pc) {
    try {
      const vector = await createEmbedding(questionText);
      if (vector && vector.length === EMBEDDING_BOYUT) {
        const index = pc.index(INDEX_ADI);
        const queryRes = await index.namespace('questions').query({
          vector,
          topK: 1,
          includeMetadata: true
        });

        if (queryRes && queryRes.matches && queryRes.matches.length > 0) {
          const topMatch = queryRes.matches[0];
          const score = Math.round((topMatch.score || 0) * 100);
          if (score >= 85) {
            return {
              isDuplicate: true,
              similarityScore: score,
              similarQuestionId: topMatch.id,
              method: 'pinecone_vector'
            };
          }
        }
      }
    } catch (pcErr) {
      console.warn('[ContentSimilarity] Pinecone sorgusu atlandı:', pcErr.message);
    }
  }

  // 2. Yerel Jaccard / Token Benzerliği Fallback
  let maxScore = 0;
  let bestMatchId = null;

  for (const q of existingQuestions) {
    const targetText = q.text || q.imageFile || '';
    const sim = calculateJaccardSimilarity(questionText, targetText);
    const scorePct = Math.round(sim * 100);
    if (scorePct > maxScore) {
      maxScore = scorePct;
      bestMatchId = q._id || q.id;
    }
  }

  return {
    isDuplicate: maxScore >= 80,
    similarityScore: maxScore,
    similarQuestionId: maxScore >= 80 ? bestMatchId : null,
    method: 'text_token_fallback'
  };
}

async function indexQuestionInPinecone(questionId, questionText, metadata = {}) {
  const pc = getPinecone();
  if (!pc || !questionText) return false;
  try {
    const vector = await createEmbedding(questionText);
    if (!vector || vector.length !== EMBEDDING_BOYUT) return false;

    const index = pc.index(INDEX_ADI);
    await index.namespace('questions').upsert([{
      id: String(questionId),
      values: vector,
      metadata: {
        text: questionText.slice(0, 500),
        grade: metadata.grade || 0,
        topic: metadata.topic || '',
        difficulty: metadata.difficulty || '',
        createdAt: new Date().toISOString()
      }
    }]);
    return true;
  } catch (err) {
    console.warn('[ContentSimilarity] Pinecone indeksleme atlandı:', err.message);
    return false;
  }
}

module.exports = {
  checkQuestionSimilarity,
  computeQuestionSimilarity: checkQuestionSimilarity,
  indexQuestionInPinecone,
  createEmbedding,
  calculateJaccardSimilarity,
  tokenJaccardSimilarity: calculateJaccardSimilarity,
  tokenize,
  tokenizeText: tokenize
};
