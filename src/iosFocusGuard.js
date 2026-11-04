/* iosFocusGuard.js -- iosFocusGuard(el, { caret }): tapping into editable text on an iPhone
 * leaves the page where it was (GESTURES.md §15).
 *
 * iPhone Safari has been seen to fling the page thousands of pixels when an editable takes a
 * tap. The likely cause, inferred and not logged, is its reveal scroll: once on focus and again
 * as the keyboard opens. This holds every scroller around el, and the window, where they were
 * at the tap. Anywhere that isn't iOS it adds no listeners and does nothing at all.
 *
 *   const stop = iosFocusGuard(el)                  // <textarea>, <input>, contenteditable
 *   const stop = iosFocusGuard(row, { caret: true }) // contenteditable only, see below
 *
 * LAYER 1, the hold, is always on and safe on a surface without the bug: it writes a scroll
 * position only if that scroller moved. From the focus, for 700ms, every frame puts back
 * anything that moved. Any touchmove anywhere ends it, because that's the reader scrolling.
 * el may be a wrapper around the editables, since it listens for focusin.
 *
 * LAYER 2, `caret: true`, stops the scroll from starting, for a contenteditable where the
 * hold still shows as a snap of 20-80pt. It REPLACES NATIVE TAP HANDLING: a quick tap's
 * touchend is prevented, so no mousedown or click follows, and the guard focuses el with
 * preventScroll and places the caret itself. Anything listening for those events stops hearing
 * them. Left to iOS: drags, presses over 400ms (they select text), and an el already focused
 * (moving the caret doesn't scroll). el must be the editable itself, and a textarea gets
 * layer 1 only, since caretRangeFromPoint can't see inside one.
 *
 * Neither layer touches a tap the keyboard would cover, where iOS's scroll is the one wanted.
 * The tap point stands in for the caret. The keyboard takes about 45% of the screen before
 * it's measurable.
 *
 * THE TAP IS SHARED BY EVERY GUARD ON THE PAGE, not kept per element, and a running hold outlives
 * the guard that started it. EditableTextBlock swaps its element for a new one during the focus,
 * so the guard that saw the touch is cleaned up mid-hold and the new element's guard never
 * saw a touch. One finger, one focus: one tap at a time is all a page has. A tap is spent by
 * its first focus and expires 500ms after the finger lifts, so a later programmatic focus
 * (Enter moving to the next block) can't pull the page back to where the last tap was.
 *
 * One file, no imports, no import-time effects, so it can be copied into a page with no
 * shared/ submodule. In a classic <script>, delete the word `export`. */
const IOS = /iP(hone|ad|od)/
const HOLD_MS = 700, QUICK_TAP_MS = 400, TAP_EXPIRES_MS = 500

let tap = null     // the touch in play, until a focus spends it
let frame = 0      // the running hold
let guards = 0     // the live guards, who share one touchmove listener

const stopHold = () => { cancelAnimationFrame(frame); frame = 0 }
const onWindowTouchMove = () => { tap = null; stopHold() }

// Would the line at this height stay clear of the keyboard? Asked again every frame of a hold,
// because the keyboard becomes measurable partway through it.
function clearsKeyboard(y) {
  const vv = window.visualViewport
  if (!vv) return false
  const keyboardOpen = vv.height < window.innerHeight * 0.8
  return y + 48 < (keyboardOpen ? vv.height : vv.height * 0.55)
}

// Every box around el that can scroll, overflow:hidden ones included: script and the browser's
// reveal scroll can both move those, and both phone shells have one around their scroller.
function scrollersAround(el) {
  const out = []
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    if (p.scrollHeight > p.clientHeight && /auto|scroll|hidden/.test(getComputedStyle(p).overflowY)) {
      out.push({ box: p, top: p.scrollTop })
    }
  }
  return out
}

function startHold() {
  if (!tap || frame) return
  const { y, saved, windowY, ended } = tap
  if (ended !== null && performance.now() - ended > TAP_EXPIRES_MS) { tap = null; return }
  tap = null
  const until = performance.now() + HOLD_MS
  const step = () => {
    if (clearsKeyboard(y)) {
      if (window.scrollY !== windowY) window.scrollTo({ top: windowY, behavior: 'instant' })
      for (const s of saved) if (s.box.scrollTop !== s.top) s.box.scrollTo({ top: s.top, behavior: 'instant' })
    }
    frame = performance.now() < until ? requestAnimationFrame(step) : 0
  }
  frame = requestAnimationFrame(step)
}

export function iosFocusGuard(el, { caret = false } = {}) {
  const ua = navigator.userAgent
  const isIOS = IOS.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1)
  if (!el || !isIOS) return () => {}

  const onTouchStart = e => {
    stopHold()
    tap = e.touches.length > 1 ? null : {
      y: e.touches[0].clientY, at: performance.now(), ended: null,
      saved: scrollersAround(el), windowY: window.scrollY,
    }
  }
  const onTouchEnd = e => {
    if (!tap) return
    tap.ended = performance.now()
    if (!caret || !el.isContentEditable || document.activeElement === el) return
    if (tap.ended - tap.at > QUICK_TAP_MS || !clearsKeyboard(tap.y)) return
    e.preventDefault()
    el.focus({ preventScroll: true })
    const t = e.changedTouches[0]
    const range = document.caretRangeFromPoint?.(t.clientX, t.clientY)
    if (range && el.contains(range.startContainer)) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }
  const onTouchCancel = () => { if (tap) tap.ended = performance.now() }

  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchend', onTouchEnd, { passive: !caret })
  el.addEventListener('touchcancel', onTouchCancel, { passive: true })
  el.addEventListener('focusin', startHold)
  if (guards++ === 0) window.addEventListener('touchmove', onWindowTouchMove, { passive: true })

  return () => {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchCancel)
    el.removeEventListener('focusin', startHold)
    if (--guards === 0) window.removeEventListener('touchmove', onWindowTouchMove)
    // A replacement attaches in the same synchronous commit. With no guard left by the next
    // microtask, nothing is listening for a touchmove, so the hold can't be allowed to run on.
    queueMicrotask(() => { if (guards === 0) { tap = null; stopHold() } })
  }
}
