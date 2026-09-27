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

   BASELINES are the other half (2026-09-26): groups of labels that must share one, each
   with its tolerance and reason, repeated per mode where the row changes with the mode.
   An `open` group passes while it disagrees and fails the day it stops, so fixing one
   means deleting its note. */

type Line = { x: number; why: string; open?: string }
type Region = { where: string; selectors: string[]; lines: Record<string, Line> }
type Group = { name: string; selectors: string[]; tolerance: number; why: string; modes?: string[]; open?: string }
type Host = { url: string; regions: Record<string, Region>; modeButton?: string; baselines?: Group[] }
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

/* The Range's box split by the font's own ascent and descent: where the baseline of the
   first line of text actually falls, whatever the element's padding or line-height. */
const BASELINE = (sel: string) => {
  const out: { t: string; y: number }[] = []
  for (const el of document.querySelectorAll(sel)) {
    if (el.children.length && !(el.textContent || '').trim()) continue
    const box = el.getBoundingClientRect()
    if (!box.width || !box.height) continue
    const text = (el.textContent || '').trim()
    if (!text) continue
    const cs = getComputedStyle(el)
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const m = ctx.measureText(text)
    const rg = document.createRange(); rg.selectNodeContents(el)
    const r = rg.getBoundingClientRect()
    out.push({ t: text.replace(/\s+/g, ' ').slice(0, 20), y: +(r.top + (r.height + (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent)) / 2).toFixed(1) })
  }
  return out
}

for (const [host, h] of Object.entries(SPEC.hosts)) {
  if (!h.baselines?.length) continue
  test.describe(`${host} · rows share a baseline`, () => {
    test.skip(({ hasTouch }) => hasTouch, 'one width, one profile')

    test(`${host} · baselines`, async ({ page }) => {
      await sealed(page)
      await page.setViewportSize({ width: 1500, height: 900 })
      await page.goto(h.url)
      await settle(page)
      const problems: string[] = []
      const census: string[] = []
      for (const g of h.baselines!) {
        const anchors: { mode: string; t: string; y: number }[] = []
        for (const mode of g.modes ?? [null]) {
          if (mode && h.modeButton) {
            await page.locator(h.modeButton, { hasText: new RegExp(`^${mode}$`) }).click()
            await page.waitForTimeout(350)
            await page.evaluate(() => scrollTo(0, 0))
          }
          const found: { sel: string; t: string; y: number }[] = []
          const seen = new Set<string>()
          for (const sel of g.selectors)
            for (const e of await page.evaluate(`(${BASELINE.toString()})(${JSON.stringify(sel)})`) as { t: string; y: number }[]) {
              const k = `${e.t}@${e.y}`   // two selectors reaching one element count once
              if (!seen.has(k)) { seen.add(k); found.push({ sel, ...e }) }
            }
          const where = `${host} ${g.name}${mode ? ` (${mode})` : ''}`
          if (mode && found[0]) anchors.push({ mode, t: found[0].t, y: found[0].y })
          if (found.length < 2) { census.push(`${where}: ${found.length} element(s), nothing to compare`); continue }
          const anchor = found[0]
          const off = found.filter(e => Math.abs(e.y - anchor.y) > g.tolerance)
          const spread = +(Math.max(...found.map(e => e.y)) - Math.min(...found.map(e => e.y))).toFixed(1)
          census.push(`${where}: ${found.length} labels, spread ${spread}px (tolerance ${g.tolerance})${g.open ? ' [open]' : ''}`)
          if (g.open) {
            if (!off.length) problems.push(`${where}: now within ${g.tolerance}px -- the disagreement is fixed; delete its "open" note in alignment-lines.json`)
            continue
          }
          for (const e of off)
            problems.push(`${where}: "${e.t}" [${e.sel}] baseline ${e.y}px, "${anchor.t}" is at ${anchor.y}px -- ${Math.abs(e.y - anchor.y).toFixed(1)}px apart, tolerance ${g.tolerance} (${g.why})`)
        }
        /* And the row itself stays put: the first label must sit on one baseline in every
           mode. A row that is internally aligned can still jump when the submenu changes. */
        if (anchors.length > 1) {
          const ys = anchors.map(a => a.y), lo = Math.min(...ys), hi = Math.max(...ys)
          census.push(`${host} ${g.name}: "${anchors[0].t}" from ${lo}px to ${hi}px across ${anchors.length} modes`)
          if (hi - lo > g.tolerance)
            problems.push(`${host} ${g.name}: "${anchors[0].t}" moves ${(hi - lo).toFixed(1)}px between modes (${anchors.map(a => `${a.mode} ${a.y}`).join(', ')}) -- tolerance ${g.tolerance}`)
        }
      }
      console.log(census.join('\n'))
      expect(problems, problems.join('\n')).toEqual([])
    })
  })
}
