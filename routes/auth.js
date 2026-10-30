const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const User = require('../models/User');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla giriş denemesi. Bir süre sonra tekrar deneyin.' }
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla kayıt denemesi. Bir süre sonra tekrar deneyin.' }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function passwordsMatch(password, confirmation) {
  if (typeof password !== 'string' || typeof confirmation !== 'string') return false;
  const supplied = Buffer.from(password);
  const expected = Buffer.from(confirmation);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla giriş denemesi. Bir süre sonra tekrar deneyin.' }
});

function redirectForRole(role) {
  if (role === 'admin') return '/admin-paneli.html';
  return role === 'teacher' ? '/ogretmen-paneli.html' : '/ogrenci-paneli.html';
}

router.post('/register', registerLimiter, async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  const role = body.role;

  if (!name || name.length > 100 || !isValidEmail(email)) {
    return res.status(400).json({ mesaj: 'Ad veya e-posta biçimi geçersiz.' });
  }
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 10 ||
      Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ mesaj: 'Şifre 10–72 bayt uzunluğunda olmalıdır.' });
  }
  if (!passwordsMatch(password, body.passwordConfirmation)) {
    return res.status(400).json({ mesaj: 'Şifreler eşleşmiyor.' });
  }
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ mesaj: 'Geçerli bir kullanıcı tipi seçin.' });
  }

  if (role === 'teacher') {
    const expectedCode = String(process.env.TEACHER_REGISTRATION_CODE || '');
    const suppliedCode = typeof body.teacherCode === 'string' ? body.teacherCode : '';
    const supplied = Buffer.from(suppliedCode);
    const expected = Buffer.from(expectedCode);
    if (!expected.length) {
      return res.status(503).json({ mesaj: 'Öğretmen kaydı şu anda etkin değil.' });
    }
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return res.status(403).json({ mesaj: 'Öğretmen davet kodu geçersiz.' });
    }
  }

  try {
    const user = await User.createWithPassword({ name, email, role }, password);
    await regenerateSession(req);
    req.session.user = { id: user._id.toString(), name: user.name, role: user.role };
    await saveSession(req);
    res.status(201).json({
      mesaj: 'Hesap oluşturuldu.',
      user: publicUser(user),
      redirectTo: redirectForRole(user.role)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ mesaj: 'Bu e-posta adresiyle zaten hesap kayıtlı.' });
    }
    console.error('Kayıt işlemi başarısız:', error);
    res.status(500).json({ mesaj: 'Kayıt sırasında sunucu hatası oluştu.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!isValidEmail(email) || typeof password !== 'string' ||
      Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ mesaj: 'E-posta veya şifre biçimi geçersiz.' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    // Yönetici hesapları yalnızca /admin/login üzerinden giriş yapabilir.
    if (!user || user.role === 'admin' || !(await user.verifyPassword(password))) {
      return res.status(401).json({ mesaj: 'E-posta veya şifre hatalı.' });
    }

    await regenerateSession(req);
    req.session.user = { id: user._id.toString(), name: user.name, role: user.role };
    await saveSession(req);
    res.json({
      mesaj: 'Giriş başarılı.',
      user: publicUser(user),
      redirectTo: redirectForRole(user.role)
    });
  } catch (error) {
    console.error('Giriş işlemi başarısız:', error);
    res.status(500).json({ mesaj: 'Giriş sırasında sunucu hatası oluştu.' });
  }
});

router.post('/admin/login', adminLoginLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!isValidEmail(email) || typeof password !== 'string' ||
      Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ mesaj: 'E-posta veya şifre biçimi geçersiz.' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = user && user.role === 'admin' && await user.verifyPassword(password);
    if (!valid) return res.status(401).json({ mesaj: 'E-posta veya şifre hatalı.' });

    await regenerateSession(req);
    req.session.user = { id: user._id.toString(), name: user.name, role: user.role };
    await saveSession(req);
    res.json({
      mesaj: 'Giriş başarılı.',
      user: publicUser(user),
      redirectTo: redirectForRole(user.role)
    });
  } catch (error) {
    console.error('Yönetici girişi başarısız:', error);
    res.status(500).json({ mesaj: 'Giriş sırasında sunucu hatası oluştu.' });
  }
});

router.get('/me', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ mesaj: 'Oturum açılmamış.' });
  try {
    const user = await User.findById(req.session.user.id).select('name email role');
    if (!user) {
      req.session.destroy(error => {
        if (error) return res.status(500).json({ mesaj: 'Oturum kapatılamadı.' });
        res.status(401).json({ mesaj: 'Hesap bulunamadı. Yeniden giriş yapın.' });
      });
      return;
    }
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Oturum kullanıcısı alınamadı:', error);
    res.status(500).json({ mesaj: 'Kullanıcı bilgileri alınamadı.' });
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('zarifcozum.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.status(204).end();
  });
});

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ mesaj: 'Giriş yapmanız gerekiyor.' });
    if (req.session.user.role !== role) {
      return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  };
}

module.exports = { router, requireRole };
