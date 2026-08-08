// Glyph-set matching + cmap parsing — shared by ReCal + font-proofer (wm-primitives).
// Categorised character sets plus a cmap parser so a Glyphs scene shows only the
// glyphs the font actually supports. Each app composes its own extra groups /
// alternates on top (ReCal: aalt inventory; font-proofer: PUA + ss04/ss05).

export type CmapRanges = [number, number][]

export type GlyphGroups = Record<string, string[]>

// Base groups common to both apps. Uppercase/Lowercase/Numerals are identical in
// both; Symbols is the superset (includes ⃁, which apps cmap-filter if unsupported).
const UPPERCASE = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ',
  'ẞ',
  ...'ĀĂĄĆĈĊČĎĐĒĔĖĘĚĜĞĠĢĤĦĨĪĬĮİĲĴĶĹĻĽĿŁŃŅŇŊŌŎŐŒŔŖŘŚŜŞŠŢŤŦŨŪŬŮŰŲŴŶŸŹŻŽ',
]
const LOWERCASE = [
  ...'abcdefghijklmnopqrstuvwxyz',
  'ß',
  ...'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
  ...'āăąćĉċčďđēĕėęěĝğġģĥħĩīĭįıĳĵķĸĺļľŀłńņňŉŋōŏőœŕŗřśŝşšţťŧũūŭůűųŵŷźżž',
]
const NUMERALS = [
  ...'0123456789',
  ...'⁰¹²³⁴⁵⁶⁷⁸⁹',
  ...'₀₁₂₃₄₅₆₇₈₉',
  ...'¼½¾⅓⅔⅛⅜⅝⅞',
  ...'ªº',
]
const SYMBOLS = [
  ...'.,:;!¡?¿',
  '"', "'",
  ...'-‒–—…',
  ...'()[]{}',
  ...'/\\|',
  ...'@#%&*+=<>~`^_',
  ...'‘’“”‚„«»‹›',
  ...'©®™°•·¶§¦',
  ...'±×÷≠≈≤≥∞',
  ...'$€£¥¢₩₪₫₿₺₽₹₴₵₱₸₼₾⃁',
]

// Build the standard set map: { All, Uppercase, Lowercase, Numerals, Symbols, ...extra }.
// `extra` groups append after Symbols and fold into the flattened "All".
export function makeGlyphSets(extra: GlyphGroups = {}): GlyphGroups {
  const groups: GlyphGroups = { Uppercase: UPPERCASE, Lowercase: LOWERCASE, Numerals: NUMERALS, Symbols: SYMBOLS, ...extra }
  return { All: Object.values(groups).flat(), ...groups }
}

// Returns merged, sorted [start, end] codepoint ranges the font's cmap supports, or
// null if none found. Handles cmap formats 0, 4, 6, 12 (TTF/OTF only — not woff2).
export function parseCmapRanges(ab: ArrayBuffer): CmapRanges | null {
  try {
    const data = new DataView(ab)
    const numTables = data.getUint16(4)
    let cmapOffset = 0
    for (let i = 0; i < numTables; i++) {
      const t = String.fromCharCode(
        data.getUint8(12 + i * 16), data.getUint8(13 + i * 16),
        data.getUint8(14 + i * 16), data.getUint8(15 + i * 16),
      )
      if (t === 'cmap') { cmapOffset = data.getUint32(12 + i * 16 + 8); break }
    }
    if (!cmapOffset) return null
    const numSub = data.getUint16(cmapOffset + 2)
    const subOffsets: number[] = []
    for (let i = 0; i < numSub; i++) subOffsets.push(cmapOffset + data.getUint32(cmapOffset + 4 + i * 8 + 4))
    const cps = new Set<number>()
    for (const off of subOffsets) {
      const format = data.getUint16(off)
      if (format === 0) {
        for (let c = 0; c < 256; c++) if (data.getUint8(off + 6 + c) !== 0) cps.add(c)
      } else if (format === 4) {
        const segX2 = data.getUint16(off + 6)
        const endBase = off + 14, startBase = endBase + segX2 + 2
        const deltaBase = startBase + segX2, rangeBase = deltaBase + segX2
        for (let s = 0; s < segX2 / 2; s++) {
          const end = data.getUint16(endBase + s * 2), start = data.getUint16(startBase + s * 2)
          const delta = data.getInt16(deltaBase + s * 2), ro = data.getUint16(rangeBase + s * 2)
          if (start === 0xFFFF) continue
          for (let c = start; c <= end && c !== 0xFFFF; c++) {
            let g
            if (ro === 0) g = (c + delta) & 0xFFFF
            else { g = data.getUint16(rangeBase + s * 2 + ro + (c - start) * 2); if (g !== 0) g = (g + delta) & 0xFFFF }
            if (g !== 0) cps.add(c)
          }
        }
      } else if (format === 6) {
        const first = data.getUint16(off + 6), count = data.getUint16(off + 8)
        for (let i = 0; i < count; i++) if (data.getUint16(off + 10 + i * 2) !== 0) cps.add(first + i)
      } else if (format === 12) {
        const nGroups = data.getUint32(off + 12)
        for (let gi = 0; gi < nGroups; gi++) {
          const g = off + 16 + gi * 12
          const startC = data.getUint32(g), endC = data.getUint32(g + 4), startGID = data.getUint32(g + 8)
          for (let c = startC; c <= endC; c++) if (startGID + (c - startC) !== 0) cps.add(c)
        }
      }
    }
    if (cps.size === 0) return null
    const sorted = Array.from(cps).sort((a, b) => a - b)
    const ranges: CmapRanges = []
    let s = sorted[0], p = sorted[0]
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === p + 1) { p = sorted[i]; continue }
      ranges.push([s, p]); s = p = sorted[i]
    }
    ranges.push([s, p])
    return ranges
  } catch { return null }
}

// null ranges = font not yet parsed → show everything. `combining` reads the mark
// after a leading dotted-circle (◌X), for sets that render marks on a base.
export function isSupported(glyph: string, ranges: CmapRanges | null, combining = false): boolean {
  if (!ranges) return true
  const cp = glyph.codePointAt(combining ? 1 : 0)
  if (cp === undefined) return false
  for (const [s, e] of ranges) if (cp >= s && cp <= e) return true
  return false
}

// Enumerate EVERY encoded codepoint in the font's cmap as displayable cell strings —
// the true "All" for an arbitrary font (curated groups are hand-picked subsets).
// Controls/space-likes are skipped; combining marks ride a dotted circle.
export function enumerateCmap(ranges: CmapRanges): string[] {
  const out: string[] = []
  for (const [s, e] of ranges) {
    for (let cp = s; cp <= e; cp++) {
      if (cp < 0x21) continue                    // controls + space
      if (cp >= 0x7f && cp <= 0xa0) continue     // C1 controls + NBSP
      if (cp >= 0x2000 && cp <= 0x200f) continue // spaces + joiners/marks
      if (cp >= 0xd800 && cp <= 0xdfff) continue // surrogates
      if (cp === 0xfeff || cp === 0x25cc) continue
      const raw = String.fromCodePoint(cp)
      out.push(/\p{Mn}/u.test(raw) ? '\u25cc' + raw : raw)
    }
  }
  return out
}
