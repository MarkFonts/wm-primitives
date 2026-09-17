# How to wire the primitives in, and how to add a dial

For you in six months, or for someone with access to these repos. Written by doing it on
2026-09-17: a bare Vite + React app with nothing else, the primitives cloned in, one dial
rendered (EVAL.md §6). Every trap below was hit in that run, in this order.

---

## Part A · Wiring wm-primitives into an app

### 1 · Get the code

It is a **git submodule**, not an npm package. Each app compiles the TSX source itself.

```bash
git submodule add https://github.com/MarkFonts/wm-primitives.git shared
```

Both existing apps mount it at `shared/`. Keep that name — the deploy workflows, the
lint config and this document all assume it.

### 2 · Install what it leans on

```bash
npm install react react-dom motion @use-gesture/react
```

`motion` and `@use-gesture/react` are needed **even if you render one slider**: the
barrel (`shared/index.ts`) exports everything, and `UiKitBoard.jsx` imports them. The
error you get otherwise names `motion/react` and `UiKitBoard.jsx`, not the real cause.

### 3 · Tell TypeScript it is a Vite app

In `tsconfig.json`:

```json
"compilerOptions": { "types": ["vite/client"], "allowJs": true }
```

`import.meta.glob` is used in `glyphNames.ts` and `specimen.ts`; without `vite/client`
you get five type errors in files you did not write. `allowJs` is for `UiKitBoard.jsx`
and the plain-JS engines (`letterbox.js`, `flattersatz.js`).

### 4 · Import the three token sheets — this is the step nothing warns you about

In your entry stylesheet or `main.tsx`, **before** anything else:

```ts
import '../shared/src/color.css'   // the seven-number colour ramp, light and dark
import '../shared/src/type.css'    // roles, inks, signals
import '../shared/src/motion.css'  // --dur-*
```

Skip this and the dial **renders without a rail**. The label, tag and value appear; the
track does not, because `--border` resolves to nothing and the gradient it sits in is
invalid. No error, no warning, a control that looks finished and is not.

### 5 · Supply the host contract

```css
:root { --ui-font: "Your UI face", system-ui; --text-rgb: 232, 232, 232; }
```

`--text-rgb` is **comma-separated** — it is used as `rgba(var(--text-rgb), α)`, and the
slash form silently fails. The full list of what an app is expected to define is
`hostTokens` in `.tokenlint.json`; `color.css` and `type.css` give defaults for the ones
that matter most, so these two are the minimum.

### 6 · Theme is `data-theme`, not `color-scheme`

```html
<html data-theme="dark">
```

**Do not** set `color-scheme: dark` on its own. It turns the canvas dark; it does not
switch the colour ramp, which is keyed on `[data-theme]` and `prefers-color-scheme`. The
result is dark ink on a dark ground with no error — the exact failure the lint config's
comment predicts. Set `data-theme`, and the ramp follows (it sets `color-scheme` for you).

### 7 · Render one

```tsx
import { AxisSlider } from '../shared/index'
<AxisSlider label="Weight" tag="wght" value={wght} min={100} max={900} step={1} onChange={setWght} />
```

### 8 · Override the right way

The primitives' CSS is all inside `@layer wm.*`. **An unlayered rule beats any layered one
at any specificity**, so your app's plain stylesheet always wins:

```css
.slider-label-name { color: var(--accent); }   /* wins, first try */
```

Writing your override inside `@layer wm.controls` also works *if* you out-specify or come
later in source — which is the fight the layer exists to end. Stay unlayered.

### 9 · Lint

Copy `.tokenlint.json` from font-proofer to your repo root, then:

```bash
node shared/scripts/lint-tokens.mjs
```

Without the config it exits 2 and says so. Wire it into `deploy.yml` before the build,
as the other apps do.

### 10 · Deploy — and know what is live

If the app deploys to wordmark.nyc, copy the last step of font-proofer's `deploy.yml`,
*The site serves what this run built*. It waits until the site serves the bundle the run
built. Without it, green means pushed, not shipped.

And know the trap: your local `shared/` is a **pin** — the commit your app last recorded,
not the primitives' `main`. `npm run build` on your laptop builds the pin; CI builds
latest `main`. To test a primitive change locally:

```bash
git -C shared fetch ../wm-primitives <branch> && git -C shared checkout FETCH_HEAD
```

---

## Part B · Adding a new dial design

A dial design is a **variant** of `AxisSlider`, not a new component. `default`, `track`,
`diamond` and `skeletal` ship today ([DIAL.md §7](DIAL.md)).

### In wm-primitives

1. **Read [DIAL.md](DIAL.md) first.** R1–R4 are the rules every variant broke once. §8 is
   the checklist a change is judged against.
2. **Add the variant name** to the `variant` union in `src/AxisSlider.tsx` — the JSDoc on
   the prop is where the one-line description goes.
3. **Style it in `src/AxisSlider.css`**, inside `@layer wm.controls`, as a
   `.slider-row--<name>` block. Theme through tokens (`--border`, `--accent`,
   `--surface`), never literals — the lint will fail the push otherwise. If the row *is*
   the track, look at how `track` stretches the range input over the bar at zero opacity:
   the native input keeps the keyboard and the mouse; only touch is ours.
4. **If it has its own gestures**, write the promise as a row in
   [GESTURES.md](GESTURES.md) *before* the code, with the commit that will prove it.
5. **Add it to `tests/`:** a row in `tests/render/` gets a baseline the first time CI sees
   it (cut on linux — do not commit a Mac one); a gesture gets a case in
   `tests/behaviour/rail.spec.ts` citing its G-id.
6. **Show it on the system page** (`docs/system/pages/controls.html`) and count it in
   [SLIDERS.md](SLIDERS.md).
7. **Push.** `consumers.yml` builds font-proofer, ReCal and opsz-proofer with your commit,
   runs the gestures, screenshots the rows, and only then tells the apps to deploy. A red
   gesture blocks all three. A rendering diff does not — it attaches the images for you.

### Receiving it in font-proofer

font-proofer imports the dial once, at the top of `src/App.jsx`:

```js
import { AxisSlider as SliderRow } from '../shared/index'
```

Every rail row is a `<SliderRow variant="track" … />` from about line 1965. A new variant
is one attribute on one row. If the host needs to *dress* it, that goes in
`src/index.css` or `src/App.css`, unlayered — and the comment beside the rule should say
which primitive rule it is overriding and why, because six months from now it will look
like a mistake.

Then: push font-proofer. Its `deploy.yml` builds against latest primitives `main`,
records the pin it built, pushes into wordmark, and waits for the site to serve it. Hold
the phone against `wordmark.nyc/font-proofer/`. **That last step has no automation** —
HDR does not screenshot and Safari cannot be handed a real touch — so it is still the
only proof that a dial works.

---

## The silent-failure list

What the wiring run found doing nothing with no message, in the order met. Each is a
candidate for a dev-mode `console.warn` in the primitive (EVAL.md §6).

| # | what you did | what happened | what should have said so |
| --- | --- | --- | --- |
| 1 | rendered a dial without importing `color.css` | the rail was invisible; label, tag and value looked finished | `AxisSlider`: on mount, if `--border` computes to nothing on the row, warn once: *"no token ramp — import shared/src/color.css"* |
| 2 | set `color-scheme: dark` to get a dark theme | black on black | `color.css` cannot warn; `AxisSlider` can: if `color-scheme` computes dark and `[data-theme]` is absent, warn once: *"theme is data-theme, not color-scheme"* |
| 3 | left `--ui-font` unset | fell back to `system-ui` | by design; the fallback is the point. No warning |
| 4 | overrode inside `@layer wm.controls` at lower specificity | (not hit in the run — out-specified by accident) | documented in `AxisSlider.css`'s header; no runtime answer exists |

Two more were **not silent**, but their messages pointed at the wrong thing:

| | error said | should have said |
| --- | --- | --- |
| peer deps | `Rollup failed to resolve "motion/react" from UiKitBoard.jsx` | README step 2: install `motion` and `@use-gesture/react` even for one slider |
| types | five errors in `glyphNames.ts` / `specimen.ts` | README step 3: `"types": ["vite/client"]` |

Timings, for the record: scaffold with `npm create vite` hung for ten minutes and produced
nothing (not the primitives' fault; written by hand in one minute instead). From a working
Vite app to a **correct** dial: about 12 minutes and six wrong turns, every one of them
above. With this page: two.
