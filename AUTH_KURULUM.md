# Kayıt ve giriş kurulumu

Kimlik doğrulama, Express oturumlarını MongoDB'de saklar. Şifreler bcrypt ile hash'lenir; tarayıcıya yalnızca `httpOnly` oturum çerezi verilir. Öğretmen kayıtlarının öğrenci tarafından kendiliğinden açılmaması için davet kodu zorunludur.

## 1. Ortam değişkenleri

Sunucu `.env` dosyasını öncelikli okur; orada bulunmayan değişkenleri `baglanti_adresi.env` dosyasından tamamlar. Aşağıdaki değerleri bu dosyalardan birine ekleyin. `.env.example` dosyasını `.env` olarak kopyalarsanız var olan MongoDB Atlas `MONGODB_URI` ve `DB_ADI` değerlerinizi de bu dosyaya taşıyın:

```env
SESSION_SECRET=32-karakterden-uzun-rastgele-bir-deger
TEACHER_REGISTRATION_CODE=ogretmenlere-guvenli-kanaldan-verilecek-kod
AI_API_KEY=google-ai-studio-gemini-api-anahtari
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

Öğretmen panelindeki planlı ders, test ve duyuru kayıtları sırasıyla `planli_dersler`, `quizler` ve `duyurular` koleksiyonlarında saklanır. Öğrenci paneli `GET /me` üzerinden güncel ad/e-posta/rolü, `GET /api/student/dashboard` (eski uyumluluk yolu: `/api/ogrenci/icerik`) üzerinden planlanmış dersleri, aktif Zoom dersini, görev/testleri, duyuruları ve öğrencinin kendi test sonuçlarını alır. Test gönderimleri sunucuda puanlanıp `quiz_sonuclari` koleksiyonuna yazılır. Öğrenci kimliği oturumdan alınır, istemcinin gönderdiği ad/puan güvenilir kabul edilmez. Ders bağlantısı HTTPS olmalıdır. Klasik optik sınav kayıt uç noktası da artık öğrenci oturumu gerektirir.

Öğrenci panelindeki sol menü bölümleri aynı sayfada sekme gibi açılır; URL parçası (ör. `#duyurular`) sekme durumunu korur. Planlı dersler, öğretmen testleri ve duyurular `GET /api/student/dashboard` isteğiyle MongoDB'den yüklenir. Test gönderildiğinde sonuç `POST /api/ogrenci/quiz/:id/teslim` üzerinden kaydedilir ve sonuçlar sekmesinde yeniden yüklenir.

Soru Sihirbazı için Google AI Studio'dan Gemini API anahtarı alıp `AI_API_KEY` olarak sunucu ortamına ekleyin; anahtarı tarayıcı koduna veya Git'e koymayın. Ek npm paketi gerekmez. Öğrenci `POST /api/ai/questions` isteğiyle konu, zorluk ve 5/10/20 soru sayısını gönderir. Sunucu Gemini yanıtını doğrular, cevap anahtarını MongoDB'de saklar ve tarayıcıya yalnızca soru/şıkları döndürür. Üretilen testler öğrencinin hesabına bağlıdır; test teslimi mevcut öğrenci test API'sinden puanlanır, cevap ve çözüm açıklamaları teslimden sonra gösterilir. Soru üretimi IP başına 15 dakikada 5 istekle sınırlandırılmıştır.

Şifre en az 10, en fazla 72 UTF-8 bayt olmalıdır (bcrypt'in giriş uzunluğu sınırı). Öğretmen kaydı için `TEACHER_REGISTRATION_CODE` gereklidir. IP başına giriş denemeleri 15 dakikada 10, kayıt denemeleri saatte 5 istekle sınırlandırılır.
