// Öğrenci Paneli "Konu Çalış" Modülü (2. Aşama: Yapısal Bloklar, R2 Ders Kitabı Referansları, 3D Bilgi Kartları Oyunu)
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Modül CSS (3D Flip, Yapısal Blok Kartları, R2 Lightbox)
  function injectStyles() {
    if (document.getElementById('kcPhase2Styles')) return;
    const style = document.createElement('style');
    style.id = 'kcPhase2Styles';
    style.textContent = `
      .kc-blocks-stack{display:flex;flex-direction:column;gap:14px}
      .kc-block-card{border-radius:14px;padding:16px 18px;border:1px solid #e6d7c8;background:#fff;box-shadow:0 2px 10px rgba(44,26,14,0.04)}
      .kc-block-head{display:flex;align-items:center;gap:8px;font-weight:800;font-size:0.86rem;letter-spacing:0.2px;margin-bottom:8px;text-transform:uppercase}
      .kc-block-body{font-size:0.96rem;line-height:1.72;color:#2c1a0e}
      .kc-block-story{background:linear-gradient(135deg,#fffcf5 0%,#fdf4e3 100%);border-color:#efd6a8;border-left:4px solid #d97706}
      .kc-block-story .kc-block-head{color:#92400e}
      .kc-block-svg{background:#fff;border:1.5px solid #e6d7c8;text-align:center;padding:18px}
      .kc-block-svg .kc-block-head{color:#2c1a0e;justify-content:center;margin-bottom:12px}
      .kc-svg-frame{width:100%;max-width:520px;margin:0 auto;padding:12px;border-radius:12px;background:#fffaf5;border:1px solid #f0e4d6;overflow:hidden}
      .kc-svg-frame svg{width:100%;max-width:520px;height:auto;display:block;margin:0 auto}
      .kc-block-rule{background:linear-gradient(135deg,#fffaf5 0%,#fdf1e3 100%);border-color:#e8c4a0;border-left:4px solid #c2570c}
      .kc-block-rule .kc-block-head{color:#9a3412}
      .kc-block-mistake{background:linear-gradient(135deg,#fff8f6 0%,#fef2f2 100%);border-color:#fecaca;border-left:4px solid #dc2626}
      .kc-block-mistake .kc-block-head{color:#991b1b}
      .kc-block-challenge{background:linear-gradient(135deg,#f8f5f0 0%,#fbf1e8 100%);border:1.5px solid #2c1a0e;border-left:5px solid #2c1a0e}
      .kc-block-challenge .kc-block-head{color:#2c1a0e}
      .kc-challenge-answer{display:none;margin-top:12px;padding:12px 14px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-weight:600;font-size:0.93rem}
      .kc-challenge-answer.revealed{display:block;animation:kcFadeIn .22s ease}
      @keyframes kcFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      .kc-ref-section{margin-top:18px;padding-top:16px;border-top:1.5px dashed #e2d3c3}
      .kc-ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:10px}
      .kc-ref-card{background:#fff;border:1px solid #e6d7c8;border-radius:12px;overflow:hidden;cursor:pointer;text-align:left;padding:0;transition:transform .16s ease,box-shadow .16s ease;display:flex;flex-direction:column}
      .kc-ref-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(44,26,14,0.12);border-color:#c2570c}
      .kc-ref-thumb{width:100%;height:110px;background:#f5ece2;display:grid;place-items:center;overflow:hidden;position:relative}
      .kc-ref-thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .kc-ref-page-pill{position:absolute;top:6px;right:6px;background:rgba(44,26,14,0.86);color:#fed7aa;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
      .kc-ref-meta{padding:8px 10px;font-size:11.5px;color:#2c1a0e;line-height:1.35}
      .kc-ref-meta strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kc-ref-meta span{color:#6a5242;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
      .kc-hap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
      .kc-hap-card{background:#fff;border:1px solid #e6d7c8;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 3px 12px rgba(44,26,14,0.04)}
      .kc-hap-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .kc-hap-num{font-family:Georgia,serif;font-weight:800;font-size:0.86rem;padding:3px 10px;border-radius:8px;color:#fff}
      .kc-hap-cat{font-size:0.75rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#fbf1e8;color:#6a5242}
      .kc-fc-scene{perspective:1100px;width:100%;max-width:560px;margin:0 auto}
      .kc-fc-card{position:relative;width:100%;min-height:245px;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.22,1,.36,1);cursor:pointer}
      .kc-fc-card.is-flipped{transform:rotateY(180deg)}
      .kc-fc-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:18px;padding:26px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;box-shadow:0 12px 28px rgba(44,26,14,0.14)}
      .kc-fc-front{background:linear-gradient(135deg,#2c1a0e 0%,#462714 100%);color:#fff;border:2px solid #2c1a0e}
      .kc-fc-back{background:linear-gradient(135deg,#fffaf5 0%,#fdf1e3 100%);color:#2c1a0e;border:2px solid #c2570c;transform:rotateY(180deg)}
      .kc-lightbox{display:none;position:fixed;inset:0;z-index:10050;background:rgba(20,10,4,0.82);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px}
      .kc-lightbox-inner{background:#fffaf5;border-radius:16px;max-width:860px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;border:2px solid #c2570c}
    `;
    document.head.appendChild(style);
  }

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
    mode: 'lesson',
    pageIdx: 0,
    // 3D Flashcard Oyun Durumu
    deckQueue: [],
    masteredCount: 0,
    totalCards: 0,
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

  function formatInlineMath(text) {
    const clean = String(text || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*\*/g, '');
    if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
      return window.zarifMathText.format(clean);
    }
    return esc(clean);
  }

  function mountSafeSvg(container, rawSvg) {
    if (!container || !rawSvg) return;
    const trimmed = String(rawSvg).trim();
    if (!trimmed.includes('<svg')) return;
    if (window.zarifSafeSvg && typeof window.zarifSafeSvg.parse === 'function') {
      try {
        const parsed = window.zarifSafeSvg.parse(trimmed);
        window.zarifSafeSvg.render(container, parsed);
        return;
      } catch (e) {}
    }
    try {
      const doc = new DOMParser().parseFromString(trimmed, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (svgEl) {
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        container.replaceChildren(svgEl);
      }
    } catch (e) {}
  }

  function splitMiniChallenge(rawText) {
    const txt = String(rawText || '').trim();
    if (!txt) return { question: '', answer: '' };
    // Örn: "Soru? (Cevap: 12)" veya "Soru? Cevap: 12"
    const parenMatch = txt.match(/^(.*?)[\s]*\((?:Cevap\s*[:\-]?\s*)?([^()]{1,180})\)\s*$/i);
    if (parenMatch && parenMatch[1].trim().length > 8) {
      return { question: parenMatch[1].trim(), answer: parenMatch[2].trim() };
    }
    const labelMatch = txt.match(/^(.*?)(?:Cevap\s*[:\-]\s*)(.+)$/i);
    if (labelMatch && labelMatch[1].trim().length > 8) {
      return { question: labelMatch[1].trim(), answer: labelMatch[2].trim() };
    }
    return { question: txt, answer: 'Yukarıdaki Altın Kural ve örnek adımlarını kullanarak cevabını doğrula!' };
  }

  function openBookLightbox(refPage) {
    let lb = document.getElementById('kcBookLightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'kcBookLightbox';
      lb.className = 'kc-lightbox';
      lb.innerHTML = `
        <div class="kc-lightbox-inner">
          <div style="background:#2c1a0e;color:#fff;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <strong id="kcLbTitle" style="font-family:Georgia,serif;font-size:1rem;">MEB Ders Kitabı</strong>
              <div id="kcLbSub" style="font-size:0.78rem;color:#fed7aa;margin-top:2px;"></div>
            </div>
            <button type="button" id="kcLbClose" style="background:rgba(255,255,255,0.16);border:0;color:#fff;width:32px;height:32px;border-radius:8px;font-size:17px;cursor:pointer;">✕</button>
          </div>
          <div style="padding:16px;overflow:auto;text-align:center;background:#fbf1e8;flex:1;" id="kcLbImgWrap"></div>
        </div>
      `;
      document.body.appendChild(lb);
      lb.addEventListener('click', e => { if (e.target === lb) lb.style.display = 'none'; });
      lb.querySelector('#kcLbClose').addEventListener('click', () => { lb.style.display = 'none'; });
    }
    lb.querySelector('#kcLbTitle').textContent = refPage.book || 'MEB Ders Kitabı';
    lb.querySelector('#kcLbSub').textContent = `${refPage.theme || ''} · Sayfa ${refPage.page || '?'}`;
    const wrap = lb.querySelector('#kcLbImgWrap');
    if (refPage.imageUrl) {
      wrap.innerHTML = `<img src="${esc(refPage.imageUrl)}" alt="MEB Ders Kitabı Sayfa ${esc(refPage.page)}" style="max-width:100%;height:auto;border-radius:10px;border:1px solid #dccab8;box-shadow:0 6px 20px rgba(44,26,14,0.15);" onerror="this.outerHTML='<div style=\\'padding:36px;color:#6a5242;\\'>📖 Sayfa görseli şu an yüklenemedi.<br><small>${esc(refPage.r2_key || refPage.imageUrl)}</small></div>'">`;
    } else {
      wrap.innerHTML = `<div style="padding:36px;color:#6a5242;">📖 Referans kayıt: ${esc(refPage.book)} · Sayfa ${esc(refPage.page)}</div>`;
    }
    lb.style.display = 'flex';
  }

  function renderReferencePagesHtml(refPages) {
    if (!Array.isArray(refPages) || !refPages.length) return '';
    return `
      <div class="kc-ref-section">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <strong style="color:#2c1a0e;font-size:0.92rem;">📖 Kaynak MEB Ders Kitabı Sayfaları (${refPages.length})</strong>
          <span style="font-size:0.78rem;color:#6a5242;">Büyütmek için sayfaya tıkla</span>
        </div>
        <div class="kc-ref-grid">
          ${refPages.map((rp, i) => `
            <button type="button" class="kc-ref-card" data-ref-idx="${i}">
              <div class="kc-ref-thumb">
                ${rp.imageUrl ? `<img src="${esc(rp.imageUrl)}" alt="Sayfa ${esc(rp.page)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><span style="display:none;font-size:1.8rem;">📄</span>` : '<span style="font-size:1.8rem;">📄</span>'}
                <span class="kc-ref-page-pill">Sayfa ${esc(rp.page || '?')}</span>
              </div>
              <div class="kc-ref-meta">
                <strong title="${esc(rp.book)}">${esc(rp.book || 'MEB Ders Kitabı')}</strong>
                <span title="${esc(rp.theme)}">${esc(rp.theme || 'Konu Sayfası')}</span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function initFlashcardDeck(cards) {
    readerState.deckQueue = (cards || []).map((c, idx) => ({ ...c, _id: idx }));
    readerState.totalCards = readerState.deckQueue.length;
    readerState.masteredCount = 0;
    readerState.cardFlipped = false;
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
    const banner = $('kcResumeBanner');
    if (banner) {
      if (state.lastAccessed) {
        banner.style.display = 'flex';
        if ($('kcResumeTitle')) $('kcResumeTitle').textContent = `${state.lastAccessed.themeTitle} · ${state.lastAccessed.subTopicTitle}`;
        if ($('kcResumeSub')) $('kcResumeSub').textContent = `${state.lastAccessed.grade}. Sınıf · Konu anlatımı · %${state.lastAccessed.percent} tamamlandı`;
        const btn = $('kcResumeBtn');
        if (btn) btn.onclick = () => openTopicById(state.lastAccessed.topicId, 'lesson', null);
      } else {
        banner.style.display = 'none';
      }
    }

    if ($('kcOverallSummary')) {
      $('kcOverallSummary').textContent = `${state.overall.completed} / ${state.overall.total} konu tamamlandı (%${state.overall.percent})`;
    }

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
      const firstId = theme.topics[0]?.id || '';

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
            <div class="kc-stat-col"><strong>${theme.completedCount}</strong><span>Tamamlanan</span></div>
            <div class="kc-stat-col"><strong>${theme.inProgressCount}</strong><span>Devam Eden</span></div>
            <div class="kc-stat-col"><strong>${theme.totalCount}</strong><span>Toplam Konu</span></div>
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
        if (btn.dataset.topicId) openTopicById(btn.dataset.topicId, btn.dataset.mode || 'lesson', theme);
      });
    });

    grid.querySelectorAll('[data-go-quiz]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof window.showPanel === 'function') window.showPanel('test-coz', true);
        else location.hash = '#test-coz';
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

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    body.innerHTML = '<div style="text-align:center;padding:48px 16px;color:#6a5242;">Konu anlatımı hazırlanıyor…</div>';

    try {
      const res = await apiJson('/api/student/topics/' + encodeURIComponent(topicId));
      readerState.topic = res.topic;
      readerState.progress = res.progress || { status: 'in_progress', lastPage: 1 };
      readerState.pageIdx = Math.max(0, Math.min((res.topic.lessonPages?.length || 1) - 1, (readerState.progress.lastPage || 1) - 1));
      initFlashcardDeck(res.topic.flashcards || []);
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

    const subNav = $('kcReaderSubTopics');
    if (subNav) {
      const siblings = readerState.theme?.topics || [];
      if (siblings.length > 1) {
        subNav.style.display = 'flex';
        subNav.innerHTML = siblings.map(st => {
          const isCur = st.id === t.id;
          const isDone = st.progressStatus === 'completed';
          return `<button type="button" data-switch-topic="${esc(st.id)}" style="padding:5px 11px;border-radius:999px;border:1.5px solid ${isCur ? '#c2570c' : '#e2d3c3'};background:${isCur ? '#c2570c' : '#fff'};color:${isCur ? '#fff' : '#2c1a0e'};font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">${isDone ? '✓ ' : ''}${esc(st.subTopicTitle)}</button>`;
        }).join('');
        subNav.querySelectorAll('[data-switch-topic]').forEach(btn => {
          btn.addEventListener('click', () => openTopicById(btn.dataset.switchTopic, readerState.mode, readerState.theme));
        });
      } else {
        subNav.style.display = 'none';
      }
    }

    document.querySelectorAll('[data-reader-mode]').forEach(btn => {
      const isAct = btn.dataset.readerMode === readerState.mode;
      btn.style.background = isAct ? '#2c1a0e' : '#fbf1e8';
      btn.style.color = isAct ? '#fff' : '#2c1a0e';
      btn.style.borderColor = isAct ? '#2c1a0e' : '#e2d3c3';
    });

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
      const curPage = pages[readerState.pageIdx] || pages[0] || {};
      const hasBlocks = Boolean(curPage.storyOrContext || curPage.keyRuleBox || curPage.commonMistakeBox || curPage.miniChallenge);
      const svgCode = curPage.visualSvg || curPage.svgDiagram || '';
      const challenge = splitMiniChallenge(curPage.miniChallenge);

      body.innerHTML = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
          ${pages.map((p, i) => `
            <button type="button" data-reader-page="${i}" style="padding:6px 12px;border-radius:8px;border:1.5px solid ${i === readerState.pageIdx ? '#c2570c' : '#e6d7c8'};background:${i === readerState.pageIdx ? '#c2570c' : '#fff'};color:${i === readerState.pageIdx ? '#fff' : '#2c1a0e'};font-size:12.5px;font-weight:700;cursor:pointer;">
              ${i + 1}. Sayfa
            </button>
          `).join('')}
        </div>

        <h3 style="margin:0 0 14px;color:#2c1a0e;font-family:Georgia,serif;font-size:1.2rem;">${esc(curPage.title || `${readerState.pageIdx + 1}. Sayfa`)}</h3>

        <div class="kc-blocks-stack">
          ${hasBlocks ? `
            ${curPage.storyOrContext ? `
              <div class="kc-block-card kc-block-story">
                <div class="kc-block-head">🎯 Keşif &amp; Bağlam</div>
                <div class="kc-block-body">${formatInlineMath(curPage.storyOrContext)}</div>
              </div>
            ` : ''}

            ${svgCode && svgCode.includes('<svg') ? `
              <div class="kc-block-card kc-block-svg">
                <div class="kc-block-head">📐 Görsel Şema</div>
                <div class="kc-svg-frame" id="kcPageSvgMount"></div>
              </div>
            ` : ''}

            ${curPage.keyRuleBox ? `
              <div class="kc-block-card kc-block-rule">
                <div class="kc-block-head">💡 Altın Kural &amp; Formül</div>
                <div class="kc-block-body">${formatInlineMath(curPage.keyRuleBox)}</div>
              </div>
            ` : ''}

            ${curPage.commonMistakeBox ? `
              <div class="kc-block-card kc-block-mistake">
                <div class="kc-block-head">⚠️ Kavram Yanılgısı / Tuzak Uyarısı</div>
                <div class="kc-block-body">${formatInlineMath(curPage.commonMistakeBox)}</div>
              </div>
            ` : ''}

            ${challenge.question ? `
              <div class="kc-block-card kc-block-challenge">
                <div class="kc-block-head">🎮 Etkileşimli Mini Meydan Okuma</div>
                <div class="kc-block-body" style="font-weight:600;">${formatInlineMath(challenge.question)}</div>
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                  <button type="button" id="kcRevealChallengeBtn" style="padding:8px 16px;border-radius:9px;border:0;background:#2c1a0e;color:#fff;font-weight:700;font-size:0.84rem;cursor:pointer;">🔍 Cevabı Kontrol Et</button>
                  <span id="kcChallengeBadge" style="display:none;padding:4px 10px;border-radius:999px;font-size:0.8rem;font-weight:700;"></span>
                </div>
                <div class="kc-challenge-answer" id="kcChallengeAnswerBox">
                  <div>✅ Çözüm / Cevap: ${formatInlineMath(challenge.answer)}</div>
                  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" id="kcChallengeCorrectBtn" style="padding:5px 12px;border-radius:8px;border:1px solid #059669;background:#059669;color:#fff;font-size:0.8rem;font-weight:700;cursor:pointer;">🎉 Doğru Bildim!</button>
                    <button type="button" id="kcChallengeRetryBtn" style="padding:5px 12px;border-radius:8px;border:1px solid #c2570c;background:#fff;color:#c2570c;font-size:0.8rem;font-weight:700;cursor:pointer;">🔁 Tekrar Gözden Geçireyim</button>
                  </div>
                </div>
              </div>
            ` : ''}
          ` : `
            <div class="kc-block-card">
              <div class="kc-block-body">${formatInlineMath(curPage.content || '')}</div>
              ${svgCode && svgCode.includes('<svg') ? '<div class="kc-svg-frame" id="kcPageSvgMount" style="margin-top:14px;"></div>' : ''}
            </div>
          `}
        </div>

        ${renderReferencePagesHtml(t.referenceBookPages)}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;gap:10px;">
          <button type="button" id="kcPrevPageBtn" ${readerState.pageIdx <= 0 ? 'disabled' : ''} style="padding:8px 16px;border-radius:9px;border:1.5px solid #dccab8;background:#fff;color:#2c1a0e;font-weight:600;cursor:pointer;opacity:${readerState.pageIdx <= 0 ? '0.45' : '1'};">← Önceki Sayfa</button>
          <span style="font-size:13px;font-weight:700;color:#6a5242;">Sayfa ${readerState.pageIdx + 1} / ${pages.length || 1}</span>
          <button type="button" id="kcNextPageBtn" ${readerState.pageIdx >= pages.length - 1 ? 'disabled' : ''} style="padding:8px 16px;border-radius:9px;border:1.5px solid #2c1a0e;background:#2c1a0e;color:#fff;font-weight:600;cursor:pointer;opacity:${readerState.pageIdx >= pages.length - 1 ? '0.45' : '1'};">Sonraki Sayfa →</button>
        </div>
      `;

      if (svgCode && svgCode.includes('<svg')) {
        mountSafeSvg($('kcPageSvgMount'), svgCode);
      }

      $('kcRevealChallengeBtn')?.addEventListener('click', () => {
        $('kcChallengeAnswerBox')?.classList.add('revealed');
        const btn = $('kcRevealChallengeBtn');
        if (btn) btn.style.display = 'none';
      });
      $('kcChallengeCorrectBtn')?.addEventListener('click', () => {
        const badge = $('kcChallengeBadge');
        if (badge) {
          badge.textContent = '🏆 Harika! Kazanımı kavradın';
          badge.style.background = '#ecfdf5';
          badge.style.color = '#065f46';
          badge.style.display = 'inline-block';
        }
      });
      $('kcChallengeRetryBtn')?.addEventListener('click', () => {
        const badge = $('kcChallengeBadge');
        if (badge) {
          badge.textContent = '💡 Altın Kural kutusuna tekrar göz atabilirsin';
          badge.style.background = '#fdf1e3';
          badge.style.color = '#9a3412';
          badge.style.display = 'inline-block';
        }
      });

      body.querySelectorAll('[data-ref-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const rp = (t.referenceBookPages || [])[Number(btn.dataset.refIdx)];
          if (rp) openBookLightbox(rp);
        });
      });

      const goPage = idx => {
        readerState.pageIdx = idx;
        renderReader();
        body.scrollTop = 0;
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
      const themes = [
        { bg: '#c2570c', icon: '💡', cat: 'Altın Kural' },
        { bg: '#2c1a0e', icon: '⚡', cat: 'Hızlı İpucu' },
        { bg: '#b45309', icon: '🎯', cat: 'Sınav Odağı' },
        { bg: '#059669', icon: '🔑', cat: 'Kilit Formül' },
        { bg: '#9a3412', icon: '📌', cat: 'Unutma' }
      ];
      body.innerHTML = `
        <div class="kc-hap-grid">
          ${notes.map((n, idx) => {
            const th = themes[idx % themes.length];
            const num = String(idx + 1).padStart(2, '0');
            return `
              <div class="kc-hap-card" style="border-top:4px solid ${th.bg};">
                <div class="kc-hap-top">
                  <span class="kc-hap-num" style="background:${th.bg};">${num}</span>
                  <span class="kc-hap-cat">${th.icon} ${th.cat}</span>
                </div>
                <div style="color:#2c1a0e;font-size:0.95rem;line-height:1.68;">${formatInlineMath(n)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    } else if (readerState.mode === 'cards') {
      const allCards = t.flashcards || [];
      if (!allCards.length) {
        body.innerHTML = '<div style="text-align:center;padding:40px;color:#6a5242;background:#fffaf5;border:1px dashed #dccab8;border-radius:14px;">Bu konu için henüz bilgi kartı eklenmemiş.</div>';
        return;
      }

      const pct = readerState.totalCards > 0 ? Math.round((readerState.masteredCount / readerState.totalCards) * 100) : 0;

      if (!readerState.deckQueue.length) {
        body.innerHTML = `
          <div style="max-width:520px;margin:20px auto;text-align:center;background:#fff;border:2px solid #059669;border-radius:20px;padding:34px 24px;box-shadow:0 12px 30px rgba(5,150,105,0.12);">
            <div style="font-size:3rem;margin-bottom:8px;">🎉</div>
            <h3 style="margin:0 0 8px;font-family:Georgia,serif;color:#065f46;font-size:1.35rem;">Tebrikler! Tüm Kartları Öğrendin</h3>
            <p style="margin:0 0 18px;color:#6a5242;font-size:0.94rem;"><strong>${readerState.totalCards} / ${readerState.totalCards}</strong> bilgi kartını başarıyla tamamladın. Konu anlatımını pekiştirmek için artık soru çözmeye hazırsın!</p>
            <div style="height:10px;border-radius:999px;background:#d1fae5;overflow:hidden;margin-bottom:20px;">
              <div style="width:100%;height:100%;background:#059669;"></div>
            </div>
            <button type="button" id="kcRestartDeckBtn" style="padding:10px 22px;border-radius:10px;border:0;background:linear-gradient(135deg,#c2570c 0%,#9a3412 100%);color:#fff;font-weight:700;cursor:pointer;">🔁 Desteyi Baştan Oyna</button>
          </div>
        `;
        $('kcRestartDeckBtn')?.addEventListener('click', () => {
          initFlashcardDeck(allCards);
          renderReader();
        });
        return;
      }

      const card = readerState.deckQueue[0];
      body.innerHTML = `
        <div style="max-width:560px;margin:0 auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;font-weight:700;color:#6a5242;margin-bottom:6px;">
            <span>✅ Öğrenilen: ${readerState.masteredCount} / ${readerState.totalCards}</span>
            <span>Destede Kalan: ${readerState.deckQueue.length} · %${pct}</span>
          </div>
          <div style="height:8px;border-radius:999px;background:#efe2d4;overflow:hidden;margin-bottom:18px;">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#c2570c,#059669);transition:width .35s ease;"></div>
          </div>

          <div class="kc-fc-scene">
            <div class="kc-fc-card ${readerState.cardFlipped ? 'is-flipped' : ''}" id="kc3dFlashcard">
              <div class="kc-fc-face kc-fc-front">
                <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:3px 12px;border-radius:999px;background:rgba(255,255,255,0.14);color:#fed7aa;">Soru / Kavram</span>
                <div style="font-size:1.15rem;font-weight:600;line-height:1.6;">${formatInlineMath(card.front)}</div>
                <span style="font-size:0.78rem;color:#dfd0c2;margin-top:8px;">👆 Cevabı görmek için karta tıkla</span>
              </div>
              <div class="kc-fc-face kc-fc-back">
                <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:3px 12px;border-radius:999px;background:#fdf1e3;color:#c2570c;border:1px solid #e8c9a4;">Cevap &amp; Açıklama</span>
                <div style="font-size:1.1rem;font-weight:700;line-height:1.6;color:#2c1a0e;">${formatInlineMath(card.back)}</div>
                ${card.tip ? `<div style="margin-top:4px;font-size:0.84rem;color:#9a3412;background:#fff;border:1px solid #f0d7b8;padding:6px 12px;border-radius:8px;">💡 İpucu: ${formatInlineMath(card.tip)}</div>` : ''}
              </div>
            </div>
          </div>

          <div style="display:flex;justify-content:center;gap:12px;margin-top:20px;min-height:44px;flex-wrap:wrap;">
            ${readerState.cardFlipped ? `
              <button type="button" id="kcCardRepeatBtn" style="padding:10px 18px;border-radius:10px;border:1.5px solid #c2570c;background:#fffaf5;color:#c2570c;font-weight:700;font-size:0.88rem;cursor:pointer;">🔄 Tekrar Etmeliyim</button>
              <button type="button" id="kcCardMasterBtn" style="padding:10px 22px;border-radius:10px;border:0;background:#059669;color:#fff;font-weight:700;font-size:0.88rem;cursor:pointer;box-shadow:0 4px 12px rgba(5,150,105,0.28);">✅ Öğrendim</button>
            ` : `
              <button type="button" id="kcCardFlipBtn" style="padding:10px 24px;border-radius:10px;border:0;background:#2c1a0e;color:#fff;font-weight:700;font-size:0.88rem;cursor:pointer;">🔄 Kartı Çevir</button>
            `}
          </div>
        </div>
      `;

      const flip = () => { readerState.cardFlipped = !readerState.cardFlipped; renderReader(); };
      $('kc3dFlashcard')?.addEventListener('click', flip);
      $('kcCardFlipBtn')?.addEventListener('click', flip);
      $('kcCardRepeatBtn')?.addEventListener('click', () => {
        const cur = readerState.deckQueue.shift();
        if (cur) readerState.deckQueue.push(cur);
        readerState.cardFlipped = false;
        renderReader();
      });
      $('kcCardMasterBtn')?.addEventListener('click', () => {
        readerState.deckQueue.shift();
        readerState.masteredCount += 1;
        readerState.cardFlipped = false;
        renderReader();
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
    injectStyles();

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
        const res = await apiJson('/api/student/topics/' + encodeURIComponent(readerState.topic.id) + '/complete', { method: 'POST' });
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
      if (typeof window.showPanel === 'function') window.showPanel('ai-mentor-panel', true);
      else location.hash = '#ai-mentor-panel';
    });

    loadTopics();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
