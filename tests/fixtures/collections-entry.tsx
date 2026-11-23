/* The collections fixture (tests/behaviour/collections.spec.ts): StyleScopeDropdown,
   StyleScopeList in both modes, and GlyphPicker over EVERY codepoint Cal Sans encodes --
   the real size of the set, so the Tab-count and render-cost numbers mean something.
   Bundled by tests/build-fixture.mjs into tests/fixtures/.build/ (gitignored). */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import StyleScopeDropdown, { StyleScopeList, type ScopeRow } from '../../src/StyleScopeDropdown'
import { GlyphPicker } from '../../src/GlyphPicker'
import { makeGlyphSets, parseCmapRanges, enumerateCmap } from '../../src/glyphset'

declare global { interface Window { log: unknown[]; ready: boolean; mountMs: number; cellCount: number } }
window.log = []

const STYLES = ['Display', 'Title', 'Heading', 'Body', 'Caption', 'Micro']

function Single() {
  const [sel, setSel] = useState('Body')
  const rows: ScopeRow[] = STYLES.map(s => ({ id: s, label: s, chips: [{ text: '16px', kind: 'size' }], selected: s === sel }))
  return (
    <div id="dd">
      <StyleScopeDropdown rows={rows} buttonLabel={sel}
        onSelect={(id, e) => { window.log.push(['dd', id, e.type]); setSel(id) }} />
    </div>
  )
}

function Multi() {
  const [sel, setSel] = useState(new Set(['sm', 'lg']))
  const tiers = ['xs', 'sm', 'base', 'lg', 'xl', '2xl']
  const rows: ScopeRow[] = tiers.map(t => ({ id: t, label: t, selected: sel.has(t) }))
  return (
    <div id="multi">
      <StyleScopeList inline mode="multi" aria-label="Tiers" rows={rows}
        onSelect={(id, e) => {
          window.log.push(['multi', id, e.type, e.shiftKey])
          setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
        }} />
    </div>
  )
}

async function main() {
  const ab = await (await fetch('/dial/shared/fonts/CalSansVF.ttf')).arrayBuffer()
  const ranges = parseCmapRanges(ab)!
  const sets = makeGlyphSets()
  // Every encoded codepoint as one group, after the curated ones -- what font-proofer's
  // "All" shows for an uploaded face.
  const groups = [
    ...['Uppercase', 'Lowercase', 'Numerals', 'Symbols'].map(k => ({ label: k, chars: sets[k].join('') })),
    { label: 'Every codepoint', cells: enumerateCmap(ranges).map(ch => ({ ch })) },
  ]
  const before = document.createElement('button')
  before.id = 'before'; before.textContent = 'before'
  const after = document.createElement('button')
  after.id = 'after'; after.textContent = 'after'
  const root = document.getElementById('root')!
  root.before(before)
  root.after(after)
  const t0 = performance.now()
  createRoot(root).render(
    <StrictMode>
      <Single />
      <Multi />
      <div id="picker" style={{ height: 600, display: 'flex' }}>
        <GlyphPicker groups={groups} fontFamily="'CalSansVF', sans-serif" ranges={ranges} names="nice"
          onSelect={c => window.log.push(['glyph', c.ch])} style={{ flex: 1, minHeight: 0 }} />
      </div>
    </StrictMode>,
  )
  const settle = () => {
    const n = document.querySelectorAll('.gp-cell').length
    if (!n) return requestAnimationFrame(settle)
    window.mountMs = performance.now() - t0
    window.cellCount = n
    window.ready = true
  }
  requestAnimationFrame(settle)
}
main()
