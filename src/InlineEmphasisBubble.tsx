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
import { Icon } from './Icon'
import { toggleEmphasis, emphasisState, type EmphasisKind } from './emphasis'
import './InlineEmphasisBubble.css'

export interface InlineEmphasisBubbleProps {
  /** CSS selector for editable elements that should trigger the bubble. */
  selector: string
  /** Style for the "italic" label — the app's resolved real italic (ital axis / italic face).
   *  UNUSED while the bubble draws marks instead of words; kept because the commented-out
   *  word version below still wants it and callers still pass it. Removing it would be a
   *  breaking change to un-break later. */
  italicLabelStyle?: CSSProperties
  /** Style for the "bold" label — the app's resolved real bold. See above: unused for now. */
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
  const [menu, setMenu] = useState<{ top: number; left: number; flip: boolean; block: HTMLElement; italic: boolean; bold: boolean } | null>(null)

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
      setMenu({ top: r.top, left: flip ? r.left - 4 : r.right + 4, flip, block: block as HTMLElement, ...emphasisState(block as HTMLElement, markers) })
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [selector, markers.italic, markers.bold])

  // Toggle the marker on the current selection (emphasis.ts, shared with Cmd/Ctrl+I/B). The
  // selection stays on the same words, so the bubble stays and its pressed state updates.
  const apply = (kind: EmphasisKind) => { if (menu) toggleEmphasis(menu.block, kind, markers) }

  if (!menu) return null
  return createPortal(
    <div
      role="toolbar"
      aria-label="Text emphasis"
      className={`inline-emph-menu${menu.flip ? ' inline-emph-menu--left' : ''}`}
      style={{ top: menu.top, left: menu.left }}
    >
      {/* THE WORDS, KEPT. This bubble said "italic" and "bold" set in the app's own
          resolved italic and bold -- so the label was a specimen of the thing it applied,
          which is a genuinely good idea in a type tool and the reason italicLabelStyle /
          boldLabelStyle exist. It is commented out rather than deleted because the
          argument for it has not gone away: a mark cannot show you the face.
          What it could not do is be small. Two words are as wide as the selection they
          hover over, and at that width the bubble covers the text you are looking at --
          which is the one thing a floating menu must not do.
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
      */}
      <button
        className="inline-emph-btn wm-icon-btn"
        title={`Wrap selection in ${markers.italic}italic${markers.italic}`}
        type="button"
        aria-label="Italic"
        aria-pressed={menu.italic}
        /* mousedown keeps the text selection alive; a keyboard press has no mousedown, and
           arrives as a click with detail 0, so the two never both fire. */
        onMouseDown={e => { e.preventDefault(); apply('italic') }}
        onClick={e => { if (e.detail === 0) apply('italic') }}
      >
        <Icon name="format_italic" size={18} />
      </button>
      <button
        className="inline-emph-btn wm-icon-btn"
        title={`Wrap selection in ${markers.bold}bold${markers.bold}`}
        type="button"
        aria-label="Bold"
        aria-pressed={menu.bold}
        onMouseDown={e => { e.preventDefault(); apply('bold') }}
        onClick={e => { if (e.detail === 0) apply('bold') }}
      >
        <Icon name="format_bold" size={18} />
      </button>
    </div>,
    document.body,
  )
}

export default InlineEmphasisBubble
