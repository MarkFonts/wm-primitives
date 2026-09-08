// BlockStyleRail — the four paragraph styles as marks, stacked in the margin beside the
// block you are editing.
//
// WHY IT EXISTS. The only way to change a block's level was `#`/`##`/`###` followed by a
// space, which fires only when the block's whole text is exactly that — so it works on a
// NEW empty block and nowhere else. To restyle the paragraph you are looking at you had
// to empty it first. This is the same four choices, reachable from where you already are.
//
// QUIET BY DEFAULT, and that is the whole design. The rail appears only while its block
// has focus, and its marks sit at the bottom of the ink ladder — `off`, the faintest ink
// this system has. It is furniture you can ignore while typing and find without hunting.
// Pointing at one brings it up a rung; the block's current level is the only mark that
// carries full ink. So the rail reads, at a glance, as "you are a Heading 2" rather than
// as four buttons demanding a decision.
//
// It is a rail, not a popover: no portal, no anchor maths, no flipping when the margin
// runs out. It is positioned by the block it belongs to, which already knows where it is.
import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { PARA_STYLE_ORDER, PARA_STYLE_LABEL, type ParaStyleKey } from './paraStyles'
import './BlockStyleRail.css'

/* The pilcrow is the same mark the Paragraph preview mode uses, and h1-h3 each carry
   their own numeral -- the rare case where an icon says more than a word would at this
   size, because the thing being named IS a number. */
const STYLE_ICON: Record<ParaStyleKey, string> = {
  h1: 'format_h1', h2: 'format_h2', h3: 'format_h3', p: 'format_paragraph',
}

export interface BlockStyleRailProps {
  /** The block's current style, which is the one mark drawn at full ink. */
  value: ParaStyleKey
  onChange: (k: ParaStyleKey) => void
  /** Which margin. 'left' is the default: it is the edge a reader's eye returns to. */
  side?: 'left' | 'right'
  className?: string
}

/* How far away the pointer can be and still raise a mark, in px. Measured per MARK, not
   per rail, so the four fade independently and the nearest is brightest -- which is what
   makes it read as a field around the cursor rather than a panel switching on. */
const REACH = 190

export function BlockStyleRail({ value, onChange, side = 'left', className }: BlockStyleRailProps) {
  const ref = useRef<HTMLDivElement>(null)

  /* Proximity, written straight to the DOM rather than through state: this runs on every
     pointermove and a setState per move would re-render the block behind it -- which is a
     fitted paragraph, so it would re-layout the text you are reading. rAF-coalesced for
     the same reason: several moves per frame, one write.
     Listening on the window, not the rail, because the whole point is to be found from
     OUTSIDE: a mark you must already be touching to see is not discoverable. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(pointer: coarse)').matches) {
      /* No pointer to be near. Touch gets them outright -- a fade keyed to a cursor that
         does not exist would leave the rail permanently invisible. */
      el.style.setProperty('--rail-prox-floor', '1')
      return
    }
    let frame = 0
    let last: PointerEvent | null = null
    const paint = () => {
      frame = 0
      if (!last) return
      for (const btn of Array.from(el.children) as HTMLElement[]) {
        const r = btn.getBoundingClientRect()
        const dx = last.clientX - (r.left + r.width / 2)
        const dy = last.clientY - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy)
        /* Squared falloff, not linear: linear reads as a wash that is always half on.
           This keeps the far marks genuinely dark and turns up quickly near the cursor. */
        const t = Math.max(0, 1 - d / REACH)
        btn.style.setProperty('--prox', String(+(t * t).toFixed(3)))
      }
    }
    const onMove = (e: PointerEvent) => {
      last = e
      if (!frame) frame = requestAnimationFrame(paint)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`block-style-rail block-style-rail--${side}${className ? ' ' + className : ''}`}
      role="group"
      aria-label="Paragraph style"
      /* The rail lives inside the editable block's wrapper, so a press inside it would
         otherwise blur the text and take the caret with it -- and the block would stop
         being focused, which is the condition for the rail being on screen at all. It
         would vanish under the pointer mid-click. */
      onMouseDown={e => e.preventDefault()}
    >
      {PARA_STYLE_ORDER.map(k => (
        <button
          key={k}
          type="button"
          className={`wm-icon-btn${value === k ? ' active' : ''}`}
          aria-pressed={value === k}
          aria-label={PARA_STYLE_LABEL[k]}
          title={PARA_STYLE_LABEL[k]}
          onClick={() => onChange(k)}
        >
          {/* `off`, not `rest`: this rail should sit below every other mark on screen.
              icon.css lets an `off` mark ignore the pointer entirely, so the hover rung
              is restored here rather than there -- see BlockStyleRail.css. */}
          <Icon name={STYLE_ICON[k]} size={20} state={value === k ? 'active' : 'off'} />
        </button>
      ))}
    </div>
  )
}

export default BlockStyleRail
