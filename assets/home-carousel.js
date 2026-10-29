(() => {
  const carousel = document.querySelector('[data-home-carousel]');
  if (!carousel) return;

  const hero = carousel.closest('.hero');
  const slides = Array.from(carousel.querySelectorAll('[data-carousel-slide]'));
  const copySlides = Array.from(hero.querySelectorAll('[data-hero-copy]'));
  const indicators = Array.from(carousel.querySelectorAll('[data-carousel-to]'));
  const count = carousel.querySelector('[data-carousel-count]');
  const previousButton = hero.querySelector('[data-carousel-prev]');
  const nextButton = hero.querySelector('[data-carousel-next]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let autoplayTimer;

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });

    copySlides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });

    indicators.forEach((indicator, indicatorIndex) => {
      if (indicatorIndex === activeIndex) {
        indicator.setAttribute('aria-current', 'true');
      } else {
        indicator.removeAttribute('aria-current');
      }
    });

    count.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  }

  function stopAutoplay() {
    window.clearInterval(autoplayTimer);
    autoplayTimer = undefined;
  }

  function startAutoplay() {
    if (reducedMotion || autoplayTimer || document.hidden) return;
    autoplayTimer = window.setInterval(() => showSlide(activeIndex + 1), 5000);
  }

  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  previousButton.addEventListener('click', () => {
    showSlide(activeIndex - 1);
    restartAutoplay();
  });
  nextButton.addEventListener('click', () => {
    showSlide(activeIndex + 1);
    restartAutoplay();
  });

  indicators.forEach((indicator) => {
    indicator.addEventListener('click', () => {
      showSlide(Number(indicator.dataset.carouselTo));
      restartAutoplay();
    });
  });

  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showSlide(activeIndex - 1);
      restartAutoplay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showSlide(activeIndex + 1);
      restartAutoplay();
    }
  });

  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', (event) => {
    if (!carousel.contains(event.relatedTarget)) startAutoplay();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  showSlide(0);
  startAutoplay();
})();
