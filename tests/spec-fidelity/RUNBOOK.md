# Spec-fidelity run — RUNBOOK

EVAL.md §5. A fresh model, given only the docs, builds three things. The deliverable is
the list of places the docs were silent. Written so a Claude session with no other
context — after a compaction, or a year from now — can run it.

## 1 · Prepare one directory per model

```bash
node tests/spec-fidelity/prepare.mjs /tmp/sf/<date>-<model>
```

It copies the stub, clones **this commit** into `stub/shared`, installs, and puts into
`docs/` only what the model may read: DIAL.md, GESTURES.md, TYPOGRAPHY.md, SLIDERS.md,
the `AxisSliderProps` JSDoc, and the `AxisSlider.css` header. Nothing else in the repo.

## 2 · Run each model

One fresh session per model (three models: the current small, mid and large Claude).
Give it this, verbatim, with the path filled in:

> You are working in `<dir>`. Read `tasks.md`, then do T1, T2 and T3 in order. You may
> read only `docs/` and `stub/`; treat `stub/shared/` as read-only except where a task
> says otherwise. Do not search the web and do not look outside `<dir>`. When done, write
> `NOTES.md` in `<dir>`: for each task, what you did, what you were unsure about, and
> which sentence in `docs/` you wished had existed.

In Claude Code that is one `Agent` call per model with `model` set; the agent's
`NOTES.md` is its transcript's honest half.

## 3 · Score

```bash
node tests/spec-fidelity/score.mjs /tmp/sf/<date>-<model>
```

Builds the stub, screenshots it, measures R1, and greps the diffs for the mechanical
rubric rows. The judgement rows (T2 mechanism, T3 judgement) are read from `NOTES.md`
and the diff by a person — or by the session running this book, which is fine, as long
as it says which.

## 4 · Write the result

`tests/spec-fidelity/results/<date>.md`: the rubric table per model, then **the list**:
each wrong turn, the sentence that would have prevented it, and the file it belongs in.
Then put those sentences in those files. That is the whole point.

## What this is not

Not a benchmark. Three models, one run each, on a control that changed last week. The
numbers exist to compare *this* run to the *last* one; the prose is the deliverable.
