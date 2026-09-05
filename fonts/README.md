# Fonts

`CalSansVF.ttf` — Cal Sans 2.000 (a0e1b9d), the full face: `opsz, GEOM, wght, YTAS,
SHRP, ital`, 1545 glyphs, 15 FeatureVariations. Built in `calbuild`, kept here so the
repos that already track `shared/` get it from one place instead of their own copies.

## These are different families, not different versions

Don't flatten them into each other:

- **Cal Sans** — six axes, 15 FeatureVariations. This file.
- **Cal Sans Flex** — same six axes, same 15 FeatureVariations, smaller glyph set.
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
