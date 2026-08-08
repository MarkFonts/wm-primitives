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
place instead of picking from a scale. Same story in two units at once on
wordmark.nyc (`.5625rem`, `.6rem`, `.625rem`, `.65rem` = 9, 9.6, 10, 10.4px).

## The two rules that make this a *typography* system

**1. A type token is a bundle, not a number.**
With a variable font carrying `opsz`, a size on its own is a half-truth: 11px set at
`opsz 32` is a different typeface than 11px at `opsz 11`. So a role resolves to
**size · leading · opsz · weight · tracking · measure** — the whole instrument
setting. This is ReCal's own thesis applied to our chrome.

**2. Tokens govern the Face. The Specimen is deliberately untokenized.**
`--ui-font: "Face"` is the chrome; `--spec: "Specimen"` is the thing under test.
Type tokens describe **chrome only**. Specimen size/leading/axes are the user's
parameter space — systematising them would be systematising the *subject* of the
tool. Keep that border bright; it's the one both apps already got right by instinct.

## Vocabulary: roles, not sizes

No `text-xs … text-9xl`. Ladders like that describe magnitude; we want the job, so
the value can change without the name lying.

| role | size | leading | opsz | wght | tracking | used for |
|---|---|---|---|---|---|---|
| `micro` | 8 | 1.2 | auto | 400 | .08em | glyph captions, rule labels |
| `label` | 10 | 1.3 | auto | 500 | .12em | section labels, uppercase eyebrows |
| `tag` | 11 | 1.2 | auto | 400 | .04em | axis tags, codes, chips |
| `ui` | 12 | 1.4 | 10 | 400 | 0 | dense controls, sliders, menus |
| `ui-lg` | 13 | 1.45 | 10 | 400 | 0 | buttons, inputs, tabs |
| `body` | 16 | 1.55 | auto | 400 | 0 | prose, docs, marketing copy |
| `lede` | 18 | 1.5 | auto | 400 | -.005em | intros, standfirsts |
| `title` | 26 | 1.2 | auto | 640 | -.01em | panel + page titles |
| `display` | 40 | 1.1 | auto | 700 | -.02em | hero, big statements |

Nine roles replace forty-four sizes. Two extras, both real needs already in the code:
`readout` (= `ui` + `tnum`, for numeric values that must not jitter) and `code`
(the only sanctioned monospace, for the copyable CSS string).

### The `opsz` column is the point

- **`auto`** — the default. `font-optical-sizing: auto` already ties opsz to
  font-size; content roles just need us to *stop fighting it*.
- **pinned (10)** — chrome only, and only where text is small and must stay
  optically identical across contexts. This is exactly the existing
  `--ui-fvs: "opsz" 10, "GEOM" 25`.

The two failure modes to encode against: pinning opsz on content (kills the reason
we ship a variable font) and letting auto loose on chrome (labels drift between
surfaces).

## Shape of the API

```css
/* type.css — one bundle per role */
:root {
  --type-ui-size: 12px;  --type-ui-leading: 1.4;
  --type-ui-wght: 400;   --type-ui-track: 0;   --type-ui-opsz: 10;
}
.type-ui {
  font-family: var(--ui-font);
  font-size: var(--type-ui-size);
  line-height: var(--type-ui-leading);
  letter-spacing: var(--type-ui-track);
  font-variation-settings: "opsz" var(--type-ui-opsz), "wght" var(--type-ui-wght);
}
```

```ts
// type.ts — same bundle for inline styles / React
type('ui')          // → CSSProperties
type('title', { measure: '32ch' })
```

Both, because our surfaces are split: CSS classes for static markup (wordmark.nyc),
the helper for computed styles (the primitives already build inline styles).

## Phases

**0 · Freeze the vocabulary.** Agree the table above — names and opsz policy, not
final numbers. Nothing ships. *Done when the role list stops changing.*

**1 · `type.css` + `type.ts` in wm-primitives.** Tokens, nine role classes, the
helper. Additive; nothing consumes it yet. *Done when both apps build unchanged.*

**2 · Adopt inside the primitives (74 decls).** Smallest surface, hardest cases
(AxisSlider labels/tags/values are four roles in one row). If the vocabulary
survives this, it's real. *Done when `shared/src/*.css` has no raw `font-size`.*

**3 · ReCal chrome (197), then font-proofer (43).** Rail, dock, panels, scene
chrome. Explicitly **not** the specimen surfaces. *Done when the only raw sizes left
are specimen-driven.*

**4 · wordmark.nyc (524).** Biggest and least urgent — do it with a codemod once the
scale is proven, mapping the 44 sizes onto the nine roles. Expect ~10 genuine
one-offs; give those a `--type-once-*` and a comment saying why.

**5 · Hold the line.** A stylelint rule banning raw `font-size` outside `type.css`,
and the density/theme extension (`compact` chrome for the instrument's dense rails)
once the base is stable.

## House style — what to avoid

Notes for anyone (human or agent) extending this, because the default instincts are
all slightly wrong for a type foundry's own tools:

- **No invented ramps.** The neutral scale, accent, radii, spring and durations
  already exist and are shared. Extending type means adding `--type-*` only.
- **No `rem` gymnastics.** Chrome is device-anchored: px. Use `em`/`ch` for
  *relationships* — measure, indents, optical padding — where they're the honest unit.
- **No generic scale names.** `text-lg` tells you nothing about whether it may
  change; `lede` does.
- **Don't expose the scale in the UI.** The system is invisible infrastructure. The
  only type controls a user sees are the instrument's own — which act on the
  Specimen, never on the Face.
- **Don't tokenize the Specimen.** Repeating it because it's the one that'll get
  broken: the proofed font's size, leading and axes belong to the user.
