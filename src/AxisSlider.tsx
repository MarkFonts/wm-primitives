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
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
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

  /* TOUCH DRAG, DRIVEN HERE RATHER THAN LEFT TO THE INPUT -- and the direction judged
     rather than declared. touch-action can only state one answer before anyone has moved:
     `pan-y` leaves a horizontal drag to be won or lost against the scroller, `none` wins it
     by taking the page's scroll away from every row. Both were tried and both were wrong;
     `none` was worse, giving a phone neither gesture.
     So: hold pan-y so the browser can always scroll, watch the first few pixels, and claim
     the pointer only once the movement is clearly horizontal.
     Mouse is untouched: the native input already handles it, and capturing there would add
     a second code path for a case that works. */
  const dragRef = useRef<{ x: number; y: number; id: number; live: boolean; v0: number | 'auto' } | null>(null)
  const rangeRef = useRef<HTMLInputElement>(null)

  /* NO setPointerCapture FOR A TOUCH, and this was measured, not reasoned (tests/behaviour,
     G9). A touch pointer is already captured to its pointerdown target by the browser.
     Asking for it again makes Chromium fire lostpointercapture for the hand-over -- and
     onLostPointerCapture is onTouchUp, so the drag ended on its first live frame, the
     scrubbing flag came off, and the native range took the rest of the gesture straight
     through onChange at touch rate. Every promise below held for exactly one frame. */
  const capture = (e: ReactPointerEvent<Element>, id: number) => {
    if (e.pointerType === 'touch') return
    try { e.currentTarget.setPointerCapture(id) } catch { /* best effort */ }
  }

  /* AND THE NATIVE RANGE MUST NOT TRACK THE FINGER ONCE WE DO. It follows a touch on its
     own, and every step of that is an input event, uncoalesced -- a second path to the
     host at 120Hz beside the one-per-frame path above. touchmove has to be cancelled to
     stop it, and React registers touch listeners passive, so this one is added by hand. */
  useEffect(() => {
    const el = rangeRef.current
    if (!el) return
    const stop = (e: TouchEvent) => { if (dragRef.current?.live) e.preventDefault() }
    el.addEventListener('touchmove', stop, { passive: false })
    return () => el.removeEventListener('touchmove', stop)
  }, [])

  /* ENGAGEMENT. On a coarse pointer the bar rests at two thirds of the row, leaving an
     inert shelf above and below it to put a thumb on -- see AxisSlider.css. Touching the
     control fills the row for a few seconds, so a second adjustment does not have to be
     aimed as precisely as the first.
     The row's HEIGHT never changes, only the bar inside it: nothing reflows, and the thing
     you were pointing at is still where you left it. */
  const [engaged, setEngaged] = useState(false)
  const engageTimer = useRef<number | null>(null)
  /* Two calls, because a single one was wrong: the bar shrank back mid-gesture while the
     finger was still on it. engage() holds it open with NO timer -- a touch that is still
     happening cannot time out -- and release() starts the three seconds once the finger
     lifts. */
  /* SCRUBBING, ANNOUNCED GLOBALLY. A host wants to know the difference between a value
     arriving continuously under a finger and one committed in a single step: the first
     wants no animation at all -- every intermediate frame is a full re-raster and the eye
     never asked for them -- while the second reads better eased.
     A data attribute on the root rather than a prop, because every consumer would
     otherwise have to thread the same flag down through every slider it renders, and the
     fact is global anyway: either the user is dragging a control or they are not. Hosts
     style off `:root[data-scrubbing]`; ignoring it costs nothing. */
  const setScrub = (on: boolean) => {
    const root = document.documentElement
    if (on) root.dataset.scrubbing = ''
    else delete root.dataset.scrubbing
  }
  useEffect(() => () => setScrub(false), [])

  const engage = () => {
    setEngaged(true)
    if (engageTimer.current) { clearTimeout(engageTimer.current); engageTimer.current = null }
  }
  const release = () => {
    if (engageTimer.current) clearTimeout(engageTimer.current)
    engageTimer.current = window.setTimeout(() => setEngaged(false), 3000)
  }
  useEffect(() => () => { if (engageTimer.current) clearTimeout(engageTimer.current) }, [])

  /* ONE UPDATE PER FRAME WHILE SCRUBBING. pointermove fires up to ~120Hz, and each event
     was calling onChange straight through: a setState, a full re-render, and a re-raster
     of whatever the host is showing. On a phone rendering a 400px variable word that is
     far more work than there are frames to do it in, so the updates queue and the type
     only catches up once the finger stops -- which reads as easing, but is a backlog.
     Coalescing to rAF means the host sees at most one value per frame, and always the
     LATEST: intermediate positions the eye never saw are dropped rather than rendered
     late. Discrete changes -- typing, arrow keys, a stepper tap, the wheel -- still go
     straight through, because one of those is one render either way. */
  const pending = useRef<number | null>(null)
  const raf = useRef(0)
  const lastSent = useRef<number | 'auto' | null>(null)
  const queueValue = (v: number) => {
    pending.current = v
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      const next = pending.current
      pending.current = null
      if (next == null || next === lastSent.current) return
      lastSent.current = next
      onChange(next)
    })
  }
  /* AND FLUSH ON RELEASE, synchronously. rAF is not guaranteed to run: a hidden tab or a
     backgrounded phone starves it, and without this the last value of a drag would sit in
     the queue forever and the gesture would silently do nothing. Coalescing is an
     optimisation for the frames in between; the value you let go on is not optional. */
  const flushValue = () => {
    setScrub(false)
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0 }
    const next = pending.current
    pending.current = null
    if (next == null || next === lastSent.current) return
    lastSent.current = next
    onChange(next)
  }
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

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

  /* THE VALUE FIELD TAKES A TAP AND PASSES ON A DRAG. It sits over the last fifth of the
     track, so while it swallowed presses outright the right end of every rail was
     undraggable -- and that is exactly where a high value parks its own thumb. You could
     only jump it by tapping somewhere else.
     So the press is judged the same way the rail's is: a tap focuses the field for typing,
     a horizontal drag drives the value as if the digits were not there. preventDefault on
     pointerdown is what buys the choice -- it suppresses the focus that would otherwise
     happen immediately, and focus() is called on the way up if it turned out to be a tap. */
  const numDrag = useRef<{ x: number; y: number; id: number; live: boolean } | null>(null)
  const stepDrag = useRef<{ x: number; y: number; id: number; live: boolean } | null>(null)
  const onNumDown = (e: ReactPointerEvent<HTMLInputElement>) => {
    if (disabled || e.pointerType === 'mouse' || numFocused) return
    e.preventDefault()
    numDrag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, live: false }
    engage()
  }
  const onNumMove = (e: ReactPointerEvent<HTMLInputElement>) => {
    const d = numDrag.current
    if (!d || e.pointerId !== d.id) return
    if (!d.live) {
      const dx = Math.abs(e.clientX - d.x), dy = Math.abs(e.clientY - d.y)
      if (dx < 6 && dy < 6) return
      if (dy > dx * 1.5) { numDrag.current = null; return }   // clearly vertical: the tray keeps it
      d.live = true
      setScrub(true)
      capture(e, d.id)
    }
    /* Measured against the RANGE, not the field: the value maps to the rail's width, and
       the field is a fifth of it sitting at one end. */
    const el = rangeRef.current
    if (!el) return
    const v = valueAt(e.clientX, el)
    if (v != null) queueValue(v)
  }
  const onNumUp = (e: ReactPointerEvent<HTMLInputElement>) => {
    const d = numDrag.current
    numDrag.current = null
    if (!d) return
    flushValue()
    release()
    if (d.live) { try { e.currentTarget.releasePointerCapture(d.id) } catch { /* gone */ } ; return }
    // It was a tap after all. Focus AND select: the caret alone lands after the last
    // digit, and replacing 1660 then means four backspaces before a new number can begin.
    e.currentTarget.focus()
    e.currentTarget.select()
  }

  /* HORIZONTAL WHEEL ONLY, and never vertical. Scroll-to-adjust was removed here for a
     good reason -- hovering a control while scrolling a panel is the common case, and a
     wheel that edits turns a scroll into an unnoticed edit. That argument is about deltaY.
     A sideways gesture over a horizontal control cannot be mistaken for scrolling a panel,
     so it can carry the edit the vertical one must not. */
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!e.deltaX || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    e.preventDefault()
    const base = typeof value === 'number' ? value : (autoValue ?? min)
    onChange(Math.min(max, Math.max(min, base + Math.sign(e.deltaX) * step)))
    engage()
  }

  const onTouchDown = (e: ReactPointerEvent<HTMLInputElement>) => {
    if (disabled || e.pointerType === 'mouse') return
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, live: false, v0: valueRef.current }
    engage()
  }
  /* The native range jumps to the touch point on pointerdown, before any direction is
     known. A tap keeps that -- it is how a tap works. A gesture that turns out to be a
     scroll must not: the bar you brushed on the way past would otherwise be left where
     your finger landed. So conceding puts the value back to what it was at touch-down. */
  const concede = (d: { v0: number | 'auto' }) => {
    dragRef.current = null
    if (valueRef.current !== d.v0) onChange(d.v0)
  }
  const onTouchMove = (e: ReactPointerEvent<HTMLInputElement>) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.id) return
    if (!d.live) {
      const dx = Math.abs(e.clientX - d.x), dy = Math.abs(e.clientY - d.y)
      /* HYSTERESIS, and this is the bug that made "drag from anywhere" not work. Deciding
         on the FIRST sample past 3px, then killing the gesture outright when it looked
         vertical, meant a finger that rolled slightly on the way down -- which is most of
         them, on a 32px bar -- lost the drag before it began, with no way back. What was
         left was whatever the native input does: jump on tap, drag only from the thumb.
         So: wait for 6px of real movement, and only concede to the scroller when the
         gesture is CLEARLY vertical (1.5x). Anything ambiguous stays ours, and a gesture
         that has not resolved yet is left undecided rather than thrown away. */
      if (dx < 6 && dy < 6) return
      if (dy > dx * 1.5) { concede(d); return }
      d.live = true
      setScrub(true)
      capture(e, d.id)
    }
    const v = valueAt(e.clientX, e.currentTarget)
    if (v != null) queueValue(v)
    e.preventDefault()
  }
  const onTouchUp = (e: ReactPointerEvent<HTMLInputElement>) => {
    const d = dragRef.current
    if (d?.live && e.pointerType !== 'touch') { try { e.currentTarget.releasePointerCapture(d.id) } catch { /* already gone */ } }
    // The browser took the gesture (a scroll): same as conceding it ourselves.
    if (d && !d.live && e.type === 'pointercancel') concede(d)
    dragRef.current = null
    flushValue()
    release()
  }

  // How far along the track the value sits, as a percentage. Only variant="track" paints
  // with it -- the bar's fill is a gradient stop, not an element -- but it costs one
  // custom property on every row rather than a second code path for one variant.
  const shownValue = isAuto ? (autoValue ?? (min + max) / 2) : (value as number)
  const valuePct = Math.max(0, Math.min(100, ((shownValue - min) / (max - min)) * 100))

  return (
    <div
      ref={rowRef}
      className={`slider-row${disabled ? ' slider-row--off' : ''}${variant !== 'default' ? ` slider-row--${variant}` : ''}${field === 'box' ? ' slider-row--boxed' : ''}${engaged ? ' slider-row--engaged' : ''}`}
      onWheel={onWheel}
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
            onPointerDown={onNumDown}
            onPointerMove={onNumMove}
            onPointerUp={onNumUp}
            onPointerCancel={onNumUp}
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
              /* The arrow keys came free with type=number and have to be put back. Held,
                 the OS repeats keydown by itself, so this reads the same as the native
                 field did. Shift is the coarse step, as it is in every design tool. */
              const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
              if (!dir) return
              e.preventDefault()
              /* An arrow abandons whatever was half-typed and steps the LIVE value. Only
                 here: clearing the draft on every key, as this once did, snapped the
                 field back to the committed number between two characters of the same
                 word now that keystrokes no longer commit. */
              setDraft(null)
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
              /* Draft only. Nothing reaches the host until Enter or blur. Propagating
                 in-range keystrokes was tried (ffa2e95) and it is worse than it sounds on a
                 phone: on the way to 1660 the proof jumps to 16, then 166, and a host that
                 clamps its own value writes that back into the field under your thumb --
                 so the digits you were typing were being edited by the thing you were
                 typing them for. A field is a place to compose a number; the rail and the
                 arrows are the live controls. */
              setDraft(shown)
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
                  /* THE ARROWS PASS A DRAG ON TOO. They sit over the rail's right end, so
                     while they swallowed presses outright you could not drag a value that
                     had parked beneath them -- the same fault the number field had, and
                     between the two of them most of the right side of the bar was dead.
                     The step still fires immediately on press, because hold-to-repeat
                     needs that; if the press then turns into a horizontal drag, the
                     repeat is cancelled and the gesture becomes a rail drag instead. */
                  onPointerDown={e => { e.preventDefault(); stepDrag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, live: false }; startStep(dir); engage() }}
                  onPointerMove={e => {
                    const d = stepDrag.current
                    if (!d || e.pointerId !== d.id) return
                    if (d.live) {
                      const el2 = rangeRef.current
                      if (el2) { const v2 = valueAt(e.clientX, el2); if (v2 != null) queueValue(v2) }
                      return
                    }
                    const dx = Math.abs(e.clientX - d.x), dy = Math.abs(e.clientY - d.y)
                    if (dx < 6 && dy < 6) return
                    if (dy > dx * 1.5) { stepDrag.current = null; return }
                    d.live = true
                    setScrub(true)
                    stopStep()
                    dragRef.current = { x: d.x, y: d.y, id: d.id, live: true, v0: valueRef.current }
                    capture(e, d.id)
                    const el = rangeRef.current
                    if (el) { const v = valueAt(e.clientX, el); if (v != null) queueValue(v) }
                  }}
                  onPointerUp={e => { stepDrag.current = null; dragRef.current = null; stopStep(); flushValue(); release() }}
                  onPointerLeave={stopStep}
                  onPointerCancel={e => { stepDrag.current = null; dragRef.current = null; stopStep(); flushValue(); release() }}
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
          ref={rangeRef}
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
