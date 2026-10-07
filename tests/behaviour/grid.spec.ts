import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/* THE LINE, RENDERED (src/grid.css + src/gridSnap.js). The token lint holds the INPUTS --
   leadings and vertical space in whole 3px units. This holds the OUTPUT, on every page that
   is on the grid, at three widths:
     1. every text block the snapper measured has its first baseline on a 3px line, and a
        block of more than one line has a leading in whole units (so its later lines do too);
     2. every row of a .wm-baselines grid meets on one baseline (data-baseline="last" items
        by their last line);
     3. the snapper refused nothing -- a refusal is a row that matched the wrong text (once:
        a paragraph pushed 212px to meet a slider label);
     4. the layout holds: no box narrower than what is in it, no grid or flex siblings drawn
        over each other. The grid put .look on 12 columns and forgot its items' span, so on
        a phone six 18px items drew their contents over one another (shipped 2026-10-01);
        the baseline checks were green the whole time.
     5. the margin holds: no measured text starts left of the house margin or ends right of
        the viewport minus it. The homepage's unlayered `* { padding: 0 }` reset beat the
        layered `.wm-grid` padding-inline, the copy sat at x=0, and checks 1-4 were green.
        A TOOL has no margin (.wm-grid--bleed, Mark 2026-10-04): text in a bleed root is judged
        against one gutter from the window edge instead, and the report says so. A BREAKER's box
        (.wm-break) runs to the window edge on purpose; only text is judged, so the text inside
        one still answers to the page margin.
     6. units share a baseline: every text run inside a --snap-unit: 1 component (a slider row,
        a chip row, a rail row) has the SAME baseline as the unit's first run, within 0.5px,
        unless the unit is data-baseline="free". The row rule (2) aligns siblings of a
        .wm-baselines grid; nothing held the text INSIDE one component together, and a rail
        row's value field drifted below its label with every other check green.
     7. a row shares its lines: in a .wm-baselines row of side-by-side text that wraps (roles
        body and up, in two items or more), the smallest text lead is the row's STEP, and every
        baseline of a larger-lead block lands on the step's lines from the row's shared first
        baseline -- the larger text is sized so its lead is a whole multiple (Mark 2026-10-06).
        A design rule, not a runtime one: nothing rewrites a leading, this reports.
     8. folio elements sit on the row step: in such a row, every box that is not text (a rule, a
        dot, a figure's top, a folio mark; not data-nosnap, not data-baseline="free") has its top
        or its centre on a multiple of the step from that baseline, within 0.5px, and gridSnap
        published the step as --row-step on the row's items.
        Annotation roles (micro, ui, label) and one-line blocks are not part of a step.
     9. text keeps one step of white: the text just above a title (a heading at 24px and up)
        in its column has its last baseline at least one step above the big text's first
        x-height, and the text just below has its first x-height at least one step under the
        title's last baseline. The step is the row's, or body's lead; x-heights are measured
        from pixels (xHeights, below).
   It judges window.wmGridSnap.blocks, exactly what the snapper judged, so ornaments placed
   on purpose (a pill's arrow, a deck counter) drop out by the same rule that skips them,
   not by a list kept here. */

const PAGES = [
  { name: 'grid demo', url: '/grid/grid.html' },
  // The system page: <main> is the root. On the line are the shell's copy, the README and
  // the Grid part of Type; the other chapters are stages, data-nosnap (build.py OFF_LINE
  // says what each would need), so the layout check skips them by the same rule.
  // Its edges belong to the doc shell, not to .wm-grid: a rail column at 1440 (copy at 202px)
  // and --edge-l/--edge-r 20px below 1080 (build-time shell CSS). It is the one page that
  // opts out of the margin check; it cannot be data-nosnap'd, its copy IS on the line.
  { name: 'system page', url: '/grid/index.html', ownEdges: true },
  { name: 'Cal Sans case study', url: '/wordmark/calsans/', dir: process.env.WORDMARK_DIR ?? resolve('../wordmark') },
  { name: 'homepage', url: '/wordmark/index.html', dir: process.env.WORDMARK_DIR ?? resolve('../wordmark') },
  // A tool and a page in one fixture: a .wm-grid--bleed root (no margin, text one gutter in),
  // and a margined root with breakers, a .wm-cols inside one, and a flagged macOS shot.
  { name: 'bleed + breakers fixture', url: '/dial/grid-bleed.html' },
  // Columns that ARE text blocks, with different leads: each carries its own baseline nudge as
  // a `top`, so a row is only found if it is grouped by the box, before the nudge.
  { name: 'row of unlike leads fixture', url: '/dial/grid-row.html' },
  // The row step: a 45/48 headline beside a 12/24 caption with its rule one step up, the
  // exemptions, and two negative cases (data-expect-offender) the test below holds to account.
  { name: 'row step fixture', url: '/dial/grid-step.html' },
]
/* KNOWN OFFENDERS of checks 7 and 8, by page and row selector: reported in the log, not failed.
   Each says why and what removes it. Keep this list short; an entry is a debt, not a waiver. */
const KNOWN: Record<string, { row: string; why: string; below?: number }[]> = {   // below: only at viewport widths under it
  // The hero is a 30/39 lede beside a 16/27 sub: 39 is not a multiple of 27. Mark kept the lede
  // at 39 for now (Cal Sans's short ascenders look spaced out at 54, 2026-10-06); the case study
  // re-sizes its hero to a multiple of its sub's lead, and this entry goes.
  'Cal Sans case study': [{ row: '.hero-cols', why: 'lede 39 beside sub 27 until the case study re-sizes its hero' }],
  // 681-1023 is still fluid; remove when wordmark steps that range. At 1440 and 1024 the rows are live.
  'homepage': [{ row: '.work-item', below: 1024, why: 'work headline 33 beside caption 24 below 1024, where wordmark has not stepped the range' }],
}
// 1024 is where the 24 columns begin (grid.css) and where the Cal Sans hero's two columns first
// share a row; 900 is below it, 1440 above.
const WIDTHS = [1440, 1024, 900, 390]

const LAYOUT = () => {   // runs in the page; stringified below
  // A flagged macOS shot is drawn past its box on purpose (its shadow); judge its WINDOW, the
  // rect less the negative margins grid.css cut the shadow out with.
  const box = (e: Element) => { const r = e.getBoundingClientRect(); if (!e.matches('[data-shot="mac"], [data-shot="mac"] > img')) return r
    const c = getComputedStyle(e), n = (v: string) => Math.max(0, -parseFloat(v) || 0)
    return { left: r.left + n(c.marginLeft), right: r.right - n(c.marginRight), top: r.top + n(c.marginTop), bottom: r.bottom - n(c.marginBottom), width: r.width - n(c.marginLeft) - n(c.marginRight), height: r.height - n(c.marginTop) - n(c.marginBottom) } }
  const vis = e => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0.05 && c.display !== 'contents' && !/absolute|fixed/.test(c.position) };
  const skip = e => e.closest('[data-nosnap], svg') || !vis(e);
  const narrow = [], overlap = [];
  for (const el of document.querySelectorAll('main *')) {
    if (skip(el)) continue;
    const c = getComputedStyle(el); if (c.display === 'inline' || c.overflowX !== 'visible' || c.whiteSpace === 'nowrap') continue;
    const b = el.getBoundingClientRect(); if (b.width < 1) continue;
    let extent = -Infinity;
    for (const k of el.children) { const kc = getComputedStyle(k); if (vis(k) && kc.position !== 'absolute' && kc.position !== 'fixed') extent = Math.max(extent, box(k).right); }
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { const rg = document.createRange(); rg.selectNodeContents(el); extent = Math.max(extent, rg.getBoundingClientRect().right); }
    if (extent > b.right + 2) narrow.push(`${el.tagName.toLowerCase()}.${(el.className + '').split(' ')[0]} is ${Math.round(b.width)}px wide with ${Math.round(extent - b.left)}px inside`);
  }
  for (const par of document.querySelectorAll('main *')) {
    if (skip(par) || !/grid|flex/.test(getComputedStyle(par).display)) continue;
    const kids = [...par.children].filter(vis).map(c => [c, box(c)] as const).filter(([, r]) => r.width > 4 && r.height > 4);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const [a, ra] = kids[i], [b2, rb] = kids[j];
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 4 && oy > 4) overlap.push(`${(par.className + '').split(' ')[0] || par.tagName}: ${(a.className + '').split(' ')[0] || a.tagName} and ${(b2.className + '').split(' ')[0] || b2.tagName} overlap by ${Math.round(ox)}x${Math.round(oy)}`);
    }
  }
  return { narrow: narrow.slice(0, 8), overlap: overlap.slice(0, 8) };
}

const UNITS = () => {   // runs in the page; stringified below
  /* UNITS SHARE A BASELINE. A --snap-unit: 1 component moves whole, by its first line; this
     holds that every text run INSIDE it sits on that baseline. A run's baseline is its Range's
     first client rect bottom (the inline box's content area, whatever the line-height) minus
     the face's descent, measured once per font with a probe span ("x" in the same computed
     font: span bottom less a zero-size inline-block's top, which is the baseline). An
     <input>/<textarea> has no text node: its value is measured from its content box, where the
     browser centres the text line (inputs) or starts it (textarea) -- the same descent probe. */
  const unitOf = (e: Element) => getComputedStyle(e).getPropertyValue('--snap-unit').trim() === '1'
  const FREE = '[data-baseline="free"], [data-nosnap], [aria-hidden="true"], .material-symbols-outlined, .wm-icon, svg, script, style, noscript'
  const cache = new Map<string, { a: number; d: number }>()
  const metrics = (host: Element) => {
    const c = getComputedStyle(host)
    const key = [c.fontFamily, c.fontSize, c.fontWeight, c.fontStyle, c.fontStretch, c.fontVariationSettings, c.fontOpticalSizing, c.fontFeatureSettings, c.letterSpacing].join('|')
    let m = cache.get(key); if (m) return m
    const sp = document.createElement('span'), ib = document.createElement('span')
    sp.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;line-height:normal;padding:0;border:0;margin:0'
    ib.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    sp.append('x', ib)
    // an <input> cannot hold a child: the probe goes in its parent wearing the input's font
    const into = /^(input|textarea)$/i.test(host.tagName) ? host.parentElement! : host
    if (into !== host) for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariationSettings', 'fontOpticalSizing', 'fontFeatureSettings', 'letterSpacing'] as const) (sp.style as any)[k] = (c as any)[k]
    into.appendChild(sp)
    const r = sp.getBoundingClientRect(), base = ib.getBoundingClientRect().top
    sp.remove()
    m = { a: base - r.top, d: r.bottom - base }; cache.set(key, m); return m
  }
  const short = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 24)
  const name = (e: Element) => `${e.tagName.toLowerCase()}.${(e.getAttribute('class') || '').split(' ')[0]}`
  const off: string[] = []; let units = 0, runs = 0
  for (const u of document.querySelectorAll('.wm-lines *')) {
    if (!unitOf(u) || (u.parentElement && unitOf(u.parentElement)) || u.closest('[data-nosnap], [data-baseline="free"]')) continue
    units++
    const found: { y: number; t: string; top: number; bottom: number }[] = []
    const w = document.createTreeWalker(u, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => n.nodeType === 1
        ? ((n as Element).matches(FREE) ? NodeFilter.FILTER_REJECT : (n as Element).matches('input, textarea') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
        : (n.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) })
    let n: Node | null
    while ((n = w.nextNode())) {
      if (n.nodeType === 1) {   // a field: its value has no text node
        const el = n as HTMLInputElement
        if (el.tagName === 'INPUT' && !/^(text|number|search|email|url|tel|password)$/.test(el.type)) continue
        const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (!el.value || !r.height || cs.visibility === 'hidden') continue
        const m = metrics(el), pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth), pb = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth)
        const ch = r.height - pt - pb
        found.push({ y: r.top + pt + (el.tagName === 'INPUT' ? (ch - (m.a + m.d)) / 2 : 0) + m.a, t: el.value, top: r.top + pt, bottom: r.bottom - pb }); continue
      }
      const tn = n as Text, host = tn.parentElement!
      if (host.closest(FREE) || getComputedStyle(host).visibility === 'hidden') continue
      const rg = document.createRange(); rg.selectNodeContents(tn)
      const rect = [...rg.getClientRects()].find(r => r.width > 0 && r.height > 0); if (!rect) continue
      found.push({ y: rect.bottom - metrics(host).d, t: tn.textContent!, top: rect.top, bottom: rect.bottom })
    }
    runs += found.length
    if (found.length < 2) continue
    // A unit that wraps (a row of chips, a caption under its label) has one baseline PER LINE, so
    // runs are grouped into lines by vertical overlap, in document order, and each run is held
    // to the first run of ITS line. Runs on a line must meet; lines are the layout's business.
    const lines: typeof found[] = []
    for (const f of found) {
      const ln = lines.find(l => { const g = l[0], ov = Math.min(g.bottom, f.bottom) - Math.max(g.top, f.top); return ov > 0.5 * Math.min(g.bottom - g.top, f.bottom - f.top) })
      ln ? ln.push(f) : lines.push([f])
    }
    for (const ln of lines) for (const f of ln.slice(1)) if (Math.abs(f.y - ln[0].y) > 0.5)
      off.push(`unit ${name(u)}: "${short(f.t)}" at ${f.y.toFixed(1)}px vs "${short(ln[0].t)}" at ${ln[0].y.toFixed(1)}px (${(f.y - ln[0].y > 0 ? '+' : '') + (f.y - ln[0].y).toFixed(1)})`)
  }
  return { units, runs, off }
}

const ROWS = (known: string[]) => {   // runs in the page; stringified below
  /* THE ROW STEP (src/gridSnap.js). Rows are grouped as the snapper groups them (the box top less
     grid.css's nudge). A block counts toward a row's step if it is a measured text block in a
     text role -- not .t-micro/.t-ui/.t-label, a leading no smaller than body's (--lead-body
     resolved in the root), not inside a --snap-unit component -- that wraps. A row with such
     blocks in two items or more has a step: the smallest of their leads.
       lines: every counted block with a larger lead has every baseline on the step's lines,
              extended both ways from the row's shared first baseline;
       step:  every non-text box in the row has its top or its centre on those lines, and each
              item carries the step as --row-step.
     A row that matches a `known` selector, or sits in [data-expect-offender], is reported but
     excused; the fixture test asserts its expected offenders ARE found. */
  const snap = (window as any).wmGridSnap, blocks = snap.blocks as Element[]
  const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
  const first = (el: Element) => { const t = snap.firstLine(el) as Node; if (!t) return NaN; t.parentNode!.insertBefore(probe, t); const y = probe.getBoundingClientRect().top; probe.remove(); return y }
  const name = (e: Element) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : '.' + (e.getAttribute('class') || '').split(' ')[0]}` + ((e.textContent || '').trim() ? ` "${(e.textContent || '').trim().slice(0, 20)}"` : '')
  const rowName = (b: Element) => `${b.tagName.toLowerCase()}${b.id ? '#' + b.id : '.' + (b.getAttribute('class') || '').split(' ')[0]}`
  const out: { kind: 'lines' | 'step'; row: string; msg: string; excused: string }[] = []
  const hasText = (e: Element) => { const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent!.trim() ? 1 : 3 }); return !!w.nextNode() }
  const off = (L: number, y0: number, y: number) => { const m = (((y - y0) % L) + L) % L; return Math.min(m, L - m) }
  let rows = 0, judged = 0, marks = 0
  for (const root of document.querySelectorAll('.wm-lines')) {
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;visibility:hidden;height:0;padding:0;border:0;font-size:var(--type-body-size,1rem);line-height:var(--lead-body,24px)'
    root.appendChild(d); const body = parseFloat(getComputedStyle(d).lineHeight) || 24; d.remove()
    const lead = (el: Element) => {
      if (el.closest('.t-micro, .t-ui, .t-label') || getComputedStyle(el).getPropertyValue('--snap-unit').trim() === '1') return 0
      const lh = parseFloat(getComputedStyle(el).lineHeight); if (!lh || lh < body - 0.5) return 0
      return snap.lines(el, lh) > 1 ? lh : 0   // from the text: a grid item's box is stretched to its row
    }
    for (const box of root.querySelectorAll('.wm-baselines')) {
      if (box.closest('[data-nosnap]')) continue
      const excused = known.find(k => box.matches(k)) ?? (box.closest('[data-expect-offender]') ? 'data-expect-offender' : '')
      const byTop = new Map<number, Element[]>()
      for (const c of box.children) { const r = c.getBoundingClientRect(); if (!r.height) continue; const cs = getComputedStyle(c); const k = Math.round(r.top - (cs.position === 'relative' ? parseFloat(cs.top) || 0 : 0)); const key = [...byTop.keys()].find(x => Math.abs(x - k) <= 1) ?? k; (byTop.get(key) ?? byTop.set(key, []).get(key)!).push(c) }
      for (const items of byTop.values()) {
        if (items.length < 2) continue
        const found = items.map(c => blocks.filter(el => c === el || c.contains(el)).map(el => [el, lead(el)] as [Element, number]).filter(b => b[1]))
        if (found.filter(f => f.length).length < 2) continue
        rows++
        const L = Math.min(...found.flat().map(b => b[1])), small = found.flat().find(b => b[1] === L)![0]
        // the row's shared first baseline: the first block of an item that meets the row by its first line
        const lead0 = items.filter(c => c.getAttribute('data-baseline') !== 'last').map(c => blocks.find(el => c === el || c.contains(el))).find(Boolean)
        const y0 = first(lead0 ?? small)
        const push = (kind: 'lines' | 'step', msg: string) => out.push({ kind, row: rowName(box), msg, excused })
        // LINES: a larger lead is a multiple of the step, and its lines are the step's
        for (const [el, lh] of found.flat()) {
          if (lh <= L + 0.01) continue
          judged++
          const n = snap.lines(el, lh), y = first(el)
          const bad = Array.from({ length: n }, (_, k) => y + k * lh).filter(b => off(L, y0, b) > 0.5)
          if (bad.length) push('lines', `${name(el)} at ${lh}px beside ${name(small)} at ${L}px: ${bad.length} of ${n} lines off the step` + (Math.abs(lh / L - Math.round(lh / L)) > 0.01 ? ` (${lh} is not a multiple of ${L})` : ` (first baseline ${(y - y0).toFixed(1)}px from the row's)`))
        }
        // STEP: the step is published, and the row's non-text boxes sit on it
        for (const c of items) {
          const v = parseFloat((c as HTMLElement).style.getPropertyValue('--row-step'))
          if (Math.abs((v || 0) - L) > 0.01) push('step', `${name(c)} carries --row-step ${(c as HTMLElement).style.getPropertyValue('--row-step') || 'none'}, the row's step is ${L}px`)
          const walk = (e: Element) => {
            if (e.matches('[data-nosnap], [data-baseline="free"], script, style, br, wbr')) return
            const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return
            if (hasText(e)) { for (const k of e.children) walk(k); return }
            if (cs.display === 'inline' || e.closest('svg') !== null && e.tagName.toLowerCase() !== 'svg') return
            const r = e.getBoundingClientRect()
            if (r.width < 0.5 || r.height < 0.5) { for (const k of e.children) walk(k); return }
            marks++
            const t = off(L, y0, r.top), m = off(L, y0, (r.top + r.bottom) / 2)
            if (Math.min(t, m) > 0.51) push('step', `${name(e)} top at ${(r.top - y0).toFixed(1)}px, centre at ${((r.top + r.bottom) / 2 - y0).toFixed(1)}px from the row's first baseline: off its ${L}px step by ${Math.min(t, m).toFixed(1)}px`)
          }
          walk(c)
        }
      }
    }
  }
  return { rows, judged, marks, out }
}

const SAFE = () => {   // runs in the page; stringified below
  /* TEXT KEEPS ONE STEP OF WHITE (the safe area). Big text is a TITLE: a measured heading
     (h1-h6) set at 24px or more, never an annotation (.t-micro, .t-ui, .t-label). A specimen or
     a figure set big in a <p> (a role sample, a card's numeral over its caption) is not a title
     and keeps its own spacing. Its step is the --row-step of the row it sits in, or else body's lead.
     The text just above it in its column (the nearest measured block that overlaps it
     horizontally and whose last baseline is above its first) must have its last baseline at
     least one step above the big text's first x-height; the text just below must have its
     first x-height at least one step under the big text's last baseline. Rules, dots and figures are not text: check 8 places
     them. Returns the geometry; the x-heights are measured from pixels by the caller. */
  const snap = (window as any).wmGridSnap, blocks = (snap.blocks as Element[]).filter(e => !e.closest('[data-nosnap]'))
  const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
  const at = (t: Node, after = false) => { after ? t.parentNode!.insertBefore(probe, t.nextSibling) : t.parentNode!.insertBefore(probe, t); const y = probe.getBoundingClientRect().top; probe.remove(); return y }
  const lastText = (el: Element) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent!.trim() ? 1 : 3 }); let t, l = null; while ((t = w.nextNode())) l = t; return l }
  const name = (e: Element) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : (e.getAttribute('class') ? '.' + e.getAttribute('class')!.split(' ')[0] : '')} "${(e.textContent || '').trim().slice(0, 20)}"`
  const keyOf = (e: Element) => { const c = getComputedStyle(e); return [c.fontFamily, c.fontSize, c.fontWeight, c.fontStyle, c.fontStretch, c.fontVariationSettings, c.fontOpticalSizing].join('|') }
  const sample: Record<string, string> = {}
  const tag = (e: Element) => { const k = keyOf(e); if (!(k in sample)) { e.setAttribute('data-xh-sample', String(Object.keys(sample).length)); sample[k] = String(Object.keys(sample).length) } return sample[k] }
  const ANN = '.t-micro, .t-ui, .t-label'
  const geo = (e: Element) => { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0); return rs.length ? { left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)), top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)) } : null }
  // measured once per block: the system page has thousands of blocks and a dozen titles
  const memo = <T,>(f: (e: Element) => T) => { const m = new Map<Element, T>(); return (e: Element) => { if (!m.has(e)) m.set(e, f(e)); return m.get(e)! } }
  const firstB = memo((e: Element) => { const t = snap.firstLine(e) as Node; return t ? at(t) : NaN })
  const lastB = memo((e: Element) => { const t = lastText(e); return t ? at(t, true) : NaN })
  const geoOf = memo(geo)
  const pairs: { big: string; other: string; side: 'above' | 'below'; step: number; bigFirst: number; bigLast: number; otherFirst: number; otherLast: number; bigX: string; otherX: string; excused: boolean }[] = []
  for (const big of blocks) {
    const cs = getComputedStyle(big)
    if (!/^H[1-6]$/.test(big.tagName) || big.closest(ANN) || parseFloat(cs.fontSize) < 24 || cs.getPropertyValue('--snap-unit').trim() === '1') continue
    const g = geoOf(big); if (!g) continue
    const root = big.closest('.wm-lines')!
    let step = 0
    for (let a: Element | null = big; a && a !== root; a = a.parentElement) { const v = parseFloat((a as HTMLElement).style?.getPropertyValue('--row-step') || ''); if (v) { step = v; break } }
    if (!step) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;visibility:hidden;height:0;font-size:var(--type-body-size,1rem);line-height:var(--lead-body,24px)'; root.appendChild(d); step = parseFloat(getComputedStyle(d).lineHeight) || 24; d.remove() }
    const bf = firstB(big), bl = lastB(big)
    let above: [Element, number] | null = null, below: [Element, number] | null = null
    for (const o of blocks) {
      if (o === big || o.contains(big) || big.contains(o) || o.closest('.wm-lines') !== root) continue
      const go = geoOf(o); if (!go || go.right <= g.left + 1 || go.left >= g.right - 1) continue
      const of = firstB(o), ol = lastB(o)
      // by baselines, not boxes: a label pulled up into a title's line box is the case to catch
      if (ol < bf - 0.5) { if (!above || ol > above[1]) above = [o, ol] }
      else if (of > bl + 0.5) { if (!below || of < below[1]) below = [o, of] }
    }
    for (const [o, side] of [[above?.[0], 'above'], [below?.[0], 'below']] as const) {
      if (!o) continue
      pairs.push({ big: name(big), other: name(o), side, step, bigFirst: bf, bigLast: bl, otherFirst: firstB(o), otherLast: lastB(o), bigX: tag(big), otherX: tag(o), excused: !!(o.closest('[data-expect-offender="safe"]') || big.closest('[data-expect-offender="safe"]')) })
    }
  }
  return pairs
}

/* X-HEIGHT, from pixels. Neither the OS/2 table nor canvas will do: Cal Sans's x runs from
   .515 em (opsz 14, wght 400) to .535 (opsz 45, wght 700, GEOM 50), and canvas ignores
   variable axes. So an "x" is set in the sample element's own computed font (size, weight,
   variations and optical sizing copied, so opsz is the same), drawn at 8x by a CSS transform
   (which leaves opsz alone), screenshot, and scanned for its top ink row at half coverage
   against a zero-size baseline probe. 1 screenshot px = 1/8 CSS px, so the error is under
   0.15px; on Cal Sans 45px wght 600 it reads 23.9 against fontTools' 1062/2000 x 45 = 23.9. */
async function xHeights(page: import('@playwright/test').Page): Promise<Record<string, number>> {
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-xh-sample]')].map(e => e.getAttribute('data-xh-sample')!))
  const out: Record<string, number> = {}
  for (const id of ids) {
    const box = await page.evaluate(id => {
      const e = document.querySelector(`[data-xh-sample="${id}"]`)!, c = getComputedStyle(e)
      // 8x, or less for type so big that 8x would not fit the 900px viewport
      const K = Math.max(1, Math.min(8, Math.floor(760 / (parseFloat(c.fontSize) * 1.5))))
      const p = document.createElement('div'); p.id = 'xh-probe'
      p.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;background:#fff;color:#000;padding:0 4px;line-height:normal;white-space:nowrap;transform-origin:0 0;transform:scale(${K});font-family:${c.fontFamily};font-size:${c.fontSize};font-weight:${c.fontWeight};font-style:${c.fontStyle};font-stretch:${c.fontStretch};font-variation-settings:${c.fontVariationSettings};font-optical-sizing:${c.fontOpticalSizing};letter-spacing:0`
      p.innerHTML = 'x<span style="display:inline-block;width:0;height:0;vertical-align:baseline"></span>'
      document.body.appendChild(p)
      const r = p.getBoundingClientRect(), b = p.querySelector('span')!.getBoundingClientRect().top
      return { K, x: Math.floor(r.left), y: Math.floor(r.top), w: Math.ceil(r.width), h: Math.ceil(r.height), base: b - Math.floor(r.top) }
    }, id)
    const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: Math.min(box.w, 2000), height: Math.min(box.h, 2000) }, animations: 'disabled', scale: 'css' })
    const top = await page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data
      // columns at the edges are skipped: the clip rounds out to whole px and takes in the page beside the probe
      for (let y = 0; y < c.height; y++) { let ink = 0; for (let x = 2; x < c.width - 3; x++) ink = Math.max(ink, 255 - d[(y * c.width + x) * 4]); if (ink >= 128) return y }
      return NaN
    }, png.toString('base64'))
    await page.evaluate(() => document.getElementById('xh-probe')?.remove())
    out[id] = (box.base - top) / box.K
  }
  await page.evaluate(() => document.querySelectorAll('[data-xh-sample]').forEach(e => e.removeAttribute('data-xh-sample')))
  return out
}

/* Check 9 (GRID.md §5, 12) from the geometry SAFE returned and the measured x-heights: the offender list. */
function safeArea(pairs: Awaited<ReturnType<typeof SAFE>>, xh: Record<string, number>) {
  const off: { msg: string; excused: boolean }[] = []
  const push = (p: { excused: boolean }, msg: string) => off.push({ msg, excused: p.excused })
  for (const p of pairs) {
    if (p.side === 'above') {
      const limit = p.bigFirst - xh[p.bigX] - p.step, short = p.otherLast - limit
      if (short > 0.5) push(p, `${p.other} above ${p.big}: last baseline ${(p.bigFirst - p.otherLast).toFixed(1)}px over its first baseline, inside the safe area (x-height ${xh[p.bigX].toFixed(1)} + step ${p.step} = ${(xh[p.bigX] + p.step).toFixed(1)}), ${short.toFixed(1)}px short`)
    } else {
      const nextX = p.otherFirst - xh[p.otherX], short = p.bigLast + p.step - nextX
      if (short > 0.5) push(p, `${p.other} below ${p.big}: its x-height ${(nextX - p.bigLast).toFixed(1)}px under the last baseline, inside the safe area (step ${p.step}), ${short.toFixed(1)}px short`)
    }
  }
  return off
}

const MARGIN = () => {   // runs in the page; stringified below
  // the house margin, resolved: --grid-margin is a clamp(), so measure it with a probe
  // Resolved INSIDE each root, not on <html>: a tool's .wm-grid--bleed on main or body sets it
  // to 0 below the document, and a page may hold a bleed root beside a margined one.
  const len = (at: Element, v: string) => { const pr = document.createElement('div'); pr.style.cssText = `position:absolute;visibility:hidden;height:0;padding:0;border:0;width:${v}`
    at.appendChild(pr); const w = pr.getBoundingClientRect().width; pr.remove(); return w }
  // A BLEED ROOT (.wm-grid--bleed, on a grid or an ancestor): no margin by design. Its text keeps
  // one gutter from the window edge instead, resolved there (12px on a phone).
  const bleedRoot = (e: Element) => e.closest('.wm-grid--bleed')
  const roots = [...document.querySelectorAll('.wm-lines')]
  const paged = roots.filter(r => !bleedRoot(r))
  const pageBleed = roots.length > 0 && !paged.length
  const ref = paged[0] ?? roots[0] ?? document.body
  const raw = getComputedStyle(ref).getPropertyValue('--grid-margin').trim()
  const margin = len(ref, 'var(--grid-margin)')
  const marginOf = new Map<Element, number>()
  let nBleed = 0, gutter = 0
  const vw = document.documentElement.clientWidth, snap = (window as any).wmGridSnap;
  // an inset scroller (a strip that scrolls inside the margin on purpose) is judged by its own box, not its text
  const inset = (e: Element) => { for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { if (getComputedStyle(a).overflowX !== 'visible') { const r = a.getBoundingClientRect(); if (r.left > 1 || r.right < vw - 1) return true } } return false };
  // a scroller's far content is clipped, not out of margin: only its start edge is judged
  const clipped = (e: Element) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible' && a.scrollWidth > a.clientWidth + 1) return true; return false };
  const off: string[] = []; let minLeft = Infinity, maxRight = -Infinity, n = 0;
  for (const el of snap.blocks as Element[]) {
    if (el.closest('[data-nosnap]') || /absolute|fixed/.test(getComputedStyle(el).position) || inset(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(el);
    const rects = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0); if (!rects.length) continue;
    const left = Math.min(...rects.map(r => r.left)), right = Math.max(...rects.map(r => r.right)); n++;
    minLeft = Math.min(minLeft, left); if (!clipped(el)) maxRight = Math.max(maxRight, right);
    const name = `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}`;
    const r0 = el.closest('.wm-lines') ?? ref
    if (!marginOf.has(r0)) marginOf.set(r0, len(r0, 'var(--grid-margin)'))
    const b = bleedRoot(el), lim = b ? len(b, 'var(--grid-gutter)') : marginOf.get(r0)!, what = b ? 'bleed root, one gutter' : 'margin'
    if (b) { nBleed++; gutter = lim }
    if (left < lim - 1) off.push(`${name} at ${Math.round(left)}px, ${what} is ${Math.round(lim)}px`);
    if (right > vw - lim + 1 && !clipped(el)) off.push(`${name} ends at ${Math.round(right)}px, ${what} is ${Math.round(lim)}px (limit ${Math.round(vw - lim)}px)`);
  }
  return { raw, margin, n, nBleed, gutter, pageBleed, minLeft, maxRight, vw, off: off.slice(0, 12) };
}

for (const pg of PAGES) {
  test.describe(`${pg.name} · on the line`, () => {
    test.skip(({ hasTouch }) => hasTouch, 'widths are the axis here, not the input')
    test.skip(!!pg.dir && !existsSync(resolve(pg.dir, pg.url.replace(/^\/[^/]+\//, '') + (pg.url.endsWith('/') ? 'index.html' : ''))), `no checkout at ${pg.dir} (WORDMARK_DIR, RECAL_DIST, FONT_PROOFER_DIST)`)

    for (const w of WIDTHS) {
      test(`${pg.name} · ${w}px`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 })
        await page.goto(pg.url)
        await page.evaluate(() => document.fonts.ready)
        // one more pass after the page's own scripts have sized things, then let it land
        await page.waitForFunction(() => typeof (window as any).wmGridSnap === 'function')
        await page.evaluate(() => (window as any).wmGridSnap())
        await page.waitForTimeout(400)

        const r = await page.evaluate(() => {
          const snap = (window as any).wmGridSnap
          const probe = document.createElement('span')
          probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
          const textOf = (el: Element) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent!.trim() ? 1 : 3 }); return w.nextNode() }
          const lastTextOf = (el: Element) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent!.trim() ? 1 : 3 }); let t, l = null; while ((t = w.nextNode())) l = t; return l }
          const at = (t: Node, after = false) => { after ? t.parentNode!.insertBefore(probe, t.nextSibling) : t.parentNode!.insertBefore(probe, t); const y = probe.getBoundingClientRect().top; probe.remove(); return y }
          const off: string[] = []
          for (const el of snap.blocks as Element[]) {
            const root = el.closest('.wm-lines')!, bl = parseFloat(getComputedStyle(root).getPropertyValue('--bl')) || 3
            const t = snap.firstLine(el); if (!t) continue   // the line the snapper measured
            const y = at(t) - root.getBoundingClientRect().top, m = ((y % bl) + bl) % bl
            if (Math.min(m, bl - m) > 0.1) off.push(`${el.tagName.toLowerCase()}.${(el.className + '').split(' ')[0]} "${el.textContent!.trim().slice(0, 24)}" ${m.toFixed(2)}px off`)
            // the lines after the first: the snapper only moves a block's first line, so a
            // block of more than one line needs a leading in whole units or line 2 drifts
            const lh = parseFloat(getComputedStyle(el).lineHeight), h = el.getBoundingClientRect().height
            if (lh && h > lh * 1.5) { const lm = lh % bl; if (Math.min(lm, bl - lm) > 0.05) off.push(`${el.tagName.toLowerCase()}.${(el.className + '').split(' ')[0]} "${el.textContent!.trim().slice(0, 24)}" leading ${lh}px is not whole units -- its later lines drift`) }
          }
          const rows: string[] = []
          for (const box of document.querySelectorAll('.wm-lines .wm-baselines')) {
            // group by the box BEFORE grid.css's baseline nudge (a relative `top`), as gridSnap does
            const byTop = new Map<number, Element[]>()
            for (const c of box.children) { const r = c.getBoundingClientRect(); if (!r.height || !textOf(c)) continue; const cs = getComputedStyle(c); const k = Math.round(r.top - (cs.position === 'relative' ? parseFloat(cs.top) || 0 : 0)); const key = [...byTop.keys()].find(x => Math.abs(x - k) <= 1) ?? k; (byTop.get(key) ?? byTop.set(key, []).get(key)!).push(c) }
            for (const items of byTop.values()) if (items.length > 1) {
              const ys = items.map(c => c.getAttribute('data-baseline') === 'last' ? at(lastTextOf(c)!, true) : at(textOf(c)!))
              const spread = Math.max(...ys) - Math.min(...ys)
              if (spread > 0.25) rows.push(`${(box.className + '').split(' ')[0]} row of ${items.length}: first baselines ${spread.toFixed(1)}px apart`)
            }
          }
          return { measured: snap.blocks.length, off, rows, refused: snap.refused.map((x: any) => `${x.shift}px (cap ${x.cap})`) }
        })

        expect(r.measured, 'the snapper measured nothing -- is gridSnap.js loaded and the page .wm-lines?').toBeGreaterThan(5)
        expect(r.off, `text blocks off the 3px line:\n${r.off.join('\n')}`).toEqual([])
        expect(r.rows, `rows that do not share a baseline:\n${r.rows.join('\n')}`).toEqual([])
        expect(r.refused, `row shifts the snapper refused (a row matched the wrong text):\n${r.refused.join('\n')}`).toEqual([])

        const l = await page.evaluate(fn => new Function('return (' + fn + ')()')(fn), LAYOUT.toString()) as { narrow: string[]; overlap: string[] }
        expect(l.narrow, `boxes narrower than their contents:\n${l.narrow.join('\n')}`).toEqual([])
        expect(l.overlap, `siblings drawn over each other:\n${l.overlap.join('\n')}`).toEqual([])

        // UNITS: every text run in a --snap-unit: 1 component shares the unit's first baseline (data-baseline="free" opts out)
        const un = await page.evaluate(fn => new Function('return (' + fn + ')()')(fn), UNITS.toString()) as { units: number; runs: number; off: string[] }
        console.log(`units ${pg.name} ${w}: ${un.units} units, ${un.runs} text runs`)
        expect(un.off, `text inside a unit that does not share the unit's baseline (mark the unit or run data-baseline="free" with a reason if it is meant to hang):\n${un.off.join('\n')}`).toEqual([])

        // ROWS: side-by-side text shares its lines (7), and the row's folio boxes sit on its step (8)
        const known = (KNOWN[pg.name] ?? []).filter(k => !k.below || w < k.below).map(k => k.row)
        const rw = await page.evaluate(([fn, k]) => new Function('return (' + fn + ')')()(k), [ROWS.toString(), known] as const) as { rows: number; judged: number; marks: number; out: { kind: string; row: string; msg: string; excused: string }[] }
        console.log(`rows ${pg.name} ${w}: ${rw.rows} rows of side-by-side text, ${rw.judged} larger-lead blocks, ${rw.marks} folio boxes judged`)
        for (const o of rw.out.filter(o => o.excused)) console.log(`  KNOWN OFFENDER (${o.excused}) ${o.row}: ${o.msg}`)
        const lines = rw.out.filter(o => !o.excused && o.kind === 'lines').map(o => `${o.row}: ${o.msg}`)
        const steps = rw.out.filter(o => !o.excused && o.kind === 'step').map(o => `${o.row}: ${o.msg}`)
        expect(lines, `a row that does not share its lines (size the larger text so its lead is a multiple of the row's smallest text lead):\n${lines.join('\n')}`).toEqual([])
        expect(steps, `folio elements off the row step (place them at multiples of var(--row-step) from the shared first baseline, or data-baseline="free" with a reason):\n${steps.join('\n')}`).toEqual([])

        // SAFE: one step of white around big text (data-expect-offender="safe" rows are the fixture's negative case)
        const pairs = await page.evaluate(fn => new Function('return (' + fn + ')()')(fn), SAFE.toString()) as Awaited<ReturnType<typeof SAFE>>
        const sf = safeArea(pairs, await xHeights(page))
        console.log(`safe ${pg.name} ${w}: ${pairs.length} neighbours of big text judged` + sf.map(o => `\n  ${o.excused ? 'EXPECTED OFFENDER ' : ''}${o.msg}`).join(''))
        const unsafe = sf.filter(o => !o.excused).map(o => o.msg)
        expect(unsafe, `text inside the safe area of big text (one step of white from its x-height; set the margin in var(--row-step) or the lead):\n${unsafe.join('\n')}`).toEqual([])

        // MARGIN: the copy sits inside the house margin, both sides (a page with ownEdges answers to its shell)
        const m = await page.evaluate(fn => new Function('return (' + fn + ')()')(fn), MARGIN.toString()) as { raw: string; margin: number; n: number; nBleed: number; gutter: number; pageBleed: boolean; minLeft: number; maxRight: number; vw: number; off: string[] }
        if (pg.ownEdges) return
        console.log(`margin ${pg.name} ${w}: --grid-margin ${m.raw} = ${m.margin}px, ${m.n} blocks, smallest left ${m.minLeft.toFixed(1)}px, largest right ${m.maxRight.toFixed(1)}px of ${m.vw}`
          + (m.nBleed ? ` -- EXEMPT from the margin: ${m.nBleed} blocks in a .wm-grid--bleed root, judged against one gutter (${m.gutter}px)` : ''))
        // a bleed page's margin is 0 by design; the margined page's must resolve
        if (!m.pageBleed) expect(m.margin, '--grid-margin did not resolve -- is grid.css loaded?').toBeGreaterThan(0)
        else expect(m.margin, 'a .wm-grid--bleed root has no margin').toBe(0)
        expect(m.off, `text outside the ${Math.round(m.margin)}px margin (an unlayered reset wiping .wm-grid padding-inline?):\n${m.off.join('\n')}`).toEqual([])
      })
    }
  })
}

/* PAGES AND TOOLS, by geometry (src/grid.css, Mark 2026-10-04). The page loop above says the
   text keeps its distance; this says the boxes are where the API promises:
     - a .wm-grid--bleed root has no margin: a box in column 1 starts at x=0, and its text one
       gutter in; a box ending in the last column holds its text one gutter from the right;
     - a .wm-break's box runs from x=0 to the window's width, its text sits at the margin, and a
       .wm-cols inside it lands on the page's own columns; a .wm-break--left keeps its span;
     - a [data-shot="mac"] image's WINDOW (the file less its shadow: 72 / 72 / 48.9 / 95.2 of the
       fixture's 2000 x 1305 file, --shot-scale .643) is exactly its cell, and what follows it
       starts where the window ends. */
test.describe('bleed, breakers, mac shot · geometry', () => {
  for (const w of [1440, 900, 390]) {
    test(`fixture · ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 })
      await page.goto('/dial/grid-bleed.html')
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => { const i = document.getElementById('shot') as HTMLImageElement; return i.complete && i.naturalWidth > 0 && !!i.style.getPropertyValue('--shot-w') })
      await page.waitForTimeout(200)
      const g = await page.evaluate(() => {
        const $ = (id: string) => document.getElementById(id)!
        const R = (id: string) => $(id).getBoundingClientRect()
        const text = (id: string) => { const rg = document.createRange(); rg.selectNodeContents($(id)); const rs = [...rg.getClientRects()].filter(r => r.width > 0); return { left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)) } }
        const content = (id: string) => { const r = R(id), c = getComputedStyle($(id)); return { left: r.left + parseFloat(c.paddingLeft), right: r.right - parseFloat(c.paddingRight) } }
        const len = (at: Element, v: string) => { const p = document.createElement('div'); p.style.cssText = `position:absolute;height:0;padding:0;border:0;width:${v}`; at.appendChild(p); const x = p.getBoundingClientRect().width; p.remove(); return x }
        const vw = document.documentElement.clientWidth
        const gutter = len($('bleed'), 'var(--grid-gutter)'), margin = len($('page'), 'var(--grid-margin)'), bleedMargin = len($('bleed'), 'var(--grid-margin)')
        const s = R('shot'), k = s.width / 2000
        return { vw, gutter, margin, bleedMargin,
          rail: R('rail'), railT: text('rail-t'), insp: R('insp'), inspC: content('insp'), full: content('full'),
          brk: R('brk'), brkT: text('brk-t'), brkA: R('brk-a'), brkB: R('brk-b'), ref12: R('ref12'), lead: R('lead'),
          brkL: R('brk-l'), brkLT: text('brk-l-t'), strip: R('strip'),
          win: { left: s.left + 72 * k, right: s.right - 72 * k, top: s.top + 76 * .643 * k, bottom: s.bottom - 148 * .643 * k },
          cell: R('cell'), after: R('after') }
      })
      const near = (a: number, b: number, what: string, tol = 1) => expect(Math.abs(a - b), `${what}: ${a.toFixed(1)} vs ${b.toFixed(1)}`).toBeLessThanOrEqual(tol)

      // the tool: no margin, columns to the edge, text one gutter in
      expect(g.bleedMargin, 'a .wm-grid--bleed root has no margin').toBe(0)
      near(g.rail.left, 0, 'the rail box starts at the window edge')
      near(g.railT.left, g.gutter, 'the rail text sits one gutter in')
      near(g.insp.right, g.vw, 'the inspector box ends at the window edge')
      near(g.inspC.right, g.vw - g.gutter, 'the inspector text ends one gutter in')
      near(g.full.left, g.gutter, 'full-width text, left'); near(g.full.right, g.vw - g.gutter, 'full-width text, right')

      // the page: breakers reach the edge, their words do not
      expect(g.margin).toBeGreaterThan(0)
      near(g.brk.left, 0, 'the breaker box starts at x=0'); near(g.brk.right, g.vw, 'the breaker box ends at the window width')
      near(g.strip.left, 0, 'the picture strip starts at x=0'); near(g.strip.right, g.vw, 'the picture strip ends at the window width')
      near(g.brkT.left, g.margin, 'text in a breaker sits at the margin')
      near(g.brkA.left, g.lead.left, '.wm-cols in a breaker: its first column is the page\'s')
      near(g.brkA.right, g.ref12.right, '.wm-cols in a breaker: its half ends where the page\'s half does')
      near(g.brkB.right, g.vw - g.margin, '.wm-cols in a breaker: its last column ends on the margin')
      near(g.brkL.left, 0, 'the left breaker starts at x=0'); near(g.brkL.right, g.ref12.right, 'the left breaker keeps its span')
      near(g.brkLT.left, g.margin, 'text in a left breaker sits at the margin')

      // the mac shot: the window is the cell, and the layout ends with it
      near(g.win.left, g.cell.left, 'the window\'s left edge on the column'); near(g.win.right, g.cell.right, 'the window\'s right edge on the column')
      near(g.win.top, g.cell.top, 'the window\'s top is the cell\'s'); near(g.win.bottom, g.cell.bottom, 'the window\'s bottom is the cell\'s')
      expect(g.after.top - g.win.bottom, 'the next line follows the window, not the shadow').toBeGreaterThanOrEqual(23)
    })
  }
})

/* THE ROW STEP, by number (tests/fixtures/grid-step.html). Where the columns sit side by side
   (from 1024), each row's items carry the --row-step its data-expect-step names ("none": no
   side-by-side text, so none), and each data-expect-offender row IS reported by the check it
   names -- the page loop above excuses those rows, so this is what keeps the checks honest.
   The eyebrow pair is the safe area's: on line 0 it passes, 30px up it is reported. */
test.describe('row step · by number', () => {
  test.skip(({ hasTouch }) => hasTouch, 'widths are the axis here, not the input')
  for (const w of [1440, 1024]) {
    test(`fixture · ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 })
      await page.goto('/dial/grid-step.html')
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => typeof (window as any).wmGridSnap === 'function')
      await page.evaluate(() => (window as any).wmGridSnap())
      await page.waitForTimeout(300)
      const got = await page.evaluate(() => [...document.querySelectorAll('[data-expect-step]')].map(s => ({
        id: s.id, want: s.getAttribute('data-expect-step')!, offender: s.getAttribute('data-expect-offender') ?? '',
        got: [...new Set([...s.children].map(c => (c as HTMLElement).style.getPropertyValue('--row-step') || 'none'))].join('|') })))
      const rw = await page.evaluate(([fn, k]) => new Function('return (' + fn + ')')()(k), [ROWS.toString(), [] as string[]] as const) as { out: { kind: string; row: string; msg: string; excused: string }[] }
      console.log(`row step fixture ${w}: ` + got.map(g => `#${g.id} ${g.got}`).join(', ') + '\n' + rw.out.map(o => `  ${o.kind} ${o.row}: ${o.msg}`).join('\n'))
      expect(got.filter(g => g.got.replace(/px$/, '') !== g.want).map(g => `#${g.id}: --row-step ${g.got}, want ${g.want}`)).toEqual([])
      for (const g of got.filter(g => g.offender))
        expect(rw.out.filter(o => o.row === 'section#' + g.id && o.kind === g.offender).length, `#${g.id} should be reported by the "${g.offender}" check`).toBeGreaterThan(0)
      // and nothing else is: the passing rows pass
      expect(rw.out.filter(o => !got.some(g => g.offender && o.row === 'section#' + g.id && o.kind === g.offender)).map(o => `${o.row}: ${o.msg}`)).toEqual([])
      // the safe area: the eyebrow on line 0 (#e6, -48) passes, the one at -30 (#e7) is reported
      const sf = safeArea(await page.evaluate(fn => new Function('return (' + fn + ')()')(fn), SAFE.toString()) as Awaited<ReturnType<typeof SAFE>>, await xHeights(page))
      expect(sf.filter(o => /^p#e7 /.test(o.msg)).length, '#e7 (an eyebrow 30px over a 45/48 headline) should be reported by "text keeps one step of white"').toBe(1)
      expect(sf.filter(o => !/^p#e7 /.test(o.msg)).map(o => o.msg)).toEqual([])
    })
  }
})

/* --grid-col IS A COLUMN (src/grid.css). A child of .wm-grid or .wm-cols can read one column as
   a length, and .wm-card's padding is built from it. The value was measured from 100cqw less
   twice the margin; but 100cqw is the container's CONTENT box, which already excludes
   .wm-grid's padding-inline, so the margin came off twice: at 1440 a column computed 20.2px
   against a real 28.6px, and every .wm-card started ~8px short of the column line. .wm-cols
   (no padding) was right all along. This reads --grid-col through a probe (width: var(--grid-col))
   and compares it with the width of a track, as the browser laid the grid out. */
test.describe('--grid-col · is a column', () => {
  test.skip(({ hasTouch }) => hasTouch, 'widths are the axis here, not the input')
  for (const w of [1440, 390]) {
    test(`.wm-grid and .wm-cols · ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 })
      await page.goto('/grid/grid.html')
      await page.evaluate(() => document.fonts.ready)
      const r = await page.evaluate(() => {
        const out: { kind: string; cols: number; track: number; first: number; probe: number }[] = []
        for (const kind of ['wm-grid', 'wm-cols']) {
          const host = document.createElement('div')
          host.className = kind; host.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden'
          const n = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-cols'))
          for (let i = 0; i < n; i++) {
            const c = document.createElement('div'); c.style.cssText = '--span:1;--span-md:1;height:1px'
            if (!i) { const p = document.createElement('div'); p.style.cssText = 'height:0;width:var(--grid-col)'; p.className = 'probe'; c.appendChild(p) }
            host.appendChild(c)
          }
          document.body.appendChild(host)
          const tracks = getComputedStyle(host).gridTemplateColumns.split(' ').map(parseFloat)
          out.push({ kind, cols: tracks.length, track: tracks[0], first: host.children[0].getBoundingClientRect().width, probe: host.querySelector('.probe')!.getBoundingClientRect().width })
          host.remove()
        }
        return out
      })
      for (const k of r) {
        expect(k.cols, `${k.kind} has columns`).toBeGreaterThan(1)
        expect(Math.abs(k.first - k.track), `${k.kind}: a span-1 child is one track`).toBeLessThan(0.5)
        expect(Math.abs(k.probe - k.track), `${k.kind} at ${w}px: --grid-col is ${k.probe.toFixed(2)}px, a real column is ${k.track.toFixed(2)}px`).toBeLessThan(0.5)
      }
    })
  }
})
