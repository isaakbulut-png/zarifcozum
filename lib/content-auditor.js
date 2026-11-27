/* ==========================================================================
   ZarifÇözüm — 2 Katmanlı Bağımsız Matematik & Pedagoji Denetim Motoru
   Katman 1: Deterministik Kural & Pedagoji Denetçisi (Sıfır maliyet, anında)
   Katman 2: Kör Çözen Bağımsız Hakem AI (Cevap anahtarı gizlenerek çözer)
   ========================================================================== */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\$|\\[a-z]+|\{|\}|\s+/g, '')
    .trim();
}

function hasValidSvgPrimitives(svg) {
  if (typeof svg !== 'string') return false;
  const s = svg.trim();
  return s.includes('<svg') && s.includes('</svg>') && /<(?:line|path|rect|circle|polygon|polyline|ellipse)\b/i.test(s);
}

/* ── KATMAN 1: Deterministik Soru Denetimi ── */
function auditQuestionDeterministic(q, grade) {
  const g = Number(grade) || 5;
  const issues = [];
  let score = 100;

  const text = String(q.text || `${q.senaryo || ''} ${q.soruKoku || ''}`).trim();
  const low = text.toLowerCase();
  const opts = q.options && typeof q.options === 'object' ? q.options : {};
  const optKeys = Object.keys(opts);
  const isMc = optKeys.length > 0 && q.questionType !== 'open_ended';

  if (text.length < 18) {
    issues.push({ severity: 'error', code: 'SHORT_TEXT', msg: 'Soru metni çok kısa veya eksik.' });
    score -= 30;
  }

  // 1. 5. Sınıf Pedagoji Bariyeri
  if (g === 5) {
    if (/(?:\$[^$]*\b[xy]\b[^$]*\$|\b[2-9]x\b|\bx\s*[+\-=])/.test(text)) {
      issues.push({ severity: 'error', code: 'GRADE5_ALGEBRA', msg: '5. sınıf pedagojisine aykırı cebirsel bilinmeyen (x/y) tespit edildi.' });
      score -= 30;
    }
    if (/\\sqrt|√|-\d+\s*(?:derece|°|\+)/.test(text)) {
      issues.push({ severity: 'warn', code: 'GRADE5_ADVANCED', msg: '5. sınıf düzeyini aşan köklü ifade veya negatif sayı kullanımı şüphesi.' });
      score -= 18;
    }
  }

  // 2. Seçenek Sayısı, Tekillik ve Cevap Anahtarı
  if (isMc) {
    const expectedCount = g >= 9 ? 5 : 4;
    if (optKeys.length !== expectedCount) {
      issues.push({ severity: 'error', code: 'OPT_COUNT', msg: `${g}. sınıf için ${expectedCount} seçenek gerekirken ${optKeys.length} seçenek var.` });
      score -= 22;
    }
    const ans = String(q.answer || '').trim().toUpperCase();
    if (!ans || !opts[ans]) {
      issues.push({ severity: 'error', code: 'MISSING_ANSWER', msg: 'Doğru cevap harfi seçenekler içinde bulunmuyor.' });
      score -= 35;
    }
    const seenVals = new Set();
    let hasDup = false;
    optKeys.forEach(k => {
      const nv = normText(opts[k]);
      if (nv && seenVals.has(nv)) hasDup = true;
      if (nv) seenVals.add(nv);
    });
    if (hasDup) {
      issues.push({ severity: 'error', code: 'DUP_OPTIONS', msg: 'Birbirinin aynısı (mükerrer) seçenekler tespit edildi.' });
      score -= 30;
    }

    // 3. Bilgi Kutusu Spoiler Kontrolü
    const bilgi = String(q.bilgiKutusu || '').trim();
    const ansVal = opts[ans] ? String(opts[ans]).trim() : '';
    if (bilgi && ansVal.length >= 4 && bilgi.toLowerCase().includes(ansVal.toLowerCase())) {
      issues.push({ severity: 'warn', code: 'SPOILER_BOX', msg: 'Bilgi/Hatırlatma kutusu doğru şıkkın metnini doğrudan ele veriyor.' });
      score -= 15;
    }
  }

  // 4. Anti-Ezber Kontrolü
  if (/şeklin adı nedir|hangi araç kullanılır|aşağıdakilerden hangisine .* denir\?/.test(low)) {
    issues.push({ severity: 'warn', code: 'DRY_RECALL', msg: 'Soru kuru tanım ezberi kalıbında; beceri temelli kurgu önerilir.' });
    score -= 12;
  }

  // 5. Görsel Bütünlüğü Kontrolü
  const gTip = String(q.gorsel_tipi || '').toLowerCase();
  if (gTip === 'tablo' && /(açı|açıölçer|iletki|üçgen|çember|ışın|dikme|parabol|kesir)/.test(low)) {
    issues.push({ severity: 'error', code: 'WRONG_TABLE_VISUAL', msg: 'Geometri/açı/kesir/fonksiyon sorusunda yanlışlıkla tablo seçilmiş.' });
    score -= 25;
  }
  if (q.svg && typeof q.svg === 'string' && q.svg.trim() && !hasValidSvgPrimitives(q.svg)) {
    issues.push({ severity: 'error', code: 'BROKEN_SVG', msg: 'SVG görseli geçerli geometrik çizim elemanı içermiyor.' });
    score -= 20;
  }
  if (/veri\s*1/i.test(String(q.svg || '') + String(q.visualHtml || '')) && /veri\s*2/i.test(String(q.svg || '') + String(q.visualHtml || ''))) {
    issues.push({ severity: 'error', code: 'FAKE_DATA', msg: 'Görselde uydurma "Veri 1 / Veri 2" tablosu tespit edildi.' });
    score -= 35;
  }

  return {
    deterministicScore: Math.max(0, Math.min(100, score)),
    issues
  };
}

/* ── KATMAN 1: Deterministik Konu Anlatımı Denetimi ── */
function auditLessonPageDeterministic(p, grade) {
  const g = Number(grade) || 5;
  const issues = [];
  let score = 100;

  const title = String(p.baslik || p.title || '').trim();
  const story = String(p.kesif_hikayesi || p.storyOrContext || p.content || '').trim();
  const rule = String(p.altin_kural || p.keyRuleBox || '').trim();
  const svg = String(p.svg_kodu || p.visualSvg || p.svgDiagram || '').trim();

  if (!title) { issues.push({ severity: 'warn', code: 'NO_TITLE', msg: 'Sayfa başlığı eksik.' }); score -= 10; }
  if (story.length < 30) { issues.push({ severity: 'error', code: 'SHORT_STORY', msg: 'Keşif hikâyesi / anlatım metni yetersiz.' }); score -= 25; }
  if (!rule) { issues.push({ severity: 'warn', code: 'NO_RULE', msg: 'Altın Kural kutusu boş.' }); score -= 10; }
  if (svg && !hasValidSvgPrimitives(svg)) {
    issues.push({ severity: 'error', code: 'RAW_SVG_TEXT', msg: 'SVG alanı geçerli şekil yerine ham metin içeriyor.' });
    score -= 30;
  }
  if (g === 5 && /(?:\$[^$]*\b[xy]\b[^$]*\$|\b[2-9]x\b)/.test(story + ' ' + rule)) {
    issues.push({ severity: 'error', code: 'GRADE5_ALGEBRA', msg: '5. sınıf anlatımında x/y cebirsel bilinmeyeni kullanılmış.' });
    score -= 25;
  }

  return { deterministicScore: Math.max(0, Math.min(100, score)), issues };
}

/* ── KATMAN 2: Kör Çözen Bağımsız Hakem Yapay Zekâ ── */
async function runBlindRefereeForQuestions(questions, grade, topic) {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey || !Array.isArray(questions) || !questions.length) return null;

  // KRİTİK: Üreticinin 'answer' alanını Hakem AI'dan GİZLİYORUZ (Kör Çözümleme)
  const blindItems = questions.slice(0, 10).map((q, idx) => ({
    index: idx,
    text: q.text || `${q.senaryo || ''} ${q.soruKoku || ''}`.trim(),
    options: q.options || {}
  }));

  const prompt = [
    `Sen bağımsız bir T.C. MEB Matematik Ölçme-Değerlendirme Baş Denetçisi ve Hakem Öğretmenisin.`,
    `Sınıf: ${grade}. Sınıf | Konu: ${topic || 'Matematik'}`,
    `GÖREV: Aşağıdaki soruları SIFIRDAN kendin çöz. Her soru için:`,
    `1) Doğru şık harfini ("A"-"E", açık uçlu ise "") kendin hesapla ve "hakem_cevabi" alanına yaz.`,
    `2) Sorunun matematiksel tutarlılığını, sınıf pedagojisine (yaş düzeyi, MEB TYMM kazanımı, Türkçe açıklığı) uygunluğunu değerlendir.`,
    `3) 0-100 arası "hakem_puani", varsa somut "bulgular" listesi ve kısa "oneri" yaz.`,
    `Sorular JSON:`,
    JSON.stringify(blindItems)
  ].join('\n');

  const schema = {
    type: 'OBJECT',
    properties: {
      results: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            index: { type: 'INTEGER' },
            hakem_cevabi: { type: 'STRING' },
            matematik_dogru: { type: 'BOOLEAN' },
            pedagoji_uygun: { type: 'BOOLEAN' },
            hakem_puani: { type: 'INTEGER' },
            bulgular: { type: 'ARRAY', items: { type: 'STRING' } },
            oneri: { type: 'STRING' }
          },
          required: ['index', 'hakem_cevabi', 'matematik_dogru', 'pedagoji_uygun', 'hakem_puani']
        }
      }
    },
    required: ['results']
  };

  try {
    const url = `${GEMINI_API_BASE}/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      }),
      signal: AbortSignal.timeout(22000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.results) ? parsed.results : null;
  } catch (err) {
    console.warn('[ZarifDenetim] Hakem AI atlandı (Katman 1 ile devam):', err.message);
    return null;
  }
}

/* ── ANA DENETİM FONKSİYONU ── */
async function auditContent({ contentType = 'questions', grade = 5, topic = 'Matematik', items = [] }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return { overallScore: 0, verdict: 'rejected', refereeUsed: false, items: [] };
  }

  if (contentType === 'lesson') {
    const pageReports = list.map((p, idx) => {
      const det = auditLessonPageDeterministic(p, grade);
      const verdict = det.deterministicScore >= 85 && !det.issues.some(i => i.severity === 'error')
        ? 'approved'
        : (det.deterministicScore >= 60 ? 'needs_review' : 'rejected');
      return {
        index: idx,
        label: p.baslik || p.title || `${idx + 1}. Sayfa`,
        score: det.deterministicScore,
        verdict,
        mathMatch: true,
        issues: det.issues,
        suggestion: det.issues.length ? 'Eksik veya uyarı verilen blokları "Bu Sayfayı Düzenle" ile güncelleyin.' : 'Pedagoji ve görsel bütünlük doğrulandı.'
      };
    });
    const avg = Math.round(pageReports.reduce((s, r) => s + r.score, 0) / pageReports.length);
    const hasRej = pageReports.some(r => r.verdict === 'rejected');
    const overallVerdict = hasRej ? 'rejected' : (avg >= 85 ? 'approved' : 'needs_review');
    return { overallScore: avg, verdict: overallVerdict, refereeUsed: false, items: pageReports };
  }

  // Sorular: Katman 1 + Katman 2 (Kör Hakem AI)
  const refereeResults = await runBlindRefereeForQuestions(list, grade, topic);
  const refMap = new Map();
  if (Array.isArray(refereeResults)) {
    refereeResults.forEach(r => refMap.set(Number(r.index), r));
  }

  const itemReports = list.map((q, idx) => {
    const det = auditQuestionDeterministic(q, grade);
    const ref = refMap.get(idx) || null;
    const allIssues = det.issues.slice();
    let finalScore = det.deterministicScore;
    let mathMatch = true;
    let producerAns = String(q.answer || '').trim().toUpperCase();
    let refereeAns = ref ? String(ref.hakem_cevabi || '').trim().toUpperCase() : '';

    if (ref) {
      if (producerAns && refereeAns && producerAns !== refereeAns) {
        mathMatch = false;
        allIssues.unshift({
          severity: 'error',
          code: 'MATH_MISMATCH',
          msg: `🚨 Matematik Çelişkisi: Üretici cevap "${producerAns}", bağımsız Hakem AI "${refereeAns}" buldu!`
        });
        finalScore = Math.min(finalScore, 35);
      } else {
        finalScore = Math.round((det.deterministicScore * 0.45) + (Math.max(0, Math.min(100, Number(ref.hakem_puani) || 80)) * 0.55));
      }
      if (ref.matematik_dogru === false) {
        mathMatch = false;
        allIssues.push({ severity: 'error', code: 'REF_MATH_ERR', msg: 'Hakem AI soruda matematiksel tutarsızlık tespit etti.' });
        finalScore = Math.min(finalScore, 45);
      }
      if (ref.pedagoji_uygun === false) {
        allIssues.push({ severity: 'warn', code: 'REF_PEDAGOGY', msg: `Hakem AI: ${grade}. sınıf pedagoji seviyesine tam uygun değil.` });
        finalScore = Math.min(finalScore, 70);
      }
      if (Array.isArray(ref.bulgular)) {
        ref.bulgular.slice(0, 3).forEach(b => {
          if (b && String(b).trim()) allIssues.push({ severity: 'info', code: 'REF_NOTE', msg: String(b).trim() });
        });
      }
    }

    const hasCritical = !mathMatch || allIssues.some(i => i.severity === 'error');
    const verdict = !hasCritical && finalScore >= 82
      ? 'approved'
      : (finalScore >= 55 && mathMatch ? 'needs_review' : 'rejected');

    return {
      index: idx,
      label: `Soru ${idx + 1}`,
      score: Math.max(0, Math.min(100, finalScore)),
      verdict,
      mathMatch,
      producerAnswer: producerAns,
      refereeAnswer: refereeAns,
      issues: allIssues,
      suggestion: (ref && ref.oneri) || (hasCritical ? 'Bu soruyu düzenleyin veya havuza almadan çıkarın.' : 'Matematiksel ve pedagojik olarak onaylandı.')
    };
  });

  const overallScore = Math.round(itemReports.reduce((s, r) => s + r.score, 0) / itemReports.length);
  const anyRejected = itemReports.some(r => r.verdict === 'rejected');
  const anyReview = itemReports.some(r => r.verdict === 'needs_review');
  const overallVerdict = anyRejected ? 'rejected' : (anyReview ? 'needs_review' : 'approved');

  return {
    overallScore,
    verdict: overallVerdict,
    refereeUsed: Boolean(refereeResults),
    items: itemReports
  };
}

module.exports = { auditContent, auditQuestionDeterministic, auditLessonPageDeterministic };
