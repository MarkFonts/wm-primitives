# The dial — one spec

What `AxisSlider` is, written down once. Companion to `src/AxisSlider.tsx` / `.css`, and
the thing to change *before* the CSS rather than after.

This exists because the control was developed four times in one evening — reserve a slot,
too much right margin, drop the slot, put it back conditionally, break the value column,
uniform slot — and every step was a reaction to a screenshot rather than to a rule. Each
fix was locally right and the sequence was wasted work. The rules below are the ones that
kept getting rediscovered.

---

## 1 · Anatomy

A row is three groups, in this order:

```
[ NAME COLUMN ][ TAG ]                    [ VALUE GROUP ]
  name + auto    opsz                      number unit ⌃⌄
```

| group | holds | sizing |
| --- | --- | --- |
| **name column** | the human label, and the `auto` control if the axis has one | `min-width: var(--axis-label-w, 105px)` — a floor, never a fixed width |
| **tag** | the four-letter axis code | content |
| **value group** | number, unit, stepper | content, right-aligned |

The track is below (`default`) or behind (`track`).

---

## 2 · The four rules that keep getting broken

**R1 — Values form a column.** Every number in a rail shares one right edge. This is the
reason the value is right-aligned at all: a rail is read *down* the right side. No
per-row saving is worth breaking it. *(Broken by making the unit slot conditional: rows
with a unit sat 16px left of rows without.)*

**R2 — Tags form a column.** Every tag in a rail starts at the same x. A rail whose
abbreviations don't line up looks broken even when each row is fine alone. *(Broken by
hanging the `auto` control off the tag, which pushed that row's tag out of line.)*

**R3 — The name is never clipped to hold a column.** `--axis-label-w` is a floor. A row
whose name plus `auto` needs more takes more, and its tag moves with it. Trading a whole
word for five pixels of alignment is the wrong way round. *(Broken by `flex: 0 1 105px`
with `overflow: hidden`, which ellipsised "Optical Size".)*

**R4 — Nothing shifts when the arrows appear.** Whatever space the stepper needs is
either already occupied by something else, or already reserved. *(Broken both ways: hung
arrows overlapped the digits; a reserved-but-empty slot read as a margin.)*

---

## 3 · The value group

```
number   right-aligned, hugs its content (field-sizing: content, min 2ch, max 14ch)
slot     one, uniform, 16px — sits at the right, and IS the bar's right padding
```

**The slot has one occupant at a time.** The unit sits in it at rest; the stepper takes it
on hover and focus, and the unit yields. On a row with no unit it holds the stepper alone
and is otherwise the right margin — which the row needed regardless.

**The slot is uniform, not conditional.** Reserving it only where a unit exists satisfies
R4 and breaks R1. Uniform satisfies both.

**The slot is not extra space.** In `track` the bar gives up its right padding to it: 16px
right against 12px left, not 28px.

**The unit only yields when it is actually handing over.** It faded on hover in rows with
no stepper to hand to, which is just the unit vanishing under the pointer.

### The field

Underline, not a box (`field="underline"`, the default):

| | |
| --- | --- |
| rule | `text-decoration: underline`, thickness 1px, offset 2px |
| why not `border-bottom` | a border is drawn on the padding box — full field width, below the descender. An underline is drawn on the **text**: exactly as wide as the value, offset from the baseline. |
| width | `field-sizing: content` — the rule is the value's own width, so it has to be |
| focus | the number **and** its underline take `--accent`, on `:focus-within` so a drag counts |
| why it matters | focus lives on the text, so it needs to know nothing about box padding or radius |

`field="box"` is the alternative, kept because a dial value in a box is a choice. It is
asked for, never reached in for.

---

## 4 · `auto`

A dot and a word, in the name column beside the name — not next to the tag (R2) and not
in the value group (it cost 34px there and shoved the field over the tag).

| | value | why |
| --- | --- | --- |
| mark | `○` / `●` — Cal Sans `circle` / `uni25CF` | **not** `◦` / `•`: those are drawn at 18% of the em against these at 76%, and `openbullet`'s counter is 90 units — 0.89px at this size, under one device pixel. It fills in and both states render as the same solid dot. |
| word | `AUTO`, caps, 10.5px | caps read larger than lowercase at equal size; at the 11px tag size `AUTO` outweighs the tag it belongs to. Half a pixel is the whole correction. |
| tracking | **off** | deliberate exception to the caps rule — `.12em` pulls a two-part mark apart |
| dot size | `0.7em`, raised `1px` | arithmetic: `AUTO`'s cap centre is 3.78px above the baseline, the glyph centres 2.70px up. 0.7em is the size whose correction lands nearest a whole pixel (0.5em would need 1.85px). |
| colour | `var(--ok, #00a01e)` on, `--text-dim` off | shape changes too, so the state survives greyscale and a colourblind reader |

The `a` key and typing the word still work. The control exists because a keystroke is
unreachable on a phone — no keypad this field raises has letters — and undiscoverable
anywhere.

---

## 5 · The rail supplies the column width

`--axis-label-w` (default 105px) is set by the **rail**, not the component: a component
cannot measure its siblings, and the right width is whatever clears the widest row.

- font-proofer's sidebar: **125px**, and that is a *ceiling* — 227px of row minus the
  widest tag (`GEOM`, 28px), the gaps and the 64px field leaves exactly that.
- 150px puts every tag under the value field.

Arrive at it by measuring the widest row, not by choosing.

---

## 6 · Ownership

**The primitive owns structure, behaviour and the field.** The host themes through
tokens (`--border`, `--radius`, `--accent`, `--bg-elevated`, `--ok`) and chooses through
props (`variant`, `field`). A host selector reaching into the component is a last resort.

`AxisSlider.css` is in `@layer wm.controls`, so an unlayered host rule always wins and no
one has to out-specify anyone. Two consequences that cost an evening:

1. **The host's reset must be layered below it.** A bare `*` or `button` selector in an
   unlayered reset outranks every class rule the primitive writes. font-proofer's
   `* { padding: 0 }` flattened the bar's padding and the slot; `button { color: inherit }`
   beat the `auto` state colour. Both now live in `@layer app.base`.
2. **The `@layer` order statement must be in the first stylesheet evaluated.** A layer's
   position is fixed when it is first *created*. If a component's CSS opens
   `@layer wm.controls` before the statement is read, the statement can no longer move it.
   Import the entry stylesheet before anything that pulls in a primitive.

### Fallbacks

`var(--x, fallback)` — one declaration, fallback **inside** the `var()`. Never two
declarations. The sRGB-then-OKLCH pattern in `color.css` works because an unsupported
*syntax* is dropped at parse time; a `var()` parses fine and fails at *computed-value*
time, and a property invalid at computed-value time does not fall back to the previous
declaration — it **inherits**.

---

## 7 · Variants

| variant | what it is | status |
| --- | --- | --- |
| `default` | label line above, track below | ships |
| `track` | the row **is** the track — label and value inside a bar whose fill is the value | ships |
| `diamond` | rotate-45 marker thumb, for default-editing rails (ReCal's Type Matrix) | ships |
| `skeletal` | thin/minimal, preview rails | ships |

`track` is built from the same DOM: the native range input is stretched over the bar at
zero opacity, so press-anywhere-to-jump, drag and the whole keyboard contract are the
platform's rather than ours to reimplement. The fill is a gradient stop at `--pct`, not an
element — nothing to keep in sync, and it cannot drift from the thumb because there is no
thumb.

Two features live on the range track and must be painted onto the bar in `track`, or they
vanish silently: `lockedAbove` and `reference`.

---

## 8 · Checklist

Any change to the dial gets checked against all of these, at a real width:

- [ ] values share one right edge (R1)
- [ ] tags share one x (R2)
- [ ] no name clipped (R3)
- [ ] nothing moves when the stepper appears (R4)
- [ ] tags off, units off — nothing else disappears with them
- [ ] touch sizing — targets grow, layout holds
- [ ] vertical
- [ ] focus visible on the value, and on the bar in `track`
- [ ] `auto` on and off, and the state readable in greyscale
