// GlyphPicker — interactive glyph browser shared by ReCal + font-proofer (wm-primitives #2).
// Equal-sized cell grid + big click-to-select viewer with U+ readout, search, and
// copy-to-clipboard. Ported from the Framer GlyphPicker; app-agnostic:
//  - groups (base + stylistic-set "escape hatches") come in via props; a group with
//    `feat` renders its chars with that OpenType feature on (alternate forms).
//  - the font arrives as CSS (family / variation / feature settings) on the root, so
//    axis changes re-render nothing — cells inherit.
//  - optional cmap ranges filter unsupported chars (shared glyphset.ts isSupported).
import { memo, useMemo, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { isSupported, type CmapRanges } from './glyphset'
import './GlyphPicker.css'

export interface GlyphPickerGroup {
  label: string
  chars: string
  /** OpenType feature tag — cells render chars WITH this feature on (ssXX alternates). */
  feat?: string
}

export interface GlyphPickerProps {
  groups: GlyphPickerGroup[]
  /** CSS for the specimen: family required; variation/feature settings optional. */
  fontFamily: string
  fontVariationSettings?: string
  fontFeatureSettings?: string
  /** cmap ranges to filter unsupported chars (feat groups skip the filter). */
  ranges?: CmapRanges | null
  onSelect?: (char: string, feat: string | null) => void
  className?: string
  style?: CSSProperties
}

const INVISIBLE_CPS = new Set([
  0x0020, 0x00a0, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
  0x2007, 0x2008, 0x2009, 0x200a, 0x200b, 0x202f, 0x205f, 0x3000, 0x200c,
  0x200d, 0x000d, 0x000a, 0x0009,
])
const isInvisible = (ch: string) => !ch.trim() || INVISIBLE_CPS.has(ch.codePointAt(0) ?? 0)
// Combining marks (Mn) render blank alone — hang them on a dotted circle.
const display = (ch: string) => (/\p{Mn}/u.test(ch) ? '◌' + ch : ch)
const hex = (ch: string) => (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')

// Memoized so selecting a glyph re-renders only the two cells whose `active` flips —
// not the whole (potentially ~2,500-cell) grid.
const Cell = memo(function Cell({ char, feat, active, onPick }: {
  char: string; feat: string | null; active: boolean
  onPick: (char: string, feat: string | null) => void
}) {
  return (
    <button
      className={`gp-cell${active ? ' gp-cell--active' : ''}${isInvisible(char) ? ' gp-cell--invisible' : ''}`}
      style={feat ? { fontFeatureSettings: `"${feat}" 1` } : undefined}
      onClick={() => onPick(char, feat)}
      title={`U+${hex(char)}${feat ? ' · ' + feat : ''}`}>
      {display(char)}
    </button>
  )
})

export function GlyphPicker({
  groups, fontFamily, fontVariationSettings, fontFeatureSettings,
  ranges = null, onSelect, className, style,
}: GlyphPickerProps) {
  const [active, setActive] = useState<{ char: string; feat: string | null }>({ char: 'A', feat: null })
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  const pick = useCallback((char: string, feat: string | null) => {
    setActive({ char, feat })
    setCopied(false)
    onSelect?.(char, feat)
  }, [onSelect])

  const copyActive = useCallback(() => {
    navigator.clipboard?.writeText(active.char).then(() => setCopied(true)).catch(() => {})
  }, [active.char])

  // cmap-filter base groups (feat groups are pre-scoped to the font); then apply the
  // search query — match by char or by U+ hex fragment.
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .map(g => {
        let chars = [...g.chars]
        if (!g.feat) chars = chars.filter(c => isSupported(c, ranges, /\p{Mn}/u.test(c)))
        if (q) chars = chars.filter(c => c.toLowerCase() === q || hex(c).toLowerCase().includes(q))
        return { ...g, list: chars }
      })
      .filter(g => g.list.length > 0)
  }, [groups, ranges, query])

  const specimen: CSSProperties = { fontFamily, fontVariationSettings, fontFeatureSettings }

  return (
    <div className={`gp${className ? ' ' + className : ''}`} style={{ ...specimen, ...style }}>
      <div className="gp-side">
        <input
          className="gp-search" type="search" placeholder="Search glyph or U+ code…"
          value={query} onChange={e => setQuery(e.target.value)} spellCheck={false} />
        <button className="gp-viewer" onClick={copyActive}
          title="Copy character to clipboard"
          style={active.feat ? { fontFeatureSettings: `"${active.feat}" 1` } : undefined}>
          <span className="gp-viewer-char">{display(active.char)}</span>
        </button>
        <div className="gp-viewer-code">
          U+{hex(active.char)}{active.feat ? ` · ${active.feat}` : ''}{copied ? ' · copied' : ''}
        </div>
      </div>
      <div className="gp-groups">
        {visibleGroups.map(g => (
          <div key={g.label} className="gp-group">
            <div className="gp-group-label">{g.label}</div>
            <div className="gp-grid">
              {g.list.map((c, i) => (
                <Cell key={i} char={c} feat={g.feat ?? null}
                  active={active.char === c && active.feat === (g.feat ?? null)}
                  onPick={pick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
