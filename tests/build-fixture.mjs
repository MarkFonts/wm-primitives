#!/usr/bin/env node
/* Bundle a React fixture for tests/behaviour: tests/fixtures/<name>-entry.tsx ->
   tests/fixtures/.build/<name>.js + .css (gitignored). Served by tests/serve.mjs at
   /dial/.build/. The specs call build() in beforeAll, so a run never sees a stale bundle.
   GlyphPicker's name pages load through Vite's import.meta.glob; esbuild has no such
   thing, so glyphNames.ts gets a dynamic import() that esbuild can bundle instead. */
import { build as esbuild } from 'esbuild'
import { readFileSync } from 'node:fs'

const viteGlob = {
  name: 'vite-glob',
  setup(b) {
    b.onLoad({ filter: /glyphNames\.ts$/ }, args => ({
      loader: 'ts',
      contents: readFileSync(args.path, 'utf8').replace(
        /import\.meta\.glob<[^>]*>\('\.\/glyphNames\/page-\*\.ts'\)/,
        "new Proxy({}, { get: (_, k) => () => import(`./glyphNames/page-${String(k).match(/page-(\\d+)/)[1]}.ts`) })",
      ),
    }))
  },
}

export async function build(name) {
  await esbuild({
    entryPoints: [`tests/fixtures/${name}-entry.tsx`],
    bundle: true,
    format: 'iife',
    outfile: `tests/fixtures/.build/${name}.js`,
    target: ['es2022'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    external: ['*.woff2', '../fonts/*', '*.ttf', '*.avif', '*.png', '*.svg'],
    plugins: [viteGlob],
    logLevel: 'warning',
  })
}

if (import.meta.url === `file://${process.argv[1]}`) await build(process.argv[2] ?? 'collections')
