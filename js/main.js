// Nota — landing page interactions.
// Без сборки и фреймворков: IntersectionObserver для reveal, немного DOM-кода
// для мокапов hero/метра, Swiper (CDN) для карусели скриншотов.

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- */
  /* Скролл-метр вверху страницы                                       */
  /* ---------------------------------------------------------------- */
  var scrollMeter = document.getElementById("scroll-meter");
  function updateScrollMeter() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - doc.clientHeight;
    var ratio = scrollable > 0 ? doc.scrollTop / scrollable : 0;
    if (scrollMeter) {
      scrollMeter.style.transform = "scaleX(" + Math.min(1, Math.max(0, ratio)) + ")";
    }
  }
  document.addEventListener("scroll", updateScrollMeter, { passive: true });
  window.addEventListener("resize", updateScrollMeter);
  updateScrollMeter();

  /* ---------------------------------------------------------------- */
  /* Reveal on scroll                                                   */
  /* ---------------------------------------------------------------- */
  var revealTargets = document.querySelectorAll(".reveal, .reveal-stagger");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealTargets.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* ---------------------------------------------------------------- */
  /* Мобильное меню                                                     */
  /* ---------------------------------------------------------------- */
  var navToggle = document.getElementById("nav-toggle");
  var navMenuMobile = document.getElementById("nav-menu-mobile");
  if (navToggle && navMenuMobile) {
    navToggle.addEventListener("click", function () {
      var isOpen = navMenuMobile.classList.toggle("flex");
      navMenuMobile.classList.toggle("hidden");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
    navMenuMobile.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navMenuMobile.classList.add("hidden");
        navMenuMobile.classList.remove("flex");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Hero: уровень записи — органичные случайные амплитуды              */
  /* ---------------------------------------------------------------- */
  document.querySelectorAll(".meter-bars span").forEach(function (bar, i) {
    var min = 0.15 + Math.random() * 0.25;
    var max = 0.55 + Math.random() * 0.45;
    bar.style.setProperty("--h-min", min.toFixed(2));
    bar.style.setProperty("--h-max", max.toFixed(2));
    bar.style.animationDelay = (i * 0.09).toFixed(2) + "s";
    bar.style.animationDuration = (1.1 + Math.random() * 0.9).toFixed(2) + "s";
  });

  /* ---------------------------------------------------------------- */
  /* Hero: печатающийся transcript — распознанное → исправленное        */
  /* ---------------------------------------------------------------- */
  var pairs = [
    { raw: "терраформ апплай", fixed: "terraform apply" },
    { raw: "биг квери", fixed: "BigQuery" },
    { raw: "кубернетес кластер", fixed: "Kubernetes-кластер" },
    { raw: "пост грез", fixed: "PostgreSQL" }
  ];
  var typeEl = document.getElementById("typewriter");

  function typewriter() {
    if (!typeEl) return;
    var pair = pairs[Math.floor(Math.random() * pairs.length)];
    var state = { phase: "raw", i: 0 };

    function render(text, cls) {
      typeEl.innerHTML =
        '<span class="' + cls + '">' + text + "</span>" +
        '<span class="typewriter-caret" aria-hidden="true">&nbsp;</span>';
    }

    if (reduceMotion) {
      render(pair.fixed, "text-ink");
      setTimeout(typewriter, 2600);
      return;
    }

    function step() {
      if (state.phase === "raw") {
        state.i++;
        render(pair.raw.slice(0, state.i), "text-ink-soft");
        if (state.i >= pair.raw.length) {
          setTimeout(function () {
            state.phase = "erase";
            step();
          }, 650);
          return;
        }
      } else if (state.phase === "erase") {
        state.i--;
        render(pair.raw.slice(0, state.i), "text-ink-soft");
        if (state.i <= 0) {
          state.phase = "fixed";
          state.i = 0;
          setTimeout(step, 150);
          return;
        }
      } else if (state.phase === "fixed") {
        state.i++;
        render(pair.fixed.slice(0, state.i), "text-violet font-medium");
        if (state.i >= pair.fixed.length) {
          setTimeout(typewriter, 2200);
          return;
        }
      }
      setTimeout(step, state.phase === "fixed" ? 55 : 40);
    }
    step();
  }
  typewriter();

  /* ---------------------------------------------------------------- */
  /* Placeholder-скриншоты: скрыть подпись, если картинка реально есть  */
  /* ---------------------------------------------------------------- */
  document.querySelectorAll(".shot-frame img[data-real]").forEach(function (img) {
    img.addEventListener("error", function () {
      img.classList.add("img-missing");
    });
    img.addEventListener("load", function () {
      var caption = img.parentElement.querySelector(".shot-placeholder");
      if (caption) caption.style.display = "none";
    });
  });

  /* ---------------------------------------------------------------- */
  /* Swiper — карусель скриншотов                                       */
  /* ---------------------------------------------------------------- */
  function initSwiper() {
    if (typeof Swiper === "undefined") return;
    // slidesPerView: "auto" — слайды разной ширины (реальные скриншоты settings-окна
    // разных вкладок отличаются пропорциями, у двух ещё не готовых — своя, меньшая).
    // Ширину каждого слайда задаёт CSS (fixed height + auto width), не Swiper.
    new Swiper(".shots-swiper", {
      slidesPerView: "auto",
      centeredSlides: true,
      spaceBetween: 24,
      grabCursor: true,
      keyboard: { enabled: true },
      a11y: { enabled: true },
      pagination: {
        el: ".shots-swiper .swiper-pagination",
        clickable: true
      },
      navigation: {
        nextEl: ".shots-swiper .swiper-button-next",
        prevEl: ".shots-swiper .swiper-button-prev"
      },
      breakpoints: {
        640: { spaceBetween: 28 },
        1280: { spaceBetween: 36 }
      }
    });
  }
  if (document.readyState === "complete") {
    initSwiper();
  } else {
    window.addEventListener("load", initSwiper);
  }

  /* ---------------------------------------------------------------- */
  /* Год в футере                                                       */
  /* ---------------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
