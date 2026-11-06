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

module.exports = { requireKonuLogin };
