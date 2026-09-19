# Evaluating the primitives — methodology and plan

2026-09-16. The eight questions were answered the same day; the decisions are in §8 and
folded into the sections above them.

The question this answers: **does a primitive do what it says, where it is actually
deployed, for a finger, a mouse, a CI runner, another LLM, and a person wiring it in a
year from now?** Everything below is a way of measuring one of those five, and the plan
is ordered by how much of the last month's rework each would have caught.

Out of scope on purpose: the GitHub Pages system site. It is a showing, not a consumer.

---

## 0 · Where we stand (measured, not assumed)

| | today |
| --- | --- |
| Automated tests in wm-primitives | **none** — one linter (`lint-tokens.mjs`) |
| Automated tests in any consumer | **none** (font-proofer, ReCal, wordmarktools) |
| Consumers | font-proofer, ReCal, `wordmarktools/kernpare`, `wordmarktools/opsz-proofer` — all git submodules at `shared/`. Two kinds: **deployed** (font-proofer, ReCal, opsz-proofer → wordmark.nyc) and **local** (Kernpare, WORDMAKE — run on the user's machine, read local folders, render on the CPU) |
| **WORDMAKE** | `wordmarktools/wordmake/` has a PLAN, a VISION and a `dist/` — **no submodule, no import**. Nothing to evaluate yet; it is a port waiting to happen. |
| Deploy chain | push to `src/` → `consumers.yml` checks 3 consumers against the commit, then dispatches 3 repos → each `deploy.yml` builds against **latest main** (not its pin), bumps the pin, pushes into `wordmark` |
| What "verified" has meant | screenshots, DevTools measurements in one session, one phone, and `gh run list` after a push |
| Spec documents | `DIAL.md` (rules R1–R4), `SLIDERS.md` (census), `TYPOGRAPHY.md`, `CHANGELOG.md`, the CSS headers |

The CHANGELOG's own tally: roughly half of September's entries were a fix for a fix, and
every wrong one looked right where it was written. That is the thing the battery is for.
It has to run somewhere other than the environment the change was made in.

**Porting note.** Kernpare consumes the submodule but was not on the mobile pass at all;
WORDMAKE does not consume it yet. Both must still be ported *correctly*, and both are
**local apps**, not sites: they need local folders and CPU rendering, so "deployed" for
them means *builds and runs from a clean clone on a laptop*, and the live-bundle checks
in §4 do not apply. They get the §2/§3 suites in full and a §4 variant (D6 only).

---

## 1 · The five audiences, and what each one is a test of

```
finger / mouse   →  behaviour       does the control answer the gesture the spec promises?
eye              →  rendering       does it look the same in every host, at every size?
CI runner        →  deployability   does a change actually reach wordmark.nyc?
another LLM      →  spec fidelity   can the docs alone produce a correct instance?
future human     →  wiring cost     how long, and how many silent failures, to add it?
```

**The promise (Q1):** everything works *and* renders the same, from one source. So
rendering parity across hosts is the headline, not a per-host nicety, and §3 leads §2 in
the plan. Known divergent controls — ReCal's Type Matrix sliders — are listed in an
allowlist the rendering suite skips, so a hack stays a named hack rather than a red run
everyone learns to ignore.

Each row is a separate suite because each fails in a different way. A control can pass
behaviour and fail rendering (HDR gated wrong in light mode), pass both and fail deploy
(the ReCal `lint-tokens` failure that shipped nothing), pass all three and still be
unwireable (three specificity fights to pad one input).

---

## 2 · Behaviour — the control answers the gesture

**Method:** Playwright, running against each consumer's built `dist/`, with real
`pointer` events and the browser's own hit-testing. Not jsdom: half the bugs of the
last month were hit-target and layout bugs, and jsdom has no layout.

**Why the consumer and not the package:** the package has no build, no theme, no host
CSS. The bug that ended the last session — an unlayered `padding: 0 16px` in font-proofer
eating 16px of rail at each end — is *invisible* from inside the package. Every case runs
in at least two hosts (font-proofer, ReCal) because a rule that passes in one and fails in
the other is the definition of a specificity fight.

**Cases, derived from the spec and from the CHANGELOG's "fix for a fix" entries** —
each one is a bug that has already happened once:

| id | case | asserts | source |
| --- | --- | --- | --- |
| B1 | touch/pen press-and-drag from *anywhere* on a track row (mouse is native) | value follows finger; direction judged after 6px, conceded only at 1.5× vertical | `d14ae6a` · G1 |
| B2 | vertical swipe starting on a track row | page scrolls, value unchanged | `ffa2e95` |
| B3 | tap at x = 0 and x = width−1 | commits `min` and `max` | `0e55d1f` |
| B4 | `ew-resize` cursor across full rail width | at 0.7px, mid, width−1 | `0e55d1f` |
| B5 | press on stepper, hold 600ms | one step then repeat; a 6px horizontal move cancels repeat and becomes a drag | `0a0429c` |
| B6 | tap the value field, select all, type `2` then `4` on a min-8 dial | draft `2` allowed, commits 24 on blur, never emits 8 | `ffa2e95` |
| B7 | clear the field, blur | reverts to committed value, no NaN emitted | `ffa2e95` |
| B8 | row height while engaged and 3s after release | 48px throughout; only the bar changes | `0a0429c` |
| B9 | engaged bar does not shrink while pointer is still down | `release()` starts the timer, not `engage()` | `d14ae6a` |
| B10 | 120Hz synthetic drag, 60 samples | ≤ one `onChange` per frame; last sample always delivered (test with page hidden) | `d14ae6a` |
| B11 | `data-scrubbing` on root exactly during a live drag | present after 6px, gone on lift | `d14ae6a` |
| B12 | keyboard: focus number field, ArrowUp/Down, Shift for ×10 | steps, clamps, `aria-valuenow` follows; Home/End are not bound | GESTURES G24 |
| B13 | `auto` button/keystroke on an opsz dial | `'auto'` emitted; `a` key only when `allowAuto` | props doc |
| B14 | reference marker at `reference = min` | clamped ≥ 5px from the corner | `4cf89bf` |
| B15 | DIAL R1/R2: every value in a rail shares one right edge; every tag one x | measured across a real rail in each host | DIAL.md |

The full promise list is [GESTURES.md](GESTURES.md) (G1–G36); the B-ids above are the
first tests to write, not the whole spec.

Steppers, `AxisTriplet`, `Icon` states and `Collapse` get their own short
tables on the same pattern once the AxisSlider ones exist and are green — that control is
the one with the most reported failures, so it is first.

**Pointer profiles (Q2).** Each case runs under two Playwright contexts: desktop mouse
in Chromium, and **WebKit with the iPhone device descriptor** — Playwright's WebKit is
the closest thing to Safari a runner can drive; it is not Safari, and any phone-only
failure still ends on the phone. No tablet. When Windows becomes a target, the same
suite adds `windows-latest` × Chromium/Edge as a third context; nothing else changes.

---

## 3 · Rendering — the same control in every host

**Method:** Playwright screenshots of every visible dial row, pixel-diffed against a
checked-in baseline (did *this host* change?), per theme × pointer profile. Baselines are
regenerated only by a deliberate command, never by a failing run.

**Across hosts, numbers rather than pixels.** The hosts show different labels and values,
so two screenshots of `size` can never be equal; what *can* be equal is the row height,
label size and weight, bar height, field and stepper size. Those are read off the
computed style of one row per variant per host and every disagreement is printed. That
is the Q1 promise made into a number, and it never fails a run: a host overriding a
primitive is allowed by the layer contract, and the report exists to show *where*.

Cross-host diffs are **reported, not gating** (see Q3): the run posts the diff image
and both crops as an artifact, because the judgement of whether a 2px shift matters is
yours and has to be made by eye.

What this catches that behaviour tests cannot: the icon ladder's wrong end value, hover
repainting over active, the ramp-under-text that deleted every label, `--nudge` shifting
a centred label 2px. All four were visible; none were assertable as a number.

**What it cannot catch, and the substitute:**

- **HDR.** A screenshot of a PQ-masked mark is SDR. The assertion is structural instead:
  the computed `background-image` on an active mark in dark mode contains the AVIF
  data URI; in light mode it is `none` and `dynamic-range-limit` is `standard`. Whether it
  *glows* is still a device check, and the plan says so rather than pretending.
- **Fonts.** Variable-axis rendering differs by OS. Baselines are per-runner
  (`ubuntu-latest` only); a local run on macOS compares against nothing and reports
  diffs as *information*, not failure.

---

## 4 · Deployability — a change reaches the site

This is where "pushed ≠ shipped" gets a test instead of a memory.

| id | check | how |
| --- | --- | --- |
| D1 | every consumer's `lint:tokens` passes against wm-primitives HEAD | `consumers.yml` `check` job: checks out each consumer, puts *this commit* in its `shared/`, runs its lint — **before** `dispatch` (the old notify.yml, now a dependent job in the same file). This is the ReCal `--glow-pos` failure, moved from the consumer's deploy to the primitive's push. |
| D2 | every consumer's `tsc --noEmit` and `vite build` pass against HEAD | same job. A type or import break is currently discovered by three separate red runs. |
| D3 | the dispatch landed | `consumers.yml` already fails loudly on a missing token; add: poll each consumer's run for the dispatched SHA and fail if none appears within 2 min |
| D4 | the live bundle is the pushed commit | each deploy's last step, *The site serves what this run built*: polls `wordmark.nyc/<app>/` for up to 10 min until it serves the bundle (opsz-proofer: the `index.html` sha) this run built; fails loudly otherwise; says so if a later run superseded it. What was done by hand at the end of the last session, as a step. |
| D5 | the pin is truthful | the same step writes the `shared/` commit it built from into the job summary beside the served bundle — the run log is the answer to "what is live?" |
| D6 | the git route round-trips | a clean `git clone --recurse-submodules` of each consumer builds from nothing — catches `.gitmodules` drift and case-insensitive filename collisions (`Specimen` / `specimen.ts`) |

Sections 2 and 3 run inside D1's matrix so behaviour is judged on the *deployed* build,
not the local one.

**What blocks (Q3):** a red **behaviour** test or a failed D1/D2 stops `consumers.yml` from
dispatching — those are bugs, and shipping one to three sites to look at it has never
been the point. A **rendering** diff does not block; it attaches images to the run. The
change still ships and you judge it live, which is how you have been working, minus the
part where nothing recorded what changed.

---

## 5 · Spec fidelity — another LLM builds from the docs alone

The docs claim to be the spec ("if the page and the CSS disagree, the CSS is right";
DIAL.md "the thing to change before the CSS"). This measures whether that is true.

**Method:** a fresh model session, no repo access beyond `DIAL.md`, `SLIDERS.md`,
`TYPOGRAPHY.md`, the `AxisSlider.css` header and the props JSDoc, is given three tasks:

1. **Instantiate** — "add a `wdth` dial to this rail" in a stub app. Score: does it pass
   the section 2 table without edits?
2. **Theme** — "make the active accent `--signal` in this host." Score: tokens or props
   only, or did it reach for a selector? Did it try to out-specify the layer?
3. **Extend** — "add a keyboard shortcut to reset to `reference`." Score: touched
   `AxisSlider.tsx` in the place the file's own comments point at, or somewhere else?

Three models, three runs each. The output is not a pass/fail but a **list of the places
the docs were silent** — every wrong turn is a sentence missing from a spec file. That
list is the deliverable; it feeds back into DIAL.md.

**Repeatable (Q7):** it lives in `tests/spec-fidelity/` as fixtures — the stub app, the
three task prompts, the rubric, and a `RUNBOOK.md` that a Claude session can execute
after a compaction with no other context. Each run appends a dated results file. It is
the one suite whose runner is a model, so its instructions have to be written for one.

Run it *before* the WORDMAKE port. WORDMAKE is the first consumer that will be wired by
reading the docs rather than by the person who wrote the control, so it is the real
version of this test, and the dry run should come first.

---

## 6 · Wiring cost — a human adds it later

**Method:** timed, logged, on a stub Vite app with nothing but React.

| id | task | measure |
| --- | --- | --- |
| W1 | add the submodule, import one primitive, render it | minutes to first paint; number of errors before it |
| W2 | supply the host contract (`--ui-font`, `--text-rgb`, `color-scheme`, the icon font link) | which ones were discovered by reading, which by a broken render |
| W3 | override one rule the "wrong" way (a layered selector) and one the right way (unlayered) | did the wrong one fail *silently*? it will — so what told them? |
| W4 | run `lint:tokens` in the stub | did it exist / was it findable / did it need `.tokenlint.json` explained |

The score is a count of **silent failures** — things that did nothing with no message.
Every one is a candidate for a dev-mode `console.warn` in the primitive. That is the
cheapest fix the whole battery can propose and it is the one nothing measures today.

**Run 2026-09-17, result: two silent failures, two misleading errors, ~12 min and six
wrong turns to a correct dial.** The rail vanishes without `color.css` imported;
`color-scheme: dark` alone is black on black. Both are in [HOWTO.md](HOWTO.md) with the
warn() they want.

**Who it is for (Q6):** you in six months, or a collaborator with access to the private
repos. So the stub is not thrown away — it becomes `HOWTO.md`: *"a new dial design lives
in wm-primitives; here is how you add one, and here is how you build the receiving side
in a font-proofer feature."* The wiring run is the first draft of that page written by
doing it, and the warn() messages are its footnotes.

---

## 7 · Plan

Ordered by what would have caught the most of last month's rework per hour spent, with
rendering pulled forward because of Q1.

```
0. GESTURES.md   the §2 table promoted to a spec, one line per case, commit-traced   DONE bb3c8c8+
             → DIAL.md covers layout only; tests need something to cite (Q4)
1. D1 + D2   consumer lint/type/build matrix in wm-primitives CI; red blocks notify   DONE consumers.yml
             → verify: push a deliberately broken token, watch it fail HERE, not in ReCal
2. §3 baselines + cross-host parity: AxisSlider rows, HDR structural, dark/light, 2 profiles  DONE tests/render
             → verify: set GRAD to −50, the ladder diff goes red; Type Matrix allowlisted
3. B1–B4, B8–B10   Playwright, font-proofer + ReCal, Chromium + WebKit/iPhone     DONE tests/behaviour
             → verify: revert 0e55d1f locally, B3/B4 go red
4. D4 + D5   live-bundle check as a deploy step (deployed consumers only)          DONE fp 3dd0bcb · ReCal 6f1be5b · wmt 8b33dfa
             → verify: compare against the hash checked by hand last session
5. §6 wiring run on a stub → HOWTO.md first draft + the warn() list                DONE HOWTO.md
6. §5 spec-fidelity fixtures + RUNBOOK, one run across three models                DONE tests/spec-fidelity/results/2026-09-17.md
             → output: the "docs were silent here" list into DIAL.md / GESTURES.md
7. opsz-proofer joins the matrix 1:1. Kernpare joins §2/§3 + D6. WORDMAKE joins the
   day it has a submodule — and step 6 runs again against its port.
   DONE, as far as each is ready (2026-09-17):
   · opsz-proofer — render baselines, dark + light, and the parity numbers. Its rows
     WERE hand-emitted HTML wearing the primitive's classes (SLIDERS.md 57-59); since
     wordmarktools 5f4c808 they are the component itself via `dist/dial.js`, so the
     baselines now watch the real dial. Gestures still off for it: the rail suite
     drives a `tracking` track row, and this page draws `default` rows -- a suite for
     that variant is the next thing to write here.
   · Kernpare — took only toggleGroup.css at first. Since wordmarktools 45f060e it links
     the token sheets and aliases its palette to the house names; since 291c5f1 its
     Auto / Light / Dark is the ThemeSwitch engine; since 5f4c808 its two preview numbers
     are `wmDial` (track). Tests: clean checkout loads (a 12-pair fixture stands in for
     its gitignored data on a runner), the toggle group and the switch hold baselines,
     the switch passes G38-G41. No token lint yet: the kern-group-analysis UI is styled
     as it is on purpose and needs an exemption first. Not deployed; served static.
   · WORDMAKE — still no submodule. Nothing to test.
   · geist-serif-morf — asked about; NOT a git repo, uses nothing from the primitives,
     one native range input. It is a port candidate, not a consumer. What Mark said it
     and Kernpare would need before anyone else could use them — baked-in font metrics,
     precisely formatted kern lists — is product work the battery cannot do; it can
     only tell you when it is done.
8. Remaining controls get §2 tables: AxisTriplet, Icon — DONE GESTURES §9–10, tests/behaviour/{triplet,icon}.spec.ts.
   Collapse ships inside Fitting (GESTURES §11, 2026-09-19); StopSlider never existed here.
```

Nothing here changes a primitive. Steps 1 and 4 are CI only; 2 and 3 add a `tests/`
directory and a `test.yml`; 0, 5 and 6 produce documents.

---

## 8 · Decisions (answered 2026-09-16)

| q | asked | decided |
| --- | --- | --- |
| Q1 | same control everywhere, or same behaviour dressed per app? | **Both, from one source.** Rendering parity is the headline. Type Matrix is a named exception on an allowlist. |
| Q2 | which phone? tablet? | **iPhone / Safari** → WebKit + iPhone descriptor. No tablet. Windows later, as an added runner. |
| Q3 | does red block deploy? | Recommended and taken: **behaviour red blocks dispatch; rendering diffs report with images and ship.** |
| Q4 | spec of record for gestures? | Recommended and taken: **`GESTURES.md`, which *is* the §2 table**, written first (step 0). Ad-hoc testing on one receiving copy of font-proofer was the whole method until now. |
| Q5 | HDR pass criterion? | **Structural assertion in CI + a manual sign-off checklist.** A Swift decode proving the asset's PQ values is a later nicety. |
| Q6 | who is the future human? | **You in six months, or a collaborator on the private repos.** The wiring run becomes `HOWTO.md`. |
| Q7 | LLM test once or repeatable? | **Repeatable**: fixtures + `RUNBOOK.md`, written so a post-compaction session can run it. |
| Q8 | kernpare / opsz-proofer / WORDMAKE on the same promise? | **opsz-proofer 1:1. WORDMAKE 1:1 when it exists.** Kernpare and WORDMAKE are **local apps** (local folders, CPU rendering): full §2/§3, deploy checks reduce to "clean clone builds and runs". |
