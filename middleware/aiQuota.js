const User = require('../models/User');

// Paket Varsayılan Limitleri
const PAKET_LIMITLERI = {
  free: { maxMessages: 5, maxQuestions: 0 },
  baslangic: { maxMessages: 25, maxQuestions: 3 },
  pro: { maxMessages: 60, maxQuestions: 10 }
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
 * Eğer ozelGunlukMesajLimiti tanımlıysa paketi ezer.
 */
function getEffectiveMessageLimit(user) {
  if (typeof user.ozelGunlukMesajLimiti === 'number' && user.ozelGunlukMesajLimiti >= 0) {
    return user.ozelGunlukMesajLimiti;
  }
  const paket = PAKET_LIMITLERI[user.paketTipi] || PAKET_LIMITLERI.free;
  return paket.maxMessages;
}

/**
 * Kullanıcının etkin soru üretim limitini hesaplar.
 */
function getEffectiveQuestionLimit(user) {
  const paket = PAKET_LIMITLERI[user.paketTipi] || PAKET_LIMITLERI.free;
  return paket.maxQuestions;
}

/**
 * Kullanıcının yapay zeka kotasını denetler ve kullanır.
 * @param {Object} userDoc - Veritabanındaki User dökümanı
 * @param {'message' | 'question'} islemTuru - Yapılan işlem
 * @returns {Promise<{ allowed: boolean, reason?: string, error?: string, status?: number }>}
 */
async function checkAndConsumeQuota(userDoc, islemTuru = 'message') {
  if (!userDoc) {
    return { allowed: true }; // Girişsiz kullanıcı veya oturum dışı (genel kurallar işler)
  }

  // Öğretmen ve Admin rolleri öğrenci kotalarından muaftır
  if (['teacher', 'admin'].includes(userDoc.role)) {
    // Ancak AI erişimi özellikle kilitlenmişse engellenir
    if (userDoc.aiErisimEngelli) {
      return {
        allowed: false,
        status: 403,
        error: 'AI_ACCESS_BLOCKED',
        message: 'Yapay zekâ erişiminiz yönetici tarafından geçici olarak durdurulmuştur.'
      };
    }
    return { allowed: true };
  }

  // 1. AI Erişim Engeli Kontrolü
  if (userDoc.aiErisimEngelli) {
    return {
      allowed: false,
      status: 403,
      error: 'AI_ACCESS_BLOCKED',
      message: 'Yapay zekâ erişiminiz yönetici tarafından geçici olarak askıya alınmıştır. Destek ile iletişime geçebilirsiniz.'
    };
  }

  // 2. Yeni Gün Kontrolü ve Sayaç Sıfırlama
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

  // 3. Limit Kontrolü
  if (islemTuru === 'message') {
    const effectiveLimit = getEffectiveMessageLimit(userDoc);
    const used = userDoc.gunlukAiMesajSayisi || 0;

    if (used < effectiveLimit) {
      // Normal limit dahilinde
      await User.updateOne({ _id: userDoc._id }, { $inc: { gunlukAiMesajSayisi: 1 } }).catch(() => {});
      userDoc.gunlukAiMesajSayisi = used + 1;
      return { allowed: true, kalan: effectiveLimit - (used + 1) };
    }

    // Normal limit dolmuş, bonus kredi kontrol et
    const bonus = userDoc.ekstraBonusKredi || 0;
    if (bonus > 0) {
      await User.updateOne(
        { _id: userDoc._id },
        {
          $inc: {
            gunlukAiMesajSayisi: 1,
            ekstraBonusKredi: -1
          }
        }
      ).catch(() => {});
      userDoc.gunlukAiMesajSayisi = used + 1;
      userDoc.ekstraBonusKredi = bonus - 1;
      return { allowed: true, bonusKullanildi: true, kalanBonus: bonus - 1 };
    }

    // Hem kota hem bonus bitti
    return {
      allowed: false,
      status: 429,
      error: 'QUOTA_EXCEEDED',
      message: 'Günlük AI mesaj hakkınız doldu. Paketinizi yükselterek veya yöneticinizden ek hak talep ederek devam edebilirsiniz.',
      limit: effectiveLimit,
      kullanilan: used
    };
  } else if (islemTuru === 'question') {
    const questionLimit = getEffectiveQuestionLimit(userDoc);
    const used = userDoc.gunlukSoruUretimSayisi || 0;

    if (used < questionLimit) {
      await User.updateOne({ _id: userDoc._id }, { $inc: { gunlukSoruUretimSayisi: 1 } }).catch(() => {});
      userDoc.gunlukSoruUretimSayisi = used + 1;
      return { allowed: true, kalan: questionLimit - (used + 1) };
    }

    return {
      allowed: false,
      status: 429,
      error: 'QUOTA_EXCEEDED',
      message: 'Günlük yeni soru üretim limitiniz doldu. Hazır soru havuzundan çözmeye devam edebilir veya paketinizi yükseltebilirsiniz.',
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
      paketTipi: 'free',
      etkinLimit: 5,
      kullanilan: 0,
      kalan: 5,
      ekstraBonusKredi: 0,
      aiErisimEngelli: false
    };
  }

  resetIfNewDay(user);
  const etkinLimit = getEffectiveMessageLimit(user);
  const kullanilan = user.gunlukAiMesajSayisi || 0;
  const kalan = Math.max(0, etkinLimit - kullanilan);

  return {
    paketTipi: user.paketTipi || 'free',
    ozelLimitMi: typeof user.ozelGunlukMesajLimiti === 'number',
    etkinLimit,
    kullanilan,
    kalan,
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

      // Veritabanından güncel kullanıcıyı çek (bellekteki oturum eski olabilir)
      const freshUser = await User.findById(user._id || user.id);
      if (!freshUser) return next();

      const result = await checkAndConsumeQuota(freshUser, islemTuru);
      if (!result.allowed) {
        return res.status(result.status || 429).json({
          error: result.error || 'QUOTA_EXCEEDED',
          mesaj: result.message,
          message: result.message,
          limit: result.limit,
          kullanilan: result.kullanilan
        });
      }

      // Oturumu güncelle
      req.session.user.gunlukAiMesajSayisi = freshUser.gunlukAiMesajSayisi;
      req.session.user.ekstraBonusKredi = freshUser.ekstraBonusKredi;
      req.session.user.paketTipi = freshUser.paketTipi;
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
  resetIfNewDay,
  getEffectiveMessageLimit,
  getEffectiveQuestionLimit,
  checkAndConsumeQuota,
  getQuotaStatus,
  aiQuotaMiddleware
};
