/* flattersatz.js — optical line fitting, for any column of text.
 *
 * Ported from **Seth Thompson's** flattersatz demo (https://seththompson.com), read
 * out of the published bundle — the repo is gone; archived at web.archive.org,
 * 30 Mar 2026. The three-stage budget and the alternating measure are his.
 *
 * His demo is built on **PreText**, by **Cheng Lou** — the line-breaking idea both
 * this and the letterbox descend from. The letterbox primitive in wm-primitives is
 * a SEPARATE implementation of the same PreText, by Charlie Clark. Two authors,
 * two implementations, one origin; do not collapse them.
 *
 * Two ideas worth stating separately, because the UI exposes them as separate modes:
 *
 * JUSTIFIED — every line is fitted to one measure. Ordinary flush-both setting,
 * except that the fitting spends three things in order rather than only word space.
 *
 * FLATTERSATZ — the measure ALTERNATES: even lines get the full column, odd lines get
 * the column minus `ragWidth` (floored at MIN_MEASURE). Lines BREAK against their own
 * target, so the right edge falls into a designed two-step band rather than wherever
 * the words happened to stop — but they are not forced to fill it. The band shapes the
 * rag; the rag stays a rag.
 *
 * THE BUDGET. A line short of its target has a deficit to spend, and spends it in
 * this order, each capped by its own limit before the next takes over:
 *
 *   1. tracking        (letter-spacing)         — spreads evenly, no rivers
 *   2. word spacing    (word-spacing)           — the reader forgives it
 *   3. glyph scaling   (scaleX on the line)     — LAST, and off by default
 *
 * Glyph scaling is a SYMMETRIC allowance around 100: 102 means the line may be set
 * anywhere from 98% to 102%. Condensing is not decoration — it is how a line takes one
 * more word instead of opening a hole, which is the choice a hand compositor makes and
 * a browser cannot. 100 means neither, and 100 is the default.
 *
 * Tracking before word spacing, because tracking distributes the correction across
 * every glyph gap while word spacing pools it into a handful of word gaps, which is
 * what rivers are made of. (InDesign orders these the other way; it is optimising for
 * a reader's tolerance, this is optimising for even colour on the page.)
 *
 * The source spends scaling FIRST, on the argument that it spreads the correction
 * evenly across a line while word spacing concentrates it into gaps and breeds
 * rivers. That is a fair call for displaying text and the wrong one for proofing it:
 * every other adjustment changes the SPACING of the type, while glyph scaling changes
 * the TYPE — stem weights and widths both — which is the one thing a proof must not
 * quietly falsify. InDesign ships glyph scaling at 100/100/100 for the same reason.
 * So the order is inverted here, and maxGlyphScaling defaults to 100, meaning off.
 *
 * JUSTIFIED ONLY: whatever survives all three caps goes back to word spacing, uncapped,
 * because a justified line has to reach its measure and a loose word space is the most
 * forgivable way to get there.
 *
 * A RAG must never take that residue. Spending it is what makes every line flush, and a
 * rag whose lines are all flush is just justified text at two measures — which is what
 * this did before the residue was fenced off. In flattersatz the caps are the whole
 * budget: a line spends what it can and then STOPS SHORT, which is the rag.
 *
 * The last line of a paragraph is never fitted, and neither is a line already at or
 * past its target.
 *
 * Plain JS, like letterbox.js and for the same reason: wordmark.nyc script-tags it into
 * a static page, so it cannot require React or a build step. `applyTo` is the whole API
 * a static page needs; React consumers call layoutParagraph and render the lines.
 */

/** A budget that permits nothing: desired, and no room either side. */
export const INERT = { min: 100, desired: 100, max: 100 }

export const MIN_MEASURE = 140      // a rag line never gets narrower than this
export const DEFAULTS = {
  // 'plain' is the default a paragraph arrives in: the fitter DOES run — every line is
  // measured and broken here — but it spends nothing and reaches for nothing. What it
  // buys is protrusion, and that is the whole reason it exists: `hanging-punctuation` is
  // Safari-only, so in Chrome a plain ragged column can only have clean margins if
  // something measures the lines. 'off' hands the paragraph back to the browser and is
  // kept for comparison, and for very long text where measuring everything is not worth
  // it.
  mode: 'plain',                    // 'off' | 'plain' | 'justified' | 'flattersatz'
  ragWidth: 40,
  // Each budget is a BAND — { min, desired, max } in percent of natural. Desired is
  // where the line starts before anything is spent; min and max are how far the fitter
  // may go in each direction, INDEPENDENTLY. One number could only ever be a floor or a
  // cap, never both, and had no desired at all. A plain number is still accepted and
  // still means that old single knob, because ReCal passes numbers.
  //
  // The H&J a justified column arrives with. Note DESIRED word spacing below 100: the
  // line starts tighter than natural and the fitter opens it, rather than starting at
  // natural and only ever adding. Expansion is live here (98–102) — on a font with a
  // wdth axis that is Zapf's expansion; on a font without one it is scaleX, which
  // distorts, so that fallback is the thing to watch.
  wordSpacing: { min: 75, desired: 85, max: 110 },
  tracking: { min: 98, desired: 100, max: 104 },      // shown 0-centred: -2 / 0 / +4
  // 100/100/100 — expansion permits NOTHING until it is opened. Picking Justify must not
  // stretch the type: word spacing and letter spacing change the setting, this changes
  // the letters, and a proof that quietly ships glyphs at 102% is lying about the face.
  // Measured before this was fixed: four of thirteen lines were already at scaleX(1.02)
  // on a font with no width axis, and zero on one that had it — inconsistent as well as
  // uninvited. Open the row and it works exactly as before, axis or scaleX.
  glyphScaling: { min: 100, desired: 100, max: 100 },  // expansion — see expandValue
  budgets: false,                   // rag only: a rag spends NOTHING unless asked. The
                                    // band is the design; spending closes the gaps
                                    // greedy leaves and the rag comes out flush.
  // The rag's knobs are its OWN. They were the same three values as justification's,
  // which meant opening a rag's word spacing quietly re-set every justified paragraph
  // in the proof. Single centred knobs, because a rag is not aiming at anything: it
  // stops short, and all these do is say how much it may close first.
  rag: { tracking: 100, wordSpacing: 100, glyphScaling: 100 },
  center: false,                    // centred rag: split the shortfall onto both sides
  hyphenate: false,                 // justified only; points come from the browser
  // How a justified paragraph is composed. 'paragraph' scores every break in the whole
  // paragraph against every other (Knuth–Plass); 'single-line' fills each line as far as
  // it goes and moves on. Not a feature and not exposed: it exists so the two can be
  // measured against each other on the same text at the same measure. A rag is
  // single-line by definition — stopping short IS the design — so this only ever
  // applies to justified.
  composer: 'paragraph',            // 'paragraph' | 'single-line'
  hang: true,                       // protrusion — see PROTRUSION. Off is a worse proof,
                                    // but it has to be possible to see the difference.
  firstIndent: 0,
  indent: 0,                        // 0 by default: the blocks already carry
                                    // inter-paragraph space, and indent + space is
                                    // two signals for one job
}

/* What "Swiss Rag" arrives as. The zeroed budgets in DEFAULTS are the JUSTIFIED
 * starting point — a browser flexing word space and nothing else. A rag starts
 * somewhere else: a real measure band, and small tracking and word-space allowances
 * A rag's shape comes from the BAND, not from stretching: lines break against
 * alternating measures and then stop where the words stop. The budgets start at zero
 * for exactly that reason — even a 2% tracking allowance closes most of the gaps that
 * greedy breaking leaves, and the "rag" comes out flush to two measures, which is what
 * the original demo actually renders. Open the budgets to pull the rag tighter toward
 * the band; leave them at zero for a true rag.
 */
export const SWISS_PRESET = {
  ragWidth: 40,
  budgets: false,
  rag: { tracking: 100, wordSpacing: 100, glyphScaling: 100 },
}

/* ── Measurement ──────────────────────────────────────────────────────────────
 * DOM, not canvas. A canvas 2d context silently ignores font-variation-settings in
 * Chrome, so every width would be measured at the default instance and the fitting
 * would be wrong by exactly as much as the proof is interesting. Measuring a real
 * element inherits the axes, the features and the optical size.
 */
let probe = null

function getProbe(reference) {
  if (!probe) {
    probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;top:-9999px;left:-9999px;' +
      // No `contain`: size containment makes the probe report 0 width, which silently
      // turns every measurement into "fits", and the whole paragraph into one line.
      'pointer-events:none;margin:0;padding:0;border:0;'
    document.body.appendChild(probe)
  }
  const cs = getComputedStyle(reference)
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch',
                   'fontVariationSettings', 'fontFeatureSettings', 'fontOpticalSizing',
                   'letterSpacing', 'wordSpacing', 'textTransform', 'fontKerning']) {
    probe.style[p] = cs[p]
  }
  return probe
}

/** font-variation-settings is a whole declaration, not a set of properties: a value set
 *  on the line REPLACES the block's axes rather than merging with them, so every string
 *  we emit has to carry the block's own settings too. */
function setAxis(fvs, tag, value) {
  const decl = `"${tag}" ${Math.round(value * 100) / 100}`
  if (!fvs || fvs === 'normal') return decl
  const re = new RegExp(`["']${tag}["']\\s*-?[\\d.]+`)
  return re.test(fvs) ? fvs.replace(re, decl) : `${fvs}, ${decl}`
}

/** Widths for one style, keyed by string. Cleared whenever the style key moves.
 *  `measureAt` is the same probe with one axis moved — the only way to know what a
 *  width axis actually does to a string, since axis widths are not linear. */
function makeMeasurer(reference, runStyles) {
  const el = getProbe(reference)
  const baseCss = el.style.cssText
  const baseFVS = getComputedStyle(reference).fontVariationSettings || ''
  const cache = new Map()
  // An italic run is a different face and therefore different widths: measuring it as
  // roman is wrong by exactly the amount that makes the line not fit. The app owns how
  // it draws emphasis, so it passes the styles in and the probe wears them.
  const measure = (s, type) => {
    const styled = type && type !== 'text' && runStyles && runStyles[type]
    const key = styled ? type + '\u0000' + s : s
    let w = cache.get(key)
    if (w === undefined) {
      if (styled) Object.assign(el.style, styled)
      el.textContent = s
      w = el.getBoundingClientRect().width
      if (styled) el.style.cssText = baseCss
      cache.set(key, w)
    }
    return w
  }
  const measureAt = (value, s, type) => {
    const styled = type && type !== 'text' && runStyles && runStyles[type]
    const key = `${value}|${type || ''}|${s}`
    let w = cache.get(key)
    if (w === undefined) {
      if (styled) Object.assign(el.style, styled)
      el.style.fontVariationSettings = setAxis(baseFVS, 'wdth', value)
      el.textContent = s
      w = el.getBoundingClientRect().width
      if (styled) el.style.cssText = baseCss
      else el.style.fontVariationSettings = baseFVS
      cache.set(key, w)
    }
    return w
  }
  return { measure, measureAt, fvsAt: v => setAxis(baseFVS, 'wdth', v),
           space: measure(' '), em: parseFloat(getComputedStyle(reference).fontSize) || 16 }
}

/** The same measurer with the DESIRED spacing folded in. Same shape, so everything
 *  downstream is unchanged; `base` is the natural one underneath. */
function withDesired(m, B) {
  const gap = (B.tracking.desired - 100) / 100 * m.em
  if (!gap && B.wordSpacing.desired === 100) return m
  return { ...m, base: m,
    measure: (s, type) => m.measure(s, type) + Math.max(Array.from(s).length - 1, 0) * gap,
    space: m.space * B.wordSpacing.desired / 100 + gap }
}

/* ── Fitting one line ─────────────────────────────────────────────────────── */

/* ── Budgets as bands ─────────────────────────────────────────────────────────
 * { min, desired, max }. A plain number is the old single knob: below 100 it was a
 * condense floor, above it a stretch cap, and the other end was pinned — so that is
 * exactly what a number still means here. Nothing that passes numbers changes.
 */
export function band(v) {
  if (v == null) return INERT
  if (typeof v === 'number') return { min: Math.min(100, v), desired: 100, max: Math.max(100, v) }
  return { min: v.min ?? 100, desired: v.desired ?? 100, max: v.max ?? 100 }
}

/** A rag spends nothing unless asked: the band IS the design, and any spend closes the
 *  gaps greedy leaves until the "rag" is flush to two measures. Justified always spends
 *  — reaching the measure is what justified means. */
export function budgetsOf(limits) {
  if (limits.mode === 'plain') return { wordSpacing: INERT, tracking: INERT, glyphScaling: INERT }
  if (limits.mode === 'flattersatz') {
    if (!limits.budgets) return { wordSpacing: INERT, tracking: INERT, glyphScaling: INERT }
    const r = limits.rag ?? {}
    return { wordSpacing: band(r.wordSpacing), tracking: band(r.tracking),
             glyphScaling: band(r.glyphScaling) }
  }
  return { wordSpacing: band(limits.wordSpacing), tracking: band(limits.tracking),
           glyphScaling: band(limits.glyphScaling) }
}

function condenseFloor(limits) { return budgetsOf(limits).glyphScaling.min }
function stretchCap(limits) { return budgetsOf(limits).glyphScaling.max }
const countSpaces = t => (t.match(/[ \u00a0]/g) ?? []).length

/* ── Expansion: Zapf's, not a scaleX ─────────────────────────────────────────
 * The hz-program expanded and condensed glyphs using specially drawn masters, never a
 * linear distortion — that is the whole point of it, and why the mechanism survived
 * into pdfTeX as font EXPANSION rather than scaling. A variable font ships those
 * masters. So: if the proofed font has a `wdth` axis, the fitter moves the axis and
 * re-measures, and what fills the line is type the designer actually drew. A font
 * without one falls back to scaleX, which distorts every stem it touches — which is
 * why expansion is opt-in either way.
 *
 * Widths along an axis are not linear, so there is nothing to compute: bisect the
 * setting and measure. CSS clamps a font-variation-settings value to the axis the font
 * really has, so bisecting a deliberately wide range needs no fvar parsing and nothing
 * plumbed in from the app — a font with no wdth axis simply never moves.
 */
const AXIS_LO = 1, AXIS_HI = 1000  // the font clamps these to its own wdth range
const MAX_STEPS = 12               // percent of natural width, either direction

/** Does this style have a live width axis? Measured once per measurer, then cached. */
export function widthAxis(m) {
  if (m._axis !== undefined) return m._axis
  const S = 'nnoonnoo'
  const w = m.measure(S)
  m._axis = (Math.abs(m.measureAt(AXIS_HI, S) - w) > 0.5 ||
             Math.abs(m.measureAt(AXIS_LO, S) - w) > 0.5) || false
  return m._axis
}

/* Expansion is QUANTISED, in whole percent of natural width. pdfTeX quantises because
 * every expansion level is a real font instance and there cannot be infinitely many; we
 * get a second thing out of it — the axis value for "102%" is found once per style
 * instead of once per line, and the percentages in the H&J panel mean what they say.
 *
 * The axis value for a percentage has to be BISECTED, not calculated: nothing says
 * where the axis currently sits (a block need not set wdth at all), the units are the
 * font's own, and width along an axis is not linear. Searching the raw range per line
 * was the first attempt and it does not work — seven halvings of [1,1000] never come
 * back down to the ~102 that a 2% budget actually needs, so every line was rejected. */
function axisFor(m, pct) {
  if (!m._axisAt) m._axisAt = new Map()
  const hit = m._axisAt.get(pct)
  if (hit !== undefined) return hit
  const S = 'nnoonnoo'
  const want = m.measure(S) * pct / 100
  let lo = AXIS_LO, hi = AXIS_HI
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2
    if (m.measureAt(mid, S) <= want) lo = mid; else hi = mid
  }
  m._axisAt.set(pct, lo)
  return lo
}

/** The expanded (or condensed) line, measured — never estimated from the sample, so a
 *  line can not overrun its measure because its letters happened to widen faster than
 *  the sample's. Null when the axis has nothing useful to offer. */
function expandValue(m, runs, want, wider, steps) {
  // Run by run, because an italic run is a different face and widens along the axis at
  // its own rate: measuring the line in one style would be wrong by the difference, and
  // for a proof of a family that ships both wdth and ital that is exactly the line you
  // most want to trust.
  const widthAt = value => runs.reduce((sum, r) => sum + m.measureAt(value, r.text, r.type), 0)
  const natural = runs.reduce((sum, r) => sum + m.measure(r.text, r.type), 0)
  let best = null
  for (let k = 1; k <= Math.min(steps, MAX_STEPS); k++) {
    const value = axisFor(m, wider ? 100 + k : 100 - k)
    const w = widthAt(value)
    if (wider) {
      if (w > want) break            // one step too far: keep the last that fitted
      best = { value, width: w }
    } else {
      best = { value, width: w }
      if (w <= want) break           // the least condensing that fits is the one to take
    }
  }
  if (!best) return null
  if (wider && best.width <= natural + 0.5) return null
  if (!wider && best.width >= natural - 0.5) return null
  return best
}

function fitLine(text, width, target, limits, m, isLast, flush, runs) {
  const B = budgetsOf(limits)
  const nat = m.base ?? m          // px conversions are against NATURAL space and em
  const parts = runs && runs.length ? runs : [{ type: 'text', text }]
  const axis = (B.glyphScaling.max > 100 || B.glyphScaling.min < 100) && widthAxis(nat)
  // measureAt reports NATURAL widths; every other width here carries the desired shift.
  const shift = m.measure(text) - nat.measure(text)
  const px = (ws, tr, sc, wdth) => ({
    wordSpacingPx: (ws / 100 - 1) * nat.space,
    trackingPx: (tr / 100 - 1) * nat.em,
    glyphScaling: sc / 100,
    fvs: wdth ? m.fvsAt(wdth) : undefined,
  })

  // ── Overset: the breaker took a word too many, on the promise of tightening ──
  // Same three budgets, same order, their below-desired halves.
  if (width > target) {
    const nSpaces = countSpaces(text)
    const nGaps = Math.max(Array.from(text).length - 1, 0)
    let excess = width - target
    let ws = B.wordSpacing.desired, tr = B.tracking.desired, sc = 100, wdth = null
    const wsRoom = nSpaces * ((ws - B.wordSpacing.min) / 100) * nat.space
    if (excess > 0 && wsRoom > 0) {
      const spend = Math.min(excess, wsRoom)
      ws -= (ws - B.wordSpacing.min) * (spend / wsRoom)
      excess -= spend
    }
    const trRoom = nGaps * ((tr - B.tracking.min) / 100) * nat.em
    if (excess > 0 && trRoom > 0) {
      const spend = Math.min(excess, trRoom)
      tr -= (tr - B.tracking.min) * (spend / trRoom)
      excess -= spend
    }
    const floor = B.glyphScaling.min / 100
    if (excess > 0 && floor < 1) {
      // What is LEFT to close, not the whole measure: word spacing and tracking have
      // already been spent, and aiming at the measure again overshot it — a line came
      // out 253px wide in a 249px column, expanded past a deficit that was already gone.
      const found = axis && expandValue(nat, parts, Math.max(width - excess, width * floor) - shift, false,
                                        Math.round(100 - B.glyphScaling.min))
      if (found) wdth = found.value
      else sc = Math.max(floor, target / width) * 100
    }
    return px(ws, tr, sc, wdth)
  }

  if (isLast || width >= target) return px(B.wordSpacing.desired, B.tracking.desired, 100, null)
  const spaces = countSpaces(text)
  const gaps = Math.max(Array.from(text).length - 1, 0)

  let deficit = target - width
  let scaling = 100, wdth = null
  let tracking = B.tracking.desired, wordSpacing = B.wordSpacing.desired

  // 1. tracking, to its max
  const trackRoom = gaps * ((B.tracking.max - tracking) / 100) * nat.em
  if (deficit > 0 && trackRoom > 0) {
    const spend = Math.min(deficit, trackRoom)
    tracking += (B.tracking.max - tracking) * (spend / trackRoom)
    deficit -= spend
  }
  // 2. word spacing, to its max
  const wordRoom = spaces * ((B.wordSpacing.max - wordSpacing) / 100) * nat.space
  if (deficit > 0 && wordRoom > 0) {
    const spend = Math.min(deficit, wordRoom)
    wordSpacing += (B.wordSpacing.max - wordSpacing) * (spend / wordRoom)
    deficit -= spend
  }
  // 3. expansion — last, and off unless asked for. The axis first, scaleX only if the
  //    font has no axis to move.
  const cap = B.glyphScaling.max
  if (deficit > 0 && cap > 100) {
    const ceiling = width * (cap / 100)
    // Only the remaining deficit — see the note in the overset branch above.
    const found = axis && expandValue(nat, parts, Math.min(width + deficit, ceiling) - shift, true,
                                      Math.round(cap - 100))
    if (found) {
      deficit -= (found.width + shift - width)
      wdth = found.value
    } else if (!axis) {
      const room = width * (cap / 100 - 1)
      if (room > 0) {
        const spend = Math.min(deficit, room)
        scaling = 100 + (cap - 100) * (spend / room)
        deficit -= spend
      }
    }
  }
  // 4. justified only: residue goes back to word spacing, uncapped. A rag stops short.
  if (flush && deficit > 0 && spaces > 0) {
    wordSpacing += ((deficit / spaces) / (scaling / 100)) / nat.space * 100
  }
  return px(wordSpacing, tracking, scaling, wdth)
}

/* ── Protrusion: hanging punctuation ──────────────────────────────────────────
 * A mark at the edge of a measure is a hole in the margin, because the eye reads the
 * ink and not the box. hz called it optical margin alignment; pdfTeX ships it as
 * character protrusion. A character that hangs hangs its OWN measured width — measured
 * live, through the same probe that measures everything else, so it is right for this
 * face at this size at this axis position and there is no table of units to go stale.
 *
 * Two rules, one per edge. Add a character to a class and it hangs.
 */
export const PROTRUSION = [
  { edge: 'left',  match: /[“‘"'¿¡(\[]/u },
  { edge: 'right', match: /[”’"',.;:!?)\]\-–—]/u },
]

/** How far this line's first and last characters may hang, in px. Measured, so it is
 *  right for the instance actually on screen. */
function protrude(runs, m, opts) {
  if (opts.hang === false || !runs.length) return { left: 0, right: 0 }
  const head = runs[0], tail = runs[runs.length - 1]
  const first = Array.from(head.text)[0]
  const last = Array.from(tail.text.trimEnd()).at(-1)
  let left = 0, right = 0
  for (const r of PROTRUSION) {
    if (r.edge === 'left' && left === 0 && first && r.match.test(first)) left = m.measure(first, head.type)
    if (r.edge === 'right' && right === 0 && last && r.match.test(last)) right = m.measure(last, tail.type)
  }
  return { left, right }
}

/** Even lines get the column; odd lines get the column less the rag. */
function targetFor(columnWidth, ragWidth, lineIndex, mode) {
  if (mode !== 'flattersatz') return columnWidth
  return lineIndex % 2 === 0 ? columnWidth : Math.max(MIN_MEASURE, columnWidth - ragWidth)
}

/* ── Hyphenation by rule, no dictionary ──────────────────────────────────────
 * The first attempt asked the browser: squeeze a word into a narrow box with
 * hyphens:auto and read where it broke. It does not work. Chromium here hyphenates
 * NOTHING and breaks anywhere instead — comf|ort, typograp|hy, typ|ogr|aphy — and it
 * does so silently, so the garbage arrives looking like dictionary output. Any such
 * trick has to be validated against known words before it is trusted; ours was not,
 * and it shipped "comf-" into a proof.
 *
 * So: rules. Liang's patterns are a dictionary by another name (~35KB), and the ask was
 * for hyphens without one. English takes three rules a long way:
 *
 *   1. after a known prefix          un-usual, re-lation, trans-late
 *   2. before a known suffix         read-ing, nation-al, comfort-able
 *   3. between two consonants        com-fort, cen-tury, typog-raphy   (VC|CV)
 *
 * with at least three letters kept on each side, which is stricter than TeX's 2/3 and
 * avoids the worst of the errors. It will not match a dictionary everywhere — no rule
 * set does — but every break it offers is defensible, which the browser's were not.
 */
const VOWELS = 'aeiouy'
// Digraphs are ONE consonant and never split: typograp-hic and lengt-hen were both
// produced by treating the second letter as a separate consonant.
const DIGRAPHS = ['ph', 'th', 'ch', 'sh', 'wh', 'gh', 'ck', 'ng', 'qu', 'rh']
const PREFIXES = ['anti', 'auto', 'circum', 'contra', 'counter', 'dis', 'extra', 'hyper',
  'inter', 'intra', 'micro', 'mis', 'mono', 'multi', 'non', 'over', 'post', 'pre', 'pro',
  'pseudo', 'quasi', 'retro', 'semi', 'sub', 'super', 'trans', 'ultra', 'under', 'un', 're']
const SUFFIXES = ['able', 'ible', 'ally', 'ance', 'ence', 'ment', 'ness', 'tion', 'sion',
  'ship', 'ward', 'wise', 'ful', 'ing', 'ist', 'ity', 'ive', 'ize', 'ise', 'ous', 'est',
  'ely', 'er', 'ly', 'al']
const MIN_SIDE = 3
const hyphenCache = new Map()

function hyphenPoints(word) {
  const w = word.toLowerCase()
  if (w.length < MIN_SIDE * 2) return []

  // An author's own soft hyphens outrank every rule below.
  if (word.includes('\u00ad')) {
    const out = []
    let i = word.indexOf('\u00ad')
    while (i >= 0) { out.push(i); i = word.indexOf('\u00ad', i + 1) }
    return out
  }
  const hit = hyphenCache.get(w)
  if (hit) return hit

  const points = new Set()
  const ok = i => i >= MIN_SIDE && i <= w.length - MIN_SIDE

  for (const p of PREFIXES) if (w.startsWith(p) && ok(p.length)) points.add(p.length)
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && ok(w.length - suf.length)) points.add(w.length - suf.length)
  }
  // VC|CV — the workhorse. Split between the consonants when a vowel sits on each side.
  const isV = c => VOWELS.includes(c)
  const splitsDigraph = i => DIGRAPHS.includes(w.slice(i - 1, i + 1)) || DIGRAPHS.includes(w.slice(i, i + 2))
  for (let i = 2; i < w.length - 2; i++) {
    if (isV(w[i - 2]) && !isV(w[i - 1]) && !isV(w[i]) && isV(w[i + 1]) && ok(i) && !splitsDigraph(i)) {
      points.add(i)
    }
  }

  // Two rules can fire a letter apart (a suffix boundary next to a VC|CV split), which
  // strands fragments: dis-rup-t-ing, exces-s-ive. Keep the points at least MIN_SIDE
  // apart, so every piece a line can end on is a piece worth reading.
  const out = []
  for (const p of [...points].sort((a, b) => a - b)) {
    if (!out.length || p - out[out.length - 1] >= MIN_SIDE) out.push(p)
  }
  hyphenCache.set(w, out)
  return out
}

/* ── Knuth–Plass, for justified setting only ──────────────────────────────────
 * Greedy breaking takes the most words each line can hold and lets the last lines pay
 * for it: one line ends up gaping while its neighbour is tight, and the gaps line up
 * down the column as rivers. KP scores the WHOLE paragraph instead — every possible
 * set of breaks — and picks the one whose lines are collectively least strained.
 *
 * Only justified uses it. A rag has nothing to optimise: its lines are not trying to
 * reach anything, so the two-measure rhythm of the Swiss rag IS the design, and greedy
 * breaking against those measures is exactly right.
 *
 * No hyphenation: break candidates are word boundaries only. A dictionary is a heavy
 * dependency for a proof, and KP earns most of its keep without one.
 *
 * badness = 100·|r|³ where r is how far a line must stretch or shrink, in units of the
 * space it has to give. r > 1 means it cannot reach; r < -1 means it overflows and the
 * break is refused outright. Demerits add a flat line penalty so the composer does not
 * buy an easier paragraph with extra lines.
 */
const LINE_PENALTY = 10
const HYPHEN_PENALTY = 50   // TeX's default: a hyphen is allowed, never free
const MAX_BADNESS = 10000    // TeX's ceiling: past this a line is not worth scoring
const OVERFULL_PENALTY = 1e10 // worse than ANY legal line, better than no paragraph
const STRETCH_PENALTY = 1e6   // per unit of stretch demanded PAST the budget — see below
const INFEASIBLE = 1e9

function kpBreak(items, target, m, limits) {
  const n = items.length
  const W = budgetsOf(limits).wordSpacing
  const nat = m.base ?? m
  const stretch = Math.max(nat.space * ((W.max - W.desired) / 100), nat.space / 3)
  // Shrink is exactly what the word-spacing band allows below desired — the composer may
  // only plan tightening the fitter can deliver. When it once assumed TeX's glue it
  // produced a 758px line in a 756px measure. Stretch keeps TeX's floor because
  // justified can always fall back on the uncapped residue; shrink has no such escape.
  const shrink = nat.space * ((W.desired - W.min) / 100)
  const hyphenW = m.measure('-')

  // Natural width of items i..j-1, without the trailing space, plus the hyphen when the
  // line ends mid-word.
  const width = (i, j) => {
    let w = 0
    for (let k = i; k < j; k++) {
      w += items[k].w
      if (k < j - 1 && items[k].space) w += m.space
    }
    if (items[j - 1].hyphen) w += hyphenW
    return w
  }
  const spacesIn = (i, j) => {
    let c = 0
    for (let k = i; k < j - 1; k++) if (items[k].space) c++
    return c
  }

  const cost = new Array(n + 1).fill(INFEASIBLE)
  const from = new Array(n + 1).fill(0)
  cost[0] = 0

  for (let j = 1; j <= n; j++) {
    if (j < n && !items[j - 1].brk) continue          // not a legal break point
    for (let i = j - 1; i >= 0; i--) {
      if (cost[i] >= INFEASIBLE) continue
      if (i > 0 && !items[i - 1].brk) continue
      const natural = width(i, j)
      const spaces = spacesIn(i, j)
      const overfull = natural - spaces * shrink - target
      // Bound the search, but do NOT refuse the line. Refusing overfull lines outright
      // made the whole paragraph infeasible at narrow measures — one impossible line and
      // the composer returned nothing, so it fell back to greedy and every hyphen the
      // browser offered went unused. TeX has the same problem and answers it the same
      // way: an overfull line is allowed, at a price nothing else can match.
      if (overfull > target) break
      let demerits
      if (j === n) {
        // The last line is not STRETCHED, but it still has to FIT. Scoring it free
        // regardless of width let the composer dump every remaining word onto it at no
        // cost, and it ran off the measure — visible immediately in the proof.
        demerits = overfull > 0 ? OVERFULL_PENALTY + overfull * OVERFULL_PENALTY : 0
      } else if (overfull > 0) {
        demerits = OVERFULL_PENALTY + overfull * OVERFULL_PENALTY
      } else {
        const slack = target - natural
        const give = slack >= 0 ? spaces * stretch : spaces * shrink
        if (give <= 0) {
          // No spaces to give: a one-word line. This paid a FLAT capped fee, which the
          // moment stretched lines started costing what they are worth became the next
          // free lunch — the composer parked "Typography" alone on a 756px line rather
          // than stretch anything. Price it by the hole it leaves, as if it had one
          // space's worth of give, so it is ranked against stretched lines and not
          // beneath them.
          if (slack === 0) demerits = 0
          else demerits = (LINE_PENALTY + MAX_BADNESS) ** 2 +
            Math.min(OVERFULL_PENALTY * 0.9, (slack / stretch - 1) ** 2 * STRETCH_PENALTY)
        } else {
          const r = slack / give
          // Bounded, or the cube runs away: with a small stretch allowance a loose line
          // scored 7e13 against an overfull line's 1e8, so the composer preferred
          // overfull lines and the paragraph came out in short, wrong pieces.
          const badness = Math.min(MAX_BADNESS, 100 * Math.abs(r) ** 3)
          demerits = (LINE_PENALTY + badness) ** 2
          // Past the cap, badness SATURATES — and a saturated line is free to get worse,
          // so the composer will sacrifice one line to buy perfect ones either side. That
          // is how "Typography is the" ended up alone on a 756px line carrying 300px of
          // word space: at r=100 it scored exactly what r=10 scores. Cost has to keep
          // climbing past the cap or there is no reason to spread the slack. Held under
          // OVERFULL_PENALTY so a loose line is still always cheaper than one that does
          // not fit — the ordering that stopped the paragraph coming out in short pieces.
          if (r > 1) demerits += Math.min(OVERFULL_PENALTY * 0.9, (r - 1) ** 2 * STRETCH_PENALTY)
          if (items[j - 1].hyphen) demerits += HYPHEN_PENALTY ** 2
        }
      }
      if (cost[i] + demerits < cost[j]) { cost[j] = cost[i] + demerits; from[j] = i }
    }
  }
  if (cost[n] >= INFEASIBLE) return null

  const breaks = []
  for (let j = n; j > 0; j = from[j]) breaks.unshift([from[j], j])
  return breaks.map(([i, j]) => {
    const runs = runsFrom(items, i, j)
    return { runs, text: runs.map(r => r.text).join(''), width: width(i, j) }
  })
}

/* ── Runs, words, items ───────────────────────────────────────────────────────
 * A paragraph arrives as RUNS — stretches of text that share an emphasis — because a
 * fitted line is one span and a span cannot carry italic in its middle. Before this, a
 * block with any inline markup skipped the fitter entirely and fell back to browser
 * flow: unfitted, unhung, sitting among fitted paragraphs. A plain string is still
 * accepted and is simply one run, so nothing that passes strings changes.
 *
 * Two words with no whitespace between them are ONE word that happens to change style
 * mid-way (`un*believable*`), and a break there would be a lie. Those items carry
 * brk:false, which is the only thing the breakers need to know about runs at all.
 */
function toRuns(input) {
  if (typeof input === 'string') return [{ type: 'text', text: input }]
  // `value` as well as `text`: that is the shape splitInlineMarkup already emits, and
  // making the apps re-map it would be a second vocabulary for one idea.
  return (input || [])
    .map(r => (r && typeof r.value === 'string' ? { type: r.type, text: r.value } : r))
    .filter(r => r && typeof r.text === 'string' && r.text !== '')
}

function runWords(runs) {
  const words = []
  for (let ri = 0; ri < runs.length; ri++) {
    for (const part of runs[ri].text.split(/(\s+)/)) {
      if (!part) continue
      const prev = words[words.length - 1]
      if (/^\s+$/.test(part)) { if (prev) prev.space = true; continue }
      if (prev && !prev.space) prev.nobrk = true   // adjacent: same word, new style
      words.push({ t: part, type: runs[ri].type, space: false })
    }
  }
  return words
}

/* Words -> composable items. With hyphenation off, one item per word. With it on, a
 * word becomes its fragments, each breakable, each carrying a hyphen if a line ends
 * there. The last fragment of a word is the one that owns the following space. */
function buildItems(runs, m, opts) {
  const words = runWords(runs)
  const items = []
  words.forEach((word, wi) => {
    const last = wi === words.length - 1
    const cuts = opts.hyphenate ? hyphenPoints(word.t) : []
    const tag = word.type
    if (!cuts.length) {
      items.push({ t: word.t, w: m.measure(word.t, tag), space: word.space && !last,
                   brk: !word.nobrk, hyphen: false, type: tag })
      return
    }
    let prev = 0
    for (const c of cuts) {
      const frag = word.t.slice(prev, c)
      items.push({ t: frag, w: m.measure(frag, tag), space: false, brk: true, hyphen: true, type: tag })
      prev = c
    }
    const tail = word.t.slice(prev)
    items.push({ t: tail, w: m.measure(tail, tag), space: word.space && !last,
                 brk: !word.nobrk, hyphen: false, type: tag })
  })
  // A break is only legal where a space or a hyphen follows; the fragments before a cut
  // already carry hyphen:true, so every item here is breakable except the very last.
  if (items.length) items[items.length - 1].brk = true
  return items
}

/** Items i..j as runs, merging neighbours that share an emphasis. `text` is the whole
 *  line for the things that only need characters — counting spaces, finding the glyph
 *  that hangs. */
function runsFrom(items, i, j) {
  const runs = []
  for (let k = i; k < j; k++) {
    const it = items[k]
    const text = it.t + (k < j - 1 && it.space ? ' ' : '')
    const prev = runs[runs.length - 1]
    if (prev && prev.type === it.type) prev.text += text
    else runs.push({ type: it.type, text })
  }
  if (runs.length && items[j - 1].hyphen) runs[runs.length - 1].text += '-'
  return runs
}

/* ── Breaking a paragraph ─────────────────────────────────────────────────── */

/**
 * @returns [{ text, indentPx, wordSpacingPx, trackingPx, glyphScaling }]
 * or null when the mode is off / the text cannot be measured yet.
 */
export function layoutParagraph(input, reference, opts, indentPx = 0) {
  const { mode } = opts
  if (mode === 'off' || !reference) return null
  const runs = toRuns(input)
  if (!runs.some(r => r.text.trim())) return null
  const columnWidth = reference.clientWidth
  if (!columnWidth) return null

  // Desired is a baseline, not a spend: it shifts every width the breaker sees, so the
  // paragraph is composed as it will actually be set. The natural measurer stays
  // reachable as `.base`, which is what px conversions and the axis work use.
  const m = withDesired(makeMeasurer(reference, opts.runStyles), budgetsOf(opts))
  const items = buildItems(runs, m, opts)
  if (!items.length) return null

  // Centred rag splits the shortfall between the two margins instead of hanging it all
  // on the right: a line 40 short sits 20 in from each side, so the rag reads as a
  // deliberate double edge rather than a ragged right with a flush left.
  const offsetFor = target => (opts.center ? (columnWidth - target) / 2 : 0)

  /* A hanging character buys the line exactly its own width of extra room, on the side
   * it hangs: shift left by what protrudes left, and let the measure run long by what
   * protrudes right. The INK then lands on the measure, which is the only edge anybody
   * sees. */
  const finish = (line, target, indent, isLast, flush) => {
    const p = protrude(line.runs, m, opts)
    // An indented line does NOT hang left. The indent is a deliberate offset and the
    // quote pulling back out of it reads as a broken indent rather than a straight
    // margin — the eye has a stepped edge to measure against, so there is no hole to
    // fix. Keyed on a real indent, not on the centred rag's offset, which is not one.
    const left = line.indented || opts.center ? 0 : p.left
    return {
      text: line.text,
      runs: line.runs,
      indentPx: indent - left,
      ...fitLine(line.text, line.width, target - 1 + left + p.right, opts, m, isLast, flush, line.runs),
    }
  }

  // Justified composes the whole paragraph at once; a rag walks it line by line.
  if (mode === 'justified' && opts.composer !== 'single-line') {
    const target = columnWidth - indentPx
    const composed = kpBreak(items, target, m, opts)
    if (composed) {
      return composed.map((l, i) =>
        finish({ ...l, indented: i === 0 && indentPx > 0 }, target,
               i === 0 ? indentPx : 0, i === composed.length - 1, true))
    }
    // fall through to greedy when nothing scored: better a plain paragraph than none
  }
  const flush = mode === 'justified'

  const lines = []
  let start = 0, lineWidth = 0, index = 0
  let indent = indentPx
  let target = targetFor(columnWidth, opts.ragWidth, 0, mode) - indent

  const push = (from, to) => {
    lines.push({ ...(() => { const runs = runsFrom(items, from, to)
                             return { runs, text: runs.map(r => r.text).join('') } })(),
                 width: lineWidth, target, indented: indent > 0,
                 indentPx: indent + offsetFor(target) })
  }

  for (let k = 0; k < items.length; k++) {
    const it = items[k]
    const gap = k > start && items[k - 1].space ? m.space : 0
    const withWord = k === start ? it.w : lineWidth + gap + it.w
    // A word that overruns by less than the condense allowance is TAKEN, and the line
    // squeezed to fit — cheaper than the hole its absence would leave.
    const squeezed = withWord * (condenseFloor(opts) / 100)
    // items[k-1].brk is what keeps a run boundary INSIDE a word from becoming a break.
    if (k > start && withWord > target && squeezed > target && items[k - 1].brk) {
      push(start, k)
      index += 1
      indent = 0
      target = targetFor(columnWidth, opts.ragWidth, index, mode)
      start = k; lineWidth = it.w
    } else {
      lineWidth = withWord
    }
  }
  if (start < items.length) push(start, items.length)

  return lines.map((l, i) => finish(l, l.target, l.indentPx, i === lines.length - 1, flush))
}

/** Inline style for one fitted line. */
export function lineStyle(l) {
  return {
    display: 'inline-block',
    whiteSpace: 'pre',
    transformOrigin: 'left',
    marginLeft: l.indentPx ? `${l.indentPx}px` : undefined,
    wordSpacing: l.wordSpacingPx ? `${l.wordSpacingPx}px` : undefined,
    letterSpacing: l.trackingPx ? `${l.trackingPx}px` : undefined,
    transform: l.glyphScaling === 1 ? undefined : `scaleX(${l.glyphScaling})`,
    // The axis, when the font had one to move. Not additive with the block's own
    // settings — fvs already carries them, which is why setAxis builds the whole string.
    fontVariationSettings: l.fvs,
  }
}

/* ── Static-page helper ───────────────────────────────────────────────────────
 * Fit an element's own text in place, and keep it fitted through resizes. Reads the
 * element's live computed style, so it inherits whatever the page already sets.
 *
 *   applyTo(document.querySelector('.lede'), { mode: 'flattersatz', ragWidth: 60 })
 *
 * Returns a stop() that disconnects the observer and restores the original text.
 */
export function applyTo(el, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const original = el.textContent
  const paint = () => {
    const lines = layoutParagraph(original, el, o, o.firstIndent)
    if (!lines) { el.textContent = original; return }
    el.textContent = ''
    for (const l of lines) {
      const row = document.createElement('div')
      const span = document.createElement('span')
      Object.assign(span.style, lineStyle(l))
      span.textContent = l.text
      row.appendChild(span)
      el.appendChild(row)
    }
  }
  paint()
  const ro = new ResizeObserver(paint)
  ro.observe(el)
  return () => { ro.disconnect(); el.textContent = original }
}
