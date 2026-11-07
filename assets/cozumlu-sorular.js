(() => {
  const $ = id => document.getElementById(id);
  const grade = $('grade-filter');
  const unit = $('unit-filter');
  const search = $('search-input');
  const cards = $('cards');
  const status = $('topics-status');
  const solutions = $('solutions');
  const solutionList = $('solutions-list');
  let topics = [];
  let counts = new Map();
  let loadId = 0;
  let solutionId = 0;
  const key = (unite, konu) => JSON.stringify([unite, konu]);

  async function get(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.mesaj || 'Veriler alınamadı.');
      error.code = data.kod;
      throw error;
    }
    return data;
  }

  function closeSolutions() {
    solutionId++;
    solutions.hidden = true;
    solutionList.replaceChildren();
    $('solutions-status').textContent = '';
  }

  async function openTopic(topic, count) {
    const current = ++solutionId;
    const selectedGrade = grade.value;
    solutions.hidden = false;
    $('solutions-title').textContent = topic.dosya_adi;
    $('solutions-status').textContent = count ? 'Çözümlü sorular yükleniyor…' : 'Henüz çözümlü soru eklenmedi.';
    solutionList.replaceChildren();
    solutions.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!count) return;
    const params = new URLSearchParams({ grade: selectedGrade, unite: topic.unite, konu: topic.dosya_adi });
    try {
      const data = await get(`/api/cozumlu-sorular?${params}`);
      if (current !== solutionId) return;
      if (!Array.isArray(data.sorular)) throw new Error('Soru listesi geçersiz.');
      $('solutions-status').textContent = data.sorular.length ? '' : 'Henüz çözümlü soru eklenmedi.';
      data.sorular.forEach(soru => {
        const article = document.createElement('article');
        const title = document.createElement('h3');
        title.textContent = soru.baslik;
        const image = document.createElement('img');
        image.src = `/api/cozumlu-sorular/${encodeURIComponent(soru.id)}/resim`;
        image.alt = `${soru.baslik} soru ve çözüm görseli`;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
          image.hidden = true;
          const error = document.createElement('p');
          error.textContent = 'Görsel yüklenemedi. Oturumunuzu ve bağlantınızı kontrol edin.';
          article.append(error);
        });
        article.append(title, image);
        solutionList.append(article);
      });
    } catch (error) {
      if (current !== solutionId) return;
      if (error.code === 'UYELIK_GEREKLI') {
        $('solutions-status').textContent = 'Çözümlü soruları görmek için üye olun veya giriş yapın.';
        const link = document.createElement('a');
        link.href = '/kayit-giris.html';
        link.textContent = 'Giriş yap / Üye ol';
        solutionList.append(link);
      } else {
        $('solutions-status').textContent = `${error.message} Konuya yeniden tıklayarak tekrar deneyin.`;
      }
    }
  }

  function render() {
    const term = search.value.trim().toLocaleLowerCase('tr-TR');
    const filtered = topics.filter(item =>
      (!unit.value || item.unite === unit.value) &&
      `${item.unite} ${item.dosya_adi}`.toLocaleLowerCase('tr-TR').includes(term));
    cards.replaceChildren();
    $('result-count').textContent = `${filtered.length} konu`;
    status.textContent = filtered.length ? '' : 'Bu seçimde konu bulunamadı.';
    filtered.forEach(item => {
      const count = counts.get(key(item.unite, item.dosya_adi)) || 0;
      const article = document.createElement('article');
      article.className = 'card';
      const body = document.createElement('div');
      body.className = 'card-body';
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = `${grade.value}. sınıf · Matematik`;
      const title = document.createElement('h3');
      title.textContent = item.dosya_adi;
      const description = document.createElement('p');
      description.className = 'card-summary';
      description.textContent = item.unite;
      const foot = document.createElement('div');
      foot.className = 'card-foot';
      const detail = document.createElement('small');
      detail.textContent = count ? `${count} çözümlü soru` : 'Henüz çözümlü soru eklenmedi.';
      const button = document.createElement('button');
      button.className = 'open-button';
      button.type = 'button';
      button.textContent = count ? 'Soruları incele ↗' : 'Konuyu incele ↗';
      button.addEventListener('click', () => {
        if (!count) {
          window.location.assign('/kayit-giris.html?mode=register');
          return;
        }
        openTopic(item, count);
      });
      foot.append(detail, button);
      body.append(tag, title, description, foot);
      article.append(body);
      cards.append(article);
    });
  }

  async function load() {
    const current = ++loadId;
    closeSolutions();
    topics = [];
    counts = new Map();
    cards.replaceChildren();
    unit.replaceChildren(new Option('Tüm üniteler', ''));
    unit.disabled = true;
    $('result-count').textContent = '';
    $('retry-topics').hidden = true;
    status.textContent = 'Müfredat konuları yükleniyor…';
    try {
      const [curriculum, data] = await Promise.all([
        get(`/api/mufredat-konulari?grade=${encodeURIComponent(grade.value)}`),
        get(`/api/cozumlu-sorular/sayilar?grade=${encodeURIComponent(grade.value)}`)
      ]);
      if (current !== loadId) return;
      if (!Array.isArray(curriculum.konular) || !Array.isArray(data.sayilar)) throw new Error('Sunucudan geçersiz veri alındı.');
      topics = curriculum.konular;
      data.sayilar.forEach(item => counts.set(key(item.unite, item.konu), item.adet));
      [...new Set(topics.map(item => item.unite))].forEach(name => unit.add(new Option(name, name)));
      unit.disabled = false;
      render();
    } catch (error) {
      if (current !== loadId) return;
      status.textContent = error.message;
      $('retry-topics').hidden = false;
    }
  }
  grade.addEventListener('change', load);
  unit.addEventListener('change', () => { closeSolutions(); render(); });
  search.addEventListener('input', () => { closeSolutions(); render(); });
  $('retry-topics').addEventListener('click', load);
  $('year').textContent = new Date().getFullYear();
  load();
})();
