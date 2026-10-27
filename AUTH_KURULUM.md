# Kayıt ve giriş kurulumu

Kimlik doğrulama, Express oturumlarını MongoDB'de saklar. Şifreler bcrypt ile hash'lenir; tarayıcıya yalnızca `httpOnly` oturum çerezi verilir. Öğretmen kayıtlarının öğrenci tarafından kendiliğinden açılmaması için davet kodu zorunludur.

## 1. Ortam değişkenleri

Sunucu önce `.env` dosyasını, yoksa `baglanti_adresi.env` dosyasını okur. Aşağıdaki değerleri kullanılan dosyaya ekleyin. `.env.example` dosyasını `.env` olarak kopyalarsanız var olan MongoDB Atlas `MONGODB_URI` ve `DB_ADI` değerlerinizi de bu dosyaya taşıyın:

```env
SESSION_SECRET=32-karakterden-uzun-rastgele-bir-deger
TEACHER_REGISTRATION_CODE=ogretmenlere-guvenli-kanaldan-verilecek-kod
```

Güçlü bir `SESSION_SECRET` üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Gerçek değerleri Git'e eklemeyin. Öğretmen davet kodunu yalnızca yetkili öğretmenlerle paylaşın. Üretimde HTTPS kullanın; sunucu `NODE_ENV=production` olduğunda oturum çerezini `secure` olarak ayarlar.

## 2. Bağımlılıklar ve başlatma

Proje kökünde:

```bash
npm install
npm start
```

`npm run dev` de kimlik doğrulamayı etkin tutmak için aynı Express sunucusunu başlatır. `static-server.js` yalnızca statik önizleme içindir; korumalı panelleri sunmaz.

## 3. Kullanım

`http://localhost:3000/kayit-giris.html` adresinden kayıt veya giriş yapın. Öğrenciler doğrudan öğrenci paneline, davet koduyla kayıtlı öğretmenler öğretmen paneline yönlendirilir.

Uç noktalar: `POST /register`, `POST /login`, `POST /logout` ve oturum bilgisini döndüren `GET /me`. Oturum açan öğretmen, mevcut öğretmen API uç noktalarını da kullanabilir. Öğretmen panelleri artık eski `x-ogretmen-sifre` başlığıyla değil, oturum ve `teacher` rolüyle korunur.

Şifre en az 10, en fazla 72 UTF-8 bayt olmalıdır (bcrypt'in giriş uzunluğu sınırı). Öğretmen kaydı için `TEACHER_REGISTRATION_CODE` gereklidir. IP başına giriş denemeleri 15 dakikada 10, kayıt denemeleri saatte 5 istekle sınırlandırılır.
