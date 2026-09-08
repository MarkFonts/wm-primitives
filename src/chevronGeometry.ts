// The house chevron's geometry, as numbers rather than as copies of a path.
//
// Named chevronGeometry and not chevron because Chevron.tsx sits beside it, and macOS is
// case-insensitive: `./src/Chevron` resolved to this file and the build failed with
// "Chevron is not exported". A name collision that only exists on some filesystems is
// worth spending a longer name to avoid.
//
// There are three chevrons on screen at once in font-proofer -- the sidebar's
// arrow_back_ios_new, a menu's keyboard_arrow_down, and a dial's stepper -- and until now
// the first two were Material Symbols while the third was a hand-stroked SVG with round
// caps. Round against flat is the difference you actually see: Material Symbols are
// FILLED SHAPES with flat-cut ends and mitred corners, not strokes, so a rounded stroke
// beside one reads as a softer, lighter mark even at identical weight.
//
// They are allowed to differ in SIZE -- a 7px gutter between three number fields is not a
// 20px sidebar control, and pretending otherwise is how the triplet's chevron ended up
// squeezed. What they may not differ in is weight and ending.
//
// STROKE LIVES IN chevron.css, not here: it has to answer :hover, and an SVG attribute
// takes neither var() nor a pseudo-class. The number below is the resting value and is
// kept for anything that needs it in JS -- the stylesheet states the same 1.5 as the
// fallback of --chevron-stroke. Two places for one number is the cost of a stroke that
// moves; they are three lines apart in the same commit rather than in two repos.
/* THE STROKE SCALES WITH THE MARK, sub-linearly, which is optical sizing by another name.
 * At one absolute stroke for every size, a 7px chevron and a 12px one do not read as the
 * same weight: the small one carries more ink per unit of mark and looks heavier, which
 * is exactly what type's opsz axis exists to correct. Linear scaling overcorrects the
 * other way -- the small mark thins until it disappears -- so the exponent is 0.5.
 *
 *   7 wide -> 0.96    10 -> 1.15 (the reference)    12 -> 1.26    20 -> 1.63
 *
 * Reference is the dial stepper, because that is the chevron beside a number and the one
 * that has to be right; everything else is fitted to it. */
const REF_W = 10
const REF_STROKE = 1.15
export function strokeFor(width: number) {
  return Math.round(REF_STROKE * Math.pow(width / REF_W, 0.5) * 100) / 100
}

export const CHEVRON = {
  /* 1.15, and it is MEASURED rather than chosen. Rasterised both chevrons at 10x
     supersample and divided ink area by arm length -- angle-independent, unlike reading a
     scanline, which reports thickness / cos(angle) and so flatters whichever chevron is
     steeper. Material's keyboard_arrow_down at 20px / wght 300 comes out at an effective
     1.02px; a 1.5 lineWidth came out at 1.34, i.e. 31% heavier, which is exactly the
     mismatch you see when the two sit in one panel. 1.15 lands on Material's weight. */
  stroke: 1.15,
  /* Round caps, mitred corner -- and flat caps were tried in between, so here is why it
     is back. `butt` cuts each cap perpendicular to its own ARM, so on a 34.6-degree
     chevron the ends come out cut at 34.6 degrees rather than vertically: a filled
     Material glyph cuts them on the horizontal, which a stroked path cannot be told to
     do. What you get is a slight bevel at each tip, not the clean square end that made
     flat look right on paper.
     The corner is a separate decision and stays mitred: a round join blunts the apex into
     an arc that, at a 1.15 stroke on a 10px mark, is most of the corner. */
  cap: 'round' as const,
  join: 'miter' as const,
  /** A mitre on a 34.6-degree apex extends ~1.6x the stroke; 4 clears it without letting
   *  a shallower chevron spike if SLOPE is ever lowered. */
  miterLimit: 4,
}

/** THE HOUSE ANGLE, as a slope: rise over run of one arm.
 *
 *  Taken from the dial stepper -- the chevron that sits beside a number and is the one
 *  that has to be right -- where a 10-wide box put the arms at 0.69, about 35 degrees.
 *
 *  It is a constant because the alternative was deriving the apex from the box HEIGHT,
 *  which is what this did first, and that quietly gave every differently-shaped box a
 *  different chevron: the slider's 10x6 came out at 34.6 degrees and the triplet's 7x6 at
 *  47.8. Two chevrons in one panel, same stroke, same caps, visibly not the same mark.
 *  Sizes may differ -- a 7px gutter between three number fields is not a 20px control --
 *  but the angle may not. */
const SLOPE = 0.69

/** The path for one chevron. `dir` 1 points up, -1 points down.
 *  `w` and `h` are the box; the drawing takes the width, derives its height from SLOPE,
 *  and centres in whatever height it is given. So a caller picks a size and gets the same
 *  mark, not a differently-proportioned one. */
export function chevronPath(dir: 1 | -1, w: number, h: number, inset = 1) {
  const x0 = inset, x1 = w / 2, x2 = w - inset
  const rise = (x1 - x0) * SLOPE
  const midY = h / 2
  const yNear = midY - rise / 2
  const yFar = midY + rise / 2
  return dir > 0
    ? `M${x0} ${round(yFar)} ${x1} ${round(yNear)} ${x2} ${round(yFar)}`
    : `M${x0} ${round(yNear)} ${x1} ${round(yFar)} ${x2} ${round(yNear)}`
}

/* Two decimals: a path string is markup, and 1.7399999999999998 is noise in the DOM. */
const round = (n: number) => Math.round(n * 100) / 100
