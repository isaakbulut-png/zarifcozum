# Maarif müfredat servisi

FastAPI servisi mevcut Node uygulamasıyla aynı MongoDB sunucusunu ve
`DB_ADI` veritabanını kullanır. `curriculum_nodes` koleksiyonu otomatik
oluşur; ayrı SQL veritabanı veya migration gerekmez.

## Kurulum ve çalıştırma

Proje kökünde:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r curriculum_backend\requirements.txt
```

`.env` dosyasında mevcut `MONGODB_URI` ve `DB_ADI` değerlerini kullanın;
`DB_ADI` yoksa Node ile aynı varsayılan `etut_merkezi` kullanılır.
Ortam değişkenleri önceliklidir; eksik değerler sırasıyla `.env` ve
`baglanti_adresi.env` dosyalarından okunur. `CURRICULUM_SERVICE_TOKEN`
değerini en az 32 karakterlik rastgele bir gizli anahtarla,
`CURRICULUM_SERVICE_URL` değerini Python servis adresiyle ayarlayın.
İki servis aynı anahtarı kullanmalıdır.

```powershell
.\.venv\Scripts\python.exe -m uvicorn curriculum_backend.main:app --host 127.0.0.1 --port 8000
npm start
```

Komutları ayrı terminallerde çalıştırın. Python servisini doğrudan internete
açmayın; farklı makinelerde özel ağ ve TLS ile koruyun. Servis anahtarı
kullanıcı kimlik doğrulamasının yerine geçmez. Express mevcut oturum ve
güncel hesap rolü denetimini kullanır.

## API ve veri yapısı

* `GET /api/v1/curriculum/tree` tüm kökleri ve altlarını döndürür;
  `?parent_id=<ObjectId>` ilgili düğüm dahil alt ağacı döndürür.
* `POST /api/v1/curriculum/nodes` 201 ve `children: []` içeren düğümü döndürür.
  `parent_id` varsa mevcut bir düğüme işaret etmelidir. Yanlış ObjectId 422,
  bulunmayan ebeveyn 404 döndürür.
* Kimlikler API'de 24 karakterli ObjectId dizgeleridir; önceki UUID biçimi
  artık geçerli değildir. MongoDB'de `_id` ve `parent_id` BSON ObjectId'dir.
* Aktif ve pasif düğümler birlikte döner; kardeşler `order_index` ve `_id`
  ile sıralanır. `metadata` iç içe JSON nesnesidir.
* Tema ve kazanımların `content_count` değeri bağlantılı soru bankası
  kayıtları (`sorular`) ve testlerdeki soru kayıtları (`quizler.questions`)
  toplamıdır. Tema, doğrudan bağlanan sorularla alt kazanımların toplamını
  içerir. Testteki her soru ayrı kayıt sayılır; aynı soru ayrıca soru
  bankasında yer alıyorsa iki kez sayılabilir. İlişkisi bulunmayan eski
  sorular sayılmaz; sıfır, tüm sistemde değil bu düğüme bağlı soru yok demektir.
* Tüm ağaç belleğe yüklenir; alt ağaç seviye bazında, `parent_id` indeksini
  kullanan sorgularla alınır. Büyük ağaçlar için sayfalama henüz yoktur.
* MongoDB yabancı anahtar uygulamaz. Ebeveyn kontrolü oluşturma API'sindedir;
  veritabanına doğrudan müdahale yetim veya döngüsel düğümler oluşturabilir.
  Tam ağaç sorgusu bu bozulmaları 500 hatası olarak bildirir.
  Bir silme/güncelleme API'si eklenirse bu bütünlük ayrıca korunmalıdır.

Servis başlarken ve seed çalışırken `(parent_id, order_index, _id)` indeksi
ile iki soru bağlantı indeksi oluşturulur; MongoDB kullanıcısının koleksiyon ve indeks oluşturma yetkisi
bulunmalıdır.

## Soruları elle bağlama

Mevcut sorular otomatik eşlenmez. Öğretmen veya yönetici oturumuyla Express
üzerinden aşağıdaki `PUT` uçlarına `{"curriculum_node_id":"<tema_veya_kazanim_id>"}`
gönderin. Bağlantıyı kaldırmak için aynı alana `null` gönderin:

* `/api/v1/curriculum/links/questions/<soru_id>` — `sorular` belgesi.
* `/api/v1/curriculum/links/quizzes/<test_id>/questions/<sira>` — testteki
  sıfırdan başlayan soru sırası (0–49). Öğretmen sadece kendi testini;
  superadmin tüm testleri değiştirebilir. Soru bankası mevcut yetkilendirmede
  öğretmen ve yöneticilerce yönetilen ortak kaynaktır.

Örnek (oturum açıkken tarayıcı konsolunda, yer tutucuları değiştirerek):

```javascript
await fetch('/api/v1/curriculum/links/questions/SORU_OBJECT_ID', {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({curriculum_node_id: 'KAZANIM_OBJECT_ID'})
}).then(async response => {
  const result = await response.json();
  if (!response.ok) throw new Error(result.mesaj);
  console.log(result.mesaj);
});
```

Bağlantılar BSON ObjectId olarak yazılır. Ağaç yeniden yüklendiğinde sayaçlar
güncellenir; henüz içerik seçme/eşleme arayüzü veya veri taşıma işlemi yoktur.

## Akıllı ödev

Öğretmen gezgininde tema ve kazanımlar sürüklenebilir veya klavye ve
dokunmatik cihazlar için "Sepete ekle" ile seçilebilir. Sepet tek bir
ödeve dönüşür. Sınıf listesi öğretmenin etkin öğrenci profillerindeki
sınıf/şubelerden türetilir. Hesap bağlantısı olmayan öğrenciler için ödev
atanır ancak öğrenci hesabı bağlanana kadar görünmez.

Test, seçilen düğümler ve tema altındaki düğümlere bağlı `quizler.questions`
kayıtlarından en fazla 10 şıklı soru içerir. Diğer öğretmenlerin erişilebilir
test soruları dahil edilir; yayınlanmamış yapay zekâ testleri hariç tutulur.
Soru bankasındaki yalnızca resim içeren ve şıkları bulunmayan kayıtlar mevcut
test çözücüsüne uyumlu olmadığından dahil edilmez. Sayaç bu kayıtları da
sayabildiği için sepetteki çözülebilir soru sayısı farklı olabilir. Hiç uygun
soru yoksa ödev oluşturulmaz; 1–9 soru varsa kısa test oluşturulur.

Oluşturma, mevcut `odevler`, `odev_atamalari`, `quizler` kayıtlarını ve
`curriculum_assignments` üst kaydını MongoDB transaction içinde yazar. Bu
işlem transaction destekleyen bir replica set veya sharded cluster gerektirir;
standalone MongoDB'de işlem başarısız olur. `COMPLETED` tüm alıcıların en az
bir kez test teslimi yapması anlamına gelir. Oluşturulan test yalnızca atanmış
öğrencilerin panelinde görünür. `POST /api/v1/assignments` ağ geçidi oturum
öğretmenini kullanır; kullanıcı tarafından gönderilen öğretmen kimliğine
güvenilmez.

## Öğrenme eksikleri ve öneriler

Canlı test bitirildiğinde sonuçla aynı transaction içinde `quiz_sonuclari`
belgesinin `performance` dizisine her sorunun kazanım ObjectId'si, içerik
parmak izi ve son kontrolün doğruluğu yazılır. Boş soru ile test bitirilemez;
tekrar denemeler ayrı sonuçlardır. Sınıf ödevinin tüm öğrencilerce
tamamlanması beklenmeden öğrencinin kendi bitirdiği test analiz edilir.
Eski sonuçlara veya bağlantısız sorulara kazanım otomatik atanmaz. Eski
oluşturulmuş ödev testleri de bu bilgiye sahip olmayabilir.

Özel ağdaki `GET /api/v1/students/<student_id>/recommendations`, son 20
tamamlanmış testte kazanım başına doğru/toplam oranını hesaplar; %60'ın
altındakileri en düşük başarıdan başlayarak listeler. Bu bir kural tabanlı
motor olup üretken yapay zekâ kullanmaz. Express üzerinden
`GET /api/student/recommendations` öğrenci ve bağlı veli içindir; öğretmen
`?student_id=<öğrenci_id>` eklemeli ve etkin öğrenci bağlantısına sahip
olmalıdır. Veli ve öğrenci başka bir kimlik isteyemez.

Materyaller `curriculum_materials` koleksiyonuna şu biçimde eklenmelidir:
`{curriculum_node_id: ObjectId(...), active: true, type: "LESSON" | "VIDEO",
title: "...", url: "https://..."}`. Bu aşamada materyal düzenleme arayüzü veya
ekleme API'si yoktur. Aktif ve doğrudan kazanıma bağlı ilk geçerli HTTP(S)
bağlantısı seçilir. Takviye soruları yalnızca öğrencinin tek ve açıkça
belirlenmiş etkin profil sınıfına eşit sayısal `quizler.grade` taşıyan,
yayınlanmış veya normal testlerdeki kazanıma doğrudan bağlı şıklı sorulardır.
Yanıtlar cevap anahtarı içermez. Soru parmak izi metin, dört şık ve cevap
üzerinden alınır; değiştirilen soru farklı soru sayılır. Testin önceki
sonuçlarındaki parmak izleri tüm geçmişte ve açık denemelerin kontrol edilmiş
sorularında aranır; eski sonuçlarda kimlik
eksikse önceden çözülmediği garanti edilemeyeceği için soru önerilmez.
Soru seçimi `question_selection_status`, eski veri kapsamı
`incomplete_history_tests` ve `incomplete_recent_tests` ile bildirilir.
Materyal veya üç uygun soru yoksa mevcut olanlar ve eksik sayıları döndürülür.
Materyal linkleri içerik yöneticilerince güvenilir kaynaklardan girilmelidir.

## Örnek veri

```powershell
.\.venv\Scripts\python.exe -m curriculum_backend.seed_curriculum
```

Beş örnek düğüm ebeveynden çocuğa eklenir. Sabit ObjectId'ler sayesinde
tekrar çalıştırmak mevcut verileri değiştirmez. Farklı bir kayıt aynı
kimliği kullanıyorsa hata verilir. İşlem transaction kullanmaz: kesinti
veya hata durumunda önceki düğümler kalabilir; sorun düzeltildikten sonra
komut yeniden çalıştırılarak tamamlanabilir. Elle başka ID'lerle girilmiş
benzer veriler otomatik birleştirilmez.

Başlık ve kazanım verisi temsili olup resmî kayıt değildir. MEB'in güncel
programında [Sayılar](https://tymm.meb.gov.tr/matematik-dersi/unite/21)
ve [Nicelikler ve Değişimler](https://tymm.meb.gov.tr/matematik-dersi/unite/23)
ayrı temalardır.

## Test

```powershell
.\.venv\Scripts\python.exe -m pip install -r curriculum_backend\requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s curriculum_backend\tests -v
node --test test\curriculum.test.js
```

Gerçek MongoDB testi için yalnızca test amaçlı bir sunucuya işaret eden
`CURRICULUM_TEST_MONGODB_URI` ortam değişkenini ayarlayın:

```powershell
$env:CURRICULUM_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017'
.\.venv\Scripts\python.exe -m unittest curriculum_backend.tests.test_mongodb -v
```

Test, rastgele adlı bir test veritabanında üç koleksiyon oluşturur ve sonunda
yalnızca bu koleksiyonları siler. URI tanımlı değilse
entegrasyon testi atlanır; diğer Python testleri MongoDB'yi taklit eder.
