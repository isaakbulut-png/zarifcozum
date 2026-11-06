(function () {
  window.ogretmenCanliYonetimi = function ({ api, bilgi, islemler, hata, sonlandir, onSonlandir }) {
    let islemSuruyor = false;
    let istekNo = 0;

    async function yenile() {
      const buIstek = ++istekNo;
      try {
        const durum = await api('/api/ogretmen/canli/ozet');
        if (buIstek !== istekNo || islemSuruyor) return;
        bilgi.textContent = durum.aktif
          ? `Kayıtlı canlı ders: ${durum.topic || 'Canlı ders'} (Toplantı no: ${durum.meetingNumber || '—'})`
          : 'Kayıtlı aktif canlı ders yok.';
        islemler.hidden = !durum.aktif;
        hata.textContent = '';
      } catch (error) {
        if (buIstek !== istekNo || islemSuruyor) return;
        hata.textContent = 'Canlı ders durumu alınamadı: ' + error.message;
      }
    }

    sonlandir.addEventListener('click', async () => {
      if (!window.confirm('Mevcut canlı dersi sonlandırmak istiyor musunuz?')) return;
      islemSuruyor = true;
      ++istekNo;
      sonlandir.disabled = true;
      hata.textContent = '';
      try {
        await api('/api/ogretmen/canli/sonlandir', { method: 'POST' });
        bilgi.textContent = 'Canlı ders sonlandırıldı.';
        islemler.hidden = true;
        try {
          await onSonlandir();
        } catch (error) {
          hata.textContent = 'Ders sonlandırıldı, ancak planlı ders listesi yenilenemedi: ' + error.message;
        }
      } catch (error) {
        hata.textContent = 'Ders sonlandırılamadı: ' + error.message;
      } finally {
        ++istekNo;
        islemSuruyor = false;
        sonlandir.disabled = false;
      }
    });

    return { yenile };
  };
})();
