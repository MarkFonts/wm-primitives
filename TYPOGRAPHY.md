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
- **Tracking on caps and on small sizes.** Bringhurst §3.2.1: letterspace all
  strings of capitals. Small optical sizes want air; large sizes want less.
- **Leading responding to measure and size.**

**A signal** is a change made to *say* something: this is a heading, this is
secondary, this is a label. Signals cost. There are four:

**size · case · ink · weight**

### The budget

> **One signal per distinction.** A role may differ from the text around it by
> **one** signal. Compensations ride along free and are never counted.

> **The absolute:** never **ink + size + case** together. Three ways of saying
> "minor" is not emphasis, it is a lack of confidence.

`opsz` moving with size is the given. The exception that proves it: `opsz`
*pinned* while size changes — a deliberate mismatch — is no longer a compensation.
It is a signal, and it is spent.

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
ground and stays honest in both themes. `--text-rgb` already exists for exactly this:

```css
color: rgb(var(--text-rgb) / var(--ink-quiet));
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
| `micro` | 8 | 1.2 | .06em ᶜ | auto | size |
| `label` | 12 | 1.3 | .12em ᶜ | 10 ᵖ | **case** (see below) |
| `ui` | 12 | 1.4 | 0 | 10 ᵖ | — (chrome norm) |
| `body` | 16 | 1.55 | 0 | auto | — (content norm) |
| `lede` | 18 | 1.5 | -.005em ᶜ | auto | size |
| `title` | 26 | 1.2 | -.01em ᶜ | auto | size |
| `display` | 40 | 1.1 | -.02em ᶜ | auto | size |

ᶜ compensation, not a signal · ᵖ pinned by policy (chrome must not drift between surfaces)

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

## IV. Face and Specimen

`--ui-font: "Face"` is the chrome; `--spec: "Specimen"` is the thing under test.
Type tokens describe **chrome only**. Specimen size, leading and axes are the user's
parameter space — systematising them would systematise the *subject* of the tool.

## V. Phases

**0 · Freeze the vocabulary.** Seven roles, three inks, the signal budget. Nothing
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

## VI. House style

- **No invented ramps.** The neutral scale, accent, radii, spring and durations
  already exist and are shared. Type adds `--type-*` and `--ink-*`, nothing else.
- **No `rem` gymnastics.** Chrome is device-anchored: px. `em`/`ch` for
  *relationships* — measure, indents, optical padding.
- **Count the signals before adding a rule.** If a new class changes two of
  size/case/ink/weight at once, the distinction it makes is not clear enough to need
  two.
- **Don't expose the scale in the UI.** The system is invisible infrastructure. The
  only type controls a user sees act on the Specimen, never on the Face.
