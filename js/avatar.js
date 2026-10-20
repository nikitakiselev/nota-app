// Nota — аватар для лендинга.
// Та же картинка, что в приложении: тело — кадры 3D-рендера и карты экрана
// из Resources/Avatar (Scripts/avatar/render.py в nota-macos), сборка кадра —
// AvatarFrame.swift, рисунки экрана — AvatarScreen.swift и
// AvatarReactionScreen.swift. Голос здесь имитируется: микрофон странице не нужен.

(function () {
  "use strict";

  // Кадр тела в пикселях: окно 92×112 pt на Retina.
  var W = 184, H = 224, FPS = 24;
  var SW = 16, SH = 12; // экран
  var BASE = "assets/avatar/";
  // Клип тела у реакции — AvatarReaction.bodyClip.
  var CLIPS = { copied: "jump", dizzy: "spin", hum: "dance" };
  // Мерцание приглушает экран, строка развёртки гасит его — AvatarFrame.
  var FLICKER = 0.55, SCANLINE = 0.68;
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

  // Экран 16×12: накал каждой точки. Фигуры записаны строками, как карта
  // корпуса: «.» пусто, «+» dim, «#» core, «@» bright.
  var INK_OF = { "+": 2, "#": 3, "@": 4 };
  function Ink() { this.v = new Uint8Array(SW * SH); }
  Ink.prototype.set = function (x, y, v) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= SW || y >= SH || isCorner(x, y)) return;
    this.v[y * SW + x] = v;
  };
  Ink.prototype.rect = function (x, y, w, h, v) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, v);
  };
  Ink.prototype.glyph = function (rows, x, y) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var v = INK_OF[rows[j][i]];
      if (v) this.set(x + i, y + j, v);
    }
  };
  // Глаза 2×2; open: 2 открыт, 1 прикрыт, 0 закрыт — прикрытый и закрытый одна строка.
  Ink.prototype.eye = function (left, open, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    if (open === 2) { this.rect(left + dx, 4 + dy, 2, 1, 4); this.rect(left + dx, 5 + dy, 2, 1, 3); }
    else this.rect(left + dx, 5 + dy, 2, 1, 3);
  };
  Ink.prototype.eyes = function (open, dx, dy) { this.eye(3, open, dx, dy); this.eye(11, open, dx, dy); };
  Ink.prototype.shift = function (dx) {
    var src = this.v.slice();
    this.v = new Uint8Array(SW * SH);
    for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) if (src[y * SW + x]) this.set(x + dx, y, src[y * SW + x]);
  };
  Ink.prototype.shiftRow = function (y, dx) {
    var row = this.v.slice(y * SW, y * SW + SW);
    for (var x = 0; x < SW; x++) this.v[y * SW + x] = 0;
    for (x = 0; x < SW; x++) if (row[x]) this.set(x + dx, y, row[x]);
  };
  Ink.prototype.noise = function (frame, density, inks) {
    for (var i = 0; i < SW * SH; i++) {
      if (hash(frame * 1013 + i) < density) this.set(i % SW, Math.floor(i / SW), inks[Math.floor(hash(frame * 7919 + i * 31 + 5) * inks.length)]);
    }
  };
  // Ореол люминофора вокруг горящих точек.
  Ink.prototype.glow = function () {
    var lit = this.v.slice();
    for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) {
      if (lit[y * SW + x]) continue;
      if ((x > 0 && lit[y * SW + x - 1]) || (x < SW - 1 && lit[y * SW + x + 1]) ||
          (y > 0 && lit[(y - 1) * SW + x]) || (y < SH - 1 && lit[(y + 1) * SW + x])) this.set(x, y, 1);
    }
  };

  function hash(n) {
    var x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  function step(t, dt) { return Math.floor(t / dt); }
  function jitter(t, dt) { return step(t, dt) % 2 ? 1 : -1; }
  function g(s) { return s.split(" "); }

  var EYE_ARC = g(".@@. @..@"), EYE_ARC_S = g(".@. @.@");
  var SQUINT_L = g("#.. .#. ..@ .#. #.."), SQUINT_R = g("..# .#. @.. .#. ..#");
  var RING = g(".@@. #..# #..# .++."), BIG = g(".@@. @@## #### .++.");
  var SMILE = g("#..# .##."), GRIN = g("#....# .####."), MOUTH_O = g(".##. #..# .##.");
  var MOUTH_OPEN = g("@@@@@@ .####."), FROWN = g(".##. #..#");
  var WAVY_A = g("+.+.+. .+.+.+"), WAVY_B = g(".+.+.+ +.+.+.");
  // Листок 7×8, как значок «Скопировать последнее» в меню.
  var SHEET = g("@@@@@@@ @.....@ @.....@ @.....@ @.....@ @.....@ @.....@ @@@@@@@");
  var SHEET_CORE = SHEET.map(function (r) { return r.replace(/@/g, "#"); });
  var SHEET_DIM = SHEET.map(function (r) { return r.replace(/@/g, "+"); });
  var ZED = g("### ..# .#. ###"), ZED_DIM = g("+++ ..+ .+. +++");
  var NOTE = g(".@@ .#. ##. ##."), NOTE_DIM = g(".++ .+. ++. ++.");
  var BLUSH = g(".+.+ +.+.");
  var ORBIT = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

  // Реакции — рисунки и длительности из AvatarReactionScreen.swift. dur у тех,
  // что в приложении держатся (пока тащат, пока спит), — сколько их показывать
  // по кнопке; peak — кадр без анимации для prefers-reduced-motion.
  var REACTIONS = {
    wink: { dur: 1.0, peak: 0.4, draw: function (S, t) {
      S.eye(3, 2);
      if (t < 0.06 || (t >= 0.7 && t < 0.78)) S.eye(11, 1);
      else if (t < 0.7) S.glyph(EYE_ARC, 10, 4);
      else S.eye(11, 2);
      if (t >= 0.06 && t < 0.85) S.glyph(SMILE, 6, 8);
      else if (t >= 0.85) S.glyph(g("+..+ .++."), 6, 8);
    } },
    smile: { dur: 1.6, peak: 0.6, draw: function (S, t) {
      if (t < 0.08 || (t >= 1.4 && t < 1.48)) return S.eyes(1);
      if (t >= 1.48) return S.eyes(2);
      S.glyph(EYE_ARC, 2, 4); S.glyph(EYE_ARC, 10, 4);
      if (t < 0.16) S.glyph(SMILE, 6, 8); else S.glyph(GRIN, 5, 8);
    } },
    stars: { dur: 1.6, peak: 0.2, draw: function (S, t) {
      if (t >= 1.4) return S.eyes(t < 1.48 ? 1 : 2);
      var big = step(t, 0.15) % 2 === 0;
      [4, 11].forEach(function (cx) {
        S.set(cx, 4, 4);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          S.set(cx + d[0], 4 + d[1], 3);
          if (big) S.set(cx + 2 * d[0], 4 + 2 * d[1], 2);
        });
        if (!big) [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) { S.set(cx + d[0], 4 + d[1], 2); });
      });
      S.glyph(g("@@@@ .##."), 6, 8);
    } },
    // Двойной клик скопировал последнюю диктовку: копия выезжает из-под листка.
    copied: { dur: 1.5, peak: 0.8, draw: function (S, t) {
      if (t >= 1.3) return S.eyes(t < 1.38 ? 1 : 2);
      var u = Math.min(1, t / 0.3), dx = Math.round(3 * (1 - u)), dy = Math.round(2 * (1 - u));
      S.glyph(SHEET_CORE, 6, 1);
      S.rect(4 + dx, 4 - dy, 5, 6, 0);
      S.glyph(SHEET, 3 + dx, 3 - dy);
    } },
    // Копировать нечего: пустой листок мигает дважды.
    empty: { dur: 1.0, peak: 0.1, draw: function (S, t) {
      if (t >= 0.8) return S.eyes(t < 0.88 ? 1 : 2);
      if (t % 0.4 < 0.25) S.glyph(SHEET_DIM, 4, 2);
    } },
    scared: { dur: 1.8, peak: 0.6, draw: function (S, t) {
      if (t < 0.06) return S.eyes(2, 0, -1);
      S.glyph(RING, 2, 3); S.glyph(RING, 10, 3);
      var p = Math.floor(hash(step(t, 0.22) + 17) * 4);
      S.set(3 + p % 2, 4 + (p >> 1), 4); S.set(11 + p % 2, 4 + (p >> 1), 4);
      S.glyph(MOUTH_O, 6, 8);
    } },
    wheee: { dur: 1.8, peak: 0.5, draw: function (S, t) {
      [[1, 0], [2, 11], [10, 5]].forEach(function (l) {
        var x = 15 - Math.floor((t * 26 + l[1]) % 22);
        S.set(x, l[0], 3); S.rect(x + 1, l[0], 3, 1, 2);
      });
      S.glyph(EYE_ARC, 2, 4); S.glyph(EYE_ARC, 10, 4); S.glyph(MOUTH_OPEN, 5, 8);
    } },
    glitch: { dur: 0.9, peak: 0.25, draw: function (S, t) {
      if (t < 0.12) { S.eyes(2); S.shiftRow(4, 3); S.shiftRow(5, -2); return; }
      if (t < 0.45) { S.noise(step(t, 0.04), 0.35, [1, 2, 2, 3]); S.rect(0, step(t - 0.12, 0.03) % SH, SW, 1, 4); return; }
      if (t < 0.55) return S.rect(0, 5, SW, 2, 3);
      S.eyes(2);
    }, flicker: function (t) { return t >= 0.6 && t < 0.66; } },
    dizzy: { dur: 2.2, peak: 0.5, draw: function (S, t) {
      if (t >= 2.0) return S.eyes(t < 2.08 ? 1 : 2);
      var s = Math.floor(16 * t - 3 * t * t);
      [[4, 1], [11, -1]].forEach(function (c) {
        ORBIT.forEach(function (d) { S.set(c[0] + d[0], 4 + d[1], 2); });
        for (var k = 2; k >= 0; k--) {
          var d = ORBIT[((c[1] * (s - k)) % 8 + 8) % 8];
          S.set(c[0] + d[0], 4 + d[1], k === 0 ? 4 : 3);
        }
      });
      S.glyph(step(t, 0.2) % 2 ? WAVY_A : WAVY_B, 5, 8);
    } },
    relief: { dur: 1.4, peak: 0.4, draw: function (S, t) {
      S.eyes(t < 0.6 ? 0 : t < 0.68 ? 1 : 2);
      if (t >= 0.1 && t < 0.6) S.glyph(g(".#. #.# .#."), 6, 8);
      if (t >= 0.2 && t < 0.9) {
        var u = (t - 0.2) / 0.7, x = 10 + Math.round(u * 4), y = 9 - Math.round(u * 3), v = u < 0.5 ? 2 : 1;
        S.set(x, y, v); S.set(x + 1, y, v); S.set(x, y - 1, v);
      }
      if (t >= 0.75 && t < 1.3) S.glyph(SMILE, 6, 8);
    } },
    squint: { dur: 2.0, peak: 0.8, draw: function (S, t, face) {
      if (t < 0.15 || t >= 1.85) return S.eyes(face.open);
      var dx = t < 1.15 ? -1 : t < 1.45 ? 1 : -1;
      S.rect(2 + dx, 4, 4, 1, 2); S.rect(3 + dx, 5, 2, 1, 3);
      S.eye(11, 2, dx); S.glyph(g(".++. +..+"), 10 + dx, 1);
      S.rect(8, 9, 3, 1, 2);
    } },
    annoyed: { dur: 2.0, peak: 1.2, draw: function (S, t) {
      if (t < 0.08 || (t >= 1.9 && t < 1.98)) return S.eyes(1);
      if (t >= 1.98) return S.eyes(2);
      var dx = t < 0.6 ? 0 : -1, dy = t >= 1.0 && t < 1.5 ? 1 : 0;
      S.rect(2 + dx, 5 + dy, 4, 1, 3); S.rect(10 + dx, 5 + dy, 4, 1, 3);
      S.rect(6 + dx, 9 + dy, 4, 1, 2);
      if (t >= 0.6) { S.set(14, 1, 2); S.set(14, 2, 3); }
    } },
    angry: { dur: 1.8, peak: 0.3, draw: function (S, t) {
      if (t >= 1.6) return S.eyes(t < 1.68 ? 1 : 2);
      S.glyph(g("##.. ..##"), 2, 2); S.glyph(g("..## ##.."), 10, 2);
      S.rect(3, 4, 2, 2, 3); S.rect(11, 4, 2, 2, 3);
      S.glyph(FROWN, 6, 8);
      if (t > 0.4 && t < 0.9) S.shift(jitter(t, 0.04));
    } },
    shy: { dur: 1.8, peak: 0.3, draw: function (S, t) {
      if (t >= 1.6) return S.eyes(t < 1.68 ? 1 : 2);
      var nervous = (t > 0.5 && t < 0.58) || (t > 0.7 && t < 0.78);
      S.eyes(nervous ? 1 : 2, -2, 1);
      S.glyph(BLUSH, 1, 8); S.glyph(BLUSH, 9, 8);
      S.rect(5, 10, 2, 1, 2);
    } },
    yawn: { dur: 2.4, peak: 1.0, draw: function (S, t) {
      var dy = t >= 0.5 && t < 1.4 ? -1 : 0, open = 2;
      if (t >= 0.3 && t < 1.7) open = 0;
      else if ((t >= 1.95 && t < 2.03) || (t >= 2.13 && t < 2.21)) open = 1;
      S.eyes(open, 0, dy);
      if ((t >= 0.2 && t < 0.5) || (t >= 1.4 && t < 1.6)) S.glyph(MOUTH_O, 6, 8);
      else if (t >= 0.5 && t < 1.4) S.glyph(g(".####. #....# #....# .####."), 5, 7 + dy);
    } },
    hum: { dur: 3.0, peak: 0.7, draw: function (S, t) {
      [0.2, 1.3].forEach(function (start) {
        if (t < start || t > start + 1.4) return;
        var u = (t - start) / 1.4;
        S.glyph(u < 0.6 ? NOTE : NOTE_DIM, 13, 8 - Math.round(u * 8));
      });
      if (t >= 2.7) return S.eyes(t < 2.78 ? 1 : 2);
      var dx = step(t, 0.4) % 2 ? 0 : -1;
      S.glyph(EYE_ARC_S, 2 + dx, 4); S.glyph(EYE_ARC_S, 10 + dx, 4);
      S.glyph(step(t, 0.2) % 2 ? SMILE : g(".##. .##."), 5 + dx, 8);
    } },
    sneeze: { dur: 2.0, peak: 1.05, draw: function (S, t) {
      if (t < 0.9) {
        S.eyes(t < 0.6 ? 2 : 1, 0, t < 0.3 ? 0 : -1);
        if (t >= 0.6) S.glyph(MOUTH_O, 6, 7); else if (t >= 0.3) S.rect(7, 8, 2, 1, 3);
        return;
      }
      if (t < 1.0) { S.glyph(SQUINT_L, 2, 1); S.glyph(SQUINT_R, 11, 1); return; }
      if (t < 1.15) return S.noise(step(t, 0.03), 0.45, [2, 3, 4]);
      S.eyes(t < 1.6 || (t >= 1.75 && t < 1.83) ? 0 : 2);
      if (t < 1.6) S.rect(7, 9, 2, 1, 2);
    }, body: function (t) { return t >= 1.0 && t < 1.15 ? [-1, 2] : t >= 1.15 && t < 1.25 ? [0, 1] : [0, 0]; } },
    sleep: { dur: 3.4, peak: 1.6, wakes: true, draw: function (S, t) {
      var dy = t < 0.3 ? 0 : t < 0.6 ? 1 : 2, dx = t < 0.6 ? 0 : -2;
      var breath = t < 0.6 || step(t - 0.6, 1.2) % 2 ? 3 : 2;
      S.rect(3 + dx, 5 + dy, 2, 1, breath); S.rect(11 + dx, 5 + dy, 2, 1, breath);
      if (t < 0.6) return;
      S.rect(5, 10, 2, 1, 2);
      var u = ((t - 0.6) % 1.4) / 1.4;
      S.glyph(u < 0.6 ? ZED : ZED_DIM, 12, 3 - Math.round(u * 3));
    } },
    // Пробуждение: глаза на миг распахиваются.
    wake: { dur: 0.4, peak: 0.05, draw: function (S, t) {
      if (t < 0.15) { S.glyph(BIG, 2, 3); S.glyph(BIG, 10, 3); } else S.eyes(2, 0, t < 0.25 ? -1 : 0);
    } },
    powerOn: { dur: 1.3, peak: 0.3, draw: function (S, t) {
      if (t < 0.15) return;
      if (t < 0.35) { var w = 1 + Math.round((t - 0.15) / 0.2 * 7); return S.rect(8 - w, 5, 2 * w, 2, 4); }
      if (t < 0.5) { var h = 1 + Math.round((t - 0.35) / 0.15 * 5); S.rect(0, 6 - h, SW, 2 * h, 3); return S.rect(0, 5, SW, 2, 4); }
      if (t < 0.65) return S.rect(0, 0, SW, SH, t < 0.57 ? 2 : 1);
      if (t < 0.8) { S.rect(3, 5, 2, 1, 2); return S.rect(11, 5, 2, 1, 2); }
      S.eyes(t < 0.88 || (t >= 1.1 && t < 1.16) ? 1 : 2);
    } },
    powerOff: { dur: 1.0, peak: 0.45, draw: function (S, t) {
      if (t < 0.1) return S.eyes(2);
      if (t < 0.2) { S.rect(0, 0, SW, SH, 3); return S.rect(0, 4, SW, 4, 4); }
      if (t < 0.4) { var h = Math.max(1, Math.round(6 * (1 - (t - 0.2) / 0.2))); return S.rect(0, 6 - h, SW, 2 * h, 4); }
      if (t < 0.6) { var w = Math.max(1, Math.round(8 * (1 - (t - 0.4) / 0.2))); return S.rect(8 - w, 5, 2 * w, 2, 4); }
      if (t < 0.85) { var u = (t - 0.6) / 0.25; S.rect(7, 5, 2, 2, u < 0.33 ? 4 : u < 0.66 ? 3 : 2); }
    } }
  };

  // Тело: лист кадров подряд слева направо и карта экрана к каждому кадру.
  // Покой нужен сразу, клипы — по требованию: вместе они весят ~4 МБ.
  var manifest = null, sheets = {};

  function fetchOk(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ": " + r.status);
      return r;
    });
  }

  // Лист в RGBA без премультипликации, как его отдаёт canvas.
  function pixelsOf(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        var ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, c.width, c.height));
      };
      img.onerror = function () { reject(new Error(url + ": не разобрать картинку")); };
      img.src = url;
    });
  }

  // Карта экрана: на кадр UInt32 — число записей, затем записи по 5 байт
  // (UInt16 пиксель, точка, покрытие, строка развёртки), little-endian.
  function parseMaps(buffer, frames, name) {
    var view = new DataView(buffer), offset = 0, maps = [];
    for (var f = 0; f < frames; f++) {
      if (offset + 4 > buffer.byteLength) throw new Error(name + ": обрывается на кадре " + f);
      var count = view.getUint32(offset, true);
      offset += 4;
      if (offset + count * 5 > buffer.byteLength) throw new Error(name + ": обрывается на кадре " + f);
      maps.push(new Uint8Array(buffer, offset, count * 5));
      offset += count * 5;
    }
    if (offset !== buffer.byteLength) throw new Error(name + ": лишние байты после " + frames + " кадров");
    return maps;
  }

  function loadSheet(name) {
    if (!manifest) manifest = fetchOk(BASE + "manifest.json").then(function (r) { return r.json(); });
    if (!sheets[name]) {
      sheets[name] = manifest.then(function (m) {
        var entry = name === "rest" ? m.rest : m.clips[name];
        return Promise.all([
          pixelsOf(BASE + entry.sheet),
          fetchOk(BASE + entry.screen).then(function (r) { return r.arrayBuffer(); })
        ]).then(function (got) {
          if (got[0].width !== W * entry.frames || got[0].height !== H) {
            throw new Error(entry.sheet + ": лист " + got[0].width + "×" + got[0].height + ", ждём " + entry.frames + " кадров");
          }
          return { name: name, frames: entry.frames, pixels: got[0], maps: parseMaps(got[1], entry.frames, entry.screen) };
        });
      });
      // Тело не загрузилось — лицо на экране всё равно живёт, а причина видна в консоли.
      sheets[name].catch(function (error) { console.error("Nota: тело аватара —", error); });
    }
    return sheets[name];
  }

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
    // Реакция поверх ожидания: { id, start, hold }.
    this.reaction = null;

    // Клип тела, который сейчас играет: { sheet, start }.
    this.body = null;
    this.clips = {};

    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext("2d");
    this.image = this.ctx.createImageData(W, H);
    this.resize();

    var self = this;
    loadSheet("rest").then(function (sheet) {
      self.rest = sheet;
      if (reduceMotion || !self.running) self.draw();
    });
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

  // Холст — ровно кадр тела, размер на странице задаёт вёрстка. Строки
  // развёртки — только когда на пиксель кадра приходится хотя бы пиксель
  // экрана: уменьшенная линия в четверть строки стала бы серой рябью.
  NotaAvatar.prototype.resize = function () {
    this.scanlines = (this.canvas.clientWidth || W) * (window.devicePixelRatio || 1) >= W - 0.5;
  };

  // Клипы реакций догружаются заранее, когда до демо недалеко.
  NotaAvatar.prototype.preload = function () {
    var self = this;
    Object.keys(CLIPS).forEach(function (id) {
      var name = CLIPS[id];
      loadSheet(name).then(function (sheet) { self.clips[name] = sheet; });
    });
  };

  NotaAvatar.prototype.setState = function (state) {
    if (state !== this.state) {
      this.state = state;
      this.since = this.now();
      // Смена состояния возвращает тело в покой одним кадром — AvatarReactionPlayer.
      this.body = null;
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

  // Реакция на мышь или простой. hold — держится, пока не вызовут release()
  // (перетаскивание, сон); иначе идёт свою длительность.
  NotaAvatar.prototype.react = function (id, hold) {
    var t = this.now();
    this.reaction = { id: id, start: t, hold: !!hold };
    // Держится, но не сон — значит, начали тащить: тело сразу в покой.
    if (hold && !REACTIONS[id].wakes) this.body = null;
    var clip = CLIPS[id];
    if (clip && !reduceMotion && this.bodyFrame(t) === null) {
      var sheet = this.clips[clip];
      // Клип ещё грузится — лицо реагирует сразу, а тело в этот раз стоит.
      if (sheet) this.body = { sheet: sheet, start: t };
      else this.preload();
    }
    if (reduceMotion) this.draw();
  };

  // Кадр клипа или null, если тело в покое. Допуск — от ошибок плавающей
  // точки, как в AvatarBodyMotion.
  NotaAvatar.prototype.bodyFrame = function (t) {
    var b = this.body;
    if (!b) return null;
    var frame = Math.floor((t - b.start) * FPS + 1e-6);
    if (frame >= b.sheet.frames) { this.body = null; return null; }
    return Math.max(0, frame);
  };

  // Отпустили или разбудили: держащаяся реакция кончается, спящий просыпается.
  NotaAvatar.prototype.release = function () {
    var r = this.reaction;
    if (!r || !r.hold) return;
    this.reaction = REACTIONS[r.id].wakes ? { id: "wake", start: this.now(), hold: false } : null;
    if (reduceMotion) this.draw();
  };

  NotaAvatar.prototype.isPlaying = function () { return this.reaction !== null; };
  NotaAvatar.prototype.isAsleep = function () { return !!this.reaction && this.reaction.id === "sleep"; };

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

    var S = new Ink();
    function set(x, y, v) { S.set(x, y, v); }
    function rect(x, y, w, h, v) { S.rect(x, y, w, h, v); }
    function eyes(shift) { S.eyes(face.open, shift); }

    // Реакция кончилась по времени: держащиеся (перетаскивание, сон) ждут release().
    var r = this.reaction, reaction = null, rt = 0;
    if (r) {
      rt = reduceMotion ? REACTIONS[r.id].peak : t - r.start;
      if (!r.hold && rt >= REACTIONS[r.id].dur) {
        this.reaction = REACTIONS[r.id].wakes ? { id: "wake", start: t, hold: false } : null;
        r = this.reaction; rt = 0;
      }
      if (r) reaction = REACTIONS[r.id];
    }

    if (reaction) reaction.draw(S, rt, face);
    else switch (state) {
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

    S.glow();
    var ink = S.v;

    // Реакция всегда зелёная и без мерцания ожидания: своё мерцание есть только у помех.
    var palette = !reaction && state === "error" ? RED : GREEN;
    var flicker = reaction ? !!(reaction.flicker && reaction.flicker(rt)) : face.flicker;
    if (!this.rest) return;
    var frame = this.bodyFrame(t);
    var sheet = frame === null ? this.rest : this.body.sheet;
    compose(this.image.data, sheet, frame || 0, ink, palette, flicker ? FLICKER : 1, this.scanlines);
    this.ctx.putImageData(this.image, 0, 0);

    // Рывок корпуса при чихе: в приложении сдвигается окно на 2 pt за точку, здесь — холст.
    var off = reaction && reaction.body ? reaction.body(rt) : [0, 0];
    var key = off[0] + "," + off[1];
    if (key !== this.bodyKey) {
      this.bodyKey = key;
      var unit = 2 * this.canvas.clientWidth / (W / 2);
      this.canvas.style.transform = off[0] || off[1] ? "translate(" + off[0] * unit + "px," + off[1] * unit + "px)" : "";
    }
  };

  function scaled(value, factor) { return Math.round(value * factor); }

  // Кадр тела и поверх него экран — AvatarFrame.pixels. Тело отрендерено с
  // погасшим экраном: свечение каждой точки складывается со стеклом по карте
  // кадра, поэтому блик виден и на тёмных точках, а экран поворачивается
  // вместе с телом. Складывается с премультипликацией, как в приложении;
  // canvas хранит цвет без неё, поэтому пиксель экрана туда и обратно.
  function compose(out, sheet, frame, ink, palette, dim, scanlines) {
    var src = sheet.pixels.data, rowFrom = sheet.pixels.width * 4, row = W * 4;
    for (var y = 0; y < H; y++) {
      var from = y * rowFrom + frame * row;
      out.set(src.subarray(from, from + row), y * row);
    }
    var lights = palette.map(function (c) {
      return [scaled(c >> 16 & 255, dim), scaled(c >> 8 & 255, dim), scaled(c & 255, dim)];
    });
    var map = sheet.maps[frame];
    for (var k = 0; k < map.length; k += 5) {
      var dot = map[k + 2];
      if (isCorner(dot % SW, Math.floor(dot / SW))) continue;
      var i = (map[k] | map[k + 1] << 8) * 4, cover = map[k + 3], scan = map[k + 4], a = out[i + 3];
      if (!a) continue;
      var light = lights[ink[dot]];
      var factor = scanlines && scan ? 1 - (1 - SCANLINE) * (scan / 255) * (cover / 255) : 1;
      for (var ch = 0; ch < 3; ch++) {
        var p = Math.round(out[i + ch] * a / 255);
        // Свет не выходит за альфу: иначе край экрана светился бы ярче самого себя.
        p = Math.min(a, p + Math.floor((light[ch] * cover + 127) / 255));
        if (factor !== 1) p = scaled(p, factor);
        out[i + ch] = Math.min(255, Math.round(p * 255 / a));
      }
    }
  }

  window.NotaAvatar = NotaAvatar;
})();
