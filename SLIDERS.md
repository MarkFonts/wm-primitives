# Every slider, icon and chevron, and what draws it

A census, not a spec — the spec is [DIAL.md](DIAL.md). This is the answer to "how many
of these are there, and which ones are actually the primitive?"

Two censuses: [the sliders](#the-sliders), then [the icons and chevrons](#the-icons-and-chevrons).

Counted 2026-09-07 across wm-primitives, font-proofer, ReCal, opsz-proofer and kernpare.
**59 sliders. 49 are the primitive; 10 are not.**

| # | label | repo | rail / context | MDS icon | control | primitive? |
|---|---|---|---| --- |---|---|
| 1 | letter spacing | wm-primitives | Fitting — Swiss Rag knobs |  | AxisSlider | ✅ |
| 2 | word spacing | wm-primitives | Fitting — Swiss Rag knobs |  | AxisSlider | ✅ |
| 3 | flex | wm-primitives | Fitting — Swiss Rag knobs |  | AxisSlider | ✅ |
| 4 | rag width | wm-primitives | Fitting |  | AxisSlider | ✅ |
| 5 | indent | wm-primitives | Fitting |  | AxisSlider | ✅ |
| 6 | word space | wm-primitives | Fitting — justification |  | AxisTriplet | ✅ |
| 7 | letter space | wm-primitives | Fitting — justification |  | AxisTriplet | ✅ |
| 8 | flex `x-scale` | wm-primitives | Fitting — justification |  | AxisTriplet | ✅ |
| 9 | measure | wm-primitives | docs · controls 01–04 | `<span class="material-symbols-outlined">fit_width</span>` | AxisSlider | ✅ |
| 10 | width `wdth` | wm-primitives | docs · controls 01–04 |  | AxisSlider | ✅ |
| 11 | leading | wm-primitives | docs · controls 01–04 | `<span class="material-symbols-outlined">format_line_spacing</span>` | AxisSlider | ✅ |
| 12 | optical size `opsz` | wm-primitives | docs · controls 01–04 | `<span class="material-symbols-outlined">mystery</span>` | AxisSlider, `auto` | ✅ |
| 13 | geometric form `GEOM` | wm-primitives | docs · controls 04 (stops) |  | page-built | ❌ |
| 14 | word space | wm-primitives | docs · controls 05 |  | AxisTriplet | ✅ |
| 15 | letter space | wm-primitives | docs · controls 05 |  | AxisTriplet | ✅ |
| 16 | flex `x-scale` | wm-primitives | docs · controls 05 |  | AxisTriplet | ✅ |
| 17 | glyph scale `wdth` | wm-primitives | docs · controls 05 (disabled) |  | AxisTriplet | ✅ |
| 18 | *(unlabelled)* | wm-primitives | docs · circles — corner-shape demo |  | bare `<input type=range>` | ❌ |
| 19 | measure | font-proofer | proofing controls | `<span class="material-symbols-outlined">fit_width</span>` | AxisSlider `track` | ✅ |
| 20 | size | font-proofer | proofing controls — paragraph | `<span class="material-symbols-outlined">format_size</span>` | AxisSlider `track` | ✅ |
| 21 | size | font-proofer | proofing controls — words | `<span class="material-symbols-outlined">format_size</span>` | AxisSlider `track` | ✅ |
| 22 | tracking | font-proofer | proofing controls — paragraph | `<span class="material-symbols-outlined">format_letter_spacing</span>` | AxisSlider `track` | ✅ |
| 23 | tracking | font-proofer | proofing controls — words | `<span class="material-symbols-outlined">format_letter_spacing</span>` | AxisSlider `track` | ✅ |
| 24 | leading | font-proofer | proofing controls — paragraph | `<span class="material-symbols-outlined">format_line_spacing</span>` | AxisSlider `track` | ✅ |
| 25 | leading | font-proofer | proofing controls — words | `<span class="material-symbols-outlined">format_line_spacing</span>` | AxisSlider `track` | ✅ |
| 26 | Optical Size | font-proofer | axis rail (from `fvar`) | `<span class="material-symbols-outlined">mystery</span>` | AxisSlider `track` | ✅ |
| 27 | Geometric Form | font-proofer | axis rail (from `fvar`) |  | AxisSlider `track` | ✅ |
| 28 | Weight | font-proofer | axis rail (from `fvar`) |  | AxisSlider `track` | ✅ |
| 29 | Ascender Height | font-proofer | axis rail (from `fvar`) |  | AxisSlider `track` | ✅ |
| 30 | Sharp | font-proofer | axis rail (from `fvar`) |  | AxisSlider `track` | ✅ |
| 31 | Italic | font-proofer | axis rail (from `fvar`) |  | AxisSlider `track` | ✅ |
| 32 | opsz | ReCal | preview bar | `<span class="material-symbols-outlined">mystery</span>` | AxisSlider 01, `allowAuto` | ✅ † |
| 33 | GEOM | ReCal | preview bar |  | AxisSlider 01 | ✅ |
| 34 | wght | ReCal | preview bar |  | AxisSlider 01 | ✅ |
| 35 | YTAS | ReCal | preview bar |  | AxisSlider 01 | ✅ |
| 36 | SHRP | ReCal | preview bar |  | AxisSlider 01 | ✅ |
| 37 | ital | ReCal | preview bar |  | AxisSlider 01 | ✅ |
| 38 | GEOM | ReCal | Type Matrix pins |  | AxisSlider `diamond` | ✅ |
| 39 | Optical size | ReCal | Type Matrix pins | `<span class="material-symbols-outlined">mystery</span>` | AxisSlider `diamond` | ✅ |
| 40 | Weight | ReCal | Type Matrix pins |  | AxisSlider `diamond` | ✅ |
| 41 | Ascender | ReCal | Type Matrix pins |  | AxisSlider `diamond` | ✅ |
| 42 | Sharp | ReCal | Type Matrix pins |  | AxisSlider `diamond` | ✅ |
| 43 | size | ReCal | typography panel | `<span class="material-symbols-outlined">format_size</span>` | AxisSlider `track` | ✅ |
| 44 | tracking | ReCal | typography panel | `<span class="material-symbols-outlined">format_letter_spacing</span>` | AxisSlider `track` | ✅ |
| 45 | leading | ReCal | typography panel | `<span class="material-symbols-outlined">format_line_spacing</span>` | AxisSlider `track` | ✅ |
| 46 | measure | ReCal | typography panel | `<span class="material-symbols-outlined">fit_width</span>` | AxisSlider `track` | ✅ |
| 47 | word space | ReCal | justification rail |  | AxisTriplet | ✅ |
| 48 | letter space | ReCal | justification rail |  | AxisTriplet | ✅ |
| 49 | flex `x-scale` | ReCal | justification rail |  | AxisTriplet | ✅ |
| 50 | Size | ReCal | compare / landing rail | `<span class="material-symbols-outlined">format_size</span>` | bare `<input type=range>` + `.pm-label` | ❌ |
| 51 | Spacing | ReCal | compare / landing rail | `<span class="material-symbols-outlined">format_letter_spacing</span>` | bare `<input type=range>` | ❌ |
| 52 | Optical Size | ReCal | compare / landing rail | `<span class="material-symbols-outlined">mystery</span>` | bare `<input type=range>` | ❌ |
| 53 | Geometric Form | ReCal | compare / landing rail |  | bare `<input type=range>` | ❌ |
| 54 | Weight | ReCal | compare / landing rail |  | bare `<input type=range>` | ❌ |
| 55 | Ascender Height | ReCal | compare / landing rail |  | bare `<input type=range>` | ❌ |
| 56 | Sharp | ReCal | compare / landing rail |  | bare `<input type=range>` | ❌ |
| 57 | screen | opsz-proofer | header rail |  | hand-emitted `.slider-row` HTML | ❌ ‡ |
| 58 | display size | opsz-proofer | header rail | `<span class="material-symbols-outlined">format_size</span>` | hand-emitted `.slider-row` HTML | ❌ ‡ |
| 59 | wght | opsz-proofer | header rail |  | hand-emitted `.slider-row` HTML | ❌ ‡ |

† Ported from a hand-built row with a native `auto` checkbox, 2026-09-07. Not yet committed.

‡ Wears the primitive's class names without being it: `build.py` emits `.slider-row`,
`.slider-label-text` and `.slider-number` as strings. It gets the styling for free and
none of the behaviour — no `auto`, no typed minus, no drawn steppers.

**kernpare** has none. Its 194 `type="range"` matches are all inside `shared/` — the
primitives' own stylesheet, not its own controls.



---

## What the census says

**The biggest remaining non-primitive rail is ReCal's compare / landing page** (50–56):
seven native ranges with their own `.pm-label` markup, in the same app whose other four
rails are all the component. Same seven parameters as the preview bar and the matrix
pins, drawn a third way.

**opsz-proofer (57–59) is the subtler case.** Nothing looks wrong, because it copies the
class names — which is exactly why nobody has noticed it is a copy. It is the same
failure as docs card 05 was: a control wearing the primitive's name, free to drift from
it, and it will drift the first time `AxisSlider.tsx` changes structure rather than
styling.

**Card 04's stop slider (13) is a genuine exception** — it is a different control
(named stops with a thumb that travels between them), not a copy of this one. It is on
the list to be demoted to a still, not converted.

**The same parameter is spelled four ways.** Weight is `wght` in ReCal's preview bar,
**Weight** in its matrix pins, its compare rail and font-proofer's axis rail, and `wght`
again in opsz-proofer. Optical size runs `opsz` / **Optical size** / **Optical Size** /
**optical size** depending on where you look. Some of that is deliberate — ReCal's
preview bar uses raw tags on purpose — but not four ways' worth.

**`flex` is three different controls.** The Swiss Rag knob (3), the triplet row (8, 16,
49) and the docs card's fourth row, which calls the same idea **glyph scale** and tags it
`wdth` instead of `x-scale`. The page and the shipping rail disagree about its name.


---

## The icons and chevrons

Same question, same answer shape. **22 marks in scope. 8 are drawn by the primitive; the rest are the apps' own.**
The 9 Lucide icons are cal.com's brand furniture and are commented out below, and three of them are the same idea drawn three ways.

| # | mark | repo | where |  | how it is made | primitive? |
|---|---|---|---|---|---|---|
| 1 | stepper chevron ⌃⌄ | wm-primitives | `AxisSlider` value field | | inline SVG, `viewBox 0 0 10 6`, stroke 1.5 | ✅ |
| 2 | stepper chevron ⌃⌄ | wm-primitives | `AxisTriplet` fields | | inline SVG, `viewBox 0 0 7 6`, stroke 1.5 — **redrawn narrower, not scaled**: scaling shrinks the stroke with the shape | ✅ |
| 3 | `auto` state dot ● / ○ | wm-primitives | `AxisSlider` label, `allowAuto` | | Cal Sans `uni25CF` / `circle` at 0.7em, raised 1px — **not** `•` / `◦`, drawn at 18% of the em against these at 76% | ✅ |
| 4 | chip dot ● | wm-primitives | `AxisTriplet` chip | | CSS `content: '\25CF'` at 0.7em, raised 1px | ✅ |
| 5 | ◆ baked-default marker | wm-primitives | `AxisSlider` value, `marker` | | text glyph, suppressed in `variant="diamond"` | ✅ |
| 6 | ◆ diamond thumb | wm-primitives | `AxisSlider` `variant="diamond"` | | CSS rotate-45 square on the range thumb | ✅ |
| 7 | align bars | wm-primitives | `Fitting` — left/center/right/justify | | `AlignIcon`, SVG 14×14, four `<rect>` rows at computed x | ✅ |
| 8 | copy → check | wm-primitives | `GlyphPicker` copy button | | SVG 16×16, two paths, 2s revert | ✅ |
| 9 | **capital `V`** | ReCal | rail seams — TYPE MATRIX, FREEZER | | **a literal Cal Sans `V` at `SHRP 100`**, `margin: 0 2em`, no transform — a transform would drop the shared clip fill and the V vanishes, so it stays inline and rides the holographic gradient | ❌ |
| 10 | seam chevron | ReCal | — | | `SeamChevron()`, SVG 22×10 — **declared and never rendered.** Dead: the `V` above took the job | ❌ |
| 11 | ↺ reset | ReCal | Reset buttons | | `ResetIcon()`, SVG 16×16, two paths — **defined twice**, `Shell.tsx:43` and `App.tsx:30`, byte-identical | ❌ |
| 12 | ✓ freeze check | ReCal | `Freezer` | | inline SVG 12×12, one path, stroke 1.8 | ❌ |
| 13 | vertical-metrics diagram | ReCal | `VMetricsView` | | SVG with a computed `viewBox` — a drawing, not an icon | ❌ |
<!-- OUT OF SCOPE for the Material Symbols migration — cal.com's own brand furniture,
     not our control vocabulary. Left as they are.
| 14–22 | 9 × 24×24 | font-proofer | cal.com nav preview | | `LucideIcon` wrapper — Event Types, Bookings, Availability, Members, Teams, Apps, Routing, Workflows, Insights | ❌ |
-->
| 48–57 | 10 × 14×14 | font-proofer | toolbars | | named set: `AlignLeft/Center/Right/Justify`, `ChevronLeft/Right`, `Glyph`, `MultiSelect`, `Para`, `Scale` | ❌ |
| 58–60 | 3 × 16×16 | font-proofer | incl. `calcom-font` | | inline SVG | ❌ |
| 61 | `fit_width` | wm-primitives docs | controls card 04 | | Material Symbols Outlined ligature | ❌ |
| 62 | `line_weight` | wm-primitives docs | controls card 04 | | Material Symbols Outlined ligature | ❌ |
| 63 | `format_line_spacing` | wm-primitives docs | controls card 04 | | Material Symbols Outlined ligature | ❌ |
| 64 | `mystery` | wm-primitives docs | controls card 04 — `opsz` | | Material Symbols Outlined ligature. Named `mystery` because no symbol means optical size | ❌ |

opsz-proofer draws **no** icons or chevrons at all — its hand-emitted `.slider-row` markup
has no stepper, which is the behaviour it silently gave up by copying the class names
instead of the component.

### What the icon census says

**The same chevron is drawn four ways.** The primitive draws it twice on purpose —
10×6 for the dial, 7×6 redrawn for the triplet's narrower gutter, and the redraw is
correct, because scaling would have thinned the stroke. But font-proofer also ships
`ChevronLeft/Right` at 14×14, and ReCal draws its seam chevron as **a capital V set in
Cal Sans**. Four chevrons, three unrelated constructions.

**ReCal's `V` is the interesting one and should probably stay.** It is not laziness: the
seam label rides a holographic gradient with a shared clip fill, and an SVG cannot be
inside that fill — the comment in `holo.css` says so and says why a transform kills it.
A letterform as an icon is the right answer *here*, in a type tool, and it is the only
mark in the census that a font could draw better than a drawing.

**`SeamChevron()` is dead** — an SVG chevron defined in `Shell.tsx` and never rendered,
left behind when the `V` took over. Deletable.

**`ResetIcon()` is defined twice in ReCal**, identically, in `Shell.tsx` and `App.tsx`.

**Three icon vocabularies coexist**: hand-inlined Lucide (font-proofer, 9 — cal.com's
nav, out of scope), a bespoke set of 16 (font-proofer, viewBoxes 12–20, not all 14×14 as
first counted), and Material Symbols as a webfont (docs only, 4). Nothing shared.

**Counted by RENDERS rather than definitions, two more are dead.** font-proofer's
`AlignLeftIcon` / `AlignCenterIcon` / `AlignRightIcon` / `AlignJustifyIcon` are rendered
**0×**: the alignment buttons you see are drawn by `AlignIcon` in wm-primitives'
`Fitting.tsx`, so the primitive already owns them and these four are duplicates to
delete, not convert. And `ChevronUpIcon` is rendered exactly **1×** — so the up chevron
needs `keyboard_arrow_up`, not a rotated `arrow_forward_ios`. Worth avoiding: rotating a
glyph puts its opsz correction on the wrong axis.



**MDS additions**
```
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=refresh" />
<style>
```
```
.material-symbols-outlined {
  font-variation-settings:
  'FILL' 0,
  'wght' 400,
  'GRAD' 0,
  'opsz' 24
}
</style>
```

##chevrons
`<span class="material-symbols-outlined">arrow_back_ios_new</span>`
`<span class="material-symbols-outlined">arrow_forward_ios</span>`

flyout `<span class="material-symbols-outlined">discover_tune</span>`
Light mode `<span class="material-symbols-outlined">light_mode</span>`
Dark mode `<span class="material-symbols-outlined">dark_mode</span>`

| # | preview tab | MDS icon |
|---|-------------|----------|
| 1 | Big Word | `<span class="material-symbols-outlined">insert_text</span>` |
<!--| 1 | Big Word | `<span class="material-symbols-outlined">zoom_in</span>` |-->
| 2 | UI | `<span class="material-symbols-outlined">mobile_layout</span>` |
| 3 | Type Scale | `<span class="material-symbols-outlined">text_fields</span>` |
| 4 | Glyphs | `<span class="material-symbols-outlined">grid_view</span>` |

| # | typography function | MDS icon |
|---|-------------|----------|
| 1 | reset | `<span class="material-symbols-outlined">reset_settings</span>` |
| 2 | align left | `<span class="material-symbols-outlined">format_align_left</span>` |
| 3 | align center | `<span class="material-symbols-outlined">format_align_center</span>` |
| 4 | align right | `<span class="material-symbols-outlined">format_align_right</span>` |
| 5 | align justify | `<span class="material-symbols-outlined">format_align_justify</span>` |

---

## The migration target, verified against the binary

Every name below was resolved out of the actual subsetted woff2 — GSUB walked, each
ligature sequence spelled back through the cmap. Not read off a website.

| bespoke icon | renders | → Material Symbols |
|---|---|---|
| `CalIcon` | 6× | `calendar_month` |
| `SlidersIcon` | 4× | `discover_tune` |
| `BigIcon` | 2× | `insert_text` |
| `ParaIcon` | 2× | `format_paragraph` |
| `GlyphIcon` | 2× | `grid_view` |
| `ScaleIcon` | 2× | `text_fields` |
| `MultiSelectIcon` | 2× | `forms_add_on` |
| `ResetIcon` | 2× | `reset_settings` |
| `ChevronLeftIcon` | 1× | `arrow_back_ios_new` |
| `ChevronRightIcon` | 1× | `arrow_forward_ios` |
| `ChevronDownIcon` | 1× | `keyboard_arrow_down` |
| `ChevronUpIcon` | 1× | `keyboard_arrow_up` |
| `AlignLeft/Center/Right/JustifyIcon` | **0×** | — **delete.** The live ones are `AlignIcon` in wm-primitives' `Fitting.tsx`, which takes `format_align_left/center/right/justify` |
| ReCal `SeamChevron()` | **0×** | — **delete.** The capital `V` took the job |

Plus, with no bespoke predecessor: `light_mode`, `dark_mode`, `fit_width`, `format_size`,
`format_letter_spacing`, `format_line_spacing`, `mystery`, `mobile_layout`.

### What the font actually ships

| | |
|---|---|
| `FILL` | 0 .. 1, default 0 |
| `GRAD` | −50 .. 200, default 0 |
| `opsz` | **20 .. 48**, default 24 |
| `wght` | 100 .. 700, default 400 |

**`opsz` bottoms out at 20.** A mark set at 14px gets the 20px drawing — the closest the
font has. `Icon.tsx` clamps rather than passing 14 through, because
`font-variation-settings` on an out-of-range value is not an error, it is silently
ignored, and you would never learn the axis had stopped working.

### `icon_names` is required, and it is a trap either way

| URL | payload | glyphs |
|---|---|---|
| `icon_names=refresh` (as first drafted) | 2 KB | 8 — **one icon** |
| no `icon_names` | **3.97 MB** | 6,607 |
| `icon_names=` our 24 | **22 KB** | 60 |

Shipped with `icon_names=refresh`, every other ligature renders as **literal text** —
`format_align_left` in words, on screen. Dropping the parameter costs 4 MB. The list is
the answer, and subsetting does not flatten the axes: all four survive at full range.

Which means the list has to track the code, or an icon added in a component renders as
its own name in production. That is a build step, not a discipline.
