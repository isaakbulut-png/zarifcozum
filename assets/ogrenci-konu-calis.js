// Öğrenci Paneli "Konu Çalış" Modülü (Sıfır AI Maliyeti - Veritabanından Hazır Öğretmen İçerikleri)
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let state = {
    grade: 6,
    search: '',
    overall: { completed: 0, total: 0, percent: 0 },
    lastAccessed: null,
    themes: [],
    loading: false
  };

  let readerState = {
    open: false,
    theme: null,
    topic: null,
    progress: null,
    mode: 'lesson', // 'lesson' | 'notes' | 'cards'
    pageIdx: 0,
    cardIdx: 0,
    cardFlipped: false
  };

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.mesaj || `Sunucu hatası (${res.status})`);
    return data;
  }

  function renderRichText(container, text, svgDiagram) {
    if (!container) return;
    container.replaceChildren();
    const combined = String(text || '') + (svgDiagram && svgDiagram.includes('<svg') ? '\n\n' + svgDiagram : '');
    if (window.zarifAiVisual && typeof window.zarifAiVisual.append === 'function') {
      window.zarifAiVisual.append(container, combined);
    } else if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
      container.innerHTML = window.zarifMathText.format(text || '');
      if (svgDiagram && svgDiagram.includes('<svg')) {
        const div = document.createElement('div');
        div.style.cssText = 'margin:14px 0;text-align:center;';
        div.innerHTML = svgDiagram;
        container.appendChild(div);
      }
    } else {
      container.textContent = text || '';
    }
  }

  function formatInlineMath(text) {
    if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
      return window.zarifMathText.format(String(text || ''));
    }
    return esc(text || '');
  }

  async function loadTopics() {
    const grid = $('kcThemesGrid');
    if (!grid) return;
    state.loading = true;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:36px 16px;color:#6a5242;background:#fffaf5;border:1px solid #e6d7c8;border-radius:16px;">Yayınlanan konular yükleniyor…</div>';

    try {
      const params = new URLSearchParams({ grade: String(state.grade) });
      if (state.search.trim()) params.set('q', state.search.trim());
      const res = await apiJson('/api/student/topics?' + params.toString());
      state.overall = res.overall || { completed: 0, total: 0, percent: 0 };
      state.lastAccessed = res.lastAccessed || null;
      state.themes = res.themes || [];
      renderDashboard();
    } catch (err) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:28px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:16px;">Konular yüklenemedi: ${esc(err.message)}</div>`;
    } finally {
      state.loading = false;
    }
  }

  function renderDashboard() {
    // 1. Kaldığın Yerden Devam Et Şeridi
    const banner = $('kcResumeBanner');
    if (banner) {
      if (state.lastAccessed) {
        banner.style.display = 'flex';
        if ($('kcResumeTitle')) {
          $('kcResumeTitle').textContent = `${state.lastAccessed.themeTitle} · ${state.lastAccessed.subTopicTitle}`;
        }
        if ($('kcResumeSub')) {
          $('kcResumeSub').textContent = `${state.lastAccessed.grade}. Sınıf · Konu anlatımı · %${state.lastAccessed.percent} tamamlandı`;
        }
        const btn = $('kcResumeBtn');
        if (btn) {
          btn.onclick = () => openTopicById(state.lastAccessed.topicId, 'lesson', null);
        }
      } else {
        banner.style.display = 'none';
      }
    }

    // 2. Genel İlerleme Özeti
    if ($('kcOverallSummary')) {
      $('kcOverallSummary').textContent = `${state.overall.completed} / ${state.overall.total} konu tamamlandı (%${state.overall.percent})`;
    }

    // 3. 2 Sütunlu Modern Tema Kartları
    const grid = $('kcThemesGrid');
    if (!grid) return;

    if (!state.themes.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:42px 24px;background:#fffaf5;border:1.5px dashed #dccab8;border-radius:18px;color:#6a5242;">
          <div style="font-size:2.2rem;margin-bottom:8px;">📚</div>
          <h3 style="margin:0 0 6px;color:#2c1a0e;font-family:Georgia,serif;">${state.grade}. Sınıf için henüz yayınlanmış konu yok</h3>
          <p style="margin:0;font-size:0.9rem;">Öğretmeniniz yeni konu anlatımlarını yayınladığında burada anında, kotanızdan harcamadan çalışabilirsiniz.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = state.themes.map((theme, idx) => {
      const pct = theme.percent || 0;
      const pctBg = pct === 100 ? '#ecfdf5' : pct > 0 ? '#fdf1e3' : '#f5ece2';
      const pctColor = pct === 100 ? '#065f46' : pct > 0 ? '#c2570c' : '#6a5242';
      const barColor = pct === 100 ? '#16a34a' : '#c2570c';
      const firstTopic = theme.topics[0];
      const firstId = firstTopic ? firstTopic.id : '';

      return `
        <article class="kc-theme-card" data-theme-idx="${idx}">
          <div class="kc-card-top">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
              <span class="kc-code-badge">${esc(theme.themeCode)}</span>
              <h3 class="kc-theme-title" title="${esc(theme.themeTitle)}">${esc(theme.themeTitle)}</h3>
            </div>
            <span class="kc-pct-badge" style="background:${pctBg};color:${pctColor};">%${pct}</span>
          </div>

          <div class="kc-progress-wrap">
            <div class="kc-progress-labels">
              <span>İlerleme</span>
              <span>${theme.completedCount} / ${theme.totalCount} konu</span>
            </div>
            <div class="kc-progress-track">
              <div class="kc-progress-fill" style="width:${pct}%;background:${barColor};"></div>
            </div>
          </div>

          <div class="kc-stats-row">
            <div class="kc-stat-col">
              <strong>${theme.completedCount}</strong>
              <span>Tamamlanan</span>
            </div>
            <div class="kc-stat-col">
              <strong>${theme.inProgressCount}</strong>
              <span>Devam Eden</span>
            </div>
            <div class="kc-stat-col">
              <strong>${theme.totalCount}</strong>
              <span>Toplam Konu</span>
            </div>
          </div>

          <div class="kc-actions-grid">
            <button type="button" class="kc-act-btn kc-act-primary" data-open-theme="${idx}" data-topic-id="${esc(firstId)}" data-mode="lesson">📖 Konu Anlatımı</button>
            <button type="button" class="kc-act-btn kc-act-warm" data-open-theme="${idx}" data-topic-id="${esc(firstId)}" data-mode="notes">💡 Pratik Bilgi</button>
            <button type="button" class="kc-act-btn kc-act-sand" data-open-theme="${idx}" data-topic-id="${esc(firstId)}" data-mode="cards">🗂️ Bilgi Kartları</button>
            <button type="button" class="kc-act-btn kc-act-quiz" data-go-quiz="${idx}">✏️ Soru Çöz</button>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-open-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = state.themes[Number(btn.dataset.openTheme)];
        const topicId = btn.dataset.topicId;
        const mode = btn.dataset.mode || 'lesson';
        if (topicId) openTopicById(topicId, mode, theme);
      });
    });

    grid.querySelectorAll('[data-go-quiz]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof window.showPanel === 'function') {
          window.showPanel('test-coz', true);
        } else {
          location.hash = '#test-coz';
        }
      });
    });
  }

  async function openTopicById(topicId, mode = 'lesson', themeObj = null) {
    const modal = $('kcReaderModal');
    const body = $('kcReaderBody');
    if (!modal || !body) return;

    readerState.open = true;
    readerState.mode = mode;
    readerState.theme = themeObj || state.themes.find(th => th.topics.some(t => t.id === topicId)) || null;
    readerState.cardIdx = 0;
    readerState.cardFlipped = false;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    body.innerHTML = '<div style="text-align:center;padding:48px 16px;color:#6a5242;">Konu anlatımı hazırlanıyor…</div>';

    try {
      const res = await apiJson('/api/student/topics/' + encodeURIComponent(topicId));
      readerState.topic = res.topic;
      readerState.progress = res.progress || { status: 'in_progress', lastPage: 1 };
      readerState.pageIdx = Math.max(0, Math.min((res.topic.lessonPages?.length || 1) - 1, (readerState.progress.lastPage || 1) - 1));
      renderReader();
    } catch (err) {
      body.innerHTML = `<div style="text-align:center;padding:36px;color:#991b1b;">Konu açılamadı: ${esc(err.message)}</div>`;
    }
  }

  function closeReader() {
    const modal = $('kcReaderModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    readerState.open = false;
    loadTopics();
  }

  function renderReader() {
    const t = readerState.topic;
    if (!t) return;

    if ($('kcReaderCode')) $('kcReaderCode').textContent = t.themeCode || `MAT.${t.grade}`;
    if ($('kcReaderTitle')) $('kcReaderTitle').textContent = t.title || t.subTopicTitle;
    if ($('kcReaderSub')) $('kcReaderSub').textContent = `${t.grade}. Sınıf · ${t.themeTitle} › ${t.subTopicTitle}`;

    // Tema içindeki alt konular seçici (birden fazla alt konu varsa)
    const subNav = $('kcReaderSubTopics');
    if (subNav) {
      const siblings = readerState.theme?.topics || [];
      if (siblings.length > 1) {
        subNav.style.display = 'flex';
        subNav.innerHTML = siblings.map(st => {
          const isCur = st.id === t.id;
          const isDone = st.progressStatus === 'completed';
          return `
            <button type="button" data-switch-topic="${esc(st.id)}" style="padding:5px 11px;border-radius:999px;border:1.5px solid ${isCur ? '#c2570c' : '#e2d3c3'};background:${isCur ? '#c2570c' : '#fff'};color:${isCur ? '#fff' : '#2c1a0e'};font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
              ${isDone ? '✓ ' : ''}${esc(st.subTopicTitle)}
            </button>
          `;
        }).join('');
        subNav.querySelectorAll('[data-switch-topic]').forEach(btn => {
          btn.addEventListener('click', () => openTopicById(btn.dataset.switchTopic, readerState.mode, readerState.theme));
        });
      } else {
        subNav.style.display = 'none';
      }
    }

    // Mod sekmeleri aktiflik
    document.querySelectorAll('[data-reader-mode]').forEach(btn => {
      const isAct = btn.dataset.readerMode === readerState.mode;
      btn.style.background = isAct ? '#2c1a0e' : '#fbf1e8';
      btn.style.color = isAct ? '#fff' : '#2c1a0e';
      btn.style.borderColor = isAct ? '#2c1a0e' : '#e2d3c3';
    });

    // Tamamlandı butonu durumu
    const compBtn = $('kcCompleteBtn');
    if (compBtn) {
      const isDone = readerState.progress?.status === 'completed';
      compBtn.textContent = isDone ? '✓ Konu Tamamlandı' : 'Konuyu Tamamladım ✓';
      compBtn.style.background = isDone ? '#065f46' : 'linear-gradient(135deg,#c2570c 0%,#9a3412 100%)';
    }

    const body = $('kcReaderBody');
    if (!body) return;

    if (readerState.mode === 'lesson') {
      const pages = t.lessonPages || [];
      const curPage = pages[readerState.pageIdx] || pages[0];
      body.innerHTML = `
        ${t.short_summary && readerState.pageIdx === 0 ? `
          <div style="background:#fbf1e8;border-left:4px solid #c2570c;padding:12px 16px;border-radius:10px;margin-bottom:18px;font-size:0.92rem;color:#2c1a0e;line-height:1.55;">
            <strong style="color:#9a3412;">📌 Hızlı Özet:</strong> ${formatInlineMath(t.short_summary)}
          </div>
        ` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
          ${pages.map((p, i) => `
            <button type="button" data-reader-page="${i}" style="padding:6px 12px;border-radius:8px;border:1.5px solid ${i === readerState.pageIdx ? '#c2570c' : '#e6d7c8'};background:${i === readerState.pageIdx ? '#c2570c' : '#fff'};color:${i === readerState.pageIdx ? '#fff' : '#2c1a0e'};font-size:12.5px;font-weight:600;cursor:pointer;">
              ${i + 1}. Sayfa
            </button>
          `).join('')}
        </div>
        <div style="background:#fff;border:1px solid #e6d7c8;border-radius:14px;padding:24px;min-height:260px;">
          <h3 style="margin:0 0 14px;color:#2c1a0e;font-family:Georgia,serif;font-size:1.18rem;border-bottom:1px solid #f0e4d6;padding-bottom:10px;">
            ${esc(curPage?.title || `${readerState.pageIdx + 1}. Sayfa`)}
          </h3>
          <div id="kcLessonRichMount" class="zp-anlatim" style="line-height:1.8;color:#2c1a0e;font-size:0.98rem;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:10px;">
          <button type="button" id="kcPrevPageBtn" ${readerState.pageIdx <= 0 ? 'disabled' : ''} style="padding:8px 16px;border-radius:9px;border:1.5px solid #dccab8;background:#fff;color:#2c1a0e;font-weight:600;cursor:pointer;opacity:${readerState.pageIdx <= 0 ? '0.45' : '1'};">← Önceki Sayfa</button>
          <span style="font-size:13px;font-weight:600;color:#6a5242;">Sayfa ${readerState.pageIdx + 1} / ${pages.length || 1}</span>
          <button type="button" id="kcNextPageBtn" ${readerState.pageIdx >= pages.length - 1 ? 'disabled' : ''} style="padding:8px 16px;border-radius:9px;border:1.5px solid #2c1a0e;background:#2c1a0e;color:#fff;font-weight:600;cursor:pointer;opacity:${readerState.pageIdx >= pages.length - 1 ? '0.45' : '1'};">Sonraki Sayfa →</button>
        </div>
      `;

      renderRichText($('kcLessonRichMount'), curPage?.content || '', curPage?.svgDiagram || '');

      const goPage = idx => {
        readerState.pageIdx = idx;
        renderReader();
        apiJson('/api/student/topics/' + encodeURIComponent(t.id) + '/progress', {
          method: 'POST',
          body: JSON.stringify({ lastPage: idx + 1 })
        }).catch(() => {});
      };
      body.querySelectorAll('[data-reader-page]').forEach(btn => btn.addEventListener('click', () => goPage(Number(btn.dataset.readerPage))));
      $('kcPrevPageBtn')?.addEventListener('click', () => { if (readerState.pageIdx > 0) goPage(readerState.pageIdx - 1); });
      $('kcNextPageBtn')?.addEventListener('click', () => { if (readerState.pageIdx < pages.length - 1) goPage(readerState.pageIdx + 1); });
    } else if (readerState.mode === 'notes') {
      const notes = t.practicalNotes || [];
      if (!notes.length) {
        body.innerHTML = '<div style="text-align:center;padding:40px;color:#6a5242;background:#fffaf5;border:1px dashed #dccab8;border-radius:14px;">Bu konu için henüz pratik hap bilgi eklenmemiş.</div>';
        return;
      }
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${notes.map((n, idx) => `
            <div style="display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #e6d7c8;border-left:4px solid #c2570c;border-radius:12px;padding:14px 16px;">
              <span style="width:26px;height:26px;border-radius:50%;background:#fdf1e3;color:#c2570c;font-weight:700;font-size:13px;display:grid;place-items:center;flex-shrink:0;">${idx + 1}</span>
              <div style="color:#2c1a0e;font-size:0.95rem;line-height:1.65;">${formatInlineMath(n)}</div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (readerState.mode === 'cards') {
      const cards = t.flashcards || [];
      if (!cards.length) {
        body.innerHTML = '<div style="text-align:center;padding:40px;color:#6a5242;background:#fffaf5;border:1px dashed #dccab8;border-radius:14px;">Bu konu için henüz bilgi kartı eklenmemiş.</div>';
        return;
      }
      const card = cards[readerState.cardIdx] || cards[0];
      body.innerHTML = `
        <div style="max-width:580px;margin:8px auto;text-align:center;">
          <div style="font-size:13px;font-weight:600;color:#6a5242;margin-bottom:10px;">Kart ${readerState.cardIdx + 1} / ${cards.length} · Çevirmek için karta tıkla</div>
          <div id="kcFlashcardBox" style="min-height:220px;padding:28px 24px;border-radius:18px;border:2px solid ${readerState.cardFlipped ? '#c2570c' : '#2c1a0e'};background:${readerState.cardFlipped ? '#fffaf5' : 'linear-gradient(135deg,#2c1a0e 0%,#3e2413 100%)'};color:${readerState.cardFlipped ? '#2c1a0e' : '#fff'};display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;cursor:pointer;box-shadow:0 10px 24px rgba(44,26,14,0.14);transition:all .2s ease;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:3px 10px;border-radius:999px;background:${readerState.cardFlipped ? '#fdf1e3' : 'rgba(255,255,255,0.14)'};color:${readerState.cardFlipped ? '#c2570c' : '#fed7aa'};">
              ${readerState.cardFlipped ? 'Cevap & Açıklama' : 'Soru / Kavram'}
            </span>
            <div style="font-size:1.12rem;font-weight:600;line-height:1.6;">
              ${formatInlineMath(readerState.cardFlipped ? card.back : card.front)}
            </div>
            ${readerState.cardFlipped && card.tip ? `<div style="margin-top:6px;font-size:0.86rem;color:#9a3412;background:#fdf1e3;padding:6px 12px;border-radius:8px;">💡 İpucu: ${formatInlineMath(card.tip)}</div>` : ''}
          </div>
          <div style="display:flex;justify-content:center;gap:12px;margin-top:16px;">
            <button type="button" id="kcPrevCardBtn" ${readerState.cardIdx <= 0 ? 'disabled' : ''} style="padding:8px 16px;border-radius:9px;border:1.5px solid #dccab8;background:#fff;color:#2c1a0e;font-weight:600;cursor:pointer;opacity:${readerState.cardIdx <= 0 ? '0.45' : '1'};">← Önceki</button>
            <button type="button" id="kcFlipCardBtn" style="padding:8px 18px;border-radius:9px;border:none;background:#c2570c;color:#fff;font-weight:600;cursor:pointer;">🔄 Kartı Çevir</button>
            <button type="button" id="kcNextCardBtn" ${readerState.cardIdx >= cards.length - 1 ? 'disabled' : ''} style="padding:8px 16px;border-radius:9px;border:1.5px solid #2c1a0e;background:#2c1a0e;color:#fff;font-weight:600;cursor:pointer;opacity:${readerState.cardIdx >= cards.length - 1 ? '0.45' : '1'};">Sonraki →</button>
          </div>
        </div>
      `;

      const flip = () => { readerState.cardFlipped = !readerState.cardFlipped; renderReader(); };
      $('kcFlashcardBox')?.addEventListener('click', flip);
      $('kcFlipCardBtn')?.addEventListener('click', flip);
      $('kcPrevCardBtn')?.addEventListener('click', () => {
        if (readerState.cardIdx > 0) { readerState.cardIdx--; readerState.cardFlipped = false; renderReader(); }
      });
      $('kcNextCardBtn')?.addEventListener('click', () => {
        if (readerState.cardIdx < cards.length - 1) { readerState.cardIdx++; readerState.cardFlipped = false; renderReader(); }
      });
    }
  }

  async function detectStudentDefaultGrade() {
    try {
      const saved = Number(localStorage.getItem('zarif_student_grade'));
      if (saved >= 5 && saved <= 12) return saved;
    } catch (e) {}
    try {
      const res = await fetch('/me', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        const g = Number(d?.user?.grade || d?.user?.sinif);
        if (g >= 5 && g <= 12) return g;
      }
    } catch (e) {}
    return 6;
  }

  async function init() {
    if (!$('kcThemesGrid')) return;

    state.grade = await detectStudentDefaultGrade();
    if ($('kcGradeSelect')) $('kcGradeSelect').value = String(state.grade);

    $('kcGradeSelect')?.addEventListener('change', e => {
      state.grade = Number(e.target.value) || 6;
      try { localStorage.setItem('zarif_student_grade', String(state.grade)); } catch (err) {}
      loadTopics();
    });

    let searchTimer = null;
    $('kcSearchInput')?.addEventListener('input', e => {
      state.search = e.target.value || '';
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadTopics, 220);
    });

    $('kcReaderCloseBtn')?.addEventListener('click', closeReader);
    $('kcReaderModal')?.addEventListener('click', e => {
      if (e.target === $('kcReaderModal')) closeReader();
    });

    document.querySelectorAll('[data-reader-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        readerState.mode = btn.dataset.readerMode;
        renderReader();
      });
    });

    $('kcCompleteBtn')?.addEventListener('click', async () => {
      if (!readerState.topic) return;
      const btn = $('kcCompleteBtn');
      btn.disabled = true;
      try {
        const res = await apiJson('/api/student/topics/' + encodeURIComponent(readerState.topic.id) + '/complete', {
          method: 'POST'
        });
        readerState.progress = res.progress || { status: 'completed', lastPage: 5 };
        if (readerState.theme) {
          const item = readerState.theme.topics.find(x => x.id === readerState.topic.id);
          if (item) item.progressStatus = 'completed';
        }
        renderReader();
      } catch (err) {
        alert('Tamamlama kaydedilemedi: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });

    $('kcAskAiMentorBtn')?.addEventListener('click', () => {
      closeReader();
      if (typeof window.showPanel === 'function') {
        window.showPanel('ai-mentor-panel', true);
      } else {
        location.hash = '#ai-mentor-panel';
      }
    });

    loadTopics();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
