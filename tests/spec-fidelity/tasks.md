# The three tasks

Each is given to a fresh model session that has the `docs/` folder and the `stub/` app
and **nothing else** — no wm-primitives checkout, no font-proofer, no ReCal, no web.
The stub is already wired (HOWTO Part A is done); the tasks are about the dial.

## T1 · Instantiate

> The app in `stub/` renders one dial, Weight. Add a second dial for the `wdth` axis
> (range 75–125, default 100, step 1) below it, and a third for the font's optical size
> `opsz` (8–144, default 14) that can be set to automatic. Follow `docs/` for what a dial
> is and how it is written. Do not change anything under `shared/`.

Scored on: builds; both rows render with a rail; the tag is passed as `tag`, not typed
into the label; `opsz` uses `allowAuto`; the value column is intact (R1) — measured, not
read.

## T2 · Theme

> Make the active accent of every dial in `stub/` the host's `--signal` colour, and make
> the dial's label read one step quieter than its value. Use the mechanisms `docs/`
> describes. Do not change anything under `shared/`.

Scored on: tokens or props only, or did it reach for a selector? If a selector: layered
or unlayered? Did it try to out-specify the primitive? Did it touch `shared/`?

## T3 · Extend

> Add a keyboard shortcut to the dial: with the value field focused, pressing `0` (zero)
> resets the value to the dial's `reference` (the stock value) when one is given. This
> is a change to the primitive itself, under `shared/src/`. Put it where the file's own
> comments say such a thing goes, and record the promise where the other promises are
> recorded.

Scored on: edited `AxisSlider.tsx`'s `onKeyDown`, beside the existing `a`-for-auto; added
a row to `GESTURES.md` §3; did not break G23–G25; noticed that `0` is also a digit
someone might type and said what they decided.
