(() => {
  const $ = id => document.getElementById(id);
  const form = $('solvedQuestionForm');
  const grade = $('solvedGrade');
  const topic = $('solvedTopic');
  const message = $('solvedMsg');
  const list = $('solvedList');
  let topics = [];
  let requestId = 0;

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mesaj || 'İşlem tamamlanamadı.');
    return data;
  }

  function showList(sorular) {
    list.replaceChildren();
    if (!sorular.length) {
      list.textContent = 'Bu sınıfa henüz çözümlü soru eklenmedi.';
      return;
    }
    sorular.forEach(soru => {
      const row = document.createElement('div');
      row.className = 'announcement';
      const label = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = soru.baslik;
      const detail = document.createElement('p');
      detail.textContent = `${soru.unite} · ${soru.konu}`;
      const preview = document.createElement('a');
      preview.href = `/api/cozumlu-sorular/${encodeURIComponent(soru.id)}/resim`;
      preview.target = '_blank';
      preview.rel = 'noopener';
      preview.textContent = 'Görseli aç';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn sm danger';
      del.textContent = 'Sil';
      del.addEventListener('click', async () => {
        if (!confirm('Bu çözümlü soru silinsin mi?')) return;
        del.disabled = true;
        try {
          const result = await request(`/api/admin/cozumlu-sorular/${encodeURIComponent(soru.id)}`, { method: 'DELETE' });
          if (await load()) message.textContent = result.mesaj;
        } catch (error) {
          message.textContent = error.message;
          del.disabled = false;
        }
      });
      label.append(title, detail, preview);
      row.append(label, del);
      list.append(row);
    });
  }

  async function load() {
    const current = ++requestId;
    const selectedGrade = grade.value;
    topics = [];
    topic.replaceChildren(new Option('Konular yükleniyor…', ''));
    topic.disabled = true;
    $('solvedSave').disabled = true;
    list.textContent = 'Sorular yükleniyor…';
    message.textContent = '';
    $('solvedRetry').hidden = true;
    try {
      const [curriculum, data] = await Promise.all([
        request(`/api/mufredat-konulari?grade=${encodeURIComponent(selectedGrade)}`),
        request(`/api/admin/cozumlu-sorular?grade=${encodeURIComponent(selectedGrade)}`)
      ]);
      if (current !== requestId) return false;
      if (!Array.isArray(curriculum.konular) || !Array.isArray(data.sorular)) throw new Error('Sunucudan geçersiz veri alındı.');
      topics = curriculum.konular;
      topic.replaceChildren(new Option(topics.length ? 'Konu seçin' : 'Bu sınıfta konu bulunamadı', ''));
      topics.forEach((item, index) => topic.add(new Option(`${item.unite} — ${item.dosya_adi}`, String(index))));
      topic.disabled = !topics.length;
      $('solvedSave').disabled = !topics.length;
      showList(data.sorular);
      return true;
    } catch (error) {
      if (current !== requestId) return false;
      topic.replaceChildren(new Option('Konular yüklenemedi', ''));
      list.textContent = '';
      message.textContent = `${error.message} Yeniden yüklemeyi deneyin.`;
      $('solvedRetry').hidden = false;
      return false;
    }
  }

  grade.addEventListener('change', load);
  $('solvedRetry').addEventListener('click', load);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const selected = topic.value === '' ? null : topics[Number(topic.value)];
    if (!selected) {
      message.textContent = 'Bir müfredat konusu seçin.';
      return;
    }
    const data = new FormData(form);
    data.set('unite', selected.unite);
    data.set('konu', selected.dosya_adi);
    $('solvedSave').disabled = true;
    message.textContent = 'Görsel yükleniyor…';
    try {
      const result = await request('/api/admin/cozumlu-sorular', { method: 'POST', body: data });
      $('solvedTitle').value = '';
      $('solvedImage').value = '';
      if (await load()) message.textContent = result.mesaj;
    } catch (error) {
      message.textContent = error.message;
      $('solvedSave').disabled = false;
    }
  });
  window.solvedQuestionsAdmin = { load };
})();
