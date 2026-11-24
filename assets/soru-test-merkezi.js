/**
 * Soru & Test Merkezi — Modern Dashboard & Onaylı Gerçek Test Motoru (v4)
 * Palet: Krem (#FAF6F0), Koyu Kahve (#3E2F26), Altın (#C59B47)
 * KURAL: Yalnızca öğretmenin "Onayla ve Yayınla" dediği gerçek sorular gösterilir;
 * hiçbir sahte / yedek örnek soru üretilmez veya gösterilmez.
 */
(() => {
  'use strict';

  const SESSION_KEY = 'zc_stm_last_session_v1';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const MODE_LABELS = {
    coktan_secmeli: 'Öğrenme Çıktısı Testleri',
    baglam_temelli: 'Bağlam Temelli Beceri Soruları',
    tanilayici_hizli: 'Tanılayıcı Doğru / Yanlış & Grid',
    acik_uclu: 'Açık Uçlu & Rubrikli Senaryolar',
    performans_gorevi: 'Ünite Performans & Süreç Görevi'
  };

  function fmtMath(txt) {
    const raw = String(txt ?? '');
    if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
      return window.zarifMathText.format(raw);
    }
    return esc(raw);
  }

  function extractTopicTitle(item) {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    if (typeof item === 'object') {
      return String(item.title || item.name || item.ad || item.konu || item.label || '').trim();
    }
    return '';
  }

  let selectedGrade = 7;
  let gradeTopicsCache = new Map();

  function getLastSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.topicTitle ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveLastSession(topicTitle, grade) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        topicTitle,
        grade: Number(grade) || selectedGrade,
        updatedAt: new Date().toISOString()
      }));
    } catch {}
  }

  async function detectRegisteredGrade() {
    const saved = Number(localStorage.getItem('zarif_student_grade'));
    if (saved >= 5 && saved <= 12) return saved;
    try {
      const res = await fetch('/api/student/ai-quota', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        const g = Number(d?.kayitliSinif || d?.grade || d?.sinif);
        if (g >= 5 && g <= 12) {
          try { localStorage.setItem('zarif_student_grade', String(g)); } catch {}
          return g;
        }
      }
    } catch {}
    const gProf = Number(window.ZarifGamification?.getProfile?.().grade);
    if (gProf >= 5 && gProf <= 12) return gProf;
    return 7;
  }

  async function fetchGradeApprovedTopics(grade) {
    if (gradeTopicsCache.has(grade)) return gradeTopicsCache.get(grade);
    const itemsMap = new Map();

    // 1. Öğretmenin "Onayla ve Yayınla" ile yayınladığı (yalnızca status === 'published') ZarifStore testleri
    const publishedStoreItems = (window.ZarifStore && window.ZarifStore.publishedTests)
      ? window.ZarifStore.publishedTests.list({ grade, status: 'published' })
      : [];
    publishedStoreItems.forEach(pub => {
      const title = extractTopicTitle(pub.topicTitle || pub.title);
      if (!title) return;
      const key = title.toLowerCase();
      const prev = itemsMap.get(key);
      itemsMap.set(key, {
        title,
        questionCount: (prev ? prev.questionCount : 0) + (Number(pub.questionCount) || (Array.isArray(pub.questions) ? pub.questions.length : 0)),
        approved: true,
        workType: pub.workType || 'coktan_secmeli',
        workTypeLabel: pub.workTypeLabel || MODE_LABELS[pub.workType] || 'Öğrenme Çıktısı Testi',
        publishedItem: pub
      });
    });

    // 2. Backend Pratik API'sinden onaylı soru sayıları
    try {
      const res = await fetch(`/api/pratik/konular?sinif=${encodeURIComponent(grade)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.konular) ? data.konular : (Array.isArray(data) ? data : []);
        list.forEach(k => {
          const title = extractTopicTitle(k);
          if (!title) return;
          const count = Number(k.soruSayisi ?? k.count ?? k.questionCount ?? 0);
          const key = title.toLowerCase();
          const prev = itemsMap.get(key);
          if (prev) {
            prev.questionCount = Math.max(prev.questionCount, count);
            prev.approved = prev.approved || count > 0;
            prev.hasBackendQuestions = count > 0;
          } else {
            itemsMap.set(key, {
              title,
              questionCount: count,
              approved: count > 0,
              hasBackendQuestions: count > 0,
              workType: 'coktan_secmeli',
              workTypeLabel: count > 0 ? 'Öğrenme Çıktısı Testi' : ''
            });
          }
        });
      }
    } catch {}

    // 3. Müfredat listesiyle tamamla (henüz onaylı soru yoksa kilitli gösterilir)
    const mufredat = (window.MATEMATIK_MUFREDATI && window.MATEMATIK_MUFREDATI[grade]) || [];
    mufredat.forEach(rawTopic => {
      const title = extractTopicTitle(rawTopic);
      if (!title) return;
      const key = title.toLowerCase();
      if (!itemsMap.has(key)) {
        itemsMap.set(key, {
          title,
          questionCount: 0,
          approved: false,
          workTypeLabel: ''
        });
      }
    });

    const list = Array.from(itemsMap.values());
    list.sort((a, b) => (b.questionCount - a.questionCount));
    gradeTopicsCache.set(grade, list);
    return list;
  }

  async function fetchBackendApprovedQuestions(grade, topicTitle) {
    try {
      const qs = new URLSearchParams({ sinif: String(grade) });
      if (topicTitle) qs.set('konu', topicTitle);
      const res = await fetch(`/api/pratik/sorular?${qs.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      const rawList = Array.isArray(data.sorular) ? data.sorular : (Array.isArray(data) ? data : []);
      return rawList.filter(q => q && (q.text || q.soru || q.question)).map(q => ({
        text: q.text || q.soru || q.question || '',
        options: q.options || q.secenekler || {},
        answer: q.answer || q.cevap || '',
        explanation: q.explanation || q.cozum || q.solution || '',
        rubric: q.rubric || []
      }));
    } catch {
      return [];
    }
  }

  function renderHero() {
    const heroMount = document.getElementById('stmHeroMount');
    if (!heroMount) return;
    const session = getLastSession();

    if (session) {
      heroMount.innerHTML = `
        <div class="stm-hero">
          <div class="stm-hero-left">
            <div class="stm-hero-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <h3 class="stm-hero-title">Devam Eden Oturum: ${esc(session.topicTitle)}</h3>
              <p class="stm-hero-sub">Yarım kalan ${session.grade}. sınıf çalışmana kaldığın yerden devam edebilirsin.</p>
            </div>
          </div>
          <button type="button" class="stm-hero-btn" id="stmContinueBtn">Devam Et →</button>
        </div>
      `;
      document.getElementById('stmContinueBtn')?.addEventListener('click', () => {
        launchMode('coktan_secmeli', session.topicTitle);
      });
    } else {
      heroMount.innerHTML = `
        <div class="stm-hero">
          <div class="stm-hero-left">
            <div class="stm-hero-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <div>
              <h3 class="stm-hero-title">Bugünün Hedefi: 20 Soru Çöz ve +50 XP Kazan</h3>
              <p class="stm-hero-sub">Öğretmeninin onaylayıp yayınladığı çalışmalarla günlük serini koru.</p>
            </div>
          </div>
          <button type="button" class="stm-hero-btn" id="stmGoalStartBtn">Onaylı Testlere Bak →</button>
        </div>
      `;
      document.getElementById('stmGoalStartBtn')?.addEventListener('click', () => {
        document.getElementById('stmGradePills')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function renderKpiStrip() {
    const kpiMount = document.getElementById('stmKpiMount');
    if (!kpiMount) return;

    const testStats = window.ZarifStore?.tests?.getStats?.() || { totalTests: 0, avgScore: 0 };
    const accuracyText = testStats.totalTests > 0
      ? `%${Number(testStats.avgScore).toLocaleString('tr-TR')}`
      : '—';

    const gProfile = window.ZarifGamification?.getProfile?.() || { streakDays: 1, xp: 0 };
    const streakDays = gProfile.streakDays || 1;
    const xpText = `+${(gProfile.xp || 0).toLocaleString('tr-TR')} XP`;

    kpiMount.innerHTML = `
      <div class="stm-kpi-strip">
        <div class="stm-kpi-box">
          <div class="stm-kpi-icon ok">✓</div>
          <div>
            <strong class="stm-kpi-val">${esc(accuracyText)}</strong>
            <span class="stm-kpi-lbl">Genel Doğru Oranı</span>
          </div>
        </div>
        <div class="stm-kpi-box">
          <div class="stm-kpi-icon fire">🔥</div>
          <div>
            <strong class="stm-kpi-val">${streakDays} Gün</strong>
            <span class="stm-kpi-lbl">Günlük Çalışma Serisi</span>
          </div>
        </div>
        <div class="stm-kpi-box">
          <div class="stm-kpi-icon star">★</div>
          <div>
            <strong class="stm-kpi-val">${esc(xpText)}</strong>
            <span class="stm-kpi-lbl">Bu Ayki Puan Artışı</span>
          </div>
        </div>
      </div>
    `;
  }

  async function renderTopicPerformance() {
    const listEl = document.getElementById('stmTopicList');
    if (!listEl) return;
    listEl.innerHTML = '<p style="margin:12px 0;color:#78695e;font-size:0.88rem;">Onaylı konular yükleniyor…</p>';

    const topics = await fetchGradeApprovedTopics(selectedGrade);
    const summary = window.ZarifStore?.tests?.getTopicSummary?.(selectedGrade);
    const perfMap = new Map();
    if (summary && Array.isArray(summary.topics)) {
      summary.topics.forEach(t => perfMap.set(String(t.topicTitle || '').toLowerCase(), t.avgScore));
    }

    if (!topics.length) {
      listEl.innerHTML = '<p style="margin:12px 0;color:#78695e;font-size:0.88rem;">Bu sınıf için müfredat konusu bulunamadı.</p>';
      return;
    }

    listEl.innerHTML = topics.slice(0, 12).map((topic, idx) => {
      const score = perfMap.has(topic.title.toLowerCase()) ? perfMap.get(topic.title.toLowerCase()) : null;
      const pct = score !== null ? score : 0;
      const barCls = score === null ? 'none' : (pct >= 75 ? 'good' : (pct >= 50 ? 'mid' : 'low'));
      const locked = !topic.approved;
      const typeTag = topic.workTypeLabel
        ? `<span style="margin-left:6px;padding:2px 7px;border-radius:999px;background:#fff4eb;border:1px solid #f0c9a8;color:#c2570c;font-size:0.68rem;font-weight:700;">${esc(topic.workTypeLabel)}</span>`
        : '';
      return `
        <div class="stm-topic-row ${locked ? 'is-locked' : ''}">
          <span class="stm-q-badge">${topic.questionCount} Soru</span>
          <span class="stm-topic-name" title="${esc(topic.title)}">${esc(topic.title)}${typeTag}</span>
          <div class="stm-bar-track"><div class="stm-bar-fill ${barCls}" style="width:${score !== null ? pct : 0}%"></div></div>
          <span class="stm-pct">${score !== null ? `%${pct}` : '—'}</span>
          ${locked
            ? '<span class="stm-lock-pill">🔒 Öğretmen Onayı Bekliyor</span>'
            : `<button type="button" class="stm-solve-btn" data-stm-solve-idx="${idx}">Çöz →</button>`
          }
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-stm-solve-idx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const chosen = topics[Number(btn.dataset.stmSolveIdx)];
        if (!chosen || !chosen.approved) return;

        if (chosen.publishedItem && Array.isArray(chosen.publishedItem.questions) && chosen.publishedItem.questions.length) {
          openPublishedItem(chosen.publishedItem);
          return;
        }

        // Backend onaylı sorularını çek
        const backendQs = await fetchBackendApprovedQuestions(selectedGrade, chosen.title);
        if (backendQs.length) {
          openPublishedItem({
            title: `${selectedGrade}. Sınıf — ${chosen.title}`,
            topicTitle: chosen.title,
            grade: selectedGrade,
            workType: chosen.workType || 'coktan_secmeli',
            workTypeLabel: chosen.workTypeLabel || 'Öğrenme Çıktısı Testi',
            questions: backendQs
          });
        } else {
          openEmptyApprovalModal(chosen.title, chosen.workTypeLabel || 'Onaylı Çalışma');
        }
      });
    });
  }

  // =========================================================================
  // SAYFA İÇİ ONAYLI TEST MOTORU (YALNIZCA ÖĞRETMEN ONAYLI GERÇEK SORULAR)
  // =========================================================================
  function getOrCreateModal() {
    let modal = document.getElementById('stmTrueFalseModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'stmTrueFalseModal';
      modal.className = 'stm-tf-modal';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function openEmptyApprovalModal(areaTitle, modeLabel) {
    const modal = getOrCreateModal();
    modal.innerHTML = `
      <div class="stm-tf-card" style="max-width:500px;">
        <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <strong>🔒 ${esc(selectedGrade)}. Sınıf · ${esc(modeLabel)}</strong>
          <button type="button" id="stmEmptyClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
        </div>
        <div style="padding:30px 24px;text-align:center;">
          <div style="width:62px;height:62px;margin:0 auto 14px;border-radius:16px;background:rgba(197,155,71,0.16);border:1.5px solid #C59B47;display:grid;place-items:center;font-size:1.8rem;">🔒</div>
          <h3 style="margin:0 0 10px;color:#3E2F26;font-size:1.08rem;">Onaylı Çalışma Henüz Yayınlanmadı</h3>
          <p style="margin:0 0 20px;color:#6a5b50;font-size:0.9rem;line-height:1.6;">
            Öğretmeniniz <strong>${esc(selectedGrade)}. Sınıf · ${esc(areaTitle || modeLabel)}</strong> alanı için henüz onaylı bir çalışma yayınlamadı. Yayınlandığında burada aktif olacaktır.
          </p>
          <button type="button" id="stmEmptyOk" class="stm-hero-btn">Tamam</button>
        </div>
      </div>
    `;
    modal.classList.add('open');
    modal.querySelector('#stmEmptyClose')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.querySelector('#stmEmptyOk')?.addEventListener('click', () => modal.classList.remove('open'));
  }

  function openPublishedItem(pub) {
    const questions = Array.isArray(pub?.questions) ? pub.questions : [];
    if (!questions.length) {
      openEmptyApprovalModal(pub?.topicTitle || '', pub?.workTypeLabel || 'Onaylı Çalışma');
      return;
    }
    const isOpenEnded = pub.workType === 'acik_uclu' ||
      pub.workType === 'performans_gorevi' ||
      !questions.some(q => q.options && Object.keys(q.options).length >= 2);
    if (isOpenEnded) {
      openOpenEndedRubricModal(pub);
    } else {
      openQuizRunnerModal(pub);
    }
  }

  async function launchMode(workType, specificTopic = '') {
    const modeLabel = MODE_LABELS[workType] || 'Onaylı Çalışma';

    // 1. Önce öğretmenin "Onayla ve Yayınla" ile ZarifStore.publishedTests'e aktardığı gerçek testleri ara
    const published = (window.ZarifStore && window.ZarifStore.publishedTests)
      ? window.ZarifStore.publishedTests.list({ grade: selectedGrade, status: 'published', workType })
      : [];

    const matched = specificTopic
      ? (published.find(p => String(p.topicTitle || '').toLowerCase() === specificTopic.toLowerCase()) || published[0])
      : published[0];

    if (matched && Array.isArray(matched.questions) && matched.questions.length) {
      openPublishedItem(matched);
      return;
    }

    // 2. Çoktan seçmeli modda backend onaylı soru havuzunu da kontrol et
    if (workType === 'coktan_secmeli') {
      const backendQs = await fetchBackendApprovedQuestions(selectedGrade, specificTopic);
      if (backendQs.length) {
        openPublishedItem({
          title: `${selectedGrade}. Sınıf ${specificTopic || modeLabel}`,
          topicTitle: specificTopic || `${selectedGrade}. Sınıf ${modeLabel}`,
          grade: selectedGrade,
          workType,
          workTypeLabel: modeLabel,
          questions: backendQs
        });
        return;
      }
    }

    // 3. Öğretmenin onayladığı gerçek soru yoksa ASLA sahte soru gösterme; şık bilgi ekranını aç
    openEmptyApprovalModal(specificTopic || modeLabel, modeLabel);
  }

  function openOpenEndedRubricModal(pub) {
    saveLastSession(pub.topicTitle || pub.title, pub.grade || selectedGrade);
    renderHero();
    const modal = getOrCreateModal();
    const questions = pub.questions || [];
    let idx = 0;
    let totalEarned = 0;

    function renderStep() {
      if (idx >= questions.length) {
        const avgPct = Math.round(totalEarned / Math.max(1, questions.length));
        window.ZarifStore?.tests?.recordResult?.({
          topicTitle: pub.topicTitle || pub.title,
          grade: Number(pub.grade) || selectedGrade,
          source: pub.workType || 'acik_uclu',
          total: questions.length,
          correct: avgPct >= 60 ? questions.length : Math.max(0, questions.length - 1),
          score: avgPct
        });
        renderKpiStrip();
        renderTopicPerformance();
        modal.innerHTML = `
          <div class="stm-tf-card" style="max-width:600px;">
            <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;">
              <strong>✍️ ${esc(pub.title)} — Sonuç</strong>
              <button type="button" id="stmOeClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
            </div>
            <div style="padding:26px 22px;text-align:center;">
              <div style="font-size:2.4rem;margin-bottom:8px;">🏆</div>
              <h3 style="margin:0 0 6px;color:#3E2F26;">Öz Değerlendirme Puanın: %${avgPct}</h3>
              <p style="margin:0 0 18px;color:#78695e;font-size:0.88rem;">Çalışma sonucun Konu Performansı ve Öğretmen Başarı Analizine kaydedildi!</p>
              <button type="button" id="stmOeDone" class="stm-hero-btn">Tamamla</button>
            </div>
          </div>
        `;
        modal.querySelector('#stmOeClose')?.addEventListener('click', () => modal.classList.remove('open'));
        modal.querySelector('#stmOeDone')?.addEventListener('click', () => modal.classList.remove('open'));
        return;
      }

      const q = questions[idx];
      const rubric = Array.isArray(q.rubric) && q.rubric.length ? q.rubric : [
        { criterion: 'Problemi doğru anlama ve matematiksel modeli kurma', points: 40 },
        { criterion: 'İşlem adımlarını eksiksiz ve gerekçeli gösterme', points: 40 },
        { criterion: 'Sonucu doğru birim ve net ifadeyle yazma', points: 20 }
      ];

      const qCodeId = q.id || q._id || `${pub.id || 'OE'}_${idx + 1}`;
      const wmHtml = window.ZarifCopyright ? window.ZarifCopyright.watermarkHtml() : '';
      const stampHtml = window.ZarifCopyright ? window.ZarifCopyright.stampHtml(qCodeId) : '';
      modal.innerHTML = `
        <div class="stm-tf-card zc-protected-surface" style="max-width:640px;">
          ${wmHtml}
          <div style="padding:14px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;position:relative;z-index:3;">
            <strong>✍️ ${esc(pub.workTypeLabel || 'Açık Uçlu & Rubrikli Senaryo')} (${idx + 1}/${questions.length})</strong>
            <button type="button" id="stmOeClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
          </div>
          <div style="padding:20px;max-height:78vh;overflow-y:auto;position:relative;z-index:3;">
            <div style="font-size:0.95rem;font-weight:600;color:#3E2F26;line-height:1.65;white-space:pre-wrap;margin-bottom:14px;">${fmtMath(q.text || q.question || '')}</div>
            <label style="display:block;font-size:0.82rem;font-weight:700;color:#3E2F26;margin-bottom:6px;">Çözüm Adımların ve Gerekçen:</label>
            <textarea id="stmOeInput" rows="4" placeholder="Çözüm adımlarını ve matematiksel gerekçeni buraya yaz…" style="width:100%;padding:11px 13px;border-radius:10px;border:1.5px solid #dfd3c5;background:#fff;font-family:inherit;font-size:0.9rem;box-sizing:border-box;"></textarea>
            <div style="margin-top:12px;">
              <button type="button" id="stmOeSubmit" class="stm-hero-btn">Gönder ve Rubrik ile Karşılaştır →</button>
            </div>
            <div id="stmOeReveal" hidden style="margin-top:16px;padding:14px 16px;border-radius:12px;background:#fff;border:1.5px solid #C59B47;">
              <div style="font-weight:800;color:#065f46;margin-bottom:6px;">✅ Örnek Çözüm:</div>
              <div style="font-size:0.88rem;color:#3E2F26;line-height:1.6;white-space:pre-wrap;margin-bottom:12px;">${fmtMath(q.solution || q.explanation || 'Adım adım çözüm rubrik kriterlerine göre değerlendirilir.')}</div>
              <div style="font-weight:800;color:#3E2F26;margin-bottom:6px;font-size:0.85rem;">📋 Dereceli Puanlama Anahtarı (Rubrik — 100 Puan):</div>
              <div style="display:grid;gap:6px;margin-bottom:12px;">
                ${rubric.map(r => `
                  <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:8px;background:#FAF6F0;border:1px solid #ece3d8;font-size:0.82rem;cursor:pointer;">
                    <span><input type="checkbox" class="stm-rubric-chk" data-pts="${Number(r.points) || 0}" checked style="margin-right:6px;accent-color:#059669;">${esc(r.criterion)}</span>
                    <strong style="color:#C59B47;white-space:nowrap;">${Number(r.points) || 0} Puan</strong>
                  </label>
                `).join('')}
              </div>
              <button type="button" id="stmOeNext" class="stm-hero-btn">${idx + 1 < questions.length ? 'Sonraki Senaryo →' : 'Değerlendirmeyi Kaydet ✓'}</button>
            </div>
            ${stampHtml}
          </div>
        </div>
      `;

      modal.querySelector('#stmOeClose')?.addEventListener('click', () => modal.classList.remove('open'));
      modal.querySelector('#stmOeSubmit')?.addEventListener('click', () => {
        const rev = modal.querySelector('#stmOeReveal');
        const sub = modal.querySelector('#stmOeSubmit');
        if (rev) rev.hidden = false;
        if (sub) sub.style.display = 'none';
      });
      modal.querySelector('#stmOeNext')?.addEventListener('click', () => {
        let earned = 0;
        modal.querySelectorAll('.stm-rubric-chk:checked').forEach(chk => {
          earned += Number(chk.dataset.pts) || 0;
        });
        totalEarned += Math.min(100, earned);
        idx += 1;
        renderStep();
      });
    }

    modal.classList.add('open');
    renderStep();
  }

  function openQuizRunnerModal(pub) {
    saveLastSession(pub.topicTitle || pub.title, pub.grade || selectedGrade);
    renderHero();
    const modal = getOrCreateModal();
    const questions = pub.questions || [];
    let idx = 0;
    let correct = 0;

    function renderStep() {
      if (idx >= questions.length) {
        const pct = Math.round((correct / Math.max(1, questions.length)) * 100);
        window.ZarifStore?.tests?.recordResult?.({
          topicTitle: pub.topicTitle || pub.title,
          grade: Number(pub.grade) || selectedGrade,
          source: pub.workType || 'coktan_secmeli',
          total: questions.length,
          correct
        });
        renderKpiStrip();
        renderTopicPerformance();
        modal.innerHTML = `
          <div class="stm-tf-card">
            <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;">
              <strong>✅ ${esc(pub.title)} — Sonuç</strong>
              <button type="button" id="stmPubClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
            </div>
            <div style="padding:26px 22px;text-align:center;">
              <div style="font-size:2.4rem;margin-bottom:8px;">${pct >= 75 ? '🏆' : '🎯'}</div>
              <h3 style="margin:0 0 6px;color:#3E2F26;">${correct} / ${questions.length} Doğru (%${pct})</h3>
              <p style="margin:0 0 18px;color:#78695e;font-size:0.88rem;">Konu Performansın ve Öğretmen Başarı Analizi otomatik güncellendi!</p>
              <button type="button" id="stmPubDone" class="stm-hero-btn">Tamamla</button>
            </div>
          </div>
        `;
        modal.querySelector('#stmPubClose')?.addEventListener('click', () => modal.classList.remove('open'));
        modal.querySelector('#stmPubDone')?.addEventListener('click', () => modal.classList.remove('open'));
        return;
      }

      const q = questions[idx];
      const opts = q.options && typeof q.options === 'object' ? Object.entries(q.options) : [];
      const qCodeId = q.id || q._id || `${pub.id || 'QZ'}_${idx + 1}`;
      const wmHtml = window.ZarifCopyright ? window.ZarifCopyright.watermarkHtml() : '';
      const stampHtml = window.ZarifCopyright ? window.ZarifCopyright.stampHtml(qCodeId) : '';
      modal.innerHTML = `
        <div class="stm-tf-card zc-protected-surface" style="max-width:620px;">
          ${wmHtml}
          <div style="padding:14px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;position:relative;z-index:3;">
            <strong style="font-size:0.95rem;">${esc(pub.workTypeLabel || 'Onaylı Çalışma')} (${idx + 1}/${questions.length})</strong>
            <button type="button" id="stmPubClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
          </div>
          <div style="padding:20px;max-height:78vh;overflow-y:auto;position:relative;z-index:3;">
            <div style="font-size:0.96rem;font-weight:600;color:#3E2F26;line-height:1.6;margin-bottom:14px;">${fmtMath(q.text || q.question || '')}</div>
            <div style="display:grid;gap:8px;">
              ${opts.map(([k, v]) => `
                <button type="button" data-pub-opt="${esc(k)}" style="text-align:left;padding:10px 14px;border-radius:10px;border:1px solid #dfd3c5;background:#fff;color:#3E2F26;font-size:0.9rem;cursor:pointer;">
                  <strong>${esc(k)})</strong> ${fmtMath(v)}
                </button>
              `).join('')}
            </div>
            <div id="stmPubFeedback" style="margin-top:12px;font-size:0.86rem;"></div>
            ${stampHtml}
          </div>
        </div>
      `;
      modal.querySelector('#stmPubClose')?.addEventListener('click', () => modal.classList.remove('open'));
      modal.querySelectorAll('[data-pub-opt]').forEach(btn => {
        btn.addEventListener('click', () => {
          const picked = btn.dataset.pubOpt;
          const ok = String(picked).toUpperCase() === String(q.answer || '').toUpperCase();
          if (ok) correct += 1;
          modal.querySelectorAll('[data-pub-opt]').forEach(b => { b.disabled = true; });
          btn.style.background = ok ? '#ecfdf5' : '#fef2f2';
          btn.style.borderColor = ok ? '#059669' : '#dc2626';
          const fb = modal.querySelector('#stmPubFeedback');
          if (fb) {
            fb.innerHTML = `<strong style="color:${ok ? '#059669' : '#dc2626'};">${ok ? '✓ Doğru!' : `✕ Yanlış (Doğru: ${esc(q.answer)})`}</strong> ${fmtMath(q.explanation || q.solution || '')}`;
          }
          setTimeout(() => { idx += 1; renderStep(); }, 1350);
        });
      });
    }

    modal.classList.add('open');
    renderStep();
  }

  function renderDashboard() {
    const mount = document.getElementById('stmDashboardMount');
    if (!mount) return;

    mount.innerHTML = `
      <div class="stm-wrap">
        <!-- 1. Üst Hero Banner -->
        <div id="stmHeroMount"></div>

        <!-- 2. "Ne Çözmek İstersin?" 2x2 Hızlı Erişim Grid'i (Yalnızca Onaylı Öğretmen Soruları) -->
        <div>
          <h3 class="stm-section-label">Ne Çözmek İstersin?</h3>
          <div class="stm-modes-grid">
            <button type="button" class="stm-mode-card" data-stm-mode="coktan_secmeli">
              <div class="stm-mode-left">
                <div class="stm-mode-icon blue">📝</div>
                <div>
                  <h3>Öğrenme Çıktısı Testleri</h3>
                  <p>Öğretmeninin onayladığı 4/5 şıklı çoktan seçmeli kazanım testleri</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>

            <button type="button" class="stm-mode-card" data-stm-mode="tanilayici_hizli">
              <div class="stm-mode-left">
                <div class="stm-mode-icon green">⚡</div>
                <div>
                  <h3>Tanılayıcı Doğru / Yanlış &amp; Grid</h3>
                  <p>Öğretmeninin yayınladığı kavram yanılgısı tespit araçları</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>

            <button type="button" class="stm-mode-card" data-stm-mode="baglam_temelli">
              <div class="stm-mode-left">
                <div class="stm-mode-icon amber">🧩</div>
                <div>
                  <h3>Bağlam Temelli Beceri Soruları</h3>
                  <p>Günlük yaşam bağlamında Matematiksel Muhakeme &amp; Problem Çözme</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>

            <button type="button" class="stm-mode-card" data-stm-mode="acik_uclu">
              <div class="stm-mode-left">
                <div class="stm-mode-icon purple">🎯</div>
                <div>
                  <h3>Açık Uçlu &amp; Rubrikli Senaryolar</h3>
                  <p>Öğretmen onaylı açık uçlu çözüm adımları ve 100 puanlık rubrik</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>
          </div>
        </div>

        <!-- 3. 3'lü Kompakt İstatistik Şeridi -->
        <div id="stmKpiMount"></div>

        <!-- 4. Sınıf Seçici & Konu Performansı Paneli -->
        <div>
          <div class="stm-grade-pills" id="stmGradePills">
            ${[5, 6, 7, 8, 9, 10, 11, 12].map(g => `
              <button type="button" class="stm-grade-pill ${g === selectedGrade ? 'active' : ''}" data-stm-grade="${g}">${g}. Sınıf</button>
            `).join('')}
          </div>

          <div class="stm-perf-card">
            <div class="stm-perf-head">
              <h3>Konu Performansı &amp; Onaylı Testler</h3>
              <div class="stm-legend">
                <span>🟢 İyi (%75+)</span>
                <span>🟡 Orta (%50-74)</span>
                <span>🔴 Zayıf (%50 altı)</span>
              </div>
            </div>
            <div class="stm-topic-list" id="stmTopicList"></div>
          </div>
        </div>
      </div>
    `;

    mount.querySelectorAll('[data-stm-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        launchMode(btn.dataset.stmMode);
      });
    });

    mount.querySelectorAll('[data-stm-grade]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedGrade = Number(btn.dataset.stmGrade) || 7;
        try { localStorage.setItem('zarif_student_grade', String(selectedGrade)); } catch {}
        mount.querySelectorAll('[data-stm-grade]').forEach(b => b.classList.toggle('active', b === btn));
        renderTopicPerformance();
      });
    });

    renderHero();
    renderKpiStrip();
    renderTopicPerformance();
  }

  async function init() {
    if (!document.getElementById('stmDashboardMount')) return;
    selectedGrade = await detectRegisteredGrade();
    renderDashboard();

    window.ZarifStore?.events?.subscribe?.('tests', () => {
      renderKpiStrip();
      renderTopicPerformance();
    });
    window.ZarifStore?.events?.subscribe?.('publishedTests', () => {
      gradeTopicsCache.clear();
      renderTopicPerformance();
    });
    window.addEventListener('zarif:gamification-change', renderKpiStrip);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
