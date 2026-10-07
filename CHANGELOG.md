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

## 2026-10-06 -- the bench hero follows its own rule

**The grid bench was the one page in the docs that broke the row rule it teaches.** Its hero is
a lede (18/27) beside 16/24 notes: 27 is not a multiple of 24, so four lines in five missed the
notes' lines, and it sat in the spec's `KNOWN` as "the case-study hero in miniature". Fixed the way
the Recommendations say (3: size the big text, do not loosen a lead): the lede is now 45/48, two
steps, the homepage headline's sizing, set page-local (`.hero-lede`; type.css has no 48 role and
display's 45/51 is not a multiple of 24). The other option, a notes lead that divides 27, only
exists at 9, which is too tight to read. First baselines still meet; the eyebrow and labels stay
outside the safe area (check 12 passes). The `KNOWN` entry is gone; the hero is now a passing
example, nine lines at 1440 where there were four, which is what 45px costs.

## 2026-10-06 -- the row step: sized leads, folio elements on the step

**Side-by-side text drifted after line 1, and the fix was going to be a runtime rounding.** A
lede at 39 beside a sub at 27 shares one line in three; the homepage's headline at 39 beside its
caption at 24 shares almost none. The draft before this (#96) rounded the larger lead up to a
multiple of the smaller at render, and the Cal Sans lede went to 54, which spaced out a face with
short ascenders and tight letters. Settled instead as a lead and size rule: the baseline grid is
3px and never changes; in a row of side-by-side text the smallest text lead is the row's step,
and the larger text is SIZED so its lead is a whole multiple of it (the homepage headline 36/39 ->
45/48 beside a 24 caption, not 36/48). Nothing rewrites a leading. The small lines are the row's
macrogrid: rules, dots and folio marks sit on multiples of the step from the shared first
baseline (the caption's rule and dot at -24).

`gridSnap.js` measures the step on every pass and writes it as `--row-step` on each item of a
`.wm-baselines` row with side-by-side text (grid.css declares it unset per item, so a nested row
never inherits). `grid.spec.ts` gains three checks: **a row shares its lines** (#96's check, kept
as the enforcement, with the step taken from the row and its lines from the row's shared first
baseline), **folio elements sit on the row step** (a non-text box's top or centre within 0.5px of
a step line, and `--row-step` published), and **text keeps one step of white** (around a
title, the text above and below keeps one step from its x-height). The x-height is read from
pixels: Cal Sans's x runs .515-.535 em across its axes and canvas ignores axes, so an `x` in the
element's own font is drawn at 8x by a transform, screenshot and scanned; it reads 23.9 at 45px
600, as fontTools does (1062/2000). With 45/48 that leaves 24.1 of white between a baseline and
the next x-height: one step, x-heights on the half lines. The recommendations that follow from it
are nine numbered rules, in GRID.md §2 and in the system page's Grid part as a chapter after
Baseline.

Known offenders, listed by page and row in the spec's `KNOWN` and printed, not failed: the Cal
Sans hero (39 beside 27; it stays for now), the grid bench's hero (drawn after it, 27 beside 24)
and the homepage's work rows (39 beside 24 until wordmark ships 45/48). On the docs the safe-area
check finds nothing to move: no title on the system page or the bench has text inside one step.
`tests/fixtures/grid-step.html` replaces #96's grid-lead fixture: a passing 45/48 row with its
rule and dot, a one-line byline and a micro note (no step), and negative cases the spec requires
it to report -- 39 beside 27, a rule at -30 in a 24 row, an eyebrow 30px over a 45/48 title --
plus a drawn stage of the step lines, half lines and x-height. Docs rebuilt (`docs/grid.html` and
`docs/index.html` inline gridSnap and grid.css); the system page also gains the chapter, which
shifts the Type part's later chapter anchors by one.

## 2026-10-06 -- the row rule grouped columns by where the nudge left them

**The Cal Sans hero's lede and sub sat three px apart at 1024 and the row rule never ran.**
`gridSnap.js` finds a `.wm-baselines` row by grouping children on `getBoundingClientRect().top`
within 1px. A column that is itself the text block (a `p.t-lede` beside a body `p`) carries
grid.css's baseline nudge as a relative `top`, up to 2px and different for different leads, so two
columns whose boxes start on one row landed in two groups and each was alone. It was fine at
1440, 900 and 390 only because the nudges happened to agree or the columns had stacked. The key is
now the box's top BEFORE the nudge: `rect.top` less the child's own computed `top` when it is
`position: relative`. That is exact, where widening the tolerance to the 3px unit would also have
merged rows that really are one line apart. The spec's "a row meets" check grouped the same way
and so could not see the miss; it takes the same pre-nudge key. `tests/fixtures/grid-row.html`
(a lede beside a `t-micro` note, nudges 4px and 0px) failed it on main, first baselines 15px
apart at 1440 and 1024, and passes now. 1024 joins `WIDTHS` in `grid.spec.ts`, so every page on
the grid is held where the 24 columns begin. gridSnap is not in `dist/`; the docs were rebuilt
because `docs/grid.html` and `docs/index.html` inline it, and only that hunk changed.

## 2026-10-05 -- the system page's baseline rule was scoped twice

**The `browser` job went red on main when the docs were rebuilt.** The "A component moves whole"
demo in `docs/system/pages/grid.html` carried `#s-type .part-1 .gx-srow.whole > span,...` as a
hand-written, already-scoped selector. `build.py`'s `scope_selector` prefixes every selector of a
comma list with the section and part, so a rebuild turned it into `#s-type .part-1 #s-type .part-1 ...`,
which matches nothing. The value lost `align-self: baseline`, fell back to centre and sat 4px above its
label (`grid.spec.ts` check 9, system page at 1440/900/390). The committed `docs/index.html` had
been patched to the single prefix by hand, so it was green until the bot's "rebuild docs for a font
bump" regenerated it from the source. The source now writes the bare `.gx-srow.whole > span,
.gx-srow.whole > output` like every other rule in the file, and the prefixer is left alone: a source
page is unscoped CSS, and a rule that scopes itself is the bug. A rebuild is stable (two runs, same
bytes) and changes only that one rule in `docs/index.html`.

---

## 2026-10-05 -- `--grid-col` no longer takes the margin off twice

**Every `.wm-card` in a `.wm-grid` started about 8px short of its column line.** `--grid-col` was
`(100cqw - 2 * --_m - gutters) / cols`. But `.wm-grid` is a size container with
`padding-inline: var(--grid-margin)`, and `cqw` measures a container's *content* box -- the margin
is already out of it. So the margin came off twice: at 1440 a column computed 20.2px against a real
28.6px, and a card's padding (one column + one gutter) landed 8.4px before the next column line.
`.wm-cols` has no padding and was right all along, which is why nothing looked wrong in the
breakers. The fix drops `2 * var(--_m)` and the two `--_m` declarations; the comment that said
"margins included" was the wrong belief written down. `tests/behaviour/grid.spec.ts` now reads
`--grid-col` through a `width: var(--grid-col)` probe inside a `.wm-grid` and a `.wm-cols` and holds
it to a real grid track, at 1440 and 390; it fails on the old formula (20.19 vs 28.59, 14.83 vs
18.16). Consumers: `wordmark/css/main.css` already measures a column from `100cqw` itself because
of this; once shared/ is bumped that local copy can go back to `--grid-col`.

---

## 2026-10-04 -- the grid spec checks that a unit's words share a baseline

**A rail row's value field sat 2px under its label and nothing noticed.** The row rule
(`.wm-baselines`) aligns siblings, and gridSnap moves a `--snap-unit: 1` component whole by its
first line -- so nothing ever looked at the words *inside* one. `tests/behaviour/grid.spec.ts` now
does (check 9 in GRID.md section 5): inside every unit, runs on one line of the unit have the same
baseline within 0.5px, unless the unit or run is `data-baseline="free"`. Baselines are measured, not
inferred from boxes: the Range's first client-rect bottom less the face's descent (one probe per
font); input values are read from their content box. A wrapped unit is judged per line.
It found the first offender on its first run: the system page's "component moves whole" slider
row, whose value was centred beside a 26px label (4px up); fixed with `align-self: baseline` on
the label and output. The real source of the rail drift is `.slider-label`, now a two-column
grid on `align-items: baseline` (`AxisSlider.css`, and `alignment.spec.ts` gains "a dial row is
one baseline"). The skip clause strips the first path segment for any host, and
The bleed-gutter lines in `alignment-lines.json` land with the two app pages, after the app PRs merge.

## 2026-10-04 — the arrows join the icon face

89 names. The case study's Highlights slideshow gets back/next buttons drawn from the face:
chevron_left and chevron_right, with arrow_back and arrow_forward in the same cut. Re-cut with
`scripts/cut-icon-subset.py chevron_left chevron_right arrow_back arrow_forward`, which also
moved the face URL to ?v=89.

## 2026-10-04 -- pages keep the margin, tools bleed, breakers, and the macOS shadow

Mark's call: the homepage, the case study, Kernpare and the opsz proofer are pages and keep the
margin (and may break out of it); font-proofer and ReCal are tools and have none, ever. Three
additions to `src/grid.css`, written up in GRID.md under "Pages and tools":

- **`.wm-grid--bleed`**, on a grid or once on `main`: `--grid-margin: 0`, columns edge to edge,
  gutter kept. Text is still never flush: a child touching a window edge pads one gutter on that
  side, computed from its `--start` / `--span` (`max(0, 2 - start)`, `max(0, start + span -
  cols)`), not left to each app. An auto-placed child counts as column 1 -- the one guess, and
  the rule names it.
- **`.wm-break`, `--left`, `--right`**: a margined grid's child whose box runs to the window, its
  text padded back to the margin. `.wm-cols` inside one lands on the page's own columns for
  free, because the breaker's content box is the page's column area.
- **`[data-shot="mac"]`**: the window screenshot's shadow cut out of the layout. Measured on the
  case study's shots: a native 2x capture carries 112 / 112 / 76 / 148 px of shadow (l r t b),
  and its 2000px exports carry 72 / 72 / 49 / 95 -- the same pixels scaled by .643, while the
  fractions of width differ (.067 against .036). So the tokens are capture px, not a ratio, and a
  resized file states `--shot-scale`. Percent margins resolve against the containing block's
  width on all four sides, so `100% x n / (w - l - r)` sizes and shifts the image with no
  wrapper; gridSnap.js writes the file width the CSS cannot read, and the rules wait for it.

The grid spec judges a bleed root's text against one gutter and says so in its report, judges
breakers' text (not their boxes) against the margin, and judges a flagged shot by its window. A
new fixture, `tests/fixtures/grid-bleed.html`, is in `PAGES` and has a geometry test of its own.
The system page's Grid part gains "Breakers and tools", two more 1440 sheets with the
font-proofer shot on columns 11-24; the bench gains a breakers section. The first cut of the
sheets put everything past column 24: the overlay's column `<i>`s fill every cell, so an
auto-placed item is pushed into implicit columns, and a 390 viewport re-placed the 1440 sheet
on `--span-md`. Each sheet item now names both.

## 2026-10-03 -- the grid spec checks the margin, and the homepage joins it

**The copy at x=0 passed.** The wordmark homepage's unlayered `* { padding: 0 }` reset beat the
layered `.wm-grid` padding-inline, so the text sat flush against the window edge and every
baseline, row, refusal and layout check stayed green -- they judge heights and overlaps, never
where the column starts. `tests/behaviour/grid.spec.ts` now resolves `--grid-margin` (a probe
`div` of that width, since it is a `clamp()`) and asserts every block gridSnap measured has its
text inside it, left and right, reporting `tag.class at Xpx, margin is Mpx`. With the reset
injected into the homepage the spec fails at all three widths (text at 0px, margin 20px at 390).
The homepage is a fourth page in `PAGES`. The system page opts out of the margin only: its edges
belong to the doc shell (a rail at 1440, 20px below 1080), and its copy is on the line, so
`data-nosnap` was not an option. The first cut also flagged every card of a full-bleed
carousel for ending 4,000px right of the viewport; text in a scroller that really scrolls is
now judged by where it starts.

## 2026-10-03 — the dial's hairline stops at the lozenge; the lozenges are one width

Two looks from a screenshot of three vertical dials at their minimums. The rail's hairline ran the
whole rail, so at min it ran on below the pill and poked out under the ground ring; it now runs from
the lozenge's centre at min to its centre at max (`inset-block` / `inset-inline` from the same
--hd-inset knobs that stop the lozenge), so the pill always covers the line's end. That exposed the
inset itself: 12px was a guess, and the pill is not the 20px it was assumed to be -- a text input
takes its face's own line box (15px for system-ui at 12px), so the input is now pinned to 1.25em
and the inset is arithmetic: 15px, 17px on touch (the comment at :root has the sums).

The other: the lozenge was `field-sizing: content` with a 2.25ch floor, so "0" was a stub, "0.00"
was wide, and a value gaining a digit made the pill breathe as it moved. dialHandle.js now sets
--hd-chars on each lozenge, the longest of fmt(min), fmt(max) and "auto", and the input floors at
that many ch. Widths differ BETWEEN dials by design (each is as wide as its own range) and are
constant within one; content sizing stays so a longer typed value still fits. Case-study axes: wght
3, GEOM 3, opsz 4 (it has an auto, and "auto" is four characters), YTAS 4, SHRP 3, ital 4.
`--hd-chars: initial` is declared like --chip-color so token lints do not fail on a runtime var.
tests/behaviour/dial-handle.spec.ts holds both, on tests/fixtures/dial-handle.html.

## 2026-10-03 — the icon face's URL follows its glyph count

`visibility` rendered as a "V" on wordmark.nyc the day it joined the face: the subset is re-cut
under the same file name, so browsers and the Pages cache kept the old one, which has no such
ligature. The URL is now `MaterialSymbolsOutlined.woff2?v=85`, the ligature count. A cut that adds
a name changes the count, so `cut-icon-subset.py` rewrites the query in src/*.css as it writes the
faces, and `lint-icons.py` fails when the two disagree. The cost is a rule that only moves when
the count does: a cut that swaps one name for another would need a manual bump.

---

## 2026-10-02 — four grid follow-ups: a relative unit row moves, ?grid on a tall page, stages out of grid.css, the reset trap

**A unit row a host made `relative` now moves.** gridSnap.js wrote `top` only on a `--snap-unit: 1`
row it found `position: static`, so a row positioned for its own guide or badge never moved; the
docs demo carried `.gx-srow.whole{top:var(--snap,0px)}` to cover for it. The write now always
puts the shift on a static or relative row (static ones are made relative and tagged `data-snap`
as before; a host's relative one gets the `top` and no tag), and leaves absolute, fixed and sticky
boxes alone. The workaround is gone; the demo's right-hand row still moves whole, and its caption
prints the shift (2.66px at 51px above, 1.66px at 52).

**`?grid` draws its lines on a page of any height.** The baseline canvas was the height of the root
and went blank past 65,535 device pixels -- the system page is ~47,000px, so 2x was dark. It is now
one fixed canvas the size of the viewport, redrawn on scroll with each root's lines offset from
the root's current top. At 1440 x 2, scrolled to the bottom (scrollY 46,448), mid-page and the top,
the canvas has a line every 6 device pixels (3 CSS px) in every case.

**grid.css no longer reaches into a stage.** The `.wm-lines :where(...)` rule (line-height,
position, top) and the `.t-*` `--lh` rules end in `:not(:where([data-nosnap], [data-nosnap] *))`.
build.py's shell had to undo them with a `revert-layer` rule; that rule is deleted, and GRID.md §6
no longer tells adopters to add it. The `:where` inside the `:not` is deliberate: a `:not()` counts
its argument, so a bare `:not([data-nosnap] *)` would have lifted the rule from (0,1,0) to (0,2,0)
and a page's `.card p` would have stopped outranking it. The system page's stage chapters
(472 elements at 1440 and at 390: rect, leading, position and top) are identical before and after.

**The universal-reset trap, recorded and held.** A host's unlayered `* { padding: 0 }` beats the
controls' layered padding, so chips drew 17px tall and still sat on a line, which the grid spec
cannot see (the case study, which now leaves `.wm-chip` out of its reset). Written into chip.css's
header and GRID.md's checklist (step 9): leave `.wm-chip, .wm-btn, .wm-select` out of the reset, or
put the reset in a layer below `wm.controls`. Three ways to survive it were weighed: (a) a note
alone changes nothing for the page that never reads it; (b) `padding-block`/`padding-inline` lose
to a universal `padding: 0` all the same; (c) `min-height`, in the layer beside the padding, which
no padding reset touches. Chosen: (c) plus the note. chip, button and select declare `box-sizing:
border-box; min-height: 27px` (the small chip 18px), the same number the padding computes to, so
nothing moves where the padding survives. It keeps the HEIGHT on the line, not the padding: a
reset page gets the box and a label flush against its hairline, which is why the note stays the
fix. tests/behaviour/line.spec.ts has a second test, the same fixture plus an injected
`* { padding: 0; margin: 0 }`, asserting 27 / 18 / 27 / 27 (33 and 45 on touch); it failed at 17
before the change.

## 2026-10-02 — visibility and visibility_off join the icon face

85 names. The case study's census card draws the eye over "1.4M views" at 72px, wght 100,
opsz 48, FILL 0, the way the bookmark sits over "12.6K bookmarks". visibility_off came along
because it is the same cut. Re-cut with `scripts/cut-icon-subset.py visibility visibility_off`.

## 2026-10-02 — the grid is a standard; the system page is on its line

Grid roll-out, step 2. GRID.md says what the grid is the way InDesign would: the columns and
why 24 and 12, the line and the seven leadings on it, what `.wm-lines` computes and why the
ascent is rounded, the row rule, what gridSnap.js measures, the lint's three keys, what the CI
spec asserts, and the order a page adopts it in -- every step written after a trap, from the
Closer Look columns that shipped at 18px to the stat figures that did not fit five across.

The system page shows it. The Grid part rides inside 01 Type, as the ramps ride inside Color,
because the poster says six laws and the grid is the type's own measure; its two chapters, Columns
and Baseline, are in the rail under Type: the columns at 1440, 900 and
390 as real `.wm-grid`s with each width's numbers set on them and scaled to fit, the baseline with
a paragraph to flip back to 1.55 and watch walk off, the seven roles over a `?grid`-style
overlay cut to each demo, three cards whose first baselines meet (the third by its last line),
and a pair of slider rows under an off-unit block -- the label snapped alone slides off its thumb, the row
that moves whole stays level -- with a chip that steps the block 48 to 52px (the first version moved
2px and nobody could see it). type.css and chip.css are
inlined for the part alone (PRIMITIVE_CSS_PART); grid.css and gridSnap.js are the shell's,
once, because a section-scoped gridSnap.js has its document queries rewritten to the section.

And the page is on the line: `<main>` is the `.wm-lines` root, so the README, the section
numbers and the Grid part share one set of lines, and the page joins the grid spec at all three
widths. The other chapters are not, and say so (Type's own page and its favicons are stages around the Grid part): each is a stage, data-nosnap, and build.py's
OFF_LINE records what putting it on would cost (the controls h1 is 40px at `normal` and would be
set solid at 24; 3,704 cells of usage table made one snapper pass 1.7s; the type chart is SVG
text the snapper can measure and cannot move). data-nosnap stops the snapper but not grid.css,
which is CSS, so the shell hands a stage's leadings back with `revert-layer`; measured, those
six chapters lay out to the pixel as they did. The page is NOT on the columns -- it is still
the rail and a 1080 measure -- and `?grid`'s lines do not draw on it past 65,535 device pixels,
which it is on a phone or at 2x.

## 2026-10-02 — the roles lead on the line; the chip, the button and the select are 27

Grid roll-out, step 1. type.css's seven leadings are `round(nearest, <ratio>em, var(--bl))`
now: still em, so they follow the reader's text size, and each lands on the 3px line at
whatever size that is. The ratios moved to make that true at the 16px root -- micro 1.2 → 1.3
(12), ui 1.4 → 1.25 (15), body 1.55 → 1.5 (24), title 1.2 → 1.15 (30), display 1.1 → 1.12
(51, written past the tie: 49.5 rounds UP in round(nearest), and a leading on a tie is one
browser rounding from the line). grid.css's --lead-* are aliases of these, with the px as
fallbacks for a page without type.css; .t-display takes --lead-display. type.ts gains `line`
(the px) and emits the same round() from type(); the parity lint checks ratio, line and that
no product sits on a tie. Every fallback in src/ that said `1.4` says `15px`.

The controls: height = leading + 2 × padding with the hairline INSIDE the step, so the chip
(27 already, by accident), the button (30.8) and the select (29, and never the button's
height beside it) are all 27px, nine units; the small chip 18; the touch floors 33 and 45.
tests/behaviour/line.spec.ts holds the computed leadings and the control heights on a fixture
that loads only src/. The case study is unaffected: its stylesheet sets every --lh itself.

## 2026-10-02 — play_arrow and pause join the icon face

83 names. The Cal Sans case study's Highlights section is getting a slideshow mode with a
pause/play bar (the case-study session asked for them rather than drawing inline SVGs). Re-cut
with `scripts/cut-icon-subset.py play_arrow pause`; lint-icons clean, both copies equal.

## 2026-10-02 — the value in the handle is a primitive; a row moves only what it aligns

`src/dialHandle.js` + `dialHandle.css`: variant 03 ("Value in the handle"), until now a demo drawn
on the system page, is a plain-script primitive -- the case study needed six vertical dials
beside a word on a page that loads no React, and Mark pointed out the vertical dial already
existed, so it is one code now: the docs card mounts the primitive. Horizontal or vertical,
typeable number in the lozenge, drag the rail, keyboard on the rail, an optional auto state, an
optional icon and a `caption` for when the full label is too long for its column. Writing the
docs test found a real bug: a host echoing a clamped value back into the field mid-word turned a
typed "90" into 75. A deliberate change (drag, keys) rewrites the field; a value from outside
does not while it has focus. The first focus ring was a capsule the size of the column; it is on
the lozenge now. Its knobs (`--hd-rail`, `--hd-id`) default at the root, not on the dial, so a
host can set them on any ancestor.

The icon face grows to 81 names: `bookmark`, `call_merge`, `star` and `public`, drawn thin (weight
100, the 48 cut, at 72px) as the marks of the case study's highlight bento -- a sleek line where a
bento would have a photograph.

`gridSnap.js`: a `.wm-baselines` row now moves ONLY the block it aligns. It moved every block in
the item, so a card whose big word sat 3px above its neighbour's had its bottom-anchored text
pushed 3px (and a half-size figure's text 45px, past the card) -- the very bottom lines Mark
asked to meet. The other blocks keep the snap they measured for themselves.

## 2026-10-02 — the triplet, visible again

Card 05 on the system page had drifted two ways. In light mode it was invisible: AxisTriplet
paints its ink as `rgba(var(--text-rgb), a)`, whose fallback is the dark ground's 232, and the
page's bridge handed the controls chapter `--text`, `--text-muted` and `--text-dim` but never
`--text-rgb` -- so the triplet drew near-white at .38 on a light page. The bridge carries it now,
per theme. And under the Vertical toggle its heads collided and its columns clipped: the toggle
turned every rig into a flex row, and a triplet has no vertical form -- three numbers on one
line IS the control -- so Vertical leaves it alone, and its note says so.

## 2026-10-02 — the line is a rule, not a convention

Two checks, so a page on the grid cannot drift off it quietly.

The INPUTS, in `scripts/lint-tokens.mjs`: a `lines` rule for files listed in a consumer's
`.tokenlint.json`. In them every `line-height` is `var(--lh)`, a `--lead-*` token or N x 3px;
every `--lh` is one of those or `round(..., var(--bl))`; every vertical space (margin/padding
top, bottom and block, row-gap, a shorthand's first and third) is N x 3px, a token or a
rounded unit. `linesSkip` names a demo's own insides by selector, since a line-based lint can't
see the DOM. `only` lets a site join one law at a time: wordmark.nyc runs `lines` alone, and is
now a consumer leg. It flags all 73 off-line values in the case study as it was before the grid,
and each of a planted 1.4 / 10px / 25px.

The OUTPUT, in `tests/behaviour/grid.spec.ts`: the demo and the case study (the site checked
out with `shared/` at the commit under test), at 1440, 900 and 390. Every block gridSnap.js
measured has its first baseline on a line; a block of more than one line has a leading in
whole units (the snapper only moves first lines -- a planted 1.4 on the studio prose fails
here); every .wm-baselines row meets; nothing was refused. It reads `wmGridSnap.blocks` and
`wmGridSnap.firstLine`, so it judges exactly what the snapper judged.

Writing it found a real defect: a block inside another block (a link's 56px ring) was measured
twice and shifted twice. A block inside a measured block now travels with it.

Then the first thing the grid shipped broke on a phone and both checks were green: `.look` had
gone onto 12 columns and its six items had no span, so below 961px they sat in one column each,
18px wide, their contents drawn over one another (wordmark #38 fixed it, 2026-10-02). Baselines
were on the line throughout -- the lint and the spec test the LINE, not the layout. So the spec
grew a layout check: no box narrower than its in-flow contents (text, or visible in-flow
children -- not scrollWidth, which counts a handle parked outside its row on purpose), and no
grid or flex siblings drawn over each other. Removing the one-line fix fails it on exactly the
six items; it also found the demo's own heading 6px wider than its column at 390.

## 2026-10-01 — the grid

`src/grid.css` + `src/gridSnap.js`, on trial in `docs/grid.html` and adopted first by the Cal
Sans case study. 24 columns, 12 below 1024 (12 divides 24, so halves and thirds survive a
phone; 30 lost because calsans splits 5:7, which is 10 | 14 here and 12.5 | 17.5 there). A 24px
gutter, 12 on a phone, and the case study's margin as everyone's. Cards step their contents in
one column + one gutter (rule A: the hanging version overlapped neighbours).

The line is 3px -- the leading subdivided, like 12/15 on a 3pt grid -- and body is 16/24, which
1.55 never divided. Getting baselines, not boxes, onto it took three discoveries, each now in
the file: type.css's .t-* classes are unlayered, so the line rules can't live in a layer; the
browser rounds ascent and descent to whole pixels and floors an odd half-leading, so the nudge
does the same; and nothing in CSS can know where a block starts after an image, so gridSnap.js
measures that after layout and sets --snap (glyphs only, under one unit). The demo puts 53/53
baselines on a line at 1440, 49/49 at 900, 70/70 at 390; the case study goes from 1/125 to
117/125, the rest being ornaments placed on purpose (pill arrows, counters, rings).

## 2026-10-01 — the chip

`src/chip.css`: one of a set, every option visible, the chosen one filled. Three apps had
drawn it three ways -- ReCal's GEOM zone chips, font-proofer's preset bar (bare words, the
chosen one boxed), Kernpare's context radios-then-chips. Mark's brief: ReCal's grammar at the
preset bar's size, and forward-view -- the state reads at rest, never only on hover. So the
unchosen options are outlined, not bare, which is the one thing that visibly changes in
font-proofer. `--chip-color` gives a chip its hue; `--small` is the lens size; `--switch` is a
modifier beside a set (dashed at rest, the secondary fill when on), never one more option.
`data-label` reserves the chosen weight's width, ReCal's no-reflow trick, as a zero-height
line rather than a grid, so it works on a bare word. ReCal's own zone chips stay: their HDR
light is theirs. The coarse-pointer floor is 32px, not the button's 44 -- a row of chips at
44 is a toolbar.

## 2026-09-27 — sync_alt joins the icon face

77 names. Kernpare's context `rev` switch and ReCal's landing-page compare button (`(Geist ⇄)`,
a text arrow until now) both draw it. Listed in the marks census under Drawn today; the face
was re-cut with `scripts/cut-icon-subset.py sync_alt`.

## 2026-09-27 — four icons take the redrawn P, and WMPR the set-6 R

WM Mono's new cut redrew P.ss01, so WMFP, WMOP, WMPR and WMKP are rebuilt from it (same
recipes, three colourways each), shipped to font-proofer, opsz-proofer, Kernpare and this
page. WMPR's R moves to set 6, matching the Type chapter's capitals.
WMKP's K moves to set 6 as well.

---

## 2026-09-27 — the capitals take set 6 for K N R V X, from a new cut of WM Mono

**Mark's picks.** The Type chapter's capitals are set 6 for K, M, N, R, V, W and X (M and W
are the drawn WM), set 1 for eleven, default for the rest, re-exported from the new cut
with its redrawn set-1 A and B (`make-favicon.py --specimen`).
The six lockups sit three and three (two by three on a tablet, one column on a phone)
instead of four and two.

---

## 2026-09-27 — Type ends with the favicons

**A chapter at the end of 01 Type: the WM Mono capitals, then the lockups.** All 26
capitals as the icons use them -- set 1 where the font has it (12), M and W from set 6
(the drawn WM), the default for the rest -- each labelled with its source and drawn in
the page ink, so it follows the theme. Then the six shipped icons (WMFP, WMGD, WMOP,
WMPR, WMWM, WMCS), each in its light and dark colourway on the ground it is for. The
font is Mark's and not in this repo, so `scripts/make-favicon.py --specimen` exports the
outlines to `docs/favicons/ss01-uppercase.json` and the builder draws those; the icons
are inlined as data: images so the self-contained build carries them and their own
`<style>` cannot reach the page.

---

## 2026-09-27 — ReCal's icon joins the family

**WMCS, set 1, widened.** C.ss01 and S.ss01 under the drawn WM, in the three colourways,
now in `docs/favicons/` beside the other seven and live on ReCal (MarkFonts/ReCal, same day).

---

## 2026-09-26 — favicons for the apps, and the script that makes them

**Seven icons, one construction.** Mark's drawn WM over each app's two letters in WM Mono,
the 2x2 grid font-proofer's and ReCal's icons use, each letter widened to its cell:
WMPR (this page, ss01), WMFP (font-proofer, P.ss01), WMGD (GliffDiff, ss01), WMOP (opsz-proofer, ss01), WMKP (Kernpare,
P.ss01), WMMF (Morf), WMWM (WORDMAKE, W + M.ss05). `docs/favicons/` holds all of them in
three colourways -- ink (black, white under a dark scheme; the one a page links), light
and dark (fixed) -- with `recipe.json` saying how each was built.

`scripts/make-favicon.py CODE [--ssNN] [--alt X=glyph] [--fill] [--colorway=...]` builds
any of them. W and M are always the drawn glyphs, copied verbatim from font-proofer's icon
(`scripts/wm-top.txt`); every other letter comes from WM Mono, which is Mark's and not in
this repo (`WM_MONO`). A bottom row whose letters dip below the baseline lifts by the
deepest overshoot, so nothing is cut at the square's edge.

---

## 2026-09-26 — `layers` joins the face; GliffDiff draws four marks

GliffDiff's Preview mode list gives each view a mark, font-proofer's way. Three of its four
were already cut in and waiting for a use: `format_shapes` (characters), `match_word`
(spacing) and `mystery` (metrics, sharing the v3 dial's mark). They move up to "Drawn
today". The fourth, `layers` (overlay), was only in the full face, so it is cut in with
`scripts/cut-icon-subset.py layers`. That makes 76 names and 110 glyphs, and the face grows
by 464 bytes. `format_paragraph` and `text_fields` gain GliffDiff as a second drawer.

---

## 2026-09-26 — one icon face, and the marks grid is the census

**The shipped subset is 75 names now, and there is a script for that.** It was 24. Kernpare
wanted `warning` where it drew a ⚠ character; the index of every mark every app calls upon
found 16 more the full face alone held (WORDMAKE's twelve, the v3 dial's four); and the
type tools' vocabulary was chosen — glyphs, specimen, family, serif, script, slab, the edit
and match marks, the six books, HDR's five states, undo and redo — 34 names cut in before
any app draws them, so a proofer can reach for one without a font rebuild. Growing the
subset turned out not to be `pyftsubset --text`: the face keeps its icons under `rlig`, and
a cut that keeps rlig keeps every icon spellable from the letters asked for — 3,954 of
them, 3MB, on the first try. `scripts/cut-icon-subset.py` prunes the ligature table to the
wanted names first, then cuts. Both copies written (fonts/ and docs/fonts/).

**The system page's marks grid is the census.** Two grids: the 39 drawn today, each with
what it means and who draws it; the 34 waiting for a use. The stepper's arrows left the
grid: a stepper is the house chevron, not a Material mark, and the two arrow names stay in
the face only because a dropdown and a fold-away draw them.

**COMPONENTS.md regenerated** once Kernpare drew `warning` (wordmarktools#9): the marks table
is read from the consumers' mains, and the browser job holds the committed copy to it.

**Baselines re-cut** from the first main run with Kernpare on the house face (run 36264533330):
Kernpare's button, page, graph, table and rail in both themes; the theme marks on the phone
(the re-cut face); and three dial rows whose numerals moved under them when calbuild
published new Cal Sans -- opsz-proofer's weight rows and one font-proofer tracking row.

---

## 2026-09-25 — alignment is tested, and ReCal and Kernpare are tested as apps

**Alignment is a rendered fact.** The lint holds every padding, gap and margin to the
scale and none of that says two labels sit on one line -- that is a sum typed by hand in
two places. `tests/behaviour/alignment.spec.ts` reads the page instead: for font-proofer
and ReCal, the left edge of every named label's text must land on one of the region's
named lines in `alignment-lines.json`, each with its arithmetic. Two disagreements are
recorded as `open` lines rather than approved: font-proofer's mode buttons inset 8 where
its fields inset 12, and ReCal's matrix title 6px right of every other rail label.
Baselines are the next half.

**ReCal and Kernpare as apps.** `recal.spec.ts`: modes, the rail's three panels and back,
the type panel's picker moving the readout, Paragraph swapping its specimen.
`kernpare-smoke.spec.ts`: the fixture opens with twelve pairs, an edit lands and counts,
Revert all puts it back. Eight tests, all green against the builds the browser job makes.

---

## 2026-09-25 — the pair test knows a pair from two strangers

**One more font-proofer test.** Two unrelated fonts dropped together load the last one
alone with no italic companion and no toggle; the DM Sans pair handed over as `a.ttf`
and `b.ttf`, in the wrong order, still pairs, because the app reads the family name
and the italic flag out of the fonts (font-proofer#38), not the filenames. Red against
font-proofer's main until #38 lands.

---

## 2026-09-25 — font-proofer gets tested as an app

**Four tests, two fixtures.** Everything that ran against font-proofer tested the primitive
inside it; nothing tested the app. Now `tests/behaviour/font-proofer.spec.ts`: every mode
opens without an error; a dropped roman + italic pair (the two files Google Fonts ships)
registers as one family, the rail starts on `auto`, and reset returns to it; the UI board
is set in the uploaded face and the chrome outside it is not; a six-axis face makes six
rows named from its own name table. The fixtures are OFL from google/fonts, subset in
`tests/fixtures/`: the DM Sans pair (Latin, ~160KB each) and Google Sans Flex (29 glyphs,
389KB, because six axes of gvar is the weight). Not Cal Sans, because the two board bugs
this guards (font-proofer#33) only show with a face that is not the app's own, and the
pair test is red against font-proofer's main until #34 lands.

---

## 2026-09-25 — margin is a gate

**The 27 sites moved in a day, so the note becomes a failure.** wm-primitives (5), font-proofer
(9), ReCal (11) and Kernpare (2), each in its own PR, each either a step or a derivation
from the size beside it -- half a thumb, a chip's own padding, a grabber's own width.
`MARGIN_GATES` is `true`; margin fails like padding and gap do. ReCal's `App.css` stays
exempt, with its 34 margins, 30 durations and 7 sizes for one later pass.

---

## 2026-09-24 — the package's own margins are on the scale

**Five sites, two kinds.** The margin note from the morning named five in `src/`. Two were
never spacing: the diamond thumb's `-5px` is half the difference between a 12px thumb and
the 2px track, and the stock mark's `-5px` is half its own width. Both are written as
what they are now, `calc()` from the sizes beside them, the way the round thumb already
was -- same pixels, no number that looks like a step and is not one. The other three
were spacing off the scale: the triplet's 10px between rows is 12 (the comment already
said "looser between"), and GlyphPicker's 26 under a group and 10 under its label are
24 and 8. No render baseline covers either, so nothing is re-cut. `dist/dial.css` rebuilt.

---

## 2026-09-24 — margin is the other half of the box

**The lint held padding and gap to the scale and never read margin.** Asked whether
font-proofer and ReCal had been policed for spacing: half. Counted with the new check:
5 sites in this package (two are dial geometry, the thumb and the stock mark centring
themselves with `-5px`; three are spacing in `GlyphPicker.css` and `AxisTriplet.css`),
9 in font-proofer, 11 in ReCal outside its exempt `App.css` and 34 inside it, 2 in
Kernpare's chrome, none in WORDMAKE.

**It reports, for now.** Same `STEPS`, negatives of a step allowed (a `-1px` hairline
pull is the scale mirrored), 0 and auto not judged; `MARGIN_GATES` is `false` and the
sites print as a note under every run. A rule that turned five consumer legs red on the
day it landed would be reverted, not obeyed. The flip is one line, after the sites move.

---

## 2026-09-23 — WORDMAKE joins CI (NEXT.md E1)

**`flattersatz-headless` lands: `StopSlider`, and a measurer without a document.** The
branch was two commits and 75 behind; nothing on main had moved under it except the
changelog. `StopSlider` is the named-stops control WORDMAKE's GEOM rail imports, and
`measurerFrom` is what lets its render workers break copy with no DOM. Both exported
from the barrel (its `Stop` type as `NamedStop`, since gradient.ts already owns `Stop`);
`SLIDERS.md` row 13 is ✅. Its CSS moved onto the duration tokens the linter now asks for,
and the knob's x is an inline transform rather than a new runtime token, because the
consumers that lint `shared/src` each carry their own copy of that list.

**WORDMAKE is a `check` leg in `consumers.yml`,** built the same way the other three are:
`wordmarktools` checked out, `wordmake/shared` pointed at the commit under test, token
lint, `npm ci`, `vite build`. In wordmarktools the `shared` under it is a submodule now,
not a symlink to one laptop's checkout, so a runner can build it at all. It is also a
consumer in `COMPONENTS.md` and the icon lint -- against its own face: it ships the
full Material Symbols file and draws `crop`, `blur_on`, `queue_play_next` and four more
the 24-name subset never held, so `WM_CONSUMER_FACES` names the woff2 it actually loads
and the lint holds it to that.

---

## 2026-09-21 — the system page draws from the full icon face

**The page about the marks was drawing marks the subset does not hold.** `fit_width`,
`format_line_spacing` and `line_weight` came out as the letters F, L and M in the
"Value in the handle" panel: the ligature never forms and the letters that spell it stay.
`lint-icons.py` had not looked at `docs/`, and the apps never use those names, so nothing
red. The system page now self-hosts the complete variable face
(`docs/fonts/MaterialSymbolsOutlined-full.woff2`, 3.98MB, 4,284 ligatures, Google's own
woff2) beside the synced 24-ligature subset the apps keep, and the lint holds
`docs/system/pages/` to that file. The self-contained build is unchanged.

**And the corner law's button placeholder is hatched and linked.** It was a dashed box
with no way through; it is the WIP hatch now and opens "Six ways to say press", tagged
undecided.

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

## 2026-09-13 — flattersatz without a document

**An injected measurer.** `measurerFrom(spec)`, and `layoutParagraph` now takes either a
DOM element or `{ width, measure(text, type) }` where the element used to go.

The probe was the only thing in the file that needed a document, and it is still the right
way to measure text the browser is going to draw — it inherits the axes, the features and
the optical size, and a canvas 2d context silently ignores `font-variation-settings` in
Chrome, so there is no shortcut. But everything downstream of it — the greedy walk, the
Knuth-Plass composer, hyphenation by rule, protrusion, the widow killer — only ever asked
the measurer for `measure`, `space` and `em`. None of it ever touched the DOM.

So a caller that already shapes its own text can hand that in. WORDMAKE is the one that
asked: its preview, its node export and its seven render workers all break the same copy,
and two of those three have no document — but all three can pass `advance(coord, text,
size)` from the shaper they already agree on. Same breaker, same rag, in a browser and in
a worker.

`measureAt` stays optional. Without it `widthAxis()` measures no axis and the expansion
stage leaves the type alone, which is the honest answer for a measurer that cannot move
one — and not a silent scaleX.

The DOM path is byte-for-byte unchanged: `measurerFrom` returns null for anything that is
not a spec, which is how `layoutParagraph` tells an element from one.

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
