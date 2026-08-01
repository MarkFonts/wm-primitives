# wm-primitives

Shared, cross-app UI primitives for WORDMARK's font tools — **font-proofer** and
**ReCal Sans**. Consumed as a **git submodule** (not a published npm package);
each app's own Vite/tsc compiles the TSX source directly, so there's no build step
here.

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
