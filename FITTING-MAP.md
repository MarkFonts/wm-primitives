# Where the line fitting lives

Hyphenation, justification and the Swiss rag are one engine and one control panel, both
in this repo. Both apps consume them through `index.ts` and neither owns any of the
logic. Line numbers drift; the function names don't.

## The engine — `src/flattersatz.js`

Plain JS, no React, no build step, because wordmark.nyc script-tags it into a static page.

| what | where | notes |
|---|---|---|
| **Options and their defaults** | `DEFAULTS` (~69) | Every knob in one object. Start here. |
| What "Swiss Rag" arrives as | `SWISS_PRESET` (~148) | The band alone, budgets off. |
| **Hyphenation** | `hyphenPoints()` (~556), `PREFIXES` (~547), `SUFFIXES` (~550) | Rules, not a dictionary — three of them: after a prefix, before a suffix, between two consonants. Digraphs never split. Justified only, and off by default. |
| **The paragraph composer** | `kpBreak()` (~622) | Knuth–Plass. Justified only. The penalties near the top of the function are the tuning surface. |
| **The single-line composer** | inside `layoutParagraph()` (~812) | Greedy. What the rag uses, and what justified falls back to when KP scores nothing. |
| **The rag band** | `targetFor()` (~519) | Even lines get the column, odd lines the column less `ragWidth`. This *is* the Swiss rag. |
| **Budget spending** | `fitLine()` (~394) | Letter spacing → word spacing → expansion, then the uncapped residue for justified only. Order is deliberate. |
| Budgets as min/desired/max | `band()` (~289), `budgetsOf()` (~298) | A plain number still means the old single knob. |
| **Hanging punctuation** | `PROTRUSION` (~498), `protrude()` (~505) | Two rules, one per edge. A character hangs its own measured width. Add a character to a class and it hangs. |
| **The widow killer** | in `buildItems()` (~758), `keepLastWord` in DEFAULTS | The space before the final word stops being a legal break. |
| **Expansion / width axis** | `widthAxis()` (~332), `axisFor()` (~351), `expandValue()` (~369) | Moves the font's `wdth` where one exists; `scaleX` where it doesn't. Quantised in whole percent. |
| **Measurement** | `makeMeasurer()` (~226), `getProbe()` (~162) | DOM, never canvas. Tracking is arithmetic, not re-measurement — see `WIDTHS` (~208) and `styleBucket()` (~210). |
| Runs (inline italic/bold) | `toRuns()` (~732), `runWords()` (~741), `runsFrom()` (~793) | A line is runs, so emphasis survives fitting. |
| **The entry point** | `layoutParagraph()` (~812) | Everything above is called from here. |
| Line → CSS | `lineStyle()` (~927) | The only place that emits style. |
| Static-page helper | `applyTo()` (~951) | For script-tag use; no React. |

Types are in `src/flattersatz.d.ts` — `FitOptions` is the readable summary of every knob.

## The controls — `src/Fitting.tsx`

| what | where |
|---|---|
| Which mode an alignment + rag switch means | `fittingMode()` (~70) |
| The alignment buttons | `AlignmentButtons()` (~46), `ALIGNMENTS` (~43) |
| **The whole panel** | `FittingControls()` (~130) |
| One min/desired/max row | `BandRow()` (~92) |
| The rag's opt-in knobs | `ragKnob` (~145) |
| The wdth / x-scale badge | `expansionChip` (~143) |
| The fitted renderer | `FittedParagraph()` (~271) |

The two collapsing sections are `<Collapse>` (`src/Collapse.tsx`), which measures its own
content and drops its cap once open. Their heights used to be four numbers typed into the
component — 108 / 300 / 34 / 240 — so adding a row meant guessing a new one, and every
guess was wrong the moment a label wrapped.

Styles: `src/Fitting.css` — `.fit-switches` (5) the Swiss Rag / Hyphenate pill, `.fit-hj`
(91) the query CONTAINER, `.fit-hj-row` (101) the H&J row layout and the `@container`
block under it that stacks the label above its box below 15rem, `.fit-hj-fields` (140) the
shared field box, `.fit-num` (168) and its override at (200), `.fit-chip` (214) the badge.
`src/collapse.css` is the disclosure box; `src/Specimen.css` has the read-more tail.

**The panel's contract with the app is a WIDTH.** Give it one and allow it any height:
the rows read the container and pick beside-or-above themselves, and the three values are
always a third of whatever is left. A 260px rail (228px of content) stacks; a wider panel
does not. Nothing about the layout is a prop, and nothing is a media query — the rail can
be dragged narrower and the rows follow.

**Careful with `.fit-num`:** the host apps style `input[type="number"]` globally, and an
attribute selector outranks a bare class. Anything set on `.fit-num` alone may be silently
overridden in the app — see the `.fit-hj-row input.fit-num` block and issue #4.

## What each app touches

Neither app contains fitting logic. They own state and placement only.

**font-proofer — `src/App.jsx`**

- `fit` state and reset: ~487, ~1745
- `swissRag` state: ~588 · derived mode: ~589
- **`fitOpts`** — the object handed to the engine: ~592
- The panel in the sidebar: ~1906 · alignment buttons: ~1750
- The fitted paragraph render: search `<FittedParagraph`

**ReCal — `src/instrument/Shell.tsx` and `src/instrument/scenes.tsx`**

- `fit` / `swissRag` / `textAlign` state: Shell ~565–568
- The panel, inside the floating Type panel: Shell ~528–531
- **The object handed to the engine**: Shell ~629
- The fitted paragraph render: scenes ~744

## "I want to change…"

| …this | go here |
|---|---|
| what a fresh paragraph does | `DEFAULTS` in flattersatz.js |
| which characters hang, and how far | `PROTRUSION` |
| how words are hyphenated | `PREFIXES` / `SUFFIXES` / `hyphenPoints` |
| how loose a justified line may get | the penalties in `kpBreak` |
| the order budgets are spent in | `fitLine` |
| what the rag band does | `targetFor` |
| the panel's layout or labels | `FittingControls` + `Fitting.css` |
| where the panel appears | the app, not here |
