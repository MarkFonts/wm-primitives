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
 * FLATTERSATZ — the measure ALTERNATES: even lines get the full column, odd lines
 * get the column minus `ragWidth` (floored at MIN_MEASURE). Each line is then fitted
 * to its own target, so the right edge is a designed two-step rag rather than
 * wherever the words happened to stop. This is the trick the demo is built around,
 * and it is why the sample reads as "ragged" while every line is in fact flush.
 *
 * THE BUDGET. A line short of its target has a deficit to spend, and spends it in
 * this order, each capped by its own limit before the next takes over:
 *
 *   1. tracking        (letter-spacing)         — spreads evenly, no rivers
 *   2. word spacing    (word-spacing)           — the reader forgives it
 *   3. glyph scaling   (scaleX on the line)     — LAST, and off by default
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
 * Whatever survives all three caps goes back to word spacing, uncapped: a line has to
 * reach its target, and a loose word space is the most forgivable way to get there.
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
  maxWordSpacing: 133,              // percent — InDesign's default maximum
  maxTracking: 102,                 // percent
  maxGlyphScaling: 100,             // percent — 100 is off; the UI caps it at 110,
                                    // because past that the proof is of a face you did not draw
  firstIndent: 0,
  indent: 0,                        // 0 by default: the blocks already carry
                                    // inter-paragraph space, and indent + space is
                                    // two signals for one job
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

function fitLine(text, width, target, limits, m, isLast) {
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
  if (deficit > 0 && limits.maxGlyphScaling > 100) {
    const room = width * (limits.maxGlyphScaling / 100 - 1)
    if (room > 0) {
      const spend = Math.min(deficit, room)
      scaling = 100 + (limits.maxGlyphScaling - 100) * (spend / room)
      deficit -= spend
    }
  }
  // 4. residue goes back to word spacing, uncapped: the line must reach its target
  if (deficit > 0 && spaces > 0) {
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

  const lines = []
  let line = [], lineWidth = 0, index = 0
  let indent = indentPx
  let target = targetFor(columnWidth, opts.ragWidth, 0, mode) - indent

  for (const word of words) {
    const w = m.measure(word)
    const withWord = line.length ? lineWidth + m.space + w : w
    if (line.length && withWord > target) {
      lines.push({ text: line.join(' '), width: lineWidth, target, indentPx: indent })
      index += 1
      indent = 0
      target = targetFor(columnWidth, opts.ragWidth, index, mode)
      line = [word]; lineWidth = w
    } else {
      line.push(word); lineWidth = withWord
    }
  }
  if (line.length) lines.push({ text: line.join(' '), width: lineWidth, target, indentPx: indent })

  return lines.map((l, i) => ({
    text: l.text,
    indentPx: l.indentPx,
    ...fitLine(l.text, l.width, l.target - 1, opts, m, i === lines.length - 1),
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
