/** Blink el's press look off for --dur-confirm, on for --dur-confirm, then settle (GESTURES.md §14).
 *  Call on a successful outcome only. No-op under prefers-reduced-motion. Returns true if it ran. */
export function wmConfirm(el: Element | null | undefined): boolean
declare global { interface Window { wmConfirm?: (el: Element | null | undefined) => boolean } }
