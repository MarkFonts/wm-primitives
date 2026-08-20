/* Fitting.tsx — the controls for flattersatz.js, shared by every paragraph view.
 *
 * The ENGINE was shared from the start; this is the interface, extracted once a second
 * app wanted it. font-proofer renders it in the TYPOGRAPHY sidebar, ReCal in the floating
 * Type panel — both build their rows from AxisSlider, so the rows travel and only the
 * container differs.
 *
 * Alignment travels too, because justified IS an alignment and the four icons are one
 * drawing job nobody should do twice. Each app places the row where its chrome wants it
 * — font-proofer beside its reset, ReCal in the floating panel.
 */
import { AxisSlider } from './AxisSlider'
import { DEFAULTS, type FitMode, type FitOptions } from './flattersatz'
import './Fitting.css'

export type { FitMode, FitOptions }


/* One family: four rows apiece, two bar lengths only (10 and 6), so the row reads as a
   set rather than four drawings. Justify gets three flush lines and a short last one —
   justification never forces the final line, and four full bars would promise setting
   nobody does. */
const BARS: Record<string, [number, number, number, number]> = {
  left: [10, 6, 10, 6], center: [10, 6, 10, 6], right: [10, 6, 10, 6], justify: [10, 10, 10, 6],
}
const ROWS = [1.6, 5.0, 8.4, 11.8]

function AlignIcon({ kind }: { kind: string }) {
  const widths = BARS[kind]
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      {ROWS.map((y, i) => {
        const w = widths[i]
        const x = kind === 'right' ? 12 - w : kind === 'center' ? 2 + (10 - w) / 2 : 2
        return <rect key={y} x={x} y={y} width={w} height="1.2" rx="0.6" fill="currentColor" />
      })}
    </svg>
  )
}

export const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const
export type Alignment = typeof ALIGNMENTS[number]

export function AlignmentButtons({ value, onChange, className = '' }: {
  value: string
  onChange: (a: Alignment) => void
  className?: string
}) {
  return (
    <>
      {ALIGNMENTS.map(a => (
        <button
          key={a}
          className={`fit-align-btn${value === a ? ' active' : ''} ${className}`.trim()}
          title={a === 'justify' ? 'Justify' : `Align ${a}`}
          aria-pressed={value === a}
          onClick={() => onChange(a)}
        >
          <AlignIcon kind={a} />
        </button>
      ))}
    </>
  )
}

/** justify -> justified, the rag switch -> flattersatz, neither -> off. Derived, never
 *  stored, so the two can never both be live. */
export function fittingMode(textAlign: string, swissRag: boolean): FitMode {
  return textAlign === 'justify' ? 'justified' : (swissRag ? 'flattersatz' : 'off')
}

export interface FittingControlsProps {
  value: Partial<FitOptions>
  onChange: (next: Partial<FitOptions>) => void
  mode: FitMode
  swissRag: boolean
  onSwissRag: (on: boolean) => void
}

export function FittingControls({ value, onChange, mode, swissRag, onSwissRag }: FittingControlsProps) {
  const v = { ...DEFAULTS, ...value }
  const set = (patch: Partial<FitOptions>) => onChange({ ...value, ...patch })
  const off = mode === 'off'

  return (
    <>
      {/* Two switches in one bordered control, the way a Roman/Italic pair reads: filled
          where it is on, a hairline between. Each keeps its own state word, because these
          are independent switches and not a two-way choice. */}
      <div className="fit-switches">
        <button
          className={`fit-switch${swissRag ? ' active' : ''}`}
          aria-pressed={swissRag}
          onClick={() => {
            // A rag arrives as a rag: the band, and no stretching. Zeros are where
            // JUSTIFIED starts, which is a different question.
            if (!swissRag) set({ ragWidth: DEFAULTS.ragWidth, tracking: 100, wordSpacing: 100, glyphScaling: 100 })
            onSwissRag(!swissRag)
          }}
        >
          <span>Swiss Rag</span>
          <span className="fit-switch-state">{swissRag ? 'on' : 'off'}</span>
        </button>
        {mode === 'justified' && (
          <button
            className={`fit-switch${v.hyphenate ? ' active' : ''}`}
            aria-pressed={!!v.hyphenate}
            onClick={() => set({ hyphenate: !v.hyphenate })}
          >
            <span>Hyphenate</span>
            <span className="fit-switch-state">{v.hyphenate ? 'on' : 'off'}</span>
          </button>
        )}
      </div>

      {/* Rows in the order the budget spends them. Rag width belongs to the rag alone, so
          it slides in and out rather than appearing and vanishing. */}
      <div className="fit-row-collapse" style={{ maxHeight: mode === 'flattersatz' ? 64 : 0 }}>
        <AxisSlider label="rag width" value={v.ragWidth} min={0} max={220} step={1} suffix="px"
          onChange={n => set({ ragWidth: n as number })} />
      </div>
      <div className="fit-options" style={{ maxHeight: off ? 0 : 420, opacity: off ? 0 : 1 }}>
        <AxisSlider label="letter spacing" value={v.tracking} min={90} max={110} step={0.1} suffix="%"
          onChange={n => set({ tracking: +(n as number).toFixed(1) })} />
        <AxisSlider label="word spacing" value={v.wordSpacing} min={80} max={133} step={1} suffix="%"
          onChange={n => set({ wordSpacing: n as number })} />
        <AxisSlider label="glyph scaling" value={v.glyphScaling} min={95} max={105} step={0.1} suffix="%"
          onChange={n => set({ glyphScaling: +(n as number).toFixed(1) })} />
        <AxisSlider label="indent" value={v.indent} min={0} max={120} step={1} suffix="px"
          onChange={n => set({ indent: n as number })} />
      </div>
    </>
  )
}
