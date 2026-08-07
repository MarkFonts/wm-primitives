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
  useLayoutEffect(() => {
    if (focused && pending.current != null && elRef.current) placeCaretAtOffset(elRef.current, pending.current)
    pending.current = null
  }, [focused])
  return (
    <div
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
      {focused ? null : (render ? render(value) : value)}
    </div>
  )
}
