/* Types for flattersatz.js. The engine stays plain JS because wordmark.nyc script-tags
   it into a static page (same reason as letterbox.js), so the types live here for the
   TSX consumers — ReCal type-checks with tsc, font-proofer strips with esbuild. */

export type FitMode = 'off' | 'justified' | 'flattersatz'

export interface FitOptions {
  mode: FitMode
  /** flattersatz: how much narrower the odd lines' measure is, in px */
  ragWidth: number
  /** all three are CENTRED: 100 permits nothing, above opens, below tightens */
  tracking: number
  wordSpacing: number
  glyphScaling: number
  /** centred alignment splits a rag's shortfall onto both margins */
  center: boolean
  /** justified only; break points come from rules, not a dictionary */
  hyphenate: boolean
  /** justified only: 'kp' composes the paragraph, 'greedy' is for measuring against it */
  composer: 'kp' | 'greedy'
  firstIndent: number
  indent: number
}

export interface FittedLine {
  text: string
  indentPx: number
  wordSpacingPx: number
  trackingPx: number
  glyphScaling: number
}

export const DEFAULTS: FitOptions
export const SWISS_PRESET: Partial<FitOptions>
export const MIN_MEASURE: number

/** Null when the mode is off, the text is empty, or the element cannot be measured yet. */
export function layoutParagraph(
  text: string,
  reference: HTMLElement,
  opts: Partial<FitOptions>,
  indentPx?: number,
): FittedLine[] | null

export function lineStyle(line: FittedLine): Record<string, string | number | undefined>

/** Fits an element's own text in place and keeps it fitted through resizes; returns a
 *  stop() that disconnects and restores the original text. */
export function applyTo(el: HTMLElement, opts?: Partial<FitOptions>): () => void
