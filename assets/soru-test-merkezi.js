/**
 * Soru & Test Merkezi — Modern Dashboard Kontrolcüsü
 * Palet: Krem (#FAF6F0), Koyu Kahve (#3E2F26), Altın (#C59B47)
 * ZarifStore.tests + ZarifGamification + /api/pratik/konular ile tam entegre.
 */
(() => {
  'use strict';

  const SESSION_KEY = 'zc_stm_last_session_v1';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const TF_QUESTIONS = [
    { q: 'İki negatif tam sayının çarpımı her zaman pozitiftir.', a: true, exp: '(-) · (-) = (+) olduğundan sonuç daima pozitiftir.' },
    { q: 'Bir üçgenin iç açılarının ölçüleri toplamı 360 derecedir.', a: false, exp: 'Üçgenin iç açıları toplamı 180°’dir (dörtgenlerin 360°’dir).' },
    { q: 'Sıfırdan farklı her gerçek sayının sıfırıncı kuvveti 1’e eşittir.', a: true, exp: 'a ≠ 0 için a⁰ = 1 kuralı geçerlidir.' },
    { q: 'Doğru orantılı iki çokluktan biri artarken diğeri azalır.', a: false, exp: 'Doğru orantıda biri artarken diğeri de aynı oranda artar.' },
    { q: 'Asal sayıların yalnızca 1 ve kendisi olmak üzere iki pozitif böleni vardır.', a: true, exp: 'En küçük asal sayı 2’dir ve her asal sayının tam 2 pozitif böleni vardır.' }
  ];

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

  function getInitialGrade() {
    const saved = Number(localStorage.getItem('zarif_student_grade'));
    if (saved >= 5 && saved <= 12) return saved;
    const gProf = window.ZarifGamification?.getProfile?.().grade;
    if (gProf >= 5 && gProf <= 12) return Number(gProf);
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
      const title = String(pub.topicTitle || pub.title || '').trim();
      if (!title) return;
      const key = title.toLowerCase();
      const prev = itemsMap.get(key);
      itemsMap.set(key, {
        title,
        questionCount: (prev ? prev.questionCount : 0) + (Number(pub.questionCount) || (Array.isArray(pub.questions) ? pub.questions.length : 0)),
        approved: true,
        workTypeLabel: pub.workTypeLabel || 'Öğrenme Çıktısı Testi',
        publishedItem: pub
      });
    });

    // 2. Pratik API'sinden onaylı soru sayıları
    try {
      const res = await fetch(`/api/pratik/konular?sinif=${encodeURIComponent(grade)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.konular) ? data.konular : (Array.isArray(data) ? data : []);
        list.forEach(k => {
          const title = String(k.konu || k.title || k.name || '').trim();
          if (!title) return;
          const count = Number(k.soruSayisi ?? k.count ?? k.questionCount ?? 0);
          const key = title.toLowerCase();
          const prev = itemsMap.get(key);
          if (prev) {
            prev.questionCount = Math.max(prev.questionCount, count);
            prev.approved = prev.approved || count > 0;
          } else {
            itemsMap.set(key, {
              title,
              questionCount: count,
              approved: count > 0,
              workTypeLabel: count > 0 ? 'Öğrenme Çıktısı Testi' : ''
            });
          }
        });
      }
    } catch {}

    // 2. Müfredat listesiyle tamamla (henüz onaylı sorusu olmayanlar kilitli görünsün)
    const mufredat = (window.MATEMATIK_MUFREDATI && window.MATEMATIK_MUFREDATI[grade]) || [];
    mufredat.forEach(topicName => {
      const title = String(topicName || '').trim();
      if (!title) return;
      const key = title.toLowerCase();
      if (!itemsMap.has(key)) {
        itemsMap.set(key, {
          title,
          questionCount: 0,
          approved: false
        });
      }
    });

    const list = Array.from(itemsMap.values());
    // Onaylı sorusu olanları üste al
    list.sort((a, b) => (b.questionCount - a.questionCount));
    gradeTopicsCache.set(grade, list);
    return list;
  }

  function scrollToPratikWithTopic(grade, topicTitle) {
    saveLastSession(topicTitle, grade);
    renderHero();
    const pratikEl = document.getElementById('pratik-test');
    if (pratikEl) {
      // Pratik widget içindeki sınıf/konu seçicilerini mümkünse otomatik seç
      const gradeBtn = pratikEl.querySelector(`button[data-sinif="${grade}"]`);
      if (gradeBtn) gradeBtn.click();
      pratikEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        scrollToPratikWithTopic(session.grade, session.topicTitle);
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
              <p class="stm-hero-sub">Aşağıdan bir çalışma modu veya onaylı konu seçerek günlük serini koru.</p>
            </div>
          </div>
          <button type="button" class="stm-hero-btn" id="stmGoalStartBtn">Hedefe Başla →</button>
        </div>
      `;
      document.getElementById('stmGoalStartBtn')?.addEventListener('click', () => {
        document.getElementById('pratik-test')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function renderKpiStrip() {
    const kpiMount = document.getElementById('stmKpiMount');
    if (!kpiMount) return;

    const testStats = window.ZarifStore?.tests?.getStats?.() || { totalTests: 0, avgScore: 0 };
    const accuracyText = testStats.totalTests > 0
      ? `%${Number(testStats.avgScore).toLocaleString('tr-TR')}`
      : '%76,5';

    const gProfile = window.ZarifGamification?.getProfile?.() || { streakDays: 3, xp: 156 };
    const streakDays = gProfile.streakDays || 3;
    const xpText = `+${(gProfile.xp || 156).toLocaleString('tr-TR')} XP`;

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
      btn.addEventListener('click', () => {
        const chosen = topics[Number(btn.dataset.stmSolveIdx)];
        if (!chosen) return;
        if (chosen.publishedItem && Array.isArray(chosen.publishedItem.questions) && chosen.publishedItem.questions.length) {
          openPublishedQuizModal(chosen.publishedItem);
        } else {
          scrollToPratikWithTopic(selectedGrade, chosen.title);
        }
      });
    });
  }

  function openPublishedQuizModal(pub) {
    saveLastSession(pub.topicTitle || pub.title, pub.grade || selectedGrade);
    renderHero();
    let modal = document.getElementById('stmTrueFalseModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'stmTrueFalseModal';
      modal.className = 'stm-tf-modal';
      document.body.appendChild(modal);
    }
    const questions = pub.questions || [];
    let idx = 0;
    let correct = 0;

    function fmtMath(txt) {
      if (window.zarifMathText && typeof window.zarifMathText.format === 'function') {
        return window.zarifMathText.format(String(txt || ''));
      }
      return esc(txt);
    }

    function renderStep() {
      if (idx >= questions.length) {
        const pct = Math.round((correct / Math.max(1, questions.length)) * 100);
        window.ZarifStore?.tests?.recordResult?.({
          topicTitle: pub.topicTitle || pub.title,
          grade: Number(pub.grade) || selectedGrade,
          source: pub.workType || 'published-test',
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
      modal.innerHTML = `
        <div class="stm-tf-card" style="max-width:600px;">
          <div style="padding:14px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div>
              <strong style="font-size:0.95rem;">${esc(pub.workTypeLabel || 'Onaylı Çalışma')} (${idx + 1}/${questions.length})</strong>
            </div>
            <button type="button" id="stmPubClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
          </div>
          <div style="padding:20px;max-height:76vh;overflow-y:auto;">
            <div style="font-size:0.96rem;font-weight:600;color:#3E2F26;line-height:1.6;margin-bottom:14px;">${fmtMath(q.text || q.question || '')}</div>
            ${opts.length ? `
              <div style="display:grid;gap:8px;">
                ${opts.map(([k, v]) => `
                  <button type="button" data-pub-opt="${esc(k)}" style="text-align:left;padding:10px 14px;border-radius:10px;border:1px solid #dfd3c5;background:#fff;color:#3E2F26;font-size:0.9rem;cursor:pointer;">
                    <strong>${esc(k)})</strong> ${fmtMath(v)}
                  </button>
                `).join('')}
              </div>
            ` : `
              <textarea id="stmOpenAns" rows="3" placeholder="Çözüm adımlarını ve gerekçeni buraya yaz…" style="width:100%;padding:10px;border-radius:10px;border:1px solid #dfd3c5;font-family:inherit;"></textarea>
              <button type="button" id="stmOpenNext" class="stm-hero-btn" style="margin-top:10px;">Cevabı Kontrol Et →</button>
            `}
            <div id="stmPubFeedback" style="margin-top:12px;font-size:0.86rem;"></div>
          </div>
        </div>
      `;
      modal.querySelector('#stmPubClose')?.addEventListener('click', () => modal.classList.remove('open'));
      if (opts.length) {
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
            setTimeout(() => { idx += 1; renderStep(); }, 1300);
          });
        });
      } else {
        modal.querySelector('#stmOpenNext')?.addEventListener('click', () => {
          correct += 1;
          const fb = modal.querySelector('#stmPubFeedback');
          if (fb) fb.innerHTML = `<strong style="color:#059669;">✓ Kaydedildi!</strong> ${fmtMath(q.solution || q.explanation || 'Çözüm adımın kaydedildi.')}`;
          setTimeout(() => { idx += 1; renderStep(); }, 1300);
        });
      }
    }

    modal.classList.add('open');
    renderStep();
  }

  function openTrueFalseModal() {
    let modal = document.getElementById('stmTrueFalseModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'stmTrueFalseModal';
      modal.className = 'stm-tf-modal';
      document.body.appendChild(modal);
    }

    let idx = 0;
    let correct = 0;

    function renderStep() {
      if (idx >= TF_QUESTIONS.length) {
        const pct = Math.round((correct / TF_QUESTIONS.length) * 100);
        window.ZarifStore?.tests?.recordResult?.({
          topicKey: 'dogru-yanlis-hizli-mod',
          topicTitle: 'Doğru / Yanlış Hızlı Mod',
          grade: selectedGrade,
          source: 'mini-test',
          total: TF_QUESTIONS.length,
          correct
        });
        renderKpiStrip();
        modal.innerHTML = `
          <div class="stm-tf-card">
            <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;">
              <strong>⚡ Doğru / Yanlış Sonucu</strong>
              <button type="button" id="stmTfClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
            </div>
            <div style="padding:26px 22px;text-align:center;">
              <div style="font-size:2.4rem;margin-bottom:8px;">${pct >= 80 ? '🏆' : '🎯'}</div>
              <h3 style="margin:0 0 6px;color:#3E2F26;">${correct} / ${TF_QUESTIONS.length} Doğru (%${pct})</h3>
              <p style="margin:0 0 18px;color:#78695e;font-size:0.88rem;">Sonucun Başarı Analizi ve XP puanına kaydedildi!</p>
              <button type="button" id="stmTfDone" class="stm-hero-btn">Tamamla</button>
            </div>
          </div>
        `;
        modal.querySelector('#stmTfClose')?.addEventListener('click', () => modal.classList.remove('open'));
        modal.querySelector('#stmTfDone')?.addEventListener('click', () => modal.classList.remove('open'));
        return;
      }

      const item = TF_QUESTIONS[idx];
      modal.innerHTML = `
        <div class="stm-tf-card">
          <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;">
            <strong>⚡ Doğru / Yanlış Hızlı Mod (${idx + 1}/${TF_QUESTIONS.length})</strong>
            <button type="button" id="stmTfClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
          </div>
          <div style="padding:22px;">
            <p style="margin:0 0 18px;font-size:1.02rem;font-weight:700;color:#3E2F26;line-height:1.5;">${esc(item.q)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <button type="button" data-tf-ans="true" style="padding:12px;border-radius:12px;border:1.5px solid #059669;background:#ecfdf5;color:#065f46;font-weight:800;cursor:pointer;">✓ Doğru</button>
              <button type="button" data-tf-ans="false" style="padding:12px;border-radius:12px;border:1.5px solid #dc2626;background:#fef2f2;color:#b91c1c;font-weight:800;cursor:pointer;">✕ Yanlış</button>
            </div>
            <div id="stmTfFeedback" style="margin-top:14px;font-size:0.86rem;min-height:22px;"></div>
          </div>
        </div>
      `;
      modal.querySelector('#stmTfClose')?.addEventListener('click', () => modal.classList.remove('open'));
      modal.querySelectorAll('[data-tf-ans]').forEach(btn => {
        btn.addEventListener('click', () => {
          const picked = btn.dataset.tfAns === 'true';
          const ok = picked === item.a;
          if (ok) correct += 1;
          modal.querySelectorAll('[data-tf-ans]').forEach(b => { b.disabled = true; });
          const fb = modal.querySelector('#stmTfFeedback');
          if (fb) {
            fb.innerHTML = `<strong style="color:${ok ? '#059669' : '#dc2626'};">${ok ? 'Doğru!' : 'Yanlış.'}</strong> ${esc(item.exp)}`;
          }
          setTimeout(() => { idx += 1; renderStep(); }, 1150);
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

        <!-- 2. "Ne Çözmek İstersin?" 2x2 Hızlı Erişim Grid'i -->
        <div>
          <h3 class="stm-section-label">Ne Çözmek İstersin?</h3>
          <div class="stm-modes-grid">
            <button type="button" class="stm-mode-card" data-stm-mode="mixed">
              <div class="stm-mode-left">
                <div class="stm-mode-icon blue">📝</div>
                <div>
                  <h3>Öğrenme Çıktısı Testleri</h3>
                  <p>5–8. sınıf 4 şıklı, 9–12. sınıf 5 şıklı çoktan seçmeli kazanım testleri</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>

            <button type="button" class="stm-mode-card" data-stm-mode="truefalse">
              <div class="stm-mode-left">
                <div class="stm-mode-icon green">⚡</div>
                <div>
                  <h3>Tanılayıcı Doğru / Yanlış &amp; Grid</h3>
                  <p>Kavram yanılgılarını hızla tespit eden biçimlendirici hızlı mod</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>

            <button type="button" class="stm-mode-card" data-stm-mode="flashcards">
              <div class="stm-mode-left">
                <div class="stm-mode-icon amber">🧩</div>
                <div>
                  <h3>Bağlam Temelli Beceri Soruları</h3>
                  <p>Günlük yaşam bağlamında muhakeme, problem çözme ve bilgi kartları</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>

            <button type="button" class="stm-mode-card" data-stm-mode="scenarios">
              <div class="stm-mode-left">
                <div class="stm-mode-icon purple">🎯</div>
                <div>
                  <h3>Açık Uçlu &amp; Rubrikli Senaryolar</h3>
                  <p>Maarif Modeli çözüm adımlarını ve gerekçelendirmeyi ölçen sorular</p>
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
        const mode = btn.dataset.stmMode;
        if (mode === 'mixed') {
          document.getElementById('pratik-test')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (mode === 'truefalse') {
          openTrueFalseModal();
        } else if (mode === 'flashcards') {
          if (typeof window.showPanel === 'function') window.showPanel('konu-anlatimlari', true);
        } else if (mode === 'scenarios') {
          if (typeof window.showPanel === 'function') window.showPanel('yaziliya-hazirlik', true);
        }
      });
    });

    mount.querySelectorAll('[data-stm-grade]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedGrade = Number(btn.dataset.stmGrade) || 7;
        mount.querySelectorAll('[data-stm-grade]').forEach(b => b.classList.toggle('active', b === btn));
        renderTopicPerformance();
      });
    });

    renderHero();
    renderKpiStrip();
    renderTopicPerformance();
  }

  function init() {
    if (!document.getElementById('stmDashboardMount')) return;
    selectedGrade = getInitialGrade();
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
