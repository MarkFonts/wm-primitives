// AxisSlider — a numeric axis/value control. The value is an editable field:
//   • normal axes → native <input type="number"> (up/down steppers, theme-aware
//     via the app's color-scheme)
//   • auto-capable axes (e.g. opsz) → a text field where you type a number OR press
//     `a` for "auto" (with a one-time hint)
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
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
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
  label, tag, value, min, max, step, onChange, display,
  lockedAbove, allowAuto, autoValue, marker, onRangePointerDown, disabled,
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

  const numberValue = allowAuto
    ? (display != null ? String(display).replace('-', '−') : String(value))
    : (value as number)

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
            type={allowAuto ? 'text' : 'number'}
            inputMode={allowAuto ? 'numeric' : undefined}
            step={allowAuto ? undefined : step}
            value={numberValue}
            disabled={disabled}
            onFocus={() => { handleFocus(); setNumFocused(true) }}
            onBlur={() => setNumFocused(false)}
            onKeyDown={e => { if (allowAuto && e.key === 'a') { e.preventDefault(); onChange('auto') } }}
            onChange={e => {
              if (!allowAuto) { onChange(parseFloat(e.target.value)); return }
              const raw = String(e.target.value).replace('−', '-').trim()
              if (raw.toLowerCase() === 'auto') { onChange('auto'); return }
              onChange(parseFloat(raw))
            }}
          />
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
