#!/usr/bin/env node
/* One static server for every consumer's dist/, each at the base path it deploys to.
   The tests screenshot the BUILT app -- the thing that ships -- not a dev server, and
   they need two hosts at once to compare them, which vite preview cannot do. Paths come
   from the environment so CI can point at fresh checkouts and a laptop at siblings. */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, resolve } from 'node:path'

const HOSTS = {
  '/font-proofer': { root: process.env.FONT_PROOFER_DIST ?? resolve('../font-proofer/dist'), spa: true },
  '/recalsans':    { root: process.env.RECAL_DIST        ?? resolve('../ReCal/dist'),        spa: true },
  // Static pages: a missing file is a 404, not index.html -- kernpare fetches JSON and
  // would otherwise be handed HTML to parse.
  '/opsz-proofer': { root: process.env.OPSZ_PROOFER_DIST ?? resolve('../wordmarktools/opsz-proofer/dist'), spa: false },
  '/kernpare':     { root: process.env.KERNPARE_DIR      ?? resolve('../wordmarktools/kernpare'),          spa: false },
  // The grid's demo page (docs/grid.html, src/ inlined) and the first page on the grid,
  // the Cal Sans case study: the wordmark site, with its shared/ pointed at this commit.
  '/grid':         { root: resolve('docs'), spa: false },
  '/wordmark':     { root: process.env.WORDMARK_DIR ?? resolve('../wordmark'), spa: false },
  // The bundle's contract fixture: this repo as a page without React.
  '/dial':         { root: resolve('tests/fixtures'), spa: false, shared: resolve('.') },
}
const PORT = Number(process.env.PORT ?? 4173)
// <script async src="https://www.googletagmanager.com/gtag/js?id=..."></script>, any attribute order
const GTAG = /<script\b[^>]*\bsrc=["']https:\/\/www\.googletagmanager\.com\/[^"']*["'][^>]*>\s*<\/script>/gi
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.txt': 'text/plain', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' }

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const base = Object.keys(HOSTS).find(b => url.pathname === b || url.pathname.startsWith(b + '/'))
  if (!base) { res.writeHead(404); return res.end('no such host: ' + url.pathname) }
  const { root, spa, shared } = HOSTS[base]
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || '/'
  if (rel === '/' && base === '/dial') rel = '/dial.html'
  let file = shared && rel.startsWith('/shared/') ? join(shared, rel.slice('/shared/'.length)) : join(root, rel)
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = join(file, 'index.html')
  } catch { if (spa) file = join(root, 'index.html') }      // SPA fallback
  try {
    let body = await readFile(file)
    // NO ANALYTICS FROM TESTS. The hosts ship their Google tag in the HTML, so every test
    // page load used to count as a visitor in the live GA properties: in the week to
    // 2026-11-11 about a third of wordmark.nyc's users were these runs (/font-proofer/,
    // /wordmark/..., one view each, 0s). Dropping the loader script is enough -- the inline
    // gtag() stub only queues into dataLayer and sends nothing without it -- and it has no
    // effect on layout or paint, so what the tests see is still what ships.
    if (extname(file) === '.html') body = Buffer.from(String(body).replace(GTAG, '<!-- gtag.js removed by tests/serve.mjs -->'))
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(body)
  } catch { res.writeHead(404); res.end() }
}).listen(PORT, () => {
  for (const [b, r] of Object.entries(HOSTS)) console.log(`http://localhost:${PORT}${b}/  ->  ${r}`)
})
