(() => {
  const carousel = document.querySelector('[data-home-carousel]');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('[data-carousel-slide]'));
  const indicators = Array.from(carousel.querySelectorAll('[data-carousel-to]'));
  const count = carousel.querySelector('[data-carousel-count]');
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

  carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => {
    showSlide(activeIndex - 1);
  });
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => {
    showSlide(activeIndex + 1);
  });

  indicators.forEach((indicator) => {
    indicator.addEventListener('click', () => {
      showSlide(Number(indicator.dataset.carouselTo));
    });
  });

  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showSlide(activeIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showSlide(activeIndex + 1);
    }
  });

  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
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
