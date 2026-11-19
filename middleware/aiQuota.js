const User = require('../models/User');

// Öğrenci Paket Varsayılan Limitleri
const PAKET_LIMITLERI = {
  free: { maxMessages: 5, maxQuestions: 0 },
  baslangic: { maxMessages: 25, maxQuestions: 3 },
  pro: { maxMessages: 60, maxQuestions: 10 }
};

// Öğretmen Rol & Yetki Varsayılan Limitleri
const OGRETMEN_LIMITLERI = {
  icerik_ureticisi: { maxQuestions: Infinity, maxMessages: Infinity, allowPro: true },
  onayli_ogretmen: { maxQuestions: 15, maxMessages: 40, allowPro: false },
  standart_ogretmen: { maxQuestions: 3, maxMessages: 10, allowPro: false }
};

/**
 * Kullanıcının günlük kotasının sıfırlanma zamanı gelmişse sayaçları sıfırlar.
 */
function resetIfNewDay(user) {
  const now = new Date();
  const sonTarih = user.sonKotaSifirlamaTarihi ? new Date(user.sonKotaSifirlamaTarihi) : new Date(0);

  const isSameDay =
    sonTarih.getFullYear() === now.getFullYear() &&
    sonTarih.getMonth() === now.getMonth() &&
    sonTarih.getDate() === now.getDate();

  if (!isSameDay) {
    user.gunlukAiMesajSayisi = 0;
    user.gunlukSoruUretimSayisi = 0;
    user.sonKotaSifirlamaTarihi = now;
    return true;
  }
  return false;
}

/**
 * Kullanıcının etkin günlük mesaj limitini hesaplar.
 */
function getEffectiveMessageLimit(user) {
  if (!user) return 5;

  // Admin her zaman sınırsız
  if (user.role === 'admin') return Infinity;

  // Öğretmen Rolleri
  if (user.role === 'teacher') {
    const oTip = user.ogretmenTipi || 'standart_ogretmen';
    if (oTip === 'icerik_ureticisi') return Infinity;

    // Admin özel limit belirlemişse paketi ezer
    if (typeof user.ozelGunlukMesajLimiti === 'number' && user.ozelGunlukMesajLimiti >= 0) {
      return user.ozelGunlukMesajLimiti;
    }

    const tLimits = OGRETMEN_LIMITLERI[oTip] || OGRETMEN_LIMITLERI.standart_ogretmen;
    return tLimits.maxMessages;
  }

  // Öğrenci Rolü
  if (typeof user.ozelGunlukMesajLimiti === 'number' && user.ozelGunlukMesajLimiti >= 0) {
    return user.ozelGunlukMesajLimiti;
  }
  const paket = PAKET_LIMITLERI[user.paketTipi] || PAKET_LIMITLERI.free;
  return paket.maxMessages;
}

/**
 * Kullanıcının etkin yeni soru üretim limitini hesaplar.
 */
function getEffectiveQuestionLimit(user) {
  if (!user) return 0;

  // Admin her zaman sınırsız
  if (user.role === 'admin') return Infinity;

  // Öğretmen Rolleri
  if (user.role === 'teacher') {
    const oTip = user.ogretmenTipi || 'standart_ogretmen';
    if (oTip === 'icerik_ureticisi') return Infinity;

    // Admin özel limit belirlemişse ozelGunlukSoruLimiti önceliklidir
    if (typeof user.ozelGunlukSoruLimiti === 'number' && user.ozelGunlukSoruLimiti >= 0) {
      return user.ozelGunlukSoruLimiti;
    }

    const tLimits = OGRETMEN_LIMITLERI[oTip] || OGRETMEN_LIMITLERI.standart_ogretmen;
    return tLimits.maxQuestions;
  }

  // Öğrenci Rolü
  const paket = PAKET_LIMITLERI[user.paketTipi] || PAKET_LIMITLERI.free;
  return paket.maxQuestions;
}

/**
 * Kullanıcının gemini-2.5-pro modelini seçme yetkisi var mı?
 */
function canUserUseProModel(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher' && user.ogretmenTipi === 'icerik_ureticisi') return true;
  return false;
}

/**
 * Kullanıcının yapay zeka kotasını denetler ve kullanır.
 * @param {Object} userDoc - Veritabanındaki User dökümanı
 * @param {'message' | 'question'} islemTuru - Yapılan işlem
 * @param {number} miktar - Tüketilecek hak (varsayılan: 1)
 * @returns {Promise<{ allowed: boolean, reason?: string, error?: string, status?: number }>}
 */
async function checkAndConsumeQuota(userDoc, islemTuru = 'message', miktar = 1) {
  if (!userDoc) {
    return { allowed: true };
  }

  // 1. AI Erişim Engeli Kontrolü (Admin hariç)
  if (userDoc.role !== 'admin' && userDoc.aiErisimEngelli) {
    return {
      allowed: false,
      status: 403,
      error: 'AI_ACCESS_BLOCKED',
      message: 'Yapay zekâ erişiminiz yönetici tarafından geçici olarak durdurulmuştur. Lütfen destek ile iletişime geçin.'
    };
  }

  // 1.5. Öğretmen Başvuru Onay Kontrolü: Onaylanmamış öğretmen AI özelliklerini kullanamaz
  if (userDoc.role === 'teacher' && userDoc.basvuruDurumu !== 'onaylandi') {
    return {
      allowed: false,
      status: 403,
      error: 'APPLICATION_PENDING',
      message: userDoc.basvuruDurumu === 'reddedildi'
        ? 'Öğretmen başvurunuz onaylanmamıştır. Destek ekibiyle iletişime geçebilirsiniz.'
        : 'Öğretmen başvurunuz incelenmektedir. Onaylandığında tüm özellikler aktif olacaktır.'
    };
  }

  // 2. Admin ve İçerik Üreticisi tamamen SINIRSIZ
  if (userDoc.role === 'admin' || (userDoc.role === 'teacher' && userDoc.ogretmenTipi === 'icerik_ureticisi')) {
    return { allowed: true, sinirsiz: true };
  }

  // 3. Yeni Gün Kontrolü ve Sayaç Sıfırlama
  const needsReset = resetIfNewDay(userDoc);
  if (needsReset) {
    await User.updateOne(
      { _id: userDoc._id },
      {
        $set: {
          gunlukAiMesajSayisi: 0,
          gunlukSoruUretimSayisi: 0,
          sonKotaSifirlamaTarihi: userDoc.sonKotaSifirlamaTarihi
        }
      }
    ).catch(() => {});
  }

  const consumeCount = Math.max(1, parseInt(miktar, 10) || 1);

  // 4. Limit Kontrolleri
  if (islemTuru === 'message') {
    const effectiveLimit = getEffectiveMessageLimit(userDoc);
    const used = userDoc.gunlukAiMesajSayisi || 0;

    if (used + consumeCount <= effectiveLimit) {
      await User.updateOne({ _id: userDoc._id }, { $inc: { gunlukAiMesajSayisi: consumeCount } }).catch(() => {});
      userDoc.gunlukAiMesajSayisi = used + consumeCount;
      return { allowed: true, kalan: effectiveLimit - (used + consumeCount) };
    }

    // Normal limit dolmuş, bonus kredi kontrol et
    const bonus = userDoc.ekstraBonusKredi || 0;
    if (bonus >= consumeCount) {
      await User.updateOne(
        { _id: userDoc._id },
        {
          $inc: {
            gunlukAiMesajSayisi: consumeCount,
            ekstraBonusKredi: -consumeCount
          }
        }
      ).catch(() => {});
      userDoc.gunlukAiMesajSayisi = used + consumeCount;
      userDoc.ekstraBonusKredi = bonus - consumeCount;
      return { allowed: true, bonusKullanildi: true, kalanBonus: bonus - consumeCount };
    }

    return {
      allowed: false,
      status: 429,
      error: 'QUOTA_EXCEEDED',
      message: userDoc.role === 'teacher'
        ? `Günlük AI mesaj hakkınız (${effectiveLimit} mesaj) doldu. Yetkinizi yükseltmek için okul yöneticinize başvurabilirsiniz.`
        : 'Günlük AI mesaj hakkınız doldu. Paketinizi yükselterek devam edebilirsiniz.',
      limit: effectiveLimit,
      kullanilan: used
    };
  } else if (islemTuru === 'question') {
    const questionLimit = getEffectiveQuestionLimit(userDoc);
    const used = userDoc.gunlukSoruUretimSayisi || 0;

    if (used + consumeCount <= questionLimit) {
      await User.updateOne({ _id: userDoc._id }, { $inc: { gunlukSoruUretimSayisi: consumeCount } }).catch(() => {});
      userDoc.gunlukSoruUretimSayisi = used + consumeCount;
      return { allowed: true, kalan: questionLimit - (used + consumeCount) };
    }

    return {
      allowed: false,
      status: 429,
      error: 'QUOTA_EXCEEDED',
      message: userDoc.role === 'teacher'
        ? `Günlük yeni soru üretim kotanız (${questionLimit} soru) doldu. Hazır soru havuzundan sınırsız soru seçebilir veya kota artırımı için yöneticiyle iletişime geçebilirsiniz.`
        : 'Günlük yeni soru üretim limitiniz doldu. Hazır soru havuzundan soru çözmeye devam edebilirsiniz.',
      limit: questionLimit,
      kullanilan: used
    };
  }

  return { allowed: true };
}

/**
 * Kullanıcının mevcut kota durumunu döndürür.
 */
function getQuotaStatus(user) {
  if (!user) {
    return {
      rol: 'misafir',
      paketTipi: 'free',
      etkinLimit: 5,
      kullanilan: 0,
      kalan: 5,
      ekstraBonusKredi: 0,
      aiErisimEngelli: false
    };
  }

  resetIfNewDay(user);
  const etkinMesajLimiti = getEffectiveMessageLimit(user);
  const etkinSoruLimiti = getEffectiveQuestionLimit(user);
  const isSinirsiz = user.role === 'admin' || (user.role === 'teacher' && user.ogretmenTipi === 'icerik_ureticisi');

  return {
    rol: user.role,
    ogretmenTipi: user.role === 'teacher' ? (user.ogretmenTipi || 'standart_ogretmen') : undefined,
    basvuruDurumu: user.basvuruDurumu || (user.role === 'teacher' ? 'inceleme_suruyor' : 'onaylandi'),
    paketTipi: user.paketTipi || 'free',
    sinirsiz: isSinirsiz,
    proModelIzni: canUserUseProModel(user),
    mesaj: {
      etkinLimit: etkinMesajLimiti,
      kullanilan: user.gunlukAiMesajSayisi || 0,
      kalan: isSinirsiz ? Infinity : Math.max(0, etkinMesajLimiti - (user.gunlukAiMesajSayisi || 0)),
      ozelLimitMi: typeof user.ozelGunlukMesajLimiti === 'number'
    },
    soru: {
      etkinLimit: etkinSoruLimiti,
      kullanilan: user.gunlukSoruUretimSayisi || 0,
      kalan: isSinirsiz ? Infinity : Math.max(0, etkinSoruLimiti - (user.gunlukSoruUretimSayisi || 0)),
      ozelLimitMi: typeof user.ozelGunlukSoruLimiti === 'number'
    },
    ekstraBonusKredi: user.ekstraBonusKredi || 0,
    toplamHarcananToken: user.toplamHarcananToken || 0,
    toplamMaliyetTL: user.toplamMaliyetTL || 0,
    aiErisimEngelli: Boolean(user.aiErisimEngelli)
  };
}

/**
 * Express Middleware
 */
function aiQuotaMiddleware(islemTuru = 'message') {
  return async (req, res, next) => {
    try {
      const user = req.session?.user;
      if (!user) return next();

      const freshUser = await User.findById(user._id || user.id);
      if (!freshUser) return next();

      const result = await checkAndConsumeQuota(freshUser, islemTuru, 1);
      if (!result.allowed) {
        return res.status(result.status || 429).json({
          error: result.error || 'QUOTA_EXCEEDED',
          mesaj: result.message,
          message: result.message,
          limit: result.limit,
          kullanilan: result.kullanilan
        });
      }

      req.session.user.gunlukAiMesajSayisi = freshUser.gunlukAiMesajSayisi;
      req.session.user.gunlukSoruUretimSayisi = freshUser.gunlukSoruUretimSayisi;
      req.session.user.ekstraBonusKredi = freshUser.ekstraBonusKredi;
      req.session.user.ogretmenTipi = freshUser.ogretmenTipi;
      req.session.user.aiErisimEngelli = freshUser.aiErisimEngelli;

      next();
    } catch (err) {
      console.warn('[aiQuotaMiddleware] Hata:', err.message);
      next();
    }
  };
}

module.exports = {
  PAKET_LIMITLERI,
  OGRETMEN_LIMITLERI,
  resetIfNewDay,
  getEffectiveMessageLimit,
  getEffectiveQuestionLimit,
  canUserUseProModel,
  checkAndConsumeQuota,
  getQuotaStatus,
  aiQuotaMiddleware
};
