(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const KIND = {'canli-ders': 'Canlı ders', odev: 'Ödev', gorusme: 'Öğretmen görüşmesi', sinav: 'Sınav', hatirlatma: 'Hatırlatıcı'};
  const DAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
  const STATUS_LABEL = {yok: 'Başlanmadı', devam: 'Devam ediyor', tamamlandi: 'Tamamlandı', eksik: 'Eksik'};
  const localDay = value => new Date(value).toLocaleDateString('sv-SE', {timeZone: 'Europe/Istanbul'});
  const fmtDate = value => new Date(value).toLocaleDateString('tr-TR', {day: 'numeric', month: 'long', weekday: 'long'});
  const fmtShort = value => new Date(value).toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'});
  const fmtTime = value => new Date(value).toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
  const fmtMin = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)} sa ${minutes % 60} dk` : `${minutes || 0} dk`;
  const empty = message => `<p class="gz-empty">${esc(message)}</p>`;

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', ...(options.headers || {})}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.mesaj || `Sunucu hatası (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function bars(items, maxValue) {
    const max = Math.max(maxValue || 0, ...items.map(item => item.value), 1);
    return `<div class="gz-bars">${items.map(item => `<div class="gz-bar${item.today ? ' is-today' : ''}${item.tone ? ` tone-${item.tone}` : ''}" title="${esc(item.title || '')}">
      <b>${esc(item.top ?? '')}</b><span style="height:${Math.max(item.value ? 4 : 0, Math.round(item.value * 100 / max))}%"></span><small>${esc(item.label)}</small></div>`).join('')}</div>`;
  }

  function kpiHtml(ozet) {
    const goal = ozet.haftalikHedef;
    const goalPct = goal ? Math.min(100, Math.round(ozet.haftalikDakika * 100 / goal)) : 0;
    const change = ozet.testBasarisi.degisim;
    return `<div class="gz-kpis">
      <article class="gz-kpi"><span>Günlük çalışma</span><strong>${esc(fmtMin(ozet.bugunDakika))}</strong><small>${ozet.bugunDakika ? 'Bugün kaydedildi' : 'Bugün henüz çalışma girilmedi'}</small></article>
      <article class="gz-kpi"><span>Haftalık hedef</span><strong>${goal ? `${esc(fmtMin(ozet.haftalikDakika))} <em>/ ${esc(fmtMin(goal))}</em>` : '—'}</strong>
        ${goal ? `<div class="gz-progress"><i style="width:${goalPct}%"></i></div><small>%${goalPct} tamamlandı</small>` : '<small>Henüz hedef belirlenmedi</small>'}</article>
      <article class="gz-kpi"><span>Test başarısı</span><strong>${ozet.testBasarisi.ortalama === null ? '—' : `%${ozet.testBasarisi.ortalama}`}</strong>
        <small>${change === null ? `${ozet.testBasarisi.sayi} test çözüldü` : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)} puan (önceki 10 teste göre)`}</small></article>
      <article class="gz-kpi"><span>Çalışma serisi</span><strong>${ozet.seri} <em>gün</em></strong><small>${ozet.bugunDakika ? 'Seri bugün de devam ediyor' : ozet.seri ? 'Bugün çalışırsan seri sürer' : 'Bugün yeni seri başlat'}</small></article>
      <article class="gz-kpi"><span>Tamamlanan konu</span><strong>${ozet.tamamlananKonu}</strong><small>${ozet.eksikKonu} eksik kazanım</small></article>
    </div>`;
  }

  function weekHtml(ozet) {
    const perDay = ozet.haftalikHedef ? Math.round(ozet.haftalikHedef / 7) : 0;
    return bars(ozet.hafta.map((day, index) => ({
      value: day.dakika, top: day.dakika || '', label: DAYS[index], today: day.bugun,
      title: `${fmtShort(day.gun)} · ${fmtMin(day.dakika)}`
    })), perDay);
  }

  function upcomingHtml(events) {
    const now = Date.now();
    const next = events.filter(item => new Date(item.startsAt).getTime() >= now && !item.tamamlandi).slice(0, 4);
    return next.length ? `<ul class="gz-list">${next.map(item => `<li><span class="gz-chip kind-${esc(item.kind)}">${esc(KIND[item.kind] || item.kind)}</span>
      <div><strong>${esc(item.title)}</strong><small>${esc(fmtShort(item.startsAt))} · ${esc(fmtTime(item.startsAt))}</small></div></li>`).join('')}</ul>` : empty('Yaklaşan etkinlik yok.');
  }

  function homeworkChips(odev) {
    return `<div class="gz-chips"><span class="gz-chip">${odev.toplam} ödev</span><span class="gz-chip ok">${odev.tamamlanan} tamamlanan</span>
      <span class="gz-chip warn">${odev.bekleyen} bekleyen</span>${odev.geciken ? `<span class="gz-chip bad">${odev.geciken} geciken</span>` : ''}</div>`;
  }

  function logListHtml(kayitlar, canDelete) {
    return kayitlar.length ? `<ul class="gz-list">${kayitlar.map(item => `<li><div><strong>${esc(fmtMin(item.dakika))}</strong>${item.konu ? ` · ${esc(item.konu)}` : ''}
      <small>${esc(fmtShort(item.gun))}${item.not ? ` · ${esc(item.not)}` : ''}</small></div>
      ${canDelete ? `<button class="gz-link" type="button" data-gz-delete-log="${esc(item.id)}">Sil</button>` : ''}</li>`).join('')}</ul>` : empty('Henüz çalışma kaydı yok.');
  }

  function kazanimHtml(grade, records, editable) {
    const units = (window.MATEMATIK_MUFREDATI || {})[grade] || [];
    if (!units.length) return empty(`${grade}. sınıf için müfredat bulunamadı.`);
    const byKey = new Map(records.filter(row => row.grade === Number(grade)).map(row => [`${row.unit}||${row.topic}`, row]));
    const total = units.reduce((sum, unit) => sum + unit.topics.length, 0);
    const done = [...byKey.values()].filter(row => row.status === 'tamamlandi').length;
    const missing = [...byKey.values()].filter(row => row.status === 'eksik');
    return `<div class="gz-summary"><strong>%${total ? Math.round(done * 100 / total) : 0}</strong> kazanım tamamlandı <small>(${done}/${total})</small>
      <div class="gz-progress"><i style="width:${total ? Math.round(done * 100 / total) : 0}%"></i></div></div>
      ${missing.length ? `<div class="gz-alert"><b>Eksik kazanımlar (${missing.length})</b><ul>${missing.map(row => `<li>${esc(row.topic)} <small>· ${esc(row.unit)}</small></li>`).join('')}</ul></div>` : ''}
      ${units.map((unit, unitIndex) => {
        const unitDone = unit.topics.filter(topic => byKey.get(`${unit.title}||${topic}`)?.status === 'tamamlandi').length;
        const pct = Math.round(unitDone * 100 / unit.topics.length);
        return `<details class="gz-unit"${unitIndex === 0 ? ' open' : ''}><summary><span>${esc(unit.title)}</span><b>%${pct}</b></summary>
          <div class="gz-progress"><i style="width:${pct}%"></i></div>
          ${unit.topics.map((topic, topicIndex) => {
            const row = byKey.get(`${unit.title}||${topic}`);
            const status = row?.status || 'yok';
            return `<div class="gz-topic status-${status}"><span>${esc(topic)}${row?.updatedBy === 'teacher' ? ' <small>· öğretmen işaretledi</small>' : ''}</span>
              ${editable ? `<select data-gz-kazanim data-grade="${esc(grade)}" data-u="${unitIndex}" data-t="${topicIndex}" aria-label="${esc(topic)} durumu">
                ${Object.entries(STATUS_LABEL).map(([value, label]) => `<option value="${value}"${value === status ? ' selected' : ''}>${label}</option>`).join('')}</select>`
                : `<em>${STATUS_LABEL[status]}</em>`}</div>`;
          }).join('')}</details>`;
      }).join('')}`;
  }

  function testsHtml(data) {
    const {testler, ozet} = data;
    if (!testler.length) return empty('Henüz çözülmüş test veya deneme yok.');
    const recent = testler.slice(0, 12).reverse();
    return `<div class="gz-chips"><span class="gz-chip">${ozet.toplam} test</span>
      <span class="gz-chip">Kazanım testi ort.: ${ozet.kazanimOrtalama === null ? '—' : `%${ozet.kazanimOrtalama}`}</span>
      <span class="gz-chip">Deneme ort.: ${ozet.denemeOrtalama === null ? '—' : `%${ozet.denemeOrtalama}`}</span>
      <span class="gz-chip ok">${ozet.dogru} doğru</span><span class="gz-chip bad">${ozet.yanlis} yanlış</span><span class="gz-chip">${ozet.bos} boş</span></div>
      <h4 class="gz-sub">Son sonuçlar</h4>
      ${bars(recent.map(item => ({value: item.score || 0, top: item.score === null ? '' : `%${item.score}`, label: fmtShort(item.createdAt), tone: item.type === 'deneme' ? 'alt' : '', title: item.title})), 100)}
      <p class="gz-legend"><i></i> Kazanım testi <i class="alt"></i> Deneme sınavı</p>
      <div class="gz-table-wrap"><table class="gz-table"><thead><tr><th>Tür</th><th>Test</th><th>Puan</th><th>D / Y / B</th><th>Tarih</th></tr></thead>
      <tbody>${testler.map(item => `<tr><td>${item.type === 'deneme' ? 'Deneme' : 'Kazanım'}</td><td>${esc(item.title)}</td><td>${item.score === null ? '—' : `%${item.score}`}</td>
        <td>${item.dogru} / ${item.yanlis} / ${item.bos}</td><td>${esc(new Date(item.createdAt).toLocaleDateString('tr-TR'))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function calendarHtml(events) {
    if (!events.length) return empty('Önümüzdeki 60 gün için takvim kaydı yok.');
    const groups = new Map();
    events.forEach(item => {
      const key = localDay(item.startsAt);
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    const now = Date.now();
    return [...groups].map(([, items]) => `<section class="gz-day"><h4>${esc(fmtDate(items[0].startsAt))}</h4>
      <ul class="gz-list">${items.map(item => `<li class="${new Date(item.startsAt).getTime() < now ? 'is-past' : ''}">
        <span class="gz-chip kind-${esc(item.kind)}">${esc(KIND[item.kind] || item.kind)}</span>
        <div><strong>${esc(item.title)}</strong><small>${esc(fmtTime(item.startsAt))}${item.note ? ` · ${esc(item.note)}` : ''}${item.status ? ` · ${esc(item.status)}` : ''}</small></div>
        ${item.link ? `<a class="gz-link" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">Derse katıl</a>` : ''}
        ${item.deletable ? `<button class="gz-link" type="button" data-gz-delete-event="${esc(item.id)}">Sil</button>` : ''}</li>`).join('')}</ul></section>`).join('');
  }

  function commentsHtml(report, teacher) {
    const comments = report.yorumlar.filter(item => item.tur === 'yorum');
    const reports = report.yorumlar.filter(item => item.tur === 'rapor');
    const row = item => `<article class="gz-comment"><header><strong>${esc(item.ogretmen)}</strong><small>${esc(new Date(item.createdAt).toLocaleDateString('tr-TR'))}</small></header>
      <p>${esc(item.metin)}</p>
      ${item.ozet ? `<div class="gz-chips"><span class="gz-chip">Haftalık: ${esc(fmtMin(item.ozet.haftalikDakika))}</span><span class="gz-chip">Test ort.: ${item.ozet.testOrtalama === null ? '—' : `%${item.ozet.testOrtalama}`}</span>
        <span class="gz-chip">Seri: ${item.ozet.seri} gün</span><span class="gz-chip">Tamamlanan konu: ${item.ozet.tamamlananKonu}</span></div>` : ''}
      ${item.tur === 'rapor' ? `<div class="gz-chips"><span class="gz-chip ${item.veliDurumu === 'iletildi' ? 'ok' : 'warn'}">${item.veliDurumu === 'iletildi'
        ? `Veliye iletildi · ${esc(new Date(item.veliTarihi).toLocaleDateString('tr-TR'))}` : 'Veliye iletilmeyi bekliyor'}</span>
        ${teacher && item.veliDurumu !== 'iletildi' ? `<button class="gz-link" type="button" data-gz-guardian="${esc(item.id)}">Veliye iletildi olarak işaretle</button>` : ''}</div>` : ''}
      ${teacher ? `<button class="gz-link" type="button" data-gz-delete-comment="${esc(item.id)}">Sil</button>` : ''}</article>`;
    return `<h4 class="gz-sub">Öğretmen yorumları</h4>${comments.length ? comments.map(row).join('') : empty('Henüz öğretmen yorumu yok.')}
      <h4 class="gz-sub">Veliye gönderilen raporlar</h4>${reports.length ? reports.map(row).join('') : empty('Henüz veli raporu hazırlanmadı.')}`;
  }

  function reportHtml(report, teacher) {
    const lists = (title, items, tone) => `<div class="gz-card ${tone}"><h4>${title}</h4>${items.length
      ? `<ul class="gz-list">${items.map(item => `<li><div><strong>${esc(item.konu)}</strong><small>${esc(item.kaynak)}</small></div></li>`).join('')}</ul>` : empty('Henüz yeterli veri yok.')}</div>`;
    return `<h4 class="gz-sub">Haftalık gelişim (son 6 hafta)</h4>
      ${bars(report.haftalar.map(week => ({value: week.dakika, top: week.dakika ? fmtMin(week.dakika) : '', label: fmtShort(week.baslangic),
        title: `${week.testSayisi} test · ${week.testOrtalama === null ? 'test yok' : `ortalama %${week.testOrtalama}`} · ${week.teslimEdilenOdev} ödev teslimi`})), 0)}
      <div class="gz-table-wrap"><table class="gz-table"><thead><tr><th>Hafta</th><th>Çalışma</th><th>Test</th><th>Test ort.</th><th>Teslim edilen ödev</th></tr></thead><tbody>
      ${report.haftalar.map(week => `<tr><td>${esc(fmtShort(week.baslangic))}</td><td>${esc(fmtMin(week.dakika))}</td><td>${week.testSayisi}</td>
        <td>${week.testOrtalama === null ? '—' : `%${week.testOrtalama}`}</td><td>${week.teslimEdilenOdev}</td></tr>`).join('')}</tbody></table></div>
      <div class="gz-two">${lists('Güçlü konular', report.guclu, 'good')}${lists('Geliştirilecek konular', report.zayif, 'weak')}</div>
      <h4 class="gz-sub">Konu / ders bazlı ödev başarısı</h4>
      ${report.konuBasarisi.length ? `<ul class="gz-list">${report.konuBasarisi.map(item => `<li><div><strong>${esc(item.konu)}</strong><small>${item.sayi} değerlendirilmiş ödev</small></div>
        <b>%${item.ortalama}</b></li>`).join('')}</ul>` : empty('Değerlendirilmiş ödev bulunmuyor.')}
      ${commentsHtml(report, teacher)}`;
  }

  function mountStudent() {
    const root = document.getElementById('gzStudentRoot');
    if (!root) return;
    const $ = id => document.getElementById(id);
    const grades = Object.keys(window.MATEMATIK_MUFREDATI || {}).map(Number).sort((a, b) => a - b);
    const state = {grade: null, ozet: null, kazanimlar: [], testler: null, takvim: [], rapor: null};

    const status = (id, message, error = false) => {
      const element = $(id);
      if (!element) return;
      element.textContent = message;
      element.className = `gz-status${error ? ' error' : ''}`;
    };

    function render() {
      if (!state.ozet) return;
      const goalInput = $('gzGoalMinutes');
      $('gzKpis').innerHTML = kpiHtml(state.ozet);
      $('gzWeek').innerHTML = weekHtml(state.ozet);
      $('gzUpcoming').innerHTML = upcomingHtml(state.takvim);
      $('gzHomework').innerHTML = homeworkChips(state.ozet.odev);
      $('gzLogs').innerHTML = logListHtml(state.ozet.kayitlar, true);
      const latest = state.rapor?.yorumlar[0];
      $('gzLatestComment').innerHTML = latest ? `<article class="gz-comment"><header><strong>${esc(latest.ogretmen)}</strong><small>${esc(new Date(latest.createdAt).toLocaleDateString('tr-TR'))}</small></header><p>${esc(latest.metin)}</p></article>` : empty('Öğretmen yorumu bekleniyor.');
      if (goalInput && document.activeElement !== goalInput) goalInput.value = state.ozet.haftalikHedef || '';
      $('gzKazanim').innerHTML = kazanimHtml(state.grade, state.kazanimlar, true);
      if (state.testler) $('gzTestler').innerHTML = testsHtml(state.testler);
      $('gzTakvim').innerHTML = calendarHtml(state.takvim.map(item => ({...item, deletable: item.deletable && item.createdBy === 'student'})));
      if (state.rapor) $('gzRapor').innerHTML = reportHtml(state.rapor, false);
    }

    async function load() {
      try {
        const ozet = await api('/api/student/gelisim/ozet');
        state.grade = state.grade || (ozet.sinif && grades.includes(ozet.sinif) ? ozet.sinif : grades.includes(6) ? 6 : grades[0]);
        const gradeSelect = $('gzGrade');
        gradeSelect.innerHTML = grades.map(grade => `<option value="${grade}"${grade === state.grade ? ' selected' : ''}>${grade}. sınıf</option>`).join('');
        const [kazanim, testler, takvim, rapor] = await Promise.all([
          api(`/api/student/gelisim/kazanimlar?grade=${state.grade}`),
          api('/api/student/gelisim/testler'),
          api('/api/student/gelisim/takvim'),
          api('/api/student/gelisim/rapor')
        ]);
        Object.assign(state, {ozet, kazanimlar: kazanim.kazanimlar, testler, takvim: takvim.olaylar, rapor});
        render();
      } catch (error) {
        if (error.status === 401) return;
        $('gzKpis').innerHTML = `<p class="gz-status error">Gelişim verileri yüklenemedi: ${esc(error.message)}</p>`;
      }
    }

    async function run(statusId, action, success) {
      try {
        const result = await action();
        status(statusId, success || result?.mesaj || 'Kaydedildi.');
        await load();
        return true;
      } catch (error) {
        status(statusId, error.message, true);
        return false;
      }
    }

    document.addEventListener('submit', async event => {
      const form = event.target;
      if (form.id === 'gzStudyForm') {
        event.preventDefault();
        const data = new FormData(form);
        if (await run('gzStudyStatus', () => api('/api/student/gelisim/calisma', {method: 'POST', body: JSON.stringify({
          minutes: Number(data.get('minutes')), topic: data.get('topic'), day: data.get('day') || undefined
        })}))) form.reset();
      } else if (form.id === 'gzGoalForm') {
        event.preventDefault();
        await run('gzGoalStatus', () => api('/api/student/gelisim/hedef', {method: 'PUT', body: JSON.stringify({weeklyMinutes: Number($('gzGoalMinutes').value)})}));
      } else if (form.id === 'gzReminderForm') {
        event.preventDefault();
        const data = new FormData(form);
        const startsAt = new Date(data.get('startsAt'));
        if (!Number.isFinite(startsAt.getTime())) return status('gzReminderStatus', 'Geçerli bir tarih ve saat seçin.', true);
        if (await run('gzReminderStatus', () => api('/api/student/gelisim/hatirlatici', {method: 'POST', body: JSON.stringify({
          title: data.get('title'), note: data.get('note'), startsAt: startsAt.toISOString()
        })}))) form.reset();
      }
    });

    document.addEventListener('change', async event => {
      const select = event.target;
      if (select.id === 'gzGrade') {
        state.grade = Number(select.value);
        state.kazanimlar = (await api(`/api/student/gelisim/kazanimlar?grade=${state.grade}`)).kazanimlar;
        render();
      } else if (select.matches?.('[data-gz-kazanim]')) {
        const unit = window.MATEMATIK_MUFREDATI[select.dataset.grade][Number(select.dataset.u)];
        await run('gzKazanimStatus', () => api('/api/student/gelisim/kazanimlar', {method: 'PUT', body: JSON.stringify({
          grade: Number(select.dataset.grade), unit: unit.title, topic: unit.topics[Number(select.dataset.t)], status: select.value
        })}), 'Kazanım durumu kaydedildi.');
      }
    });

    document.addEventListener('click', async event => {
      const log = event.target.closest?.('[data-gz-delete-log]');
      const reminder = event.target.closest?.('[data-gz-delete-event]');
      if (log) await run('gzStudyStatus', () => api(`/api/student/gelisim/calisma/${encodeURIComponent(log.dataset.gzDeleteLog)}`, {method: 'DELETE'}));
      if (reminder) await run('gzReminderStatus', () => api(`/api/student/gelisim/hatirlatici/${encodeURIComponent(reminder.dataset.gzDeleteEvent)}`, {method: 'DELETE'}));
    });

    document.querySelector('[name="day"]')?.setAttribute('max', localDay(new Date()));
    load();
    window.addEventListener('zarif:gelisim-yenile', load);
  }

  function mountTeacher(host, studentId) {
    if (!host || !studentId) return;
    const base = `/api/ogretmen/gelisim/ogrenciler/${encodeURIComponent(studentId)}`;
    let data = null;
    const say = (message, error = false) => {
      const element = host.querySelector('[data-gz-status]');
      if (element) {
        element.textContent = message;
        element.className = `gz-status${error ? ' error' : ''}`;
      }
    };

    function render() {
      if (!data.bagli) {
        host.innerHTML = '<div class="gz"><h3>Gelişim takibi</h3><p class="gz-empty">Öğrenci hesabını davet koduyla bağladığında çalışma, kazanım, test ve takvim verileri burada görünür.</p></div>';
        return;
      }
      host.innerHTML = `<div class="gz"><h3>Gelişim takibi</h3><p class="gz-status" data-gz-status role="status"></p>
        ${kpiHtml(data.ozet)}${weekHtml(data.ozet)}
        <form class="gz-inline" data-gz-form="goal"><label>Haftalık hedef (dk)<input name="weeklyMinutes" type="number" min="30" max="4200" value="${data.ozet.haftalikHedef || ''}" required></label><button class="gz-btn" type="submit">Hedefi kaydet</button></form>
        <h4 class="gz-sub">Kazanım takibi · ${esc(data.sinif)}. sınıf</h4>${kazanimHtml(data.sinif, data.kazanimlar, true)}
        <h4 class="gz-sub">Sınav ve testler</h4>${testsHtml(data)}
        <h4 class="gz-sub">Takvim</h4>
        <form class="gz-inline" data-gz-form="event"><label>Tür<select name="kind"><option value="gorusme">Öğretmen görüşmesi</option><option value="sinav">Sınav</option></select></label>
          <label>Başlık<input name="title" maxlength="150" required></label><label>Tarih ve saat<input name="startsAt" type="datetime-local" required></label>
          <label>Not<input name="note" maxlength="500"></label><button class="gz-btn" type="submit">Takvime ekle</button></form>
        ${calendarHtml(data.takvim.map(item => ({...item, deletable: item.deletable && item.createdBy === 'teacher'})))}
        <h4 class="gz-sub">Başarı raporu ve yorumlar</h4>
        <form class="gz-inline gz-stack" data-gz-form="comment"><label>Tür<select name="type"><option value="yorum">Öğrenci yorumu</option><option value="rapor">Veli raporu (güncel özetle birlikte)</option></select></label>
          <label>Metin<textarea name="text" rows="3" maxlength="2000" required></textarea></label><button class="gz-btn" type="submit">Kaydet</button></form>
        <p class="gz-note">Veli raporları bu sistemde kayıt altına alınır; iletim e-posta/telefon ile siz yaparsınız ve “Veliye iletildi” olarak işaretlersiniz.</p>
        ${reportHtml(data.rapor, true)}</div>`;
    }

    async function reload() {
      data = await api(base);
      render();
    }

    async function act(request, success) {
      try {
        await request();
        await reload();
        say(success);
      } catch (error) {
        say(error.message, true);
      }
    }

    host.addEventListener('submit', event => {
      const form = event.target.closest('[data-gz-form]');
      if (!form) return;
      event.preventDefault();
      const values = new FormData(form);
      const type = form.dataset.gzForm;
      if (type === 'goal') act(() => api(`${base}/hedef`, {method: 'PUT', body: JSON.stringify({weeklyMinutes: Number(values.get('weeklyMinutes'))})}), 'Hedef kaydedildi.');
      if (type === 'event') {
        const startsAt = new Date(values.get('startsAt'));
        if (!Number.isFinite(startsAt.getTime())) return say('Geçerli bir tarih ve saat seçin.', true);
        act(() => api(`${base}/olaylar`, {method: 'POST', body: JSON.stringify({
          kind: values.get('kind'), title: values.get('title'), note: values.get('note'), startsAt: startsAt.toISOString()
        })}), 'Takvim kaydı eklendi.');
      }
      if (type === 'comment') act(() => api(`${base}/yorumlar`, {method: 'POST', body: JSON.stringify({type: values.get('type'), text: values.get('text')})}), 'Kaydedildi.');
    });

    host.addEventListener('change', event => {
      const select = event.target;
      if (!select.matches?.('[data-gz-kazanim]')) return;
      const unit = window.MATEMATIK_MUFREDATI[select.dataset.grade][Number(select.dataset.u)];
      act(() => api(`${base}/kazanim`, {method: 'PUT', body: JSON.stringify({
        grade: Number(select.dataset.grade), unit: unit.title, topic: unit.topics[Number(select.dataset.t)], status: select.value
      })}), 'Kazanım durumu güncellendi.');
    });

    host.addEventListener('click', event => {
      const eventButton = event.target.closest('[data-gz-delete-event]');
      const commentButton = event.target.closest('[data-gz-delete-comment]');
      const guardianButton = event.target.closest('[data-gz-guardian]');
      if (eventButton) act(() => api(`/api/ogretmen/gelisim/olaylar/${encodeURIComponent(eventButton.dataset.gzDeleteEvent)}`, {method: 'DELETE'}), 'Takvim kaydı silindi.');
      if (commentButton) act(() => api(`/api/ogretmen/gelisim/yorumlar/${encodeURIComponent(commentButton.dataset.gzDeleteComment)}`, {method: 'DELETE'}), 'Kayıt silindi.');
      if (guardianButton) act(() => api(`/api/ogretmen/gelisim/yorumlar/${encodeURIComponent(guardianButton.dataset.gzGuardian)}/veli`, {method: 'PATCH'}), 'Rapor veliye iletildi olarak işaretlendi.');
    });

    host.innerHTML = '<div class="gz"><p class="gz-empty">Gelişim verileri yükleniyor…</p></div>';
    reload().catch(error => { host.innerHTML = `<div class="gz"><p class="gz-status error">Gelişim verileri yüklenemedi: ${esc(error.message)}</p></div>`; });
  }

  window.ZarifGelisim = {mountTeacher};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountStudent);
  else mountStudent();
})();
