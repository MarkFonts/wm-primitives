/* Types for letterbox.js. The engine is authored as plain ES-module JS because two of
 * its call sites are static HTML pages that script-tag it directly (wordmark.nyc, and
 * this repo's system page, which inlines the file); TS consumers get the shape here. */

export interface LetterboxAxis {
  tag: string
  min: number
  max: number
  /** Seconds; the period is `speed * mult`. */
  speed: number
  mult: number
}

/** Tint a seeded share of the glyphs from `ink` toward `signal`. One canvas. */
export interface LetterboxSpeckle {
  /** Fraction of glyphs that ride the effect. Default 1/6. */
  share?: number
  /** Phase groups, so they do not pulse in unison. Default 5. */
  groups?: number
  /** Radians per ms. Default 0.0016, about a 4s cycle. */
  speed?: number
  /** Colour the speckle fades toward. Default: the config's `signal`. */
  to?: string | null
  /** Which canvas it paints on when `layers` is on. Default 'back'. */
  layer?: 'back' | 'front' | 'split'
}

/**
 * Paint every glyph again on front canvases at a group-phased alpha. Only pays where
 * something sits between the layers — over flat ground the front copy is invisible.
 */
export interface LetterboxLayers {
  /** Front canvases, stacked over the back one. */
  front: HTMLCanvasElement[]
  /** Phase groups; the visible share is roughly 1/groups at a time. Default 3. */
  groups?: number
  /** Radians per ms. Default 0.0016. */
  speed?: number
  /** Viewport width below which the split is skipped. Default 0. */
  minWidth?: number
}

export interface LetterboxConfig {
  words?: string[]
  largeFontFamily?: string
  largeWeight?: number
  fillFontFamily?: string
  fillWeight?: number
  /** Fill size in px at the 850px reference width; scales down below it. */
  fillSize?: number
  widthFraction?: number
  verticalPad?: number
  wordGap?: number
  maxWidth?: number
  heroHeightFrac?: number
  topPadVh?: number
  extraTopPad?: number
  extraBottomPad?: number
  minFillSize?: number
  /** Fill text. Default: the Jerome K. Jerome passage exported as `JEROME`. */
  pool?: string | null
  poolRepeat?: number
  /**
   * Animated axes. Canvas 2D has no fontVariationSettings in Chrome and the @font-face
   * descriptor does not reach it either, so an animated axis is rendered as a ladder of
   * FontFaces — one per step — and each frame asks for the nearest rung. The first axis
   * animates. Requires `faceSrc`; without it the axes are inert.
   */
  axes?: LetterboxAxis[]
  /** "url(...)" of the variable font, for building the ladder. */
  faceSrc?: string | null
  /** Rungs across the axis range. Default 14. */
  faceSteps?: number
  /** Pinned font-variation-settings, e.g. "'opsz' 10, 'GEOM' 25". */
  fvs?: string | null
  /** Pinned font-feature-settings, e.g. "'rclt' 1". */
  ffs?: string | null
  /** A custom property name (read live, so themes reach it) or a literal colour. */
  ink?: string
  signal?: string
  inkFallback?: [number, number, number]
  signalFallback?: [number, number, number]
  bleedTop?: number
  /** Custom property the top bleed is read from at init. Default '--lb-bleed'. */
  bleedVar?: string | null
  pointer?: 'window' | 'window-gated' | 'canvas'
  /**
   * 'display-p3' gives the canvas a wide buffer so a P3-scaled token paints as the neon
   * it is. On an sRGB buffer the same colour is clamped back to its hex fallback.
   */
  colorSpace?: 'srgb' | 'display-p3'
  speckle?: LetterboxSpeckle | null
  layers?: LetterboxLayers | null
  autoResize?: boolean
}

export interface LetterboxHandle {
  /** Lay out and start the loop. Safe to call again — that is what resize does. */
  init(): void
  /** Remove every listener, observer and frame this instance registered. */
  destroy(): void
}

export declare const JEROME: string

export declare function createLetterbox(
  canvasEl: HTMLCanvasElement | null,
  config?: LetterboxConfig,
): LetterboxHandle | null
