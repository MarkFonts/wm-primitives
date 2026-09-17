import { test, expect } from '@playwright/test'
import { sealed, settle } from '../render/hosts'

/* GESTURES.md §8 -- the theme switch. One engine under two looks: font-proofer's marks
   and Kernpare's words. The promise is the same in both: a press stamps <html>, stores
   the choice under ONE key, and the pressed state is on the button. */
for (const [name, url] of [['font-proofer', '/font-proofer/'], ['kernpare', '/kernpare/']] as const) {
  test.describe(`${name} · theme switch`, () => {
    test.skip(({ hasTouch }) => hasTouch, 'a click is a click; one profile is enough')

    test('G38-G40 · a press stamps the root, stores the choice, and the button says so', async ({ page }) => {
      await sealed(page)
      await page.goto(url)
      await settle(page)
      const sw = page.locator('#theme-toggle')
      await expect(sw).toBeVisible()
      for (const t of ['dark', 'light', 'auto'] as const) {
        await sw.locator(`[data-mode="${t}"]`).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', t)
        expect(await page.evaluate(() => localStorage.getItem('wm-theme'))).toBe(t)
        await expect(sw.locator(`[data-mode="${t}"]`)).toHaveAttribute('aria-pressed', 'true')
        expect(await sw.locator('[aria-pressed="true"]').count()).toBe(1)
      }
    })

    test('G41 · an applied theme reaches the switch without a press', async ({ page }) => {
      await sealed(page)
      await page.goto(url)
      await settle(page)
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark'
        document.documentElement.dispatchEvent(new CustomEvent('wm-theme', { detail: 'dark' }))
      })
      await expect(page.locator('#theme-toggle [data-mode="dark"]')).toHaveAttribute('aria-pressed', 'true')
    })
  })
}

test('font-proofer · the choice survives a reload', async ({ page, hasTouch }) => {
  test.skip(hasTouch)
  await sealed(page); await page.goto('/font-proofer/'); await settle(page)
  await page.locator('#theme-toggle [data-mode="dark"]').click()
  await page.reload(); await settle(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#theme-toggle [data-mode="dark"]')).toHaveAttribute('aria-pressed', 'true')
})
