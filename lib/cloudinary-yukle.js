const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');

const KLASOR = 'zarifcozum/sorular';

function yapilandirildi() {
  return Boolean(process.env.CLOUDINARY_URL);
}

// cloudinary SDK, CLOUDINARY_URL (cloudinary://key:secret@cloud) değişkenini kendisi okur.
function yapilandir() {
  return cloudinary.config({ secure: true });
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
