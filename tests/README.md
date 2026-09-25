# tests/

The battery from [EVAL.md](../EVAL.md). What exists so far:

| dir | EVAL § | what it holds |
| --- | --- | --- |
| `behaviour/` | 2 | GESTURES.md, on the built hosts: a real Chromium touch (CDP) and a synthesised WebKit one, plus a mouse; `theme.spec.ts` for the switch |
| `render/` | 3 | every visible dial row in every host, screenshotted and held to a baseline; the cross-host parity report |
| `__screenshots__/` | 3 | the baselines, **committed**, cut on linux in CI |

The hosts are the consumers' *built* `dist/`, served by `serve.mjs` at the base path each
deploys to. Locally they are the sibling checkouts (`../font-proofer/dist`, `../ReCal/dist`,
`../wordmarktools/opsz-proofer/dist` — build them first; `../wordmarktools/kernpare` is
served as-is); in CI they are fresh checkouts with this commit in `shared/`.

```
npm run test:behaviour         # gates dispatch in CI
npm run test:render            # compare against the committed baselines
npm run test:render:update     # re-cut them -- refuses outside CI (scripts/update-snapshots.mjs)
npx playwright show-report     # the diffs, side by side
```

A run on a Mac compares macOS text rendering against linux baselines and will report
small diffs. Windows has its own set: `consumers.yml`'s `windows` job sets
`WM_PLATFORM=win32` and reads `tests/__screenshots__/win32/` instead (report only). That is information, not a verdict: read the report, and only re-cut
baselines from CI (`workflow_dispatch` on Consumers, then download the artifact).

Cross-host is **numbers, not pixels**. The hosts show different labels and values, so two
screenshots of `size` cannot be equal; the row height, label size and weight, bar height
and field size can. `rows.spec.ts` collects those per host into `test-results/parity/`
and the last test prints every disagreement. It never fails: a host overriding a
primitive is allowed by the layer contract, and the report exists to show where.

**Three projects.** `desktop` (Chromium, mouse), `iphone` (WebKit wearing the iPhone
descriptor — the nearest a runner gets to Safari), and `touch` (Chromium wearing the same
phone). The third exists because WebKit cannot be handed a touch drag: the `iphone`
project synthesises pointer events on the element, which exercises the rail's judgement
exactly but not the browser's; `touch` sends a real touch through CDP, so the browser
arbitrates it — and that is where the capture bug was found.

**The hosts' `shared/` is a pin.** Locally, `../font-proofer/shared` is a submodule at
whatever commit that app last recorded, not this working tree. To test a change to the
primitive, point it at your commit first:

```
git -C ../font-proofer/shared fetch ../../wm-primitives <branch> && git -C ../font-proofer/shared checkout FETCH_HEAD
```

and rebuild the host. CI does this for you.

## font-proofer's own behaviour

`tests/behaviour/font-proofer.spec.ts` (2026-09-25) is the app around the primitive: every
mode opens clean; a dropped roman + italic pair is one family with the rail on `auto`
and reset returning to it; the UI board is set in the uploaded face; six axes make six
rows. Its fixtures are two OFL faces from google/fonts, subset in `tests/fixtures/`: the
DM Sans pair as Google Fonts ships it, and Google Sans Flex cut to a pangram for its six
axes. Not Cal Sans on purpose -- the board and reset bugs it guards only show with a
face that is not the app's own.

## The hosts as apps, and where their labels sit

Three more behaviour suites (2026-09-25), all against the builds the browser job already
makes:

- `alignment.spec.ts` + `alignment-lines.json` -- alignment is a rendered fact, not a CSS
  literal. For font-proofer and ReCal, at 1500px, the left edge of the TEXT of every
  label the JSON names must land on one of that region's named lines, each line with
  the sum that puts it there (rail 16 + border 1 + padding 12 = 29). A line marked
  `open` is a disagreement recorded so the suite is green today and deleted when it is
  fixed, like `parity-allow.json`: today font-proofer's mode buttons at 24 and ReCal's
  matrix title at 22. Baselines are the next half.
- `recal.spec.ts` -- ReCal as an instrument: every mode opens clean, the rail walks its
  three panels and back, the type panel's picker changes the readout, Paragraph swaps
  its specimen. (The pyodide export engine's CDN failure under `sealed()` is filtered;
  it is not the instrument.)
- `kernpare-smoke.spec.ts` -- against the 12-pair fixture: it opens, lists twelve
  pairs, takes an edit (click, type, Enter), counts it, and reverts it. The fenced
  analysis UI is not touched.
