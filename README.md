# wm-primitives

**The promise: every control works and renders the same, from one source.** A dial in
font-proofer, in ReCal, in opsz-proofer and in Kernpare is the same file, and a change
to it reaches all four only after every one of them has been built, driven with a
finger, and screenshotted against a baseline. If something here is inconsistent, that
is a bug with a test missing, not a style choice.

This page is in the order you meet things. Everything it links to is the source; if
this page and a linked file disagree, the file is right.

## 1 · What you get

[COMPONENTS.md](COMPONENTS.md) — every export, one line each, which apps draw it, and
where its spec lives. Generated from `index.ts`, never hand-kept.

The ones people come for:

- **`AxisSlider`** — the dial. One number on one axis; rail, field, stepper; four
  variants. Spec [DIAL.md](DIAL.md), promises [GESTURES.md](GESTURES.md).
- **`ThemeSwitch`** — Auto / Light / Dark, one engine, two looks.
- **`Icon`** and **`Chevron`** — the one mark, the one chevron.
- **`dist/dial.js`** — the dial for a page with no React, same source, as a script tag.
- Tokens, in four sheets that style nothing until you use them: `color.css`,
  `type.css` ([TYPOGRAPHY.md](TYPOGRAPHY.md)), `space.css`, `motion.css`.

## 2 · What you must supply

[HOST-CONTRACT.md](HOST-CONTRACT.md) — the tokens the consuming app defines, what each
is, and what breaks without it. Two have no safe fallback: without `--border` the rail
is invisible; without a theme stamped as `data-theme` a dark page is black on black.
Both were found by wiring a bare app and are the first two steps of the HOWTO.

## 3 · How to wire it in, and add a dial

[HOWTO.md](HOWTO.md). Part A: a submodule at `shared/`, the peer deps, the three token
sheets, the contract, `data-theme`, one dial rendered — ten steps, each one a trap that
was hit once. Part B: a new dial design is a *variant*, and how the receiving app takes
it.

## 4 · How to override

Every rule this package writes is inside `@layer wm.*`. **An unlayered rule in your app
beats any of them, at any specificity, first try.** Theme through tokens
(`--accent: var(--signal)`), choose behaviour through props, and reach in with a
selector only as a last resort — where the layer guarantees you win. The header of
`src/AxisSlider.css` is the long form.

## 5 · How you know it shipped

Push to `main`. [`consumers.yml`](.github/workflows/consumers.yml) checks out every
consumer, puts your commit in its `shared/`, runs its lint and build, drives the
gestures in Chromium and WebKit, screenshots every row, and only then tells the apps
to deploy. Each app's deploy then waits until wordmark.nyc serves the bundle it built.
Green means *live*, not pushed. [EVAL.md](EVAL.md) is the methodology;
[tests/README.md](tests/README.md) the suites.

**Tags.** A change to what a consumer can see — a prop, a token name in
[HOST-CONTRACT.md](HOST-CONTRACT.md), `wmDial`'s API, a CSS class a host is told to use —
gets a tag: `v0.<minor>.<patch>`, minor for a contract change, patch for anything else
that ships, and the CHANGELOG entry names it. The deploys build against `main` today
(`git submodule update --remote`), which is why "what is live" needed its own check; a
consumer that wants to stand still pins the tag instead. `v0.1.0` is the contract as of
2026-09-19.

## The rest

- [CHANGELOG.md](CHANGELOG.md) — what changed and what it cost. Most entries are a fix
  for a fix; the wrong version is the useful part.
- [SLIDERS.md](SLIDERS.md) — the census. Fifty-nine sliders, none a copy.
- [BUTTONS.md](BUTTONS.md) — six button families to decide from, what each demonstrates and
  cannot do, and what none of them has had yet. None chosen.
- [NEXT.md](NEXT.md) — the checklist from here to a system a stranger is fluent in.
- [The system, illustrated](https://markfonts.github.io/wm-primitives/) — type, corners,
  circles, space, colour as live CSS. A showing, not a consumer.

Consumed as a git submodule, not an npm package; each app's Vite/tsc compiles the TSX
directly. Typed TSX; token-based CSS with fallbacks; font identity only — props carry
family and axes, never proofing size.
