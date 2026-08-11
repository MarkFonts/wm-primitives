/* type.ts — the type tokens for the places CSS classes cannot reach.
 *
 * Prefer the `t-*` classes from type.css. This exists for inline styles, canvas
 * measurement and anywhere a size has to be a number rather than a class.
 *
 * Sizes are px here because that is what JS consumers need. type.css declares the same
 * values in rem so they follow the reader's root size; if you set a size from here you
 * have opted out of that, which is fine for canvas and wrong for text.
 */

export const ROLES = {
  micro:   { size: 9,  lead: 1.2,  opsz: null },
  label:   { size: 12, lead: 1.3,  opsz: null },
  ui:      { size: 12, lead: 1.4,  opsz: null },
  body:    { size: 16, lead: 1.55, opsz: null },
  lede:    { size: 18, lead: 1.5,  opsz: null },
  title:   { size: 26, lead: 1.2,  opsz: null },
  display: { size: 45, lead: 1.1,  opsz: null },
} as const

export type Role = keyof typeof ROLES

/** The poster scale. Ratio root-2, so every second step doubles. */
export const POSTER = [48, 68, 96, 136, 192] as const

/** Ink — opacity on the text colour. Three levels, never four. */
export const INK = { full: 1, quiet: 0.62, faint: 0.38 } as const

/** The only tracking value in the system: capitals, and nothing else. */
export const TRACK_CAPS = '.12em'

/**
 * GEOM landings. Round values, each sitting mid-pad — a range the font holds flat, so
 * precision inside one buys nothing while between them the drawing moves fastest.
 * Cal Sans only. `swaps` is where that landing's glyph set actually changes, read off
 * the font's own condition sets.
 */
export const LANDINGS = {
  a11y: { value: 0,   pad: [0, 10]   as const, swaps: ['I', 'l', '0'] },
  ui:   { value: 25,  pad: [16, 34]  as const, swaps: ['a'] },
  base: { value: 50,  pad: [40, 60]  as const, swaps: ['g', 'u', 'f', 't', 'j', 'y'] },
  geo:  { value: 100, pad: [80, 100] as const, swaps: ['C', 'c', 'M', '1', '5', '0'] },
} as const

export type Landing = keyof typeof LANDINGS

/** Inline style for a role. `opsz` is pinned only where type.css pins it. */
export function type(role: Role): React.CSSProperties {
  const r = ROLES[role]
  const style: React.CSSProperties = {
    fontSize: `${r.size / 16}rem`,
    lineHeight: r.lead,
    fontOpticalSizing: r.opsz === null ? 'auto' : 'none',
  }
  if (role === 'label') {
    style.letterSpacing = TRACK_CAPS
    style.textTransform = 'uppercase'
  }
  return style
}

/** `rgba(var(--text-rgb), α)` — the token is comma-separated, so the slash form breaks. */
export const ink = (level: keyof typeof INK) => `rgba(var(--text-rgb), ${INK[level]})`
