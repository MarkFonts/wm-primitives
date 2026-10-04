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
/ `--start-md` (default: all of them). `--grid-col` is one column as a length, from `100cqw`, so
anything inside can measure a column without script.

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

### Components move whole: `--snap-unit: 1`

A slider row, a pill with a mark, a chip row: anything with a part beside its words is shifted as
one, by its first line, and nothing inside it is snapped on its own (that would pull the words off
the thumb). Set `--snap-unit: 1` on the component; it inherits, and only the outermost one counts.
A row a host made `position: relative` (to hang a guide or a badge off it) still moves: the snapper
writes the `top` on it whether it found it static or relative. Absolute, fixed and sticky boxes are
left alone.

### Stages: `data-nosnap`

A subtree marked `data-nosnap` -- a demo with its own type, a cube, a tester, a poster -- is
skipped by the snapper, by grid.css and by the CI checks. grid.css's `.wm-lines` rules end in
`:not(:where([data-nosnap], [data-nosnap] *))`, so a `p` inside a stage keeps whatever leading,
position and `top` it had without the grid; no shell has to hand them back. (They used to reach
in, and the system page undid them with a `revert-layer` rule. The `:where` inside the `:not`
keeps the selector at the specificity it had: a bare `:not()` counts its argument.)

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
  it measured by; `.refused` the row shifts it would not make. The CI spec reads these, so it
  judges exactly what the snapper judged.
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
checked out with `shared/` at the commit under test) and the wordmark homepage -- at **1440, 900 and 390** wide, 900 tall,
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
    should end on its neighbour's line.
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

- **Side-by-side columns with different leadings drift after line 1.** The row rule meets first
  baselines; a body column beside a lede column shares every third line and no others. An open
  design call (the case study's hero).
- **The system page is on the line but not on the columns.** Its layout is still the rail and a
  1080px measure; only the README, the section numbers and the Grid part are on the line, and the
  other chapters are stages (docs/system/build.py, `OFF_LINE`, says what each would need).
