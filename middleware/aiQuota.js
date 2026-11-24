const User = require('../models/User');

// Öğrenci Paket Varsayılan Limitleri (Hedeflenen 3 Yıllık Paket Mimarisi)
const PAKET_LIMITLERI = {
  free: {
    dailySokratik: 3,
    weeklySokratik: 3,
    monthlySokratik: 12,
    monthlyOgretmenIkizi: 0,
    dailyQuestions: 0,
    monthlyQuestions: 0,
    maxMessages: 3
  },
  temel: {
    dailySokratik: 3,
    monthlySokratik: 90,
    monthlyOgretmenIkizi: 30,
    dailyQuestions: 0,
    monthlyQuestions: 0,
    maxMessages: 3
  },
  standart: {
    dailySokratik: 10,
    monthlySokratik: 300,
    monthlyOgretmenIkizi: 150,
    dailyQuestions: 3,
    monthlyQuestions: 15,
    maxMessages: 10
  },
  vip: {
    dailySokratik: 25,
    monthlySokratik: 750,
    monthlyOgretmenIkizi: 400,
    dailyQuestions: 10,
    monthlyQuestions: 50,
    maxMessages: 25
  },
  // Geriye dönük uyumluluk takma adları
  baslangic: {
    dailySokratik: 3,
    monthlySokratik: 90,
    monthlyOgretmenIkizi: 30,
    dailyQuestions: 0,
    monthlyQuestions: 0,
    maxMessages: 25
  },
  pro: {
    dailySokratik: 25,
    monthlySokratik: 750,
    monthlyOgretmenIkizi: 400,
    dailyQuestions: 10,
    monthlyQuestions: 50,
    maxMessages: 60
  }
};

// Öğretmen Rol & Yetki Varsayılan Limitleri
// Kural: Admin rolü hariç hiçbir kullanıcıya sınırsız AI verilmez; öğretmenler için aylık maksimum 200 soru kotası vardır.
const OGRETMEN_LIMITLERI = {
  icerik_ureticisi: {
    maxQuestions: 50,
    monthlyQuestions: 200,
    maxMessages: 100,
    monthlyMessages: 1000,
    allowPro: true
  },
  onayli_ogretmen: {
    maxQuestions: 15,
    monthlyQuestions: 200,
    maxMessages: 40,
    monthlyMessages: 500,
    allowPro: false
  },
  standart_ogretmen: {
    maxQuestions: 3,
    monthlyQuestions: 50,
    maxMessages: 10,
    monthlyMessages: 150,
    allowPro: false
  }
};

/**
 * Kullanıcının etkin paketini tespit eder.
 */
function resolveUserPlan(user) {
  if (!user) return 'free';
  if (typeof user.getEffectivePlan === 'function') {
    return user.getEffectivePlan();
  }
  if (user.subscriptionStatus === 'active' && user.subscriptionPlan) {
    return user.subscriptionPlan;
  }
  const p = user.paketTipi;
  if (p === 'vip' || p === 'pro') return 'vip';
  if (p === 'standart') return 'standart';
  if (p === 'temel' || p === 'baslangic') return 'temel';
  return 'free';
}

/**
 * Kullanıcının günlük kotasının sıfırlanma zamanı gelmişse sayaçları sıfırlar.
 */
function getWeekStartTimestamp(dateInput) {
  const d = new Date(dateInput || Date.now());
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Paz, 1=Pzt
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.getTime();
}

function resetIfNewWeek(user) {
  const now = new Date();
  const lastReset = user.sonHaftalikSifirlamaTarihi ? new Date(user.sonHaftalikSifirlamaTarihi) : new Date(0);
  const isSameWeek = getWeekStartTimestamp(lastReset) === getWeekStartTimestamp(now);
  if (!isSameWeek) {
    user.haftalikSokratikSayisi = 0;
    user.sonHaftalikSifirlamaTarihi = now;
    return true;
  }
  return false;
}

function resetIfNewDay(user) {
  const now = new Date();
  const sonTarih = user.sonKotaSifirlamaTarihi ? new Date(user.sonKotaSifirlamaTarihi) : new Date(0);

  const isSameDay =
    sonTarih.getFullYear() === now.getFullYear() &&
    sonTarih.getMonth() === now.getMonth() &&
    sonTarih.getDate() === now.getDate();

  if (!isSameDay) {
    user.gunlukAiMesajSayisi = 0;
    user.gunlukSokratikSayisi = 0;
    user.gunlukSoruUretimSayisi = 0;
    user.sonKotaSifirlamaTarihi = now;
    return true;
  }
  return false;
}

/**
 * Kullanıcının aylık kotasının sıfırlanma zamanı gelmişse sayaçları sıfırlar.
 */
function resetIfNewMonth(user) {
  const now = new Date();
  const sonAylik = user.sonAylikSifirlamaTarihi ? new Date(user.sonAylikSifirlamaTarihi) : new Date(0);

  const isSameMonth =
    sonAylik.getFullYear() === now.getFullYear() &&
    sonAylik.getMonth() === now.getMonth();

  if (!isSameMonth) {
    user.aylikSokratikSayisi = 0;
    user.aylikOgretmenIkiziSayisi = 0;
    user.aylikSoruUretimSayisi = 0;
    user.sonAylikSifirlamaTarihi = now;
    return true;
  }
  return false;
}

/**
 * Kullanıcının etkin günlük mesaj (Sokratik) limitini hesaplar.
 */
function getEffectiveMessageLimit(user) {
  if (!user) return 3;

  // Admin her zaman sınırsız
  if (user.role === 'admin') return Infinity;

  // Öğretmen Rolleri
  if (user.role === 'teacher') {
    const oTip = user.ogretmenTipi || 'standart_ogretmen';
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
  const planKey = resolveUserPlan(user);
  const paket = PAKET_LIMITLERI[planKey] || PAKET_LIMITLERI.free;
  return paket.dailySokratik || paket.maxMessages || 3;
}

/**
 * Kullanıcının etkin aylık Sokratik Mentör limitini hesaplar.
 */
function getEffectiveMonthlySokratikLimit(user) {
  if (!user) return 15;
  if (user.role === 'admin') return Infinity;
  if (user.role === 'teacher') {
    const oTip = user.ogretmenTipi || 'standart_ogretmen';
    const tLimits = OGRETMEN_LIMITLERI[oTip] || OGRETMEN_LIMITLERI.standart_ogretmen;
    return tLimits.monthlyMessages;
  }
  const planKey = resolveUserPlan(user);
  const paket = PAKET_LIMITLERI[planKey] || PAKET_LIMITLERI.free;
  return paket.monthlySokratik || 15;
}

/**
 * Kullanıcının etkin aylık Öğretmen İkizi limitini hesaplar.
 */
function getEffectiveMonthlyOgretmenIkiziLimit(user) {
  if (!user) return 0;
  if (user.role === 'admin') return Infinity;
  if (user.role === 'teacher') return 100; // Öğretmenler kendi panellerinde kullanabilir
  const planKey = resolveUserPlan(user);
  const paket = PAKET_LIMITLERI[planKey] || PAKET_LIMITLERI.free;
  return paket.monthlyOgretmenIkizi || 0;
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
    if (typeof user.ozelGunlukSoruLimiti === 'number' && user.ozelGunlukSoruLimiti >= 0) {
      return user.ozelGunlukSoruLimiti;
    }
    const tLimits = OGRETMEN_LIMITLERI[oTip] || OGRETMEN_LIMITLERI.standart_ogretmen;
    return tLimits.maxQuestions;
  }

  // Öğrenci Rolü
  const planKey = resolveUserPlan(user);
  const paket = PAKET_LIMITLERI[planKey] || PAKET_LIMITLERI.free;
  return paket.dailyQuestions || 0;
}

/**
 * Kullanıcının aylık soru üretim üst sınırını hesaplar (Öğretmenler için maks 200).
 */
function getEffectiveMonthlyQuestionLimit(user) {
  if (!user) return 0;
  if (user.role === 'admin') return Infinity;
  if (typeof user.ozelAylikSoruLimiti === 'number' && user.ozelAylikSoruLimiti >= 0) {
    return user.ozelAylikSoruLimiti;
  }
  if (user.role === 'teacher') {
    const oTip = user.ogretmenTipi || 'standart_ogretmen';
    const tLimits = OGRETMEN_LIMITLERI[oTip] || OGRETMEN_LIMITLERI.standart_ogretmen;
    return tLimits.monthlyQuestions || 200;
  }
  const planKey = resolveUserPlan(user);
  const paket = PAKET_LIMITLERI[planKey] || PAKET_LIMITLERI.free;
  return paket.monthlyQuestions || 0;
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
 * @param {'message' | 'sokratik' | 'ogretmen_ikizi' | 'question'} islemTuru - Yapılan işlem
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

  // 2. Yalnızca Admin tamamen sınırsızdır
  if (userDoc.role === 'admin') {
    return { allowed: true, sinirsiz: true };
  }

  // 3. Yeni Gün ve Yeni Ay Kontrolleri ve Sayaç Sıfırlama
  const dayReset = resetIfNewDay(userDoc);
  const monthReset = resetIfNewMonth(userDoc);
  const weekReset = resetIfNewWeek(userDoc);
  if ((dayReset || weekReset || monthReset) && userDoc._id && require('mongoose').connection?.readyState === 1) {
    const updateFields = {};
    if (dayReset) {
      updateFields.gunlukAiMesajSayisi = 0;
      updateFields.gunlukSokratikSayisi = 0;
      updateFields.gunlukSoruUretimSayisi = 0;
      updateFields.sonKotaSifirlamaTarihi = userDoc.sonKotaSifirlamaTarihi;
    }
    if (weekReset) {
      updateFields.haftalikSokratikSayisi = 0;
      updateFields.sonHaftalikSifirlamaTarihi = userDoc.sonHaftalikSifirlamaTarihi;
    }
    if (monthReset) {
      updateFields.aylikSokratikSayisi = 0;
      updateFields.aylikOgretmenIkiziSayisi = 0;
      updateFields.aylikSoruUretimSayisi = 0;
      updateFields.sonAylikSifirlamaTarihi = userDoc.sonAylikSifirlamaTarihi;
    }
    await User.updateOne({ _id: userDoc._id }, { $set: updateFields }).catch(() => {});
  }

  const consumeCount = Math.max(1, parseInt(miktar, 10) || 1);
  const hasDb = userDoc._id && require('mongoose').connection?.readyState === 1;
  const effectivePlan = resolveUserPlan(userDoc);

  // 4. İŞLEM TÜRÜ DENETİMLERİ

  // 0) Ücretsiz öğrenci için kilitli asistanlar (Adım Adım Soru Çözümü & AI Koç)
  if (userDoc.role === 'student' && effectivePlan === 'free' && (islemTuru === 'soru_cozum' || islemTuru === 'ai_koc')) {
    const label = islemTuru === 'ai_koc' ? 'AI Koç (Haftalık Plan)' : 'Adım Adım Soru Çözümü';
    return {
      allowed: false,
      status: 403,
      error: 'PLAN_UPGRADE_REQUIRED',
      message: `${label} asistanı ücretsiz planda kilitlidir. Üyeliğini Temel, Standart veya VIP pakete yükselterek hemen kullanmaya başlayabilirsin.`,
      limit: 0,
      kullanilan: 0
    };
  }

  // A) Öğretmen İkizi (Farklı Anlat) Kontrolü
  if (islemTuru === 'ogretmen_ikizi') {
    const monthlyLimit = getEffectiveMonthlyOgretmenIkiziLimit(userDoc);
    const monthlyUsed = userDoc.aylikOgretmenIkiziSayisi || 0;

    if (monthlyUsed + consumeCount <= monthlyLimit) {
      if (hasDb) {
        await User.updateOne({ _id: userDoc._id }, { $inc: { aylikOgretmenIkiziSayisi: consumeCount } }).catch(() => {});
      }
      userDoc.aylikOgretmenIkiziSayisi = monthlyUsed + consumeCount;
      return { allowed: true, kalanAylik: monthlyLimit - (monthlyUsed + consumeCount) };
    }

    // Normal limit dolmuşsa ekstra Öğretmen İkizi bonus kredisini kontrol et
    const ikizBonus = userDoc.ekstraOgretmenIkiziKredi || 0;
    if (ikizBonus >= consumeCount) {
      if (hasDb) {
        await User.updateOne({ _id: userDoc._id }, {
          $inc: { aylikOgretmenIkiziSayisi: consumeCount, ekstraOgretmenIkiziKredi: -consumeCount }
        }).catch(() => {});
      }
      userDoc.aylikOgretmenIkiziSayisi = monthlyUsed + consumeCount;
      userDoc.ekstraOgretmenIkiziKredi = ikizBonus - consumeCount;
      return { allowed: true, bonusKullanildi: true, kalanBonus: ikizBonus - consumeCount };
    }

    return {
      allowed: false,
      status: 429,
      error: 'QUOTA_EXCEEDED',
      message: monthlyLimit === 0
        ? 'Öğretmen İkizi (Farklı Anlatım) özelliği Temel pakette aylık 30, Standart pakette 150, VIP pakette 400 haktır. Paketinizi yükselterek bu özelliği hemen kullanmaya başlayabilirsiniz.'
        : `Aylık Öğretmen İkizi kullanım hakkınız (${monthlyLimit} hak) doldu. Bir sonraki ay yenilenecektir veya paketinizi yükseltebilirsiniz.`,
      limit: monthlyLimit,
      kullanilan: monthlyUsed
    };
  }

  // B) Sokratik Mentör / Genel AI Mesajı Kontrolü
  if (islemTuru === 'message' || islemTuru === 'sokratik' || islemTuru === 'soru_cozum' || islemTuru === 'ai_koc') {
    const dailyLimit = getEffectiveMessageLimit(userDoc);
    const weeklyLimit = (userDoc.role === 'student' && effectivePlan === 'free') ? (PAKET_LIMITLERI.free.weeklySokratik || 3) : null;
    const monthlyLimit = getEffectiveMonthlySokratikLimit(userDoc);

    const dailyUsed = userDoc.gunlukSokratikSayisi || userDoc.gunlukAiMesajSayisi || 0;
    const weeklyUsed = userDoc.haftalikSokratikSayisi || 0;
    const monthlyUsed = userDoc.aylikSokratikSayisi || 0;

    // 1) Aylık sınır kontrolü
    if (monthlyUsed + consumeCount > monthlyLimit) {
      const sokratikBonus = userDoc.ekstraSokratikKredi || 0;
      if (sokratikBonus >= consumeCount) {
        if (hasDb) {
          await User.updateOne({ _id: userDoc._id }, {
            $inc: {
              gunlukAiMesajSayisi: consumeCount,
              gunlukSokratikSayisi: consumeCount,
              haftalikSokratikSayisi: consumeCount,
              aylikSokratikSayisi: consumeCount,
              ekstraSokratikKredi: -consumeCount
            }
          }).catch(() => {});
        }
        userDoc.gunlukAiMesajSayisi = dailyUsed + consumeCount;
        userDoc.gunlukSokratikSayisi = dailyUsed + consumeCount;
        userDoc.haftalikSokratikSayisi = weeklyUsed + consumeCount;
        userDoc.aylikSokratikSayisi = monthlyUsed + consumeCount;
        userDoc.ekstraSokratikKredi = sokratikBonus - consumeCount;
        return { allowed: true, bonusKullanildi: true, kalanSokratikBonus: sokratikBonus - consumeCount };
      }

      return {
        allowed: false,
        status: 429,
        error: 'QUOTA_EXCEEDED',
        message: `Aylık Sokratik AI Mentör hakkınız (${monthlyLimit} soru) doldu. Bir sonraki ay yenilenecektir veya paketinizi yükselterek devam edebilirsiniz.`,
        limit: monthlyLimit,
        kullanilan: monthlyUsed,
        periyot: 'aylik'
      };
    }

    // 1b) Ücretsiz öğrenci haftalık sınır kontrolü (haftada 3 hak)
    if (weeklyLimit !== null && weeklyUsed + consumeCount > weeklyLimit) {
      return {
        allowed: false,
        status: 429,
        error: 'QUOTA_EXCEEDED',
        message: `Ücretsiz planda haftalık Sokratik AI Mentör hakkınız (${weeklyLimit} hak/hafta, ${monthlyLimit} hak/ay) doldu. Yeni haftada yenilenir veya üyeliğini yükselterek hemen devam edebilirsin.`,
        limit: weeklyLimit,
        kullanilan: weeklyUsed,
        periyot: 'haftalik'
      };
    }

    // 2) Günlük sınır kontrolü
    if (dailyUsed + consumeCount <= dailyLimit) {
      if (hasDb) {
        await User.updateOne(
          { _id: userDoc._id },
          {
            $inc: {
              gunlukAiMesajSayisi: consumeCount,
              gunlukSokratikSayisi: consumeCount,
              haftalikSokratikSayisi: consumeCount,
              aylikSokratikSayisi: consumeCount
            }
          }
        ).catch(() => {});
      }
      userDoc.gunlukAiMesajSayisi = dailyUsed + consumeCount;
      userDoc.gunlukSokratikSayisi = dailyUsed + consumeCount;
      userDoc.haftalikSokratikSayisi = weeklyUsed + consumeCount;
      userDoc.aylikSokratikSayisi = monthlyUsed + consumeCount;
      return {
        allowed: true,
        kalanGunluk: dailyLimit - (dailyUsed + consumeCount),
        kalanHaftalik: weeklyLimit !== null ? Math.max(0, weeklyLimit - (weeklyUsed + consumeCount)) : null,
        kalanAylik: monthlyLimit - (monthlyUsed + consumeCount)
      };
    }

    // Günlük limit dolmuşsa bonus kredi kontrol et
    const bonus = userDoc.ekstraBonusKredi || 0;
    if (bonus >= consumeCount) {
      if (hasDb) {
        await User.updateOne(
          { _id: userDoc._id },
          {
            $inc: {
              gunlukAiMesajSayisi: consumeCount,
              gunlukSokratikSayisi: consumeCount,
              aylikSokratikSayisi: consumeCount,
              ekstraBonusKredi: -consumeCount
            }
          }
        ).catch(() => {});
      }
      userDoc.gunlukAiMesajSayisi = dailyUsed + consumeCount;
      userDoc.gunlukSokratikSayisi = dailyUsed + consumeCount;
      userDoc.aylikSokratikSayisi = monthlyUsed + consumeCount;
      userDoc.ekstraBonusKredi = bonus - consumeCount;
      return { allowed: true, bonusKullanildi: true, kalanBonus: bonus - consumeCount };
    }

    return {
      allowed: false,
      status: 429,
      error: 'QUOTA_EXCEEDED',
      message: userDoc.role === 'teacher'
        ? `Günlük AI mesaj hakkınız (${dailyLimit} mesaj) doldu. Yetkinizi yükseltmek için okul yöneticinize başvurabilirsiniz.`
        : `Bugünkü Sokratik AI hakkınız (${dailyLimit} soru) doldu. Yarın yeniden yüklenecektir veya paketinizi yükselterek günlük limitinizi artırabilirsiniz.`,
      limit: dailyLimit,
      kullanilan: dailyUsed,
      periyot: 'gunluk'
    };
  }

  // C) Soru Üretim Kontrolü (Öğretmen ve Öğrenci)
  if (islemTuru === 'question') {
    const dailyLimit = getEffectiveQuestionLimit(userDoc);
    const monthlyLimit = getEffectiveMonthlyQuestionLimit(userDoc);

    const dailyUsed = userDoc.gunlukSoruUretimSayisi || 0;
    const monthlyUsed = userDoc.aylikSoruUretimSayisi || 0;

    // 1) Aylık sınır kontrolü (Öğretmenler için aylık maks 200 soru kotası)
    if (monthlyUsed + consumeCount > monthlyLimit) {
      return {
        allowed: false,
        status: 429,
        error: 'QUOTA_EXCEEDED',
        message: userDoc.role === 'teacher'
          ? `Aylık soru üretim kotanız (${monthlyLimit} soru) doldu. Veritabanındaki zengin hazır soru kütüphanesinden sınırsız soru seçip test oluşturmaya devam edebilirsiniz.`
          : 'Aylık yeni soru üretim limitiniz doldu. Hazır soru havuzundan soru çözmeye devam edebilirsiniz.',
        limit: monthlyLimit,
        kullanilan: monthlyUsed,
        periyot: 'aylik'
      };
    }

    // 2) Günlük sınır kontrolü
    if (dailyUsed + consumeCount <= dailyLimit) {
      if (hasDb) {
        await User.updateOne(
          { _id: userDoc._id },
          {
            $inc: {
              gunlukSoruUretimSayisi: consumeCount,
              aylikSoruUretimSayisi: consumeCount
            }
          }
        ).catch(() => {});
      }
      userDoc.gunlukSoruUretimSayisi = dailyUsed + consumeCount;
      userDoc.aylikSoruUretimSayisi = monthlyUsed + consumeCount;
      return {
        allowed: true,
        kalanGunluk: dailyLimit - (dailyUsed + consumeCount),
        kalanAylik: monthlyLimit - (monthlyUsed + consumeCount)
      };
    }

    return {
      allowed: false,
      status: 429,
      error: 'QUOTA_EXCEEDED',
      message: userDoc.role === 'teacher'
        ? `Günlük yeni soru üretim kotanız (${dailyLimit} soru) doldu. Hazır soru havuzundan sınırsız soru seçebilir veya kota artırımı için yöneticiyle iletişime geçebilirsiniz.`
        : 'Günlük yeni soru üretim limitiniz doldu. Hazır soru havuzundan soru çözmeye devam edebilirsiniz.',
      limit: dailyLimit,
      kullanilan: dailyUsed,
      periyot: 'gunluk'
    };
  }

  return { allowed: true };
}

/**
 * Kullanıcının mevcut kota durumunu detaylı olarak döndürür.
 */
function getQuotaStatus(user) {
  if (!user) {
    return {
      rol: 'misafir',
      paketTipi: 'free',
      etkinLimit: 3,
      kullanilan: 0,
      kalan: 3,
      ekstraBonusKredi: 0,
      aiErisimEngelli: false
    };
  }

  resetIfNewDay(user);
  resetIfNewWeek(user);
  resetIfNewMonth(user);

  const planKey = resolveUserPlan(user);
  const etkinMesajLimiti = getEffectiveMessageLimit(user);
  const etkinAylikSokratik = getEffectiveMonthlySokratikLimit(user);
  const etkinOgretmenIkizi = getEffectiveMonthlyOgretmenIkiziLimit(user);
  const etkinSoruLimiti = getEffectiveQuestionLimit(user);
  const etkinAylikSoruLimiti = getEffectiveMonthlyQuestionLimit(user);

  const isSinirsiz = user.role === 'admin';
  const isFreeStudent = user.role === 'student' && planKey === 'free';
  const haftalikLimit = isFreeStudent ? (PAKET_LIMITLERI.free.weeklySokratik || 3) : null;
  const haftalikKullanilan = user.haftalikSokratikSayisi || 0;
  const haftalikKalan = haftalikLimit !== null ? Math.max(0, haftalikLimit - haftalikKullanilan) : null;
  const gunlukKalan = isSinirsiz ? Infinity : Math.max(0, etkinMesajLimiti - (user.gunlukSokratikSayisi || user.gunlukAiMesajSayisi || 0));
  const aylikKalan = isSinirsiz ? Infinity : Math.max(0, etkinAylikSokratik - (user.aylikSokratikSayisi || 0));
  const ikizKalan = isSinirsiz ? Infinity : Math.max(0, etkinOgretmenIkizi - (user.aylikOgretmenIkiziSayisi || 0));

  return {
    rol: user.role,
    ogretmenTipi: user.role === 'teacher' ? (user.ogretmenTipi || 'standart_ogretmen') : undefined,
    basvuruDurumu: user.basvuruDurumu || (user.role === 'teacher' ? 'inceleme_suruyor' : 'onaylandi'),
    paketTipi: planKey,
    sinirsiz: isSinirsiz,
    proModelIzni: canUserUseProModel(user),
    sokratik: {
      gunlukLimit: etkinMesajLimiti,
      gunlukKullanilan: user.gunlukSokratikSayisi || user.gunlukAiMesajSayisi || 0,
      gunlukKalan,
      haftalikLimit,
      haftalikKullanilan,
      haftalikKalan,
      aylikLimit: etkinAylikSokratik,
      aylikKullanilan: user.aylikSokratikSayisi || 0,
      aylikKalan
    },
    ogretmenIkizi: {
      aylikLimit: etkinOgretmenIkizi,
      aylikKullanilan: user.aylikOgretmenIkiziSayisi || 0,
      aylikKalan: ikizKalan
    },
    assistants: {
      ai_mentor: {
        locked: false,
        periodMode: isFreeStudent ? 'weekly_monthly' : 'daily_monthly'
      },
      ogretmen_ikizi: {
        locked: isFreeStudent || (!isSinirsiz && etkinOgretmenIkizi <= 0)
      },
      soru_cozum: {
        locked: isFreeStudent
      },
      ai_koc: {
        locked: isFreeStudent
      }
    },
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
      aylikLimit: etkinAylikSoruLimiti,
      aylikKullanilan: user.aylikSoruUretimSayisi || 0,
      aylikKalan: isSinirsiz ? Infinity : Math.max(0, etkinAylikSoruLimiti - (user.aylikSoruUretimSayisi || 0)),
      ozelLimitMi: typeof user.ozelGunlukSoruLimiti === 'number'
    },
    ekstraBonusKredi: user.ekstraBonusKredi || 0,
    toplamHarcananToken: user.toplamHarcananToken || 0,
    toplamMaliyetTL: user.toplamMaliyetTL || 0,
    aiErisimEngelli: Boolean(user.aiErisimEngelli),
    seriGunSayisi: user.seriGunSayisi || 0,
    seriKorumaKalkani: Boolean(user.seriKorumaKalkani),
    kazanilanRozetler: user.kazanilanRozetler || [],
    kayitliSinif: user.kayitliSinif || 8,
    name: user.name || 'Öğrenci',
    email: user.email || ''
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

      // İstek gövdesinde seçili AI asistan rolüne göre dinamik işlem türü belirle
      let targetIslemTuru = islemTuru;
      const reqAiRole = req.body?.gorevTuru || req.body?.aiRole || req.body?.role;
      if (reqAiRole === 'ogretmen_ikizi') {
        targetIslemTuru = 'ogretmen_ikizi';
      } else if (reqAiRole === 'soru_cozum') {
        targetIslemTuru = 'soru_cozum';
      } else if (reqAiRole === 'ai_koc') {
        targetIslemTuru = 'ai_koc';
      }

      const result = await checkAndConsumeQuota(freshUser, targetIslemTuru, 1);
      if (!result.allowed) {
        return res.status(result.status || 429).json({
          error: result.error || 'QUOTA_EXCEEDED',
          mesaj: result.message,
          message: result.message,
          limit: result.limit,
          kullanilan: result.kullanilan,
          periyot: result.periyot
        });
      }

      req.session.user.gunlukAiMesajSayisi = freshUser.gunlukAiMesajSayisi;
      req.session.user.gunlukSokratikSayisi = freshUser.gunlukSokratikSayisi;
      req.session.user.aylikSokratikSayisi = freshUser.aylikSokratikSayisi;
      req.session.user.aylikOgretmenIkiziSayisi = freshUser.aylikOgretmenIkiziSayisi;
      req.session.user.gunlukSoruUretimSayisi = freshUser.gunlukSoruUretimSayisi;
      req.session.user.aylikSoruUretimSayisi = freshUser.aylikSoruUretimSayisi;
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
  resolveUserPlan,
  resetIfNewDay,
  resetIfNewMonth,
  getEffectiveMessageLimit,
  getEffectiveMonthlySokratikLimit,
  getEffectiveMonthlyOgretmenIkiziLimit,
  getEffectiveQuestionLimit,
  getEffectiveMonthlyQuestionLimit,
  canUserUseProModel,
  checkAndConsumeQuota,
  getQuotaStatus,
  aiQuotaMiddleware
};
