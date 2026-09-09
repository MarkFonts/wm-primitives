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
import { CHEVRON, chevronPath } from './chevronGeometry'
import './chevron.css'
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
  /** Show the named `auto` checkbox beside the tag. Defaults ON wherever allowAuto is
   *  set: the keystroke alone is unreachable on a phone (no keypad this field can raise
   *  has letters) and, on any device, undiscoverable — nothing on screen said the state
   *  existed. Pass false for the key only. */
  autoButton?: boolean
  autoValue?: number
  /** Optional ◆ "baked default" marker before the value (suppressed for variant="diamond"). */
  marker?: boolean
  /** Optional hook on the range thumb's pointer-down (e.g. drag-to-flash). */
  onRangePointerDown?: (e: ReactPointerEvent<HTMLInputElement>) => void
  /** Dim/disable the control (e.g. a frozen axis). */
  disabled?: boolean
  /** Thumb style: 'default' round thumb · 'diamond' rotate-45 marker-default thumb (Type-Matrix
   *  style, for default-editing rails) · 'skeletal' thin/minimal (preview/demo)
   *  · 'track' the row IS the track: label and value sit inside a bar whose fill is the
   *    value, and a press anywhere on it jumps there and follows. */
  variant?: 'default' | 'diamond' | 'skeletal' | 'track'
  /** How the value field is dressed. 'underline' (default) is the house treatment: a rule
   *  under the digits, as wide as the value, with focus carried by the underline and the
   *  number colouring together -- no box means nothing has to know about box padding or
   *  radius to show a state. 'box' is font-proofer's original field, kept because a dial
   *  value in a box is a legitimate choice and not a legacy. */
  field?: 'underline' | 'box'
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
  variant = 'default', field = 'underline', reference, suffix, showRange,
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

  /* WHAT THE FIELD SHOWS WHILE YOU TYPE IN IT. A controlled input clamped on every
     keystroke cannot be retyped: clearing it parsed as NaN, the handler returned without
     propagating, and React rendered the old value straight back -- so the field could
     never be emptied. Worse, selecting 88 on a min-8 dial and typing "2" committed 8
     immediately, then "4" made 84. The small number you were reaching for was
     unreachable, which is how a headline bottomed out at 88.
     So the field keeps its own draft while focused and the clamp moves to blur. Nothing
     out of range ever reaches onChange -- an in-range draft still propagates on every
     keystroke, so live preview is unchanged -- but the INTERMEDIATE states of typing
     (empty, "-", "2" on the way to "24") are now allowed to exist. */
  const [draft, setDraft] = useState<string | null>(null)
  const committed = nbMinus(display != null ? String(display) : String(value))
  const numberValue = draft ?? committed

  /* TOUCH DRAG, DRIVEN HERE RATHER THAN LEFT TO THE INPUT. The CSS gives the row to this
     control on a coarse pointer, so once a finger is down the whole gesture is ours -- and
     this makes the drag definite rather than hoping a native range answers touch the way it
     answers a mouse, which is exactly what was in doubt when the rails read as dead.
     Mouse is untouched: the native input already handles it, and capturing there would add
     a second code path for a case that works. */
  const dragRef = useRef<{ x: number; y: number; id: number; live: boolean } | null>(null)

  const valueAt = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    if (!r.width) return null
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const raw = min + t * (max - min)
    const snapped = step > 0 ? Math.round(raw / step) * step : raw
    /* toFixed then + to shed float dust: 0.1 steps otherwise land on 1.7000000000000002,
       which the number field then prints in full. */
    return Math.min(max, Math.max(min, +snapped.toFixed(6)))
  }

  const onTouchDown = (e: ReactPointerEvent<HTMLInputElement>) => {
    if (disabled || e.pointerType === 'mouse') return
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, live: false }
  }
  const onTouchMove = (e: ReactPointerEvent<HTMLInputElement>) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.id) return
    if (!d.live) {
      /* 3px of slop so a tap that wobbles is still a tap, not a drag that nudges the value
         a step before you have let go. Direction is NOT judged: the row is the slider's, so
         a finger that moves at all is driving it. */
      if (Math.abs(e.clientX - d.x) < 3 && Math.abs(e.clientY - d.y) < 3) return
      d.live = true
      try { e.currentTarget.setPointerCapture(d.id) } catch { /* capture is best-effort */ }
    }
    const v = valueAt(e.clientX, e.currentTarget)
    if (v != null && v !== value) onChange(v)
    e.preventDefault()
  }
  const onTouchUp = (e: ReactPointerEvent<HTMLInputElement>) => {
    const d = dragRef.current
    if (d?.live) { try { e.currentTarget.releasePointerCapture(d.id) } catch { /* already gone */ } }
    dragRef.current = null
  }

  // How far along the track the value sits, as a percentage. Only variant="track" paints
  // with it -- the bar's fill is a gradient stop, not an element -- but it costs one
  // custom property on every row rather than a second code path for one variant.
  const shownValue = isAuto ? (autoValue ?? (min + max) / 2) : (value as number)
  const valuePct = Math.max(0, Math.min(100, ((shownValue - min) / (max - min)) * 100))

  return (
    <div
      ref={rowRef}
      className={`slider-row${disabled ? ' slider-row--off' : ''}${variant !== 'default' ? ` slider-row--${variant}` : ''}${field === 'box' ? ' slider-row--boxed' : ''}`}
      style={{ '--pct': `${valuePct}%` } as CSSProperties}
    >
      {hintPos && createPortal(
        <div className="slider-auto-hint" style={{ top: hintPos.top, left: hintPos.left }}>
          hint: type &quot;a&quot; for auto
        </div>,
        document.body,
      )}
      <div className="slider-label">
        <span className="slider-label-left">
          <span className={`slider-label-text${tag ? ' slider-label-text--tagged' : ''}`}>
            <span className="slider-label-name">{label}</span>
            {allowAuto && autoButton && !disabled && (
            /* Beside the label, not in the value group. A keystroke cannot be the only
               way to reach a state — `a` needs a letter key, and no keypad this field
               raises has one, so on a phone the shortcut was unreachable and the hint
               named a key you do not have. It was a pill in the value group first, which
               read as a badge rather than a control, said "auto" a second time next to a
               field already showing it, and cost 34px in a 227px row — enough to shove
               the field over the tag. This is the shape ReCal arrived at independently
               (.opsz-auto): the state is named on screen instead of being secret. The key
               stays as the fast path, and typing the word still works. */
            <button
              type="button"
              className={`slider-auto${isAuto ? ' slider-auto--on' : ''}`}
              aria-pressed={isAuto}
              title={isAuto ? 'auto — tap for a number' : 'follow the optical size automatically'}
              onClick={() => onChange(isAuto ? (autoValue ?? min) : 'auto')}
            >
              {/* ● on, ○ off — Cal Sans' own circle/uni25CF, NOT • bullet and ◦ openbullet.
                  Those are the marks this wants, and they cannot be used: they are drawn at
                  18% of the em against these at 76%, and openbullet's counter is 90 units --
                  0.89px at this size, under one device pixel -- so it fills in and both
                  states render as the same solid dot. Measured, not guessed. */}
              <span className="slider-auto-dot" aria-hidden="true">{isAuto ? '\u25CF' : '\u25CB'}</span>
              <span className="slider-auto-word">auto</span>
            </button>
            )}
          </span>
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
            onBlur={() => {
              setNumFocused(false)
              /* Commit on the way out. An empty or unparseable draft is not an edit --
                 it is an abandoned one -- so the field falls back to the live value
                 rather than to min. */
              if (draft != null) {
                const raw = draft.replace('\u2212', '-').trim()
                const n = parseFloat(raw)
                if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
                setDraft(null)
              }
            }}
            onKeyDown={e => {
              if (allowAuto && e.key === 'a') { e.preventDefault(); onChange('auto'); return }
              /* Enter commits the draft without waiting for a blur -- on a phone that is
                 the "done" key, and there may be nowhere obvious to tap next. Escape
                 abandons it and puts the live value back. */
              if (e.key === 'Enter') { e.currentTarget.blur(); return }
              if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); return }
              if (draft != null) setDraft(null)
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
              const shown = String(e.target.value)
              const raw = shown.replace('−', '-').trim()
              if (allowAuto && raw.toLowerCase() === 'auto') { setDraft(null); onChange('auto'); return }
              setDraft(shown)
              const n = parseFloat(raw)
              if (Number.isNaN(n)) return
              /* In range: propagate, so the proof follows the digits as before. Out of
                 range: hold it in the draft and let blur clamp it -- committing min on
                 the first digit of a longer number is exactly what made this unusable. */
              if (n >= min && n <= max) onChange(n)
            }}
          />
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
                    <path d={chevronPath(dir, 10, 6)}
                      fill="none" stroke="currentColor"                       strokeLinecap={CHEVRON.cap} strokeLinejoin={CHEVRON.join} strokeMiterlimit={CHEVRON.miterLimit} />
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
        {/* clamp(), not a bare percent: at stock = axis floor the mark sat at left:0 with a
            negative margin and hung off the bar's rounded corner, where any shape reads as
            damage rather than as a marker. Half its own width of inset at each end keeps
            it ON the bar without moving it anywhere it can be misread. */}
        {refPct != null && <span className="slider-ref" style={{ left: `clamp(5px, ${refPct}%, calc(100% - 5px))` }} aria-hidden="true" />}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={isAuto ? Math.min(max, Math.max(min, autoValue ?? (min + max) / 2)) : (value as number)}
          disabled={disabled}
          onPointerDown={e => { onTouchDown(e); onRangePointerDown?.(e) }}
          onPointerMove={onTouchMove}
          onPointerUp={onTouchUp}
          onPointerCancel={onTouchUp}
          onLostPointerCapture={onTouchUp}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}

export default AxisSlider
