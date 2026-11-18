const test = require('node:test');
const assert = require('node:assert/strict');

const AiQuestionDraft = require('../models/AiQuestionDraft');
const ContentLibrary = require('../models/ContentLibrary');
const Soru = require('../models/Soru');
const { computeQuestionSimilarity, tokenJaccardSimilarity, calculateJaccardSimilarity } = require('../lib/content-similarity');
const { generateStandardPdf, generateStandardDocx, exportQuestions, exportContentItems } = require('../lib/document-exporter');
const { checkContentLibrary } = require('../lib/system-health-checker');

test('AiQuestionDraft model schema ve validasyonu doğru çalışır', () => {
  const draft = new AiQuestionDraft({
    title: '6. Sınıf Kesirler AI Taslağı',
    topic: 'Kesirler',
    grade: 6,
    difficulty: 'Orta',
    source: 'ai_wizard',
    questions: [
      {
        questionNumber: 1,
        text: '3/4 ile 1/2 toplamı kaçtır?',
        options: { A: '5/4', B: '1/4', C: '4/6', D: '3/8' },
        answer: 'A',
        explanation: 'Paydalar eşitlenir: 3/4 + 2/4 = 5/4',
        outcomeCode: 'MAT.6.1.1'
      }
    ],
    metadata: {
      model: 'gemini-2.5-flash',
      promptTokens: 120
    }
  });

  assert.equal(draft.status, 'draft');
  assert.equal(draft.questions.length, 1);
  assert.equal(draft.questions[0].answer, 'A');
  assert.equal(draft.topic, 'Kesirler');
});

test('ContentLibrary model schema ve içerik türleri doğru çalışır', () => {
  const item = new ContentLibrary({
    title: 'Haftalık LGS Matematik Çalışma Planı',
    type: 'ai_study_plan',
    ders: 'matematik',
    grade: 8,
    topic: 'Çarpanlar ve Katlar',
    content: 'Pazartesi: 30 soru çarpanlar, Salı: Konu tekrarı...',
    source: 'ai_mentor',
    status: 'draft',
    createdBy: 'teacher123',
    metadata: {
      generatedBy: 'AI Mentor'
    }
  });

  assert.equal(item.type, 'ai_study_plan');
  assert.equal(item.contentType, 'ai_study_plan');
  assert.equal(item.status, 'draft');
  assert.equal(item.ders, 'matematik');
  assert.ok(item.body.includes('Pazartesi'));
});

test('Soru modeli hybrid (metin, SVG, resimsiz) yapıyı destekler', () => {
  const soru = new Soru({
    grade: 7,
    ders: 'matematik',
    topic: 'Tam Sayılar',
    answer: 'C',
    text: '(-5) + (+8) işleminin sonucu kaçtır?',
    options: [
      { label: 'A', text: '-13' },
      { label: 'B', text: '-3' },
      { label: 'C', text: '+3' },
      { label: 'D', text: '+13' }
    ],
    format: 'text_svg',
    source: 'ai_generated',
    explanation: 'Farklı işaretli sayılar toplanırken mutlak değeri büyük olanın işareti alınır.'
  });

  assert.equal(soru.format, 'text_svg');
  assert.equal(soru.source, 'ai_generated');
  assert.equal(soru.answer, 'C');
  assert.equal(soru.options.length, 4);
  assert.equal(soru.options.find(o => o.label === 'C').text, '+3');
  assert.equal(soru.imageUrl, undefined);
});

test('Semantik ve token benzerlik kontrolü kopyaları ve benzer soruları yakalar', async () => {
  const q1 = 'Bir kenar uzunluğu 5 cm olan karenin çevresi kaç santimetredir?';
  const q2 = 'Bir kenar uzunluğu 5 cm olan karenin çevresi kaç santimetredir?';
  const q3 = 'Güneş sistemindeki en büyük gezegen hangisidir?';

  const similaritySame = await computeQuestionSimilarity(q1, [{ text: q2 }]);
  assert.ok(similaritySame.isDuplicate);
  assert.ok(similaritySame.similarityScore >= 80);

  const similarityDiff = await computeQuestionSimilarity(q1, [{ text: q3 }]);
  assert.ok(!similarityDiff.isDuplicate);
  assert.ok(similarityDiff.similarityScore < 40);
});

test('Document Exporter sıfır bağımlılıkla geçerli PDF ve DOCX üretir', async () => {
  const questions = [
    {
      text: '2x + 6 = 14 ise x kaçtır?',
      options: { A: '2', B: '4', C: '6', D: '8' },
      answer: 'B',
      explanation: '2x = 8 => x = 4'
    }
  ];

  const pdfBuf = await exportQuestions(questions, {
    title: 'Cebirsel İfadeler Testi',
    topic: 'Denklemler',
    format: 'pdf'
  });

  assert.ok(Buffer.isBuffer(pdfBuf));
  assert.ok(pdfBuf.length > 500);
  assert.ok(pdfBuf.toString('binary', 0, 8).startsWith('%PDF-1.4'));

  const docxBuf = await exportQuestions(questions, {
    title: 'Cebirsel İfadeler Testi',
    topic: 'Denklemler',
    format: 'docx'
  });

  assert.ok(Buffer.isBuffer(docxBuf));
  assert.ok(docxBuf.length > 500);
  assert.equal(docxBuf[0], 0x50);
  assert.equal(docxBuf[1], 0x4B);
  assert.equal(docxBuf[2], 0x03);
  assert.equal(docxBuf[3], 0x04);
});

test('checkContentLibrary sistem sağlığı fonksiyonu çalışır', async () => {
  const result = await checkContentLibrary();
  assert.ok(result);
  assert.ok(result.status === 'ok' || result.status === 'warning');
  assert.ok(typeof result.totalContent === 'number');
  assert.ok(typeof result.totalDrafts === 'number');
  assert.ok(typeof result.totalSorular === 'number');
});
