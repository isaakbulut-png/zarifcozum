// Öğretmen Paneli "Konu Anlatımı Üret" Stüdyosu (İnceleme, Düzenleme, Yayınlama & Yayınlananlar Listesi)
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let currentTopic = null;
  let activeStudioTab = 'pages'; // 'pages' | 'notes' | 'cards'
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
    if (type === 'ok') el.style.color = '#065f46';
    else if (type === 'error') el.style.color = '#991b1b';
    else el.style.color = '#6a5242';
  }

  function normalizeTopicData(raw) {
    const defaultTitles = [
      '1. Sayfa: Gerçek Hayat Keşfi',
      '2. Sayfa: Kavram İnşası & Şemalar',
      '3. Sayfa: Adım Adım Çözümlü Örnekler',
      '4. Sayfa: Sık Yapılan Hatalar',
      '5. Sayfa: Kendini Dene & Pekiştirme'
    ];
    let pages = Array.isArray(raw.lessonPages) && raw.lessonPages.length
      ? raw.lessonPages.map((p, i) => ({
          pageNumber: Number(p.pageNumber) || (i + 1),
          title: p.title || defaultTitles[i] || `${i + 1}. Sayfa`,
          content: p.content || '',
          svgDiagram: p.svgDiagram || ''
        }))
      : [];

    if (!pages.length && raw.detailed_content) {
      const parts = String(raw.detailed_content).split(/\[SAYFA_(\d+)\]/gi);
      if (parts.length >= 3) {
        for (let i = 1; i < parts.length; i += 2) {
          const no = Number(parts[i]) || (pages.length + 1);
          pages.push({ pageNumber: no, title: defaultTitles[no - 1] || `${no}. Sayfa`, content: (parts[i + 1] || '').trim(), svgDiagram: '' });
        }
      } else {
        pages.push({ pageNumber: 1, title: defaultTitles[0], content: raw.detailed_content, svgDiagram: '' });
      }
    }
    while (pages.length < 5) {
      const i = pages.length;
      pages.push({ pageNumber: i + 1, title: defaultTitles[i], content: '', svgDiagram: '' });
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
      teacherNotes: raw.teacherNotes || '',
      status: raw.status || 'draft'
    };
  }

  function renderRichContent(container, text, svgDiagram) {
    container.replaceChildren();
    const full = text + (svgDiagram && svgDiagram.includes('<svg') ? '\n\n' + svgDiagram : '');
    if (window.zarifAiVisual && typeof window.zarifAiVisual.append === 'function') {
      window.zarifAiVisual.append(container, full);
    } else if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
      container.innerHTML = window.zarifMathText.format(text);
      if (svgDiagram && svgDiagram.includes('<svg')) {
        const div = document.createElement('div');
        div.style.cssText = 'margin:14px 0;text-align:center;';
        div.innerHTML = svgDiagram;
        container.appendChild(div);
      }
    } else {
      container.textContent = text;
    }
  }

  function renderStudio() {
    if (!currentTopic) return;
    const wrap = $('currPreviewWrapper');
    if (!wrap) return;
    wrap.style.display = 'block';

    if ($('currEditTitle')) $('currEditTitle').value = currentTopic.title || '';
    if ($('currEditSummary')) $('currEditSummary').value = currentTopic.short_summary || '';
    if ($('currPreviewMeta')) {
      $('currPreviewMeta').textContent = `${currentTopic.grade}. Sınıf · ${currentTopic.themeCode} · ${currentTopic.themeTitle} › ${currentTopic.subTopicTitle}${currentTopic.outcome_code ? ' [' + currentTopic.outcome_code + ']' : ''}`;
    }

    // Ana sekme butonları aktiflik
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
      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;" id="currStudioPagePills">
            ${currentTopic.lessonPages.map((p, i) => `
              <button type="button" data-page-idx="${i}" style="padding:6px 12px;border-radius:8px;border:1.5px solid ${i === activePageIdx ? '#c2570c' : '#e2d3c3'};background:${i === activePageIdx ? '#c2570c' : '#fff'};color:${i === activePageIdx ? '#fff' : '#2c1a0e'};font-size:12.5px;font-weight:600;cursor:pointer;">
                ${i + 1}. Sayfa
              </button>
            `).join('')}
          </div>
          <button type="button" id="togglePageEditMode" style="padding:6px 12px;border-radius:8px;border:1.5px solid #c2570c;background:${editMode ? '#c2570c' : '#fffaf5'};color:${editMode ? '#fff' : '#c2570c'};font-size:12.5px;font-weight:600;cursor:pointer;">
            ${editMode ? '👁️ Önizlemeye Dön' : '✏️ Bu Sayfayı Düzenle'}
          </button>
        </div>
        ${editMode ? `
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:600;color:#2c1a0e;margin-bottom:4px;">Sayfa Başlığı</label>
              <input type="text" id="pageEditTitle" value="${esc(page.title)}" style="width:100%;padding:9px 12px;border:1.5px solid #dccab8;border-radius:8px;font-size:14px;">
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:600;color:#2c1a0e;margin-bottom:4px;">Konu Anlatım Metni (KaTeX $...$ ve $$...$$ destekli)</label>
              <textarea id="pageEditContent" rows="10" style="width:100%;padding:10px 12px;border:1.5px solid #dccab8;border-radius:8px;font-size:13.5px;line-height:1.6;font-family:inherit;">${esc(page.content)}</textarea>
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:600;color:#2c1a0e;margin-bottom:4px;">SVG Şema Kodu (İsteğe bağlı)</label>
              <textarea id="pageEditSvg" rows="3" style="width:100%;padding:8px 10px;border:1.5px solid #dccab8;border-radius:8px;font-size:12px;font-family:monospace;">${esc(page.svgDiagram || '')}</textarea>
            </div>
          </div>
        ` : `
          <div style="background:#fff;border:1px solid #e6d7c8;border-radius:12px;padding:22px;">
            <h4 style="margin:0 0 12px;color:#2c1a0e;font-size:17px;border-bottom:1px solid #f0e4d6;padding-bottom:8px;">${esc(page.title)}</h4>
            <div id="currStudioRichMount" class="zp-anlatim" style="line-height:1.75;color:#2c1a0e;"></div>
          </div>
        `}
      `;

      body.querySelectorAll('[data-page-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          activePageIdx = Number(btn.dataset.pageIdx);
          renderStudio();
        });
      });

      $('togglePageEditMode')?.addEventListener('click', () => {
        editMode = !editMode;
        renderStudio();
      });

      if (editMode) {
        $('pageEditTitle')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].title = e.target.value; });
        $('pageEditContent')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].content = e.target.value; });
        $('pageEditSvg')?.addEventListener('input', e => { currentTopic.lessonPages[activePageIdx].svgDiagram = e.target.value; });
      } else {
        const mount = $('currStudioRichMount');
        if (mount) renderRichContent(mount, page.content, page.svgDiagram);
      }
    } else if (activeStudioTab === 'notes') {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${currentTopic.practicalNotes.map((note, idx) => `
            <div style="display:flex;gap:8px;align-items:flex-start;background:#fffaf5;border:1px solid #e6d7c8;border-radius:10px;padding:10px 12px;">
              <span style="font-weight:700;color:#c2570c;font-size:13px;padding-top:6px;">${idx + 1}.</span>
              <textarea data-note-idx="${idx}" rows="2" style="flex:1;padding:7px 10px;border:1px solid #dccab8;border-radius:8px;font-size:13.5px;font-family:inherit;">${esc(note)}</textarea>
              <button type="button" data-del-note="${idx}" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:600;">Sil</button>
            </div>
          `).join('')}
          <button type="button" id="addPracticalNoteBtn" style="align-self:flex-start;padding:8px 14px;border-radius:8px;border:1.5px dashed #c2570c;background:#fffaf5;color:#c2570c;font-weight:600;font-size:13px;cursor:pointer;">+ Yeni Hap Bilgi Ekle</button>
        </div>
      `;
      body.querySelectorAll('[data-note-idx]').forEach(ta => {
        ta.addEventListener('input', e => { currentTopic.practicalNotes[Number(ta.dataset.noteIdx)] = e.target.value; });
      });
      body.querySelectorAll('[data-del-note]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTopic.practicalNotes.splice(Number(btn.dataset.delNote), 1);
          renderStudio();
        });
      });
      $('addPracticalNoteBtn')?.addEventListener('click', () => {
        currentTopic.practicalNotes.push('');
        renderStudio();
      });
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
      body.querySelectorAll('[data-del-card]').forEach(btn => btn.addEventListener('click', () => {
        currentTopic.flashcards.splice(Number(btn.dataset.delCard), 1);
        renderStudio();
      }));
      $('addFlashcardBtn')?.addEventListener('click', () => {
        currentTopic.flashcards.push({ front: '', back: '', tip: '' });
        renderStudio();
      });
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
      const payload = {
        ...currentTopic,
        status: targetStatus
      };
      const res = await apiJson('/api/ai/curriculum-content/publish', {
        method: 'POST',
        body: JSON.stringify(payload)
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
        setStatus('5 sayfalık konu anlatımı, pratik hap bilgiler ve bilgi kartları üretiliyor (15-30 sn sürebilir)…');
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
          setStatus('✅ İçerik üretildi! Aşağıda inceleyip düzenleyebilir, ardından öğrenci paneline yayınlayabilirsiniz.', 'ok');
        } catch (err) {
          setStatus('Üretim hatası: ' + err.message, 'error');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }

    document.querySelectorAll('[data-studio-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeStudioTab = btn.dataset.studioTab;
        renderStudio();
      });
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
