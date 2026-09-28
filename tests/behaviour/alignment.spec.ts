import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sealed, settle } from '../render/hosts'

/* ALIGNMENT IS A RENDERED FACT, NOT A CSS LITERAL. The token lint holds every padding,
   gap and margin to the scale, and none of that says two labels sit on one line: that
   is a sum -- rail 16 + border 1 + padding 12 -- typed by hand in two places, and true
   only until one of them changes. It happened (2026-09-24): ReCal's mode label sat 4px
   lower on Paragraph than on any other mode, and its set-chip row was inset 5px against
   chips that pad 4. Nothing red.

   So this reads the page. For each host, at one width, the left edge of the TEXT (a
   Range over the contents, not the element's box -- a box aligned at 16 with its text
   at 29 is the normal case, and the text is what the eye lines up) of every element
   alignment-lines.json names, and each must land on one of that region's named lines.
   The lines carry their arithmetic; a line marked `open` is a disagreement recorded so
   the spec is green today and deleted the day it is fixed, like parity-allow.json.

   Baselines are the other half: pairs across the rail/canvas split that share a line,
   checked in every canvas mode (ReCal's two header rows sat 2px and 1px apart until
   2026-09-27). The probe is a zero-size inline-block before the first text node, so a
   flex button or a two-line caption reports its first line, not its box. */

type Line = { x: number; why: string; open?: string }
type Region = { where: string; selectors: string[]; lines: Record<string, Line> }
type Pair = { a: string; b: string; why: string; every?: boolean }
type Host = { url: string; regions: Record<string, Region>; baselines?: { modes?: string; pairs: Pair[]; steady?: { selector: string; why: string } } }
const SPEC = JSON.parse(readFileSync(fileURLToPath(new URL('alignment-lines.json', import.meta.url)), 'utf8')) as {
  tolerance: number; hosts: Record<string, Host>
}

for (const [host, h] of Object.entries(SPEC.hosts)) {
  test.describe(`${host} · every label sits on a named line`, () => {
    test.skip(({ hasTouch }) => hasTouch, 'one width, one profile')

    test(`${host} · left edges`, async ({ page }) => {
      await sealed(page)
      await page.setViewportSize({ width: 1500, height: 900 })
      await page.goto(h.url)
      await settle(page)

      const problems: string[] = []
      const census: string[] = []
      for (const [region, r] of Object.entries(h.regions)) {
        const found = await page.evaluate(sel => {
          const out: { t: string; cls: string; x: number; left: number }[] = []
          for (const el of document.querySelectorAll(sel)) {
            const box = el.getBoundingClientRect()
            if (!box.width || !box.height) continue
            const rg = document.createRange(); rg.selectNodeContents(el)
            const tr = rg.getBoundingClientRect()
            if (!tr.width) continue
            out.push({ t: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24), cls: (el.getAttribute('class') || '').split(' ')[0], x: +tr.left.toFixed(1), left: box.left })
          }
          return out
        }, r.selectors.join(', '))
        /* `where` bounds the region by the element's box, so a selector that matches on
           both sides of the split (a dial row in the rail and one in the type panel) is
           judged against the right lines. */
        const m = /under (\d+)px|from (\d+)px/.exec(r.where)
        const inRegion = (left: number) => m?.[1] ? left < +m[1] : m?.[2] ? left >= +m[2] : true
        const lines = Object.entries(r.lines)
        let onLine = 0
        for (const e of found.filter(e => inRegion(e.left))) {
          const hit = lines.find(([, l]) => Math.abs(l.x - e.x) <= SPEC.tolerance)
          if (hit) { onLine++; continue }
          const nearest = lines.reduce((a, b) => Math.abs(b[1].x - e.x) < Math.abs(a[1].x - e.x) ? b : a)
          problems.push(`${host} ${region}: "${e.t}" [.${e.cls}] text starts at ${e.x}px -- on no line; nearest is ${nearest[0]} at ${nearest[1].x} (${nearest[1].why})`)
        }
        census.push(`${host} ${region}: ${onLine} on the ${lines.length} named lines (${lines.map(([n, l]) => `${n} ${l.x}${l.open ? '*' : ''}`).join(', ')})`)
      }
      console.log(census.join('\n'))
      expect(problems, problems.join('\n')).toEqual([])
    })
  })
}

/* Every visible element the selector finds, each measured at its first text line.
   One function, stringified into the page, so the probe is the same everywhere. */
const baselines = (sel: string) => {
  const out: number[] = []
  for (const e of document.querySelectorAll(sel)) {
    const box = e.getBoundingClientRect()
    if (!box.width || !box.height) continue
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent!.trim() ? 1 : 3 })
    const t = w.nextNode()
    if (!t) continue
    const wrap = document.createElement('span'); t.parentNode!.insertBefore(wrap, t); wrap.appendChild(t)
    const probe = document.createElement('span')
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    wrap.prepend(probe)
    out.push(+probe.getBoundingClientRect().top.toFixed(1))
    wrap.replaceWith(t)
  }
  return out
}

for (const [host, h] of Object.entries(SPEC.hosts)) {
  if (!h.baselines) continue
  const bl = h.baselines
  test.describe(`${host} · baselines across the split`, () => {
    test.skip(({ hasTouch }) => hasTouch, 'one width, one profile')

    test(`${host} · baselines`, async ({ page }) => {
      await sealed(page)
      await page.setViewportSize({ width: 1500, height: 900 })
      await page.goto(h.url)
      await settle(page)

      const modes = bl.modes ? await page.locator(bl.modes).count() : 1
      const problems: string[] = []
      const steady: [string, number][] = []
      for (let i = 0; i < modes; i++) {
        let mode = '(page)'
        if (bl.modes) {
          const tab = page.locator(bl.modes).nth(i)
          mode = (await tab.textContent())!.trim()
          await tab.click()
          await page.waitForTimeout(300)
        }
        const measure = (sel: string) => page.evaluate(([fn, s]) => new Function('return ' + fn)()(s), [baselines.toString(), sel] as const) as Promise<number[]>
        for (const pr of bl.pairs) {
          const [a] = await measure(pr.a)
          // `every`: each element b finds must sit on a's line, not just the first
          const bs = pr.every ? await measure(pr.b) : (await measure(pr.b)).slice(0, 1)
          if (a === undefined || !bs.length) continue     // a submenu that this mode does not draw
          for (const b of bs)
            if (Math.abs(a - b) > SPEC.tolerance)
              problems.push(`${host} ${mode}: ${pr.a} at ${a} vs ${pr.b} at ${b} (${(b - a).toFixed(1)}px) -- ${pr.why}`)
        }
        if (bl.steady) {
          const [y] = await measure(bl.steady.selector)
          if (y !== undefined) steady.push([mode, y])
        }
      }
      // `steady`: the row may not move as the modes change what it holds
      if (bl.steady && steady.length) {
        const [m0, y0] = steady[0]
        for (const [m, y] of steady.slice(1))
          if (Math.abs(y - y0) > SPEC.tolerance)
            problems.push(`${host}: ${bl.steady.selector} at ${y} on ${m} vs ${y0} on ${m0} -- ${bl.steady.why}`)
      }
      expect(problems, problems.join('\n')).toEqual([])
    })
  })
}
