/** The one action a toast may carry, drawn as 06 Menu (.wm-menu). */
export interface ToastAction {
  label: string
  /** A Material Symbols name drawn before the label. 06 wants a mark at rest, so pass one. */
  mark?: string
  /** Runs after the confirm's blink (2 x --dur-confirm), then the toast dismisses. */
  onClick?: () => void
}
export interface ToastOptions {
  /** The news, at full ink. */
  title: string
  /** One quieter line under the title (--text-muted). */
  line?: string | null
  action?: ToastAction | null
  /** Stay until dismissed. Otherwise every toast leaves after --dur-hint (3s). */
  persist?: boolean
  /** A toast with this id already showing is updated in place instead of replaced. */
  id?: string | number
}
export interface ToastHandle {
  /** Dismiss it. A no-op once it has gone. */
  close(): void
  /** Refill it with these keys and restart its clock. A no-op once it has gone. */
  update(opts: Partial<ToastOptions>): void
}
/** Show one line of news in a corner (top right on a desktop, the bottom on a phone), replacing
 *  the toast showing. Pair with toast.css; it never takes focus. */
export function toast(opts: ToastOptions): ToastHandle
