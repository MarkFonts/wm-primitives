#!/usr/bin/env node
/* lint-tokens — fail the build when chrome drifts off the system.
 *
 * Everything this checks was cleaned up by hand at least once. Hand cleanups do not hold:
 * the next literal gets added by whoever is in a hurry, looks exactly like the tokens
 * around it, and nobody notices until the numbers are audited again. This turns each
 * cleanup into a rule that enforces itself.
 *
 * Config: .tokenlint.json at the repo root.
 *   { "roots": ["src"], "exempt": ["src/App.css"], "typeParity": "shared/src",
 *     "tokenSources": ["shared/src"], "hostTokens": ["--text"], "runtimeTokens": [] }
 *
 * roots        linted for literals AND scanned for token declarations/references
 * tokenSources scanned for declarations only -- where the primitives declare theirs
 * hostTokens   the consuming app declares these; reading one bare is legal
 * runtimeTokens this repo's own JS sets these on its own elements
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

/* A host token with no prose is a token nobody can be told to define. Only where the
   config keeps prose at all (this package); a consumer's list is its own. */
if (cfg.hostTokenDocs) {
  const docs = cfg.hostTokenDocs
  const undocumented = (cfg.hostTokens ?? []).filter(t => !docs[t])
  if (undocumented.length) {
    console.error(`lint-tokens: ${undocumented.length} host token(s) with no entry in hostTokenDocs: ${undocumented.join(' ')}`)
    process.exit(1)
  }
}

/* The scale, and the only padding values allowed to appear as literals. 0 is always fine. */
const STEPS = new Set([0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64])
/* margin: report only until the consumers are on the scale, then a gate. See the check. */
const MARGIN_GATES = false
const margins = []

/* font-size may be a token, or a unit that is doing something px cannot: container-query
   units sizing a glyph to its cell, em/% inheriting, or a keyword. A raw px font-size is
   the thing being banned. */
const SIZE_OK = /^(?:var\(|inherit|initial|unset|smaller|larger|\d*\.?\d+(?:cq[whibmax]+|em|ex|ch|%|rem)\b)/

/* A root may be a directory (walked for .css) or one file. An .html file counts: Kernpare
   is a single index.html with its CSS in <style> blocks, and a page that cannot be linted
   because of where it keeps its stylesheet is a page that drifts. Everything outside the
   <style> blocks is blanked, line for line, so a problem's line number is the file's. */
const walk = dir => statSync(dir).isDirectory()
  ? readdirSync(dir).flatMap(name => {
      const p = join(dir, name)
      if (name === 'node_modules' || name === 'dist' || name === '.git') return []
      return statSync(p).isDirectory() ? walk(p) : /\.(css|html)$/.test(p) ? [p] : []
    })
  : [dir]
const styleOnly = (file, text) => {
  if (!file.endsWith('.html')) return text
  let out = '', at = 0
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const open = m.index + m[0].indexOf(m[1])
    out += text.slice(at, open).replace(/[^\n]/g, ' ') + m[1]
    at = open + m[1].length
  }
  return out + text.slice(at).replace(/[^\n]/g, ' ')
}

const stripFallbacks = s => s.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '')
const problems = []

/* REFERENCES. Every check above reads a declaration and judges its value; none of them
   follows a var() back to where it is defined, so a token that no longer exists reads
   exactly like one that does. That is not hypothetical -- when --pad-N became
   --spacing-0N, files kept saying var(--pad-4), rendered with zero padding, and this
   linter said clean. Of the rules here it is the only one that catches a RENAME, which
   is most of what happens to this system.
   Gathered from every file including the exempt ones: `exempt` is about literals in
   somebody else's gallery, and a rename breaks a gallery the same as anything else. */
const declared = new Set()
const used = new Map()   // --name -> [{ at, fallback }]
/* Comments name tokens in prose all over this package -- editRail.css explains
   --edit-rail-target in its header -- so they are cut before either scan, or the
   documentation of a token counts as a use of it. Newlines survive, to keep line
   numbers honest. */
const decomment = t => t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

/* Declarations only, no literal rules: an app's CSS reads --spacing-04 and --type-ui-size
   from the primitives it builds against, and those are declared in shared/src, outside
   its own roots. Without this the reference check calls 23 perfectly good tokens
   undefined the moment an app upgrades -- which is exactly what it did. */
for (const dir of cfg.tokenSources ?? []) {
  const abs = join(ROOT, dir.split('/').join(sep))
  if (!existsSync(abs)) continue
  for (const file of walk(abs))
    for (const m of decomment(styleOnly(file, readFileSync(file, 'utf8'))).matchAll(/(--[\w-]+)\s*:/g))
      declared.add(m[1])
}

for (const root of cfg.roots ?? ['src']) {
  const abs = join(ROOT, root)
  if (!existsSync(abs)) continue
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file)
    const text = styleOnly(file, readFileSync(file, 'utf8'))

    decomment(text).split('\n').forEach((line, i) => {
      /* A declaration is `--x:`; a read is `var(--x` -- and `var(--x, 8px)` carries a
         comma, which is the whole difference between a miss that degrades and a miss
         that paints black text on a black ground. */
      for (const m of line.matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1])
      for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
        if (!used.has(m[1])) used.set(m[1], [])
        used.get(m[1]).push({ at: `${rel}:${i + 1}`, fallback: m[2] === ',' })
      }
    })

    if (EXEMPT.some(e => rel === e || rel.startsWith(e + sep))) continue
    const lines = text.split('\n')
    let off = false

    lines.forEach((line, i) => {
      const at = `${rel}:${i + 1}`

      /* One line may say why it is off the system, on itself or on the line above:
             /* token-lint: allow -- 8px: the badge has to sit BESIDE its label *\/
         A reason is required, because the point is to state the exception rather than to
         silence it. File-level `exempt` stays for whole files that are somebody else's
         gallery; a single sanctioned declaration should not have to exempt its file --
         which is what kept this linter red, and a linter nobody can get to green is one
         everybody learns to ignore. */
      const allow = /token-lint:\s*allow\s*--\s*\S/
      if (allow.test(line) || (i > 0 && allow.test(lines[i - 1]))) return

      /* A REGION may be off the system, with a reason, for a design that is deliberately
         its own -- Kernpare's kern-group analysis is styled like a terminal on purpose,
         and its file also holds the page chrome that must not be:
             /* token-lint: off -- the analysis UI is Severance on purpose *\/
             ...
             /* token-lint: on *\/
         Between the two, literals are not judged. References still are, above: a renamed
         token breaks a terminal the same as anything else. */
      if (/token-lint:\s*off\s*--\s*\S/.test(line)) { off = true; return }
      if (/token-lint:\s*on\b/.test(line)) { off = false; return }
      if (off) return

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

      /* MARGIN is the other half of the box, and it was never checked: padding and gap
         were held to the scale from the start while margins sat beside them unread:
         27 off the scale across this package and four consumers, and 34 more inside
         ReCal's exempt App.css (counted 2026-09-24). Same steps, and a negative step
         is fine -- a -1px hairline pull or a -8px optical hang is the scale, mirrored.
         0 and auto are not judged. This REPORTS until every consumer is on the scale,
         then MARGIN_GATES flips and it fails like padding does; a rule that turned five
         consumer legs red on the day it landed would be reverted, not obeyed. */
      for (const m of line.matchAll(/(?<![-\w])(margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?)\s*:\s*([^;}]+)/g)) {
        for (const px of stripFallbacks(m[2]).matchAll(/(-?\d*\.?\d+)px/g)) {
          const n = Math.abs(Number(px[1]))
          if (!STEPS.has(n))
            (MARGIN_GATES ? problems : margins).push(`${at}  ${m[1]} ${px[1]}px is off the scale  (${m[1]}: ${m[2].trim()})`)
        }
      }

      for (const m of line.matchAll(/(?<![-\w])font-size\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim()
        if (!SIZE_OK.test(v))
          problems.push(`${at}  font-size ${v} is a literal, not a role`)
      }

      /* TRACKING. TYPOGRAPHY.md: "Tracking may only ever be positive, and only on
         capitals. One token, --track-caps: .12em, and no other tracking value exists in
         the system." It existed anyway -- 0.02, 0.04, 0.06, 0.08em, spread across three
         repos, every one of them a lowercase UI label reading visibly open beside an
         untracked one. The rule is the law with nothing added: the token, or nothing. */
      for (const m of line.matchAll(/(?<![-\w])letter-spacing\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim()
        if (!/^(?:var\(--track-caps\b|normal$|inherit$|initial$|unset$|0(?:px|em|rem)?$)/.test(v))
          problems.push(`${at}  letter-spacing ${v} is not --track-caps  (capitals only, one value)`)
      }

      /* MOTION. Three near-identical "fast" values were in use -- .1s, .12s, .15s -- plus
         a --dur-fast that only ReCal defined, at 140ms, against a .12s fallback everywhere
         else: the same primitive animated at two speeds depending on which app rendered
         it. Durations come from motion.css now, and a literal is how that happens again.
         Only transition/animation shorthands and their -duration/-delay longhands: a
         TRANSITIONS ONLY. A transition is a state change -- hover, press, open -- and
         that is what the scale governs. A keyframe animation's duration is choreography:
         a loop's period, a bounce, a 2.1s wght-and-SHRP party. Linting those produced
         nothing but a queue of exemptions, which is how a rule teaches people to write
         `allow` without reading it. */
      for (const m of line.matchAll(/(?<![-\w])(transition)(?:-duration|-delay)?\s*:\s*([^;}]+)/g)) {
        for (const t of stripFallbacks(m[2]).matchAll(/(?<![\w.-])(\d*\.?\d+)(m?s)\b/g))
          problems.push(`${at}  ${m[1]} time ${t[0]} is a literal  (use var(--dur-fast|--dur-med|--dur-layout|--dur-slow, ...))`)
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

/* A token read here is legitimate in exactly three ways: this package declares it, the
   consuming app declares it (hostTokens -- the contract, written down so a consumer can
   be checked against it instead of guessed at), or our own JS sets it on an element
   (runtimeTokens). Anything else is a name that has drifted. */
/* OPT-IN, and that is not timidity. This file is consumed by three other repos that run
   it against their own CSS with their own config, and a shared rule that cannot be
   satisfied until that config is updated turns every consumer red on upgrade -- it broke
   font-proofer's and ReCal's deploys the day it landed. A repo asks for the check by
   describing where its tokens come from; until then the other rules run as before. */
const wantsRefs = !!(cfg.hostTokens || cfg.runtimeTokens || cfg.tokenSources)
const HOST = new Set(cfg.hostTokens ?? [])
const RUNTIME = new Set(cfg.runtimeTokens ?? [])
const contracted = new Set([...HOST, ...RUNTIME])
let bare = 0
for (const [name, sites] of wantsRefs ? used : []) {
  if (declared.has(name)) continue
  if (contracted.has(name)) { bare += sites.filter(s => !s.fallback).length; continue }
  const where = sites.slice(0, 3).map(s => s.at).join(', ')
  problems.push(`${sites[0].at}  var(${name}) is declared nowhere  (${sites.length} use${sites.length > 1 ? 's' : ''}: ${where})`)
}

/* ── TOKEN TYPES ─────────────────────────────────────────────────────────────────────
 *
 * A token can be declared, spelled right, read with a fallback, and still be wrong,
 * because nothing until now checked WHAT KIND of value it holds. --dial-thumb is the
 * dial thumb's SIZE -- `width: var(--dial-thumb, 14px)` -- and a host that reads the
 * name as a colour and sets #e8e8e8 makes that declaration invalid at computed-value
 * time. The thumb collapses, and because a range input maps a click through its thumb
 * geometry, EVERY SLIDER IN THE APP then snaps to its minimum on click. No error, no
 * warning, and the symptom is nowhere near the cause. That happened; this is the rule.
 *
 * It is the same failure family as color.css's: a custom property that does not resolve
 * is not a value you can see going missing, it is a declaration the engine drops.
 *
 * TYPES ARE INFERRED, NOT DECLARED BY HAND. A hand-kept list is another thing to drift.
 * Each read of a token says what it is twice over -- by the property it sits in
 * (`width:` wants a length) and by its own fallback (`var(--x, 14px)`) -- so the type is
 * read off the package's own usage. Which also means the check has teeth against this
 * package first: if two files disagree about what a token is, that is a problem here,
 * before any consumer is involved.
 *
 * What it catches:
 *   - a DECLARATION whose value contradicts how the token is read (in roots, and in any
 *     tokenSources or extra files passed on argv -- point it at a consumer's CSS)
 *   - two reads that disagree with each other about the type
 *   - a fallback that contradicts its own property
 *
 * It stays quiet where it cannot be sure: a token read only through var() with no
 * fallback and no telling property has no inferred type and is skipped. */

/* `stroke-width` is deliberately NOT here: SVG takes it unitless, so --chevron-stroke: 1.15
   is correct and a length rule would call it wrong. A property only earns a place on this
   list if a bare number in it would be invalid. */
const TYPE_OF_PROP = [
  [/^(width|height|min-|max-|inset|top|right|bottom|left|margin|padding|gap|border-radius|border-width|outline-offset|flex-basis|translate|text-underline-offset)/, 'length'],
  [/^(color|fill|stroke|background-color|border-color|outline-color|caret-color|accent-color|text-decoration-color)$/, 'color'],
  [/^(opacity|z-index|flex-grow|flex-shrink|font-weight|order)$/, 'number'],
  [/^(transition-duration|animation-duration|transition-delay|animation-delay)$/, 'time'],
]
const LOOKS = [
  [/^-?(\d*\.)?\d+(px|rem|em|ch|ex|vh|vw|vmin|vmax|cm|mm|in|pt|pc|q|lh|cap|ic|rlh)$/i, 'length'],
  [/^(#[0-9a-f]{3,8}|transparent|currentcolor)$/i, 'color'],
  [/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i, 'color'],
  [/^-?(\d*\.)?\d+(m?s)$/i, 'time'],
  [/^-?(\d*\.)?\d+$/, 'number'],
]
const looksLike = v => {
  const t = v.trim().replace(/\s*!important$/, '')
  if (/^(0|auto|none|inherit|initial|unset|revert)$/i.test(t)) return null   // type-neutral
  if (/^(var|calc|clamp|min|max|env)\(/i.test(t)) return null               // computed; no claim
  for (const [re, kind] of LOOKS) if (re.test(t)) return kind
  return null
}
const typeOfProp = prop => {
  for (const [re, kind] of TYPE_OF_PROP) if (re.test(prop)) return kind
  return null
}

if (cfg.hostTokens || cfg.tokenSources) {
  /* name -> { type, why[] } gathered from every read, then every declaration judged. */
  const inferred = new Map()
  const note = (name, kind, why) => {
    if (!kind) return
    const e = inferred.get(name) ?? { kinds: new Map() }
    e.kinds.set(kind, (e.kinds.get(kind) ?? []).concat(why))
    inferred.set(name, e)
  }
  const decls = new Map()   // name -> [{ at, value }]

  const extra = process.argv.slice(2).map(f => join(ROOT, f.split('/').join(sep)))
  const files = [...(cfg.roots ?? ['src']), ...(cfg.tokenSources ?? [])]
    .map(d => join(ROOT, d.split('/').join(sep))).filter(existsSync).flatMap(walk)
    .concat(extra.filter(existsSync))

  for (const file of files) {
    const rel = relative(ROOT, file)
    decomment(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
      const at = `${rel}:${i + 1}`
      /* Reads: the property this var() sits in, and the fallback it carries. */
      /* QUOTES END A DECLARATION TOO, and that is not pedantry now that a root may be
         .html: an inline style="" attribute is terminated by its quote, not a semicolon.
         Stopping only at `;` and `}` ran straight out of one attribute and into the next
         tag -- in kernpare it paired `font-weight` from one <span> with a var() inside
         the NEXT one and reported a colour token as being read as a number. */
      for (const m of line.matchAll(/([-a-z]+)\s*:\s*([^;}"']*var\([^;}"']*)/g)) {
        const prop = m[1], rest = m[2]
        if (prop.startsWith('--')) continue          // a token defined from another
        /* THE PROPERTY ONLY SPEAKS FOR A TOP-LEVEL var(). Nested inside a function it
           says nothing about the token: `color: rgba(var(--text-rgb), var(--ink-quiet))`
           is a colour built from a component list and an alpha, and reading either as
           "a colour because the property is color:" is how this rule's first draft
           reported five false positives in this package alone. Depth is tracked rather
           than guessed; the fallback still speaks at any depth, because a literal is a
           literal wherever it sits. */
        let depth = 0
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === ')') { depth--; continue }
          if (rest[i] !== '(') continue
          const head = rest.slice(0, i + 1)
          const isVar = /var\($/.test(head)
          depth++
          if (!isVar) continue
          const tail = rest.slice(i + 1)
          const v = tail.match(/^\s*(--[\w-]+)\s*(?:,\s*([^),]+))?/)
          if (!v) continue
          if (depth === 1) note(v[1], typeOfProp(prop), `${at} (${prop}:)`)
          if (v[2]) note(v[1], looksLike(v[2]), `${at} (fallback ${v[2].trim()})`)
        }
      }
      /* Declarations, to be judged against the above. */
      for (const m of line.matchAll(/(--[\w-]+)\s*:\s*([^;}"']+)/g))
        decls.set(m[1], (decls.get(m[1]) ?? []).concat({ at, value: m[2].trim() }))
    })
  }

  for (const [name, e] of inferred) {
    const kinds = [...e.kinds.keys()]
    if (kinds.length > 1) {
      const spread = kinds.map(k => `${k} at ${e.kinds.get(k)[0]}`).join(', vs ')
      problems.push(`${e.kinds.get(kinds[0])[0]}  ${name} is read as two different types  (${spread})`)
      continue
    }
    const want = kinds[0]
    for (const d of decls.get(name) ?? []) {
      const got = looksLike(d.value)
      if (got && got !== want)
        problems.push(`${d.at}  ${name} is a ${want}, declared as a ${got}  (${name}: ${d.value})  -- read as ${want} at ${e.kinds.get(want)[0]}`)
    }
  }
}

/* Notes, not failures. A bare host token is a real risk -- an undefined custom property
   is invalid at computed-value time, so a consumer that misses --text inherits a colour
   rather than falling back to one -- but there are too many to fail on today, and a
   linter nobody can get to green is one everybody learns to ignore. The number is
   printed so it can be worked down and then promoted. */
const notes = []
if (!wantsRefs) notes.push('reference check off -- add tokenSources/hostTokens to .tokenlint.json to enable it')
if (bare) notes.push(`${bare} host-token read${bare > 1 ? 's' : ''} with no fallback (README: var(--surface-2, var(--bg-elevated)))`)
const stale = [...contracted].filter(t => !used.has(t))
if (stale.length) notes.push(`contract lists ${stale.length} token${stale.length > 1 ? 's' : ''} nothing reads: ${stale.join(' ')}`)
if (margins.length) notes.push(`${margins.length} margin${margins.length > 1 ? 's' : ''} off the scale (not yet a failure -- MARGIN_GATES):\n${margins.map(m => '        ' + m).join('\n')}`)

if (problems.length) {
  console.error(`\nlint-tokens: ${problems.length} problem${problems.length > 1 ? 's' : ''}\n`)
  for (const p of problems) console.error('  ' + p)
  for (const n of notes) console.error(`  note -- ${n}`)
  console.error('\nUse a step (4 6 8 12 16 24 32 48 64) or a --type-* role.')
  console.error('If a value genuinely belongs off the system, add its file to .tokenlint.json exempt and say why.\n')
  process.exit(1)
}
for (const n of notes) console.log(`lint-tokens: note -- ${n}`)
console.log('lint-tokens: clean')
