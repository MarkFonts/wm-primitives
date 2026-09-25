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

   Baselines are the next half: the same idea across the rail/canvas split, where the
   two header rows disagree by 1-2px today. Left edges first, because they are the
   larger class and the one the census shows. */

type Line = { x: number; why: string; open?: string }
type Region = { where: string; selectors: string[]; lines: Record<string, Line> }
type Host = { url: string; regions: Record<string, Region> }
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
