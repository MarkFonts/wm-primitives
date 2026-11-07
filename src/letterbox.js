/* letterbox.js -- the house wordmark, scanned and packed with prose.
 *
 * The effect descends from PreText, by Cheng Lou. This engine follows Charlie
 * Clark's implementation of it (https://charlieclark.co/); this is
 * WORDMARK's engine built on it. Scan a word at display size into an alpha mask, slice
 * the mask into LINE_H rows, walk each ink span filling it with fill-size glyphs until
 * the next one will not fit. The cursor pushes and scales the glyphs it passes.
 *
 * ONE engine, three call sites that used to carry their own copy: wordmark.nyc's hero
 * and footer, this repo's system-page colophon, and ReCal's footer. Everything they
 * disagreed about is config; the defaults are the plain letterbox with neither of the
 * two colour mechanisms on.
 *
 * The two mechanisms are independent and composable:
 *
 *   -- SPECKLE (`speckle`) tints a seeded share of the glyphs from `ink` toward
 *      `signal` on N phase groups. One canvas. The colour is computed per glyph and
 *      painted ONCE: drawing the same glyph twice to blend it accumulates antialiasing
 *      and fattens it, which is visible at 10px.
 *   -- JUGGLE (`layers`) paints EVERY glyph on the back canvas at full ink and again on
 *      the front canvas at a group-phased alpha. On flat ground the front copy is
 *      invisible (ink over ink) and this buys nothing -- it pays only where something
 *      sits BETWEEN the layers (wordmark.nyc slides work images through), because there
 *      the back copy is hidden and only the fading front copy shows, so those letters
 *      shimmer over the image. Gate it with `layers.minWidth`.
 *
 * A third, opt-in, changes the paint rather than the colour:
 *
 *   -- HDR (`hdr`) paints with WebGPU instead of Canvas 2D, because a 2D canvas clamps
 *      every colour at SDR white and has nowhere above it to put a glow. An rgba16float
 *      swap chain under extended tone mapping does, so a glyph's `gain` can exceed 1 and
 *      shine past the page. Gated once per letterbox (see `useGPU`); anything that fails
 *      the gate gets the Canvas 2D letterbox exactly as it always was.
 *
 * ASCII ONLY. docs/system/build.py inlines this file into a single HTML document and
 * asserts it; the one non-ASCII character the engine needs (a thin space) is written
 * as an escape rather than as itself.
 *
 * NO ANIMATED AXES, deliberately. Canvas 2D has no fontVariationSettings in Chrome and
 * the @font-face descriptor does not reach it either -- measured, identical ink at GEOM 0
 * and GEOM 100 through both -- so the `axes` config every copy of this carried was inert
 * for its whole life and nobody missed it. A ladder of FontFaces does work, was built, and
 * was removed: at fill size the motion is invisible, so it bought fourteen font
 * registrations per instance and nothing else. Pin what you need with `fvs`.
 *
 * Default fill text: Jerome K. Jerome, "Three Men in a Boat" (1889), public domain.
 */

export var JEROME =
  "I do think that of all the silly irritating tomfoolishness by which we are plagued " +
  "this weather forecast fraud is about the most aggravating It forecasts precisely what " +
  "happened yesterday or the day before and precisely the opposite of what is going to " +
  "happen to day I remember a holiday of mine being completely ruined one late autumn by " +
  "our paying attention to the weather report of the local newspaper Heavy showers with " +
  "thunderstorms may be expected to day it would say on Monday and so we would give up " +
  "our picnic and stop indoors all day waiting for the rain And people would pass the " +
  "house going off in wagonettes and coaches as jolly and merry as could be the sun " +
  "shining out and not a cloud to be seen";

var DEFAULTS = {
  words:           ['WORDMARK'],
  largeFontFamily: '"CalSansVF", -apple-system, sans-serif',
  largeWeight:     700,
  fillFontFamily:  '"CalSansVF", -apple-system, sans-serif',
  fillWeight:      400,
  fillSize:        10,        // px at the 850px reference width
  widthFraction:   0.98,      // fraction of the layout width the words fill
  verticalPad:     0,         // LINE_H units above and below the word block
  wordGap:         0,         // LINE_H units between rows
  maxWidth:        Infinity,  // layout cap in px; Infinity = the parent's width
  heroHeightFrac:  0,         // fraction of vh to centre the block in (hero use)
  topPadVh:        0,
  extraTopPad:     0,         // px at the 850px reference width
  extraBottomPad:  0,
  minFillSize:     6,
  pool:            null,      // fill text; null = JEROME
  poolRepeat:      6,
  fvs:             null,      // pinned font-variation-settings, e.g. "'opsz' 10"
  ffs:             null,      // pinned font-feature-settings, e.g. "'rclt' 1"
  ink:             '--ink',   // a custom property name, or any literal colour
  signal:          '--signal',
  inkFallback:     [232, 232, 232],
  signalFallback:  [238, 255, 65],
  // Top bleed: the canvas grows by this much so glyphs pushed up past the letters are
  // not cut off by the raster edge, and the CSS takes the same amount back out of the
  // layout. `bleedVar` lets the stylesheet own the number, declared once.
  bleedTop:        0,
  bleedVar:        '--lb-bleed',
  // Where the cursor is read. 'window' lets the field reach outside the box, so glyphs
  // lean away before the cursor arrives -- the right choice when the canvas overhangs
  // its neighbours and is pointer-events:none. 'window-gated' does the same but drops
  // the field once the cursor leaves the box. 'canvas' only ever sees its own hits.
  pointer:         'window',
  speckle:         null,      // {share, groups, speed, to, layer}
  layers:          null,      // {front: [canvas], groups, speed, minWidth}
  // HDR, opt-in: {gain, twinkle}. Paints with WebGPU on an HDR display (or `?hdr` in the
  // URL) in a browser that has it; everywhere else, and always with `layers`, the 2D
  // path runs unchanged and this is ignored.
  //   gain     every glyph's brightness as a multiple of SDR white; 1 is today's ink.
  //   twinkle  {mode, share, groups, speed, peak}, or null for a steady fill. A seeded
  //            `share` of glyphs rises from `gain` to `peak` and back. 'stars' gives each
  //            its own phase and period and a brief flash; 'groups' uses the speckle's
  //            phased waves on `groups` groups.
  hdr:             null,
  // 'display-p3' gives the canvas a wide buffer, so a P3 token paints as the neon it
  // is instead of being clamped back into sRGB on the way in.
  colorSpace:      'srgb',
  autoResize:      true,
};

var SPECKLE_DEFAULTS = {
  share: 1 / 6, groups: 5, speed: 0.0016,
  to: null,        // colour the speckle fades toward; null = the config's `signal`
  layer: 'back',   // 'back' | 'front' | 'split' -- which canvas the speckle paints on
};
var LAYER_DEFAULTS   = { front: [], groups: 3, speed: 0.0016, minWidth: 0 };
var HDR_DEFAULTS     = { gain: 1, twinkle: null };
var TWINKLE_DEFAULTS = { mode: 'stars', share: 1 / 6, groups: 5, speed: 0.0016, peak: 2.5 };


/* ---- colour --------------------------------------------------------------- */
function parseRGB(str, fallback) {
  str = (str || '').trim();
  if (str.charAt(0) === '#') {
    var h = str.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (!isNaN(n) && h.length === 6) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /* color(display-p3 .93 1 .25) -- components are 0..1 and the SPACE NAME CONTAINS A
     DIGIT, so the plain number sweep below reads the 3 of "p3" as the red channel and
     the colour comes out near black. Match the function form first, and only then fall
     through. Carried back as 0-255 so everything downstream keeps one number space. */
  var fn = str.match(/^color\(\s*([\w-]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/i);
  if (fn) return [+fn[2] * 255, +fn[3] * 255, +fn[4] * 255];
  /* Anything else -- oklch(), oklab(), lch(), color-mix(), a named colour -- goes
     through the engine instead of a regex. The docs ramp writes every role as
     oklch(93.1% 0 0), and the number sweep below read that as rgb(93, 0, 0): the
     wordmark painted dark red and the speckle green, because L, C and H were taken
     for R, G and B. Letting a 1x1 canvas resolve it is also future-proof -- the next
     colour syntax needs no branch here. */
  if (str && str.charAt(0) !== '#' && /[a-z]/i.test(str)) {
    var sniffed = viaCanvas(str);
    if (sniffed) return sniffed;
  }
  var m = str.match(/(\d+(?:\.\d+)?)/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return fallback;
}

/* Paint one pixel and read it back. Returns null if the engine rejects the syntax --
   fillStyle keeps its previous value on an invalid assignment, which is exactly how we
   tell "unsupported" from "black". */
var _probe = null;
function viaCanvas(str) {
  try {
    if (!_probe) {
      var el = document.createElement('canvas');
      el.width = el.height = 1;
      _probe = el.getContext('2d', { willReadFrequently: true });
      if (!_probe) return null;
    }
    _probe.fillStyle = '#000';
    _probe.fillStyle = str;
    if (_probe.fillStyle === '#000') {
      /* Either the syntax was rejected, or the colour really is black. Re-ask against
         a different sentinel to tell them apart. */
      _probe.fillStyle = '#fff';
      _probe.fillStyle = str;
      if (_probe.fillStyle === '#ffffff') return null;
    }
    _probe.clearRect(0, 0, 1, 1);
    _probe.fillRect(0, 0, 1, 1);
    var d = _probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  } catch (e) {
    return null;
  }
}

/* A colour is either the name of a custom property -- read live, so the theme toggle
   and the OS preference both reach it -- or a literal the caller already resolved. */
function resolveColour(spec, fallback) {
  if (spec && spec.slice(0, 2) === '--') {
    return parseRGB(getComputedStyle(document.documentElement).getPropertyValue(spec), fallback);
  }
  return parseRGB(spec, fallback);
}

function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }


/* `gain` is a multiple of SDR white: 1 is ordinary white, 3 is three times as bright as
   the interface around it. On a plain canvas the gain is dropped -- there is nowhere
   above white to put it -- so the same config degrades to today's rendering. */
/* P3-SCALED, on purpose: the same 0-255 numbers read as P3 coordinates rather than
   converted into P3. A colour-managed conversion would land back on the sRGB colour and
   look identical; this one leaves the sRGB gamut and reads as the neon it is. Needs a
   display-p3 canvas, or the buffer clamps it straight back. */
function paintColour(c, p3On) {
  if (p3On) {
    return 'color(display-p3 ' + (c[0] / 255).toFixed(4) + ' ' +
           (c[1] / 255).toFixed(4) + ' ' + (c[2] / 255).toFixed(4) + ')';
  }
  return rgb(c);
}

/* Seeded, not random: a resize rebuilds the same pattern, because the pattern is a
   property of the wordmark rather than of when you loaded the page. */
function seededFrac(i, salt) {
  var x = Math.sin(i * 127.1 + 311.7 + salt) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Build one letterbox on a canvas. Returns { init, destroy }: `init` lays out and
 * starts the loop (call it once fonts are ready, and it is safe to call again --
 * that is what the resize handler does), `destroy` removes every listener it added.
 */
export function createLetterbox(canvasEl, config) {
  if (!canvasEl) return null;

  var CFG = Object.assign({}, DEFAULTS, config || {});
  var SPK = CFG.speckle ? Object.assign({}, SPECKLE_DEFAULTS, CFG.speckle) : null;
  var LYR = CFG.layers  ? Object.assign({}, LAYER_DEFAULTS,   CFG.layers)  : null;

  var HDR = CFG.hdr ? Object.assign({}, HDR_DEFAULTS, CFG.hdr) : null;
  var TW  = HDR && HDR.twinkle ? Object.assign({}, TWINKLE_DEFAULTS, HDR.twinkle) : null;

  var POOL = (CFG.pool || JEROME).repeat(CFG.poolRepeat);

  /* GPU or 2D, decided ONCE: a canvas that has handed out a 2D context can never give
     a WebGPU one, so this cannot be re-asked on resize. The juggle stays Canvas 2D --
     it needs two stacked canvases with the page between them, and `layers` wins. */
  var useGPU = !!HDR && !LYR && !!navigator.gpu &&
    ((window.matchMedia && matchMedia('(dynamic-range: high)').matches) ||
     new URLSearchParams(location.search).has('hdr'));

  var p3On = false;
  function context(el) {
    if (CFG.colorSpace === 'display-p3') {
      var pc = el.getContext('2d', { colorSpace: 'display-p3' });
      if (pc && pc.getContextAttributes && pc.getContextAttributes().colorSpace === 'display-p3') {
        p3On = true;
        return pc;
      }
    }
    return el.getContext('2d');
  }

  // allCtxs[0] is the back canvas (this one); allCtxs[1+] are the juggle's front layers.
  var allEls  = [canvasEl].concat(LYR ? LYR.front : []);
  // The GPU path owns the canvas outright, so it takes no 2D context here.
  var allCtxs = useGPU ? [null] : allEls.map(context);
  // Refreshed per build so a breakpoint crossing takes effect on resize.
  var splitActive = false;

  var BLEED   = CFG.bleedTop;
  var FILL_SZ = CFG.fillSize;
  var LINE_H  = Math.ceil(1.3 * FILL_SZ);

  var isMouseDown = false;
  function onDown() { isMouseDown = true; }
  function onUp()   { isMouseDown = false; }
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);

  /* ---- scanWord ----------------------------------------------------------- */
  function scanWord(word, fontSize, SCAN_SZ) {
    var oc = document.createElement('canvas');
    oc.width = oc.height = SCAN_SZ;
    var c = oc.getContext('2d');
    c.font = CFG.largeWeight + ' ' + fontSize + 'px ' + CFG.largeFontFamily;
    if (CFG.fvs) c.fontVariationSettings = CFG.fvs;
    if (CFG.ffs) c.fontFeatureSettings = CFG.ffs;
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

  /* ---- word width probe (shared by build + height) ------------------------ */
  function maxWordWidth(probe, refSize) {
    probe.font = CFG.largeWeight + ' ' + refSize + 'px ' + CFG.largeFontFamily;
    if (CFG.fvs) probe.fontVariationSettings = CFG.fvs;
    var maxWid = 0;
    for (var i = 0; i < CFG.words.length; i++) {
      var m = probe.measureText(CFG.words[i]);
      var w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (w > maxWid) maxWid = w;
    }
    if (maxWid < 1) maxWid = refSize * (CFG.words[0].length || 4) * 0.6;
    return maxWid;
  }

  function topPadding(CW) {
    var refW = Math.min(CW, 850);
    return LINE_H * CFG.verticalPad + (CFG.extraTopPad || 0) * (refW / 850) +
           (CFG.topPadVh || 0) * window.innerHeight;
  }

  /* ---- buildAllChars ------------------------------------------------------ */
  function buildAllChars(CW, layoutCW, heroH) {
    splitActive = !!LYR && allCtxs.length > 1 &&
                  window.matchMedia('(min-width: ' + LYR.minWidth + 'px)').matches;

    var refSize  = 200;
    var maxWid   = maxWordWidth(document.createElement('canvas').getContext('2d'), refSize);
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

    var yOff = Math.max(topPadding(CW), (heroH - totalH) / 2) + BLEED;

    var sc = document.createElement('canvas').getContext('2d');
    sc.font = CFG.fillWeight + ' ' + FILL_SZ + 'px ' + CFG.fillFontFamily;
    if (CFG.fvs) sc.fontVariationSettings = CFG.fvs;

    var chars = [], pi = 0;
    var TAU = 6.2832;

    for (var wi = 0; wi < scans.length; wi++) {
      var scan = scans[wi];
      for (var ri = 0; ri < scan.rows.length; ri++) {
        var hy    = yOff + ri * LINE_H;
        var spans = scan.rows[ri];
        for (var spi = 0; spi < spans.length; spi++) {
          var span = spans[spi];
          var x1   = (span.x + span.w) + xShift;
          var cx2  = span.x + xShift;
          while (cx2 < x1) {
            var ch = POOL[pi % POOL.length];
            if (ch === ' ') ch = '\u2009';   // word spaces render as thin spaces
            var cw = sc.measureText(ch).width;
            if (cx2 + cw > x1) break;   // does not fit -- leave it for the next span
            pi++;
            var idx = chars.length;
            // Salts 17 (membership) and 5 (group) are load-bearing: they are what make
            // an existing page rebuild the pattern it already had.
            chars.push({
              ch: ch, hx: cx2, hy: hy, dx: 0, dy: 0,
              acid:   SPK ? seededFrac(idx, 17) < SPK.share : false,
              aphase: SPK ? Math.floor(seededFrac(idx, 5) * SPK.groups) * (TAU / SPK.groups) : 0,
              jphase: LYR ? Math.floor(seededFrac(idx, 5) * LYR.groups) * (TAU / LYR.groups) : 0,
              // Which canvas this one's speckle lands on. 'split' seeds the choice, so
              // the bright glyphs straddle both layers instead of sitting on one.
              afront: SPK && LYR ? (SPK.layer === 'front' ||
                       (SPK.layer === 'split' && seededFrac(idx, 31) < 0.5)) : false,
            });
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
    var refSize  = 200;
    var maxWid   = maxWordWidth(document.createElement('canvas').getContext('2d'), refSize);
    var fontSize = (layoutCW * CFG.widthFraction / maxWid) * refSize;
    var totalScanH = 0;

    for (var wi = 0; wi < CFG.words.length; wi++) {
      var sc2 = document.createElement('canvas').getContext('2d');
      sc2.font = CFG.largeWeight + ' ' + fontSize + 'px ' + CFG.largeFontFamily;
      if (CFG.fvs) sc2.fontVariationSettings = CFG.fvs;
      sc2.textBaseline = 'alphabetic';
      var mW2 = sc2.measureText(CFG.words[wi]);
      totalScanH += Math.ceil(mW2.actualBoundingBoxAscent + mW2.actualBoundingBoxDescent + LINE_H * 0.5);
    }

    var WORD_GAP = LINE_H * CFG.wordGap;
    var totalH   = totalScanH + WORD_GAP * (CFG.words.length - 1);
    var refW     = Math.min(CW, 850);
    var botPad   = LINE_H * CFG.verticalPad + (CFG.extraBottomPad || 0) * (refW / 850);
    var yOff     = Math.max(topPadding(CW), (heroH - totalH) / 2);
    return Math.ceil(yOff + totalH + botPad);
  }

  /* ---- per-glyph steps, shared by both painters so they cannot drift ----------- */
  // The cursor push, damping and scale. Leaves the glyph's position in c.x, c.y.
  function step(c, mp, radius, strength, scalePk) {
    if (mp) {
      var rx   = (c.hx + c.dx) - mp.x;
      var ry   = (c.hy + c.dy) - mp.y;
      var dist = Math.sqrt(rx * rx + ry * ry);
      if (dist < radius && dist > 0) {
        var f = (1 - dist / radius) * strength * 0.3;
        c.dx += (rx / dist) * f;
        c.dy += (ry / dist) * f;
      }
    }
    c.dx *= 0.94;
    c.dy *= 0.94;

    c.x = c.hx + c.dx;
    c.y = c.hy + c.dy;
    var scale = 1;

    if (mp) {
      var d2 = Math.sqrt((c.x - mp.x) * (c.x - mp.x) + (c.y - mp.y) * (c.y - mp.y));
      if (d2 < radius) scale = 1 + (scalePk - 1) * (1 - d2 / radius);
    }
    return scale;
  }

  // The speckle's colour for this glyph this frame, or null when it stays ink.
  function speckleMix(c, inkC, sigC, nowMs) {
    if (!SPK || !c.acid) return null;
    var a = 0.5 + 0.5 * Math.sin(nowMs * SPK.speed + c.aphase);
    a = a * a;   // squared, so a glyph reads as ink for most of the cycle
    return [inkC[0] + (sigC[0] - inkC[0]) * a,
            inkC[1] + (sigC[1] - inkC[1]) * a,
            inkC[2] + (sigC[2] - inkC[2]) * a];
  }

  /* ---- drawFrame ---------------------------------------------------------- */
  function drawGlyph(g, c, tx, ty, scale, fillFont) {
    if (scale > 1.05) {
      var sz = FILL_SZ * scale;
      g.font = CFG.fillWeight + ' ' + sz.toFixed(1) + 'px ' + CFG.fillFontFamily;
      g.fillText(c.ch, tx, ty - (sz - FILL_SZ) * 0.5);
      g.font = fillFont;
    } else {
      g.fillText(c.ch, tx, ty);
    }
  }

  function drawFrame(chars, CW, CH, dpr, mp, nowMs) {
    if (useGPU) return drawFrameGPU(chars, CW, CH, dpr, mp, nowMs);
    var inkC     = resolveColour(CFG.ink, CFG.inkFallback);
    // The speckle's target: its own `to` when set, else the config's signal hue. Set
    // `to` to the ink colour for a speckle that brightens without changing hue.
    var sigC     = SPK ? resolveColour(SPK.to || CFG.signal, CFG.signalFallback) : inkC;
    var inkStr   = paintColour(inkC, p3On);
    var fvs      = CFG.fvs || 'normal';
    var fillFont = CFG.fillWeight + ' ' + FILL_SZ + 'px ' + CFG.fillFontFamily;

    for (var li = 0; li < allCtxs.length; li++) {
      var lc = allCtxs[li];
      lc.setTransform(dpr, 0, 0, dpr, 0, 0);
      lc.clearRect(0, 0, CW, CH);
      lc.fillStyle             = inkStr;   // z-order alone makes the juggle
      lc.font                  = fillFont;
      lc.fontVariationSettings = fvs;
      if (CFG.ffs) lc.fontFeatureSettings = CFG.ffs;
      lc.textBaseline          = 'top';
    }
    var cur = inkStr, curFront = inkStr;

    var radius   = isMouseDown ? 250 : 100;
    var strength = isMouseDown ? 105 : 35;
    var scalePk  = isMouseDown ? 6   : 4;

    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];

      var scale = step(c, mp, radius, strength, scalePk);
      var tx2 = c.x;
      var ty2 = c.y;

      // SPECKLE -- one paint, at a colour mixed for this glyph this frame. On a P3
      // canvas that colour is the P3-scaled acid, which is where the neon comes from.
      var mix     = speckleMix(c, inkC, sigC, nowMs);
      var acidStr = mix ? paintColour(mix, p3On) : null;

      var backStr = (acidStr && !c.afront) ? acidStr : inkStr;
      if (backStr !== cur) { allCtxs[0].fillStyle = backStr; cur = backStr; }
      drawGlyph(allCtxs[0], c, tx2, ty2, scale, fillFont);

      // JUGGLE -- the same glyph again on the front layer at a phased alpha.
      if (splitActive) {
        var ja = 0.5 + 0.5 * Math.sin(nowMs * LYR.speed + c.jphase);
        var fc = allCtxs[1];
        var frontStr = (acidStr && c.afront) ? acidStr : inkStr;
        if (frontStr !== curFront) { fc.fillStyle = frontStr; curFront = frontStr; }
        fc.globalAlpha = ja * ja;          // squared, so one group clearly dominates
        drawGlyph(fc, c, tx2, ty2, scale, fillFont);
        fc.globalAlpha = 1;
      }
    }
  }

  /* ---- drawFrame (WebGPU) -------------------------------------------------- */
  /* Glyphs come from an atlas of the font's own rasters, white on transparent, drawn as
     instanced quads. The fragment shader multiplies the COLOUR by the glyph's gain (not
     the coverage), so gain above 1 is brighter than SDR white and the edges stay put. */
  var SHADER = [
    'struct U { size: vec2f, pad: vec2f };',
    '@group(0) @binding(0) var<uniform> u: U;',
    '@group(0) @binding(1) var samp: sampler;',
    '@group(0) @binding(2) var atlas: texture_2d<f32>;',
    'struct VSIn { @builtin(vertex_index) vi: u32, @location(0) rect: vec4f, @location(1) uv: vec4f, @location(2) col: vec4f };',
    'struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f };',
    '@vertex fn vs(in: VSIn) -> VSOut {',
    '  let corner = vec2f(f32(in.vi & 1u), f32(in.vi >> 1u));',
    '  let px = in.rect.xy + corner * in.rect.zw;',
    '  let clip = vec2f(px.x / u.size.x * 2.0 - 1.0, 1.0 - px.y / u.size.y * 2.0);',
    '  var o: VSOut;',
    '  o.pos = vec4f(clip, 0.0, 1.0);',
    '  o.uv = mix(in.uv.xy, in.uv.zw, corner);',
    '  o.col = in.col;',
    '  return o;',
    '}',
    '@fragment fn fs(in: VSOut) -> @location(0) vec4f {',
    '  let cov = textureSample(atlas, samp, in.uv).a;',
    '  return vec4f(in.col.rgb * in.col.a * cov, cov);',   // premultiplied; col.a is the gain
    '}',
  ].join('\n');

  var gpu = null, gpuReady = false, pendingInit = false;

  /* Every mip level is rasterized with the font at that level's size, not shrunk from
     the one above: level 0 at four times the device fill size (the cursor's scale peak),
     each level half the last, down to 4px. At rest a glyph is 1/4 of a level-0 texel
     per device pixel, so the sampler lands on the level drawn at exactly the fill size
     -- the font's own pixels -- and a glyph the cursor has swollen reads a larger raster. */
  function buildAtlas(device) {
    var p0 = Math.ceil(FILL_SZ * dpr * 4), levels = 1;
    while (p0 / Math.pow(2, levels) >= 4) levels++;
    var unit = Math.pow(2, levels - 1);          // cells stay whole pixels at every level
    var pad  = Math.ceil(p0 * 0.2);
    var cell = Math.ceil((Math.ceil(p0 * 1.35) + pad * 2) / unit) * unit;
    var seen = {}, list = [];
    for (var i = 0; i < POOL.length; i++) {
      var ch = POOL[i] === ' ' ? '\u2009' : POOL[i];
      if (!seen[ch]) { seen[ch] = true; list.push(ch); }
    }
    var cols = Math.ceil(Math.sqrt(list.length)), rowsN = Math.ceil(list.length / cols);
    var W = cols * cell, H = rowsN * cell;
    var tex = device.createTexture({
      size: [W, H], mipLevelCount: levels, format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    for (var L = 0; L < levels; L++) {
      var s = 1 / Math.pow(2, L);
      var oc = document.createElement('canvas');
      oc.width = W * s; oc.height = H * s;
      var c = oc.getContext('2d');
      c.font = CFG.fillWeight + ' ' + (p0 * s) + 'px ' + CFG.fillFontFamily;
      if (CFG.fvs) c.fontVariationSettings = CFG.fvs;
      if (CFG.ffs) c.fontFeatureSettings = CFG.ffs;
      c.textBaseline = 'top';
      c.fillStyle = '#fff';
      for (var k = 0; k < list.length; k++) {
        c.fillText(list[k], (k % cols) * cell * s + pad * s, Math.floor(k / cols) * cell * s + pad * s);
      }
      device.queue.copyExternalImageToTexture(
        { source: oc }, { texture: tex, mipLevel: L, premultipliedAlpha: true }, [oc.width, oc.height]);
    }
    var map = {};
    for (var m = 0; m < list.length; m++) {
      var cx = (m % cols) * cell, cy = Math.floor(m / cols) * cell;
      map[list[m]] = [cx / W, cy / H, (cx + cell) / W, (cy + cell) / H];
    }
    return { tex: tex, map: map, cell: cell, pad: pad, px: p0 };
  }

  function setupGPU() {
    return navigator.gpu.requestAdapter().then(function (adapter) {
      if (!adapter) return false;
      return adapter.requestDevice().then(function (device) {
        var ctx = canvasEl.getContext('webgpu');
        var cfg = { device: device, format: 'rgba16float', alphaMode: 'premultiplied',
                    toneMapping: { mode: 'extended' } };
        if (CFG.colorSpace === 'display-p3') { cfg.colorSpace = 'display-p3'; p3On = true; }
        try { ctx.configure(cfg); }
        catch (e) { p3On = false; delete cfg.colorSpace; ctx.configure(cfg); }
        var mod = device.createShaderModule({ code: SHADER });
        var pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: mod, entryPoint: 'vs', buffers: [{ arrayStride: 48, stepMode: 'instance', attributes: [
            { shaderLocation: 0, offset: 0,  format: 'float32x4' },
            { shaderLocation: 1, offset: 16, format: 'float32x4' },
            { shaderLocation: 2, offset: 32, format: 'float32x4' } ] }] },
          fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] },
          primitive: { topology: 'triangle-strip' },
        });
        gpu = { device: device, ctx: ctx, pipeline: pipeline,
                sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' }),
                ubuf: device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
                ibuf: null, idata: null, icap: 0, bind: null, atlas: null };
        return true;
      });
    }).catch(function () { return false; });
  }

  // FILL_SZ and dpr change on resize, so the atlas is rebuilt on every init.
  function rebuildAtlas() {
    if (gpu.atlas) gpu.atlas.tex.destroy();
    gpu.atlas = buildAtlas(gpu.device);
    gpu.bind = gpu.device.createBindGroup({ layout: gpu.pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: gpu.ubuf } },
      { binding: 1, resource: gpu.sampler },
      { binding: 2, resource: gpu.atlas.tex.createView() } ] });
  }

  // Gain: the base, raised toward `peak` by a seeded share of glyphs.
  function glyphGain(i, nowMs) {
    var gain = HDR.gain;
    if (TW && (TW.share >= 1 || seededFrac(i, 23) < TW.share)) {
      var env, TAU = 6.2832;
      if (TW.mode === 'stars') {
        var sn = Math.sin(nowMs * TW.speed * (0.6 + seededFrac(i, 59)) + seededFrac(i, 41) * TAU);
        env = sn > 0 ? Math.pow(sn, 6) : 0;
      } else {
        var w = 0.5 + 0.5 * Math.sin(nowMs * TW.speed + Math.floor(seededFrac(i, 5) * TW.groups) * (TAU / TW.groups));
        env = w * w;
      }
      gain += (TW.peak - gain) * env;
    }
    return gain;
  }

  function drawFrameGPU(chars, CW, CH, dpr, mp, nowMs) {
    if (!gpu || !gpu.atlas) return;
    var inkC = resolveColour(CFG.ink, CFG.inkFallback);
    var sigC = SPK ? resolveColour(SPK.to || CFG.signal, CFG.signalFallback) : inkC;

    var N = chars.length;
    if (!gpu.ibuf || gpu.icap < N) {
      if (gpu.ibuf) gpu.ibuf.destroy();
      gpu.icap  = Math.max(N, 256);
      gpu.ibuf  = gpu.device.createBuffer({ size: gpu.icap * 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      gpu.idata = new Float32Array(gpu.icap * 12);
    }
    var D = gpu.idata, A = gpu.atlas, n = 0;

    var radius   = isMouseDown ? 250 : 100;
    var strength = isMouseDown ? 105 : 35;
    var scalePk  = isMouseDown ? 6   : 4;

    for (var i = 0; i < N; i++) {
      var c = chars[i];
      var scale = step(c, mp, radius, strength, scalePk);

      // The same placement drawGlyph() makes, as a quad over the atlas cell.
      var sz = scale > 1.05 ? FILL_SZ * scale : FILL_SZ;
      var ty = scale > 1.05 ? c.y - (sz - FILL_SZ) * 0.5 : c.y;
      var k  = sz / A.px;    // CSS px per level-0 texel
      var uv = A.map[c.ch];
      if (!uv) continue;

      var col = speckleMix(c, inkC, sigC, nowMs) || inkC;

      var o = n * 12;
      D[o]     = c.x - A.pad * k;  D[o + 1] = ty - A.pad * k;
      D[o + 2] = A.cell * k;       D[o + 3] = A.cell * k;
      D[o + 4] = uv[0]; D[o + 5] = uv[1]; D[o + 6] = uv[2]; D[o + 7] = uv[3];
      D[o + 8] = col[0] / 255; D[o + 9] = col[1] / 255; D[o + 10] = col[2] / 255;
      D[o + 11] = glyphGain(i, nowMs);
      n++;
    }

    gpu.device.queue.writeBuffer(gpu.ibuf, 0, D.buffer, 0, n * 48);
    gpu.device.queue.writeBuffer(gpu.ubuf, 0, new Float32Array([CW, CH, 0, 0]));
    var enc = gpu.device.createCommandEncoder();
    var pass = enc.beginRenderPass({ colorAttachments: [{
      view: gpu.ctx.getCurrentTexture().createView(),
      clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(gpu.pipeline);
    pass.setBindGroup(0, gpu.bind);
    pass.setVertexBuffer(0, gpu.ibuf);
    pass.draw(4, n);
    pass.end();
    gpu.device.queue.submit([enc.finish()]);
  }

  /* ---- init / loop -------------------------------------------------------- */
  var chars = [], rafId = null, rafResize = null, mp = null, CW = 0, CH = 0, dpr = 1;

  function init() {
    if (useGPU && !gpuReady) {
      if (!pendingInit) {
        pendingInit = true;
        setupGPU().then(function (ok) {
          pendingInit = false;
          // No adapter or device: the canvas has been given nothing yet, so 2D still works.
          if (!ok) { useGPU = false; p3On = false; allCtxs = allEls.map(context); }
          gpuReady = ok;
          init();
        });
      }
      return;
    }
    dpr = window.devicePixelRatio || 1;
    var parentW = Math.floor(canvasEl.parentElement.getBoundingClientRect().width);
    var capW    = isFinite(CFG.maxWidth) ? CFG.maxWidth : parentW;
    CW          = Math.max(Math.min(parentW, capW), 320);

    if (CFG.bleedVar) {
      var declared = parseFloat(getComputedStyle(document.documentElement)
                      .getPropertyValue(CFG.bleedVar));
      BLEED = isNaN(declared) ? CFG.bleedTop : declared;
    }

    FILL_SZ = Math.max(CFG.minFillSize || 0, CFG.fillSize * Math.pow(Math.min(CW, 850) / 850, 1.4));
    LINE_H  = Math.ceil(1.3 * FILL_SZ);

    var heroH = CFG.heroHeightFrac > 0 ? Math.round(window.innerHeight * CFG.heroHeightFrac) : 0;
    CH = computeCanvasHeight(CW, CW, heroH) + BLEED;

    for (var ei = 0; ei < allEls.length; ei++) {
      var el = allEls[ei];
      el.style.width  = CW + 'px';
      el.style.height = CH + 'px';
      el.width  = Math.round(CW * dpr);
      el.height = Math.round(CH * dpr);
    }

    if (useGPU) rebuildAtlas();
    chars = buildAllChars(CW, CW, heroH);
    drawFrame(chars, CW, CH, dpr, mp, performance.now());
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function loop(nowMs) {
    rafId = null;
    drawFrame(chars, CW, CH, dpr, mp, nowMs);
    rafId = requestAnimationFrame(loop);
  }

  /* ---- listeners ---------------------------------------------------------- */
  var moveTarget = CFG.pointer === 'canvas' ? canvasEl : window;
  function onMove(e) {
    var r = canvasEl.getBoundingClientRect();
    var x = e.clientX - r.left;
    var y = e.clientY - r.top;
    mp = (CFG.pointer === 'window-gated' && (x < 0 || x > r.width || y < 0 || y > r.height))
       ? null : { x: x, y: y };
  }
  function onLeave() { mp = null; }
  moveTarget.addEventListener('mousemove', onMove);
  (CFG.pointer === 'canvas' ? canvasEl : document).addEventListener('mouseleave', onLeave);

  function redraw() { if (chars.length) drawFrame(chars, CW, CH, dpr, mp, performance.now()); }

  // Theme: the explicit toggle stamps data-theme, the OS preference fires matchMedia.
  var observer = new MutationObserver(redraw);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', redraw);

  function onResize() {
    cancelAnimationFrame(rafResize);
    rafResize = requestAnimationFrame(init);
  }
  if (CFG.autoResize) window.addEventListener('resize', onResize);

  function destroy() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    cancelAnimationFrame(rafResize);
    window.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    moveTarget.removeEventListener('mousemove', onMove);
    (CFG.pointer === 'canvas' ? canvasEl : document).removeEventListener('mouseleave', onLeave);
    if (CFG.autoResize) window.removeEventListener('resize', onResize);
    observer.disconnect();
    if (gpu && gpu.ctx) { try { gpu.ctx.unconfigure(); } catch (e) {} }
    if (mq && mq.removeEventListener) mq.removeEventListener('change', redraw);
  }

  return { init: init, destroy: destroy };
}
