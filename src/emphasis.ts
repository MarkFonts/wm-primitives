// emphasis.ts — the one place *italic* / **bold** markup is toggled on a selection.
// InlineEmphasisBubble (mouse, and keyboard on its buttons) and EditableTextBlock's
// Cmd/Ctrl+I / Cmd/Ctrl+B both call toggleEmphasis, so there is exactly one path. It writes
// the markers as TEXT through execCommand('insertText') -- never the browser's own <i>/<b>
// insertion -- so the raw text stays the source of truth and the blurred view renders it.

export interface EmphasisMarkers { italic: string; bold: string }
export type EmphasisKind = 'italic' | 'bold'
export const DEFAULT_MARKERS: EmphasisMarkers = { italic: '*', bold: '**' }

/** True when this key event is the platform's Cmd/Ctrl + I or B, and nothing else held. */
export function emphasisKey(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): EmphasisKind | null {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  if (e.altKey || e.shiftKey || (mac ? !e.metaKey || e.ctrlKey : !e.ctrlKey || e.metaKey)) return null
  const k = e.key.toLowerCase()
  return k === 'i' ? 'italic' : k === 'b' ? 'bold' : null
}

/** Character offsets of the current selection within `block`'s text, or null. */
function selectionOffsets(block: HTMLElement): { s: number; e: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const r = sel.getRangeAt(0)
  if (!block.contains(r.startContainer) || !block.contains(r.endContainer)) return null
  const pre = document.createRange()
  pre.selectNodeContents(block); pre.setEnd(r.startContainer, r.startOffset)
  const s = pre.toString().length
  return { s, e: s + r.toString().length }
}

function rangeAt(block: HTMLElement, a: number, b: number): Range {
  const r = document.createRange()
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let pos = 0, started = false, n: Node | null
  while ((n = w.nextNode())) {
    const len = n.textContent!.length
    if (!started && a <= pos + len) { r.setStart(n, a - pos); started = true }
    if (started && b <= pos + len) { r.setEnd(n, b - pos); return r }
    pos += len
  }
  r.selectNodeContents(block); r.collapse(false)
  return r
}

const run = (text: string, from: number, step: 1 | -1, c: string) => {
  let n = 0
  for (let i = from; i >= 0 && i < text.length && text[i] === c; i += step) n++
  return n
}

/** How many `c` delimiters wrap the selection, counting those inside it and just outside. */
function depth(text: string, s: number, e: number, c: string) {
  const inner = text.slice(s, e)
  if (!inner.replace(new RegExp(`\\${c}`, 'g'), '')) return { k: 0, li: 0, ri: 0, bb: 0, ba: 0 }
  const li = run(text, s, 1, c), ri = run(text, e - 1, -1, c)
  const bb = run(text, s - 1, -1, c), ba = run(text, e, 1, c)
  return { k: Math.min(bb + li, ba + ri), li, ri, bb, ba }
}

function activeOf(text: string, s: number, e: number, kind: EmphasisKind, m: EmphasisMarkers) {
  const mk = m[kind]
  const { k } = depth(text, s, e, mk[0])
  // * and ** share a character: three of them is bold AND italic, so a plain k >= len test
  // would call the bold of `**x**` italic too.
  if (m.italic[0] === m.bold[0] && m.bold.length > m.italic.length) {
    return kind === 'bold' ? k >= m.bold.length : (k % m.bold.length) >= m.italic.length
  }
  return k >= mk.length
}

/** What the current selection inside `block` already is. */
export function emphasisState(block: HTMLElement, m: EmphasisMarkers = DEFAULT_MARKERS) {
  const o = selectionOffsets(block)
  if (!o) return { italic: false, bold: false }
  const text = block.textContent ?? ''
  return { italic: activeOf(text, o.s, o.e, 'italic', m), bold: activeOf(text, o.s, o.e, 'bold', m) }
}

/** Wrap the selection in the marker, or take that marker off if it is already on.
 *  The selection survives, on the same words, so the key can be pressed again. */
export function toggleEmphasis(block: HTMLElement, kind: EmphasisKind, m: EmphasisMarkers = DEFAULT_MARKERS): boolean {
  const o = selectionOffsets(block)
  if (!o) return false
  const text = block.textContent ?? ''
  const mk = m[kind], len = mk.length
  let from = o.s, to = o.e, replacement: string, innerStart: number, innerLen: number
  if (activeOf(text, o.s, o.e, kind, m)) {
    const d = depth(text, o.s, o.e, mk[0])
    from = o.s - d.bb; to = o.e + d.ba
    const inner = text.slice(o.s + d.li, o.e - d.ri)
    const left = mk[0].repeat(d.bb + d.li).slice(len), right = mk[0].repeat(d.ba + d.ri).slice(len)
    replacement = left + inner + right
    innerStart = from + left.length; innerLen = inner.length
  } else {
    replacement = mk + text.slice(o.s, o.e) + mk
    innerStart = o.s + len; innerLen = o.e - o.s
  }
  const sel = window.getSelection()!
  sel.removeAllRanges(); sel.addRange(rangeAt(block, from, to))
  document.execCommand('insertText', false, replacement)
  sel.removeAllRanges(); sel.addRange(rangeAt(block, innerStart, innerStart + innerLen))
  return true
}
