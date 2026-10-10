// Nota — пиксельный аватар для лендинга.
// Та же картинка, что в приложении: карта корпуса и рисунки экрана — из
// AvatarSprite.swift и AvatarScreen.swift в nota-macos. Голос здесь
// имитируется: микрофон странице не нужен.

(function () {
  "use strict";

  var SIZE = 38;
  var SX = 10, SY = 17, SW = 16, SH = 12; // экран на карте корпуса

  var ROWS = [
    "                        ######        ",
    "                       #shhhhh#       ",
    "                       #lmllllm#      ",
    "                       #lmlmmmmd#     ",
    "                       #lm##lmmmd#    ",
    "                       #lm# #lmmmd#   ",
    "                       #lm#  #lmmd#   ",
    "                       #lm#   #lmd#   ",
    "                       #lm#    #dd#   ",
    "            ############lm########    ",
    "           #sshhhhhhhhhhhhhhhhhh#     ",
    "          #hlllllllllllllllllllhd#    ",
    "         #hlllllllllllllllllllhdd#    ",
    "        #hlllllllllllllllllllhddd#    ",
    "       #hmmmmmmmmmmmmmmmmmmmhdddd#    ",
    "      #hmmmmmmmmmmmmmmmmmmmmmdddd#    ",
    "      #lmmbbbbbbbbbbbbbbbbmmmdddd#    ",
    "      #lmbb..............bbmmdddd#    ",
    "      #lmb................bmmdddd#    ",
    "      #lmb................bmmdhld#    ",
    "      #lmb................bmmdlmd###  ",
    "      #lmb................bmmdddd#ll# ",
    "      #lmb................bmmddddmmmd#",
    "    ###lmb................bmmdhldmmmd#",
    "   #sl#lmb................bmmdlmd#dd# ",
    "  #lmmmlmb................bmmdddd###  ",
    "  #lmmmlmb................bmmdddd#    ",
    "   #dd#lmb................bmmddd#     ",
    "    ###lmbb..............bbmmdd#      ",
    "      #lmmbbbbbbbbbbbbbbbbmmmd#       ",
    "      #lmmmmmmmmmmmmmmmmmmmmm#        ",
    "       #dddddddddddddddddddd#         ",
    "        ###md##########md###          ",
    "          #md#        #md#            ",
    "         #slll#      #slll#           ",
    "        #mmmmmm#    #mmmmmm#          ",
    "         #dddd#      #dddd#           ",
    "          ####        ####            "
  ];
  var BODY = {
    "#": 0x070d0f, d: 0x1b272c, m: 0x283a40, l: 0x3a5259,
    h: 0x76a3a3, s: 0xc5ebe3, b: 0x0f1719, ".": 0x04110a
  };
  var SCREEN = 0x04110a;
  // Накал: 1 ореол, 2 dim, 3 core, 4 bright.
  var GREEN = [SCREEN, 0x0c2c18, 0x1d6a3a, 0x46f283, 0xc4ffd8];
  var RED = [SCREEN, 0x2e0d0a, 0x6e1f1a, 0xff5a48, 0xffc6bd];

  var CHECK = [[4, 6], [5, 7], [6, 8], [7, 7], [8, 6], [9, 5], [10, 4], [11, 3], [12, 2]];
  CHECK = CHECK.concat(CHECK.map(function (p) { return [p[0], p[1] + 1]; }));
  var BROWS = [[3, 3], [4, 2], [11, 2], [12, 3]];
  var MOUTH = [[6, 9], [7, 8], [8, 8], [9, 9]];
  var DONE_SECONDS = 1.4;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function isCorner(x, y) {
    return (x === 0 || x === SW - 1) && (y === 0 || y === SH - 1);
  }

  function noise(x, seed) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    function h(n) { var v = Math.sin((n + seed * 57.3) * 127.1) * 43758.5453; return v - Math.floor(v); }
    return h(i) * (1 - u) + h(i + 1) * u;
  }
  // Похоже на речь: слова и паузы, внутри слова — слоги около 6 в секунду.
  function speechDb(t) {
    var fine = noise(t * 23, 3);
    return noise(t * 0.9, 1) > 0.32 ? -34 + 20 * noise(t * 7, 2) + 4 * fine : -54 + 4 * fine;
  }

  var body = (function () {
    var data = new Uint8ClampedArray(SIZE * SIZE * 4);
    ROWS.forEach(function (row, y) {
      for (var x = 0; x < SIZE; x++) {
        var c = BODY[row[x]];
        if (c === undefined) continue;
        var i = (y * SIZE + x) * 4;
        data[i] = c >> 16 & 255; data[i + 1] = c >> 8 & 255; data[i + 2] = c & 255; data[i + 3] = 255;
      }
    });
    return data;
  })();

  function NotaAvatar(canvas, options) {
    this.canvas = canvas;
    this.onState = options && options.onState;
    // Демо может задержаться на галочке: в приложении она гаснет через 1,4 с.
    this.keepDone = false;
    this.state = "idle";
    this.since = 0;
    this.start = performance.now() / 1000;
    this.level = -60;
    this.lastT = null;
    this.blinkAt = 1 + Math.random() * 2;
    this.glanceAt = 2.5 + Math.random() * 3;
    this.glanceUntil = 0;
    this.glanceDx = 0;
    this.flickerAt = 4 + Math.random() * 2;
    this.visible = true;

    this.low = document.createElement("canvas");
    this.low.width = this.low.height = SIZE;
    this.lowCtx = this.low.getContext("2d");
    this.image = this.lowCtx.createImageData(SIZE, SIZE);
    this.ctx = canvas.getContext("2d");
    this.resize();

    var self = this;
    window.addEventListener("resize", function () { self.resize(); if (reduceMotion) self.draw(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        self.visible = entries[0].isIntersecting;
        if (self.visible) self.loop();
      }).observe(canvas);
    }
    this.loop();
  }

  NotaAvatar.prototype.now = function () {
    return performance.now() / 1000 - this.start;
  };

  // Масштаб — целое число физических пикселей на точку спрайта, от ширины
  // холста в вёрстке: дробный растянул бы точки неровно.
  NotaAvatar.prototype.resize = function () {
    var dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    this.dpr = dpr;
    this.scale = Math.max(1, Math.round((this.canvas.clientWidth || SIZE * 2) / SIZE));
    this.canvas.width = this.canvas.height = SIZE * this.scale * dpr;
    this.ctx.imageSmoothingEnabled = false;
  };

  NotaAvatar.prototype.setState = function (state) {
    if (state !== this.state) {
      this.state = state;
      this.since = this.now();
    }
    if (this.onState) this.onState(state);
    if (reduceMotion) this.draw();
  };

  NotaAvatar.prototype.loop = function () {
    if (this.running || reduceMotion) { if (reduceMotion) this.draw(); return; }
    this.running = true;
    var self = this;
    function frame() {
      if (!self.visible) { self.running = false; return; }
      self.draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  NotaAvatar.prototype.face = function (t) {
    if (t >= this.blinkAt + 0.16) this.blinkAt = t + 2.2 + Math.random() * 3.6;
    var d = t - this.blinkAt;
    var open = d < 0 || d >= 0.16 ? 2 : d < 0.05 || d >= 0.11 ? 1 : 0;
    if (t >= this.glanceAt) {
      this.glanceDx = Math.random() < 0.5 ? -1 : 1;
      this.glanceUntil = t + 0.6 + Math.random() * 0.9;
      this.glanceAt = this.glanceUntil + 3 + Math.random() * 5;
    }
    if (t >= this.flickerAt + 0.07) this.flickerAt = t + 5 + Math.random() * 6;
    return {
      open: open,
      glance: t < this.glanceUntil ? this.glanceDx : 0,
      flicker: t >= this.flickerAt && t < this.flickerAt + 0.07
    };
  };

  NotaAvatar.prototype.draw = function () {
    var t = this.now();
    var dt = this.lastT === null ? 0 : Math.min(0.1, t - this.lastT);
    this.lastT = t;
    var state = this.state, sT = t - this.since;
    if (state === "done" && !this.keepDone && sT >= DONE_SECONDS) {
      this.setState("idle");
      state = "idle"; sT = 0;
    }

    var target = state === "listening" ? speechDb(t) : -60;
    this.level += (target - this.level) * (1 - Math.exp(-dt / (target > this.level ? 0.05 : 0.25)));
    var level = Math.max(0, Math.min(1, (this.level + 50) / 44));
    var face = reduceMotion ? { open: 2, glance: 0, flicker: false } : this.face(t);

    var ink = new Uint8Array(SW * SH);
    function set(x, y, v) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= SW || y >= SH || isCorner(x, y)) return;
      ink[y * SW + x] = v;
    }
    function rect(x, y, w, h, v) {
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) set(x + i, y + j, v);
    }
    function eyes(shift) {
      [3, 11].forEach(function (left) {
        if (face.open === 2) { rect(left + shift, 4, 2, 1, 4); rect(left + shift, 5, 2, 1, 3); }
        else rect(left + shift, 5, 2, 1, 3);
      });
    }

    switch (state) {
      case "idle": eyes(face.glance); break;
      case "connecting": eyes([-2, 0, 2, 0][Math.floor(sT / 0.4) % 4]); break;
      case "listening": {
        var amp = 0.4 + 4.6 * level, prev = null;
        for (var x = 0; x < SW; x++) {
          var env = 0.55 + 0.45 * Math.sin(x * 0.42 + t * 3.1);
          var y = Math.max(0, Math.min(SH - 1, Math.round(6 + amp * env * Math.sin(x * 0.95 - t * 13))));
          if (prev !== null && prev !== y) {
            var s = y > prev ? 1 : -1;
            for (var r = prev + s; r !== y; r += s) set(x, r, 3);
          }
          set(x, y, 4);
          prev = y;
        }
        break;
      }
      case "transcribing": {
        var u = (sT / 0.55) % 2, p = u < 1 ? u : 2 - u, dir = u < 1 ? 1 : -1, trail = [4, 3, 2, 2];
        for (var j = 3; j >= 0; j--) rect(Math.round(p * 14 - dir * j * 1.5), 5, 2, 2, trail[j]);
        break;
      }
      case "done": CHECK.forEach(function (q) { set(q[0], q[1], 4); }); break;
      case "error":
        BROWS.forEach(function (q) { set(q[0], q[1], 2); });
        eyes(0);
        MOUTH.forEach(function (q) { set(q[0], q[1], 3); });
        break;
    }

    // Ореол люминофора вокруг горящих точек.
    var lit = ink.slice();
    for (var gy = 0; gy < SH; gy++) for (var gx = 0; gx < SW; gx++) {
      if (lit[gy * SW + gx]) continue;
      if ((gx > 0 && lit[gy * SW + gx - 1]) || (gx < SW - 1 && lit[gy * SW + gx + 1]) ||
          (gy > 0 && lit[(gy - 1) * SW + gx]) || (gy < SH - 1 && lit[(gy + 1) * SW + gx])) set(gx, gy, 1);
    }

    var data = this.image.data, palette = state === "error" ? RED : GREEN, dim = face.flicker ? 0.55 : 1;
    data.set(body);
    for (var py = 0; py < SH; py++) for (var px = 0; px < SW; px++) {
      if (isCorner(px, py)) continue;
      var c = palette[ink[py * SW + px]], k = ((SY + py) * SIZE + SX + px) * 4;
      data[k] = (c >> 16 & 255) * dim; data[k + 1] = (c >> 8 & 255) * dim; data[k + 2] = (c & 255) * dim;
    }
    this.lowCtx.putImageData(this.image, 0, 0);

    var full = SIZE * this.scale * this.dpr, unit = this.scale * this.dpr;
    this.ctx.clearRect(0, 0, full, full);
    this.ctx.drawImage(this.low, 0, 0, full, full);
    // Строки развёртки — тонкая линия внизу каждой строки экрана, если на
    // неё хватает физических пикселей.
    if (unit >= 4) {
      this.ctx.fillStyle = "rgba(0,0,0,0.32)";
      var line = Math.max(1, Math.round(unit / 4));
      for (var row = 0; row < SH; row++) {
        this.ctx.fillRect(SX * unit, (SY + row + 1) * unit - line, SW * unit, line);
      }
    }
  };

  window.NotaAvatar = NotaAvatar;
})();
