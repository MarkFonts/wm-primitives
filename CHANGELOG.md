# What changed, and why

A log of decisions, not of diffs — `git log` already has the diffs. Each entry says what
moved and what it cost, because most of these were reached by getting them wrong first and
the wrong version is the useful part.

Companion to [DIAL.md](DIAL.md) (the dial's layout), [GESTURES.md](GESTURES.md) (what it does
under a pointer), [SLIDERS.md](SLIDERS.md) (the census), [EVAL.md](EVAL.md) (how it is tested) and
[HOWTO.md](HOWTO.md) (how to wire it in, and add a dial).
Newest first.

---

## 2026-09-19 — process (NEXT.md F) · v0.1.0

**A PR that changes what ships carries a CHANGELOG entry, or it is red.** `lint.yml`
`changelog`, on `pull_request`: `src/`, `index.ts` or `dist/` changed without this file
changing fails. Docs and tests are exempt — this is a log of decisions.

**`test:render:update` refuses outside CI.** The baselines are linux's; a Mac that re-cut
them would make the next CI run red on every row. `WM_FORCE_BASELINES=1` for the day the
runner is wrong, and the commit says so.

**Tags.** `v0.1.0` is the contract as it stands: the props in `AxisSliderProps`, the
tokens in HOST-CONTRACT.md, `wmDial.mount / get / set / update / destroy / mountTheme`,
`.wm-btn` and `.wm-select`. A change to any of those bumps the minor and gets a tag; the
policy is in README §5. `package.json` says 0.1.0 to match.

---

## 2026-09-19 — into more hands (NEXT.md E)

**Kernpare is held to the system.** The linter could not read it: one `index.html`, its
CSS in two `<style>` blocks, and a linter that walked `.css` files. It reads style blocks
out of an `.html` root now, line numbers intact, and a region can be fenced
`token-lint: off -- reason` … `token-lint: on` for a design that is deliberately its own
— the kern-group analysis UI is Severance on purpose and stays so. Everything outside the
fences was fifty-four literals off the scales; they are steps and roles now. A `kernpare`
leg in `consumers.yml` runs the lint on every push.

**The system page is the README.** The Pages site opened with a poster and six galleries
and said nothing about what the package promises or what a host owes it; the README said
all of that and was rendered only by GitHub. `build.py` renders it as section 01 with a
converter the size of the README's own markdown, and a README edit rebuilds the page.

**Windows renders.** A `windows` job, Chromium on `windows-latest`, the render suite
against its own baselines under `tests/__screenshots__/win32/`. A report, like the linux
rendering step; the first run cut the baselines.

**WORDMAKE was closer than the docs said, and further.** EVAL had it as "no submodule, no
import". It imports six sheets and five components — through a symlink to the laptop's
checkout, and two of the components (`StopSlider`, `StyleScopeDropdown`) exist only on
the `flattersatz-headless` branch. So "StopSlider never had a file" (yesterday's entry)
was true of main and not of the repo. NEXT.md E has the three steps.

---

## 2026-09-19 — the open decisions, closed (NEXT.md D)

**Typing commits on Enter or blur, in every field.** The dial had moved there on the 17th;
the triplet still committed per keystroke, so typing `24` on a min-8 band became 8, then
84, with the neighbours carried along on each step. One rule now, GESTURES §0 *Typing*.
G45 and its test changed to match.

**The dial's type size was never inherited — its box was.** The text is 12px in every
host and always was. What the parity report read as 16px was the label *container*,
which set no size or leading of its own, so a row was 18px in the two React hosts and
18.8px in opsz-proofer's 12px/1.4 panel. `.slider-label` sets both now, and the type
tokens carry fallbacks (`0.75rem`, `1.4`, `0.5625rem` for the tag) so a host that never
loads `type.css` gets the same box. Five allowlist lines existed for this.

**The parity gate had been crashing since it was written.** `__dirname` in an ES module;
rendering is continue-on-error, so the crash read as a report with nothing in it. Two
runs on main went by like that. `import.meta.url` now, and the run after this one is the
first the gate has actually judged.

**Three render baselines outlived the thing they pictured.** Kernpare's `.ui-seg` (the pill
it retired for the house button), its `theme-words` (it took the marks look), and
opsz-proofer's two rows (the `input[type="text"]` scoping). All from the 17th; all
reported, none blocking, none read. Re-cut from CI, and the Kernpare test now pictures
the house button.

**Mouse drag-from-anywhere is native, and proven.** The native range jumps on press and
keeps dragging from there. G18 says so and a test holds it; the promise is per pointer.

**`--dial-track-h` is the host's.** 24px default, 14 floor, DIAL §7. ReCal's 14 is not
drift.

**`Collapse` was shipping all along.** Nothing imports it by name except `Fitting`, which
wraps its two H&J sections in it — so the census read "unshipped". GESTURES §11 now has
its rows. `StopSlider` was a name in four documents and no file.

**ReCal's measure is in body ems now.** `.para-doc` sets the `p` style's size, so `34em`
is thirty-four of them rather than of the page's 16px. (ReCal, not here.)

---

## 2026-09-17 — the dial for pages without React

**`dist/dial.js`: one source, a second output.** `a0e1645`
Kernpare and opsz-proofer are not React apps, and the census records what happened when
one of them hand-wrote the dial's markup: the class names with none of the behaviour,
free to drift the first time `AxisSlider.tsx` changed shape. A plain-JS port would be
the same drift with more code. So `AxisSlider.tsx` itself, React inside, is bundled by
esbuild into a script tag (`wmDial.mount(el, props)` → `get / set / update / destroy`),
~70 KB gzipped. The bundle is committed because those pages run no npm; a `dial` job
fails the push that changes the source without rebuilding it, and dispatch waits on it.

**And the two pages took it.** wordmarktools `5f4c808`
opsz-proofer's three hand-emitted rows — the census's 57–59 — are `wmDial.mount` now;
`build.py` inlines the bundle's CSS in place of `AxisSlider.css` and ships `dial.js`
beside the page. Scroll-to-adjust went with the markup: the dial refuses a vertical
wheel on purpose. Kernpare's *Italic angle* and *Glyph size* are dials where two number
inputs were. Fifty-nine sliders in the census; none is a copy any more.

**This log was silent for a night, and that was a bug.** Five entries were inserted by
anchoring each on the heading of the one before, and the first anchor only ever existed
on a side branch. Every insert was a no-op that raised nothing. They are all below now,
under an assertion.

---

## 2026-09-17 — the other controls get their rows

**GESTURES §9 (the triplet) and §10 (the mark), with tests.** PR #17
Thirteen promises: the triplet's stepper, arrows, typing, the carry rule (an edit that
would cross a neighbour moves the neighbour, never clamps the edit), `offset`,
`disabled`; the mark's ladder on both grounds, hover never landing on an active mark,
the swatch only in the dark, `opsz` clamped to the axis, `label` → `aria`.

**A held stepper on the triplet moved one step and stood still.** PR #17
The repeat timer fired on schedule and committed from the band captured at press time
— base+step, base+step, base+step. `AxisSlider` had guarded its own stepper against
exactly this with a ref; the triplet had not. Found by G43 on its first run.

**Open, written down rather than decided:** the triplet still commits a parseable
number on every keystroke (G45); the dial stopped doing that today (G19). Two fields,
one keystroke, two behaviours.

---

## 2026-09-17 — the theme switch is one control

**`ThemeSwitch`, both looks, one engine.** `b5ae658`
Auto / Light / Dark existed twice and was missing once: font-proofer drew three Material
marks, Kernpare three words in a pill, ReCal none (light-only tokens, by decision). Each
had its own storage key and its own idea of what `auto` stamps on `<html>`. `theme.js`
is the engine, plain JS so a page without React drives the same buttons with
`mountThemeSwitch()`; the React form has both looks. One key, `wm-theme`; the attribute
always present; a `wm-theme` event on `<html>` so a canvas painted with token colours
can repaint. Placement stays in the app.

**Chevrons: never a text glyph.** `6dbcb99`, ReCal `6b5f5df`, Kernpare `cb49925`
ReCal's style menus carried `▾` set in Cal Sans — a 9px triangle matching nothing.
Kernpare's preset select wore Chrome's arrow. Both are the house chevron now.

**The parity report earned its keep on day one.** The `track` variant agrees on every
number in every host; the `default` variant is two controls (ReCal 14px rail via the
offered `--dial-track-h`, font-proofer 24px + `padding: 0 16px` unlayered); ReCal's rows
show `cursor: pointer` where the primitive says `ew-resize`. Written down, not changed.

---

## 2026-09-17 — the battery, and the first bug it found

**EVAL.md, GESTURES.md, tests/.** `67aee88` `7da3285` `da86e1a`
A methodology (five audiences, eight decisions), a behaviour spec (36 promises, each
traced to the commit where the opposite was a bug), and the suites: every consumer built
against the commit before any is told to deploy; every dial row in every host held to a
linux baseline with cross-host parity as numbers; the gesture promises run as Playwright
in a real Chromium touch and a synthesised WebKit one; the deploys wait until the site
serves what they built; a docs-only run across three models that put eight missing
sentences into the docs.

**A touch keeps its own capture.** `6325c50`
Found by the behaviour suite on its second run, under a *real* touch — the synthesised
one had passed. Asking `setPointerCapture` for a touch pointer, which the browser has
already captured, made Chromium fire `lostpointercapture` for the hand-over, and
`onLostPointerCapture` is `onTouchUp`. The drag ended on its first live frame,
`data-scrubbing` came off, and the native range carried the rest as ~28 uncoalesced
`input` events. Every promise of the mobile pass held for exactly one frame.

**The field composes; Enter or blur commits.** `7970694`
From the phone: typing toward 1660 had the proof jump to 16, then 166, and a host that
clamps wrote its answer back into the field mid-word. Draft only now; a tap selects the
digits; only an arrow abandons the draft.

---

## 2026-09-13 — the dial answers a finger

The mobile pass. Every item here was reported from a phone, and several of the fixes
replaced an earlier fix of mine that had made things worse.

**Drag from anywhere on the rail.** `d14ae6a`
The direction of a gesture was decided on the *first* move sample past 3px, and a sample
that looked vertical killed the gesture outright with no way back. A finger rolling
slightly on the way down — which is most of them, on a 32px bar — lost the drag before it
began, leaving only what the native input does: jump on tap, drag from the thumb. Now it
waits for 6px of real movement and concedes only when the gesture is *clearly* vertical
(1.5×); anything ambiguous stays a drag.

**touch-action: the two wrong answers before the right one.** `ffa2e95` after `ab84960`
`pan-y` left a horizontal drag to be won or lost against the scroller, and the scroller
won nearly every time — the rails read as dead. `none` won the drag by taking the page's
vertical scroll away from every row, so a phone got *neither* gesture. Neither can be
right, because `touch-action` states one answer before anyone has moved a finger. The
direction is judged per gesture in JS instead, with `pan-y` held so the browser can always
scroll.

**A resting shelf.** `0a0429c`
Every track row was 48px of live target sitting 6px from the next: nowhere on the rail to
put a thumb that was not a control. Big rows, unusable for exactly that reason — so the
fix was subtraction. The row stays 48px always and only the *bar* inside it changes, so
nothing reflows. At rest the bar is 32px, leaving ~8–11px of inert band (shelf plus seam)
between bars. Touching one fills the row for three seconds.

The input is inset *less* than the bar and asymmetrically — 3px above, 5px below. A finger
hides what it is over, so people aim with its visible top edge and miss high.

**The stepper was what blocked the shelf.** `0a0429c`
A bar cannot be shorter than its tallest content, and the stepper pair stood 46px, propping
every bar open to the full row. It also threw the two marks to the row's extremes, which is
why they read as too high and too low. 16px boxes let the bar rest at 32 and bring the marks
within 6px; the touch area returns as padding and leaves layout via an equal negative
margin, capped at 3px because stacked buttons any larger would overlap and make up-vs-down
ambiguous at the seam.

**The value field and the arrows stopped eating drags.** `0a0429c`, `d14ae6a`
Both sit over the rail's right end, so between them most of that side was undraggable —
exactly where a high value parks its own thumb. Each now takes a tap and passes a drag: the
field focuses for typing on a tap and drives the value on a horizontal drag; the stepper
fires its step immediately on press (hold-to-repeat needs that) and cancels the repeat if
the press becomes a drag.

**The lag was never easing.** `d14ae6a`
Type appeared to ease behind the finger. There was no transition on the preview anywhere.
It was *frequency*: `pointermove` fires ~120Hz and each event was a setState, a re-render
and a re-raster of a 400px variable word, so the work queued and caught up after the
gesture stopped. Drag updates are coalesced to one per frame, always the latest — positions
the eye never saw are dropped rather than rendered late.

Coalescing needs a **synchronous flush on release**, because rAF is not guaranteed to run:
a hidden tab or a backgrounded phone starves it, and the last value of a drag would sit in
the queue forever. The frames in between are an optimisation; the value you let go on is
not.

**`data-scrubbing` on the root.** `d14ae6a`
Set for exactly the duration of a live drag, so a host can ease a *committed* value and
refuse to ease a *dragged* one. An attribute rather than a prop: otherwise every consumer
threads the same flag through every slider, and the fact is global anyway — either the user
is dragging a control or they are not. Ignoring it costs nothing.

**Typing could not clear the field.** `ffa2e95`
The field is controlled and clamped on every keystroke, so clearing it parsed as NaN, the
handler returned without propagating, and React rendered the old value straight back.
Worse, selecting 88 on a min-8 dial and typing "2" committed 8 that instant, then "4" made
84 — the small number you were reaching for was unreachable. The field now keeps a draft
while focused and the clamp moves to blur. Nothing out of range ever reaches `onChange`;
the intermediate states of typing are simply allowed to exist.

**Stock is a mark on the bar's foot.** `4cf89bf`
The reference marker was a 28px rhombus at 45°, written to *mirror* the diamond thumb. With
the thumb gone from the track variant it was mirroring nothing and lay across the row at an
angle. Its position is clamped, because at stock = axis floor it hung off the bar's rounded
corner, where any shape reads as damage — as a triangle it read as a speech-bubble tail.

---

## 2026-09-09 — light, and what carries it

**The ink ladder ends where each ground needs it.** `5a7f38e`
Active's GRAD was read off the axis rather than off the ladder: −50 is the floor of the
shipped `fvar`, so the mark went visibly thin the moment the pointer left. Each theme now
states its own end value, one rung below its own hover — dark `50 · 100 · 75`, light
`100 · 150 · 100`.

**Light takes no HDR at all, and that is physics.** `5a7f38e`
The boost exists only for pixels brighter than SDR white; a mark on a light ground has to go
*darker* to read as chosen. Ungated, the swatch painted the chosen mark white on a light
page — the faintest thing in the row rather than the fullest.

**Hover stopped landing on active marks.** `5a7f38e`
The guard covered the `--active` modifier but not a mark made active by a host ancestor
carrying `.active`. Since `background-clip: text` only reveals the image where the text is
transparent, repainting at ink-quiet covered the swatch entirely: the HDR did not dim under
the pointer, it was *replaced*.

**A press is light on the chevron, not a disc behind it.** `bf491f7`
Both steppers acknowledged a press with a shape, putting a second object in a 9px box that
already held a chevron. The mark answers instead. Momentary is two durations rather than an
animation: opacity snaps on at `:active` and eases back out on release, so the flash cannot
lag the press or be re-triggered mid-decay by the hold-repeat timer.

**Material Symbols, subset to the 24 marks we draw.** `e3b6676`
3.79 MB → 15.6 KB; the shipped face carried 6,607 glyphs to draw 24. **The trap:**
subsetting with `--text` of the letters saves 5.8%, because every icon name is spelled in
`[a-z0-9_]` and keeping those letters makes every ligature *reachable*, so layout closure
retains all 6,583. `--no-layout-closure` is what makes it 53 glyphs. Also: `pyftsubset`
drops glyph names to `post` format 3, so verifying by glyph name reports a false failure —
verify by rendering.

**The swatch baker learned colour, gamut and a falloff.** `15ed551`
A white swatch masked onto a coloured control flattens it to white, so each hue needs its
own bake. **The gamut error worth remembering:** the container is BT.2020 (`nclx 9`), so
linear sRGB components handed to it are reinterpreted as BT.2020 coordinates and every
channel that is not the peak lands too low. Measured on the zone green: written
`[0.203, 1, 0.333]` where the true value is `[0.502, 1, 0.415]`. It looked vivid, which is
why it passed the eye — but the HDR swatch was a *different colour* from the flat fallback
beneath it, so a control shifted hue as the boost engaged.

**The hero's gloss: one mask, one map, one origin.** `b380a35`, `2931c60`, `c334fbe`
Four separate defects at one join. The mask was 1px, because a `<use>` does not inherit the
CSS that styles its referent. The pattern was sized off the SVG's own viewBox, so the bend
sampled the field ~3× zoomed against the bar. The conversion had to come from
`getScreenCTM()`, not `boundingRect/viewBox` — that quotient is only right when box and
viewBox share an aspect ratio. And on a cold load the header measured 0 wide, so the pattern
shipped at `width="0"`: a gloss exactly zero pixels across, invisible locally because
localhost settles layout before the script runs.

`non-scaling-stroke` went with it: it is *defined* to ignore the CTM, so the SVG strokes
held 8px while the CSS bar grew with page zoom. At 100% they agreed, which is why every
screenshot looked clean.

---

## 2026-09-08 — one chevron, one stroke

**One chevron, at one angle, with a stroke that follows its size.** `42bc938`, `bbd89d2`
Round caps after flat ones were tried and rejected. `strokeFor(w)` derives weight from
width, so 12-wide gets 1.26 and 10-wide gets 1.15 — a difference, not a drift.

**Self-hosted Material Symbols, and the marks recorded on the system page.** `8b30eec`
A subsetted `icon_names` link under the *same* font-family silently wins over a fuller face
and prints ligature names as text.

**Coarse pointers: reset the transform the position change left behind.** `da26495`
`position: static` without `transform: none` left a 44px stepper pulled up 22px, overhanging
its neighbours and swallowing the touches meant for the track. A position change without the
matching transform reset is the trap.

---

## Rules this log keeps re-proving

- **A measurement beats a reading.** Half the entries above are a fix for a fix, and the
  wrong one always looked right in the environment it was written in.
- **localhost hides cold-load bugs.** Layout settles before the script runs, so anything
  derived from a measured box needs a guard *and* something watching for the real value.
- **Specificity fights come in threes.** `AxisSlider.css`'s header documents two; the value
  field's touch target made three. At equal specificity, source order decides.
- **An effect that is invisible in a screenshot can only be judged on the device.** HDR is
  the sharpest case; touch is the next.
- **A synthesised event tests the component; only a real one tests the browser.** The
  capture bug passed every synthetic run and failed the first real touch.
