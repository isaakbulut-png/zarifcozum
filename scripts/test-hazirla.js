const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
// Kendi modelinizin yolunu buraya ekleyin (Örn: models klasöründeki Soru şeması)
const Soru = require('../models/Soru'); 

// 1. MongoDB Atlas Bağlantısı (Buraya kendi MongoDB Bağlantı Linkinizi Yapıştırın)
const MONGO_URI = "mongodb+srv://kullanici:sifre@cluster0.xxxxx.mongodb.net/zarifcozum";

async function otomatikSorulariYukle() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("MongoDB Atlas bağlantısı başarılı!");

        const sorularKlasoru = path.join(__dirname, '../public/images/sorular');
        const dosyalar = fs.readdirSync(sorularKlasoru);

        const eklenecekSorular = [];

        dosyalar.forEach((dosya) => {
            if (dosya.endsWith('.png') || dosya.endsWith('.jpg') || dosya.endsWith('.jpeg')) {
                // Dosya adından soru adını ve dersi tahmin et (Örn: matematik-soru1.png -> Matematik)
                const dosyaAdi = path.parse(dosya).name;
                const dersAdi = dosyaAdi.split('-')[0]; 

                // Resmin internet adresi
                const resimUrl = `https://zarifcozum.com{dosya}`;

                eklenecekSorular.push({
                    ders: dersAdi.charAt(0).toUpperCase() + dersAdi.slice(1),
                    soruMetni: `${dosyaAdi} için soruyu çözünüz.`,
                    gorselUrl: resimUrl,
                    secenekler: ["A", "B", "C", "D", "E"], // Şablon seçenekler
                    dogruCevap: "A" // Varsayılan doğru cevap (Siz panelden güncelleyebilirsiniz)
                });
            }
        });

        if (eklenecekSorular.length > 0) {
            // Veri tabanına toplu ekleme yap (Aynı soruların tekrar eklenmesini önlemek için mantık kurulabilir)
            await Soru.insertMany(eklenecekSorular);
            console.log(`🚀 Başarılı! ${eklenecekSorular.length} adet soru otomatik olarak MongoDB Atlas'a yüklendi.`);
        } else {
            console.log("Klasörde yüklenecek yeni resim bulunamadı.");
        }

    } catch (hata) {
        console.error("Hata oluştu:", hata);
    } finally {
        mongoose.connection.close();
    }
}

otomatikSorulariYukle();
