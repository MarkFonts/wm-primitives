# wm-primitives — what this is for

## The claim

Three products, one vocabulary. A **Glyphs plugin**, a **React proofing page**, and
**wordmark.nyc** should be recognisably the same studio's work — not because someone
remembered to match a color, but because the decision was made once, written down as CSS,
and imported.

That is the whole ambition. It is not a component library.

## Why this system can do something a generic one cannot

Most design systems are typographic tenants: they pick a typeface and arrange it. This one
is a landlord. The typeface is ours, so the system can reach into it:

- **GEOM is a semantic axis, not a style knob.** 0 · 25 · 50 · 100 mean A11y · UI · Base ·
  Geo — a job per landing, not a taste. A string you transcribe is set at 0 because the
  drawing separates `I l 0` there, not because it looks technical.
- **The corners share continuity with the letterforms.** `superellipse(1.2)` is exponent
  2^1.2 ≈ 2.30, so curvature reaches zero where the cap meets the straight edge. The
  typeface was drawn with G2 smoothing; the UI now rounds the same way. A system that did
  not own its typeface could not make that argument.
- **The documentation is a specimen.** The system page's navigation is set in the face it
  documents, and the active chapter shifts GEOM 25 → 100. The doc is not *about* the
  material, it is *made of* it.

## The discipline

Four rules, each of which was learned by getting it wrong first.

1. **One signal per distinction.** Six signals exist — size, case, ink, weight, rule, geom.
   Spending three on one distinction reads as emphasis, not structure. Compensations
   (tracking on caps, optical sizing) are free; signals are budgeted.
2. **The CSS is the source of truth; the page illustrates it.** `type.css`, `corners.css`
   and `space.css` ship, get diffed, and are what the apps load. When the page and the CSS
   disagree, the page is wrong.
3. **Every token carries a literal fallback.** These components render in roots that never
   import the token files. A bare `var()` on a missing token does not fall back to
   something sensible — it collapses the property. Padding goes to 0, and `corner-shape`
   silently becomes a no-op.
4. **Measure the render, never the source.** Every real bug this system has produced was
   invisible in the CSS: a comment that swallowed a selector, CDATA that killed a
   stylesheet, an exclusion list voided by one unparseable vendor pseudo-element. All three
   looked correct in the file and wrong on screen.

## Where it goes

**Near** — finish what is declared but not consumed. The type tokens exist and no
application chrome uses them: ReCal and font-proofer between them hold ~125 literal
`font-size` declarations and zero `var(--type-*-size)`. A rule nobody imports is a
suggestion.

**Then** — one page per parameter. The single long document proves the vocabulary holds
together; it is not where someone lands to answer "what padding goes on a chip?" Each law
earns its own page, with the long form as the index.

**Later** — past CSS. A Glyphs plugin cannot import `space.css`; it needs the same numbers
through a Python surface. `type.ts` already exists for JS consumers. The scale is the
contract, and CSS is only its first runtime.

## What it must not become

A fork of somebody else's kit with our colors swapped in. The COSS board in this repo is
deliberately exempt from our rules — it is a gallery of Pasquale Vitiello's components,
rendered in Cal Sans to prove the face works in real UI micro-typography. It is a specimen,
not a dependency, and nothing in it aligns against our chrome.

The moment this system's answer to a question is "because that is how the popular library
does it," it has stopped being worth maintaining. Every rule here should be traceable to
something true about the typeface, the surface, or the reader.
