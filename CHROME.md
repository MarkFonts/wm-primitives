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

## Retirement list

Each is a class → `.wm-btn` (or `.wm-select`) swap plus deleting the app's rule.

- **font-proofer**: `.mode-btn` (+ `.mode-btn-row` stays as the strip), `.calcom-clock-btn`,
  `.tray-btn`; selects: `.instance-select` ×3 → `.wm-select`.
- **ReCal**: `.rail-preset` → `.wm-select`; `.style-menu-btn` → `.wm-btn` (its inverted
  hover is `--solid`'s look, so decide whether the hover inverts or the button is solid);
  `.freezer-reset` → `.wm-btn` + `t-label`; `.export-btn` → `.wm-btn--solid`.
- **Kernpare**: done here.
- **opsz-proofer**: `.seg` → `.ui-seg`, done here.
