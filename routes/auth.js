const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const router = express.Router();
const googleClient = new OAuth2Client();
const genericResetMessage = 'E-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.';
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
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla şifre sıfırlama isteği. Bir süre sonra tekrar deneyin.' }
});
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla şifre değiştirme denemesi. Bir süre sonra tekrar deneyin.' }
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

function validPassword(password) {
  return typeof password === 'string' &&
    Buffer.byteLength(password, 'utf8') >= 10 &&
    Buffer.byteLength(password, 'utf8') <= 72;
}

function teacherCodeIsValid(suppliedCode) {
  const expected = Buffer.from(String(process.env.TEACHER_REGISTRATION_CODE || ''));
  const supplied = Buffer.from(typeof suppliedCode === 'string' ? suppliedCode : '');
  return expected.length > 0 && supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected);
}

function createMailTransport() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASSWORD || '');
  const from = String(process.env.SMTP_FROM || '').trim();
  if (!host || !user || !pass || !from) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return {
    from,
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    })
  };
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
  if (!validPassword(password)) {
    return res.status(400).json({ mesaj: 'Şifre 10–72 bayt uzunluğunda olmalıdır.' });
  }
  if (!passwordsMatch(password, body.passwordConfirmation)) {
    return res.status(400).json({ mesaj: 'Şifreler eşleşmiyor.' });
  }
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ mesaj: 'Geçerli bir kullanıcı tipi seçin.' });
  }

  if (role === 'teacher') {
    if (!process.env.TEACHER_REGISTRATION_CODE) {
      return res.status(503).json({ mesaj: 'Öğretmen kaydı şu anda etkin değil.' });
    }
    if (!teacherCodeIsValid(body.teacherCode)) {
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

router.get('/auth/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ googleClientId: String(process.env.GOOGLE_CLIENT_ID || '').trim() });
});

router.post('/auth/google', (req, res, next) => {
  const limiter = req.body?.intent === 'register' ? registerLimiter : loginLimiter;
  limiter(req, res, next);
}, async (req, res) => {
  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  const intent = req.body?.intent;
  const requestedRole = req.body?.role;
  if (!credential || credential.length > 10000 || !['login', 'register'].includes(intent)) {
    return res.status(400).json({ mesaj: 'Google giriş bilgisi geçersiz.' });
  }
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) return res.status(503).json({ mesaj: 'Google ile giriş şu anda etkin değil.' });

  let profile;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    profile = ticket.getPayload();
  } catch (error) {
    console.warn('Google kimlik belirteci doğrulanamadı:', error.message);
    return res.status(401).json({ mesaj: 'Google hesabı doğrulanamadı.' });
  }
  if (!profile || !profile.sub || !profile.email || profile.email_verified !== true ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(profile.iss)) {
    return res.status(401).json({ mesaj: 'Google hesabı doğrulanamadı.' });
  }
  try {
    const email = profile.email.trim().toLowerCase();
    if (!isValidEmail(email)) return res.status(401).json({ mesaj: 'Google e-posta adresi geçersiz.' });
    let user = await User.findOne({ googleId: profile.sub }).select('+googleId');
    if (!user) {
      user = await User.findOne({ email }).select('+googleId');
      if (user?.role === 'admin' || (user?.googleId && user.googleId !== profile.sub)) {
        return res.status(403).json({ mesaj: 'Bu Google hesabıyla giriş yapılamıyor.' });
      }
      if (user) {
        user.googleId = profile.sub;
        await user.save();
      } else {
        if (intent !== 'register') {
          return res.status(404).json({ mesaj: 'Bu Google hesabıyla kayıtlı hesap bulunamadı. Önce hesap oluşturun.' });
        }
        if (!['student', 'teacher'].includes(requestedRole)) {
          return res.status(400).json({ mesaj: 'Geçerli bir kullanıcı tipi seçin.' });
        }
        if (requestedRole === 'teacher') {
          if (!process.env.TEACHER_REGISTRATION_CODE) {
            return res.status(503).json({ mesaj: 'Öğretmen kaydı şu anda etkin değil.' });
          }
          if (!teacherCodeIsValid(req.body?.teacherCode)) {
            return res.status(403).json({ mesaj: 'Öğretmen davet kodu geçersiz.' });
          }
        }
        user = await User.create({
          name: String(profile.name || email.split('@')[0]).trim().slice(0, 100),
          email,
          role: requestedRole,
          googleId: profile.sub
        });
      }
    }

    if (user.role === 'admin') return res.status(403).json({ mesaj: 'Yönetici hesabı Google ile giriş yapamaz.' });
    await regenerateSession(req);
    req.session.user = { id: user._id.toString(), name: user.name, role: user.role };
    await saveSession(req);
    res.json({
      mesaj: 'Google girişi başarılı.',
      user: publicUser(user),
      redirectTo: redirectForRole(user.role)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ mesaj: 'Bu e-posta adresiyle zaten hesap kayıtlı.' });
    }
    console.error('Google ile giriş başarısız:', error);
    res.status(500).json({ mesaj: 'Google girişi sırasında sunucu hatası oluştu.' });
  }
});

router.post('/forgot-password', resetLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) return res.status(400).json({ mesaj: 'Geçerli bir e-posta adresi girin.' });

  const mail = createMailTransport();
  const appBaseUrl = String(process.env.APP_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? '' : `http://localhost:${process.env.PORT || 3000}`)).trim();
  if (!mail || !appBaseUrl) {
    return res.status(503).json({ mesaj: 'Şifre sıfırlama e-posta hizmeti yapılandırılmamış.' });
  }
  let baseUrl;
  try {
    baseUrl = new URL(appBaseUrl);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      throw new Error('APP_BASE_URL geçerli bir HTTP(S) adresi olmalıdır.');
    }
  } catch (error) {
    console.error('Şifre sıfırlama adresi yapılandırması geçersiz:', error);
    return res.status(503).json({ mesaj: 'Şifre sıfırlama e-posta hizmeti yapılandırılmamış.' });
  }

  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
      user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const resetUrl = new URL('/kayit-giris.html', baseUrl);
      resetUrl.searchParams.set('mode', 'reset');
      resetUrl.searchParams.set('email', email);
      resetUrl.searchParams.set('token', token);
      try {
        await mail.transport.sendMail({
          from: mail.from,
          to: email,
          subject: 'ZarifÇözüm şifre sıfırlama',
          text: `Şifrenizi yenilemek için 30 dakika içinde bu bağlantıyı açın: ${resetUrl.toString()}`,
          html: `<p>Şifrenizi yenilemek için 30 dakika içinde aşağıdaki bağlantıyı açın:</p><p><a href="${resetUrl.toString()}">Şifremi yenile</a></p><p>Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`
        });
      } catch (error) {
        console.error('Şifre sıfırlama isteği başarısız:', error);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        try {
          await user.save();
        } catch (cleanupError) {
          console.error('Kullanılmayan şifre sıfırlama belirteci temizlenemedi:', cleanupError);
        }
      }
    }
    res.json({ mesaj: genericResetMessage });
  } catch (error) {
    console.error('Şifre sıfırlama e-postası gönderilemedi:', error);
    res.status(500).json({ mesaj: 'Şifre sıfırlama isteği işlenemedi.' });
  }
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const { password, passwordConfirmation } = req.body || {};
  if (!isValidEmail(email) || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ mesaj: 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ mesaj: 'Şifre 10–72 bayt uzunluğunda olmalıdır.' });
  }
  if (!passwordsMatch(password, passwordConfirmation)) {
    return res.status(400).json({ mesaj: 'Şifreler eşleşmiyor.' });
  }

  try {
    const resetHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOneAndUpdate({
      email,
      resetPasswordToken: resetHash,
      resetPasswordExpires: { $gt: new Date() }
    }, {
      $set: { passwordHash: await User.hashPassword(password) },
      $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 }
    }, { new: true, runValidators: true });
    if (!user) {
      return res.status(400).json({ mesaj: 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.' });
    }
    res.json({ mesaj: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
  } catch (error) {
    console.error('Şifre sıfırlama başarısız:', error);
    res.status(500).json({ mesaj: 'Şifre güncellenirken sunucu hatası oluştu.' });
  }
});

router.post('/change-password', passwordChangeLimiter, requireRole('student', 'teacher', 'admin'), async (req, res) => {
  const { currentPassword, password, passwordConfirmation } = req.body || {};
  if (!validPassword(password)) {
    return res.status(400).json({ mesaj: 'Yeni şifre 10–72 bayt uzunluğunda olmalıdır.' });
  }
  if (!passwordsMatch(password, passwordConfirmation)) {
    return res.status(400).json({ mesaj: 'Yeni şifreler eşleşmiyor.' });
  }

  try {
    const user = await User.findById(req.session.user.id).select('+passwordHash');
    if (!user) return res.status(401).json({ mesaj: 'Hesap bulunamadı. Yeniden giriş yapın.' });
    if (user.passwordHash &&
        (typeof currentPassword !== 'string' || !(await user.verifyPassword(currentPassword)))) {
      return res.status(400).json({ mesaj: 'Mevcut şifre hatalı.' });
    }
    await user.setPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ mesaj: 'Şifreniz başarıyla değiştirildi.' });
  } catch (error) {
    console.error('Şifre değiştirme başarısız:', error);
    res.status(500).json({ mesaj: 'Şifre değiştirilirken sunucu hatası oluştu.' });
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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ mesaj: 'Giriş yapmanız gerekiyor.' });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  };
}

module.exports = { router, requireRole };
