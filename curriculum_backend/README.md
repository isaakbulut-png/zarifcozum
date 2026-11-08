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
