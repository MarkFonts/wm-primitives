/* gradient.ts — the shape of a ramp, and the three things a ramp can carry.
 *
 * WHY THIS FILE EXISTS
 * The package already ramps in three places, and spells it three ways. Specimen.css has
 * six hand-picked stops approximating alpha ≈ t², with a comment explaining that a
 * straight two-stop fade "puts a visible edge where the fade starts and then crawls".
 * UiKitBoard.jsx builds its top mask inline as exactly that two-stop fade -- the edge
 * the other file wrote a paragraph about. icon.css and AxisSlider.css ramp too, but
 * those are fills (a stop AT a value), not fades, and are none of this file's business.
 *
 * So: one fade, two spellings, one of them the bug the other one documents. Same shape
 * as --dur-fast before motion.css, and it gets the same treatment -- an engine with the
 * number in it, not a convention everyone re-derives.
 *
 * ONE MECHANISM: CUBIC-BÉZIER CONTROL POINTS
 * The four references this was built from look like four techniques and are one.
 *   · Lukas Hermann's and Takehiko Ono's "clothoid gradient" pens ease the ALPHA so a
 *     scrim has no visible start edge.
 *   · Mass Driver's gradient resampler eases the COLOUR by letting you drag control
 *     points into the interpolation and then sampling the result to plain CSS stops.
 *   · variablur eases the BLUR RADIUS across a view, with named curves or a cubic Bézier.
 * Three channels, one curve. The curve is a cubic Bézier in every case, so this file has
 * one sampler and three emitters rather than three engines.
 *
 * THE CLOTHOID IS A BÉZIER, and that is measured, not assumed. Fitting cubic-bezier to
 * the pen's seven hand-written stops lands on (0.416, 0.657, 0.695, 1) with an RMS error
 * of 0.00065 in alpha and a worst case of 0.0013 -- a third of one step in 8-bit. The
 * pens' curve does not need its own code path; it is a preset of this one.
 *
 * SAMPLING IS BY CURVE PARAMETER, NOT BY POSITION. Walking s from 0 to 1 and taking the
 * Bézier's (x, y) puts the stops where the curve bends, which is why the pens' own stops
 * crowd toward the transparent end (50, 65, 75.5, 82.85, 88) instead of sitting at equal
 * intervals. Sampling y at equal x would give the same curve with the stops in the wrong
 * places -- smooth where nothing happens, faceted where everything does.
 *
 * NO COLOUR PARSING. Every emitter hands the mixing to CSS via color-mix(), so a ramp can
 * be built from var(--bg) without this file ever learning what --bg resolves to. See
 * color.css: the tokens compute to oklch(), a regex sweep reads L, C, H as R, G, B, and
 * that is how the colophon wordmark turned dark red. The engine that must not be second-
 * guessed here is the browser's.
 */

/** A CSS cubic-bezier()'s four numbers: the two control points, with P0 (0,0) and
 *  P3 (1,1) implied. Same tuple CSS takes, so a curve can be handed straight to a
 *  transition if a consumer wants the motion to match the ink. */
export type Bezier = readonly [number, number, number, number]

/** The curve presets. `clothoid` is the fitted pen (see above); the other four are the
 *  CSS keywords' own control points, so `ease-in` here and `ease-in` in a transition are
 *  the same curve rather than two things with one name. */
export const EASES = {
  linear:        [0, 0, 1, 1],
  clothoid:      [0.416, 0.657, 0.695, 1],
  'ease-in':     [0.42, 0, 1, 1],
  'ease-out':    [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
} as const satisfies Record<string, Bezier>

export type EaseName = keyof typeof EASES

/** Either a preset's name or four raw numbers — the controls drag the numbers, the call
 *  sites name the preset, and nothing has to convert between them. */
export type Ease = EaseName | Bezier

export const resolveEase = (e: Ease = 'clothoid'): Bezier =>
  typeof e === 'string' ? EASES[e] : e

/* One axis of a cubic Bézier with the ends pinned at 0 and 1, expanded to a polynomial
   so a point costs three multiplies. c1/c2 are that axis's two control values. */
const axis = (c1: number, c2: number, s: number) =>
  ((((1 - 3 * c2 + 3 * c1) * s) + (3 * c2 - 6 * c1)) * s + 3 * c1) * s

/** The curve at parameter `s` (0..1) as [x, y] — position along the ramp, and how far
 *  the ramp has travelled there. */
export function bezierPoint(e: Ease, s: number): [number, number] {
  const [x1, y1, x2, y2] = resolveEase(e)
  return [axis(x1, x2, s), axis(y1, y2, s)]
}

/** The curve's y at a given x, by bisection. Not used to build ramps (those sample by
 *  parameter); it is what a curve EDITOR draws with, where x is a pixel column. */
export function bezierY(e: Ease, x: number): number {
  const [x1, y1, x2, y2] = resolveEase(e)
  let lo = 0, hi = 1, s = x
  for (let i = 0; i < 24; i++) {          // 24 halvings ≈ 6e-8, well under a pixel
    if (axis(x1, x2, s) < x) lo = s; else hi = s
    s = (lo + hi) / 2
  }
  return axis(y1, y2, s)
}

export interface RampOptions {
  /** The curve. Default `clothoid` — the whole point of the file is that `linear` is
   *  the wrong default for a fade, and a default nobody passes is the one that ships. */
  ease?: Ease
  /** How many stops. Eight is where the banding stops being visible on a 13rem fade at
   *  the pens' curve; below five the facets show, above twelve nothing changes and the
   *  declaration just gets longer. */
  stops?: number
  /** Any CSS gradient direction: 'to bottom' (default), 'to right', '135deg'. */
  dir?: string
  /** Where the ramp starts and ends, in the channel's own units — alpha 0..1 for a
   *  scrim or mask, px for a blur. Default is a full 1 → 0 fade. */
  from?: number
  to?: number
  /** Emit stop positions as a fraction of this CSS length instead of as percentages —
   *  `calc(0.1704 * 48px)` rather than `17.04%`.
   *
   *  It exists because a ramp is sometimes measured against something that is not its
   *  own box. UiKitBoard's top mask has to end EXACTLY at the inset the app's floating
   *  chrome occupies: a percentage of the strip is a different number every time the
   *  strip resizes, and a span longer than the inset leaves the ramp still resolving
   *  over content that has nothing above it — a permafade, which its comment calls out
   *  as a real bug rather than a tuning problem. */
  span?: string
}

/** A stop: `at` is its position along the ramp (0..1), `v` the channel value there. */
export interface Stop { at: number; v: number }

/* How a position is spelled. The ends are written plainly rather than as calc(0 * 48px)
   and calc(1 * 48px), which are correct and unreadable in a stylesheet nobody wrote. */
const posIn = (span?: string) => (at: number): string =>
  span == null ? `${pct(at)}%`
    : at <= 0 ? '0'
    : at >= 1 ? span
    : `calc(${amt(at)} * ${span})`

/* Float dust, shed on the way out rather than at every call site: 0.1 + 0.2 in a
   percentage prints as 30.000000000000004 and ships that way into a stylesheet. */
const pct = (n: number) => +(n * 100).toFixed(2)
const amt = (n: number) => +n.toFixed(4)

/** The curve, sampled into stops. The emitters below all start here; export it because a
 *  consumer that renders its own stops (an SVG gradient, a canvas) needs the numbers and
 *  not a CSS string. */
export function rampStops(o: RampOptions = {}): Stop[] {
  const { ease = 'clothoid', stops = 8, from = 1, to = 0 } = o
  const n = Math.max(2, Math.round(stops))
  const out: Stop[] = []
  for (let i = 0; i < n; i++) {
    const [x, y] = bezierPoint(ease, i / (n - 1))
    out.push({ at: amt(x), v: amt(from + (to - from) * y) })
  }
  return out
}

/** A scrim: one colour ramped in ALPHA, for laying over content that continues past it.
 *  `color` is any CSS colour and may be a custom property, because the mixing happens in
 *  CSS: `color-mix(in srgb, var(--bg) 22%, transparent)` is the same idiom Specimen.css
 *  already writes by hand.
 *
 *  srgb, deliberately, and only here. Mixing toward `transparent` in a perceptual space
 *  carries the colour toward that space's zero as the alpha falls, so a scrim in oklab
 *  greys out before it disappears. The colour is not changing in a scrim; only how much
 *  of it there is. `blend()` below, where the colour IS changing, defaults to oklab. */
export function scrim(color: string, o: RampOptions = {}): string {
  const { dir = 'to bottom' } = o
  const pos = posIn(o.span)
  const parts = rampStops(o).map(({ at, v }) =>
    `${v <= 0 ? 'transparent' : v >= 1 ? color : `color-mix(in srgb, ${color} ${pct(v)}%, transparent)`} ${pos(at)}`)
  return `linear-gradient(${dir}, ${parts.join(', ')})`
}

/** The same ramp as an alpha channel only, for `mask-image` — where the fade should take
 *  the content away rather than paint over it. Black is opaque in a mask, so the ramp
 *  runs in black's alpha and the colour is irrelevant.
 *
 *  A TRADE, not a better option. Over a photograph, a video or another gradient this is
 *  the only correct answer: a scrim can only fade toward ONE colour, and over a varied
 *  ground the fade's own colour reads as a wash. UiKitBoard's comment gets there from
 *  the other end -- "real transparency, not a dark tint".
 *
 *  What it costs is the engine's own dithering. Skia dithers a background gradient and
 *  very nearly does not dither a mask; the same ramp, measured, carries a per-pixel
 *  deviation of 2.98 as `background-image` against 0.22 as `mask-image`, and the mask's
 *  longest flat terrace is 13px against 6px. So a mask over a FLAT ground bands where
 *  the identical scrim does not, and it is banding you then have to fix by hand.
 *
 *  Over a flat ground, reach for scrim(). Reach for this when the ground is not flat,
 *  and add `.wm-dither` (gradient.css) if the result bands. */
export function maskRamp(o: RampOptions = {}): string {
  const { dir = 'to bottom' } = o
  const pos = posIn(o.span)
  const parts = rampStops(o).map(({ at, v }) => `rgb(0 0 0 / ${amt(v)}) ${pos(at)}`)
  return `linear-gradient(${dir}, ${parts.join(', ')})`
}

/** Interpolation space for `blend()`.
 *
 *  oklab is the default because its ramp is perceptually even in LIGHTNESS: srgb's
 *  midpoint sits too dark, and oklab's does not. Red -> green, measured at the midpoint:
 *  luma 101 in srgb against 111 in oklab.
 *
 *  WHAT OKLAB DOES NOT DO is save two complementary colours from going grey in the
 *  middle, and it is widely claimed to. Blue -> yellow, midpoint saturation: srgb 12%,
 *  oklab 14%. Both are mud. A straight line between opposite hues passes through the
 *  neutral axis whatever rectangular space it is drawn in, because that is where the
 *  axis is.
 *
 *  oklch is the one that keeps the chroma up, by interpolating hue as an ANGLE and
 *  going around rather than through -- blue -> yellow holds 63% saturation. The cost is
 *  a hue nobody picked: that ramp passes through magenta. Choose it when chroma matters
 *  more than the path, not as a general upgrade.
 *
 *  srgb and hsl are here to REPRODUCE a ramp somebody already shipped, not to choose. */
export type Space = 'oklab' | 'oklch' | 'srgb' | 'hsl' | 'lab' | 'display-p3'

/** Two colours, interpolated along the curve, in `space` (see Space above -- oklab for
 *  even lightness, oklch when the middle must stay saturated). This is Mass Driver's
 *  resampler: rather
 *  than let the browser run a straight line through the curve, put control points on
 *  it and sample the result to ordinary stops -- which means the output works anywhere,
 *  including engines with no interpolation hints at all.
 *
 *  `linear` here is not a no-op: even at linear the colours are mixed in `space`, which
 *  is the difference between a two-stop declaration and this one. */
export function blend(from: string, to: string, o: RampOptions & { space?: Space } = {}): string {
  const { dir = 'to bottom', space = 'oklab' } = o
  const pos = posIn(o.span)
  const parts = rampStops({ ...o, from: 0, to: 1 }).map(({ at, v }) =>
    `${v <= 0 ? from : v >= 1 ? to : `color-mix(in ${space}, ${from} ${pct(1 - v)}%, ${to})`} ${pos(at)}`)
  return `linear-gradient(${dir}, ${parts.join(', ')})`
}

export interface BlurLayer {
  backdropFilter: string
  WebkitBackdropFilter: string
  /** The band's own box, as an `inset` shorthand. This is GEOMETRY, not a mask, and the
   *  distinction is the whole reason this function was rewritten -- see below. */
  inset: string
}

export interface BlurOptions extends Omit<RampOptions, 'from' | 'to' | 'stops' | 'span'> {
  /** Blur radius at the far end of the ramp, in px. Default 24. */
  radius?: number
  /** How many stacked layers. Six is enough that the steps are invisible at 24px and
   *  cheap enough to sit under a scrolling list; each layer is a separate backdrop
   *  rasterisation, so this is the expensive number, not `stops`. */
  layers?: number
  /** Redeclared ONLY to correct the default. RampOptions says `clothoid`, and inheriting
   *  that here would be wrong -- see blurLayers() below for why, and for the numbers. */
  ease?: Ease
  /** Where the ramp BEGINS, measured from the leading edge. Everything before it is left
   *  alone. A number is a fraction of the element; a string is any CSS length, and `lh`
   *  is the one worth knowing: `start: '1lh'` holds the first line and ramps from there.
   *
   *  It exists because over TEXT the useful ramp does not start at the element's edge.
   *  The smallest stop in a 24px stack is still 1.35px, and 1.35px at 0% lands inside the
   *  first line's ascenders -- so the line the reader anchors on is already damaged before
   *  the gradation has done anything. Over a colour field there is no anchor and every
   *  part of the ramp is legitimate, which is why this defaults to 0 rather than to a line.
   *
   *  TWO THINGS TO KNOW ABOUT `lh` HERE. It resolves against the line-height of the STACK
   *  element, which inherits from its parent and need not match the paragraphs it covers
   *  (measured: 20.3px against the text's 21.75px in one ordinary case). And it is measured
   *  from the element's edge, so padding counts -- `calc(12px + 1lh)` is what "after one
   *  line" means inside a box with 12px of padding. Pass an explicit length when it has to
   *  be exact. */
  start?: number | string
}

/** Progressive blur — variablur's effect, as a stack of masked backdrop layers, because
 *  the web has no way to vary one filter's strength across an element.
 *
 *  TILED BANDS, NOT CUMULATIVE ONES, and this is the whole design. The obvious
 *  construction is to have each layer reveal everything from its band onward and add a
 *  little more blur, so the strengths accumulate. It composes beautifully on paper and
 *  GHOSTS on screen: `backdrop-filter` blurs what is BEHIND the layer, and wherever that
 *  layer's mask sits at partial alpha the compositor blends a blurred copy over the still
 *  sharp original. Over live text that is a visible double image -- two copies of the same
 *  line, one crisp and one smeared, through the whole run-in. It was shipped that way and
 *  spotted by eye, not by any measurement here; the sharpness profile is monotonic either
 *  way, because the artefact is a superposition, not a failure to blur.
 *
 *  So each layer instead owns ONE band at full opacity, feathered into its neighbours, and
 *  carries the absolute radius that band should read at. Every pixel is covered by exactly
 *  one layer at full strength, and the crossfades are between adjacent, similar radii
 *  rather than between sharp and fully blurred. The end bands do not feather off the edge:
 *  the first has nothing above it to hand over to and the last nothing below, and a
 *  feather there leaves a strip no layer covers.
 *
 *  THE QUADRATURE IS GONE WITH IT. It existed to make accumulating layers land on the
 *  radius asked for -- sigma^2 = sigma1^2 + sigma2^2, so a band reading 12px over 9px took
 *  a 7.9px step. Tiled layers do not accumulate: each blurs the original content, so it
 *  simply carries the radius its band should have. Correct arithmetic for a construction
 *  that turned out to be the wrong one.
 *
 *  BANDS ARE EVENLY SPACED; ONLY THE RADIUS FOLLOWS THE CURVE. Placing the bands by curve
 *  parameter too -- which the first version did -- means `ease-in` crowds them into the
 *  last 5% of the span and `linear` (cubic-bezier(0,0,1,1), whose parameter sweep is
 *  smoothstep) bunches them at both ends. Position and strength are two different
 *  questions and the curve answers only the second.
 *
 *  EASE-IN-OUT, NOT THE CLOTHOID, AND THIS IS THE ONE PLACE THE HOUSE DEFAULT IS WRONG.
 *  A blur wants BOTH ends eased, for two different reasons. Hold the start, because text
 *  stops being legible around 4px and a ramp that spends that in its first band has thrown
 *  the effect away before the eye has moved -- the clothoid, fitted to an alpha scrim where
 *  the fade must BEGIN imperceptibly, puts 6.16px on the top band of a 24px stack, and
 *  plain `linear` puts 4px. Then ease INTO the maximum, so the blur arrives rather than
 *  hitting a ceiling; that is the clothoid's own argument about visible edges, applied at
 *  the other end. First-layer radius at 24px over six layers:
 *
 *      ease-in-out   1.35   5.56  12.00  18.44  22.65  24
 *      ease-in       1.07   3.75   7.57  12.28  17.75  24
 *      linear        4.00   8.00  12.00  16.00  20.00  24
 *      clothoid      6.16  11.86  16.83  20.71  23.17  24
 *
 *  ease-in holds the start as well but climbs to the ceiling without easing into it.
 *  Both are usable; in-out is the one that reads as a gradation at both ends.
 *
 *  KEEP THE RADIUS WELL UNDER THE SPAN IT RAMPS ACROSS -- a rough ceiling is a tenth.
 *  A blur samples a neighbourhood `radius` wide, and at the element's edge there is no
 *  neighbourhood: the compositor clamps and smears the edge pixels instead. At 28px in an
 *  86px box that smear is a third of the height and the result is blotchy rather than
 *  soft. The same 28px across 240px is clean. This is a property of backdrop-filter, not
 *  of the stack, so no number here can fix it -- it is a sizing decision at the call site.
 *
 *  RAMP ACROSS THE TEXT, NOT ALONG IT. Blurring left-to-right over left-to-right prose
 *  dissolves every line mid-word, which looks like a bug; running it down the block takes
 *  whole lines at a time, which is the effect people mean. variablur's own list-edge
 *  example is vertical for this reason.
 *
 *  THE TEXT UNDERNEATH IS STILL LIVE, and that is a content decision, not a rendering one.
 *  This blurs pixels; it does not redact. The words stay in the DOM, so they are selectable,
 *  copyable, findable with the browser's own find, and read aloud in full by a screen
 *  reader, which sees no blur at all. Never use it to withhold anything -- a paywall, a
 *  spoiler, a password. For those, do not send the text.
 *
 *  IT DOES NOT REFLOW WITH THE CONTENT. The bands are fractions of the element, so the
 *  ramp lands wherever the box says and not on any particular line. A block that rewraps
 *  at a narrower width gets the same ramp over different words.
 *
 *  COST: one backdrop rasterisation per layer, per frame. Six is affordable under a
 *  scrolling list; it is still the expensive number here, and the one to cut first.
 *
 *  What it cannot do is blur a scrolling ancestor's overflow on iOS Safari, where a
 *  backdrop-filter inside a scroll container is sampled before the scroll offset is applied
 *  and the blur lags the content. Position it against the viewport instead.
 *
 *  Returns style objects, not a class: the layers are the consumer's to render, usually
 *  as absolutely-positioned siblings in a `pointer-events: none` wrapper. `ProgressiveBlur`
 *  in GradientControls.tsx does exactly that, and is the answer for anyone who does not
 *  want to. */
/* A feather, eased rather than straight, as a list of `black a% p%` stops.
 *
 * THE FEATHERS HAD THE BUG THIS FILE EXISTS TO FIX. A two-stop feather is a LINEAR alpha
 * ramp, so the blur profile it produces is piecewise linear and kinks at every band
 * boundary -- and a kink in the derivative is exactly the visible edge that scrim() spends
 * a paragraph on. It showed as a hard line across the second line of text. The window is
 * smoothstepped instead, which is C1 at both ends, so neighbouring bands hand over with no
 * corner for the eye to find. */
const SMOOTH = [0, 0.25, 0.5, 0.75, 1].map(t => ({ t, a: t * t * (3 - 2 * t) }))

const feather = (
  from: number, to: number, rising: boolean, at: (f: number) => string,
) => SMOOTH.map(({ t, a }) =>
  `rgb(0 0 0 / ${amt(rising ? a : 1 - a)}) ${at(from + (to - from) * t)}`)

export function blurLayers(o: BlurOptions = {}): BlurLayer[] {
  const { dir = 'to bottom', radius = 24, layers = 16, ease = 'ease-in-out', start = 0 } = o
  const n = Math.max(1, Math.round(layers))
  /* GEOMETRY, NOT MASKS. Every earlier version of this made each layer fill the element
     and cut it back to a band with mask-image. That is the technique everyone publishes,
     and in the assembled system page it does not hold: a single layer masked
     to the top 25% blurred the WHOLE panel, and six of them stacked took measured
     sharpness down the panel to a flat 0.1 against 8.7-16.8 with the stack removed. A
     uniform smear, which is the one thing a progressive blur must not be.
     The mask is ignored outright there -- mask-image, -webkit-mask-image, the shorthand,
     mask-mode: alpha and will-change: mask all render identically, and the same markup
     in a standalone page masks correctly. So it is a compositing-path difference, not a
     syntax error, and not something to depend on either way.
     How far that generalises was never established -- the trigger is unisolated and the
     computed styles match in both documents but for width -- so this is one page, not a
     law about the platform (NEXT.md D holds the open item). It does not need to be a
     law: geometry bounded the filter in
     both documents, a band positioned at top/height blurs its own rows and nothing else,
     and preferring it costs nothing but the feather below.

     The cost is the feather: a band's edge is now a step in radius rather than a fade,
     so the seam has to be hidden by making the step small instead of by blending it.
     That is what the layer count buys, and why the default moved from 6 to 16 -- at 12
     the bands read as horizontal strips, at 16 they do not, and at 32 it is no better.
     Each band is a separate backdrop rasterisation, so 16 is the number to lower first
     if a stack has to sit under a scrolling list. */
  const horizontal = /right|left|^(90|270)deg/.test(dir)
  const reverse = /to left|to top|270deg/.test(dir)
  /* Every edge is a fraction of the RAMP, which may not be the whole element. With a
     length offset that cannot be a percentage, so it is arithmetic CSS does at layout. */
  const edge = typeof start === 'string'
    ? (f: number) => `calc(${start} + (100% - ${start}) * ${amt(f)})`
    : (f: number) => `${pct(start + (1 - start) * f)}%`
  /* The far edge is stated as a distance from the far side, so a plain fraction stays a
     plain percentage instead of becoming calc(100% - 45%) for no reason. */
  const back = typeof start === 'string'
    ? (f: number) => `calc((100% - ${start}) * ${amt(1 - f)})`
    : (f: number) => `${pct((1 - start) * (1 - f))}%`
  const out: BlurLayer[] = []
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n
    /* The band's FAR edge, not its midpoint: sampling the middle means the last band
       reads at ease(1 - 1/2n) and the stack never reaches the radius that was asked
       for. At the far edge the final layer is exactly `radius`, which is the promise. */
    const r = radius * bezierY(ease, b)
    const near = edge(reverse ? 1 - b : a)
    const far = back(reverse ? 1 - a : b)
    /* inset: top right bottom left. Stating both edges rather than an extent keeps the
       bands exactly adjacent at any element size -- a height in percent rounds, and the
       gap it leaves is a bright hairline across blurred text. */
    const inset = horizontal ? `0 ${far} 0 ${near}` : `${near} 0 ${far} 0`
    const blur = `blur(${+r.toFixed(2)}px)`
    out.push({ backdropFilter: blur, WebkitBackdropFilter: blur, inset })
  }
  return out
}

/** The CSS a consumer would paste — what the controls' copy button hands over. `prop` is
 *  the declaration name, since the same ramp is `background-image` as a scrim and
 *  `mask-image` as a mask, and pasting the wrong one is silent. */
export function declaration(prop: string, value: string): string {
  /* Split on the gradient's OWN commas and no others. A regex cannot do this: the
     stops are color-mix(in srgb, X 22%, transparent), so "comma" matches three times
     per stop and the pasted rule is not CSS. Depth counting is the whole fix. */
  const open = value.indexOf('(')
  const head = value.slice(0, open + 1)
  const body = value.slice(open + 1, value.lastIndexOf(')'))
  const parts: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(body.slice(start).trim())
  return `${prop}:\n  ${head}\n    ${parts.join(',\n    ')}\n  );`
}

/* ── per-channel steering (Mass Driver's schema) ──────────────────────────────────────
 *
 * `blend()` above applies ONE curve to the interpolation parameter, so R, G and B are
 * remapped together: it re-spaces the stops ALONG a path and cannot change the path's
 * shape through colour space. Mass Driver's resampler gives each channel its own curve,
 * which moves the path itself -- bend G alone and the ramp leaves the line between its
 * endpoints entirely. Their tool draws exactly that: three graphs, R, G and B, each with
 * its own control points, over a shared sample count.
 *
 * THIS ONE HAS TO RESOLVE COLOURS, and that is the whole reason it is a separate
 * function. Steering a channel means knowing what the channel is, and no amount of
 * color-mix() will tell you -- the browser does the mixing precisely so this package
 * never has to look. So the invariant relaxes here, under the house rule that already
 * covers it (color.css): resolve through the ENGINE, never a regex. A 1x1 canvas, the
 * same way src/letterbox.js resolves colour, and for the same reason -- the tokens
 * compute to oklch(), and a number sweep reads L, C, H as R, G, B and paints 93.1% grey
 * as rgb(93, 0, 0).
 *
 * STOPS SIT AT EVEN POSITIONS, unlike rampStops(). Their curves are value-against-
 * POSITION, so x is where you are along the ramp and the sample count just decides how
 * many times it is read. Sampling by curve parameter here would be reading their graph
 * wrong. */

/** Three channel values, 0..255 for srgb or h 0..360 / s 0..100 / l 0..100 for hsl. */
export type Triple = [number, number, number]

/** The two spaces Mass Driver's tool offers. Not a general colour-space list: these are
 *  the ones whose channels are meaningful to steer by hand. */
export type ChannelSpace = 'srgb' | 'hsl'

export const CHANNEL_NAMES: Record<ChannelSpace, [string, string, string]> = {
  srgb: ['R', 'G', 'B'],
  hsl: ['H', 'S', 'L'],
}

/* sRGB <-> HSL, the textbook pair. Written out rather than pulled in, because the whole
   dependency footprint of this file is otherwise nothing. */
export function rgbToHsl([r, g, b]: Triple): Triple {
  const R = r / 255, G = g / 255, B = b / 255
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn
  const l = (mx + mn) / 2
  if (d === 0) return [0, 0, l * 100]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = mx === R ? 60 * (((G - B) / d) % 6)
    : mx === G ? 60 * ((B - R) / d + 2)
    : 60 * ((R - G) / d + 4)
  return [(h + 360) % 360, s * 100, l * 100]
}

function hslToRgb([h, s, l]: Triple): Triple {
  const S = s / 100, L = l / 100
  const c = (1 - Math.abs(2 * L - 1)) * S
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const m = L - c / 2
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/** Any CSS colour as sRGB bytes, resolved by the browser. Pass a Triple to skip it --
 *  which is how this file stays testable outside a browser, and how a caller that has
 *  already resolved a token avoids paying for it twice. */
export function resolveRGB(c: string | Triple): Triple {
  if (Array.isArray(c)) return c
  if (typeof document === 'undefined')
    throw new Error('resolveRGB needs a document; pass an [r, g, b] triple instead')
  /* TWO HOPS, and the first one is not optional. A canvas fillStyle is parsed by the
     canvas, which knows nothing about custom properties -- `var(--accent)` is simply an
     invalid colour there and silently leaves the previous fill in place. So the value
     goes through a real element's computed style first, which is what expands the var,
     and the canvas then turns whatever that resolved to (today an oklch()) into bytes.
     Resolution is against the document root, so a token scoped to some subtree will not
     be seen; pass an already-resolved colour, or a Triple, in that case. */
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden'
  probe.style.color = c
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()

  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })!
  /* Paint over a known ground first: a colour with alpha would otherwise read against
     whatever the canvas starts as, which is transparent black. */
  cx.fillStyle = '#000'; cx.fillRect(0, 0, 1, 1)
  cx.fillStyle = resolved; cx.fillRect(0, 0, 1, 1)
  const [r, g, b] = cx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

export interface ChannelBlendOptions {
  /** Which channels you are steering. Default 'srgb', as their tool opens. */
  space?: ChannelSpace
  /** One curve per channel, in the space's own order. A channel left undefined is
   *  linear — which is what their three graphs show before anything is dragged. */
  ease?: [Ease?, Ease?, Ease?]
  /** Their "Samples". Stops are evenly spaced, so this is purely how often the curves
   *  are read. Default 5, theirs. */
  stops?: number
  dir?: string
}

const hex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')

/* Ties go DOWN, which is not arbitrary: it is what reproduces Mass Driver's own output.
   A linear R from 246 to 48 over five samples passes through exactly 196.5 and 97.5, and
   their stops are c4 (196) and 61 (97). Math.round would give 197 and 98 and the
   reproduction test below would be off by one in two channels for no better reason. */
const round = (n: number) => Math.ceil(n - 0.5)

/** Mass Driver's resampler: a curve per channel, sampled to ordinary CSS stops.
 *
 *  `channelBlend('#F65030', '#3050F6', { stops: 5 })` reproduces their default output
 *  exactly, which is the test that says this reads their graphs the way they draw them.
 *  Bend one channel and the ramp leaves the straight line between the endpoints — which
 *  is the entire point, and the thing `blend()` cannot do at any `ease`. */
export function channelBlend(
  from: string | Triple, to: string | Triple, o: ChannelBlendOptions = {},
): string {
  const { space = 'srgb', ease = [], stops = 5, dir = '90deg' } = o
  const n = Math.max(2, Math.round(stops))
  const toSpace = (t: Triple) => space === 'hsl' ? rgbToHsl(t) : t
  const A = toSpace(resolveRGB(from))
  const B = toSpace(resolveRGB(to))

  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const v = [0, 1, 2].map(k => {
      const e = ease[k]
      const f = e == null ? t : bezierY(e, t)
      /* Hue takes the short way round, as CSS does in a polar space. Without it a ramp
         from 350 to 10 crawls backwards through the entire wheel. */
      if (space === 'hsl' && k === 0) {
        let d = B[0] - A[0]
        if (d > 180) d -= 360
        if (d < -180) d += 360
        return A[0] + d * f
      }
      return A[k] + (B[k] - A[k]) * f
    }) as Triple
    const [r, g, b] = space === 'hsl' ? hslToRgb(v) : v
    parts.push(`#${hex(round(r))}${hex(round(g))}${hex(round(b))}`)
  }
  return `linear-gradient(${dir}, ${parts.join(', ')})`
}
