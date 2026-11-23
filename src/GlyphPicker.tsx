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
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { isSupported, type CmapRanges } from './glyphset'
import { loadNamePages, algorithmicName } from './glyphNames'
import { Icon } from './Icon'
import { wmConfirm } from './confirm.js'
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
// identity, so only cells whose state entry changed re-render. The same holds for the
// roving tabindex: an arrow press flips `tabbable` on two cells and nothing else.
const Cell = memo(function Cell({ cell, active, tabbable, idx, state, name, label, onPick }: {
  cell: GlyphPickerCell; active: boolean; tabbable: boolean; idx: number
  state?: { className?: string; style?: CSSProperties; nonce?: number; onAnimationEnd?: () => void }
  name?: string
  label: string
  onPick: (cell: GlyphPickerCell) => void
}) {
  return (
    <button
      key={state?.nonce}
      type="button"
      role="gridcell"
      aria-selected={active}
      aria-label={label}
      tabIndex={tabbable ? 0 : -1}
      data-gp-i={idx}
      className={`gp-cell${active ? ' gp-cell--active' : ''}${isInvisible(cell.ch) ? ' gp-cell--invisible' : ''}${name !== undefined ? ' gp-cell--named' : ''}${state?.className ? ' ' + state.className : ''}`}
      style={cell.ffs || state?.style ? { ...(cell.ffs ? { fontFeatureSettings: cell.ffs } : null), ...state?.style } : undefined}
      onClick={() => onPick(cell)}
      onAnimationEnd={state?.onAnimationEnd}
      title={`U+${hex(cell.ch)}${cell.note ? ' · ' + cell.note : ''}${name ? ' · ' + name : ''}`}>
      <span className="gp-cell-ch" aria-hidden="true">{display(cell.ch)}</span>
      {name !== undefined && <span className="gp-cell-name" aria-hidden="true">{name || '\u00a0'}</span>}
    </button>
  )
})

// Split a group's cells into the rows the CSS grid draws, so role=grid has real rows.
// The rows are `display: contents`: the cells still lay out in .gp-grid's own columns,
// and the look is untouched. `cols` is read from the rendered grid (gridTemplateColumns
// resolves auto-fill to its tracks); 0 means "not measured" and gives one row per group.
function chunk<T>(list: T[], cols: number): T[][] {
  if (cols <= 0) return [list]
  const rows: T[][] = []
  for (let i = 0; i < list.length; i += cols) rows.push(list.slice(i, i + cols))
  return rows
}

// Keyboard movement through the grid (GESTURES.md G133). `groups` is the cell count of each
// visible group, in order, and every group shares one column count -- one container, one
// auto-fill track list. Returns the flat index to move to, or null for "not a grid key".
function nextIndex(
  e: { key: string; ctrlKey: boolean; metaKey: boolean },
  flat: number, groups: number[], cols: number, pageRows: number,
): number | null {
  const total = groups.reduce((a, n) => a + n, 0)
  if (!total) return null
  // Locate the cell: its group, its index inside the group, its row and column.
  let g = 0, start = 0
  while (g < groups.length - 1 && flat >= start + groups[g]) { start += groups[g]; g++ }
  const c = Math.max(1, cols)
  const local = flat - start
  const col = local % c
  const down = (from: number) => {
    let gi = 0, s = 0
    while (gi < groups.length - 1 && from >= s + groups[gi]) { s += groups[gi]; gi++ }
    const l = from - s
    if (l + c < groups[gi]) return from + c                          // same group, next row
    const lastRowStart = Math.floor((groups[gi] - 1) / c) * c
    if (l < lastRowStart) return s + groups[gi] - 1                   // short last row: its end
    if (gi === groups.length - 1) return from                         // bottom of the grid
    return s + groups[gi] + Math.min(l % c, groups[gi + 1] - 1)       // next group, first row
  }
  const up = (from: number) => {
    let gi = 0, s = 0
    while (gi < groups.length - 1 && from >= s + groups[gi]) { s += groups[gi]; gi++ }
    const l = from - s
    if (l - c >= 0) return from - c
    if (gi === 0) return from
    const prev = groups[gi - 1], ps = s - prev
    const lastRowStart = Math.floor((prev - 1) / c) * c
    return ps + Math.min(lastRowStart + (l % c), prev - 1)            // previous group, last row
  }
  const mod = e.ctrlKey || e.metaKey
  switch (e.key) {
    case 'ArrowRight': return Math.min(flat + 1, total - 1)
    case 'ArrowLeft':  return Math.max(flat - 1, 0)
    case 'ArrowDown':  return down(flat)
    case 'ArrowUp':    return up(flat)
    case 'Home': return mod ? 0 : flat - col
    case 'End':  return mod ? total - 1 : Math.min(flat - col + c - 1, start + groups[g] - 1)
    case 'PageDown': { let f = flat; for (let i = 0; i < pageRows; i++) f = down(f); return f }
    case 'PageUp':   { let f = flat; for (let i = 0; i < pageRows; i++) f = up(f); return f }
  }
  return null
}

// Copy affordance (from the house CopyButton): copy icon → checkmark, 2s revert.
//
// TWO STEPS, NOT ONE. Swapping content_copy straight to check changes the glyph in a
// single frame and animates only the fill behind it, which at 140ms does not read as a
// transition at all -- it reads as a flash, and the thing it looks like it flashed to is
// the icon you just replaced. So the mark FILLS first, still as content_copy and slowly
// enough to see, and only then becomes check. The confirmation is the filling; the check
// is where it lands.
//
// THE FILL IS NOW THE HOUSE CONFIRM (GESTURES.md §14, G91). It was its own 260ms slow fill;
// it is the same receipt every control gives: on a copy that worked the button takes
// .wm-confirm (wmConfirm), and the filled, active content_copy blinks -- off 80ms, on 80ms --
// and only then becomes check, at 160. Still two steps, still fill-before-swap: the mark is
// seen filled for the on phase before the glyph changes, so the swap does not read as a flash
// back to the old icon. Only the length changed, 260 -> 160.
//
// Both marks come from one font at one weight, which is the other half of why this works:
// two inlined SVGs from two sources could not be relied on to agree about stroke or
// optical centre, and any disagreement between them shows up exactly at the swap.
function CopyIcon({ ok }: { ok: boolean }) {
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    if (!ok) { setFilled(false); return }
    /* Fill immediately, hold the copy mark for the length of that fill, then swap. The
       timeout matches FILL_MS below rather than guessing: if the two disagree the glyph
       changes mid-fill, which is the flicker this exists to remove. */
    setFilled(true)
    const t = window.setTimeout(() => setFilled(false), FILL_MS)
    return () => window.clearTimeout(t)
  }, [ok])
  const showCheck = ok && !filled
  return (
    <Icon
      name={showCheck ? 'check' : 'content_copy'}
      size={20}
      filled={ok}
      state={ok ? 'active' : 'rest'}
    />
  )
}
const FILL_MS = 160   // 2 x --dur-confirm: the blink, then the check

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
  const uid = useId()
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  // What the polite live region says. Copy is otherwise silent: the mark fills and turns
  // into a check, which a screen reader never sees (G135).
  const [announce, setAnnounce] = useState('')
  // The roving tabindex: the one cell that takes Tab, by id, plus its flat position so a
  // char that sits in two groups does not make two Tab stops (G132).
  const [focusAt, setFocusAt] = useState<{ id: string; flat: number } | null>(null)
  // null until the first layout read. The cells wait for it, so they mount once, already in
  // their rows -- not once flat and again when the rows arrive.
  const [cols, setCols] = useState<number | null>(null)
  const groupsRef = useRef<HTMLDivElement | null>(null)

  const pick = useCallback((cell: GlyphPickerCell) => {
    setActive(cell)
    setCopied(false)
    onSelect?.(cell)
  }, [onSelect])

  const copyActive = useCallback((btn?: HTMLElement) => {
    navigator.clipboard?.writeText(active.ch).then(() => {
      setCopied(true)
      wmConfirm(btn)
      // Cleared first so copying the same glyph twice is announced twice.
      setAnnounce('')
      requestAnimationFrame(() => setAnnounce(`Copied ${display(active.ch)}, U+${hex(active.ch)}`))
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [active.ch])

  // Lazy name data: load only the pages covering the codepoints actually present. Loaded
  // whether or not captions are on -- every cell's accessible name carries its glyph name
  // (G134). Search still matches names only when `names` asks for them.
  const [nameData, setNameData] = useState<Map<number, [string | 0, string | 0]> | null>(null)
  const searchNames = names && typeof names !== 'function' ? nameData : null
  useEffect(() => {
    let alive = true
    const cps = new Set<number>()
    for (const g of groups) {
      for (const c of g.cells ?? []) cps.add(codeOf(c.ch))
      for (const ch of g.chars ?? '') cps.add(codeOf(ch))
    }
    loadNamePages(cps).then(m => { if (alive) setNameData(m) })
    return () => { alive = false }
  }, [groups])

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
          const e = searchNames?.get(codeOf(c.ch))
          return !!e && [e[0], e[1]].some(n => n && loose(n).includes(qLoose))
        })
        return { label: g.label, list }
      })
      .filter(g => g.list.length > 0)
  }, [groups, ranges, query, searchNames])

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
  // The cell's accessible name: the character, then its glyph name, then the code -- "é,
  // eacute, U+00E9". A name that only repeats the character ("A") is dropped. The visual
  // caption and the title stay as they were; the label is what a screen reader reads.
  const labelFor = (cell: GlyphPickerCell, caption?: string) => {
    const { nice, uni } = nameParts(cell)
    const nm = (typeof names === 'function' ? caption : undefined) ?? nice ?? uni?.toLowerCase()
    const shown = isInvisible(cell.ch) ? '' : display(cell.ch)
    return [shown, nm && nm !== shown ? nm : '', `U+${hex(cell.ch)}`, cell.note ?? '']
      .filter(Boolean).join(', ')
  }

  // Column count, read from the grid the browser laid out. One read per resize, never per
  // render or per key. Unresolvable (picker hidden: the value comes back as the authored
  // repeat(...)) means 0, which renders one row per group until it is visible.
  useLayoutEffect(() => {
    const box = groupsRef.current
    if (!box) return
    const measure = () => {
      const grid = box.querySelector('.gp-grid')
      const tpl = grid ? getComputedStyle(grid).gridTemplateColumns : ''
      const n = tpl && !tpl.includes('(') && tpl !== 'none' ? tpl.trim().split(/\s+/).length : 0
      setCols(prev => (prev === n ? prev : n))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [visibleGroups.length > 0])

  // Flat order of every visible cell, for the roving tabindex and the arrow keys.
  const flatIds = useMemo(() => visibleGroups.flatMap(g => g.list.map(cellId)), [visibleGroups])
  const groupSizes = useMemo(() => visibleGroups.map(g => g.list.length), [visibleGroups])
  // The Tab stop: the cell last moved to if it is still there (same place first, then the
  // same id anywhere, since a search reshuffles places), else the selected glyph, else the
  // first cell.
  const tabStop = (() => {
    if (focusAt) {
      if (flatIds[focusAt.flat] === focusAt.id) return focusAt.flat
      const i = flatIds.indexOf(focusAt.id)
      if (i >= 0) return i
    }
    const a = flatIds.indexOf(cellId(active))
    return a >= 0 ? a : 0
  })()

  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest?.('[data-gp-i]') as HTMLElement | null
    if (!el || !groupsRef.current?.contains(el)) return
    const flat = Number(el.dataset.gpI)
    // A page is the rows that fit in what the reader can see of the grid.
    const box = groupsRef.current
    const cellH = el.getBoundingClientRect().height || 1
    const seen = Math.min(box.clientHeight || Infinity, window.innerHeight)
    const pageRows = Math.max(1, Math.floor(seen / cellH) - 1)
    const to = nextIndex(e, flat, groupSizes, cols || flatIds.length, pageRows)
    if (to == null) return
    e.preventDefault()
    if (to === flat) return
    setFocusAt({ id: flatIds[to], flat: to })
    ;(box.querySelector(`[data-gp-i="${to}"]`) as HTMLElement | null)?.focus()
  }

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
        <button className="gp-copy" onClick={e => copyActive(e.currentTarget)} title="Copy character to clipboard">
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
      {/* One Tab stop for the whole set, however many groups (G132). Each group is its own
          labelled grid; the arrow keys cross from one to the next as if they were one. */}
      <div className="gp-groups" ref={groupsRef} onKeyDown={onGridKey}
        onFocus={e => {
          const el = (e.target as HTMLElement).closest?.('[data-gp-i]') as HTMLElement | null
          if (!el) return
          const flat = Number(el.dataset.gpI)
          if (flatIds[flat] && (focusAt?.flat !== flat || focusAt?.id !== flatIds[flat])) setFocusAt({ id: flatIds[flat], flat })
        }}>
        {(() => {
          let base = 0
          return visibleGroups.map((g, gi) => {
            const start = base
            base += g.list.length
            const labelId = `${uid}-g${gi}`
            return (
              <div key={g.label} className="gp-group">
                <div className="gp-group-label" id={labelId}>{g.label}</div>
                <div className="gp-grid" role="grid" aria-labelledby={labelId}>
                  {cols !== null && chunk(g.list.map((c, i) => ({ c, i })), cols).map((row, ri) => (
                    <div key={ri} role="row" className="gp-row">
                      {row.map(({ c, i }) => {
                        const caption = captionFor(c)
                        return (
                          <Cell key={c.key ?? i} cell={c}
                            idx={start + i}
                            active={cellId(active) === cellId(c)}
                            tabbable={start + i === tabStop}
                            state={cellState?.(c)}
                            name={caption}
                            label={labelFor(c, caption)}
                            onPick={pick} />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        })()}
      </div>
      <span className="gp-live" role="status" aria-live="polite">{announce}</span>
      {layout === 'bottom' && side}
    </div>
  )
}
