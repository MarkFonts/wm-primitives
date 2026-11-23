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
 *     --pill-s: <short side>px and --pill-clip: the clip-path shape() for its height (below).
 *     A pill ::before / ::after is marked on its host as data-wm-pill-b / data-wm-pill-a with
 *     --pill-s-b / --pill-s-a and --pill-clip-b / --pill-clip-a;
 *   - keeps the marks true: a ResizeObserver on every rounded element, and a MutationObserver
 *     for added nodes and class changes (a class can change a radius). Style-attribute writes
 *     are ignored on purpose -- sliders write --pct every frame, and so does this file;
 *   - takes every mark off again when the attribute goes.
 *
 * The clip only removes the sliver between the round cap and the eased one (at most 0.003 h, at
 * a 1.2 choke), so a size that is a frame stale moves an almost invisible sliver; the observers
 * re-measure before the next paint.
 *
 * Pills under 8px on the short side are left round (MIN_S, below). An element, a subtree or a
 * single ::before / ::after opts out with --pill-ease: off. Plain script, no imports: build.py
 * inlines it in the system page's shell (its `export` stripped) and a page without a bundler
 * loads it as a module. Also on window.wmCorners. Starts itself when a document is present. */

const MARK = 'data-wm-pill'
const PSEUDO = [['::before', 'data-wm-pill-b', '--pill-s-b', '--pill-clip-b'], ['::after', 'data-wm-pill-a', '--pill-s-a', '--pill-clip-a']]
// The curve leaves the straight L = ratio/2 x s from each end, so a pill shorter than ratio x s (1.2 s)
// would have its two caps cross: it stays round.
// Below 8px the eased cap is within 0.03px of round (0.003 h), so a clip would change nothing a
// screen can show. Skipping them is not only economy: the dial's 4-6px grip sits under its shade
// layer (AxisSlider.css, .slider-grip-shade: clip-path + drop-shadow), and Chrome 153 composited the
// shade's light cast through a clipped grip as two white discs at its ends.
const MIN_S = 8
// shape() is Chrome 135, Safari 18.4, Firefox 148. Without it a pill is not marked at all and keeps today's
// corner: the clip below is a var(), valid at parse time, so an unsupported engine would not drop it.
const SHAPE_OK = typeof CSS !== 'undefined' && CSS.supports('clip-path', 'shape(from 0px 0px, line to 1px 1px, close)')

// ── The cap ──────────────────────────────────────────────────────────────────────────────────
// Mark's rule (CHROME.md "Corners"): the cap is chosen by its CHOKE, L : (h/2), where L is the
// distance from the pill's end to where the curve leaves the straight. A round cap is 1:1. The
// depth never changes -- the nose touches the end, the cap is h/2 deep, CSS radius stays h/2 --
// only the choke moves. Mark's call is one choke for every pill: 1.2, at every height. (A
// 1.3 -> 1.15 ramp with height was built and replaced; pillRatio stays the one place a height
// could matter again, and the shape cache is keyed by ratio.)
const RATIO = 1.2

/** The choke ratio L : (h/2) for a pill h px tall: 1.2 at every height. */
export function pillRatio(h) { return RATIO }

// One quarter of the cap, walked from the straight to the nose: straight -> curvature ramps
// linearly from 0 over length T -> a circular arc of radius 1 -> the nose, G2 throughout.
// The heading is analytic in arc length; positions integrate it by the midpoint rule.
// Returns the points (x along the pill, y across) and each one's heading, for unit R.
function walk(T, n) {
  const S = T + Math.PI / 2 - T / 2, ds = S / n
  const th = s => s < T ? s * s / (2 * T) : T / 2 + (s - T)
  const x = [0], y = [0], t = [0]
  for (let i = 0; i < n; i++) {
    const m = th((i + 0.5) * ds)
    x.push(x[i] + Math.cos(m) * ds); y.push(y[i] + Math.sin(m) * ds); t.push(th((i + 1) * ds))
  }
  return { x, y, t, n, S }
}

// Bisect the ramp length T so the quarter's end has x / y = ratio (T = 0 is the circle, 1:1)
function solveRamp(ratio) {
  let lo = 0, hi = Math.PI
  for (let i = 0; i < 44; i++) {
    const m = (lo + hi) / 2, q = walk(m, 400)
    q.x[400] / q.y[400] < ratio ? lo = m : hi = m
  }
  return (lo + hi) / 2
}

// The cap, scaled so the nose is h/2 deep: points in units of h, `a` = distance from the pill's
// end along it, `c` = distance in from the side. The curve leaves the straight at a = L.
const FIT_N = 1200
function capPoints(ratio) {
  const q = walk(solveRamp(ratio), FIT_N), k = 0.5 / q.y[FIT_N], L = q.x[FIT_N] * k
  return { a: q.x.map(v => L - v * k), c: q.y.map(v => v * k), t: q.t, L, n: FIT_N }
}

// Knots of the three cubics per quarter, as fractions of the quarter's arc length. Tuned (see
// scripts/gen-pill-shape.mjs --check) so the worst fit error over every ratio is 0.00014 h (0.014px on a 96px pill).
const KNOTS = [0, 0.22, 0.42, 1]

// Hermite cubic through P0..P3 with the known tangents at both ends, handles solved by least
// squares against the dense points between them (linear in the two handle lengths).
function cubic(cap, i0, i1) {
  const { a, c, t } = cap
  const P0 = [a[i0], c[i0]], P3 = [a[i1], c[i1]]
  // the cap is walked from the straight; `a` falls toward the end, so the heading's a-component is negative
  const d0 = [-Math.cos(t[i0]), Math.sin(t[i0])], d3 = [-Math.cos(t[i1]), Math.sin(t[i1])]
  // chord-length parameter of each sample, refined twice against the fitted curve
  const idx = []; for (let i = i0; i <= i1; i += Math.max(1, ((i1 - i0) / 80) | 0)) idx.push(i)
  if (idx[idx.length - 1] !== i1) idx.push(i1)
  let ts = idx.map(i => (i - i0) / (i1 - i0)), H = [0, 0]
  for (let pass = 0; pass < 3; pass++) {
    let m00 = 0, m01 = 0, m11 = 0, r0 = 0, r1 = 0
    idx.forEach((i, j) => {
      const u = ts[j], v = 1 - u
      const b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u
      const q = [a[i] - (P0[0] * (b0 + b1) + P3[0] * (b2 + b3)), c[i] - (P0[1] * (b0 + b1) + P3[1] * (b2 + b3))]
      const e0 = [d0[0] * b1, d0[1] * b1], e1 = [-d3[0] * b2, -d3[1] * b2]
      m00 += e0[0] * e0[0] + e0[1] * e0[1]; m01 += e0[0] * e1[0] + e0[1] * e1[1]; m11 += e1[0] * e1[0] + e1[1] * e1[1]
      r0 += e0[0] * q[0] + e0[1] * q[1]; r1 += e1[0] * q[0] + e1[1] * q[1]
    })
    const det = m00 * m11 - m01 * m01
    H = [(r0 * m11 - r1 * m01) / det, (m00 * r1 - m01 * r0) / det]
    // re-parameterize: nearest point on the fitted cubic by a few Newton-free scans
    const B = u => { const v = 1 - u, b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u
      return [P0[0] * b0 + (P0[0] + H[0] * d0[0]) * b1 + (P3[0] - H[1] * d3[0]) * b2 + P3[0] * b3,
              P0[1] * b0 + (P0[1] + H[0] * d0[1]) * b1 + (P3[1] - H[1] * d3[1]) * b2 + P3[1] * b3] }
    ts = idx.map((i, j) => {
      let best = ts[j], bd = Infinity
      for (let w = 0.12, c0 = ts[j]; w > 1e-4; w /= 3) {
        for (let k = -3; k <= 3; k++) {
          const u = Math.min(1, Math.max(0, c0 + k * w / 3)), p = B(u), d = (p[0] - a[i]) ** 2 + (p[1] - c[i]) ** 2
          if (d < bd) { bd = d; best = u }
        }
        c0 = best
      }
      return best
    })
  }
  return [[P0[0] + H[0] * d0[0], P0[1] + H[0] * d0[1]], [P3[0] - H[1] * d3[0], P3[1] - H[1] * d3[1]], P3]
}

/** The cap's three cubics for a ratio, from the straight to the nose: [[c1, c2, end]...] with every
 *  point [a, c] in units of h (a from the pill's end, c from the side), plus its L (also in h). */
export function pillCap(ratio) {
  const cap = capPoints(ratio), segs = []
  for (let j = 0; j < KNOTS.length - 1; j++) segs.push(cubic(cap, Math.round(KNOTS[j] * cap.n), Math.round(KNOTS[j + 1] * cap.n)))
  return { L: cap.L, start: [cap.L, 0], segs, dense: cap }
}

const SHAPE_B = '4000px'   // the outside box's reach past the element: shadows, spills, focus rings
const shapeCache = new Map()
const num = v => +v.toFixed(6)

/** The clip-path shape() string for a pill of this choke ratio: EVERYTHING except the sliver between
 *  the round stadium and the eased one (evenodd: a big box, minus the round stadium, plus the eased
 *  one). axis 'x' = caps left and right, 'y' = top and bottom. Every number is a fraction of the
 *  short side, held in the custom property `size` (--pill-s, --pill-s-b or --pill-s-a). */
export function pillShape(ratio, axis, size = '--pill-s') {
  const key = ratio + axis + size
  let out = shapeCache.get(key)
  if (out) return out
  const { L, start, segs } = pillCap(ratio)
  const s = `var(${size})`
  // k from the near edge, or (far) from the far edge
  const at = (k, far) => k === 0 ? (far ? '100%' : '0px')
    : far ? `calc(100% - ${s} * ${num(k)})` : `calc(${s} * ${num(k)})`
  const P = (a, far, c) => axis === 'x' ? `${at(a, far)} ${at(c, false)}` : `${at(c, false)} ${at(a, far)}`
  const seg = (far, [c1, c2, e]) => `curve to ${P(e[0], far, e[1])} with ${P(c1[0], far, c1[1])} / ${P(c2[0], far, c2[1])}`
  // a quarter walked backwards, or mirrored across the pill (c -> 1 - c)
  const flip = q => q.map(g => g.map(p => [p[0], 1 - p[1]]))
  const back = (q, from) => {
    const pts = [from]; for (const g of q) pts.push(...g)
    const r = []; for (let i = pts.length - 1; i > 0; i -= 3) r.push([pts[i - 1], pts[i - 2], pts[i - 3]])
    return r
  }
  const top = segs, topBack = back(segs, start), r = `calc(${s} * 0.5)`, sw = axis === 'x' ? 'cw' : 'ccw'
  const B = SHAPE_B
  const parts = [
    `from -${B} -${B}`, `line to calc(100% + ${B}) -${B}`, `line to calc(100% + ${B}) calc(100% + ${B})`,
    `line to -${B} calc(100% + ${B})`, 'close',
    `move to ${P(0.5, false, 0)}`, `line to ${P(0.5, true, 0)}`,
    `arc to ${P(0.5, true, 1)} of ${r} ${sw}`, `line to ${P(0.5, false, 1)}`, `arc to ${P(0.5, false, 0)} of ${r} ${sw}`, 'close',
    `move to ${P(L, false, 0)}`, `line to ${P(L, true, 0)}`,
    ...top.map(g => seg(true, g)), ...flip(topBack).map(g => seg(true, g)),
    `line to ${P(L, false, 1)}`,
    ...flip(top).map(g => seg(false, g)), ...topBack.map(g => seg(false, g)),
    'close',
  ]
  out = `shape(evenodd ${parts.join(', ')})`
  shapeCache.set(key, out)
  return out
}

let doc = null, live = false, ro = null, mo = null, queued = new Set(), raf = 0
const marked = new Set()   // elements carrying any mark, so turning the law off is exact

function px(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

// 'x' | 'y' | null, the short side and its choke ratio, for a computed style on a border box w x h
function pillOf(cs, w, h) {
  if (!SHAPE_OK || !(w > 0 && h > 0)) return null
  const s = Math.min(w, h), l = Math.max(w, h), ratio = pillRatio(s)
  if (s < MIN_S || l < s * ratio + 1) return null
  for (const c of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']) {
    const v = cs[c]
    if (!v || v.includes('%')) return null          // a % radius is an ellipse on a non-square box, not a pill
    if (px(v) < s / 2 - 0.5) return null
  }
  return { axis: w >= h ? 'x' : 'y', s, ratio }
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

function set(el, attr, prop, clip, p) {
  if (p) {
    const v = p.s.toFixed(2) + 'px', c = pillShape(p.ratio, p.axis, prop)
    if (el.getAttribute(attr) !== p.axis) el.setAttribute(attr, p.axis)
    if (el.style.getPropertyValue(prop) !== v) el.style.setProperty(prop, v)
    if (el.style.getPropertyValue(clip) !== c) el.style.setProperty(clip, c)
    marked.add(el)
  } else if (el.hasAttribute(attr)) {
    el.removeAttribute(attr); el.style.removeProperty(prop); el.style.removeProperty(clip)
  }
}

function classify(el) {
  if (!el.isConnected || !(el instanceof doc.defaultView.HTMLElement)) return
  const win = doc.defaultView
  const cs = win.getComputedStyle(el)
  const off = cs.getPropertyValue('--pill-ease').trim() === 'off'
  const rounded = px(cs.borderTopLeftRadius) > 0 || px(cs.borderBottomRightRadius) > 0
  if (rounded) ro.observe(el)
  set(el, MARK, '--pill-s', '--pill-clip', !off && rounded ? pillOf(cs, el.offsetWidth, el.offsetHeight) : null)
  for (const [pe, attr, prop, clip] of PSEUDO) {
    const pcs = win.getComputedStyle(el, pe)
    const pr = !off && pcs.content !== 'none' && px(pcs.borderTopLeftRadius) > 0 && pcs.getPropertyValue('--pill-ease').trim() !== 'off'
    if (pr) ro.observe(el)   // a pseudo follows its host's size, so the host's resize re-reads it
    set(el, attr, prop, clip, pr ? pillOf(pcs, ...pseudoBox(pcs)) : null)
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
    el.removeAttribute(MARK); el.style.removeProperty('--pill-s'); el.style.removeProperty('--pill-clip')
    for (const [, attr, prop, clip] of PSEUDO) { el.removeAttribute(attr); el.style.removeProperty(prop); el.style.removeProperty(clip) }
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
