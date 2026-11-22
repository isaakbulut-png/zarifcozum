const nodemailer = require('nodemailer');

/**
 * SMTP Mail Taşımacısını Oluşturur
 */
function createMailTransport() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASSWORD || '');
  const from = String(process.env.SMTP_FROM || 'bildirim@zarifcozum.com').trim();

  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 587);

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

/**
 * Başvuru Onay E-postası HTML Şablonu
 */
function getApprovedEmailHtml({ name, teacherType, siteUrl }) {
  const typeLabel = teacherType === 'icerik_ureticisi'
    ? 'İçerik Üreticisi (⭐ Sınırsız AI Soru Sihirbazı & Havuz Yetkisi)'
    : 'Onaylı Öğretmen (Günlük 15 AI Soru & 40 Mesaj Yetkisi)';

  const loginUrl = `${siteUrl}/kayit-giris.html?mode=login&role=teacher`;

  return `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="utf-8">
    <title>Öğretmen Başvurunuz Onaylandı</title>
  </head>
  <body style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background-color:#fbf1e8; margin:0; padding:24px; color:#3a2618;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff; border-radius:18px; border:1px solid #ebd3bd; overflow:hidden; box-shadow:0 12px 36px rgba(58,38,24,0.08);">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg, #2c1a0e, #3a2618); padding:32px 24px; text-align:center;">
          <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:-0.02em;">ZarifÇözüm</h1>
          <p style="color:#ebd8c8; margin:6px 0 0; font-size:13px;">MEB Maarif Modeli Matematik Platformu</p>
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="display:inline-block; background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-size:12px; font-weight:700; padding:4px 12px; border-radius:999px; margin-bottom:16px;">
            ✅ Başvuru Onaylandı
          </div>

          <h2 style="color:#2c1a0e; font-size:20px; font-weight:700; margin:0 0 16px;">Tebrikler Sayın ${name},</h2>

          <p style="font-size:15px; line-height:1.6; color:#523520; margin:0 0 16px;">
            ZarifÇözüm platformuna yapmış olduğunuz öğretmenlik başvurusu ve doğrulama belgeleriniz incelenmiş olup <strong>onaylanmıştır</strong>.
          </p>

          <div style="background:#fefbf7; border-left:4px solid #c2570c; padding:14px 18px; border-radius:8px; margin:0 0 24px;">
            <p style="margin:0; font-size:14px; color:#523520;">
              <strong>Atanan Yetki Düzeyi:</strong><br>
              <span style="color:#c2570c; font-weight:600;">${typeLabel}</span>
            </p>
          </div>

          <p style="font-size:14px; line-height:1.6; color:#523520; margin:0 0 24px;">
            Artık Öğretmen Panelinize giriş yaparak Türkiye Yüzyılı Maarif Modeli standartlarında yapay zekâ destekli soru hazırlayabilir, içerik havuzuna katkı sağlayabilir ve öğrencilerinize özel çalışmalar tanımlayabilirsiniz.
          </p>

          <!-- CTA Button -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <a href="${loginUrl}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #c2570c, #952719); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:13px 32px; border-radius:10px; box-shadow:0 4px 14px rgba(194,87,12,0.3);">
                  Öğretmen Paneline Giriş Yap →
                </a>
              </td>
            </tr>
          </table>

          <p style="font-size:12px; color:#8c7e72; line-height:1.5; margin:0; border-top:1px solid #f3e1cf; padding-top:16px;">
            Eğer bu başvuruyu siz yapmadıysanız lütfen bu e-postayı dikkate almayınız veya doğrudan bizimle iletişime geçiniz.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#fbf1e8; padding:18px 24px; text-align:center; font-size:12px; color:#6a5242; border-top:1px solid #ebd3bd;">
          © ${new Date().getFullYear()} ZarifÇözüm Eğitim Teknolojileri · Tüm hakları saklıdır.
        </td>
      </tr>
    </table>
  </body>
  </html>
  `.trim();
}

/**
 * Başvuru Reddedildi E-postası HTML Şablonu
 */
function getRejectedEmailHtml({ name, siteUrl }) {
  const contactUrl = `${siteUrl}/#iletisim`;

  return `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="utf-8">
    <title>Öğretmen Başvuru Bilgilendirmesi</title>
  </head>
  <body style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background-color:#fbf1e8; margin:0; padding:24px; color:#3a2618;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff; border-radius:18px; border:1px solid #ebd3bd; overflow:hidden; box-shadow:0 12px 36px rgba(58,38,24,0.08);">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg, #2c1a0e, #3a2618); padding:32px 24px; text-align:center;">
          <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:-0.02em;">ZarifÇözüm</h1>
          <p style="color:#ebd8c8; margin:6px 0 0; font-size:13px;">MEB Maarif Modeli Matematik Platformu</p>
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="display:inline-block; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-size:12px; font-weight:700; padding:4px 12px; border-radius:999px; margin-bottom:16px;">
            İnceleme Sonucu
          </div>

          <h2 style="color:#2c1a0e; font-size:20px; font-weight:700; margin:0 0 16px;">Sayın ${name},</h2>

          <p style="font-size:15px; line-height:1.6; color:#523520; margin:0 0 16px;">
            ZarifÇözüm platformuna iletmiş olduğunuz öğretmenlik başvurunuz yönetim ekibimiz tarafından değerlendirilmiştir.
          </p>

          <p style="font-size:14px; line-height:1.6; color:#523520; margin:0 0 20px;">
            Yüklenen doğrulama belgesinin okunamaması, eksik olması veya platform başvuru kriterlerine uyum sağlayamaması nedeniyle başvurunuz şu aşamada <strong>onaylanamamıştır</strong>.
          </p>

          <div style="background:#fefbf7; border-left:4px solid #b91c1c; padding:14px 18px; border-radius:8px; margin:0 0 24px;">
            <p style="margin:0; font-size:13px; color:#523520; line-height:1.5;">
              Belgenizi güncelleyerek yeniden başvuruda bulunmak veya başvuru detayları hakkında bilgi almak için destek ekibimizle iletişime geçebilirsiniz.
            </p>
          </div>

          <!-- Contact Link -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <a href="${contactUrl}" target="_blank" style="display:inline-block; background:#f4ebe1; color:#78350f; border:1px solid #e7ded3; font-size:14px; font-weight:700; text-decoration:none; padding:11px 24px; border-radius:8px;">
                  Destek Ekibine Ulaşın
                </a>
              </td>
            </tr>
          </table>

          <p style="font-size:12px; color:#8c7e72; line-height:1.5; margin:0; border-top:1px solid #f3e1cf; padding-top:16px;">
            İlginiz için teşekkür eder, çalışmalarınızda başarılar dileriz.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#fbf1e8; padding:18px 24px; text-align:center; font-size:12px; color:#6a5242; border-top:1px solid #ebd3bd;">
          © ${new Date().getFullYear()} ZarifÇözüm Eğitim Teknolojileri · Tüm hakları saklıdır.
        </td>
      </tr>
    </table>
  </body>
  </html>
  `.trim();
}

/**
 * Öğretmen Başvuru Durum Bilgilendirme E-postası Gönderir
 * @param {Object} params
 * @param {string} params.email - Öğretmenin e-posta adresi
 * @param {string} params.name - Öğretmenin adı
 * @param {string} params.status - 'onaylandi' | 'reddedildi'
 * @param {string} [params.teacherType] - 'icerik_ureticisi' | 'onayli_ogretmen' | 'standart_ogretmen'
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendTeacherStatusEmail({ email, name, status, teacherType }) {
  if (!email || !status) {
    return { sent: false, reason: 'missing_parameters' };
  }

  const mailer = createMailTransport();
  if (!mailer) {
    console.warn(`[TeacherMailNotifier] SMTP yapılandırılmamış. "${name}" (${email}) için "${status}" e-postası gönderilemedi.`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const siteUrl = String(process.env.APP_URL || process.env.SITE_URL || 'https://zarifcozum.com').replace(/\/$/, '');
  const isApproved = status === 'onaylandi';

  const subject = isApproved
    ? 'ZarifÇözüm · Öğretmenlik Başvurunuz Onaylandı! 🎉'
    : 'ZarifÇözüm · Öğretmenlik Başvuru Durumunuz';

  const html = isApproved
    ? getApprovedEmailHtml({ name, teacherType, siteUrl })
    : getRejectedEmailHtml({ name, siteUrl });

  const text = isApproved
    ? `Sayın ${name},\n\nZarifÇözüm öğretmenlik başvurunuz onaylanmıştır. Öğretmen panelinize giriş yaparak içerik ve soru hazırlamaya hemen başlayabilirsiniz: ${siteUrl}/kayit-giris.html?mode=login&role=teacher`
    : `Sayın ${name},\n\nZarifÇözüm öğretmenlik başvurunuz değerlendirilmiş olup şu aşamada onaylanamamıştır. Detaylı bilgi için destek ekibimizle iletişime geçebilirsiniz.`;

  try {
    await mailer.transport.sendMail({
      from: `"ZarifÇözüm Bildirim" <${mailer.from}>`,
      to: email,
      subject,
      text,
      html
    });

    console.log(`[TeacherMailNotifier] "${name}" (${email}) adresine "${status}" bildirim e-postası başarıyla gönderildi.`);
    return { sent: true };
  } catch (error) {
    console.error(`[TeacherMailNotifier] E-posta gönderim hatası (${email}):`, error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = {
  createMailTransport,
  sendTeacherStatusEmail
};
