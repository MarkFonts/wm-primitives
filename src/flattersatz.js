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

export const MIN_MEASURE = 140      // a rag line never gets narrower than this
export const DEFAULTS = {
  mode: 'off',                      // 'off' | 'justified' | 'flattersatz'
  ragWidth: 40,
  // All three budgets start at 100 — no stretching at all. Justified still reaches its
  // measure, because the uncapped residue is fenced to that mode; a rag simply stops
  // short. Open a budget deliberately and it is spent in both. This is also why moving
  // between Swiss Rag and Justify only adds or removes the rag width: nothing else
  // about the setting changes underneath you.
  maxWordSpacing: 100,              // percent
  maxTracking: 100,                 // percent
  glyphScaling: 100,                // percent — <100 condenses, >100 stretches, 100 off
  center: false,                    // centred rag: split the shortfall onto both sides
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
  maxTracking: 100,
  maxWordSpacing: 100,
  glyphScaling: 100,
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

/** Widths for one style, keyed by string. Cleared whenever the style key moves. */
function makeMeasurer(reference) {
  const el = getProbe(reference)
  const cache = new Map()
  const measure = s => {
    let w = cache.get(s)
    if (w === undefined) {
      el.textContent = s
      w = el.getBoundingClientRect().width
      cache.set(s, w)
    }
    return w
  }
  return { measure, space: measure(' '), em: parseFloat(getComputedStyle(reference).fontSize) || 16 }
}

/* ── Fitting one line ─────────────────────────────────────────────────────── */

const NONE = { wordSpacingPx: 0, trackingPx: 0, glyphScaling: 1 }

/** One knob, two directions: below 100 is the condense floor, above it the stretch cap. */
function condenseFloor(limits) {
  return Math.min(100, limits.glyphScaling ?? 100)
}
function stretchCap(limits) {
  return Math.max(100, limits.glyphScaling ?? 100)
}

function fitLine(text, width, target, limits, m, isLast, flush) {
  // Overset: the breaker took one more word than fits, on the promise that condensing
  // is allowed. Squeeze to the target, never past the floor.
  if (width > target) {
    const floor = condenseFloor(limits) / 100
    if (floor >= 1) return NONE
    return { ...NONE, glyphScaling: Math.max(floor, target / width) }
  }
  if (isLast || width >= target) return NONE
  const spaces = (text.match(/[  ]/g) ?? []).length
  const gaps = Math.max(Array.from(text).length - 1, 0)

  let deficit = target - width
  let scaling = 100, tracking = 100, wordSpacing = 100

  // 1. tracking, capped
  const trackRoom = gaps * (limits.maxTracking / 100 - 1) * m.em
  if (deficit > 0 && trackRoom > 0) {
    const spend = Math.min(deficit, trackRoom)
    tracking = 100 + (limits.maxTracking - 100) * (spend / trackRoom)
    deficit -= spend
  }
  // 2. word spacing, capped
  const wordRoom = spaces * (limits.maxWordSpacing / 100 - 1) * m.space
  if (deficit > 0 && wordRoom > 0) {
    const spend = Math.min(deficit, wordRoom)
    wordSpacing = 100 + (limits.maxWordSpacing - 100) * (spend / wordRoom)
    deficit -= spend
  }
  // 3. glyph scaling, capped — last resort, and 100 (off) unless asked for
  const cap = stretchCap(limits)
  if (deficit > 0 && cap > 100) {
    const room = width * (cap / 100 - 1)
    if (room > 0) {
      const spend = Math.min(deficit, room)
      scaling = 100 + (cap - 100) * (spend / room)
      deficit -= spend
    }
  }
  // 4. justified only: residue goes back to word spacing, uncapped. A rag stops short.
  if (flush && deficit > 0 && spaces > 0) {
    wordSpacing += ((deficit / spaces) / (scaling / 100)) / m.space * 100
  }
  return {
    wordSpacingPx: (wordSpacing / 100 - 1) * m.space,
    trackingPx: (tracking / 100 - 1) * m.em,
    glyphScaling: scaling / 100,
  }
}

/** Even lines get the column; odd lines get the column less the rag. */
function targetFor(columnWidth, ragWidth, lineIndex, mode) {
  if (mode !== 'flattersatz') return columnWidth
  return lineIndex % 2 === 0 ? columnWidth : Math.max(MIN_MEASURE, columnWidth - ragWidth)
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
const INFEASIBLE = 1e9

function kpBreak(words, widths, space, target, m, limits) {
  const n = words.length
  // Stretch and shrink per space, in px. The budgets set them where the user has
  // opened one; otherwise a space may give a third of itself and take a sixth, which
  // is close to TeX's interword glue and keeps the scoring honest.
  const stretch = Math.max(space * ((limits.maxWordSpacing || 100) / 100 - 1), space / 3)
  // NO shrink. TeX gives interword glue a shrink component, but our fitter has none to
  // spend — word spacing only opens — so a composer that counted on shrinking produced
  // lines wider than the column (a 758 line in a 756 measure, seen in testing). Until
  // there is a minimum word space to shrink INTO, the composer may only stretch.
  const shrink = 0

  // prefix[i] = natural width of words 0..i-1 with single spaces
  const prefix = [0]
  for (let i = 0; i < n; i++) prefix.push(prefix[i] + widths[i] + (i < n - 1 ? space : 0))

  const cost = new Array(n + 1).fill(INFEASIBLE)
  const from = new Array(n + 1).fill(0)
  cost[0] = 0

  for (let j = 1; j <= n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      if (cost[i] >= INFEASIBLE) continue
      const natural = prefix[j] - prefix[i] - (j < n ? space : 0)
      const spaces = j - i - 1
      if (natural - spaces * shrink > target) break   // unfixably long: stop widening
      let demerits
      if (j === n) {
        demerits = 0                                   // the last line may end short
      } else {
        const slack = target - natural
        const give = slack >= 0 ? spaces * stretch : spaces * shrink
        if (give <= 0) { if (slack !== 0) continue; demerits = 0 }
        else {
          const r = slack / give
          if (r < -1) continue
          const badness = 100 * Math.abs(r) ** 3
          demerits = (LINE_PENALTY + badness) ** 2
        }
      }
      if (cost[i] + demerits < cost[j]) { cost[j] = cost[i] + demerits; from[j] = i }
    }
  }
  if (cost[n] >= INFEASIBLE) return null               // nothing feasible: caller falls back

  const breaks = []
  for (let j = n; j > 0; j = from[j]) breaks.unshift([from[j], j])
  return breaks.map(([i, j]) => ({
    text: words.slice(i, j).join(' '),
    width: prefix[j] - prefix[i] - (j < n ? space : 0),
  }))
}

/* ── Breaking a paragraph ─────────────────────────────────────────────────── */

/**
 * @returns [{ text, indentPx, wordSpacingPx, trackingPx, glyphScaling }]
 * or null when the mode is off / the text cannot be measured yet.
 */
export function layoutParagraph(text, reference, opts, indentPx = 0) {
  const { mode } = opts
  if (mode === 'off' || !reference || !text.trim()) return null
  const columnWidth = reference.clientWidth
  if (!columnWidth) return null

  const m = makeMeasurer(reference)
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return null

  // Centred rag splits the shortfall between the two margins instead of hanging it all
  // on the right: a line 40 short sits 20 in from each side, so the rag reads as a
  // deliberate double edge rather than a ragged right with a flush left.
  const offsetFor = target => (opts.center ? (columnWidth - target) / 2 : 0)

  // Justified composes the whole paragraph at once; a rag walks it line by line.
  if (mode === 'justified') {
    const widths = words.map(w => m.measure(w))
    const target = columnWidth - indentPx
    const composed = kpBreak(words, widths, m.space, target, m, opts)
    if (composed) {
      return composed.map((l, i) => ({
        text: l.text,
        indentPx: i === 0 ? indentPx : 0,
        ...fitLine(l.text, l.width, target - 1, opts, m, i === composed.length - 1, true),
      }))
    }
    // fall through to greedy when nothing scored: better a plain paragraph than none
  }

  const lines = []
  let line = [], lineWidth = 0, index = 0
  let indent = indentPx
  let target = targetFor(columnWidth, opts.ragWidth, 0, mode) - indent

  for (const word of words) {
    const w = m.measure(word)
    const withWord = line.length ? lineWidth + m.space + w : w
    // A word that overruns by less than the condense allowance is TAKEN, and the line
    // squeezed to fit — cheaper than the hole its absence would leave.
    const squeezed = withWord * (condenseFloor(opts) / 100)
    if (line.length && withWord > target && squeezed > target) {
      lines.push({ text: line.join(' '), width: lineWidth, target, indentPx: indent + offsetFor(target) })
      index += 1
      indent = 0
      target = targetFor(columnWidth, opts.ragWidth, index, mode)
      line = [word]; lineWidth = w
    } else {
      line.push(word); lineWidth = withWord
    }
  }
  if (line.length) lines.push({ text: line.join(' '), width: lineWidth, target, indentPx: indent + offsetFor(target) })

  return lines.map((l, i) => ({
    text: l.text,
    indentPx: l.indentPx,
    ...fitLine(l.text, l.width, l.target - 1, opts, m, i === lines.length - 1, mode === 'justified'),
  }))
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
