# ramps — copy handoff

Raw notes for a writing pass on **section 06 · Ramps** of the system page.
Not prose itself. Bullets, slots, and the facts you are allowed to state.

---

## where

Repo root, absolute:

```
/Users/Mark/Documents/Github/wm-primitives
```

Everything below is relative to it.

```
docs/system/pages/ramps.copy.js      THE ONLY FILE YOU EDIT — every string on the page
docs/system/pages/ramps.copy.md      this brief
docs/system/pages/ramps.html         the page — generated, never hand-edit
docs/index.html                      the assembled site — generated, never hand-edit
scripts/build-ramps.mjs              machinery — DO NOT EDIT, another agent holds it
```

## how to edit

- Everything you touch is `docs/system/pages/ramps.copy.js` — one exported object of
  strings, nothing else in it.
- **Do not edit `scripts/build-ramps.mjs`.** It is machinery, another agent is working in
  it, and a copy change never needs it.
- `v.EASES` `v.radii` `v.worst` `v.rms` `v.MD_A` `v.MD_B` are the live values —
  interpolate them, never retype what they hold.
- Rebuild, from the repo root:

  ```
  cd /Users/Mark/Documents/Github/wm-primitives
  node scripts/build-ramps.mjs && python3 docs/system/build.py --linked
  ```

- Check standalone: open `docs/system/pages/ramps.html`
- Check assembled: open `docs/index.html`, jump to `#s-ramps`. **Check light mode too** —
  the assembled page is light by default and this section already lost its ink once.
- Don't commit `docs/index.html` unless the tree is clean; it inlines `src/`, so a rebuild
  sweeps in whatever else is uncommitted.

### the one hard rule

`${...}` inside a slot is a **live value from the engine**. Measured, and it moves when the
engine moves. Keep every one. Write around them.

If a sentence wants a number that isn't already in a slot — ask for the slot. Don't type
the number. The entire reason this page is generated is that no figure on it can go stale
quietly.

### mechanics

- Entities are HTML: `&#8212;` em dash · `&#8594;` arrow · `&#183;` middot · `&#916;` delta
- Allowed inline: `<b>` (emphasis, not weight) and `<code>`
- Backticks inside a slot need escaping — the file is a JS template literal. A stray one
  breaks the build. (It already did once.)

---

## voice

From the rest of the repo — match `SLIDERS.md`, `DIAL.md`, `color.css`'s header:

- state the thing → why it's that way → **name the failure it came from**
- numbers instead of adjectives
- no "simply", no "just", no hedging
- a sentence earns its place by saying something that wasn't obvious
- the repo is comfortable admitting the code was wrong first. Several notes here do that
  deliberately; don't polish it out.

---

## the slots

39 total. `title`, `lede`, `c1..c6_title`, `c1..c6_tag`, `note1..8`, `cap1..8`, `cap3a`, `cap7a`, `cap7b`, `cap7c`,
and `ctl_stops` `ctl_radius` `ctl_layers` `ctl_hold` `ctl_dither` — the slider labels.

**tags** = the right-hand label on a chapter rule. Short. Lowercase unless it's code.

---

### `title` · `lede`
- current title: **Ramps**
- lede's job: one curve, three channels; and that nothing on the page is typed in
- ~45 words now. Fine to cut.

### c1 · The curve — `c1_tag` is live
- on screen: an SVG plot (alpha vs position, fitted curve + the pens' 7 dots + 8 stop
  marks) and a residual table
- `note1` must survive: the fit is **measured**, not asserted; the clothoid is a *preset*
  not a code path; stops crowd at the transparent end because sampling is by curve
  parameter, not even positions
- live slots: `${worst.toFixed(4)}` `${rms.toFixed(5)}`
- `cap1` `cap2` are the two figure captions

### c2 · The edge
- on screen: **three** prose panels — no scrim (control) · linear · clothoid — and a
  `stops` slider driving both scrims at once
- `note2` — perceived lightness moves fastest at the transparent end, so a straight alpha
  ramp announces itself where it starts and then crawls
- the control panel is the point of comparison; copy can now say "against the unveiled
  panel" and mean something
- `cap3a` = the control, `cap3` = `linear`, `cap4` = `clothoid · the default`

### c3 · Where you mix
- on screen: four bands — srgb / oklab / oklch / lab
- `note3` — **the contrarian one, keep its spine.** Received wisdom says oklab rescues you
  from sRGB's grey midpoint. It does not. A straight line between opposite hues crosses
  the neutral axis in *any* rectangular space. oklab buys even **lightness**. Only oklch
  holds chroma, and pays with a hue nobody picked.
- this is the chapter that earns sitting next to 05 Color

### c4 · Steering a channel
- on screen: 4 ramps (none / R / G / B steered), then 3 channel plots
- `note4` — one curve re-spaces stops *along* a path; a curve per channel *moves* the
  path. And: G doesn't move at all in Mass Driver's own pair, which is why it never goes
  grey and why steering G there does nothing.
- live slots: `${MD_A}` `${MD_B}`

### c5 · Progressive blur — `c5_tag` is live
- ⚠ 2026-09-20: the assembled demo does not show a progression (sharpness measured flat
  at 0.1 down the panel; mask-image is not clipping backdrop-filter in the assembled
  page). Under repair in the generator. Until it is fixed, copy describes the technique
  and claims nothing about what the panel on this page shows.
- on screen: two prose panels, `start 0` vs held — with `radius` / `layers` / `hold`
  sliders. Both stacks rebuild; only the right one takes the hold.
- `note5` — tiled bands not a cumulative stack (which **ghosts**: a blurred copy over the
  still-sharp original, a double image on live text). Bands evenly spaced, only the radius
  follows the curve. `start` holds the first lines.
- `note6` — the limitation. Blurs pixels, does **not** redact. Still selectable, copyable,
  findable, read aloud in full. Never use to withhold anything. **Keep this blunt.**
- live slot: `${radii.join(' &#183; ')}`

### c6 · Banding
- on screen: **five full-width rows** over a stated dark ground, same ink, same
  quantiser, in this order: the steep control (alpha 0→1, fuses) · the dark fade (the
  failure: bands) · the light control (same levels, same density, clean) · the same
  endpoints as a `background-image` · the mask with `.wm-dither`. A `dither` slider on
  the last; at 0 the steps come back. No filter, no amplified copy.
- `note7` — the mechanism is **repetition, not the edge**: one step is ~0.37 ΔL* wherever
  it sits and invisible alone; steps 5px apart fuse, 13px apart band, 155px apart vanish
  into a flat field. Visibility peaks. Tone matters on its own (dark row bands, light row
  with the same numbers is clean). More stops **cannot** help.
- `note8` — Skia dithers a background gradient and near-as-nothing a mask. `.wm-dither`
  sits after the quantiser, so it **hides the edge and does not remove the step**; the
  background row halves the step because it dithers before quantising. The chapter's
  first draft said dither removes the staircase and its second said wide terraces make
  it visible; note8 says both were wrong.
- live slots, all `v.band`: `levels` `perLevel` · `steepLevels` `steepPerLevel` ·
  `lightLevels` `lightPerLevel` · `dLdark` `dLlight` · `jumpMask` `jumpBg` `jumpDither` ·
  `run` `dithered`; and `v.dither.bg` `v.dither.mask`. MEASURED off a real render (a block
  in the generator, marked as such), not derived. The last three rows share 76 levels, so
  px-per-level cannot separate them: quote the column step.
- captions, in row order: `cap7a` `cap7` `cap7c` `cap7b` `cap8`.

---

## facts you may state (all measured this session)

```
clothoid            cubic-bezier(0.416, 0.657, 0.695, 1)
  fitted to         the two CodePens' 7 hand-written stops
  RMS               0.00071 in alpha        worst 0.0012
  ("about a third of one step in 8-bit")

blur radii          1.35 · 5.56 · 12 · 18.44 · 22.65 · 24  (24px, 6 layers, ease-in-out)
  first band by curve:  in-out 1.35 · in 1.07 · linear 4.00 · clothoid 6.16
  text illegible at    ~4px
  default is ease-in-out — hold the start, ease into the maximum

midpoint saturation, #1544C4 -> #F0B323
  srgb 12%   oklab 14%   lab 28%   oklch 63%
midpoint rgb
  srgb 131,124,115   oklab 130,136,151   oklch 214,79,145
red->green luma      srgb 101   oklab 111   (this is what oklab actually buys)

dither              per-pixel deviation, same ramp
  background-image  2.98        mask-image  0.22
banding             94 distinct levels over 190px, every terrace step exactly 1

Mass Driver pair    #F65030 -> #3050F6
  R 246->48   G 80->80 (flat)   B 48->246
  channelBlend reproduces their published output byte for byte
```

**Do not state** anything not on this list without checking. Several plausible-sounding
claims about this material are false — "oklab fixes muddy gradients" is the big one, and
this page exists partly to correct it.

---

## layout: the two weak chapters are fixed

Both were fixed before the writing pass, so the copy can describe what's actually there.

**c2 The edge** — now three panels, not two: `no scrim` · `linear` · `clothoid`. The
control is what makes the other two legible; without it the two ramps read as a small
difference in timing rather than a difference in *where the fade announces itself*. Text
is denser and the boxes taller (300px) so more lines fall inside the ramp.
New slot: `cap3a`.

**c6 Banding** — went through four shapes on 2026-09-19/20 and the copy followed each:
two bands crossing a narrow alpha range; a 2×2 with a `contrast(6)` column (dropped:
contrast pivots on 0.5 and rescaled the copy off its ground, 113→142 became 41→215, a
different picture rather than a louder one); four rows at 11 levels / 155px, which Mark
could not see a single step in, because a lone edge is below threshold and banding is
the repetition; now five rows at a density that bands. The numbers moved every time,
which is why they are slots and the brief no longer repeats them.

Two things that surfaced on the way, both worth knowing:

- an alpha ramp only has the range its **backdrop** gives it. The band sat on the
  assembled page's light default at first and spanned 2 levels, not 18 — it was measuring
  the page, not the quantisation. It states its own ground now (`.bandwrap`).
- **`.wm-dither` has to sit after whatever quantises, not under it.** Inside the masked
  element the noise modulated the ink *before* the mask touched it, and did measurably
  nothing. On the wrapper it lands on the composited result. And even there it hides the
  edge without removing the step — the column mean keeps the jump. This generalises
  beyond this page.

⚠ One caveat for whoever reviews: terraces are a 1:1 phenomenon. Screenshots that get
downscaled average them away, so judge this chapter on a real display at 100%, not from
an image in a chat.

## placeholders, if the layout grows

If a new slot is needed, add it to `COPY` and reference it as `${COPY.newkey}` in the
template. Placeholder convention for anything not yet written:

```js
  note9: `TK — one line on why the band count stops mattering past 12.`,
```

`TK` is the marker; the build does not fail on it, so grep before publishing.

---

## the sliders

The page carries the engine inlined (3.5 KB, no framework) and five native range inputs.
Nothing to write here beyond the five `ctl_*` labels, but two things to know:

- **The page is correct with JS off.** Every demo is baked at its default and the sliders
  only re-emit, so copy should describe the default state and not assume interaction.
- `build.py` rebinds `document.querySelector` to the section root and **renames ids**, so
  the script addresses everything by class and `data-` attribute. If you add a demo that
  needs wiring, follow that; an id will silently miss.
