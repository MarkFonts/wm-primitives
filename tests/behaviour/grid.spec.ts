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
]
const WIDTHS = [1440, 900, 390]

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
    test.skip(!!pg.dir && !existsSync(resolve(pg.dir, pg.url.replace('/wordmark/', '') + (pg.url.endsWith('/') ? 'index.html' : ''))), 'no wordmark checkout (WORDMARK_DIR)')

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
            const byTop = new Map<number, Element[]>()
            for (const c of box.children) { const r = c.getBoundingClientRect(); if (!r.height || !textOf(c)) continue; const k = Math.round(r.top); const key = [...byTop.keys()].find(x => Math.abs(x - k) <= 1) ?? k; (byTop.get(key) ?? byTop.set(key, []).get(key)!).push(c) }
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
