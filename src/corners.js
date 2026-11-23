/* corners.js -- the eased corner law's one piece of JS (CHROME.md, "Corners").
 *
 * The law itself is CSS (corners.css). What CSS cannot do is know which elements are PILLS:
 * a pill is a shape decision made by numbers (radius >= half the short side), not by a class,
 * and the eased cap's clip-path needs the pill's short side as a length, because shape()
 * resolves x percentages against the width. So this file, and only while
 * <html data-corners="eased"> is set:
 *
 *   - finds every element whose four corners are all at least half its short side, on a box
 *     that is not square (a circle stays a circle), and marks it data-wm-pill="x" | "y" with
 *     --pill-s: <short side>px. A pill ::before / ::after is marked on its host as
 *     data-wm-pill-b / data-wm-pill-a with --pill-s-b / --pill-s-a;
 *   - keeps the marks true: a ResizeObserver on every rounded element, and a MutationObserver
 *     for added nodes and class changes (a class can change a radius). Style-attribute writes
 *     are ignored on purpose -- sliders write --pct every frame, and so does this file;
 *   - takes every mark off again when the attribute goes.
 *
 * A stale --pill-s is harmless by construction: the clip only removes the sliver between the
 * round cap and the eased one (at most 0.0035 r), so a wrong size moves an invisible sliver.
 *
 * Pills under 8px on the short side are left round (MIN_S, below). An element, a subtree or a
 * single ::before / ::after opts out with --pill-ease: off. Plain script, no imports: build.py
 * inlines it in the system page's shell (its `export` stripped) and a page without a bundler
 * loads it as a module. Also on window.wmCorners. Starts itself when a document is present. */

const MARK = 'data-wm-pill'
const PSEUDO = [['::before', 'data-wm-pill-b', '--pill-s-b'], ['::after', 'data-wm-pill-a', '--pill-s-a']]
const ROUND_MIN = 1.15   // the eased cap's tangent sits 0.575 s from each end: shorter than 1.15 s and the caps overlap
// Below 8px the eased cap is within 0.014px of round (0.0035 r), so a clip would change nothing a
// screen can show. Skipping them is not only economy: the dial's 4-6px grip sits under its shade
// layer (AxisSlider.css, .slider-grip-shade: clip-path + drop-shadow), and Chrome 153 composited the
// shade's light cast through a clipped grip as two white discs at its ends.
const MIN_S = 8

let doc = null, live = false, ro = null, mo = null, queued = new Set(), raf = 0
const marked = new Set()   // elements carrying any mark, so turning the law off is exact

function px(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

// 'x' | 'y' | null, and the short side, for a computed style on a border box w x h
function pillOf(cs, w, h) {
  if (!(w > 0 && h > 0)) return null
  const s = Math.min(w, h), l = Math.max(w, h)
  if (s < MIN_S || l < s * ROUND_MIN + 1) return null
  for (const c of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']) {
    const v = cs[c]
    if (!v || v.includes('%')) return null          // a % radius is an ellipse on a non-square box, not a pill
    if (px(v) < s / 2 - 0.5) return null
  }
  return { axis: w >= h ? 'x' : 'y', s }
}

// the border box of a pseudo-element, from its resolved width/height (used values when rendered)
function pseudoBox(cs) {
  if (cs.content === 'none' || cs.content === 'normal' || cs.display === 'none') return [0, 0]
  let w = px(cs.width), h = px(cs.height)
  if (cs.boxSizing !== 'border-box') {
    w += px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth)
    h += px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth)
  }
  return [w, h]
}

function set(el, attr, prop, p) {
  if (p) {
    const v = p.s.toFixed(2) + 'px'
    if (el.getAttribute(attr) !== p.axis) el.setAttribute(attr, p.axis)
    if (el.style.getPropertyValue(prop) !== v) el.style.setProperty(prop, v)
    marked.add(el)
  } else if (el.hasAttribute(attr)) {
    el.removeAttribute(attr); el.style.removeProperty(prop)
  }
}

function classify(el) {
  if (!el.isConnected || !(el instanceof doc.defaultView.HTMLElement)) return
  const win = doc.defaultView
  const cs = win.getComputedStyle(el)
  const off = cs.getPropertyValue('--pill-ease').trim() === 'off'
  const rounded = px(cs.borderTopLeftRadius) > 0 || px(cs.borderBottomRightRadius) > 0
  if (rounded) ro.observe(el)
  set(el, MARK, '--pill-s', !off && rounded ? pillOf(cs, el.offsetWidth, el.offsetHeight) : null)
  for (const [pe, attr, prop] of PSEUDO) {
    const pcs = win.getComputedStyle(el, pe)
    const pr = !off && pcs.content !== 'none' && px(pcs.borderTopLeftRadius) > 0 && pcs.getPropertyValue('--pill-ease').trim() !== 'off'
    if (pr) ro.observe(el)   // a pseudo follows its host's size, so the host's resize re-reads it
    set(el, attr, prop, pr ? pillOf(pcs, ...pseudoBox(pcs)) : null)
  }
}

function scan(root) {
  if (root.nodeType !== 1) return
  classify(root)
  for (const el of root.querySelectorAll('*')) classify(el)
}

function flush() {
  raf = 0
  if (!live) { queued.clear(); return }
  const q = [...queued]; queued.clear()
  for (const n of q) scan(n)
}
function queue(n) { queued.add(n); if (!raf) raf = doc.defaultView.requestAnimationFrame(flush) }

function on() {
  if (live) return
  live = true
  ro = new doc.defaultView.ResizeObserver(entries => { for (const e of entries) classify(e.target) })
  mo = new doc.defaultView.MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(n => { if (n.nodeType === 1) queue(n) })
      else if (r.target.nodeType === 1) queue(r.target)
    }
  })
  mo.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-shape', 'hidden'] })
  scan(doc.documentElement)
}

function off() {
  if (!live) return
  live = false
  ro.disconnect(); mo.disconnect(); ro = mo = null
  for (const el of marked) {
    el.removeAttribute(MARK); el.style.removeProperty('--pill-s')
    for (const [, attr, prop] of PSEUDO) { el.removeAttribute(attr); el.style.removeProperty(prop) }
  }
  marked.clear()
}

function sync() { doc.documentElement.getAttribute('data-corners') === 'eased' ? on() : off() }

/** Start following <html data-corners>. Idempotent; called on load. Returns a function that
 *  re-reads every element now (for a host that changed sizes without a resize or class change). */
export function wmCorners(d) {
  if (!doc) {
    doc = d || document
    new doc.defaultView.MutationObserver(sync).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-corners'] })
    sync()
  }
  return () => { if (live) scan(doc.documentElement) }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') { window.wmCorners = wmCorners; wmCorners(document) }
