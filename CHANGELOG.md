# What changed, and why

A log of decisions, not of diffs — `git log` already has the diffs. Each entry says what
moved and what it cost, because most of these were reached by getting them wrong first and
the wrong version is the useful part.

Companion to [DIAL.md](DIAL.md) (the dial's layout), [GESTURES.md](GESTURES.md) (what it does
under a pointer), [SLIDERS.md](SLIDERS.md) (the census), [GRADIENTS.md](GRADIENTS.md) (the shape of a ramp),
[EVAL.md](EVAL.md) (how it is tested) and
[HOWTO.md](HOWTO.md) (how to wire it in, and add a dial).
Newest first.

---

## 2026-09-20 — progressive blur is retired; one blur, with a radius

**It could not be made to work, and three attempts is enough.** A stepless progressive
blur over live DOM text is not achievable with `backdrop-filter`. Both constructions
were built and both were rejected on sight:

- **Hard-edged bands.** Every pixel sits under exactly one layer at alpha 1, so nothing
  ghosts — but the radius jumps at each boundary and the staircase is plainly visible.
- **Feathered bands.** No steps, but `backdrop-filter` at partial mask alpha composites
  the blurred copy *over the still-sharp original*. Measured: uniform mask alpha 0.5
  leaves a peak edge of **108**, against **217** unblurred and **19** fully blurred.
  Exactly half the sharp text survives, in every feather zone, and it reads as a seam
  through the type.

There is no third option in CSS. A true per-pixel variable blur — what variablur does in
Metal — needs the content rasterised to a canvas, which costs the live text that the
effect exists to preserve.

**§05 is now "The blur": one uniform `backdrop-filter` and a radius slider,** shown
against an untouched twin. Nothing is masked, so there is no partial alpha to ghost and
no second radius to step to. Measured across the panel, the biggest row-to-row change in
local sharpness is 0.002 at 12px and 0.001 at 30px — flat, which is the whole point.

The twin is not decoration. A uniform blur has no sharp region of its own, so a lone
panel at any useful radius is illegible end to end and reads as a broken figure rather
than as an effect; the pair gives the eye its reference back without reintroducing a
stack. For the same reason the default radius is **3px**, not the 12 it shipped at for
an hour: this chapter's own prose says type stops being legible around 4px, and at 12
the panel was a formless grey field you could not tell was text. At 3 it is plainly the
same lines as the panel beside it. The slider tops out at 24 rather than 48 because the
useful range is the first few pixels and the rest all looks identical.

`blurLayers()` and `ProgressiveBlur` are deprecated rather than deleted, so the finding
stays beside the code. No call site in this package used them; `SpecimenNav` uses
`scrim()` and `UiKitBoard` uses `maskRamp()`, and a fade has never had any of these
problems.

**It also closes [NEXT.md](NEXT.md) D.** The mask was never the thing that was broken.
`corner-shape: superellipse(1.2)`, applied page-wide, drops the mask on any layer whose
HOST carries a non-round corner shape — only the host, which is why resetting the layers
changed nothing and why the computed styles gave nothing away. Found by lifting the
panel up its ancestor chain until masking started working. The claim that `mask-image`
does not bound a `backdrop-filter` was wrong and is corrected wherever it was made.

## 2026-09-20 — the icon face is a subset, and a lint knows what it holds

**`icon.css` said the full 3.9MB face shipped so a subset could never drift. The file
was a 16KB subset of 24 ligatures.** Found by the "Button designs" session reading a
screenshot closely: a name outside the subset does not print as words, the ligature
never forms and the browser draws the component glyphs the font happens to hold, so
`undo` was two strokes and `arrow_outward` a circle, and both passed as icons. The
comment now says what ships and what the failure looks like. The guard is
`scripts/lint-icons.py`: it reads the GSUB and fails any name in the code the face
cannot draw — the package's names in `lint.yml`, every consumer's in `consumers.yml`.
Its first run caught the JSDoc example on `Icon.tsx` (`reset_settings`, not in the
face). WORDMAKE uses seven names outside the subset and is unaffected only because it
loads the full face from Google itself; the day it joins CI it either grows the subset
or loses the link.

---

## 2026-09-20 — the house button splits a word

**A flex box makes a bare text run an item.** `.wm-btn` was inline-flex with a 6px gap so
a mark could sit beside its word; Kernpare writes its labels `<u>D</u>elete Pairs` for
the access keys, and the gap fell between the D and the rest. The first fix wrapped the
labels on the Kernpare side, which Mark called duct tape, correctly: the button was
asking every host to know a flex-box rule. So the gap is gone from the box and lives on
the mark instead -- a margin on `.wm-icon` or anything flagged `data-mark`, on the side
that faces the label. Text sits flush however it is marked up; a mark keeps its space.
Kernpare's wrapping is reverted (wordmarktools `46afddd` → back).

---

## 2026-09-20 — the blur bands stop relying on a mask

**`blurLayers()` was building a uniform smear.** Measured down the system page's blur
panel, sharpness was flat at 0.1 from the first line to the last, against 8.7–16.8 with
the layer stack removed. Not a tuning problem and not a small one: there was no
progression at any radius, and at 4px every line was equally destroyed.

Every version of the function had each layer fill the element and cut it back to a band
with `mask-image`, which is how the technique is published everywhere. In the assembled
system page that mask does not constrain the filter: one layer masked to the top 25%
blurs the *whole* panel, and each further layer compounds, one measured 1.8, three 0.2,
six 0.1. `mask-image`, `-webkit-mask-image`, the `mask` shorthand, `mask-mode: alpha` and
`will-change: mask` all render identically.

**How far that generalises is not established, and this entry should not be read as
saying it does.** The same markup in a standalone page masks correctly, which rules out a
syntax error and points at the compositing path — but the trigger was never isolated, the
layers' computed styles are identical in both documents but for width, and the whole
finding rests on one page in one browser. What is solid is the measurement and the
remedy. Reducing it to a minimal repro is [NEXT.md](NEXT.md) D, and until that exists the
general rule is not this package's to state.

**So the bands are geometry.** Each layer states its own `inset` and blurs its own rows,
which holds in every document tested. `BlurLayer` loses `maskImage`/`WebkitMaskImage` and
gains `inset`; `.wm-blur-layer` loses `inset: 0`, which would otherwise hand every band
the whole element and restore the bug in silence.

**What it cost:** the feather. A band edge is a step in radius now, not a fade, so the
seam is hidden by making the step small rather than by blending it. The default moves
6 → 8.

A first pass put it at 16, on the strength of a 1:1 screenshot of a 994×88 strip in
which 12 appeared to show horizontal strips and 16 did not. Rendered headed at 2×, the
condition most readers are actually in, 8 and 16 and 32 are hard to tell apart and 8
arguably reads best — so 16 was nearly tripling the backdrop rasterisations for a
difference visible only in the harness that chose it.

What the count actually buys is fidelity to the easing, not smoothness. Each band takes
the radius at its FAR edge, so a coarse stack is systematically blurrier than the curve
it samples and a fine one tracks it more closely while sampling it into more steps.
That is a real trade and a much weaker reason than the one first written here. Each band
is a separate backdrop rasterisation, so this is still the first number to lower under a
scrolling list — there is just less to lower now.

The two unit tests that read mask stops were asserting the right properties through the
wrong surface. Tiling is an identity now rather than a coverage integral — band *i*'s far
edge **is** band *i+1*'s near edge, asserted exactly, which is why `inset` states both
edges instead of a height. Added one that the layers carry no mask at all, because a mask
coming back would come back silently.

## 2026-09-20 — the ramps demos move

**The section shipped inert.** Six chapters of baked CSS that state a default and cannot
be pushed off it: a reader who wants to know what four stops looks like, or where a blur
stops being legible, had to take the page's word. Five native ranges now — `stops` on the
scrim pair, `radius` / `layers` / `hold` on the blur stacks, dither strength on the banded
pair — driving the engine inlined into the page.

**No framework for it.** `src/gradient.ts` is 3.5KB and has no dependencies, which is the
whole reason it can be inlined; `dist/dial.js` already ships one React and a second bundle
here would ship another for the sake of a slider. `js=9.0KB` for the section, against 0.
The page stays correct with JS off — every demo is baked at its default and the controls
only re-emit.

Wired by class and `data-` attribute, never by id: `build.py` rebinds
`document.querySelector` to the section root but leaves `getElementById` alone, and renames
ids on the way in. Checked after Ramps moved inside Color (#28) — the root is `#s-color`
now and all five still drive.

**And the copy left the generator.** The `COPY` object sat at the top of
`build-ramps.mjs`, so a writing pass and the machinery were one edit surface and two people
could not work at once. The 36 strings are `docs/system/pages/ramps.copy.js` now, an
exported function taking the measured values so the live figures still interpolate and
still cannot be retyped. The generator holds no prose at all.

## 2026-09-19 — process (NEXT.md F) · v0.1.0

**A PR that changes what ships carries a CHANGELOG entry, or it is red.** `lint.yml`
`changelog`, on `pull_request`: `src/`, `index.ts` or `dist/` changed without this file
changing fails. Docs and tests are exempt — this is a log of decisions.

**`test:render:update` refuses outside CI.** The baselines are linux's; a Mac that re-cut
them would make the next CI run red on every row. `WM_FORCE_BASELINES=1` for the day the
runner is wrong, and the commit says so.

**Tags.** `v0.1.0` is the contract as it stands: the props in `AxisSliderProps`, the
tokens in HOST-CONTRACT.md, `wmDial.mount / get / set / update / destroy / mountTheme`,
`.wm-btn` and `.wm-select`. A change to any of those bumps the minor and gets a tag; the
policy is in README §5. `package.json` says 0.1.0 to match.

---

## 2026-09-19 — into more hands (NEXT.md E)

**Kernpare is held to the system.** The linter could not read it: one `index.html`, its
CSS in two `<style>` blocks, and a linter that walked `.css` files. It reads style blocks
out of an `.html` root now, line numbers intact, and a region can be fenced
`token-lint: off -- reason` … `token-lint: on` for a design that is deliberately its own
— the kern-group analysis UI is Severance on purpose and stays so. Everything outside the
fences was fifty-four literals off the scales; they are steps and roles now. A `kernpare`
leg in `consumers.yml` runs the lint on every push.

**The system page is the README.** The Pages site opened with a poster and six galleries
and said nothing about what the package promises or what a host owes it; the README said
all of that and was rendered only by GitHub. `build.py` renders it as section 01 with a
converter the size of the README's own markdown, and a README edit rebuilds the page.

**Windows renders.** A `windows` job, Chromium on `windows-latest`, the render suite
against its own baselines under `tests/__screenshots__/win32/`. A report, like the linux
rendering step; the first run cut the baselines.

**WORDMAKE was closer than the docs said, and further.** EVAL had it as "no submodule, no
import". It imports six sheets and five components — through a symlink to the laptop's
checkout, and two of the components (`StopSlider`, `StyleScopeDropdown`) exist only on
the `flattersatz-headless` branch. So "StopSlider never had a file" (yesterday's entry)
was true of main and not of the repo. NEXT.md E has the three steps.

---

## 2026-09-19 — the open decisions, closed (NEXT.md D)

**Typing commits on Enter or blur, in every field.** The dial had moved there on the 17th;
the triplet still committed per keystroke, so typing `24` on a min-8 band became 8, then
84, with the neighbours carried along on each step. One rule now, GESTURES §0 *Typing*.
G45 and its test changed to match.

**The dial's type size was never inherited — its box was.** The text is 12px in every
host and always was. What the parity report read as 16px was the label *container*,
which set no size or leading of its own, so a row was 18px in the two React hosts and
18.8px in opsz-proofer's 12px/1.4 panel. `.slider-label` sets both now, and the type
tokens carry fallbacks (`0.75rem`, `1.4`, `0.5625rem` for the tag) so a host that never
loads `type.css` gets the same box. Five allowlist lines existed for this.

**The parity gate had been crashing since it was written.** `__dirname` in an ES module;
rendering is continue-on-error, so the crash read as a report with nothing in it. Two
runs on main went by like that. `import.meta.url` now, and the run after this one is the
first the gate has actually judged.

**Three render baselines outlived the thing they pictured.** Kernpare's `.ui-seg` (the pill
it retired for the house button), its `theme-words` (it took the marks look), and
opsz-proofer's two rows (the `input[type="text"]` scoping). All from the 17th; all
reported, none blocking, none read. Re-cut from CI, and the Kernpare test now pictures
the house button.

**Mouse drag-from-anywhere is native, and proven.** The native range jumps on press and
keeps dragging from there. G18 says so and a test holds it; the promise is per pointer.

**`--dial-track-h` is the host's.** 24px default, 14 floor, DIAL §7. ReCal's 14 is not
drift.

**`Collapse` was shipping all along.** Nothing imports it by name except `Fitting`, which
wraps its two H&J sections in it — so the census read "unshipped". GESTURES §11 now has
its rows. `StopSlider` was a name in four documents and no file.

**ReCal's measure is in body ems now.** `.para-doc` sets the `p` style's size, so `34em`
is thirty-four of them rather than of the page's 16px. (ReCal, not here.)

## 2026-09-19 — the system page gets section 06

**Ramps sits beside Colour rather than inside it.** 05 has a stated premise — every colour
literal in the three style bases, 692 of them, audited — and a curve is not a literal.
Appending to it would break the one thing that section promises, so 06 is its own, and
"Who uses what" moves to 07. Numbering is positional in `SECTIONS`, so the rail renumbered
itself and the chapter ids came off the page's own headings.

**It is generated.** `scripts/build-ramps.mjs` imports a live compile of `src/gradient.ts`
and writes the page from it: every gradient is a string the engine emitted, and the
residual table, the blur radii in the chapter heading and the channel-plot endpoints are
all read off the package. The engine's output changed three times on the day the section
was written; a page with those figures typed into it would have been wrong within the hour
and looked authoritative the whole time.

**No JavaScript.** `css=6.2KB html=31.7KB js=0.0KB`. A scrim, a blend and a channel ramp
are declarations, and the blur stack is twelve divs with inline styles, so the assembled
page pays nothing at runtime. The dither tile is read out of `src/gradient.css` so the page
shows the noise that actually ships.

**Two things the build taught, both the same lesson.** The assembled page is LIGHT by
default and a scoped `body{color}` travels with its section: every heading and table value
that inherited `#e8e8e8` went white-on-white while the explicitly-greyed prose survived.
Ink is the host's now; this page states a colour only where it also states the ground. And
the banding demo first spanned **2 levels instead of 18**, because an alpha ramp only has
the range its backdrop gives it — it was measuring the page, not the quantisation.

**`.wm-dither` has to sit after whatever quantises, not under it.** Inside the masked
element the noise modulated the ink before the mask touched it: 19 terraces either way,
126px widest in both. On the wrapper it lands on the composited result and the widest run
collapses to 10px. That generalises past this page.

**`ramps.copy.md` is the writing handoff.** All 31 strings are hoisted into one `COPY`
object with no prose left in the template, so a writing pass edits an object and never
markup. The brief carries the measured figures with a "state nothing that is not on this
list" rule, because several plausible claims about this material are false and the page
exists partly to correct one of them.

`docs/index.html` is NOT in this commit: it inlines `src/`, and that tree currently carries
an unrelated in-flight edit to `AxisSlider.css`. Rebuild with
`python3 docs/system/build.py --linked` once it is clean.

---
## 2026-09-19 — the linter learns what a token IS

**A token can be declared, spelled right, read with a fallback, and still be wrong.**
`--dial-thumb` is the dial thumb's SIZE — `width: var(--dial-thumb, 14px)` — and a host
that reads the name as a colour and sets `#e8e8e8` makes that declaration invalid at
computed-value time. The thumb collapses; because a range input maps a click through its
thumb geometry, EVERY SLIDER IN THE APP then snaps to its minimum on click. No error, no
warning, and the symptom nowhere near the cause. It cost most of an afternoon, chasing a
control that would not drag, before the cause turned out to be one line in the host.

Same failure family as color.css's: a custom property that does not resolve is not a value
you watch go missing, it is a declaration the engine drops.

**Types are inferred, not hand-declared.** A list of expected types is one more thing to
drift out of date. Every read already says what a token is twice — by the property it sits
in (`width:` wants a length) and by its own fallback (`var(--x, 14px)`) — so the type is
read off this package's own usage. Which gives the rule teeth here first: two files that
disagree about what a token is are a problem before any consumer is involved.

**THE PROPERTY ONLY SPEAKS FOR A TOP-LEVEL `var()`.** The first draft read the outer
property whatever the nesting and reported five false positives in this package alone:
`color: rgba(var(--text-rgb), var(--ink-quiet, .62))` is a colour built from a component
list and an alpha, and neither is a colour. Depth is tracked now. `stroke-width` is off the
length list for the same kind of reason — SVG takes it unitless, so `--chevron-stroke: 1.15`
is correct.

**It runs against a consumer too.** Paths on argv are linted alongside `roots`, so
`node scripts/lint-tokens.mjs ../font-proofer/src/app.css` checks that app's declarations
against the contract this package's usage implies — which is where the bug actually was.

---
## 2026-09-19 — a curve per channel

**`blend()` could never have reproduced Mass Driver's tool, and the barrel said it could.**
One ease on the interpolation parameter remaps R, G and B together: it re-spaces the stops
along a path and cannot bend the path. Their resampler gives each channel its own curve.
Stated as a test now — one curve on all three channels lands the midpoint *exactly* on the
straight line between the endpoints; steering G alone puts it 20 levels off it.

**`channelBlend()` reproduces their published output byte for byte.**
`#F65030 → #3050F6`, five samples, no control points →
`linear-gradient(90deg, #f65030, #c45061, #935093, #6150c4, #3050f6)`. Ties round DOWN to
get there: a linear R from 246 to 48 passes through exactly 196.5 and 97.5, and their stops
are 196 and 97. Stops sit at even positions, unlike `rampStops()` — their curves are value
against *position*, so sampling by curve parameter would be reading their graphs wrong.

**It is the one function here that resolves a colour**, and the exception is the point:
steering a channel means knowing what the channel is, and `color-mix()` exists precisely so
this package never has to look. It resolves the way the house rule requires — through the
engine, never a regex. Two hops, because a canvas `fillStyle` cannot expand `var(--accent)`:
computed style first, 1×1 canvas second.

**Their demo pair hides the feature.** G is 80 at both ends of `#F65030 → #3050F6`, so every
curve on it is a no-op — which is why the first render of this looked broken and why the
control now labels that channel `flat` and dashes its curve.

**Two CSS bugs found by rendering it rather than by reading it.** The three editors kept
their `grid-template-columns: repeat(3, 1fr)` inside a 300px rail, at 96px each, because the
stacking rule was a *viewport* media query and the viewport was 1000px wide. Replaced with a
container query — and then the first version of that never fired either, since a container
query styles a container's DESCENDANTS and cannot style the container it queries. The
containment sits on `.grad-controls` and the query names it.

New: `channelBlend`, `resolveRGB`, `rgbToHsl`, `CHANNEL_NAMES`, `ChannelCurves`, a
`'channels'` kind on `GradientSpec`. 29 assertions.

---

## 2026-09-18 — gradients get an engine

**One fade, two spellings, one of them the bug the other one documents.**
`Specimen.css` carries six hand-picked stops and a paragraph explaining that a straight
two-stop ramp "puts a visible edge where the fade starts and then crawls".
`UiKitBoard.jsx` builds its top mask inline as exactly that two-stop ramp. Same shape as
`--dur-fast` before `motion.css`, so it gets the same treatment: `src/gradient.ts`, with
the number in it.

**Four references turned out to be one technique.** The clothoid-gradient pens ease the
ALPHA; Mass Driver's resampler eases the COLOUR by dragging control points onto the
interpolation and sampling back to plain stops; variablur eases a BLUR RADIUS. Three
channels, one cubic Bézier — so one sampler and three emitters (`scrim`, `blend`,
`blurLayers`), not three engines.

**The clothoid IS a Bézier, measured rather than assumed.** Fitting `cubic-bezier()` to
the pen's seven hand-written stops lands on `(0.416, 0.657, 0.695, 1)` at an RMS error of
0.00065 in alpha, worst case 0.0013 — a third of one step in 8-bit. It is the default,
because `linear` is the wrong default for a fade and the default nobody passes is the one
that ships.

**Sampling is by curve parameter, not by position**, which is why the stops crowd toward
the transparent end the way the pen's own do. Sampling `y` at equal `x` draws the same
curve with the stops in the wrong places: smooth where nothing happens, faceted where
everything does.

**Progressive blur composes by quadrature, and that is the whole difference.** Each layer
blurs what the layers under it already blurred, so σ² = σ₁² + σ₂²: a band that should read
at 12px on top of 9px gets sqrt(12² − 9²) = 7.9, not 3. The common version of this trick
hands each layer the curve's value and goes to mush a third of the way in. Tested at 2, 4,
6 and 10 layers — the radii compose back to the radius that was asked for.

**Nothing parses a colour.** Every emitter mixes through `color-mix()`, so a ramp can be
built out of `var(--bg)` without this package learning what `--bg` resolves to — the
colophon-wordmark rule from `color.css`, applied before it could be broken again.

**Named `GradientControls.tsx`, not `Gradient.tsx`.** On a case-insensitive filesystem
`./src/Gradient` and `./src/gradient` are one module: the barrel resolves both imports to
the engine and fails at build with a missing export naming the component. `tsc` caught it;
`SpecimenNav` and `letterbox.js` are already named around the same trap.

**Both call sites took it, and no baseline moved.** `Specimen.css`'s six stops are gone;
`SpecimenNav` sets `scrim('var(--bg)', { dir: 'to top' })` instead. `UiKitBoard`'s inline
two-stop mask is `maskRamp({ from: .55, to: 1, span })`. The claim that these sat under
render baselines was wrong — every committed screenshot is a dial row or `kernpare-ui-seg`,
and nothing shoots either fade — so they were checked by rendering both ramps against their
old strings on identical content.

The tail is visually unchanged, which is the expected result: the clothoid tracks the
hand-fitted t² curve within a few points across the whole ramp, because the hand curve was
aiming at the same thing. The board mask improved at the join — its alpha now decelerates
into full reveal (`.55 → .667 → … → .992 → 1`) where the two-stop version arrived linearly,
and that arrival was the visible edge `Specimen.css` spent a paragraph warning about, in
the one file that was building it.

**`span` earned its way into `RampOptions`** doing it. The board's mask must end EXACTLY at
the chrome's inset, so positions are emitted as a fraction of a length —
`calc(0.1704 * 48px)` — rather than as percentages of a strip that resizes.

New: `src/gradient.ts`, `src/GradientControls.tsx`, `src/gradient.css`,
`tests/unit/gradient.spec.ts` (44 assertions, no browser and no host — the engine is
numbers), [GRADIENTS.md](GRADIENTS.md).
Converted: `src/Specimen.css`, `src/SpecimenNav.tsx`, `src/UiKitBoard.jsx`.

---

## 2026-09-17 — the dial for pages without React

**`dist/dial.js`: one source, a second output.** `a0e1645`
Kernpare and opsz-proofer are not React apps, and the census records what happened when
one of them hand-wrote the dial's markup: the class names with none of the behaviour,
free to drift the first time `AxisSlider.tsx` changed shape. A plain-JS port would be
the same drift with more code. So `AxisSlider.tsx` itself, React inside, is bundled by
esbuild into a script tag (`wmDial.mount(el, props)` → `get / set / update / destroy`),
~70 KB gzipped. The bundle is committed because those pages run no npm; a `dial` job
fails the push that changes the source without rebuilding it, and dispatch waits on it.

**And the two pages took it.** wordmarktools `5f4c808`
opsz-proofer's three hand-emitted rows — the census's 57–59 — are `wmDial.mount` now;
`build.py` inlines the bundle's CSS in place of `AxisSlider.css` and ships `dial.js`
beside the page. Scroll-to-adjust went with the markup: the dial refuses a vertical
wheel on purpose. Kernpare's *Italic angle* and *Glyph size* are dials where two number
inputs were. Fifty-nine sliders in the census; none is a copy any more.

**This log was silent for a night, and that was a bug.** Five entries were inserted by
anchoring each on the heading of the one before, and the first anchor only ever existed
on a side branch. Every insert was a no-op that raised nothing. They are all below now,
under an assertion.

---

## 2026-09-17 — the other controls get their rows

**GESTURES §9 (the triplet) and §10 (the mark), with tests.** PR #17
Thirteen promises: the triplet's stepper, arrows, typing, the carry rule (an edit that
would cross a neighbour moves the neighbour, never clamps the edit), `offset`,
`disabled`; the mark's ladder on both grounds, hover never landing on an active mark,
the swatch only in the dark, `opsz` clamped to the axis, `label` → `aria`.

**A held stepper on the triplet moved one step and stood still.** PR #17
The repeat timer fired on schedule and committed from the band captured at press time
— base+step, base+step, base+step. `AxisSlider` had guarded its own stepper against
exactly this with a ref; the triplet had not. Found by G43 on its first run.

**Open, written down rather than decided:** the triplet still commits a parseable
number on every keystroke (G45); the dial stopped doing that today (G19). Two fields,
one keystroke, two behaviours.

---

## 2026-09-17 — the theme switch is one control

**`ThemeSwitch`, both looks, one engine.** `b5ae658`
Auto / Light / Dark existed twice and was missing once: font-proofer drew three Material
marks, Kernpare three words in a pill, ReCal none (light-only tokens, by decision). Each
had its own storage key and its own idea of what `auto` stamps on `<html>`. `theme.js`
is the engine, plain JS so a page without React drives the same buttons with
`mountThemeSwitch()`; the React form has both looks. One key, `wm-theme`; the attribute
always present; a `wm-theme` event on `<html>` so a canvas painted with token colours
can repaint. Placement stays in the app.

**Chevrons: never a text glyph.** `6dbcb99`, ReCal `6b5f5df`, Kernpare `cb49925`
ReCal's style menus carried `▾` set in Cal Sans — a 9px triangle matching nothing.
Kernpare's preset select wore Chrome's arrow. Both are the house chevron now.

**The parity report earned its keep on day one.** The `track` variant agrees on every
number in every host; the `default` variant is two controls (ReCal 14px rail via the
offered `--dial-track-h`, font-proofer 24px + `padding: 0 16px` unlayered); ReCal's rows
show `cursor: pointer` where the primitive says `ew-resize`. Written down, not changed.

---

## 2026-09-17 — the battery, and the first bug it found

**EVAL.md, GESTURES.md, tests/.** `67aee88` `7da3285` `da86e1a`
A methodology (five audiences, eight decisions), a behaviour spec (36 promises, each
traced to the commit where the opposite was a bug), and the suites: every consumer built
against the commit before any is told to deploy; every dial row in every host held to a
linux baseline with cross-host parity as numbers; the gesture promises run as Playwright
in a real Chromium touch and a synthesised WebKit one; the deploys wait until the site
serves what they built; a docs-only run across three models that put eight missing
sentences into the docs.

**A touch keeps its own capture.** `6325c50`
Found by the behaviour suite on its second run, under a *real* touch — the synthesised
one had passed. Asking `setPointerCapture` for a touch pointer, which the browser has
already captured, made Chromium fire `lostpointercapture` for the hand-over, and
`onLostPointerCapture` is `onTouchUp`. The drag ended on its first live frame,
`data-scrubbing` came off, and the native range carried the rest as ~28 uncoalesced
`input` events. Every promise of the mobile pass held for exactly one frame.

**The field composes; Enter or blur commits.** `7970694`
From the phone: typing toward 1660 had the proof jump to 16, then 166, and a host that
clamps wrote its answer back into the field mid-word. Draft only now; a tap selects the
digits; only an arrow abandons the draft.

---

## 2026-09-13 — the dial answers a finger

The mobile pass. Every item here was reported from a phone, and several of the fixes
replaced an earlier fix of mine that had made things worse.

**Drag from anywhere on the rail.** `d14ae6a`
The direction of a gesture was decided on the *first* move sample past 3px, and a sample
that looked vertical killed the gesture outright with no way back. A finger rolling
slightly on the way down — which is most of them, on a 32px bar — lost the drag before it
began, leaving only what the native input does: jump on tap, drag from the thumb. Now it
waits for 6px of real movement and concedes only when the gesture is *clearly* vertical
(1.5×); anything ambiguous stays a drag.

**touch-action: the two wrong answers before the right one.** `ffa2e95` after `ab84960`
`pan-y` left a horizontal drag to be won or lost against the scroller, and the scroller
won nearly every time — the rails read as dead. `none` won the drag by taking the page's
vertical scroll away from every row, so a phone got *neither* gesture. Neither can be
right, because `touch-action` states one answer before anyone has moved a finger. The
direction is judged per gesture in JS instead, with `pan-y` held so the browser can always
scroll.

**A resting shelf.** `0a0429c`
Every track row was 48px of live target sitting 6px from the next: nowhere on the rail to
put a thumb that was not a control. Big rows, unusable for exactly that reason — so the
fix was subtraction. The row stays 48px always and only the *bar* inside it changes, so
nothing reflows. At rest the bar is 32px, leaving ~8–11px of inert band (shelf plus seam)
between bars. Touching one fills the row for three seconds.

The input is inset *less* than the bar and asymmetrically — 3px above, 5px below. A finger
hides what it is over, so people aim with its visible top edge and miss high.

**The stepper was what blocked the shelf.** `0a0429c`
A bar cannot be shorter than its tallest content, and the stepper pair stood 46px, propping
every bar open to the full row. It also threw the two marks to the row's extremes, which is
why they read as too high and too low. 16px boxes let the bar rest at 32 and bring the marks
within 6px; the touch area returns as padding and leaves layout via an equal negative
margin, capped at 3px because stacked buttons any larger would overlap and make up-vs-down
ambiguous at the seam.

**The value field and the arrows stopped eating drags.** `0a0429c`, `d14ae6a`
Both sit over the rail's right end, so between them most of that side was undraggable —
exactly where a high value parks its own thumb. Each now takes a tap and passes a drag: the
field focuses for typing on a tap and drives the value on a horizontal drag; the stepper
fires its step immediately on press (hold-to-repeat needs that) and cancels the repeat if
the press becomes a drag.

**The lag was never easing.** `d14ae6a`
Type appeared to ease behind the finger. There was no transition on the preview anywhere.
It was *frequency*: `pointermove` fires ~120Hz and each event was a setState, a re-render
and a re-raster of a 400px variable word, so the work queued and caught up after the
gesture stopped. Drag updates are coalesced to one per frame, always the latest — positions
the eye never saw are dropped rather than rendered late.

Coalescing needs a **synchronous flush on release**, because rAF is not guaranteed to run:
a hidden tab or a backgrounded phone starves it, and the last value of a drag would sit in
the queue forever. The frames in between are an optimisation; the value you let go on is
not.

**`data-scrubbing` on the root.** `d14ae6a`
Set for exactly the duration of a live drag, so a host can ease a *committed* value and
refuse to ease a *dragged* one. An attribute rather than a prop: otherwise every consumer
threads the same flag through every slider, and the fact is global anyway — either the user
is dragging a control or they are not. Ignoring it costs nothing.

**Typing could not clear the field.** `ffa2e95`
The field is controlled and clamped on every keystroke, so clearing it parsed as NaN, the
handler returned without propagating, and React rendered the old value straight back.
Worse, selecting 88 on a min-8 dial and typing "2" committed 8 that instant, then "4" made
84 — the small number you were reaching for was unreachable. The field now keeps a draft
while focused and the clamp moves to blur. Nothing out of range ever reaches `onChange`;
the intermediate states of typing are simply allowed to exist.

**Stock is a mark on the bar's foot.** `4cf89bf`
The reference marker was a 28px rhombus at 45°, written to *mirror* the diamond thumb. With
the thumb gone from the track variant it was mirroring nothing and lay across the row at an
angle. Its position is clamped, because at stock = axis floor it hung off the bar's rounded
corner, where any shape reads as damage — as a triangle it read as a speech-bubble tail.

---

## 2026-09-09 — light, and what carries it

**The ink ladder ends where each ground needs it.** `5a7f38e`
Active's GRAD was read off the axis rather than off the ladder: −50 is the floor of the
shipped `fvar`, so the mark went visibly thin the moment the pointer left. Each theme now
states its own end value, one rung below its own hover — dark `50 · 100 · 75`, light
`100 · 150 · 100`.

**Light takes no HDR at all, and that is physics.** `5a7f38e`
The boost exists only for pixels brighter than SDR white; a mark on a light ground has to go
*darker* to read as chosen. Ungated, the swatch painted the chosen mark white on a light
page — the faintest thing in the row rather than the fullest.

**Hover stopped landing on active marks.** `5a7f38e`
The guard covered the `--active` modifier but not a mark made active by a host ancestor
carrying `.active`. Since `background-clip: text` only reveals the image where the text is
transparent, repainting at ink-quiet covered the swatch entirely: the HDR did not dim under
the pointer, it was *replaced*.

**A press is light on the chevron, not a disc behind it.** `bf491f7`
Both steppers acknowledged a press with a shape, putting a second object in a 9px box that
already held a chevron. The mark answers instead. Momentary is two durations rather than an
animation: opacity snaps on at `:active` and eases back out on release, so the flash cannot
lag the press or be re-triggered mid-decay by the hold-repeat timer.

**Material Symbols, subset to the 24 marks we draw.** `e3b6676`
3.79 MB → 15.6 KB; the shipped face carried 6,607 glyphs to draw 24. **The trap:**
subsetting with `--text` of the letters saves 5.8%, because every icon name is spelled in
`[a-z0-9_]` and keeping those letters makes every ligature *reachable*, so layout closure
retains all 6,583. `--no-layout-closure` is what makes it 53 glyphs. Also: `pyftsubset`
drops glyph names to `post` format 3, so verifying by glyph name reports a false failure —
verify by rendering.

**The swatch baker learned colour, gamut and a falloff.** `15ed551`
A white swatch masked onto a coloured control flattens it to white, so each hue needs its
own bake. **The gamut error worth remembering:** the container is BT.2020 (`nclx 9`), so
linear sRGB components handed to it are reinterpreted as BT.2020 coordinates and every
channel that is not the peak lands too low. Measured on the zone green: written
`[0.203, 1, 0.333]` where the true value is `[0.502, 1, 0.415]`. It looked vivid, which is
why it passed the eye — but the HDR swatch was a *different colour* from the flat fallback
beneath it, so a control shifted hue as the boost engaged.

**The hero's gloss: one mask, one map, one origin.** `b380a35`, `2931c60`, `c334fbe`
Four separate defects at one join. The mask was 1px, because a `<use>` does not inherit the
CSS that styles its referent. The pattern was sized off the SVG's own viewBox, so the bend
sampled the field ~3× zoomed against the bar. The conversion had to come from
`getScreenCTM()`, not `boundingRect/viewBox` — that quotient is only right when box and
viewBox share an aspect ratio. And on a cold load the header measured 0 wide, so the pattern
shipped at `width="0"`: a gloss exactly zero pixels across, invisible locally because
localhost settles layout before the script runs.

`non-scaling-stroke` went with it: it is *defined* to ignore the CTM, so the SVG strokes
held 8px while the CSS bar grew with page zoom. At 100% they agreed, which is why every
screenshot looked clean.

---

## 2026-09-08 — one chevron, one stroke

**One chevron, at one angle, with a stroke that follows its size.** `42bc938`, `bbd89d2`
Round caps after flat ones were tried and rejected. `strokeFor(w)` derives weight from
width, so 12-wide gets 1.26 and 10-wide gets 1.15 — a difference, not a drift.

**Self-hosted Material Symbols, and the marks recorded on the system page.** `8b30eec`
A subsetted `icon_names` link under the *same* font-family silently wins over a fuller face
and prints ligature names as text.

**Coarse pointers: reset the transform the position change left behind.** `da26495`
`position: static` without `transform: none` left a 44px stepper pulled up 22px, overhanging
its neighbours and swallowing the touches meant for the track. A position change without the
matching transform reset is the trap.

---

## Rules this log keeps re-proving

- **A measurement beats a reading.** Half the entries above are a fix for a fix, and the
  wrong one always looked right in the environment it was written in.
- **localhost hides cold-load bugs.** Layout settles before the script runs, so anything
  derived from a measured box needs a guard *and* something watching for the real value.
- **Specificity fights come in threes.** `AxisSlider.css`'s header documents two; the value
  field's touch target made three. At equal specificity, source order decides.
- **An effect that is invisible in a screenshot can only be judged on the device.** HDR is
  the sharpest case; touch is the next.
- **A synthesised event tests the component; only a real one tests the browser.** The
  capture bug passed every synthetic run and failed the first real touch.
