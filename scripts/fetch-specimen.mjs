#!/usr/bin/env node
/* fetch-specimen — pull a public-domain work from Project Gutenberg into specimens/.
 *
 *   node scripts/fetch-specimen.mjs 98 tale-of-two-cities
 *
 * Takes the HTML edition, not the plain text: PG's HTML marks chapters as headings, and
 * guessing chapter breaks out of a flat text file is exactly the kind of thing that
 * silently gets one wrong in the middle of a novel.
 *
 * The WORK is public domain. Project Gutenberg's licence header and footer are not part
 * of it and are stripped — what lands in the repo is the text, with a provenance line in
 * the commit rather than a trademark notice in the specimen.
 *
 * Chapter breaks become FORM FEEDs, so the first two chapters are what an app loads and
 * the rest waits for "read more". Re-run build-specimens.mjs after this.
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const [id, slug, firstStr, restStr] = process.argv.slice(2)
if (!id || !slug) { console.error('usage: fetch-specimen.mjs <gutenberg-id> <slug> [first-chunk-words] [later-chunk-words]'); process.exit(1) }
// Breaks are placed by WORD COUNT, snapped forward to the next heading. Counting
// chapters does not survive contact with Project Gutenberg: book divisions and chapters
// carry the same heading level, front matter adds more, and "after chapter 2" landed in
// the table of contents. Words are the thing a reader actually receives.
const FIRST = Number(firstStr ?? 1200)   // enough to fill a column and start reading
const REST = Number(restStr ?? 8000)     // each "read more" after that

const url = `https://www.gutenberg.org/files/${id}/${id}-h/${id}-h.htm`
const res = await fetch(url)
if (!res.ok) { console.error(`fetch-specimen: ${url} → ${res.status}`); process.exit(1) }
let html = await res.text()

// PG wraps the work in these markers. Everything outside them is their licence.
const start = html.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK/i)
const end = html.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i)
if (start === -1 || end === -1) { console.error('fetch-specimen: could not find the PG start/end markers'); process.exit(1) }
html = html.slice(start, end)

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
                   lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' }
const clean = s => s
  .replace(/<br\s*\/?>/gi, ' ')
  // Local emphasis survives as the apps' own inline markup. A phrase the author set in
  // italic is not decoration — it is the reason that paragraph looks the way it does,
  // and a specimen that flattens it is showing the wrong text.
  .replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
    const t = inner.replace(/<[^>]+>/g, '').trim()
    return t ? `*${t}*` : ''
  })
  .replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
    const t = inner.replace(/<[^>]+>/g, '').trim()
    return t ? `**${t}**` : ''
  })
  .replace(/<[^>]+>/g, '')
  .replace(/&([a-z]+);/gi, (m, e) => entities[e.toLowerCase()] ?? m)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/\s+/g, ' ')
  .trim()

const blocks = []
// PG's front matter carries a "Contents" heading followed by one short block per chapter.
// In a proof those read as fifty stray one-line paragraphs before the book starts, so
// everything from that heading to the next one is dropped.
let inContents = false
for (const m of html.matchAll(/<(h1|h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
  const text = clean(m[2])
  if (!text) continue
  const tag = m[1].toLowerCase()
  const type = tag === 'p' ? 'p' : tag === 'h1' ? 'h1' : 'h2'
  if (type !== 'p') inContents = /^contents$/i.test(text)
  if (inContents) continue
  blocks.push({ type, text })
}
if (blocks.length < 20) { console.error(`fetch-specimen: only ${blocks.length} blocks parsed — check the source`); process.exit(1) }

const lines = []
let since = 0, breaks = 0, chapters = 0
for (const b of blocks) {
  if (b.type === 'h2') chapters += 1
  const quota = breaks === 0 ? FIRST : REST
  if (b.type !== 'p' && since >= quota) { lines.push('\f'); breaks += 1; since = 0 }
  lines.push((b.type === 'h1' ? '# ' : b.type === 'h2' ? '## ' : '') + b.text)
  since += b.text.split(/\s+/).length
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'specimens', `${slug}.txt`)
writeFileSync(out, lines.join('\n\n') + '\n')
const words = lines.reduce((n, l) => n + l.split(/\s+/).length, 0)
console.log(`fetch-specimen: ${slug} — ${blocks.length} blocks, ${chapters} chapters, ~${words.toLocaleString()} words`)
console.log(`  ${breaks + 1} chunks (first ~${FIRST} words, then ~${REST}); source: gutenberg.org ebook ${id}`)
