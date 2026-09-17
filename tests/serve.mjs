#!/usr/bin/env node
/* One static server for every consumer's dist/, each at the base path it deploys to.
   The tests screenshot the BUILT app -- the thing that ships -- not a dev server, and
   they need two hosts at once to compare them, which vite preview cannot do. Paths come
   from the environment so CI can point at fresh checkouts and a laptop at siblings. */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, resolve } from 'node:path'

const HOSTS = {
  '/font-proofer': process.env.FONT_PROOFER_DIST ?? resolve('../font-proofer/dist'),
  '/recalsans':    process.env.RECAL_DIST        ?? resolve('../ReCal/dist'),
}
const PORT = Number(process.env.PORT ?? 4173)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.txt': 'text/plain', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' }

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const base = Object.keys(HOSTS).find(b => url.pathname === b || url.pathname.startsWith(b + '/'))
  if (!base) { res.writeHead(404); return res.end('no such host: ' + url.pathname) }
  const root = HOSTS[base]
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || '/'
  let file = join(root, rel)
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = join(file, 'index.html')
  } catch { file = join(root, 'index.html') }      // SPA fallback
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(body)
  } catch { res.writeHead(404); res.end() }
}).listen(PORT, () => {
  for (const [b, r] of Object.entries(HOSTS)) console.log(`http://localhost:${PORT}${b}/  ->  ${r}`)
})
