# Every rule, and what enforces it

NEXT.md B, first item: walk each spec, and for every rule write the check that holds
it — or the honest label **by eye**, which means: nothing does, a person has to look.
The unlabelled middle is where drift lives, so there is no unlabelled middle here.

Legend — **lint**: `scripts/lint-tokens.mjs`, fails a push · **render**: `tests/render`,
pixel baselines per host and the cross-host parity gate · **gesture**: `tests/behaviour`
· **CI**: a `consumers.yml` step · **by eye**: no check exists yet · **runtime**:
`src/contract.ts`, a dev-mode `console.warn`.

## DIAL.md — layout

| rule | enforced by |
| --- | --- |
| R1 values share one right edge | **render** — `tests/spec-fidelity/score.mjs` measures it; `rows.spec.ts` does not yet assert it. *by eye* in the row suite → **TODO** |
| R2 tags share one x | *by eye* → **TODO**, same measurement |
| R3 the name is never clipped; `--axis-label-w` is a floor | *by eye* |
| R4 nothing shifts when the arrows appear | *by eye* |
| §3 one field, and it is text (a real minus) | **gesture** G19–G23; `nbMinus` |
| §4 `auto` is named on screen, not only a key | **gesture** G25, G35 |
| §5 the rail supplies the column width | *by eye* |
| §6 theme through tokens, behaviour through props, selectors last | **lint** (literals), **runtime** (`--border`), the `@layer` contract |
| §7 `track` and `default` are one DOM | **render** parity — same parts measured in both |
| §7 `lockedAbove` / `reference` painted onto the bar | **gesture** G10 (reference clamp); `lockedAbove` *by eye* |
| §8 checklist: tags off / units off / touch sizing / vertical / focus / auto in greyscale | touch sizing **gesture** G11–13; the rest *by eye* |

## GESTURES.md — behaviour

Every numbered promise has a test or says it does not: G1–G5, G8, G9, G11–13 (`rail.spec.ts`, per variant), G19–G23 (typing), G38–G42 (theme), G43–G48 (triplet), G49–G55 (mark). Untested: **G6, G7, G10, G14–G18, G24–G37**. Those are *by test-gap*, not *by eye* — the promises are exact, the tests are unwritten. G7 (one update per frame) and G31 (the chevron flash) are the two most worth writing.

## TYPOGRAPHY.md — type

| rule | enforced by |
| --- | --- |
| I · compensations are free, signals budgeted (six signals) | *by eye* — the budget is a review rule, and stays one |
| Tracking only positive, only on capitals | **lint** partly (`--track-caps` is the only tracking token); a negative literal is not caught → **TODO** |
| Space: the `--spacing-*` scale, no literal padding/gap off it | **lint** — `STEPS`, padding *and* gap |
| The cap rule `padding-x ≥ 0.6 × radius` | *by eye* (needs computed values; a render-time assertion is possible) |
| Height follows the type, never a fixed number | *by eye*; `Collapse` exists for exactly this |
| II · three inks, relative not ranked; hue is not an ink | **lint** (the `--ink-*` tokens; colour literals) |
| III · roles spend size and nothing else; no ladder names | **lint** `typeParity` — the `t-*` classes must match `type.css`; a raw px `font-size` fails |
| IV · the poster scale, ratio √2 | **lint** `typeParity` |
| VII · never synthesise a style; address the axis | *by eye* — `font-style: italic` on a variable face is not caught → **TODO** (one regex) |
| VII · declare in rem, write in px | **lint** `SIZE_OK` |
| VII · no invented ramps | **lint** (tokens only) |
| VII · the scale is invisible in the UI | *by eye* |

## GRADIENTS.md

Not on `main` yet (a parallel session's branch). Its rows go here when it lands; it
ships with `tests/unit`, so most will be **unit**.

## The contract and the pipeline

| rule | enforced by |
| --- | --- |
| every host token has prose | **lint** (`hostTokenDocs`) |
| `--border` resolves on a dial; `data-theme` accompanies a dark scheme | **runtime** |
| COMPONENTS.md and HOST-CONTRACT.md match their inputs | **CI** |
| `dist/dial.js` matches `src/` | **CI** |
| every consumer builds against the commit before any deploys | **CI** |
| a deploy is live, not only pushed | **CI** (each consumer's last step) |
| the same row renders the same in every host | **render** parity gate + `parity-allow.json` |

## The TODO line

Four checks would move the most rows off *by eye*: R1/R2 as a render assertion (the
score script already has the measurement), a negative-tracking regex, a
`font-style: italic` regex, and G7. All under an hour each.
