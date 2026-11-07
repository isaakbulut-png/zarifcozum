const {prepareQuestion} = require('../lib/quiz-content');
const {ObjectId} = require('mongodb');

function createTeacherQuizHandler(getCollection) {
  return async (req, res) => {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const questions = req.body?.questions;
      if (!title || title.length > 150 || description.length > 500 ||
          !Array.isArray(questions) || questions.length < 1 || questions.length > 50) {
        return res.status(400).json({mesaj: 'Test başlığı ve 1–50 geçerli soru gereklidir.'});
      }
      let preparedQuestions;
      try {
        preparedQuestions = questions.map(prepareQuestion);
      } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({mesaj: err.message});
        throw err;
      }
      const quiz = {
        title, description, questions: preparedQuestions,
        createdBy: req.session.user.id,
        createdAt: new Date()
      };
      const result = await getCollection().insertOne(quiz);
      res.status(201).json({
        mesaj: 'Test yayınlandı.',
        quiz: {id: result.insertedId.toString(), title, soruSayisi: quiz.questions.length}
      });
    } catch (err) {
      console.error('❌ Test oluşturulamadı:', err);
      res.status(500).json({mesaj: 'Test oluşturulamadı.'});
    }
  };
}

function createStudentQuizSubmissionHandler({getQuizCollection, getResultCollection, pointsService}) {
  return async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({mesaj: 'Geçersiz test numarası.'});
      const quiz = await getQuizCollection().findOne({_id: new ObjectId(req.params.id)});
      if (!quiz || (quiz.source === 'ai' && quiz.published !== true)) {
        return res.status(404).json({mesaj: 'Test bulunamadı.'});
      }
      const answers = req.body?.answers;
      if (!Array.isArray(answers) || answers.length !== quiz.questions.length ||
          !answers.every((answer, index) => answer === null ||
            ['A', 'B', 'C', 'D'].includes(answer) && quiz.questions[index].options[answer])) {
        return res.status(400).json({mesaj: 'Test cevapları geçersiz.'});
      }
      const correctCount = answers.reduce(
        (count, answer, index) => count + (answer !== null && answer === quiz.questions[index].answer ? 1 : 0), 0
      );
      const totalCount = quiz.questions.length;
      const score = Math.round(correctCount * 100 / totalCount);
      const {result, kazanilanPuan} = await pointsService.transaction(async session => {
        const result = await getResultCollection().insertOne({
          quizId: quiz._id, quizTitle: quiz.title, studentId: req.session.user.id,
          studentName: req.session.user.name, answers, correctCount, totalCount, score, createdAt: new Date()
        }, {session});
        const keys = quiz.questions.flatMap((question, index) =>
          answers[index] !== null && answers[index] === question.answer ? [`quiz:${quiz._id}:${index}`] : []
        );
        const kazanilanPuan = await pointsService.award(session, req.session.user.id, keys);
        return {result, kazanilanPuan};
      });
      res.status(201).json({
        mesaj: 'Test sonucu kaydedildi.', id: result.insertedId, score, correctCount, totalCount, kazanilanPuan,
        review: quiz.questions.map(({answer, explanation, outcomeCode}, index) => ({
          answer, explanation: explanation || '',
          ipucuVar: Boolean(outcomeCode && answers[index] !== null && answers[index] !== answer)
        }))
      });
    } catch (error) {
      console.error('❌ Öğrenci testi kaydedilemedi:', error);
      res.status(500).json({mesaj: 'Test sonucu kaydedilemedi.'});
    }
  };
}

module.exports = {createTeacherQuizHandler, createStudentQuizSubmissionHandler};
