# Typography tokens — roadmap

How WORDMARK's web things (wordmark.nyc, ReCal, font-proofer, Framer embeds) should
handle type. Companion to the primitives in `src/`.

## Where we are (audited 2026-08-07)

| | `font-size` decls | distinct sizes | `--type-*` tokens |
|---|---|---|---|
| wordmark.nyc | 524 | 44 (px **and** rem) | 0 |
| ReCal | 197 | 33 | 0 |
| wm-primitives | 74 | 17 | 0 |
| font-proofer | 43 | 14 | 0 |

Colour, motion and shape are **already a shared system** — 26 token names appear in
both wordmark.nyc and the apps (`--accent`, `--surface-1..3`, `--text-*`, `--border*`,
`--radius`, `--radius-pill`, `--spring`, `--dur`, the zone colours, `--marker-*`).

Type is the hole. 838 hand-placed declarations, no vocabulary. The tell: sizes run
10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5 — half-pixel drift from nudging values in
place instead of picking from a scale.

---

## I. Compensations are free. Signals are budgeted.

The distinction the whole system hangs on, and the one we were getting wrong.

**A compensation** is a change the type *requires* to stay itself at a new setting.
It carries no meaning; it prevents a defect. Reading it as emphasis is a
misreading — nothing was said.

- **`opsz` tracking size.** Given, always, invisible. Our own product's thesis.
- **Leading responding to measure and size.**

Tracking is *not* on this list, and that is a rule, not an omission — see below.

**A signal** is a change made to *say* something: this is a heading, this is
secondary, this is a label. Signals cost. There are five:

**size · case · ink · weight · rule**

`rule` is the quietest of them — a hairline under the words, everything else held
constant. It is also the one our own proof sheets reach for most, and it deserves to
be in the vocabulary rather than improvised each time.

### The budget

> **One signal per distinction.** A role may differ from the text around it by
> **one** signal. Compensations ride along free and are never counted.

> **The absolute:** never **ink + size + case** together. Three ways of saying
> "minor" is not emphasis, it is a lack of confidence.

`opsz` moving with size is the given. The exception that proves it: `opsz`
*pinned* while size changes — a deliberate mismatch — is no longer a compensation.
It is a signal, and it is spent.

### The weight-and-colour habit

The pairing hardest to catch, because each half looks reasonable alone: making a
heading **bolder** *and* giving it a different hue. That is two signals for one idea,
and it is how most interfaces drift into shouting.

```html
<h3 style="font-weight:640; color:var(--accent)">Messina Serif</h3>  <!-- two -->
<h3 class="rule">Messina Serif</h3>                                  <!-- one -->
```

Same size, same weight, same colour, same case — only a rule beneath. Prefer it to a
weight bump whenever the distinction is *structural* (this is a heading) rather than
*urgent* (read this first). Weight is for urgency; a rule is for structure.

Hue is not on the list of five on purpose. Reserve it for pointing at the thing under
discussion — an annotation, a highlighted value — never for hierarchy. The moment a
colour means "important," it stops being able to mean anything else.

### Tracking: one value, for capitals

**Tracking may only ever be positive, and only on capitals. It is never negative.**
One token, `--track-caps: .12em`, and no other tracking value exists in the system.

The direction is the whole rule, because the two cases are not symmetric. *Positive*
tracking **adds** space that capitals genuinely lack — no axis supplies it, so
hand-work is the only way. *Negative* tracking **removes** space to imitate a display
cut, which is exactly what `opsz` already does, and does properly: by redrawing the
letters, not merely closing the gaps between them.

So the reflex to pull -.02em, -.03em, -.04em as sizes climb is what you do when a
font has no optical size axis. Cal Sans *has* one, it is already tightening the fit
at every step, and doing it again by hand double-counts the axis the whole product is
built on — the two corrections then fight each other at the extremes.

The positive case is real and narrow: capitals are drawn with sidebearings tuned for
mixed-case setting, so a run of them crowds. Bringhurst §3.2.1 — letterspace all
strings of capitals and small caps. That is the only place, so it gets the only value.

Small sizes are not an exception either. An 8px caption at `opsz 8` is already the
small-optical cut, drawn with the air it needs.

### A note on `opsz`, points and pixels

The axis is specified in points, which reads at first like a mismatch with CSS. It is
not — and the clause that resolves it is easy to miss, because the designer-facing
descriptions (Google Fonts' among them) quote the "points" part and stop there. From
Microsoft's OpenType axis-tag registry, which is the normative definition:

> The scale for the Optical size axis is text size in points. For these purposes, the
> text size is as determined by the document or application for its intended use; the
> actual physical size on a display may be different due to platform or application
> scaling methods or intended viewing distance.

So "points" here is a **nominal** scale — whatever number the document uses for text
size — and physical size is explicitly out of scope. Google's description ("optimized
for use at singular specific sizes, such as 14 pt or 144 pt") is describing the same
thing from the design side, and is not in conflict; it simply omits the sentence that
tells you the number is not a physical measurement. On the web the document declares
text size in CSS px, so the px number *is* that number, and a browser handing the
computed px to the axis is implementing the spec rather than ignoring it.

Which it does, consistently, whatever unit you author in:

| declared | computed | `auto` applies |
|---|---|---|
| `24px` | 24px | `opsz` 24 |
| `1.5rem` (root 16px) | 24px | `opsz` 24 |
| `1.5rem` (root 20px) | 30px | `opsz` 30 |
| `18pt` | 24px | `opsz` 24 |

Measured in Blink against explicitly-set axis values. `pt` is converted to px at parse
time, so it changes nothing — and needs to change nothing.

The same rule holds outside the browser, which is what makes it a rule rather than a
quirk: **every application maps its own text-size number 1:1 onto the axis.**
InDesign's number is points, so 60pt gives `opsz` 60; Figma does the same, with a
checkbox for it; the browser's number is px, so 60px gives `opsz` 60. One behaviour,
different units — precisely what "as determined by the document or application"
describes.

Two consequences worth holding on to. Cal Sans' 8–45 range maps onto exactly the sizes
web UI uses, so the whole axis gets exercised rather than the top half sitting idle.
And `display` at 45px does sit on the ceiling: at that size `auto` applies `opsz` 45,
the maximum. Text ends where the axis ends.

The one case that still needs a hand: `rem` means the computed px — and therefore the
optical grade — follows the reader's root size. That is the correct behaviour, but if
a surface ever needs a fixed optical grade regardless of the reader, pin it with
`font-variation-settings` rather than trusting `auto`.

## II. Ink

Grey is a signal, and we have been spending it like punctuation. Four levels
(`--text`, `--text-muted`, `--text-dim`, `--text-faint`) resolve to inks of
**1.00 · 0.64 · 0.40 · 0.24** on our ground — a finer gradation than any page can
actually mean. Three:

```css
--ink-full:  1;      /* the text is the text */
--ink-quiet: .62;    /* subordinate: captions, annotations, spec data */
--ink-faint: .38;    /* structural only: rules, disabled, watermarks */
```

Ink is **opacity on the text colour**, not a separate hex — so it composes over any
ground and stays honest in both themes. `--text-rgb` already exists for exactly this,
and it is **comma-separated**, so use the `rgba()` form (the space/slash syntax needs
`232 232 232` and will silently drop the whole declaration):

```css
color: rgba(var(--text-rgb), var(--ink-quiet));
```

The old `--text-faint` tier (0.24) retires. Anything that quiet is either structure
(use a border token) or shouldn't be on the page.

## III. Roles

No `text-xs … text-9xl`. Ladders describe magnitude; we want the job, so the value
can change without the name lying.

Every role below spends **size** and nothing else. Ink and case are applied
separately, and spending either means not also changing role.

| role | size | leading | tracking | opsz | spends |
|---|---|---|---|---|---|
| `micro` | 8 | 1.2 | 0 | auto | size |
| `label` | 12 | 1.3 | `--track-caps` ᶜ | 10 ᵖ | **case** (see below) |
| `ui` | 12 | 1.4 | 0 | 10 ᵖ | — (chrome norm) |
| `body` | 16 | 1.55 | 0 | auto | — (content norm) |
| `lede` | 18 | 1.5 | 0 | auto | size |
| `title` | 26 | 1.2 | 0 | auto | size |
| `display` | 45 | 1.1 | 0 | auto ᵐ | size |

ᶜ compensation, not a signal · ᵖ pinned by policy (chrome must not drift between surfaces) ·
ᵐ at 45px `auto` applies `opsz` 45 — the top of the axis

Plus two non-roles: `readout` (= `ui` + `tnum`, so digits don't jitter) and `code`
(the only sanctioned monospace).

### What changed, and why

- **`label` no longer shrinks.** It was 10px **+** uppercase **+** wght 500 **+**
  muted ink — four signals for one idea. Now it sits at `ui` size in full ink and
  distinguishes itself by **case alone**, letterspaced because caps require it.
  A label is not less important than the thing it labels; it is a different kind of
  thing.
- **`tag` and `ui-lg` are gone.** `tag` (11) sat one pixel from `ui` (12) and
  `ui-lg` (13) one the other way — three roles inside three pixels, none of which a
  reader can distinguish. One chrome size: 12.
- **`title` and `display` dropped their weight bumps.** At 26 and 40px, size has
  already said it. Adding 640/700 was a second signal spent on a distinction that
  was already made.

Seven roles, from nine, from forty-four sizes.

### Where quiet comes from

Not from a smaller role. A caption that recedes should recede by **ink**, at the
size its context calls for:

```html
<p class="t-ui ink-quiet">34px · opsz 45 — drawn for display.</p>   <!-- one signal -->
<p class="t-micro ink-faint">34px · opsz 45 — drawn for display.</p><!-- two: don't -->
```

## IV. The poster scale

The seven roles top out at `display` (45px), and the number is not arbitrary: at 45px
`font-optical-sizing: auto` applies `opsz` 45, the top of Cal Sans' range. `display` is
the last step that still has optical sizing left to give — above it the axis is pinned
at maximum whatever you do. Text ends where the axis ends, and above that lives
another instrument: the monster sample. The hero word
on a family page, the Words scene, a specimen waterfall.

Up there the rules change, and it is worth saying why. At text sizes you name the
**job**, because size alone does not tell a reader what a thing is. At display sizes
the job *is* magnitude — a 96px word is not a different kind of thing from a 136px
word, it is the same thing, larger. So here a ladder is honest, where in the text
scale it would have been a dodge.

```css
--poster-1:  48px;   --poster-2:  68px;   --poster-3:  96px;
--poster-4: 136px;   --poster-5: 192px;
```

**Ratio: √2.** The paper ratio — the one the A-series is built on — so every second
step doubles exactly (48 → 96 → 192). Tailwind's 5xl–9xl (48, 60, 72, 96, 128) walks
1.25, 1.20, 1.33, 1.33: four different intervals pretending to be a scale. Ours has
one interval, and two of the five steps (68, 96) are already in the codebase.

| step | size | leading | tracking | spends |
|---|---|---|---|---|
| `poster-1` | 48 | 1.05 | 0 | size |
| `poster-2` | 68 | 1.02 | 0 | size |
| `poster-3` | 96 | 1.00 | 0 | size |
| `poster-4` | 136 | 0.98 | 0 | size |
| `poster-5` | 192 | 0.96 | 0 | size |

Leading tightens as the steps climb — a compensation, since a line box built for
reading is too loose once the words are this large. **Tracking stays at zero**, and
the poster scale is exactly where that rule earns its keep: negative tracking on
display type is a hand-made substitute for optical sizing, and `opsz` is already
doing it here.

### It is face-agnostic, and that is the point

The poster scale sets **size and leading. Nothing else.** It never touches an axis,
and it never tracks. `font-optical-sizing: auto` then does the right thing for whichever face it
is pointed at — and this is exactly why we never pin `opsz` here.

That is what lets one scale serve both sides of the boundary without breaking it:

- On the **Face**, poster sets a hero headline on wordmark.nyc.
- On the **Specimen**, poster sets the monster sample — while size, leading and axes
  stay the user's to drive. The scale offers a step; the instrument still owns the
  parameters.

The rule from §V holds: tokens govern the Face. The poster scale is not an exception
to it, because it governs *setting*, not the typeface.

## V. Face and Specimen

`--ui-font: "Face"` is the chrome; `--spec: "Specimen"` is the thing under test.
Type tokens describe **chrome only**. Specimen size, leading and axes are the user's
parameter space — systematising them would systematise the *subject* of the tool.

## VI. Phases

**0 · Freeze the vocabulary.** Seven roles, five poster steps, three inks, the signal budget. Nothing
ships. *Done when the role list stops changing.*

**1 · `type.css` + `type.ts` in wm-primitives.** Role classes, ink modifiers, the
helper. Additive. *Done when both apps build unchanged.*

**2 · Adopt inside the primitives (74 decls).** Smallest surface, hardest cases: an
AxisSlider row is label + value + tag + track in one line, and under the budget most
of them must differ by ink alone. If the rule survives that row, it is real.

**3 · ReCal chrome (197), then font-proofer (43).** Chrome only, never the specimen.

**4 · wordmark.nyc (524).** Codemod once the scale is proven: 44 sizes → 7 roles.
Expect ~10 genuine one-offs; give those `--type-once-*` and a comment saying why.

**5 · Hold the line.** Lint raw `font-size` outside `type.css`. Then density.

## VII. House style

- **Never let the browser synthesise a style.** Cal Sans has a drawn italic on the
  `ital` axis; `font-style: italic` makes the browser shear the upright instead, which
  is a counterfeit. Address the axis: `font-variation-settings: "ital" 1` with
  `font-style: normal`. Same for weight — no synthetic bolding when `wght` exists.
- **No invented ramps.** The neutral scale, accent, radii, spring and durations
  already exist and are shared. Type adds `--type-*` and `--ink-*`, nothing else.
- **Declare in `rem`, write in px.** The scale is authored in `rem` against a 16px
  root so it follows the reader's own text size; prose, tables and spec rails quote px,
  because that is how type is talked about. `em`/`ch` stay for *relationships* —
  measure, indents, optical padding.
- **Count the signals before adding a rule.** If a new class changes two of
  size/case/ink/weight at once, the distinction it makes is not clear enough to need
  two.
- **Don't expose the scale in the UI.** The system is invisible infrastructure. The
  only type controls a user sees act on the Specimen, never on the Face.
