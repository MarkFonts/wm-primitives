// One read pass over a tile's hidden real content -> a flat list of placeholder boxes.
// Idea (walk the DOM, one bar per text line, one shape per control) from Skullet by Lochie Axon.
// Own implementation: no ResizeObserver, no storage, reads only (no style writes between reads).
const CONTROL_TAG = /^(INPUT|BUTTON|SELECT|TEXTAREA|IMG|SVG|CANVAS|VIDEO|PROGRESS|METER)$/
const CONTROL_CLS = /(^|\s)ui-(btn|switch|check|radio|avatar|thumb|chip|kbd|field|slider|dot|tool|spinner|stars?|badge)\b/

const fill = (cs) => (cs.backgroundColor && !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(cs.backgroundColor)) || cs.backgroundImage !== 'none'
const side = (cs, s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none'
const ring = (cs) => ['Top', 'Right', 'Bottom', 'Left'].every(s => side(cs, s)) // a rule on one side is not a box
const painted = (cs) => fill(cs) || ring(cs)

const isControl = (el) => CONTROL_TAG.test(el.tagName) || el.getAttribute('role') === 'slider' || CONTROL_CLS.test(el.className?.baseVal ?? el.className ?? '')
// Memoised per pass: each element's style is read once and its subtree answer is asked once.
let kidMemo = new WeakMap(), styleMemo = new WeakMap()
const style = (el) => { let c = styleMemo.get(el); if (!c) styleMemo.set(el, c = getComputedStyle(el)); return c }
const hasPaintedKid = (el) => {
  let v = kidMemo.get(el)
  if (v !== undefined) return v
  v = false
  for (const k of el.children) {
    if (style(k).display === 'none') continue
    if (isControl(k) || painted(style(k)) || hasPaintedKid(k)) { v = true; break }
  }
  kidMemo.set(el, v); return v
}

// root: element whose subtree is measured; returns { w, h, boxes: [{x,y,w,h,r,circle}] } in root-local px.
export function skeletonize(root) {
  kidMemo = new WeakMap(); styleMemo = new WeakMap()
  const o = root.getBoundingClientRect()
  const boxes = []
  const push = (r, radius, circle, frame) => {
    if (r.width < 1 || r.height < 1) return
    boxes.push({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, r: radius, circle, frame })
  }
  const shape = (el, r, cs) => {
    const radius = cs.borderRadius || '0px'
    const circle = /50%/.test(radius) && Math.abs(r.width - r.height) < 1.5
    push(r, radius === '0px' && !circle ? '4px' : radius, circle)
  }
  const walk = (el) => {
    const cs = style(el)
    if (cs.display === 'none') return
    const r = el.getBoundingClientRect()
    const control = isControl(el) && !(el.tagName !== 'INPUT' && hasPaintedKid(el)) // a field holding a kbd/button: outline + contents
    // A painted box with no painted descendants is a leaf shape; its inner text is not drawn.
    if (control || (painted(cs) && !hasPaintedKid(el) && el.children.length < 2 && r.height <= 64)) { shape(el, r, cs); return }
    // A painted container (code block, fieldset, segmented group): keep its outline, then its contents.
    if (el !== root && (painted(cs) || isControl(el)) && r.width > 12 && r.height > 12) push(r, cs.borderRadius || '0px', false, true)
    for (const n of el.childNodes) {
      if (n.nodeType === 1) walk(n)
      else if (n.nodeType === 3 && n.nodeValue.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(n)
        const lines = []
        for (const q of rg.getClientRects()) {
          if (q.width < 1) continue
          const l = lines.find(L => Math.abs(L.top - q.top) < q.height * .5)
          if (l) { l.left = Math.min(l.left, q.left); l.right = Math.max(l.right, q.right) }
          else lines.push({ top: q.top, h: q.height, left: q.left, right: q.right })
        }
        const fs = parseFloat(cs.fontSize) || 14, bh = Math.max(6, Math.round(fs * .7))
        for (const L of lines) push({ left: L.left, width: L.right - L.left, top: L.top + (L.h - bh) / 2, height: bh }, bh / 2 + 'px', false)
      }
    }
  }
  walk(root)
  return { w: o.width, h: o.height, boxes }
}

// Static alpha mask for the one sheen layer: the bars' silhouettes (rounded rects; the sheen is ~7% alpha,
// so circular arcs vs the superellipse of the drawn bars are not distinguishable).
export function sheenMask({ w, h, boxes }) {
  const rx = (b) => b.circle ? b.w / 2 : Math.min(parseFloat(b.r) || 0, b.w / 2, b.h / 2)
  const rects = boxes.filter(b => !b.frame).map(b => `<rect x='${b.x.toFixed(1)}' y='${b.y.toFixed(1)}' width='${b.w.toFixed(1)}' height='${b.h.toFixed(1)}' rx='${rx(b).toFixed(1)}'/>`).join('')
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w.toFixed(1)} ${h.toFixed(1)}' preserveAspectRatio='none'>${rects}</svg>`)}")`
}

// Markup for the overlay (strings only: all reads happen first, all writes go through paint()).
export function skeletonHTML({ boxes }) {
  const f = (n) => +n.toFixed(2)
  return boxes.map(b => `<div class="ui-skb${b.circle ? ' ui-skb--circle' : b.frame ? ' ui-skb--frame' : ''}" style="left:${f(b.x)}px;top:${f(b.y)}px;width:${f(b.w)}px;height:${f(b.h)}px;border-radius:${b.circle ? '50%' : b.r}"></div>`).join('') + '<div class="ui-skl-sheen"><i></i></div>'
}

// Writes are batched: every tile mounted in one commit reads first, then one microtask writes them all,
// so a board of N tiles costs one layout instead of N read/write/read cycles.
const queue = []
export function paint(fn) { if (queue.push(fn) === 1) queueMicrotask(() => queue.splice(0).forEach(f => f())) }
