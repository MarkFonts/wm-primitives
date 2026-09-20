#!/usr/bin/env node
/* Generate docs/system/pages/ramps.html — section 06 of the system page.
 *
 * GENERATED, because a hand-baked page is a lie with a half-life. Every gradient here is
 * a STRING the engine emits, and the engine's output changed three times on the day this
 * section was written (the blur stack went cumulative -> tiled, its default curve moved
 * twice). A page with those values typed into it would have been wrong within the hour
 * and looked authoritative the whole time. So: one source, a second output, the same
 * shape as scripts/build-dial.mjs.
 *
 * The page needs NO JavaScript. A scrim, a blend and a channel ramp are declarations, and
 * the blur stack is six divs with inline styles -- so everything here is baked CSS and the
 * assembled page pays nothing at runtime. The curve editor is the only part of the
 * primitive that genuinely needs React, and it is not on this page.
 *
 *   node scripts/build-ramps.mjs
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { copy } from '../docs/system/pages/ramps.copy.js'

/* The engine, compiled and imported, so the page cannot disagree with the package. */
const bundled = await build({
  entryPoints: ['src/gradient.ts'], bundle: true, format: 'esm', write: false,
  target: ['es2022'], logLevel: 'warning',
})
const engineSrc = bundled.outputFiles[0].text
const g = await import('data:text/javascript;base64,' +
  Buffer.from(engineSrc).toString('base64'))
/* The same text, minus its ESM export, for inlining into the page. 3.5KB and no
   dependencies -- the sliders need the engine, not React, and dist/dial.js already
   ships one React that a second bundle here would duplicate. */
const engineInline = engineSrc.replace(/export\s*\{[\s\S]*?\};?\s*$/, '')

/* The dither tile is read out of the shipped stylesheet rather than regenerated, so the
   page demonstrates the same noise the package actually applies. */
const DITHER = readFileSync('src/gradient.css', 'utf8').match(/url\((data:image\/png;base64,[^)]+)\)/)[1]

const A = '#1544C4', B = '#F0B323'          // blue -> yellow: all three channels travel
const MD_A = '#F65030', MD_B = '#3050F6'    // Mass Driver's own pair: G is flat

/* channelBlend resolves a colour through the browser -- computed style, then a 1x1
   canvas -- which is exactly right in a page and unavailable here. It takes an [r,g,b]
   triple for this case, which is also why it is testable outside a browser at all. */
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/* ── the numbers the copy is allowed to state ────────────────────────────────────────
 *
 * Two kinds, and the difference matters. COMPUTED ones are derived here from the same
 * inputs the page renders from, so they cannot drift from the picture beside them.
 * MEASURED ones are facts about a browser -- how much Skia dithers, how wide a terrace
 * comes out -- which no amount of arithmetic here can produce. They are constants with
 * their provenance attached, and if the demo they describe changes they must be taken
 * again. That is the whole reason they are here rather than typed into a sentence: one
 * place to find, and a comment saying how.
 * ────────────────────────────────────────────────────────────────────────────────── */

/* sRGB <-> OKLab/OKLCh. Checked against the browser's own color-mix() on the page's pair:
   oklab and oklch land on the same bytes exactly, srgb within one unit of blue. */
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const l2s = c => Math.max(0, Math.min(255, Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055))))
const toOklab = ([r, gg, b]) => {
  const R = s2l(r), G = s2l(gg), B = s2l(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const t = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [0.2104542553*l + 0.7936177850*m - 0.0040720468*t,
          1.9779984951*l - 2.4285922050*m + 0.4505937099*t,
          0.0259040371*l + 0.7827717662*m - 0.8086757660*t]
}
const fromOklab = ([L, a, b]) => {
  const l = (L + 0.3963377774*a + 0.2158037573*b) ** 3
  const m = (L - 0.1055613458*a - 0.0638541728*b) ** 3
  const t = (L - 0.0894841775*a - 1.2914855480*b) ** 3
  return [l2s( 4.0767416621*l - 3.3077115913*m + 0.2309699292*t),
          l2s(-1.2684380046*l + 2.6097574011*m - 0.3413193965*t),
          l2s(-0.0041960863*l - 0.7034186147*m + 1.7076147010*t)]
}
const toOklch = c => { const [L, a, b] = toOklab(c); return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360] }
const fromOklch = ([L, C, h]) => fromOklab([L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)])

const midpoint = (A, B, space) => {
  if (space === 'srgb') return A.map((v, i) => Math.round((v + B[i]) / 2))
  if (space === 'oklab') { const a = toOklab(A), b = toOklab(B); return fromOklab(a.map((v, i) => (v + b[i]) / 2)) }
  const a = toOklch(A), b = toOklch(B)
  let dh = b[2] - a[2]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360
  return fromOklch([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] + dh / 2])
}
const satOf = ([r, gg, b] ) => { const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); return mx === 0 ? 0 : Math.round((mx - mn) / mx * 100) }
const lumaOf = ([r, gg, b]) => Math.round(0.2126 * r + 0.7152 * gg + 0.0722 * b)

/* COMPUTED. lab is deliberately absent: CSS lab() is D50-referenced and this is D65, so a
   figure from here would disagree with the swatch the browser paints beside it. The
   argument is srgb against oklab against oklch; lab is a fourth swatch, not a claim. */
const sat = Object.fromEntries(['srgb', 'oklab', 'oklch']
  .map(sp => [sp, satOf(midpoint(rgb(A), rgb(B), sp))]))
const luma = Object.fromEntries(['srgb', 'oklab']
  .map(sp => [sp, lumaOf(midpoint(rgb('#c8452f'), rgb('#2f7d54'), sp))]))

/* COMPUTED from the band's own parameters: #e8e8e8 ink at BAND_FROM..BAND_TO alpha over
   the #0f0f0f ground the wrapper states. That is what "how many levels" means.
   The steep band is the control and crosses the whole alpha range at the same width. */
const BAND_FROM = 0, BAND_TO = .35
const LIGHT_FROM = .65, LIGHT_TO = 1
const levelsFor = (a0, a1) => Math.round((a1 - a0) * (0xe8 - 0x0f))
const bandLevels = levelsFor(BAND_FROM, BAND_TO)
const steepLevels = levelsFor(0, 1)
const lightLevels = levelsFor(LIGHT_FROM, LIGHT_TO)

/* MEASURED in Chromium by decoding the rendered band, AT THE SECTION'S 1080px MEASURE,
   which puts the band at 1024px once the part's 28px padding is taken off each side.
   That measure is a max-width, so narrower viewports scale the band and the lengths
   here with it: these are true of the >=1080 case and indicative below it.

   Which of these move with width, and which do not, is worth keeping straight:
     - px-per-level is width/levels, so it moves arithmetically
     - the RUN lengths are decoded off a render, so they have to be re-taken, not scaled
     - the JUMPS do not move at all. A step in the column mean is a property of the
       quantiser, not of how many pixels you spread it over. When the measure went
       1143 -> 1080 (band 1414 -> 1024) every jump came back identical, and that is the
       expected result rather than a lucky one.
   Re-take these if the band's range, the section's measure or the dither strength
   changes; the jumps only if the range or the dither does. */
const MEASURED = {
  ditherBg: 2.98,      // per-pixel deviation, same ramp as background-image
  ditherMask: 0.22,    //   "                            as mask-image
  terrace: 14,         // px per level across the dark band -- the density the eye reads
  runMask: 35,         // widest identical run across the dark mask row, px
  runDither: 23,       //   "   with .wm-dither: broken up, not removed
  terraceSteep: 5,     //   "   the steep control: dense enough to fuse
  terraceLight: 14,    //   "   the light control: same density, other end of the scale
  /* The last three rows all carry 76 levels, so px-per-level cannot tell them apart.
     What separates them is the size of the step left in the COLUMN MEAN. */
  jumpMask: 0.99,      // the staircase itself
  jumpBg: 0.49,        // as a background-image: Skia halves it
  jumpDither: 1.29,    // masked + .wm-dither: the step survives, with noise on top
  /* MEASURED down the c5 blur panel in the ASSEMBLED page: mean |dx| between adjacent
     pixels per horizontal slice, which is the cheapest proxy for "is there detail here".
     The stack flattens it to a constant; hidden, the same panel keeps its text. These
     are the numbers note5b quotes, so they live here rather than in the prose. */
  blurSmeared: 0.1,    // sharpness with the layer stack, every slice, top to bottom
  blurSharpLo: 8.7,    // sharpness with the stack hidden, quietest slice
  blurSharpHi: 16.8,   //   "                              busiest slice
  dLdark: 0.365,       // CIELAB dL* of one 8-bit step at the dark row's foot
  dLlight: 0.351,      //   "                        at the light row's foot
}


/* ── 01 · the curve ──────────────────────────────────────────────────────────────── */
const PEN = [[0, 1], [.5, .30], [.65, .15], [.755, .075], [.8285, .037], [.88, .019], [1, 0]]
const PX = x => (x * 250).toFixed(1), PY = a => ((1 - a) * 150).toFixed(1)
let fitPath = ''
for (let i = 0; i <= 120; i++) {
  const x = i / 120
  fitPath += (i ? ' L' : 'M') + PX(x) + ',' + PY(1 - g.bezierY('clothoid', x))
}
let worst = 0, sumSq = 0
const penRows = PEN.map(([t, a]) => {
  const got = 1 - g.bezierY('clothoid', t), d = got - a
  worst = Math.max(worst, Math.abs(d)); sumSq += d * d
  return `<tr><td class="m">${(t * 100).toFixed(2)}%</td><td class="m">${a.toFixed(4)}</td>` +
         `<td class="m">${got.toFixed(4)}</td><td class="m ok">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(4)}</td></tr>`
}).join('')
const rms = Math.sqrt(sumSq / PEN.length)
const stopDots = g.rampStops({ stops: 8 })
  .map(s => `<circle class="dot" cx="${PX(s.at)}" cy="${PY(s.v)}" r="3.2"/>`).join('')

/* ── 03 · where you mix ──────────────────────────────────────────────────────────── */
const SPACES = ['srgb', 'oklab', 'oklch', 'lab']
const mixBands = SPACES.map(sp =>
  `<figure><div class="band dither" style="background-image:${g.blend(A, B, { space: sp, ease: 'linear', stops: 9, dir: '90deg' })}"></div>` +
  `<figcaption>${sp}</figcaption></figure>`).join('')

/* ── 04 · steering a channel ─────────────────────────────────────────────────────── */
const EI = g.EASES['ease-in']
const steer = [
  ['none', undefined], ['R steered', [EI, undefined, undefined]],
  ['G steered', [undefined, EI, undefined]], ['B steered', [undefined, undefined, EI]],
].map(([label, ease]) =>
  `<figure><div class="band dither" style="background-image:${g.channelBlend(rgb(A), rgb(B), { stops: 9, dir: '90deg', ease })}"></div>` +
  `<figcaption>${label}</figcaption></figure>`).join('')

/* Mass Driver's three graphs, drawn from the pair's real endpoints: R falls, G is level,
   B rises. The whole point of plotting a channel on its own axis. */
const chan = (from, to, i, name, hue) => {
  const a = parseInt(from.slice(1 + i * 2, 3 + i * 2), 16) / 255
  const b = parseInt(to.slice(1 + i * 2, 3 + i * 2), 16) / 255
  const y = v => ((1 - v) * 80).toFixed(1)
  return `<figure><svg viewBox="-2 -6 104 92" class="chan"><rect class="f" x="0" y="0" width="100" height="80"/>` +
    `<line class="ln" x1="0" y1="${y(a)}" x2="100" y2="${y(b)}" stroke="${hue}"/>` +
    `<circle cx="0" cy="${y(a)}" r="2.6" fill="${hue}"/><circle cx="100" cy="${y(b)}" r="2.6" fill="${hue}"/>` +
    `</svg><figcaption style="color:${hue}">${name} ${Math.round(a * 255)} → ${Math.round(b * 255)}</figcaption></figure>`
}
const mdPlots = ['#e05', '#0b6', '#48f'].map((h, i) =>
  chan(MD_A, MD_B, i, ['R', 'G', 'B'][i], h)).join('')

/* ── 05 · progressive blur, as static DOM ────────────────────────────────────────── */
const blurStack = (radius, start) => g.blurLayers({ radius, start })
  .map(l => `<div style="inset:${l.inset};backdrop-filter:${l.backdropFilter};` +
             `-webkit-backdrop-filter:${l.backdropFilter}"></div>`).join('')
const LINES = ['Hamburgefonstiv — the tail of the work goes on', 'past the point where the reader can still be',
  'sure of it, which is the whole affordance: a', 'hard cut reads as the end of the specimen',
  'rather than the end of what has loaded so far.', 'The fade is not decoration. It is the signal',
  'that there is more, and it has to arrive without', 'announcing itself, or it becomes a panel laid',
  'over the text instead of the ink thinning out.', 'A flat swatch forgives any curve. Type will not.']
const proseBlock = LINES.map(l => `<p>${l}</p>`).join('')
/* Denser and doubled, so the ramp has lines to act on rather than empty box. */
const denseBlock = LINES.concat(LINES.slice(0, 6)).map(l => `<p>${l}</p>`).join('')
/* The radius ladder the chapter quotes. Sampled at 6 for the table because 16 numbers
   is a list, not a figure -- the stack itself runs at the default. */
const radii = g.blurLayers({ radius: 24, layers: 6 }).map(l => l.backdropFilter.slice(5, -3))

/* ── 02 · the edge, and 06 · banding ─────────────────────────────────────────────── */
/* A SCRIM NEEDS A CONTROL BESIDE IT. Fading --bg over a --bg ground is the real use --
   the ink thins out and the page shows through -- but with nothing to compare against,
   linear and clothoid read as a small difference in timing rather than as a difference
   in where the fade announces itself. The unveiled panel is what makes the other two
   legible, and the text is set denser so more lines fall inside the ramp. */
const scrimOf = ease => g.scrim('#0f0f0f', { ease, dir: 'to top' })
/* THE TERRACES HAVE TO BE GIVEN ROOM. Banding is levels-per-pixel, so a ramp that
   crosses the whole range over a short box hides it -- the steps are a pixel apart and
   the page is usually viewed scaled. Crossing a NARROW range over a WIDE box is the same
   phenomenon with the evidence enlarged.
   AND IT STILL HAS TO BE AMPLIFIED, which took two failed attempts to accept. .5 -> .58
   was measurably terraced and visually a flat grey slab. Widening to .3 -> .62 gave more
   terraces, not more visible ones -- because the step between two of them is ONE level,
   and one level is one level wherever you put it.

   Two wrong diagnoses before this one, both worth leaving on the record.

   First: that the steps were too SMALL to see, fixed by showing the band again through
   filter: contrast(6). contrast() pivots on 0.5 and rescales everything through it, so
   the amplified copy stopped sitting on the ground it was composited over -- 113->142
   became 41->215, a near-full-range gradient floating on a #0f0f0f page it had no
   relationship to. A different picture, not a louder one.

   Second: that what mattered was terrace WIDTH, fixed by crossing fewer levels over the
   same width -- 11 levels at 155px each. That is the worst choice available. It reads
   as one flat grey (11 levels is 4% of the range: there is no visible gradient left to
   band) and every step is an isolated edge of about 0.37 dL*, which is under threshold
   on its own. Too flat to be a gradient and too sparse to show a step, from one cause.

   What the eye actually catches is the REPETITION. Many steps close together read as a
   pattern; that pattern is what people mean by banding. So visibility is not monotonic
   in terrace width, it peaks: 5px per level fuses into a smooth ramp, 13px bands hard,
   155px disappears into a flat field.

   And position on the tone scale matters independently, which CIELAB says it should not.
   The dark row and the light row below are the same 76 levels at the same 13px, and
   their per-step dL* differs by a twentieth (0.365 against 0.351) -- yet the dark one
   bands unmistakably and the light one is clean. Lab is uniform for small patches, not
   for a 1-level edge run across a wide smooth field, and this is the cheapest available
   demonstration of the gap. It is also why banding complaints are always about the dark
   end of a gradient. */
const bandDemo = g.maskRamp({ dir: '90deg', ease: 'linear', stops: 64, from: BAND_FROM, to: BAND_TO })
const bandSteep = g.maskRamp({ dir: '90deg', ease: 'linear', stops: 64, from: 0, to: 1 })
/* Same level count and same px-per-level as bandDemo, at the other end of the scale.
   This row is the control for the tonal claim, not decoration: drop it and "the dark
   end is where it shows" is an assertion. */
const bandLight = g.maskRamp({ dir: '90deg', ease: 'linear', stops: 64, from: LIGHT_FROM, to: LIGHT_TO })
/* LINEAR, not the page's own clothoid. Everywhere else the ease is the subject; here
   the subject is levels per pixel, and a clothoid varies that along the ramp -- it
   crowds the stops, so px-per-level stops being one number. */
const over = a => Math.round(0x0f + a * (0xe8 - 0x0f))
const bandBg = `linear-gradient(90deg, rgb(${over(BAND_FROM)} ${over(BAND_FROM)} ${over(BAND_FROM)}), `
  + `rgb(${over(BAND_TO)} ${over(BAND_TO)} ${over(BAND_TO)}))`


/* The copy lives in docs/system/pages/ramps.copy.js and nowhere else. Nothing in this
   file is prose; a writing pass never opens it. */
const COPY = copy({ EASES: g.EASES, radii, worst, rms, MD_A, MD_B,
  sat, luma, band: { levels: bandLevels, perLevel: MEASURED.terrace, terrace: MEASURED.terrace,
          dithered: MEASURED.runDither, run: MEASURED.runMask,
          steepLevels, steepPerLevel: MEASURED.terraceSteep, steepTerrace: MEASURED.terraceSteep,
          lightLevels, lightPerLevel: MEASURED.terraceLight,
          jumpMask: MEASURED.jumpMask, jumpBg: MEASURED.jumpBg, jumpDither: MEASURED.jumpDither,
          dLdark: MEASURED.dLdark, dLlight: MEASURED.dLlight },
  dither: { bg: MEASURED.ditherBg, mask: MEASURED.ditherMask },
  blur: { smeared: MEASURED.blurSmeared, sharpLo: MEASURED.blurSharpLo, sharpHi: MEASURED.blurSharpHi } })

const page = `<!doctype html><meta charset=utf-8><title>ramps</title><style>
@font-face{font-family:"CalSansVF";src:url(../../fonts/CalSansVF.ttf);font-weight:400 700}
@font-face{font-family:"Face";src:url(../../fonts/CalSansVF.ttf);font-weight:400 700}
*{box-sizing:border-box}
/* COLOR ON BODY, PAIRED WITH THE GROUND ON BODY. This rule scopes to .part-1 -- the
   ramps part alone, not the whole of #s-color -- so the ink lands exactly where the
   #0f0f0f beside it does, and the Color audit above keeps the host's.
   Leaving the colour off was the bug: the ground here is stated unconditionally while
   the host's ink follows the host's scheme, so in light mode every heading, table cell
   and caption that inherited rendered near-black on near-black, and only the spans
   carrying a literal stayed readable. State both or state neither. */
body{margin:0;background:#0f0f0f;color:#c9c9c9;font-family:"CalSansVF",system-ui,sans-serif;
 font-optical-sizing:auto;font-variation-settings:"GEOM" 25;padding:32px 28px 8px}
h1{font-size:23px;margin:0 0 5px} .lede{color:#9a9a9a;font-size:13px;margin:0 0 22px;max-width:84ch}
h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin:34px 0 12px;padding-bottom:7px;
 border-bottom:1px solid #222;display:flex;justify-content:space-between}
h2 span{color:#7d7d7d;letter-spacing:0;text-transform:none;font-size:10px}
/* LITERAL INK, BECAUSE THIS PART STATES ITS OWN GROUND. These notes sit inside section
   05 beside the Color audit's, so they were briefly switched to var(--ink-2) to match
   them. That was wrong, and it broke the part outright: --ink-2 follows the HOST's
   colour scheme, this body states background:#0f0f0f unconditionally, and in light mode
   every note, heading and caption here rendered near-black on near-black. Only the
   <code> spans, which carry a literal, stayed legible.
   The rule the rest of this file already follows: state ink only where you also state
   the ground, and then state both. Matching the audit on SIZE (13.5px) is right;
   matching it on colour cannot be, because the two sit on different grounds. */
p.note{color:#9a9a9a;font-size:13.5px;line-height:1.5;margin:0 0 14px;max-width:84ch}
p.note b{font-weight:400}
code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#7d7d7d}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}
figure{margin:0}
figcaption{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;color:#8a8a8a;margin-top:5px}
.band{height:84px;border-radius:5px;position:relative;overflow:hidden}
/* Full width on purpose: the terraces need the pixels. And the wrap STATES THE GROUND --
   an alpha ramp only has the range its backdrop gives it, and on the assembled page's
   light default #e8e8e8 at .5 alpha lands 2 levels from #e8e8e8 at .58. Over #0f0f0f the
   same ramp is 18. The demo was measuring the page, not the quantisation. */
/* THE DITHER GOES OUTSIDE THE MASK. Here the terraces are the MASK's alpha being
   quantised, and noise applied inside the masked element modulates the ink before the
   mask touches it -- measurably nothing: 19 terraces either way, the widest 126px in
   both. On the wrapper it lands on the composited result, which is where the steps
   actually are. Worth knowing generally: .wm-dither has to sit after whatever quantises,
   not under it. */
.bandwrap{background:#0f0f0f;border-radius:5px;overflow:hidden;position:relative}
.bandstack{display:grid;gap:14px}
.band.wide{height:88px;border-radius:0}
/* A control row. Native range on purpose: this page carries no component library, and
   a slider that needs one would mean shipping React to a page that otherwise needs
   none. The page renders correctly with JS off -- every demo is baked at its default
   and the sliders only re-emit. */
.ctl{display:flex;align-items:center;gap:10px;margin:12px 0 2px;
 font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#7d7d7d}
.ctl label{min-width:46px}
.ctl input[type=range]{flex:1;max-width:260px;accent-color:#3f95c9;height:16px}
.ctl output{min-width:3ch;text-align:right;font-variant-numeric:tabular-nums}
.ctls{display:flex;flex-wrap:wrap;gap:6px 28px}
.dither{position:relative}
.dither::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:url(${DITHER});
 background-repeat:repeat;mix-blend-mode:overlay;opacity:var(--wm-dither,.18)}
@media (min-resolution:2dppx){.dither::after{background-size:32px 32px}}
table{width:100%;border-collapse:collapse;font-size:12px;max-width:560px}
td,th{padding:6px 10px 6px 0;border-bottom:1px solid #222;text-align:left}
th{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#7d7d7d;font-weight:400}
td.m{font-family:ui-monospace,Menlo,monospace} td.ok{color:#3f95c9}
svg.fit{width:100%;max-width:300px;height:auto}
svg.fit .f{fill:#0f0f0f;stroke:#333}
svg.fit .line{stroke:#333;stroke-dasharray:3 3}
svg.fit .curve{fill:none;stroke:#6ab7e8;stroke-width:2.5}
svg.fit .dot{fill:#0f0f0f;stroke:#e8e8e8;stroke-width:1.5}
svg.chan{width:100%;height:auto}
svg.chan .f{fill:#0f0f0f;stroke:#333}
svg.chan .ln{stroke-width:2.5}
.spec{position:relative;overflow:hidden;height:210px;background:#0f0f0f;border:1px solid #222;border-radius:6px;padding:12px 14px}
.spec p{margin:0 0 6px;font-size:13px;line-height:1.42;color:#e8e8e8}
.spec.tall{height:300px}
.spec.tall p{margin:0 0 3px;font-size:11.5px;line-height:1.34}
.spec .veil{position:absolute;inset:0;pointer-events:none}
.stack{position:absolute;inset:0;pointer-events:none;isolation:isolate;overflow:hidden}
.stack>div{position:absolute;inset:0}
</style>

<h1>${COPY.title}</h1>
<p class="lede">${COPY.lede}</p>

<h2>${COPY.c1_title} <span>${COPY.c1_tag}</span></h2>
<p class="note">${COPY.note1}</p>
<div class="row" style="grid-template-columns:minmax(220px,300px) 1fr;align-items:start">
<figure><svg class="fit" viewBox="-6 -8 262 166">
<rect class="f" x="0" y="0" width="250" height="150" rx="3"/>
<line class="line" x1="0" y1="0" x2="250" y2="150"/>
<path class="curve" d="${fitPath}"/>${stopDots}
</svg><figcaption>${COPY.cap1}</figcaption></figure>
<figure><table><thead><tr><th>at</th><th>the pens</th><th>the curve</th><th>&#916;</th></tr></thead>
<tbody>${penRows}</tbody></table><figcaption>${COPY.cap2}</figcaption></figure>
</div>

<h2>${COPY.c2_title} <span>${COPY.c2_tag}</span></h2>
<p class="note">${COPY.note2}</p>
<div class="row" style="grid-template-columns:repeat(3,1fr)">
<figure><div class="spec tall">${denseBlock}</div>
<figcaption>${COPY.cap3a}</figcaption></figure>
<figure><div class="spec tall">${denseBlock}<div class="veil" data-veil="linear" style="background-image:${scrimOf('linear')}"></div></div>
<figcaption>${COPY.cap3}</figcaption></figure>
<figure><div class="spec tall">${denseBlock}<div class="veil" data-veil="clothoid" style="background-image:${scrimOf('clothoid')}"></div></div>
<figcaption>${COPY.cap4}</figcaption></figure>
</div>
<div class="ctl"><label>${COPY.ctl_stops}</label><input type="range" data-k="stops" min="2" max="16" step="1" value="8"><output>8</output></div>

<h2>${COPY.c3_title} <span>${COPY.c3_tag}</span></h2>
<p class="note">${COPY.note3}</p>
<div class="row">${mixBands}</div>

<h2>${COPY.c4_title} <span>${COPY.c4_tag}</span></h2>
<p class="note">${COPY.note4}</p>
<div class="row">${steer}</div>
<div class="row" style="grid-template-columns:repeat(3,minmax(96px,150px));margin-top:14px">${mdPlots}</div>

<h2>${COPY.c5_title} <span>${COPY.c5_tag}</span></h2>
<p class="note">${COPY.note5}</p>
<div class="row" style="grid-template-columns:1fr 1fr">
<figure><div class="spec">${proseBlock}<div class="stack" data-stack="plain">${blurStack(24, 0)}</div></div>
<figcaption>${COPY.cap5}</figcaption></figure>
<figure><div class="spec">${proseBlock}<div class="stack" data-stack="held">${blurStack(24, 'calc(12px + 2lh)')}</div></div>
<figcaption>${COPY.cap6}</figcaption></figure>
</div>
<div class="ctls">
<div class="ctl"><label>${COPY.ctl_radius}</label><input type="range" data-k="radius" min="4" max="48" step="1" value="24"><output>24</output></div>
<div class="ctl"><label>${COPY.ctl_layers}</label><input type="range" data-k="layers" min="4" max="32" step="1" value="8"><output>8</output></div>
<div class="ctl"><label>${COPY.ctl_hold}</label><input type="range" data-k="hold" min="0" max="40" step="1" value="0"><output>0</output></div>
</div>
<p class="note" style="margin-top:14px">${COPY.note6}</p>

<h2>${COPY.c6_title} <span>${COPY.c6_tag}</span></h2>
<p class="note">${COPY.note7}</p>
<p class="note">${COPY.note8}</p>
<div class="bandstack">
<figure><div class="bandwrap"><div class="band wide" style="background:#e8e8e8;-webkit-mask-image:${bandSteep};mask-image:${bandSteep}"></div></div>
<figcaption>${COPY.cap7a}</figcaption></figure>
<figure><div class="bandwrap"><div class="band wide" style="background:#e8e8e8;-webkit-mask-image:${bandDemo};mask-image:${bandDemo}"></div></div>
<figcaption>${COPY.cap7}</figcaption></figure>
<figure><div class="bandwrap"><div class="band wide" style="background:#e8e8e8;-webkit-mask-image:${bandLight};mask-image:${bandLight}"></div></div>
<figcaption>${COPY.cap7c}</figcaption></figure>
<figure><div class="bandwrap"><div class="band wide" style="background:${bandBg}"></div></div>
<figcaption>${COPY.cap7b}</figcaption></figure>
<figure><div class="bandwrap dither" data-dither><div class="band wide" style="background:#e8e8e8;-webkit-mask-image:${bandDemo};mask-image:${bandDemo}"></div></div>
<figcaption>${COPY.cap8}</figcaption></figure>
</div>
<div class="ctl"><label>${COPY.ctl_dither}</label><input type="range" data-k="dither" min="0" max="60" step="1" value="18"><output>.18</output></div>

<script>
/* The engine, inlined -- the same src/gradient.ts this page was generated from, so a
   slider and the baked default cannot disagree. No framework: every control is a native
   range, and the page is correct with JS off because each demo ships at its default.

   build.py rebinds document.querySelector to the section root and RENAMES ids, so
   everything below addresses by class and data- attribute and never by id. */
${engineInline}

const ctl = (k, fn) => {
  const el = document.querySelector('input[data-k="' + k + '"]')
  if (!el) return
  const out = el.nextElementSibling
  const run = () => { const v = +el.value; if (out) out.textContent = fn(v) ?? v }
  el.addEventListener('input', run)
  run()
}

/* c2 -- the same stop count on both scrims, so the comparison stays honest. Pull it
   under five and the ramp facets; that is the sampling, not the curve. */
ctl('stops', n => {
  for (const ease of ['linear', 'clothoid']) {
    const el = document.querySelector('[data-veil="' + ease + '"]')
    if (el) el.style.backgroundImage = scrim('#0f0f0f', { ease, dir: 'to top', stops: n })
  }
})

/* c5 -- both stacks rebuild; only the right one takes the hold, so the pair keeps
   showing what the offset buys. */
const paint = (sel, start) => {
  const wrap = document.querySelector(sel)
  if (!wrap) return
  const radius = +document.querySelector('input[data-k="radius"]').value
  const layers = +document.querySelector('input[data-k="layers"]').value
  wrap.innerHTML = blurLayers({ radius, layers, start }).map(l =>
    '<div style="inset:' + l.inset + ';backdrop-filter:' + l.backdropFilter +
    ';-webkit-backdrop-filter:' + l.backdropFilter + '"></div>').join('')
}
const blur = () => {
  const hold = +document.querySelector('input[data-k="hold"]').value / 100
  paint('[data-stack="plain"]', 0)
  /* At 0 the held panel keeps the line-based offset it is captioned with, rather than
     becoming a second copy of the panel beside it. The first repaint used to overwrite
     the static calc() with the slider's zero, so the pair rendered identically on load
     and the hold appeared to do nothing until the slider was touched -- which read as a
     dead control rather than as a default. */
  paint('[data-stack="held"]', hold || 'calc(12px + 2lh)')
}
ctl('radius', v => { blur(); return v + 'px' })
ctl('layers', v => { blur(); return v })
ctl('hold',   v => { blur(); return v + '%' })

/* c6 -- the dither's own strength. At 0 the terraces come back, which is the point. */
ctl('dither', v => {
  const el = document.querySelector('[data-dither]')
  if (el) el.style.setProperty('--wm-dither', v / 100)
  return (v / 100).toFixed(2)
})
</script>
`
writeFileSync('docs/system/pages/ramps.html', page)
console.log(`ramps.html: ${(page.length / 1024).toFixed(1)} KB`)
console.log(`  clothoid fit  RMS ${rms.toFixed(5)}, worst ${worst.toFixed(4)}`)
console.log(`  blur radii    ${radii.join(' ')}`)
console.log(`  sat           srgb ${sat.srgb}%  oklab ${sat.oklab}%  oklch ${sat.oklch}%`)
console.log(`  luma          srgb ${luma.srgb}  oklab ${luma.oklab}`)
console.log(`  band          ${bandLevels} levels at ${MEASURED.terrace}px each, run ${MEASURED.runMask}px -> ${MEASURED.runDither}px dithered`)
