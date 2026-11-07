# Zarif Puan ve lig sistemi

- Öğrencinin doğruladığı her soru bir kez 10 puan kazandırır. Puan hem `zarifPuan` hem `haftalikPuan` alanına eklenir.
- Öğretmen testleri ve çevrimiçi test ödevleri aynı test/soru kimliğini kullanır. Aynı resimli soru farklı denemelerde kullanıldığında da yalnızca bir kez puanlanır. Geçmiş teslimler geriye dönük puanlanmaz.
- Öğretmen testleri tekrar çözülebilir ve önceki teslimden sonra cevapları gösterir. Sonraki denemede ilk kez doğru verilen cevapların puanlanması seçildiğinden, öğrenciler cevap anahtarını kullanarak puan kazanabilir.
- Pratik ekranındaki cevaplar tarayıcıda kontrol edilir; sunucu tarafından doğrulanmadıklarından puan verilmez. Eski cevap kaydetme akışı da doğrulanmış bir cevap sonucu sunmaz.
- `GET /api/leaderboard` yalnızca oturum açmış öğrenciler içindir; en yüksek haftalık puanlı 10 öğrencinin adı ve soyadı baş harfleri gösterilir. İstek Redis kullanılmadan MongoDB'den okunur.
- Sonuç ve puan yazımı aynı MongoDB işlemi içinde gerçekleşir; MongoDB replica set veya sharded cluster işlemleri desteklemelidir. Uygulama yeniden başlatıldığında gerekli indeks oluşturulur.

## Haftalık iş taslağı

`lib/weekly-league-job.js`, pazartesi 00:00 `Europe/Istanbul` zamanlamasını tanımlar; ancak otomatik olarak çalışmaz ve çalıştırılması açıkça hata verir. Lig yükselme/düşme eşikleri henüz belirlenmemiştir. Etkinleştirilmeden önce haftalık dönemlerin kaydı, eşzamanlı sunucularda tek kez çalıştırma, kesinti sonrası kurtarma ve puan eklemeleriyle sıfırlama arasındaki yarış koşulları tasarlanıp test edilmelidir. Şu an haftalık puanlar otomatik sıfırlanmaz ve ligler otomatik değişmez.
