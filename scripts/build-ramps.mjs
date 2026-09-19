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

/* The engine, compiled and imported, so the page cannot disagree with the package. */
const bundled = await build({
  entryPoints: ['src/gradient.ts'], bundle: true, format: 'esm', write: false,
  target: ['es2022'], logLevel: 'warning',
})
const g = await import('data:text/javascript;base64,' +
  Buffer.from(bundled.outputFiles[0].text).toString('base64'))

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
const blurStack = (radius, start) => g.blurLayers({ radius, layers: 6, start })
  .map(l => `<div style="backdrop-filter:${l.backdropFilter};-webkit-backdrop-filter:${l.backdropFilter};` +
             `-webkit-mask-image:${l.maskImage};mask-image:${l.maskImage}"></div>`).join('')
const LINES = ['Hamburgefonstiv — the tail of the work goes on', 'past the point where the reader can still be',
  'sure of it, which is the whole affordance: a', 'hard cut reads as the end of the specimen',
  'rather than the end of what has loaded so far.', 'The fade is not decoration. It is the signal',
  'that there is more, and it has to arrive without', 'announcing itself, or it becomes a panel laid',
  'over the text instead of the ink thinning out.', 'A flat swatch forgives any curve. Type will not.']
const proseBlock = LINES.map(l => `<p>${l}</p>`).join('')
/* Denser and doubled, so the ramp has lines to act on rather than empty box. */
const denseBlock = LINES.concat(LINES.slice(0, 6)).map(l => `<p>${l}</p>`).join('')
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
   phenomenon with the evidence enlarged: .5 -> .58 of #e8e8e8 over #0f0f0f is ~18 levels,
   so at full column width each terrace is tens of pixels across and impossible to miss.
   Nothing is exaggerated -- it is the identical quantisation, given space. */
const bandDemo = g.maskRamp({ dir: '90deg', from: .5, to: .58 })


/* ── THE COPY ─────────────────────────────────────────────────────────────────────────
 *
 * Every word on the page is in this object and nowhere else. Nothing below it is prose,
 * so a writing pass never touches markup and cannot break the build by editing a tag.
 *
 * ${...} IS A LIVE VALUE FROM THE ENGINE, NOT DECORATION. Those are measured -- the
 * clothoid's four numbers, the fitted residual, the blur radii -- and they change when
 * the engine changes. Keep every one of them; write around them. If a sentence needs a
 * number that is not already in a slot, ask for it rather than typing it in: the whole
 * point of generating this page is that no figure on it can go stale silently.
 *
 * Entities are HTML: &#8212; em dash, &#8594; arrow, &#183; middot, &#916; delta.
 * Inline markup allowed in notes: <b> (reads as emphasis, not weight) and <code>.
 *
 * House voice, from the rest of this repo: state the thing, then why it is that way, and
 * name the failure it came from. Numbers over adjectives. No hedging, no "simply", no
 * "just". A sentence earns its place by saying something that was not obvious.
 * ────────────────────────────────────────────────────────────────────────────────── */
const COPY = {
  title: `Ramps`,
  lede: `One curve, three channels. The alpha of a scrim, the colour of a blend and the radius of a blur are the same cubic B&#233;zier applied to different quantities &#8212; so the package has one sampler and three emitters rather than three engines. Every gradient on this page is a string <code>src/gradient.ts</code> emitted; none of it is typed in.`,
  c1_title: `The curve`,
  c1_tag: `cubic-bezier(${g.EASES.clothoid.join(', ')})`,
  c2_title: `The edge`,
  c2_tag: `why linear will not do`,
  c3_title: `Where you mix`,
  c3_tag: `the midpoint, four spaces`,
  c4_title: `Steering a channel`,
  c4_tag: `Mass Driver's schema`,
  c5_title: `Progressive blur`,
  c5_tag: `${radii.join(' &#183; ')} px`,
  c6_title: `Banding`,
  c6_tag: `8-bit, and what the engine cannot fix`,
  note1: `Two CodePens make the same fade by hand, seven stops written out one at a time. Fitting a <code>cubic-bezier()</code> to those seven numbers lands within <b>${worst.toFixed(4)}</b> of every one of them, RMS <b>${rms.toFixed(5)}</b> &#8212; about a third of one step in 8-bit. The hand-written version and the curve are the same fade, so the clothoid is a preset here, not a code path. The white dots are where the eight default stops fall: they crowd toward the transparent end, because the curve is sampled by its own parameter rather than at even positions.`,
  note2: `Interpolate alpha in a straight line and it does not read as straight: perceived lightness moves fastest at the transparent end, so the fade announces itself where it starts and then crawls. Both panels fade the same colour over the same text across the same distance. Only the curve differs. This is the whole argument for the file.`,
  note3: `The received wisdom is that oklab rescues a gradient from the grey midpoint sRGB gives you. <b>It does not.</b> A straight line between opposite hues passes through the neutral axis in any rectangular space, because that is where the axis is. What oklab buys is even <b>lightness</b>. Only <b>oklch</b> holds the chroma, by interpolating hue as an angle and going around rather than through &#8212; at the cost of a hue nobody picked. The default stays oklab because it is the predictable one.`,
  note4: `One curve on the interpolation re-spaces the stops <b>along</b> a fixed path through colour space. A curve <b>per channel</b> moves the path itself. Below left: the same two colours with one channel steered at a time &#8212; the ramp leaves the straight line between its endpoints, which is how the tool escapes sRGB's mud without changing space. Below right: the three graphs for <code>${MD_A}</code> &#8594; <code>${MD_B}</code>, plotted on each channel's own axis. R falls, B rises, and <b>G does not move at all</b> &#8212; which is why that pair never goes grey, and why a curve on G there does nothing.`,
  note5: `variablur's effect, as a stack of masked backdrop layers. Each layer owns <b>one band</b> at full opacity carrying that band's absolute radius &#8212; not a cumulative stack, which ghosts: <code>backdrop-filter</code> blurs what is behind the layer, so at partial mask alpha the compositor blends a blurred copy over the still-sharp original and live text shows a double image. Bands are evenly spaced; only the radius follows the curve. The right-hand panel holds the first lines with <code>start</code>, because the smallest stop in the stack still lands inside the first line's ascenders otherwise.`,
  note6: `It blurs pixels; it does not redact. The words stay in the DOM &#8212; selectable, copyable, findable, and read aloud in full by a screen reader, which sees no blur at all. Never use it to withhold anything.`,
  note7: `A ramp crossing ~94 of the 256 available levels over 190px spends about two pixels per level, and the eye finds those edges. <b>More stops cannot help</b> &#8212; an 8-stop ramp and a 2-stop ramp band identically. Nothing in CSS asks for more output bits, so sub-level noise is the only control there is, and every band on this page carries it.`,
  note8: `Mostly you do not need it: Skia already dithers a background gradient and very nearly does not dither a mask &#8212; the same ramp measures a per-pixel deviation of <b>2.98</b> as <code>background-image</code> against <b>0.22</b> as <code>mask-image</code>. So a scrim is dithered for you and a mask over a flat ground is not, which is the one place in this package that bands.`,
  cap1: `alpha against position &#183; dots = the engine's stops`,
  cap2: `the pens' seven stops, against the fitted curve`,
  cap3a: `no scrim &#183; the control`,
  cap3: `linear`,
  cap4: `clothoid &#183; the default`,
  cap5: `start 0`,
  cap6: `start 'calc(12px + 2lh)'`,
  cap7: `a narrow alpha range over a wide box &#183; ~18 levels, no dither &#183; the terraces are the bug`,
  cap8: `the same ramp, the same 18 levels, with .wm-dither`,
}

const page = `<!doctype html><meta charset=utf-8><title>ramps</title><style>
@font-face{font-family:"CalSansVF";src:url(../../fonts/CalSansVF.ttf);font-weight:400 700}
@font-face{font-family:"Face";src:url(../../fonts/CalSansVF.ttf);font-weight:400 700}
*{box-sizing:border-box}
/* NO COLOR ON BODY. Standalone this page is dark, but build.py scopes it into a
   document that is LIGHT by default -- and a scoped body rule carries its ink with it,
   so every heading and table value that inherited #e8e8e8 went white-on-white in the
   assembled page while the explicitly-greyed prose survived. Ink is the host's; this
   page only ever states a colour where it also states the ground under it. */
body{margin:0;background:#0f0f0f;font-family:"CalSansVF",system-ui,sans-serif;
 font-optical-sizing:auto;font-variation-settings:"GEOM" 25;padding:32px 28px 90px}
h1{font-size:23px;margin:0 0 5px} .lede{color:#8a8a8a;font-size:13px;margin:0 0 22px;max-width:84ch}
h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin:34px 0 12px;padding-bottom:7px;
 border-bottom:1px solid #222;display:flex;justify-content:space-between}
h2 span{color:#7d7d7d;letter-spacing:0;text-transform:none;font-size:10px}
p.note{color:#8a8a8a;font-size:12.5px;line-height:1.5;margin:0 0 14px;max-width:84ch}
p.note b{font-weight:400}
code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#7d7d7d}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}
figure{margin:0}
figcaption{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;color:#7d7d7d;margin-top:5px}
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
.band.wide{height:64px;border-radius:0}
.dither{position:relative}
.dither::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:url(${DITHER});
 background-repeat:repeat;mix-blend-mode:overlay;opacity:.18}
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
<figure><div class="spec tall">${denseBlock}<div class="veil" style="background-image:${scrimOf('linear')}"></div></div>
<figcaption>${COPY.cap3}</figcaption></figure>
<figure><div class="spec tall">${denseBlock}<div class="veil" style="background-image:${scrimOf('clothoid')}"></div></div>
<figcaption>${COPY.cap4}</figcaption></figure>
</div>

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
<figure><div class="spec">${proseBlock}<div class="stack">${blurStack(24, 0)}</div></div>
<figcaption>${COPY.cap5}</figcaption></figure>
<figure><div class="spec">${proseBlock}<div class="stack">${blurStack(24, 'calc(12px + 2lh)')}</div></div>
<figcaption>${COPY.cap6}</figcaption></figure>
</div>
<p class="note" style="margin-top:14px">${COPY.note6}</p>

<h2>${COPY.c6_title} <span>${COPY.c6_tag}</span></h2>
<p class="note">${COPY.note7}</p>
<p class="note">${COPY.note8}</p>
<figure style="margin-top:4px"><div class="bandwrap"><div class="band wide" style="background:#e8e8e8;-webkit-mask-image:${bandDemo};mask-image:${bandDemo}"></div></div>
<figcaption>${COPY.cap7}</figcaption></figure>
<figure style="margin-top:14px"><div class="bandwrap dither"><div class="band wide" style="background:#e8e8e8;-webkit-mask-image:${bandDemo};mask-image:${bandDemo}"></div></div>
<figcaption>${COPY.cap8}</figcaption></figure>
`
writeFileSync('docs/system/pages/ramps.html', page)
console.log(`ramps.html: ${(page.length / 1024).toFixed(1)} KB`)
console.log(`  clothoid fit  RMS ${rms.toFixed(5)}, worst ${worst.toFixed(4)}`)
console.log(`  blur radii    ${radii.join(' ')}`)
