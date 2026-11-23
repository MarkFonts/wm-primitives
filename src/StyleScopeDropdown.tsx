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
// colors flow in unchanged. Destined to move into the shared `wm-primitives` submodule.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from 'react'
// Behavior comes from React Aria (the house choice for collection keyboard behavior):
// arrows, Home/End, typeahead, one Tab stop with a roving tabindex, aria-selected and
// aria-multiselectable. Subpath imports keep the bundle to the hooks used.
import { useListBox, useOption } from 'react-aria/useListBox'
import { useListState, type ListState } from 'react-stately/useListState'
import { Item } from 'react-stately/Item'
import { Icon } from './Icon'
import { wmConfirm } from './confirm.js'
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
  /** Material Symbols name for the mark that NAMES the row -- format_h1, format_paragraph.
   *  It exists so the label can stop being the name: with a mark carrying "which level",
   *  the label is free to be a specimen word set at the style's real size, which is the
   *  thing you are actually choosing between. */
  icon?: string
  chips?: ScopeChip[]
  selected?: boolean
}

/** The event that picked a row: a pointer press (shiftKey drives font-proofer's range pick)
 *  or the Space / Enter keydown that picked it from the keyboard. Before keyboard support it
 *  was always a click, so `(id, e) => e.shiftKey` keeps working unchanged. */
export type ScopeSelectEvent = ReactMouseEvent | ReactKeyboardEvent

export interface StyleScopeDropdownProps {
  rows: ScopeRow[]
  /** 'single' = radio (Paragraph/roles); 'multi' = checkbox with ●/○ (Scale tiers) */
  mode?: 'single' | 'multi'
  /** the trigger-button face: active style name, or a collapsed label like "3 tiers" */
  buttonLabel: ReactNode
  /** called with the row id; for 'multi' the host toggles membership */
  onSelect: (id: string, e: ScopeSelectEvent) => void
  /** extra class on the wrapper for app-specific overrides */
  className?: string
}

export interface StyleScopeListProps {
  rows: ScopeRow[]
  mode?: 'single' | 'multi'
  onSelect: (id: string, e: ScopeSelectEvent) => void
  /** fires after a 'single'-mode pick so a host popover can close itself */
  onPicked?: () => void
  /** render bare rows (no box/position/shadow) for nesting inside a host popover */
  inline?: boolean
  className?: string
  /** Move focus into the list when it mounts: onto the selected row, else the first. A host
   *  popover passes this so opening it from the keyboard lands in the list (GESTURES.md G126). */
  autoFocus?: boolean
  /** The listbox's accessible name. Defaults to "Styles"; ignored when `aria-labelledby` is set. */
  'aria-label'?: string
  'aria-labelledby'?: string
  id?: string
}

type Picked = { e: SyntheticEvent | null }

/** One row. useOption gives it role=option, aria-selected, the roving tabindex and press
 *  handling; the markup inside is unchanged. */
function ScopeOption({ row, mode, state }: { row: ScopeRow; mode: 'single' | 'multi'; state: ListState<ScopeRow> }) {
  const ref = useRef<HTMLButtonElement>(null)
  const { optionProps } = useOption({ key: row.id }, state, ref)
  return (
    <button
      {...optionProps}
      type="button"
      ref={ref}
      className={`ssd-row${row.selected ? ' on' : ''}`}
    >
      {mode === 'multi' && (
        <span className="ssd-check" aria-hidden="true">{row.selected ? '●' : '○'}</span>
      )}
      {row.icon && (
        /* The mark takes the row's selected state, like every other icon in the
           system -- the row's own `.on` class does not reach it, because the label
           beside it is set in the PROOFED font and must not inherit UI ink. */
        <Icon name={row.icon} size={20} state={row.selected ? 'active' : 'rest'} className="ssd-icon" />
      )}
      <span className="ssd-name" style={{ ...(row.labelStyle || null), fontWeight: row.weight }}>
        {row.label}
      </span>
      {row.chips && row.chips.length > 0 && (
        <span className="ssd-chips">
          {row.chips.map((c, i) => (
            <span key={i} className={`ssd-chip${c.kind ? ' ssd-chip--' + c.kind : ''}`}>
              {c.text}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

/**
 * StyleScopeList — the genuinely-shared part: the rows (label + metadata chips),
 * with single/multi selection. This is what every one of the 6 sites duplicates.
 * Drop it inside whatever trigger/popover each app already has (font-proofer's
 * portal panel, ReCal's absolute menu), OR use StyleScopeDropdown for a
 * self-contained trigger+list.
 *
 * Keyboard (GESTURES.md G127): one Tab stop; arrows, Home/End and typeahead move focus
 * without picking; Space or Enter picks the focused row, exactly as a click does.
 *
 * Selection stays the HOST's: `rows[].selected` is the truth and React Aria is never
 * allowed to change it. Every attempt it makes is turned back into the one call the hosts
 * already handle, `onSelect(id, event)` -- so font-proofer's "click the active role to clear
 * it" and its shift-click range keep working, and React Aria's own extras (Shift+Arrow
 * range, Mod+A, Escape-clears) do nothing.
 */
export function StyleScopeList({
  rows, mode = 'single', onSelect, onPicked, inline, className, autoFocus,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, id,
}: StyleScopeListProps) {
  const ref = useRef<HTMLDivElement>(null)
  // The event behind the pick, captured on the way down so the host still gets a real
  // event with real modifier keys. React Aria's onSelectionChange carries none.
  const picked = useRef<Picked>({ e: null })
  const capture = (e: SyntheticEvent) => { picked.current.e = e }
  const latest = useRef({ onSelect, onPicked, mode })
  latest.current = { onSelect, onPicked, mode }

  const state = useListState<ScopeRow>({
    items: rows,
    children: (r: ScopeRow) => <Item key={r.id} textValue={r.label}>{r.label}</Item>,
    selectionMode: mode === 'multi' ? 'multiple' : 'single',
    selectionBehavior: 'toggle',
    selectedKeys: rows.filter(r => r.selected).map(r => r.id),
    onSelectionChange: () => {
      const e = picked.current.e
      picked.current.e = null
      if (!e) return
      // Only a press or Space/Enter on a row counts. Anything else React Aria selects on
      // (Shift+Arrow extends, Mod+A) is not a pick.
      if (e.type === 'keydown') {
        const k = (e as ReactKeyboardEvent).key
        if (k !== ' ' && k !== 'Enter') return
      }
      const el = (e.target as Element | null)?.closest?.('[role="option"]') as HTMLElement | null
      const key = el?.dataset.key
      if (!el || key == null || !ref.current?.contains(el)) return
      const { onSelect, onPicked, mode } = latest.current
      onSelect(key, e as ScopeSelectEvent)
      wmConfirm(el)
      if (mode === 'single') onPicked?.()
    },
  })

  const { listBoxProps } = useListBox({
    'aria-label': ariaLabelledby ? undefined : (ariaLabel ?? 'Styles'),
    'aria-labelledby': ariaLabelledby,
    id,
    autoFocus: autoFocus ? true : undefined,
    shouldSelectOnPressUp: true,
    selectionBehavior: 'toggle',
    escapeKeyBehavior: 'none',   // Escape belongs to whatever popover holds the list
  }, state, ref)

  return (
    <div
      {...listBoxProps}
      ref={ref}
      className={`ssd-list ssd-list--${mode}${inline ? ' ssd-list--inline' : ''}${className ? ' ' + className : ''}`}
      onPointerDownCapture={capture}
      onPointerUpCapture={capture}
      onClickCapture={capture}
      onKeyDownCapture={capture}
    >
      {[...state.collection].map(node => {
        const row = node.value as ScopeRow
        return <ScopeOption key={row.id} row={row} mode={mode} state={state} />
      })}
    </div>
  )
}

/**
 * StyleScopeDropdown — self-contained trigger (labelled button + caret) wrapping
 * StyleScopeList. Matches ReCal's StyleMenu/TierMenu shape; use for ReCal and any
 * new picker. font-proofer keeps its own portal trigger and uses StyleScopeList.
 *
 * TODO(overlays): the open/close, Escape and focus-return below are the minimum to make
 * the trigger honest (GESTURES.md G129-G131). Move this onto the shared Popover from the
 * `overlays` branch once it merges, and delete the local pointerdown/blur/Escape code.
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
  const btnRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const btnId = useId()

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) btnRef.current?.focus()
  }

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
    <div
      ref={wrapRef}
      className={`ssd${className ? ' ' + className : ''}`}
      onKeyDown={e => {
        if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(true) }
      }}
      onBlur={e => {
        // Tabbing out of the open list closes it; focus moving within the picker does not.
        if (open && !wrapRef.current?.contains(e.relatedTarget as Node | null) && e.relatedTarget) setOpen(false)
      }}
    >
      <button
        type="button"
        ref={btnRef}
        id={btnId}
        className="ssd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={e => { setOpen(o => !o); wmConfirm(e.currentTarget) }}
        onKeyDown={e => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true) }
        }}
      >
        <span className="ssd-btn-label">{buttonLabel}</span>
        {/* Was `▾`, U+25BE -- a filled triangle from whatever UI font happened to be
            resolved, which is a fourth chevron treatment in a system that has one. */}
        <Icon name="keyboard_arrow_down" size={20} className="ssd-caret" />
      </button>
      {open && (
        <StyleScopeList
          id={listId}
          aria-labelledby={btnId}
          rows={rows}
          mode={mode}
          onSelect={onSelect}
          onPicked={() => close(true)}
          autoFocus
        />
      )}
    </div>
  )
}
