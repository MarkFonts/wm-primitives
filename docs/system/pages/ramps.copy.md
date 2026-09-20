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

36 total. `title`, `lede`, `c1..c6_title`, `c1..c6_tag`, `note1..8`, `cap1..8`, `cap3a`,
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
- on screen: two prose panels, `start 0` vs held — with `radius` / `layers` / `hold`
  sliders. Both stacks rebuild; only the right one takes the hold.
- `note5` — tiled bands not a cumulative stack (which **ghosts**: a blurred copy over the
  still-sharp original, a double image on live text). Bands evenly spaced, only the radius
  follows the curve. `start` holds the first lines.
- `note6` — the limitation. Blurs pixels, does **not** redact. Still selectable, copyable,
  findable, read aloud in full. Never use to withhold anything. **Keep this blunt.**
- live slot: `${radii.join(' &#183; ')}`

### c6 · Banding
- on screen: **two full-width bands stacked**, undithered then dithered, over a stated
  dark ground, with a `dither` slider on the second — at 0 the terraces come back
- `note7` — ~94 of 256 levels over 190px ≈ 2px per level. More stops **cannot** help.
- `note8` — Skia dithers a background gradient and near-as-nothing a mask. So a scrim is
  dithered for you; a mask over a flat ground is not.
- the demo now crosses a narrow alpha range over a wide box, so the terraces are tens of
  pixels wide. Copy may point at them directly.

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

**c6 Banding** — now two full-width bands stacked, crossing a *narrow* alpha range
(.5 → .58) instead of the whole range over a short box. Same quantisation, given room:
**19 levels across 1050px, widest terrace 126px.** Dithered, the widest run collapses to
**10px**. Captions `cap7` `cap8` rewritten to match.

Two things that surfaced while fixing it, both worth knowing:

- an alpha ramp only has the range its **backdrop** gives it. The band sat on the
  assembled page's light default at first and spanned 2 levels, not 18 — it was measuring
  the page, not the quantisation. It states its own ground now (`.bandwrap`).
- **`.wm-dither` has to sit after whatever quantises, not under it.** Inside the masked
  element the noise modulated the ink *before* the mask touched it, and did measurably
  nothing: 19 terraces either way, 126px widest in both. On the wrapper it lands on the
  composited result. This generalises beyond this page.

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
