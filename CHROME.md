# The chrome census: buttons, selects, labels, marks

Counted 2026-09-19 across wm-primitives, font-proofer, ReCal, opsz-proofer and Kernpare
(`scripts/`-free: a regex over each app's own CSS and markup, shared/ excluded). The
sliders have [SLIDERS.md](SLIDERS.md); this is the rest of the chrome, and it is the
next slider-sized job (NEXT.md C).

## Buttons

Rules whose selector names a button (`button`, `-btn`, `.btn`):

| app | rules | what most of them are |
| --- | --- | --- |
| wm-primitives | 63 | `.wm-icon-btn` (the mark), `.ui-seg > button` (the pill), the dial's and triplet's steppers, `.fit-align-btn` |
| font-proofer | 63 | `.mode-btn`, `.align-btn`, `.styles-toggle-btn`, `.calcom-clock-btn`, `.text-tab` … |
| ReCal | 50 | `.rail-preset`, `.style-menu-btn`, `.freezer-reset`, `.mode-btn`, `.chip`, `.export-btn` … |
| Kernpare | 16 | `#actions button`, `.mgrid button`, `#savestate button`, `.seegrp`, `#unpin` |
| opsz-proofer | 4 | `.seg button` (a one-of-N) |

**Three buttons exist, and the system had named two.** The *mark* — all target, no
face — is `.wm-icon-btn` in `icon.css`. The *pill* — one of N — is `.ui-seg` in
`toggleGroup.css`. The third, drawn most often and named never, is the **boxed
button**: a surface, a hairline, the house corner, quiet ink that fills on hover, a
raised state for the chosen one. font-proofer's `.mode-btn`, ReCal's `.rail-preset` and
`.style-menu-btn`, Kernpare's `#actions button` and `.mgrid button` are all that button
with their own padding (`5px 8px`, `6px 8px`, `3px 7px`, `1px 8px`) and radius (`4`, `5`,
`6`). As of this census it is **`.wm-btn`** in `src/button.css` — `.active`, `--solid`
for the one primary action, `--quiet` for a row of secondary ones. Kernpare and
opsz-proofer adopted it in the same commit; the retirement list for the two big apps is
below.

What is *not* the boxed button and stays its own: the steppers (a mark with a chevron),
`.text-tab` and `.mode-btn-row` (a tab strip — a fourth thing, uncensused), and every
button in Kernpare's kern-group modal (styled on purpose, never normalised).

## Selects

| app | native `<select>` | wrapper | chevron |
| --- | --- | --- | --- |
| font-proofer | 3 | `.instance-select-wrap` | `<Chevron>` |
| ReCal | 3 | `.rail-preset-wrap` | `<Chevron>` |
| Kernpare | 1 | `.sel-wrap` | the path, inlined |

One fix, three names — `appearance: none`, a positioned wrapper, the mark hung off it
at the right edge with `pointer-events: none`. Now `.wm-select-wrap` + `.wm-select` in
`src/select.css`; the three wrappers are retired in this commit.

## Section labels, tags, chips

Rules that set `text-transform: uppercase` (the tell of a label role):

| app | rules | `t-label` uses |
| --- | --- | --- |
| wm-primitives | 8 | 3 |
| font-proofer | 4 | 0 |
| ReCal | 21 | 0 |
| Kernpare | 4 | 0 |
| opsz-proofer | 0 | 0 |

`t-label` — micro size, caps tracking, quiet ink — exists in `type.css` and no app uses
it; each writes the same three declarations under its own name (`.section-label`,
`.sect`, `.freezer-section-title`, `.gg-geom-axis-label` …). ReCal's 21 are the debt.
Not retired here: that is a per-rule judgement (some of the 21 are chips, some tags,
some genuinely labels) and belongs to the same pass as the tab strip.

## Marks

Generated into [COMPONENTS.md § Marks](COMPONENTS.md#marks): 12 names drawn, all in
font-proofer (ReCal draws none; Kernpare and opsz-proofer draw the theme switch's three
through the bundle, which the scan reads as font-proofer's). The subset font carries 24.

## ◆

The vocabulary said diamond after the stock marker became a foot tick (CHANGELOG
2026-09-13). Retired in this commit: the dial's `marker` prop (no consumer passed it),
and ReCal's four visible glyphs — the rail's "◆ your defaults", the YOUR tag, the pin
row's `::before`, the Info "yours ◆". Code comments that call the defaults layer ◆
stay: that is the layer's name in the code, and renaming a concept is not this commit.

## Corners

The house corner is `src/corners.css`: `corner-shape: superellipse(1.2)` on every rounded
corner, circles and the font-proofer mimics opted out. Since 2026-11-23 there is a second law
behind a flag, **eased**, which Mark picked from the rendered G2 audit and the live corner
bench. It is off by default: without the flag nothing changes a pixel.

**The flag.** `<html data-corners="eased">`. The system page opens with it on at
`?corners=eased`, and the corner law chapter has a Today / Eased toggle that flips the whole
page. Apps opt in by setting the attribute (and importing `src/corners.js`, or `wmCorners`
from the barrel, beside `corners.css`).

**Rects** keep `superellipse(1.2)`; every radius grows by 12.5% (`--corner-scale: 1.125`;
8px → 9px, 6px → 6.75px). That puts the 45° point back on the original circle and moves the
tangent nodes inward, so the curve eases into the original corner depth instead of a squircle
bulging into the same box. Every primitive's radius is written
`calc(<r> * var(--corner-scale, 1))`; a concentric outer radius scales only its inner part
(`.wm-menu-seg`: `r * scale + 3px`). Renders in Chrome 139+ and Safari 27.3 (beta);
elsewhere plain round, the accepted fallback.

**Pills** (every corner at least half the short side, on a box that is not square) cannot be
done with `corner-shape`: any superellipse above 1 flattens the nose (curvature 0 at the
extreme). They get an eased cap, chosen by its **choke**: L : (h/2), where L is the distance
from the pill's end to where the curve leaves the straight. A round cap is 1:1. The depth never
changes (the nose touches the end, the cap is h/2 deep, the CSS radius stays h/2); only the choke
moves, and it is one number for every pill:

    ratio = 1.2   (L = 0.6 h from the end, at every height)

Mark chose it fixed. (A ramp, 1.3:1 at 24px tall easing to 1.15:1 at 96px, was built first and
replaced.) Per quarter the cap is a
straight, a linear curvature ramp (length T), a circular arc (radius R) and the nose, G2
throughout. For unit R, T is bisected in [0, π] until the end's x/y equals the ratio, then the
curve is scaled so y = h/2. It is drawn with `clip-path: shape()` (Chrome 135, Safari 18.4,
Firefox 148; elsewhere plain round), three cubics per quarter, built by `corners.js`
(`pillRatio`, `pillCap`, `pillShape`) and cached by ratio, so a page holds one shape per axis. The fit
is within 0.015px of the exact curve at 96px tall; `node scripts/gen-pill-shape.mjs --check`
audits it.

**The clip is not the pill.** A clip-path clips everything the element paints: border,
box-shadow, outline, children. So the clip is *everything except the sliver between the round
cap and the eased one*: evenodd of a box 4000px past the element, the round stadium (exact
arcs), and the eased stadium. The pill underneath is forced to `corner-shape: round`, so its
own fill is the round stadium, and the clip shaves it to the eased one. The eased cap lies
inside the round one everywhere, by at most 0.003 h at the 1.2 choke (0.07px on a 24px pill,
0.29px on a 96px one), so:

| paint | what happens under the flag |
| --- | --- |
| fill | the eased cap, exactly (pixel-diffed against the bench's own clip: 4× closer than round at 200px) |
| border, inset press ring, confirm blink | drawn by the engine on the round curve; the clip trims their outer edge to the eased one (≤ 0.003 h) |
| focus ring (`outline`, any offset ≥ 0) | **not clipped**: it lies outside the round box, which the clip keeps whole. Still the engine's round ring, 2px off the body |
| box-shadow, a ring of ground (`.wm-hd-pill`), the accent pill's spill | not clipped, same reason |
| children that overhang the box | not clipped, except where they cross the sliver |

So there is no per-component pattern: no wrapper, no pseudo-element border, no drop-shadow
move. Rejected on the way: clipping the element to the eased pill (kills rings, shadows and
the accent spill, and needs a second mechanism for each); a pure-CSS `shape()` (x
percentages resolve against the width, so the cap's x needs the height as a length — no CSS
unit gives an element its own height without containing its size); a `mask` with
height-scaled cap images (pure CSS and height-independent, but a mask clips the ring and the
shadow exactly as a clip does, and the accent button's HDR light must never pass through a
mask).

**`corners.js`** finds the pills, because "pill" is a numbers decision, not a class: radius
≥ half the short side, long side ≥ 1.2 × short (shorter and the two caps would
cross), short side ≥ 8px (below that the eased cap is within 0.03px of round). It marks
`data-wm-pill="x" | "y"` with `--pill-s` and `--pill-clip` (the `shape()` for that height; a
vertical pill, like a grip, is `y`), and a pill `::before` / `::after` on its host as
`data-wm-pill-b` / `data-wm-pill-a` with `--pill-s-b` / `--pill-clip-b` (and `-a`). A ResizeObserver on every rounded element and a
MutationObserver for added nodes and class changes keep the marks true; style writes are
ignored (sliders write `--pct` every frame). A size a frame stale moves an almost invisible
sliver. Without `shape()` support corners.js marks nothing, so a pill keeps today's corner (a
`var()` clip is valid at parse time and would otherwise blank a clip a component sets itself). Opt out with `--pill-ease: off` on an element, a subtree or a pseudo-element (the
mimics carry it). Without `corners.js` a pill keeps today's corner.

**The cap rule** (space.css) under the flag is `padding-x ≥ 0.7 r` for both shapes. On the
pill at the 1.2 choke, 95% of the height is reached at 0.71 r and 99% at 0.91 r (round: 0.69 r and 0.86 r).

Spec: `tests/behaviour/corners.spec.ts` (C1–C6) on `tests/fixtures/corners.html`.

## Retirement list

Each is a class → `.wm-btn` (or `.wm-select`) swap plus deleting the app's rule.

- **font-proofer**: `.mode-btn` (+ `.mode-btn-row` stays as the strip), `.calcom-clock-btn`,
  `.tray-btn`; selects: `.instance-select` ×3 → `.wm-select`.
- **ReCal**: `.rail-preset` → `.wm-select`; `.style-menu-btn` → `.wm-btn` (its inverted
  hover is `--solid`'s look, so decide whether the hover inverts or the button is solid);
  `.freezer-reset` → `.wm-btn` + `t-label`; `.export-btn` → `.wm-btn--solid`.
- **Kernpare**: done here.
- **opsz-proofer**: `.seg` → `.ui-seg`, done here.
