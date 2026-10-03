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
   It judges window.wmGridSnap.blocks, exactly what the snapper judged, so ornaments placed
   on purpose (a pill's arrow, a deck counter) drop out by the same rule that skips them,
   not by a list kept here. */

const PAGES = [
  { name: 'grid demo', url: '/grid/grid.html' },
  // The system page: <main> is the root. On the line are the shell's copy, the README and
  // the Grid part of Type; the other chapters are stages, data-nosnap (build.py OFF_LINE
  // says what each would need), so the layout check skips them by the same rule.
  { name: 'system page', url: '/grid/index.html' },
  { name: 'Cal Sans case study', url: '/wordmark/calsans/', dir: process.env.WORDMARK_DIR ?? resolve('../wordmark') },
]
const WIDTHS = [1440, 900, 390]

const LAYOUT = () => {   // runs in the page; stringified below
  const vis = e => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0.05 && c.display !== 'contents' && !/absolute|fixed/.test(c.position) };
  const skip = e => e.closest('[data-nosnap], svg') || !vis(e);
  const narrow = [], overlap = [];
  for (const el of document.querySelectorAll('main *')) {
    if (skip(el)) continue;
    const c = getComputedStyle(el); if (c.display === 'inline' || c.overflowX !== 'visible' || c.whiteSpace === 'nowrap') continue;
    const b = el.getBoundingClientRect(); if (b.width < 1) continue;
    let extent = -Infinity;
    for (const k of el.children) { const kc = getComputedStyle(k); if (vis(k) && kc.position !== 'absolute' && kc.position !== 'fixed') extent = Math.max(extent, k.getBoundingClientRect().right); }
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { const rg = document.createRange(); rg.selectNodeContents(el); extent = Math.max(extent, rg.getBoundingClientRect().right); }
    if (extent > b.right + 2) narrow.push(`${el.tagName.toLowerCase()}.${(el.className + '').split(' ')[0]} is ${Math.round(b.width)}px wide with ${Math.round(extent - b.left)}px inside`);
  }
  for (const box of document.querySelectorAll('main *')) {
    if (skip(box) || !/grid|flex/.test(getComputedStyle(box).display)) continue;
    const kids = [...box.children].filter(vis).map(c => [c, c.getBoundingClientRect()]).filter(([, r]) => r.width > 4 && r.height > 4);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const [a, ra] = kids[i], [b2, rb] = kids[j];
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 4 && oy > 4) overlap.push(`${(box.className + '').split(' ')[0] || box.tagName}: ${(a.className + '').split(' ')[0] || a.tagName} and ${(b2.className + '').split(' ')[0] || b2.tagName} overlap by ${Math.round(ox)}x${Math.round(oy)}`);
    }
  }
  return { narrow: narrow.slice(0, 8), overlap: overlap.slice(0, 8) };
}

for (const pg of PAGES) {
  test.describe(`${pg.name} · on the line`, () => {
    test.skip(({ hasTouch }) => hasTouch, 'widths are the axis here, not the input')
    test.skip(!!pg.dir && !existsSync(resolve(pg.dir, 'calsans/index.html')), 'no wordmark checkout (WORDMARK_DIR)')

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
      })
    }
  })
}
