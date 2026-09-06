# Fonts

Cal Sans 2.000 (a0e1b9d), built in `calbuild`, kept here so the repos that already
track `shared/` get it from one place instead of their own copies. Every house face an
app renders from lives here -- a consumer holding its own copy is the bug, because the
copy is what stops the app noticing this file went stale.

| file | | |
|---|---|---|
| `CalSansVF.ttf` / `.woff2` | full face, six axes | 1545 glyphs, 15 FV |
| `CalSansFlexVF.ttf` / `.woff2` | Flex | 1545 glyphs, 15 FV |
| `CalSans-Bold.woff2` | **the 2021 Cal Sans, v1.000** | 613 glyphs, 0 FV |

`CalSans-Bold.woff2` is the odd one out and is **not** published by `calbuild --bump`.
It is the original 2021 drawing, kept for font-proofer's before/after page, not a house
face -- so unlike everything else here it must NOT track the current build.

The trap: calbuild can produce a file with exactly this name (a v2 static at GEOM 50 /
opsz 45, 1545 glyphs). It is a different typeface that happens to share a filename.
Publishing it would leave the comparison page showing v2 against v2 and quietly destroy
the only copy of the old drawing. `bump_primitives.DO_NOT_PUBLISH` refuses to, and
raises if anyone puts it back in the publish list.

It reads 0 FeatureVariations because it is a static -- correct, and true of any static.
Only the variable faces are worth running the check below against.


## These are different families, not different versions

Don't flatten them into each other:

- **Cal Sans** — six axes, 15 FeatureVariations. This file.
- **Cal Sans Flex** — the **avar2** build, not a reduced anything. Same 1545 glyphs and
  same 15 FeatureVariations as the full face; what differs is `avar` v2 carrying a
  `VarIdxMap` (the full face has plain v1), and `YTAS` hidden, cross-mapped off `opsz`.
  Built by `calbuild/scripts/lib/build_flex.py`. It is LARGER than the full face --
  1.31MB against 992KB -- because shifting the defaults expands `gvar` by ~292KB and
  `HVAR` by ~16KB. Bigger is expected here and is not a sign of a bad build.
- **Cal Sans UI** — `wght, GEOM` only, 9 FeatureVariations. A deliberately reduced face
  for interface work and for Framer, which handles a face carrying 20 stylistic sets and
  42 character variants badly.

A trimmed glyph set or feature list is a legitimate build choice, and all three keep
their FeatureVariations intact.

## The one thing that silently breaks

`GSUB` **FeatureVariations** drive every GEOM- and opsz-conditioned glyph swap — 11
records on GEOM alone, 4 on GEOM+opsz, all substituting into `rclt`. They aren't
user-selectable features, so a subsetter told to keep only the features you named will
drop them. The result still *looks* right — every letterform is present — but the axes
stop swapping glyphs, so `a`, `G`, `f`, `j`, `t`, `y` no longer change with GEOM and the
small-optical `a` never appears.

Worth checking on anything that has been through a subsetter or an inliner:

```python
from fontTools.ttLib import TTFont
f = TTFont("suspect.ttf")
fv = getattr(f["GSUB"].table, "FeatureVariations", None)
print(len(fv.FeatureVariationRecord) if fv else 0)   # Cal Sans / Flex: 15, UI: 9
```

## Updating

`python -m scripts --bump` in calbuild, after a build. It copies the house faces here,
commits and pushes, which fires `notify.yml` and redeploys the consumers. It refuses if
FeatureVariations did not survive the build, or if this checkout is dirty or off main.
`CalSans-Bold.woff2` is excluded, per above.

`--varonly` stops before the statics, so it warns that any static it would publish is
from an earlier run. Don't hand-copy: the point of the flag is that the version is
guaranteed by git rather than asserted by whoever remembered to drag the file across.
