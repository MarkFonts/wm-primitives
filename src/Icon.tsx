// Icon — one mark, drawn by a variable font rather than a drawing.
//
// WHY A FONT AND NOT SVG. Every icon in this system was an inlined SVG, in three
// unrelated vocabularies (SLIDERS.md counts them). A drawing is fixed: it has one weight,
// one optical size, and one relationship to the ink around it. Material Symbols is a
// variable font with `opsz`, `wght`, `GRAD` and `FILL`, which means the mark can do what
// the type beside it already does -- get heavier on hover, hold its stroke at 16px, and
// stop blooming on a dark ground. None of that is reachable from a <path>.
//
// THE HOST LOADS THE FONT. This component does not fetch anything. The app adds the
// Google Fonts link (or self-hosts the same file) with the four axes:
//
//   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
//
// Trimming that axis list is how you silently lose the hover weight: an axis absent from
// the URL is absent from the file, and font-variation-settings on a missing axis is not
// an error, it just does nothing.
//
// NO BOX. An icon here is a mark, not a button face. Nothing draws a border, a fill or a
// radius around it. The hit target, where one is needed, comes from padding on whatever
// wraps it -- see icon.css. A 28px bordered square around a 14px mark was the old answer
// and it made a rail of five read as five buttons rather than one row of marks.
import type { CSSProperties } from 'react'
import './icon.css'

export interface IconProps {
  /** Material Symbols ligature name — "format_align_left", "reset_settings". Not a path. */
  name: string
  /** Ink and weight together. `off` is a control that cannot act right now, not one that
   *  is merely unselected: unselected is `rest`. */
  state?: 'off' | 'rest' | 'active'
  /** px. Sets font-size AND opsz, because the two must agree -- an icon rendered at 16px
   *  with opsz 24 is drawn for a size it is not being shown at, which is the whole reason
   *  the axis exists. Clamped to the axis range (20–48) for opsz; the glyph still scales. */
  size?: number
  /** Solid rather than outlined. Reads as "on" in the way a filled dot does. */
  filled?: boolean
  /** Screen-reader name. Omit only when an adjacent text label already says it, in which
   *  case the mark is decorative and is hidden. */
  label?: string
  className?: string
  /** Escape hatch for per-instance custom properties -- `--icon-dur` for a confirm that
   *  needs to be slower than a hover. Merged UNDER the computed axis values, so it can
   *  add but never silently break opsz/FILL. */
  style?: CSSProperties
}

/* opsz is 20..48 in the shipped file. A mark set at 12px still renders -- it is just
   drawn with the 20px correction, which is the closest the font has. Clamping here rather
   than passing 12 through keeps font-variation-settings valid instead of silently
   ignored. */
const OPSZ_MIN = 20
const OPSZ_MAX = 48

export function Icon({ name, state = 'rest', size = 20, filled, label, className, style }: IconProps) {
  const opsz = Math.min(OPSZ_MAX, Math.max(OPSZ_MIN, size))
  return (
    <span
      className={`wm-icon material-symbols-outlined wm-icon--${state}${className ? ' ' + className : ''}`}
      style={{
        ...style,
        fontSize: `${size}px`,
        // Only the axes that vary per instance. wght and GRAD are stated in CSS so a
        // :hover rule can move them -- an inline style would win over the hover and the
        // emphasis would never arrive.
        ['--icon-opsz' as string]: String(opsz),
        ['--icon-fill' as string]: filled ? '1' : '0',
      }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      /* translate="no": the ligature name IS the glyph. A page translator that renders
         "format_align_left" into another language turns the icon into that literal text. */
      translate="no"
    >
      {name}
    </span>
  )
}
