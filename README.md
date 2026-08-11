# wm-primitives

**→ [The system, illustrated](https://markfonts.github.io/wm-primitives/)** — type,
corners, circles, space, and color, with every rule shown as live CSS rather than a
screenshot. Source and build in [`docs/system/`](docs/system/README.md).

Shared, cross-app UI primitives for WORDMARK's font tools — **font-proofer** and
**ReCal Sans**. Consumed as a **git submodule** (not a published npm package);
each app's own Vite/tsc compiles the TSX source directly, so there's no build step
here.

The rules live in the CSS, not in the page: `src/type.css` (roles, inks, signals),
`src/corners.css` (the corner law and its circle exclusions), `src/space.css` (the
`--pad-*` scale, the cap rule, the alignment rule). If the page and the CSS disagree,
the CSS is right.

## Contents

- **`StyleScopeList` / `StyleScopeDropdown`** — the named-style / scope picker
  (rows + label + spec chips, single- or multi-select). Token-based CSS bridges to
  each app's theme via `var(--…)` fallbacks. A `.ssd-list--dense` variant keeps
  many-chip rows compact.

## Use

```ts
import { StyleScopeList } from '@markfonts/wm-primitives'
```

The component imports its own CSS, so no separate stylesheet import is needed.

## Design rules

- **Font identity only** — props carry font family/axes, never proofing size.
- **Token-based** styling with fallbacks: `var(--surface-2, var(--bg-elevated))`.
- **Typed TSX** so ReCal's `tsc` type-checks it and font-proofer's esbuild strips types.
