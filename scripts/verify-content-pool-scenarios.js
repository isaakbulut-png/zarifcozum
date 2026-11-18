require('dotenv').config();
const mongoose = require('mongoose');
const assert = require('node:assert/strict');
const express = require('express');

const AiQuestionDraft = require('../models/AiQuestionDraft');
const ContentLibrary = require('../models/ContentLibrary');
const Soru = require('../models/Soru');
const { createAIRouter } = require('../routes/ai');
const { createContentLibraryRouter } = require('../routes/content-library');
const { checkQuestionSimilarity, calculateJaccardSimilarity } = require('../lib/content-similarity');
const { exportQuestions, exportContentItems, generateStandardPdf, generateStandardDocx } = require('../lib/document-exporter');
const { createConfiguredPrivateDocumentStorage } = require('../lib/site-media-storage');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_ADI = process.env.DB_ADI || 'etut_merkezi';

async function runVerification() {
  console.log('===============================================================');
  console.log('🚀 MERKEZİ İÇERİK HAVUZU 12 SENARYO DOĞRULAMA TESTİ BAŞLATILIYOR');
  console.log('===============================================================\n');

  // 0. Veritabanı Bağlantısı
  console.log('📦 MongoDB bağlantısı kuruluyor...');
  await mongoose.connect(MONGODB_URI, { dbName: DB_ADI });
  console.log(`✅ MongoDB bağlandı: ${mongoose.connection.host}/${DB_ADI}\n`);

  const results = [];
  let testDraftId = null;
  let testQuestion = null;
  let testSoruId = null;
  let testContentId = null;

  // Test Express Server Setup
  const app = express();
  app.use(express.json());
  // Mock teacher session
  const mockTeacher = { id: 'teacher_test_001', role: 'teacher', username: 'ogretmen_test' };
  app.use((req, res, next) => {
    req.session = { user: mockTeacher };
    next();
  });

  const privateDocumentStorage = createConfiguredPrivateDocumentStorage(process.env);
  const mediaStorage = { saveFile: async () => ({ url: 'https://media.zarifcozum.com/test.jpg' }) };
  const mockAdminLog = { log: async () => {} };

  app.use('/api/ai', createAIRouter({
    getQuizCollection: () => mongoose.connection.collection('quizler'),
    requireRole: () => (req, res, next) => next(),
    AdminLog: mockAdminLog
  }));

  app.use('/api/content-library', createContentLibraryRouter({
    requireStaff: (req, res, next) => next(),
    mediaStorage,
    privateDocumentStorage,
    AdminLog: mockAdminLog
  }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 Test API sunucusu dinlemede: ${baseUrl}\n`);

  // --- SENARYO 1: AI ile yeni soru üret ---
  try {
    const t0 = Date.now();
    console.log('🔹 SENARYO 1: AI ile yeni soru üretiliyor...');
    
    // Doğrudan route üzerinden veya Gemini API ile soru üret
    const res = await fetch(`${baseUrl}/api/ai/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grade: 7,
        topic: 'Sayılar ve Nicelikler',
        difficulty: 'Orta',
        count: 1
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Soru üretimi başarısız (${res.status}): ${data.mesaj || JSON.stringify(data)}`);
    }

    assert.ok(data.quiz, 'quiz nesnesi dönmedi');
    assert.ok(data.quiz.questions.length > 0, 'Soru üretilemedi');
    assert.ok(data.draftId, 'draftId dönmedi');

    testDraftId = data.draftId;
    testQuestion = data.quiz.questions[0];

    const duration = Date.now() - t0;
    console.log(`   ✅ Soru başarıyla üretildi: "${testQuestion.text.slice(0, 60)}..."`);
    console.log(`   ⏱ Süre: ${duration} ms | Taslak ID: ${testDraftId}`);
    results.push({ id: 1, title: 'AI ile yeni soru üret', status: 'SUCCESS', details: `Soru üretildi (ID: ${testDraftId})`, duration });
  } catch (err) {
    console.error(`   ❌ Senaryo 1 Başarısız:`, err.message);
    results.push({ id: 1, title: 'AI ile yeni soru üret', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 2: Sorunun ai_question_drafts koleksiyonuna yazılıp yazılmadığını kontrol et ---
  try {
    console.log('\n🔹 SENARYO 2: ai_question_drafts koleksiyonu kontrol ediliyor...');
    assert.ok(testDraftId, 'Test taslak ID bulunamadı');

    const draftInDb = await AiQuestionDraft.findById(testDraftId);
    assert.ok(draftInDb, 'Taslak MongoDB ai_question_drafts koleksiyonunda bulunamadı!');
    assert.equal(draftInDb.status, 'draft', 'Taslak durumu "draft" değil!');
    assert.equal(draftInDb.topic, 'Sayılar ve Nicelikler', 'Taslak konusu uyuşmuyor!');
    assert.ok(draftInDb.questions.length > 0, 'Taslakta soru yok!');
    assert.ok(draftInDb.questions[0].options.A, 'Soru seçenekleri eksik!');

    console.log(`   ✅ Taslak MongoDB'de doğrulandı: ${draftInDb.title}`);
    console.log(`   📄 Soru Sayısı: ${draftInDb.questions.length} | Durum: ${draftInDb.status} | Koleksiyon: ai_question_drafts`);
    results.push({ id: 2, title: 'ai_question_drafts koleksiyonuna kayıt kontrolü', status: 'SUCCESS', details: `Koleksiyonda kayıt mevcut (${draftInDb._id})` });
  } catch (err) {
    console.error(`   ❌ Senaryo 2 Başarısız:`, err.message);
    results.push({ id: 2, title: 'ai_question_drafts koleksiyonuna kayıt kontrolü', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 3 & 4: Sayfayı yenile ve Taslağın geri yüklenip yüklenmediğini kontrol et ---
  try {
    console.log('\n🔹 SENARYO 3 & 4: Sayfa yenileme (F5) ve taslak geri yükleme kontrolü...');
    assert.ok(testDraftId, 'Test taslak ID bulunamadı');

    // F5 simülasyonu: Client tarafında localStorage'dan alınan draftId ile GET /api/ai/questions/drafts/:id çağrılır
    const getDraftRes = await fetch(`${baseUrl}/api/ai/questions/drafts/${testDraftId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const draftData = await getDraftRes.json();

    assert.ok(getDraftRes.ok, `Taslak sorgulama başarısız (${getDraftRes.status})`);
    assert.ok(draftData.draft, 'Dönen veri içinde draft nesnesi yok');
    assert.equal(draftData.draft.id, testDraftId.toString(), 'Geri yüklenen taslak ID uyuşmuyor');
    assert.ok(draftData.draft.questions.length > 0, 'Geri yüklenen taslak soruları boş');
    assert.equal(draftData.draft.questions[0].text, testQuestion.text, 'Geri yüklenen soru metni orijinalle eşleşmiyor');

    console.log(`   ✅ F5 simülasyonu başarılı: Taslak eksiksiz geri yüklendi.`);
    console.log(`   🔄 Kurtarılan Soru: "${draftData.draft.questions[0].text.slice(0, 50)}..."`);
    results.push({ id: 3, title: 'Sayfa yenileme simülasyonu (F5)', status: 'SUCCESS', details: 'Client localStorage draftId parametresi sağlandı' });
    results.push({ id: 4, title: 'Taslağın geri yüklenip yüklenmediği', status: 'SUCCESS', details: `Taslak eksiksiz yüklendi (ID: ${draftData.draft.id})` });
  } catch (err) {
    console.error(`   ❌ Senaryo 3 & 4 Başarısız:`, err.message);
    results.push({ id: 3, title: 'Sayfa yenileme simülasyonu (F5)', status: 'FAILED', error: err.message });
    results.push({ id: 4, title: 'Taslağın geri yüklenip yüklenmediği', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 5: Soruyu Soru Bankasına Aktar ---
  try {
    console.log('\n🔹 SENARYO 5: Soru Soru Bankasına aktarılıyor...');
    assert.ok(testDraftId, 'Test taslak ID bulunamadı');

    const transferRes = await fetch(`${baseUrl}/api/ai/questions/drafts/${testDraftId}/transfer-to-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndices: [0] })
    });
    const transferData = await transferRes.json();

    assert.ok(transferRes.ok, `Transfer başarısız (${transferRes.status}): ${JSON.stringify(transferData)}`);
    assert.ok(transferData.success, 'Transfer response success !== true');
    assert.ok(transferData.transferredCount >= 1, 'Aktarılan soru sayısı 0');

    console.log(`   ✅ Soru Bankasına Aktarma Başarılı: ${transferData.transferredCount} soru aktarıldı.`);
    results.push({ id: 5, title: 'Soruyu Soru Bankasına Aktar', status: 'SUCCESS', details: `${transferData.transferredCount} soru aktarıldı` });
  } catch (err) {
    console.error(`   ❌ Senaryo 5 Başarısız:`, err.message);
    results.push({ id: 5, title: 'Soruyu Soru Bankasına Aktar', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 6: Sorunun sorular koleksiyonuna kaydedilip kaydedilmediğini kontrol et ---
  try {
    console.log('\n🔹 SENARYO 6: sorular koleksiyonu kalıcı kayıt kontrolü...');
    assert.ok(testDraftId, 'Test taslak ID bulunamadı');

    const soruInDb = await Soru.findOne({ draftId: testDraftId });
    assert.ok(soruInDb, 'Soru "sorular" koleksiyonunda bulunamadı!');
    assert.equal(soruInDb.format, 'text_svg', 'Soru formatı text_svg değil!');
    assert.equal(soruInDb.source, 'ai_generated', 'Soru kaynağı ai_generated değil!');
    assert.equal(soruInDb.topic, 'Sayılar ve Nicelikler', 'Soru konusu eşleşmiyor!');
    assert.ok(soruInDb.answer, 'Soru doğru cevabı eksik!');

    testSoruId = soruInDb._id;
    console.log(`   ✅ Soru "sorular" koleksiyonunda doğrulandı!`);
    console.log(`   🆔 Soru ID: ${soruInDb._id} | Format: ${soruInDb.format} | Cevap: ${soruInDb.answer}`);
    results.push({ id: 6, title: 'sorular koleksiyonuna kayıt kontrolü', status: 'SUCCESS', details: `Koleksiyonda doğrulandı (ID: ${soruInDb._id})` });
  } catch (err) {
    console.error(`   ❌ Senaryo 6 Başarısız:`, err.message);
    results.push({ id: 6, title: 'sorular koleksiyonuna kayıt kontrolü', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 7 & 8: AI Mentor ile konu anlatımı oluştur ve content_library koleksiyonuna kaydı doğrula ---
  try {
    console.log('\n🔹 SENARYO 7 & 8: AI Mentor konu anlatımı oluşturma ve content_library kontrolü...');
    
    // Konu anlatımı oluşturma ve kaydetme
    const topicSummaryPayload = {
      title: 'Tam Sayılarda Çarpma ve Bölme Kuralları',
      contentType: 'ai_topic_summary',
      lesson: 'matematik',
      grade: 7,
      topic: 'Sayılar ve Nicelikler',
      body: 'Tam sayılarda aynı işaretli iki sayının çarpımı pozitif (+), farklı işaretli iki sayının çarpımı ise negatiftir (-)... Örnek: (-4) x (-3) = +12',
      metadata: {
        generatedBy: 'AI Mentor',
        prompt: '7. sınıf tam sayılarda çarpma kuralını açıkla'
      },
      source: 'ai_mentor',
      status: 'approved'
    };

    const createRes = await fetch(`${baseUrl}/api/content-library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topicSummaryPayload)
    });
    const createData = await createRes.json();

    assert.ok(createRes.ok, `İçerik oluşturulamadı (${createRes.status}): ${JSON.stringify(createData)}`);
    testContentId = createData.id || createData.item?._id;
    assert.ok(testContentId, 'Dönen yanıtta ID bulunamadı');

    // MongoDB'den doğrula
    const contentInDb = await ContentLibrary.findById(testContentId);
    assert.ok(contentInDb, 'Oluşturulan içerik content_library koleksiyonunda bulunamadı!');
    assert.equal(contentInDb.type, 'ai_topic_summary', 'İçerik türü ai_topic_summary değil!');
    assert.equal(contentInDb.topic, 'Sayılar ve Nicelikler', 'Konu eşleşmiyor!');
    assert.ok(contentInDb.content.includes('Tam sayılarda aynı işaretli'), 'İçerik gövdesi eksik!');

    console.log(`   ✅ AI Mentor konu anlatımı başarıyla oluşturuldu ve content_library koleksiyonuna yazıldı.`);
    console.log(`   📚 İçerik Başlığı: "${contentInDb.title}" | ID: ${contentInDb._id}`);
    results.push({ id: 7, title: 'AI Mentor ile konu anlatımı oluştur', status: 'SUCCESS', details: `Konu anlatımı oluşturuldu (ID: ${contentInDb._id})` });
    results.push({ id: 8, title: 'content_library koleksiyonuna kayıt kontrolü', status: 'SUCCESS', details: `Kayıt doğrulandı (Tür: ${contentInDb.type})` });
  } catch (err) {
    console.error(`   ❌ Senaryo 7 & 8 Başarısız:`, err.message);
    results.push({ id: 7, title: 'AI Mentor ile konu anlatımı oluştur', status: 'FAILED', error: err.message });
    results.push({ id: 8, title: 'content_library koleksiyonuna kayıt kontrolü', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 9: PDF oluştur ---
  try {
    console.log('\n🔹 SENARYO 9: PDF oluşturma testi...');
    assert.ok(testQuestion, 'Test sorusu bulunamadı');

    const pdfBuffer = await exportQuestions([testQuestion], {
      title: '7. Sınıf Tam Sayılar Çalışma Testi',
      topic: 'Tam Sayılar',
      format: 'pdf'
    });

    assert.ok(Buffer.isBuffer(pdfBuffer), 'PDF çıktısı Buffer değil');
    assert.ok(pdfBuffer.length > 500, `PDF dosya boyutu çok küçük (${pdfBuffer.length} bayt)`);
    assert.ok(pdfBuffer.toString('binary', 0, 8).startsWith('%PDF-1.4'), 'PDF başlığı %PDF-1.4 ile başlamıyor');

    console.log(`   ✅ PDF başarıyla oluşturuldu.`);
    console.log(`   📑 Format: PDF-1.4 | Boyut: ${pdfBuffer.length} bayt | Başlık: "%PDF-1.4"`);
    results.push({ id: 9, title: 'PDF oluşturma', status: 'SUCCESS', details: `Geçerli %PDF-1.4 üretildi (${pdfBuffer.length} bayt)` });
  } catch (err) {
    console.error(`   ❌ Senaryo 9 Başarısız:`, err.message);
    results.push({ id: 9, title: 'PDF oluşturma', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 10: DOCX oluştur ---
  try {
    console.log('\n🔹 SENARYO 10: DOCX oluşturma testi...');
    assert.ok(testQuestion, 'Test sorusu bulunamadı');

    const docxBuffer = await exportQuestions([testQuestion], {
      title: '7. Sınıf Tam Sayılar Çalışma Testi',
      topic: 'Tam Sayılar',
      format: 'docx'
    });

    assert.ok(Buffer.isBuffer(docxBuffer), 'DOCX çıktısı Buffer değil');
    assert.ok(docxBuffer.length > 500, `DOCX dosya boyutu çok küçük (${docxBuffer.length} bayt)`);
    // PK ZIP Header (0x50, 0x4B, 0x03, 0x04)
    assert.equal(docxBuffer[0], 0x50, 'DOCX ilk baytı 0x50 ("P") değil');
    assert.equal(docxBuffer[1], 0x4B, 'DOCX ikinci baytı 0x4B ("K") değil');

    console.log(`   ✅ DOCX başarıyla oluşturuldu.`);
    console.log(`   📄 Format: OpenXML DOCX | Boyut: ${docxBuffer.length} bayt | Magic: PK (ZIP)`);
    results.push({ id: 10, title: 'DOCX oluşturma', status: 'SUCCESS', details: `Geçerli OpenXML DOCX üretildi (${docxBuffer.length} bayt)` });
  } catch (err) {
    console.error(`   ❌ Senaryo 10 Başarısız:`, err.message);
    results.push({ id: 10, title: 'DOCX oluşturma', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 11: Cloudflare R2 arşivleme işlevini test et ---
  try {
    console.log('\n🔹 SENARYO 11: Cloudflare R2 arşivleme testi...');
    assert.ok(testContentId, 'Arşivlenecek test içerik ID bulunamadı');

    const archiveRes = await fetch(`${baseUrl}/api/content-library/${testContentId}/archive-r2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const archiveData = await archiveRes.json();

    assert.ok(archiveRes.ok, `R2 arşivleme başarısız (${archiveRes.status}): ${JSON.stringify(archiveData)}`);
    assert.ok(archiveData.success, 'R2 yanıt success !== true');
    assert.ok(archiveData.r2Key, 'R2 anahtarı (r2Key) üretilmedi');

    // MongoDB'deki güncellemeyi doğrula
    const updatedContent = await ContentLibrary.findById(testContentId);
    assert.ok(updatedContent.r2Key, 'MongoDB r2Key güncellenmedi');
    assert.equal(updatedContent.status, 'archived', 'İçerik durumu "archived" olmadı');

    console.log(`   ✅ Cloudflare R2 Arşivleme Başarılı!`);
    console.log(`   ☁ R2 Anahtarı: ${archiveData.r2Key}`);
    console.log(`   🔗 R2 URL: ${archiveData.r2Url || 'Özel R2 Deposu'}`);
    results.push({ id: 11, title: 'Cloudflare R2 arşivleme işlevi', status: 'SUCCESS', details: `R2 Arşivi oluşturuldu (${archiveData.r2Key})` });
  } catch (err) {
    console.error(`   ❌ Senaryo 11 Başarısız:`, err.message);
    results.push({ id: 11, title: 'Cloudflare R2 arşivleme işlevi', status: 'FAILED', error: err.message });
  }

  // --- SENARYO 12: Pinecone benzerlik kontrolünü test et ---
  try {
    console.log('\n🔹 SENARYO 12: Pinecone / Semantik benzerlik kontrolü testi...');
    
    const originalText = testQuestion ? testQuestion.text : 'Bir kenar uzunluğu 10 cm olan karenin alanı kaç santimetrekaredir?';
    // Birebir aynı / benzer soru
    const identicalText = originalText;
    // Farklı soru
    const differentText = 'Fotosentez olayında açığa çıkan gaz hangisidir?';

    console.log(`   🔍 1. Test: Özdeş/benzer soru kontrolü...`);
    const duplicateCheck = await checkQuestionSimilarity(originalText, [{ text: identicalText }]);
    assert.ok(duplicateCheck.isDuplicate, 'Özdeş soru mükerrer olarak algılanmadı!');
    assert.ok(duplicateCheck.similarityScore >= 80, `Benzerlik skoru beklenen %80 altında: %${duplicateCheck.similarityScore}`);
    console.log(`      ✓ Benzerlik Skoru: %${duplicateCheck.similarityScore} (Mükerrer: ${duplicateCheck.isDuplicate}, Yöntem: ${duplicateCheck.method})`);

    console.log(`   🔍 2. Test: Tamamen farklı soru kontrolü...`);
    const differentCheck = await checkQuestionSimilarity(originalText, [{ text: differentText }]);
    assert.ok(!differentCheck.isDuplicate, 'Farklı soru yanlışlıkla mükerrer olarak algılandı!');
    assert.ok(differentCheck.similarityScore < 40, `Farklı soru benzerlik skoru beklenenden yüksek: %${differentCheck.similarityScore}`);
    console.log(`      ✓ Benzerlik Skoru: %${differentCheck.similarityScore} (Mükerrer: ${differentCheck.isDuplicate}, Yöntem: ${differentCheck.method})`);

    console.log(`   ✅ Semantik benzerlik ve kopya koruma algoritması başarıyla doğrulandı.`);
    results.push({ id: 12, title: 'Pinecone / Semantik benzerlik kontrolü', status: 'SUCCESS', details: `Özdeş: %${duplicateCheck.similarityScore}, Farklı: %${differentCheck.similarityScore} (${duplicateCheck.method})` });
  } catch (err) {
    console.error(`   ❌ Senaryo 12 Başarısız:`, err.message);
    results.push({ id: 12, title: 'Pinecone / Semantik benzerlik kontrolü', status: 'FAILED', error: err.message });
  }

  // Clean-up Test Data
  console.log('\n🧹 Test verileri temizleniyor...');
  try {
    if (testDraftId) await AiQuestionDraft.findByIdAndDelete(testDraftId);
    if (testSoruId) await Soru.findByIdAndDelete(testSoruId);
    if (testContentId) await ContentLibrary.findByIdAndDelete(testContentId);
    console.log('✅ Geçici test kayıtları temizlendi.');
  } catch (cleanErr) {
    console.warn('Temizleme uyarısı:', cleanErr.message);
  }

  server.close();
  await mongoose.disconnect();
  console.log('🔌 Veritabanı ve sunucu kapatıldı.\n');

  console.log('===============================================================');
  console.log('📊 TEST SONUÇLARI ÖZETİ');
  console.log('===============================================================');
  console.table(results);

  const passedCount = results.filter(r => r.status === 'SUCCESS').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  console.log(`\nToplam: ${results.length} | Başarılı: ${passedCount} | Başarısız: ${failedCount}`);

  return { passedCount, failedCount, results };
}

runVerification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
