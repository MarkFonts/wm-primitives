#!/usr/bin/env node
/* zoom-morph-svg -- the zoom control's open/close choreography as one looping, self-contained SVG.
 *
 *   node scripts/zoom-morph-svg.mjs        -> docs/assets/zoom-morph.svg
 *
 * COMPOSED, not recorded. It mounts the real control (src/zoomControl.js + its CSS, the readout
 * in Cal Sans so the numerals measure as drawn) in headless Chromium, presses the mark, and reads
 * the Web Animations the control declares -- every keyframe's offset, value and easing -- plus the
 * geometry of the open control; then closes it (Escape) and reads the close the same way. The SVG
 * is written from those numbers as CSS keyframes, one track per moving part, on a loop of
 *     open (the control's 600ms) . hold 1200 . close (its 300ms) . hold 800
 * so a change to the choreography in zoomControl.js is a re-run of this, never a redraw.
 *
 * Translation, part by part (the live control animates transform, opacity and clip-path; an SVG
 * drawn to play everywhere animates transform and opacity only):
 *   the glasses   transform + opacity, as they are
 *   the mark      FILL is a font axis: the two drawings, FILL 0 and FILL 1, cross-faded -- the rest
 *                 drawing fades OUT as the filled one fades in, or its lens shows through the
 *                 filled one's (the ghost Mark saw, 2026-10-07)
 *   the rule      its clip inset(0 R 0 L) is the same as scaling the full-length line onto [L, R]
 *   the lozenge   its round-ended clip is drawn as two end caps and a middle, moved and scaled; the
 *                 3px ground ring is the same shape behind it in the ground colour
 *   the readout   its clip reveals whole numerals (steps), so each numeral is its own path with
 *                 its own opacity; the shift that centres what is showing is the group's
 *                 transform. Filled in the ground colour, never knocked out -- a knockout shows
 *                 the rule through the digits
 * Vector only: outlines from the subset face at the control's axes (fontTools) and Cal Sans.
 * currentColor plus a prefers-color-scheme rule, so one file works on light and dark.
 * The run checks its own output against the live timeline (every keyframe within 20ms). */
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, extname, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const OUT = join(ROOT, 'docs', 'assets', 'zoom-morph.svg')
const HOLD_OPEN = 1200, HOLD_SHUT = 800

const PAGE = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
${['color', 'type', 'space', 'motion', 'icon', 'chip', 'dialHandle', 'themeSwitch', 'zoomControl'].map(n => `<link rel="stylesheet" href="/src/${n}.css">`).join('')}
<style>@font-face{font-family:CalSans;src:url(/fonts/CalSansVF.ttf)}
:root{--ui-font:CalSans;--text-rgb:232,232,232}body{margin:0;background:var(--bg)}#r{position:fixed;top:24px;right:24px}
.wm-zoom output{font-variation-settings:normal}</style></head>
<body><span id="r" class="wm-theme-row"><span class="wm-zoom wm-zoom--left" data-collapse data-key="zoom-morph-svg"></span></span>
<script src="/src/zoomControl.js"></script></body></html>`
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.html': 'text/html' }
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE) }
  try { const b = await readFile(join(ROOT, decodeURIComponent(path))); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(b) }
  catch { res.writeHead(404); res.end() }
}).listen(0)
const base = `http://localhost:${server.address().port}/`

/* ---- the live timeline ---- */
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 200 } })
await page.goto(base); await page.evaluate(() => document.fonts.ready)
const read = () => page.evaluate(() => {
  const z = document.querySelector('.wm-zoom'), api = z.__wmZoom
  const role = el => el.classList.contains('wm-zoom-fly') ? 'fly:' + el.textContent
    : el.classList.contains('wm-hd-pill') ? 'pill' : el.tagName === 'OUTPUT' ? 'read' : el.tagName === 'I' ? 'rule'
    : el.closest('.wm-zoom-toggle') ? 'mark' : el.getAttribute('aria-label') === 'Zoom out' ? 'out' : 'in'
  return api.morph().map(a => ({ role: role(a.effect.target), duration: a.effect.getTiming().duration,
    keyframes: a.effect.getKeyframes().map(k => ({ offset: k.computedOffset, easing: k.easing, transform: k.transform, opacity: k.opacity, clip: k.clipPath, fvs: k.fontVariationSettings })) }))
})
await page.click('.wm-zoom-toggle')
const open = await read()
await page.evaluate(() => document.querySelector('.wm-zoom').__wmZoom.morph().forEach(a => a.finish()))
await page.waitForTimeout(50)
const geo = await page.evaluate(() => {
  const z = document.querySelector('.wm-zoom'), B = z.querySelector('.wm-zoom-box').getBoundingClientRect()
  const c = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - B.left, y: r.top + r.height / 2 - B.top, w: r.width, h: r.height } }
  const rule = z.querySelector('.wm-hd-rail > i').getBoundingClientRect(), o = z.querySelector('output'), O = o.getBoundingClientRect()
  return { w: B.width, h: B.height, mark: c(z.querySelector('.wm-zoom-toggle .wm-icon')), out: c(z.querySelector('[aria-label="Zoom out"] .wm-icon')),
    in: c(z.querySelector('[aria-label="Zoom in"] .wm-icon')), pill: c(z.querySelector('.wm-hd-pill')),
    rule: { l: rule.left - B.left, r: rule.right - B.left, y: rule.top + rule.height / 2 - B.top }, text: o.textContent, ow: O.width }
})
await page.locator('[role="slider"]').focus(); await page.keyboard.press('Escape')
const shut = await read()
await browser.close(); server.close()
const OPEN = Math.max(...open.map(a => a.duration)), SHUT = Math.max(...shut.map(a => a.duration))
const T = OPEN + HOLD_OPEN + SHUT + HOLD_SHUT

/* ---- outlines ---- */
const py = spawnSync('python3', ['-c', `
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
ms = TTFont(sys.argv[1]); cmap = ms.getBestCmap(); g2c = {g: chr(c) for c, g in cmap.items()}; lig = {}
for lu in ms['GSUB'].table.LookupList.Lookup:
  for st in lu.SubTable:
    st = getattr(st, 'ExtSubTable', st)
    for first, ligs in getattr(st, 'ligatures', {}).items():
      for l in ligs:
        try: lig[''.join(g2c[x] for x in [first] + list(l.Component))] = l.LigGlyph
        except KeyError: pass
out = {}
s = 20 / ms['head'].unitsPerEm
for fill in (0, 1):
  gs = ms.getGlyphSet(location={'FILL': fill, 'wght': 300, 'opsz': 20, 'GRAD': 0})
  for n in ('pageview', 'search', 'zoom_out', 'zoom_in'):
    p = SVGPathPen(gs); gs[lig[n]].draw(TransformPen(p, (s, 0, 0, -s, -480 * s, 480 * s))); out[f'{n}:{fill}'] = p.getCommands()
cal = TTFont(sys.argv[2]); gs = cal.getGlyphSet(); cm = cal.getBestCmap(); k = 12 / cal['head'].unitsPerEm
x = 0; chars = []; ends = []
for ch in sys.argv[3]:
  g = cm[ord(ch)]; p = SVGPathPen(gs); gs[g].draw(TransformPen(p, (k, 0, 0, -k, x, 0))); chars.append(p.getCommands()); x += gs[g].width * k; ends.append(x)
out['chars'] = chars; out['ends'] = ends; out['textW'] = x; out['cap'] = cal['OS/2'].sCapHeight * k
print(json.dumps(out))
`, join(ROOT, 'fonts', 'MaterialSymbolsOutlined.woff2'), join(ROOT, 'fonts', 'CalSansVF.ttf'), geo.text], { encoding: 'utf8' })
if (py.status) { console.error(py.stderr); process.exit(1) }
const G = JSON.parse(py.stdout)
const r2 = n => Math.round(n * 100) / 100
const path = d => d.replace(/-?\d+\.\d+/g, m => String(r2(+m)))
const PAD = 12, W = Math.ceil(geo.w + 2 * PAD), H = Math.ceil(geo.h + 2 * PAD)
const X = x => PAD + x, Y = y => PAD + y

/* ---- parsing the live values ---- */
const pxs = s => [...(s ?? '').matchAll(/-50% ([+-]) ([\d.]+)px/g)].map(m => (m[1] === '-' ? -1 : 1) * +m[2])
const scale1 = s => { const m = /scale\(([\d.]+)\)/.exec(s ?? ''); return m ? +m[1] : 1 }
const tx = s => { const m = /translateX\((-?[\d.]+)px\)/.exec(s ?? ''); return m ? +m[1] : 0 }
const inset = s => { const m = /inset\((-?[\d.]+)px(?: (-?[\d.]+)px)?(?: (-?[\d.]+)px)?(?: (-?[\d.]+)px)?/.exec(s ?? ''); if (!m) return null; const v = m.slice(1).map(x => x === undefined ? undefined : +x); const [t, r = t, b = t, l = r] = v; return { t, r, b, l } }
const fillOf = s => { const m = /"FILL" ([\d.]+)/.exec(s ?? ''); return m ? +m[1] : 0 }

/* ---- tracks: a part's live keyframes -> SVG keyframes on the loop ---- */
const css = [], checks = []
const decl = v => Object.entries(v).map(([p, x]) => `${p}:${x}`).join(';')
// conv(k) -> declarations for this part; rest -> its state while the other phase plays
function track(id, partsOpen, partsShut, conv, rest, easeOverride) {
  const at = ms => r2(ms / T * 100)
  const frames = new Map()
  const put = (ms, v, easing) => { frames.set(at(ms), decl(v) + (easing && easing !== 'linear' ? `;animation-timing-function:${easeOverride ?? easing}` : '')); checks.push([id, ms]) }
  const play = (a, start) => a.keyframes.map(k => { put(start + k.offset * a.duration, conv(k), k.easing); return conv(k) })
  let last = rest.open
  if (partsOpen) last = play(partsOpen, 0).at(-1); else put(0, rest.open)
  put(OPEN + HOLD_OPEN - 1, last)
  if (partsShut) play(partsShut, OPEN + HOLD_OPEN); else put(OPEN + HOLD_OPEN, rest.shut)
  put(T, rest.shut)
  css.push(`@keyframes ${id}{${[...frames].sort((a, b) => a[0] - b[0]).map(([p, d]) => `${p}%{${d}}`).join('')}}#${id}{animation:${id} ${T}ms linear infinite}`)
}
const pick = (set, role) => set.find(a => a.role === role)
const els = []
const glyph = (n, f = 0) => `<path d="${path(G[`${n}:${f}`])}"/>`

// the rule: the full line, scaled onto its clip
{
  const rl = geo.rule.l, rr = geo.rule.r, rw = rr - rl
  const conv = k => { const c = inset(k.clip) ?? { l: 0, r: 0 }; const s = Math.max(0, (rw - c.l - c.r) / rw); return { transform: `translate(${r2(X(rl + c.l) - s * X(rl))}px,0) scaleX(${r2(s)})` } }
  track('rule', pick(open, 'rule'), pick(shut, 'rule'), conv, { open: { transform: `translate(${r2(X(rl))}px,0) scaleX(0)` }, shut: { transform: `translate(${r2(X(rl))}px,0) scaleX(0)` } })
  els.push(`<g id="rule"><rect x="${r2(X(rl))}" y="${r2(Y(geo.rule.y) - .5)}" width="${r2(rw)}" height="1" opacity=".3"/></g>`)
}
// the buttons
for (const k of ['out', 'in']) {
  track('b' + k, pick(open, k), pick(shut, k), f => ({ opacity: f.opacity ?? 1 }), { open: { opacity: 0 }, shut: { opacity: 0 } })
  els.push(`<g transform="translate(${r2(X(geo[k].x))} ${r2(Y(geo[k].y))})" opacity=".62"><g id="b${k}">${glyph(k === 'out' ? 'zoom_out' : 'zoom_in')}</g></g>`)
}
// the mark: the rest drawing fades out exactly as the filled one fades in
{
  const m = `translate(${r2(X(geo.mark.x))} ${r2(Y(geo.mark.y))})`
  track('mfill', pick(open, 'mark'), pick(shut, 'mark'), k => ({ opacity: r2(fillOf(k.fvs)) }), { open: { opacity: 0 }, shut: { opacity: 0 } })
  track('mrest', pick(open, 'mark'), pick(shut, 'mark'), k => ({ opacity: r2(1 - fillOf(k.fvs)) }), { open: { opacity: 1 }, shut: { opacity: 1 } })
  els.push(`<g transform="${m}" opacity=".62"><g id="mrest">${glyph('pageview', 0)}</g></g>`)
  els.push(`<g transform="${m}" opacity=".62"><g id="mfill">${glyph('pageview', 1)}</g></g>`)
}
// the lozenge: ring (ground) and pill (ink), each as two caps and a middle
{
  const pw = geo.pill.w, ph = geo.pill.h, cx0 = geo.pill.x, cy = geo.pill.y
  const shape = (k, ring) => {
    const c = inset(k.clip) ?? { t: -3, r: -3, b: -3, l: -3 }
    const dx = pxs(k.transform)[0] ?? 0, op = k.opacity ?? 1
    let w = pw - c.l - c.r, h = ph - c.t - c.b
    if (c.t < 0 && !ring) { w -= 6; h -= 6 }        // the clip holds the 3px ring; the ink is inside it
    if (c.t >= 0 && ring) { w = 0; h = 0 }          // a dot has no ring
    w = Math.max(0, w); h = Math.max(0, h)
    const rad = Math.min(w, h) / 2, mid = Math.max(0, w - 2 * rad), cx = X(cx0 + dx)
    return { cx, rad, mid, h, op }
  }
  for (const ring of [true, false]) {
    const id = ring ? 'ring' : 'pill', S = k => shape(k, ring)
    const sh = { open: { opacity: 0 }, shut: { opacity: 0 } }
    // unit shapes, centred at the origin: a cap is a unit circle, the middle a unit square
    track(id + 'L', pick(open, 'pill'), pick(shut, 'pill'), k => { const s = S(k); return { transform: `translate(${r2(s.cx - s.mid / 2)}px,${r2(Y(cy))}px) scale(${r2(s.rad)})`, opacity: s.op } }, sh)
    track(id + 'R', pick(open, 'pill'), pick(shut, 'pill'), k => { const s = S(k); return { transform: `translate(${r2(s.cx + s.mid / 2)}px,${r2(Y(cy))}px) scale(${r2(s.rad)})`, opacity: s.op } }, sh)
    track(id + 'M', pick(open, 'pill'), pick(shut, 'pill'), k => { const s = S(k); return { transform: `translate(${r2(s.cx)}px,${r2(Y(cy))}px) scale(${r2(s.mid)},${r2(s.rad * 2)})`, opacity: s.op } }, sh)
    const fill = ring ? ' class="ground"' : ''
    els.push(`<g${fill}><g id="${id}L"><circle r="1"/></g><g id="${id}R"><circle r="1"/></g><g id="${id}M"><rect x="-.5" y="-.5" width="1" height="1"/></g></g>`)
  }
}
// the readout: one path per numeral, shown when the clip has reached it; the group shifts
{
  const n = G.chars.length, x0 = X(geo.pill.x) - G.textW / 2, y0 = Y(geo.pill.y) + G.cap / 2
  // the live clip is in the output's box; its text is centred in it, so numeral i ends at
  // (ow - textW)/2 + its right edge
  const ends = G.ends.map(a => (geo.ow - G.textW) / 2 + a)
  const shown = (k, i) => { const c = inset(k.clip); if (!c) return 1; return geo.ow - c.r >= ends[i] - 1.5 ? 1 : 0 }
  const pr = pick(open, 'read'), ps = pick(shut, 'read'), pp = pick(open, 'pill'), pps = pick(shut, 'pill')
  // the group's shift: the readout's own translateX, plus the pill's slide
  track('readg', pr, ps, k => ({ transform: `translate(${r2(tx(k.transform))}px,0)` }), { open: { transform: 'translate(0px,0)' }, shut: { transform: 'translate(0px,0)' } }, 'steps(1,end)')
  track('reads', pp, pps, k => ({ transform: `translate(${r2(pxs(k.transform)[0] ?? 0)}px,0)` }), { open: { transform: 'translate(0px,0)' }, shut: { transform: 'translate(0px,0)' } })
  G.chars.forEach((d, i) => track('c' + i, pr, ps, k => ({ opacity: shown(k, i) }), { open: { opacity: 0 }, shut: { opacity: 0 } }, 'steps(1,end)'))
  els.push(`<g id="reads"><g id="readg"><g class="ground" transform="translate(${r2(x0)} ${r2(y0)})">${G.chars.map((d, i) => `<g id="c${i}"><path d="${path(d)}"/></g>`).join('')}</g></g></g>`)
}
// the glasses in flight
{
  const flys = set => set.filter(a => a.role.startsWith('fly:'))
  const conv = k => { const [x = 0, y = 0] = pxs(k.transform); return { transform: `translate(${r2(x)}px,${r2(y)}px) scale(${r2(scale1(k.transform))})`, opacity: k.opacity ?? 1 } }
  const hide = { open: { opacity: 0 }, shut: { opacity: 0 } }
  flys(open).forEach((a, i) => { track('fo' + i, a, null, conv, hide); els.push(`<g transform="translate(${r2(X(geo.mark.x))} ${r2(Y(geo.mark.y))})" opacity=".62"><g id="fo${i}">${glyph(a.role.slice(4))}</g></g>`) })
  flys(shut).forEach((a, i) => { track('fs' + i, null, a, conv, hide); els.push(`<g transform="translate(${r2(X(geo.mark.x))} ${r2(Y(geo.mark.y))})" opacity=".62"><g id="fs${i}">${glyph(a.role.slice(4))}</g></g>`) })
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" role="img" aria-label="The zoom control opening out of its mark and closing back into it">
<!-- wm-primitives zoom control: open ${OPEN}ms, hold ${HOLD_OPEN}, close ${SHUT}ms, hold ${HOLD_SHUT}. Composed by scripts/zoom-morph-svg.mjs from the live keyframes; do not edit. -->
<style>svg{color:#161616;--ground:#fafafa}@media (prefers-color-scheme:dark){svg{color:#e8e8e8;--ground:#111}}
g,path,rect,circle{fill:currentColor}.ground,.ground *{fill:var(--ground)}g[id]{transform-box:view-box;transform-origin:0 0}
${css.join('\n')}
@media (prefers-reduced-motion:reduce){g[id]{animation-play-state:paused}}</style>
${els.join('\n')}
</svg>
`
await mkdir(join(ROOT, 'docs', 'assets'), { recursive: true })
await writeFile(OUT, svg)
// the check: every live keyframe time has a keyframe in the written SVG within 20ms
const written = {}
for (const m of svg.matchAll(/@keyframes (\w+)\{(.*?)\}#/g)) written[m[1]] = [...m[2].matchAll(/([\d.]+)%\{/g)].map(x => +x[1] / 100 * T)
const worst = Math.max(...checks.map(([id, ms]) => Math.min(...(written[id] ?? [Infinity]).map(w => Math.abs(w - ms)))))
if (!/animation:\w+ \d+ms linear infinite/.test(svg)) { console.error('zoom-morph-svg: the SVG has no animation'); process.exit(1) }
console.log(`zoom-morph-svg: ${OUT.replace(ROOT + '/', '')} ${(svg.length / 1024).toFixed(1)} KB; loop ${T}ms (open ${OPEN}, close ${SHUT}); ${checks.length} keyframes, worst timing error ${r2(worst)}ms`)
if (worst > 20 || svg.length > 40 * 1024) process.exit(1)
