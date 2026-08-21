/* specimen.ts — long public-domain texts, authored whole and served in pieces.
 *
 * A work lives in ONE file, `specimens/<slug>.txt`, where it can be read and edited.
 * `scripts/build-specimens.mjs` splits it on its FORM FEED breaks into
 * `specimens/<slug>/00.txt`, `01.txt`, … and this fetches only as far as the reader has
 * asked. A proof should not pull a novel across the wire to show two chapters.
 *
 * Vite resolves the glob to hashed URLs at build time, which is why nothing here knows
 * about base paths or `public/` — both apps deploy under different bases and neither has
 * to care. `?url` keeps the text OUT of the bundle: only the addresses are eager.
 *
 * Edits made to loaded blocks are the app's business and deliberately nothing to do with
 * this file: renavigating re-fetches the chunk, so a reader's italics and typing are
 * real while they are there and gone when they come back. That is the intent, not a
 * limitation — a specimen is not a document.
 */

export type SpecimenBlock = { type: 'h1' | 'h2' | 'p'; text: string }

const FILES = import.meta.glob('../specimens/*/*.txt', {
  query: '?url', import: 'default', eager: true,
}) as Record<string, string>

const BY_SLUG: Record<string, string[]> = {}
for (const path of Object.keys(FILES).sort()) {
  const m = path.match(/specimens\/([^/]+)\/(\d+)\.txt$/)
  if (m) (BY_SLUG[m[1]] ||= []).push(FILES[path])
}

/** Slugs the build found, so an app can list what it has without hardcoding titles. */
export const SPECIMENS = Object.keys(BY_SLUG)

/** How many chunks this work has — i.e. how many times "read more" can be pressed. */
export function specimenChunks(slug: string): number {
  return BY_SLUG[slug]?.length ?? 0
}

/** Blank line separates blocks; `# ` is an h1 and `## ` an h2. Deliberately the smallest
 *  format that carries a chapter heading — anything richer and the specimen becomes a
 *  document format nobody asked for. */
export function parseSpecimen(text: string): SpecimenBlock[] {
  return text
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(b =>
      b.startsWith('## ') ? { type: 'h2' as const, text: b.slice(3).trim() } :
      b.startsWith('# ')  ? { type: 'h1' as const, text: b.slice(2).trim() } :
                            { type: 'p'  as const, text: b.replace(/\n/g, ' ') })
}

/** One chunk, parsed. Empty when the work or the chunk does not exist. */
export async function loadSpecimen(slug: string, index: number): Promise<SpecimenBlock[]> {
  const url = BY_SLUG[slug]?.[index]
  if (!url) return []
  const res = await fetch(url)
  if (!res.ok) return []
  return parseSpecimen(await res.text())
}
