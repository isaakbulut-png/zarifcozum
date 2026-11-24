// Öğretmen Paneli "Konu Anlatımı Üret" Stüdyosu (2. Aşama: Yapısal Blok Kartları, R2 MEB Kitap Referansları, Düzenleme & Yayınlama)
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function injectStudioStyles() {
    if (document.getElementById('currStudioPhase2Css')) return;
    const style = document.createElement('style');
    style.id = 'currStudioPhase2Css';
    style.textContent = `
      .cs-blocks{display:flex;flex-direction:column;gap:12px}
      .cs-card{border-radius:13px;padding:15px 17px;border:1px solid #e6d7c8;background:#fff}
      .cs-head{font-weight:800;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.25px;margin-bottom:7px}
      .cs-body{font-size:0.94rem;line-height:1.68;color:#2c1a0e}
      .cs-story{background:linear-gradient(135deg,#fffcf5 0%,#fdf4e3 100%);border-color:#efd6a8;border-left:4px solid #d97706}
      .cs-story .cs-head{color:#92400e}
      .cs-svg{background:#fff;border:1.5px solid #e6d7c8;text-align:center}
      .cs-svg-box{width:100%;max-width:520px;margin:0 auto;padding:10px;border-radius:10px;background:#fffaf5;border:1px solid #f0e4d6;overflow:hidden}
      .cs-svg-box svg{width:100%;max-width:520px;height:auto;display:block;margin:0 auto}
      .cs-rule{background:linear-gradient(135deg,#fffaf5 0%,#fdf1e3 100%);border-color:#e8c4a0;border-left:4px solid #c2570c}
      .cs-rule .cs-head{color:#9a3412}
      .cs-mistake{background:linear-gradient(135deg,#fff8f6 0%,#fef2f2 100%);border-color:#fecaca;border-left:4px solid #dc2626}
      .cs-mistake .cs-head{color:#991b1b}
      .cs-challenge{background:linear-gradient(135deg,#f8f5f0 0%,#fbf1e8 100%);border:1.5px solid #2c1a0e;border-left:5px solid #2c1a0e}
      .cs-challenge .cs-head{color:#2c1a0e}
      .cs-ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:10px}
      .cs-ref-card{background:#fff;border:1px solid #e6d7c8;border-radius:10px;overflow:hidden;cursor:pointer;padding:0;text-align:left;transition:transform .15s ease}
      .cs-ref-card:hover{transform:translateY(-2px);border-color:#c2570c}
      .cs-ref-thumb{height:96px;background:#f5ece2;display:grid;place-items:center;position:relative;overflow:hidden}
      .cs-ref-thumb img{width:100%;height:100%;object-fit:cover}
      .cs-ref-pill{position:absolute;top:5px;right:5px;background:rgba(44,26,14,0.88);color:#fed7aa;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px}
      .cs-lightbox{display:none;position:fixed;inset:0;z-index:10060;background:rgba(20,10,4,0.82);align-items:center;justify-content:center;padding:20px}
    `;
    document.head.appendChild(style);
  }

  let currentTopic = null;
  let activeStudioTab = 'pages';
  let activePageIdx = 0;
  let editMode = false;

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

  function setStatus(msg, type = '') {
    const el = $('currStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'status' + (type ? ' ' + type : '');
    el.style.color = type === 'ok' ? '#065f46' : type === 'error' ? '#991b1b' : '#6a5242';
  }

  function formatInlineMath(text) {
    const clean = String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*\*/g, '');
    if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
      return window.zarifMathText.format(clean);
    }
    return esc(clean);
  }

  function mountSvg(container, rawSvg) {
    if (!container || !rawSvg || !String(rawSvg).includes('<svg')) return;
    if (window.zarifSafeSvg && typeof window.zarifSafeSvg.parse === 'function') {
      try {
        const parsed = window.zarifSafeSvg.parse(String(rawSvg).trim());
        window.zarifSafeSvg.render(container, parsed);
        return;
      } catch (e) {}
    }
    try {
      const doc = new DOMParser().parseFromString(String(rawSvg).trim(), 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (svgEl) {
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        container.replaceChildren(svgEl);
      }
    } catch (e) {}
  }

  function openBookLightbox(rp) {
    let lb = document.getElementById('currBookLightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'currBookLightbox';
      lb.className = 'cs-lightbox';
      lb.innerHTML = `
        <div style="background:#fffaf5;border:2px solid #c2570c;border-radius:16px;max-width:860px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;">
          <div style="background:#2c1a0e;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;">
            <div><strong id="csLbTitle" style="font-family:Georgia,serif;"></strong><div id="csLbSub" style="font-size:12px;color:#fed7aa;"></div></div>
            <button type="button" id="csLbClose" style="background:rgba(255,255,255,0.16);border:0;color:#fff;width:32px;height:32px;border-radius:8px;font-size:17px;cursor:pointer;">✕</button>
          </div>
          <div id="csLbBody" style="padding:16px;overflow:auto;text-align:center;background:#fbf1e8;"></div>
        </div>
      `;
      document.body.appendChild(lb);
      lb.addEventListener('click', e => { if (e.target === lb) lb.style.display = 'none'; });
      lb.querySelector('#csLbClose').addEventListener('click', () => { lb.style.display = 'none'; });
    }
    lb.querySelector('#csLbTitle').textContent = rp.book || 'MEB Ders Kitabı';
    lb.querySelector('#csLbSub').textContent = `${rp.theme || ''} · Sayfa ${rp.page || '?'}`;
    lb.querySelector('#csLbBody').innerHTML = rp.imageUrl
      ? `<img src="${esc(rp.imageUrl)}" style="max-width:100%;height:auto;border-radius:10px;border:1px solid #dccab8;" onerror="this.outerHTML='<div style=\\'padding:30px;color:#6a5242;\\'>📖 Sayfa görseli yüklenemedi (${esc(rp.r2_key || rp.imageUrl)})</div>'">`
      : `<div style="padding:30px;color:#6a5242;">📖 ${esc(rp.book)} · Sayfa ${esc(rp.page)}</div>`;
    lb.style.display = 'flex';
  }

  function normalizeTopicData(raw) {
    const defaultTitles = [
      '1. Sayfa: Gerçek Hayat Keşfi',
      '2. Sayfa: Kavram İnşası ve Temel Kurallar',
      '3. Sayfa: Adım Adım Çözümlü Örnekler',
      '4. Sayfa: Sık Yapılan Hatalar ve Stratejiler',
      '5. Sayfa: Kendini Dene ve Özet Pekiştirme'
    ];
    let pages = Array.isArray(raw.lessonPages) && raw.lessonPages.length
      ? raw.lessonPages.map((p, i) => ({
          pageNumber: Number(p.pageNumber) || (i + 1),
          title: p.title || defaultTitles[i] || `${i + 1}. Sayfa`,
          storyOrContext: p.storyOrContext || '',
          keyRuleBox: p.keyRuleBox || '',
          visualSvg: p.visualSvg || p.svgDiagram || '',
          commonMistakeBox: p.commonMistakeBox || '',
          miniChallenge: p.miniChallenge || '',
          content: p.content || '',
          svgDiagram: p.svgDiagram || p.visualSvg || ''
        }))
      : [];

    if (!pages.length && raw.detailed_content) {
      const parts = String(raw.detailed_content).split(/\[SAYFA_(\d+)\]/gi);
      if (parts.length >= 3) {
        for (let i = 1; i < parts.length; i += 2) {
          const no = Number(parts[i]) || (pages.length + 1);
          pages.push({ pageNumber: no, title: defaultTitles[no - 1] || `${no}. Sayfa`, storyOrContext: (parts[i + 1] || '').trim(), keyRuleBox: '', visualSvg: '', commonMistakeBox: '', miniChallenge: '', content: (parts[i + 1] || '').trim(), svgDiagram: '' });
        }
      } else {
        pages.push({ pageNumber: 1, title: defaultTitles[0], storyOrContext: raw.detailed_content, keyRuleBox: '', visualSvg: '', commonMistakeBox: '', miniChallenge: '', content: raw.detailed_content, svgDiagram: '' });
      }
    }
    while (pages.length < 5) {
      const i = pages.length;
      pages.push({ pageNumber: i + 1, title: defaultTitles[i], storyOrContext: '', keyRuleBox: '', visualSvg: '', commonMistakeBox: '', miniChallenge: '', content: '', svgDiagram: '' });
    }

    return {
      id: raw._id || raw.id || null,
      grade: Number(raw.grade) || 6,
      subject: raw.subject || 'Matematik',
      themeCode: raw.themeCode || `MAT.${raw.grade || 6}.1`,
      themeTitle: raw.themeTitle || raw.unit_topic || '',
      subTopicTitle: raw.subTopicTitle || raw.sub_topic || '',
      unit_topic: raw.unit_topic || raw.themeTitle || '',
      sub_topic: raw.sub_topic || raw.subTopicTitle || '',
      outcome_code: raw.outcome_code || '',
      title: raw.title || raw.subTopicTitle || raw.sub_topic || 'Konu Anlatımı',
      short_summary: raw.short_summary || '',
      lessonPages: pages,
      practicalNotes: Array.isArray(raw.practicalNotes) ? [...raw.practicalNotes] : [],
      flashcards: Array.isArray(raw.flashcards) ? raw.flashcards.map(c => ({ front: c.front || '', back: c.back || '', tip: c.tip || '' })) : [],
      referenceBookPages: Array.isArray(raw.referenceBookPages) ? [...raw.referenceBookPages] : [],
      teacherNotes: raw.teacherNotes || '',
      status: raw.status || 'draft'
    };
  }

  function renderStudio() {
    if (!currentTopic) return;
    const wrap = $('currPreviewWrapper');
    if (!wrap) return;
    wrap.style.display = 'block';

    if ($('currEditTitle')) $('currEditTitle').value = currentTopic.title || '';
    if ($('currEditSummary')) $('currEditSummary').value = currentTopic.short_summary || '';
    if ($('currPreviewMeta')) {
      const refInfo = currentTopic.referenceBookPages?.length ? ` · 📖 ${currentTopic.referenceBookPages.length} MEB Kitap Sayfası Bağlı` : '';
      $('currPreviewMeta').textContent = `${currentTopic.grade}. Sınıf · ${currentTopic.themeCode} · ${currentTopic.themeTitle} › ${currentTopic.subTopicTitle}${currentTopic.outcome_code ? ' [' + currentTopic.outcome_code + ']' : ''}${refInfo}`;
    }

    document.querySelectorAll('[data-studio-tab]').forEach(btn => {
      const isAct = btn.dataset.studioTab === activeStudioTab;
      btn.style.background = isAct ? '#2c1a0e' : '#fbf1e8';
      btn.style.color = isAct ? '#fff' : '#2c1a0e';
      btn.style.borderColor = isAct ? '#2c1a0e' : '#e2d3c3';
    });

    const body = $('currStudioBody');
    if (!body) return;

    if (activeStudioTab === 'pages') {
      const page = currentTopic.lessonPages[activePageIdx] || currentTopic.lessonPages[0];
      const svgCode = page.visualSvg || page.svgDiagram || '';
      const hasBlocks = Boolean(page.storyOrContext || page.keyRuleBox || page.commonMistakeBox || page.miniChallenge);

      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${currentTopic.lessonPages.map((p, i) => `
              <button type="button" data-page-idx="${i}" style="padding:6px 12px;border-radius:8px;border:1.5px solid ${i === activePageIdx ? '#c2570c' : '#e2d3c3'};background:${i === activePageIdx ? '#c2570c' : '#fff'};color:${i === activePageIdx ? '#fff' : '#2c1a0e'};font-size:12.5px;font-weight:700;cursor:pointer;">
                ${i + 1}. Sayfa
              </button>
            `).join('')}
          </div>
          <button type="button" id="togglePageEditMode" style="padding:6px 12px;border-radius:8px;border:1.5px solid #c2570c;background:${editMode ? '#c2570c' : '#fffaf5'};color:${editMode ? '#fff' : '#c2570c'};font-size:12.5px;font-weight:600;cursor:pointer;">
            ${editMode ? '👁️ Kart Önizlemeye Dön' : '✏️ Bu Sayfayı Düzenle'}
          </button>
        </div>

        ${editMode ? `
          <div style="display:flex;flex-direction:column;gap:12px;background:#fffaf5;border:1px solid #e6d7c8;border-radius:12px;padding:16px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#2c1a0e;margin-bottom:4px;">Sayfa Başlığı</label>
              <input type="text" id="peTitle" value="${esc(page.title)}" style="width:100%;padding:8px 11px;border:1.5px solid #dccab8;border-radius:8px;font-size:14px;">
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;">🎯 Keşif / Bağlam Kutusu (storyOrContext)</label>
              <textarea id="peStory" rows="3" style="width:100%;padding:8px 11px;border:1.5px solid #dccab8;border-radius:8px;font-size:13.5px;font-family:inherit;">${esc(page.storyOrContext || page.content)}</textarea>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#9a3412;margin-bottom:4px;">💡 Altın Kural / Formül Kutusu (keyRuleBox)</label>
              <textarea id="peRule" rows="3" style="width:100%;padding:8px 11px;border:1.5px solid #dccab8;border-radius:8px;font-size:13.5px;font-family:inherit;">${esc(page.keyRuleBox)}</textarea>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#991b1b;margin-bottom:4px;">⚠️ Kavram Yanılgısı / Tuzak Uyarısı (commonMistakeBox)</label>
              <textarea id="peMistake" rows="2" style="width:100%;padding:8px 11px;border:1.5px solid #dccab8;border-radius:8px;font-size:13.5px;font-family:inherit;">${esc(page.commonMistakeBox)}</textarea>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#2c1a0e;margin-bottom:4px;">🎮 Etkileşimli Mini Meydan Okuma (miniChallenge — cevabı parantez içinde yazın)</label>
              <textarea id="peChallenge" rows="2" style="width:100%;padding:8px 11px;border:1.5px solid #dccab8;border-radius:8px;font-size:13.5px;font-family:inherit;">${esc(page.miniChallenge)}</textarea>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#2c1a0e;margin-bottom:4px;">📐 SVG Şema Kodu (visualSvg)</label>
              <textarea id="peSvg" rows="4" style="width:100%;padding:8px 10px;border:1.5px solid #dccab8;border-radius:8px;font-size:12px;font-family:monospace;">${esc(svgCode)}</textarea>
            </div>
          </div>
        ` : `
          <h4 style="margin:0 0 12px;color:#2c1a0e;font-family:Georgia,serif;font-size:1.12rem;">${esc(page.title)}</h4>
          <div class="cs-blocks">
            ${hasBlocks ? `
              ${page.storyOrContext ? `<div class="cs-card cs-story"><div class="cs-head">🎯 Keşif &amp; Bağlam</div><div class="cs-body">${formatInlineMath(page.storyOrContext)}</div></div>` : ''}
              ${svgCode && svgCode.includes('<svg') ? `<div class="cs-card cs-svg"><div class="cs-head">📐 Görsel Şema</div><div class="cs-svg-box" id="csPageSvgMount"></div></div>` : ''}
              ${page.keyRuleBox ? `<div class="cs-card cs-rule"><div class="cs-head">💡 Altın Kural &amp; Formül</div><div class="cs-body">${formatInlineMath(page.keyRuleBox)}</div></div>` : ''}
              ${page.commonMistakeBox ? `<div class="cs-card cs-mistake"><div class="cs-head">⚠️ Kavram Yanılgısı / Tuzak Uyarısı</div><div class="cs-body">${formatInlineMath(page.commonMistakeBox)}</div></div>` : ''}
              ${page.miniChallenge ? `<div class="cs-card cs-challenge"><div class="cs-head">🎮 Etkileşimli Mini Meydan Okuma</div><div class="cs-body">${formatInlineMath(page.miniChallenge)}</div></div>` : ''}
            ` : `
              <div class="cs-card"><div class="cs-body">${formatInlineMath(page.content)}</div>${svgCode && svgCode.includes('<svg') ? '<div class="cs-svg-box" id="csPageSvgMount" style="margin-top:12px;"></div>' : ''}</div>
            `}
          </div>

          ${currentTopic.referenceBookPages?.length ? `
            <div style="margin-top:16px;padding-top:14px;border-top:1.5px dashed #e2d3c3;">
              <strong style="color:#2c1a0e;font-size:0.9rem;">📖 Kaynak MEB Ders Kitabı Sayfaları (${currentTopic.referenceBookPages.length})</strong>
              <div class="cs-ref-grid">
                ${currentTopic.referenceBookPages.map((rp, i) => `
                  <button type="button" class="cs-ref-card" data-cs-ref="${i}">
                    <div class="cs-ref-thumb">
                      ${rp.imageUrl ? `<img src="${esc(rp.imageUrl)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><span style="display:none;font-size:1.6rem;">📄</span>` : '<span style="font-size:1.6rem;">📄</span>'}
                      <span class="cs-ref-pill">Sayfa ${esc(rp.page || '?')}</span>
                    </div>
                    <div style="padding:7px 9px;font-size:11.5px;color:#2c1a0e;">
                      <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(rp.book || 'MEB Kitabı')}</strong>
                      <span style="color:#6a5242;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(rp.theme || '')}</span>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        `}
      `;

      body.querySelectorAll('[data-page-idx]').forEach(btn => btn.addEventListener('click', () => { activePageIdx = Number(btn.dataset.pageIdx); renderStudio(); }));
      $('togglePageEditMode')?.addEventListener('click', () => { editMode = !editMode; renderStudio(); });

      if (editMode) {
        $('peTitle')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].title = e.target.value; });
        $('peStory')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].storyOrContext = e.target.value; });
        $('peRule')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].keyRuleBox = e.target.value; });
        $('peMistake')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].commonMistakeBox = e.target.value; });
        $('peChallenge')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].miniChallenge = e.target.value; });
        $('peSvg')?.addEventListener('input', e => {
          currentTopic.lessonPages[activePageIdx].visualSvg = e.target.value;
          currentTopic.lessonPages[activePageIdx].svgDiagram = e.target.value;
        });
      } else {
        if (svgCode && svgCode.includes('<svg')) mountSvg($('csPageSvgMount'), svgCode);
        body.querySelectorAll('[data-cs-ref]').forEach(btn => {
          btn.addEventListener('click', () => {
            const rp = currentTopic.referenceBookPages[Number(btn.dataset.csRef)];
            if (rp) openBookLightbox(rp);
          });
        });
      }

    } else if (activeStudioTab === 'notes') {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${currentTopic.practicalNotes.map((note, idx) => `
            <div style="display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #e6d7c8;border-left:4px solid #c2570c;border-radius:10px;padding:10px 12px;">
              <span style="background:#c2570c;color:#fff;font-weight:800;font-size:12px;padding:3px 8px;border-radius:7px;">${String(idx + 1).padStart(2, '0')}</span>
              <textarea data-note-idx="${idx}" rows="2" style="flex:1;padding:7px 10px;border:1px solid #dccab8;border-radius:8px;font-size:13.5px;font-family:inherit;">${esc(note)}</textarea>
              <button type="button" data-del-note="${idx}" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:600;">Sil</button>
            </div>
          `).join('')}
          <button type="button" id="addPracticalNoteBtn" style="align-self:flex-start;padding:8px 14px;border-radius:8px;border:1.5px dashed #c2570c;background:#fffaf5;color:#c2570c;font-weight:600;font-size:13px;cursor:pointer;">+ Yeni Hap Bilgi Ekle</button>
        </div>
      `;
      body.querySelectorAll('[data-note-idx]').forEach(ta => ta.addEventListener('input', e => { currentTopic.practicalNotes[Number(ta.dataset.noteIdx)] = e.target.value; }));
      body.querySelectorAll('[data-del-note]').forEach(btn => btn.addEventListener('click', () => { currentTopic.practicalNotes.splice(Number(btn.dataset.delNote), 1); renderStudio(); }));
      $('addPracticalNoteBtn')?.addEventListener('click', () => { currentTopic.practicalNotes.push(''); renderStudio(); });

    } else if (activeStudioTab === 'cards') {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${currentTopic.flashcards.map((card, idx) => `
            <div style="background:#fffaf5;border:1px solid #e6d7c8;border-radius:12px;padding:12px 14px;display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:start;">
              <div>
                <label style="font-size:11.5px;font-weight:700;color:#6a5242;">Ön Yüz (Soru / Kavram)</label>
                <input type="text" data-card-front="${idx}" value="${esc(card.front)}" style="width:100%;margin-top:4px;padding:7px 10px;border:1px solid #dccab8;border-radius:8px;font-size:13px;">
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;color:#6a5242;">Arka Yüz (Cevap / Formül)</label>
                <input type="text" data-card-back="${idx}" value="${esc(card.back)}" style="width:100%;margin-top:4px;padding:7px 10px;border:1px solid #dccab8;border-radius:8px;font-size:13px;">
                <input type="text" data-card-tip="${idx}" value="${esc(card.tip || '')}" placeholder="İpucu (isteğe bağlı)" style="width:100%;margin-top:6px;padding:6px 10px;border:1px dashed #dccab8;border-radius:8px;font-size:12px;">
              </div>
              <button type="button" data-del-card="${idx}" style="margin-top:20px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:600;">Sil</button>
            </div>
          `).join('')}
          <button type="button" id="addFlashcardBtn" style="align-self:flex-start;padding:8px 14px;border-radius:8px;border:1.5px dashed #c2570c;background:#fffaf5;color:#c2570c;font-weight:600;font-size:13px;cursor:pointer;">+ Yeni Bilgi Kartı Ekle</button>
        </div>
      `;
      body.querySelectorAll('[data-card-front]').forEach(el => el.addEventListener('input', e => { currentTopic.flashcards[Number(el.dataset.cardFront)].front = e.target.value; }));
      body.querySelectorAll('[data-card-back]').forEach(el => el.addEventListener('input', e => { currentTopic.flashcards[Number(el.dataset.cardBack)].back = e.target.value; }));
      body.querySelectorAll('[data-card-tip]').forEach(el => el.addEventListener('input', e => { currentTopic.flashcards[Number(el.dataset.cardTip)].tip = e.target.value; }));
      body.querySelectorAll('[data-del-card]').forEach(btn => btn.addEventListener('click', () => { currentTopic.flashcards.splice(Number(btn.dataset.delCard), 1); renderStudio(); }));
      $('addFlashcardBtn')?.addEventListener('click', () => { currentTopic.flashcards.push({ front: '', back: '', tip: '' }); renderStudio(); });
    }
  }

  async function saveTopic(targetStatus) {
    if (!currentTopic) return;
    currentTopic.title = ($('currEditTitle')?.value || currentTopic.title || '').trim();
    currentTopic.short_summary = ($('currEditSummary')?.value || currentTopic.short_summary || '').trim();

    const pubBtn = $('publishCurriculumBtn');
    const draftBtn = $('saveDraftCurriculumBtn');
    if (pubBtn) pubBtn.disabled = true;
    if (draftBtn) draftBtn.disabled = true;
    setStatus(targetStatus === 'published' ? 'Onaylanıyor ve öğrenci paneline yayınlanıyor…' : 'Taslak olarak kaydediliyor…');

    try {
      const res = await apiJson('/api/ai/curriculum-content/publish', {
        method: 'POST',
        body: JSON.stringify({ ...currentTopic, status: targetStatus })
      });
      currentTopic.status = targetStatus;
      setStatus('🎉 ' + (res.mesaj || 'Başarıyla kaydedildi!'), 'ok');
      await loadPublishedList();
    } catch (err) {
      setStatus('Kaydetme hatası: ' + err.message, 'error');
    } finally {
      if (pubBtn) pubBtn.disabled = false;
      if (draftBtn) draftBtn.disabled = false;
    }
  }

  async function loadPublishedList() {
    const listEl = $('publishedTopicsList');
    if (!listEl) return;
    const gradeFilter = $('publishedTopicsGradeFilter')?.value || '';
    const url = '/api/ai/curriculum-content/my-list' + (gradeFilter ? `?grade=${encodeURIComponent(gradeFilter)}` : '');
    try {
      const res = await apiJson(url);
      const items = res.items || [];
      if (!items.length) {
        listEl.innerHTML = '<p style="margin:0;color:#6a5242;font-size:13.5px;padding:16px;text-align:center;background:#fffaf5;border:1px dashed #e2d3c3;border-radius:10px;">Henüz kaydedilmiş konu anlatımı bulunmuyor. Yukarıdaki formdan ilk konunuzu üretip yayınlayabilirsiniz.</p>';
        return;
      }
      listEl.innerHTML = items.map(it => `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 14px;background:#fffaf5;border:1px solid #e6d7c8;border-radius:12px;">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:#2c1a0e;color:#fed7aa;">${it.grade}. Sınıf</span>
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:#fdf1e3;color:#9a3412;border:1px solid #e8c9a4;">${esc(it.themeCode)}</span>
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${it.status === 'published' ? '#ecfdf5' : '#fef3c7'};color:${it.status === 'published' ? '#065f46' : '#92400e'};">
                ${it.status === 'published' ? '● Yayında' : '○ Taslak'}
              </span>
            </div>
            <div style="font-weight:700;color:#2c1a0e;font-size:14.5px;margin-top:5px;">${esc(it.title)}</div>
            <div style="font-size:12px;color:#6a5242;margin-top:2px;">${esc(it.themeTitle)} › ${esc(it.subTopicTitle)} · ${it.pageCount} Sayfa · ${it.notesCount} Hap Bilgi · ${it.cardsCount} Kart</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" data-edit-topic="${esc(it.id)}" style="padding:7px 12px;border-radius:8px;border:1px solid #c2570c;background:#fff;color:#c2570c;font-weight:600;font-size:12.5px;cursor:pointer;">✏️ Düzenle</button>
            <button type="button" data-del-topic="${esc(it.id)}" style="padding:7px 10px;border-radius:8px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-weight:600;font-size:12.5px;cursor:pointer;">Sil</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-edit-topic]').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await apiJson('/api/ai/curriculum-content/' + encodeURIComponent(btn.dataset.editTopic));
            if (res?.data) {
              currentTopic = normalizeTopicData(res.data);
              activeStudioTab = 'pages';
              activePageIdx = 0;
              editMode = false;
              renderStudio();
              $('currPreviewWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              setStatus('Konu düzenleme için yüklendi.', 'ok');
            }
          } catch (err) {
            setStatus('Konu açılamadı: ' + err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        });
      });

      listEl.querySelectorAll('[data-del-topic]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Bu konu anlatımı kalıcı olarak silinecek. Emin misiniz?')) return;
          btn.disabled = true;
          try {
            await apiJson('/api/ai/curriculum-content/' + encodeURIComponent(btn.dataset.delTopic), { method: 'DELETE' });
            await loadPublishedList();
          } catch (err) {
            alert('Silinemedi: ' + err.message);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p style="color:#991b1b;font-size:13px;">Liste yüklenemedi: ${esc(err.message)}</p>`;
    }
  }

  function init() {
    injectStudioStyles();
    const form = $('aiCurriculumForm');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const grade = $('currGrade')?.value;
        const unit_topic = $('currTema')?.value;
        const sub_topic = $('currAltKonu')?.value;
        const teacherNotes = $('currTeacherNotes')?.value || '';
        const btn = $('generateCurriculumBtn');

        if (!grade || !unit_topic || !sub_topic) {
          setStatus('Lütfen sınıf, tema ve alt konuyu seçin.', 'error');
          return;
        }

        if (btn) btn.disabled = true;
        setStatus('MEB ders kitabı sayfaları taranıyor, 5 sayfalık yapısal anlatım + zorunlu SVG + bilgi kartları üretiliyor (15-30 sn)…');
        if ($('currPreviewWrapper')) $('currPreviewWrapper').style.display = 'none';

        try {
          const res = await apiJson('/api/ai/curriculum-content/generate', {
            method: 'POST',
            body: JSON.stringify({ grade: Number(grade), ders: 'Matematik', unit_topic, sub_topic, teacherNotes })
          });
          currentTopic = normalizeTopicData(res.data);
          activeStudioTab = 'pages';
          activePageIdx = 0;
          editMode = false;
          renderStudio();
          const ragBooks = res.data?.ragSourceCount?.books || currentTopic.referenceBookPages.length;
          setStatus(`✅ İçerik üretildi (${ragBooks} MEB ders kitabı sayfası referans alındı)! İnceleyip yayınlayabilirsiniz.`, 'ok');
        } catch (err) {
          setStatus('Üretim hatası: ' + err.message, 'error');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }

    document.querySelectorAll('[data-studio-tab]').forEach(btn => {
      btn.addEventListener('click', () => { activeStudioTab = btn.dataset.studioTab; renderStudio(); });
    });

    $('publishCurriculumBtn')?.addEventListener('click', () => saveTopic('published'));
    $('saveDraftCurriculumBtn')?.addEventListener('click', () => saveTopic('draft'));
    $('publishedTopicsGradeFilter')?.addEventListener('change', loadPublishedList);
    $('refreshPublishedTopicsBtn')?.addEventListener('click', loadPublishedList);

    loadPublishedList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
