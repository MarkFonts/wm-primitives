# From a set of primitives to a system people can build on

A checklist, 2026-09-18. Written after the battery landed (EVAL.md) and the last copied
slider was retired (SLIDERS.md). What exists is real: tokens, a dial with a spec and a
test suite, a theme switch, a chevron, a mark, a deploy chain that only ships what
passes. What does not exist yet is the thing that makes a stranger fluent in it.

Ordered. Each item names what "done" looks like, because "make it consistent" is not
a task. Skip nothing above the line you are on; below it, pick.

---

## A · The thing a stranger reads first (this is the gap)

- [ ] **One page that says what the system IS, in the order a builder meets it.**
      Today the truth is split across nine files that each assume the others. Done: a
      `README.md` that answers, in this order — what you get, what you must supply (the
      host contract), how to add a dial, how to override, how to know it shipped — and
      links out. HOWTO.md is most of the words already; the README is not.
- [ ] **A component index with one line each.** Every export in `index.ts`: name, one
      sentence, which apps draw it, link to its spec. Generated from the JSDoc, not hand
      kept — a hand-kept list is the SLIDERS.md census again, right until it is not.
- [ ] **The host contract as a file, not a comment.** `.tokenlint.json`'s `hostTokens`
      is the real list; it needs a prose twin: for each token, what it is, a default, and
      what breaks without it (the two silent failures HOWTO found are the model).
- [ ] **Name the promise.** EVAL Q1 decided it: *works and renders the same, from one
      source.* It appears in EVAL.md and nowhere a builder looks. Put it in the README's
      first paragraph and make every other rule answer to it.

## B · Make the rules enforce themselves (the lint is the system)

- [ ] **Every rule in TYPOGRAPHY / DIAL / GRADIENTS has a lint or a test, or is marked
      "by eye".** Walk each file; for each rule write the check or the honest label. The
      unlabelled middle is where drift lives.
- [ ] **`console.warn` in dev for the silent failures.** HOWTO lists them: no token ramp,
      `color-scheme` without `data-theme`. Cheapest fix the battery proposed; unbuilt.
- [ ] **The gesture suite covers every variant, not the one row the hosts share.**
      `default` and `diamond` have no gesture tests (opsz-proofer is `gestures: false`
      for exactly this). Done: `rail.spec.ts` parameterised by variant.
- [ ] **Cross-host parity becomes a gate for the numbers the primitive owns.** The report
      exists; the decision of which disagreements are allowed does not. Done: an
      allowlist file with a reason per line (Type Matrix, ReCal's 14px rail), everything
      else red.
- [ ] **A `contract` test for the no-React bundle.** `wmDial.mount / get / set / update /
      destroy` is an API three pages depend on and nothing tests it but a smoke probe.

## C · Fewer ways to say one thing (the census, continued)

- [ ] **Buttons.** There is no house button. Every app draws its own; Kernpare has five
      rules for one thing. A census like SLIDERS.md, then one `Button` (or one CSS
      contract) and the retirement list. This is the next slider-sized job.
- [ ] **Select.** Two apps hang the house chevron off a native `<select>` by copying the
      same wrapper. One `Select` primitive, or one documented pattern with a class name.
- [ ] **Section labels, tags, chips.** `t-label`, `.sect`, `.tag`, `.slider-tag`,
      `.style-menu-caret`… Count them; most are `t-label` or `t-micro` with a colour.
- [ ] **Icon inventory.** 24 marks, recorded on the system page. Add: which app uses
      which, so removing one is a search, not a guess.
- [ ] **Retire `◆`.** The vocabulary still says diamond; the marker is a foot tick.

## D · The decisions still open (write them down or they get re-argued)

- [x] **Typing commits when?** Enter or blur, everywhere; Escape abandons. GESTURES §0
      *Typing*; the triplet moved (G45), its test with it. 2026-09-19.
- [x] **Mouse drag-from-anywhere.** Per pointer. The native range already drags from
      wherever the press lands; the G18 test proves it. 2026-09-19.
- [x] **`default` variant: 14px or 24px rail?** Per host: `--dial-track-h`, 24 default,
      14 floor. DIAL §7. 2026-09-19.
- [x] **The dial's type size is inherited.** The text never was — 12px in every host —
      but the label *box* inherited size and leading, so rows were 18px in two hosts and
      18.8 in the third. The box sets both now; the tokens got fallbacks. 2026-09-19.
- [x] **`em` on the measure dial** — converted: ReCal's `.para-doc` takes the body
      style's size, so `34em` is 34 body ems. 2026-09-19.
- [x] **StopSlider and Collapse** — Collapse ships: `Fitting` wraps its two sections in
      it, in both apps' H&J panels (GESTURES §11). StopSlider was a name with no file.
      2026-09-19.

## E · Getting it into more hands

- [ ] **WORDMAKE joins.** It has no submodule. The day it does, run the spec-fidelity
      book against its port (tests/spec-fidelity/RUNBOOK.md) — that is the real version
      of the docs test.
- [ ] **Kernpare and geist-serif-morf as "usable by others".** Product work, not system
      work: baked-in font metrics, formatted kern lists. Define done for each; the wiring
      test (HOWTO) can then measure it.
- [ ] **Windows.** EVAL Q2 deferred it. One more runner, one more baseline set.
- [ ] **The Kernpare token lint.** Needs the analysis-UI exemption written first; then
      the same gate the other apps have.
- [ ] **A public system page that is the README rendered**, not a gallery beside it.
      Today the Pages site is for show (your words) and the README is thin; one source.

## F · Process, so the next month is cheaper than the last

- [ ] **A CHANGELOG entry per PR, asserted.** The night the log went silent is in it.
      Done: the CHANGELOG check is a CI step — a PR touching `src/` without an entry is red.
- [ ] **Baselines re-cut from CI only.** README says it; make `test:render:update` refuse
      to run outside CI unless forced.
- [ ] **A release tag when a consumer-visible contract changes** (a prop, a token name,
      `wmDial`'s API). Consumers pin by tag, not by "latest main" — the `--remote` deploy
      is convenient and it is also why "what is live" needed a step to answer.
- [ ] **Retire `git` on this machine for the private repos**, or fix it. The memory file
      says why; every session pays for it.

---

What makes a system world-class is not the count of components. It is that a builder can
predict what the next one will do before reading it, and that the system tells them,
loudly, when they have stepped off it. A, B and F are that. C, D and E are more surface.
