// Kullanım:  npm run test-hazirla            (public/images/sorular içindeki yeni resimleri MongoDB'ye ekler)
//            npm run test-hazirla -- --kuru  (veritabanına yazmadan ne ekleneceğini gösterir)
const fs = require('fs');
const path = require('path');
for (const file of ['.env', 'baglanti_adresi.env']) {
  const envPath = path.join(__dirname, '..', file);
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath, quiet: true });
}
const mongoose = require('mongoose');
const { sorulariSenkronla, RESIM_KLASORU } = require('../lib/soru-senkron');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI tanımlı değil.');
  const kuru = process.argv.includes('--kuru');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_ADI || 'etut_merkezi' });
  console.log(`📂 Taranan klasör: ${RESIM_KLASORU}`);
  console.log(`🗄️  Veritabanı: ${mongoose.connection.name}${kuru ? ' (kuru çalıştırma, yazılmayacak)' : ''}`);

  const sonuc = await sorulariSenkronla({ kuru });
  if (!sonuc.toplam) {
    console.log('⚠️  Klasörde .png/.jpg/.jpeg/.webp resim bulunamadı.');
    return;
  }
  sonuc.eklenen.forEach(dosya => console.log(`  ${kuru ? '+ eklenecek' : '✅ eklendi'}: ${dosya}`));
  sonuc.atlanan.forEach(dosya => console.log(`  ⏭️  zaten kayıtlı: ${dosya}`));
  console.log(`Özet: ${sonuc.toplam} resim, ${sonuc.eklenen.length} yeni, ${sonuc.atlanan.length} mevcut.`);
}

main()
  .catch(error => {
    console.error('❌', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
