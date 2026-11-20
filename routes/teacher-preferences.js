const express = require('express');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validPreferences(body) {
  if (!body || typeof body.displayName !== 'string' || typeof body.branch !== 'string' ||
      !Array.isArray(body.grades) || typeof body.notifications !== 'boolean') return null;
  const displayName = body.displayName.trim();
  const branch = body.branch.trim();
  const grades = [...new Set(body.grades)];
  if (displayName.length > 100 || branch.length > 80 ||
      grades.some(grade => !Number.isInteger(grade) || grade < 1 || grade > 12)) return null;
  return { displayName, branch, grades, notifications: body.notifications };
}

function createTeacherPreferencesRouter({ requireTeacher, UserModel }) {
  const router = express.Router();
  router.use(requireTeacher);

  router.get('/', asyncRoute(async (req, res) => {
    const user = await UserModel.findById(req.session.user.id)
      .select('teacherPanelPreferences')
      .lean();
    if (!user) return res.status(404).json({ mesaj: 'Öğretmen hesabı bulunamadı.' });
    res.json({ preferences: user.teacherPanelPreferences || null });
  }));

  router.put('/', asyncRoute(async (req, res) => {
    const preferences = validPreferences(req.body);
    if (!preferences) {
      return res.status(400).json({ mesaj: 'Profil adı, branş, sınıf seviyeleri ve bildirim tercihini kontrol edin.' });
    }
    const result = await UserModel.updateOne(
      { _id: req.session.user.id, role: { $in: ['teacher', 'admin'] } },
      { $set: { teacherPanelPreferences: preferences } },
      { runValidators: true }
    );
    if (!result.matchedCount) return res.status(404).json({ mesaj: 'Öğretmen hesabı bulunamadı.' });
    res.json({ mesaj: 'Profil tercihleri hesabınıza kaydedildi.', preferences });
  }));

  return router;
}

module.exports = { createTeacherPreferencesRouter, validPreferences };
