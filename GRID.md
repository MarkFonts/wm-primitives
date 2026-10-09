# The grid

The house grid as a standard, the way InDesign has one: a page does not choose its columns, its
margin or where its baselines fall, any more than a document in InDesign chooses its own
baseline grid after the fact. `src/grid.css` states it, `src/gridSnap.js` puts what CSS cannot
place onto it, `scripts/lint-tokens.mjs` keeps a stylesheet from drifting off it, and
`tests/behaviour/grid.spec.ts` checks the rendered page. The Cal Sans case study
(wordmark.nyc/calsans) was the first page on it and is the worked example throughout.

Companion to [TYPOGRAPHY.md](TYPOGRAPHY.md) (the roles whose leadings sit on the line) and
[HOWTO.md](HOWTO.md) (wiring the package in). Shown, live, on
[the system page](https://markfonts.github.io/wm-primitives/) under 01 Type, and on the bench it
was cut on, [docs/grid.html](https://markfonts.github.io/wm-primitives/grid.html). If this page
and `grid.css` disagree, the CSS is right.

---

## 1 · The columns

**24 columns on a desktop, 12 below 1024px.**

- 24. It halves, thirds, quarters, sixths and eighths, and calsans splits its sections 5:7
  three times, which is 10 | 14 in whole columns.
- 12 below 1024. The phone's count has to divide the desktop's, so a half is still a half and
  a third still a third when the columns fold.
- **Gutter**: the pad scale's 24px, 12 below 600.
- **Margin**: `clamp(20px, 5vw, 40px)` on a phone, `clamp(32px, 7vw, 112px)` from 681px. The case
  study's own, and the same for every project: page padding belongs to the grid, not to the page.

| | 1440 | 900 | 390 |
|---|---|---|---|
| `--grid-cols` | 24 | 12 | 12 |
| `--grid-gutter` | 24 | 24 | 12 |
| `--grid-margin` | 100.8 (7vw) | 63 (7vw) | 20 (5vw, held) |
| one column | 28.6 | 42.5 | 18.2 |

`.wm-grid` is the columns plus the margin; `.wm-cols` the same columns inside a wrapper that
already has it. A child spans `--span` of the 24 and `--span-md` of the 12, starting at `--start`
/ `--start-md` (default: all of them). `--grid-col` is one column as a length, from `100cqw` (the container's content box, so
the margin is already out of it), so anything inside can measure a column without script.

**Rows share their height.** Items that share a row stretch to the tallest of them: a grid row's default
`align-items: stretch`, never a per-card height. A row of cards with ragged bottoms is a lint failure (2026-10-09).

**Cards: rule A.** A card is a box on the columns, and its contents step in one column and one
gutter, so they land on the next column line (`.wm-card`). The hanging version (B), where the box
hung outside the columns and the text sat on them, drew over its neighbours.

**Stages keep their own room.** A demo, the cube's panel, a tester: a stage insets by what it
needs, not by rule A. The case study's cube keeps its old padding, on the unit vertically, because
its rings are sized from the edge distance; its Closer Look demos inset by the gutter alone below
1024, where a column is wide enough that the card inset pushed the big words past the box (+38px
at 900).

### Pages and tools

Mark's call, 2026-10-04: **a page has the margin; a tool has none, ever.** The homepage, the Cal
Sans case study, Kernpare and the opsz proofer are pages, and keep it (and may break out of it,
below). font-proofer and ReCal are tools: they fill the window.

**Tools bleed: `.wm-grid--bleed`.** On a `.wm-grid`, or once on `main` or `body` so every grid in
the app opts in (`--grid-margin` is inherited; on `<html>` a host's own unlayered `:root
--grid-margin` would beat it, so prefer `main`). It sets `--grid-margin: 0`: the columns run the
full width, still 24 / 12, and the gutter stays.

**The one-gutter rule.** Text in a bleeding tool is never flush against the window. A child of a
bleed grid that touches a window edge pads one `--grid-gutter` on that side, worked out from the
house placement rather than left to each app:

```
start pad = gutter x max(0, 2 - start)                 one gutter when it starts in column 1
end pad   = gutter x max(0, start + span - cols)        one gutter when it ends in the last
```

(`--start-md` / `--span-md` below 1024.) An auto-placed child counts as starting in column 1, so
give a child that starts elsewhere its `--start`. Stages (`data-nosnap`) and pictures (`img`,
`video`, `picture`, `canvas`, `svg`, `[data-shot]`) are not padded. The pad is layered: a host's
own unlayered padding on the box replaces it, so put that padding on an element inside.

**Breakers: `.wm-break`, `.wm-break--left`, `.wm-break--right`.** A child of a margined `.wm-grid`
whose box runs to the window edge: it takes the margin back with a negative `margin-inline` of
`--grid-margin` on the breaking side(s) and pads it back in, so the **text in a breaker still
sits at the margin** -- a breaker is a bleed of the box, not of the words. `.wm-break` spans
everything and breaks both sides; `--left` and `--right` keep the child's `--span` (`--span-md`)
and run to their side. With both classes the modifier wins. A picture or stage breaker is marked
`data-nosnap` and gets no inner padding: it is all box. **`.wm-cols` works inside a breaker**
with nothing extra: the breaker's content box is the page's column area, so its columns are the
page's (the spec checks a half inside one ends where the page's half does). In a bleed root there
is no margin to break, and a breaker is an ordinary, gutter-padded child.

**macOS screenshots: `data-shot="mac"`.** A window captured with Cmd-Shift-4, space carries its
drop shadow as a transparent margin, so the visible window sits inside the image and a shot set
on the columns lands its window short of them. Flag it -- on an `img`, a `video`, or a
`picture` (whose `img` takes the rules) -- and the shadow is cut out of the layout: the image's
box is the window, to the pixel, and the shadow is drawn past it.

Measured on the case study's tool shots (2026-10-04; alpha >= 250 is the window, its rounded
corners are opaque and the shadow is partial alpha):

| image | file px | left | right | top | bottom | as fractions (l r t b) |
|---|---|---|---|---|---|---|
| calbuild (Terminal, native 2x) | 1666 x 1790 | 112 | 112 | 76 | 148 | .0672 .0672 .0425 .0827 |
| proofer-ui-light | 2000 x 1305 | 72 | 72 | 49 | 95 | .0360 .0360 .0375 .0728 |
| kernpare-dark | 2000 x 1308 | 72 | 72 | 49 | 95 | .0360 .0360 .0375 .0726 |
| recal | 2000 x 1305 | 72 | 72 | 49 | 95 | .0360 .0360 .0375 .0728 |

The fractions disagree between files and the pixels do not: the 2000px files are the same
112 / 112 / 76 / 148 scaled by 72 / 112 = .643 (76 x .643 = 48.9, 148 x .643 = 95.2). **The shadow
is a fixed size in points** (56 / 56 / 38 / 74 pt at 2x; it falls downward, so the bottom is
twice the top), not a ratio of the window, so a ratio measured on one shot is wrong on a window
of another size. The tokens are therefore capture px at 2x:

```
--shot-mac-l: 112   --shot-mac-r: 112   --shot-mac-t: 76   --shot-mac-b: 148
--shot-scale: 1     file px per capture px: .643 for the case study's 2000px exports, .5 for a 1x capture
--shot-w            the file's pixel width (unitless) -- gridSnap.js writes it
```

The arithmetic, with B the box the window should fill (the containing block, 100%), w the file's
width and l r t b the shadow in file px (token x scale): one file px renders at
k = B / (w - l - r), so `width = k x w` and `margin = -k t, -k r, -k b, -k l`. Percent margins
resolve against the containing block's inline size on all four sides, top and bottom included,
which is exactly B, so every term is `100% x n / (w - l - r)` and no wrapper is needed. CSS
cannot read a file's pixel width, so gridSnap.js writes `--shot-w` inline (the width attribute at
DOMContentLoaded, so a page with width/height lays out once; corrected from `naturalWidth` on
load) and the rules wait for it (`[style*="--shot-w"]`): without the script, or before it, the
plain image shows, never one sized from a guess. A margined `.wm-grid` holding a shot clips its
sides (`overflow-x: clip`, not a scroll container): on a phone the 20px margin is narrower than a
native capture's shadow, and the page must not scroll sideways for a shadow.

The snapper skips a flagged image (as if `data-nosnap`), and the spec's layout check judges its
window, not its box.

## 2 · The line

**3px.** Not a leading: a unit every leading divides into, "fractional" in the sense that 12/15
sits on a 3pt grid. Body is 16/24, eight units -- which the 1.55 it replaced (24.8) never was.

Since step 1 of the roll-out (#81) all seven roles lead on it. type.css writes each leading as
`round(nearest, <ratio>em, var(--bl))`: still em, so it follows the reader's text size, and on
the line at whatever size that is.

| role | size | leading | units | ratio |
|---|---|---|---|---|
| micro | 9 | 12 | 4 | 1.3 |
| label | 12 | 15 | 5 | 1.25 |
| ui | 12 | 15 | 5 | 1.25 |
| body | 16 | 24 | 8 | 1.5 |
| lede | 18 | 27 | 9 | 1.5 |
| title | 26 | 30 | 10 | 1.15 |
| display | 45 | 51 | 17 | 1.12 |

Display is 1.12 and not 1.1 because 45 × 1.1 is 49.5, a tie, and `round(nearest)` takes a tie up:
a leading on a tie is one browser's rounding from off the line. The parity lint refuses a ratio
whose product sits on one.

**The pad scale is not on the line, and need not be.** A component's insides are its own -- type
is tinier than space. What carries text in the flow (a chip, a button, a pill) is the exception:
its HEIGHT is in units, so a row of them is a line of type and nothing below it is knocked off.
That is why the chip, the button and the select are all 27px (TYPOGRAPHY.md, "Height follows the
type").

### What `.wm-lines` does

Inside a `.wm-lines` root, every `p`, `li`, `h1`-`h5`, `figcaption`, `.t-*` and `[data-line]`
takes its leading from `--lh` (body by default; each `.t-*` sets its own role's) and is nudged
down so its first baseline lands on a line:

```
top = mod(bl - mod(round(down, (lh - asc - desc) / 2, 1px) + asc, bl), bl) + snap
asc = round(font-asc × 1em, 1px)    desc = round(font-desc × 1em, 1px)
```

A baseline sits half the leading less the face, plus the ascent, below the top of its line box.
The browser rounds ascent and descent to whole pixels at each size and floors an odd half-leading
(lede: 27 − 20 = 7, so 3 above, not 3.5), and the nudge does both, or it lands a pixel out at
some sizes and not others. `top` on a relative box moves the glyphs and not the layout, so
nothing below the block moves.

Cal Sans's hhea is 1800 / −490 on 2000: `--font-asc: .9`, `--font-desc: .245`. A page on another
face sets those two from its own hhea (or typo, if the font sets USE_TYPO_METRICS).

The rules are **unlayered**, on purpose: type.css's `.t-*` classes are unlayered (they are its
API), and an unlayered rule beats any layered one however specific. Inside a layer, `.wm-lines
.t-ui` lost to `.t-ui` and ui sat at 16.8 instead of 15.

### The row rule: `.wm-baselines`

Side-by-side text shares a first baseline, as it would in InDesign. In a `.wm-baselines`
container, children that start in one row (same box top, within 1px) have their first text
block moved to the **lowest** first baseline in the row: a label beside its specimen, two columns
of a hero, three cards.

- `data-baseline="last"` on an item: it meets the row by its **last** line. A two-line caption
  beside one big word ends on the word's baseline instead of hanging below it.
- **Only the block being aligned moves.** The rest of the item keeps the snap it measured for
  itself. Moving the whole item put a card's bottom-anchored text 3px below its neighbour's (and
  a half-size figure's text 45px, past the card) -- the very bottom lines that should meet (#79).
  Card heights on the unit, and the bottom lines meet by layout.
- **A shift is capped at the target's font-size.** A real shift is at most the gap between two
  first lines' ascents. More means the row matched the wrong text -- a slider label instead of
  the specimen above it once pushed a paragraph 212px -- so it is refused, warned in the
  console and listed in `wmGridSnap.refused`, which CI reads.

### The row step

In a row of side-by-side text -- blocks in text roles (body, lede, title, display) that each wrap,
in two items or more -- the **smallest text lead is the row's step**. gridSnap measures it on
every pass and writes it inline as `--row-step` on each item of the row (a `.wm-baselines`
container can hold several rows; grid.css declares it unset on every item, so a nested row never
inherits an outer one's). A row with no side-by-side text has no step, and its items lose the
property. The larger text is **sized** so its lead is a whole multiple of the step; nothing at
render rewrites a leading, and [check 10](#5--the-ci-spec) reports a row whose leads do not
divide. The step is also the row's macrogrid: rules, dots, figure tops and folio marks sit on
multiples of it from the shared first baseline, `top: calc(-1 * var(--row-step, 24px))` for the
homepage caption's rule ([check 11](#5--the-ci-spec)). Write the fallback: below 1024 the
columns stack and the row has no step. Annotation roles and one-line blocks are not part of it.

### Components move whole: `--snap-unit: 1`

A slider row, a pill with a mark, a chip row: anything with a part beside its words is shifted as
one, by its first line, and nothing inside it is snapped on its own (that would pull the words off
the thumb). Set `--snap-unit: 1` on the component; it inherits, and only the outermost one counts.
A row a host made `position: relative` (to hang a guide or a badge off it) still moves: the snapper
writes the `top` on it whether it found it static or relative. Absolute, fixed and sticky boxes are
left alone.

**Inside a unit, one line of text is one baseline.** Every text run on a line of a `--snap-unit: 1`
component -- a slider row's name, tag and value; a chip row's chips -- has the same baseline as
the first run on that line, within 0.5px. The row rule above aligns siblings of a `.wm-baselines`
grid; this holds the words *inside* one component together (a rail row's value field once sat
2px under its label and every other check was green). A unit that wraps has a baseline per line,
and each line is held to its own first run. So a caption stacked under its label is on another line and is **never compared with the label**; only words that share a line are. Opt out with `data-baseline="free"` on the unit, or
on a run inside it (a caption meant to hang), and say why in a comment; `data-nosnap`,
`aria-hidden` marks and icon glyphs (`.material-symbols-outlined`, `.wm-icon`) are not text runs.

### Stages: `data-nosnap`

A subtree marked `data-nosnap` -- a demo with its own type, a cube, a tester, a poster -- is
skipped by the snapper, by grid.css and by the CI checks. grid.css's `.wm-lines` rules end in
`:not(:where([data-nosnap], [data-nosnap] *))`, so a `p` inside a stage keeps whatever leading,
position and `top` it had without the grid; no shell has to hand them back. (They used to reach
in, and the system page undid them with a `revert-layer` rule. The `:where` inside the `:not`
keeps the selector at the specificity it had: a bare `:not()` counts its argument.)

### Recommendations

Big type beside small, as rules. Each is held by a spec check where one exists (§5).

1. **Set every lead in whole 3px lines.** The line never changes, so a lead of 24, 27 or 48 is
   eight, nine or sixteen of it, and a block's later lines stay on the grid its first line was
   put on. A lead of 24.8 is on the line once and walks off by the second. Checks 2 and 3.
2. **In a row of side-by-side text, take the smallest text lead as the row's step.** The tiny
   lines next to the big lines are the row's macrogrid: a 12/24 caption beside a 45/48 headline
   gives the row a step of 24. Only text that wraps and is in a text role counts (body, lede,
   title, display). gridSnap measures the step and writes it on the row's items as `--row-step`.
   Check 11.
3. **Size the big text so its lead is a whole multiple of the step; do not loosen a lead to make
   it fit.** The homepage headline went from 36/39 to 45/48 beside a 24 caption, not to 36/48: a
   lead opened by a third looks spaced out, a size one token larger does not. Each headline line
   then lands on every other caption line. Check 10, "a row shares its lines". Between a headline and text the multiple is two or more;
   between two blocks of running text it is one -- give them the same lead.
4. **Keep one step of white around every line of the big text.** Between its lines (a baseline to
   the next line's x-height), above the block (what precedes it ends one step above its first
   x-height) and below it (the next text's x-height sits one step under its last baseline). Cal
   Sans 600 at 45/48 has an x-height of 23.9px, measured from the pixels, so the white is 24.1:
   baselines on the step lines, x-heights on the half lines. As ratios, step = size x (lead ratio
   - x-height ratio) = 45 x (1.067 - .531) = 24.1; another face or size checks that fit before it
   is adopted. Check 12, "text keeps one step of white".
5. **Put rules, dots and folio marks on the step, counted from the shared first baseline.** The
   homepage caption's rule and dot sit at -24, one caption line above the row's first baseline,
   written `top: calc(-1 * var(--row-step, 24px))`. A mark between steps reads as a slip beside
   type that is on them. Check 11, "folio elements sit on the row step".
6. **Set an eyebrow or a label on line 0 of its title, one lead above the first baseline, never
   nearer.** With the big text sized to the step its x-height sits on a half line, so the safe
   area above a title is exactly one of its leads: -48 for 45/48. An eyebrow at -30 is inside it,
   18px short. Check 12.
7. **Let annotations and one-line blocks keep their own lead.** Micro, label and ui text, and any
   block that runs to one line, share the row's first baseline and nothing after it. They are not
   part of the step, so a 9/12 note beside an 18/27 lede is no conflict.
8. **Express the margins around big text in the row step, not in em.** A headline's margin-top and
   margin-bottom are multiples of `var(--row-step)`, or of its own lead, so what follows starts on
   the macrogrid. An em margin follows the size and lands between lines.
9. **When a row's leads cannot divide, change the size, not the grid.** Nothing at render rounds a
   lead; the check reports the row. The case study's hero, a lede at 39 beside a sub at 27, is the
   standing example, listed as a known offender until the hero is re-sized.

## 3 · gridSnap.js -- what CSS cannot know

The nudge is exact for a block whose BOX starts on a line. A block below an image, an embed, a
cube or a 1px rule starts wherever those end, and nothing in CSS can know where that is. gridSnap
measures each text block's first rendered baseline after layout (a zero-size inline-block probe
before its first text) and sets `--snap` on it to the remainder, `0 ≤ snap < 3px`, which
grid.css adds to `top`. Glyphs move, layout does not, so one pass is enough.

- A **text block** is an in-flow element with a direct, non-blank text node -- or text inside
  inline children, so a specimen split into per-letter spans is still one line of type. Skipped:
  anything absolute, fixed or sticky; anything `relative` for its own reasons; `[data-nosnap]`.
- A static block the snapper has to move is made `relative` and **tagged `data-snap`**, so the
  next pass knows that `relative` is its own and measures it again. Untagged, every rerun dropped
  it. A unit row that was already `relative` gets the `top` but no tag: the position was never
  its to claim.
- A block inside another block travels with it. A link's 56px ring was measured as a block of its
  own and shifted twice.
- It **reruns** when fonts load, on `load`, when a root resizes, and on `window.wmGridSnap()`.
  Call that after a script of the page's own changes heights.
- `window.wmGridSnap.blocks` is every block the last pass measured and `.firstLine(el)` the text
  it measured by; `.refused` the row shifts it would not make; `.lines(el, lead)` how many lines a
  block's text runs to (counted from its line boxes: a grid item is stretched to its row, so a
  one-line label beside a paragraph has a box three lines tall). The CI spec reads these, so it
  judges exactly what the snapper judged.
- **The row step**: after the row rule, every `.wm-baselines` row with side-by-side text gets
  `--row-step` on its items (§2). It is only written, never used by the snapper itself.
- `--snap` is declared `initial` in grid.css and set inline. Never list it (or `--chip-color`) as
  a runtime token: three consumers lint `shared/src` with their own lists.
- **`?grid`** on any adopting page draws the columns (pink) and the 3px lines (blue) over each
  `.wm-lines` root. The lines are a canvas at the screen's own pixel density, one device pixel
  each: a CSS gradient at a fractional zoom resamples 3px stripes into smeared, unevenly spaced
  lines, which read as the type being off when it is the drawing that is. It is ONE canvas the size
  of the viewport, fixed, redrawn on scroll, so how tall the page is does not matter.

- **Shots.** Every pass writes `--shot-w` on a `[data-shot="mac"]` that has none (§1, Pages and
  tools), and skips the flagged image as a stage. The `?grid` columns take the first root's
  margin, so a tool's `.wm-grid--bleed` draws them edge to edge.

Plain script, no module: `<script src="shared/src/gridSnap.js" defer>`.

## 4 · The lint

`scripts/lint-tokens.mjs` holds the INPUTS. In a consumer's `.tokenlint.json`:

- **`lines`**: files whose text sits on the grid. In them:

  | declaration | must be |
  |---|---|
  | `line-height` | `var(--lh)`, a `var(--lead-*)`, N × 3px, or `1` |
  | `--lh` | a `var(--lead-*)`, N × 3px, or `round(<mode>, <x>, var(--bl))` (or `, N×3px)`) |
  | vertical space: `margin`/`padding` top, bottom and block, `row-gap`, a `gap`'s row, a shorthand's first and third | `0`, `auto`, N × 3px, a `var(...)`, or `round(..., var(--bl))` |

  The inline axis is not judged.
- **`linesSkip`**: a selector regex for what in those files is NOT on the line -- a demo's own
  insides. A line-based lint cannot see the DOM, so the stages are named twice: `data-nosnap` in
  the page, `linesSkip` here.
- **`only`**: run just these checks (`"scale"`, `"size"`, `"tracking"`, `"motion"`, `"lines"`).
  A site that joins the system one law at a time: wordmark.nyc runs `lines` alone.

wordmark's config is the example: `roots` and `lines` are `css/case.css`, `only: ["lines"]`,
and `linesSkip` names the cube, the waterfall, the UI kit, the tester, the deck and the pills.
On the case study as it was before the grid it flags all 73 off-line values.

## 5 · The CI spec

`tests/behaviour/grid.spec.ts` holds the OUTPUT, on every page in its `PAGES` -- the bench
(`docs/grid.html`), the system page (`docs/index.html`) and the case study (the wordmark site
checked out with `shared/` at the commit under test) the wordmark homepage and ReCal's eight compare pages (`/recalsans/<slug>/`, from `RECAL_DIST`) -- at **1440, 900 and 390** wide, 900 tall,
in Chromium. After fonts load and one more snapper pass:

1. the snapper measured more than five blocks (is it loaded, is the page `.wm-lines`?);
2. every measured block has its first baseline within 0.1px of a line;
3. every block of more than one line has a leading in whole units -- the snapper only moves first
   lines, so a 1.4 drifts from line 2 on (a planted 1.4 on the case study's prose fails here);
4. every row of every `.wm-baselines` meets within 0.25px (`data-baseline="last"` items by their
   last line);
5. nothing was refused;
6. **the layout holds** -- no box in `main` narrower than its in-flow contents (text, or visible
   in-flow children; not `scrollWidth`, which counts a handle parked outside its row on purpose),
   and no grid or flex siblings drawn over each other by more than 4 × 4px. Stages and SVG are
   skipped.
7. **the margin holds** -- every measured text block (not `data-nosnap`, not absolute or fixed,
   not inside an inset scroller) starts at or right of the root's `--grid-margin` (resolved by
   a probe, it is a `clamp()`) minus 1px, and ends at or left of the viewport minus it; text in
   a scroller that actually scrolls is judged by its start edge only. The system page opts out
   (`ownEdges`): its edges are the doc shell's rail and `--edge-l`, not `.wm-grid`. The margin is
   resolved in each block's own root. **Text in a `.wm-grid--bleed` root is judged against one
   gutter instead**, and the report line says so (`EXEMPT from the margin: N blocks in a
   .wm-grid--bleed root, judged against one gutter (24px)`); on a page whose every root bleeds,
   the margin is asserted to be 0 rather than more than 0. A breaker's box reaching the window
   edge is allowed -- only text is judged -- so the text inside one still answers to the margin.
   The layout check judges a `[data-shot="mac"]` image by its window, not its shadowed box.
8. **bleed, breakers, shots, by geometry** (`tests/fixtures/grid-bleed.html` at
   `/dial/grid-bleed.html`, which is also in `PAGES`): a bleed rail's box at x=0 and its text one
   gutter in; a `.wm-break`'s box from 0 to the window width with its text at the margin, and a
   `.wm-cols` inside it on the page's columns; a `--left` breaker keeping its span; a flagged shot's
   window equal to its cell on all four sides.
9. **units share a baseline** -- inside every `--snap-unit: 1` component (not nested in another,
   not `data-nosnap`, not `data-baseline="free"`) the text runs on one line of the unit sit on
   one baseline, within 0.5px. A run's baseline is the bottom of its Range's first client rect
   minus the face's descent (read once per font from a probe span); an `<input>`/`<textarea>`
   value, which has no text node, is read from its content box with the same descent, the line
   centred in an input and top-aligned in a textarea. Offenders print as
   `unit tag.class: "text" at Ypx vs "first text" at Ypx (delta)`.
10. **a row shares its lines** -- in every `.wm-baselines` row with side-by-side text (§2, the row
   step), every block with a lead larger than the step has every baseline on the step's lines,
   extended both ways from the row's shared first baseline, within 0.5px. Offenders print as
   `div.hero-cols: p.hero-lede "..." at 39px beside p.hero-sub "..." at 27px: 3 of 4 lines off the step (39 is not a multiple of 27)`.
11. **folio elements sit on the row step** -- in such a row, every box that is not text (a rule, a
   dot, a figure's top; not `data-nosnap`, not `data-baseline="free"`) has its top or its centre
   on a multiple of the step from the row's first baseline, within 0.5px (a rule sits by its top,
   a dot hung on it by its centre), and every item carries the step as `--row-step`. Offenders
   print as `b.rule top at -30.0px, centre at -29.5px from the row's first baseline: off its 24px step by 5.5px`.
12. **text keeps one step of white** -- around a title (a heading, `h1`-`h6`, at 24px or more; not
   an annotation), the nearest text above it in its column has its last baseline at least one step
   above the title's first x-height, and the nearest text below has its first x-height at least
   one step under the title's last baseline, within 0.5px. The step is the row's, or body's lead.
   A specimen or a figure set big in a `p` (a role sample, a card's numeral over its caption) is
   not a title. X-heights are measured from pixels, because Cal Sans's x runs from .515 em to .535
   across its axes and canvas ignores the axes: an `x` in the element's own computed font is drawn
   at up to 8x by a CSS transform (which leaves opsz alone), screenshot, and its top ink row found
   at half coverage against a zero-size baseline probe -- under 0.15px of error; it reads 23.9 on
   Cal Sans 600 at 45px, where fontTools gives 1062/2000 x 45 = 23.9.

Checks 10 and 11 report; they never fix. A row that cannot be sized yet is listed in the spec's
`KNOWN` by page and row selector, with why and what removes it, and printed as `KNOWN OFFENDER`:
the case study's hero (lede 39 beside sub 27) and the homepage's work rows (headline 39 beside caption 24, until the 45/48
headline ships). `tests/fixtures/grid-step.html` (`/dial/grid-step.html`, in `PAGES`) holds a
passing row, the exemptions and three negative cases marked `data-expect-offender`, which the
page loop excuses and a test of its own requires each check to report.

Check 6 exists because every baseline check was green while the first page on the grid was
broken on a phone (below).

## 6 · Adopting it: the checklist

In this order. Each step names the trap it was written after.

1. **Link the sheets.** `color.css`, `type.css`, then `grid.css`. A page without type.css gets the
   `--lead-*` px fallbacks; a page on another face sets `--font-asc` / `--font-desc` (§2).
2. **One `.wm-lines` root** around the copy -- `main`, usually. Lines are counted from its top;
   two roots are two sets of lines.
3. **A leading wherever there is a size.** Use the roles, or set `--lh` beside every font-size:
   a `--lead-*` token, N × 3px, or `round(nearest, Nem, var(--bl))` for fluid type. A heading left
   at `line-height: normal` inside the root gets body's 24 and a two-line 40px heading collides.
4. **Vertical space in units**: margins and paddings between text blocks, N × 3px. A 1px rule is
   fine -- the snapper puts the next block back -- but say so in a comment, and prefer 5px + 1px.
5. **Sections on the columns.** `.wm-grid`, `.wm-cols`, or a grid of your own on
   `var(--grid-cols)` and `var(--grid-gutter)`. **Every child needs a span at both counts.** The
   case study put `.look` on 12 columns and its six items had no span: below 961px they sat in one
   column each, 18px wide, their contents drawn over one another, and it shipped (2026-10-01) with
   every baseline green. Check the 12-column layout as deliberately as the 24.
6. **Size what goes in a column for that column.** When the case study's stat strip went to five
   across, its figures kept the size they had at four, and 3,000 ran out of its 228px column at
   1440; the spec's layout check caught it (2026-10-02). The figures went to `clamp(40px, 5.2vw,
   80px)`.
7. **Cards: rule A** (`.wm-card`, or `padding: var(--grid-gutter) calc(var(--grid-col) +
   var(--grid-gutter))`). Stages inset by what they need.
8. **Mark the stages** `data-nosnap`, and name them in `linesSkip`. grid.css leaves a stage alone,
   so a stage that sets no leading of its own needs nothing handed back (it used to take a shell
   rule, `revert-layer` on line-height, position and top; delete it if your shell has one). A
   table of thousands of cells is a stage too: the system page with every chapter on measured
   5,569 blocks, and one pass took 1.7s, every time `main` resized.
9. **Keep the controls out of a universal reset.** A host's unlayered `* { padding: 0 }` beats
   the controls' layered padding, so chips, buttons and selects shrank to 17px: still on a line,
   so the grid spec could not see it (found on the case study, 2026-10-02, which now leaves
   `.wm-chip` out of its reset). Leave
   `.wm-chip, .wm-btn, .wm-select` out of the reset, or put the reset in a layer below
   `wm.controls`. The controls also hold their 27px with a `min-height` that a padding reset cannot
   reach, so a page that missed this still has the height; it does not have the padding.
10. **Hidden is `display: none`.** A slideshow whose other slides stay in the flow, stacked in one
    cell, is siblings drawn over each other to the layout check -- the spec caught the case study's
    highlights doing it (2026-10-02). They show the current slide and `display: none` the rest.
11. **Components move whole**: `--snap-unit: 1` on a slider row, a chip row, a pill with a mark.
12. **Rows meet**: `.wm-baselines` on side-by-side text; `data-baseline="last"` on a caption that
    should end on its neighbour's line. Wrapping text beside wrapping text has a step (§2): size
    the big text so its lead is a multiple of it, hang rules and folio marks on
    `var(--row-step)`, and keep one step of white around every title (the recommendations).
13. **Load gridSnap.js** (`defer`), and call `wmGridSnap()` after any script of yours changes a
    height.
14. **Lint**: add the stylesheet to `lines` (and `only: ["lines"]` if the site is not on the rest
    of the system yet).
15. **CI**: add the page to `PAGES` in `tests/behaviour/grid.spec.ts`.
    **A page or a tool?** A tool puts `.wm-grid--bleed` on `main` (one gutter from the window,
    never flush, never a margin) and gives each edge child its `--start`; a page keeps the
    margin and breaks out of it with `.wm-break`. A macOS window screenshot gets
    `data-shot="mac"` and, if it was resized after capture, its `--shot-scale`.
16. **Look** at every section at 390, about 800 and 1440, and at a short phone (660-740px of
    visible height), with `?grid` on. The checks test the line and a coarse layout; they do not
    test whether it looks right, and Closer Look broke at the two widths nobody looked at.

## 7 · Known limits

- **Side-by-side text: a lead and size rule, not a grid change.** The baseline grid is 3px and
  never changes. In a row of side-by-side text (text roles body, lede, title and display, each
  wrapping), the smallest text lead is the row's step, and the larger text is sized so its lead
  is a whole multiple of it: the homepage's headline 45/48 beside a 24 caption. Tiny lines next
  to big lines become the macrogrid for rules and other folio elements, which sit on multiples
  of the step from the row's shared first baseline (the homepage caption's rule and dot at -24).
  Annotation roles (micro, label, ui) and one-line blocks are unchanged: on the 3px line, first
  baseline shared by the row rule, not part of the step. It is enforced by the spec (checks 10 and
  11), never by rounding at render; where a row's leads do not divide, the check reports it.
- **One step of white around every line of the big text.** With the headline sized to two steps
  (45/48 beside 24), Cal Sans's x-height (23.9px at 45, 600) leaves 24.1px from one baseline to
  the next line's x-height: one step, so baselines fall on the step lines and x-heights on the
  half lines. Between its lines, above the block (the previous element ends one step above its
  first x-height) and below it (the next text's x-height sits one step under its last baseline).
  So a headline's margin-top and margin-bottom are expressed in the row step (`var(--row-step)`
  multiples), not in em. It holds for Cal Sans at the 2x sizing (lead / x-height ratio about
  1.07 / .53); another face or size checks the x-height-to-step fit before adopting a size.
  `tests/fixtures/grid-step.html` draws it: a 45/48 stage with the step lines, the half lines
  and the x-height.
- **Known offenders.** The case study's hero (lede 39 beside sub 27) stays as it is for now and is
  listed in the spec's `KNOWN`, and so are the homepage's work rows until the 45/48 headline
  ships. The grid bench's hero is not: its 18/27 lede has 16/27 notes beside it, the same lead.
- **The system page is on the columns; most of it is not on the line.** The shell is the house
  grid with the house margin -- the rail on 5 of the 24, one empty column, the content from column 7
  to the margin (12 and a top bar below 1024) -- with sections still capped at a 1080px measure.
  Only the README, the section numbers and the Grid part are on the line; the other chapters are
  stages (docs/system/build.py, `OFF_LINE`, says what each would need). The spec still opts it out of
  the margin check (`ownEdges`), and the check would judge nothing there now anyway: `<main>` sits
  in the zoom control's `overflow-x: auto` pan box, which the check treats as an inset scroller.
  G and L toggle the columns and the lines on it at any time.
