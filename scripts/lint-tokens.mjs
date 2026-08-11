#!/usr/bin/env node
/* lint-tokens — fail the build when chrome drifts off the system.
 *
 * Everything this checks was cleaned up by hand at least once. Hand cleanups do not hold:
 * the next literal gets added by whoever is in a hurry, looks exactly like the tokens
 * around it, and nobody notices until the numbers are audited again. This turns each
 * cleanup into a rule that enforces itself.
 *
 * Config: .tokenlint.json at the repo root.
 *   { "roots": ["src"], "exempt": ["src/App.css"], "typeParity": "shared/src" }
 *
 * exempt is deliberate, not a backlog. Anything listed there should be explainable in one
 * sentence -- a frozen file, or a gallery of somebody else's components.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const CONFIG = join(ROOT, '.tokenlint.json')
if (!existsSync(CONFIG)) {
  console.error('lint-tokens: no .tokenlint.json at the repo root')
  process.exit(2)
}
const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
const EXEMPT = (cfg.exempt ?? []).map(p => p.split('/').join(sep))

/* The scale, and the only padding values allowed to appear as literals. 0 is always fine. */
const STEPS = new Set([0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64])

/* font-size may be a token, or a unit that is doing something px cannot: container-query
   units sizing a glyph to its cell, em/% inheriting, or a keyword. A raw px font-size is
   the thing being banned. */
const SIZE_OK = /^(?:var\(|inherit|initial|unset|smaller|larger|\d*\.?\d+(?:cq[whibmax]+|em|ex|ch|%|rem)\b)/

const walk = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name)
  if (name === 'node_modules' || name === 'dist' || name === '.git') return []
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.css') ? [p] : []
})

const stripFallbacks = s => s.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '')
const problems = []

for (const root of cfg.roots ?? ['src']) {
  const abs = join(ROOT, root)
  if (!existsSync(abs)) continue
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file)
    if (EXEMPT.some(e => rel === e || rel.startsWith(e + sep))) continue
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')

    lines.forEach((line, i) => {
      const at = `${rel}:${i + 1}`

      /* gap is spacing on the same scale as padding, and sits inches away from it in the
         same rule -- checking one and not the other is how 10px gaps survived a padding
         audit. flex/grid gap only; the word also appears in shorthand grid properties,
         which this deliberately does not touch. */
      for (const m of line.matchAll(/(?<![-\w])((?:row-|column-)?gap|padding[-\w]*)\s*:\s*([^;}]+)/g)) {
        for (const px of stripFallbacks(m[2]).matchAll(/(\d*\.?\d+)px/g)) {
          const n = Number(px[1])
          if (!STEPS.has(n))
            problems.push(`${at}  ${m[1]} ${n}px is off the scale  (${m[1]}: ${m[2].trim()})`)
        }
      }

      for (const m of line.matchAll(/(?<![-\w])font-size\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim()
        if (!SIZE_OK.test(v))
          problems.push(`${at}  font-size ${v} is a literal, not a role`)
      }
    })
  }
}

/* type.css and type.ts state the same seven roles. Written twice, they drift -- and they
   had: type.ts said micro was 8px months after type.css moved it to 9, and kept opsz pins
   that type.css deleted. */
if (cfg.typeParity) {
  const base = join(ROOT, cfg.typeParity.split('/').join(sep))
  const cssPath = join(base, 'type.css'), tsPath = join(base, 'type.ts')
  if (existsSync(cssPath) && existsSync(tsPath)) {
    const css = readFileSync(cssPath, 'utf8'), ts = readFileSync(tsPath, 'utf8')
    const toPx = v => v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v)

    const cssRoles = {}
    for (const m of css.matchAll(/--type-([a-z]+)-(size|lead):\s*([^;]+);/g)) {
      cssRoles[m[1]] ??= {}
      cssRoles[m[1]][m[2]] = m[2] === 'size' ? toPx(m[3].trim()) : parseFloat(m[3])
    }
    const tsRoles = {}
    for (const m of ts.matchAll(/(\w+):\s*\{\s*size:\s*([\d.]+),\s*lead:\s*([\d.]+),\s*opsz:\s*(null|\d+)/g))
      tsRoles[m[1]] = { size: +m[2], lead: +m[3], opsz: m[4] === 'null' ? null : +m[4] }

    for (const [role, c] of Object.entries(cssRoles)) {
      const t = tsRoles[role]
      if (!t) { problems.push(`type.ts is missing the ${role} role that type.css declares`); continue }
      if (t.size !== c.size) problems.push(`type parity: ${role} size is ${t.size}px in type.ts, ${c.size}px in type.css`)
      if (c.lead !== undefined && t.lead !== c.lead)
        problems.push(`type parity: ${role} lead is ${t.lead} in type.ts, ${c.lead} in type.css`)
    }
    /* type.ts's own header says opsz is pinned only where type.css pins it. */
    const cssPins = /font-variation-settings:[^;]*['"]opsz['"]/.test(css)
    if (!cssPins)
      for (const [role, t] of Object.entries(tsRoles))
        if (t.opsz !== null)
          problems.push(`type parity: ${role} pins opsz ${t.opsz} in type.ts, but type.css pins none`)
  }
}

if (problems.length) {
  console.error(`\nlint-tokens: ${problems.length} problem${problems.length > 1 ? 's' : ''}\n`)
  for (const p of problems) console.error('  ' + p)
  console.error('\nUse a step (4 6 8 12 16 24 32 48 64) or a --type-* role.')
  console.error('If a value genuinely belongs off the system, add its file to .tokenlint.json exempt and say why.\n')
  process.exit(1)
}
console.log('lint-tokens: clean')
