# Rubric

The output of a run is not a score. It is a **list of the places the docs were silent** —
every wrong turn is a sentence missing from DIAL.md, GESTURES.md or a JSDoc. Numbers are
kept only so runs can be compared.

| | 2 | 1 | 0 |
| --- | --- | --- | --- |
| T1 builds & renders | both rows, rails visible, tag in `tag` | renders, but tag typed into label or no rail | does not build |
| T1 auto | `allowAuto` on opsz, and it works | auto attempted another way | absent |
| T1 column (R1) | values share one right edge, measured | off by ≤ 2px | broken |
| T2 mechanism | tokens on `:root` (`--accent`) or an unlayered rule | a layered rule that happened to win | edited `shared/`, or an `!important` |
| T2 ink step | used `--ink-quiet` / a `t-*` class | hard-coded an opacity or colour | did not do it |
| T3 placement | `onKeyDown`, beside `a`-for-auto | elsewhere in `AxisSlider.tsx` | a new file or a wrapper |
| T3 spec | a row in GESTURES §3 with the id | mentioned in a comment only | nothing recorded |
| T3 judgement | said `0` is a digit and chose (modifier, empty-field-only, or declined) | did it without noticing | broke typing |

**The deliverable is the "docs were silent" list**, written by the runner after reading
the transcript: each wrong turn, the sentence that would have prevented it, and which
file it belongs in.
