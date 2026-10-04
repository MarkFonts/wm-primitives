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
     6. units share a baseline: every text run inside a --snap-unit: 1 component (a slider row,
        a chip row, a rail row) has the SAME baseline as the unit's first run, within 0.5px,
        unless the unit is data-baseline="free". The row rule (2) aligns siblings of a
        .wm-baselines grid; nothing held the text INSIDE one component together, and a rail
        row's value field drifted below its label with every other check green.
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
  // ReCal's eight compare pages (scripts/gen-landing.mjs): the article under the app is the
  // .wm-lines root; the app above it is outside the root, the specimen is data-nosnap.
  ...['poppins', 'inter', 'geist', 'futura', 'neutra', 'circular', 'gotham', 'gt-america'].map(slug =>
    ({ name: `ReCal /${slug}/`, url: `/recalsans/${slug}/`, dir: process.env.RECAL_DIST ?? resolve('../ReCal/dist') })),
  // The two apps, TOOLS: #root is the .wm-lines root, the rail and the chrome on the line,
  // the specimen / proof sheet / UI board stages (data-nosnap). RECAL_DIST / FONT_PROOFER_DIST,
  // the builds tests/serve.mjs serves. Tools are .wm-grid--bleed (no margin, text one gutter
  // from the window), so like the system page they opt out of the page-margin check.
  { name: 'ReCal app', url: '/recalsans/', ownEdges: true, dir: process.env.RECAL_DIST ?? resolve('../ReCal/dist') },
  { name: 'font-proofer', url: '/font-proofer/', ownEdges: true, dir: process.env.FONT_PROOFER_DIST ?? resolve('../font-proofer/dist') },
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

const MARGIN = () => {   // runs in the page; stringified below
  // the house margin, resolved: --grid-margin is a clamp(), so measure it with a probe
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--grid-margin').trim();
  const pr = document.createElement('div'); pr.style.cssText = 'position:absolute;visibility:hidden;height:0;width:var(--grid-margin)';
  document.body.appendChild(pr); const margin = pr.getBoundingClientRect().width; pr.remove();
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
    if (left < margin - 1) off.push(`${name} at ${Math.round(left)}px, margin is ${Math.round(margin)}px`);
    if (right > vw - margin + 1 && !clipped(el)) off.push(`${name} ends at ${Math.round(right)}px, margin is ${Math.round(margin)}px (limit ${Math.round(vw - margin)}px)`);
  }
  return { raw, margin, n, minLeft, maxRight, vw, off: off.slice(0, 12) };
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

        // UNITS: every text run in a --snap-unit: 1 component shares the unit's first baseline (data-baseline="free" opts out)
        const un = await page.evaluate(fn => new Function('return (' + fn + ')()')(fn), UNITS.toString()) as { units: number; runs: number; off: string[] }
        console.log(`units ${pg.name} ${w}: ${un.units} units, ${un.runs} text runs`)
        expect(un.off, `text inside a unit that does not share the unit's baseline (mark the unit or run data-baseline="free" with a reason if it is meant to hang):\n${un.off.join('\n')}`).toEqual([])

        // MARGIN: the copy sits inside the house margin, both sides (a page with ownEdges answers to its shell)
        const m = await page.evaluate(fn => new Function('return (' + fn + ')()')(fn), MARGIN.toString()) as { raw: string; margin: number; n: number; minLeft: number; maxRight: number; vw: number; off: string[] }
        if (pg.ownEdges) return
        console.log(`margin ${pg.name} ${w}: --grid-margin ${m.raw} = ${m.margin}px, ${m.n} blocks, smallest left ${m.minLeft.toFixed(1)}px, largest right ${m.maxRight.toFixed(1)}px of ${m.vw}`)
        expect(m.margin, '--grid-margin did not resolve -- is grid.css loaded?').toBeGreaterThan(0)
        expect(m.off, `text outside the ${Math.round(m.margin)}px margin (an unlayered reset wiping .wm-grid padding-inline?):\n${m.off.join('\n')}`).toEqual([])
      })
    }
  })
}
