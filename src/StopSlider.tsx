// StopSlider — named stops and the raw axis, in ONE row.
//
// An axis with named places on it wants both: the names, because that is where the design
// decisions are, and the axis, because a value between two names is a real value. Stacking a
// chip strip over an AxisSlider says that twice and spends two rows of a rail on it.
//
//   STOPS     the segments, the current one filled. Click a name, take that value.
//   FREE      the names fade, a rail draws in behind them, and THE GRIP BECOMES THE THUMB.
//
// THE GRIP AND THE THUMB ARE ONE NODE, and that is the whole idea rather than a detail of
// it. Parked, it is a 6x16 handle in the gutter right of the stops with two dashes either
// side; unlocked, it travels onto the rail and becomes the 20x20 thumb. A second control
// appearing below would be a different idea -- one that says "here is a slider as well"
// rather than "this is the same control, told another way".
//
// PROVENANCE. This is docs card 04, from docs/system/pages/controls.html, which is itself a
// port of MorphControl in framercomponents/files/CustomTypeTester.tsx without framer-motion.
// SLIDERS.md has carried it as row 13, `page-built` -- in the system, never extracted -- and
// names it "a genuine exception: named stops with a thumb that travels between them", not a
// variant of AxisSlider. It is not one: AxisSlider is a number with a track, this is a set
// of named values that a number can move between.
//
// WHAT IT DOES NOT DECIDE. The stops themselves. They are a property of the axis and of the
// design system that named them, and this component takes them as a prop -- which matters,
// because the house currently disagrees with itself about where GEOM's `Base` sits (ReCal's
// instrument rail says 50, the docs card says 60). Extracting the control does not settle
// that and must not pretend to.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './StopSlider.css'

/** A named place on the axis. */
export interface Stop {
  value: number
  label: string
}

export interface StopSliderProps {
  /** Human name of the parameter — "geometric form". Not the axis tag. */
  label: string
  value: number
  min: number
  max: number
  /** Rounding for a dragged value. Defaults to 1. */
  step?: number
  stops: Stop[]
  onChange: (v: number) => void
  /** Formatted readout, when the raw number is not what should be shown. */
  display?: string | number
}

// The gutter the grip parks in and the reset fills, and the thumb once it has travelled.
// Both are the docs card's; see the note in StopSlider.css.
const PARK = 34
const KNOB = 20

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function StopSlider({
  label, value, min, max, step = 1, stops, onChange, display,
}: StopSliderProps) {
  const [free, setFree] = useState(false)
  const [drag, setDrag] = useState(false)
  const [spin, setSpin] = useState(false)
  const [width, setWidth] = useState(0)
  const area = useRef<HTMLDivElement | null>(null)

  /* The knob's offset is in PIXELS, measured, because the same node parks and travels: a
     percentage inside its own transform resolves against the knob, not against the rail. */
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const span = Math.max(1e-6, max - min)
  const at = clamp((value - min) / span, 0, 1)
  const x = free
    ? at * Math.max(0, width - PARK - KNOB)
    : Math.max(0, width - PARK) + (PARK - 6) / 2

  const fromX = (clientX: number) => {
    const r = area.current?.getBoundingClientRect()
    if (!r) return
    const t = clamp((clientX - r.left - KNOB / 2) / Math.max(1, r.width - PARK - KNOB), 0, 1)
    onChange(Math.round((min + t * span) / step) * step)
  }

  /* Listening on the window, not on the knob. A pointer that leaves the control mid-drag
     still belongs to the drag, and a capture that is lost -- another element grabbing it, a
     window blur -- has to end the gesture rather than leave it stuck on. */
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => { e.preventDefault(); fromX(e.clientX) }
    const up = () => setDrag(false)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
    }
  }, [drag, min, max, step])

  /* Locking SNAPS to the nearest named stop. Locking without snapping leaves a segmented
     control showing a value none of its buttons match, so nothing reads as selected and the
     control looks broken rather than closed. */
  const relock = () => {
    if (stops.length) {
      const near = stops.reduce((best, s) =>
        Math.abs(s.value - value) < Math.abs(best - value) ? s.value : best, stops[0].value)
      onChange(near)
    }
    setFree(false)
    setSpin(true)
    setTimeout(() => setSpin(false), 520)
  }

  return (
    <div className={`wm-stops${free ? ' is-free' : ''}${drag ? ' is-drag' : ''}`}>
      <div className="wm-stops-head">
        <span className="wm-stops-label t-ui">{label}</span>
        <span className="wm-stops-value">{display ?? value}</span>
      </div>

      <div className="wm-stops-area" ref={area}>
        <div className="wm-stops-row">
          {stops.map(s => (
            <button
              key={s.value}
              type="button"
              /* Pressed only when the value is EXACTLY on the stop. A segmented control that
                 stays lit while the thumb is dragged away from it is lying about where you
                 are, and "between two stops" is a state this control exists to allow. */
              aria-pressed={value === s.value}
              tabIndex={free ? -1 : 0}
              onClick={() => onChange(s.value)}
            >{s.label}</button>
          ))}
        </div>

        <span className="wm-stops-rail" />

        <div
          className="wm-stops-knob"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          style={{ '--stops-x': `${x}px` } as React.CSSProperties}
          // Parked, a click unlocks. Unlocked, a pointerdown starts the drag — the same
          // gesture as the Framer original, where the grip is the way in.
          onClick={() => { if (!free) setFree(true) }}
          onPointerDown={e => {
            if (!free) return
            e.preventDefault()
            e.currentTarget.setPointerCapture?.(e.pointerId)
            setDrag(true)
          }}
          onKeyDown={e => {
            if (!free) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFree(true) }
              return
            }
            const d = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
            if (!d) return
            e.preventDefault()
            onChange(clamp(value + d * (e.shiftKey ? 10 : 1), min, max))
          }}
        />

        <button
          type="button"
          className={`wm-stops-reset${spin ? ' is-spin' : ''}`}
          title="back to named stops"
          aria-label="back to named stops"
          onClick={relock}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13 8a5 5 0 1 1-1.6-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13 2v3.2h-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
