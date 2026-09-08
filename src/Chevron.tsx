// Chevron — the house chevron as a component, for every chevron that is not big enough
// to be a Material Symbol.
//
// WHY THIS EXISTS RATHER THAN keyboard_arrow_down. Material Symbols' chevron has flat,
// square-cut ends; ours is a stroked path with round caps. Set one beside the other and
// the difference is immediate, and it cannot be argued away by matching weight -- which
// was measured and matched, and did not help.
//
// So one of them has to win, and it is this one, for a reason that is not taste: Material
// Symbols' opsz axis bottoms out at 20. A dial's stepper is 6px tall and a triplet's is 7.
// Asking a glyph drawn for 20px to be the mark in a 6px slot gets you the 20px drawing
// scaled down -- the stroke thins with it, which is exactly the problem redrawing the
// triplet's chevron narrower was solving. A stroked path has no such floor.
//
// Material stays for everything that is a SYMBOL rather than a chevron: format_align_*,
// the pilcrow, reset, the theme marks. Those have no size floor problem because they are
// never asked to be 6px.
import { CHEVRON, chevronPath, strokeFor } from './chevronGeometry'
import './chevron.css'

export interface ChevronProps {
  /** 1 points up, -1 points down. Left/right are this rotated, per `dir` + CSS. */
  dir?: 1 | -1
  /** Box, in px. The drawing scales; the STROKE does not, which is the point. */
  width?: number
  height?: number
  className?: string
}

export function Chevron({ dir = -1, width = 10, height = 6, className }: ChevronProps) {
  return (
    <svg
      className={`wm-chevron${className ? ' ' + className : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      /* The stroke rides on a custom property rather than the attribute so :hover can
         scale it -- see chevron.css. Derived from the width, not fixed, so a 7px mark and
         a 12px one read as the same weight. */
      style={{ ['--chevron-stroke' as string]: String(strokeFor(width)) }}
      strokeLinecap={CHEVRON.cap}
      strokeLinejoin={CHEVRON.join}
      strokeMiterlimit={CHEVRON.miterLimit}
      aria-hidden="true"
    >
      <path d={chevronPath(dir, width, height)} />
    </svg>
  )
}

export default Chevron
