# Fonts

**`CalSansVF.ttf` is the single source of truth for Cal Sans across every WORDMARK
project.** Built in `calbuild`, distributed from here.

Consumers get it through the existing `shared/` submodule, so a font update is the
same one-line flow as any other primitive change: bump the pointer, and the deploy
chain rebuilds both apps.

- **Never** copy this file into an app repo. A copy is a version that will drift.
- **Never** subset it in a consumer. If a surface needs a subset, that is a build-step
  concern and the subset must be generated from this file, not hand-made — a subset
  silently loses `GSUB` FeatureVariations, which is what drives every GEOM and
  opsz-conditioned glyph swap. A subsetted Cal Sans looks correct and behaves wrong.
- To update: rebuild in `calbuild`, copy the result here, push, bump the consumers.

Audited 2026-08-07: 18 copies of this file existed across the projects, on two
different versions, two of them subsetted. That is what this directory replaces.
