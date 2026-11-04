/* ============================================================
 * 日麻牌面  tiles.js  v1
 * 纯 SVG 生成 34 种日麻牌面（+3 张赤五），零图片、零依赖。
 * 牌 id 与 engine.js 一致：
 *   0-8 萬  9-17 筒  18-26 索  27-33 東南西北白發中  34/35/36 赤五萬/筒/索
 * 用法：
 *   MJTiles.svg(5)        -> '<svg …>' 字符串（牌面图画，牌身由 CSS 负责）
 *   MJTiles.label(5)      -> '六萬'
 * ============================================================ */
(function (global) {
  'use strict';

  var FONT = "'Yu Mincho','YuMincho','Hiragino Mincho ProN','MS Mincho','Songti SC','SimSun','Noto Serif JP','Noto Serif SC',serif";

  var INK   = '#231f19';
  var RED   = '#b0322a';
  var RED2  = '#c4473a';
  var GREEN = '#1a7a4c';
  var GREEN2= '#2b9463';
  var BLUE  = '#1b5a82';
  var PAPER = '#fdf9ee';

  var CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var HONOR_GLYPH = ['東', '南', '西', '北', '白', '發', '中'];
  var SUIT_GLYPH = ['萬', '筒', '索'];

  function n(v) { return Math.round(v * 100) / 100; }

  /* ---------------- 基本画笔 ---------------- */

  // 筒子：外环 + 白圈 + 圆心
  function dot(cx, cy, r, rim, core) {
    return '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '" fill="' + rim + '"/>' +
      '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r * 0.6) + '" fill="' + PAPER + '"/>' +
      '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r * 0.26) + '" fill="' + core + '"/>';
  }

  // 索子：竹节棍（细长、带竹节）
  function stick(cx, cy, w, h, c1, c2) {
    var x = cx - w / 2, y = cy - h / 2, r = w * 0.34;
    var jw = Math.max(1.2, h * 0.035);
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" rx="' + n(r) + '" fill="' + c1 + '"/>' +
      '<rect x="' + n(x + w * 0.16) + '" y="' + n(y + h * 0.06) + '" width="' + n(w * 0.24) + '" height="' + n(h * 0.88) + '" rx="' + n(w * 0.12) + '" fill="' + c2 + '" opacity=".6"/>' +
      '<rect x="' + n(x) + '" y="' + n(y + h * 0.28) + '" width="' + n(w) + '" height="' + n(jw) + '" fill="' + PAPER + '" opacity=".5"/>' +
      '<rect x="' + n(x) + '" y="' + n(y + h * 0.65) + '" width="' + n(w) + '" height="' + n(jw) + '" fill="' + PAPER + '" opacity=".5"/>' +
      '<rect x="' + n(x) + '" y="' + n(y + h * 0.28 + jw) + '" width="' + n(w) + '" height="' + n(Math.max(1, h * 0.022)) + '" fill="#000" opacity=".14"/>' +
      '<rect x="' + n(x) + '" y="' + n(y + h * 0.65 + jw) + '" width="' + n(w) + '" height="' + n(Math.max(1, h * 0.022)) + '" fill="#000" opacity=".14"/>';
  }

  function glyph(ch, size, color, y, x) {
    return '<text x="' + (x || 50) + '" y="' + y + '" text-anchor="middle" ' +
      'font-family="' + FONT + '" font-size="' + size + '" fill="' + color + '" ' +
      'style="font-weight:600">' + ch + '</text>';
  }

  /* ---------------- 萬子 ---------------- */

  function manzu(t, aka) {
    var numColor = aka ? RED : INK;
    var wanColor = aka ? RED : '#a9302a';
    var s = '';
    s += glyph(CN[t], 57, numColor, 63);
    s += glyph('萬', 48, wanColor, 112);
    return s;
  }

  /* ---------------- 筒子 ---------------- */

  var PIN_LAYOUT = {
    1: [[50, 65, 38]],
    2: [[50, 38, 26], [50, 92, 26]],
    3: [[30, 32, 22], [50, 65, 22], [70, 98, 22]],
    4: [[31, 38, 23], [69, 38, 23], [31, 92, 23], [69, 92, 23]],
    5: [[31, 34, 21], [69, 34, 21], [50, 65, 21], [31, 96, 21], [69, 96, 21]],
    6: [[31, 30, 20], [69, 30, 20], [31, 65, 20], [69, 65, 20], [31, 100, 20], [69, 100, 20]],
    7: [[33, 26, 16], [67, 26, 16], [22, 65, 13], [50, 65, 13], [78, 65, 13], [33, 104, 16], [67, 104, 16]],
    8: [[31, 22, 16], [69, 22, 16], [31, 50, 16], [69, 50, 16], [31, 78, 16], [69, 78, 16], [31, 106, 16], [69, 106, 16]],
    9: [[25, 26, 16], [50, 26, 16], [75, 26, 16], [25, 65, 16], [50, 65, 16], [75, 65, 16], [25, 104, 16], [50, 104, 16], [75, 104, 16]]
  };

  function pinzu(t, aka) {
    var n1 = t + 1;
    var rim = aka ? RED2 : BLUE;
    var core = aka ? '#8f241d' : RED;
    if (n1 === 1) {
      // 一筒：同心多重环，牌面标志
      var cx = 50, cy = 65, R = 40;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + (aka ? '#c4473a' : '#1b5a82') + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(R * 0.78) + '" fill="' + PAPER + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(R * 0.6) + '" fill="' + (aka ? '#c4473a' : '#b0322a') + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(R * 0.4) + '" fill="' + PAPER + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(R * 0.18) + '" fill="' + (aka ? '#c4473a' : '#1b5a82') + '"/>';
    }
    var out = '';
    PIN_LAYOUT[n1].forEach(function (p) { out += dot(p[0], p[1], p[2], rim, core); });
    return out;
  }

  /* ---------------- 索子 ---------------- */

  var SOU_LAYOUT = {
    2: [[36, 65, 19, 92], [64, 65, 19, 92]],
    3: [[50, 30, 19, 48], [31, 97, 19, 48], [69, 97, 19, 48]],
    4: [[34, 38, 19, 50], [66, 38, 19, 50], [34, 92, 19, 50], [66, 92, 19, 50]],
    5: [[31, 34, 18, 46], [69, 34, 18, 46], [50, 65, 18, 46, 1], [31, 96, 18, 46], [69, 96, 18, 46]],
    6: [[34, 27, 17, 36], [66, 27, 17, 36], [34, 65, 17, 36], [66, 65, 17, 36], [34, 103, 17, 36], [66, 103, 17, 36]],
    7: [[50, 19, 15, 28, 1], [34, 54, 15, 24], [66, 54, 15, 24], [34, 79, 15, 24], [66, 79, 15, 24], [34, 104, 15, 24], [66, 104, 15, 24]],
    8: [[34, 21, 15, 28], [66, 21, 15, 28], [34, 49, 15, 28], [66, 49, 15, 28], [34, 77, 15, 28], [66, 77, 15, 28], [34, 105, 15, 28], [66, 105, 15, 28]],
    9: [[26, 26, 16, 36], [50, 26, 16, 36], [74, 26, 16, 36], [26, 65, 16, 36], [50, 65, 16, 36], [74, 65, 16, 36], [26, 104, 16, 36], [50, 104, 16, 36], [74, 104, 16, 36]]
  };

  function bird(aka) {
    var bodyC = aka ? '#b0322a' : GREEN;
    var bodyD = aka ? '#8f241d' : '#125c39';
    var wingC = aka ? '#8f241d' : '#125c39';
    return '<g>' +
      '<path d="M32 80 C 18 92, 12 108, 17 120" fill="none" stroke="' + bodyC + '" stroke-width="5.4" stroke-linecap="round"/>' +
      '<path d="M36 84 C 25 98, 24 112, 31 122" fill="none" stroke="' + bodyD + '" stroke-width="4.6" stroke-linecap="round"/>' +
      '<path d="M28 76 C 20 86, 15 96, 16 106" fill="none" stroke="' + bodyC + '" stroke-width="3.4" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M24 72 C 15 80, 9 90, 8 100" fill="none" stroke="' + bodyD + '" stroke-width="3" stroke-linecap="round" opacity=".55"/>' +
      '<ellipse cx="52" cy="72" rx="22" ry="17.5" fill="' + bodyC + '" transform="rotate(-16 52 72)"/>' +
      '<path d="M45 60 C 58 63, 65 74, 57 86 C 46 82, 39 70, 45 60 Z" fill="' + wingC + '"/>' +
      '<circle cx="69" cy="45" r="12.5" fill="' + bodyC + '"/>' +
      '<path d="M79 42 L 95 49 L 79 55 Z" fill="#c4473a"/>' +
      '<path d="M63 33 C 64 25, 70 21, 77 23" fill="none" stroke="#c4473a" stroke-width="3.6" stroke-linecap="round"/>' +
      '<circle cx="72" cy="42" r="3.4" fill="' + PAPER + '"/><circle cx="72.6" cy="42" r="1.7" fill="' + INK + '"/>' +
      '<path d="M53 88 L 51 101 M53 88 L 58 101" fill="none" stroke="#c4473a" stroke-width="2.6" stroke-linecap="round"/>' +
      '</g>';
  }

  function souzu(t, aka) {
    var n1 = t + 1;
    if (n1 === 1) return bird(aka);
    var c1 = aka ? RED : GREEN;
    var c2 = aka ? RED2 : GREEN2;
    var out = '';
    SOU_LAYOUT[n1].forEach(function (p) {
      var red = p[4] === 1 && !aka;
      out += stick(p[0], p[1], p[2], p[3], red ? RED : c1, red ? RED2 : c2);
    });
    return out;
  }

  /* ---------------- 字牌 ---------------- */

  function honor(t, aka) {
    if (t === 4) {
      // 白：留白 + 极淡双框
      return '<rect x="15" y="13" width="70" height="104" rx="8" fill="none" stroke="#b9a982" stroke-width="2.6" opacity=".9"/>' +
             '<rect x="24" y="22" width="52" height="86" rx="4" fill="none" stroke="#c3b48f" stroke-width="1.6" opacity=".7"/>';
    }
    var color = t === 5 ? GREEN : t === 6 ? RED : INK;
    if (aka) color = RED;
    return glyph(HONOR_GLYPH[t], 74, color, 100);
  }

  /* ---------------- 组装 ---------------- */

  function baseOf(id) {
    if (id === 34) return 4;
    if (id === 35) return 13;
    if (id === 36) return 22;
    return id;
  }

  function art(id) {
    var t = baseOf(id), aka = id >= 34;
    if (t < 9) return manzu(t, aka);
    if (t < 18) return pinzu(t - 9, aka);
    if (t < 27) return souzu(t - 18, aka);
    return honor(t - 27, aka);
  }

  function svg(id, cls) {
    return '<svg class="face' + (cls ? ' ' + cls : '') + '" viewBox="0 0 100 130" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + art(id) + '</svg>';
  }

  function label(id) {
    var t = baseOf(id);
    if (id >= 34) return '赤' + label(t);
    if (t >= 27) return HONOR_GLYPH[t - 27];
    return CN[t % 9] + SUIT_GLYPH[Math.floor(t / 9)];
  }

  global.MJTiles = { svg: svg, art: art, label: label, baseOf: baseOf };
})(typeof window !== 'undefined' ? window : this);