const {prepareQuestion} = require('../lib/quiz-content');

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

module.exports = {createTeacherQuizHandler};
