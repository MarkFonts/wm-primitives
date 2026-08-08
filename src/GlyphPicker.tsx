// GlyphPicker — interactive glyph browser shared by ReCal + font-proofer (wm-primitives #2).
// Equal-sized cell grid + an UNBOXED specimen viewer: the selected glyph sits on real
// metric rules (descender/baseline/x-height/cap/ascender) that END AT THE SIDEBEARINGS —
// two verticals at the origin and the advance width, so the frame is the glyph's own
// cell, font-editor style. Advance width is measured from the DOM (an inline span's
// width IS the advance, honoring variation/feature settings); the baseline is pinned
// with a flex-baseline strut so rules never drift from the rendered glyph.
//
// App-agnostic: groups (incl. ssXX feature "escape hatches") via props; the font
// arrives as CSS on the root so axis changes re-render nothing; optional cmap ranges
// filter unsupported chars; optional `metrics` prop (from real font data) draws the
// rules — without it the specimen just centers.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { isSupported, type CmapRanges } from './glyphset'
import { loadNamePages, algorithmicName } from './glyphNames'
import './GlyphPicker.css'

/** One cell. `ffs` is a raw font-feature-settings fragment for this cell (e.g.
    `"ss02" 1` or `'aalt' 3, 'rclt' 1`); `note` is appended to the U+ readout when
    selected (e.g. "aalt 3"); `key` disambiguates cells sharing a char. */
export interface GlyphPickerCell {
  ch: string
  ffs?: string
  note?: string
  key?: string
}

export interface GlyphPickerGroup {
  label: string
  /** Shorthand: plain string of chars (cmap-filtered). */
  chars?: string
  /** Explicit cells (pre-scoped to the font — no cmap filter). */
  cells?: GlyphPickerCell[]
  /** Group-wide ffs fragment; a cell's own ffs overrides. */
  ffs?: string
}

/** App-driven per-cell decoration (flash effects etc). Return undefined for none.
    `nonce` re-keys the cell so a CSS animation restarts. */
export type GlyphCellState = (cell: GlyphPickerCell) =>
  { className?: string; style?: CSSProperties; nonce?: number; onAnimationEnd?: () => void } | undefined

/** Font-unit metrics (from the font's real tables / design data). baseline is 0. */
export interface GlyphPickerMetrics {
  upm: number
  ascender: number
  capHeight: number
  xHeight: number
  descender: number   // negative, e.g. -245
}

// Measure metrics EMPIRICALLY from the live rendered instance — the browser has
// already interpolated the design space, so for any font at any axis position we
// just read the ink: /H top = cap, /x top = x-height, /h top = ascender, /g bottom
// = descender (the house metric definitions). A hidden canvas inherits
// font-variation-settings from its element style (Chromium), so variations apply.
// Returns null until the font is loaded/measurable.
export function measureGlyphMetrics(
  fontFamily: string, fontVariationSettings?: string, fontFeatureSettings?: string,
): GlyphPickerMetrics | null {
  try {
    const c = document.createElement('canvas')
    c.style.cssText = 'position:absolute;visibility:hidden'
    if (fontVariationSettings) c.style.fontVariationSettings = fontVariationSettings
    if (fontFeatureSettings) c.style.fontFeatureSettings = fontFeatureSettings
    document.body.appendChild(c)
    const ctx = c.getContext('2d')
    if (!ctx) { c.remove(); return null }
    ctx.font = `1000px ${fontFamily}`
    const ink = (s: string) => ctx.measureText(s)
    const cap = ink('H').actualBoundingBoxAscent
    const x = ink('x').actualBoundingBoxAscent
    const asc = ink('h').actualBoundingBoxAscent
    const desc = -ink('g').actualBoundingBoxDescent
    c.remove()
    if (!cap || !x) return null   // font not loaded yet → fallback glyphs measured
    return { upm: 1000, ascender: Math.max(asc, cap), capHeight: cap, xHeight: x, descender: desc }
  } catch { return null }
}

export interface GlyphPickerProps {
  groups: GlyphPickerGroup[]
  /** CSS for the specimen: family required; variation/feature settings optional. */
  fontFamily: string
  fontVariationSettings?: string
  fontFeatureSettings?: string
  fontOpticalSizing?: 'auto' | 'none'
  /** cmap ranges to filter unsupported chars (explicit-cells groups skip the filter). */
  ranges?: CmapRanges | null
  /** App-driven per-cell decoration (flash effects etc). */
  cellState?: GlyphCellState
  /** Glyph names: 'nice' (AGLFN), 'unicode' (official), 'both', or a custom resolver.
      Data is page-chunked and lazy-loaded for only the codepoints on screen; cells
      grow a caption beneath the glyph. */
  names?: 'nice' | 'unicode' | 'both' | ((cell: GlyphPickerCell) => string | undefined)
  /** Draw metric rules + sidebearing verticals around the big glyph. */
  metrics?: GlyphPickerMetrics
  /** 'side' = specimen column left of the grid; 'bottom' = grid on top, specimen band docked below. */
  layout?: 'side' | 'bottom'
  /** How much room the specimen takes: 1 = single column (~280px), 2 = double (~560px). */
  specimenSpan?: 1 | 2
  /** Escape hatch: exact CSS size for the specimen column width (side) / band height (bottom). */
  specimenSize?: number | string
  onSelect?: (cell: GlyphPickerCell) => void
  className?: string
  style?: CSSProperties
}

const INVISIBLE_CPS = new Set([
  0x0020, 0x00a0, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
  0x2007, 0x2008, 0x2009, 0x200a, 0x200b, 0x202f, 0x205f, 0x3000, 0x200c,
  0x200d, 0x000d, 0x000a, 0x0009,
])
const isInvisible = (ch: string) => !ch.trim() || INVISIBLE_CPS.has(ch.codePointAt(0) ?? 0)
// Combining marks (Mn) render blank alone — hang them on a dotted circle. Anchored
// to the string START so pre-composed cells (already "◌̀") don't get a second ◌.
const display = (ch: string) => (/^\p{Mn}/u.test(ch) ? '◌' + ch : ch)
// The reported codepoint skips a leading dotted-circle scaffold (◌̀ → U+0300, the
// mark itself, not U+25CC).
const codeOf = (s: string) => {
  const cps = [...s].map(c => c.codePointAt(0) ?? 0)
  return cps.find(cp => cp !== 0x25cc) ?? cps[0] ?? 0
}
const hex = (ch: string) => codeOf(ch).toString(16).toUpperCase().padStart(4, '0')

// Match key for name search: case folded, separators ignored. Deliberately
// INCLUSIVE — plain substring, so "ger" finds germandbls AND dagger, and names
// without spaces (most AGLFN names) still match mid-word.
const loose = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '')

const cellId = (c: GlyphPickerCell) => c.key ?? `${c.ch}|${c.ffs ?? ''}`

// Memoized so selecting a glyph re-renders only the two cells whose `active` flips —
// not the whole (potentially ~2,500-cell) grid. `state` (flash etc) is compared by
// identity, so only cells whose state entry changed re-render.
const Cell = memo(function Cell({ cell, active, state, name, onPick }: {
  cell: GlyphPickerCell; active: boolean
  state?: { className?: string; style?: CSSProperties; nonce?: number; onAnimationEnd?: () => void }
  name?: string
  onPick: (cell: GlyphPickerCell) => void
}) {
  return (
    <button
      key={state?.nonce}
      className={`gp-cell${active ? ' gp-cell--active' : ''}${isInvisible(cell.ch) ? ' gp-cell--invisible' : ''}${name !== undefined ? ' gp-cell--named' : ''}${state?.className ? ' ' + state.className : ''}`}
      style={cell.ffs || state?.style ? { ...(cell.ffs ? { fontFeatureSettings: cell.ffs } : null), ...state?.style } : undefined}
      onClick={() => onPick(cell)}
      onAnimationEnd={state?.onAnimationEnd}
      title={`U+${hex(cell.ch)}${cell.note ? ' · ' + cell.note : ''}${name ? ' · ' + name : ''}`}>
      <span className="gp-cell-ch">{display(cell.ch)}</span>
      {name !== undefined && <span className="gp-cell-name">{name || '\u00a0'}</span>}
    </button>
  )
})

// Copy affordance (from the house CopyButton): copy icon → checkmark, 2s revert.
function CopyIcon({ ok }: { ok: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      {ok ? (
        <path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
      ) : (
        <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M2.75.5A1.75 1.75 0 0 0 1 2.25v7.5c0 .966.784 1.75 1.75 1.75H4.5V10H2.75a.25.25 0 0 1-.25-.25v-7.5A.25.25 0 0 1 2.75 2h5.5a.25.25 0 0 1 .25.25V3H10v-.75A1.75 1.75 0 0 0 8.25.5zm5 4A1.75 1.75 0 0 0 6 6.25v7.5c0 .966.784 1.75 1.75 1.75h5.5A1.75 1.75 0 0 0 15 13.75v-7.5a1.75 1.75 0 0 0-1.75-1.75zM7.5 6.25A.25.25 0 0 1 7.75 6h5.5a.25.25 0 0 1 .25.25v7.5a.25.25 0 0 1-.25.25h-5.5a.25.25 0 0 1-.25-.25z" />
      )}
    </svg>
  )
}

// Label placement: each label magnets to its rule; colliding labels share the
// displacement symmetrically — so coincident rules (asc == cap) split around the
// common line (first label above it, second below).
function placeLabels(desired: number[], minGap = 11): number[] {
  const y = [...desired]
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 1; i < y.length; i++) {
      const overlap = y[i - 1] + minGap - y[i]
      if (overlap > 0) { y[i - 1] -= overlap / 2; y[i] += overlap / 2 }
    }
  }
  return y
}

// The unboxed specimen: glyph on metric rules ending at sidebearing verticals.
function Specimen({ cell, metrics, fontKey }: {
  cell: GlyphPickerCell; metrics?: GlyphPickerMetrics; fontKey: string
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const glyphRef = useRef<HTMLSpanElement | null>(null)
  const strutRef = useRef<HTMLSpanElement | null>(null)
  // Measured geometry, all px within the specimen box: sidebearing verticals from the
  // glyph span (span width == advance width), the real BASELINE from the strut's
  // bottom edge, and the rendered font-size — so rules anchor to the actual glyph
  // regardless of how the layout sizes/stretches the specimen.
  const [geom, setGeom] = useState<{ sb: [number, number]; baselineY: number; fpx: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current, g = glyphRef.current, s = strutRef.current
      if (!box || !g) return setGeom(null)
      const b = box.getBoundingClientRect(), r = g.getBoundingClientRect()
      const baselineY = s ? s.getBoundingClientRect().bottom - b.top : r.bottom - b.top
      setGeom({ sb: [r.left - b.left, r.right - b.left], baselineY, fpx: parseFloat(getComputedStyle(g).fontSize) })
    }
    measure()
    // Webfonts land async — re-measure once loaded so the verticals don't lie.
    document.fonts?.ready.then(measure).catch(() => {})
    const ro = new ResizeObserver(measure)
    if (boxRef.current) ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [cell.ch, cell.ffs, fontKey, metrics])

  if (!metrics) {
    return (
      <div className="gp-specimen gp-specimen--bare" ref={boxRef}>
        <span ref={glyphRef} className="gp-specimen-glyph"
          style={cell.ffs ? { fontFeatureSettings: cell.ffs } : undefined}>{display(cell.ch)}</span>
      </div>
    )
  }

  const { upm, ascender, capHeight, xHeight, descender } = metrics
  // Rules hang off the MEASURED baseline in rendered px: y = baseline − v/upm·fontSize.
  const yOf = (v: number) => (geom ? geom.baselineY - (v / upm) * geom.fpx : 0)
  const rules: [string, number][] = [
    ['asc', ascender], ['cap', capHeight], ['x', xHeight], ['base', 0], ['desc', descender],
  ]
  const labelYs = placeLabels(rules.map(([, v]) => yOf(v)))
  // Metric lines END at the sidebearing verticals (+ a small overhang for the label);
  // until the geometry is measured they stay hidden rather than lying at full width.
  const OVERHANG = 14
  const ruleBox: CSSProperties = geom
    ? { left: geom.sb[0] - OVERHANG, width: geom.sb[1] - geom.sb[0] + OVERHANG * 2 }
    : { visibility: 'hidden' }
  const labelBox: CSSProperties = geom ? { left: geom.sb[0] - OVERHANG - 6 } : { visibility: 'hidden' }
  return (
    <div className="gp-specimen" ref={boxRef}
      style={{ ['--gp-asc' as string]: `${ascender / upm}em`, ['--gp-desc' as string]: `${-descender / upm}em` }}>
      {rules.map(([label, v]) => (
        <div key={label} className={`gp-rule${v === 0 ? ' gp-rule--base' : ''}`} style={{ top: yOf(v), ...ruleBox }} />
      ))}
      {rules.map(([label], i) => (
        <span key={label} className="gp-rule-label" style={{ top: labelYs[i], ...labelBox }}>{label}</span>
      ))}
      {geom && geom.sb[1] - geom.sb[0] > 0 && (
        <>
          <div className="gp-sb" style={{ left: geom.sb[0], top: yOf(ascender), height: yOf(descender) - yOf(ascender) }} />
          <div className="gp-sb" style={{ left: geom.sb[1], top: yOf(ascender), height: yOf(descender) - yOf(ascender) }} />
        </>
      )}
      {/* flex-baseline strut: its bottom sits on the shared baseline — the measured
          anchor every rule hangs off, so rules and glyph can never drift apart. */}
      <div className="gp-specimen-line">
        <span ref={strutRef} className="gp-strut" aria-hidden />
        <span ref={glyphRef} className="gp-specimen-glyph"
          style={cell.ffs ? { fontFeatureSettings: cell.ffs } : undefined}>{display(cell.ch)}</span>
      </div>
    </div>
  )
}

export function GlyphPicker({
  groups, fontFamily, fontVariationSettings, fontFeatureSettings, fontOpticalSizing,
  ranges = null, metrics, layout = 'side', specimenSpan = 1, specimenSize,
  cellState, names, onSelect, className, style,
}: GlyphPickerProps) {
  const [active, setActive] = useState<GlyphPickerCell>({ ch: 'A' })
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  const pick = useCallback((cell: GlyphPickerCell) => {
    setActive(cell)
    setCopied(false)
    onSelect?.(cell)
  }, [onSelect])

  const copyActive = useCallback(() => {
    navigator.clipboard?.writeText(active.ch).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [active.ch])

  // Lazy name data: load only the pages covering the codepoints actually present.
  const [nameData, setNameData] = useState<Map<number, [string | 0, string | 0]> | null>(null)
  useEffect(() => {
    if (!names || typeof names === 'function') { setNameData(null); return }
    let alive = true
    const cps = new Set<number>()
    for (const g of groups) {
      for (const c of g.cells ?? []) cps.add(codeOf(c.ch))
      for (const ch of g.chars ?? '') cps.add(codeOf(ch))
    }
    loadNamePages(cps).then(m => { if (alive) setNameData(m) })
    return () => { alive = false }
  }, [names, groups])

  // Resolve each group to cells: `chars` shorthand gets cmap-filtered; explicit
  // `cells` are pre-scoped. Group ffs applies unless the cell has its own. Then the
  // search query — match by char or by U+ hex fragment.
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const qLoose = loose(q)
    return groups
      .map(g => {
        let list: GlyphPickerCell[] = g.cells
          ? g.cells.map(c => ({ ...c, ffs: c.ffs ?? g.ffs }))
          : [...(g.chars ?? '')]
              .filter(c => isSupported(c, ranges, /\p{Mn}/u.test(c)))
              .map(ch => ({ ch, ffs: g.ffs }))
        if (q) list = list.filter(c => {
          if (c.ch.toLowerCase() === q || hex(c.ch).toLowerCase().includes(q)) return true
          const e = nameData?.get(codeOf(c.ch))
          return !!e && [e[0], e[1]].some(n => n && loose(n).includes(qLoose))
        })
        return { label: g.label, list }
      })
      .filter(g => g.list.length > 0)
  }, [groups, ranges, query, nameData])

  // Caption for a cell (short form) + full name line for the console.
  const nameParts = useCallback((cell: GlyphPickerCell): { nice?: string; uni?: string } => {
    const cp = codeOf(cell.ch)
    const e = nameData?.get(cp)
    return { nice: e?.[0] || undefined, uni: (e?.[1] || undefined) ?? algorithmicName(cp) }
  }, [nameData])
  // Official Unicode names are ALL CAPS by convention — display them lowercased;
  // nice names keep their casing (Aacute vs aacute is meaningful).
  const captionFor = useCallback((cell: GlyphPickerCell): string | undefined => {
    if (!names) return undefined
    if (typeof names === 'function') return names(cell)
    const { nice, uni } = nameParts(cell)
    const luni = uni?.toLowerCase()
    return (names === 'unicode' ? luni ?? nice : nice ?? luni) ?? ''
  }, [names, nameParts])

  // The specimen font travels as CSS custom props consumed ONLY by glyph-bearing
  // elements (.gp-specimen / .gp-cell) — inherited font-variation-settings on the
  // root would drift the picker's own chrome in hosts whose UI font shares the
  // variable font (ReCal). Axis changes still re-render nothing.
  const specimen: CSSProperties = {
    ['--gp-font' as string]: fontFamily,
    ['--gp-fvs' as string]: fontVariationSettings ?? 'normal',
    ['--gp-ffs' as string]: fontFeatureSettings ?? 'normal',
    ['--gp-opsz' as string]: fontOpticalSizing ?? 'auto',
  }
  const fontKey = `${fontFamily}|${fontVariationSettings ?? ''}|${fontFeatureSettings ?? ''}|${fontOpticalSizing ?? ''}`

  // Specimen room: span presets (1 ≈ 280px / 2 ≈ 560px column; 50% / 66% band) or an
  // exact size. The glyph scales with the container (cqw), so more room = bigger glyph.
  const sizeCss = specimenSize ?? (layout === 'side'
    ? (specimenSpan === 2 ? '560px' : '280px')
    : (specimenSpan === 2 ? '66%' : '50%'))

  // Specimen + console: glyph first, then ITS data (U+ / copy), then the grid tool (search).
  const side = (
    <div className="gp-side" style={{ flexBasis: sizeCss }}>
      <Specimen cell={active} metrics={metrics} fontKey={fontKey} />
      <div className="gp-console">
        <button className="gp-copy" onClick={copyActive} title="Copy character to clipboard">
          <span className="gp-code">U+{hex(active.ch)}{active.note ? ` · ${active.note}` : ''}</span>
          <CopyIcon ok={copied} />
        </button>
        {names && typeof names !== 'function' && (() => {
          const { nice, uni } = nameParts(active)
          const line = [nice, uni?.toLowerCase()].filter(Boolean).join(' — ')
          return line ? <div className="gp-name">{line}</div> : null
        })()}
        <input
          className="gp-search" type="search" placeholder="Search name, glyph, or U+ code…"
          value={query} onChange={e => setQuery(e.target.value)} spellCheck={false} />
      </div>
    </div>
  )

  return (
    <div className={`gp gp--${layout}${className ? ' ' + className : ''}`} style={{ ...specimen, ...style }}>
      {layout === 'side' && side}
      <div className="gp-groups">
        {visibleGroups.map(g => (
          <div key={g.label} className="gp-group">
            <div className="gp-group-label">{g.label}</div>
            <div className="gp-grid">
              {g.list.map((c, i) => (
                <Cell key={c.key ?? i} cell={c}
                  active={cellId(active) === cellId(c)}
                  state={cellState?.(c)}
                  name={captionFor(c)}
                  onPick={pick} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {layout === 'bottom' && side}
    </div>
  )
}
