# What changed, and why

A log of decisions, not of diffs — `git log` already has the diffs. Each entry says what
moved and what it cost, because most of these were reached by getting them wrong first and
the wrong version is the useful part.

Companion to [DIAL.md](DIAL.md) (the dial's layout), [GESTURES.md](GESTURES.md) (what it does
under a pointer), [SLIDERS.md](SLIDERS.md) (the census) and [EVAL.md](EVAL.md) (how it is tested).
Newest first.

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
