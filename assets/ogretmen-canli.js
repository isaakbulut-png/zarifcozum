(function () {
  window.ogretmenCanliYonetimi = function ({ api, gorunumler, onSonlandir }) {
    let islemSuruyor = false;
    let istekNo = 0;

    function guncelle(alan, ozellik, deger) {
      for (const gorunum of gorunumler) gorunum[alan][ozellik] = deger;
    }

    async function yenile() {
      const buIstek = ++istekNo;
      try {
        const durum = await api('/api/ogretmen/canli/ozet');
        if (buIstek !== istekNo || islemSuruyor) return;
        guncelle('bilgi', 'textContent', durum.aktif
          ? `Kayıtlı canlı ders: ${durum.topic || 'Canlı ders'} (Toplantı no: ${durum.meetingNumber || '—'})`
          : 'Kayıtlı aktif canlı ders yok.');
        guncelle('islemler', 'hidden', !durum.aktif);
        guncelle('hata', 'textContent', '');
      } catch (error) {
        if (buIstek !== istekNo || islemSuruyor) return;
        guncelle('hata', 'textContent', 'Canlı ders durumu alınamadı: ' + error.message);
      }
    }

    async function dersiSonlandir() {
      if (islemSuruyor) return;
      if (!window.confirm('Mevcut canlı dersi sonlandırmak istiyor musunuz?')) return;
      islemSuruyor = true;
      ++istekNo;
      guncelle('sonlandir', 'disabled', true);
      guncelle('hata', 'textContent', '');
      try {
        await api('/api/ogretmen/canli/sonlandir', { method: 'POST' });
        guncelle('bilgi', 'textContent', 'Canlı ders sonlandırıldı.');
        guncelle('islemler', 'hidden', true);
        try {
          await onSonlandir();
        } catch (error) {
          guncelle('hata', 'textContent', 'Ders sonlandırıldı, ancak planlı ders listesi yenilenemedi: ' + error.message);
        }
      } catch (error) {
        guncelle('hata', 'textContent', 'Ders sonlandırılamadı: ' + error.message);
      } finally {
        ++istekNo;
        islemSuruyor = false;
        guncelle('sonlandir', 'disabled', false);
      }
    }

    for (const gorunum of gorunumler) gorunum.sonlandir.addEventListener('click', dersiSonlandir);

    return { yenile };
  };
})();
