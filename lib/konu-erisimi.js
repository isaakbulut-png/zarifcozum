const { resolveUserPlan } = require('../middleware/aiQuota');

/**
 * Öğrencinin paketine göre erişebileceği sınıf düzeylerini döndürür.
 * - VIP Paket: 5-12 tüm sınıflar
 * - Standart Paket: Kayıtlı sınıf + 1 alt sınıf telafi erişimi (örn: 8 ve 7)
 * - Temel Paket & Free: Yalnızca kayıtlı 1 sınıf düzeyi
 */
function getAllowedGradesForStudent(user) {
  if (!user || user.role !== 'student') return [5, 6, 7, 8, 9, 10, 11, 12];

  const plan = resolveUserPlan(user);
  if (plan === 'vip') {
    return [5, 6, 7, 8, 9, 10, 11, 12];
  }

  // Öğrencinin kayıtlı sınıfı (belirtilmemişse varsayılan 8)
  const registeredGrade = Number(user.kayitliSinif) || 8;

  if (plan === 'standart') {
    const telafi = Number(user.seciliTelafiSinif) || (registeredGrade > 5 ? registeredGrade - 1 : null);
    const allowed = [registeredGrade];
    if (telafi && telafi >= 5 && telafi <= 12 && !allowed.includes(telafi)) {
      allowed.push(telafi);
    }
    return allowed;
  }

  // Temel ve Free paket: Yalnızca kayıtlı 1 sınıf
  return [registeredGrade];
}

/**
 * Kullanıcının belirtilen sınıfa erişim yetkisi olup olmadığını kontrol eder.
 */
function canStudentAccessGrade(user, grade) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'teacher') return true;
  const gradeNum = parseInt(grade, 10);
  if (!gradeNum || gradeNum < 5 || gradeNum > 12) return false;

  const allowedGrades = getAllowedGradesForStudent(user);
  return allowedGrades.includes(gradeNum);
}

/**
 * Oturum açma gerektiren temel konu middleware'i.
 */
function requireKonuLogin(req, res, next) {
  const user = req.session?.user;
  if (!user?.id || !['student', 'teacher', 'admin'].includes(user.role)) {
    res.set('Cache-Control', 'no-store');
    return res.status(403).json({
      kod: 'UYELIK_GEREKLI',
      mesaj: 'Konu içeriklerini görmek için üye olun veya giriş yapın.',
      yonlendir: '/kayit-giris.html',
      girisYapti: false
    });
  }
  next();
}

/**
 * Paket bazlı sınıf yetkilendirmesi middleware'i.
 */
function requireGradeAccess(req, res, next) {
  const user = req.session?.user;
  if (!user?.id || !['student', 'teacher', 'admin'].includes(user.role)) {
    res.set('Cache-Control', 'no-store');
    return res.status(403).json({
      kod: 'UYELIK_GEREKLI',
      mesaj: 'Konu içeriklerini görmek için üye olun veya giriş yapın.',
      yonlendir: '/kayit-giris.html',
      girisYapti: false
    });
  }

  if (user.role === 'admin' || user.role === 'teacher') {
    return next();
  }

  const requestedGrade = req.params?.grade || req.query?.grade || req.body?.grade || req.query?.sinif || req.body?.sinif;
  if (requestedGrade && !canStudentAccessGrade(user, requestedGrade)) {
    const plan = resolveUserPlan(user);
    const registered = user.kayitliSinif || 8;
    return res.status(403).json({
      kod: 'GRADE_ACCESS_DENIED',
      mesaj: `${requestedGrade}. sınıf içeriklerine erişim paketinizin kapsamı dışındadır. Mevcut paketiniz (${plan.toUpperCase()}) ile kayıtlı sınıfınız (${registered}. Sınıf) içeriklerine erişebilirsiniz. Standart pakette 1 alt sınıf telafi, VIP pakette tüm sınıf düzeylerine (5-12) sınırsız erişim sağlanır.`,
      mevcutPaket: plan,
      kayitliSinif: registered,
      istenenSinif: Number(requestedGrade)
    });
  }

  next();
}

module.exports = {
  getAllowedGradesForStudent,
  canStudentAccessGrade,
  requireKonuLogin,
  requireGradeAccess
};
