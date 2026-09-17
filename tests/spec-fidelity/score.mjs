#!/usr/bin/env node
/* The mechanical half of rubric.md. Usage: node score.mjs <run-dir> */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
const RUN = resolve(process.argv[2]); const STUB = join(RUN, 'stub')
const sh = (c, o = {}) => { try { return execSync(c, { cwd: STUB, stdio: 'pipe', ...o }).toString() } catch (e) { return 'ERR ' + (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '') } }
const out = {}
out.build = sh('npx tsc --noEmit && npx vite build').startsWith('ERR') ? 'FAILS' : 'ok'
const diff = sh('git -C shared diff --stat && git -C shared status --short')
out.sharedTouched = diff.trim() ? diff.trim().split('\n').slice(0, 8).join(' | ') : 'untouched'
const src = sh('cat src/*.tsx src/*.css 2>/dev/null')
out.tagProp = /tag=["'{]/.test(src) ? 'tag= used' : 'no tag prop'
out.allowAuto = /allowAuto/.test(src) ? 'allowAuto' : 'no allowAuto'
out.layered = /@layer\s+wm/.test(src) ? 'WROTE INSIDE @layer wm' : 'no wm layer'
out.important = /!important/.test(src) ? '!important' : 'no !important'
out.accentToken = /--accent\s*:/.test(src) ? '--accent set' : 'no --accent'
out.inkToken = /--ink-quiet|t-quiet|ink-quiet/.test(src) ? 'ink token' : 'no ink token'
const kd = sh("git -C shared diff -U0 -- src/AxisSlider.tsx | grep -c \"^+.*'0'\\|^+.*\\\"0\\\"\" || true").trim()
out.t3zeroKey = kd !== '0' && !kd.startsWith('ERR') ? `zero-key edit in AxisSlider.tsx (+${kd})` : 'no zero-key edit in AxisSlider.tsx'
out.t3gestures = sh('git -C shared diff --stat -- GESTURES.md').trim() ? 'GESTURES.md edited' : 'GESTURES.md not edited'
out.notes = existsSync(join(RUN, 'NOTES.md')) ? `${readFileSync(join(RUN, 'NOTES.md'), 'utf8').length} chars` : 'MISSING'
if (out.build === 'ok') {
  const shot = `
import { chromium } from '${resolve(process.cwd(), 'node_modules/@playwright/test/index.mjs')}'
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path'
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.ttf':'font/ttf', '.woff2':'font/woff2', '.avif':'image/avif' }
const srv = createServer(async (q, r) => { let f = join('dist', q.url === '/' ? 'index.html' : q.url); try { r.writeHead(200, {'content-type': T[extname(f)] ?? 'application/octet-stream'}); r.end(await readFile(f)) } catch { r.writeHead(404); r.end() } }).listen(4322)
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 260 } })
await p.goto('http://localhost:4322/'); await p.waitForTimeout(500); await p.screenshot({ path: '${join(RUN, 'shot.png')}' })
console.log(JSON.stringify(await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.slider-row')]
  const rights = rows.map(r => r.querySelector('input.slider-number')?.getBoundingClientRect().right ?? null)
  const rails = rows.map(r => { const t = r.querySelector('input[type=range]'); if (!t) return false; const s = getComputedStyle(t); return t.getBoundingClientRect().height > 0 && s.visibility !== 'hidden' })
  return { rows: rows.length, rightEdges: rights.map(x => x && Math.round(x * 10) / 10), railsPresent: rails, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }
}))); await b.close(); srv.close()`
  const r = sh(`node --input-type=module -e "${shot.replace(/"/g, '\\"')}"`)
  out.render = r.trim()
}
console.log(JSON.stringify(out, null, 1))
