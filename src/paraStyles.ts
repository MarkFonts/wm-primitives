/* paraStyles.ts — the four paragraph styles, and how one of them becomes fit options.
 *
 * Both paragraph views show the same document: a heading, its subheads, and body text,
 * each editable, each with its own size and leading. The two apps had arrived at the
 * SAME four keys, the same labels, the same numbers, and — after alignment moved into
 * the styles — the same six fields, written out twice in two repos. Two copies of a
 * record agree until one of them is edited.
 *
 * What is here is the part that is genuinely one thing: the keys, their order, their
 * labels, the shared defaults, and the resolver. What is NOT here is anything about the
 * font each app draws with — font-proofer carries axisOverrides / weight / italic /
 * ss04 / ss05 for the family it is proofing, ReCal carries one wght off the instrument.
 * Each app extends the base with its own, which is the difference that is real.
 *
 * The CSS stays with the apps too: font-proofer sets its block rhythm in em off the
 * type, ReCal in px off its stage. Same class name, different measure of the same
 * decision — promoting one would just impose it on the other.
 */
import { fittingMode, type Alignment } from './Fitting'
import type { FitOptions } from './flattersatz'

export type ParaStyleKey = 'h1' | 'h2' | 'h3' | 'p'
export const PARA_STYLE_ORDER: ParaStyleKey[] = ['h1', 'h2', 'h3', 'p']
export const PARA_STYLE_LABEL: Record<ParaStyleKey, string> = {
  h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', p: 'Paragraph',
}

/** What every paragraph style has, whatever the app draws it with. */
export interface ParaStyleBase {
  size: number
  leading: number
  tracking: number
  /* Alignment, the rag and hyphenation are the STYLE's, and inherit nothing — like size
     and leading, and unlike the axes, which cascade from the app's own controls. A
     heading is ranged left and is not hyphenated; justifying the body says nothing about
     the headings above it. The H&J bands those decisions are fitted to stay per FONT. */
  align: Alignment
  swissRag: boolean
  hyphenate: boolean
}

/** The shared core. An app spreads these and adds its own font fields. */
export const PARA_STYLE_DEFAULTS: Record<ParaStyleKey, ParaStyleBase> = {
  h1: { size: 57, leading: 1.1, tracking: 0, align: 'left', swissRag: false, hyphenate: false },
  h2: { size: 32, leading: 1.2, tracking: 0, align: 'left', swissRag: false, hyphenate: false },
  h3: { size: 22, leading: 1.3, tracking: 0, align: 'left', swissRag: false, hyphenate: false },
  p:  { size: 18, leading: 1.6, tracking: 0, align: 'left', swissRag: false, hyphenate: false },
}

/** One style plus the font's bands = what layoutParagraph takes for a block. Both apps
 *  wrote this same object inline the day alignment moved into the styles. */
export function fitOptionsFor(
  style: Pick<ParaStyleBase, 'align' | 'swissRag' | 'hyphenate'>,
  fit: Partial<FitOptions>,
): Partial<FitOptions> {
  return {
    ...fit,
    hyphenate: style.hyphenate,
    mode: fittingMode(style.align, style.swissRag),
    align: style.align,
    center: style.align === 'center',
  }
}
