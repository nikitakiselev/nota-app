// Nota — лендинг: сцены на прокрутке, счётчики, водопад скриншотов, демо аватара.
// Без сборки и фреймворков. Аватар рисует js/avatar.js.
(function () {
  "use strict";
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fit(c) {
    var r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    c.width = Math.max(1, Math.round(r.width * d)); c.height = Math.max(1, Math.round(r.height * d));
    var x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    return { w: r.width, h: r.height, x: x };
  }
  // Доля пройденного закреплённого раздела, 0…1.
  function prog(el) {
    var r = el.getBoundingClientRect(), d = r.height - innerHeight;
    return d <= 0 ? 0 : clamp(-r.top / d, 0, 1);
  }
  // Насколько блок въехал в экран: 0 — нижний край экрана, 1 — прошёл долю span.
  function enter(el, span) {
    return clamp((innerHeight - el.getBoundingClientRect().top) / (innerHeight * span), 0, 1);
  }
  // Похоже на речь: слова и паузы, внутри слова — слоги.
  function speech(t) {
    var word = Math.sin(t * 1.9) + Math.sin(t * 0.7 + 2) > -0.6 ? 1 : 0.08;
    return word * (0.4 + 0.6 * Math.abs(Math.sin(t * 9.1) * Math.sin(t * 3.7 + 1)));
  }
  function hash(n) { var v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); }

  $$("[data-to]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.getElementById(b.dataset.to).scrollIntoView({ behavior: RM ? "auto" : "smooth" });
    });
  });

  /* ---------- сцена на прокрутке: слова, описания, полоска, фон ---------- */
  function Scene(root, apply) {
    var pin = $(".pin", root), lists = [$$(".words span", root), $$(".desc p", root)], bar = $(".prog i", root);
    var n = lists[0].length, self = { step: 0, loc: 0, visible: false, eq: null, cv: $(".eq", root) };
    self.resize = function () { self.eq = fit(self.cv); };
    self.update = function () {
      var r = root.getBoundingClientRect();
      self.visible = r.bottom > 0 && r.top < innerHeight;
      var s = prog(root) * n, st = Math.min(n - 1, Math.floor(s));
      self.step = st; self.loc = s - st; pin.dataset.s = st;
      lists.forEach(function (list) {
        list.forEach(function (el, i) { el.classList.toggle("on", i === st); el.classList.toggle("past", i < st); });
      });
      bar.style.transform = "scaleX(" + clamp(s / n, 0, 1) + ")";
      apply(st, self.loc);
    };
    return self;
  }
  // Полоски звука. mode: speech, run (огонёк распознавания), noise, music, hush.
  function bars(g, t, mode, amp, color) {
    var x = g.x, w = g.w, h = g.h, n = 36, bw = w / n;
    x.clearRect(0, 0, w, h); x.fillStyle = color;
    for (var i = 0; i < n; i++) {
      var e = Math.sin(Math.PI * (i + 0.5) / n), bh = 4;
      if (mode === "speech") bh = h * amp * e * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.9 + t * 7) * Math.sin(i * 0.37 - t * 3)));
      else if (mode === "run") bh = 4 + 14 * Math.max(0, 1 - Math.abs(i - (t * 30) % n) / 3);
      else if (mode === "noise") bh = h * amp * (0.25 + 0.75 * hash(i + Math.floor(t * 16) * 37));
      else if (mode === "music") bh = h * amp * e * (0.45 + 0.55 * Math.sin(i * 0.55 - t * 2.4));
      else if (mode === "hush") bh = 4 + 5 * amp * hash(i + Math.floor(t * 8) * 13);
      bh = Math.max(4, bh);
      x.beginPath(); x.roundRect(i * bw + bw * 0.22, (h - bh) / 2, bw * 0.56, bh, bw * 0.28); x.fill();
    }
  }
  function avatarIn(root) {
    var c = $("canvas.av", root);
    return c && window.NotaAvatar ? new window.NotaAvatar(c) : null;
  }

  /* ---------- первый экран ---------- */
  var heroEl = $("#hero"), heroAv = avatarIn(heroEl), heroLine = $(".line", heroEl), heroKey = $(".key", heroEl), heroAmp = 0;
  var PAIR = { raw: "терраформ апплай", fixed: "terraform apply" };
  var STATES = ["idle", "listening", "transcribing", "done"];
  if (heroAv) heroAv.keepDone = true;
  var hero = Scene(heroEl, function (st, loc) {
    var press = st === 0 ? clamp(loc * 1.7, 0, 1) : st === 1 ? 1 : st === 2 ? clamp(1 - loc * 3, 0, 1) : 0;
    heroKey.style.setProperty("--press", press.toFixed(3));
    if (heroAv) heroAv.setState(STATES[st]);
    heroLine.className = "line" + (st === 3 ? " fix" : " raw");
    heroLine.textContent = st === 0 ? "" : st === 1 ? PAIR.raw.slice(0, Math.ceil(loc * 1.4 * PAIR.raw.length))
      : st === 2 ? PAIR.raw + " …" : PAIR.fixed.slice(0, Math.ceil(loc * 1.8 * PAIR.fixed.length));
  });

  /* ---------- детектор речи ---------- */
  var vadEl = $("#vad"), vadAv = avatarIn(vadEl), vadLine = $(".line", vadEl), vadTag = $(".tag", vadEl);
  var FAKES = [
    ["запись: тишина в комнате", "«Время обновления: 06:00»"],
    ["запись: громкий шум", "«Время обновления: 20.04.2011»"],
    ["запись: музыка без слов", "«Продолжение следует...»"]
  ];
  var vad = Scene(vadEl, function (st, loc) {
    if (vadAv) vadAv.setState(st === 3 ? "idle" : "transcribing");
    if (st < 3) {
      vadTag.textContent = FAKES[st][0] + " — whisper без VAD вставил бы:";
      vadLine.className = "line bad";
      vadLine.textContent = FAKES[st][1].slice(0, Math.ceil(clamp(loc * 1.7, 0, 1) * FAKES[st][1].length));
    } else {
      vadTag.textContent = "те же записи, VAD включён:";
      vadLine.className = "line ok";
      vadLine.textContent = "голоса нет — ничего не вставлено";
    }
  });

  /* ---------- имя: слова зажигаются по мере прокрутки ---------- */
  var nameEl = $("#name-text");
  nameEl.innerHTML = nameEl.textContent.split(" ").map(function (w) { return "<span>" + w + "</span>"; }).join(" ");
  var nameWords = $$("span", nameEl);

  /* ---------- приватность: счётчик байтов ---------- */
  var zero = $("#zero"), zeroBox = zero.parentNode;

  /* ---------- словарь, водопад, статистика ---------- */
  var cards = $$(".card"), colsBox = $("#cols"), cols = $$("#cols > div");
  var barsBox = $("#bars"), HEIGHTS = [38, 55, 47, 70, 62, 22, 18, 58, 74, 66, 91, 80, 30, 26];
  HEIGHTS.forEach(function (h) { var i = document.createElement("i"); i.style.height = h + "%"; barsBox.appendChild(i); });
  var barEls = $$("i", barsBox), nums = $$("#stats [data-n]"), statsBox = $(".st-grid");

  function onScroll() {
    hero.update(); vad.update();
    if (RM) return;
    var p = clamp((innerHeight * 0.9 - nameEl.getBoundingClientRect().top) / (innerHeight * 0.55), 0, 1);
    nameWords.forEach(function (w, i) { w.classList.toggle("lit", i < p * nameWords.length); });

    var z = 1 - enter(zeroBox, 0.75);
    zero.textContent = Math.round(1048576 * z * z * z).toLocaleString("ru-RU");

    cards.forEach(function (c, i) {
      var n = cards[i + 1]; if (!n) return;
      var r = c.getBoundingClientRect(), s = clamp(1 - (n.getBoundingClientRect().top - r.top) / r.height, 0, 1);
      c.style.transform = "scale(" + (1 - 0.06 * s) + ")";
      c.style.filter = "brightness(" + (1 - 0.06 * s) + ")";
    });

    var cr = colsBox.getBoundingClientRect(), cp = clamp((innerHeight - cr.top) / (innerHeight + cr.height), 0, 1);
    cols[0].style.transform = "translateY(" + (-cp * 240) + "px)";
    cols[1].style.transform = "translateY(" + (-330 + cp * 260) + "px)";
    cols[2].style.transform = "translateY(" + (-cp * 340) + "px)";

    var sp = enter(statsBox, 0.7), ease = 1 - Math.pow(1 - sp, 3);
    barEls.forEach(function (b, i) { b.style.transform = "scaleY(" + clamp(ease * 1.5 - i * 0.035, 0, 1) + ")"; });
    nums.forEach(function (b) {
      var v = +b.dataset.n * ease;
      b.textContent = b.dataset.n.indexOf(".") < 0 ? Math.round(v) : v.toFixed(1);
    });
  }
  function onResize() { hero.resize(); vad.resize(); onScroll(); }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onResize);
  onResize();

  var last = 0, vadAmp = 0;
  function tick(ms) {
    var t = ms / 1000, dt = Math.min(0.05, t - last); last = t;
    if (!document.hidden) {
      if (hero.visible) {
        var target = hero.step === 1 ? 0.15 + 0.85 * speech(t) : 0.03;
        heroAmp += (target - heroAmp) * Math.min(1, dt * (target > heroAmp ? 14 : 6));
        bars(hero.eq, t, hero.step === 2 ? "run" : "speech", heroAmp, hero.step === 2 ? "#eeab2e" : "#6c63f2");
      }
      if (vad.visible) {
        var want = vad.step === 3 ? 0 : 1;
        vadAmp += (want - vadAmp) * Math.min(1, dt * 5);
        bars(vad.eq, t, ["hush", "noise", "music", "hush"][vad.step], vad.step === 1 ? 0.8 * vadAmp : vad.step === 2 ? 0.7 * vadAmp : vadAmp,
          vad.step === 3 ? "#22b795" : "#e2532f");
      }
    }
    requestAnimationFrame(tick);
  }
  if (RM) { bars(hero.eq, 1, "speech", 0.5, "#6c63f2"); bars(vad.eq, 1, "hush", 0, "#22b795"); }
  else requestAnimationFrame(tick);

  /* ---------- скриншот крупно ---------- */
  var zoom = $("#zoom");
  $$("#cols img").forEach(function (img) {
    img.addEventListener("click", function () {
      $("img", zoom).src = img.src; $("img", zoom).alt = img.alt; $("p", zoom).textContent = img.alt;
      zoom.showModal();
    });
  });
  zoom.addEventListener("click", function () { zoom.close(); });

  /* ---------- команда установки ---------- */
  var copy = $("#copy");
  copy.addEventListener("click", function () {
    navigator.clipboard.writeText($("#cmd").textContent).then(function () {
      copy.textContent = "Скопировано";
      setTimeout(function () { copy.textContent = "Скопировать команду"; }, 2000);
    }, function () { copy.textContent = "Не удалось — выделите команду вручную"; });
  });

  /* ---------- раздел «Аватар»: состояния и реакции, как в приложении ---------- */
  (function () {
    var canvas = $("#av-demo");
    if (!canvas || !window.NotaAvatar) return;
    var stateBtns = $$("#av-states [data-state]");
    var demo = new window.NotaAvatar(canvas, {
      onState: function (s) { stateBtns.forEach(function (b) { b.classList.toggle("cur", b.dataset.state === s); }); }
    });
    // Клипы тела (~4 МБ) грузятся, когда до раздела недалеко: шапке хватает кадра покоя.
    if ("IntersectionObserver" in window && !RM) {
      var near = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        near.disconnect(); demo.preload();
      }, { rootMargin: "800px 0px" });
      near.observe(canvas);
    }
    var scenario = [["idle", 3.6], ["connecting", 1.6], ["listening", 4.6], ["transcribing", 1.7], ["done", 1.4]];
    var step = 0, timer = null;
    function next() {
      var item = scenario[step++ % scenario.length];
      demo.setState(item[0]);
      timer = setTimeout(next, item[1] * 1000);
    }
    stateBtns.forEach(function (b) {
      b.addEventListener("click", function () { clearTimeout(timer); demo.keepDone = true; demo.setState(b.dataset.state); });
    });
    $("#av-cycle").addEventListener("click", function () { clearTimeout(timer); demo.keepDone = false; step = 0; next(); });
    if (RM) demo.setState("idle"); else next();

    $$(".seg button").forEach(function (tab) {
      tab.addEventListener("click", function () {
        $$(".seg button").forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
        $$(".av-box [data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      });
    });

    var TRIGGERS = {
      click: ["wink", "smile", "stars"], dbl: ["copied"], empty: ["empty"], drag: ["scared", "wheee"],
      drop: ["glitch", "dizzy", "relief"], hover: ["squint"], burst: ["annoyed", "angry", "shy"],
      idle: ["yawn", "hum", "sneeze", "sleep"]
    };
    var lastPick = {};
    function pick(trigger) {
      var list = TRIGGERS[trigger];
      var pool = list.length > 1 ? list.filter(function (id) { return id !== lastPick[trigger]; }) : list;
      return (lastPick[trigger] = pool[Math.floor(Math.random() * pool.length)]);
    }
    // В приложении реакции играют только в ожидании.
    function toIdle() { clearTimeout(timer); demo.keepDone = false; demo.setState("idle"); }
    $$("#av-reactions [data-trigger]").forEach(function (b) {
      b.addEventListener("click", function () { toIdle(); demo.react(pick(b.dataset.trigger)); });
    });

    var press = null, clicks = [], lastClick = -Infinity, hoverTimer = null;
    function now() { return performance.now() / 1000; }
    function click() {
      var t = now();
      clicks = clicks.filter(function (c) { return t - c < 2.5; });
      clicks.push(t);
      if (clicks.length >= 5) { clicks = []; lastClick = -Infinity; demo.react(pick("burst")); return; }
      if (t - lastClick < 0.4) { lastClick = -Infinity; demo.react(pick("dbl")); return; }
      lastClick = t;
      demo.react(pick("click"));
    }
    canvas.addEventListener("pointerdown", function (e) {
      toIdle(); clearTimeout(hoverTimer);
      var woke = demo.isAsleep();
      if (woke) demo.release();
      press = { x: e.clientX, y: e.clientY, moved: false, woke: woke };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!press) return;
      var dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (!press.moved && Math.hypot(dx, dy) > 5) { press.moved = true; demo.react(pick("drag"), true); canvas.style.transition = "none"; }
      if (press.moved) canvas.style.transform = "translate(" + dx + "px," + dy + "px)";
    });
    function up() {
      if (!press) return;
      var p = press; press = null;
      if (p.moved) {
        demo.release(); demo.react(pick("drop"));
        canvas.style.transition = "transform .45s cubic-bezier(.2,.8,.2,1)"; canvas.style.transform = "";
      } else if (!p.woke) click();
    }
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerenter", function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { if (!press && !demo.isPlaying() && demo.state === "idle") demo.react(pick("hover")); }, 1000);
    });
    canvas.addEventListener("pointerleave", function () { clearTimeout(hoverTimer); });
  })();
})();
