# Gestures — what a control promises to a pointer

The behaviour spec. [DIAL.md](DIAL.md) says where things sit; this says what they *do*
when touched, pressed, typed at or scrolled. One row per promise, each traced to the
commit where the opposite behaviour was a reported bug — so a row here is not a wish, it
is something that has already gone wrong once. The tests in `tests/` cite these ids.

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

---

## 1 · The rail

Mouse is left to the native `<input type=range>`: click jumps, drag from the thumb
follows. Every rule in this section is for **touch and pen** (`pointerType !== 'mouse'`).

| id | gesture | promise | commit |
| --- | --- | --- | --- |
| G1 | finger down anywhere on the row, then ≥ 6px of movement that is not clearly vertical | value follows the finger for the rest of the gesture, from wherever it started — not only from the thumb | `d14ae6a` |
| G2 | finger down on the row, then movement that is clearly vertical (dy > 1.5 dx) | the page scrolls; the value never changes; the gesture is handed back and not reclaimed | `ffa2e95` |
| G3 | finger down, movement < 6px, lift | no value change (the native tap-to-jump still applies on mouse; on touch a sub-threshold press is a no-op) | `d14ae6a` |
| G4 | a gesture that wanders — first sample looks vertical, later samples horizontal | still becomes a drag; undecided is not the same as refused | `d14ae6a` |
| G5 | press at x = 0 / x = width − 1 of the track row | reaches `min` / `max`; nothing at the ends of the bar is dead | `0e55d1f` |
| G6 | the value is read from the pointer's x against the **rail**, wherever the press began (field, stepper, rail) | one mapping, `valueAt`, for all three | `0a0429c` |
| G7 | during a live drag, `pointermove` at 120Hz | host receives at most one `onChange` per animation frame, always the most recent position, never the same value twice in a row | `d14ae6a` |
| G8 | lift, with a value still queued and no frame having run (hidden tab, backgrounded page) | the queued value is delivered synchronously on lift; the gesture cannot end on a value the host never saw | `d14ae6a` |
| G9 | the whole of a live drag | `<html data-scrubbing>` is present from the moment the gesture is claimed until lift, and absent otherwise | `d14ae6a` |
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
| G16 | tap (touch/pen, < 6px movement) | focuses for typing; the tap did not jump the value | `0a0429c` |
| G17 | press and horizontal drag (touch/pen) | drives the value exactly as a rail drag would (G1, G6–G9); the field does **not** take focus | `0a0429c` |
| G18 | mouse | native: click focuses, no drag | `0a0429c` |
| G19 | typing while focused | the field shows the draft verbatim, including empty, `-`, and out-of-range intermediates; an **in-range** draft propagates on each keystroke; nothing out of range ever reaches `onChange` | `ffa2e95` |
| G20 | select-all then type `2`,`4` on a min-8 dial | `8` is never emitted; `24` is committed on blur | `ffa2e95` |
| G21 | blur with an empty or unparseable draft | reverts to the committed value; `onChange` not called | `ffa2e95` |
| G22 | blur with a parseable draft | clamped to `[min, max]`, then committed | `ffa2e95` |
| G23 | `Enter` | commits (blurs); `Escape` abandons the draft and blurs | `ffa2e95` |
| G24 | `ArrowUp` / `ArrowDown`, held | ±`step`, clamped; the OS key-repeat carries the hold. `Shift` makes it ±10·step. `Home`/`End` are **not** bound | `ffa2e95` |
| G25 | `a` with `allowAuto` | commits `'auto'`; without `allowAuto` the key types | props doc |
| G26 | first focus on a dial with `allowAuto`, not yet auto | a hint appears below the field once per mount and leaves after 3000ms | `handleFocus` |

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

- **Mouse drag from anywhere on the rail.** Native behaviour only. The hysteresis path is
  touch and pen; a mouse click jumps and a mouse drag needs the thumb (or, on the track
  variant, is native tap-and-follow).
- **`Home` / `End` / `PageUp` / `PageDown`** in the field.
- **Vertical wheel to adjust.** Deliberately absent (G33).
- **A tablet profile.** Phone and desktop only (EVAL.md Q2).
- **That the bar glows.** HDR is asserted structurally, not perceptually (EVAL.md Q5).

---

## Other controls

`StopSlider`, `AxisTriplet`, `Icon`, `Collapse` get their own sections here as their
tests are written (EVAL.md step 8). Until then the only promise recorded is that
`AxisTriplet`'s steppers follow G27–G31 by the same CSS, and `StopSlider`'s rail carries
`touch-action: pan-y` with **no** JS direction judgement yet — a phone can scroll over
it, but cannot yet drag it from anywhere. That is a known gap, not a promise.
