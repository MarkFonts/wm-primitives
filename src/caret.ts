// Shared contentEditable caret helpers — pure DOM, no font/React/CSS knowledge.
// Both apps' editable proofing blocks use these to place the caret and to map a
// click point to a character offset. Extracted verbatim from font-proofer + ReCal
// (font-proofer named them placeCursor*; import with an alias there).

/** Collapse the caret to the very start of el's content. */
export function placeCaretAtStart(el: HTMLElement): void {
  const r = document.createRange(), s = window.getSelection()
  r.setStart(el, 0); r.collapse(true); s?.removeAllRanges(); s?.addRange(r)
}

/** Collapse the caret to the very end of el's content. */
export function placeCaretAtEnd(el: HTMLElement): void {
  const r = document.createRange(), s = window.getSelection()
  r.selectNodeContents(el); r.collapse(false); s?.removeAllRanges(); s?.addRange(r)
}

/** Place the caret at a character offset within el's first text node. */
export function placeCaretAtOffset(el: HTMLElement, offset: number): void {
  const tn = el.firstChild, len = tn?.textContent?.length ?? 0
  const r = document.createRange(), s = window.getSelection()
  r.setStart(tn ?? el, Math.min(Math.max(offset, 0), len)); r.collapse(true)
  s?.removeAllRanges(); s?.addRange(r)
}

/** Character offset within el at a viewport point — so clicking into a styled
 *  block lands the caret where you clicked rather than at the start. */
export function caretCharOffset(el: HTMLElement, x: number, y: number): number {
  const doc = el.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null, offset = 0
  if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; offset = p.offset } }
  else if (doc.caretRangeFromPoint) { const rr = doc.caretRangeFromPoint(x, y); if (rr) { node = rr.startContainer; offset = rr.startOffset } }
  if (!node || !el.contains(node)) return el.textContent?.length ?? 0
  const r = document.createRange(); r.selectNodeContents(el); r.setEnd(node, offset)
  return r.toString().length
}
