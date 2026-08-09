# Fonts

**One Cal Sans file, one repo, two delivery channels.** Built in `calbuild`,
distributed from here.

| consumer | channel |
|---|---|
| ReCal, font-proofer | the `shared/` submodule they already track — `shared/fonts/CalSansVF.ttf` |
| Framer, wordmark.nyc, anything remote | `https://cdn.jsdelivr.net/gh/MarkFonts/wm-primitives@<sha>/fonts/CalSansVF.ttf` |

**Pin the SHA in the URL.** The Framer components currently point at
`calcom/sans@main`, and `@main` is a moving target on a repo we don't cut releases
from — jsDelivr caches it for a day and then silently serves whatever landed. That is
how everything ended up on 1.998 while calbuild was on 1.999. A SHA URL is immutable
and cached forever; changing the font becomes an intentional edit to that one line.

## These are different families, not different versions

Don't flatten them into each other:

- **Cal Sans** — `opsz, GEOM, wght, YTAS, SHRP, ital`, 15 FeatureVariations. The full face.
- **Cal Sans Flex** — same six axes, same 15 FeatureVariations, smaller glyph set.
- **Cal Sans UI** — `wght, GEOM` only, 9 FeatureVariations. A deliberately reduced face
  for interface work and for Framer, which handles a face carrying 20 stylistic sets
  and 42 character variants badly.

A trimmed glyph set or a trimmed feature list is a legitimate build choice, and all
three of the above keep their FeatureVariations intact.

## The one thing that silently breaks

`GSUB` **FeatureVariations** are what drive every GEOM- and opsz-conditioned glyph swap
(11 records on GEOM alone, 4 on GEOM+opsz — all substituting into `rclt`). They are not
user-selectable features, so a subsetter told to keep only the features you asked for
will happily drop them. The result still *looks* correct — every letterform is present —
but the axes stop swapping glyphs, so `a`, `G`, `f`, `j`, `t`, `y` no longer change with
GEOM and the small-optical `a` never appears at all.

Check any subset before shipping it:

```python
from fontTools.ttLib import TTFont
f = TTFont("subset.ttf")
fv = getattr(f["GSUB"].table, "FeatureVariations", None)
print(len(fv.FeatureVariationRecord) if fv else 0)   # Cal Sans / Flex: 15, UI: 9
```

To update: rebuild in `calbuild`, copy here, push, then bump the submodule pointers and
the pinned SHA in the remote consumers.
