/* GradientControls.tsx — the controls for gradient.ts, and the one component the engine
 * cannot be reduced to a string for.
 *
 * NOT Gradient.tsx, for the same reason SpecimenNav is not Specimen: on a case-insensitive
 * filesystem `./src/Gradient` and `./src/gradient` are one module, so the barrel resolves
 * both imports to the engine and fails at build with a missing export that names the
 * component. Named for the headline export instead.
 *
 * Same split as Fitting.tsx: the ENGINE is a plain module a static page can script-tag,
 * this is the interface both apps render. A scrim and a blend are declarations, so they
 * need no component at all -- a call site sets `background-image` and is done.
 * Progressive blur is not a declaration; it is a stack of masked backdrop layers, and
 * that stack is DOM. `ProgressiveBlur` exists so the four consumers do not each grow
 * their own version of the wrapper (and each get the quadrature wrong, see gradient.ts).
 *
 * THE CURVE EDITOR IS THE CONTROL. Mass Driver's resampler makes the same point: the
 * numbers that matter in a gradient are not the endpoints, which are obvious, but the
 * two control points, which are not -- and you cannot type those. You drag them and
 * watch the ramp. The presets are there to start from, not to choose from.
 */
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { AxisSlider } from './AxisSlider'
import {
  CHANNEL_NAMES, EASES, blend, blurLayers, bezierY, channelBlend, declaration, maskRamp,
  resolveEase, resolveRGB, rgbToHsl, scrim,
  type Bezier, type ChannelSpace, type Ease, type EaseName, type Space, type Triple,
} from './gradient'

/* A colour as the three numbers the channel view is steering. */
const channelTriple = (c: string, space: ChannelSpace): Triple => {
  const rgb = resolveRGB(c)
  return space === 'hsl' ? rgbToHsl(rgb) : rgb
}
import './toggleGroup.css'
import './gradient.css'

/* ── ProgressiveBlur ──────────────────────────────────────────────────────────────── */

export interface ProgressiveBlurProps {
  /** Blur radius at the far end, px. Default 24. */
  radius?: number
  /** Stacked layers. Each is its own backdrop rasterisation — this is the cost. Default 6. */
  layers?: number
  /** The curve the radius follows. Default `ease-in-out` — a blur wants both ends eased:
   *  hold the start so the text stays legible, ease into the maximum so it arrives. */
  ease?: Ease
  /** Gradient direction the blur grows along. Default 'to bottom'. */
  dir?: string
  /** Hold this much of the leading edge untouched — a fraction, or a CSS length such as
   *  `'1lh'`. See blurLayers() in gradient.ts. */
  start?: number | string
  /** Where the stack sits. Default 'absolute', which assumes a positioned parent — the
   *  usual case, since the point is to blur an edge of something. 'fixed' is for a
   *  viewport-edge blur under fixed chrome. */
  position?: 'absolute' | 'fixed'
  className?: string
  style?: CSSProperties
}

/** variablur's effect, for the web. The stack blurs what is BEHIND it, so it goes over
 *  the content it acts on rather than around it, and takes no pointer events: it is a
 *  lens, not a lid.
 *
 *  What it cannot do is blur a scrolling ancestor's overflow on iOS Safari, where a
 *  backdrop-filter inside a scroll container is sampled before the scroll offset is
 *  applied and the blur lags the content. The fix is the same one the fixed-header case
 *  wants — position it against the viewport, not the scroller. */
/** @deprecated Retired 2026-09-20 with `blurLayers()` -- see its note for the two
 *  artifacts and why neither is fixable. Use a scrim, or one uniform blur. */
export function ProgressiveBlur({
  radius = 24, layers = 8, ease = 'ease-in-out', dir = 'to bottom', start = 0,
  position = 'absolute', className = '', style,
}: ProgressiveBlurProps) {
  const stack = useMemo(() => blurLayers({ radius, layers, ease, dir, start }),
    [radius, layers, ease, dir, start])
  return (
    <div className={`wm-blur ${className}`.trim()} style={{ position, ...style }} aria-hidden="true">
      {stack.map((layer, i) => <div key={i} className="wm-blur-layer" style={layer as CSSProperties} />)}
    </div>
  )
}

/* ── CurveEditor ──────────────────────────────────────────────────────────────────── */

const BOX = 120          // the editor's own coordinate box; CSS scales the SVG
const HANDLE = 6

export interface CurveEditorProps {
  value: Bezier
  onChange: (b: Bezier) => void
  /** Draw the sampled stops on the curve, so the count reads as positions and not as a
   *  number. Off by default — a blur stack has bands, not stops. */
  marks?: number
  /** Where the curve's 0 and 1 sit on the plot's own axis, 0..1 bottom to top.
   *
   *  Default [0, 1]: the curve climbs corner to corner, which is right for an easing,
   *  where 0 and 1 are the whole story. It is WRONG for a channel. Mass Driver plots
   *  absolute channel value against position, so R descending 246 -> 48 draws as a line
   *  going DOWN, and a channel that does not move at all draws as a horizontal line
   *  partway up. Normalised, all three climb identically and a flat channel is a lie
   *  told with a diagonal. Pass the channel's real endpoints and the graph means
   *  something. */
  range?: [number, number]
  /** Nothing here can be edited, so draw nothing that says it can. No handles, no control
   *  arms, no pointer handling, no grab cursor — a level line and that is all.
   *
   *  A channel whose ends are equal is the case: every curve on it resolves to the same
   *  line, so a handle is an affordance the control cannot honour. Dimming it was not
   *  enough; a dimmed handle is still a handle. */
  locked?: boolean
}

/** Two draggable control points over the curve they describe. Y is inverted on the way
 *  in and out, because SVG counts down and a ramp reads up. */
export function CurveEditor({ value, onChange, marks, range = [0, 1], locked = false }: CurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [held, setHeld] = useState<0 | 1 | null>(null)
  const [x1, y1, x2, y2] = value
  /* The curve's own 0..1 placed on the plot's 0..1. Everything drawn below goes through
     this, so the path, the reference line, the marks and the handles cannot disagree
     about where a value sits. */
  const [lo, hi] = range
  const plot = (v: number) => lo + (hi - lo) * v

  /* The path is sampled rather than emitted as a <path d="C …">, because the same
     sampler has to agree with the stops drawn on top of it. Two ways of drawing one
     curve is how an editor ends up lying about what it will output. */
  const d = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 48; i++) {
      const x = i / 48
      pts.push(`${(x * BOX).toFixed(2)},${((1 - plot(bezierY(value, x))) * BOX).toFixed(2)}`)
    }
    return 'M' + pts.join(' L')
  }, [value, lo, hi])

  const move = (e: ReactPointerEvent) => {
    if (held == null || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    /* BOTH axes clamped to 0..1. X because CSS requires it -- a cubic-bezier() with an x
       outside that range is invalid and the whole declaration is dropped.
       Y because this is a RAMP editor, not an easing editor. CSS does allow y to
       overshoot, and for a transition that overshoot is a bounce worth having; here it
       is a curve the output cannot honour. Every emitter guards its own ends, so a value
       past the endpoint is silently flattened -- scrim() emitted `var(--bg) 0%,
       var(--bg) 24.06%`, two identical stops and one wasted, while the editor drew a
       confident excursion; channelBlend() clamps at the byte. A control that draws a
       shape its output does not produce is worse than one that cannot draw it.
       It also keeps the handle inside its own field, which is how this was noticed. */
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    /* Back out of the plot's axis into the curve's own. On a compressed range (a channel
       that barely moves) a pixel of pointer travel is many units of curve, which is
       correct: the curve is the only thing being edited, and the plot is just where it
       is shown. A channel that does not move at all cannot be edited by definition --
       hi === lo makes this a division by zero, so it is guarded and the drag is ignored. */
    const span = hi - lo
    if (Math.abs(span) < 1e-6) return
    const plotY = 1 - (e.clientY - r.top) / r.height
    const ny = Math.min(1, Math.max(0, (plotY - lo) / span))
    onChange((held === 0 ? [+nx.toFixed(3), +ny.toFixed(3), x2, y2] : [x1, y1, +nx.toFixed(3), +ny.toFixed(3)]) as Bezier)
  }

  const grab = (i: 0 | 1) => (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId)
    setHeld(i)
  }

  const cy = (y: number) => (1 - plot(y)) * BOX
  const stops = marks && marks >= 2 ? Array.from({ length: marks }, (_, i) => i / (marks - 1)) : []

  return (
    <svg
      ref={svgRef} className={`grad-curve${locked ? ' locked' : ''}`}
      viewBox={`${-HANDLE - 2} ${-HANDLE - 2} ${BOX + 2 * HANDLE + 4} ${BOX + 2 * HANDLE + 4}`}
      aria-disabled={locked || undefined}
      onPointerMove={locked ? undefined : move}
      onPointerUp={locked ? undefined : () => setHeld(null)}
      onPointerCancel={locked ? undefined : () => setHeld(null)}
    >
      <rect className="grad-curve-field" x="0" y="0" width={BOX} height={BOX} rx="3" />
      {/* The straight line the curve is being pulled off — without it there is nothing
          on screen saying what "eased" is eased against. Locked, the curve IS that line,
          so a second one under it is just a doubled stroke. */}
      {!locked && <line className="grad-curve-linear" x1="0" y1={cy(0)} x2={BOX} y2={cy(1)} />}
      {!locked && <line className="grad-curve-arm" x1="0" y1={cy(0)} x2={x1 * BOX} y2={cy(y1)} />}
      {!locked && <line className="grad-curve-arm" x1={BOX} y1={cy(1)} x2={x2 * BOX} y2={cy(y2)} />}
      <path className="grad-curve-path" d={d} />
      {stops.map(s => {
        const [px, py] = [s, bezierY(value, s)]
        return <circle key={s} className="grad-curve-mark" cx={px * BOX} cy={cy(py)} r="2" />
      })}
      {!locked && ([[x1, y1, 0], [x2, y2, 1]] as const).map(([hx, hy, i]) => (
        <circle
          key={i} className={`grad-curve-handle${held === i ? ' held' : ''}`}
          cx={hx * BOX} cy={cy(hy)} r={HANDLE}
          onPointerDown={grab(i as 0 | 1)}
        />
      ))}
    </svg>
  )
}

/* ── ChannelCurves ────────────────────────────────────────────────────────────────── */

/* Their tool's middle third: one graph per channel, side by side, over a shared sample
   count. The graphs are the SAME CurveEditor as the single-curve mode -- there is one
   curve widget in this package, and three of it is what a channel view is. */
export function ChannelCurves({ space, value, onChange, stops, from, to }: {
  space: ChannelSpace
  value: [Ease?, Ease?, Ease?]
  onChange: (e: [Ease?, Ease?, Ease?]) => void
  stops: number
  /** The ramp's endpoints, so a channel that cannot move can say so. */
  from: string
  to: string
}) {
  const names = CHANNEL_NAMES[space]

  /* THE PLOT SAYS IT, SO NOTHING ELSE HAS TO. A channel whose ends are equal cannot be
     steered -- v = A + (B - A) * f, and with A === B every curve is the same level line.
     Drawn on the channel's real endpoints that IS a level line, which is the whole
     message; a badge reading "flat" beside it was a second copy of one fact, added
     because the drawing was normalised and could not carry it. The drawing carries it
     now, so the badge is gone and the endpoints drive everything. */
  /* Each channel's endpoints on its OWN axis, normalised to the plot's 0..1 so the graph
     can show R falling, G level and B rising -- the three lines Mass Driver draws, rather
     than three identical diagonals. */
  const ranges = useMemo(() => {
    const full: Triple = space === 'hsl' ? [360, 100, 100] : [255, 255, 255]
    try {
      const A = channelTriple(from, space)
      const B = channelTriple(to, space)
      return [0, 1, 2].map(i => [A[i] / full[i], B[i] / full[i]] as [number, number])
    } catch {
      return [[0, 1], [0, 1], [0, 1]] as [number, number][]
    }
  }, [from, to, space])

  /* Endpoint-derived, and it governs AFFORDANCE only: whether the editor offers handles.
     Not a label, not a tint. */
  const locked = ranges.map(([a, b]) => Math.abs(a - b) < 1 / 512) as [boolean, boolean, boolean]
  return (
    <div className="grad-channels">
      {[0, 1, 2].map(i => {
        /* An untouched channel is `undefined`, not EASES.linear, because the two are not
           the same fact: one says "nobody has steered this", the other says "somebody
           chose a straight line". The reset below restores the first. */
        const curve = value[i] ?? EASES.linear
        const touched = value[i] != null
        return (
          <div className="grad-channel" key={i}>
            <div className="grad-channel-head">
              <span className={`grad-channel-name ch-${i}`}>{names[i]}</span>
              {/* Only when there is something to undo. A word for "linear" was redundant
                  with a straight line and a word for "flat" was redundant with a level
                  one -- both were describing a picture sitting directly underneath. */}
              {touched && !locked[i] && (
                <button
                  className="grad-channel-reset"
                  onClick={() => { const n = [...value] as [Ease?, Ease?, Ease?]; n[i] = undefined; onChange(n) }}
                >reset</button>
              )}
            </div>
            <CurveEditor
              value={resolveEase(curve)}
              marks={stops}
              range={ranges[i]}
              locked={locked[i]}
              onChange={b => { const n = [...value] as [Ease?, Ease?, Ease?]; n[i] = b; onChange(n) }}
            />
          </div>
        )
      })}
    </div>
  )
}

/* ── GradientControls ─────────────────────────────────────────────────────────────── */

export type GradientKind = 'scrim' | 'blend' | 'blur' | 'channels'

export interface GradientSpec {
  kind: GradientKind
  ease: Bezier
  /** Stops for scrim/blend. Ignored by blur, which has bands. */
  stops: number
  /** Direction, in CSS gradient degrees: 0 is to top, 180 to bottom. */
  angle: number
  /** Scrim: the colour that fades. Blend: the colour it starts at. */
  from: string
  /** Blend only: the colour it ends at. */
  to: string
  space: Space
  radius: number
  layers: number
  /** Emit the scrim as `mask-image` rather than `background-image` — the ramp takes the
   *  content away instead of painting over it. See maskRamp() on why that is usually
   *  the one you want. */
  asMask: boolean
  /** kind 'blur': how much of the leading edge stays untouched, as a fraction. Over text
   *  the useful ramp starts after the first line — the smallest stop in the stack still
   *  lands inside its ascenders otherwise. The engine also takes a CSS length here
   *  (`'1lh'`), which a call site should prefer; a slider cannot offer one. */
  hold: number
  /** kind 'channels': which three channels are being steered. */
  chSpace: ChannelSpace
  /** kind 'channels': a curve per channel. `undefined` is linear, which is what their
   *  graphs show before anything is dragged. */
  chEase: [Ease?, Ease?, Ease?]
}

export const GRADIENT_DEFAULTS: GradientSpec = {
  kind: 'scrim', ease: EASES.clothoid, stops: 8, angle: 180,
  from: 'var(--bg)', to: 'var(--accent)', space: 'oklab',
  radius: 24, layers: 6, asMask: false, hold: 0,
  chSpace: 'srgb', chEase: [undefined, undefined, undefined],
}

/** The spec as the declaration it stands for — the single place that decides what a spec
 *  means, so the preview and the copy button can never disagree about it. Blur has no
 *  declaration (it is DOM); it reports the layer count instead. */
export function gradientCss(s: GradientSpec): { prop: string; value: string } | null {
  const dir = `${s.angle}deg`
  const o = { ease: s.ease, stops: s.stops, dir }
  if (s.kind === 'blur') return null
  if (s.kind === 'channels')
    return { prop: 'background-image',
             value: channelBlend(s.from, s.to, { space: s.chSpace, ease: s.chEase, stops: s.stops, dir }) }
  if (s.kind === 'blend') return { prop: 'background-image', value: blend(s.from, s.to, { ...o, space: s.space }) }
  return s.asMask
    ? { prop: 'mask-image', value: maskRamp(o) }
    : { prop: 'background-image', value: scrim(s.from, o) }
}

/* THE RIGHT CURVE DEPENDS ON WHAT THE CURVE DRIVES. A scrim wants the clothoid, which
   rises fast so the fade begins imperceptibly. A blur wants the opposite: text stops being
   legible around 4px, so a front-loaded ramp is spent before the eye has gone a third of
   the way. blurLayers() already defaults to ease-in for that reason -- but the spec carries
   ONE `ease`, so switching to Blur handed it the clothoid and overrode that default. The
   panel looked like the effect was broken when it was being told to do the wrong thing. */
const KIND_EASE: Record<GradientKind, Bezier> = {
  scrim: EASES.clothoid, blend: EASES.clothoid, channels: EASES.clothoid,
  blur: EASES['ease-in-out'],
}

/* Swap the curve on a kind change ONLY if it is still the outgoing kind's default -- a
   curve someone has dragged is theirs and survives the switch. */
const easeForKind = (from: GradientKind, to: GradientKind, ease: Bezier): Bezier =>
  KIND_EASE[from].every((v, i) => v === ease[i]) ? KIND_EASE[to] : ease

const KINDS: { k: GradientKind; label: string }[] = [
  { k: 'scrim', label: 'Scrim' }, { k: 'blend', label: 'Blend' },
  { k: 'blur', label: 'Blur' }, { k: 'channels', label: 'Channels' },
]
const SPACES: Space[] = ['oklab', 'oklch', 'srgb', 'hsl']
/* Short enough that five of them fit one rail. `clothoid` earns the odd abbreviation:
   it is the only preset here that is not a CSS keyword, and the only one worth naming
   in full anywhere else. */
const PRESET_LABEL: Record<EaseName, string> = {
  linear: 'linear', clothoid: 'cloth', 'ease-in': 'in', 'ease-out': 'out', 'ease-in-out': 'in-out',
}
/* The tokens a ramp is actually built from here. A free field is still there for anything
   else; this is so the common case is not typing `var(--surface-hi)` from memory. */
const TOKENS = ['var(--bg)', 'var(--surface)', 'var(--surface-hi)', 'var(--text)', 'var(--accent)']

export interface GradientControlsProps {
  value: GradientSpec
  onChange: (s: GradientSpec) => void
  /** Hide the preview when the host is already showing the ramp on something real —
   *  a proofer's own column is a better preview than a swatch. */
  preview?: boolean
}

export function GradientControls({ value, onChange, preview = true }: GradientControlsProps) {
  const set = (patch: Partial<GradientSpec>) => onChange({ ...value, ...patch })
  const [copied, setCopied] = useState(false)
  const css = gradientCss(value)
  const isBlur = value.kind === 'blur'
  const isChannels = value.kind === 'channels'

  /* Which preset, if any, the four numbers currently ARE. Derived rather than stored:
     dragging a handle off `clothoid` has to stop saying clothoid, and a spec that
     remembers a name it no longer matches is the bug that makes a preset row untrustworthy. */
  const presetName = (Object.keys(EASES) as EaseName[])
    .find(n => (EASES[n] as Bezier).every((v, i) => v === value.ease[i]))

  const copy = async () => {
    if (!css) return
    await navigator.clipboard.writeText(declaration(css.prop, css.value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="grad-controls">
      <div className="ui-seg grad-kinds">
        {KINDS.map(({ k, label }) => (
          <button key={k} className={value.kind === k ? 'active' : ''} aria-pressed={value.kind === k}
            onClick={() => set({ kind: k, ease: easeForKind(value.kind, k, value.ease) })}>{label}</button>
        ))}
      </div>

      {preview && <GradientPreview spec={value} />}

      {/* THE CURVE. One editor for all three kinds, because it is one curve for all three
          kinds -- alpha, colour and blur radius are what it is applied to, not what it is. */}
      {isChannels ? (
        <>
          <ChannelCurves space={value.chSpace} value={value.chEase} stops={value.stops}
            from={value.from} to={value.to} onChange={chEase => set({ chEase })} />
          <div className="grad-row">
            <span className="grad-row-label">channels</span>
            <div className="ui-seg">
              {(['srgb', 'hsl'] as ChannelSpace[]).map(sp => (
                <button key={sp} className={value.chSpace === sp ? 'active' : ''} aria-pressed={value.chSpace === sp}
                  /* The curves are indices into whatever space is showing, so switching
                     space with a channel steered would silently re-point that curve at a
                     different quantity. Clearing is the honest move. */
                  onClick={() => set({ chSpace: sp, chEase: [undefined, undefined, undefined] })}>{sp}</button>
              ))}
            </div>
          </div>
        </>
      ) : (
      <>
      <div className="grad-curve-row">
        <CurveEditor value={value.ease} onChange={ease => set({ ease })} marks={isBlur ? value.layers : value.stops} />
      </div>
      <div className="ui-seg grad-presets">
        {(Object.keys(EASES) as EaseName[]).map(n => (
          <button key={n} className={presetName === n ? 'active' : ''} aria-pressed={presetName === n}
            onClick={() => set({ ease: EASES[n] as Bezier })}>{PRESET_LABEL[n]}</button>
        ))}
      </div>
      <code className="grad-readout">cubic-bezier({value.ease.join(', ')})</code>
      </>
      )}

      {!isBlur && (
        <>
          <AxisSlider label={isChannels ? 'samples' : 'stops'} value={value.stops} min={2} max={16} step={1}
            onChange={n => set({ stops: n as number })} />
          <TokenField label={value.kind === 'blend' ? 'from' : 'colour'} value={value.from}
            onChange={from => set({ from })} />
        </>
      )}
      {(value.kind === 'blend' || isChannels) && (
        <>
          <TokenField label="to" value={value.to} onChange={to => set({ to })} />
          {value.kind === 'blend' && <div className="grad-row">
            <span className="grad-row-label">space</span>
            <div className="ui-seg">
              {SPACES.map(s => (
                <button key={s} className={value.space === s ? 'active' : ''} aria-pressed={value.space === s}
                  onClick={() => set({ space: s })}>{s}</button>
              ))}
            </div>
          </div>}
        </>
      )}
      {value.kind === 'scrim' && (
        <button className={`grad-switch${value.asMask ? ' active' : ''}`} aria-pressed={value.asMask}
          onClick={() => set({ asMask: !value.asMask })}>
          <span>as mask</span>
          <span className="grad-switch-state">{value.asMask ? 'mask-image' : 'background'}</span>
        </button>
      )}
      {isBlur && (
        <>
          <AxisSlider label="radius" value={value.radius} min={2} max={80} step={1} suffix="px"
            onChange={n => set({ radius: n as number })} />
          {/* Capped at 10: past that the layers cost more than they smooth and each one
              is another backdrop rasterisation. */}
          <AxisSlider label="layers" value={value.layers} min={2} max={10} step={1}
            onChange={n => set({ layers: n as number })} />
          {/* Capped at 50%: past half the box the ramp has too little room left to be a
              ramp. A call site wanting "exactly one line" passes '1lh' to the engine. */}
          <AxisSlider label="hold" value={Math.round(value.hold * 100)} min={0} max={50} step={1}
            suffix="%" onChange={n => set({ hold: (n as number) / 100 })} />
        </>
      )}

      <AxisSlider label="angle" value={value.angle} min={0} max={360} step={15} suffix="°"
        onChange={n => set({ angle: n as number })} />

      {css && (
        <button className="grad-copy" onClick={copy}>{copied ? 'copied' : `copy ${css.prop}`}</button>
      )}
    </div>
  )
}

/* A colour as a token name, with the swatch beside it resolving it. The swatch is a
   div with the value as its background, so the browser resolves the custom property --
   the same reason gradient.ts mixes in CSS. Reading it back in JS is what turned the
   colophon wordmark dark red (color.css). */
function TokenField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `grad-tok-${label}`
  return (
    <div className="grad-row">
      <span className="grad-row-label">{label}</span>
      <span className="grad-swatch" style={{ background: value }} />
      <input className="grad-token" list={id} value={value} spellCheck={false}
        onChange={e => onChange(e.target.value)} />
      <datalist id={id}>{TOKENS.map(t => <option key={t} value={t} />)}</datalist>
    </div>
  )
}

/* ── GradientPreview ──────────────────────────────────────────────────────────────── */

/** The ramp over something with an edge in it. Type, not a swatch: a scrim over flat
 *  colour looks perfect at any curve, and the banding these curves exist to remove is
 *  only visible over content. The lines are the reason the preview is worth the space. */
export function GradientPreview({ spec }: { spec: GradientSpec }) {
  const css = gradientCss(spec)
  const ramp: CSSProperties | undefined = css
    ? (css.prop === 'mask-image'
        ? { maskImage: css.value, WebkitMaskImage: css.value }
        : { backgroundImage: css.value })
    : undefined

  return (
    <div className="grad-preview">
      <div className="grad-preview-body" style={css?.prop === 'mask-image' ? ramp : undefined}>
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="grad-preview-line" />)}
      </div>
      {css?.prop === 'background-image' && <div className="grad-preview-ramp" style={ramp} />}
      {spec.kind === 'blur' && (
        <ProgressiveBlur radius={spec.radius} layers={spec.layers} ease={spec.ease} dir={`${spec.angle}deg`} />
      )}
    </div>
  )
}
