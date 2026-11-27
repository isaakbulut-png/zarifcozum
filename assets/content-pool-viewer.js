/* ==========================================================================
   ZarifÇözüm — Merkezi İçerik Havuzu PDF & PNG/JPEG Görüntüleyici (v1)
   - Doğrudan indirme yerine sitedeki orijinal KaTeX + SVG + Görsel kalitesiyle
     PDF (tarayıcı PDF görüntüleyici) ve PNG / JPEG görsel önizleme sunar.
   - Kullanıcı önizleme üzerinden istediğinde Farklı Kaydet / İndir yapabilir.
   ========================================================================== */
(function () {
  'use strict';

  const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

  const loadedScripts = {};
  let activeBlobUrls = [];

  function revokeActiveBlobs() {
    activeBlobUrls.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch (_) {}
    });
    activeBlobUrls = [];
  }

  function loadScriptOnce(url, checkFn) {
    if (checkFn()) return Promise.resolve();
    if (loadedScripts[url]) return loadedScripts[url];
    loadedScripts[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => (checkFn() ? resolve() : reject(new Error('Kütüphane yüklenemedi: ' + url)));
      s.onerror = () => reject(new Error('CDN erişim hatası: ' + url));
      document.head.appendChild(s);
    });
    return loadedScripts[url];
  }

  function ensureRenderLibs(needPdf) {
    const tasks = [loadScriptOnce(HTML2CANVAS_URL, () => typeof window.html2canvas === 'function')];
    if (needPdf) {
      tasks.push(loadScriptOnce(JSPDF_URL, () => Boolean(window.jspdf && window.jspdf.jsPDF)));
    }
    return Promise.all(tasks);
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeSlug(str) {
    return String(str || 'zarifcozum-icerik')
      .toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'zarifcozum-icerik';
  }

  // KaTeX + güvenli metin biçimlendirme ($$...$$, $...$, \[...\], \(...\))
  function renderMathHtml(raw) {
    if (raw === null || raw === undefined) return '';
    const text = String(raw);
    const hasKatex = typeof window.katex !== 'undefined' && typeof window.katex.renderToString === 'function';

    const tokens = [];
    const placeholder = (html) => {
      const idx = tokens.length;
      tokens.push(html);
      return `@@ZCMATH_${idx}@@`;
    };

    const renderTex = (tex, displayMode) => {
      if (!hasKatex) return `<code>${escHtml(tex)}</code>`;
      try {
        return window.katex.renderToString(tex.trim(), {
          displayMode: Boolean(displayMode),
          throwOnError: false,
          strict: false
        });
      } catch (_) {
        return escHtml(tex);
      }
    };

    let processed = text
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => placeholder(renderTex(tex, true)))
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => placeholder(renderTex(tex, true)))
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => placeholder(renderTex(tex, false)))
      .replace(/\$([^$\n]+?)\$/g, (_, tex) => placeholder(renderTex(tex, false)));

    processed = escHtml(processed)
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\r?\n/g, '<br>');

    processed = processed.replace(/@@ZCMATH_(\d+)@@/g, (_, i) => tokens[Number(i)] || '');
    return processed;
  }

  function normalizeOptions(options) {
    if (!options) return [];
    if (Array.isArray(options)) {
      return options.map((opt, idx) => {
        if (typeof opt === 'string') {
          return { label: String.fromCharCode(65 + idx), text: opt };
        }
        return {
          label: opt.label || opt.key || String.fromCharCode(65 + idx),
          text: opt.text || opt.value || ''
        };
      }).filter((o) => o.text !== '');
    }
    if (typeof options === 'object') {
      return ['A', 'B', 'C', 'D', 'E']
        .filter((k) => options[k] !== undefined && options[k] !== null && String(options[k]).trim() !== '')
        .map((k) => ({ label: k, text: String(options[k]) }));
    }
    return [];
  }

  function buildVisualHtml(q) {
    if (!q || typeof q !== 'object') return '';
    const parts = [];

    // 1. VisualMathEngine parametrik çizimi varsa
    if (q.visualSpec && window.VisualMathEngine && typeof window.VisualMathEngine.render === 'function') {
      try {
        const renderedSvg = window.VisualMathEngine.render(q.visualSpec);
        if (renderedSvg) {
          parts.push(`<div class="zc-pv-visual">${renderedSvg}</div>`);
        }
      } catch (_) {}
    }

    // 2. Ham inline SVG varsa
    const rawSvg = q.svg || q.svg_kodu || '';
    if (!parts.length && typeof rawSvg === 'string' && rawSvg.includes('<svg')) {
      parts.push(`<div class="zc-pv-visual">${rawSvg}</div>`);
    }

    // 3. R2 / Imagen 3 görsel URL'i varsa
    const imgUrl = q.imageUrl || q.image || q.visualUrl || '';
    if (typeof imgUrl === 'string' && imgUrl.trim()) {
      parts.push(
        `<div class="zc-pv-visual"><img src="${escHtml(imgUrl.trim())}" crossorigin="anonymous" alt="Soru Görseli" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:10px;display:block;margin:0 auto;"></div>`
      );
    }

    return parts.join('');
  }

  function renderSingleQuestionCard(q, indexLabel, showAnswerInline) {
    const opts = normalizeOptions(q.options);
    const visualHtml = buildVisualHtml(q);
    const stem = q.text || q.question || q.soru || '';
    const answer = q.answer || q.correctAnswer || q.dogruCevap || '';
    const explanation = q.explanation || q.solution || q.cozum || '';
    const kazanim = q.kazanim || q.kazanim_kodu || '';

    const optsHtml = opts.length
      ? `<div class="zc-pv-options">${opts.map((o) => `
          <div class="zc-pv-option">
            <span class="zc-pv-opt-badge">${escHtml(o.label)}</span>
            <div class="zc-pv-opt-text">${renderMathHtml(o.text)}</div>
          </div>`).join('')}</div>`
      : '';

    const ansHtml = showAnswerInline && (answer || explanation)
      ? `<div class="zc-pv-answer-box">
          ${answer ? `<div><strong>✅ Doğru Cevap:</strong> ${renderMathHtml(answer)}</div>` : ''}
          ${explanation ? `<div style="margin-top:4px;"><strong>💡 Çözüm:</strong> ${renderMathHtml(explanation)}</div>` : ''}
        </div>`
      : '';

    return `
      <article class="zc-pv-qcard">
        <div class="zc-pv-qhead">
          <span class="zc-pv-qnum">${escHtml(indexLabel)}</span>
          ${kazanim ? `<span class="zc-pv-qtag">${escHtml(kazanim)}</span>` : ''}
        </div>
        ${visualHtml}
        <div class="zc-pv-qtext">${renderMathHtml(stem)}</div>
        ${optsHtml}
        ${ansHtml}
      </article>
    `;
  }

  function buildPrintableSheetElement(items) {
    const first = items[0] || {};
    const isBulk = items.length > 1;
    const sheetTitle = isBulk
      ? `Merkezi İçerik Havuzu (${items.length} İçerik)`
      : (first.title || 'Soru Önizleme');
    const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    const bodyBlocks = [];
    const answerKeyList = [];
    let globalQCounter = 0;

    items.forEach((item, idx) => {
      const gradeLabel = item.grade ? `${item.grade}. Sınıf` : 'Genel';
      const topicLabel = item.topic || 'Matematik';
      const diffLabel = item.difficulty ? String(item.difficulty).toUpperCase() : '';
      const metaChips = [gradeLabel, topicLabel, diffLabel].filter(Boolean)
        .map((c) => `<span class="zc-pv-chip">${escHtml(c)}</span>`).join('');

      if (isBulk) {
        bodyBlocks.push(`
          <div class="zc-pv-section-hdr">
            <span>${idx + 1}. ${escHtml(item.title || 'İçerik')}</span>
            <div class="zc-pv-chips">${metaChips}</div>
          </div>
        `);
      }

      const content = item.content;

      if (content && Array.isArray(content.questions) && content.questions.length > 0) {
        content.questions.forEach((q, qIdx) => {
          globalQCounter += 1;
          const qLabel = isBulk ? `Soru ${globalQCounter}` : `Soru ${qIdx + 1}`;
          bodyBlocks.push(renderSingleQuestionCard(q, qLabel, false));
          const ans = q.answer || q.correctAnswer || '';
          if (ans) answerKeyList.push({ label: qLabel, answer: ans, explanation: q.explanation || '' });
        });
      } else if (content && typeof content === 'object' && (content.text || content.question || content.soru)) {
        globalQCounter += 1;
        const qLabel = isBulk ? `Soru ${globalQCounter}` : 'Soru';
        bodyBlocks.push(renderSingleQuestionCard(content, qLabel, !isBulk));
        if (isBulk && content.answer) {
          answerKeyList.push({ label: qLabel, answer: content.answer, explanation: content.explanation || '' });
        }
      } else if (typeof content === 'string') {
        bodyBlocks.push(`<div class="zc-pv-textblock">${renderMathHtml(content)}</div>`);
      } else if (content && typeof content === 'object') {
        const desc = content.description || content.summary || content.body || '';
        if (desc) {
          bodyBlocks.push(`<div class="zc-pv-textblock">${renderMathHtml(desc)}</div>`);
        } else {
          const kv = Object.entries(content)
            .filter(([k, v]) => v !== null && v !== undefined && k !== 'svg' && k !== 'soruId')
            .map(([k, v]) => `<div><strong>${escHtml(k)}:</strong> ${renderMathHtml(typeof v === 'object' ? JSON.stringify(v) : v)}</div>`)
            .join('');
          bodyBlocks.push(`<div class="zc-pv-textblock">${kv || 'İçerik detayı bulunamadı.'}</div>`);
        }
      }
    });

    const answerKeyHtml = answerKeyList.length > 0
      ? `
        <section class="zc-pv-anskey">
          <div class="zc-pv-anskey-title">📋 Cevap Anahtarı</div>
          <div class="zc-pv-anskey-grid">
            ${answerKeyList.map((a) => `
              <div class="zc-pv-anskey-item">
                <strong>${escHtml(a.label)}:</strong> ${renderMathHtml(a.answer)}
              </div>
            `).join('')}
          </div>
        </section>
      `
      : '';

    const singleMeta = !isBulk
      ? [
          first.grade ? `${first.grade}. Sınıf` : '',
          first.topic || '',
          first.difficulty ? String(first.difficulty).toUpperCase() : ''
        ].filter(Boolean).map((m) => `<span class="zc-pv-chip">${escHtml(m)}</span>`).join('')
      : `<span class="zc-pv-chip">${items.length} İçerik</span>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'zc-pv-stage';
    wrapper.innerHTML = `
      <style>
        .zc-pv-stage {
          position: fixed;
          left: -99999px;
          top: 0;
          width: 794px;
          background: #ffffff;
          color: #0f172a;
          font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
          padding: 34px 38px 40px;
          box-sizing: border-box;
          line-height: 1.55;
        }
        .zc-pv-stage * { box-sizing: border-box; }
        .zc-pv-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding-bottom: 16px;
          margin-bottom: 22px;
          border-bottom: 2.5px solid #0f172a;
        }
        .zc-pv-brand {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #c2410c;
          margin-bottom: 4px;
        }
        .zc-pv-title {
          font-size: 19px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 8px 0;
          line-height: 1.3;
        }
        .zc-pv-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .zc-pv-chip {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 999px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
        }
        .zc-pv-date {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          white-space: nowrap;
        }
        .zc-pv-section-hdr {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin: 18px 0 10px;
          padding: 8px 12px;
          background: #fff7ed;
          border-left: 4px solid #ea580c;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13.5px;
          color: #7c2d12;
        }
        .zc-pv-qcard {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px 20px;
          margin-bottom: 16px;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
        }
        .zc-pv-qhead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .zc-pv-qnum {
          display: inline-block;
          background: #0f172a;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 999px;
        }
        .zc-pv-qtag {
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          background: #f8fafc;
          padding: 3px 9px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .zc-pv-visual {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 14px;
          text-align: center;
        }
        .zc-pv-visual svg {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        .zc-pv-qtext {
          font-size: 14.5px;
          color: #0f172a;
          margin-bottom: 14px;
          word-break: break-word;
        }
        .zc-pv-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .zc-pv-option {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 9px 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13.5px;
        }
        .zc-pv-opt-badge {
          flex: 0 0 24px;
          height: 24px;
          line-height: 24px;
          text-align: center;
          border-radius: 999px;
          background: #0f172a;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
        }
        .zc-pv-opt-text {
          flex: 1;
          color: #1e293b;
          padding-top: 1px;
        }
        .zc-pv-answer-box {
          margin-top: 14px;
          padding: 11px 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          font-size: 13px;
          color: #14532d;
        }
        .zc-pv-textblock {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 18px;
          margin-bottom: 14px;
          font-size: 14px;
          color: #1e293b;
        }
        .zc-pv-anskey {
          margin-top: 20px;
          padding: 14px 18px;
          background: #f8fafc;
          border: 1.5px dashed #94a3b8;
          border-radius: 12px;
        }
        .zc-pv-anskey-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .zc-pv-anskey-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          font-size: 13px;
        }
        .zc-pv-anskey-item {
          color: #0f172a;
        }
        .zc-pv-footer {
          margin-top: 22px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #64748b;
        }
      </style>
      <header class="zc-pv-header">
        <div>
          <div class="zc-pv-brand">ZarifÇözüm · Türkiye Yüzyılı Maarif Modeli</div>
          <h1 class="zc-pv-title">${escHtml(sheetTitle)}</h1>
          <div class="zc-pv-chips">${singleMeta}</div>
        </div>
        <div class="zc-pv-date">${escHtml(dateStr)}</div>
      </header>
      <main>${bodyBlocks.join('')}${answerKeyHtml}</main>
      <footer class="zc-pv-footer">
        <span>www.zarifcozum.com</span>
        <span>Merkezi İçerik Havuzu Önizlemesi</span>
      </footer>
    `;
    return wrapper;
  }

  async function waitForImagesAndFonts(container) {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((res) => {
        img.onload = res;
        img.onerror = res;
        setTimeout(res, 3500);
      });
    }));
  }

  async function renderItemsToCanvas(items) {
    const sheet = buildPrintableSheetElement(items);
    document.body.appendChild(sheet);
    try {
      await waitForImagesAndFonts(sheet);
      const canvas = await window.html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794
      });
      return canvas;
    } finally {
      sheet.remove();
    }
  }

  function buildPdfBlobFromCanvas(canvas) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();   // 210mm
    const pageH = pdf.internal.pageSize.getHeight();  // 297mm
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const pxPerMm = canvas.width / usableW;
    const sliceHeightPx = Math.floor(usableH * pxPerMm);

    let offsetY = 0;
    let pageIdx = 0;

    while (offsetY < canvas.height) {
      const currentSliceH = Math.min(sliceHeightPx, canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = currentSliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0, offsetY, canvas.width, currentSliceH,
        0, 0, canvas.width, currentSliceH
      );

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
      const renderedH = currentSliceH / pxPerMm;
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin, usableW, renderedH, undefined, 'FAST');

      offsetY += currentSliceH;
      pageIdx += 1;
    }

    return pdf.output('blob');
  }

  function triggerSaveAs(blobUrl, filename) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function ensureModalRoot() {
    let modal = document.getElementById('zcPoolViewerModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'zcPoolViewerModal';
    modal.style.cssText = [
      'position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;',
      'background:rgba(15,23,42,0.88);backdrop-filter:blur(6px);'
    ].join('');
    modal.innerHTML = `
      <div id="zcPvTopbar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 20px;background:#0f172a;color:#f8fafc;border-bottom:1px solid rgba(255,255,255,0.12);">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <span id="zcPvModeBadge" style="padding:4px 10px;border-radius:999px;background:#ea580c;color:#fff;font-size:12px;font-weight:800;">ÖNİZLEME</span>
          <strong id="zcPvTitle" style="font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42vw;"></strong>
        </div>
        <div id="zcPvControls" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"></div>
      </div>
      <div id="zcPvBody" style="flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:18px;"></div>
    `;
    document.body.appendChild(modal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeModal();
      }
    });

    return modal;
  }

  function closeModal() {
    const modal = document.getElementById('zcPoolViewerModal');
    if (modal) {
      modal.style.display = 'none';
      const body = document.getElementById('zcPvBody');
      if (body) body.innerHTML = '';
    }
    revokeActiveBlobs();
  }

  function showLoadingInModal(title, message) {
    const modal = ensureModalRoot();
    modal.style.display = 'flex';
    document.getElementById('zcPvModeBadge').textContent = 'HAZIRLANIYOR';
    document.getElementById('zcPvTitle').textContent = title;
    document.getElementById('zcPvControls').innerHTML = `
      <button type="button" id="zcPvCloseBtn" style="padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.22);background:#1e293b;color:#fff;font-weight:700;cursor:pointer;">✕ Kapat</button>
    `;
    document.getElementById('zcPvCloseBtn').onclick = closeModal;
    document.getElementById('zcPvBody').innerHTML = `
      <div style="text-align:center;color:#f8fafc;padding:36px;">
        <div style="font-size:32px;margin-bottom:10px;">⏳</div>
        <div style="font-size:15px;font-weight:700;">${escHtml(message)}</div>
        <div style="font-size:12.5px;color:#94a3b8;margin-top:6px;">KaTeX formülleri ve SVG çizimleri orijinal kalitede oluşturuluyor...</div>
      </div>
    `;
  }

  function styleToolbarBtn(label, bg, color) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = `padding:7px 13px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:${bg};color:${color};font-size:12.5px;font-weight:700;cursor:pointer;`;
    return btn;
  }

  async function previewPdf(items) {
    if (!items || !items.length) {
      alert('Görüntülenecek içerik bulunamadı.');
      return;
    }

    // Tekil R2 PDF dokümanıysa doğrudan sunucudan inline PDF olarak aç
    if (items.length === 1 && items[0].r2Key && items[0].type === 'pdf_document') {
      const url = `/api/content-library/export?format=pdf&ids=${encodeURIComponent(items[0]._id || items[0].id)}`;
      const modal = ensureModalRoot();
      revokeActiveBlobs();
      modal.style.display = 'flex';
      document.getElementById('zcPvModeBadge').textContent = 'PDF GÖRÜNTÜLEYİCİ';
      document.getElementById('zcPvTitle').textContent = items[0].title || 'PDF Dokümanı';
      const controls = document.getElementById('zcPvControls');
      controls.replaceChildren();

      const btnNewTab = styleToolbarBtn('↗ Yeni Sekmede Aç', '#2563eb', '#fff');
      btnNewTab.onclick = () => window.open(url, '_blank');
      const btnSave = styleToolbarBtn('💾 Farklı Kaydet', '#059669', '#fff');
      btnSave.onclick = () => window.open(url + '&download=1', '_blank');
      const btnClose = styleToolbarBtn('✕ Kapat', '#1e293b', '#fff');
      btnClose.onclick = closeModal;
      controls.append(btnNewTab, btnSave, btnClose);

      const body = document.getElementById('zcPvBody');
      body.style.padding = '0';
      body.innerHTML = `<iframe src="${escHtml(url)}" style="width:100%;height:100%;border:none;background:#525659;" title="PDF Önizleme"></iframe>`;
      return;
    }

    const baseTitle = items.length === 1 ? (items[0].title || 'Soru') : `Merkezi İçerik Havuzu (${items.length} İçerik)`;
    showLoadingInModal(baseTitle, 'PDF Görüntüleyici hazırlanıyor...');

    try {
      await ensureRenderLibs(true);
      const canvas = await renderItemsToCanvas(items);
      const pdfBlob = buildPdfBlobFromCanvas(canvas);
      revokeActiveBlobs();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      activeBlobUrls.push(pdfUrl);

      document.getElementById('zcPvModeBadge').textContent = 'PDF ÖNİZLEME';
      document.getElementById('zcPvTitle').textContent = baseTitle;

      const controls = document.getElementById('zcPvControls');
      controls.replaceChildren();

      const btnSwitchImg = styleToolbarBtn('🖼️ PNG / JPEG Gör', '#334155', '#fff');
      btnSwitchImg.onclick = () => previewImage(items, 'png');

      const btnNewTab = styleToolbarBtn('↗ Yeni Sekmede PDF Aç', '#2563eb', '#fff');
      btnNewTab.onclick = () => window.open(pdfUrl, '_blank');

      const btnSave = styleToolbarBtn('💾 PDF Farklı Kaydet', '#059669', '#fff');
      btnSave.onclick = () => triggerSaveAs(pdfUrl, `${safeSlug(baseTitle)}.pdf`);

      const btnClose = styleToolbarBtn('✕ Kapat', '#1e293b', '#fff');
      btnClose.onclick = closeModal;

      controls.append(btnSwitchImg, btnNewTab, btnSave, btnClose);

      const body = document.getElementById('zcPvBody');
      body.style.padding = '0';
      body.innerHTML = `<iframe src="${pdfUrl}" style="width:100%;height:100%;border:none;background:#525659;" title="PDF Önizleme"></iframe>`;
    } catch (err) {
      console.error('[ZarifPoolViewer] PDF önizleme hatası:', err);
      document.getElementById('zcPvBody').innerHTML = `
        <div style="background:#fff;color:#b91c1c;padding:24px;border-radius:12px;max-width:480px;text-align:center;">
          <strong>PDF oluşturulamadı</strong>
          <p style="margin:8px 0 0;font-size:13px;color:#475569;">${escHtml(err.message)}</p>
        </div>
      `;
    }
  }

  async function previewImage(items, initialFormat) {
    if (!items || !items.length) {
      alert('Görüntülenecek içerik bulunamadı.');
      return;
    }

    const baseTitle = items.length === 1 ? (items[0].title || 'Soru') : `Merkezi İçerik Havuzu (${items.length} İçerik)`;
    showLoadingInModal(baseTitle, 'Yüksek çözünürlüklü görsel hazırlanıyor...');

    try {
      await ensureRenderLibs(false);
      const canvas = await renderItemsToCanvas(items);
      revokeActiveBlobs();

      let currentFormat = initialFormat === 'jpeg' ? 'jpeg' : 'png';
      const blobCache = {};

      const getFormatUrl = async (fmt) => {
        if (blobCache[fmt]) return blobCache[fmt];
        const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.95));
        const url = URL.createObjectURL(blob);
        activeBlobUrls.push(url);
        blobCache[fmt] = url;
        return url;
      };

      const body = document.getElementById('zcPvBody');
      body.style.padding = '20px';
      body.style.alignItems = 'flex-start';

      const imgEl = document.createElement('img');
      imgEl.alt = baseTitle;
      imgEl.style.cssText = 'max-width:100%;width:794px;height:auto;border-radius:12px;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,0.45);display:block;margin:0 auto;';
      body.replaceChildren(imgEl);

      const controls = document.getElementById('zcPvControls');
      const btnPng = styleToolbarBtn('PNG', '#ea580c', '#fff');
      const btnJpeg = styleToolbarBtn('JPEG', '#334155', '#e2e8f0');
      const btnSwitchPdf = styleToolbarBtn('📄 PDF Olarak Gör', '#334155', '#fff');
      const btnNewTab = styleToolbarBtn('↗ Yeni Sekmede Gör', '#2563eb', '#fff');
      const btnSave = styleToolbarBtn('💾 Görseli Kaydet', '#059669', '#fff');
      const btnClose = styleToolbarBtn('✕ Kapat', '#1e293b', '#fff');

      const applyFormat = async (fmt) => {
        currentFormat = fmt;
        const url = await getFormatUrl(fmt);
        imgEl.src = url;
        document.getElementById('zcPvModeBadge').textContent = fmt === 'jpeg' ? 'JPEG GÖRSEL' : 'PNG GÖRSEL';
        btnPng.style.background = fmt === 'png' ? '#ea580c' : '#334155';
        btnJpeg.style.background = fmt === 'jpeg' ? '#ea580c' : '#334155';
        btnNewTab.onclick = () => window.open(url, '_blank');
        btnSave.onclick = () => triggerSaveAs(url, `${safeSlug(baseTitle)}.${fmt === 'jpeg' ? 'jpg' : 'png'}`);
      };

      btnPng.onclick = () => applyFormat('png');
      btnJpeg.onclick = () => applyFormat('jpeg');
      btnSwitchPdf.onclick = () => previewPdf(items);
      btnClose.onclick = closeModal;

      controls.replaceChildren(btnPng, btnJpeg, btnSwitchPdf, btnNewTab, btnSave, btnClose);
      document.getElementById('zcPvTitle').textContent = baseTitle;
      await applyFormat(currentFormat);
    } catch (err) {
      console.error('[ZarifPoolViewer] Görsel önizleme hatası:', err);
      document.getElementById('zcPvBody').innerHTML = `
        <div style="background:#fff;color:#b91c1c;padding:24px;border-radius:12px;max-width:480px;text-align:center;">
          <strong>Görsel oluşturulamadı</strong>
          <p style="margin:8px 0 0;font-size:13px;color:#475569;">${escHtml(err.message)}</p>
        </div>
      `;
    }
  }

  window.ZarifPoolViewer = {
    previewPdf,
    previewImage,
    close: closeModal
  };
})();
