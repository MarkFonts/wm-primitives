# TRANSPORT.md — the play bar proposal, and what is left to decide

**Status: six bar schemas drawn, in two registers. None chosen, none production-ready.**
The pages are [`docs/system/pages/transport.html`](docs/system/pages/transport.html) and,
before it, [`docs/system/pages/play.html`](docs/system/pages/play.html). Both are linked from
*WIP primitives · pages to decide from* and deliberately **not** registered in `build.py`'s
`SECTIONS`, for the reason [BUTTONS.md](BUTTONS.md) gives: Pages serves them in place, and a
page whose purpose is to be argued with must not need a rebuild to be seen.

Two apps need the result: **WORDMAKE** (`wordmarktools/wordmake`, `src/app/rails/Transport.jsx`)
and **Morf** (`wordmarktools/morf`, `src/Playbar.tsx`). Both have a bar today; neither bar is
the other's, and neither is a primitive.

---

## 0 · What was decided before the drawing (2026-09-23)

Four answers, Mark's, that the pages are built to:

- **One primitive, two registers.** wm-primitives ships one Transport — *play · scrubber ·
  readouts slot*. WORDMAKE mounts it with step / play / frames / clock / loop / rate. Morf
  mounts it with tune / play / builds / labels. Nothing is a per-app fork.
- **No stage click.** The "over-everything" play — the whole preview or specimen as the
  target — was proposed on `play.html` (07 · Stage) and withdrawn in full. The bar is the
  whole instrument.
- **Morf spaces its stops by build index, evenly.** Every beat is one step. Dates are labels,
  never distances.
- **The bar, not the button, is the object.** `play.html` asked what carries the play/pause
  *state* and drew seven answers; the reframe is that the transport is the most important
  UI in both tools and the button is one of its parts. `play.html` stays as the record of
  the button question.

## 1 · What all six obey

| | |
|---|---|
| the unit | WORDMAKE's scrubber is in **frames**, never seconds — the frame is what a designer argues about when a clip is cut against an endcard. Morf's is in **builds**. |
| scrubbing pauses | pointerdown on any track pauses and stays paused. A head that runs away from the hand dragging it is the one thing a transport must never do. |
| readouts | tabular figures, one ink each: counter full, clock quiet. Loop is a state, not a colour. The rate is a select and says `23.976`, never a fraction. |
| keys | Space toggles. ←/→ step one unit; shift × 10 in WORDMAKE. Every bar is focusable; the ring is never removed. |
| the mark | Material, from the full face: `play_arrow` / `pause` FILL 1, wght 300 → 400 when on; `repeat` for loop, filled when on; **the rate as its own ligature** — `24fps_select` / `30fps_select` / `60fps_select` / `autofps_select` (25 and 23.976 have none and fall back to text). The page's § 00 shows the whole media vocabulary on the axes. |
| target | 44px, as padding. Where a schema is taller than 44px the extra height is readout, not target. |
| no acid | `--signal` is not spent on the transport. WORDMAKE's export button already wears it once per screen. |

## 2 · The six, and what each cannot do

| | schema | what carries it | what it costs |
|---|---|---|---|
| 01 | **Deck** | controls · track · readouts, disciplined to the button laws | the control group; loop and rate sit as furniture on every bar |
| 02 | **Slate** | the readout is the object — count at 22px, track a hairline under it | 64px tall; the track is small enough that scrubbing is a precision act |
| 03 | **Ruler** | a graduated track — a tick per second / per build, labels along it, a flagged head | width; does not degrade below ~900px; loud for a floor |
| 04 | **Strip** | the 44px footer *is* the scrubber; elapsed fills it; controls sit on the fill | a miss on a control is a seek; "playing" and "held" share a surface |
| 05 | **Cells** | discrete — 24 cells (seconds) / 11 cells (builds) | WORDMAKE loses the frame as a drag target; Morf legible to ~30 builds |
| 06 | **Overlay** | broadcast — a strip on the picture, hover-revealed, auto-hides; LIVE dot and **measured** fps | discoverability; gives up the floor as a floor; 58.9 fps on battery |

Morf's register in 04 fills a build's width at each beat, with seams between — the one
schema where the fill has the grain of the content. 05 is the other: a beat is discrete and a
cell is discrete.

## 3 · What none of the six has had

- [ ] **No accessibility pass.** `aria-pressed` and labels are set; nothing has been near a
      screen reader, and the range semantics of a custom scrubber (`role=slider`,
      `aria-valuenow`) are not drawn.
- [ ] **No coarse-pointer test.** 04's tap-vs-drag threshold is 4px on a mouse and untested
      on a thumb. 44px is asserted, not measured.
- [ ] **No narrow width.** Both registers were drawn for a footer of 600–900px. Below 600 the
      WORDMAKE readouts collide in every schema but 05 and 06.
- [ ] **The marks are not in the subset.** `fonts/MaterialSymbolsOutlined.woff2` has 24
      ligatures and none of the transport's — not `play_arrow`, `pause`, `repeat`, nor any
      `*fps_select`; the pages draw from the full face in
      `docs/fonts/`. Both apps draw the marks as Cal Sans glyphs today. Growing the subset is
      the first commit of whichever schema wins — see `icon.css` and `scripts/lint-icons.py`.
- [ ] **Not written against the engines.** The pages run fake clocks. WORDMAKE's readout is
      written imperatively from `engine.subscribe`, sixty times a second, outside React;
      Morf eases build to build with `SEG 900 / HOLD 420` at speed 1. The primitive's API is
      whatever lets both keep doing that without a re-render per frame.

## 4 · The order the decisions have to be taken in

1. **The schema** — or the pairing, since the registers may take different schemas if the
   shared bones are the slot contract. Nothing below can start first.
2. **The slot contract** — what the primitive owns (play, track, head, keys, pause-on-scrub)
   and what the app supplies (readouts, options, the clock).
3. **The subset** — add the marks the chosen schema spends (play, pause, repeat, the fps
   ligatures it needs), both copies, lint clean in every consumer.
4. **WORDMAKE first** — it has the harder clock (frames, loop, rate) and the imperative
   readout; if the primitive survives it, Morf is a second mount, not a second design.
