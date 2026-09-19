import { test, expect } from '@playwright/test'
import { sealed, settle } from './hosts'

/* ThemeSwitch held to a baseline: font-proofer's marks in dark and light (the marks
   carry the ink ladder) and Kernpare's, which took the marks look too on 2026-09-17 --
   the `words` baseline outlived that by two days. */
test.describe('theme switch', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`font-proofer · marks · ${theme}`, async ({ page }) => {
      await sealed(page)
      await page.addInitScript(t => localStorage.setItem('wm-theme', t), theme)
      await page.goto('/font-proofer/'); await settle(page)
      await expect(page.locator('#theme-toggle')).toHaveScreenshot(`theme-marks-${theme}.png`)
    })
  }
  test('kernpare · marks', async ({ page }) => {
    await sealed(page)
    await page.goto('/kernpare/'); await settle(page)
    await expect(page.locator('#theme-toggle')).toHaveScreenshot('theme-kernpare-marks.png')
  })
})
