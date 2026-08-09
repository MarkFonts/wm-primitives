# Fonts

**`CalSansVF.ttf` is the single source of truth for Cal Sans across every WORDMARK
project.** Built in `calbuild`, distributed from here.

Consumers get it through the existing `shared/` submodule, so a font update is the same
one-line flow as any other primitive change: bump the pointer, and the deploy chain
rebuilds both apps.

- **Don't copy this file into an app repo.** A checked-in copy is a version that drifts.
- **Subsetting is fine — verify it afterwards.** Payload-shaped subsets (Framer embeds,
  a proof page, a landing page) are a legitimate build step. The trap is that the usual
  subsetters drop `GSUB` **FeatureVariations**, and those drive every GEOM and
  opsz-conditioned glyph swap in Cal Sans. A subset that lost them still *looks* right —
  the letterforms are all there — but the axes stop swapping glyphs, so `a`, `G`, `f`,
  `j`, `t`, `y` never change with GEOM and the small-optical `a` never appears.

  Check any subset before shipping it:

  ```python
  from fontTools.ttLib import TTFont
  f = TTFont("subset.ttf")
  fv = getattr(f["GSUB"].table, "FeatureVariations", None)
  print(len(fv.FeatureVariationRecord) if fv else 0, "should be 15")
  ```

- To update: rebuild in `calbuild`, copy the result here, push, bump the consumers.

Audited 2026-08-07: 18 copies existed across the projects on two different versions —
everything deployed was on 1.998 while calbuild had 1.999 — and two were subsets that
had silently lost their FeatureVariations.
