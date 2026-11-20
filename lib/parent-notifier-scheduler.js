const nodemailer = require('nodemailer');
const { createSmsService } = require('./sms-service');
const { resolveUserPlan } = require('../middleware/aiQuota');

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
 * Haftalık Veli Öğrenme Karnesi HTML Şablonu
 */
function buildWeeklyReportHtml({ studentName, weekLabel, completedAssignments, averageSuccess, criticalGaps, aiMentorSummary }) {
  const gapsListHtml = (criticalGaps && criticalGaps.length > 0)
    ? criticalGaps.map(g => `<li style="padding:6px 0; color:#854d0e;">⚠️ <strong>${g.title || g.topic || 'Kazanım'}</strong> - Başarı: %${g.success_percent || g.score || 0}</li>`).join('')
    : '<li style="color:#15803d;">🎉 Bu hafta tespit edilen kritik kazanım eksiği bulunmuyor. Harika ilerleme!</li>';

  return `
  <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; max-width:600px; margin:0 auto; background:#fdfbf7; border:1px solid #e7ded3; border-radius:14px; overflow:hidden;">
    <div style="background:#7a4f2d; color:#ffffff; padding:24px; text-align:center;">
      <h1 style="margin:0; font-size:22px; font-weight:700;">ZarifÇözüm · Haftalık Veli Karnesi</h1>
      <p style="margin:6px 0 0; font-size:14px; opacity:0.9;">${studentName} için Haftalık Matematik Gelişim Raporu</p>
    </div>
    <div style="padding:24px;">
      <p style="font-size:14px; color:#57483d; margin-top:0;">Sayın Velimiz, öğrencimizin <strong>${weekLabel}</strong> dönemindeki çalışma performansı aşağıda özetlenmiştir:</p>
      
      <div style="display:flex; gap:12px; margin:20px 0;">
        <div style="flex:1; background:#ffffff; border:1px solid #e7ded3; border-radius:10px; padding:14px; text-align:center;">
          <span style="font-size:12px; color:#8a7768; display:block;">Tamamlanan Ödev</span>
          <strong style="font-size:24px; color:#3b2d22;">${completedAssignments}</strong>
        </div>
        <div style="flex:1; background:#ffffff; border:1px solid #e7ded3; border-radius:10px; padding:14px; text-align:center;">
          <span style="font-size:12px; color:#8a7768; display:block;">Ortalama Başarı</span>
          <strong style="font-size:24px; color:#7a4f2d;">%${averageSuccess}</strong>
        </div>
      </div>

      <h3 style="font-size:15px; color:#3b2d22; border-bottom:1px solid #e7ded3; padding-bottom:6px;">Öncelikli Gelişim Alanları (Kazanımlar)</h3>
      <ul style="padding-left:18px; margin:10px 0 20px; font-size:13px;">
        ${gapsListHtml}
      </ul>

      ${aiMentorSummary ? `
      <div style="background:#f3e8dc; border-left:4px solid #7a4f2d; padding:12px 16px; border-radius:6px; margin:18px 0; font-size:13px; color:#4a3525;">
        <strong>🤖 AI Sokratik Mentör Değerlendirmesi:</strong><br>
        ${aiMentorSummary}
      </div>` : ''}

      <div style="text-align:center; margin-top:28px;">
        <a href="https://zarifcozum.com/veli-panel.html" style="background:#7a4f2d; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px; display:inline-block;">Veli Panelini İncele</a>
      </div>
    </div>
    <div style="background:#f4ece2; padding:14px; text-align:center; font-size:12px; color:#8a7768;">
      ZarifÇözüm Online Matematik Eğitim Platformu
    </div>
  </div>
  `;
}

/**
 * Tek bir veli için haftalık bildirimleri gönderir.
 */
async function sendWeeklyReportToParent({ parent, student, reportData, smsService = createSmsService() }) {
  const plan = resolveUserPlan(student);
  const results = { emailSent: false, smsSent: false };

  // Temel pakette otomatik veli bildirimi kapalıdır (yalnızca web panel)
  if (plan === 'free' || plan === 'temel') {
    return { skipped: true, reason: 'Temel pakette otomatik haftalık bildirim bulunmaz; web veli paneli aktiftir.' };
  }

  const studentName = student.name || 'Öğrenciniz';
  const mailer = createMailTransport();

  // 1. E-Posta Karnesi (Standart ve VIP Paketler)
  if (parent.email && mailer) {
    try {
      const html = buildWeeklyReportHtml({
        studentName,
        weekLabel: reportData.weekLabel || 'Bu Hafta',
        completedAssignments: reportData.completedAssignments || 0,
        averageSuccess: reportData.averageSuccess || 0,
        criticalGaps: reportData.criticalGaps || [],
        aiMentorSummary: reportData.aiMentorSummary || null
      });

      await mailer.transport.sendMail({
        from: mailer.from,
        to: parent.email,
        subject: `📊 ${studentName} - Haftalık Matematik Öğrenme Karnesi (ZarifÇözüm)`,
        html
      });
      results.emailSent = true;
    } catch (err) {
      console.warn('Veli e-posta gönderim hatası:', err.message);
    }
  }

  // 2. SMS Bildirimi (Yalnızca VIP Paket)
  if (plan === 'vip' && parent.phone) {
    try {
      const smsMessage = `ZarifCozum: ${studentName} bu hafta ${reportData.completedAssignments || 0} odev tamamladi. Ortalama basari: %${reportData.averageSuccess || 0}. Detayli karne: zarifcozum.com/veli-panel.html`;
      const smsRes = await smsService.sendSms({
        phone: parent.phone,
        message: smsMessage
      });
      results.smsSent = smsRes.success;
    } catch (err) {
      console.warn('Veli SMS gönderim hatası:', err.message);
    }
  }

  return results;
}

module.exports = {
  createMailTransport,
  buildWeeklyReportHtml,
  sendWeeklyReportToParent
};
