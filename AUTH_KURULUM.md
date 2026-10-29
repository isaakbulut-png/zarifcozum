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

Yapay Zeka Soru Sihirbazı için Google AI Studio'dan Gemini API anahtarı alıp `AI_API_KEY` olarak sunucu ortamına ekleyin; anahtarı tarayıcı koduna veya Git'e koymayın. Ek npm paketi gerekmez. Yalnızca öğretmen oturumuyla kullanılabilen `POST /api/ai/questions` konu, zorluk ve 5/10/20 soru sayısını alır; Gemini yanıtını doğrular ve soruları veritabanına kaydetmeden öğretmene taslak olarak döndürür. Öğretmen her soruyu kontrol edip `POST /api/ai/questions/publish` üzerinden ayrı ayrı onaylayabilir. Onaylanan sorular birer soruluk testler olarak `quizler` koleksiyonuna kaydedilir ve `GET /api/student/dashboard` yanıtındaki öğretmen testleri listesine eklenir. Öğretmen panelindeki yayınlanmış yapay zeka soruları listesinden "Soruyu sil" ile onaylanan AI kaydı veritabanından kalıcı olarak silinebilir. Öğrenciler testleri mevcut `POST /api/ogrenci/quiz/:id/teslim` uç noktasından çözer; cevap ve çözüm açıklamaları teslimden sonra gösterilir. Soru üretimi IP başına 15 dakikada 5 istekle sınırlandırılmıştır.

Şifre en az 10, en fazla 72 UTF-8 bayt olmalıdır (bcrypt'in giriş uzunluğu sınırı). Öğretmen kaydı için `TEACHER_REGISTRATION_CODE` gereklidir. IP başına giriş denemeleri 15 dakikada 10, kayıt denemeleri saatte 5 istekle sınırlandırılır.

## Ödeme webhook güvenliği

Kart numarası, CVV veya son kullanma tarihi uygulama sunucusuna gönderilmemeli ya da MongoDB'de saklanmamalıdır. Ödeme formu sağlayıcının barındırdığı sayfada açılmalıdır. API kimlik bilgilerini yalnızca hosting ortam değişkenlerinde tutun: iyzico için `IYZICO_API_KEY` ve `IYZICO_SECRET_KEY`; PayTR için `PAYTR_MERCHANT_KEY` ve `PAYTR_MERCHANT_SALT`. Bunları tarayıcı koduna, Git'e veya loglara koymayın.

Webhook adresleri `/api/webhooks/iyzico` ve `/api/webhooks/paytr` şeklindedir. PayTR `merchant_oid`, `merchant_salt`, `status` ve `total_amount` alanlarını merchant key ile HMAC-SHA256/Base64 doğrular ([PayTR Bildirim URL dokümanı](https://dev.paytr.com/iframe-api/iframe-api-2-adim)). iyzico normal ödeme callback'i `X-IYZ-SIGNATURE-V3` başlığındaki HMAC-SHA256/hex imzasıyla doğrulanır ([iyzico Webhook dokümanı](https://docs.iyzico.com/ek-servisler/webhook)). iyzico hesabında V3 imza özelliği etkinleştirilmiş olmalıdır. İmza kontrolü, herhangi bir ödeme/kullanıcı veritabanı sorgusundan önce yapılır. PayTR callback'lerinde `OK` cevabı yalnızca doğrulama ve idempotent işlem başarılıysa döner.

PayTR sandbox checkout `/api/payments/paytr/checkout` rotasından başlatılır; öğrenci oturumu gerekir. Paket kimliği sunucu tarafı demo kataloğundan seçilir, fiyat ve `merchant_oid` istemciden kabul edilmez. Checkout PayTR iFrame API'sine `test_mode=1` ile gider ve öğrenci panelinde PayTR'ın barındırdığı ödeme formunu açar. Kart verisi ZarifÇözüm sunucusuna ulaşmaz. Sandbox paket fiyatları 249/499/899 TL'dir ve canlı satış teklifi değildir.

Ödeme başlamadan önce benzersiz `Payment` kaydı `pending` oluşturulur. `orderReference`, miktar, para birimi, kullanıcı ve abonelik tipi istemciden güvenilerek alınmaz; sunucu tarafından belirlenir. iyzico'da bu referans `paymentConversationId`, PayTR'de `merchant_oid` ile birebir eşleşmelidir. Webhook yalnızca eşleşen bekleyen ödemeyi atomik MongoDB transaction içinde bir kez işler; devam eden abonelik varsa süresini üzerine ekler. Kart verisi veya sağlayıcı sırları ödeme koleksiyonunda tutulmaz. MongoDB transaction için replica set gerekir.

PayTR sandbox yapılandırması:

1. PayTR işyeri hesabı/sandbox erişimini PayTR üzerinden oluşturun ve test mağaza kimlik bilgilerini alın. Sandbox ve canlı `merchant_id`, `merchant_key`, `merchant_salt` değerlerini birbirine karıştırmayın.
2. Yerelde `.env` dosyasına veya Render servisinin **Environment** ayarlarına `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` ve `APP_BASE_URL` ekleyin. `APP_BASE_URL`, `https://zarifcozum.com` gibi bu sunucunun herkese açık HTTPS origin'i olmalıdır. Sırları sohbete, repoya veya tarayıcıya koymayın.
3. PayTR mağaza panelindeki **Bildirim URL** ayarını `https://zarifcozum.com/api/webhooks/paytr` yapın. Bu URL oturum açma gerektirmemeli ve dışarıdan erişilebilir olmalıdır.
4. `npm.cmd test` ile otomatik imza/checkout kontrollerini çalıştırın. Gerçek sandbox iFrame denemesi için uygulamayı çalıştırıp öğrenci hesabıyla **Üyelik ve paketler** alanından demo paketi seçin; test kartlarını yalnızca PayTR'ın güncel sandbox yönergelerine göre PayTR iFrame'inde kullanın. Ödeme sonucu, tarayıcı dönüş URL'sine göre değil doğrulanmış callback'e göre belirlenir.
5. Canlıya geçmeden önce gerçek paket/fiyatları, sözleşme ve yasal bilgilendirmeleri kesinleştirin. Bu uygulama sürümünde checkout her zaman `test_mode=1` gönderir; canlı tahsilatı açmak için yeni bir kod incelemesi ve ayrı test gerekir.

iyzico'nun yayımlanmış V3 imza örneği normal ödeme callback alanlarını kapsar; abonelik callback formatı için bu kurala uygun bir imza alan dizisi belgelenmediğinden `subscription.*` event'leri kasıtlı olarak reddedilir. Bu event'leri açmadan önce iyzico'dan abonelik webhook imza formülünü yazılı olarak doğrulayın. PayTR'nin standart Bildirim URL callback'i imza doğrulanarak desteklenir; yinelenen tahsilatlar için her sağlayıcı yenilemesinin sunucuda ayrı bir bekleyen ödeme kaydıyla eşleştirilmesi gerekir.

Bu webhook kurulumu tek başına PCI-DSS veya KVKK uyumluluğu sertifikası sağlamaz. Üretime geçmeden önce veri envanteri/saklama süresi, erişim kontrolleri, gizlilik metinleri, sözleşmeler ve ödeme sağlayıcısının güncel teknik yönergeleri ayrıca gözden geçirilmelidir. Test ve canlı ortam anahtarlarını ayırın.
