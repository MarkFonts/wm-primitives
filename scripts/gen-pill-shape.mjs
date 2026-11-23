#!/usr/bin/env node
/* The eased pill cap's audit and printer. The cap itself is built at runtime by src/corners.js
 * (pillRatio, pillCap, pillShape): the choke depends on the pill's height, so one fixed shape
 * scaled by --pill-s no longer serves every size, and there is nothing left to GENERATE into
 * corners.css. This file imports the same solver and answers two questions about it.
 *
 *   node scripts/gen-pill-shape.mjs            table, per ratio: L, nose radius, fit error at
 *                                              96px, and how far the eased cap lies inside the
 *                                              round one (the sliver the clip removes)
 *   node scripts/gen-pill-shape.mjs --check    the same, and exit 1 if any fit is over 0.05px
 *                                              at 96px tall, or any cap leaves the round one
 *   node scripts/gen-pill-shape.mjs --shape 1.28 x     print one shape() string
 *
 * Fit error is the worst distance from the cubics to the exact curve (a clothoid ramp into an
 * arc, ratio solved by bisection; CHROME.md "Corners"), measured against 1200 samples per quarter. */
import { pillRatio, pillCap, pillShape } from '../src/corners.js'

const args = process.argv.slice(2)
if (args[0] === '--shape') { console.log(pillShape(+args[1], args[2] || 'x')); process.exit(0) }

const LIMIT_PX = 0.05, AT = 96
const bez = (p0, [c1, c2, e], u) => { const v = 1 - u
  return [0, 1].map(k => p0[k] * v * v * v + c1[k] * 3 * v * v * u + c2[k] * 3 * v * u * u + e[k] * u * u * u) }

function audit(ratio) {
  const { L, start, segs, dense } = pillCap(ratio), { a, c } = dense
  let err = 0, p0 = start
  for (const g of segs) {
    for (let i = 0; i <= 200; i++) {
      const p = bez(p0, g, i / 200)
      let best = Infinity
      for (let j = 0; j < a.length - 1; j++) {   // distance to the dense polyline
        const dx = a[j + 1] - a[j], dy = c[j + 1] - c[j], l2 = dx * dx + dy * dy
        const t = Math.max(0, Math.min(1, ((p[0] - a[j]) * dx + (p[1] - c[j]) * dy) / l2))
        best = Math.min(best, Math.hypot(p[0] - a[j] - t * dx, p[1] - c[j] - t * dy))
      }
      err = Math.max(err, best)
    }
    p0 = g[2]
  }
  // inside the round cap: for points within h/2 of the end, the distance to the round center (0.5, 0.5) <= 0.5
  let sliver = 0, out = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] >= 0.5) continue
    const d = Math.hypot(a[i] - 0.5, c[i] - 0.5)
    sliver = Math.max(sliver, 0.5 - d); out = Math.max(out, d - 0.5)
  }
  return { ratio, L, err, sliver, out }
}

let bad = 0
console.log('ratio   L/h     fit err @96px   sliver @32px   sliver @96px')
for (let r = 1.15; r <= 1.3001; r += 0.01) {
  const q = audit(+r.toFixed(2)), px = q.err * AT
  const flag = px > LIMIT_PX || q.out > 1e-6
  if (flag) bad++
  console.log(`${q.ratio.toFixed(2)}   ${q.L.toFixed(4)}   ${px.toFixed(4)}px         ${(q.sliver * 32).toFixed(3)}px        ${(q.sliver * 96).toFixed(3)}px${flag ? '   <-- FAIL' : ''}`)
}
console.log(`ramp: 24px ${pillRatio(24)}, 32px ${pillRatio(32)}, 48px ${pillRatio(48)}, 96px ${pillRatio(96)}, 160px ${pillRatio(160)}`)
if (args.includes('--check') && bad) { console.error(`${bad} ratio(s) out of tolerance`); process.exit(1) }
