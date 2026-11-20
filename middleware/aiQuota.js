const User = require('../models/User');

// Öğrenci Paket Varsayılan Limitleri (Hedeflenen 3 Yıllık Paket Mimarisi)
const PAKET_LIMITLERI = {
  free: {
    dailySokratik: 3,
    monthlySokratik: 15,
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
  if ((dayReset || monthReset) && userDoc._id && require('mongoose').connection?.readyState === 1) {
    const updateFields = {};
    if (dayReset) {
      updateFields.gunlukAiMesajSayisi = 0;
      updateFields.gunlukSokratikSayisi = 0;
      updateFields.gunlukSoruUretimSayisi = 0;
      updateFields.sonKotaSifirlamaTarihi = userDoc.sonKotaSifirlamaTarihi;
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

  // 4. İŞLEM TÜRÜ DENETİMLERİ

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
  if (islemTuru === 'message' || islemTuru === 'sokratik') {
    const dailyLimit = getEffectiveMessageLimit(userDoc);
    const monthlyLimit = getEffectiveMonthlySokratikLimit(userDoc);

    const dailyUsed = userDoc.gunlukSokratikSayisi || userDoc.gunlukAiMesajSayisi || 0;
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
              aylikSokratikSayisi: consumeCount,
              ekstraSokratikKredi: -consumeCount
            }
          }).catch(() => {});
        }
        userDoc.gunlukAiMesajSayisi = dailyUsed + consumeCount;
        userDoc.gunlukSokratikSayisi = dailyUsed + consumeCount;
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

    // 2) Günlük sınır kontrolü
    if (dailyUsed + consumeCount <= dailyLimit) {
      if (hasDb) {
        await User.updateOne(
          { _id: userDoc._id },
          {
            $inc: {
              gunlukAiMesajSayisi: consumeCount,
              gunlukSokratikSayisi: consumeCount,
              aylikSokratikSayisi: consumeCount
            }
          }
        ).catch(() => {});
      }
      userDoc.gunlukAiMesajSayisi = dailyUsed + consumeCount;
      userDoc.gunlukSokratikSayisi = dailyUsed + consumeCount;
      userDoc.aylikSokratikSayisi = monthlyUsed + consumeCount;
      return {
        allowed: true,
        kalanGunluk: dailyLimit - (dailyUsed + consumeCount),
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
  resetIfNewMonth(user);

  const planKey = resolveUserPlan(user);
  const etkinMesajLimiti = getEffectiveMessageLimit(user);
  const etkinAylikSokratik = getEffectiveMonthlySokratikLimit(user);
  const etkinOgretmenIkizi = getEffectiveMonthlyOgretmenIkiziLimit(user);
  const etkinSoruLimiti = getEffectiveQuestionLimit(user);
  const etkinAylikSoruLimiti = getEffectiveMonthlyQuestionLimit(user);

  const isSinirsiz = user.role === 'admin';

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
      gunlukKalan: isSinirsiz ? Infinity : Math.max(0, etkinMesajLimiti - (user.gunlukSokratikSayisi || user.gunlukAiMesajSayisi || 0)),
      aylikLimit: etkinAylikSokratik,
      aylikKullanilan: user.aylikSokratikSayisi || 0,
      aylikKalan: isSinirsiz ? Infinity : Math.max(0, etkinAylikSokratik - (user.aylikSokratikSayisi || 0))
    },
    ogretmenIkizi: {
      aylikLimit: etkinOgretmenIkizi,
      aylikKullanilan: user.aylikOgretmenIkiziSayisi || 0,
      aylikKalan: isSinirsiz ? Infinity : Math.max(0, etkinOgretmenIkizi - (user.aylikOgretmenIkiziSayisi || 0))
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

      // İstek gövdesinde aiRole (ör. ogretmen_ikizi) belirtilmişse dinamik işlem türü seç
      let targetIslemTuru = islemTuru;
      if (req.body?.role === 'ogretmen_ikizi' || req.body?.aiRole === 'ogretmen_ikizi' || req.body?.gorevTuru === 'ogretmen_ikizi') {
        targetIslemTuru = 'ogretmen_ikizi';
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
