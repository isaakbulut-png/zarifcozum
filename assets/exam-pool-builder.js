/**
 * Exam Pool Builder - Havuzdan Test/Deneme Oluşturma Modülü
 * ogretmen-paneli.html içine entegre olur
 */

(async () => {
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const grades = Array.from({length: 12}, (_, i) => i + 1);
  let createdExams = [];
  let questionPool = [];
  let selectedQuestions = new Set();

  const GRADES = {
    1: '1. Sınıf', 2: '2. Sınıf', 3: '3. Sınıf', 4: '4. Sınıf',
    5: '5. Sınıf', 6: '6. Sınıf', 7: '7. Sınıf', 8: '8. Sınıf',
    9: '9. Sınıf', 10: '10. Sınıf', 11: '11. Sınıf', 12: '12. Sınıf'
  };

  async function apiCall(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {...(isFormData ? {} : {'Content-Type': 'application/json'}), ...(options.headers || {})}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mesaj || `Sunucu hatası (${response.status})`);
    return data;
  }

  // Soru havuzunu yükle
  async function loadQuestionPool() {
    try {
      const result = await apiCall('/api/sorular');
      questionPool = result.sorular || [];
    } catch (error) {
      console.error('Soru havuzu yüklenemedi:', error);
      questionPool = [];
    }
  }

  // ========== TAB SWITCHING ==========
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      const tabs = e.target.parentElement.querySelectorAll('.tab-btn');
      const panels = e.target.parentElement.parentElement.querySelectorAll('.tab-panel');
      
      tabs.forEach(tab => tab.classList.remove('active'));
      panels.forEach(panel => panel.classList.remove('active'));
      
      e.target.classList.add('active');
      const panelId = e.target.getAttribute('aria-controls');
      $(panelId)?.classList.add('active');
    }
  });

  // ========== TAB 1: OTOMATİK ÇEKME ==========
  const autoForm = $('examAutoForm');
  const autoGradeSelect = $('examAutoGrade');
  const autoStatus = $('examAutoStatus');
  const autoResult = $('examAutoResult');
  const autoResultInfo = $('examAutoResultInfo');
  const autoResultPreview = $('examAutoResultPreview');

  // Grade dropdown'u doldur
  grades.forEach(grade => {
    const option = document.createElement('option');
    option.value = grade;
    option.textContent = GRADES[grade];
    autoGradeSelect.appendChild(option);
    
    const selectManual = $('examManualGrade');
    const optClone = option.cloneNode(true);
    selectManual.appendChild(optClone);
    
    const selectManualForm = $('examManualGradeForm');
    const optClone2 = option.cloneNode(true);
    selectManualForm.appendChild(optClone2);
  });

  autoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    autoStatus.textContent = 'Sorular çekiliyor...';
    autoResult.hidden = true;

    try {
      const grade = parseInt($('examAutoGrade').value);
      const examType = $('examAutoType').value;
      const unit_topic = $('examAutoTopic').value.trim() || undefined;
      const sub_topic = $('examAutoSubtopic').value.trim() || undefined;
      const questionCount = parseInt($('examAutoCount').value);
      const duration = parseInt($('examAutoDuration').value);
      const title = $('examAutoTitle').value.trim();

      const response = await apiCall('/api/exams/generate', {
        method: 'POST',
        body: JSON.stringify({
          grade, examType, unit_topic, sub_topic, questionCount, duration, title
        })
      });

      // Başarılı - önizleme göster
      createdExams.push(response.exam);
      autoResultInfo.innerHTML = `
        <strong>${escapeHtml(response.exam.title)}</strong><br>
        ${GRADES[response.exam.grade]} · ${response.exam.questionCount} soru · ${response.exam.duration} dakika
      `;

      // Sorular listesini göster (sadece sayı)
      autoResultPreview.innerHTML = `
        <div style="text-align:center; padding:10px; background:#f9f8f7; border-radius:8px;">
          <strong style="font-size:1.1rem;">📋 ${response.exam.questionCount} soru seçildi</strong>
        </div>
      `;

      autoResult.hidden = false;
      autoStatus.textContent = '';
    } catch (error) {
      if (error.message.includes('NO_MATCHING_QUESTIONS')) {
        autoStatus.textContent = '❌ Seçilen kriterle hiç soru bulunamadı.';
      } else if (error.message.includes('INSUFFICIENT_QUESTIONS')) {
        const match = error.message.match(/(\d+) soru/);
        const count = match ? match[1] : '?';
        autoStatus.innerHTML = `⚠️ Yalnızca ${count} soru bulundu. <button class="btn light" type="button" onclick="document.getElementById('examAutoCount').value='${count}'; document.getElementById('examAutoForm').dispatchEvent(new Event('submit'));">Tüm ${count}'i kullan</button>`;
      } else {
        autoStatus.textContent = `❌ ${error.message}`;
      }
      autoResult.hidden = true;
    }
  });

  $('examAutoPublish')?.addEventListener('click', async () => {
    if (createdExams.length === 0) return;
    const exam = createdExams[createdExams.length - 1];
    
    try {
      await apiCall(`/api/exams/${exam.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: true })
      });
      autoStatus.textContent = '✅ Sınav yayınlandı!';
      autoResult.hidden = true;
      autoForm.reset();
      renderExamList();
    } catch (error) {
      autoStatus.textContent = `❌ ${error.message}`;
    }
  });

  $('examAutoCancel')?.addEventListener('click', () => {
    createdExams.pop();
    autoResult.hidden = true;
    autoForm.reset();
  });

  // ========== TAB 2: MANUEL SEÇİM ==========
  const manualForm = $('examManualForm');
  const manualQList = $('examManualQuestionList');
  const manualSelected = $('examManualSelected');
  const manualStatus = $('examManualStatus');

  async function renderQuestionList() {
    const gradeFilter = $('examManualGrade').value;
    const topicFilter = $('examManualTopic').value;
    const searchFilter = $('examManualSearch').value.toLowerCase();

    const filtered = questionPool.filter(q => {
      const gradMatch = !gradeFilter || q.grade === parseInt(gradeFilter);
      const topicMatch = !topicFilter || q.topic === topicFilter;
      const searchMatch = !searchFilter || q.text?.toLowerCase().includes(searchFilter);
      return gradMatch && topicMatch && searchMatch;
    });

    manualQList.innerHTML = filtered.map(q => `
      <div class="question-row" data-qid="${q.id}">
        <input type="checkbox" class="q-checkbox" value="${q.id}" ${selectedQuestions.has(q.id) ? 'checked' : ''}>
        <div class="question-info">
          <strong>${q.siraNo || '?'}. Soru</strong>
          <small>${GRADES[q.grade] || 'Bilinmiyor'} · Tema: ${escapeHtml(q.topic || '—')}</small>
        </div>
      </div>
    `).join('');

    // Checkbox event listeners
    manualQList.querySelectorAll('.q-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedQuestions.add(e.target.value);
        } else {
          selectedQuestions.delete(e.target.value);
        }
        updateSelectedCount();
      });
    });
  }

  function updateSelectedCount() {
    manualSelected.textContent = `${selectedQuestions.size} seçildi`;
  }

  $('examManualGrade')?.addEventListener('change', renderQuestionList);
  $('examManualTopic')?.addEventListener('change', renderQuestionList);
  $('examManualSearch')?.addEventListener('input', renderQuestionList);

  $('examManualSelectAll')?.addEventListener('click', () => {
    manualQList.querySelectorAll('.q-checkbox').forEach(cb => {
      cb.checked = true;
      selectedQuestions.add(cb.value);
    });
    updateSelectedCount();
  });

  $('examManualClearAll')?.addEventListener('click', () => {
    manualQList.querySelectorAll('.q-checkbox').forEach(cb => cb.checked = false);
    selectedQuestions.clear();
    updateSelectedCount();
  });

  manualForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    manualStatus.textContent = 'Sınav oluşturuluyor...';

    try {
      const title = $('examManualTitle').value.trim();
      const grade = parseInt($('examManualGradeForm').value);
      const examType = $('examManualTypeForm').value;
      const duration = parseInt($('examManualDurationForm').value);
      const questionIds = Array.from(selectedQuestions);

      if (questionIds.length === 0) {
        manualStatus.textContent = '❌ En az bir soru seçmelisiniz.';
        return;
      }

      const response = await apiCall('/api/exams/create-manual', {
        method: 'POST',
        body: JSON.stringify({
          title, grade, examType, questionIds, duration
        })
      });

      createdExams.push(response.exam);
      manualStatus.textContent = '✅ Sınav oluşturuldu! Seçenekler: Yayınla veya Sil.';
      selectedQuestions.clear();
      manualForm.reset();
      renderQuestionList();
      renderExamList();
    } catch (error) {
      manualStatus.textContent = `❌ ${error.message}`;
    }
  });

  // ========== EXAM LİSTESİ ==========
  async function renderExamList() {
    try {
      const result = await apiCall('/api/exams?limit=50');
      createdExams = result.exams || [];

      const list = $('examList');
      list.innerHTML = createdExams.length ? createdExams.map(exam => `
        <article class="data-item">
          <div>
            <strong>${escapeHtml(exam.title)}</strong>
            <p>
              ${GRADES[exam.grade]} · 
              ${exam.examType === 'konu_testi' ? '📚 Konu Testi' : '📋 Deneme Sınavı'} · 
              ${exam.questionCount} soru · ${exam.duration} dakika
              ${exam.unit_topic ? ` · ${escapeHtml(exam.unit_topic)}` : ''}
            </p>
            <small>${exam.isPublished ? '✅ Yayınlandı' : '⏳ Taslak'}</small>
          </div>
          <div style="display:flex; gap:6px; flex:none;">
            ${!exam.isPublished ? `
              <button class="btn light" type="button" data-exam-publish="${exam.id}">Yayınla</button>
            ` : ''}
            <button class="btn light" type="button" data-exam-delete="${exam.id}">Sil</button>
          </div>
        </article>
      `).join('') : '<p class="dashboard-empty">Henüz sınav oluşturulmamış.</p>';

      // Yayınla button'ları
      list.querySelectorAll('[data-exam-publish]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const examId = btn.getAttribute('data-exam-publish');
          try {
            await apiCall(`/api/exams/${examId}`, {
              method: 'PATCH',
              body: JSON.stringify({ isPublished: true })
            });
            renderExamList();
          } catch (error) {
            alert(`Hata: ${error.message}`);
          }
        });
      });

      // Sil button'ları
      list.querySelectorAll('[data-exam-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const examId = btn.getAttribute('data-exam-delete');
          if (!confirm('Bu sınavı silmek istediğinizden emin misiniz?')) return;
          try {
            await apiCall(`/api/exams/${examId}`, { method: 'DELETE' });
            renderExamList();
          } catch (error) {
            alert(`Hata: ${error.message}`);
          }
        });
      });
    } catch (error) {
      console.error('Sınav listesi yüklenemedi:', error);
    }
  }

  // ========== İNİT ==========
  await loadQuestionPool();
  await renderExamList();
  await renderQuestionList();
})();
