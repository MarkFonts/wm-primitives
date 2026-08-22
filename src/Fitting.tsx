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
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AxisSlider } from './AxisSlider'
import { band, DEFAULTS, layoutParagraph, lineStyle, type Band, type FitMode, type FitOptions } from './flattersatz'
import { splitInlineMarkup } from './inlineMarkup'
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
  // Neither justified nor ragged still MEASURES: 'plain' breaks the lines itself so the
  // margin can hang its punctuation, and spends nothing while doing it. Only an explicit
  // 'off' hands the paragraph back to the browser.
  return textAlign === 'justify' ? 'justified' : (swissRag ? 'flattersatz' : 'plain')
}

export interface FittingControlsProps {
  value: Partial<FitOptions>
  onChange: (next: Partial<FitOptions>) => void
  mode: FitMode
  swissRag: boolean
  onSwissRag: (on: boolean) => void
  /** The proofed font has a `wdth` axis, so expansion can be Zapf's rather than a
   *  scaleX. The app knows this from fvar; the engine also detects it by measuring. */
  widthAxis?: boolean
}

/* One row of the H&J schema: minimum · desired · maximum. Three numbers because one
   knob can only ever be a floor OR a cap, and never states what the line should aim for
   in the first place. Letter spacing is stored 100-centred like the others and shown
   0-centred, which is how type people read it. */
function BandRow({ label, chip, chipMuted, title, value, offset, step, onChange }: {
  label: string
  chip?: string
  chipMuted?: boolean
  title?: string
  value: Band
  offset: number
  step: number
  onChange: (b: Band) => void
}) {
  const field = (k: keyof Band) => (
    <input
      key={k}
      className="fit-num"
      type="number"
      step={step}
      aria-label={`${label} ${k}`}
      value={+(value[k] - offset).toFixed(2)}
      onChange={e => onChange({ ...value, [k]: +e.target.value + offset })}
    />
  )
  return (
    <div className="fit-hj-row" title={title}>
      <span className="fit-hj-label">
        {label}
        {chip && <em className={`fit-chip${chipMuted ? ' fit-chip--muted' : ''}`}>{chip}</em>}
      </span>
      {/* One box, three values. Three separate boxes could not fit the rail beside the
          label, and the arrows were not the thing to give up — so the row keeps ONE
          border and one padding, and the values are divided by hairlines inside it. */}
      <div className="fit-hj-fields">
        {(['min', 'desired', 'max'] as const).map(field)}
      </div>
    </div>
  )
}

export function FittingControls({ value, onChange, mode, swissRag, onSwissRag, widthAxis = false }: FittingControlsProps) {
  const v = { ...DEFAULTS, ...value }
  const set = (patch: Partial<FitOptions>) => onChange({ ...value, ...patch })
  // const off = mode === 'off'   // only the indent row read this — see below
  const rag = mode === 'flattersatz'
  const [hj, setHj] = useState(false)

  /* The expansion row states what it is DOING, and only once it does anything. At rest
     — 100/100/100 — it is just a control and wears no badge. Opened, the badge names the
     mechanism, because these two are not the same act: `wdth` moves masters the designer
     drew, `scaleX` stretches what is there. Showing only the good one would make its
     absence ambiguous, so both are labelled and only the honest one glows. */
  const spending = (b: Band) => b.max > 100 || b.min < 100
  const expansionChip = (b: Band) =>
    !spending(b) ? undefined : widthAxis ? 'wdth' : 'scaleX'

  const ragKnob = (k: 'tracking' | 'wordSpacing' | 'glyphScaling', label: string) => (
    <AxisSlider label={label} value={v.rag[k]} min={k === 'wordSpacing' ? 80 : 95}
      max={k === 'wordSpacing' ? 133 : 105} step={k === 'wordSpacing' ? 1 : 0.1} suffix="%"
      onChange={n => set({ rag: { ...v.rag, [k]: +(n as number).toFixed(1) } })} />
  )

  return (
    <>
      {/* Two switches in one bordered control, the way a Roman/Italic pair reads: filled
          where it is on, a hairline between. Each keeps its own state word, because these
          are independent switches and not a two-way choice. */}
      <div className="fit-switches">
        <button
          className={`fit-switch${rag ? ' active' : ''}`}
          aria-pressed={rag}
          disabled={mode === 'justified'}
          title={mode === 'justified' ? 'Justification replaces the rag — pick another alignment to set one' : undefined}
          onClick={() => {
            // A rag arrives as a rag: the band, and nothing spent. The H&J bands are
            // where JUSTIFIED starts, which is a different question.
            if (!swissRag) set({ ragWidth: DEFAULTS.ragWidth, budgets: false, rag: DEFAULTS.rag })
            onSwissRag(!swissRag)
          }}
        >
          <span>Swiss Rag</span>
          {/* Under Justify the rag is not merely unused, it is replaced — so the switch
              reads off and stays off, instead of reporting a state with no output. */}
          <span className="fit-switch-state">{rag ? 'on' : 'off'}</span>
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

      {/* THE RAG. Its measure band, and knobs that are its own — opening one closes the
          gaps greedy breaking leaves, which is the rag, so they start off and stay off
          until asked for. */}
      <div className={`fit-row-collapse${rag ? ' fit-row-collapse--open' : ''}`}
        style={{ maxHeight: rag ? (v.budgets ? 300 : 108) : 0 }}>
        <AxisSlider label="rag width" value={v.ragWidth} min={0} max={220} suffix="px"
          onChange={n => set({ ragWidth: n as number })} />
        <button className={`fit-sub${v.budgets ? ' active' : ''}`} aria-pressed={v.budgets}
          onClick={() => set({ budgets: !v.budgets })}>
          <span>spacing budgets</span>
          <span className="fit-switch-state">{v.budgets ? 'on' : 'off'}</span>
        </button>
        {v.budgets && (
          <>
            {ragKnob('tracking', 'letter spacing')}
            {ragKnob('wordSpacing', 'word spacing')}
            {ragKnob('glyphScaling', 'glyph scaling')}
            {expansionChip(band(v.rag.glyphScaling)) && (
              <div className="fit-chip-row">
                <em className={`fit-chip${widthAxis ? '' : ' fit-chip--muted'}`}>
                  {expansionChip(band(v.rag.glyphScaling))}
                </em>
              </div>
            )}
          </>
        )}
      </div>

      {/* JUSTIFICATION. The schema itself is buried: a proof wants a column that reads,
          not a dialog, and these are the numbers you set once per typeface. */}
      <div className={`fit-row-collapse${mode === 'justified' ? ' fit-row-collapse--open' : ''}`}
        style={{ maxHeight: mode === 'justified' ? (hj ? 240 : 34) : 0 }}>
        <button className={`fit-sub${hj ? ' active' : ''}`} aria-expanded={hj} onClick={() => setHj(!hj)}>
          <span>justification</span>
          <span className="fit-switch-state">{hj ? 'hide' : 'H&J'}</span>
        </button>
        {hj && (
          <div className="fit-hj">
            <div className="fit-hj-row fit-hj-head">
              <span className="fit-hj-label" />
              <div className="fit-hj-fields fit-hj-fields--head">
                <span>min</span><span>desired</span><span>max</span>
              </div>
            </div>
            <BandRow label="word spacing" offset={0} step={1} value={band(v.wordSpacing)}
              onChange={b => set({ wordSpacing: b })} />
            <BandRow label="letter spacing" offset={100} step={0.5} value={band(v.tracking)}
              onChange={b => set({ tracking: b })} />
            {/* One name, whichever mechanism serves it: the row does the same job and
                obeys the same numbers whether the font has a width axis to move or has
                to be stretched. Which of the two it used is in the tooltip, not in a
                label that changes shape from font to font. */}
            <BandRow label="glyph scaling"
              chip={expansionChip(band(v.glyphScaling))}
              chipMuted={!widthAxis}
              title={widthAxis
                ? 'This font has a width axis: expansion moves wdth and re-measures, so the line is filled with type the designer drew.'
                : 'No width axis in this font: expansion falls back to scaleX, which distorts. Leave at 100 to keep the proof honest.'}
              offset={0} step={0.5} value={band(v.glyphScaling)}
              onChange={b => set({ glyphScaling: b })} />
          </div>
        )}
      </div>

      {/* Indent is out of the rail. Justified never wanted it, and in rag mode it was one
          more slider shoving the variable axes off the bottom — which is the whole reason
          anyone opened the panel. The option still exists in the engine; nothing here
          sets it. */}
      {/* <div className="fit-options" style={{ maxHeight: off ? 0 : 64, opacity: off ? 0 : 1 }}>
        <AxisSlider label="indent" value={v.indent} min={0} max={120} suffix="px"
          onChange={n => set({ indent: n as number })} />
      </div> */}
    </>
  )
}

/* One paragraph, fitted line by line. Rendered only when a mode is on and the block is
 * NOT focused — editing keeps the raw flow, which is the contract EditableTextBlock
 * already has, so this needs nothing from it. Measurement happens against this wrapper,
 * so it inherits the block's real font, axes and size.
 *
 * `fallback` is what the app would have rendered: inline markup, a flash overlay,
 * whatever. It shows while the first measurement is pending, and permanently for any
 * block the fitter will not touch.
 */
export function FittedParagraph({ text, opts, indentPx = 0, fallback, runStyle }: {
  text: string
  opts: Partial<FitOptions>
  indentPx?: number
  fallback: ReactNode
  /** How this app draws emphasis. Used twice and it must be the same both times: to
   *  MEASURE the run (an italic run is a different face, so different widths) and to
   *  draw it. Omit and a marked-up block simply sets roman. */
  runStyle?: (kind: 'bold' | 'italic' | 'underline') => CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<ReturnType<typeof layoutParagraph>>(null)

  // Tokenised HERE, from the string, so the effect below can depend on the string. Taking
  // tokens as a prop would hand it a fresh array every render and re-fit the paragraph
  // forever.
  const runs = useMemo(() => splitInlineMarkup(text), [text])
  // Keyed on the VALUES, not on the callback's identity: an app that passes an inline
  // arrow — which is the natural way to write it — would otherwise hand this a new
  // function every render and re-fit the paragraph forever.
  const computed = runStyle && {
    bold: runStyle('bold'), italic: runStyle('italic'), underline: runStyle('underline'),
  }
  const runStylesKey = JSON.stringify(computed ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runStyles = useMemo(() => computed, [runStylesKey])

  const relayout = () => {
    const el = ref.current
    if (el) setLines(layoutParagraph(runs, el, { ...opts, runStyles }, indentPx))
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    relayout()
    const ro = new ResizeObserver(relayout)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, runStyles, indentPx, opts.mode, opts.center, opts.ragWidth, opts.wordSpacing,
      opts.tracking, opts.glyphScaling, opts.hyphenate, opts.budgets, opts.rag, opts.hang])

  /* Every style that changes GLYPH WIDTHS has to re-fit, and almost none of them change
   * the box: tracking, size, weight, a variable axis, a feature setting — the column
   * stays exactly as wide as it was, so neither the options above nor the ResizeObserver
   * notices. The breaks then stay as computed under the old style and the line runs past
   * the measure: 0.3em of tracking put a 1223px line in a 756px column, with the line
   * text identical to before, which is what proves it never recomposed.
   *
   * Reading the RESOLVED style is deliberate. Asking the app to declare what changed is
   * how this bug happened in the first place — a list of dependencies that someone has
   * to remember to add tracking to. The browser already knows. */
  const lastStyle = useRef('')
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const cs = getComputedStyle(el)
    const key = [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.fontStyle, cs.fontStretch,
                 cs.fontVariationSettings, cs.fontFeatureSettings, cs.fontOpticalSizing,
                 cs.letterSpacing, cs.wordSpacing, cs.textTransform, cs.fontKerning].join('|')
    if (key === lastStyle.current) return
    lastStyle.current = key
    relayout()
  })

  return (
    <div ref={ref}>
      {lines
        ? lines.map((l, i) => (
            <div key={i}>
              <span style={lineStyle(l) as React.CSSProperties}>
                {/* The line is one span — that is what carries its spacing and its
                    expansion — and the emphasis lives in spans INSIDE it. A run can no
                    longer send the whole block back to browser flow. */}
                {(l.runs ?? [{ type: 'text', text: l.text }]).map((r, ri) =>
                  r.type === 'text' || !runStyle
                    ? r.text
                    : <span key={ri} style={runStyle(r.type as 'bold' | 'italic' | 'underline')}>{r.text}</span>)}
              </span>
            </div>
          ))
        : fallback}
    </div>
  )
}
