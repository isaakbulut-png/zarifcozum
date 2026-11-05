const axios = require('axios');

const TOKEN_URL = 'https://zoom.us/oauth/token';
const API_URL = 'https://api.zoom.us/v2';

let tokenOnbellegi = null;

function yapilandirildi() {
  return Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET && process.env.ZOOM_HOST_USER_ID);
}

// Server-to-Server OAuth: token ~1 saat geçerlidir, süresi dolmadan yeniden kullanılır.
async function getZoomAccessToken() {
  if (tokenOnbellegi && tokenOnbellegi.bitis > Date.now() + 60_000) return tokenOnbellegi.token;
  if (!yapilandirildi()) throw new Error('Zoom ayarları eksik: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET ve ZOOM_HOST_USER_ID doldurulmalı.');

  const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const { data } = await axios.post(TOKEN_URL, null, {
    params: { grant_type: 'account_credentials', account_id: process.env.ZOOM_ACCOUNT_ID },
    headers: { Authorization: `Basic ${basic}` },
    timeout: 15000
  });
  tokenOnbellegi = { token: data.access_token, bitis: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return tokenOnbellegi.token;
}

/**
 * Yeni bir canlı ders toplantısı oluşturur.
 * @param {{topic?: string, startTime?: string|Date, duration?: number, agenda?: string}} secenekler
 * @returns {Promise<{id: number, topic: string, startTime: string, duration: number, joinUrl: string, startUrl: string, password: string}>}
 */
async function createZoomMeeting({ topic = 'Zarif Çözüm Canlı Ders', startTime, duration = 60, agenda = '' } = {}) {
  const token = await getZoomAccessToken();
  const planli = startTime ? new Date(startTime) : null;
  if (planli && Number.isNaN(planli.getTime())) throw new Error('Geçersiz başlangıç zamanı.');

  const govde = {
    topic: String(topic).slice(0, 200),
    type: planli ? 2 : 1,
    duration: Math.min(Math.max(Number(duration) || 60, 5), 300),
    timezone: 'Europe/Istanbul',
    agenda: String(agenda).slice(0, 2000),
    settings: { join_before_host: false, waiting_room: true, mute_upon_entry: true }
  };
  if (planli) govde.start_time = planli.toISOString().replace(/\.\d{3}Z$/, 'Z');

  try {
    const { data } = await axios.post(
      `${API_URL}/users/${encodeURIComponent(process.env.ZOOM_HOST_USER_ID)}/meetings`,
      govde,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );
    return {
      id: data.id,
      topic: data.topic,
      startTime: data.start_time,
      duration: data.duration,
      joinUrl: data.join_url,
      startUrl: data.start_url,
      password: data.password
    };
  } catch (error) {
    if (error.response?.status === 401) tokenOnbellegi = null;
    const detay = error.response?.data?.message || error.message;
    throw new Error(`Zoom toplantısı oluşturulamadı: ${detay}`);
  }
}

module.exports = { yapilandirildi, getZoomAccessToken, createZoomMeeting };
