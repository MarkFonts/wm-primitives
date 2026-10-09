import { test, expect } from '@playwright/test'

/* The system page's G/L overlay under the live-area zoom (the shell's .wm-zoom, data-target
   ".wm-main"). One layer, in the zoom target's scroll parent (.wm-pan), never larger than what
   is visible of <main>, its columns the content's own, scaled by the zoom: at 130% the pitch is
   1.3 x (column + gutter) and every stripe of the Grid chapter's try-it card -- drawn inside the
   target -- lands on one of the overlay's. */
test.describe('system page · G/L under the zoom', () => {
  test.skip(({ hasTouch }) => hasTouch, 'a desktop viewport is the case; the arithmetic is the same on a phone')
  test('zoom 130, G: the overlay is the target\'s, its columns the target\'s columns x 1.3', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/grid/index.html'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500)
    await page.evaluate(() => (document.querySelector('.wm-zoom[data-target=".wm-main"]') as any).__wmZoom.set(130))
    await page.evaluate(() => { const t = document.querySelector('.gx-tc-big')!; scrollBy(0, t.getBoundingClientRect().top - 200) })
    await page.waitForTimeout(200)
    await page.keyboard.press('g'); await page.waitForTimeout(100)
    const r = await page.evaluate(() => {
      const ov = document.querySelector('.wm-ov') as HTMLElement, main = document.querySelector('.wm-main') as HTMLElement
      const cs = getComputedStyle(main), n = +cs.getPropertyValue('--grid-cols') - +cs.getPropertyValue('--rail-span') - +cs.getPropertyValue('--rail-gap')
      const g = parseFloat(cs.getPropertyValue('--grid-gutter')), col = (main.offsetWidth - (n - 1) * g) / n
      const o = ov.getBoundingClientRect(), m = main.getBoundingClientRect()
      const pitch = +ov.dataset.pitch!
      const stripes = [...document.querySelectorAll('.gx-tc-cols > span')].map(s => (s.getBoundingClientRect().left - m.left) / pitch)
      return { parent: ov.parentElement!.className, inMain: o.left >= m.left - .5 && o.right <= m.right + .5, fits: o.width <= innerWidth && o.height <= innerHeight,
        pitch, want: (col + g) * 1.3, zoom: main.currentCSSZoom, stripes, display: getComputedStyle(ov).display }
    })
    expect(r.display).toBe('block')
    expect(r.parent).toBe('wm-pan')
    expect(r.inMain && r.fits).toBe(true)
    expect(r.zoom).toBeCloseTo(1.3, 3)
    expect(r.pitch).toBeCloseTo(r.want, 2)
    expect(r.stripes.length).toBeGreaterThan(0)
    for (const k of r.stripes) expect(Math.abs(k - Math.round(k))).toBeLessThan(0.02)
  })
})
