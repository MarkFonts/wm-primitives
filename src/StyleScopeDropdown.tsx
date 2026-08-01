// ─────────────────────────────────────────────────────────────────────────────
// StyleScopeDropdown — FIRST shared cross-app design primitive.
//
// One "named-style / tier scope" picker used everywhere both apps expose a set of
// styles to edit: a trigger button that opens a popover of rows, each row = a label
// (optionally rendered in the proofed font) + metadata chips (px / wght / opsz /
// markup / tracking …). Supports single-select (radio) and multi-select (●/○).
//
// Replaces, once migrated:
//   • ReCal:        StyleMenu (Paragraph) + TierMenu (Scale, multi-select)
//   • font-proofer: the 4 .para-styles-panel copies (paragraph / calcom / coss / scale)
//
// The apps' differences become CONFIG, not forks:
//   - chip content       → each app builds its own `chips[]` (font-proofer from
//                          axisOverrides; ReCal from {size,wght}; ReCal Paragraph adds
//                          the {kind:'markup'} chip #/##/### /—).
//   - label typeface     → pass `labelStyle` to render the row label in the proofed
//                          font (font-proofer); omit it for the UI face (ReCal).
//   - selection model    → mode 'single' | 'multi'.
//
// Written in TSX so ReCal's `tsc` build type-checks it; font-proofer's esbuild strips
// the types. Styling is token-based (see StyleScopeDropdown.css) so each app's theme
// colours flow in unchanged. Destined to move into the shared `wm-primitives` submodule.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import './StyleScopeDropdown.css'

export type ScopeChipKind = 'size' | 'axis' | 'tracking' | 'markup' | 'local'

export interface ScopeChip {
  text: string
  /** styling variant; e.g. 'markup' for the #/##/### chip, 'local' for overridden axes */
  kind?: ScopeChipKind
}

export interface ScopeRow {
  id: string
  label: string
  /** render the row label at this font-weight (e.g. H1 row at 700). NOT a size scale. */
  weight?: number
  /** when set, the label renders in the proofed font (font-proofer); omit for the UI face */
  labelStyle?: CSSProperties
  chips?: ScopeChip[]
  selected?: boolean
}

export interface StyleScopeDropdownProps {
  rows: ScopeRow[]
  /** 'single' = radio (Paragraph/roles); 'multi' = checkbox with ●/○ (Scale tiers) */
  mode?: 'single' | 'multi'
  /** the trigger-button face: active style name, or a collapsed label like "3 tiers" */
  buttonLabel: ReactNode
  /** called with the row id; for 'multi' the host toggles membership */
  onSelect: (id: string, e: ReactMouseEvent) => void
  /** extra class on the wrapper for app-specific overrides */
  className?: string
}

export interface StyleScopeListProps {
  rows: ScopeRow[]
  mode?: 'single' | 'multi'
  onSelect: (id: string, e: ReactMouseEvent) => void
  /** fires after a 'single'-mode pick so a host popover can close itself */
  onPicked?: () => void
  /** render bare rows (no box/position/shadow) for nesting inside a host popover */
  inline?: boolean
  className?: string
}

/**
 * StyleScopeList — the genuinely-shared part: the rows (label + metadata chips),
 * with single/multi selection. This is what every one of the 6 sites duplicates.
 * Drop it inside whatever trigger/popover each app already has (font-proofer's
 * portal panel, ReCal's absolute menu), OR use StyleScopeDropdown for a
 * self-contained trigger+list.
 */
export function StyleScopeList({ rows, mode = 'single', onSelect, onPicked, inline, className }: StyleScopeListProps) {
  return (
    <div className={`ssd-list ssd-list--${mode}${inline ? ' ssd-list--inline' : ''}${className ? ' ' + className : ''}`} role="listbox">
      {rows.map(r => (
        <button
          type="button"
          key={r.id}
          role="option"
          aria-selected={!!r.selected}
          className={`ssd-row${r.selected ? ' on' : ''}`}
          onClick={(e) => {
            onSelect(r.id, e)
            if (mode === 'single') onPicked?.()
          }}
        >
          {mode === 'multi' && (
            <span className="ssd-check" aria-hidden="true">{r.selected ? '●' : '○'}</span>
          )}
          <span className="ssd-name" style={{ ...(r.labelStyle || null), fontWeight: r.weight }}>
            {r.label}
          </span>
          {r.chips && r.chips.length > 0 && (
            <span className="ssd-chips">
              {r.chips.map((c, i) => (
                <span key={i} className={`ssd-chip${c.kind ? ' ssd-chip--' + c.kind : ''}`}>
                  {c.text}
                </span>
              ))}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * StyleScopeDropdown — self-contained trigger (labelled button + caret) wrapping
 * StyleScopeList. Matches ReCal's StyleMenu/TierMenu shape; use for ReCal and any
 * new picker. font-proofer keeps its own portal trigger and uses StyleScopeList.
 */
export default function StyleScopeDropdown({
  rows,
  mode = 'single',
  buttonLabel,
  onSelect,
  className,
}: StyleScopeDropdownProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // close on outside pointerdown (matches both apps' existing dropdowns)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div ref={wrapRef} className={`ssd${className ? ' ' + className : ''}`}>
      <button type="button" className="ssd-btn" onClick={() => setOpen(o => !o)}>
        <span className="ssd-btn-label">{buttonLabel}</span>
        <span className="ssd-caret" aria-hidden="true">▾</span>
      </button>
      {open && <StyleScopeList rows={rows} mode={mode} onSelect={onSelect} onPicked={() => setOpen(false)} />}
    </div>
  )
}
