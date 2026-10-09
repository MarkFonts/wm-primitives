/* confirm.js -- wmConfirm(el): the receipt for a press that worked (GESTURES.md §14).
 *
 * Adds .wm-confirm to el; motion.css runs the one keyframe set (80ms press look OFF, 80ms
 * ON) and this takes the class off on its animationend, with a timeout in case the
 * animation never runs (motion.css not loaded, a hidden tab). Call it on OUTCOMES only:
 * a chip chosen, a theme set, a value reset -- never on a drag, a hold-repeat, or a press
 * that failed its own check.
 *
 *   - reduced motion: nothing. The control is already in its result state.
 *   - a second success inside the blink restarts it from 0 on the same class: the running
 *     animation is rewound, the class is never taken off and put back, so nothing flickers.
 *
 * A FRAMEWORK MAY TAKE THE CLASS BACK. A React button whose className changes with the result
 * (`active` on a theme mark, `on` on a row) is re-rendered after the click handler that called
 * this, and React writes className whole -- dropping .wm-confirm. So the class is re-asserted
 * after the microtask and the next frame, for as long as the blink is meant to be running.
 *
 * Also set on window.wmConfirm, because dialHandle.js and zoomControl.js are plain scripts
 * that cannot import: they call window.wmConfirm?.(el), so a page without this module
 * still works, unconfirmed. Returns true if the blink started. */
const PHASES = 2
const SLACK = 60   // ms past the end before the fallback strips the class

export function wmConfirm(el) {
  if (!el || !el.classList) return false
  const win = el.ownerDocument?.defaultView || window
  if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  const phase = parseFloat(win.getComputedStyle(el).getPropertyValue('--dur-confirm')) || 80
  clearTimeout(el.__wmConfirmT)
  if (el.classList.contains('wm-confirm')) {
    const run = el.getAnimations?.().find(a => a.animationName === 'wm-confirm')
    if (run) run.currentTime = 0
  } else {
    el.classList.add('wm-confirm')
    if (!el.__wmConfirmEnd) {
      el.__wmConfirmEnd = e => { if (e.target === el && e.animationName === 'wm-confirm') done(el) }
      el.addEventListener('animationend', el.__wmConfirmEnd)
    }
  }
  el.__wmConfirmLive = true
  const keep = () => { if (el.__wmConfirmLive && !el.classList.contains('wm-confirm')) el.classList.add('wm-confirm') }
  queueMicrotask(keep)
  win.requestAnimationFrame?.(keep)
  el.__wmConfirmT = setTimeout(() => done(el), PHASES * phase + SLACK)
  return true
}

function done(el) {
  clearTimeout(el.__wmConfirmT)
  el.__wmConfirmLive = false
  el.classList.remove('wm-confirm')
}

// A block, not a bare statement: build.py concatenates this ahead of dialHandle.js, whose
// leading `(() => {` would otherwise call the assignment's value.
if (typeof window !== 'undefined') { window.wmConfirm = wmConfirm }
