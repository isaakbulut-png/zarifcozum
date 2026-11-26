/* ==========================================================================
   ZarifÇözüm — Modern Hero Slider Controller
   4 Slides • Dual-Tone H1 • 01/04 Bar • 6s Progress • Lottie + SVG Fallback
   ========================================================================== */
(function () {
  "use strict";

  var SLIDE_DURATION = 6000;

  var SLIDES = [
    {
      num: "01",
      tabLabel: "Konu",
      eyebrow: "5–12. Sınıf MEB Uyumlu Anlatım",
      titleHtml: "Matematiği <span class='zc-highlight'>adım adım</span> ve görerek öğren.",
      desc: "Konu anlatımı, çözümlü örnek ve pekiştirme soruları tek bir sade öğrenme akışında ilerler.",
      primaryText: "Sınıfını Seç",
      primaryHref: "#sinif-sec",
      secondaryText: "Ücretsiz Başla",
      secondaryHref: "kayit-giris.html?mode=register",
      lottieSrc: "assets/lottie/slide-1.json",
      floatTop: {
        icon: "📐",
        title: "Görsel Anlatım",
        sub: "Adım adım konu akışı"
      },
      floatBottom: {
        icon: "✨",
        title: "MEB 2025–2026",
        sub: "Güncel kazanım sırası"
      },
      renderFallback: function () {
        return (
          '<div class="zc-scene">' +
            '<svg class="zc-scene-svg" viewBox="0 0 380 250" fill="none" aria-hidden="true">' +
              '<line x1="36" y1="210" x2="346" y2="210" stroke="#D9CBBF" stroke-width="2" stroke-linecap="round"/>' +
              '<line x1="56" y1="30" x2="56" y2="224" stroke="#D9CBBF" stroke-width="2" stroke-linecap="round"/>' +
              '<polygon class="zc-draw-path" points="90,192 210,68 296,192" fill="rgba(212,163,89,0.16)" stroke="#2C221E" stroke-width="3" stroke-linejoin="round"/>' +
              '<path class="zc-draw-wave" d="M 56 164 Q 124 84, 192 142 T 334 86" stroke="#A62C1E" stroke-width="3.5" stroke-linecap="round" fill="none"/>' +
              '<circle class="zc-pulse-dot" cx="210" cy="68" r="7" fill="#A62C1E"/>' +
              '<circle class="zc-pulse-dot" cx="334" cy="86" r="7" fill="#1E7550"/>' +
              '<rect x="228" y="42" width="112" height="32" rx="10" fill="#2C221E"/>' +
              '<text x="284" y="63" text-anchor="middle" fill="#FFFDF9" font-size="13" font-weight="700">A = (a · h) / 2</text>' +
            '</svg>' +
          '</div>'
        );
      }
    },
    {
      num: "02",
      tabLabel: "Deneme",
      eyebrow: "Akıllı Ölçme & Net Takibi",
      titleHtml: "Dün 6 doğru, bugün 8. <span class='zc-highlight'>Hedefin 10'da 10!</span>",
      desc: "Kazanım testleri ve Türkiye geneli denemelerle eksiklerini anında gör, her gün netini yükselt.",
      primaryText: "Deneme Merkezini Gör",
      primaryHref: "ogrenci-paneli.html#denemeler",
      secondaryText: "Ücretsiz Başla",
      secondaryHref: "kayit-giris.html?mode=register",
      lottieSrc: "assets/lottie/slide-2.json",
      floatTop: {
        icon: "📈",
        title: "+2 Net Artış",
        sub: "Son 7 gün performansı"
      },
      floatBottom: {
        icon: "🎯",
        title: "Eksik Kazanım",
        sub: "Anında konu önerisi"
      },
      renderFallback: function () {
        return (
          '<div class="zc-scene">' +
            '<div class="zc-scene-metrics">' +
              '<div class="zc-ring-box">' +
                '<svg width="150" height="150" viewBox="0 0 120 120" aria-hidden="true">' +
                  '<circle cx="60" cy="60" r="50" fill="none" stroke="#EAE0D5" stroke-width="11"/>' +
                  '<circle class="zc-ring-progress" cx="60" cy="60" r="50" fill="none" stroke="#1E7550" stroke-width="11" stroke-linecap="round" transform="rotate(-90 60 60)"/>' +
                '</svg>' +
                '<div class="zc-ring-label">' +
                  '<span class="zc-ring-pct">%80</span>' +
                  '<span class="zc-ring-sub">Başarı Oranı</span>' +
                '</div>' +
              '</div>' +
              '<div class="zc-bars-box">' +
                '<div class="zc-bars-title">Doğru Sayısı Gelişimi</div>' +
                '<div class="zc-bars-chart">' +
                  '<div class="zc-bar-col"><div class="zc-bar-fill b1"></div><span class="zc-bar-lbl">6</span></div>' +
                  '<div class="zc-bar-col"><div class="zc-bar-fill b2"></div><span class="zc-bar-lbl">8</span></div>' +
                  '<div class="zc-bar-col"><div class="zc-bar-fill b3"></div><span class="zc-bar-lbl">10</span></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }
    },
    {
      num: "03",
      tabLabel: "AI Asistan",
      eyebrow: "Sokratik Yapay Zeka Mentör",
      titleHtml: "Takıldın mı? Cevabı vermem, <span class='zc-highlight'>yolu gösteririm.</span>",
      desc: "Yapay zeka mentörün soruyu doğrudan çözmek yerine seni doğru adıma yönlendirir, kalıcı öğrenme sağlar.",
      primaryText: "AI Asistanı İncele",
      primaryHref: "pages/asistanla-soru-coz-tanitim.html",
      secondaryText: "Ücretsiz Başla",
      secondaryHref: "kayit-giris.html?mode=register",
      lottieSrc: "assets/lottie/slide-3.json",
      floatTop: {
        icon: "🤖",
        title: "Sokratik İpucu",
        sub: "Önce 5'i karşıya al"
      },
      floatBottom: {
        icon: "💡",
        title: "7/24 Rehberlik",
        sub: "Adım adım çözüm desteği"
      },
      renderFallback: function () {
        return (
          '<div class="zc-scene">' +
            '<div class="zc-ai-board">' +
              '<div class="zc-ai-header">✨ ZarifÇözüm AI Mentör • Adım Adım İpucu</div>' +
              '<div class="zc-ai-step s1"><span>2x + 5 = 13</span><span class="zc-ai-step-tag">Soru</span></div>' +
              '<div class="zc-ai-step s2"><span>2x = 13 − 5</span><span class="zc-ai-step-tag">İpucu: −5</span></div>' +
              '<div class="zc-ai-step s3"><span>x = 4 ✓</span><span class="zc-ai-step-tag">Harika!</span></div>' +
            '</div>' +
          '</div>'
        );
      }
    },
    {
      num: "04",
      tabLabel: "Keşif",
      eyebrow: "5–8. Sınıf İnteraktif Laboratuvar",
      titleHtml: "Ezberi bırak; <span class='zc-highlight'>dokunarak ve deneyerek</span> keşfet.",
      desc: "Kesirler, teraziler, koordinat düzlemi ve 3B şekillerle oynayarak matematiğin mantığını kendin keşfet.",
      primaryText: "Canlı Keşif Modunu Aç",
      primaryHref: "kesif-modu.html",
      secondaryText: "Aşağıda Hemen Dene",
      secondaryHref: "#canli-kesif-vitrini",
      lottieSrc: "assets/lottie/slide-4.json",
      floatTop: {
        icon: "🏆",
        title: "+25 Keşif XP",
        sub: "Oyunlaştırılmış öğrenme"
      },
      floatBottom: {
        icon: "🧭",
        title: "8 Canlı Laboratuvar",
        sub: "5, 6, 7 ve 8. sınıf"
      },
      renderFallback: function () {
        return (
          '<div class="zc-scene">' +
            '<div class="zc-discover-scene">' +
              '<div class="zc-cube-viewport" aria-hidden="true">' +
                '<div class="zc-cube">' +
                  '<div class="zc-cube-face front">a³</div>' +
                  '<div class="zc-cube-face back">6a²</div>' +
                  '<div class="zc-cube-face right">x²</div>' +
                  '<div class="zc-cube-face left">πr²</div>' +
                  '<div class="zc-cube-face top">1/2</div>' +
                  '<div class="zc-cube-face bottom">3B</div>' +
                '</div>' +
              '</div>' +
              '<div class="zc-numline-box">' +
                '<div class="zc-numline-track"><span class="zc-numline-marker"></span></div>' +
                '<div class="zc-numline-ticks"><span>−2</span><span>−1</span><span>0</span><span>+1</span><span>+2</span></div>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }
    }
  ];

  function initHeroSlider() {
    var section = document.getElementById("heroSliderSection");
    if (!section) return;

    var copyWrap = document.getElementById("zcHeroCopy");
    var eyebrowEl = document.getElementById("zcHeroEyebrowText");
    var titleEl = document.getElementById("zcHeroTitle");
    var descEl = document.getElementById("zcHeroDesc");
    var primaryBtn = document.getElementById("zcHeroPrimaryBtn");
    var secondaryBtn = document.getElementById("zcHeroSecondaryBtn");

    var lottieLayer = document.getElementById("zcHeroLottieLayer");
    var fallbackLayer = document.getElementById("zcHeroFallbackLayer");

    var floatTop = document.getElementById("zcHeroFloatTop");
    var floatTopIcon = document.getElementById("zcHeroFloatTopIcon");
    var floatTopTitle = document.getElementById("zcHeroFloatTopTitle");
    var floatTopSub = document.getElementById("zcHeroFloatTopSub");

    var floatBottom = document.getElementById("zcHeroFloatBottom");
    var floatBottomIcon = document.getElementById("zcHeroFloatBottomIcon");
    var floatBottomTitle = document.getElementById("zcHeroFloatBottomTitle");
    var floatBottomSub = document.getElementById("zcHeroFloatBottomSub");

    var counterCurrent = document.getElementById("zcHeroCounterCurrent");
    var tabButtons = Array.prototype.slice.call(section.querySelectorAll(".zc-hero-tab"));

    var activeIndex = 0;
    var timerId = null;
    var isPaused = false;
    var remainingMs = SLIDE_DURATION;
    var slideStartedAt = Date.now();
    var lottieCache = {};

    function checkLottieExists(url) {
      if (typeof lottieCache[url] === "boolean") {
        return Promise.resolve(lottieCache[url]);
      }
      return fetch(url, { method: "HEAD" })
        .then(function (res) {
          var ok = res.ok;
          lottieCache[url] = ok;
          return ok;
        })
        .catch(function () {
          lottieCache[url] = false;
          return false;
        });
    }

    function renderStage(slide, index) {
      if (fallbackLayer) {
        fallbackLayer.innerHTML = slide.renderFallback();
        fallbackLayer.classList.remove("is-hidden");
      }
      if (lottieLayer) {
        lottieLayer.classList.remove("is-ready");
        lottieLayer.innerHTML = "";
      }

      checkLottieExists(slide.lottieSrc).then(function (exists) {
        if (!exists || activeIndex !== index || !lottieLayer) return;
        var player = document.createElement("lottie-player");
        player.setAttribute("src", slide.lottieSrc);
        player.setAttribute("background", "transparent");
        player.setAttribute("speed", "1");
        player.setAttribute("loop", "");
        player.setAttribute("autoplay", "");
        player.addEventListener("ready", function () {
          if (activeIndex !== index) return;
          lottieLayer.classList.add("is-ready");
          if (fallbackLayer) fallbackLayer.classList.add("is-hidden");
        });
        lottieLayer.appendChild(player);
      });
    }

    function restartProgressAnimation(index) {
      tabButtons.forEach(function (btn, idx) {
        btn.classList.toggle("is-active", idx === index);
        btn.setAttribute("aria-selected", idx === index ? "true" : "false");
        var bar = btn.querySelector(".zc-hero-tab-progress");
        if (bar) {
          bar.style.animation = "none";
          void bar.offsetWidth;
          bar.style.animation = "";
        }
      });
    }

    function applySlide(index, immediate) {
      activeIndex = (index + SLIDES.length) % SLIDES.length;
      var slide = SLIDES[activeIndex];

      if (counterCurrent) counterCurrent.textContent = slide.num;
      restartProgressAnimation(activeIndex);

      var updateDom = function () {
        if (eyebrowEl) eyebrowEl.textContent = slide.eyebrow;
        if (titleEl) titleEl.innerHTML = slide.titleHtml;
        if (descEl) descEl.textContent = slide.desc;

        if (primaryBtn) {
          primaryBtn.textContent = slide.primaryText;
          primaryBtn.setAttribute("href", slide.primaryHref);
        }
        if (secondaryBtn) {
          secondaryBtn.textContent = slide.secondaryText;
          secondaryBtn.setAttribute("href", slide.secondaryHref);
        }

        if (floatTopIcon) floatTopIcon.textContent = slide.floatTop.icon;
        if (floatTopTitle) floatTopTitle.textContent = slide.floatTop.title;
        if (floatTopSub) floatTopSub.textContent = slide.floatTop.sub;

        if (floatBottomIcon) floatBottomIcon.textContent = slide.floatBottom.icon;
        if (floatBottomTitle) floatBottomTitle.textContent = slide.floatBottom.title;
        if (floatBottomSub) floatBottomSub.textContent = slide.floatBottom.sub;

        renderStage(slide, activeIndex);

        if (copyWrap) copyWrap.classList.remove("is-switching");
        if (floatTop) floatTop.classList.remove("is-switching");
        if (floatBottom) floatBottom.classList.remove("is-switching");
      };

      if (immediate) {
        updateDom();
      } else {
        if (copyWrap) copyWrap.classList.add("is-switching");
        if (floatTop) floatTop.classList.add("is-switching");
        if (floatBottom) floatBottom.classList.add("is-switching");
        setTimeout(updateDom, 170);
      }

      remainingMs = SLIDE_DURATION;
      scheduleNext();
    }

    function scheduleNext() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (isPaused) return;
      slideStartedAt = Date.now();
      timerId = setTimeout(function () {
        applySlide(activeIndex + 1, false);
      }, remainingMs);
    }

    function pause() {
      if (isPaused) return;
      isPaused = true;
      section.classList.add("is-paused");
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      var elapsed = Date.now() - slideStartedAt;
      remainingMs = Math.max(400, remainingMs - elapsed);
    }

    function resume() {
      if (!isPaused) return;
      isPaused = false;
      section.classList.remove("is-paused");
      scheduleNext();
    }

    tabButtons.forEach(function (btn, idx) {
      btn.addEventListener("click", function () {
        if (idx === activeIndex) {
          remainingMs = SLIDE_DURATION;
          restartProgressAnimation(idx);
          scheduleNext();
          return;
        }
        applySlide(idx, false);
      });
    });

    section.addEventListener("mouseenter", pause);
    section.addEventListener("mouseleave", resume);

    applySlide(0, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroSlider);
  } else {
    initHeroSlider();
  }
})();
