// AxisSlider — a numeric axis/value control. The value is an editable TEXT field with a
// stepper of our own, plus a range track below.
//   • every axis → type=text, inputMode=decimal, so the readout can carry a real minus
//     (U+2212). A number input cannot: the value would not parse, so it is stuck with a
//     hyphen. The rest of the system already formats readouts with nbMinus; the field
//     you can type in was the last place printing the wrong character.
//   • auto-capable axes (e.g. opsz) additionally take `a` for "auto" (with a one-time
//     hint). Nothing else distinguishes them now — one field, one code path.
//   • the stepper is drawn here rather than the browser's: a text field has none, and
//     the native one could not be styled the same way twice (font-proofer forced
//     WebKit's visible, Firefox ignored that, ReCal left it hidden). Arrow keys, Shift
//     for a coarse step, and press-and-hold repeat are all reimplemented.
// …plus a range track below. Font-agnostic: the tag is just a label, nothing here
// knows about any specific font. Extracted from font-proofer's SliderRow.
//
// Labelling contract — the row reads:  <label>  <tag>  <range>  …  <value><suffix>
//   <AxisSlider label="Weight" tag="wght" showRange min={200} max={800} … />
//   →           Weight  wght  200–800                              400
// `label` is the HUMAN name and `tag` is the OpenType axis tag; don't put the tag in
// `label`, and don't hand-type a range into `tag` — pass showRange and it's derived
// from min/max (so it can never go stale).
//
// Optional extras (used by ReCal's rail, ignored elsewhere):
//   • marker  — a ◆ "baked default" indicator before the value
//   • onRangePointerDown — hook on the range thumb (e.g. drag-to-flash a zone)
//   • disabled — dim/lock the control (e.g. a frozen axis)
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { nbMinus } from './format'
import './AxisSlider.css'

export interface AxisSliderProps {
  /** Human-readable name, shown first — "Weight", "Optical size", "size".
   *  NOT the OpenType tag: pass that as `tag`. */
  label: string
  /** OpenType axis tag, shown muted after the label — "wght", "opsz", "GEOM".
   *  Omit for non-axis controls (size/tracking/leading). For a min–max readout use
   *  `showRange` — never hand-type a range here. */
  tag?: string
  value: number | 'auto'
  min: number
  max: number
  step?: number
  onChange: (v: number | 'auto') => void
  /** Formatted string for the value field (e.g. ReCal's ital 2-decimals). */
  display?: string | number
  /** Show a locked region on the track up to this value. */
  lockedAbove?: number | null
  /** Enable the `a`-for-auto text field (e.g. opsz). */
  allowAuto?: boolean
  /** Show a tappable `auto` chip beside the value. Defaults ON wherever allowAuto is set,
   *  because the keystroke alone is unreachable on a phone — no mobile keypad this field
   *  can raise has letters. Pass false to go back to the key only. */
  autoButton?: boolean
  autoValue?: number
  /** Optional ◆ "baked default" marker before the value (suppressed for variant="diamond"). */
  marker?: boolean
  /** Optional hook on the range thumb's pointer-down (e.g. drag-to-flash). */
  onRangePointerDown?: (e: ReactPointerEvent<HTMLInputElement>) => void
  /** Dim/disable the control (e.g. a frozen axis). */
  disabled?: boolean
  /** Thumb style: 'default' round thumb · 'diamond' rotate-45 marker-default thumb (Type-Matrix
   *  style, for default-editing rails) · 'skeletal' thin/minimal (preview/demo). */
  variant?: 'default' | 'diamond' | 'skeletal'
  /** Stock/original value → a faint "burned" reference marker on the track (see how far you moved). */
  reference?: number
  /** Static unit label shown just after the editable field (e.g. "px", "%", "em"). Never inside it. */
  suffix?: string
  /** Show the axis range (e.g. "200–800") after the tag, derived from min/max so it
   *  always matches the track. */
  showRange?: boolean
}

export function AxisSlider({
  label, tag, value, min, max, step = 1, onChange, display,
  lockedAbove, allowAuto, autoButton = true, autoValue, marker, onRangePointerDown, disabled,
  variant = 'default', reference, suffix, showRange,
}: AxisSliderProps) {
  const [numFocused, setNumFocused] = useState(false)

  // No scroll-to-adjust. Hovering a control while scrolling the panel is the common
  // case, and a wheel that edits values turns a scroll into an unnoticed edit — a
  // proof silently set to different numbers than the ones you chose. Removed
  // deliberately; the drag, the arrow keys and the number field all still work.
  const rowRef = useRef<HTMLDivElement>(null)
  const refPct = reference != null
    ? Math.max(0, Math.min(100, ((reference - min) / (max - min)) * 100))
    : null
  const lockedPct = lockedAbove != null
    ? Math.max(0, Math.min(100, ((lockedAbove - min) / (max - min)) * 100))
    : null
  const isAuto = allowAuto && value === 'auto'
  const hintShownRef = useRef(false)
  const [hintPos, setHintPos] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = () => {
    if (allowAuto && !isAuto && !hintShownRef.current && inputRef.current) {
      hintShownRef.current = true
      const rect = inputRef.current.getBoundingClientRect()
      setHintPos({ top: rect.bottom + 6, left: rect.left })
      setTimeout(() => setHintPos(null), 3000)
    }
  }

  /* ONE field, and it is text. A number input cannot show U+2212 — the value would not
     parse — so it is stuck with a hyphen, and a hyphen is not a minus. The readouts
     elsewhere already use nbMinus for exactly this reason; the field you can type in was
     the one place still printing the wrong character. Going to text costs the native
     steppers, which are rebuilt below, and buys a real minus, `auto` on any dial, and
     one control instead of two. */
  /* Press-and-hold repeat. The native spinner did this; a button we draw does not, so it
     is a delay then an interval, at roughly the rates a key repeat uses. */
  const valueRef = useRef(value)
  valueRef.current = value
  const holdRef = useRef<{ t?: number; i?: number }>({})
  const stopStep = () => {
    clearTimeout(holdRef.current.t); clearInterval(holdRef.current.i)
    holdRef.current = {}
  }
  const startStep = (dir: 1 | -1) => {
    const bump = () => {
      const base = typeof valueRef.current === 'number' ? valueRef.current : (autoValue ?? min)
      onChange(Math.min(max, Math.max(min, base + dir * step)))
    }
    bump()
    holdRef.current.t = window.setTimeout(() => {
      holdRef.current.i = window.setInterval(bump, 60)
    }, 400)
  }
  useEffect(() => stopStep, [])

  const numberValue = nbMinus(display != null ? String(display) : String(value))

  return (
    <div ref={rowRef} className={`slider-row${disabled ? ' slider-row--off' : ''}${variant !== 'default' ? ` slider-row--${variant}` : ''}`}>
      {hintPos && createPortal(
        <div className="slider-auto-hint" style={{ top: hintPos.top, left: hintPos.left }}>
          hint: type &quot;a&quot; for auto
        </div>,
        document.body,
      )}
      <div className="slider-label">
        <span className="slider-label-left">
          <span className={`slider-label-text${tag ? ' slider-label-text--tagged' : ''}`}>{label}</span>
          {tag && <span className="slider-tag">{tag}</span>}
          {showRange && <span className="slider-range">{min}–{max}</span>}
        </span>
        <span className="slider-value">
          {marker && variant !== 'diamond' && <span className="slider-marker" aria-hidden="true">◆</span>}
          <input
            ref={inputRef}
            className="slider-number"
            type="text"
            /* decimal, not numeric: numeric gives a keypad with no minus and no separator */
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            role="spinbutton"
            aria-valuenow={typeof value === 'number' ? value : undefined}
            aria-valuemin={min}
            aria-valuemax={max}
            /* The bounds belong on the FIELD as well as the track. They were only ever on
               the range, so the two halves of one control disagreed: every dial accepted
               anything typed into it — ital (0-1) took 501, wght (400-700) took 1200 —
               while the track pinned to its max. The field is what feeds the render, so
               the readout was free to lie about what you are looking at: a font clamps an
               out-of-range axis when it rasterises, and the proof showed 700 under a
               label reading 1200. */
            value={numberValue}
            disabled={disabled}
            onFocus={() => { handleFocus(); setNumFocused(true) }}
            onBlur={() => setNumFocused(false)}
            onKeyDown={e => {
              if (allowAuto && e.key === 'a') { e.preventDefault(); onChange('auto'); return }
              /* The arrow keys came free with type=number and have to be put back. Held,
                 the OS repeats keydown by itself, so this reads the same as the native
                 field did. Shift is the coarse step, as it is in every design tool. */
              const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
              if (!dir) return
              e.preventDefault()
              const base = typeof value === 'number' ? value : (autoValue ?? min)
              onChange(Math.min(max, Math.max(min, base + dir * step * (e.shiftKey ? 10 : 1))))
            }}
            onChange={e => {
              /* min/max on the element stops the STEPPERS going out of range, but a typed
                 value still arrives here unclamped — the attribute only marks the input
                 invalid, it does not refuse the keystroke. Clamp on the way through, and
                 drop NaN: mid-edit the field is legitimately "" or "-", and passing that
                 on sets the axis to NaN and blanks the proof. */
              /* ONE parse for both paths. The field now RENDERS a real minus, so a real
                 minus is what comes back when you edit it — and parseFloat("−0.08") is
                 NaN. Undoing the display's own substitution used to be the auto path's
                 business alone; it is every field's business now. */
              const raw = String(e.target.value).replace('−', '-').trim()
              if (allowAuto && raw.toLowerCase() === 'auto') { onChange('auto'); return }
              const n = parseFloat(raw)
              if (Number.isNaN(n)) return
              onChange(Math.min(max, Math.max(min, n)))
            }}
          />
          {allowAuto && autoButton && !disabled && (
            /* A keystroke cannot be the only way to reach a state. `a` for auto needs a
               letter key, and every mobile keypad this field can raise — numeric or
               decimal — has no letters on it, so on a phone the shortcut was unreachable
               and the hint was telling you to press a key you do not have. The button is
               the affordance; the key stays as the fast path. */
            <button
              type="button"
              className={`slider-auto-btn${isAuto ? ' slider-auto-btn--on' : ''}`}
              aria-pressed={isAuto}
              title={isAuto ? 'auto — tap for a number' : 'follow the optical size automatically'}
              onClick={() => onChange(isAuto ? (autoValue ?? min) : 'auto')}
            >auto</button>
          )}
          {!disabled && (
            <span className="slider-step" aria-hidden="true">
              {([1, -1] as const).map(dir => (
                <button
                  key={dir}
                  type="button"
                  tabIndex={-1}
                  className="slider-step-btn"
                  onPointerDown={e => { e.preventDefault(); startStep(dir) }}
                  onPointerUp={stopStep}
                  onPointerLeave={stopStep}
                  onPointerCancel={stopStep}
                >
                  <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
                    <path d={dir > 0 ? 'M1 4.5 5 1.5 9 4.5' : 'M1 1.5 5 4.5 9 1.5'}
                      fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </span>
          )}
          {suffix && (
            <span className={`slider-suffix${numFocused ? ' slider-suffix--hidden' : ''}`} aria-hidden="true">{suffix}</span>
          )}
        </span>
      </div>
      <div
        className="slider-track-wrap"
        style={lockedPct != null ? ({ '--locked-pct': `${lockedPct}%` } as CSSProperties) : undefined}
      >
        {refPct != null && <span className="slider-ref" style={{ left: `${refPct}%` }} aria-hidden="true" />}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={isAuto ? Math.min(max, Math.max(min, autoValue ?? (min + max) / 2)) : (value as number)}
          disabled={disabled}
          onPointerDown={onRangePointerDown}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}

export default AxisSlider
