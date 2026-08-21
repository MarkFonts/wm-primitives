/* Types for flattersatz.js. The engine stays plain JS because wordmark.nyc script-tags
   it into a static page (same reason as letterbox.js), so the types live here for the
   TSX consumers — ReCal type-checks with tsc, font-proofer strips with esbuild. */

export type FitMode = 'off' | 'justified' | 'flattersatz'

/** min/desired/max in percent of natural. A number is the legacy single knob. */
export interface Band { min: number; desired: number; max: number }
export type Budget = Band | number

export interface FitOptions {
  mode: FitMode
  /** flattersatz: how much narrower the odd lines' measure is, in px */
  ragWidth: number
  /** Each budget is a band in percent of natural. A plain number is still accepted and
   *  still means the old single knob: below 100 a floor, above 100 a cap. */
  tracking: Budget
  wordSpacing: Budget
  /** Expansion. Moves the font's own `wdth` axis when it has one, scaleX when it does
   *  not — see widthAxis. Off (100/100/100) unless asked for. */
  glyphScaling: Budget
  /** flattersatz only: a rag spends nothing unless this is on. The band is the design. */
  budgets: boolean
  /** flattersatz only, and separate from the bands above on purpose: the rag's knobs
   *  must not re-set the justified paragraphs in the same proof. */
  rag: { tracking: number; wordSpacing: number; glyphScaling: number }
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
  /** Present only when expansion moved a real width axis: the block's own
   *  font-variation-settings with `wdth` replaced. */
  fvs?: string
}

export const DEFAULTS: FitOptions
export const SWISS_PRESET: Partial<FitOptions>
export const MIN_MEASURE: number
export const INERT: Band

/** Normalises a Budget to a Band. */
export function band(v: Budget | null | undefined): Band
/** The three bands actually in force — all INERT for a rag that has not opted in. */
export function budgetsOf(limits: Partial<FitOptions>): { wordSpacing: Band; tracking: Band; glyphScaling: Band }
/** True when the measured style has a live `wdth` axis, i.e. expansion can be Zapf's
 *  rather than a scaleX. Detected by measuring, so it needs no fvar parsing. */
export function widthAxis(m: unknown): boolean

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
