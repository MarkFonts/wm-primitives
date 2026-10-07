#!/usr/bin/env node
/* zoom-morph-svg -- the zoom control's open/close choreography as one looping, self-contained SVG.
 *
 *   node scripts/zoom-morph-svg.mjs        -> docs/assets/zoom-morph.svg
 *
 * COMPOSED, not recorded. It mounts the real control (src/zoomControl.js + its CSS) in headless
 * Chromium, presses the mark, and reads the Web Animations the control declares -- every
 * keyframe's offset, value and easing, and each animation's duration -- plus the geometry of the
 * open control. Then it closes it (Escape) and reads the close the same way. The SVG is written
 * from those numbers: CSS keyframes, one per moving part, on a loop of
 *     open (the control's 600ms) . hold 1200 . close (its 240ms) . hold 800
 * so a change to the choreography in zoomControl.js is a re-run of this, never a redraw.
 *
 * Vector only: the marks are the subset face's own outlines (fontTools, at the control's axes:
 * wght 300, opsz 20, GRAD 0, FILL 0 and 1), the readout is Cal Sans outlines, knocked out of the
 * lozenge with a mask. currentColor throughout, and a prefers-color-scheme rule sets the colour,
 * so one file works on light and dark. Needs Playwright (devDependency) and fonttools.
 * The run checks its own output: the SVG's keyframes against the live ones (within 20ms). */
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, extname, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const OUT = join(ROOT, 'docs', 'assets', 'zoom-morph.svg')
const HOLD_OPEN = 1200, HOLD_SHUT = 800

/* ---- a server for src/ and fonts/, and a page with one collapsing control on its row ---- */
const PAGE = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
${['color', 'type', 'space', 'motion', 'icon', 'chip', 'dialHandle', 'themeSwitch', 'zoomControl'].map(n => `<link rel="stylesheet" href="/src/${n}.css">`).join('')}
<style>:root{--ui-font:system-ui;--text-rgb:232,232,232}body{margin:0;background:var(--bg)}#r{position:fixed;top:24px;right:24px}</style></head>
<body><span id="r" class="wm-theme-row"><span class="wm-zoom wm-zoom--left" data-collapse data-key="zoom-morph-svg"></span></span>
<script src="/src/zoomControl.js"></script></body></html>`
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.html': 'text/html' }
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
  const z = document.querySelector('.wm-zoom'), api = z.__wmZoom, box = z.querySelector('.wm-zoom-box').getBoundingClientRect()
  const role = el => el.classList.contains('wm-zoom-fly') ? 'fly:' + el.textContent
    : el.classList.contains('wm-hd-pill') ? 'pill' : el.tagName === 'OUTPUT' ? 'read' : el.tagName === 'I' ? 'rule'
    : el.closest('.wm-zoom-toggle') ? 'mark' : el.getAttribute('aria-label') === 'Zoom out' ? 'out' : 'in'
  const anims = api.morph().map(a => ({ role: role(a.effect.target), duration: a.effect.getTiming().duration,
    keyframes: a.effect.getKeyframes().map(k => ({ offset: k.computedOffset, easing: k.easing, transform: k.transform, opacity: k.opacity, fvs: k.fontVariationSettings })) }))
  return { anims, box: { x: box.left, y: box.top, w: box.width, h: box.height } }
})
await page.click('.wm-zoom-toggle')
const open = await read()
await page.evaluate(() => document.querySelector('.wm-zoom').__wmZoom.morph().forEach(a => a.finish()))
await page.waitForTimeout(50)
const geo = await page.evaluate(() => {
  const z = document.querySelector('.wm-zoom'), B = z.querySelector('.wm-zoom-box').getBoundingClientRect()
  const c = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - B.left, y: r.top + r.height / 2 - B.top, w: r.width, h: r.height } }
  const rule = z.querySelector('.wm-hd-rail > i').getBoundingClientRect()
  return { w: B.width, h: B.height, mark: c(z.querySelector('.wm-zoom-toggle .wm-icon')), out: c(z.querySelector('[aria-label="Zoom out"] .wm-icon')),
    in: c(z.querySelector('[aria-label="Zoom in"] .wm-icon')), pill: c(z.querySelector('.wm-hd-pill')),
    rule: { l: rule.left - B.left, r: rule.right - B.left, y: rule.top + rule.height / 2 - B.top }, text: z.querySelector('output').textContent }
})
await page.locator('[role="slider"]').focus(); await page.keyboard.press('Escape')
const shut = await read()
await browser.close(); server.close()
const OPEN = Math.max(...open.anims.map(a => a.duration)), SHUT = Math.max(...shut.anims.map(a => a.duration))
const T = OPEN + HOLD_OPEN + SHUT + HOLD_SHUT

/* ---- outlines: the marks from the subset at the control's axes, the readout in Cal Sans ---- */
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
  for n in ('pageview', 'zoom_out', 'zoom_in'):
    p = SVGPathPen(gs); gs[lig[n]].draw(TransformPen(p, (s, 0, 0, -s, -480 * s, 480 * s))); out[f'{n}:{fill}'] = p.getCommands()
cal = TTFont(sys.argv[2]); gs = cal.getGlyphSet(); cm = cal.getBestCmap(); k = 12 / cal['head'].unitsPerEm
x = 0; parts = []
for ch in sys.argv[3]:
  g = cm[ord(ch)]; p = SVGPathPen(gs); gs[g].draw(TransformPen(p, (k, 0, 0, -k, x, 0))); parts.append(p.getCommands()); x += gs[g].width * k
out['text'] = ' '.join(parts); out['textW'] = x
asc = cal['OS/2'].sCapHeight * k; out['cap'] = asc
print(json.dumps(out))
`, join(ROOT, 'fonts', 'MaterialSymbolsOutlined.woff2'), join(ROOT, 'fonts', 'CalSansVF.ttf'), geo.text], { encoding: 'utf8' })
if (py.status) { console.error(py.stderr); process.exit(1) }
const G = JSON.parse(py.stdout)
const r2 = n => Math.round(n * 100) / 100
const path = d => d.replace(/-?\d+\.\d+/g, m => String(r2(+m)))

/* ---- the keyframes, mapped onto the loop ---- */
const num = (s, re, d) => { const m = re.exec(s ?? ''); return m ? parseFloat(m[1]) : d }
// a live keyframe -> this part's SVG transform/opacity
const conv = {
  fly: k => { const t = k.transform ?? ''; const xs = [...t.matchAll(/-50% ([+-]) ([\d.]+)px/g)].map(m => (m[1] === '-' ? -1 : 1) * +m[2]); const s = num(t, /scale\(([\d.]+)/, 1)
    return { transform: `translate(${r2(xs[0] ?? 0)}px,${r2(xs[1] ?? 0)}px) scale(${r2(s)})`, opacity: k.opacity } },
  pill: k => { if (!k.transform) return { opacity: k.opacity }; const sx = /-50% ([+-]) ([\d.]+)px/.exec(k.transform), x = sx ? (sx[1] === '-' ? -1 : 1) * +sx[2] : 0; const m = /scale\(([\d.]+), ([\d.]+)\)/.exec(k.transform)
    return { transform: `translate(${r2(x)}px,0) scale(${m ? r2(+m[1]) : 1},${m ? r2(+m[2]) : 1})`, opacity: k.opacity } },
  rule: k => ({ transform: `scaleX(${r2(num(k.transform, /scaleX\(([\d.]+)\)/, 1))})` }),
  read: k => ({ opacity: k.opacity }),
  out: k => ({ opacity: k.opacity }), in: k => ({ opacity: k.opacity }),
  // FILL on the live mark is a font axis; here it is the two drawings, cross-faded
  mark: k => ({ opacity: num(k.fvs, /"FILL" ([\d.]+)/, 0) }),
}
const decl = v => Object.entries(v).filter(([, x]) => x !== undefined && x !== null && x !== '').map(([p, x]) => `${p}:${x}`).join(';')
const REST = { pill: { opacity: 0 }, rule: { transform: 'scaleX(0)' }, read: { opacity: 0 }, out: { opacity: 0 }, in: { opacity: 0 }, mark: { opacity: 0 } }
const HIDE = { opacity: 0 }
const checks = []
function track(id, kind, o, c) {
  const at = ms => r2(ms / T * 100) + '%'
  const frames = []
  const push = (ms, v, easing) => frames.push(`${at(ms)}{${decl(v)}${easing && easing !== 'linear' ? `;animation-timing-function:${easing}` : ''}}`)
  const rest = REST[kind] ?? HIDE
  const seg = (a, start) => a.keyframes.map(k => { const ms = start + k.offset * a.duration; checks.push([id, ms]); push(ms, conv[kind](k), k.easing); return conv[kind](k) })
  // the holds end 1ms before the close begins: two keyframes at one percentage collapse to the last
  if (o) { const v = seg(o, 0); push(OPEN + HOLD_OPEN - 1, v.at(-1)) } else { push(0, rest); push(OPEN + HOLD_OPEN - 1, rest) }
  if (c) { const v = seg(c, OPEN + HOLD_OPEN); push(T, kind.startsWith('fly') ? HIDE : rest); void v } else { push(OPEN + HOLD_OPEN + SHUT, rest); push(T, rest) }
  return `@keyframes ${id}{${frames.join('')}}#${id}{animation:${id} ${T}ms linear infinite}`
}
const find = (set, role) => set.anims.find(a => a.role === role)
const openFly = open.anims.filter(a => a.role.startsWith('fly:')), shutFly = shut.anims.filter(a => a.role.startsWith('fly:'))

/* ---- the drawing ---- */
const PAD = 12, W = Math.ceil(geo.w + 2 * PAD), H = Math.ceil(geo.h + 2 * PAD)
const at = p => `translate(${r2(PAD + p.x)} ${r2(PAD + p.y)})`
const glyph = (n, f = 0) => `<path d="${path(G[`${n}:${f}`])}"/>`
const css = []
const els = []
// the rule: a hairline from the left end to the right, drawn leftwards from its right end
css.push(track('rule', 'rule', find(open, 'rule'), find(shut, 'rule')))
els.push(`<g transform="translate(${r2(PAD + geo.rule.r)} ${r2(PAD + geo.rule.y)})"><g id="rule"><rect x="${r2(geo.rule.l - geo.rule.r)}" y="-.5" width="${r2(geo.rule.r - geo.rule.l)}" height="1" opacity=".3"/></g></g>`)
// the buttons
for (const k of ['out', 'in']) {
  css.push(track('b' + k, k, find(open, k), find(shut, k)))
  els.push(`<g transform="${at(geo[k])}" opacity=".62"><g id="b${k}">${glyph(k === 'out' ? 'zoom_out' : 'zoom_in')}</g></g>`)
}
// the mark: unfilled always under, filled cross-faded over it
css.push(track('mfill', 'mark', find(open, 'mark'), find(shut, 'mark')))
els.push(`<g transform="${at(geo.mark)}" opacity=".62">${glyph('pageview', 0)}</g>`)   // the rest drawing never leaves
els.push(`<g transform="${at(geo.mark)}"><g id="mfill">${glyph('pageview', 1)}</g></g>`)
// the lozenge, with the readout knocked out of it
const ph = geo.pill.h, pw = geo.pill.w
css.push(track('pill', 'pill', find(open, 'pill'), find(shut, 'pill')))
css.push(track('read', 'read', find(open, 'read'), find(shut, 'read')))
els.push(`<mask id="knock" maskUnits="userSpaceOnUse" x="${-pw}" y="${-ph}" width="${2 * pw}" height="${2 * ph}"><rect x="${-pw}" y="${-ph}" width="${2 * pw}" height="${2 * ph}" fill="#fff"/><g id="read" fill="#000"><path transform="translate(${r2(-G.textW / 2)} ${r2(G.cap / 2)})" d="${path(G.text)}"/></g></mask>`)
els.push(`<g transform="${at(geo.pill)}"><g id="pill"><rect x="${r2(-pw / 2)}" y="${r2(-ph / 2)}" width="${r2(pw)}" height="${r2(ph)}" rx="${r2(ph / 2)}" mask="url(#knock)"/></g></g>`)
// the magnifiers in flight: three on the way out, two on the way home
openFly.forEach((a, i) => { const id = 'fo' + i; css.push(track(id, 'fly', a, null)); els.push(`<g transform="${at(geo.mark)}" opacity=".62"><g id="${id}">${glyph(a.role.slice(4))}</g></g>`) })
shutFly.forEach((a, i) => { const id = 'fs' + i; css.push(track(id, 'fly', null, a)); els.push(`<g transform="${at(geo.mark)}" opacity=".62"><g id="${id}">${glyph(a.role.slice(4))}</g></g>`) })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" role="img" aria-label="The zoom control opening out of its mark and closing back into it">
<!-- wm-primitives zoom control: open ${OPEN}ms, hold ${HOLD_OPEN}, close ${SHUT}ms, hold ${HOLD_SHUT}. Composed by scripts/zoom-morph-svg.mjs from the live keyframes; do not edit. -->
<style>svg{color:#161616}@media (prefers-color-scheme:dark){svg{color:#e8e8e8}}g,path,rect{fill:currentColor}#knock rect{fill:#fff}#read,#read *{fill:#000}g[id]{transform-box:view-box;transform-origin:0 0}
${css.join('\n')}
@media (prefers-reduced-motion:reduce){g[id]{animation-play-state:paused}}</style>
${els.join('\n')}
</svg>
`
await mkdir(join(ROOT, 'docs', 'assets'), { recursive: true })
await writeFile(OUT, svg)
// the check: read the keyframe percentages back out of the written SVG and hold every live keyframe
// time to one of them
const written = {}
for (const m of svg.matchAll(/@keyframes (\w+)\{(.*?)\}#/g)) written[m[1]] = [...m[2].matchAll(/([\d.]+)%\{/g)].map(x => +x[1] / 100 * T)
const worst = Math.max(...checks.map(([id, ms]) => Math.min(...(written[id] ?? [Infinity]).map(w => Math.abs(w - ms)))))
if (!/animation:\w+ \d+ms linear infinite/.test(svg)) { console.error('zoom-morph-svg: the SVG has no animation'); process.exit(1) }
console.log(`zoom-morph-svg: ${OUT.replace(ROOT + '/', '')} ${(svg.length / 1024).toFixed(1)} KB; loop ${T}ms (open ${OPEN}, close ${SHUT}); ${checks.length} keyframes, worst timing error ${worst}ms`)
if (worst > 20) process.exit(1)
