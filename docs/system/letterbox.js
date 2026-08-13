/* letterbox.js -- the colophon at the foot of the system page.
 *
 * Ported from wordmark.nyc (wordmark/js/letterbox.js): the same engine -- scan the
 * word at display size, slice it into LINE_H rows, walk each ink span filling it with
 * prose until the next glyph will not fit. Reduced here to the one-line footer case
 * and rewired to this page's tokens. Four deliberate differences:
 *
 *   -- ONE canvas, not two. The two-layer split on wordmark.nyc exists so work images
 *      can sit BETWEEN the layers, hiding the full-ink back copy so only the fading
 *      front copy shows over the image. Nothing sits between them here, so the split
 *      would buy an extra canvas and no effect.
 *   -- The speckle is 1/6 of the glyphs and fades ink -> --signal, rather than 1/3
 *      fading in and out. Colour is computed per glyph and painted once; drawing the
 *      same glyph twice to blend it would accumulate antialiasing and fatten it, which
 *      is visible at 10px.
 *   -- Axes: SHRP only. The hero config animates 'wdth', and CalSansVF has no such
 *      axis (fvar reads opsz, GEOM, wght, YTAS, SHRP, ital), so that half of the
 *      animation was moving nothing. SHRP is also the safe one to spend: it is not one
 *      of the six signals, where GEOM and wght are.
 *   -- Colours come from --ink / --bg / --signal, so it follows the page's theme.
 *
 * Fill text: Jerome K. Jerome, "Three Men in a Boat" (1889), public domain.
 */
var LB_CONFIG = {
  words:           ['WORDMARK'],
  largeFontFamily: '"Face", "CalSansVF", -apple-system, sans-serif',
  largeWeight:     700,
  fillFontFamily:  '"Face", "CalSansVF", -apple-system, sans-serif',
  fillWeight:      400,
  fillSize:        10,
  widthFraction:   0.98,
  verticalPad:     0,
  wordGap:         0,
  axes: [
    { tag: 'SHRP', min: 0, max: 100, speed: 8, mult: 0.9 }
  ],
  maxWidth:       Infinity,
  heroHeightFrac: 0,
  topPadVh:       0,      // the gap above is .wm-lb's margin; the canvas is the letters
  extraTopPad:    0,
  extraBottomPad: 0,
  minFillSize:    6,
  // Read from --lb-bleed at init: the canvas grows by this much at the top so
  // repelled glyphs are not cut off by the raster edge, and the CSS takes the same
  // amount back out of the layout. One value, declared once, in the stylesheet.
  bleedTop:       260
};

(function () {
  'use strict';

  var canvasEl = document.getElementById('lb-footer');
  if (!canvasEl) return;

  var isMouseDown = false;
  window.addEventListener('mousedown', function () { isMouseDown = true; });
  window.addEventListener('mouseup',   function () { isMouseDown = false; });

  var POOL = "I do think that of all the silly irritating tomfoolishness by which we are plagued this weather forecast fraud is about the most aggravating It forecasts precisely what happened yesterday or the day before and precisely the opposite of what is going to happen to day I remember a holiday of mine being completely ruined one late autumn by our paying attention to the weather report of the local newspaper Heavy showers with thunderstorms may be expected to day it would say on Monday and so we would give up our picnic and stop indoors all day waiting for the rain And people would pass the house going off in wagonettes and coaches as jolly and merry as could be the sun shining out and not a cloud to be seen".repeat(6);

  var CFG = LB_CONFIG;
  var ctx = canvasEl.getContext('2d');

  /* ---- colour ------------------------------------------------------------- */
  function parseRGB(str, fallback) {
    str = (str || '').trim();
    if (str.charAt(0) === '#') {
      var h = str.slice(1);
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      var n = parseInt(h, 16);
      if (!isNaN(n) && h.length === 6) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = str.match(/(\d+(?:\.\d+)?)/g);
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
    return fallback;
  }

  function getThemeColours() {
    var s = getComputedStyle(document.documentElement);
    return {
      ink:    parseRGB(s.getPropertyValue('--ink'),    [232, 232, 232]),
      signal: parseRGB(s.getPropertyValue('--signal'), [238, 255, 65])
    };
  }

  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

  function buildFVS(axisValues) {
    if (!axisValues || !axisValues.length) return 'normal';
    return axisValues.map(function (a) {
      return '"' + a.tag + '" ' + a.value.toFixed(2);
    }).join(', ');
  }

  /* The speckle: a seeded sixth of the glyphs ride a phase group, fading between ink
     and the signal hue. Seeded rather than random so a resize rebuilds the same set --
     the pattern is a property of the wordmark, not of when you loaded the page. */
  var ACID_SHARE   = 1 / 6;
  var ACID_GROUPS  = 5;        // phase groups, so they do not pulse in unison
  var ACID_SPEED   = 0.0016;   // rad/ms -- about a 4s cycle
  function seededFrac(i, salt) {
    var x = Math.sin(i * 127.1 + 311.7 + salt) * 43758.5453;
    return x - Math.floor(x);
  }

  var BLEED   = CFG.bleedTop;
  var FILL_SZ = CFG.fillSize;
  var LINE_H  = Math.ceil(1.3 * FILL_SZ);

  /* ---- scanWord ----------------------------------------------------------- */
  function scanWord(word, fontSize, SCAN_SZ) {
    var oc = document.createElement('canvas');
    oc.width = oc.height = SCAN_SZ;
    var c = oc.getContext('2d');
    c.font = CFG.largeWeight + ' ' + fontSize + 'px ' + CFG.largeFontFamily;
    c.textBaseline = 'alphabetic';

    var mW  = c.measureText(word);
    var wid = mW.actualBoundingBoxLeft + mW.actualBoundingBoxRight;
    var cx  = (SCAN_SZ - wid) / 2 + mW.actualBoundingBoxLeft;
    var asc = mW.actualBoundingBoxAscent;
    var dsc = mW.actualBoundingBoxDescent;
    var cy  = (SCAN_SZ - (asc + dsc)) / 2 + asc;

    c.fillStyle = '#000';
    c.fillText(word, cx - mW.actualBoundingBoxLeft, cy);

    var px     = c.getImageData(0, 0, SCAN_SZ, SCAN_SZ).data;
    var yStart = Math.max(0, Math.floor(cy - asc - LINE_H * 0.5));
    var yEnd   = Math.min(SCAN_SZ, Math.ceil(cy + dsc));
    var rows   = [];

    for (var row = yStart; row < yEnd; row += LINE_H) {
      var col = new Uint8Array(SCAN_SZ);
      var end = Math.min(row + LINE_H, yEnd);
      for (var y = row; y < end; y++) {
        var base = y * SCAN_SZ * 4;
        for (var x = 0; x < SCAN_SZ; x++) {
          if (px[base + x * 4 + 3] > 60) col[x] = 1;
        }
      }
      var spans = [], s = -1;
      for (var x2 = 0; x2 <= SCAN_SZ; x2++) {
        if (x2 < SCAN_SZ && col[x2]) {
          if (s === -1) s = x2;
        } else if (s !== -1) {
          if (x2 - s > 4) spans.push({ x: s, w: x2 - s });
          s = -1;
        }
      }
      rows.push(spans);
    }

    return { rows: rows, scanH: Math.max(1, yEnd - yStart) };
  }

  /* ---- buildAllChars ------------------------------------------------------ */
  function buildAllChars(CW, layoutCW, heroH) {
    var probe   = document.createElement('canvas').getContext('2d');
    var refSize = 200;
    probe.font  = CFG.largeWeight + ' ' + refSize + 'px ' + CFG.largeFontFamily;
    var maxWid  = 0;
    for (var i = 0; i < CFG.words.length; i++) {
      var m = probe.measureText(CFG.words[i]);
      var w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (w > maxWid) maxWid = w;
    }
    if (maxWid < 1) maxWid = refSize * (CFG.words[0].length || 4) * 0.6;
    var fontSize = (layoutCW * CFG.widthFraction / maxWid) * refSize;

    var SCAN_SZ         = Math.max(1000, Math.ceil(layoutCW * 1.1));
    var wordWidthInScan = fontSize * (maxWid / refSize);
    var scanLeftEdge    = (SCAN_SZ - wordWidthInScan) / 2;
    var displayLeftEdge = (CW - wordWidthInScan) / 2;
    var xShift          = displayLeftEdge - scanLeftEdge;

    var WORD_GAP = LINE_H * CFG.wordGap;
    var scans    = CFG.words.map(function (w) { return scanWord(w, fontSize, SCAN_SZ); });
    var totalH   = WORD_GAP * (scans.length - 1);
    for (var si = 0; si < scans.length; si++) totalH += scans[si].scanH;

    var refW2  = Math.min(CW, 850);
    var topPad = LINE_H * CFG.verticalPad + (CFG.extraTopPad || 0) * (refW2 / 850) + (CFG.topPadVh || 0) * window.innerHeight;
    var yOff   = Math.max(topPad, (heroH - totalH) / 2) + BLEED;

    var sc = document.createElement('canvas').getContext('2d');
    sc.font = CFG.fillWeight + ' ' + FILL_SZ + 'px ' + CFG.fillFontFamily;

    var chars = [], pi = 0;

    for (var wi = 0; wi < scans.length; wi++) {
      var scan = scans[wi];
      for (var ri = 0; ri < scan.rows.length; ri++) {
        var hy    = yOff + ri * LINE_H;
        var spans = scan.rows[ri];
        for (var spi = 0; spi < spans.length; spi++) {
          var span = spans[spi];
          var x0   = span.x + xShift;
          var x1   = (span.x + span.w) + xShift;
          var cx2  = x0;
          while (cx2 < x1) {
            var ch = POOL[pi % POOL.length];
            if (ch === ' ') ch = '\u2009';   // word spaces render as thin spaces
            var cw = sc.measureText(ch).width;
            if (cx2 + cw > x1) break;   // does not fit -- leave it for the next span
            pi++;
            var idx  = chars.length;
            var acid = seededFrac(idx, 17) < ACID_SHARE;
            var grp  = Math.floor(seededFrac(idx, 5) * ACID_GROUPS);
            chars.push({ ch: ch, hx: cx2, hy: hy, dx: 0, dy: 0,
                         acid: acid, phase: grp * (6.2832 / ACID_GROUPS) });
            cx2 += cw;
          }
        }
      }
      yOff += scan.scanH + WORD_GAP;
    }

    return chars;
  }

  /* ---- computeCanvasHeight ------------------------------------------------ */
  function computeCanvasHeight(CW, layoutCW, heroH) {
    var probe   = document.createElement('canvas').getContext('2d');
    var refSize = 200;
    probe.font  = CFG.largeWeight + ' ' + refSize + 'px ' + CFG.largeFontFamily;
    var maxWid  = 0, totalScanH = 0;
    for (var i = 0; i < CFG.words.length; i++) {
      var m = probe.measureText(CFG.words[i]);
      var w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (w > maxWid) maxWid = w;
    }
    if (maxWid < 1) maxWid = refSize * (CFG.words[0].length || 4) * 0.6;
    var fontSize = (layoutCW * CFG.widthFraction / maxWid) * refSize;

    for (var wi = 0; wi < CFG.words.length; wi++) {
      var sc2 = document.createElement('canvas').getContext('2d');
      sc2.font = CFG.largeWeight + ' ' + fontSize + 'px ' + CFG.largeFontFamily;
      sc2.textBaseline = 'alphabetic';
      var mW2 = sc2.measureText(CFG.words[wi]);
      totalScanH += Math.ceil(mW2.actualBoundingBoxAscent + mW2.actualBoundingBoxDescent + LINE_H * 0.5);
    }

    var WORD_GAP = LINE_H * CFG.wordGap;
    var totalH   = totalScanH + WORD_GAP * (CFG.words.length - 1);
    var refW     = Math.min(CW, 850);
    var topPad   = LINE_H * CFG.verticalPad + (CFG.extraTopPad    || 0) * (refW / 850) + (CFG.topPadVh || 0) * window.innerHeight;
    var botPad   = LINE_H * CFG.verticalPad + (CFG.extraBottomPad || 0) * (refW / 850);
    var yOff     = Math.max(topPad, (heroH - totalH) / 2);
    return Math.ceil(yOff + totalH + botPad);
  }

  /* ---- axis animation ----------------------------------------------------- */
  var startTime = null;

  function getCurrentAxisValues(nowMs) {
    if (startTime === null) startTime = nowMs;
    var elapsed = (nowMs - startTime) / 1000;
    return CFG.axes.map(function (axis) {
      var period = axis.speed * axis.mult;
      var t = Math.sin(Math.PI * (elapsed / period));
      return { tag: axis.tag, value: axis.min + (axis.max - axis.min) * t * t };
    });
  }

  /* ---- drawFrame ---------------------------------------------------------- */
  function drawFrame(chars, CW, CH, dpr, mp, nowMs) {
    var col      = getThemeColours();
    var fvs      = buildFVS(getCurrentAxisValues(nowMs));
    var fillFont = CFG.fillWeight + ' ' + FILL_SZ + 'px ' + CFG.fillFontFamily;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    ctx.font                  = fillFont;
    ctx.fontVariationSettings = fvs;
    ctx.textBaseline          = 'top';

    var inkStr = rgb(col.ink);
    ctx.fillStyle = inkStr;
    var cur = inkStr;

    var radius   = isMouseDown ? 250 : 100;
    var strength = isMouseDown ? 105 : 35;
    var scalePk  = isMouseDown ? 6   : 4;

    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];

      if (mp) {
        var tx   = c.hx + c.dx;
        var ty   = c.hy + c.dy;
        var rx   = tx - mp.x;
        var ry   = ty - mp.y;
        var dist = Math.sqrt(rx * rx + ry * ry);
        if (dist < radius && dist > 0) {
          var f = (1 - dist / radius) * strength * 0.3;
          c.dx += (rx / dist) * f;
          c.dy += (ry / dist) * f;
        }
      }
      c.dx *= 0.94;
      c.dy *= 0.94;

      var tx2 = c.hx + c.dx;
      var ty2 = c.hy + c.dy;
      var scale = 1;

      if (mp) {
        var d2 = Math.sqrt((tx2 - mp.x) * (tx2 - mp.x) + (ty2 - mp.y) * (ty2 - mp.y));
        if (d2 < radius) scale = 1 + (scalePk - 1) * (1 - d2 / radius);
      }

      var want = inkStr;
      if (c.acid) {
        var a = 0.5 + 0.5 * Math.sin(nowMs * ACID_SPEED + c.phase);
        a = a * a;   // squared, so a glyph reads as ink most of the cycle
        want = rgb([col.ink[0] + (col.signal[0] - col.ink[0]) * a,
                    col.ink[1] + (col.signal[1] - col.ink[1]) * a,
                    col.ink[2] + (col.signal[2] - col.ink[2]) * a]);
      }
      if (want !== cur) { ctx.fillStyle = want; cur = want; }

      if (scale > 1.05) {
        var sz = FILL_SZ * scale;
        ctx.font = CFG.fillWeight + ' ' + sz.toFixed(1) + 'px ' + CFG.fillFontFamily;
        ctx.fillText(c.ch, tx2, ty2 - (sz - FILL_SZ) * 0.5);
        ctx.font = fillFont;
      } else {
        ctx.fillText(c.ch, tx2, ty2);
      }
    }
  }

  /* ---- init / loop -------------------------------------------------------- */
  var chars = [], rafId = null, mp = null, CW, CH, dpr;

  function init() {
    dpr = window.devicePixelRatio || 1;
    var parentW = Math.floor(canvasEl.parentElement.getBoundingClientRect().width);
    var capW    = isFinite(CFG.maxWidth) ? CFG.maxWidth : parentW;
    CW          = Math.max(Math.min(parentW, capW), 320);

    var declared = parseFloat(getComputedStyle(document.documentElement)
                    .getPropertyValue('--lb-bleed'));
    BLEED = isNaN(declared) ? CFG.bleedTop : declared;

    FILL_SZ = Math.max(CFG.minFillSize || 0, CFG.fillSize * Math.pow(Math.min(CW, 850) / 850, 1.4));
    LINE_H  = Math.ceil(1.3 * FILL_SZ);

    var heroH = CFG.heroHeightFrac > 0 ? Math.round(window.innerHeight * CFG.heroHeightFrac) : 0;
    CH = computeCanvasHeight(CW, CW, heroH) + BLEED;

    canvasEl.style.width  = CW + 'px';
    canvasEl.style.height = CH + 'px';
    canvasEl.width  = Math.round(CW * dpr);
    canvasEl.height = Math.round(CH * dpr);

    chars = buildAllChars(CW, CW, heroH);
    drawFrame(chars, CW, CH, dpr, mp, performance.now());
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function loop(nowMs) {
    rafId = null;
    drawFrame(chars, CW, CH, dpr, mp, nowMs);
    rafId = requestAnimationFrame(loop);
  }

  // Tracked on `window`, not on the canvas: the canvas is pointer-events:none (it
  // overhangs the content above it), and this way the field also reaches out past the
  // box -- glyphs lean away from the cursor before it has arrived. The repel is
  // distance-gated anyway, so a cursor at the top of the page costs nothing.
  window.addEventListener('mousemove', function (e) {
    var r = canvasEl.getBoundingClientRect();
    mp = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  document.addEventListener('mouseleave', function () { mp = null; });

  // theme: the explicit toggle stamps data-theme, the OS preference fires matchMedia
  new MutationObserver(function () {
    if (chars.length) drawFrame(chars, CW, CH, dpr, mp, performance.now());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () {
      if (chars.length) drawFrame(chars, CW, CH, dpr, mp, performance.now());
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    init();
  }

  var rafResize;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(rafResize);
    rafResize = requestAnimationFrame(init);
  });
}());
