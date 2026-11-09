/* toast.js -- toast(opts): one line of news in a corner, with at most one thing to do.
 *
 *   toast({ title, line?, action?, persist = false, id? })  ->  { close, update }
 *     title    the news, full ink
 *     line     optional, one quieter line under it (--text-muted)
 *     action   optional, { label, mark?, onClick }: ONE action, the house primary (06 Menu,
 *              .wm-menu). mark is a Material Symbols name drawn before the label; 06 wants a
 *              mark at rest (button-sets.css), so pass one. Without it the label stands alone.
 *     persist  stay until dismissed. Otherwise EVERY toast leaves after --dur-hint (3s), one
 *              with an action included (Mark, 2026-11-08).
 *     id       a toast with that id already showing is updated in place, not replaced
 *
 *   update(opts) refills the showing toast (the same keys) and restarts its clock;
 *   close() dismisses it. Both are no-ops once it has gone.
 *
 *   - ONE AT A TIME. A new toast replaces the one showing; there is no stack.
 *   - WHERE IS CSS, NOT AN OPTION (toast.css): top right on a desktop, the bottom on a phone.
 *   - THE CLOCK PAUSES while the pointer or focus is inside, and while the tab is hidden.
 *     --dur-hint is read off the toast, as wmConfirm reads --dur-confirm, so a host that
 *     retunes motion.css retunes this.
 *   - THE ACTION CONFIRMS, THEN RUNS, THEN GOES: wmConfirm(button), onClick after the blink
 *     (2 x --dur-confirm), so the receipt is seen before a reload takes the page away; then
 *     the toast dismisses. Reduced motion: no blink, so no wait.
 *   - THE DISMISS MARK is drawn when there is something to wait for -- persist, or an action.
 *     A bare toast that leaves on its own needs none. Esc dismisses any of them.
 *   - role="status" inside one aria-live="polite" region on <body>. It never takes focus.
 *
 * Plain JS, no framework, like confirm.js: Kernpare has no React, and a service worker's
 * controllerchange fires outside any component tree. The host imports toast.css (with
 * button-sets.css, icon.css and motion.css) from its stylesheet; this file imports no CSS. */
import { wmConfirm } from './confirm.js'

let region = null
let current = null
let keys = false

/* A duration token off an element: '3s', '240ms', or the fallback. */
function dur(el, name, fallback) {
  const win = el.ownerDocument?.defaultView || window
  const v = win.getComputedStyle(el).getPropertyValue(name).trim()
  const n = parseFloat(v)
  if (!isFinite(n)) return fallback
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : fallback
}

function node(tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}
function mark(name, small) {
  const s = node('span', small ? 'wm-icon wm-menu-mark--sm' : 'wm-icon', name)
  s.setAttribute('aria-hidden', 'true')
  s.setAttribute('translate', 'no')
  return s
}

function mount() {
  if (region && region.isConnected) return region
  region = node('div', 'wm-toasts')
  region.setAttribute('aria-live', 'polite')
  document.body.append(region)
  if (!keys) {
    keys = true
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !e.defaultPrevented && current) current.handle.close()
    })
  }
  return region
}

export function toast(opts = {}) {
  if (opts.id != null && current && current.id === opts.id) {
    current.handle.update(opts)
    return current.handle
  }
  if (current) current.remove()
  mount()

  let o = { ...opts, persist: !!opts.persist }
  let gone = false, acting = false
  let timer = 0, left = 0, since = 0, held = false, over = false
  const el = node('div', 'wm-toast')
  el.setAttribute('role', 'status')
  el.dataset.state = 'enter'

  function fill() {
    const text = node('div', 'wm-toast-text')
    text.append(node('div', 'wm-toast-title', o.title ?? ''))
    if (o.line) text.append(node('div', 'wm-toast-line', o.line))
    const kids = [text]
    const act = o.action
    if (act) {
      const b = node('button', 'wm-menu')
      b.type = 'button'
      if (act.mark) b.append(mark(act.mark))
      b.append(act.label)
      b.addEventListener('click', () => run(b, act))
      kids.push(b)
    }
    if (o.persist || act) {
      const x = node('button', 'wm-menu wm-menu--mark')
      x.type = 'button'
      x.setAttribute('aria-label', 'Dismiss')
      x.append(mark('close', true))
      x.addEventListener('click', () => { wmConfirm(x); close() })
      kids.push(x)
    }
    el.replaceChildren(...kids)
  }

  function run(b, act) {
    if (acting || gone) return
    acting = true
    stop()
    const blink = wmConfirm(b) ? 2 * dur(b, '--dur-confirm', 80) : 0
    setTimeout(() => {
      try { act.onClick?.() } finally { close() }
    }, blink)
  }

  /* the clock: --dur-hint of time with nothing holding it */
  function stop() { clearTimeout(timer); timer = 0 }
  function start() {
    stop()
    if (o.persist || gone || acting) return
    left = dur(el, '--dur-hint', 3000)
    since = performance.now()
    held = false
    hold()
  }
  function hold() {
    if (o.persist || gone || acting) return
    const now = performance.now()
    const want = over || el.contains(document.activeElement) || document.hidden
    if (want && !held) { left -= now - since; stop(); held = true }
    else if (!want && (held || !timer)) {
      held = false; since = now
      timer = setTimeout(close, Math.max(0, left))
    }
  }
  const later = () => setTimeout(hold)

  function remove() {
    if (gone) return
    gone = true
    stop()
    document.removeEventListener('visibilitychange', hold)
    el.remove()
    if (current && current.el === el) current = null
  }
  function close() {
    if (gone) return
    gone = true
    stop()
    document.removeEventListener('visibilitychange', hold)
    if (current && current.el === el) current = null
    el.dataset.state = 'exit'
    setTimeout(() => el.remove(), dur(el, '--dur-fast', 140) + 40)
  }
  function update(next = {}) {
    if (gone) return
    o = { ...o, ...next, persist: next.persist != null ? !!next.persist : o.persist }
    fill()
    start()
  }

  fill()
  region.append(el)
  el.getBoundingClientRect()   // the enter state is laid out before it is left
  el.dataset.state = 'shown'

  el.addEventListener('pointerenter', () => { over = true; hold() })
  el.addEventListener('pointerleave', () => { over = false; hold() })
  el.addEventListener('focusin', hold)
  el.addEventListener('focusout', later)
  document.addEventListener('visibilitychange', hold)
  start()

  const handle = { close, update }
  current = { id: opts.id, el, handle, remove }
  return handle
}
