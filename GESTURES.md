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
| coarse-pointer row / resting bar / engaged bar | **48 / 32 / 48px** | `AxisSlider.css` `@media (pointer: coarse)` |
| input inset inside the resting bar | **3px top, 5px bottom** | same — finger aims with its visible top edge |
| reference marker clamp from either end | **5px** | `clamp(5px, %, calc(100% − 5px))` |
| shift-arrow coarse step | **×10** | field `onKeyDown` |
| drag updates delivered to the host | **≤ 1 per frame**, latest wins, duplicates dropped | `queueValue` / `lastSent` |

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
| G12 | lift | the bar stays full for 3000ms, then returns to 32px | `0a0429c` |
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

`StopSlider` never existed in this repo — the census named it, no file did (2026-09-19).

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
