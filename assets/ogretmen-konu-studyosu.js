// Öğretmen Paneli "Konu Anlatımı Üret" Stüdyosu
// 5. Sınıf Ders Kitabı Estetiğinde 2 Sütunlu Sayfa Tasarımı (%55 Sol / %45 Sağ),
// Gerçek Inline SVG Render, Gizli Cevaplı Mini Meydan Okuma & Maarif Kazanım Künyesi
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function injectStudioStyles() {
    if (document.getElementById('currStudioPhase3Css')) return;
    const style = document.createElement('style');
    style.id = 'currStudioPhase3Css';
    style.textContent = `
      .cs-studio-wrap { background: #FAF8F5; border-radius: 18px; padding: 20px; color: #0F172A; }
      .cs-kunye-card {
        background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
        color: #F8FAFC;
        border-radius: 16px;
        padding: 16px 20px;
        margin-bottom: 18px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .cs-kunye-code {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(217, 119, 6, 0.24);
        border: 1px solid rgba(217, 119, 6, 0.55);
        color: #FCD34D;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.85rem;
        font-weight: 800;
      }
      .cs-skill-pills { display: flex; flex-wrap: wrap; gap: 6px; }
      .cs-skill-pill {
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: #E2E8F0;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .cs-two-col {
        display: grid;
        grid-template-columns: 55fr 45fr;
        gap: 20px;
        align-items: start;
      }
      .cs-col { display: flex; flex-direction: column; gap: 14px; }
      .cs-card {
        border-radius: 16px;
        padding: 18px 20px;
        border: 1px solid #E2E8F0;
        background: #FFFFFF;
        box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
      }
      .cs-head {
        font-weight: 800;
        font-size: 0.84rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .cs-body { font-size: 0.98rem; line-height: 1.68; color: #1E293B; }
      .cs-story { background: #FFFFFF; border-left: 4px solid #0F172A; }
      .cs-story .cs-head { color: #0F172A; }
      .cs-rule {
        background: linear-gradient(135deg, #FFFDF9 0%, #FEF3C7 100%);
        border-color: #FCD34D;
        border-left: 5px solid #D97706;
      }
      .cs-rule .cs-head { color: #92400E; }
      .cs-mistake {
        background: linear-gradient(135deg, #FFF8F8 0%, #FEF2F2 100%);
        border-color: #FECACA;
        border-left: 5px solid #DC2626;
      }
      .cs-mistake .cs-head { color: #991B1B; }
      .cs-svg-stage {
        background: #FFFFFF;
        border: 1.5px solid #CBD5E1;
        border-radius: 16px;
        padding: 16px;
        text-align: center;
      }
      .cs-svg-canvas {
        width: 100%;
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #FAF8F5;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 10px;
        overflow: hidden;
      }
      .cs-svg-canvas svg {
        width: 100%;
        max-width: 440px;
        height: auto;
        display: block;
      }
      .cs-challenge {
        background: #FFFFFF;
        border: 1.5px solid #0F172A;
        border-top: 4px solid #D97706;
      }
      .cs-challenge .cs-head { color: #0F172A; }
      .cs-ans-reveal {
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 10px;
        background: #ECFDF5;
        border: 1px solid #A7F3D0;
        color: #065F46;
        font-size: 0.94rem;
        font-weight: 600;
        line-height: 1.55;
      }
      .cs-toggle-ans-btn {
        margin-top: 12px;
        padding: 8px 16px;
        border-radius: 10px;
        border: none;
        background: #D97706;
        color: #FFFFFF;
        font-weight: 800;
        font-size: 0.88rem;
        cursor: pointer;
      }
      .cs-toggle-ans-btn:hover { background: #B45309; }
      @media (max-width: 960px) {
        .cs-two-col { grid-template-columns: 1fr; }
      }
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
    el.style.color = type === 'ok' ? '#059669' : type === 'error' ? '#DC2626' : '#475569';
  }

  function formatInlineMath(text) {
    const clean = String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*\*/g, '');
    if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
      return window.zarifMathText.format(clean);
    }
    return esc(clean);
  }

  // Güvenli Inline SVG temizleyici (script ve on* handler'ları temizler, gerçek <svg> şeklini innerHTML ile çizer)
  function sanitizeInlineSvg(rawSvg) {
    const s = String(rawSvg || '').trim();
    const match = s.match(/<svg[\s\S]*?<\/svg>/i);
    if (!match) return '';
    let svg = match[0]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '');
    if (!/xmlns=/.test(svg)) {
      svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svg;
  }

  function splitLegacyChallenge(rawChallenge, explicitAnswer) {
    if (explicitAnswer && String(explicitAnswer).trim()) {
      return { soru: String(rawChallenge || '').trim(), cevap: String(explicitAnswer).trim() };
    }
    const text = String(rawChallenge || '').trim();
    const m = text.match(/\((?:Cevap\s*:\s*)?([^)]+)\)\s*$/i);
    if (m) {
      return { soru: text.slice(0, m.index).trim(), cevap: m[1].trim() };
    }
    return { soru: text, cevap: '' };
  }

  function normalizeTopicData(raw) {
    const defaultTitles = [
      '1. Sayfa: Gerçek Hayat Keşfi',
      '2. Sayfa: Kavram İnşası ve Temel Kurallar',
      '3. Sayfa: Adım Adım Çözümlü Örnekler',
      '4. Sayfa: Sık Yapılan Hatalar ve Stratejiler',
      '5. Sayfa: Kendini Dene ve Özet Pekiştirme'
    ];
    const topKazanim = raw.kazanim_kodu || raw.outcome_code || `MAT.${raw.grade || 5}.1.1`;
    const topSurec = Array.isArray(raw.surec_becerileri) && raw.surec_becerileri.length
      ? [...raw.surec_becerileri]
      : ['Akıl Yürütme', 'Matematiksel Modelleme', 'Matematiksel Temsil'];

    let pages = Array.isArray(raw.lessonPages) && raw.lessonPages.length
      ? raw.lessonPages.map((p, i) => {
          const split = splitLegacyChallenge(p.mini_soru || p.miniChallenge || '', p.mini_cevap || '');
          const svg = p.svg_kodu || p.visualSvg || p.svgDiagram || '';
          const title = p.baslik || p.title || defaultTitles[i] || `${i + 1}. Sayfa`;
          const story = p.kesif_hikayesi || p.storyOrContext || p.content || '';
          const rule = p.altin_kural || p.keyRuleBox || '';
          const mistake = p.kavram_yanilgisi || p.commonMistakeBox || '';
          return {
            pageNumber: Number(p.pageNumber) || (i + 1),
            baslik: title,
            title,
            kesif_hikayesi: story,
            storyOrContext: story,
            altin_kural: rule,
            keyRuleBox: rule,
            kavram_yanilgisi: mistake,
            commonMistakeBox: mistake,
            mini_soru: split.soru,
            mini_cevap: split.cevap,
            miniChallenge: split.cevap ? `${split.soru} (Cevap: ${split.cevap})` : split.soru,
            svg_kodu: svg,
            visualSvg: svg,
            svgDiagram: svg,
            kazanim_kodu: p.kazanim_kodu || topKazanim,
            surec_becerileri: Array.isArray(p.surec_becerileri) && p.surec_becerileri.length ? [...p.surec_becerileri] : [...topSurec],
            content: p.content || story
          };
        })
      : [];

    while (pages.length < 5) {
      const i = pages.length;
      pages.push({
        pageNumber: i + 1,
        baslik: defaultTitles[i],
        title: defaultTitles[i],
        kesif_hikayesi: '',
        storyOrContext: '',
        altin_kural: '',
        keyRuleBox: '',
        kavram_yanilgisi: '',
        commonMistakeBox: '',
        mini_soru: '',
        mini_cevap: '',
        miniChallenge: '',
        svg_kodu: '',
        visualSvg: '',
        svgDiagram: '',
        kazanim_kodu: topKazanim,
        surec_becerileri: [...topSurec],
        content: ''
      });
    }

    return {
      id: raw._id || raw.id || null,
      grade: Number(raw.grade) || 5,
      subject: raw.subject || 'Matematik',
      themeCode: raw.themeCode || `MAT.${raw.grade || 5}.1`,
      themeTitle: raw.themeTitle || raw.unit_topic || '',
      subTopicTitle: raw.subTopicTitle || raw.sub_topic || '',
      unit_topic: raw.unit_topic || raw.themeTitle || '',
      sub_topic: raw.sub_topic || raw.subTopicTitle || '',
      outcome_code: topKazanim,
      kazanim_kodu: topKazanim,
      surec_becerileri: topSurec,
      title: raw.title || raw.subTopicTitle || raw.sub_topic || 'Konu Anlatımı',
      short_summary: raw.short_summary || '',
      lessonPages: pages,
      practicalNotes: Array.isArray(raw.practicalNotes) ? [...raw.practicalNotes] : [],
      flashcards: Array.isArray(raw.flashcards) ? raw.flashcards.map(c => ({ front: c.front || '', back: c.back || '', tip: c.tip || '' })) : [],
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
      $('currPreviewMeta').textContent = `${currentTopic.grade}. Sınıf · ${currentTopic.kazanim_kodu} · ${currentTopic.themeTitle} › ${currentTopic.subTopicTitle}`;
    }

    document.querySelectorAll('[data-studio-tab]').forEach(btn => {
      const isAct = btn.dataset.studioTab === activeStudioTab;
      btn.style.background = isAct ? '#0F172A' : '#FAF8F5';
      btn.style.color = isAct ? '#FFFFFF' : '#0F172A';
      btn.style.borderColor = isAct ? '#0F172A' : '#CBD5E1';
    });

    const body = $('currStudioBody');
    if (!body) return;

    if (activeStudioTab === 'pages') {
      const page = currentTopic.lessonPages[activePageIdx] || currentTopic.lessonPages[0];
      let safeSvgHtml = sanitizeInlineSvg(page.svg_kodu || page.visualSvg || '');
      if (!safeSvgHtml && window.ZarifVisualRenderer) {
        const inferred = window.ZarifVisualRenderer.inferVisualSpecFromText(`${page.baslik} ${page.kesif_hikayesi} ${page.altin_kural}`, currentTopic.subTopicTitle, currentTopic.grade);
        if (inferred) safeSvgHtml = sanitizeInlineSvg(window.ZarifVisualRenderer.renderToSvg(inferred));
      }

      const pageKazanim = page.kazanim_kodu || currentTopic.kazanim_kodu || `MAT.${currentTopic.grade}.1.1`;
      const pageSkills = Array.isArray(page.surec_becerileri) && page.surec_becerileri.length
        ? page.surec_becerileri
        : currentTopic.surec_becerileri;

      body.innerHTML = `
        <div class="cs-studio-wrap">
          <!-- Sayfa Geçişleri & Düzenleme Butonu -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${currentTopic.lessonPages.map((p, i) => `
                <button type="button" data-page-idx="${i}" style="padding:7px 14px;border-radius:10px;border:1.5px solid ${i === activePageIdx ? '#D97706' : '#CBD5E1'};background:${i === activePageIdx ? '#D97706' : '#FFFFFF'};color:${i === activePageIdx ? '#FFFFFF' : '#0F172A'};font-size:13px;font-weight:700;cursor:pointer;">
                  ${i + 1}. Sayfa
                </button>
              `).join('')}
            </div>
            <button type="button" id="togglePageEditMode" style="padding:7px 14px;border-radius:10px;border:1.5px solid #0F172A;background:${editMode ? '#0F172A' : '#FFFFFF'};color:${editMode ? '#FFFFFF' : '#0F172A'};font-size:13px;font-weight:700;cursor:pointer;">
              ${editMode ? '👁️ Ders Kitabı Önizlemeye Dön' : '✏️ Bu Sayfayı Düzenle'}
            </button>
          </div>

          <!-- Türkiye Yüzyılı Maarif Modeli Kazanım Künyesi (Kırık MEB Resimleri Yerine) -->
          <div class="cs-kunye-card">
            <div>
              <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#94A3B8;margin-bottom:4px;">🇹🇷 Türkiye Yüzyılı Maarif Modeli Kazanım Künyesi</div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span class="cs-kunye-code">${esc(pageKazanim)}</span>
                <strong style="font-size:0.98rem;color:#FFFFFF;">${esc(currentTopic.themeTitle)} › ${esc(currentTopic.subTopicTitle)}</strong>
              </div>
            </div>
            <div class="cs-skill-pills">
              ${pageSkills.map(sk => `<span class="cs-skill-pill">✨ ${esc(sk)}</span>`).join('')}
            </div>
          </div>

          ${editMode ? `
            <div class="cs-card" style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:grid;grid-template-columns:1fr 180px;gap:12px;">
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#0F172A;margin-bottom:4px;">Sayfa Başlığı (baslik)</label>
                  <input type="text" id="peTitle" value="${esc(page.baslik)}" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:14px;">
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#0F172A;margin-bottom:4px;">Kazanım Kodu</label>
                  <input type="text" id="peKazanim" value="${esc(pageKazanim)}" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:14px;font-family:monospace;">
                </div>
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#0F172A;margin-bottom:4px;">🎯 Keşif Hikayesi (kesif_hikayesi)</label>
                <textarea id="peStory" rows="3" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:14px;font-family:inherit;">${esc(page.kesif_hikayesi)}</textarea>
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#92400E;margin-bottom:4px;">💡 Altın Kural (altin_kural)</label>
                <textarea id="peRule" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:14px;font-family:inherit;">${esc(page.altin_kural)}</textarea>
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#991B1B;margin-bottom:4px;">⚠️ Kavram Yanılgısı (kavram_yanilgisi)</label>
                <textarea id="peMistake" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:14px;font-family:inherit;">${esc(page.kavram_yanilgisi)}</textarea>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#0F172A;margin-bottom:4px;">🎮 Mini Soru (mini_soru)</label>
                  <textarea id="peMiniSoru" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:14px;font-family:inherit;">${esc(page.mini_soru)}</textarea>
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#059669;margin-bottom:4px;">✅ Mini Cevap (mini_cevap)</label>
                  <textarea id="peMiniCevap" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:14px;font-family:inherit;">${esc(page.mini_cevap)}</textarea>
                </div>
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#0F172A;margin-bottom:4px;">📐 Inline SVG Kodu (svg_kodu — viewBox="0 0 400 260")</label>
                <textarea id="peSvg" rows="5" style="width:100%;padding:9px 12px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:12px;font-family:monospace;">${esc(page.svg_kodu || page.visualSvg || '')}</textarea>
              </div>
            </div>
          ` : `
            <h4 style="margin:0 0 14px;color:#0F172A;font-size:1.25rem;font-weight:800;">${esc(page.baslik)}</h4>
            <div class="cs-two-col">
              <!-- Sol Sütun (%55): Keşif Hikayesi + Altın Kural + Kavram Yanılgısı -->
              <div class="cs-col">
                ${page.kesif_hikayesi ? `
                  <div class="cs-card cs-story">
                    <div class="cs-head">🎯 Keşif Hikayesi</div>
                    <div class="cs-body">${formatInlineMath(page.kesif_hikayesi)}</div>
                  </div>` : ''}

                ${page.altin_kural ? `
                  <div class="cs-card cs-rule">
                    <div class="cs-head">💡 Altın Kural &amp; Formül</div>
                    <div class="cs-body">${formatInlineMath(page.altin_kural)}</div>
                  </div>` : ''}

                ${page.kavram_yanilgisi ? `
                  <div class="cs-card cs-mistake">
                    <div class="cs-head">⚠️ Kavram Yanılgısı Uyarısı</div>
                    <div class="cs-body">${formatInlineMath(page.kavram_yanilgisi)}</div>
                  </div>` : ''}
              </div>

              <!-- Sağ Sütun (%45): Geniş SVG Görsel Sahnesi + Gizli Cevaplı Mini Meydan Okuma -->
              <div class="cs-col">
                <div class="cs-svg-stage">
                  <div class="cs-head" style="justify-content:center;color:#0F172A;">📐 Görsel Şema Sahnesi</div>
                  <div class="cs-svg-canvas" id="csPageSvgMount"></div>
                </div>

                ${page.mini_soru ? `
                  <div class="cs-card cs-challenge">
                    <div class="cs-head">🎮 Mini Meydan Okuma</div>
                    <div class="cs-body">${formatInlineMath(page.mini_soru)}</div>
                    ${page.mini_cevap ? `
                      <button type="button" class="cs-toggle-ans-btn" id="csToggleAnsBtn">👁️ Cevabı Gör</button>
                      <div class="cs-ans-reveal" id="csMiniAnswerBox" hidden>
                        <strong>✅ Açıklamalı Cevap:</strong> ${formatInlineMath(page.mini_cevap)}
                      </div>` : ''}
                  </div>` : ''}
              </div>
            </div>
          `}
        </div>
      `;

      body.querySelectorAll('[data-page-idx]').forEach(btn => btn.addEventListener('click', () => {
        activePageIdx = Number(btn.dataset.pageIdx);
        renderStudio();
      }));
      $('togglePageEditMode')?.addEventListener('click', () => { editMode = !editMode; renderStudio(); });

      if (editMode) {
        const p = currentTopic.lessonPages[activePageIdx];
        $('peTitle')?.addEventListener('input', e => { p.baslik = p.title = e.target.value; });
        $('peKazanim')?.addEventListener('input', e => { p.kazanim_kodu = e.target.value; });
        $('peStory')?.addEventListener('input', e => { p.kesif_hikayesi = p.storyOrContext = p.content = e.target.value; });
        $('peRule')?.addEventListener('input', e => { p.altin_kural = p.keyRuleBox = e.target.value; });
        $('peMistake')?.addEventListener('input', e => { p.kavram_yanilgisi = p.commonMistakeBox = e.target.value; });
        $('peMiniSoru')?.addEventListener('input', e => {
          p.mini_soru = e.target.value;
          p.miniChallenge = p.mini_cevap ? `${p.mini_soru} (Cevap: ${p.mini_cevap})` : p.mini_soru;
        });
        $('peMiniCevap')?.addEventListener('input', e => {
          p.mini_cevap = e.target.value;
          p.miniChallenge = p.mini_cevap ? `${p.mini_soru} (Cevap: ${p.mini_cevap})` : p.mini_soru;
        });
        $('peSvg')?.addEventListener('input', e => { p.svg_kodu = p.visualSvg = p.svgDiagram = e.target.value; });
      } else {
        const svgMount = $('csPageSvgMount');
        if (svgMount) {
          svgMount.innerHTML = safeSvgHtml || '<span style="color:#64748B;font-size:0.9rem;">Bu sayfa için SVG görseli düzenlemeden eklenebilir.</span>';
        }
        $('csToggleAnsBtn')?.addEventListener('click', function () {
          const box = $('csMiniAnswerBox');
          if (!box) return;
          box.hidden = !box.hidden;
          this.textContent = box.hidden ? '👁️ Cevabı Gör' : '🙈 Cevabı Gizle';
        });
      }

    } else if (activeStudioTab === 'notes') {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${currentTopic.practicalNotes.map((note, idx) => `
            <div style="display:flex;gap:10px;align-items:flex-start;background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid #D97706;border-radius:12px;padding:10px 12px;">
              <span style="background:#0F172A;color:#FCD34D;font-weight:800;font-size:12px;padding:3px 8px;border-radius:7px;">${String(idx + 1).padStart(2, '0')}</span>
              <textarea data-note-idx="${idx}" rows="2" style="flex:1;padding:7px 10px;border:1px solid #CBD5E1;border-radius:8px;font-size:13.5px;font-family:inherit;">${esc(note)}</textarea>
              <button type="button" data-del-note="${idx}" style="background:#FEF2F2;color:#991B1B;border:1px solid #FECACA;border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:700;">Sil</button>
            </div>
          `).join('')}
          <button type="button" id="addPracticalNoteBtn" style="align-self:flex-start;padding:8px 14px;border-radius:10px;border:1.5px dashed #D97706;background:#FAF8F5;color:#B45309;font-weight:700;font-size:13px;cursor:pointer;">+ Yeni Hap Bilgi Ekle</button>
        </div>
      `;
      body.querySelectorAll('[data-note-idx]').forEach(ta => ta.addEventListener('input', e => { currentTopic.practicalNotes[Number(ta.dataset.noteIdx)] = e.target.value; }));
      body.querySelectorAll('[data-del-note]').forEach(btn => btn.addEventListener('click', () => { currentTopic.practicalNotes.splice(Number(btn.dataset.delNote), 1); renderStudio(); }));
      $('addPracticalNoteBtn')?.addEventListener('click', () => { currentTopic.practicalNotes.push(''); renderStudio(); });

    } else if (activeStudioTab === 'cards') {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${currentTopic.flashcards.map((card, idx) => `
            <div style="background:#FAF8F5;border:1px solid #E2E8F0;border-radius:12px;padding:12px 14px;display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:start;">
              <div>
                <label style="font-size:11.5px;font-weight:700;color:#475569;">Ön Yüz (Soru / Kavram)</label>
                <input type="text" data-card-front="${idx}" value="${esc(card.front)}" style="width:100%;margin-top:4px;padding:7px 10px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;">
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;color:#475569;">Arka Yüz (Cevap / Formül)</label>
                <input type="text" data-card-back="${idx}" value="${esc(card.back)}" style="width:100%;margin-top:4px;padding:7px 10px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;">
                <input type="text" data-card-tip="${idx}" value="${esc(card.tip || '')}" placeholder="İpucu (isteğe bağlı)" style="width:100%;margin-top:6px;padding:6px 10px;border:1px dashed #CBD5E1;border-radius:8px;font-size:12px;">
              </div>
              <button type="button" data-del-card="${idx}" style="margin-top:20px;background:#FEF2F2;color:#991B1B;border:1px solid #FECACA;border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:700;">Sil</button>
            </div>
          `).join('')}
          <button type="button" id="addFlashcardBtn" style="align-self:flex-start;padding:8px 14px;border-radius:10px;border:1.5px dashed #D97706;background:#FAF8F5;color:#B45309;font-weight:700;font-size:13px;cursor:pointer;">+ Yeni Bilgi Kartı Ekle</button>
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

    if (targetStatus === 'published' && !currentTopic.id) {
      try {
        const dupParams = new URLSearchParams({
          grade: String(currentTopic.grade),
          unit_topic: currentTopic.unit_topic || currentTopic.themeTitle || '',
          sub_topic: currentTopic.sub_topic || currentTopic.subTopicTitle || '',
          outcome_code: currentTopic.outcome_code || ''
        });
        const dup = await apiJson('/api/topics/check-duplicate?' + dupParams.toString());
        if (dup?.exists) {
          const ok = confirm(`Bu kazanım (${dup.existing.sub_topic}) için zaten yayında bir konu var.\nMevcut konunun üzerine yazılsın mı?`);
          if (!ok) return;
        }
      } catch (e) {}
    }

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
      if (res?.data?._id) currentTopic.id = String(res.data._id);
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
    const url = '/api/topics/manage' + (gradeFilter ? `?grade=${encodeURIComponent(gradeFilter)}` : '');
    try {
      const res = await apiJson(url);
      const items = res.items || [];
      if (!items.length) {
        listEl.innerHTML = '<p style="margin:0;color:#475569;font-size:13.5px;padding:16px;text-align:center;background:#FAF8F5;border:1px dashed #CBD5E1;border-radius:10px;">Henüz yayınlanmış konu anlatımı bulunmuyor. Yukarıdaki formdan ilk konunuzu üretip yayınlayabilirsiniz.</p>';
        return;
      }
      listEl.innerHTML = items.map(it => {
        const isPub = it.status === 'published';
        const dateStr = it.updatedAt ? new Date(it.updatedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:13px 15px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:#0F172A;color:#FCD34D;">${it.grade}. Sınıf</span>
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:#FEF3C7;color:#92400E;">${esc(it.themeCode)}</span>
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${isPub ? '#ECFDF5' : '#FEF3C7'};color:${isPub ? '#065F46' : '#92400E'};">
                ${isPub ? '● Yayında' : '○ Taslakta'}
              </span>
              ${dateStr ? `<span style="font-size:11px;color:#64748B;">${dateStr}</span>` : ''}
            </div>
            <div style="font-weight:700;color:#0F172A;font-size:14.5px;margin-top:5px;">${esc(it.title)}</div>
            <div style="font-size:12px;color:#475569;margin-top:2px;"><strong>${esc(it.themeTitle)}</strong> › ${esc(it.subTopicTitle)} · ${it.pageCount} Sayfa · ${it.notesCount} Hap Bilgi · ${it.cardsCount} Kart</div>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;">
            <button type="button" data-preview-topic="${esc(it.id)}" style="padding:7px 11px;border-radius:8px;border:1px solid #0F172A;background:#FFFFFF;color:#0F172A;font-weight:600;font-size:12px;cursor:pointer;">👁️ Önizle</button>
            <button type="button" data-toggle-topic="${esc(it.id)}" data-next-status="${isPub ? 'draft' : 'published'}" style="padding:7px 11px;border-radius:8px;border:1px solid ${isPub ? '#D97706' : '#059669'};background:${isPub ? '#FFFBEB' : '#ECFDF5'};color:${isPub ? '#92400E' : '#065F46'};font-weight:600;font-size:12px;cursor:pointer;">
              ${isPub ? '⏸️ Yayından Kaldır' : '🚀 Yayınla'}
            </button>
            <button type="button" data-del-topic="${esc(it.id)}" style="padding:7px 11px;border-radius:8px;border:1px solid #DC2626;background:#DC2626;color:#FFFFFF;font-weight:600;font-size:12px;cursor:pointer;">🗑️ Sil</button>
          </div>
        </div>`;
      }).join('');

      listEl.querySelectorAll('[data-preview-topic]').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await apiJson('/api/topics/' + encodeURIComponent(btn.dataset.previewTopic));
            if (res?.data) {
              currentTopic = normalizeTopicData(res.data);
              activeStudioTab = 'pages';
              activePageIdx = 0;
              editMode = false;
              renderStudio();
              $('currPreviewWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              setStatus('Konu 2 sütunlu ders kitabı stüdyosunda açıldı.', 'ok');
            }
          } catch (err) {
            setStatus('Konu açılamadı: ' + err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        });
      });

      listEl.querySelectorAll('[data-toggle-topic]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const nextStatus = btn.dataset.nextStatus;
          btn.disabled = true;
          try {
            const res = await apiJson('/api/topics/' + encodeURIComponent(btn.dataset.toggleTopic) + '/status', {
              method: 'PATCH',
              body: JSON.stringify({ status: nextStatus })
            });
            setStatus('✅ ' + (res.mesaj || 'Durum güncellendi.'), 'ok');
            await loadPublishedList();
          } catch (err) {
            alert('Durum değiştirilemedi: ' + err.message);
            btn.disabled = false;
          }
        });
      });

      listEl.querySelectorAll('[data-del-topic]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Bu konu anlatımı veritabanından ve öğrenci panelinden kalıcı olarak silinecek. Emin misiniz?')) return;
          btn.disabled = true;
          try {
            const res = await apiJson('/api/topics/' + encodeURIComponent(btn.dataset.delTopic), { method: 'DELETE' });
            setStatus('🗑️ ' + (res.mesaj || 'Konu silindi.'), 'ok');
            await loadPublishedList();
          } catch (err) {
            alert('Silinemedi: ' + err.message);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p style="color:#991B1B;font-size:13px;">Liste yüklenemedi: ${esc(err.message)}</p>`;
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
        setStatus('5 sayfalık Maarif Modeli anlatımı + gerçek inline SVG çizimleri + kazanım künyesi üretiliyor (15-30 sn)…');
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
          setStatus('✅ 5 sayfalık görsel konu anlatımı ve Maarif Modeli kazanım künyesi üretildi! İnceleyip yayınlayabilirsiniz.', 'ok');
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

    // Konu Üret stüdyosuna "🛡️ Denetime Gönder" butonu ekle
    const pubBtn = $('publishCurriculumBtn');
    if (pubBtn && !$('auditCurriculumBtn')) {
      const audBtn = document.createElement('button');
      audBtn.type = 'button';
      audBtn.id = 'auditCurriculumBtn';
      audBtn.textContent = '🛡️ Denetime Gönder';
      audBtn.style.cssText = 'padding:9px 15px;border-radius:10px;border:1.5px solid #D97706;background:#0F172A;color:#FDE68A;font-weight:800;font-size:13px;cursor:pointer;';
      pubBtn.parentNode.insertBefore(audBtn, pubBtn);
      audBtn.addEventListener('click', async () => {
        if (!currentTopic || !Array.isArray(currentTopic.lessonPages) || !currentTopic.lessonPages.length) {
          setStatus('Önce bir konu anlatımı üretin.', 'error');
          return;
        }
        audBtn.disabled = true;
        audBtn.textContent = '🛡️ Denetleniyor…';
        try {
          const res = await apiJson('/api/audit/submit', {
            method: 'POST',
            body: JSON.stringify({
              contentType: 'lesson',
              grade: currentTopic.grade || 5,
              topic: currentTopic.subTopicTitle || currentTopic.title || 'Konu Anlatımı',
              title: currentTopic.title || `${currentTopic.grade || 5}. Sınıf Konu Anlatımı`,
              items: currentTopic.lessonPages
            })
          });
          const rep = res?.report;
          const ok = rep?.verdict === 'approved';
          const warnSummary = (rep?.items || [])
            .flatMap(it => (it.issues || []).map(x => `${it.label}: ${x.msg}`))
            .slice(0, 4)
            .join(' | ');
          setStatus(
            `${ok ? '✅' : '⚠️'} Konu Denetim Skoru: %${rep?.overallScore || 0} — Admin Denetim Kuyruğuna gönderildi.${warnSummary ? ' Bulgular: ' + warnSummary : ''}`,
            ok ? 'ok' : 'error'
          );
        } catch (err) {
          setStatus('Denetim hatası: ' + err.message, 'error');
        } finally {
          audBtn.disabled = false;
          audBtn.textContent = '🛡️ Denetime Gönder';
        }
      });
    }
    $('publishedTopicsGradeFilter')?.addEventListener('change', loadPublishedList);
    $('refreshPublishedTopicsBtn')?.addEventListener('click', loadPublishedList);

    loadPublishedList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
