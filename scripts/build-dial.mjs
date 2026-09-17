#!/usr/bin/env node
/* Bundle the dial for pages without React: dist/dial.js (IIFE, global wmDial) and
   dist/dial.css. One source -- src/AxisSlider.tsx -- a second output. Committed, because
   the consumers that need it (Kernpare, opsz-proofer) run no npm; consumers.yml fails
   if the committed bundle is stale against the source. */
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
const r = await build({
  entryPoints: ['src/dial-entry.tsx'],
  bundle: true,
  format: 'iife',
  globalName: 'wmDial',
  outfile: 'dist/dial.js',
  minify: true,
  sourcemap: false,
  target: ['es2022'],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
  // Font and image URLs stay as written: dist/ sits beside src/, so '../fonts/…' resolves
  // the same from either, and the host serves shared/ whole.
  external: ['*.woff2', '*.ttf', '*.avif', '*.png', '*.svg'],
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
})
const js = readFileSync('dist/dial.js', 'utf8')
// A one-line provenance header, so a copy found in a consumer can be traced.
writeFileSync('dist/dial.js', `/* wm-primitives dial -- built from src/AxisSlider.tsx by scripts/build-dial.mjs; do not edit */\n` + js)
const out = r.metafile.outputs
for (const [f, o] of Object.entries(out)) console.log(f.padEnd(16), (o.bytes / 1024).toFixed(1) + ' KB')
