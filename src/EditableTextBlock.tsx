// EditableTextBlock — the canonical contentEditable text-block lifecycle, shared by
// ReCal + font-proofer. While FOCUSED the element owns its raw text (children null,
// imperative textContent) so typing is never fought by React; on BLUR the raw text is
// committed and cleared so React can render the styled/blurred view (`render`).
// A mousedown on the blurred view captures the caret position so the click lands
// where the user aimed once the raw text swaps in.
//
// Focus can be internal (default) or parent-controlled via `focused`/`onFocusChange`
// — font-proofer's Paragraph coordinates many blocks (split/merge, style targeting),
// so its parent owns focus; ReCal's fields manage themselves.
import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, FormEvent, KeyboardEvent } from 'react'
import { placeCaretAtOffset, caretCharOffset } from './caret'

export interface EditableTextBlockProps {
  value: string
  onCommit: (text: string) => void
  /** Blurred display (styled spans, inline markup…). Defaults to the raw value. */
  render?: (value: string) => ReactNode
  className?: string
  style?: CSSProperties
  /** Provide to control focus from the parent; omit for internal focus state. */
  focused?: boolean
  onFocusChange?: (focused: boolean) => void
  /** Also commit on every input while focused (live preview), not just on blur. */
  liveCommit?: boolean
  onInput?: (e: FormEvent<HTMLDivElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  /** Access to the element (e.g. a parent ref map for cross-block operations). */
  innerRef?: (el: HTMLDivElement | null) => void
}

export function EditableTextBlock({
  value, onCommit, render, className, style,
  focused: focusedProp, onFocusChange, liveCommit, onInput, onKeyDown, innerRef,
}: EditableTextBlockProps) {
  const controlled = focusedProp !== undefined
  const [focusedState, setFocusedState] = useState(false)
  const focused = controlled ? focusedProp : focusedState
  const elRef = useRef<HTMLDivElement | null>(null)
  const pending = useRef<number | null>(null)
  /* Remounting on the focus flip (see the key below) drops the browser's focus with the
     old element, so it has to be taken again here -- and the caret replaced, which this
     effect already did. Guarded on activeElement so a block that is focused for any other
     reason is not yanked. */
  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    if (focused) {
      if (document.activeElement !== el) el.focus({ preventScroll: true })
      if (pending.current != null) placeCaretAtOffset(el, pending.current)
    }
    pending.current = null
  }, [focused])
  return (
    /* KEYED ON FOCUS, so the two owners of this element's contents never hand it over
       in place. Focused, the element owns its raw text imperatively and React children
       are null; blurred, React renders the styled view into it. Switching between those
       by RECONCILING is what crashed: press Enter and the parent splices a new block and
       moves focus in the same commit, so this element goes focused -> blurred while its
       DOM still holds nodes the browser inserted for the keypress. React then tries to
       removeChild a node that is no longer where it left it -- NotFoundError, and the
       whole tree unmounts.
       onBlur clears the text for exactly this reason, but blur does not fire first when
       the parent moves focus programmatically. A changed key sidesteps the question: the
       old element is discarded whole and a fresh one is built, so React never reconciles
       against DOM it did not write. It is a remount per focus change, which is cheap
       here -- one block, on a click or an Enter. */
    <div
      key={focused ? 'raw' : 'rendered'}
      ref={el => { elRef.current = el; innerRef?.(el); if (el && !el.textContent) el.textContent = value }}
      contentEditable suppressContentEditableWarning spellCheck={false}
      className={className} style={style}
      onMouseDown={e => { if (!focused) pending.current = caretCharOffset(e.currentTarget, e.clientX, e.clientY) }}
      onFocus={() => { if (!controlled) setFocusedState(true); onFocusChange?.(true) }}
      onBlur={e => {
        // Commit the edited raw text and clear the imperative text node so React can
        // render the blurred view cleanly (no duplicated text).
        const t = e.currentTarget.textContent ?? ''
        e.currentTarget.textContent = ''
        onCommit(t)
        if (!controlled) setFocusedState(false)
        onFocusChange?.(false)
      }}
      onInput={e => { if (liveCommit && focused) onCommit(e.currentTarget.textContent ?? ''); onInput?.(e) }}
      onKeyDown={onKeyDown}
    >
      {/* NOTHING but the text lives in here. A sibling node inside a contentEditable is
          counted by every caret helper that walks children -- placeCaretAtOffset threw
          IndexSizeError the moment a rail was rendered before the text -- and the browser
          will happily let you type into it. Furniture goes OUTSIDE the editable element,
          positioned against its wrapper. */}
      {focused ? null : (render ? render(value) : value)}
    </div>
  )
}
