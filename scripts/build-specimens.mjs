#!/usr/bin/env node
/* build-specimens — split each authored specimen into the chunks the apps fetch.
 *
 * A work is authored as ONE file, `specimens/<slug>.txt`, because that is where it is
 * readable and editable: drop a public-domain text in, mark where it may pause, commit.
 * What ships is different — a proof must not pull a whole novel across the wire to show
 * two chapters — so this splits that one file into `specimens/<slug>/00.txt`, `01.txt`,
 * … and the app fetches only as far as the reader asks.
 *
 * The break is U+000C FORM FEED: the plain-text "break here" control, invisible, already
 * used as a page break by the Gutenberg texts these come from, and impossible to collide
 * with prose. `--- break ---` on its own line does the same thing if you want to see it.
 *
 * Format inside a chunk: blank line separates blocks, `# ` is an h1, `## ` an h2.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'specimens')
const BREAK = /\f|^--- break ---$/m

if (!existsSync(DIR)) { console.error('build-specimens: no specimens/ directory'); process.exit(1) }

let total = 0
for (const file of readdirSync(DIR).filter(f => f.endsWith('.txt'))) {
  const slug = file.replace(/\.txt$/, '')
  const text = readFileSync(join(DIR, file), 'utf8')
  const chunks = text.split(BREAK).map(c => c.trim()).filter(Boolean)
  const out = join(DIR, slug)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  chunks.forEach((c, i) => writeFileSync(join(out, String(i).padStart(2, '0') + '.txt'), c + '\n'))
  const kb = chunks.map(c => (c.length / 1024).toFixed(1) + 'K').join(' + ')
  console.log(`  ${slug}: ${chunks.length} chunk${chunks.length > 1 ? 's' : ''} — ${kb}`)
  total += chunks.length
}
console.log(`build-specimens: ${total} chunks`)
