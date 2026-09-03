// AxisTriplet — one parameter, three numbers: minimum · desired · maximum.
//
// A single knob can only ever be a floor OR a cap, and neither says what the line
// should AIM for. Justification needs all three, so the three are one control: they
// share a label, a unit and a lozenge, and only hairlines divide them. Three bordered
// boxes side by side would read as three controls that happen to sit on a row.
//
// Two things follow from "one control", and neither is decoration:
//
//   • The order is an invariant, and it is CARRIED, not refused. Type 95 into a min
//     under a desired of 85 and desired comes with it. A field that silently rejects
//     what you typed, or snaps back on blur without saying why, is the worst version
//     of this control — you cannot tell whether the app heard you.
//   • The unit belongs to the parameter, so it is printed once, beside the label, in
//     the quiet ink. Printing it in all three fields says they are three values of
//     three different things.
//
// `offset` exists because flattersatz stores tracking 100-centred (98/100/104) and
// type people read it 0-centred (−2/0/+4). The store keeps its numbers; the control
// shows yours. It is a display transform, not a second unit — all three H&J parameters
// are percentages.
//
// The field is the same one AxisSlider draws: type=text so the readout can carry a real
// minus (U+2212) instead of a hyphen, arrow keys reimplemented because type=text does
// not bring them, Shift for ×10, and drawn chevrons rather than the platform stepper,
// which cannot survive type=text and does not theme.
import { useRef, useState } from 'react'
import { nbMinus } from './format'
import './AxisTriplet.css'

/** The three numbers, in the store's own units (before `offset` is applied). */
export interface Band { min: number; desired: number; max: number }

export interface AxisTripletProps {
  /** Human name of the parameter — "word spacing", "letter spacing", "flex". */
  label: string
  /** Unit of all three numbers, shown once beside the label. */
  unit?: string
  /** Optional badge after the label (ReCal uses it for the expansion mechanism). */
  chip?: string
  chipMuted?: boolean
  title?: string
  value: Band
  onChange: (b: Band) => void
  /** Subtracted for display, added back on edit. 100 shows a 100-centred store 0-centred. */
  offset?: number
  step?: number
  /** Hard limits on the displayed number, after `offset`. */
  min?: number
  max?: number
  disabled?: boolean
  /** Render the min/desired/max column heads above this row. */
  showHeads?: boolean
}

const KEYS = ['min', 'desired', 'max'] as const
type Key = typeof KEYS[number]

/* Moving one edge carries the others rather than clamping the edit away. Which
   neighbours move depends on which edge you grabbed: a min may push desired up and
   desired may push max; a max pulls them down the same way. */
function carry(b: Band, k: Key, v: number): Band {
  const n = { ...b, [k]: v }
  if (k === 'min') { n.desired = Math.max(n.desired, v); n.max = Math.max(n.max, n.desired) }
  if (k === 'desired') { n.min = Math.min(n.min, v); n.max = Math.max(n.max, v) }
  if (k === 'max') { n.desired = Math.min(n.desired, v); n.min = Math.min(n.min, n.desired) }
  return n
}

export function AxisTriplet({
  label, unit, chip, chipMuted, title, value, onChange,
  offset = 0, step = 1, min = -Infinity, max = Infinity, disabled, showHeads,
}: AxisTripletProps) {
  /* While a field has focus it shows the draft you are typing, not the store's
     reformatted value — reformatting mid-keystroke eats the minus you just hit and
     makes "-" impossible to type. The draft is dropped on blur, so the store always
     wins in the end. Kept as one {key,text} rather than swapping the input between
     controlled and uncontrolled, which React warns about and which loses the caret. */
  const [draft, setDraft] = useState<{ k: Key; text: string } | null>(null)
  const hold = useRef<{ t?: number; i?: number }>({})

  const shown = (k: Key) => +(value[k] - offset).toFixed(2)
  const commit = (k: Key, display: number) =>
    onChange(carry(value, k, Math.min(max, Math.max(min, display)) + offset))

  /* A drawn button gets no native repeat, so press-and-hold is a timer: one step, a
     400ms wait for the intent, then 60ms repeats. Matches AxisSlider's stepper. */
  const stopHold = () => {
    if (hold.current.t) window.clearTimeout(hold.current.t)
    if (hold.current.i) window.clearInterval(hold.current.i)
    hold.current = {}
  }
  const startHold = (k: Key, dir: 1 | -1) => {
    const bump = () => commit(k, +(shown(k) + dir * step).toFixed(2))
    bump()
    hold.current.t = window.setTimeout(() => {
      hold.current.i = window.setInterval(bump, 60)
    }, 400)
  }

  return (
    <>
      {showHeads && (
        <div className="triplet-row triplet-row--head" aria-hidden="true">
          <span className="triplet-label" />
          <div className="triplet-fields triplet-fields--head">
            <span>min</span><span>desired</span><span>max</span>
          </div>
        </div>
      )}
      <div className={`triplet-row${disabled ? ' triplet-row--off' : ''}`} title={title}>
        <span className="triplet-label">
          {label}
          {unit && <i className="triplet-unit">{unit}</i>}
          {chip && <em className={`triplet-chip${chipMuted ? ' triplet-chip--muted' : ''}`}>{chip}</em>}
        </span>
        {/* One box, three values: one border, one padding, hairlines inside. */}
        <div className="triplet-fields">
          {KEYS.map(k => (
            <span className="triplet-f" key={k}>
              <input
                className="triplet-num"
                type="text"
                inputMode="decimal"
                role="spinbutton"
                aria-label={`${label} ${k}`}
                aria-valuenow={shown(k)}
                disabled={disabled}
                value={draft && draft.k === k ? draft.text : nbMinus(String(shown(k)))}
                onBlur={() => setDraft(null)}
                onKeyDown={e => {
                  const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
                  if (!dir) return
                  e.preventDefault()
                  commit(k, +(shown(k) + dir * step * (e.shiftKey ? 10 : 1)).toFixed(2))
                }}
                onChange={e => {
                  /* The field renders U+2212, so U+2212 is what comes back. One parse
                     for both paths, or a typed minus reads as NaN. */
                  const text = String(e.target.value)
                  setDraft({ k, text })
                  const raw = text.replace('−', '-').trim()
                  /* "", "-" and "-." are on the way to a number, not numbers. Committing
                     them would clamp the field out from under the caret. */
                  if (raw === '' || raw === '-' || raw === '-.' || raw === '.') return
                  const n = parseFloat(raw)
                  if (!Number.isNaN(n)) commit(k, n)
                }}
              />
              {!disabled && (
                <span className="triplet-step" aria-hidden="true">
                  {([1, -1] as const).map(dir => (
                    <button
                      key={dir}
                      type="button"
                      tabIndex={-1}
                      className="triplet-step-btn"
                      onPointerDown={e => { e.preventDefault(); startHold(k, dir) }}
                      onPointerUp={stopHold}
                      onPointerLeave={stopHold}
                      onPointerCancel={stopHold}
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
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
