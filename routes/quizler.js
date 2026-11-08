const {prepareQuestion} = require('../lib/quiz-content');
const {ObjectId} = require('mongodb');
const {createHash} = require('node:crypto');

function questionFingerprint(question) {
  const parts = [question.text, ...'ABCD'.split('').map(key => question.options?.[key]), question.answer];
  if (!parts.every(value => typeof value === 'string')) return null;
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

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

function createStudentQuizSubmissionHandler() {
  return (req, res) => res.status(409).json({
    mesaj: 'Doğrudan teslim kapatıldı; testi canlı deneme ile başlatıp kontrol ederek bitirin.',
    code: 'LIVE_ATTEMPT_REQUIRED'
  });
}

function createLiveQuizHandlers({getQuizCollection, getAttemptCollection, getResultCollection, pointsService, getHomeworkCollection, getHomeworkAssignmentCollection}) {
  const key = (studentId, quizId) => `${studentId}:${quizId}`;
  const runId = attempt => attempt.runId || attempt._id;
  const runFilter = attempt => attempt.runId ? {runId: attempt.runId} : {runId: {$exists: false}};
  const publicAttempt = attempt => ({
    id: runId(attempt), status: attempt.status,
    questions: attempt.state.map(({checks, answer, correct}) => ({checks, answer, correct}))
  });
  const findAttempt = (req, session) => getAttemptCollection().findOne(
    {_id: key(req.session.user.id, req.params.id.toLowerCase()), studentId: req.session.user.id},
    session ? {session} : {}
  );
  const validId = req => ObjectId.isValid(req.params.id) && /^[a-f\d]{24}$/i.test(req.params.id);
  const fail = (res, error) => {
    console.error('Canlı test işlemi başarısız:', error);
    return res.status(500).json({mesaj: 'Canlı test işlemi tamamlanamadı.'});
  };
  const resultResponse = result => ({
    mesaj: 'Test sonucu kaydedildi.', id: result._id, score: result.score,
    correctCount: result.correctCount, totalCount: result.totalCount,
    kazanilanPuan: result.kazanilanPuan, review: result.review, answers: result.answers
  });
  return {
    start: async (req, res) => {
      try {
        if (!validId(req)) return res.status(400).json({mesaj: 'Geçersiz test numarası.'});
        const quiz = await getQuizCollection().findOne({_id: new ObjectId(req.params.id)});
        if (!quiz || (quiz.source === 'ai' && quiz.published !== true) || !quiz.questions?.length) {
          return res.status(404).json({mesaj: 'Test bulunamadı.'});
        }
        if (quiz.source === 'curriculum_assignment') {
          const homework = await getHomeworkCollection().findOne({quizId: String(quiz._id), teacherId: quiz.createdBy});
          const assigned = homework && await getHomeworkAssignmentCollection().findOne({
            homeworkId: homework._id, studentUserId: req.session.user.id
          });
          if (!assigned) return res.status(404).json({mesaj: 'Test bulunamadı.'});
        }
        const existing = await findAttempt(req);
        if (existing && existing.status !== 'legacy' &&
            (existing.status !== 'finished' || req.body?.restart !== true)) {
          return res.json({attempt: publicAttempt(existing)});
        }
        const attempt = {
          _id: key(req.session.user.id, req.params.id.toLowerCase()),
          runId: new ObjectId().toString(),
          quizId: quiz._id, studentId: req.session.user.id, studentName: req.session.user.name,
          quizTitle: quiz.title, questions: quiz.questions, status: 'open',
          state: quiz.questions.map(() => ({checks: 0, answer: null, correct: null})),
          createdAt: new Date()
        };
        try {
          const filter = existing && existing.status === 'finished'
            ? {_id: attempt._id, studentId: attempt.studentId, status: 'finished',
              resultId: existing.resultId, ...runFilter(existing)}
            : {_id: attempt._id, status: 'legacy'};
          const replaced = await getAttemptCollection().replaceOne(filter, attempt, {upsert: !existing || existing.status === 'legacy'});
          if (!replaced.modifiedCount && !replaced.upsertedCount) {
            return res.json({attempt: publicAttempt(await findAttempt(req))});
          }
        } catch (error) {
          if (error.code !== 11000) throw error;
          return res.json({attempt: publicAttempt(await findAttempt(req))});
        }
        return res.status(201).json({attempt: publicAttempt(attempt)});
      } catch (error) { return fail(res, error); }
    },
    check: async (req, res) => {
      try {
        if (!validId(req) || typeof req.body?.attemptId !== 'string' || !req.body.attemptId ||
            !Number.isInteger(req.body?.index) || req.body.index < 0 ||
            !['A', 'B', 'C', 'D'].includes(req.body?.answer)) {
          return res.status(400).json({mesaj: 'Geçersiz soru veya cevap.'});
        }
        const attempt = await findAttempt(req);
        if (!attempt || attempt.status === 'legacy') return res.status(404).json({mesaj: 'Aktif test bulunamadı.'});
        if (runId(attempt) !== req.body.attemptId) return res.status(409).json({mesaj: 'Deneme değişti; güncel denemeyi açın.'});
        const {index, answer} = req.body;
        const question = attempt.questions[index];
        const state = attempt.state[index];
        if (!question || !question.options?.[answer] || !state) return res.status(400).json({mesaj: 'Geçersiz soru veya cevap.'});
        if (attempt.status !== 'open' || state.checks >= 2 || state.correct) {
          return res.status(409).json({mesaj: 'Bu soru artık kontrol edilemez.'});
        }
        const correct = answer === question.answer;
        const updated = await getAttemptCollection().updateOne({
          _id: attempt._id, studentId: req.session.user.id, status: 'open',
          ...runFilter(attempt),
          [`state.${index}.checks`]: state.checks, [`state.${index}.correct`]: state.correct
        }, {$set: {[`state.${index}`]: {checks: state.checks + 1, answer, correct}}});
        if (!updated.modifiedCount) return res.status(409).json({mesaj: 'Test durumu değişti; yeniden deneyin.'});
        return res.json({index, checks: state.checks + 1, answer, correct, remainingChecks: correct ? 0 : 1 - state.checks});
      } catch (error) { return fail(res, error); }
    },
    finish: async (req, res) => {
      try {
        if (!validId(req) || typeof req.body?.attemptId !== 'string' || !req.body.attemptId) {
          return res.status(400).json({mesaj: 'Geçersiz test veya deneme numarası.'});
        }
        const outcome = await pointsService.transaction(async session => {
          const attempt = await findAttempt(req, session);
          if (!attempt || attempt.status === 'legacy') return {status: 404, mesaj: 'Aktif test bulunamadı.'};
          if (runId(attempt) !== req.body.attemptId) {
            const result = await getResultCollection().findOne({
              liveAttemptId: req.body.attemptId, studentId: req.session.user.id,
              quizId: new ObjectId(req.params.id)
            }, {session});
            return result ? {result} : {status: 409, mesaj: 'Deneme değişti; güncel denemeyi açın.'};
          }
          if (attempt.status === 'finished') {
            const result = await getResultCollection().findOne({_id: attempt.resultId, studentId: req.session.user.id}, {session});
            if (!result) throw new Error('Canlı test sonucu bulunamadı.');
            return {result};
          }
          if (attempt.state.some(state => state.checks < 1)) return {status: 409, mesaj: 'Tüm sorular en az bir kez kontrol edilmelidir.'};
          const answers = attempt.state.map(state => state.answer);
          const correctCount = attempt.state.filter(state => state.correct).length;
          const totalCount = attempt.state.length;
          const score = Math.round(correctCount * 100 / totalCount);
          const resultId = new ObjectId();
          const claimed = await getAttemptCollection().updateOne(
            {_id: attempt._id, status: 'open', state: attempt.state, ...runFilter(attempt)},
            {$set: {status: 'finished', resultId, finishedAt: new Date()}}, {session}
          );
          if (!claimed.modifiedCount) throw new Error('Test durumu değişti.');
          const kazanilanPuan = await pointsService.award(session, req.session.user.id,
            attempt.state.flatMap((state, index) => state.correct ? [`quiz:${attempt.quizId}:${index}`] : []));
          const review = attempt.questions.map(({answer, explanation, outcomeCode}, index) => ({
            answer, explanation: explanation || '',
            ipucuVar: Boolean(outcomeCode && answers[index] !== answer)
          }));
          const result = {
            _id: resultId, liveAttemptId: runId(attempt), quizId: attempt.quizId, quizTitle: attempt.quizTitle,
            studentId: attempt.studentId, studentName: attempt.studentName, answers, correctCount,
            totalCount, score, kazanilanPuan, review, createdAt: new Date(),
            performance: attempt.questions.map((question, index) => ({
              curriculum_node_id: question.curriculum_node_id instanceof ObjectId ? question.curriculum_node_id : null,
              question_fingerprint: questionFingerprint(question),
              correct: attempt.state[index].correct === true
            }))
          };
          await getResultCollection().insertOne(result, {session});
          return {result};
        });
        if (outcome.status) return res.status(outcome.status).json({mesaj: outcome.mesaj});
        return res.json(resultResponse(outcome.result));
      } catch (error) { return fail(res, error); }
    }
  };
}

module.exports = {createTeacherQuizHandler, createStudentQuizSubmissionHandler, createLiveQuizHandlers};
