# Kayıt ve giriş kurulumu

Kimlik doğrulama, Express oturumlarını MongoDB'de saklar. Şifreler bcrypt ile hash'lenir; tarayıcıya yalnızca `httpOnly` oturum çerezi verilir. Öğretmen kayıtlarının öğrenci tarafından kendiliğinden açılmaması için davet kodu zorunludur.

## 1. Ortam değişkenleri

Sunucu `.env` dosyasını öncelikli okur; orada bulunmayan değişkenleri `baglanti_adresi.env` dosyasından tamamlar. Aşağıdaki değerleri bu dosyalardan birine ekleyin. `.env.example` dosyasını `.env` olarak kopyalarsanız var olan MongoDB Atlas `MONGODB_URI` ve `DB_ADI` değerlerinizi de bu dosyaya taşıyın:

```env
SESSION_SECRET=32-karakterden-uzun-rastgele-bir-deger
TEACHER_REGISTRATION_CODE=ogretmenlere-guvenli-kanaldan-verilecek-kod
GOOGLE_CLIENT_ID=google-oauth-web-istemci-kimligi
GEMINI_API_KEY=google-ai-studio-gemini-api-anahtari
SMTP_HOST=smtp.ornek.com
SMTP_PORT=587
SMTP_USER=uygulama-e-posta-kullanici-adi
SMTP_PASSWORD=uygulama-e-posta-sifresi
SMTP_FROM=ZarifCozum <noreply@ornek.com>
APP_BASE_URL=https://zarifcozum.com
```

Güçlü bir `SESSION_SECRET` üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Gerçek değerleri Git'e eklemeyin. Öğretmen davet kodunu yalnızca yetkili öğretmenlerle paylaşın. Google Cloud Console'da bir **Web application** OAuth istemcisi oluşturup üretim alan adınızı ve `http://localhost:3000` adresini yetkili JavaScript kaynaklarına ekleyin; istemci kimliğini `GOOGLE_CLIENT_ID` olarak ayarlayın. Google girişinde yeni öğretmen hesabı açmak için de öğretmen davet kodu gerekir. Parola sıfırlama e-postaları için `SMTP_*` değerlerini e-posta sağlayıcınızın SMTP bilgileriyle, `APP_BASE_URL` değerini uygulamanın herkese açık kök adresiyle yapılandırın. Geliştirmede `APP_BASE_URL` belirtilmezse `http://localhost:3000` kullanılır; üretimde bu değişken zorunludur. Üretimde HTTPS kullanın; sunucu `NODE_ENV=production` olduğunda oturum çerezini `secure` olarak ayarlar.

## 2. Bağımlılıklar ve başlatma

Proje kökünde:

```bash
npm install
npm start
```

`npm run dev` de kimlik doğrulamayı etkin tutmak için aynı Express sunucusunu başlatır. `static-server.js` yalnızca statik önizleme içindir; korumalı panelleri sunmaz.

## 3. Kullanım

`http://localhost:3000/kayit-giris.html` adresinden kayıt veya giriş yapın. Öğrenciler doğrudan öğrenci paneline, davet koduyla kayıtlı öğretmenler öğretmen paneline yönlendirilir. Google ile devam et seçeneği e-posta adresi Google tarafından doğrulanmış hesapları kabul eder; yeni kullanıcılar kayıt görünümünde seçilen rol ve öğretmen davet koduyla oluşturulur. `Şifremi unuttum` bağlantısı, 30 dakika geçerli ve tek kullanımlık bir bağlantıyı e-posta ile gönderir. Öğretmen ve öğrenci panellerindeki `Şifre değiştir` düğmesi oturum açmış kullanıcının şifresini günceller; Google ile açılan ve henüz şifresi olmayan hesapta mevcut şifre boş bırakılabilir.

Uç noktalar: `POST /register`, `POST /login`, `POST /auth/google`, `POST /forgot-password`, `POST /reset-password`, oturum gerektiren `POST /change-password`, `POST /logout` ve oturum bilgisini döndüren `GET /me`. `GET /auth/config` tarayıcıya yalnızca herkese açık Google istemci kimliğini döndürür. Oturum açan öğretmen, mevcut öğretmen API uç noktalarını da kullanabilir. Öğretmen panelleri artık eski `x-ogretmen-sifre` başlığıyla değil, oturum ve `teacher` rolüyle korunur.

Öğretmen panelindeki planlı ders, test ve duyuru kayıtları sırasıyla `planli_dersler`, `quizler` ve `duyurular` koleksiyonlarında saklanır. Öğrenci paneli `GET /me` üzerinden güncel ad/e-posta/rolü, `GET /api/student/dashboard` (eski uyumluluk yolu: `/api/ogrenci/icerik`) üzerinden planlanmış dersleri, aktif Zoom dersini, görev/testleri, duyuruları ve öğrencinin kendi test sonuçlarını alır. Test gönderimleri sunucuda puanlanıp `quiz_sonuclari` koleksiyonuna yazılır. Öğrenci kimliği oturumdan alınır, istemcinin gönderdiği ad/puan güvenilir kabul edilmez. Ders bağlantısı HTTPS olmalıdır. Klasik optik sınav kayıt uç noktası da artık öğrenci oturumu gerektirir.

Öğrenci panelindeki sol menü bölümleri aynı sayfada sekme gibi açılır; URL parçası (ör. `#duyurular`) sekme durumunu korur. Planlı dersler, öğretmen testleri ve duyurular `GET /api/student/dashboard` isteğiyle MongoDB'den yüklenir. Test gönderildiğinde sonuç `POST /api/ogrenci/quiz/:id/teslim` üzerinden kaydedilir ve sonuçlar sekmesinde yeniden yüklenir.

Yapay Zeka Soru Sihirbazı için Google AI Studio'dan Gemini API anahtarı alıp `GEMINI_API_KEY` olarak sunucu ortamına ekleyin; anahtarı tarayıcı koduna veya Git'e koymayın. Ek npm paketi gerekmez. Yalnızca öğretmen oturumuyla kullanılabilen `POST /api/ai/questions` konu, zorluk ve 5/10/20 soru sayısını alır; Gemini yanıtını doğrular ve soruları veritabanına kaydetmeden öğretmene taslak olarak döndürür. Öğretmen her soruyu kontrol edip `POST /api/ai/questions/publish` üzerinden ayrı ayrı onaylayabilir. Onaylanan sorular birer soruluk testler olarak `quizler` koleksiyonuna kaydedilir ve `GET /api/student/dashboard` yanıtındaki öğretmen testleri listesine eklenir. Öğretmen panelindeki yayınlanmış yapay zeka soruları listesinden "Soruyu sil" ile onaylanan AI kaydı veritabanından kalıcı olarak silinebilir. Öğrenciler testleri mevcut `POST /api/ogrenci/quiz/:id/teslim` uç noktasından çözer; cevap ve çözüm açıklamaları teslimden sonra gösterilir. Soru üretimi IP başına 15 dakikada 5 istekle sınırlandırılmıştır.

Şifre en az 10, en fazla 72 UTF-8 bayt olmalıdır (bcrypt'in giriş uzunluğu sınırı). Öğretmen kaydı için `TEACHER_REGISTRATION_CODE` gereklidir. IP başına giriş ve şifre değiştirme denemeleri 15 dakikada 10, kayıt denemeleri saatte 5, şifre sıfırlama denemeleri 15 dakikada 5 istekle sınırlandırılır. Google oturumları OAuth istemci kimliği ve doğrulanmış Google ID belirteciyle sunucuda doğrulanır; admin hesapları Google girişi kullanamaz.

## Gerçek zamanlı AI sohbeti

AI Mentör ekranları Socket.IO üzerinden `send-message` olayı gönderir ve `receive-message` yanıtını alır. Bağlantı, Express ile aynı MongoDB oturum çerezini ve rol/hesap/abonelik kontrollerini kullanır. `POST /api/chat` geriye dönük uyumluluk için açık kalır. İstek başına mesaj 4.000 karakterle, kullanıcı başına Socket.IO sohbeti 10 dakikada 20 istekle sınırlandırılır.

Socket.IO `send-message` olayındaki kullanıcı mesajı ve AI yanıtı ile geriye dönük uyumluluk için açık bırakılan `POST /api/chat` mesaj çiftleri `ChatMessage` modeliyle MongoDB'deki `chat_messages` koleksiyonuna kaydedilir. Her kayıt `userId`, `roomName`, `sender` (`user` veya `ai`), `message` ve `createdAt` alanlarını taşır; geçmiş kullanıcıya özeldir ve kullanıcı silene kadar saklanır. Canlı ders ekranı açıldığında Zoom toplantı numarası `join-room` olayına gönderilir; sunucu aktif toplantıyı doğrular, aynı Socket.IO odasına katılma işlemini yapar ve kullanıcının o ders için son 20 özel mesajını olay onayıyla döndürür. Sonraki geçmiş sayfaları `load-history` olayıyla 50'şer kayıt halinde yüklenir; ana AI Mentör ekranı kullanıcının asistan ve canlı ders mesajlarını gösterir. Canlı ders panelindeki **Geçmişi sil** düğmesi yalnızca o dersin geçmişini, ana AI Mentör ekranındaki düğme ise kullanıcının tüm AI geçmişini siler. Oda üyeliği ortak olsa da AI yanıtları ve geçmiş başka katılımcılara gösterilmez. `zoom-room.html` paneli Zoom SDK yanında açılır; `canli.html` paneli ise Zoom'un ayrı sekmede açılan bağlantısına eşlik eder. Oda/kota durumu şu an tek Node.js sürecinde tutulur. Birden fazla uygulama örneğine yatay ölçeklemeden önce Socket.IO Redis adapter ve süreçler arası ortak kota deposu gerekir. Socket.IO HTTP istek/yanıt yükünü azaltabilir; Gemini üretim yükünü veya maliyetini azaltmaz.

## Yönetici paneli

Yönetici hesabı arayüzden **açılamaz**; yalnızca sunucuda şu komutla oluşturulur (PowerShell):

```powershell
$env:ADMIN_EMAIL="ben@ornek.com"; $env:ADMIN_NAME="Yönetici"; $env:ADMIN_PASSWORD="en az 10 karakterlik şifre"; npm run admin:create
```

- Giriş adresi: `/yonetim` (ana sayfada bağlantısı yoktur, arama motorlarına kapalıdır). Yerelde: `http://localhost:3000/yonetim`
- Yönetici hesapları yalnızca `/admin/login` ile giriş yapar; normal giriş sayfası yöneticileri kabul etmez.
- Aktif bölümler: Genel Bakış, Kullanıcılar, Ödemeler, Duyurular. Diğer butonlar ilgili paneller hazır olana kadar pasiftir.

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
