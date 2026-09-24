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
  /* ---------------------------------------------------------------- */
  /* Эквалайзер за курсором на первом экране                           */
  /* ---------------------------------------------------------------- */
  // Столбики уровня, как в панели записи самого приложения, поднимаются
  // мягким холмом под курсором. Только там, где есть мышь или трекпад:
  // на телефоне курсора нет, а бесконечная анимация стоила бы батареи.
  // И не для тех, кто попросил систему уменьшить движение.
  (function heroEqualizer() {
    var hero = document.getElementById("hero");
    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!hero || !finePointer || reduceMotion) return;

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    hero.insertBefore(canvas, hero.firstChild);
    var ctx = canvas.getContext("2d");

    var GAP = 14, BAR = 7, SIGMA = 110, PEAK = 170;
    // Подобрано на демо: «живость» 4 из 10. Выше — столбики начинают
    // дёргаться вразнобой, и это раздражает, а не радует.
    var LIVELINESS = 0.4;
    var MINT = [34, 183, 149], VIOLET = [108, 99, 242];
    var W = 0, H = 0, bars = [], t = 0;
    var mouseX = 0, inside = false, followX = 0;
    var running = false, visible = true;

    function resize() {
      var dpr = window.devicePixelRatio || 1;
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.ceil(W / GAP);
      while (bars.length < n) bars.push({ h: 5, v: 0 });
    }
    resize();
    followX = W * 0.6;
    new ResizeObserver(resize).observe(hero);

    hero.addEventListener("mousemove", function (e) {
      mouseX = e.clientX - hero.getBoundingClientRect().left;
      inside = true;
    });
    hero.addEventListener("mouseleave", function () { inside = false; });

    function frame() {
      if (!visible || document.hidden) { running = false; return; }
      t += 0.016;
      // Без мыши холм медленно гуляет сам, чтобы экран не был мёртвым.
      var target = inside ? mouseX : W * (0.6 + 0.28 * Math.sin(t * 0.35));
      followX += (target - followX) * 0.06;
      ctx.clearRect(0, 0, W, H);
      // Пол — нижний край окна, пока секция его перекрывает: первый экран
      // выше окна, и столбики у низа секции оказывались за краем, невидимые.
      var rect = hero.getBoundingClientRect();
      var floor = Math.min(H, window.innerHeight - rect.top) - 14;

      var n = Math.ceil(W / GAP), spring = 0.05 + LIVELINESS * 0.07;
      for (var i = 0; i < n; i++) {
        var b = bars[i], x = i * GAP + 4;
        var near = Math.exp(-((x - followX) * (x - followX)) / (2 * SIGMA * SIGMA));
        // Две медленные синусоиды со сдвигом по номеру столбика: соседи
        // движутся согласованно, и по ряду идёт волна, а не шум.
        var wave = 0.5 + 0.5 * Math.sin(t * (0.8 + LIVELINESS * 1.6) - i * 0.35)
          * Math.sin(t * (0.5 + LIVELINESS * 0.9) * 0.7 + i * 0.12);
        // Потолок в пикселях, а не доля экрана: первый экран высокий, и
        // холм в полвысоты залезал на кнопки и текст.
        var goal = 5 + near * PEAK * (0.55 + 0.45 * wave) + wave * 6;
        // Пружина с затуханием: столбик догоняет цель, как стрелка
        // индикатора, а не перескакивает к ней за кадр.
        b.v = (b.v + (goal - b.h) * spring) * 0.72;
        b.h += b.v;

        var k = Math.min(1, near * 1.3);
        ctx.fillStyle = "rgba(" +
          Math.round(MINT[0] + (VIOLET[0] - MINT[0]) * k) + "," +
          Math.round(MINT[1] + (VIOLET[1] - MINT[1]) * k) + "," +
          Math.round(MINT[2] + (VIOLET[2] - MINT[2]) * k) + "," +
          (0.22 + near * 0.3).toFixed(3) + ")";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, floor - b.h, BAR, b.h, 3.5);
        else ctx.rect(x, floor - b.h, BAR, b.h);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    function start() {
      if (running || !visible || document.hidden) return;
      running = true;
      requestAnimationFrame(frame);
    }
    // Ушли ниже первого экрана или на другую вкладку — кадры не считаются.
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      start();
    }).observe(hero);
    document.addEventListener("visibilitychange", start);
    start();
  })();

  /* ---------------------------------------------------------------- */
  /* Лайтбокс — скриншот крупно                                         */
  /* ---------------------------------------------------------------- */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = lightbox ? lightbox.querySelector("img") : null;
  var lightboxCaption = lightbox ? lightbox.querySelector(".lightbox-caption") : null;
  var shots = [];
  var shotIndex = 0;
  var shotsSwiper = null;

  function showShot(index) {
    shotIndex = (index + shots.length) % shots.length;
    var img = shots[shotIndex];
    var caption = img.closest("figure").querySelector("figcaption");
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = (caption ? caption.textContent + " · " : "")
      + (shotIndex + 1) + " / " + shots.length;
    // Карусель под лайтбоксом едет следом: закрыли — стоите на том же снимке.
    if (shotsSwiper) shotsSwiper.slideTo(shotIndex);
  }
  function openLightbox(img) {
    if (!lightbox) return;
    shots = Array.prototype.slice.call(document.querySelectorAll(".shots-swiper .swiper-slide img"));
    lightbox.hidden = false;
    document.documentElement.style.overflow = "hidden";
    // У карусели свои стрелки на клавиатуре: при открытом лайтбоксе она
    // листалась бы вдвое и уезжала от показанного снимка.
    if (shotsSwiper) shotsSwiper.keyboard.disable();
    showShot(Math.max(0, shots.indexOf(img)));
  }
  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightboxImg.removeAttribute("src");
    document.documentElement.style.overflow = "";
    if (shotsSwiper) shotsSwiper.keyboard.enable();
  }
  if (lightbox) {
    lightbox.addEventListener("click", closeLightbox);
    lightbox.querySelector(".lightbox-prev").addEventListener("click", function (e) {
      e.stopPropagation(); showShot(shotIndex - 1);
    });
    lightbox.querySelector(".lightbox-next").addEventListener("click", function (e) {
      e.stopPropagation(); showShot(shotIndex + 1);
    });
    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") showShot(shotIndex - 1);
      else if (e.key === "ArrowRight") showShot(shotIndex + 1);
    });
    // Свайп на телефоне: стрелки там мелкие, а листать пальцем привычнее.
    var touchX = null;
    lightbox.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) {
        e.preventDefault();
        showShot(shotIndex + (dx < 0 ? 1 : -1));
      }
    });
  }

  function initSwiper() {
    if (typeof Swiper === "undefined") return;
    // slidesPerView: "auto" — слайды разной ширины (реальные скриншоты settings-окна
    // разных вкладок отличаются пропорциями, у двух ещё не готовых — своя, меньшая).
    // Ширину каждого слайда задаёт CSS (fixed height + auto width), не Swiper.
    shotsSwiper = new Swiper(".shots-swiper", {
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
      },
      // Событие Swiper, а не click на картинке: оно не приходит, если
      // карусель тянули мышью, — иначе каждое перелистывание открывало бы снимок.
      on: {
        click: function (swiper, event) {
          if (event.target && event.target.tagName === "IMG") openLightbox(event.target);
        }
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
