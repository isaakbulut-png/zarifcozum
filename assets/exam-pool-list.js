/**
 * Exam Pool List - Öğrenci Paneli Sınav Listeleme
 * Yayınlanan test ve deneme sınavlarını gösterir
 */

(async () => {
  const $ = id => document.getElementById(id);

  const GRADES = {
    1: '1. Sınıf', 2: '2. Sınıf', 3: '3. Sınıf', 4: '4. Sınıf',
    5: '5. Sınıf', 6: '6. Sınıf', 7: '7. Sınıf', 8: '8. Sınıf',
    9: '9. Sınıf', 10: '10. Sınıf', 11: '11. Sınıf', 12: '12. Sınıf'
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

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

  async function loadExams() {
    const feed = $('examPoolFeed');
    if (!feed) return;

    try {
      const result = await apiCall('/api/ogrenci/exams?limit=100');
      const exams = result.exams || [];

      if (exams.length === 0) {
        feed.innerHTML = '<p class="feed-status">Şu an yayınlanan test veya deneme sınavı yok.</p>';
        return;
      }

      feed.innerHTML = exams.map(exam => `
        <article class="card" style="margin-bottom:12px; padding:14px; display:flex; justify-content:space-between; align-items:start; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <h3 style="margin:0 0 4px; font-size:1rem; color:#322a23;">${escapeHtml(exam.title)}</h3>
            <p style="margin:0 0 6px; font-size:0.85rem; color:#748078;">
              ${GRADES[exam.grade]} · 
              ${exam.examType === 'konu_testi' ? '📚 Konu Testi' : '📋 Deneme Sınavı'} · 
              ${exam.questionCount} soru · ⏱️ ${exam.duration} dakika
              ${exam.unit_topic ? ` · ${escapeHtml(exam.unit_topic)}` : ''}
            </p>
            <small style="color:#a09080;">📅 ${new Date(exam.createdAt).toLocaleDateString('tr-TR')}</small>
          </div>
          <button class="btn" type="button" data-exam-start="${exam.id}" style="white-space:nowrap; flex:none;">
            Çöz →
          </button>
        </article>
      `).join('');

      // Start button event listeners
      feed.querySelectorAll('[data-exam-start]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const examId = btn.getAttribute('data-exam-start');
          try {
            const exam = await apiCall(`/api/ogrenci/exams/${examId}`);
            startExam(exam.exam);
          } catch (error) {
            alert(`Hata: ${error.message}`);
          }
        });
      });
    } catch (error) {
      console.error('Sınavlar yüklenemedi:', error);
      feed.innerHTML = `<p class="feed-status">Sınavlar yüklenirken hata oluştu: ${error.message}</p>`;
    }
  }

  function startExam(exam) {
    // Exam başlat - basit bir gösterim
    alert(`
Sınav: ${exam.title}
Soru Sayısı: ${exam.questions.length}
Süre: ${exam.duration} dakika

Bu sınav özelliği kullanıcı öğrenci panelinde görüntülenir ve çözüm modülü gelecekte implemente edilecektir.
    `);
    
    // TODO: Exam solving interface ekle (future implementation)
  }

  // Yükle
  await loadExams();
})();
