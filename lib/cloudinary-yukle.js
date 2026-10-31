const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');

const KLASOR = 'zarifcozum/sorular';

function yapilandirildi() {
  return Boolean(process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
}

function yapilandir() {
  if (process.env.CLOUDINARY_URL) return cloudinary.config({ secure: true });
  return cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

// Aynı görsel içeriği her zaman aynı public_id'yi üretir; böylece aynı resim iki kez yüklenmez.
function icerikKimligi(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24);
}

function cloudinaryaYukle(buffer, publicId) {
  yapilandir();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: KLASOR, public_id: publicId, resource_type: 'image', overwrite: false },
      (error, sonuc) => (error ? reject(error) : resolve({ url: sonuc.secure_url, publicId: sonuc.public_id }))
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinaryaYukle, icerikKimligi, yapilandirildi, KLASOR };
