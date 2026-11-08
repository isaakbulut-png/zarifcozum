const express = require('express');
const {createCurriculumService} = require('../lib/curriculumService');

function createStudentRecommendationsRouter({requireRoles, ParentModel, UserModel, getStudents, service = createCurriculumService()}) {
  const router = express.Router();
  router.get('/recommendations', requireRoles, async (req, res) => {
    try {
      const {id, role} = req.session.user;
      let studentId;
      if (role === 'student') {
        if (req.query.student_id !== undefined && req.query.student_id !== id) {
          return res.status(403).json({mesaj: 'Bu öğrencinin önerilerine erişemezsiniz.'});
        }
        studentId = id;
      } else if (role === 'parent') {
        const parent = await ParentModel.findById(id).select('studentId restricted').lean();
        if (!parent || parent.restricted) return res.status(403).json({mesaj: 'Veli hesabı doğrulanamadı.'});
        studentId = String(parent.studentId || '');
        if (req.query.student_id !== undefined && req.query.student_id !== studentId) {
          return res.status(403).json({mesaj: 'Bu öğrencinin önerilerine erişemezsiniz.'});
        }
      } else if (role === 'teacher') {
        studentId = req.query.student_id;
        if (typeof studentId !== 'string' || !/^[a-f\d]{24}$/i.test(studentId)) {
          return res.status(400).json({mesaj: 'Geçerli öğrenci kimliği gereklidir.'});
        }
        const profile = await getStudents().findOne({teacherId: id, linkedUserId: studentId, active: true});
        if (!profile) return res.status(404).json({mesaj: 'Bağlı öğrenci bulunamadı.'});
      } else {
        return res.status(403).json({mesaj: 'Yetkisiz erişim.'});
      }
      if (!/^[a-f\d]{24}$/i.test(studentId)) return res.status(404).json({mesaj: 'Bağlı öğrenci bulunamadı.'});
      const student = await UserModel.findOne({_id: studentId, role: 'student', restricted: {$ne: true}}).select('_id').lean();
      if (!student) return res.status(404).json({mesaj: 'Bağlı öğrenci bulunamadı.'});
      const response = await service.getRecommendations(studentId);
      if (response.status < 200 || response.status >= 500 ||
          (response.status >= 300 && response.status < 400) || response.status === 401) {
        console.error('Öneri servisi başarısız:', response.status);
        return res.status(502).json({mesaj: 'Öneri servisi yanıt veremedi.'});
      }
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('Öneriler alınamadı:', error.code || error.message);
      return res.status(503).json({mesaj: 'Öneriler alınamıyor.'});
    }
  });
  return router;
}

module.exports = {createStudentRecommendationsRouter};
