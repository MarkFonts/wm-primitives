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

- [x] **Reduce the mask-vs-backdrop-filter claim to a minimal repro.** Done 2026-09-20.
      It was never a property of `backdrop-filter`: `corner-shape: superellipse(1.2)`,
      applied page-wide, drops the mask on any layer whose HOST carries a non-round
      corner shape. Only the host matters, which is why resetting the layers changed
      nothing and why the computed styles gave nothing away. Found by lifting the panel
      up its ancestor chain until masking started working. The claim is corrected
      wherever it was stated, and the progressive blur it was blocking has since been
      retired for unrelated reasons -- see the 2026-09-20 CHANGELOG entry.

## E · Getting it into more hands

- [ ] **WORDMAKE joins.** Found 2026-09-19: it already builds on the primitives — six
      token sheets, `AxisSlider`, `Icon`, `Collapse`, `EditableTextBlock` — through a
      `shared` that is a *symlink* to the laptop's wm-primitives checkout, and it imports
      `StopSlider` and `StyleScopeDropdown`, which live on the `flattersatz-headless`
      branch (2 ahead, 25 behind main), not on main. Three steps, in order: merge that
      branch (or lift the two files); symlink → submodule; a `wordmake` leg in
      `consumers.yml`. Then the spec-fidelity book (tests/spec-fidelity/RUNBOOK.md)
      against the port. Step one is a decision, not a chore: the branch is somebody's
      work in progress.
- [ ] **Kernpare and geist-serif-morf as "usable by others".** Product work, not system
      work. Done, proposed 2026-09-19 — strike what is wrong:
      - *Kernpare:* a stranger with a `.glyphspackage` runs `pack.py` then `serve.py`
        from the README alone and sees their pairs; `data.json` is the only thing the
        page needs, no Glyphs install; the kern lists export in the `left;right;value`
        form the README promises, and one line of it round-trips through Glyphs; the
        Adobe attribution is on the page, not only in NOTICE.
      - *geist-serif-morf:* it is three HTML files and a `.glyphs` in a folder with no
        README and no repo. Done is: a README that says what it is (a morph between two
        dated cuts of Geist Serif), the font it embeds and its licence, and one command
        or URL that opens it. Whether its playhead becomes the house dial is a
        question for after that.
- [x] **Windows.** A `windows` job in `consumers.yml`: the same hosts, Chromium, the
      render suite only, its own baselines in `tests/__screenshots__/win32/`. A report,
      never a gate (EVAL Q2's order was iPhone first). 2026-09-19.
- [x] **The Kernpare token lint.** The linter reads `<style>` blocks out of an `.html`
      root, and a `token-lint: off -- reason` … `token-lint: on` fence marks the analysis
      UI as the named exception it is. The chrome outside the fences moved onto the
      scales (fifty-four literals); Kernpare is a `check` leg in `consumers.yml`, lint
      only. 2026-09-19.
- [x] **A public system page that is the README rendered**, not a gallery beside it.
      The README is section 01 of the Pages site now, rendered by `docs/system/build.py`
      from the same file GitHub shows; an edit to either rebuilds the page
      (`docs-fonts.yml`). The gallery follows it. 2026-09-19.

## F · Process, so the next month is cheaper than the last

- [x] **A CHANGELOG entry per PR, asserted.** `lint.yml` `changelog`: a PR that touches
      `src/`, `index.ts` or `dist/` without a CHANGELOG change is red. 2026-09-19.
- [x] **Baselines re-cut from CI only.** `test:render:update` runs
      `scripts/update-snapshots.mjs`, which refuses outside CI and prints the artifact
      route; `WM_FORCE_BASELINES=1` overrides, on the record. 2026-09-19.
- [x] **A release tag when a consumer-visible contract changes.** Policy in README §5;
      `v0.1.0` cut on main 2026-09-19 as the contract's first fixed point. Consumers still
      deploy from `main` by choice; pinning a tag is one line in their deploy.
- [ ] **Retire `git` on this machine for the private repos**, or fix it. Measured
      2026-09-19, with a real timer: `ls-remote`, `status` and `fetch` on the public and the
      private repos all complete in 0.5–1.6s, with the keychain helper and without it. The
      hang is intermittent, not a configuration; the documented cases are `checkout` and
      `pull --rebase` (stalling in `merge-base`), each with GitHub Desktop open, and on
      the 17th with a second Claude session using the same checkout. Two things to change anyway: `~/.gitconfig` says `filter.lfs.required =
      true` and `git-lfs` is not installed, which fails any repo that ever adds an LFS
      attribute; and `gh auth git-credential` can stand in for the keychain helper, which
      cannot prompt from a sandbox. The guarded-call habit and the API route stay until a
      hang is caught with `GIT_TRACE=1` attached.

## H · The transport (one bar for WORDMAKE and Morf)

Opened 2026-09-23. Six bar schemas in two registers on `docs/system/pages/transport.html`,
preceded by the play-button question on `play.html`; both stay out of SECTIONS for the
reason G gives. Decided already: one primitive with a readouts slot; no stage click; Morf's
stops evenly by beat. The schema is **left blank**: ______. [TRANSPORT.md](TRANSPORT.md) holds
the coverage, what none has had, and the order — schema, slot contract, subset, WORDMAKE
first.

## G · The enclosure language (one grammar for everything boxed)

Opened 2026-09-20 from the six-family proposal on `docs/system/pages/buttons.html`
(the "Button designs" session). It stays out of `build.py`'s SECTIONS permanently, Mark's
decision 2026-09-20: Pages serves it in place, so an edit is live in under a minute, and a
page whose purpose is to be argued with must not need a rebuild of a 900KB artifact to be
seen. The WIP chapter links it; it is never assembled. One family wins and becomes
`src/button.css`. Until then this section is
what the win changes; the family is **left blank**: ______.

What a language is, as against the button we have: every boxed thing — button, field,
chip, tag, pill, the toggle group, the select, the dial's value field — is one shape
grammar with named sizes and states, so a builder predicts the next box before reading
its CSS, and the lint tells them when they have stepped off it (the test in the closing
paragraph below).

- [ ] **C · Buttons reopens as the language.** `.wm-btn` + `.active` + `--solid` +
      `--quiet` becomes the family's own vocabulary; C3 (labels, tags, chips) folds into
      it rather than being its own pass; CHROME.md's retirement lists are done once, in
      the language, not per app. The mark-margin rule (2026-09-20, "the gap is for a
      mark, not for text") moves into it.
- [ ] **The corner law's "The button" chapter gets written** from the winning family:
      the G2 corner, the space inside it at each size, the cap rule that keeps a small
      radius from pinching. That chapter is the visual spec the family is judged against.
- [ ] **B · Lint.** Enclosure pairs — radius with padding, size with type role — come
      from the language's table or fail. Today the pad scale is linted and the cap rule is
      "by eye".
- [ ] **GESTURES gets a button table.** The button has no G-rows. The candidate names
      five states — rest, hover, held, focus, chosen — and each is a promise to test.
- [ ] **F · v0.2.0.** `.wm-btn` is in the v0.1.0 contract; reshaping or renaming it is
      consumer-visible, so the language ships as a minor bump with the four apps migrated
      in the same window.
- [ ] **E · Kernpare again.** Its 28 buttons were put on the old button; they take the
      language, with the two retired ones in font-proofer and ReCal.

**What the Keyline candidate would change, on top of that** (read from its page, not
decided): *a closed keyline means press; a bottom-only keyline means change.*

- **Fields join the language for free.** The dial's value field already is the
  bottom-only keyline — `.slider-number`'s underline that completes on focus — so the
  candidate is honest with the dial as it stands, and the editable line in ReCal and
  WORDMAKE is the same device. One rule covers three files today.
- **It forbids a decorative rule.** The law holds only if no line under a heading is ever
  decoration. The system page draws one under every section head (`.wm-sec-head`'s
  border-top) and ReCal's panels draw several. Either those go, or they are demonstrably
  not keylines (full-bleed, a different ink), or the family is dishonest on its own page.
  That is a lint: a 1px line that is not an enclosure's edge fails.
- **Tags and chips cannot be boxed.** A tag is not pressable, so under this law it may
  not wear a closed keyline — it needs ground only, or caps, or nothing. C3 stops being
  "normalise the tags" and becomes "unbox them". Untouched so far; this is the first
  consequence to look at, because `.slider-tag`, `.tag` and the chips are the most
  numerous boxes in the census.
- **"chosen" replaces `.active`.** A rename, and the toggle group's `.ui-seg` selected
  state is the same word. Part of the v0.2.0 bump above.
- **Five states, one ink ladder.** rest → hover → held is the existing ink ladder; focus
  is the accent ring; chosen is a ground change. Nothing new to invent, which is the
  candidate's argument for itself ("the cheapest thing here").

---

What makes a system world-class is not the count of components. It is that a builder can
predict what the next one will do before reading it, and that the system tells them,
loudly, when they have stepped off it. A, B and F are that. C, D and E are more surface.
