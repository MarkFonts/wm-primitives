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

## Blur: one radius, not a ramp

**Progressive blur is retired; `blurLayers()` and `ProgressiveBlur` are deprecated.** A stepless progressive blur over
live DOM text is not achievable with `backdrop-filter`, and both constructions were built,
shipped and rejected on sight:

- **Hard-edged bands.** Every pixel sits under exactly one layer at alpha 1, so nothing
  ghosts — but the radius jumps at each boundary and the staircase is plainly visible.
- **Feathered bands.** No steps, but `backdrop-filter` at partial mask alpha composites the
  blurred copy *over the still-sharp original*. Measured: a uniform mask alpha of 0.5 leaves
  a peak edge of **108**, against **217** unblurred and **19** fully blurred. Exactly half
  the sharp text survives, in every feather zone, which reads as a seam through the type.

There is no third option in CSS. A true per-pixel variable blur — what variablur does in
Metal — needs the content rasterised to a canvas, and that costs the live text, the thing
the effect exists to keep.

**Use instead:** `scrim()` or `maskRamp()` for a fade, which have no artifact at all and are
what every shipping call site already uses; or a single uniform `backdrop-filter` with no
mask, which has neither a partial alpha to ghost nor a second radius to step to.

The functions are kept rather than deleted so the finding stays next to the code. No call
site in this package uses them.

**One thing worth keeping from the wreckage.** A non-round `corner-shape` on the element
that *contains* a masked `backdrop-filter` layer silently drops the mask — only the host
matters, not the layer. Page-wide `corner-shape: superellipse(1.2)` cost a full rewrite of
`blurLayers` before the cause was found, because the symptom is indistinguishable from
`mask-image` simply not working and nothing in the computed styles says otherwise.

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
