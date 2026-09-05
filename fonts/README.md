# Fonts

Cal Sans 2.000 (a0e1b9d), built in `calbuild`, kept here so the repos that already
track `shared/` get it from one place instead of their own copies. Every house face an
app renders from lives here -- a consumer holding its own copy is the bug, because the
copy is what stops the app noticing this file went stale.

| file | | |
|---|---|---|
| `CalSansVF.ttf` / `.woff2` | full face, six axes | 1545 glyphs, 15 FV |
| `CalSansFlexVF.ttf` / `.woff2` | Flex | 1545 glyphs, 15 FV |
| `CalSans-Bold.woff2` | static instance | 1545 glyphs, 0 FV |

`CalSans-Bold.woff2` reads 0 FeatureVariations and that is correct: it is a static, so
the axes are baked and there is nothing left to condition on. Only the variable faces
are worth running the check below against.


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

To update: rebuild in `calbuild`, copy here, push, bump the submodule pointers.
