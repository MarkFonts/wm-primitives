import { test, expect } from '@playwright/test'
import { HOSTS, sealed, settle } from '../render/hosts'

/* GESTURES.md §10 -- the mark's ladder, read off font-variation-settings. font-proofer
   draws marks in both grounds; the alignment buttons carry one active and three at rest. */
const grad = (el: Element) => {
  const m = /["']GRAD["']\s*(-?\d+)/.exec(getComputedStyle(el).fontVariationSettings); return m ? Number(m[1]) : NaN
}
const fp = HOSTS.find(h => h.name === 'font-proofer')!
for (const theme of ['dark', 'light'] as const) {
  const L = theme === 'dark' ? { rest: 50, hover: 100, active: 75 } : { rest: 100, hover: 150, active: 100 }
  test.describe(`font-proofer · mark · ${theme}`, () => {
    test.skip(({ hasTouch }) => hasTouch, 'hover needs a pointer')
    test.beforeEach(async ({ page }) => {
      await sealed(page); await fp.setTheme(page, theme); await page.goto(fp.url); await settle(page)
      await page.getByRole('button', { name: /paragraph/i }).first().click()
      await expect(page.locator('.fit-align-btn.active .wm-icon')).toBeVisible()
    })

    test(`G49 · rest ${L.rest} → hover ${L.hover}; active ${L.active}`, async ({ page }) => {
      const rest = page.locator('.fit-align-btn:not(.active) .wm-icon').first()
      const active = page.locator('.fit-align-btn.active .wm-icon').first()
      expect(await rest.evaluate(grad)).toBe(L.rest)
      expect(await active.evaluate(grad)).toBe(L.active)
      await rest.hover(); await page.waitForTimeout(150)
      expect(await rest.evaluate(grad)).toBe(L.hover)
    })

    test('G51 · hover never lands on an active mark', async ({ page }) => {
      const active = page.locator('.fit-align-btn.active .wm-icon').first()
      await active.hover(); await page.waitForTimeout(150)
      expect(await active.evaluate(grad)).toBe(L.active)
      expect(await active.evaluate(el => getComputedStyle(el).backgroundImage.includes('data:image/avif'))).toBe(theme === 'dark')
    })

    test('G53 · size sets opsz, clamped to the axis', async ({ page }) => {
      const mark = page.locator('.fit-align-btn .wm-icon').first()
      const fvs = await mark.evaluate(el => getComputedStyle(el).fontVariationSettings)
      const opsz = Number(/["']opsz["']\s*(\d+)/.exec(fvs)?.[1])
      expect(opsz).toBeGreaterThanOrEqual(20); expect(opsz).toBeLessThanOrEqual(48)
      expect(await mark.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(20)
    })
  })
}
