/* Types for flattersatz.js. The engine stays plain JS because wordmark.nyc script-tags
   it into a static page (same reason as letterbox.js), so the types live here for the
   TSX consumers — ReCal type-checks with tsc, font-proofer strips with esbuild. */

export type FitMode = 'off' | 'plain' | 'justified' | 'flattersatz'

/** A stretch of text sharing one emphasis. `value` is accepted as well as `text`,
 *  because that is the shape splitInlineMarkup already emits. */
export interface Run { type: string; text?: string; value?: string }

/** CSS applied to a run when measuring AND when drawing it — the two must match.
 *  Deliberately an object rather than a string map: React's CSSProperties has optional
 *  properties, not an index signature, so a stricter type here rejects the very thing
 *  every caller passes. The engine only ever Object.assigns it onto the probe. */
export type RunStyles = Partial<Record<string, object>>

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
  /** Which edge is flush — the only edge a hanging character can straighten. Left and
   *  justified hang left, right hangs right, centred hangs nowhere. */
  align: 'left' | 'center' | 'right' | 'justify'
  /** centred alignment splits a rag's shortfall onto both margins */
  center: boolean
  /** justified only; break points come from rules, not a dictionary */
  hyphenate: boolean
  /** The widow killer: the space before a paragraph's final word stops being a legal
   *  break, so the last word cannot stand alone on a line. Default true. */
  keepLastWord: boolean
  /** protrusion: a hanging character hangs its own measured width. Default true. */
  hang: boolean
  /** How this app draws bold/italic/underline, so runs are measured in the face they
   *  are set in. Omit and every run measures roman. */
  runStyles: RunStyles
  /** justified only. 'paragraph' scores every break against every other; 'single-line'
   *  fills each line and moves on. Not exposed — it exists to measure one against the
   *  other. A rag is always single-line, because stopping short is the design. */
  composer: 'paragraph' | 'single-line'
  firstIndent: number
  indent: number
}

export interface FittedLine {
  text: string
  indentPx: number
  wordSpacingPx: number
  trackingPx: number
  glyphScaling: number
  /** The line's emphasis runs, in order. Concatenating their text gives `text`. */
  runs?: { type: string; text: string }[]
  /** Right-aligned only: how far the trailing character hangs past the right margin.
   *  Emitted as a negative margin-right, because a right-aligned line is positioned by
   *  that edge and extra width alone would not move it. */
  hangRightPx?: number
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
  input: string | readonly Run[],
  reference: HTMLElement,
  opts: Partial<FitOptions>,
  indentPx?: number,
): FittedLine[] | null

export function lineStyle(line: FittedLine): Record<string, string | number | undefined>

/** Fits an element's own text in place and keeps it fitted through resizes; returns a
 *  stop() that disconnects and restores the original text. */
export function applyTo(el: HTMLElement, opts?: Partial<FitOptions>): () => void
