const express = require('express');
const {createCurriculumService} = require('../lib/curriculumService');

function createCurriculumAssignmentsRouter({requireTeacher, getStudents, service = createCurriculumService()}) {
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
    try {
      const {grade, section, curriculum_node_ids, due_date} = req.body || {};
      const response = await service.createAssignment({
        grade, section, curriculum_node_ids, due_date, teacher_id: req.session.user.id
      });
      if (response.status < 200 || response.status >= 500 || (response.status >= 300 && response.status < 400) || response.status === 401) {
        console.error('Ödev servisi başarısız:', response.status);
        return res.status(502).json({mesaj: 'Ödev servisi yanıt veremedi.'});
      }
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('Ödev servisine erişilemedi:', error.code || error.message);
      return res.status(503).json({mesaj: 'Ödev servisine erişilemiyor.'});
    }
  });
  return router;
}

module.exports = {createCurriculumAssignmentsRouter};
