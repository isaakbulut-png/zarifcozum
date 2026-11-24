/**
 * Soru & Test Merkezi — Modern Dashboard & Sayfa İçi Gerçek Test Motoru (v3)
 * Palet: Krem (#FAF6F0), Koyu Kahve (#3E2F26), Altın (#C59B47)
 * ZarifStore.publishedTests + ZarifStore.tests + ZarifGamification + /api/pratik/konular
 */
(() => {
  'use strict';

  const SESSION_KEY = 'zc_stm_last_session_v1';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

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

  // 5–12. Sınıflar için Sınıf Bazlı Dinamik Tanılayıcı Doğru / Yanlış Bankası
  const TF_BANK_BY_GRADE = {
    5: [
      { q: 'Bir milyon sayısında 6 tane sıfır vardır.', a: true, exp: '1.000.000 sayısı 1 ve ardından 6 sıfırdan oluşur.' },
      { q: 'Paydaları eşit iki kesirden payı küçük olan daha büyüktür.', a: false, exp: 'Paydaları eşit kesirlerde payı BÜYÜK olan daha büyüktür.' },
      { q: 'Bir dar açının ölçüsü 90 dereceden küçüktür.', a: true, exp: '0° ile 90° arasındaki açılara dar açı denir.' },
      { q: 'Dikdörtgenin tüm kenar uzunlukları her zaman birbirine eşittir.', a: false, exp: 'Dikdörtgenin yalnızca karşılıklı kenarları eşittir; tüm kenarları eşit olan özel dikdörtgen karedir.' }
    ],
    6: [
      { q: 'En küçük asal sayı 2’dir ve 2 dışındaki tüm asal sayılar tektir.', a: true, exp: '2 yalnızca 1 ve 2’ye bölünen tek çift asal sayıdır.' },
      { q: 'İki negatif tam sayının toplamı her zaman pozitiftir.', a: false, exp: 'İki negatif tam sayının toplamı her zaman negatiftir (ör. -3 + (-5) = -8).' },
      { q: 'Bir sayının 3 ile kalansız bölünebilmesi için rakamları toplamı 3’ün katı olmalıdır.', a: true, exp: '3 ile bölünebilme kuralı rakamlar toplamının 3’ün katı olmasıdır.' },
      { q: 'Oran yazılırken iki çokluğun birimleri mutlaka farklı olmalıdır.', a: false, exp: 'Oran aynı veya farklı birimlerle yazılabilir; birimli ve birimsiz oran vardır.' }
    ],
    7: [
      { q: 'İki negatif tam sayının çarpımı her zaman pozitiftir.', a: true, exp: '(-) · (-) = (+) olduğundan çarpım daima pozitiftir.' },
      { q: 'Doğru orantılı iki çokluktan biri artarken diğeri aynı oranda azalır.', a: false, exp: 'Doğru orantıda biri artarken diğeri de aynı oranda artar; ters orantıda azalır.' },
      { q: 'Bir üçgenin iç açılarının ölçüleri toplamı 180 derecedir.', a: true, exp: 'Öklid düzleminde her üçgenin iç açıları toplamı 180°’dir.' },
      { q: '0 (sıfır) bir rasyonel sayı değildir.', a: false, exp: '0 = 0/1 şeklinde yazılabildiği için rasyonel sayıdır.' }
    ],
    8: [
      { q: 'Sıfırdan farklı her gerçek sayının sıfırıncı kuvveti 1’e eşittir.', a: true, exp: 'a ≠ 0 için a⁰ = 1 kuralı geçerlidir.' },
      { q: '√18 sayısı rasyonel bir sayıdır.', a: false, exp: '√18 = 3√2 olduğundan irrasyonel bir sayıdır.' },
      { q: 'Bir dik üçgende hipotenüsün karesi, dik kenarların kareleri toplamına eşittir.', a: true, exp: 'Pisagor bağıntısı: a² + b² = c².' },
      { q: 'İki pozitif tam sayının EBOB’u her zaman EKOK’undan büyüktür.', a: false, exp: 'EBOB ≤ EKOK her zaman geçerlidir.' }
    ],
    9: [
      { q: 'Boş küme her kümenin alt kümesidir.', a: true, exp: '∅ ⊆ A her A kümesi için doğrudur.' },
      { q: 'p ⇒ q önermesi yalnızca p yanlış ve q doğru iken yanlıştır.', a: false, exp: 'p ⇒ q koşullu önermesi yalnızca p ≡ 1 ve q ≡ 0 iken 0 (yanlış) olur.' },
      { q: 'Mutlak değer |x| hiçbir gerçek sayı için negatif değer alamaz.', a: true, exp: 'Her x ∈ ℝ için |x| ≥ 0’dır.' },
      { q: 'Üçgen eşitsizliğine göre bir kenar diğer iki kenarın toplamından büyük olmalıdır.', a: false, exp: 'Bir kenar diğer iki kenarın toplamından KÜÇÜK, farkının mutlak değerinden BÜYÜK olmalıdır.' }
    ],
    10: [
      { q: 'Her fonksiyon aynı zamanda bir bağıntıdır.', a: true, exp: 'Fonksiyon, tanım kümesindeki her elemanı değer kümesinde tek bir elemana eşleyen özel bir bağıntıdır.' },
      { q: 'P(x) = x² + 3/x ifadesi bir polinomdur.', a: false, exp: 'Polinomlarda değişkenin üssü doğal sayı olmalıdır; 3/x = 3x⁻¹ üssü negatif olduğu için polinom değildir.' },
      { q: 'n elemanlı bir kümenin r’li permütasyonu sıralamanın önemli olduğu diziliş sayısıdır.', a: true, exp: 'Permütasyon sıralı dizilişleri, kombinasyon ise sırasız seçimleri sayar.' },
      { q: 'İkinci dereceden bir denklemin diskriminantı Δ < 0 ise iki farklı gerçek kökü vardır.', a: false, exp: 'Δ < 0 olduğunda denklemin gerçek (reel) kökü yoktur.' }
    ],
    11: [
      { q: 'Birim çember üzerinde her α açısı için sin²α + cos²α = 1 özdeşliği sağlanır.', a: true, exp: 'Birim çember denklemi x² + y² = 1 olduğundan cos²α + sin²α = 1’dir.' },
      { q: 'Analitik düzlemde eğimleri çarpımı +1 olan iki doğru birbirine diktir.', a: false, exp: 'Birbirine dik iki doğrunun eğimleri çarpımı m₁ · m₂ = -1’dir.' },
      { q: 'Parabolün tepe noktasının apsisi r = -b / (2a) formülüyle bulunur.', a: true, exp: 'f(x) = ax² + bx + c parabolünde simetri ekseni x = -b/(2a)’dır.' },
      { q: 'Çemberde aynı yayı gören merkez açının ölçüsü çevre açının yarısıdır.', a: false, exp: 'Merkez açı gördüğü yaya eşit, çevre açı ise yayın yarısına eşittir (merkez açı çevre açının 2 katıdır).' }
    ],
    12: [
      { q: 'logₐ(1) = 0 eşitliği tüm geçerli tabanlar (a > 0, a ≠ 1) için doğrudur.', a: true, exp: 'a⁰ = 1 olduğundan logₐ(1) = 0’dır.' },
      { q: 'Bir fonksiyonun bir noktada limiti varsa o noktada kesinlikle süreklidir.', a: false, exp: 'Süreklilik için limitin varlığı yetmez; limit değerinin f(a) fonksiyon değerine eşit olması gerekir.' },
      { q: 'Sabit bir fonksiyonun türevi her noktada sıfıra eşittir.', a: true, exp: 'f(x) = c için f’(x) = 0’dır.' },
      { q: 'Aritmetik dizide ardışık terimler arasındaki oran sabittir.', a: false, exp: 'Aritmetik dizide ardışık terimler arasındaki FARK sabittir; oran sabit olan geometrik dizidir.' }
    ]
  };

  function buildSampleMcqForGrade(grade, workType) {
    const g = Number(grade) || 7;
    const isLise = g >= 9;
    const isBaglam = workType === 'baglam_temelli';
    if (isLise) {
      return [
        {
          text: isBaglam
            ? `(${g}. Sınıf TYMM Bağlam) Bir teknoloji atölyesinde üretilen $x$ adet sensörün toplam maliyeti $M(x) = 40x + 600$ TL fonksiyonu ile modellenmektedir. 15 adet sensör üretildiğinde toplam maliyet kaç TL olur?`
            : `(${g}. Sınıf) $f(x) = 3x - 5$ fonksiyonu için $f(4)$ değeri kaçtır?`,
          options: isBaglam
            ? { A: '900', B: '1050', C: '1200', D: '1350', E: '1500' }
            : { A: '5', B: '6', C: '7', D: '8', E: '9' },
          answer: isBaglam ? 'C' : 'C',
          explanation: isBaglam
            ? '$M(15) = 40 \\cdot 15 + 600 = 600 + 600 = 1200$ TL bulunur.'
            : '$f(4) = 3 \\cdot 4 - 5 = 12 - 5 = 7$ bulunur.'
        },
        {
          text: isBaglam
            ? `(${g}. Sınıf TYMM Bağlam) Bir su deposundaki su miktarı saatte sabit $12$ litre azalmaktadır. Başlangıçta $180$ litre su bulunduğuna göre $5$ saat sonra depoda kaç litre su kalır?`
            : `(${g}. Sınıf) $2x + 6 = 20$ denklemini sağlayan $x$ değeri kaçtır?`,
          options: isBaglam
            ? { A: '100', B: '110', C: '120', D: '130', E: '140' }
            : { A: '5', B: '6', C: '7', D: '8', E: '9' },
          answer: 'C',
          explanation: isBaglam
            ? '$180 - 12 \\cdot 5 = 180 - 60 = 120$ litre kalır.'
            : '$2x = 14 \\Rightarrow x = 7$ bulunur.'
        }
      ];
    }
    return [
      {
        text: isBaglam
          ? `(${g}. Sınıf TYMM Bağlam) Bir okul kütüphanesinde her rafta $18$ kitap bulunmaktadır. Öğrenciler bağış kampanyasıyla $4$ rafı tamamen doldurduktan sonra $12$ kitap daha getirdiğine göre toplam kaç kitap olmuştur?`
          : `(${g}. Sınıf) $\\frac{3}{5} = \\frac{x}{20}$ orantısında $x$ kaçtır?`,
        options: isBaglam
          ? { A: '72', B: '80', C: '84', D: '90' }
          : { A: '10', B: '12', C: '15', D: '18' },
        answer: isBaglam ? 'C' : 'B',
        explanation: isBaglam
          ? '$4 \\cdot 18 + 12 = 72 + 12 = 84$ kitap olur.'
          : 'İçler-dışlar çarpımı: $5x = 60 \\Rightarrow x = 12$.'
      },
      {
        text: isBaglam
          ? `(${g}. Sınıf TYMM Bağlam) Sabit hızla yürüyen bir sporcu $3$ dakikada $240$ metre yol alıyor. Aynı tempoyla $5$ dakikada kaç metre yol alır?`
          : `(${g}. Sınıf) $4$ kalem $12$ TL ise aynı fiyattan $10$ kalem kaç TL eder?`,
        options: isBaglam
          ? { A: '320', B: '360', C: '400', D: '450' }
          : { A: '24', B: '28', C: '30', D: '36' },
        answer: 'C',
        explanation: isBaglam
          ? 'Dakikada $240 / 3 = 80$ m yürür; $5 \\cdot 80 = 400$ m.'
          : '1 kalem $3$ TL olduğundan $10 \\cdot 3 = 30$ TL eder.'
      }
    ];
  }

  function buildSampleOpenEndedForGrade(grade) {
    const g = Number(grade) || 7;
    if (g >= 9) {
      return [
        {
          text: `(${g}. Sınıf Açık Uçlu Senaryo) Bir öğrenci harçlığının her hafta sabit miktarda artmasıyla biriktirdiği parayı $f(n) = 25n + 50$ ($n$: hafta sayısı) şeklinde modelliyor.\n1) 6. haftanın sonunda toplam kaç TL birikir?\n2) 300 TL’ye ulaşmak için en az kaç hafta gerekir? Çözüm adımlarını gerekçelendirerek yazınız.`,
          solution: '1) $f(6) = 25 \\cdot 6 + 50 = 150 + 50 = 200$ TL birikir.\n2) $25n + 50 = 300 \\Rightarrow 25n = 250 \\Rightarrow n = 10$ hafta gerekir.',
          rubric: [
            { criterion: 'Fonksiyon kuralında n = 6 değerini doğru yerine koyma ve hesaplama', points: 40 },
            { criterion: 'Hedef tutar için 25n + 50 = 300 denklemini doğru kurma', points: 30 },
            { criterion: 'Denklemi adım adım çözüp n = 10 sonucunu gerekçelendirme', points: 30 }
          ]
        }
      ];
    }
    return [
      {
        text: `(${g}. Sınıf Açık Uçlu Senaryo) Bir fidan dikildiğinde boyu $24$ cm’dir ve her ay düzenli olarak $6$ cm uzamaktadır.\n1) 5 ay sonunda fidanın boyu kaç cm olur?\n2) Fidanın boyunun $60$ cm olması için kaç ay geçmesi gerekir? Çözüm adımlarını açıklayarak yazınız.`,
        solution: '1) 5 ayda $5 \\cdot 6 = 30$ cm uzar. Toplam boy: $24 + 30 = 54$ cm.\n2) Uzaması gereken miktar: $60 - 24 = 36$ cm. Geçen süre: $36 / 6 = 6$ ay.',
        rubric: [
          { criterion: '5 aylık uzama miktarını (5 × 6 = 30 cm) doğru hesaplama', points: 35 },
          { criterion: 'Başlangıç boyunu ekleyip 54 cm sonucuna ulaşma', points: 25 },
          { criterion: '60 cm hedefi için farkı bulup 6 ay sonucunu gerekçelendirme', points: 40 }
        ]
      }
    ];
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
          const title = extractTopicTitle(k);
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

    // 3. Müfredat listesiyle tamamla (nesne veya string olabilir — [object Object] hatası engellendi)
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
              <p class="stm-hero-sub">Aşağıdan bir Maarif çalışma modu veya onaylı konu seçerek günlük serini koru.</p>
            </div>
          </div>
          <button type="button" class="stm-hero-btn" id="stmGoalStartBtn">Hedefe Başla →</button>
        </div>
      `;
      document.getElementById('stmGoalStartBtn')?.addEventListener('click', () => {
        launchMode('coktan_secmeli');
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
          openQuizRunnerModal(chosen.publishedItem, '');
        } else {
          launchMode('coktan_secmeli', chosen.title);
        }
      });
    });
  }

  // =========================================================================
  // SAYFA İÇİ GERÇEK TEST MOTORU (4 ÇALIŞMA MODU — BAŞKA SEKMEYE YÖNLENDİRMEZ)
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

  function launchMode(workType, specificTopic = '') {
    const published = (window.ZarifStore && window.ZarifStore.publishedTests)
      ? window.ZarifStore.publishedTests.list({ grade: selectedGrade, status: 'published', workType })
      : [];

    if (workType === 'tanilayici_hizli') {
      if (published.length && Array.isArray(published[0].questions) && published[0].questions.length) {
        openQuizRunnerModal(published[0], '');
      } else {
        openTrueFalseModal(selectedGrade);
      }
      return;
    }

    if (workType === 'acik_uclu') {
      if (published.length && Array.isArray(published[0].questions) && published[0].questions.length) {
        openOpenEndedRubricModal(published[0], '');
      } else {
        openOpenEndedRubricModal({
          title: `${selectedGrade}. Sınıf Açık Uçlu & Rubrikli Senaryo`,
          topicTitle: specificTopic || `${selectedGrade}. Sınıf Açık Uçlu Senaryo`,
          grade: selectedGrade,
          workType: 'acik_uclu',
          workTypeLabel: 'Açık Uçlu & Rubrikli Senaryolar',
          questions: buildSampleOpenEndedForGrade(selectedGrade)
        }, `${selectedGrade}. sınıf için öğretmeninizin onayladığı açık uçlu senaryo bekleniyor — örnek Maarif senaryosuyla hemen pratik yapabilirsin.`);
      }
      return;
    }

    // coktan_secmeli veya baglam_temelli
    if (published.length && Array.isArray(published[0].questions) && published[0].questions.length) {
      openQuizRunnerModal(published[0], '');
      return;
    }

    const modeLabel = workType === 'baglam_temelli'
      ? 'Bağlam Temelli Beceri Soruları (TYMM)'
      : 'Öğrenme Çıktısı Testleri';
    openQuizRunnerModal({
      title: `${selectedGrade}. Sınıf ${modeLabel}`,
      topicTitle: specificTopic || `${selectedGrade}. Sınıf ${modeLabel}`,
      grade: selectedGrade,
      workType,
      workTypeLabel: modeLabel,
      questions: buildSampleMcqForGrade(selectedGrade, workType)
    }, `${selectedGrade}. sınıf için öğretmeninizin onayladığı "${modeLabel}" testi bekleniyor — aşağıda ${selectedGrade}. sınıf örnek sorularıyla kendini deneyebilirsin.`);
  }

  function openTrueFalseModal(grade) {
    const g = Number(grade) || selectedGrade;
    const bank = TF_BANK_BY_GRADE[g] || TF_BANK_BY_GRADE[7];
    saveLastSession(`${g}. Sınıf Tanılayıcı Doğru/Yanlış`, g);
    renderHero();

    const modal = getOrCreateModal();
    let idx = 0;
    let correct = 0;

    function renderStep() {
      if (idx >= bank.length) {
        const pct = Math.round((correct / bank.length) * 100);
        window.ZarifStore?.tests?.recordResult?.({
          topicKey: `tanilayici-dy-${g}`,
          topicTitle: `${g}. Sınıf Tanılayıcı D/Y`,
          grade: g,
          source: 'tanilayici_hizli',
          total: bank.length,
          correct
        });
        renderKpiStrip();
        renderTopicPerformance();
        modal.innerHTML = `
          <div class="stm-tf-card">
            <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;">
              <strong>⚡ ${g}. Sınıf Tanılayıcı D/Y Sonucu</strong>
              <button type="button" id="stmTfClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
            </div>
            <div style="padding:26px 22px;text-align:center;">
              <div style="font-size:2.4rem;margin-bottom:8px;">${pct >= 75 ? '🏆' : '🎯'}</div>
              <h3 style="margin:0 0 6px;color:#3E2F26;">${correct} / ${bank.length} Doğru (%${pct})</h3>
              <p style="margin:0 0 18px;color:#78695e;font-size:0.88rem;">Konu Performansın ve Öğretmen Başarı Analizi otomatik güncellendi!</p>
              <button type="button" id="stmTfDone" class="stm-hero-btn">Tamamla</button>
            </div>
          </div>
        `;
        modal.querySelector('#stmTfClose')?.addEventListener('click', () => modal.classList.remove('open'));
        modal.querySelector('#stmTfDone')?.addEventListener('click', () => modal.classList.remove('open'));
        return;
      }

      const item = bank[idx];
      modal.innerHTML = `
        <div class="stm-tf-card">
          <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;">
            <strong>⚡ ${g}. Sınıf Tanılayıcı Doğru / Yanlış (${idx + 1}/${bank.length})</strong>
            <button type="button" id="stmTfClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
          </div>
          <div style="padding:22px;">
            <p style="margin:0 0 18px;font-size:1.02rem;font-weight:700;color:#3E2F26;line-height:1.5;">${fmtMath(item.q)}</p>
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
            fb.innerHTML = `<strong style="color:${ok ? '#059669' : '#dc2626'};">${ok ? 'Doğru!' : 'Yanlış.'}</strong> ${fmtMath(item.exp)}`;
          }
          setTimeout(() => { idx += 1; renderStep(); }, 1250);
        });
      });
    }

    modal.classList.add('open');
    renderStep();
  }

  function openOpenEndedRubricModal(pub, noticeText) {
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
          source: 'acik_uclu',
          total: questions.length,
          correct: avgPct >= 60 ? questions.length : Math.max(0, questions.length - 1),
          score: avgPct
        });
        renderKpiStrip();
        renderTopicPerformance();
        modal.innerHTML = `
          <div class="stm-tf-card" style="max-width:600px;">
            <div style="padding:16px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;">
              <strong>✍️ Açık Uçlu &amp; Rubrikli Değerlendirme Tamamlandı</strong>
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

      modal.innerHTML = `
        <div class="stm-tf-card" style="max-width:640px;">
          <div style="padding:14px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <strong>✍️ ${esc(pub.grade || selectedGrade)}. Sınıf Açık Uçlu &amp; Rubrikli Senaryo (${idx + 1}/${questions.length})</strong>
            <button type="button" id="stmOeClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
          </div>
          <div style="padding:20px;max-height:78vh;overflow-y:auto;">
            ${noticeText ? `<div style="margin-bottom:12px;padding:9px 12px;border-radius:10px;background:#fffbeb;border:1px solid #f59e0b;color:#92400e;font-size:0.8rem;font-weight:600;">ℹ️ ${esc(noticeText)}</div>` : ''}
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
                ${rubric.map((r, ri) => `
                  <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:8px;background:#FAF6F0;border:1px solid #ece3d8;font-size:0.82rem;cursor:pointer;">
                    <span><input type="checkbox" class="stm-rubric-chk" data-pts="${Number(r.points) || 0}" checked style="margin-right:6px;accent-color:#059669;">${esc(r.criterion)}</span>
                    <strong style="color:#C59B47;white-space:nowrap;">${Number(r.points) || 0} Puan</strong>
                  </label>
                `).join('')}
              </div>
              <button type="button" id="stmOeNext" class="stm-hero-btn">${idx + 1 < questions.length ? 'Sonraki Senaryo →' : 'Değerlendirmeyi Kaydet ✓'}</button>
            </div>
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

  function openQuizRunnerModal(pub, noticeText) {
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
      modal.innerHTML = `
        <div class="stm-tf-card" style="max-width:620px;">
          <div style="padding:14px 20px;background:#3E2F26;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <strong style="font-size:0.95rem;">${esc(pub.workTypeLabel || 'Onaylı Çalışma')} (${idx + 1}/${questions.length})</strong>
            <button type="button" id="stmPubClose" style="background:rgba(255,255,255,0.16);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">×</button>
          </div>
          <div style="padding:20px;max-height:78vh;overflow-y:auto;">
            ${noticeText ? `<div style="margin-bottom:12px;padding:9px 12px;border-radius:10px;background:#fffbeb;border:1px solid #f59e0b;color:#92400e;font-size:0.8rem;font-weight:600;">ℹ️ ${esc(noticeText)}</div>` : ''}
            <div style="font-size:0.96rem;font-weight:600;color:#3E2F26;line-height:1.6;margin-bottom:14px;">${fmtMath(q.text || q.question || '')}</div>
            <div style="display:grid;gap:8px;">
              ${opts.map(([k, v]) => `
                <button type="button" data-pub-opt="${esc(k)}" style="text-align:left;padding:10px 14px;border-radius:10px;border:1px solid #dfd3c5;background:#fff;color:#3E2F26;font-size:0.9rem;cursor:pointer;">
                  <strong>${esc(k)})</strong> ${fmtMath(v)}
                </button>
              `).join('')}
            </div>
            <div id="stmPubFeedback" style="margin-top:12px;font-size:0.86rem;"></div>
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

        <!-- 2. "Ne Çözmek İstersin?" 2x2 Hızlı Erişim Grid'i (Tümü Sayfa İçi Gerçek Test Motoru) -->
        <div>
          <h3 class="stm-section-label">Ne Çözmek İstersin?</h3>
          <div class="stm-modes-grid">
            <button type="button" class="stm-mode-card" data-stm-mode="coktan_secmeli">
              <div class="stm-mode-left">
                <div class="stm-mode-icon blue">📝</div>
                <div>
                  <h3>Öğrenme Çıktısı Testleri</h3>
                  <p>Seçili sınıfa ait 4/5 şıklı onaylı çoktan seçmeli kazanım testleri</p>
                </div>
              </div>
              <span class="stm-mode-arrow">→</span>
            </button>

            <button type="button" class="stm-mode-card" data-stm-mode="tanilayici_hizli">
              <div class="stm-mode-left">
                <div class="stm-mode-icon green">⚡</div>
                <div>
                  <h3>Tanılayıcı Doğru / Yanlış &amp; Grid</h3>
                  <p>Seçili sınıfa özel kavram yanılgısı tespit eden hızlı biçimlendirici mod</p>
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
                  <p>Çözüm adımlarını yaz, örnek çözüm ve 100 puanlık rubrikle karşılaştır</p>
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
