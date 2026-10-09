#!/usr/bin/env node
/* confirm-svg -- the click confirm (GESTURES.md §14) on a chip pair, as one looping SVG.
 *
 *   node scripts/confirm-svg.mjs        -> docs/assets/confirm.svg
 *   CONFIRM_PHASE=640 CONFIRM_OUT=docs/assets/confirm-slow.svg node scripts/confirm-svg.mjs
 *                                       -> the same loop at x8, for the docs: 80ms is a blink
 *                                          the eye cannot read inside a 3s loop
 *
 * COMPOSED, not recorded, like zoom-morph-svg.mjs. It mounts two real chips (src/chip.css +
 * motion.css, the labels in Cal Sans) in headless Chromium and reads their boxes, their label
 * baselines and --dur-confirm; the labels are outlined from CalSansVF at the chips' own axes
 * (opsz 12, wght 400 at rest / 600 chosen) with fontTools. The loop:
 *     Text chosen, hold . press Display: it is chosen, its fill OFF one phase, ON one phase,
 *     settled, hold . press Text: the same . back to the start
 * Each chip is four drawings -- rest (outline, regular), pressed (the :active acknowledgement,
 * G92: the edge in full ink over a 12% wash), off (outline, bold: the weight does not blink),
 * chosen (fill, bold, ground ink) -- switched by opacity on steps, never faded, because the
 * confirm is a blink. The press is held for two phases before the release, so the loop reads
 * press -> undo -> redo -> settle. currentColor plus a prefers-color-scheme rule. */
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, extname, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const OUT = process.env.CONFIRM_OUT ? resolve(ROOT, process.env.CONFIRM_OUT) : join(ROOT, 'docs', 'assets', 'confirm.svg')
const HOLD = 1000, SETTLE = 1000
const LABELS = ['Text', 'Display']

const PAGE = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
${['color', 'type', 'motion', 'chip'].map(n => `<link rel="stylesheet" href="/src/${n}.css">`).join('')}
<style>@font-face{font-family:CalSans;src:url(/fonts/CalSansVF.ttf);font-weight:400 700}
:root{--ui-font:CalSans}body{margin:0;background:var(--bg)}#r{position:fixed;top:24px;left:24px}</style></head>
<body><div id="r" class="wm-chip-row">${LABELS.map((l, i) => `<button class="wm-chip${i ? '' : ' on'}" data-label="${l}">${l}</button>`).join('')}</div></body></html>`
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.ttf': 'font/ttf', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE) }
  try { const b = await readFile(join(ROOT, decodeURIComponent(path))); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(b) }
  catch { res.writeHead(404); res.end() }
}).listen(0)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 120 } })
await page.goto(`http://localhost:${server.address().port}/`); await page.evaluate(() => document.fonts.ready)
const geo = await page.evaluate(() => {
  const row = document.getElementById('r').getBoundingClientRect()
  const chips = [...document.querySelectorAll('.wm-chip')].map(c => {
    const b = c.getBoundingClientRect(), cs = getComputedStyle(c)
    const rg = document.createRange(); rg.selectNodeContents(c.firstChild); const t = rg.getBoundingClientRect()
    return { x: b.left - row.left, y: b.top - row.top, w: b.width, h: b.height, r: Math.min(parseFloat(cs.borderTopLeftRadius), b.height / 2),
      size: parseFloat(cs.fontSize), top: t.top - row.top, cx: b.left + b.width / 2 - row.left }
  })
  return { w: row.width, h: row.height, chips, phase: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-confirm')) }
})
await browser.close(); server.close()
const P = +process.env.CONFIRM_PHASE || geo.phase   // 80; CONFIRM_PHASE=640 makes the slowed docs loop

const py = spawnSync('python3', ['-c', `
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
f = TTFont(sys.argv[1]); cm = f.getBestCmap(); upm = f['head'].unitsPerEm; size = float(sys.argv[2])
k = size / upm; out = {'asc': f['hhea'].ascent * k}
for w in (400, 600):
  gs = f.getGlyphSet(location={'wght': w, 'opsz': size})
  for word in sys.argv[3:]:
    x = 0; d = []
    for ch in word:
      g = cm[ord(ch)]; p = SVGPathPen(gs); gs[g].draw(TransformPen(p, (k, 0, 0, -k, x, 0))); d.append(p.getCommands()); x += gs[g].width * k
    out[f'{word}:{w}'] = {'d': ' '.join(d), 'w': x}
print(json.dumps(out))
`, join(ROOT, 'fonts', 'CalSansVF.ttf'), String(geo.chips[0].size), ...LABELS], { encoding: 'utf8' })
if (py.status) { console.error(py.stderr); process.exit(1) }
const G = JSON.parse(py.stdout)
const r2 = n => Math.round(n * 100) / 100
const path = d => d.replace(/-?\d+\.\d+/g, m => String(r2(+m)))

/* the loop, in ms: [0, A) Text chosen; A Display pressed; B Text pressed; T back to the start */
const PRESS = 2 * P   // how long the press is held before the release that confirms
const A = HOLD + PRESS, B = A + 2 * P + SETTLE + PRESS, T = B + 2 * P + SETTLE
const pct = ms => `${r2(ms / T * 100)}%`
// a chip's state at each moment: which of its four drawings shows
function states(i) {
  return i === 1
    ? [[0, 'rest'], [A - PRESS, 'pressed'], [A, 'off'], [A + P, 'on'], [B, 'rest']]
    : [[0, 'on'], [A, 'rest'], [B - PRESS, 'pressed'], [B, 'off'], [B + P, 'on']]
}
const PAD = 6, W = Math.ceil(geo.w + 2 * PAD), H = Math.ceil(geo.h + 2 * PAD)
const css = [], body = []
const rect = (c, cls) => `<rect class="${cls}" x="${r2(PAD + c.x + (cls.startsWith('edge') ? .5 : 0))}" y="${r2(PAD + c.y + (cls.startsWith('edge') ? .5 : 0))}" width="${r2(c.w - (cls.startsWith('edge') ? 1 : 0))}" height="${r2(c.h - (cls.startsWith('edge') ? 1 : 0))}" rx="${r2(c.r - (cls.startsWith('edge') ? .5 : 0))}"/>`
const label = (c, word, w, cls) => { const g = G[`${word}:${w}`]; return `<path class="${cls}" transform="translate(${r2(PAD + c.cx - g.w / 2)} ${r2(PAD + c.top + G.asc)})" d="${path(g.d)}"/>` }
geo.chips.forEach((c, i) => {
  const word = LABELS[i], st = states(i)
  const draw = {
    rest: rect(c, 'edge') + label(c, word, 400, 'ink'),
    pressed: rect(c, 'wash') + rect(c, 'edge full') + label(c, word, 400, 'fill'),
    off:  rect(c, 'edge') + label(c, word, 600, 'ink'),
    on:   rect(c, 'fill') + label(c, word, 600, 'ground'),
  }
  for (const s of ['rest', 'pressed', 'off', 'on']) {
    const id = `c${i}${s}`
    const frames = st.map(([ms, v]) => `${pct(ms)}{opacity:${v === s ? 1 : 0}}`)
    css.push(`@keyframes ${id}{${frames.join('')}100%{opacity:${st[0][1] === s ? 1 : 0}}}#${id}{animation:${id} ${T}ms step-end infinite}`)
    body.push(`<g id="${id}">${draw[s]}</g>`)
  }
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" role="img" aria-label="A chip is pressed, then confirms: the press look goes off, the fill comes on, then it settles">
<!-- wm-primitives click confirm (GESTURES.md §14): off ${P}ms, on ${P}ms, then settle${P !== geo.phase ? `; SLOWED x${P / geo.phase}, the real phase is ${geo.phase}ms` : ''}. Composed by scripts/confirm-svg.mjs from the live chips; do not edit. -->
<style>svg{color:#161616;--ground:#fafafa}@media (prefers-color-scheme:dark){svg{color:#e8e8e8;--ground:#111}}
.fill{fill:currentColor}.edge{fill:none;stroke:currentColor;stroke-width:1;stroke-opacity:.38}.edge.full{stroke-opacity:1}.wash{fill:currentColor;fill-opacity:.12}.ink{fill:currentColor;fill-opacity:.62}.ground{fill:var(--ground)}
${css.join('\n')}</style>
${body.join('\n')}
</svg>
`
await mkdir(join(ROOT, 'docs', 'assets'), { recursive: true })
await writeFile(OUT, svg)
console.log(`${OUT.slice(ROOT.length + 1)}  ${W}x${H}  loop ${T}ms  phase ${P}ms  ${(svg.length / 1024).toFixed(1)} KB`)
