const express = require('express');
const {createCurriculumService} = require('../lib/curriculumService');
const { ObjectId } = require('mongodb');

function createCurriculumAssignmentsRouter({requireTeacher, getStudents, service = createCurriculumService(), getDb}) {
  const router = express.Router();
  router.use(requireTeacher);

  router.get('/classes', async (req, res) => {
    try {
      const profiles = await getStudents().find(
        {teacherId: req.session.user.id, active: true},
        {projection: {grade: 1, section: 1, linkedUserId: 1}}
      ).toArray();
      const classes = new Map();
      for (const profile of profiles) {
        if (!Number.isInteger(profile.grade) || !profile.section) continue;
        const key = JSON.stringify([profile.grade, profile.section]);
        const item = classes.get(key) || {grade: profile.grade, section: profile.section, students: 0, linked: 0};
        item.students++;
        if (profile.linkedUserId) item.linked++;
        classes.set(key, item);
      }
      res.json({classes: [...classes.values()].sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section, 'tr'))});
    } catch (error) {
      console.error('Ödev sınıfları yüklenemedi:', error);
      res.status(500).json({mesaj: 'Sınıflar yüklenemedi.'});
    }
  });

  router.post('/', async (req, res) => {
    const {grade, section, curriculum_node_ids, due_date} = req.body || {};
    const teacherId = req.session.user.id;
    try {
      const response = await service.createAssignment({
        grade, section, curriculum_node_ids, due_date, teacher_id: teacherId
      });
      if (response.status < 200 || response.status >= 500 || (response.status >= 300 && response.status < 400) || response.status === 401) {
        console.error('Ödev servisi başarısız:', response.status);
        return res.status(502).json({mesaj: 'Ödev servisi yanıt veremedi.'});
      }
      return res.status(response.status).json(response.data);
    } catch (error) {
      // Fallback when service is not running or unconfigured
      if (typeof getDb === 'function') {
        const db = getDb();
        if (db) {
          try {
            const recipients = await db.collection('ogrenci_profilleri').find({
              teacherId, grade: Number(grade), section: String(section), active: true
            }).toArray();
            if (!recipients.length) {
              return res.status(400).json({ detail: 'Bu sınıf ve şubede kayıtlı etkin öğrenci bulunamadı.' });
            }
            const nodeIds = (curriculum_node_ids || []).map(id => {
              try { return new ObjectId(id); } catch { return null; }
            }).filter(Boolean);
            const questionFilter = {
              'questions.curriculum_node_id': { $in: nodeIds },
              source: { $ne: 'curriculum_assignment' }
            };
            const hasQuestions = await db.collection('quizler').findOne(questionFilter);
            if (!hasQuestions) {
              return res.status(400).json({ detail: 'Seçilen kazanımlara bağlı soru bulunamadı. Lütfen soru bankasından soru ekleyin veya farklı bir kazanım seçin.' });
            }
          } catch (dbErr) {
            console.error('Ödev MongoDB denetim hatası:', dbErr);
          }
        }
      }
      console.error('Ödev servisine erişilemedi:', error.code || error.message);
      return res.status(503).json({mesaj: 'Ödev servisine erişilemiyor.'});
    }
  });
  return router;
}

module.exports = {createCurriculumAssignmentsRouter};
