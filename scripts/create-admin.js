// Kullanım (PowerShell):
//   $env:ADMIN_EMAIL="ben@ornek.com"; $env:ADMIN_NAME="Yönetici"; $env:ADMIN_PASSWORD="en az 10 karakterlik şifre"; npm run admin:create
// Hesap zaten varsa rolü 'admin' yapılır ve şifresi güncellenir.
const fs = require('fs');
const path = require('path');
for (const file of ['.env', 'baglanti_adresi.env']) {
  const envPath = path.join(__dirname, '..', file);
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
}
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const name = String(process.env.ADMIN_NAME || 'Yönetici').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI tanımlı değil.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL geçerli bir e-posta olmalı.');
  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes < 10 || bytes > 72) throw new Error('ADMIN_PASSWORD 10–72 bayt uzunluğunda olmalı.');

  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_ADI || 'etut_merkezi' });
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`✅ ${email} yönetici olarak güncellendi.`);
  } else {
    await User.create({ name, email, role: 'admin', passwordHash });
    console.log(`✅ Yönetici oluşturuldu: ${email}`);
  }
}

main()
  .catch(error => {
    console.error('❌', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
