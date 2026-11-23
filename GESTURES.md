# Gestures — what a control promises to a pointer

The behaviour spec. [DIAL.md](DIAL.md) says where things sit; this says what they *do*
when touched, pressed, typed at or scrolled. One row per promise, each traced to the
commit where the opposite behaviour was a reported bug — so a row here is not a wish, it
is something that has already gone wrong once. The tests in `tests/behaviour/` cite these ids; `rail.spec.ts` covers G1–G5, G8, G9, G11–13.
**Ids are permanent.** A new promise takes the next number at the end of its section's
range — append; never renumber. (Spec-fidelity run 2026-09-17: one model inserted a row
and shifted ten ids, which would have broken every test citing them.)

Read against `src/AxisSlider.tsx`. If this and the code disagree, the code is a bug or
this is stale; either way the row says which commit to read.

---

## 0 · The numbers

Every threshold in one place, so a test and the code cannot drift on a constant.

| what | value | where |
| --- | --- | --- |
| movement before a gesture is judged | **6px** on either axis | `dx < 6 && dy < 6` |
| concede to the scroller when | **dy > 1.5 × dx** | same block, three times: rail, field, stepper |
| engaged bar holds after lift | **3000ms** | `release()` |
| stepper hold: first repeat after / then every | **400ms / 60ms** | `startStep()` |
| coarse-pointer row / resting bar / engaged bar | **48 / 30 / 48px** | `AxisSlider.css` `@media (pointer: coarse)` |
| input inset inside the resting bar | **3px top, 5px bottom** | same — finger aims with its visible top edge |
| reference marker clamp from either end | **5px** | `clamp(5px, %, calc(100% − 5px))` |
| shift-arrow coarse step | **×10** | field `onKeyDown` |
| drag updates delivered to the host | **≤ 1 per frame**, latest wins, duplicates dropped | `queueValue` / `lastSent` |
| the confirm: press look off, then on | **80ms / 80ms**, then settle | `--dur-confirm`, `src/motion.css` (§14) |

`touch-action` on the rail is **`pan-y`**, always. The direction of a gesture is decided
by the rules below, not by that property — it states one answer before anyone has moved.

**Typing.** A field shows the draft verbatim and **nothing reaches the host until Enter or
blur**; Escape abandons it. Every field: the dial's (G19–G23) and the triplet's (G45).
Decided 2026-09-19, after the triplet committed per keystroke and typing 24 on a min-8
band became 8, then 84 — the same chase the dial had lost on the 17th.

**Capture.** A touch is never asked for `setPointerCapture` — the browser has already
captured it to the element it went down on, and asking again makes Chromium fire
`lostpointercapture` for the hand-over, which the rail reads as a lift. Pen and mouse
still capture. And once a touch drag is live, `touchmove` is cancelled so the native
range stops following the finger on its own: one path to the host, not two.
(`6325c50`, found by `tests/behaviour` G9.)

---

## 1 · The rail

Mouse is left to the native `<input type=range>`: a press anywhere jumps the thumb to the
pointer, and holding on keeps dragging it from there — which is drag-from-anywhere, paid
for by the platform (G18). Every rule in this section is for **touch and pen**
(`pointerType !== 'mouse'`); the promise is per pointer, decided 2026-09-19.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G1 | finger down anywhere on the row, then ≥ 6px of movement that is not clearly vertical | value follows the finger for the rest of the gesture, from wherever it started — not only from the thumb | `d14ae6a` |
| G2 | finger down on the row, then movement that is clearly vertical (dy > 1.5 dx) | the page scrolls; the gesture is handed back and not reclaimed; and the value is **put back** to what it was at touch-down, because the native range had already jumped it to the finger on `pointerdown` | `ffa2e95`, `6325c50` |
| G3 | finger down, movement < 6px, lift | a tap, and a tap is the native input's: the value jumps to the tap point. The rail never claims it, so `data-scrubbing` is never set | `d14ae6a` |
| G4 | a gesture that wanders — first sample looks vertical, later samples horizontal | still becomes a drag; undecided is not the same as refused | `d14ae6a` |
| G5 | press at x = 0 / x = width − 1 of the track row | reaches `min` / `max`; nothing at the ends of the bar is dead | `0e55d1f` |
| G6 | the value is read from the pointer's x against the **rail**, wherever the press began (field, stepper, rail) | one mapping, `valueAt`, for all three | `0a0429c` |
| G7 | during a live drag, `pointermove` at 120Hz | host receives at most one `onChange` per animation frame, always the most recent position, never the same value twice in a row | `d14ae6a` |
| G8 | lift, with a value still queued and no frame having run (hidden tab, backgrounded page) | the queued value is delivered synchronously on lift; the gesture cannot end on a value the host never saw | `d14ae6a` |
| G9 | the whole of a live drag | `<html data-scrubbing>` is present from the moment the gesture is claimed until lift, and absent otherwise — including under a real touch, where it used to last one frame | `d14ae6a`, `6325c50` |
| G10 | `reference` at or near `min` / `max` | the marker sits ≥ 5px from either end, never on the rounded corner | `4cf89bf` |

---

## 2 · Engagement (coarse pointer only)

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G11 | any press on the row, field, or stepper | the bar grows to fill the row while the pointer is down, with **no timer running** — a touch that is still happening cannot time out | `d14ae6a` |
| G12 | lift | the bar stays full for 3000ms, then returns to 30px | `0a0429c` |
| G13 | at every moment of G11–G12 | the **row is 48px**; nothing above or below it moves. Only the bar and the input inset change | `0a0429c` |
| G14 | a second press inside the 3000ms | the timer is cleared, not restarted-on-top; the bar never blinks | `d14ae6a` |
| G15 | `prefers-reduced-motion: reduce` | the bar changes size without a transition | `0a0429c` |

---

## 3 · The value field

One text input, not a number input — it has to show U+2212.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G16 | tap (touch/pen, < 6px movement) | focuses for typing **with the digits selected**, so the next keystroke replaces them; the tap did not jump the value | `0a0429c`, field-typing |
| G17 | press and horizontal drag (touch/pen) | drives the value exactly as a rail drag would (G1, G6–G9); the field does **not** take focus | `0a0429c` |
| G18 | mouse | native: a press anywhere on the rail jumps the value there, and the drag that follows moves it; `data-scrubbing` is never set | `0a0429c`, G18 test |
| G19 | typing while focused | the field shows the draft verbatim, including empty, `-`, and out-of-range intermediates; **nothing reaches `onChange` until Enter or blur** — the proof does not chase the digits, and a host that clamps cannot rewrite the field mid-word | `ffa2e95`, field-typing |
| G20 | type `2`,`4` on a min-8 dial | nothing is emitted while typing; `24` is committed on Enter or blur | `ffa2e95` |
| G21 | blur with an empty or unparseable draft | reverts to the committed value; `onChange` not called | `ffa2e95` |
| G22 | blur with a parseable draft | clamped to `[min, max]`, then committed | `ffa2e95` |
| G23 | `Enter` | commits (blurs); `Escape` abandons the draft and blurs | `ffa2e95` |
| G24 | `ArrowUp` / `ArrowDown`, held | ±`step`, clamped; the OS key-repeat carries the hold. `Shift` makes it ±10·step. `Home`/`End` are **not** bound | `ffa2e95` |
| G25 | `a` with `allowAuto` | commits `'auto'`; without `allowAuto` the key types | props doc |
| G26 | first focus on a dial with `allowAuto`, not yet auto | a hint appears below the field once per mount and leaves after 3000ms | `handleFocus` |

**When a printable key may be a command here.** A key that can appear *inside* a value
(`0`–`9`, `-`, `.`) may be bound only while no draft is in progress — the first keystroke
of a fresh edit, when the digits are still selected (G16). A key that cannot appear in a
number (`a`) may be bound always (G25). New single-key shortcuts go in `onKeyDown` beside
`a`, with their row here. (Derived independently by two models in the 2026-09-17 run; the
docs had not said it.)

---

## 4 · The stepper

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G27 | press | **one step immediately** on down, not on up — hold-to-repeat depends on it | `bf491f7` |
| G28 | hold | repeats after 400ms, then every 60ms, until lift, cancel, or the pointer leaves the button | `bf491f7` |
| G29 | press, then ≥ 6px horizontal | the repeat is cancelled and the gesture becomes a rail drag (G1); the step already taken on down stands | `d14ae6a` |
| G30 | press, then clearly vertical | repeat cancelled, gesture handed to the scroller; no further steps | `d14ae6a` |
| G31 | press, visually | the **chevron** brightens for the press — no disc, no second shape in the box; opacity snaps on at `:active` and eases out over `2 × --dur-fast` on release; the hold-repeat cannot retrigger the flash mid-decay | `bf491f7` |
| G32 | the two buttons on a coarse pointer | 16px boxes, padding-extended hit areas, overlap ≤ 3px so up-vs-down is never ambiguous at the seam | `0a0429c` |

---

## 5 · Wheel

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G33 | vertical wheel over any part of the row | **nothing.** The panel scrolls. A hover-while-scrolling must never edit a value | removed deliberately, see the comment at `rowRef` |
| G34 | horizontal wheel (`|deltaX| > |deltaY|`) | ±`step` per event, clamped, and the row engages | `onWheel` |

---

## 6 · Auto

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G35 | the `auto` button (shown by default wherever `allowAuto`) | toggles between `'auto'` and `autoValue ?? min`; `aria-pressed` follows | props doc |
| G36 | while auto | the track paints at `autoValue` (or mid-range if none) — the bar never sits at 0 for a value that is not 0 | `shownValue` |

---

## 7 · What is not promised

Written down so a test does not get invented for it.

- **Mouse hysteresis.** The 6px / 1.5× judgement is touch and pen only. A mouse gets the
  native range, which already drags from anywhere (G18) — no scroller to concede to.
- **`Home` / `End` / `PageUp` / `PageDown`** in the field.
- **Vertical wheel to adjust.** Deliberately absent (G33).
- **A tablet profile.** Phone and desktop only (EVAL.md Q2).
- **That the bar glows.** HDR is asserted structurally, not perceptually (EVAL.md Q5).

---

## 8 · The theme switch

`ThemeSwitch` (both looks) and `mountThemeSwitch()` (a page without React) over one
engine, `theme.js`. Tested in `tests/behaviour/theme.spec.ts`.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G38 | press Auto / Light / Dark | `<html data-theme>` is that value — **always present, including `auto`** | theme-switch |
| G39 | the same press | stored under **one** key, `wm-theme`, in every app; a page migrating from its own key reads it once and never writes it again | theme-switch |
| G40 | the same press | `aria-pressed="true"` on exactly one button; the look (ink on the mark, or the pill) follows it | theme-switch |
| G41 | a theme applied by anything else — a session restore, a shortcut — fires `wm-theme` on `<html>` | the switch follows the event; a canvas painted with token colours repaints on it | theme-switch |
| G42 | reload | the choice is what it was (font-proofer). Kernpare restores its *session's* theme over storage, by its own prior design | theme-switch |

**Not promised:** where it sits. Both apps park it top-right and fade it; that is the
app's, not the control's.

## 9 · The triplet

`AxisTriplet`: min / desired / max as one row, three fields, no rail. Deployed in the
Fitting panel's H&J section in both apps. Tested in `tests/behaviour/triplet.spec.ts`.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G43 | press a stepper | one step on down; repeat after 400ms, then every 60ms; lift, leave or cancel stops it (the dial's G27–G28, same numbers) | `AxisTriplet.tsx` |
| G44 | `ArrowUp` / `ArrowDown` in a field | ±`step`, `Shift` ×10; abandons a draft first | `AxisTriplet.tsx` |
| G45 | typing in a field | the field shows the draft verbatim; **nothing reaches `onChange` until Enter or blur**, then clamped to `[min, max]` and carried (G46); Escape abandons (§0, the typing rule) | `AxisTriplet.tsx` |
| G46 | an edit that would cross a neighbour | the neighbour is **carried**, never the edit clamped: min pushes desired up and desired pushes max; max pulls desired down and desired pulls min; desired pushes both outward | `carry()` |
| G47 | `offset` | the field shows `stored − offset` and commits `typed + offset` — letter space is stored 100-centred and shown 0-centred | props |
| G48 | `disabled` | the row is at .45 opacity and takes no pointer | `AxisTriplet.css` |

Until 2026-09-19 G45 committed per keystroke, the behaviour the dial had dropped two days
earlier. One rule now, in §0.

## 10 · The mark

`Icon`: a Material Symbols mark on the same axes as the type beside it. Tested in
`tests/behaviour/icon.spec.ts`; the swatch structurally in `tests/render/rows.spec.ts`.

| id | state | promise | commit |
| --- | --- | --- | --- |
| G49 | rest / hover / active | GRAD **dark 50 · 100 · 75**, **light 100 · 150 · 100**. Hover is the top of the ladder; active is one rung below hover, on both grounds | `5a7f38e` |
| G50 | `off` | the rest rung, and **no hover** — a control that cannot act does not brighten | `icon.css` |
| G51 | hover over an active mark, by its own class or an ancestor `.active` | **nothing.** Hover never repaints an active mark: with `background-clip: text` a repaint at ink-quiet would *replace* the swatch, not dim it | `5a7f38e` |
| G52 | active, dark ground | the mark is masked with the PQ swatch (HDR); `dynamic-range-limit: no-limit`. Light ground: no swatch, plain full ink — the boost has nowhere to go | `5a7f38e` |
| G53 | `size` | sets `font-size` **and** `opsz` together; `opsz` clamped to the axis, 20–48, so the setting stays valid rather than silently ignored | `Icon.tsx` |
| G54 | `label` | given: `aria-label`; absent: `aria-hidden` — the adjacent text names it | `Icon.tsx` |
| G55 | a press on a stepper | the chevron brightens — no disc, no second shape (G31) | `bf491f7` |

## Other controls

`StopSlider` is not on main — it lives on the `flattersatz-headless` branch, where
WORDMAKE builds against it (NEXT.md E). It gets rows here when that lands (2026-09-19).

## 11 · Collapse

`Collapse`: a disclosure box that measures its own content, so a section's height is
never a number anyone maintains. It ships inside `Fitting` — font-proofer's H&J panel
holds two — which is why NEXT.md D had it down as unshipped: nothing imports it by name
but the primitive that wraps it. No gesture of its own; the triplet tests (G43–G46) run
inside an open one, and `triplet.spec.ts` opens it the way a hand would.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G56 | `open` flips | the box animates between 0 and its measured content height, then drops the cap so a label that wraps later is not clipped | `Collapse.tsx` |
| G57 | content changes while open | the height follows the content; nothing is typed in | `Collapse.tsx` |

## 12 · The zoom control

`src/zoomControl.js` + `.css`: zoom_out · the dialHandle rail with the percentage in the
lozenge · zoom_in · the mark (`data-icon`), applying CSS `zoom` to a target. Alone, or under the theme
switch as `.wm-theme-stack` (themeSwitch.css). Prototyped on two scratch study pages
(2026-10-06). Tested in `tests/behaviour/zoomControl.spec.ts`.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G58 | any change, from anywhere | the value is clamped to `[min, max]` (default 50–400) and snapped to `step` (10) counted from `min`; the rail is `role=slider` with `aria-valuemin/max/now` and the label "Zoom"; the lozenge reads `N%` in tabular figures | zoom-control |
| G59 | zoom_out / zoom_in / the mark | −step / +step; the mark, on a control that never collapses, goes back to **100** — the page's own size, not "fit the window". On a collapsing control the mark only opens and closes (G67), and the reset is the lozenge (G72). There is no fit_screen button | zoom-control |
| G60 | `+` or `=` / `-`, `_` or `−` / `0` | in, out, back to 100: while focus is in the control, or anywhere on the page that is not a field (`input`, `textarea`, `select`, contenteditable). With Cmd/Ctrl/Alt: **nothing** — those are the browser's own zoom. A control with `data-keys="local"` answers only with focus inside it; otherwise the first page-level control does. On the rail, arrows ±step, Home/End min/max | zoom-control |
| G61 | reload | the value is what it was, read from `localStorage[data-key]` (default `wm-zoom`) in try/catch; every change, and the mount, fires `wm-zoom` (bubbling, `detail` = the percent) | zoom-control |
| G62 | a zoom other than 100 | the target is anchored **top-left**: it keeps its 100% width and left edge, so it grows right and down, nothing reflows, and the document scrolls to its new right edge. A selector that matches several boxes (the blocks under a sticky header that holds the control) zooms and anchors each on its own. The type is re-rasterised, not scaled; a `<canvas>` inside is the exception and redraws at `currentCSSZoom` on `wm-zoom` | zoom-control |
| G63 | 200% | a baseline in the target is twice as far from the target's top, within 1px: exact on macOS's system-ui, 1px off on the Linux runner's face, because Chrome rounds ascent and descent to whole pixels at each size. Flowing text has no mark to re-seat on, so the control does not | zoom-control |
| G64 | the stack | the theme row and the zoom row are **one width with one right edge** — CSS, one `max-content` grid column, no measurement — each 27px (33 on touch), `--spacing-02` apart | zoom-control |
| G65 | press on the lozenge, then drag | the value does **not** jump on the press; it follows the pointer from where it was grabbed; a press elsewhere on the rail jumps there. The lozenge never leaves the rail. No wheel (G33) | zoom-control |

**Collapse and placement** (`data-collapse`, `.wm-zoom--left`, `.wm-theme-stack`; round 2,
2026-10-07). The same spec file.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G66 | at rest, `data-collapse` | one 27px `.wm-icon-btn` (33 on touch), the mark, showing `data-icon` — `pageview` by default, or `feature_search`; both have a FILL drawing (frame_inspect, the first default, has none) — unfilled (FILL 0), with `aria-expanded="false"`; every other part is `inert` and clipped off its left | zoom-control |
| G67 | press the mark | the control opens **leftwards out of it**, and the mark **stays where it is**. Layout jumps to the open state; the morph is transform, opacity and clip-path only, one 600ms timeline (2.5 × `--dur-med`), in Mark's order: **1** one magnifier leaves the mark, which fills in place (FILL 0 → 1, 0–120ms); **2** it zips to where the lozenge sits at 100% (0–100); **3** there it becomes two, `zoom_out` and `zoom_in`, which travel outward to the ends (120–330) and cross into the real buttons (330–380); **4** the rule stretches with them from the centre to both ends, under everything (a clip on the full-length hairline, 120–330); **5** the lozenge appears as a 6px dot on the rule at the centre (300); **6** it grows round the readout a numeral a beat — `1`, `10`, `100`, `100%` (340–490) — then slides to the saved value if that is not 100 (500–600). Focus goes to the rail. **Pressed again while open**, the mark closes the control and **keeps the zoom** (the reset is the lozenge, G72). **Closing** (300ms) is the open folded back: the two glasses zip to the lozenge and merge as the rule retracts into them, the numerals collapse as the lozenge shrinks to the dot, the one glass zips home and the mark unfills — unless the zoom is not 100, when it stays filled (G73). `Escape` (focus inside) and a press anywhere outside close the same way and **keep** the value; Escape returns focus to the mark. A hidden page swaps the states, as reduced motion does | zoom-control |
| G68 | `prefers-reduced-motion: reduce` | the same two states, swapped, with no morph | zoom-control |
| G69 | reload | open or closed is kept with the value under the one key: `"170 open"` / `"170 closed"` (`parseFloat` still reads the number); with nothing stored, `data-open="true"` starts it open | zoom-control |
| G70 | `.wm-zoom--left`, open | the control opens **leftwards** on the theme switch's row from a 27px footprint, its right edge anchored to the footprint's; the open box lies over the row (ground: `--zoom-ground`), so the row stays 27 tall and nothing in it, beside it or below it moves; the rail is a fixed 8rem | zoom-control |
| G71 | `.wm-theme-stack`, collapsing | at rest the mark sits at the stack's right edge under the switch; open, the zoom row and the switch row are one width with one right edge (G64); the rail's floor is 10rem, so the open stack is wider than the chips | zoom-control |

**Reset, the shut readout, and capture** (round 6, 2026-10-07).

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G72 | press the lozenge (down and up, no drag) | **back to 100**: the lozenge slides home over `--dur-med` while its numerals count to 100 a step at a time; the control stays open. A drag that starts on the lozenge still drags (more than 3px). `0` (G60) is the same reset. Reduced motion or a shut control: at once | zoom-control |
| G73 | shut, at a zoom other than 100 | the value stays on show **immediately left of the mark** — `150%`, the ui role (12/15), tabular, `--text-muted`, no pill — on the same row, out of the flow, so nothing moves; the mark stays **filled**. It fades in as the control shuts and out on a reset. At 100: no readout, the mark outlined | zoom-control |
| G74 | `data-capture`, a pinch over the region | the region is the target, or the selector given as the value. A trackpad pinch there — `wheel` with `ctrlKey` (Chrome, Firefox, Edge; also ctrl + a mouse wheel), or Safari's `gesturestart`/`gesturechange` — is **cancelled** (listeners on the region, `passive: false`) and drives the control: continuous, × e^(−deltaY/100), snapped to the step; Safari's scale from the value the gesture began at. A shut control opens, with its morph. A plain wheel there still scrolls | zoom-control |
| G75 | `data-capture`, Cmd/Ctrl `+` `−` `0` | while the pointer is over the region or focus is inside it: cancelled, and ±step / the reset on this control (opening it if shut) — **in a text field too**: the chord types nothing, and the page zooming under a field is what capture exists to stop. Elsewhere the chords are the browser's | zoom-control |

**Not promised (capture).** The browser's own zoom outside the region — a page cannot reach it,
and should not. A pinch the browser handles before the page sees it (some platforms' "smart zoom"
double-tap, iOS Safari's page pinch) is not intercepted. Browser zoom applied before the control
mounted stays applied.

## 13 · The theme stack, vertical

`.wm-theme-stack--vertical` (themeSwitch.css) + `src/themeStack.js`: the phone's version of the
theme + zoom cluster (Mark, 2026-10-07: "run them vertically … exclusively for mobile versions of
font-proofer and gliffdiff"). The class is unconditional; the HOST puts it on under its own phone
rule — `(max-width: 768px), (pointer: coarse)` — through its mobile render branch or a `matchMedia`,
because CSS cannot add a class. Tested in `tests/behaviour/themeStack.spec.ts` against
`tests/fixtures/theme-stack.html`, which does exactly that.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G76 | the class on, any scroll or pan of the page | the three theme marks and the zoom's mark run **top to bottom**, `position: fixed` at `--stack-top` from the top (6px by default; under the host's chrome with `data-below`, G82) and `--spacing-04` from the right (past the safe areas), so the cluster never moves with the page; no bar, no ground (transparent, no image). Each target a 27px square, 33 on touch, on the 3px line, one right edge; the zoom's mark `--spacing-02` under the third; the zoom is `.wm-zoom--down` (G79), the stack's only layout. The chosen mark is the house active mark (G52): the PQ swatch on dark, full ink on light. Without the class the stack is the ordinary one and nothing hides | theme-stack-vertical |
| G77 | `data-hide="scroll"`, a vertical scroll anywhere (or only in `data-scroller`) | **down** hides it — `data-stowed`, `inert`, translated off the top edge — by its height **plus its whole rest top**, so it clears the edge from any rest (from 114px a fixed 48px left its foot on the chrome) — over 180ms on `cubic-bezier(0.2,0.7,0.2,1)` — **up** shows it. A direction must run **24px** (eight units) before it counts, so a jitter cannot flap it; on the **page's own** scroller it always shows near the top (until the content under its rest footprint has scrolled past). On a **named** (`data-scroller`) or inner scroller the run alone stows it — no near-top exemption: with `data-below` the stack rests inside the stage's box, so a footprint measure was always ≈ its own height and the stage had to scroll ~145px. Read passively, one capture-phase listener; the scroll is never cancelled. Hiding folds an open zoom | theme-stack-vertical |
| G78 | `data-hide="swipe"`, a pointer down **on the stack**, then up | clearly vertical (dy > 1.5 dx) the stack follows the finger upwards; lifted past **24px** it is dismissed, short of that it settles back. The press that became a swipe is not also a press on the mark it began on. A drag that starts on the zoom's rail is the rail's. Back: a press **inside the stack's rest footprint** — its column × its rest height at its rest top, wherever `--stack-top` puts it — or a scroll up of 24px. While stowed (not under the host's `data-hidden`) **the footprint is the stack's**: the press is taken on the document's capture phase, cancelled and stopped, and the mouse/click/focus that would follow are swallowed, so nothing under it sees it — no caret, no keyboard, no glyph detail. (It was the top 27px of the screen, which is where hosts keep tabs; then a pass-through tap in the footprint, which focused the paragraph under it.) | theme-stack-vertical |
| G79 | `.wm-zoom--down`, open | the vertical stack's zoom (Mark, 2026-10-07: down, and only down; `.wm-zoom--left` stays the horizontal row's, G70) opens **downwards** from its mark: the mark on top, then zoom_in, a rail of `--zoom-rail` (126px) with **max at the top** (`aria-orientation="vertical"`, ArrowUp is +step), zoom_out at the foot; one column: zoom_in, the rail and zoom_out sit **on the mark's own axis** (one right edge with the stack's marks, G76) — a bigger target from the screen edge and from slide drawers (Mark). The lozenge, not rotated, is centred on that axis and overhangs the column toward the edge; only if centring would put it (ring included) past the viewport's right edge is **the lozenge alone** moved inward, by the least that keeps it on screen. The glasses and the rail never leave the axis. The rail shortens to fit: `min(--zoom-rail, foot − the open box's top − the rest of the box − 12px)`, the foot being the viewport's or, if the stack names a `data-scroller`, that box's bottom, whichever is higher up, on the 3px line, so the open box **ends 12px inside** that foot — down to the floor, **45px** (fifteen units): the least at which the 21px lozenge still travels the whole min→max range with the glasses clear of its 3px ring. Re-measured on open and resize; the lozenge's travel is a percentage of the rail. `--zoom-rail` is the nominal — a host's value is honoured as-is, the floor its only minimum. If even the floor does not fit, the control still opens at 45 and its foot crosses the host's lower chrome; nothing warns. The box lies over the text below it, so nothing moves. The open morph (G67) is the same timeline: the glasses travel between measured centres, so they go down by themselves; only the rule's stretch, the lozenge's slide and the rail's mapping change axis | theme-stack-vertical |
| G82 | `data-below="selector"` on the stack (commas allowed) | the stack rests **under the host's top chrome**: `--stack-top` = the **lowest** bottom among every element the selector matches, + 6px, rounded up to the 3px line, written on the stack. Nothing matching (a row that exists in some modes only): removed, and the default 6px stands. Re-measured on resize, orientation, a resize of any match (ResizeObserver), a `class`/`hidden`/`style` change on a match, a child added or removed in a match's parent (every parent ever seen stays watched), the end of a scroll and a tap. Nothing body-wide: a contentEditable host restyles inline constantly. A row that appears where no match ever was is caught on the next tap, resize or scroll end. A host with no selector to give sets `--stack-top` itself (a multiple of 3); the stack never sits over chrome either way | theme-stack-vertical |
| G83 | `data-fit="selector"` on the `.wm-zoom--down` (or its `.wm-theme-stack`) | the box the open control ends **12px inside**: the **lowest** bottom among the matches, never past the viewport; absent, or nothing matching, the `data-scroller` box, else the viewport (G79). So a host can lend the rail a row below its stage — font-proofer's chevron flap, two-thirds wide and centred, frees the right sixth of its row under the zoom column (Mark: "buy some space for the max length … with the flap not bar"), ~51px more rail. Re-measured on open, resize, and the `data-below` triggers (G82) applied to its matches | zoom-fit |
| G81 | the host sets `data-hidden` on the `.wm-theme-stack` (or calls `wmThemeStack.hide(el, true)`, which only sets it) | hidden **whatever the scroll or swipe say** — the same translate off the top edge, `inert`, an open zoom folded — for as long as the attribute is there; a scroll up or a top-edge tap does not bring it back. Removed (`wmThemeStack.hide(el, false)`), the stack is where the scroll state puts it: shown, unless a scroll down stowed it meanwhile. themeStack.js **never adds or removes** `data-hidden`; its own state is `data-stowed`. For a sheet or overlay that covers the corner (font-proofer's phone sheet). Without the class, the in-flow stack is `visibility: hidden` | theme-stack-vertical |
| G80 | `data-capture`, a **touch** pinch over the region | it opens the shut control (with its morph) and drives the value, × the ratio of the fingers' distance to their distance at the second touch-down, from the value it began at — as a desktop pinch does (G74). iOS Safari: `gesturestart`/`gesturechange`, cancelled. Elsewhere (Chrome Android): two touch pointers; the region gets `touch-action: pan-x pan-y` and a two-touch `touchmove` is cancelled, so the browser never pinch-zooms first; one finger still scrolls. Never both: where gesture events exist, the pointers do not count. A touch on the region while open closes the control on **lift**, and not at all if a second finger came down, so a pinch never folds and reopens it. The native zoom never happens, so the fixed stack stays top right (`visualViewport.scale` stays 1). **The host's half:** the zoomed target pans sideways in its own box (`overflow-x: auto` on its parent); if the document itself grows wider, mobile Chromium widens the layout viewport to it and a fixed element moves with it — measured: the stack's right edge went from 363 to 551 at 150% | theme-stack-vertical |

**Not promised (§13).** No gesture outside the stack is captured: a swipe on the text is the
page's, and the top-edge tap also reaches whatever is under it. The zoom control's own capture
(`data-capture`, G74–G75, G80) is unchanged by the stack. With capture **off**, a page pinch
moves a fixed element with the layout viewport (iOS Safari especially); the stack does not track
`visualViewport`. With capture on, a pinch that starts outside the region is still the browser's. A scroller
other than the page (or `data-scroller`) is learnt on its first scroll event, so that one event
does not count.

## 14 · The confirm

`src/confirm.js` (`wmConfirm(el)`) + one keyframe set in `src/motion.css`. Mark, 2026-10-08:
*"every click has a CONFIRMATION signal, like macOS: on successful click, undo then redo the
click look."* `:active` is the **acknowledgement** and is unchanged; the confirm is the
**receipt**, given only when the press worked. Tested in `tests/behaviour/confirm.spec.ts`
against `tests/fixtures/confirm.html`.

**The timeline.** At the outcome (t = 0) the control's script adds `.wm-confirm`.

| t (ms) | `--confirm-off` | what shows |
| --- | --- | --- |
| 0 – 80 | **1** | the press look **off** — the control's rest paint |
| 80 – 160 | **0** | the press look **on** |
| 160 | — | `animationend` takes the class off (a timeout 60ms later if the animation never ran); the control **settles** into its result state |

`steps(1)`: a blink, not a fade, and the recipes' own transitions are off while it runs. Paint
only — no box moves, the grid is untouched, a chosen chip's weight does not blink. Each family
mixes **its own** press look by `--confirm-off`: a box (`.wm-btn`, `.wm-chip`, `.fit-switch`,
`.wm-stops-row button`, the case study's `.ui-*` and `.ssd-btn` ring) its fill and edge; a mark
(`.wm-icon`, `.wm-hd-pill`, `.ssd-row.on`) its FILL and HDR paint (G52); a stepper its chevron
light (G31).

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G84 | a press whose outcome succeeded | `.wm-confirm` on the control at the outcome; `--confirm-off` 1 for 80ms, 0 for 80ms; the class is gone after 160 and the control is in its result state | click-confirm |
| G85 | `prefers-reduced-motion: reduce` | no class, no blink: straight to the result | click-confirm |
| G86 | a second success inside the blink | the running animation is rewound to 0 on the **same** class — the class is never taken off and put back, so nothing flickers; the timeout restarts with it | click-confirm |
| G87 | a press that failed its own check — a step clamped at a bound, a reset at 100, a handler that reports failure | **nothing.** Only outcomes confirm: never a drag, a hold-repeat, a hover or a focus | click-confirm |
| G88 | stepper (`.slider-step-btn`, `.triplet-step-btn`) | the confirm fires on the **lift** of a press that took its one step on down (G27, G43) and did nothing else: not once the repeat has started (G28), not after the press became a rail drag (G29) or went to the scroller (G30), not after the pointer left. So the repeat can never retrigger it, which is G31's rule for the flash, kept | click-confirm |
| G89 | zoom lozenge press (G72), the `0` key, a non-collapsing mark (G59) | the reset to 100 blinks the **lozenge's** fill, while it slides home. Shut, the reset shows on the note (G73) and nothing blinks. **Open / close (G67) does not confirm**: the morph's first beat fills the same mark (FILL 0 → 1, 0–120ms, Web Animations) and would override the blink — the morph is its receipt | click-confirm |
| G90 | theme mark (G38), alignment mark, chip, row, stop, `fit-switch`, the auto switch | confirmed in the primitive's own handler. A React button that rewrites its `className` on the result (an `.active` mark) re-asserts the class after the microtask and the next frame, so the receipt survives the render | click-confirm |
| G91 | `GlyphPicker`'s copy (SLIDERS.md row 8) | the filled, active `content_copy` blinks off 80 / on 80, **then** becomes `check` at 160. It was its own 260ms slow fill; it is the house confirm now, and still fills before it swaps | click-confirm |
| G92 | press (`:active`) on a chip, a mark (`.wm-icon-btn`: the theme marks, the zoom's marks, the alignments) or the lozenge | the **acknowledgement**, snapped on, so the confirm's off phase has a look to undo. Chip: a pill, so not corners.css's inset ring (it ignores `corner-shape`) — the edge goes to the fill's ink over a 12% wash. Mark: the **hover rung** (ink-quiet, GRAD +50) — no box, no disc; never on an already active mark (G51). Lozenge: its ink goes to the end of the ramp (white on dark, black on light). A chosen chip takes none: it is already filled | press-ack |

**Where the call lives.** Wired: `ThemeSwitch` and `mountThemeSwitch` (theme.js), `Fitting`
(alignments, Swiss Rag, Hyphenate), `StopSlider` (a stop), `StyleScopeDropdown` (a row, the
trigger), `AxisSlider` / `AxisTriplet` steppers, `GlyphPicker` copy, `zoomControl.js` (the
reset) and `dialHandle.js` (the auto switch) — the two plain scripts through
`window.wmConfirm?.(el)`, so a page that does not load `confirm.js` still works, unconfirmed.
**The host's:** `.wm-btn` and `.wm-chip` have no script — the app calls `wmConfirm(button)` in
its own handler, after the work succeeded; the same for the case study's `.ui-*`.

**Not promised (§14).** The `--switch` chip keeps its **dashed** edge through the whole blink:
dashed is its rest look, and the receipt must not solidify it (Mark has not ruled; the rest look
is the safe one).

## 15 · The focus guard

`src/iosFocusGuard.js` (`iosFocusGuard(el, { caret })`), used by `EditableTextBlock` with layer 1
only. Tested in `tests/behaviour/ios-focus-guard.spec.ts` against
`tests/fixtures/ios-guard.html`, with a faked iOS user agent and synthetic touches: **the
scroll it exists to stop only happens on a real iPhone**, so the tests cover the logic and
never the fix.

**The guard only undoes scrolls.** Chrome on iPhone resizes the layout viewport with the keyboard, and
`vh`, `svh`, `dvh`, `lvh`, and `innerHeight` all shrink with it (817 to 435 measured). Anything sized in
them above the editable changes height, and the page moves with `scrollY` at 0, so there is nothing to
put back. A page with viewport-sized blocks above an editable has to hold those heights itself.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G95 | anything, off iOS | no listeners, no writes. iOS is `iP(hone\|ad\|od)` in the UA, or `Mac` with `maxTouchPoints > 1` | ios-focus-guard |
| G96 | a tap focuses the element | for 700ms from the focus, the window and every scroller around it (`overflow: hidden` ones too) are put back where they were at the touch. Nothing that didn't move is written to | ios-focus-guard |
| G97 | a touchmove anywhere, during or before the hold | the hold ends and the reader's scroll stands | ios-focus-guard |
| G98 | a tap the keyboard would cover: `tapY + 48` not under `visualViewport.height` if the keyboard is open (height under 80% of the tallest `innerHeight` seen at this width, taken at each touch, because Chrome on iPhone shrinks `innerHeight` with the keyboard), else `height * 0.55` | neither layer acts; iOS reveals the line | ios-focus-guard |
| G99 | a focus with no tap behind it, or over 500ms after the finger lifted, or a tap already spent by a focus | no hold: Enter moving to the next block never pulls the page back | ios-focus-guard |
| G100 | a quick tap with `caret: true` on an unfocused contenteditable | `touchend` prevented, focus with `preventScroll`, caret placed at the tap. Left to iOS: a drag, a press over 400ms, an element already focused, a textarea | ios-focus-guard |
| G101 | the guarded element is replaced during the focus (`EditableTextBlock`'s key) | the hold carries on, and the replacement's guard takes over the touchmove. With no guard left, the hold stops | ios-focus-guard |

## 16 · Accessibility one-offs

Five gaps from the accessibility audit. Tested in `tests/behaviour/a11y-oneoffs.spec.ts`.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G102 | `AxisSlider` is read by a screen reader | the range and the field are both named by the label (`aria-labelledby` on the label span); `aria-valuetext` carries the unit (`16 px`) and says `auto, 14` while auto. `AxisTriplet` fields keep their `label min / des / max` names and speak the unit | a11y-oneoffs |
| G103 | a `Collapse` is shut | `inert` and `aria-hidden`: nothing inside is focusable or announced. Open removes both. The animation is untouched | a11y-oneoffs |
| G104 | the `InlineEmphasisBubble` | `role="toolbar"` ("Text emphasis") of two real buttons with `aria-pressed` for what the selection already is. A mouse press still acts on mousedown and keeps the selection; Enter / Space acts on the click (`detail` 0), so one press never fires twice. Pressing again takes the marker off, and the selection stays on the same words | a11y-oneoffs |
| G105 | Cmd+I / Cmd+B (Ctrl on non-Mac) in an `EditableTextBlock` with `emphasis` | the same toggle as the bubble (`src/emphasis.ts`), written as `*` / `**` text, never the browser's `<i>` / `<b>`. `***x***` is both. No selection: the key is swallowed and nothing is written. Without the `emphasis` prop the keys are the browser's | a11y-oneoffs |
| G106 | keyboard focus on the toggle group, theme marks, zoom control, toast, and the triplet field | the house 2px ring (`--signal-ink`), by `:focus-visible` only: a click never draws it | a11y-oneoffs |

## 17 · Overlays: popover, menu, dialog

`src/overlays.tsx`: `usePopoverTrigger`, `Popover` (or the `usePopoverPanel` hook, for a panel
that renders its own root), `Menu` + `MenuItem`, `Dialog`, `useOverlayClose`. Behavior only:
every element is the host's, with the host's class, where the host renders it (no portal, no
positioning, no style). Built on React Aria's low-level hooks (`useOverlay`, `useOverlayTrigger`,
`useModalOverlay`, `FocusScope`). Not in `index.ts`: import the file by path once the app has
`react-aria` and `react-stately` installed. Tested in `tests/behaviour/overlays.spec.ts` on
`tests/fixtures/overlays.html`, the page bundled from `tests/fixtures/overlays-entry.tsx`.

**G107–G111 are unused**: this section was written beside §16 and started at G112 so neither renumbered the other.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G112 | any render | the trigger carries `aria-haspopup` (`dialog` for a panel, `true` for a menu, `listbox`), `aria-expanded`, and while open `aria-controls` = the panel's id. The panel has `role` = its type and `tabindex="-1"`; every other prop the host gives lands on it untouched | overlays |
| G113 | Escape (focus inside), a press outside, focus leaving (Tab out, a field pressed elsewhere), the trigger again | a non-modal panel closes. The outside press **lands**: the page under a non-modal panel is live, so one press closes the panel and does what it does there, pointerdown included (a dial under it starts its drag). A press on the trigger is the toggle, never close-then-reopen | overlays |
| G114 | it opens | focus moves in, without scrolling: a panel takes it on **itself**, never on a field (on a phone a field raises the keyboard); a child with `autoFocus` takes it instead. A menu or listbox lands on its chosen item (`aria-checked` / `aria-selected`), else the first | overlays |
| G115 | it closes | focus goes back to the trigger, unless it already went somewhere on purpose (Tab out, a press on another field). A trigger that takes no ref (AccentButton on React 18) is found by its `aria-controls` at the open | overlays |
| G116 | overlays inside overlays | only the topmost answers Escape: a menu inside a dialog closes first, focus back on its trigger inside the dialog; the next Escape closes the dialog | overlays |
| G117 | Escape in a text field inside the panel | if the field answered it (blurred itself, as the dial's value field does, or prevented the key, as the triplet does) the panel **stays**, focus comes back to the panel, and the next Escape closes it. A field that ignored the key: the panel closes. Mid-composition (IME): nothing | overlays |
| G118 | ArrowDown / ArrowUp / Home / End in a menu or listbox | focus walks the items (`menuitem`, `menuitemradio`, `menuitemcheckbox`, `option`), wrapping, skipping disabled ones. On the closed trigger ArrowDown opens onto the chosen item (else the first), ArrowUp onto the last. Tab leaves and closes | overlays |
| G119 | an item pressed, or Enter / Space on it | `onAction` runs, then the menu closes and focus is back on the trigger (`closeOnAction={false}` keeps it open). `selected` makes it a `menuitemradio` with `aria-checked`. A disabled item does nothing and the menu stays | overlays |
| G120 | a modal opens | everything outside the panel and its scrim is `inert` and the page does not scroll (React Aria's `usePreventScroll`, the scrollbar's width padded back); both are given back on close | overlays |
| G121 | Escape, a press on the scrim, the panel's own close | the modal closes (the scrim only while `isDismissable`, the default). The scrim press does not land: the page under it is inert. Tab and Shift+Tab wrap inside the panel | overlays |
| G122 | a modal opens, then closes | focus to the panel (or the `autoFocus` child), and back to the opener once the inert is lifted | overlays |
| G123 | the dial and the iOS focus guard | a dial inside a panel drags and takes Escape (G117) without closing it, even when the drag ends outside. A non-modal panel adds no touch listener: under `iosFocusGuard` (§15) a tap into an editable outside closes the panel by its blur, and focus stays in the text. The modal's scroll lock is React Aria's own iOS handling; a guarded editable inside an open modal is not promised | overlays |
| G124 | `prefers-reduced-motion: reduce`, or not | the primitive has no motion: open and close are immediate, and every focus move is `preventScroll` (an item brought into view jumps, `block: nearest`). A host that animates its panel does it in its own CSS, behind `prefers-reduced-motion: no-preference` | overlays |

**Not promised (§17).** Positioning: the panel sits where the host's CSS puts it, and keeping it
inside a box (ReCal's `useKeepInside`) stays the host's. Typeahead in menus. Submenus. The
VoiceOver re-announce React Aria's `useDialog` does on iOS (it is not used: its focus runs once
on mount, and a hook-form panel mounts closed).

## 18 · Collections from the keyboard

`StyleScopeList` / `StyleScopeDropdown` (`src/StyleScopeDropdown.tsx`) and `GlyphPicker`
(`src/GlyphPicker.tsx`). Tested in `tests/behaviour/collections.spec.ts` against
`tests/fixtures/collections.html`, whose picker holds every codepoint Cal Sans encodes
(1,072 cells), so "one Tab stop" is measured at the real size.

**Ids start at G126.** Three branches added rows at once (2026-11-23): §16 took G102–G106
and §17 G112–G124, so G107–G111 and G125 are unused. Ids stay permanent.

**The list is React Aria, the grid is not.** The list uses `useListBox` / `useOption`
(`react-aria`, `react-stately`, peer dependencies from this change). The grid is a roving
tabindex written here. Measured on the fixture's set in Chromium, production build, keydown
or pointerdown to the frame after it, median of 7 interleaved loads, at 1,072 cells (Cal Sans)
and 3,216 (the set three times): a `useGridList` prototype cost 62 / 185ms per pick and
31 / 93ms per arrow press, because every item re-renders when the selection manager changes.
The hand-rolled grid costs 17 / 17ms per pick, the same as main (one frame is the floor of the
measure), and 12 / 12ms per arrow, because an arrow flips `tabbable` on two memoized cells and
nothing else. Mount: 124 / 146ms, against main's 235 / 233 and the prototype's 112 / 315.

**Selection stays the host's.** `rows[].selected` is the truth. React Aria is never allowed to
change it: every pick, from a press or the keyboard, becomes the one call the hosts already
handle, `onSelect(id, event)`, with the real event, so font-proofer's shift-click range and its
"click the active role to clear it" keep working.

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G126 | a list opens from the keyboard (`autoFocus`, which `StyleScopeDropdown` always passes) | focus lands on the selected row, or the first row if none is selected | collections-keyboard |
| G127 | Tab into a `StyleScopeList`; ↑ ↓, Home, End, or typing a label's first letters | one Tab stop for the whole list (roving tabindex); the keys move focus and never pick. Space or Enter picks the focused row, exactly as a click does. `mode="multi"` is `aria-multiselectable`; every row carries `aria-selected`. React Aria's own extras (Shift+Arrow range, Mod+A, Escape clears) reach nothing | collections-keyboard |
| G128 | a pointer pick, mouse or touch | unchanged: one `onSelect(id, e)` per press, `e` the click with its modifier keys, then the confirm blink on that row | collections-keyboard |
| G129 | `StyleScopeDropdown`'s trigger | `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls` naming the open list; the list is labelled by the trigger. ↓ or ↑ on a closed trigger opens it | collections-keyboard |
| G130 | Escape inside an open dropdown | it closes and focus returns to the trigger. Tabbing out closes it without moving focus back | collections-keyboard |
| G131 | a `mode="single"` pick in the dropdown | the list closes and focus returns to the trigger, which now shows the new name | collections-keyboard |
| G132 | Tab through a `GlyphPicker` | the whole set of cells, every group, is ONE Tab stop: the cell last moved to, else the selected glyph, else the first. A char that sits in two groups is still one stop | collections-keyboard |
| G133 | arrow keys in the picker | ← → move one cell, crossing group ends; ↑ ↓ move one row in the same column, crossing into the next or previous group's nearest row (a short last row lands on its last cell); Home / End go to the row's ends, Ctrl/⌘+Home / End to the first and last cell; PageUp / PageDown move by the rows that fit in the visible grid. Moving never picks: Enter or Space does | collections-keyboard |
| G134 | a screen reader on a cell | each group is a `role="grid"` labelled by its group label, with `role="row"`s (`display: contents`, so the CSS grid is untouched) of `role="gridcell"`s. A cell is named by its character, its glyph name and its code ("Ä, Adieresis, U+00C4"; a name that only repeats the character is dropped), whether or not captions are on. The picked glyph is `aria-selected` | collections-keyboard |
| G135 | copy succeeds | "Copied ß, U+00DF" is announced in a polite live region inside the picker, read and never seen; copying the same glyph twice announces twice. Not the toast: a toast would be a new thing on screen | collections-keyboard |
| G136 | keyboard focus on a row, a cell, a trigger, or the copy button | the house ring (`button.css`: 2px `--signal-ink`), on `:focus-visible` only, so a click never draws it. A glyph cell's ring sits outside the cell (offset 1px) so it never reads as the selected cell's inset ring; a list row's sits inside (offset −2px), like 06 Menu | collections-keyboard |
