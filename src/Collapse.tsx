/* Collapse.tsx — a disclosure box that measures its own content.
 *
 * Every collapsing section in the rail used to carry a hand-tuned `maxHeight` number
 * inline: 108 for the rag, 300 once its budgets opened, 34 for the H&J switch, 240 for
 * the schema. Adding a row meant guessing a new one, and every guess was wrong the
 * moment a label wrapped — which the narrow H&J layout now makes routine.
 *
 * So the box asks the content. A ResizeObserver on an inner wrapper reports the real
 * height, and once an open box has finished opening its cap goes away entirely
 * (`max-height: none`), so nothing that grows afterwards can be clipped.
 *
 * The height stays an INLINE style on purpose. A class-based max-height lost to
 * font-proofer's cascade once already (see collapse.css), and the 0fr -> 1fr grid trick
 * collapses to nothing inside a flex column that gives the box no definite height.
 * Inline cannot lose.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './collapse.css'

/* A backstop for the transitionend that never comes: a box inside a `display: none`
   ancestor, or a viewer with reduced motion, transitions nothing and would otherwise
   sit at its opening height forever. Comfortably longer than --dur-med. */
const SETTLE_MS = 400

export interface CollapseProps {
  open: boolean
  children: ReactNode
  className?: string
  /** Room for a shadow to bleed past the edge while open — the wdth badge's glow was
   *  being cut square by this box, its nearest clipping ancestor. Only ever applied to
   *  an OPEN box: a closed one given the same margin leaks its first rows on screen. */
  clipMargin?: number
}

export function Collapse({ open, children, className = '', clipMargin = 12 }: CollapseProps) {
  const inner = useRef<HTMLDivElement>(null)
  // `null` means "no cap" — the settled open state. A number is a live max-height, in px.
  const [maxHeight, setMaxHeight] = useState<number | null>(open ? null : 0)
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const measure = () => inner.current?.scrollHeight ?? 0

  // The height is only ever set from a measurement, and only while the box is animating
  // or shut. Mount is deliberately not animated: a panel that opens itself on first
  // paint reads as a glitch, not as a disclosure.
  const first = useRef(true)
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return }
    clearTimeout(settle.current)
    if (open) {
      setMaxHeight(measure())
      settle.current = setTimeout(() => setMaxHeight(null), SETTLE_MS)
    } else {
      // Closing from `none` has nothing to animate FROM, so pin the current height for
      // one frame and only then go to zero. Two frames: the first commits the pin.
      setMaxHeight(measure())
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setMaxHeight(0)))
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  // While the box is open and still capped — mid-animation, or held there by a viewer
  // that never fires transitionend — content that grows has to move the cap with it.
  // An uncapped open box needs nothing; it is already the height of its content.
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setMaxHeight(h => (open && h !== null && h !== 0 ? el.scrollHeight : h))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => () => clearTimeout(settle.current), [])

  return (
    <div
      className={`wm-collapse${open ? ' wm-collapse--open' : ''}${className ? ' ' + className : ''}`}
      style={{
        maxHeight: maxHeight === null ? 'none' : maxHeight,
        overflowClipMargin: open ? clipMargin : undefined,
      }}
      onTransitionEnd={e => {
        if (e.propertyName !== 'max-height' || e.target !== e.currentTarget) return
        if (open) { clearTimeout(settle.current); setMaxHeight(null) }
      }}
    >
      {/* The measured element. It must not be the animating one: a box whose own
          max-height is being driven reports that height back as its scrollHeight, and
          the two chase each other. */}
      <div ref={inner}>{children}</div>
    </div>
  )
}
