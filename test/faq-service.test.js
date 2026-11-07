const assert = require('node:assert/strict');
const test = require('node:test');
const { createAiChatReply } = require('../lib/ai-chat');
const { createFaqService, normalizeFaqQuestion } = require('../lib/faq-service');
const AiFaq = require('../models/AiFaq');
const { sanitizeFaqHtml } = require('../lib/rich-content');

function createMemoryRedis() {
  const values = new Map();
  return {
    isReady: true,
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) {
      values.set(key, value);
      return 'OK';
    },
    async incr(key) {
      const value = Number(values.get(key) || 0) + 1;
      values.set(key, String(value));
      return value;
    }
  };
}

function createFaqCollection(entries) {
  return {
    find(filter) {
      const matchesGrade = entry => filter.grade === null
        ? entry.grade === null
        : filter.$or.some(condition =>
          condition.grade === null ? entry.grade === null : entry.grade === condition.grade);
      return {
        select() {
          return {
            lean: async () => entries.filter(entry =>
              entry.normalizedQuestion === filter.normalizedQuestion &&
              entry.active === filter.active && matchesGrade(entry))
          };
        }
      };
    }
  };
}

test('FAQ questions normalize Turkish case, punctuation and whitespace', () => {
  assert.equal(normalizeFaqQuestion('  NASIL, ÇALIŞIR?  '), 'nasıl çalışır');
});

test('FAQ HTML is sanitized while formula LaTeX remains available for rendering', () => {
  const content = sanitizeFaqHtml(
    '<p onclick="alert(1)">Yanıt <strong>vurgusu</strong><script>alert(2)</script></p>' +
    '<p><span class="ql-formula" data-value="x^2">x²</span></p>'
  );
  assert.doesNotMatch(content.html, /onclick|script|alert/);
  assert.match(content.html, /<strong>vurgusu<\/strong>/);
  assert.match(content.html, /class="ql-formula" data-value="x\^2"/);
  assert.match(content.text, /\\\(x\^2\\\)/);
});

test('AI FAQ mongoose schema validates required content and indexes exact scope keys', async () => {
  const faq = new AiFaq({
    question: 'Kesir nedir?',
    normalizedQuestion: 'kesir nedir',
    answerHtml: '<p>Yanıt</p>',
    answerText: 'Yanıt',
    grade: 5,
    scopeKey: '5',
    createdBy: 'admin-1'
  });
  await assert.doesNotReject(faq.validate());
  assert.equal(AiFaq.collection.collectionName, 'ai_faqs');
  assert.ok(AiFaq.schema.indexes().some(([keys, options]) =>
    keys.normalizedQuestion === 1 && keys.scopeKey === 1 && options.unique));
  const invalid = new AiFaq({
    question: 'Geçersiz sınıf',
    normalizedQuestion: 'geçersiz sınıf',
    answerHtml: '<p>Yanıt</p>',
    answerText: 'Yanıt',
    grade: 13,
    scopeKey: '13',
    createdBy: 'admin-1'
  });
  await assert.rejects(invalid.validate(), { name: 'ValidationError' });
});

test('an exact FAQ match returns the managed answer without calling AI', async () => {
  const entries = [{
    normalizedQuestion: 'kesir nedir',
    question: 'Kesir nedir?',
    answerText: 'Bir bütünün eş parçalarından biridir.',
    answerHtml: '<p>Bir bütünün eş parçalarından biridir.</p>',
    grade: null,
    active: true
  }];
  const faqService = createFaqService({
    getFaqModel: () => createFaqCollection(entries),
    redisClient: createMemoryRedis()
  });
  const reply = createAiChatReply({
    findFaq: faqService.findAnswer,
    generateReply: async () => { throw new Error('AI should not run for an FAQ hit.'); }
  });

  assert.deepEqual(await reply({ ogrenciMesaji: 'KESİR nedir?', sinif: 5 }), {
    text: 'Bir bütünün eş parçalarından biridir.',
    html: '<p>Bir bütünün eş parçalarından biridir.</p>'
  });
});

test('class-specific FAQ takes precedence and cache invalidation serves updated content', async () => {
  const entries = [
    { normalizedQuestion: 'oran nedir', answerText: 'Genel açıklama', answerHtml: '<p>Genel açıklama</p>', grade: null, active: true },
    { normalizedQuestion: 'oran nedir', answerText: '5. sınıfa uygun açıklama', answerHtml: '<p>5. sınıfa uygun açıklama</p>', grade: 5, active: true }
  ];
  const redisClient = createMemoryRedis();
  const faqService = createFaqService({
    getFaqModel: () => createFaqCollection(entries),
    redisClient
  });
  const request = { ogrenciMesaji: 'Oran nedir?', sinif: 5 };

  assert.deepEqual(await faqService.findAnswer(request), {
    text: '5. sınıfa uygun açıklama',
    html: '<p>5. sınıfa uygun açıklama</p>'
  });
  entries[1].answerText = 'Güncel açıklama';
  entries[1].answerHtml = '<p>Güncel açıklama</p>';
  await faqService.invalidate();
  assert.equal((await faqService.findAnswer(request)).text, 'Güncel açıklama');
});

test('an FAQ miss falls through to the existing AI reply', async () => {
  const faqService = createFaqService({
    getFaqModel: () => createFaqCollection([]),
    redisClient: null
  });
  const reply = createAiChatReply({
    findFaq: faqService.findAnswer,
    generateReply: async request => `AI: ${request.ogrenciMesaji}`
  });

  assert.deepEqual(await reply({ ogrenciMesaji: 'Bilinmeyen soru', sinif: 7 }), {
    text: 'AI: Bilinmeyen soru',
    html: null
  });
});
