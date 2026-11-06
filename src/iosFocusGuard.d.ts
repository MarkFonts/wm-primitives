/** Keep the page where it was when a tap focuses editable text on iOS (GESTURES.md §15).
 *  Holds the window and every scroller around el for 700ms after the focus, skipping a tap the
 *  keyboard would cover. `caret: true` also takes over quick taps on a contenteditable, so the
 *  scroll never starts; no mousedown or click follows those taps. Off iOS, a complete no-op.
 *  Returns the cleanup. */
export function iosFocusGuard(
  el: HTMLElement | null | undefined,
  options?: { caret?: boolean },
): () => void
