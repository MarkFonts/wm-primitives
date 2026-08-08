// Lazy glyph-name lookup for GlyphPicker's `names` prop. The generated data
// (gen-glyph-names.mjs) is chunked into 2048-codepoint pages; loadNamePages()
// dynamically imports ONLY the pages the given codepoints touch — a Latin font
// pulls a few KB, never the whole 40k-name dataset. CJK unified ideographs and
// Hangul syllables aren't in the data at all: their official names are
// algorithmic and computed here for free.
import { NAME_PAGES } from './glyphNames/pages'

export type GlyphNamePair = { nice?: string; uni?: string }

const pageModules = import.meta.glob<{ default: [number, string | 0, string | 0][] }>('./glyphNames/page-*.ts')
const loadedPages = new Map<number, Promise<[number, string | 0, string | 0][]>>()

function loadPage(p: number) {
  let promise = loadedPages.get(p)
  if (!promise) {
    const loader = pageModules[`./glyphNames/page-${p}.ts`]
    promise = loader ? loader().then(m => m.default) : Promise.resolve([])
    loadedPages.set(p, promise)
  }
  return promise
}

/** Load the name pages covering `cps`; resolves to a cp → [nice, uni] map. */
export async function loadNamePages(cps: Iterable<number>): Promise<Map<number, [string | 0, string | 0]>> {
  const pages = new Set<number>()
  for (const cp of cps) {
    const p = cp >> 11
    if (NAME_PAGES.has(p)) pages.add(p)
  }
  const out = new Map<number, [string | 0, string | 0]>()
  await Promise.all([...pages].map(async p => {
    for (const [cp, nice, uni] of await loadPage(p)) out.set(cp, [nice, uni])
  }))
  return out
}

// ── Algorithmic official names (excluded from the generated data on purpose) ──
const HANGUL_L = 'G,GG,N,D,DD,R,M,B,BB,S,SS,,J,JJ,C,K,T,P,H'.split(',')
const HANGUL_V = 'A,AE,YA,YAE,EO,E,YEO,YE,O,WA,WAE,OE,YO,U,WEO,WE,WI,YU,EU,YI,I'.split(',')
const HANGUL_T = ',G,GG,GS,N,NJ,NH,D,L,LG,LM,LB,LS,LT,LP,LH,M,B,BS,S,SS,NG,J,C,K,T,P,H'.split(',')

export function algorithmicName(cp: number): string | undefined {
  const hx = cp.toString(16).toUpperCase().padStart(4, '0')
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x20000 && cp <= 0x2a6df) || (cp >= 0x2a700 && cp <= 0x2ebef)) {
    return `CJK UNIFIED IDEOGRAPH-${hx}`
  }
  if (cp >= 0xac00 && cp <= 0xd7a3) {
    const i = cp - 0xac00
    return `HANGUL SYLLABLE ${HANGUL_L[Math.floor(i / 588)]}${HANGUL_V[Math.floor((i % 588) / 28)]}${HANGUL_T[i % 28]}`
  }
  if (cp >= 0xf900 && cp <= 0xfaff) return `CJK COMPATIBILITY IDEOGRAPH-${hx}`
  if (cp >= 0xe000 && cp <= 0xf8ff) return `PRIVATE USE-${hx}`
  return undefined
}
