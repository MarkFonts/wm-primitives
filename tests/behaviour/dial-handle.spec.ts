import { test, expect } from '@playwright/test'

/* src/dialHandle.js + .css: the hairline ends at the lozenge's extreme centres, and every
   lozenge is as wide as the longest value its own range can show. Fixture:
   tests/fixtures/dial-handle.html, the case study's six axes vertical plus two horizontal. */
const CHARS: Record<string, number> = { wght: 3, GEOM: 3, opsz: 4 /* "auto" */, YTAS: 4, SHRP: 3, ital: 4 }

test.beforeEach(async ({ page }) => {
  await page.goto('/dial/dial-handle.html')
  await page.evaluate(() => document.fonts.ready)
})

for (const which of ['min', 'max'] as const) {
  test(`hairline stays inside the lozenge at ${which}`, async ({ page }) => {
    await page.evaluate(w => (window as any).park(w), which)
    const boxes = await page.evaluate(() => [...document.querySelectorAll('.wm-hd-rail')].map(r => {
      const vertical = !!r.closest('.wm-hd--vertical')
      const i = r.querySelector('i')!.getBoundingClientRect(), p = r.querySelector('.wm-hd-pill')!.getBoundingClientRect()
      return vertical ? { vertical, lo: i.top - p.top, hi: p.bottom - i.bottom } : { vertical, lo: i.left - p.left, hi: p.right - i.right }
    }))
    expect(boxes.length).toBe(8)
    // the line's end sits within the pill's span on the rail axis, at whichever end the pill is
    for (const b of boxes) {
      const end = which === 'min' ? (b.vertical ? b.hi : b.lo) : (b.vertical ? b.lo : b.hi)
      expect(end, JSON.stringify(b)).toBeGreaterThanOrEqual(-0.5)
    }
  })
}

test('the ring ends on the rail, not past it, when vertical', async ({ page }) => {
  await page.evaluate(() => (window as any).park('min'))
  const over = await page.evaluate(() => {
    const r = document.querySelector('.wm-hd--vertical .wm-hd-rail')!.getBoundingClientRect()
    return document.querySelector('.wm-hd--vertical .wm-hd-pill')!.getBoundingClientRect().bottom + 3 - r.bottom
  })
  // the ring's edge may sit up to a pixel inside the rail's end, never past it
  expect(over).toBeLessThanOrEqual(0.01); expect(over).toBeGreaterThanOrEqual(-1)
})

test('--hd-chars is the longest value, and the pill is one width wherever it sits', async ({ page }) => {
  for (const [tag, n] of Object.entries(CHARS)) {
    const got = await page.locator(`[data-axis="${tag}"] .wm-hd-pill`).evaluate(el => (el as HTMLElement).style.getPropertyValue('--hd-chars'))
    expect(Number(got), tag).toBe(n)
  }
  const widths = async () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-axis]')].map(e => [(e as HTMLElement).dataset.axis, e.querySelector('.wm-hd-pill')!.getBoundingClientRect().width])))
  await page.evaluate(() => (window as any).park('min')); const a = await widths()
  await page.evaluate(() => (window as any).park('max')); const b = await widths()
  for (const k in a) expect(Math.abs(a[k] - b[k]), k).toBeLessThanOrEqual(0.5)
})
