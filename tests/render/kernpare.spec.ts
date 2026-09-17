import { test, expect } from '@playwright/test'
import { sealed, settle } from './hosts'

/* Kernpare is a LOCAL app: one index.html, a python server for saves, no build. It
   takes one thing from the primitives -- toggleGroup.css -- and draws no dial, so it
   joins as the smallest promise that is still a promise: a clean checkout loads without
   an exception, and the one shared control it draws matches its baseline.
   Its kern-group analysis UI is styled the way it is on purpose (Severance) and is not
   compared to anything. */
test.describe('kernpare', () => {
  test('a clean checkout loads, and the shared toggle group matches', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await sealed(page)
    await page.goto('/kernpare/')
    await settle(page)
    expect(errors, 'uncaught exceptions on load').toEqual([])
    const seg = page.locator('.ui-seg').first()
    await expect(seg).toBeVisible()
    await expect(seg).toHaveScreenshot('kernpare-ui-seg.png')
  })
})
