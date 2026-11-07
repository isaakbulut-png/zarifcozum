const express = require('express');
const {ObjectId} = require('mongodb');

function createMentorHintRouter({requireStudent, limiter, getResults, getQuizzes, generateHint}) {
  const router = express.Router();
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
