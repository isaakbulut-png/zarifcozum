# 🎯 Öğrenci & Öğretmen Paneli Audit - Hızlı Çözümler Rehberi

## 📌 Öncelikli İşlem Sırası (Do It First!)

### 🔴 ACIL - Bu Hafta Yapılmalı

#### #1 Sınav Takvimi Sunucu Entegrasyonu (Yüksek Etki)
```
Durum:  ❌ Çalışmıyor - Veriler yerel kalıyor
Risiko: 🔴 YÜKSEK - Öğrenci hiçbir sınav görmüyor
```

**Nereyi Değiştir:**
- **Frontend**: `ogretmen-paneli.html:1328-1341` 
  - Modal form güncellemesi
  - Form submission'ını API'ye gönder

**Yeni Backend Rotası Ekle:**
```javascript
// routes/ogretmen-ogrenci-odev.js veya yeni dosya
POST /api/ogretmen/sinav-plani
  Input: { tarih, baslik, test_id, ... }
  Action: Veritabanına kaydet
  Response: { success, sinav_id }

GET /api/ogrenci/takvim
  Action: API'den takvim çek (mevcut + sınav)
  Response: [ { type: 'exam', date, title }, ... ]
```

**Öğrenci Tarafı:**
- `ogrenci-paneli.html` takvim modülü zaten API'yi çekiyorsa, 
  ekstra değişiklik olmayabilir

---

#### #2 Öğretmen Tercihlerini API'ye Bağla (Yüksek Etki)
```
Durum:  ⚠️ Form var, verisi kayıt edilmiyor
Risiko: 🔴 YÜKSEK - Tercihler başka cihazda kayıp
```

**Nereyi Değiştir:**
- **Frontend**: `ogretmen-paneli.html:1244-1258`
  - Kaydet butonunu API çağrısına bağla

**Yeni Backend Rotası Ekle:**
```javascript
// routes/ogretmen-ogrenci-odev.js veya auth.js
POST /api/ogretmen/tercihler
  Input: { branch, class_levels, notification_prefs }
  Action: ogretmen tablosuna tercihler sütunu ekle
  Response: { success, tercihler }

GET /api/ogretmen/tercihler
  Action: Öğretmen tercihlerini getir
  Response: { branch, class_levels, ... }
```

**Veritabanı Değişikliği:**
```sql
ALTER TABLE ogretmen ADD COLUMN IF NOT EXISTS tercihler JSON;
-- Örnek: {"branch": "Matematik", "class_levels": [9,10], "notifications": true}
```

---

#### #3 Öğrenci Kazanım Raporu Öğretmen Paneline Ekle (Yüksek Etki)
```
Durum:  ⚠️ Backend API mevcut, frontend panel eksik
Risiko: 🟠 ORTA - Öğretmen öğrenci ilerlemesini tam izleyemiyor
```

**Nereyi Değiştir:**
- **Frontend**: `ogretmen-paneli.html` - öğrenci detay bölümüne kartı ekle

**Yeni Panel Kartı Ekle:**
```html
<!-- ogretmen-paneli.html öğrenci detay bölümüne ekle -->
<div class="card">
  <h2>📊 Kazanım Raporları</h2>
  <div id="kazanim-raporu">Yükleniyor...</div>
</div>
```

**Backend:** Zaten mevcut
- `routes/ogrenci-gelisim.js:274+` - Kazanım API'si
- GET `/api/ogrenci/:id/kazanimlar` → Zaten çalışıyor

**JavaScript İşlemi:**
```javascript
// ogretmen-paneli.html script kısmına ekle
async function loadKazanimRaporu(ogrenci_id) {
  const res = await fetch(`/api/ogrenci/${ogrenci_id}/kazanimlar`);
  const data = await res.json();
  // Render: Kazanım card'ları, ilerleme barları, vb.
}
```

---

### 🟡 ÖNEMLİ - Bu Ay Yapılmalı

#### #4 Çift "Canlı Dersi Sonlandır" Kontrolünü Birleştir
```
Durum:  ⚠️ Aynı fonksiyon 2 yerinde
Risiko: 🟠 ORTA - Kullanıcı karışıklığı
```

**Nereyi Değiştir:**
- **Frontend**: `ogretmen-paneli.html:1286-1291`
  - Kenar çubuk kontrolünü KALDIRIN
  - Tutarlılık için ders bölümünde saklayın

**Kod Değişikliği:**
```html
<!-- KALDIRINCA: ogretmen-paneli.html satır 1286-1291 -->
<!-- 
<button class="btn" onclick="endLiveLesson()">
  Canlı Dersi Sonlandır
</button>
Bunu SİL veya comment'e al
-->

<!-- Tutarlılık için: Ders bölümünde kontrol saklayın (936-937) -->
```

---

#### #5 Bildirim Ayarlarını Aktif Hale Getir
```
Durum:  ⚠️ Ayar var, sistem uygulamıyor
Risiko: 🟠 ORTA - Bildirimler varsayılan ayarlara göre geliyor
```

**Nereyi Değiştir:**
- **Frontend**: `ogretmen-paneli.html` & `ogrenci-paneli.html` tercihler formları
- **Backend**: `routes/admin.js` veya bildirim sistemi

**Çözüm Adımları:**
1. Öğretmen & öğrenci tercihlerini sunucuya kaydet (yukarıda #2'yi yapın)
2. Bildirim gönderme sırasında tercihler kontrol et

---

### 🟢 DÜŞÜK ÖNCELİK - Sonraki Sprint

#### #6 Öğrenci Test Menüsünü Netleştir
```
Durum:  🟢 Çalışıyor ama etiketler karışık
Risiko: 🟢 DÜŞÜK - UX improvement
```

**Nereyi Değiştir:**
- **Frontend**: `ogrenci-paneli.html:367-370, 397-409`

**Önerilen Etiketler:**
```
Şu: "Sınav ve testlerim"      → "Benim Testlerim"
Şu: "Öğretmen testleri"       → "Öğretmen Testleri"
Şu: "Deneme sınavları"        → "Deneme Sınavları"
```

---

#### #7 Yerel Depolama Uyarıları Ekleme
```
Durum:  ℹ️ Kullanıcı deneyimi
Risiko: 🟢 DÜŞÜK - Önleme amaçlı
```

**Nereyi Değiştir:**
- `ogretmen-paneli.html:1328-1341` (Sınav planı)
- `ogretmen-paneli.html:1244-1258` (Tercihler)

**Eklenecek Element:**
```html
<div class="info-box">
  <svg>⚠️</svg>
  <small>
    Bu veriler yalnızca bu tarayıcıda tutulacaktır. 
    Öğrencilere göstermek için... (link/button)
  </small>
</div>
```

---

## 📊 Veri Akışı Kontrol Listesi

Aşağıdaki tabloyu kontrol edin. Tüm hücrelerde ✅ olmalı:

| Veri Türü | Backend API | Frontend Panel | Synced? | Status |
|-----------|---|---|---|---|
| Ödev Atama | ✅ Var | ✅ Var | ✅ Tamam | 🟢 Ready |
| Canlı Ders | ✅ Var | ✅ Var | ✅ Tamam | 🟢 Ready |
| Test/Quiz | ✅ Var | ✅ Var | ✅ Tamam | 🟢 Ready |
| Öğrenci Kazanımı | ✅ Var | ⚠️ Kısmi | ⚠️ Kısmi | 🟡 To Do: Öğretmen panele ekle |
| Sınav Planı | ❌ Yok | ✅ Var | ❌ Yok | 🔴 To Do: Backend yap |
| Öğretmen Tercihleri | ❌ Yok | ✅ Var | ❌ Yok | 🔴 To Do: Backend yap |
| Bildirim Ayarları | ⚠️ Var | ✅ Var | ❌ Yok | 🔴 To Do: Aktif et |

---

## 🛠️ Teknik Referans

### Backend Dosyaları (Değiştirilecek/Oluşturulacak)

```
routes/ogretmen-ogrenci-odev.js  ← Sınav planı API'si ekle
routes/auth.js                   ← Tercihler API'si ekle (veya yeni dosya)
models/ogretmen.js               ← tercihler field'ı ekle
```

### Frontend Dosyaları (Değiştirilecek)

```
ogretmen-paneli.html:1328-1341   ← Sınav planı formu API'ye bağla
ogretmen-paneli.html:1244-1258   ← Tercihler formu API'ye bağla
ogretmen-paneli.html:1286-1291   ← Çift kontrolü kaldır
ogretmen-paneli.html (gövde)     ← Kazanım raporu kartı ekle
ogrenci-paneli.html:367-370      ← Test menü etiketlerini düzenle
ogrenci-paneli.html:397-409      ← Test menü etiketlerini düzenle
```

### SQL Migration (Veritabanı)

```sql
-- Öğretmen tercihlerini ekle
ALTER TABLE ogretmen ADD COLUMN tercihler JSON DEFAULT NULL;

-- Sınav planı tablosu (yeni)
CREATE TABLE IF NOT EXISTS sinav_plani (
  id UUID PRIMARY KEY,
  ogretmen_id UUID REFERENCES ogretmen(id),
  tarih DATE,
  baslik VARCHAR(255),
  test_id UUID,
  not_ekle TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bildirim tercihleri (varsa, aktif et)
-- ALTER TABLE ogretmen ADD COLUMN bildirim_tercih JSON DEFAULT NULL;
```

---

## 🎯 Kontrol Şekli (Verification)

Her değişiklikten sonra bu adımları yapın:

✅ **#1 Sınav Planı (Sonrası Kontrol)**
```
1. Öğretmen: "Sınavı takvime ekle" → Form doldur → Kaydet
2. Veritabanı: SELECT * FROM sinav_plani → Veri görünmeli
3. Öğrenci: Takvimi aç → Sınav görünmeli
```

✅ **#2 Öğretmen Tercihleri (Sonrası Kontrol)**
```
1. Öğretmen: Tercihler formunu doldur → Kaydet
2. Veritabanı: SELECT tercihler FROM ogretmen → JSON görünmeli
3. Yeniden giriş: Ayarlar hatırlanmalı (başka cihazdan da)
```

✅ **#3 Kazanım Raporu (Sonrası Kontrol)**
```
1. Öğretmen: Öğrenci detayını aç
2. Frontend: "Kazanım Raporları" kartı görünmeli
3. API: Kartlar popüle edilmeli (tarama yapıp göster)
```

---

## 📋 Kod Kütüphanesi (Copy-Paste Ready)

### Frontend JS (Form → API)

```javascript
// ogretmen-paneli.html script kısmına ekle
async function saveSinavPlani() {
  const form = document.getElementById('sinav-plani-form');
  const data = {
    tarih: form.tarih.value,
    baslik: form.baslik.value,
    test_id: form.test_id.value,
    not_ekle: form.not_ekle.value
  };
  
  const res = await fetch('/api/ogretmen/sinav-plani', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (res.ok) {
    alert('Sınav planı kaydedildi!');
    form.reset();
  } else {
    alert('Hata: ' + res.statusText);
  }
}
```

### Backend JS (API Rotası)

```javascript
// routes/ogretmen-ogrenci-odev.js
app.post('/api/ogretmen/sinav-plani', authenticateTeacher, async (req, res) => {
  try {
    const { tarih, baslik, test_id, not_ekle } = req.body;
    const ogretmen_id = req.user.id;
    
    const sonuc = await db.query(
      `INSERT INTO sinav_plani (ogretmen_id, tarih, baslik, test_id, not_ekle)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ogretmen_id, tarih, baslik, test_id, not_ekle]
    );
    
    res.json({ success: true, sinav: sonuc.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

---

## ⚠️ Dikkat Edilecek Noktalar

1. **Veri Tablosu Güvenliği**: 
   - Öğretmen kendi sınav planını görebilmeli
   - Öğrenci yalnızca atanmış sınavları görebilmeli
   - Rolü kontrol et: `authenticateTeacher`, `authenticateStudent`

2. **Frontend Spinner/Loading**:
   - Form submission sırasında "Kaydediliyor..." göster
   - Error handling: "Veri kaydedilmedi, lütfen yeniden dene"

3. **Migration & Testing**:
   - Veritabanı değişiklikleri önce test ortamında yap
   - Mevcut verileri etkilemediğini kontrol et

4. **UI Uyarısı**:
   - Kullanıcıya "Bu veri nereye kaydediliyor?" açıkça söyle
   - Yerel depolama vs. sunucu depolama farkını vurgula

---

## 📞 İlgili Dosyalar

| Dosya | Amaç | Durum |
|-------|------|-------|
| ogrenci-paneli.html | Öğrenci arayüzü | 📌 Referans |
| ogretmen-paneli.html | Öğretmen arayüzü | ⚠️ Değiştirilecek |
| routes/ogretmen-ogrenci-odev.js | Ödev backend | ✅ Var, genişlet |
| routes/ogrenci-gelisim.js | Kazanım backend | ✅ Var, bağla |
| routes/auth.js | Kimlik backend | ⚠️ Tercihler ekle |
| models/ogretmen.js | Öğretmen schema | ⚠️ Alan ekle |

---

## 📝 Son Notlar

- **Toplam Çalışma**: ~2-3 gün (tüm maddeleri yaparsanız)
- **Acil Çalışma**: ~1 gün (#1-3)
- **Test Kapsamı**: Öğretmen & Öğrenci akışının tam olması
- **Kullanıcı Bildirimi**: Deploy sonrası "Yeni özellikler" duyurusu

---

**Hazırlayan**: Copilot Audit Agent  
**Tarih**: 20 Kasım 2026  
**Versiyon**: 1.0  
**Durum**: ✅ Hazır Uygulanabilir
