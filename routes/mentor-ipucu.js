const express = require('express');
const {ObjectId} = require('mongodb');

function createMentorHintRouter({requireStudent, limiter, getResults, getQuizzes, getAttempts, generateHint, generateGeneralHint}) {
  const router = express.Router();
  router.post('/live/:quizId/:index', requireStudent, limiter, async (req, res) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.quizId) || !/^\d{1,3}$/.test(req.params.index) ||
          typeof req.body?.attemptId !== 'string' || !req.body.attemptId) {
        return res.status(400).json({mesaj: 'Geçersiz test veya soru numarası.'});
      }
      const studentId = req.session.user.id;
      const attempt = await getAttempts().findOne({
        _id: `${studentId}:${req.params.quizId.toLowerCase()}`, studentId, status: 'open'
      });
      if (!attempt || (attempt.runId || attempt._id) !== req.body.attemptId) {
        return res.status(404).json({mesaj: 'Aktif test denemesi bulunamadı.'});
      }
      const index = Number(req.params.index);
      const question = attempt?.questions?.[index];
      const state = attempt?.state?.[index];
      if (!question || !state?.checks || state.correct !== false || !question.options?.[state.answer]) {
        return res.status(404).json({mesaj: 'Bu cevap için canlı ipucu bulunmuyor.'});
      }
      const payload = {outcomeCode: question.outcomeCode, question, selected: state.answer};
      const text = question.outcomeCode ? await generateHint(payload) : await generateGeneralHint(payload);
      res.set('Cache-Control', 'no-store');
      return res.json({ipucu: text});
    } catch (error) {
      console.error('Canlı ipucu üretilemedi:', error);
      return res.status(502).json({mesaj: 'İpucu üretilemedi. Lütfen daha sonra tekrar deneyin.'});
    }
  });
  router.post('/:resultId/:index', requireStudent, limiter, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.resultId) || !/^\d{1,3}$/.test(req.params.index)) {
        return res.status(400).json({mesaj: 'Geçersiz sonuç veya soru numarası.'});
      }
      const result = await getResults().findOne({_id: new ObjectId(req.params.resultId), studentId: req.session.user.id});
      if (!result || result.type === 'deneme') return res.status(404).json({mesaj: 'Test sonucu bulunamadı.'});
      const quiz = await getQuizzes().findOne({_id: result.quizId});
      const index = Number(req.params.index);
      const question = quiz?.questions?.[index];
      const selected = result.answers?.[index];
      if (!question?.outcomeCode || !selected || selected === question.answer || !question.options?.[selected]) {
        return res.status(404).json({mesaj: 'Bu cevap için doğrulanabilir kazanım ipucu bulunmuyor.'});
      }
      const text = await generateHint({outcomeCode: question.outcomeCode, question, selected});
      res.set('Cache-Control', 'no-store');
      res.json({ipucu: text});
    } catch (error) {
      console.error('Kazanım ipucu üretilemedi:', error);
      res.status(502).json({mesaj: 'Kazanım doğrulanamadı veya ipucu üretilemedi. Lütfen daha sonra tekrar deneyin.'});
    }
  });
  return router;
}

module.exports = {createMentorHintRouter};
