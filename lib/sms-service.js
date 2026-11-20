/**
 * SMS Servisi (VIP Paket Velileri için Haftalık Karne ve Acil Bildirimler)
 */

function createSmsService({ fetchImpl = globalThis.fetch } = {}) {
  const user = String(process.env.SMS_USER || '').trim();
  const password = String(process.env.SMS_PASSWORD || '');
  const header = String(process.env.SMS_HEADER || 'ZARIFCOZUM').trim();
  const isEnabled = Boolean(user && password);

  async function sendSms({ phone, message }) {
    if (!phone || !message) {
      throw new Error('Telefon numarası ve mesaj metni gereklidir.');
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!/^0?5\d{9}$/.test(cleanPhone)) {
      throw new Error('Geçersiz telefon formatı. 05xx xxx xx xx olmalıdır.');
    }

    if (!isEnabled) {
      // Test / Geliştirme ortamı için simülasyon logu
      return {
        success: true,
        mock: true,
        phone: cleanPhone,
        message,
        info: 'SMS_USER ve SMS_PASSWORD tanımlı olmadığından SMS gönderimi simüle edildi.'
      };
    }

    // Netgsm REST API Entegrasyonu
    try {
      const response = await fetchImpl('https://api.netgsm.com.tr/sms/send/rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usercode: user,
          password: password,
          gsmno: cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone,
          message: message,
          msgheader: header
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await response.json().catch(() => ({}));
      return {
        success: response.ok,
        status: response.status,
        data
      };
    } catch (err) {
      console.warn('SMS gönderimi başarısız:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  return { sendSms, isEnabled };
}

module.exports = { createSmsService };
