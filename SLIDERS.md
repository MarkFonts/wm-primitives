# Every slider, and what draws it

A census, not a spec — the spec is [DIAL.md](DIAL.md). This is the answer to "how many
of these are there, and which ones are actually the primitive?"


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
