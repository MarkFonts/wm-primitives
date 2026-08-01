// InlineEmphasisBubble — surfaces the otherwise-invisible *italic* / **bold**
// markup. When text is selected inside an editable element matching `selector`, a
// small bubble tucks at the selection's top-right corner (flipping left when the
// right margin runs out) with two buttons that wrap the selection in markers.
//
// Font-agnostic by design: the component knows nothing about any specific font.
// Each app passes the *resolved* italic/bold label styles (its own real ital-axis /
// italic-face rendering) so the labels preview the actual font being edited.
import { useState, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import './InlineEmphasisBubble.css'

export interface InlineEmphasisBubbleProps {
  /** CSS selector for editable elements that should trigger the bubble. */
  selector: string
  /** Style for the "italic" label — the app's resolved real italic (ital axis / italic face). */
  italicLabelStyle?: CSSProperties
  /** Style for the "bold" label — the app's resolved real bold. */
  boldLabelStyle?: CSSProperties
  /** Markup markers wrapped around the selection. Defaults to the * / ** convention. */
  markers?: { italic: string; bold: string }
}

export function InlineEmphasisBubble({
  selector,
  italicLabelStyle,
  boldLabelStyle,
  markers = { italic: '*', bold: '**' },
}: InlineEmphasisBubbleProps) {
  const [menu, setMenu] = useState<{ top: number; left: number; flip: boolean } | null>(null)

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setMenu(null); return }
      const node = sel.anchorNode
      const host = node && (node.nodeType === 3 ? node.parentElement : (node as HTMLElement))
      const block = host && host.closest && host.closest(selector)
      if (!block) { setMenu(null); return }
      const r = sel.getRangeAt(0).getBoundingClientRect()
      if (!r.width && !r.height) { setMenu(null); return }
      // No room on the right → tuck at the top-LEFT corner instead. Bubble sits
      // above-and-out so it never lands between lines (keeps the leading readable).
      const flip = r.right + 4 + 120 > window.innerWidth - 8
      setMenu({ top: r.top, left: flip ? r.left - 4 : r.right + 4, flip })
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [selector])

  // Wrap the current selection in markup; renders styled on blur via the app's renderInline.
  const apply = (marker: string) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString()
    document.execCommand('insertText', false, `${marker}${text}${marker}`)
    setMenu(null)
  }

  if (!menu) return null
  return createPortal(
    <div
      className={`inline-emph-menu${menu.flip ? ' inline-emph-menu--left' : ''}`}
      style={{ top: menu.top, left: menu.left }}
    >
      <button
        className="inline-emph-btn"
        title={`Wrap selection in ${markers.italic}italic${markers.italic}`}
        onMouseDown={e => { e.preventDefault(); apply(markers.italic) }}
      >
        <em style={italicLabelStyle}>italic</em>
      </button>
      <button
        className="inline-emph-btn"
        title={`Wrap selection in ${markers.bold}bold${markers.bold}`}
        onMouseDown={e => { e.preventDefault(); apply(markers.bold) }}
      >
        <strong style={boldLabelStyle}>bold</strong>
      </button>
    </div>,
    document.body,
  )
}

export default InlineEmphasisBubble
