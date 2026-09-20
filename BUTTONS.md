# BUTTONS.md — the enclosure proposal, and what is left to decide

**Status: six explorations drawn. None chosen, none production-ready** (§ 0). The page is
[`docs/system/pages/buttons.html`](docs/system/pages/buttons.html), linked from *07 · WIP
primitives* and deliberately **not** registered in `build.py`'s `SECTIONS` — it is a page to
decide from, and only the family that wins becomes `src/button.css`.

What a win changes across the system — the language, the lint, the v0.2.0 bump, the four
apps — is [NEXT.md § G](NEXT.md). **This file is the proposal's own state and the order the
decisions have to be taken in.** Where the two disagree, § G is the plan and this is the
evidence.

---

## 0 · These are explorations. None of them is production-ready.

**Nothing here is asking for a decision, and nothing below is due.** What is on the page is
six drawings that render. What a primitive needs before it ships is a different list, and
none of the six has had any of it:

- [ ] **No accessibility pass.** Contrast was measured for 04's depth tokens and for nothing
      else. The five states have not been checked at any size, and no editable mark has been
      near a screen reader. The `contenteditable` in the specimens is a demo device so the
      affordance can be judged against the thing it promises — it is not a proposal.
- [ ] **No keyboard pass** beyond `:focus-visible` existing in every family. Tab order, the
      chosen-state announcement, and whether "chosen" is `aria-pressed` or
      `aria-current` are all undecided.
- [ ] **No device testing** beyond one phone at one width. Touch sizing auto-enables on a
      coarse pointer; whether the 44px floor is right *per family* is untested.
- [ ] **No Safari verification.** It has no `corner-shape`, so every family degrades to a
      plain radius there — the page says so, but nobody has looked. 05 additionally depends
      on `mask-composite: intersect`, and its fallback is to paint as 01.
- [ ] **No tests.** `tests/render` has no rows for any of this and `tests/behaviour` has no
      button suite. The five states are five promises and none of them is tested.
- [ ] **No token lint.** The page is deliberately page-local CSS with literal values, which
      puts all six outside `.tokenlint.json`'s reach. Only the winner gets linted, because
      only the winner becomes a primitive.
- [ ] **No consumer trial.** Nothing has been built against font-proofer, ReCal or Kernpare.
- [ ] **Reduced motion** is honoured on the page but not specified; **RTL** is untested.

Treat the page as a place to look, and this file as what has been learned so far.

---

## 1 · What the page now demonstrates

Two things get decided, and only two: **one enclosure** (what a thing looks like when
pressing it does something) and **one editable mark** (what text looks like when it is yours
to change). They are one decision because they are the same question asked twice, and
because getting the second one wrong produces a bulleted list of unformatted links that each
open a modal, with nothing on the page to say so.

All six families draw the **same six specimens on the same content**, so a difference between
two of them is a difference between designs and not between demos:

| | screamer | buttons | menu | 5 states | editable | in situ |
| --- | --- | --- | --- | --- | --- | --- |
| 01 Keyline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 02 Lozenge | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 03 Rule | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 04 Plate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 05 Bracket | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 06 Menu | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 2 · The six, and the one thing each cannot do

The "cannot" column is the finding. None of these is an omission to be filled in later.

| family | the claim | cannot do |
| --- | --- | --- |
| **01 Keyline** | a box, and one side of it — a closed keyline means press, a bottom-only keyline means change | — (its cost is a rule, not a limit: no line under a heading may ever be decoration) |
| **02 Lozenge** | a ground, not an edge | — (wide; the 5% resting wash is near-invisible on `--surface`) |
| **03 Rule** | the type is the control | **an icon-only button** — there is nothing to draw it in, so those actions borrow 01 |
| **04 Plate** | hills and holes | **the house corner on its own wells** — inset shadow follows `border-radius`, not `corner-shape` |
| **05 Bracket** | corner ticks that close on approach | — (its cost is legibility: 9px ticks read as noise in a dense menu, not as an edge) |
| **06 Menu** | an enclosure means *chosen*, not pressable | **a primary louder than chosen**, and **an editable that is prose rather than a value** |

**06 is called Menu in the display and `rail` in the code, deliberately.** The specimen is a
list of preview modes of equal weight that you pick between rather than read — which is what
a menu is, and which is also what earns the icons: the label law says a mark has to justify
itself, and *"the items are of equal weight and you are scanning to choose"* is the
justification. `rail` stays as the idiom in `src/`, in the class names, and wherever the
prose means font-proofer's actual rail or the dial's.

**03 is the one to reject on purpose rather than by omission.** It is the most typographic
answer on the page and it fails exactly where the brief says not to: at the resting spec
(1px, ink-3, 13px) the underline *did not render at all* — the specimen was a row of bare
words, and it had to be raised to ink-2 to get a fair test. The affordance is one ink step
from not existing. It also depends on a document-wide "nothing else may be underlined" rule
that no component can enforce.

## 3 · When a decision is wanted, this is the order

Not a schedule. Recorded now because the order is the useful part and it is
cheaper to write down than to re-argue.

- [ ] **D1 · Decide the editable mark first, not the enclosure.** It is the half of the
      brief with a shipped answer already in the building: `.slider-number` in
      `src/AxisSlider.css` — a 1px underline drawn on the **text** at offset 2, exactly as
      wide as the value, focus taking the digits and the rule together at 2px. Every dial in
      every app wears it. Choosing anything else for editable text means the menu and the
      field disagree inside one panel.
- [ ] **D2 · Resolve the prose gap that D1 leaves.** `.slider-number` was written for a
      number in a rail. On a wrapped headline the rule is two full lines of underline, and
      the brief's editable case **is** a headline. Either the prose case gets a different
      device that still reads as one decision with the value case, or the value rule is
      generalised and the wrap is accepted. **This is the open question the page does not
      answer.** The untested candidate: a flat −L well plus 01's bottom keyline, giving
      04's hole/hill read without the shadow fault — not drawn yet.
- [ ] **D3 · Choose the enclosure.** Current reading: **01 for everything outside a menu,
      06 inside one.** Both are already half-built — 01's enclosure is `src/button.css`,
      06 is what font-proofer's rail already does — and they fit together without being
      reconciled.
- [ ] **D4 · Test D3's real risk before adopting it.** One panel would hold **both meanings
      of a box at once**: in 01 an enclosure means *pressable*, in 06 it means *chosen*.
      That is a genuine conflict, not a detail, and it should be tried in a real panel
      rather than argued.
- [ ] **D5 · Write the screamer into the spec, not just the page.** A display CTA is not the
      UI button made bigger (§ 4). Whatever wins needs a display size with its **own optical
      size and its own vertical spacing**, or the first hero button undoes the family.
- [ ] **D6 · Decide what none of the six cover** (§ 5) before the language is called done.

## 4 · Measured, so it is not re-derived

Every number here came off the shipped face or the shipped CSS during the proposal. None of
it is taste.

- **Optical size is an axis, and a display CTA has to move on it.** Cal Sans `opsz` runs
  **8 · 14 · 45**. The menu runs `opsz 10`. Scaling a 13px button to 34px without moving
  `opsz` prints the *small* drawing large — thicker stems, looser fit — which is mis-drawn
  rather than merely big. `wordmark.nyc`'s `.hero-pill` already runs `opsz 45, wght 700,
  GEOM 50`; the screamers take its `opsz 45` and `GEOM 50` and **not** its weight. 700 is a
  second emphasis stacked on whatever the enclosure is already doing — `icon.css`'s rule for
  the mark, that *a heavier stroke on top is two emphases stacked*. A 2.5px keyline, a 0.1em
  rule, 3px ticks and a raised plate are each loud alone, so those families set 400. **02
  keeps 700**, for legibility rather than volume: it is the only screamer that inverts, dark
  ink on a signal field, and weight holds the counters open against a flat colour.
- **A display pill reads tight on top because the bottom carries space nothing occupies.**
  With `line-height: 1` this face's baseline sits **0.8275em** below the top of the line box,
  the cap top **0.1075em** down, and the descender falls **0.0650em *past*** the bottom. The
  hero pill's `0.22em / 0.38em` padding then leaves **0.315em** of clear air under the
  descender. The fix is to **remove that room, not to balance it**: `text-box-trim` trimmed
  to `cap alphabetic` makes the box the lettering itself, so symmetric padding is optical
  centring by construction, the descender hangs with **0.1025em** to spare, and the pill
  comes down from **1.70em to 1.40em**. *Do not raise the ascenders to fix this.*
- **`YTAS`'s minimum is `sCapHeight`.** Both are **1440**, so at the default this face's
  ascenders stop exactly at cap height. Worth knowing; it is **not** the lever for the
  spacing problem above.
- **Set a display button's box, not its padding.** A family that draws a keyline pays for
  its own stroke: at equal padding the screamers measured **40px and 37px** side by side. An
  explicit `1.4em` height with `box-sizing: border-box` makes all six identical.
- **`corner-shape` and shadows disagree.** An inset `box-shadow` follows `border-radius` but
  **not** `corner-shape` (already recorded in `src/corners.css`). Any family built on a
  recess inherits this — it is the engine, not a bug to fix here.
- **Depth must not be keyed to the ink.** 04 was first drawn with its highlight mixed from
  `--ink` and its cast shadow from `--bg`. **Those two swap with the theme and the sun does
  not**: in light mode the top edge went dark and the shadow went white, and every plate lit
  from below. A highlight is white and a shadow is black in *both* themes; only the pressure
  changes. Related: a "sunk" ground mixed from `--bg` into `--surface` is a step down in dark
  and **nothing** in light — the first light-mode well resolved to `#ebebeb`, the exact
  luminance of `--surface-hi`, so the hole did not exist.
- **The house face ships a 24-ligature subset**, and a name outside it does **not** fail
  loudly — the ligature never forms and the browser draws the component glyphs, so `undo`
  rendered as two unrelated strokes and `arrow_outward` as a circle, both still looking like
  icons. Fixed on main in `27cf57c`: `src/icon.css` now says so and `scripts/lint-icons.py`
  reads the GSUB and fails any undrawable name in CI. *Reset is `settings_backup_restore`.*
  The screamer's arrow is **U+2197 as a Cal Sans text glyph** (with `&thinsp;`), copied from
  the real `.hero-pill` — not a Material ligature, and correctly invisible to the linter.

## 5 · What none of the six draw

Decide these before the language is called finished. Each is a state or a shape the winning
family will have to answer for, and none of them is answered today:

- [ ] a **pending / loading** state
- [ ] a **destructive** action that must look dangerous without a second hue
- [ ] a label that **wraps to two lines**
- [ ] a **count or badge** riding the enclosure
- [ ] a **split button**
- [ ] an **HDR *chosen* state on an enclosure** rather than on a mark — the page's last row
      demonstrates the mechanism (`src/icon.css` cuts the glyph with `background-clip: text`;
      `src/AxisSlider.css` and `src/AxisTriplet.css` cut a chevron with `mask-image`, all
      three sharing one PQ swatch), and **no family assumes it**. Extending it to an
      enclosure is a design question, not a port.

## 6 · On the day a family wins

Fill in the blank in [NEXT.md § G](NEXT.md) and work its checklist: the family's vocabulary
replaces `.wm-btn`'s, the corner law's "The button" chapter gets written from it, the
enclosure pairs become lint, GESTURES gets a button table for the five states, and it ships
as a **v0.2.0 minor bump** with the four consumers migrated in the same window — `.wm-btn` is
in the v0.1.0 contract, so reshaping it is consumer-visible.

Until then: **nothing in `src/` has been changed by any of this**, and `build.py`'s
`SECTIONS` are untouched.
