# The shape of a ramp

A spec, and the reasoning behind one number. Companion to [DIAL.md](DIAL.md),
[TYPOGRAPHY.md](TYPOGRAPHY.md) and [SLIDERS.md](SLIDERS.md).

Engine: `src/gradient.ts`. Controls: `src/GradientControls.tsx`. Chrome: `src/gradient.css`.

---

## Why there is a file

The package already faded in three places before this, and spelled it two ways.

| where | what it does | how it was | now |
|---|---|---|---|
| `Specimen.css` | the tail of a part-loaded work thins out | six hand-picked stops approximating alpha ≈ t² | `scrim('var(--bg)', { dir: 'to top' })`, set by `SpecimenNav` |
| `UiKitBoard.jsx` | the board's top edge under the app's chrome | `linear-gradient(to bottom, rgba(0,0,0,.55), black ${topInset}px)` | `maskRamp({ from: .55, to: 1, span: '${topInset}px' })` |
| `AxisSlider.css`, `icon.css` | a track fill, a swatch | a stop **at** a value | unchanged — not a fade, and none of this file's business |

The first carries a paragraph explaining that a straight two-stop ramp "puts a visible
edge where the fade starts and then crawls". The second is that ramp. One fade, two
spellings, one of them the bug the other one documents — the same shape as `--dur-fast`
before `motion.css`, and it gets the same treatment: an engine with the number in it
rather than a convention everybody re-derives.

**Both are converted.** Neither is under a render baseline — the committed screenshots are
dial rows and `kernpare-ui-seg`, and nothing screenshots either fade — so the conversion was
checked by rendering the two ramps against their old strings on identical content instead.

The specimen tail is visually unchanged: the clothoid tracks the hand-fitted t² curve within
a few points of alpha across the whole ramp, which is unsurprising, because the hand curve
was aiming at the same thing.

The board mask visibly improved, and at the end that mattered. Its alpha now runs
`.55 → .667 → .77 → .85 → .918 → .96 → .992 → 1`: the curve's slow end lands on full reveal,
so the join is imperceptible. The two-stop version arrived at 1 linearly, and that arrival
was the edge `Specimen.css` spent a paragraph warning about — in the one file that was
building it.

---

## One mechanism

Four techniques were on the table. They are one technique.

- **Clothoid gradients** ([Lukas Hermann](https://codepen.io/lhermann/pen/qmpMGQ),
  [Takehiko Ono](https://codepen.io/onopko/pen/rNGRjYL)) ease the **alpha**, so a scrim has
  no visible start edge.
- **[Mass Driver's resampler](https://workshop.mass-driver.com/gradients)** eases the
  **colour**, by putting control points on the interpolation and sampling the result back
  down to ordinary CSS stops.
- **[variablur](https://github.com/whatsinlab/variablur)** eases a **blur radius** across a
  view, with named curves or a cubic Bézier.

Three channels, one curve, and the curve is a cubic Bézier in every case. So: one sampler,
three emitters.

### The clothoid is a Bézier, and that is measured

Fitting `cubic-bezier()` to the pen's seven hand-written stops lands on

```
cubic-bezier(0.416, 0.657, 0.695, 1)
```

with an RMS error of **0.00065** in alpha and a worst case of **0.0013** — a third of one
step in 8-bit. Stop for stop:

| position | pen's alpha | the curve |
|---|---|---|
| 50% | 0.300 | 0.2988 |
| 65% | 0.150 | 0.1509 |
| 75.5% | 0.075 | 0.0747 |
| 82.85% | 0.037 | 0.0367 |
| 88% | 0.019 | 0.0179 |

It does not need its own code path. It is `EASES.clothoid`, and it is the default,
because `linear` is the wrong default for a fade and a default nobody passes is the one
that ships.

### Sampling is by curve parameter, not by position

Walking `s` from 0 to 1 and taking the Bézier's `(x, y)` puts the stops **where the curve
bends**. That is why the pen's own stops crowd toward the transparent end — 50, 65, 75.5,
82.85, 88 — instead of sitting at equal intervals. Sampling `y` at equal `x` gives the same
curve with the stops in the wrong places: smooth where nothing happens, faceted where
everything does. The curve editor draws the sampled stops on the curve so you can watch
them crowd.

### No colour parsing, ever

Every emitter hands the mixing to CSS through `color-mix()`, so a ramp can be built out of
`var(--bg)` without this package ever learning what `--bg` resolves to. `color.css` says why
at length: the tokens compute to `oklch()`, a regex sweep reads L, C, H as R, G, B, and that
is how the colophon wordmark turned dark red.

---

## The engine

```ts
import { scrim, maskRamp, blend, blurLayers, rampStops, EASES } from './shared'

scrim('var(--bg)')                              // background-image, 8 stops, clothoid
maskRamp({ dir: 'to right', stops: 6 })         // mask-image
blend('var(--accent)', 'var(--bg)', { space: 'oklab' })
blurLayers({ radius: 24 })                      // style objects, one band each
rampStops({ ease: [0.4, 0, 0.6, 1], stops: 5 }) // the numbers, for an SVG or a canvas
```

`RampOptions` is `{ ease, stops, dir, from, to, span }`. `ease` is a preset name or four raw
numbers, so call sites name a curve and controls drag one without converting between them.

**`span` is for a ramp measured against something that is not its own box.** It emits stop
positions as a fraction of a CSS length — `calc(0.1704 * 48px)` rather than `17.04%`. The
board's top mask has to end EXACTLY at the inset the app's floating chrome occupies: a
percentage of the strip is a different number every time the strip resizes, and a span
longer than the inset leaves the ramp still resolving over content with nothing above it —
a permafade, which `UiKitBoard`'s own comment calls a real bug rather than a tuning problem.
The ends are spelled plainly (`0`, `48px`), because `calc(0 * 48px)` is correct and
unreadable. `blurLayers` does not take it: its bands are geometry, and the option would
silently do nothing.

**Defaults, and what earned them.** `stops: 8` is where banding stops being visible on a
13rem fade at the clothoid; below five the facets show, above twelve nothing changes and the
declaration just gets longer. `layers: 6` is the same argument for the blur stack, where the
cost is real — each layer is its own backdrop rasterisation.

### Scrim mixes in sRGB; blend mixes in oklab

Not an inconsistency. A scrim's colour is not changing, only how much of it there is —
mixing toward `transparent` in a perceptual space carries the colour toward that space's
zero as the alpha falls, so a scrim in oklab greys out before it disappears. In a blend the
colour *is* changing, and oklab is where the **lightness** of that change is even.

### What oklab does not do

It does not save two complementary colours from going grey through the middle, and it is
widely claimed to — this document claimed it too, until the midpoints were measured:

| blue → yellow | midpoint | saturation |
|---|---|---|
| `srgb` | 131,124,115 | 12% |
| `oklab` | 130,136,151 | **14%** |
| `oklch` | 214,79,145 | **63%** |
| `lab` | 166,119,132 | 28% |

sRGB and oklab are both mud. A straight line between opposite hues passes through the
neutral axis in *any* rectangular space, because that is where the axis is. What oklab
actually buys is lightness: red → green midpoint luma is 101 in sRGB against 111 in oklab.

**`oklch` is the one that keeps chroma**, because it interpolates hue as an angle and goes
*around* rather than through. The cost is an intermediate hue nobody picked — blue → yellow
in oklch travels through magenta. Reach for it when the middle must stay saturated, not as
a general upgrade. That is why the default stays oklab: it is the predictable one.

### `scrim` or `maskRamp` is a trade, and banding is half of it

A scrim can only fade toward **one** colour. Over a photograph, a video or another gradient,
the fade's own colour reads as a wash across the content, and a mask is the only correct
answer — `UiKitBoard`'s comment gets there from the other end, "real transparency, not a
dark tint".

What a mask costs is **the engine's own dithering**, and this is the part that was missing
here. Skia dithers a background gradient; it very nearly does not dither a mask. The same
ramp, measured three ways:

| the ramp lives in | per-pixel deviation | longest flat terrace |
|---|---|---|
| `mask-image` | 0.22 | 13px |
| `background-image` over a `background-color` | **2.98** | 6px |
| a masked child div | 2.11 | 13px |

So a mask over a **flat** ground bands where the identical scrim does not — 13× less
free dither — and it is banding you then have to fix by hand.

**Over a flat ground, reach for `scrim`.** Reach for `maskRamp` when the ground is not
flat, and add `.wm-dither` if the result bands.

---

## Progressive blur: tiled bands, not a cumulative stack

`blurLayers()` is variablur's effect as a stack of backdrop layers, because the web has no
way to vary one filter's strength across an element.

**The bands are geometry, not masks — and that is not a style choice.** Everyone publishes
this technique with each layer filling the element and cut back to a band by `mask-image`.
In this package's own system page that did not hold: a single layer masked to the top 25%
blurred the *whole* panel, and six stacked took measured sharpness down the panel to a flat
0.1 against 8.7–16.8 with the stack removed — a uniform smear, which is the one thing a
progressive blur must not be. `mask-image`, `-webkit-mask-image`, the `mask` shorthand,
`mask-mode: alpha` and `will-change: mask` all render identically.

Read that as one document rather than as a rule about the platform. The same markup in a
standalone page masks correctly, so it is not a syntax error and the compositing path is
the obvious suspect, but the trigger was never isolated — the layers' computed styles are
the same in both but for width. The conclusion drawn here is narrow and practical: a mask
is not a dependable bound for a `backdrop-filter`, and a band positioned by `inset` blurs
its own rows and nothing else in every document tested. Geometry costs nothing to prefer.
Reducing the mask behaviour to a minimal repro is [NEXT.md](NEXT.md) D.

The cost is the feather: a band's edge is a step in radius rather than a fade, so the seam
is hidden by making the step small rather than by blending it. That is what `layers` buys.
At 12 the bands read as horizontal strips, at 16 they do not, and 32 is no better — hence
the default of 16. Each band is a separate backdrop rasterisation, so it is the first number
to lower if a stack has to sit under a scrolling list.

**The obvious construction ghosts.** Have each layer reveal everything from its band onward
and add a little more blur, so the strengths accumulate — it composes beautifully on paper.
On screen, `backdrop-filter` blurs what is *behind* the layer, and wherever that layer's
mask sits at partial alpha the compositor blends a blurred copy over the still-sharp
original. Over live text that is a visible double image: two copies of the same line, one
crisp and one smeared, through the whole run-in.

It shipped that way and was spotted by eye. No measurement here would have caught it — the
sharpness profile is monotonic either way, because the artefact is a *superposition*, not a
failure to blur.

**The feathers had this file's own bug in them.** A two-stop feather is a *linear* alpha
ramp, so the blur profile it produces is piecewise linear and kinks at every band boundary —
and a kink in the derivative is exactly the visible edge `scrim()` spends a paragraph on. It
showed as a hard line across the second line of text. The windows are smoothstepped instead,
C1 at both ends, so neighbouring bands hand over with no corner for the eye to find. Total
coverage across the span runs `1.00 1.22 1.64 1.94 2.00 … 2.00 1.94 1.64 1.22 1.00` — never
thinning to nothing, never cornering.

**So each layer owns one band** at full opacity, feathered into its neighbours, carrying the
absolute radius that band should read at. Every pixel is covered by exactly one layer at
full strength, and the crossfades are between adjacent, similar radii rather than between
sharp and fully blurred. The end bands do not feather off the edge — the first has nothing
above it to hand to and the last nothing below, and a feather there leaves a strip no layer
covers.

**The quadrature went with it.** It existed to make accumulating layers land on the radius
asked for — σ² = σ₁² + σ₂², so a band reading 12px on top of 9px took a 7.9px step. Tiled
layers do not accumulate; each blurs the original, so it simply carries its band's radius.
Correct arithmetic for a construction that turned out to be the wrong one.

**Bands are evenly spaced; only the radius follows the curve.** Placing the bands by curve
parameter as well — which the first version did — crowds `ease-in`'s bands into the last 5%
of the span, and bunches `linear`'s at both ends, since `cubic-bezier(0,0,1,1)` swept by
parameter is smoothstep. Position and strength are different questions and the curve answers
only the second.

At radius 28 over 6 layers the stack is `1.25 · 4.37 · 8.83 · 14.33 · 20.71 · 28`.

### The default curve here is `ease-in-out`, not the clothoid

A blur wants **both** ends eased, for two different reasons. *Hold the start*, because text
stops being legible around 4px and a ramp that spends that in its first band has thrown the
effect away before the eye has moved. Then *ease into the maximum*, so the blur arrives
instead of hitting a ceiling — which is the clothoid's own argument about visible edges,
applied at the other end.

First-layer radius at 24px over six layers — the leftmost number is how blurred the top line
of text is:

| curve | | | | | | |
|---|---|---|---|---|---|---|
| **ease-in-out** | **1.35** | 5.56 | 12.00 | 18.44 | 22.65 | 24 |
| ease-in | 1.07 | 3.75 | 7.57 | 12.28 | 17.75 | 24 |
| linear | 4.00 | 8.00 | 12.00 | 16.00 | 20.00 | 24 |
| clothoid | 6.16 | 11.86 | 16.83 | 20.71 | 23.17 | 24 |

The clothoid puts 6.16px on the top band and `linear` 4px — both past the legibility cliff
before the ramp has begun. `ease-in` holds the start too, but climbs to the ceiling without
easing into it.

### Limitations, all of them about live text

**The text underneath is still live**, and that is a content decision rather than a rendering
one. This blurs pixels; it does not redact. The words stay in the DOM — selectable, copyable,
findable with the browser's own find, and read aloud in full by a screen reader, which sees
no blur at all. Never use it to withhold anything: a paywall, a spoiler, a password. For
those, do not send the text.

**It does not reflow with the content.** The bands are fractions of the element, so the ramp
lands where the box says and not on any particular line. A block that rewraps at a narrower
width gets the same ramp over different words.

**Over text the ramp should not start at the element's edge.** The smallest stop in a 24px
stack is still 1.35px, and 1.35px at 0% lands inside the first line's *ascenders* — so the
line the reader anchors on is damaged before the gradation has done anything. `start` holds
a leading stretch untouched:

```ts
blurLayers({ start: 'calc(12px + 1lh)' })   // hold one line, ramp after it
blurLayers({ start: 0.25 })                 // or a plain fraction of the element
```

Over a colour field there is no anchor and every part of the ramp is observable, which is
why this defaults to `0` rather than to a line. Two things to know about `lh` here: it
resolves against the line-height of the **stack** element, which inherits from its parent
and need not match the paragraphs it covers (20.3px against the text's 21.75px, in one
ordinary case); and it measures from the element's edge, so padding counts — hence the
`12px +` above. Pass an explicit length when it has to be exact.

The onset is feathered rather than cut. A hard start would be the same visible edge this
file is about, landing directly under the line the offset exists to protect.

**Keep the radius well under the span it ramps across** — a tenth is a safe ceiling. A blur
samples a neighbourhood `radius` wide, and at the element's edge there is no neighbourhood,
so the compositor clamps and smears. 28px inside an 86px box is a third of the height and
comes out blotchy; the same 28px across 240px is clean. No number in the engine can fix
this — it is a property of `backdrop-filter` and a sizing decision at the call site.

**Ramp across the text, not along it.** Blurring left-to-right over left-to-right prose
dissolves every line mid-word and reads as a bug. Running it down the block takes whole lines
at a time; variablur's own list-edge example is vertical for the same reason.

**Cost is one backdrop rasterisation per layer, per frame.** Six is affordable under a
scrolling list; it is still the expensive number, and the first to cut.

**On iOS Safari** a `backdrop-filter` inside a scroll container is sampled before the scroll
offset is applied, so the blur lags the content. Position it against the viewport instead.

`<ProgressiveBlur>` renders the stack. It is a lens, not a lid: `pointer-events: none`, its
own stacking context, and no background of any kind — a background would be the thing you
see instead of the blurred content behind it.

---

## The controls

`<GradientControls value onChange />` — one `GradientSpec`, three kinds (scrim, blend,
blur), and `gradientCss(spec)` as the single place that decides what a spec *means*, so the
preview and the copy button cannot disagree about it.

**The curve editor is the control.** Mass Driver's tool makes the same point: the numbers
that matter in a gradient are not the endpoints, which are obvious, but the two control
points, which are not — and you cannot type those. You drag them and watch the ramp. The
presets are there to start from, not to choose from, and the row stops claiming a name the
moment a handle moves off it (derived from the four numbers, never stored — a spec that
remembers a name it no longer matches is what makes a preset row untrustworthy).

**Both axes are clamped to 0..1.** X because CSS requires it: outside that range a
`cubic-bezier()` is invalid and the declaration is dropped. Y *is* legal to overshoot in
CSS, and for a transition that overshoot is a bounce worth having — but this is a ramp
editor, and no emitter here can honour it. Each one guards its own ends, so a value past
the endpoint is silently flattened: `scrim()` with an undershooting curve emitted
`var(--bg) 0%, var(--bg) 24.06%` — two identical stops, one wasted — while the editor drew
a confident excursion. `channelBlend()` clamps at the byte. A control that draws a shape
its output will not produce is worse than one that cannot draw it, and the clamp also keeps
the handle inside its own field.

**The preview is type, not a swatch.** Over flat colour every curve looks correct. The
banding these curves exist to remove is only visible over content with edges in it.

---

## Naming

`GradientControls.tsx`, not `Gradient.tsx`. On a case-insensitive filesystem
`./src/Gradient` and `./src/gradient` are one module, so the barrel resolves both imports
to the engine and fails at build with a missing export that names the component. Same trap
`SpecimenNav` and `letterbox.js` are already named around.
