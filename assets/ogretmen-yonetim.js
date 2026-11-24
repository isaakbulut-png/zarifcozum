(() => {
  const STORAGE_KEY = 'zarifcozum.teacherWorkspace.v1';
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const grades = Array.from({length: 12}, (_, index) => index + 1);
  const curriculum = window.MATEMATIK_MUFREDATI || {};
  const createId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  let hasSavedProfile = false;
  let serverExams = [];
  const defaultState = () => ({
    students: [],
    assignments: [],
    content: [],
    documents: [],
    exams: [],
    customUnits: {},
    customTopics: {},
    profile: {name: '', branch: 'Matematik', grades: [], notifications: true}
  });

  let localWorkspaceLoaded = true;
  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return defaultState();
      hasSavedProfile = Boolean(saved.profile && typeof saved.profile === 'object');
      const initial = defaultState();
      if ((Array.isArray(saved.students) && saved.students.length) ||
          (Array.isArray(saved.assignments) && saved.assignments.length)) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({...saved, students: [], assignments: []}));
        } catch (error) {
          console.error('Eski öğrenci ve ödev kayıtları yerel depolamadan temizlenemedi:', error);
        }
      }
      return {
        ...initial,
        ...saved,
        students: [],
        assignments: [],
        content: Array.isArray(saved.content) ? saved.content : [],
        documents: Array.isArray(saved.documents) ? saved.documents : [],
        exams: Array.isArray(saved.exams) ? saved.exams : [],
        customUnits: saved.customUnits && typeof saved.customUnits === 'object' ? saved.customUnits : {},
        customTopics: saved.customTopics && typeof saved.customTopics === 'object' ? saved.customTopics : {},
        profile: {...initial.profile, ...(saved.profile || {})}
      };
    } catch (error) {
      localWorkspaceLoaded = false;
      console.error('Öğretmen çalışma alanı kayıtları okunamadı:', error);
      return defaultState();
    }
  }

  let state = readState();
  let management = {dersler: [], quizler: [], sonuclar: []};
  let managementLoaded = false;
  let serverWorkspaceLoaded = false;
  let studentLoadError = '';
  let homeworkLoadError = '';
  const topicMap = new Map();

  async function teacherApi(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: {...(isFormData ? {} : {'Content-Type': 'application/json'}), ...(options.headers || {})}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mesaj || `Sunucu hatası (${response.status})`);
    return data;
  }

  async function loadTeacherWorkspace() {
    try {
      const [studentResult, homeworkResult] = await Promise.allSettled([
        teacherApi('/api/ogretmen/ogrenciler'),
        teacherApi('/api/ogretmen/odevler')
      ]);

      if (studentResult.status === 'fulfilled') {
        state.students = studentResult.value.students || [];
        studentLoadError = '';
        serverWorkspaceLoaded = true;
      } else {
        studentLoadError = studentResult.reason?.message || 'Öğrenci verileri alınamadı';
        console.warn('Öğrenci verileri alınamadı:', studentResult.reason);
      }

      if (homeworkResult.status === 'fulfilled') {
        state.assignments = homeworkResult.value.homework || [];
        state.serverSummary = {homework: homeworkResult.value.summary};
        homeworkLoadError = '';
      } else {
        homeworkLoadError = homeworkResult.reason?.message || 'Ödev verileri alınamadı';
        console.warn('Ödev verileri alınamadı:', homeworkResult.reason);
      }

      renderStudents();
      renderAssignments();
      renderDashboard();
      renderAnalytics();
      renderQuizOptions();
      refreshAssignmentStudents();
    } catch (error) {
      console.error('Öğrenci ve ödev verileri yüklenemedi:', error);
      studentLoadError = error.message;
      homeworkLoadError = error.message;
      setStatus('studentStatus', `Öğrenci verileri yüklenemedi: ${error.message}`, 'error');
      setStatus('assignmentStatus', `Ödev verileri yüklenemedi: ${error.message}`, 'error');
      renderStudents();
      renderAssignments();
    }
  }
  window.loadTeacherWorkspace = loadTeacherWorkspace;

  function persist(statusId, successMessage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({...state, students: [], assignments: []}));
      localWorkspaceLoaded = true;
      if (statusId && $(statusId)) setStatus(statusId, successMessage || 'Kaydedildi.', 'ok');
      renderDashboard();
      renderStudents();
      renderAssignments();
      renderDocuments();
      renderAnalytics();
      renderContentList();
      return true;
    } catch (error) {
      console.error('Öğretmen çalışma alanı kaydedilemedi:', error);
      if (statusId && $(statusId)) setStatus(statusId, 'Bu tarayıcıya kaydedilemedi. Depolama alanınızı kontrol edin.', 'error');
      return false;
    }
  }

  function setStatus(id, message, kind = '') {
    const element = $(id);
    if (!element) return;
    element.textContent = message;
    element.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function gradeLabel(grade) {
    return `${grade}. Sınıf`;
  }

  function fillGradeSelect(select, includeAll = false) {
    if (!select) return;
    select.innerHTML = `${includeAll ? '<option value="">Tüm sınıflar</option>' : ''}${grades.map(grade =>
      `<option value="${grade}">${gradeLabel(grade)}</option>`
    ).join('')}`;
  }

  function unitsFor(grade) {
    const official = (curriculum[grade] || []).map((unit, index) => {
      const id = `base-${grade}-${index}`;
      const titles = [...unit.topics, ...(state.customTopics[id] || [])];
      return {
        id,
        title: unit.title,
        topics: titles.map((title, topicIndex) => ({
          title, key: `${grade}|base-${grade}-${index}|${topicIndex}`
        }))
      };
    });
    const custom = (state.customUnits[String(grade)] || []).map(unit => ({
      id: unit.id,
      title: unit.title,
      topics: unit.topics.map((title, topicIndex) => ({
        title, key: `${grade}|${unit.id}|${topicIndex}`
      }))
    }));
    return [...official, ...custom];
  }

  function allTopics() {
    const entries = [];
    topicMap.clear();
    grades.forEach(grade => unitsFor(grade).forEach(unit => unit.topics.forEach(topic => {
      entries.push({grade, unit, ...topic});
      topicMap.set(topic.key, {grade, unit, ...topic});
    })));
    return entries;
  }

  function topicOptionLabel(item) {
    return `${gradeLabel(item.grade)} · ${item.unit.title.replace(/^\d+\.\s*(Ünite|Tema)\s*·\s*/i, '')} · ${item.title}`;
  }

  function refreshTopicSelect(select, selectedValue = '') {
    if (!select) return;
    const topics = allTopics();
    select.innerHTML = `<option value="">Konu seçin</option>${topics.map(item =>
      `<option value="${escapeHtml(item.key)}">${escapeHtml(topicOptionLabel(item))}</option>`
    ).join('')}`;
    if (selectedValue && topics.some(item => item.key === selectedValue)) select.value = selectedValue;
  }

  function selectedGrade() {
    return Number($('curriculumGrade').value || 5);
  }

  function topicLabel(key) {
    return topicMap.get(key)?.title || key || 'Konu seçilmedi';
  }

  function renderCurriculum() {
    const grade = selectedGrade();
    const units = unitsFor(grade);
    const unitSelect = $('curriculumUnit');
    const priorUnit = unitSelect.value;
    unitSelect.innerHTML = units.length
      ? units.map(unit => `<option value="${escapeHtml(unit.id)}">${escapeHtml(unit.title)}</option>`).join('')
      : '<option value="">Henüz ünite eklenmedi</option>';
    if (units.some(unit => unit.id === priorUnit)) unitSelect.value = priorUnit;

    const chosenUnit = units.find(unit => unit.id === unitSelect.value) || units[0];
    const topicSelect = $('curriculumTopic');
    topicSelect.innerHTML = chosenUnit?.topics.length
      ? `<option value="">Konu seçin</option>${chosenUnit.topics.map(topic =>
        `<option value="${escapeHtml(topic.key)}">${escapeHtml(topic.title)}</option>`
      ).join('')}`
      : '<option value="">Henüz konu eklenmedi</option>';
    const currentContentTopic = topicMap.get($('contentTopic').value);
    if (currentContentTopic && (currentContentTopic.grade !== grade || currentContentTopic.unit.id !== chosenUnit?.id)) {
      $('contentTopic').value = '';
      $('contentTitle').value = '';
    }

    $('curriculumHeading').textContent = `${gradeLabel(grade)} · Matematik müfredatı`;
    const outline = $('curriculumOutline');
    if (!units.length) {
      outline.innerHTML = '<p class="dashboard-empty">Paylaşılan PDF’de bu sınıf için müfredat bulunmuyor. Aşağıdan ünite ve konu ekleyerek kendi müfredatınızı oluşturabilirsiniz.</p>';
    } else {
      outline.innerHTML = units.map(unit => `<details class="curriculum-unit" ${unit.id === chosenUnit?.id ? 'open' : ''}>
        <summary>${escapeHtml(unit.title)} <small>· ${unit.topics.length} konu</small></summary>
        <div class="curriculum-topics">${unit.topics.map(topic => {
          const count = state.content.filter(item => item.topicKey === topic.key).length;
          return `<button class="curriculum-topic" type="button" data-topic-key="${escapeHtml(topic.key)}" aria-pressed="${topic.key === topicSelect.value}">
            <span>${escapeHtml(topic.title)}</span><small>${count ? `${count} materyal` : 'İçerik ekle'}</small>
          </button>`;
        }).join('')}</div>
      </details>`).join('');
    }
    refreshTopicSelect($('assignmentTopic'), $('assignmentTopic').value);
    refreshTopicSelect($('documentTopic'), $('documentTopic').value);
    refreshPrerequisites();
    renderContentList();
  }

  function refreshPrerequisites() {
    const select = $('contentPrerequisites');
    const currentKey = $('curriculumTopic').value;
    select.innerHTML = allTopics()
      .filter(topic => topic.key !== currentKey)
      .map(topic => `<option value="${escapeHtml(topic.key)}">${escapeHtml(topicOptionLabel(topic))}</option>`).join('');
  }

  function setSelectedTopic(key) {
    const details = topicMap.get(key);
    if (!details) return;
    $('curriculumGrade').value = String(details.grade);
    renderCurriculum();
    $('curriculumUnit').value = details.unit.id;
    renderCurriculum();
    $('curriculumTopic').value = key;
    $('contentTopic').value = key;
    $('contentTitle').value = details.title;
    $('contentPrerequisites').querySelectorAll('option').forEach(option => { option.selected = false; });
    document.querySelectorAll('.curriculum-topic').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.topicKey === key));
    });
    renderContentList();
  }

  function renderContentList() {
    const key = $('contentTopic')?.value || $('curriculumTopic')?.value;
    const list = $('linkedContentList');
    if (!list) return;
    const entries = state.content.filter(item => item.topicKey === key);
    $('contentLinks').innerHTML = entries.map(item =>
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.typeLabel)} · ${escapeHtml(item.title)} (${item.status === 'published' ? 'Yayında' : 'Taslak'})</option>`
    ).join('');
    list.innerHTML = entries.length ? entries.map(item => `<div class="linked-content-item">
      <span>${escapeHtml(item.typeLabel)} · <strong>${escapeHtml(item.title)}</strong></span>
      <span class="content-actions">
        <small>${item.status === 'published' ? 'Yayında' : 'Taslak'}</small>
        <button type="button" data-content-toggle="${escapeHtml(item.id)}">${item.status === 'published' ? 'Yayından kaldır' : 'Yayınla'}</button>
        <button type="button" data-content-delete="${escapeHtml(item.id)}" aria-label="İçeriği sil">Sil</button>
      </span>
    </div>`).join('') : '<p class="dashboard-empty">Bu konuya henüz materyal bağlanmadı.</p>';
  }

  function renderStudents() {
    const body = $('studentRows');
    if (!body) return;
    const query = $('studentSearch').value.trim().toLocaleLowerCase('tr-TR');
    const gradeFilter = $('studentGradeFilter').value;
    const sectionFilter = $('studentSectionFilter').value;
    const activeFilter = $('studentStatusFilter').value;
    const students = state.students.filter(student =>
      (!query || `${student.name} ${student.studentNumber} ${student.email}`.toLocaleLowerCase('tr-TR').includes(query)) &&
      (!gradeFilter || String(student.grade) === gradeFilter) &&
      (!sectionFilter || student.section === sectionFilter) &&
      (activeFilter === 'all' || String(student.active !== false) === activeFilter)
    );
    body.innerHTML = students.length ? students.map(student => {
      const homework = student.homework || {};
      return `<tr><td><button class="student-name-link" type="button" data-student-detail="${escapeHtml(student.id)}">${escapeHtml(student.name)}</button></td>
        <td>${escapeHtml(student.studentNumber)}</td><td>${gradeLabel(student.grade)} / ${escapeHtml(student.section)}</td>
        <td>${homework.completed || 0}/${homework.total || 0} teslim · ${homework.pending || 0} bekliyor</td>
        <td><span class="status-chip ${student.linked ? 'is-linked' : 'is-unlinked'}">${student.linked ? 'Bağlı' : 'Davet bekliyor'}</span></td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button class="btn light student-history" type="button" data-student-detail="${escapeHtml(student.id)}">Detay</button>
          <button type="button" data-send-motivation="${escapeHtml(student.id)}" data-student-name="${escapeHtml(student.name)}" style="padding:5px 10px;border-radius:8px;border:1px solid #d97706;background:#fffbeb;color:#92400e;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">⚡ +20 Motivasyon</button>
        </div></td></tr>`;
    }).join('') : `<tr><td colspan="6" class="empty">${studentLoadError ? `Öğrenciler yüklenemedi: ${escapeHtml(studentLoadError)}` : serverWorkspaceLoaded ? 'Bu ölçütlerde öğrenci bulunamadı.' : 'Öğrenci listesi yükleniyor…'}</td></tr>`;

    const gradeCount = state.students.length;
    const activeCount = state.students.filter(student => student.active !== false).length;
    const inactiveCount = gradeCount - activeCount;
    $('studentSummary').innerHTML = [
      [gradeCount, 'Toplam kayıtlı'],
      [activeCount, 'Aktif öğrenci'],
      [inactiveCount, 'Pasif öğrenci']
    ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
    const sections = [...new Set(state.students.map(student => student.section).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    const previousSection = $('studentSectionFilter').value;
    $('studentSectionFilter').innerHTML = `<option value="">Tüm şubeler</option>${sections.map(section => `<option value="${escapeHtml(section)}">${escapeHtml(section)} Şubesi</option>`).join('')}`;
    if (sections.includes(previousSection)) $('studentSectionFilter').value = previousSection;
    refreshAssignmentStudents();
    renderDashboard();
  }

  function refreshAssignmentStudents() {
    const grade = Number($('assignmentGrade').value || 5);
    const section = $('assignmentSection').value;
    const sections = [...new Set(state.students
      .filter(student => student.active !== false && Number(student.grade) === grade)
      .map(student => student.section).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    const selectedSection = $('assignmentSection').value;
    $('assignmentSection').innerHTML = `<option value="">Bu sınıftaki tüm şubeler</option>${sections.map(item =>
      `<option value="${escapeHtml(item)}">${escapeHtml(item)} Şubesi</option>`
    ).join('')}`;
    if (sections.includes(selectedSection)) $('assignmentSection').value = selectedSection;
    const eligible = state.students.filter(student =>
      student.active !== false && Number(student.grade) === grade &&
      (!$('assignmentSection').value || student.section === $('assignmentSection').value)
    );
    const selected = new Set([...$('assignmentStudents').selectedOptions].map(option => option.value));
    $('assignmentStudents').innerHTML = eligible.map(student =>
      `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)} · ${escapeHtml(student.studentNumber)} · ${escapeHtml(student.section)}</option>`
    ).join('');
    [...$('assignmentStudents').options].forEach(option => { option.selected = selected.has(option.value); });
    $('assignmentStudentsField').hidden = $('assignmentTargetMode').value !== 'students';
  }

  function renderAssignments() {
    const list = $('assignmentList');
    if (!list) return;
    const summary = state.serverSummary?.homework || {};
    $('homeworkSummary').innerHTML = [
      [summary.total || 0, 'Toplam ödev'],
      [summary['Atandı'] || 0, 'Atandı'],
      [summary['Teslim edildi'] || 0, 'Teslim edildi'],
      [summary['Geç teslim'] || 0, 'Geç teslim'],
      [summary['Teslim edilmedi'] || 0, 'Teslim edilmedi'],
      [summary['Kontrol edildi'] || 0, 'Kontrol edildi']
    ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
    list.innerHTML = state.assignments.length ? [...state.assignments]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(item => {
        const submitted = ['Teslim edildi', 'Geç teslim', 'Kontrol edildi', 'Eksik'].reduce((sum, status) => sum + (item.counts?.[status] || 0), 0);
        const progress = item.recipientCount ? Math.round(submitted * 100 / item.recipientCount) : 0;
        const submittedCount = item.counts?.['Teslim edildi'] || 0;
        const overdueCount = item.counts?.['Geç teslim'] || 0;
        const reviewedCount = item.counts?.['Kontrol edildi'] || 0;
        return `<article class="homework-card">
          <div class="homework-card-head"><div><h3>${escapeHtml(item.title)}</h3><p>${gradeLabel(item.grade)}${item.section ? ` · ${escapeHtml(item.section)} Şubesi` : ''} · ${escapeHtml(item.topic || 'Genel çalışma')}</p></div><span class="homework-due">Son tarih · ${new Date(item.dueAt).toLocaleDateString('tr-TR')}</span></div>
          <div class="homework-metrics"><span><strong>${item.recipientCount}</strong> Atanan</span><span><strong>${submittedCount}</strong> Teslim edildi</span><span><strong>${overdueCount}</strong> Geç teslim</span><span><strong>${item.counts?.['Teslim edilmedi'] || 0}</strong> Teslim edilmedi</span><span><strong>${reviewedCount}</strong> Kontrol edildi</span></div>
          <div class="homework-progress"><span style="width:${progress}%"></span></div>
          <div class="homework-card-actions"><small>${progress}% teslim tamamlandı</small><button class="btn light" type="button" data-homework-detail="${escapeHtml(item.id)}">Teslimleri görüntüle</button></div>
        </article>`;
      }).join('') : `<p class="dashboard-empty">${homeworkLoadError ? `Ödevler yüklenemedi: ${escapeHtml(homeworkLoadError)}` : serverWorkspaceLoaded ? 'Henüz ödev oluşturulmadı.' : 'Ödevler yükleniyor…'}</p>`;
    renderDashboard();
  }

  function renderDocuments() {
    const list = $('documentList');
    if (!list) return;
    list.innerHTML = state.documents.length ? [...state.documents].reverse().map(document => `<article class="data-item">
      <div><strong>${escapeHtml(document.title)}</strong><p>${escapeHtml(document.type)} · ${gradeLabel(document.grade)}${document.topicKey ? ` · ${escapeHtml(topicLabel(document.topicKey))}` : ''}</p>
        <a class="text-link" href="${escapeHtml(document.url)}" target="_blank" rel="noopener noreferrer">Dokümanı aç ↗</a></div>
      <button class="del" type="button" data-document-delete="${escapeHtml(document.id)}" aria-label="Dokümanı kaldır">×</button>
    </article>`).join('') : '<p class="dashboard-empty">Henüz doküman bağlantısı eklenmedi.</p>';
  }

  let analyticsTrendChart = null;
  let analyticsDistChart = null;

  const ANALYTICS_TOPIC_OPTIONS = [
    'Oran ve Orantı',
    'Cebirsel İfadeler',
    'Doğrusal Denklemler',
    'Rasyonel Sayılar',
    'Kesirlerle İşlemler',
    'Doğrular ve Açılar',
    'Üslü İfadeler',
    'Kareköklü İfadeler',
    'Yüzdeler ve Problemler',
    'Veri Analizi'
  ];

  const ANALYTICS_MOCK_RESULTS = [
    { studentName: 'Zeynep Kaya', grade: 7, testTitle: 'Oran ve Orantı Mini Test', topicTitle: 'Oran ve Orantı', score: 48, weekIndex: 0 },
    { studentName: 'Kerem Yılmaz', grade: 7, testTitle: 'Cebirsel İfadeler Kazanım Testi', topicTitle: 'Cebirsel İfadeler', score: 54, weekIndex: 1 },
    { studentName: 'Elif Demir', grade: 8, testTitle: 'Doğrusal Denklemler Tarama', topicTitle: 'Doğrusal Denklemler', score: 56, weekIndex: 2 },
    { studentName: 'Mert Arslan', grade: 7, testTitle: 'Rasyonel Sayılar Pratik', topicTitle: 'Rasyonel Sayılar', score: 68, weekIndex: 2 },
    { studentName: 'Defne Aydın', grade: 7, testTitle: 'Doğrular ve Açılar Değerlendirme', topicTitle: 'Doğrular ve Açılar', score: 88, weekIndex: 3 },
    { studentName: 'Emir Şahin', grade: 8, testTitle: 'Üslü İfadeler Deneme', topicTitle: 'Üslü İfadeler', score: 76, weekIndex: 4 },
    { studentName: 'Azra Çelik', grade: 7, testTitle: 'Oran ve Orantı Tekrar Testi', topicTitle: 'Oran ve Orantı', score: 62, weekIndex: 4 },
    { studentName: 'Yusuf Koç', grade: 8, testTitle: 'Veri Analizi & Grafikler', topicTitle: 'Veri Analizi', score: 92, weekIndex: 5 }
  ];

  function renderAssignedTasksFeed() {
    const feed = $('assignedTasksFeed');
    if (!feed || !window.ZarifStore || !window.ZarifStore.assignments) return;
    const assigned = window.ZarifStore.assignments.list().slice(0, 5);
    if (!assigned.length) {
      feed.innerHTML = '';
      return;
    }
    feed.innerHTML = `
      <div style="border-top:1px dashed #e2cdb8;padding-top:10px;">
        <div style="font-size:12px;font-weight:700;color:#6a5242;margin-bottom:6px;">📌 Öğrenci Paneline Gönderilen Son Çalışmalar (${assigned.length})</div>
        <div style="display:grid;gap:6px;">
          ${assigned.map(a => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:9px;background:#fff;border:1px solid #ead8c5;font-size:12.5px;">
              <div>
                <strong style="color:#2c1a0e;">${escapeHtml(a.studentName)}</strong>
                <span style="color:#c2570c;font-weight:600;"> · ${escapeHtml(a.topicTitle)}</span>
              </div>
              <span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${a.status === 'completed' ? '#ecfdf5' : '#fef3c7'};color:${a.status === 'completed' ? '#065f46' : '#92400e'};">
                ${a.status === 'completed' ? '✓ Tamamlandı' : '⏳ Bekliyor'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function getRegisteredAnalyticsStudents() {
    const map = new Map();
    const sources = [
      ...(Array.isArray(state.students) ? state.students.filter(s => s && s.active !== false) : []),
      ...(Array.isArray(management.ogrenciler) ? management.ogrenciler : [])
    ];
    sources.forEach(s => {
      const id = String(s.id || s._id || s.studentId || s.name || '').trim();
      const name = String(s.name || s.fullName || s.adSoyad || '').trim();
      if (!name) return;
      const key = id || name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: id || key,
          name,
          grade: Number(s.grade || s.sinif) || 7,
          section: String(s.section || s.sube || '').trim()
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  function populateAnalyticsStudentSelect() {
    const sel = $('analyticsStudentSelect');
    if (!sel) return;
    const prevVal = sel.value;
    const students = getRegisteredAnalyticsStudents();
    const opts = ['<option value="">👥 Tüm Kayıtlı Öğrenciler (Genel)</option>'];
    students.forEach(s => {
      const gradeTxt = s.grade ? ` (${s.grade}. Sınıf${s.section ? ' ' + s.section : ''})` : '';
      opts.push(`<option value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-grade="${s.grade}">${escapeHtml(s.name)}${escapeHtml(gradeTxt)}</option>`);
    });
    sel.innerHTML = opts.join('');
    if (prevVal && [...sel.options].some(o => o.value === prevVal)) {
      sel.value = prevVal;
    }
    updateAnalyticsAssignTargetBanner();
  }

  function getSelectedAnalyticsTarget() {
    const sel = $('analyticsStudentSelect');
    if (!sel || !sel.value) return null;
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) return null;
    return {
      id: opt.value,
      name: opt.dataset.name || opt.textContent.trim(),
      grade: Number(opt.dataset.grade) || 7
    };
  }

  function updateAnalyticsAssignTargetBanner() {
    const banner = $('analyticsAssignTargetBanner');
    if (!banner) return;
    const target = getSelectedAnalyticsTarget();
    if (target) {
      banner.innerHTML = `🎯 <strong>Atama Hedefi:</strong> <span style="color:#c2570c;font-weight:700;">${escapeHtml(target.name)}</span> (${target.grade}. Sınıf · Gerçek Öğrenci)`;
    } else {
      banner.innerHTML = '🎯 <strong>Atama Hedefi:</strong> Tüm Kayıtlı Öğrenciler (Genel Çalışma Planı)';
    }
  }

  function renderAnalytics() {
    populateAnalyticsStudentSelect();
    const selectedTarget = getSelectedAnalyticsTarget();
    const selectedGradeFilter = $('analyticsSubjectSelect')?.value || 'all';

    const serverResults = [...(management.sonuclar || [])].filter(result =>
      result.score !== null && result.score !== undefined && Number.isFinite(Number(result.score))
    ).map(r => ({
      studentName: r.studentName || 'Öğrenci',
      grade: Number(r.grade) || 7,
      testTitle: r.testTitle || 'Matematik Testi',
      topicTitle: r.topicTitle || r.topic || r.testTitle || 'Genel Matematik',
      score: Math.max(0, Math.min(100, Number(r.score))),
      createdAt: r.submittedAt || r.createdAt || new Date().toISOString()
    }));

    const storeResults = (window.ZarifStore && window.ZarifStore.tests)
      ? window.ZarifStore.tests.list().map(r => ({
          studentName: r.studentName || 'Öğrenci',
          grade: Number(r.grade) || 7,
          testTitle: r.topicTitle || 'Mini Test',
          topicTitle: r.topicTitle || 'Genel Matematik',
          score: Math.max(0, Math.min(100, Number(r.score))),
          createdAt: r.createdAt
        }))
      : [];

    const combined = [...storeResults, ...serverResults];
    const isMock = combined.length === 0;
    let results = isMock ? ANALYTICS_MOCK_RESULTS : combined;
    if (selectedGradeFilter !== 'all') {
      const gradeFiltered = results.filter(r => Number(r.grade) === Number(selectedGradeFilter));
      if (gradeFiltered.length) results = gradeFiltered;
    }
    if (selectedTarget && !isMock) {
      const studentFiltered = results.filter(r =>
        String(r.studentName || '').toLowerCase() === selectedTarget.name.toLowerCase()
      );
      if (studentFiltered.length) results = studentFiltered;
    }

    const mockBadge = $('analyticsMockBadge');
    if (mockBadge) mockBadge.hidden = !isMock;

    const scores = results.map(result => Number(result.score));
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    const passed = scores.filter(score => score >= 60).length;
    const passRate = scores.length ? Math.round(passed * 100 / scores.length) : 0;
    const needSupport = scores.filter(score => score < 60).length;

    // 4'lü Özet Kartları (Lucide ikonlarıyla)
    $('analyticsSummary').innerHTML = [
      { value: `%${average}`, label: 'Genel Başarı Ortalaması', icon: 'trending-up', accent: '#c2570c', bg: '#fff4eb' },
      { value: String(results.length), label: 'Değerlendirilen Test', icon: 'clipboard-check', accent: '#2c1a0e', bg: '#f5ebe0' },
      { value: `%${passRate}`, label: 'Başarı Oranı (%60+)', icon: 'award', accent: '#2f6f4e', bg: '#ecf7f0' },
      { value: String(needSupport), label: 'Destek Gereken (%60 Altı)', icon: 'alert-triangle', accent: '#b91c1c', bg: '#fef2f2' }
    ].map(card => `
      <div style="background:#fffaf5;border:1px solid #ead8c5;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:11px;background:${card.bg};color:${card.accent};display:grid;place-items:center;flex-shrink:0;">
          <i data-lucide="${card.icon}" style="width:20px;height:20px;"></i>
        </div>
        <div>
          <strong style="display:block;font-size:1.35rem;line-height:1.15;color:#2c1a0e;">${escapeHtml(card.value)}</strong>
          <span style="font-size:0.78rem;color:#6a5242;">${escapeHtml(card.label)}</span>
        </div>
      </div>
    `).join('');

    // En Çok Zorlanılan Konular (konu bazlı gruplama)
    const topicMap = {};
    results.forEach(r => {
      const key = r.topicTitle || r.testTitle || 'Genel Matematik';
      if (!topicMap[key]) topicMap[key] = { title: key, sum: 0, count: 0 };
      topicMap[key].sum += Number(r.score) || 0;
      topicMap[key].count += 1;
    });
    const topicList = Object.values(topicMap)
      .map(t => ({ title: t.title, avg: Math.round(t.sum / t.count), count: t.count }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 6);

    $('scoreChart').innerHTML = topicList.map(topic => {
      const barColor = topic.avg < 60 ? '#c2570c' : (topic.avg < 80 ? '#b88a28' : '#587760');
      return `<div class="score-row">
        <span title="${escapeHtml(topic.title)} (${topic.count} test)">${escapeHtml(topic.title)}</span>
        <div class="score-track"><div class="score-fill" style="width:${topic.avg}%;background:${barColor};"></div></div>
        <strong>%${topic.avg}</strong>
      </div>`;
    }).join('');

    // %60 Altı Hedefli Çalışma Önerileri (Konu Seç + Çalışma Ata)
    const recommendations = results.filter(result => Number(result.score) < 60).slice(0, 8);
    $('recommendationList').innerHTML = recommendations.length ? recommendations.map((result, idx) => {
      const currentTopic = result.topicTitle || 'Oran ve Orantı';
      const options = Array.from(new Set([currentTopic, ...ANALYTICS_TOPIC_OPTIONS]));
      return `<div class="dashboard-item" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px;border-radius:12px;background:#fff;border:1px solid #ead8c5;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div>
            <strong style="color:#2c1a0e;">${escapeHtml(result.studentName || 'Öğrenci')}</strong>
            <span style="margin-left:6px;padding:2px 7px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:11.5px;font-weight:700;">%${Number(result.score)}</span>
            <small style="display:block;color:#6a5242;margin-top:2px;">${escapeHtml(result.testTitle || 'Matematik Testi')}</small>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="recTopic_${idx}" aria-label="Konu seç" style="flex:1;min-width:165px;padding:6px 9px;border-radius:8px;border:1px solid #dccab8;background:#fffaf5;font-size:12.5px;color:#2c1a0e;">
            ${options.map(opt => `<option value="${escapeHtml(opt)}" ${opt === currentTopic ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
          </select>
          <button type="button" class="recommendation-action"
            data-quick-assign="true"
            data-select-id="recTopic_${idx}"
            data-student="${escapeHtml(result.studentName || 'Öğrenci')}"
            data-grade="${Number(result.grade) || 7}"
            data-test="${escapeHtml(result.testTitle || 'Matematik Testi')}"
            data-score="${Number(result.score)}"
            style="padding:7px 12px;border-radius:8px;border:none;background:#c2570c;color:#fff;font-weight:700;font-size:12.5px;white-space:nowrap;">
            📌 Çalışma Ata
          </button>
        </div>
      </div>`;
    }).join('') : '<p class="dashboard-empty">Harika! Şu an %60 altında puanlanan test sonucu yok.</p>';

    // Quick-assign click handlers
    $('recommendationList').querySelectorAll('[data-quick-assign]').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectEl = $(btn.dataset.selectId);
        const topicTitle = selectEl ? selectEl.value : 'Matematik Tekrarı';
        const selectedRealStudent = getSelectedAnalyticsTarget();
        const studentId = selectedRealStudent ? selectedRealStudent.id : '';
        const studentName = selectedRealStudent
          ? selectedRealStudent.name
          : (btn.dataset.student || 'Tüm Kayıtlı Öğrenciler');
        const grade = selectedRealStudent
          ? selectedRealStudent.grade
          : (Number(btn.dataset.grade) || 7);
        const sourceTestTitle = btn.dataset.test || '';
        const scoreAtAssign = Number(btn.dataset.score);

        if (window.ZarifStore && window.ZarifStore.assignments) {
          window.ZarifStore.assignments.add({
            studentId,
            studentName,
            grade,
            topicTitle,
            sourceTestTitle,
            scoreAtAssign: Number.isFinite(scoreAtAssign) ? scoreAtAssign : null,
            note: `${sourceTestTitle} (%${scoreAtAssign}) sonucuna göre öğretmen tarafından hedefli tekrar çalışması atandı.`
          });
        }
        btn.textContent = selectedRealStudent
          ? `✓ ${selectedRealStudent.name} İçin Atandı`
          : '✓ Öğrenci Paneline Atandı';
        btn.style.background = '#2f6f4e';
        btn.disabled = true;
        renderAssignedTasksFeed();
      });
    });

    renderAssignedTasksFeed();

    // Chart.js: Trend Çizgi Grafiği & Puan Dağılımı Grafiği
    if (typeof window.Chart === 'function') {
      const trendCanvas = $('analyticsTrendCanvas');
      const distCanvas = $('analyticsDistCanvas');

      if (trendCanvas) {
        if (analyticsTrendChart) analyticsTrendChart.destroy();
        let trendLabels = ['Hafta 1', 'Hafta 2', 'Hafta 3', 'Hafta 4', 'Hafta 5', 'Hafta 6'];
        let trendValues = [54, 60, 65, 71, 76, 82];
        if (!isMock && window.ZarifStore && window.ZarifStore.tests) {
          const weekly = window.ZarifStore.tests.getWeeklyTrend(6);
          const hasWeekly = weekly.some(w => w.count > 0);
          if (hasWeekly) {
            trendLabels = weekly.map(w => w.label);
            trendValues = weekly.map(w => w.avgScore);
          }
        }
        analyticsTrendChart = new window.Chart(trendCanvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [{
              label: 'Ortalama Puan (%)',
              data: trendValues,
              borderColor: '#c2570c',
              backgroundColor: 'rgba(194, 87, 12, 0.14)',
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#2c1a0e',
              pointRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { min: 0, max: 100, ticks: { callback: v => `%${v}` } }
            }
          }
        });
      }

      if (distCanvas) {
        if (analyticsDistChart) analyticsDistChart.destroy();
        const buckets = [0, 0, 0, 0]; // 0-59, 60-74, 75-89, 90-100
        scores.forEach(s => {
          if (s < 60) buckets[0] += 1;
          else if (s < 75) buckets[1] += 1;
          else if (s < 90) buckets[2] += 1;
          else buckets[3] += 1;
        });
        analyticsDistChart = new window.Chart(distCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['0–59 (Destek)', '60–74 (Gelişiyor)', '75–89 (İyi)', '90–100 (Mükemmel)'],
            datasets: [{
              label: 'Test Sayısı',
              data: buckets,
              backgroundColor: ['#c2570c', '#d99b26', '#7a987f', '#2f6f4e'],
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } }
            }
          }
        });
      }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function withinCurrentWeek(value) {
    const date = new Date(value);
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return date >= monday && date < nextMonday;
  }

  function dashboardEmptyState(message, action, href) {
    return `<div class="dashboard-empty-state">
      <p>${escapeHtml(message)}</p>
      <a class="dashboard-empty-action" href="${escapeHtml(href)}">${escapeHtml(action)}</a>
    </div>`;
  }

  function renderDashboard() {
    $('dashboardDate').textContent = new Date().toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const activeClasses = new Set(state.students.filter(student => student.active !== false).map(student => `${student.grade}-${student.section || ''}`));
    const published = state.content.filter(item => item.status === 'published').length;
    const allExams = [...state.exams, ...serverExams];
    const upcomingExams = allExams.filter(exam => exam.date >= today()).length;
    $('kpiStudents').textContent = String(state.students.length);
    $('kpiClasses').textContent = String(activeClasses.size);
    $('kpiLessons').textContent = String(state.content.length);
    $('kpiPublished').textContent = String(published);
    const homeworkCounts = state.serverSummary?.homework || {};
    $('kpiAssignments').textContent = String(
      (homeworkCounts['Atandı'] || 0) +
      (homeworkCounts['Görüntülendi'] || 0) +
      (homeworkCounts['Devam ediyor'] || 0)
    );
    $('kpiExams').textContent = String(upcomingExams);

    const summaryValues = [
      state.students.length,
      activeClasses.size,
      state.content.length,
      published,
      Number($('kpiAssignments').textContent),
      upcomingExams
    ];
    const showStarterChecklist = localWorkspaceLoaded && serverWorkspaceLoaded &&
      summaryValues.filter(value => value === 0).length >= 4;
    $('starterChecklist').hidden = !showStarterChecklist;
    $('teacherKpis').classList.toggle('is-compact', showStarterChecklist);

    const upcomingLiveLessons = managementLoaded
      ? (management.dersler || []).filter(lesson => {
        const startsAt = Date.parse(lesson.startsAt);
        return Number.isFinite(startsAt) && startsAt >= Date.now();
      }).length
      : null;
    const updateSetupStep = (name, loaded, complete, detail) => {
      const step = document.querySelector(`[data-setup-step="${name}"]`);
      if (!step) return;
      step.classList.toggle('is-complete', loaded && complete);
      step.querySelector('[data-setup-status]').textContent = loaded
        ? complete ? 'Tamamlandı' : 'Sırada'
        : 'Veri bekleniyor';
      step.querySelector('[data-setup-detail]').textContent = detail;
    };
    updateSetupStep(
      'students',
      serverWorkspaceLoaded,
      state.students.length > 0,
      serverWorkspaceLoaded ? `${state.students.length} kayıt` : 'Öğrenciler yükleniyor…'
    );
    updateSetupStep(
      'content',
      localWorkspaceLoaded,
      state.content.length > 0,
      localWorkspaceLoaded ? `${state.content.length} içerik` : 'İçerik verileri okunamadı'
    );
    updateSetupStep(
      'lessons',
      managementLoaded,
      upcomingLiveLessons > 0,
      managementLoaded
        ? upcomingLiveLessons > 0 ? `${upcomingLiveLessons} planlı ders` : 'İlk canlı dersini planla'
        : 'Ders planları yükleniyor…'
    );
    updateSetupStep(
      'assignments',
      serverWorkspaceLoaded,
      state.assignments.length > 0,
      serverWorkspaceLoaded ? `${state.assignments.length} ödev` : 'Ödev verileri yükleniyor…'
    );

    const lessons = (management.dersler || []).filter(lesson => withinCurrentWeek(lesson.startsAt));
    const weekExams = allExams.filter(exam => withinCurrentWeek(`${exam.date}T12:00:00`));
    const schedule = [
      ...lessons.map(lesson => ({title: lesson.title, when: lesson.startsAt, link: lesson.link, kind: 'Canlı ders'})),
      ...weekExams.map(exam => ({title: exam.title, when: `${exam.date}T12:00:00`, kind: 'Sınav'}))
    ].sort((a, b) => new Date(a.when) - new Date(b.when));
    $('dashboardSchedule').innerHTML = schedule.length ? schedule.slice(0, 6).map(item => `<div class="dashboard-item">
      <div><strong>${escapeHtml(item.title)}</strong><small>${item.kind}${item.link ? ` · <a class="text-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Katıl ↗</a>` : ''}</small></div>
      <time>${new Date(item.when).toLocaleDateString('tr-TR', {weekday: 'short', day: 'numeric', month: 'short'})} ${new Date(item.when).toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'})}</time>
    </div>`).join('') : dashboardEmptyState('Bu hafta için planlanmış ders veya sınav yok.', 'İlk dersini planla', '#lessons');

    const activities = [...(management.sonuclar || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    $('dashboardActivity').innerHTML = activities.length ? activities.map(item => `<div class="dashboard-item">
      <div><strong>${escapeHtml(item.studentName || 'Öğrenci')} · ${escapeHtml(item.testTitle || 'Test')}</strong><small>${new Date(item.createdAt).toLocaleDateString('tr-TR')}</small></div>
      <time>${item.score === null ? '—' : `%${Number(item.score)}`}</time>
    </div>`).join('') : dashboardEmptyState('Henüz öğrenci etkinliği bulunmuyor.', 'Öğrenci ekle', '#students');
  }

  function applyProfile() {
    $('teacherDisplayName').value = state.profile.name;
    $('teacherBranch').value = state.profile.branch || 'Matematik';
    $('teacherNotifications').checked = state.profile.notifications !== false;
    const select = $('teacherGrades');
    [...select.options].forEach(option => { option.selected = state.profile.grades.includes(Number(option.value)); });
  }

  async function initializeProfile() {
    const form = $('teacherProfileForm');
    const controls = [...form.querySelectorAll('input, select, button')];
    controls.forEach(control => { control.disabled = true; });
    try {
      const {preferences} = await teacherApi('/api/ogretmen/tercihler');
      let saved = Boolean(preferences);
      if (preferences) {
        state.profile = {
          name: preferences.displayName, branch: preferences.branch,
          grades: preferences.grades, notifications: preferences.notifications
        };
      } else if (hasSavedProfile) {
        const migrated = await teacherApi('/api/ogretmen/tercihler', {
          method: 'PUT',
          body: JSON.stringify({
            displayName: state.profile.name, branch: state.profile.branch || 'Matematik',
            grades: state.profile.grades, notifications: state.profile.notifications !== false
          })
        });
        saved = true;
        state.profile = {
          name: migrated.preferences.displayName, branch: migrated.preferences.branch,
          grades: migrated.preferences.grades, notifications: migrated.preferences.notifications
        };
      }
      applyProfile();
      setStatus(
        'profileStatus',
        saved ? 'Profil tercihleri hesabınızla eşitlendi.' : 'Henüz kaydedilmiş tercih yok; kaydettiğinizde hesabınıza yazılır.',
        saved ? 'ok' : ''
      );
    } catch (error) {
      applyProfile();
      setStatus('profileStatus', `Profil tercihleri yüklenemedi: ${error.message}`, 'error');
    } finally {
      controls.forEach(control => { control.disabled = false; });
    }
  }

  async function loadServerExams() {
    const result = await teacherApi('/api/ogretmen/gelisim/sinavlar');
    serverExams = result.sinavlar || [];
    renderExams();
    renderDashboard();
  }

  function renderExams() {
    const list = $('scheduledExamList');
    if (!list) return;
    const exams = [
      ...state.exams.map(exam => ({...exam, localOnly: true})),
      ...serverExams.map(exam => ({...exam, localOnly: false}))
    ].sort((a, b) => a.date.localeCompare(b.date));
    list.innerHTML = exams.length ? exams.map(exam => `<article class="data-item">
      <div><strong>${escapeHtml(exam.title)}</strong><p>${gradeLabel(exam.grade)} · ${escapeHtml(exam.date)}${exam.quizId ? ` · ${escapeHtml(management.quizler.find(quiz => quiz.id === exam.quizId)?.title || 'Bağlı test')}` : ''}</p>
        <small>${exam.localOnly ? 'Yalnızca bu cihazda; öğrencilere görünmez' : 'Bağlı öğrencilerin takviminde görünür'}</small></div>
      ${exam.localOnly
        ? `<button class="del" type="button" data-exam-delete="${escapeHtml(exam.id)}" aria-label="Yerel sınavı kaldır">×</button>`
        : `<button class="del" type="button" data-shared-exam-delete="${escapeHtml(exam.id)}" aria-label="Paylaşılan sınavı kaldır">×</button>`}
    </article>`).join('') : '<p class="dashboard-empty">Henüz planlanmış sınav yok.</p>';
  }

  function renderQuizOptions() {
    const select = $('examQuiz');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = `<option value="">Henüz test seçilmedi</option>${(management.quizler || []).map(quiz =>
      `<option value="${escapeHtml(quiz.id)}">${escapeHtml(quiz.title)}</option>`
    ).join('')}`;
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    $('examScheduleStatus').textContent = management.quizler?.length
      ? 'Bir test seçebilir veya sınavı bağımsız olarak planlayabilirsiniz.'
      : 'Test listesi yüklendikten sonra mevcut testi sınava bağlayabilirsiniz.';
    const assignmentQuiz = $('assignmentQuiz');
    const currentQuiz = assignmentQuiz.value;
    assignmentQuiz.innerHTML = `<option value="">Test bağlama</option>${(management.quizler || []).map(quiz =>
      `<option value="${escapeHtml(quiz.id)}">${escapeHtml(quiz.title)}</option>`
    ).join('')}`;
    if ([...assignmentQuiz.options].some(option => option.value === currentQuiz)) assignmentQuiz.value = currentQuiz;
  }

  function renderStudentDetail(detail) {
    const panel = $('studentDetail');
    const student = detail.student;
    panel.hidden = false;
    panel.dataset.studentId = student.id;
    panel.innerHTML = `<div class="detail-heading"><div><p class="eyebrow">ÖĞRENCİ PROFİLİ</p><h3>${escapeHtml(student.name)}</h3><p>${gradeLabel(student.grade)} · ${escapeHtml(student.section)} Şubesi · Öğrenci No: ${escapeHtml(student.studentNumber)}</p></div><button class="btn light" type="button" data-detail-close>Profili kapat</button></div>
      <div class="student-detail-stats"><div><strong>${detail.summary.assigned}</strong><span>Verilen ödev</span></div><div><strong>${detail.summary.submitted}</strong><span>Teslim edilen</span></div><div><strong>${detail.summary.pending}</strong><span>Bekleyen</span></div><div><strong>${detail.summary.reviewed}</strong><span>Kontrol edilen</span></div></div>
      <div class="student-detail-grid"><form id="studentEditForm"><h4>Kişisel bilgiler</h4>
        <div class="form-grid"><div class="field"><label for="editStudentFirstName">Ad</label><input id="editStudentFirstName" maxlength="80" required value="${escapeHtml(student.firstName)}"></div>
        <div class="field"><label for="editStudentLastName">Soyad</label><input id="editStudentLastName" maxlength="80" required value="${escapeHtml(student.lastName)}"></div>
        <div class="field"><label for="editStudentNumber">Öğrenci numarası</label><input id="editStudentNumber" maxlength="30" required value="${escapeHtml(student.studentNumber)}"></div>
        <div class="field"><label for="editStudentGrade">Sınıf</label><select id="editStudentGrade">${grades.map(grade => `<option value="${grade}"${grade === student.grade ? ' selected' : ''}>${gradeLabel(grade)}</option>`).join('')}</select></div>
        <div class="field"><label for="editStudentSection">Şube</label><input id="editStudentSection" maxlength="12" required value="${escapeHtml(student.section)}"></div>
        <div class="field"><label for="editStudentEmail">Öğrenci e-postası</label><input id="editStudentEmail" type="email" maxlength="254" value="${escapeHtml(student.email)}"></div>
        <div class="field full"><label for="editStudentGuardian">Veli iletişim bilgisi</label><input id="editStudentGuardian" maxlength="160" value="${escapeHtml(student.guardianContact)}"></div></div>
        <div class="button-row"><button class="btn" type="submit">Bilgileri kaydet</button><button class="btn light" type="button" data-student-active="${student.active}">${student.active ? 'Öğrenciyi pasife al' : 'Öğrenciyi etkinleştir'}</button><span class="status" id="studentEditStatus" role="status"></span></div>
        <p class="storage-note">Hesap durumu: ${student.linked ? 'Öğrenci hesabı bağlı' : 'Davet kodu ile hesap bağlantısı bekleniyor'}</p>
        ${student.linked ? '' : `<button class="btn light" type="button" data-student-invitation="${escapeHtml(student.id)}">Yeni davet kodu oluştur</button>`}
        <button class="btn light" type="button" data-student-homework="${escapeHtml(student.id)}">Bu öğrenciye ödev ata</button>
      </form>
      <div><h4>Ödev geçmişi</h4><div class="student-history-list">${detail.homework.length ? detail.homework.map(item => `<article class="history-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.topic || 'Genel çalışma')} · Son tarih ${new Date(item.dueAt).toLocaleDateString('tr-TR')}</small></div><span class="status-chip ${statusClass(item.status)}">${escapeHtml(item.status)}</span>${item.score === null ? '' : `<b>%${item.score}</b>`}</article>`).join('') : '<p class="dashboard-empty">Henüz ödev geçmişi yok.</p>'}</div>
      <h4>Test sonuçları</h4><div class="student-history-list">${detail.quizResults.length ? detail.quizResults.map(item => `<article class="history-row"><div><strong>${escapeHtml(item.title)}</strong><small>${new Date(item.createdAt).toLocaleDateString('tr-TR')}</small></div><b>${item.score === null ? '—' : `%${item.score}`}</b></article>`).join('') :       '<p class="dashboard-empty">Öğretmen test sonucu bulunamadı.</p>'}</div></div></div><section data-gelisim-mount></section>`;
          const mount = panel.querySelector('[data-gelisim-mount]');
          if (window.ZarifGelisim && mount) window.ZarifGelisim.mountTeacher(mount, student.id);
        }

  function statusClass(status) {
    return ({
      'Atandı': 'status-assigned',
      'Görüntülendi': 'status-viewed',
      'Devam ediyor': 'status-progress',
      'Teslim edildi': 'status-submitted',
      'Geç teslim': 'status-late',
      'Kontrol edildi': 'status-reviewed',
      'Eksik': 'status-missing',
      'Teslim edilmedi': 'status-overdue'
    })[status] || '';
  }

  function renderHomeworkDetail(homework) {
    const panel = $('homeworkDetail');
    panel.hidden = false;
    panel.dataset.homeworkId = homework.id;
    panel.innerHTML = `<div class="detail-heading"><div><p class="eyebrow">ÖDEV TESLİM TAKİBİ</p><h3>${escapeHtml(homework.title)}</h3><p>${gradeLabel(homework.grade)}${homework.section ? ` · ${escapeHtml(homework.section)} Şubesi` : ''} · Son teslim ${new Date(homework.dueAt).toLocaleString('tr-TR')}</p></div><button class="btn light" type="button" data-homework-close>Takip ekranını kapat</button></div>
      ${homework.hasResourceFile ? `<a class="text-link" href="/api/ogretmen/odevler/${encodeURIComponent(homework.id)}/resource">Ödev PDF dosyasını indir</a>` : ''}
      <div class="student-detail-stats">${Object.entries(homework.counts).map(([status, count]) => `<div><strong>${count}</strong><span>${escapeHtml(status)}</span></div>`).join('')}</div>
      <div class="homework-recipient-list">${homework.recipients.map(item => `<article class="homework-recipient">
        <div><strong>${escapeHtml(item.studentName)}</strong><small>${escapeHtml(item.studentNumber)} · ${gradeLabel(item.grade)} / ${escapeHtml(item.section)} · ${item.linked ? 'Hesap bağlı' : 'Öğrenci hesabı bağlı değil'}</small>
          ${item.submittedAt ? `<small>Teslim: ${new Date(item.submittedAt).toLocaleString('tr-TR')}</small>` : ''}
          ${item.submissionText ? `<p>${escapeHtml(item.submissionText)}</p>` : ''}
          ${item.hasFile ? `<a class="text-link" href="/api/ogretmen/odevler/atamalar/${encodeURIComponent(item.assignmentId)}/file" target="_blank" rel="noopener noreferrer">Teslim dosyasını görüntüle ↗</a>` : ''}
          ${['Teslim edildi', 'Geç teslim', 'Eksik', 'Kontrol edildi'].includes(item.status) ? `<form class="review-form" data-review-assignment="${escapeHtml(item.assignmentId)}">
            <label>Puan <input type="number" name="score" min="0" max="100" step="1" value="${item.score ?? ''}" placeholder="0–100"></label>
            <label>Geri bildirim <input type="text" name="feedback" maxlength="2000" value="${escapeHtml(item.feedback)}" placeholder="Öğretmen değerlendirmesi"></label>
            <label>Durum <select name="status"><option${item.status === 'Kontrol edildi' ? ' selected' : ''}>Kontrol edildi</option><option${item.status === 'Eksik' ? ' selected' : ''}>Eksik</option></select></label>
            <button class="btn light" type="submit">Değerlendirmeyi kaydet</button><span class="status" role="status"></span>
          </form>` : ''}
        </div><span class="status-chip ${statusClass(item.status)}">${escapeHtml(item.status)}</span></article>`).join('')}</div>`;
  }

  function wireServerWorkspace() {
    document.addEventListener('submit', async event => {
      const form = event.target;
      if (form.id !== 'studentForm' && form.id !== 'assignmentForm' && form.id !== 'studentEditForm' &&
          !form.matches('[data-review-assignment]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        if (form.id === 'studentForm') {
          setStatus('studentStatus', 'Öğrenci kaydediliyor…');
          const result = await teacherApi('/api/ogretmen/ogrenciler', {
            method: 'POST',
            body: JSON.stringify({
              firstName: $('studentFirstName').value,
              lastName: $('studentLastName').value,
              studentNumber: $('studentNumber').value,
              grade: Number($('studentGrade').value),
              section: $('studentSection').value,
              email: $('studentEmail').value,
              guardianContact: $('studentGuardian').value
            })
          });
          form.reset();
          $('studentInviteCode').textContent = result.invitationCode;
          $('studentInvitePanel').hidden = false;
          setStatus('studentStatus', result.mesaj, 'ok');
          await loadTeacherWorkspace();
          return;
        }

        if (form.id === 'studentEditForm') {
          const studentId = $('studentDetail').dataset.studentId;
          await teacherApi(`/api/ogretmen/ogrenciler/${encodeURIComponent(studentId)}`, {
            method: 'PUT',
            body: JSON.stringify({
              firstName: $('editStudentFirstName').value,
              lastName: $('editStudentLastName').value,
              studentNumber: $('editStudentNumber').value,
              grade: Number($('editStudentGrade').value),
              section: $('editStudentSection').value,
              email: $('editStudentEmail').value,
              guardianContact: $('editStudentGuardian').value
            })
          });
          await loadTeacherWorkspace();
          renderStudentDetail(await teacherApi(`/api/ogretmen/ogrenciler/${encodeURIComponent(studentId)}`));
          return;
        }

        if (form.matches('[data-review-assignment]')) {
          await teacherApi(`/api/ogretmen/odevler/atamalar/${encodeURIComponent(form.dataset.reviewAssignment)}/review`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: form.elements.status.value,
              score: form.elements.score.value,
              feedback: form.elements.feedback.value
            })
          });
          const homeworkId = $('homeworkDetail').dataset.homeworkId;
          await loadTeacherWorkspace();
          renderHomeworkDetail((await teacherApi(`/api/ogretmen/odevler/${encodeURIComponent(homeworkId)}`)).homework);
          return;
        }

        const targetedStudents = $('assignmentTargetMode').value === 'students'
          ? [...$('assignmentStudents').selectedOptions].map(option => option.value)
          : [];
        if ($('assignmentTargetMode').value === 'students' && !targetedStudents.length) {
          setStatus('assignmentStatus', 'Ödev atamak için en az bir öğrenci seçin.', 'error');
          return;
        }
        setStatus('assignmentStatus', 'Ödev oluşturuluyor ve öğrencilere atanıyor…');
        const request = new FormData();
        request.set('title', $('assignmentTitle').value);
        request.set('grade', String(Number($('assignmentGrade').value)));
        request.set('section', $('assignmentSection').value);
        targetedStudents.forEach(id => request.append('studentIds', id));
        request.set('dueAt', new Date(`${$('assignmentDue').value}T23:59:59`).toISOString());
        request.set('topic', $('assignmentTopic').value ? topicLabel($('assignmentTopic').value) : '');
        request.set('type', $('assignmentType').value);
        request.set('quizId', $('assignmentQuiz').value);
        request.set('description', $('assignmentDescription').value);
        if ($('assignmentResource').files[0]) request.set('resource', $('assignmentResource').files[0]);
        const result = await teacherApi('/api/ogretmen/odevler', {method: 'POST', body: request});
        form.reset();
        $('assignmentDue').min = today();
        $('assignmentType').value = 'online';
        $('assignmentQuizField').hidden = false;
        $('assignmentResource').required = false;
        setStatus('assignmentStatus', result.mesaj, 'ok');
        await loadTeacherWorkspace();
      } catch (error) {
        const statusId = form.id === 'studentForm' ? 'studentStatus' : 'assignmentStatus';
        if (form.id === 'studentEditForm') setStatus('studentEditStatus', `Öğrenci bilgileri kaydedilemedi: ${error.message}`, 'error');
        else setStatus(statusId, `İşlem tamamlanamadı: ${error.message}`, 'error');
        if (form.id === 'studentForm') {
          loadTeacherWorkspace().catch(() => {});
        }
      } finally {
        if (button) button.disabled = false;
      }
    }, true);

    document.addEventListener('change', event => {
      const target = event.target;
      if (target.id === 'studentGradeFilter' || target.id === 'studentSectionFilter' || target.id === 'studentStatusFilter') {
        renderStudents();
      } else if (target.id === 'assignmentGrade' || target.id === 'assignmentSection' || target.id === 'assignmentTargetMode') {
        refreshAssignmentStudents();
      } else if (target.id === 'assignmentType') {
        $('assignmentQuizField').hidden = target.value !== 'online';
        $('assignmentResource').required = target.value === 'pdf';
      }
    }, true);

    document.addEventListener('input', event => {
      if (event.target.id === 'studentSearch') renderStudents();
    }, true);

    document.addEventListener('click', async event => {
      const target = event.target;
      const detailButton = target.closest('[data-student-detail]');
      const row = target.closest('#studentRows');
      const invitationButton = target.closest('[data-student-invitation]');
      const activateButton = target.closest('[data-student-active]');
      const assignStudentHomework = target.closest('[data-student-homework]');
      const homeworkButton = target.closest('[data-homework-detail]');
      const closeHomework = target.closest('[data-homework-close]');
      const closeStudent = target.closest('[data-detail-close]');
      const copyInvitation = target.closest('#copyStudentInvite');
      const closeInvitation = target.closest('#closeStudentInvite');
      const recommend = target.closest('[data-recommend]');
      if (!detailButton && !row && !activateButton && !invitationButton && !assignStudentHomework &&
          !closeStudent && !homeworkButton && !closeHomework &&
          !copyInvitation && !closeInvitation && !recommend) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        if (detailButton) {
          renderStudentDetail(await teacherApi(`/api/ogretmen/ogrenciler/${encodeURIComponent(detailButton.dataset.studentDetail)}`));
          $('studentDetail').scrollIntoView({behavior: 'smooth', block: 'start'});
        } else if (closeStudent) {
          $('studentDetail').hidden = true;
        } else if (activateButton) {
          const studentId = $('studentDetail').dataset.studentId;
          const active = activateButton.dataset.studentActive !== 'true';
          await teacherApi(`/api/ogretmen/ogrenciler/${encodeURIComponent(studentId)}/status`, {
            method: 'PATCH', body: JSON.stringify({active})
          });
          await loadTeacherWorkspace();
          renderStudentDetail(await teacherApi(`/api/ogretmen/ogrenciler/${encodeURIComponent(studentId)}`));
        } else if (invitationButton) {
          const result = await teacherApi(`/api/ogretmen/ogrenciler/${encodeURIComponent(invitationButton.dataset.studentInvitation)}/invitation`, {method: 'POST'});
          $('studentInviteCode').textContent = result.invitationCode;
          $('studentInvitePanel').hidden = false;
          $('studentInvitePanel').scrollIntoView({behavior: 'smooth'});
        } else if (assignStudentHomework) {
          const profile = state.students.find(item => item.id === assignStudentHomework.dataset.studentHomework);
          if (profile) {
            $('assignmentGrade').value = String(profile.grade);
            refreshAssignmentStudents();
            $('assignmentSection').value = profile.section;
            refreshAssignmentStudents();
            [...$('assignmentStudents').options].forEach(option => { option.selected = option.value === profile.id; });
            $('assignmentTargetMode').value = 'students';
            $('assignmentStudentsField').hidden = false;
            window.teacherPanelNavigation.open('assignments');
          }
        } else if (homeworkButton) {
          renderHomeworkDetail((await teacherApi(`/api/ogretmen/odevler/${encodeURIComponent(homeworkButton.dataset.homeworkDetail)}`)).homework);
          $('homeworkDetail').scrollIntoView({behavior: 'smooth', block: 'start'});
        } else if (closeHomework) {
          $('homeworkDetail').hidden = true;
        } else if (copyInvitation) {
          try {
            await navigator.clipboard.writeText($('studentInviteCode').textContent);
            copyInvitation.textContent = 'Kopyalandı ✓';
          } catch (error) {
            console.error('Davet kodu panoya kopyalanamadı:', error);
            copyInvitation.textContent = 'Kopyalanamadı; kodu seçin';
          }
        } else if (closeInvitation) {
          $('studentInvitePanel').hidden = true;
        } else if (recommend) {
          window.teacherPanelNavigation.open('assignments');
          const matches = state.students.filter(item => item.name === recommend.dataset.recommend && item.active !== false);
          if (matches.length !== 1) {
            setStatus('assignmentStatus', matches.length ? 'Aynı isimde birden fazla öğrenci var; ödev formundan doğru öğrenciyi seçin.' : 'Bu öğrenci öğretmen listesinde bulunamadı.', 'error');
          } else {
            $('assignmentGrade').value = String(matches[0].grade);
            refreshAssignmentStudents();
            $('assignmentSection').value = matches[0].section;
            refreshAssignmentStudents();
            [...$('assignmentStudents').options].forEach(option => { option.selected = option.value === matches[0].id; });
            $('assignmentTargetMode').value = 'students';
            $('assignmentStudentsField').hidden = false;
            $('assignmentTitle').value = `${matches[0].name} için konu tekrarı`;
          }
        }
      } catch (error) {
        const status = $('studentEditStatus') && !$('studentDetail').hidden ? 'studentEditStatus' : 'assignmentStatus';
        setStatus(status, `İşlem tamamlanamadı: ${error.message}`, 'error');
      }
    }, true);
  }

  function init() {
    fillGradeSelect($('curriculumGrade'));
    $('curriculumGrade').value = '5';
    fillGradeSelect($('studentGrade'));
    fillGradeSelect($('studentGradeFilter'), true);
    fillGradeSelect($('assignmentGrade'));
    fillGradeSelect($('documentGrade'));
    fillGradeSelect($('examGrade'));
    fillGradeSelect($('teacherGrades'));
    $('assignmentDue').min = today();
    $('examDate').min = today();
    $('studentGradeFilter').value = '';
    refreshTopicSelect($('assignmentTopic'));
    refreshTopicSelect($('documentTopic'));
    renderCurriculum();
    initializeProfile();
    renderDashboard();
    renderStudents();
    renderAssignments();
    renderDocuments();
    renderAnalytics();
    renderExams();
    loadServerExams().catch(error => {
      setStatus('examScheduleStatus', `Paylaşılan sınavlar yüklenemedi: ${error.message}`, 'error');
    });
    loadTeacherWorkspace().catch(error => {
      console.warn('İlk çalışma alanı yüklemesi tamamlanamadı:', error);
    });

    $('curriculumGrade').addEventListener('change', renderCurriculum);
    $('curriculumUnit').addEventListener('change', renderCurriculum);
    $('curriculumTopic').addEventListener('change', event => setSelectedTopic(event.target.value));
    $('curriculumOutline').addEventListener('click', event => {
      const button = event.target.closest('[data-topic-key]');
      if (button) setSelectedTopic(button.dataset.topicKey);
    });

    $('contentForm').addEventListener('submit', event => {
      event.preventDefault();
      const topicKey = $('contentTopic').value || $('curriculumTopic').value;
      if (!topicKey) {
        setStatus('contentStatus', 'Önce bir sınıf ve konu seçin.', 'error');
        return;
      }
      const typeLabels = {lesson: 'Konu anlatımı', activity: 'Etkinlik', test: 'Konu testi', pdf: 'PDF', video: 'Video', example: 'Örnek çözüm'};
      const id = createId();
      const selectedLinks = [...$('contentLinks').selectedOptions].map(option => option.value);
      const relatedContent = state.content.filter(item => item.topicKey === topicKey);
      const linkedIds = new Set([id, ...selectedLinks, ...relatedContent.map(item => item.id)]);
      const status = event.submitter?.dataset.contentStatus || 'draft';
      state.content.forEach(item => {
        if (selectedLinks.includes(item.id) || item.topicKey === topicKey) {
          item.linkedIds = [...new Set([...(item.linkedIds || [item.id]), id])];
        }
      });
      state.content.push({
        id, topicKey, title: $('contentTitle').value.trim(), type: $('contentType').value,
        typeLabel: typeLabels[$('contentType').value], description: $('contentDescription').value.trim(),
        url: $('contentUrl').value.trim(), status, linkedIds: [...linkedIds],
        prerequisites: [...$('contentPrerequisites').selectedOptions].map(option => option.value),
        createdAt: new Date().toISOString()
      });
      if (persist('contentStatus', status === 'published' ? 'İçerik yayınlandı.' : 'Taslak kaydedildi.')) renderCurriculum();
    });

    $('linkedContentList').addEventListener('click', event => {
      const toggle = event.target.closest('[data-content-toggle]');
      const remove = event.target.closest('[data-content-delete]');
      if (toggle) {
        const item = state.content.find(content => content.id === toggle.dataset.contentToggle);
        if (item) item.status = item.status === 'published' ? 'draft' : 'published';
        persist('contentStatus', 'İçerik durumu güncellendi.');
        renderCurriculum();
      }
      if (remove) {
        state.content = state.content.filter(content => content.id !== remove.dataset.contentDelete);
        state.content.forEach(item => { item.linkedIds = (item.linkedIds || []).filter(id => id !== remove.dataset.contentDelete); });
        persist('contentStatus', 'İçerik kaldırıldı.');
        renderCurriculum();
      }
    });

    $('curriculumAddForm').addEventListener('submit', event => {
      event.preventDefault();
      const grade = selectedGrade();
      const unitTitle = $('newUnitTitle').value.trim();
      const topicTitle = $('newTopicTitle').value.trim();
      let units = state.customUnits[String(grade)] || (state.customUnits[String(grade)] = []);
      let unit = unitTitle
        ? units.find(item => item.title.toLocaleLowerCase('tr-TR') === unitTitle.toLocaleLowerCase('tr-TR'))
        : units.find(item => item.id === $('curriculumUnit').value) ||
          ((curriculum[grade] || []).some((_, index) => `base-${grade}-${index}` === $('curriculumUnit').value)
            ? {id: $('curriculumUnit').value, topics: []}
            : null);
      if (!unitTitle && !unit) {
        setStatus('contentStatus', 'Konu eklemek için önce bir ünite seçin veya yeni ünite adı girin.', 'error');
        return;
      }
      if (unitTitle && !unit) {
        unit = {id: `custom-${createId()}`, title: unitTitle, topics: []};
        units.push(unit);
      }
      if (topicTitle) {
        const unitTopics = unit.id.startsWith('base-')
          ? (state.customTopics[unit.id] || (state.customTopics[unit.id] = []))
          : unit.topics;
        if (!unitTopics.includes(topicTitle)) unitTopics.push(topicTitle);
      }
      persist('contentStatus', 'Müfredat güncellendi.');
      $('newUnitTitle').value = '';
      $('newTopicTitle').value = '';
      renderCurriculum();
    });

    $('documentForm').addEventListener('submit', event => {
      event.preventDefault();
      state.documents.push({
        id: createId(), title: $('documentTitle').value.trim(), type: $('documentType').value,
        grade: Number($('documentGrade').value), topicKey: $('documentTopic').value,
        url: $('documentUrl').value.trim(), createdAt: new Date().toISOString()
      });
      if (persist('documentStatus', 'Doküman bağlantısı eklendi.')) event.currentTarget.reset();
    });
    $('documentList').addEventListener('click', event => {
      const remove = event.target.closest('[data-document-delete]');
      if (!remove) return;
      state.documents = state.documents.filter(item => item.id !== remove.dataset.documentDelete);
      persist('documentStatus', 'Doküman kaldırıldı.');
    });

    $('teacherProfileForm').addEventListener('submit', async event => {
      event.preventDefault();
      const preferences = {
        displayName: $('teacherDisplayName').value.trim(), branch: $('teacherBranch').value.trim(),
        grades: [...$('teacherGrades').selectedOptions].map(option => Number(option.value)),
        notifications: $('teacherNotifications').checked
      };
      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const result = await teacherApi('/api/ogretmen/tercihler', {
          method: 'PUT', body: JSON.stringify(preferences)
        });
        state.profile = {
          name: result.preferences.displayName, branch: result.preferences.branch,
          grades: result.preferences.grades, notifications: result.preferences.notifications
        };
        hasSavedProfile = true;
        setStatus('profileStatus', result.mesaj, 'ok');
      } catch (error) {
        setStatus('profileStatus', `Tercihler kaydedilemedi: ${error.message}`, 'error');
      } finally {
        submit.disabled = false;
      }
    });

    $('printAnalytics').addEventListener('click', () => window.print());
    $('examScheduleForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      setStatus('examScheduleStatus', 'Sınav öğrencilerin takvimine kaydediliyor…');
      try {
        const result = await teacherApi('/api/ogretmen/gelisim/sinavlar', {
          method: 'POST',
          body: JSON.stringify({
            title: $('examTitleSchedule').value.trim(),
            grade: Number($('examGrade').value),
            date: $('examDate').value,
            quizId: $('examQuiz').value || null
          })
        });
        setStatus('examScheduleStatus', result.mesaj, 'ok');
        form.reset();
        try {
          await loadServerExams();
        } catch (error) {
          setStatus('examScheduleStatus', `Sınav kaydedildi ancak liste yenilenemedi: ${error.message}`, 'error');
        }
      } catch (error) {
        setStatus('examScheduleStatus', `Sınav kaydedilemedi: ${error.message}`, 'error');
      } finally {
        submit.disabled = false;
      }
    });
    $('scheduledExamList')?.addEventListener('click', async event => {
      const shared = event.target.closest('[data-shared-exam-delete]');
      if (shared) {
        shared.disabled = true;
        try {
          const result = await teacherApi(`/api/ogretmen/gelisim/sinavlar/${encodeURIComponent(shared.dataset.sharedExamDelete)}`, {
            method: 'DELETE'
          });
          setStatus('examScheduleStatus', result.mesaj, 'ok');
        } catch (error) {
          setStatus('examScheduleStatus', `Sınav kaldırılamadı: ${error.message}`, 'error');
          shared.disabled = false;
          return;
        }
        try {
          await loadServerExams();
        } catch (error) {
          setStatus('examScheduleStatus', `Sınav kaldırıldı ancak liste yenilenemedi: ${error.message}`, 'error');
        }
        return;
      }
      const local = event.target.closest('[data-exam-delete]');
      if (!local) return;
      state.exams = state.exams.filter(exam => exam.id !== local.dataset.examDelete);
      if (persist('examScheduleStatus', 'Bu cihazdaki sınav planı kaldırıldı.')) {
        renderExams();
      }
    });

    const navigationLinks = [...document.querySelectorAll('.teacher-sidebar nav a[href^="#"]')];
    const observed = navigationLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navigationLinks.forEach(link => {
          if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
      }, {rootMargin: '-15% 0px -70% 0px', threshold: [0, .15, .4]});
      observed.forEach(section => observer.observe(section));
    }
    wireServerWorkspace();
    $('analyticsStudentSelect')?.addEventListener('change', () => {
      updateAnalyticsAssignTargetBanner();
      renderAnalytics();
    });
    $('analyticsSubjectSelect')?.addEventListener('change', () => {
      renderAnalytics();
    });
    $('studentRows')?.addEventListener('click', event => {
      const btn = event.target.closest('[data-send-motivation]');
      if (!btn) return;
      const studentId = btn.dataset.sendMotivation || '';
      const studentName = btn.dataset.studentName || 'Öğrenci';
      if (window.ZarifGamification && typeof window.ZarifGamification.sendMotivationPoints === 'function') {
        window.ZarifGamification.sendMotivationPoints({ studentId, studentName, points: 20 });
      }
      btn.textContent = '✓ +20 XP Gönderildi';
      btn.style.background = '#ecfdf5';
      btn.style.borderColor = '#059669';
      btn.style.color = '#065f46';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = '⚡ +20 Motivasyon';
        btn.style.background = '#fffbeb';
        btn.style.borderColor = '#d97706';
        btn.style.color = '#92400e';
        btn.disabled = false;
      }, 2800);
    });
    if (window.ZarifStore && window.ZarifStore.events) {
      window.ZarifStore.events.subscribe('tests', renderAnalytics);
      window.ZarifStore.events.subscribe('assignments', renderAssignedTasksFeed);
    }
  }

  window.addEventListener('teacher-dashboard:data', event => {
    const nextManagement = event.detail || {};
    if (Array.isArray(nextManagement.dersler)) managementLoaded = true;
    management = {...management, ...nextManagement};
    renderDashboard();
    renderAnalytics();
    renderQuizOptions();
    renderExams();
    loadTeacherWorkspace();
  });

  init();
})();
