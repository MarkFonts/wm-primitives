import { test, expect } from '@playwright/test'
import { sealed, settle } from './hosts'

/* Kernpare is a LOCAL app: one index.html, a python server for saves, no build. Its
   dials are the bundle (dial-bundle.spec.ts) and its theme switch has theme.spec.ts, so
   this is the smallest promise that is still a promise: a clean checkout loads without
   an exception, and the house button it draws twenty-eight of matches its baseline.
   (Until 2026-09-19 this looked for .ui-seg, the pill Kernpare retired in CHROME.md C.)
   Its kern-group analysis UI is styled the way it is on purpose (Severance) and is not
   compared to anything. */
test.describe('kernpare', () => {
  test('a clean checkout loads, and the shared toggle group matches', async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await sealed(page)
    await page.goto('/kernpare/')
    await settle(page)
    expect(errors, 'uncaught exceptions on load').toEqual([])
    const btn = page.locator('.wm-btn').first()
    await expect(btn).toBeVisible()
    // The actual, as a file in the report, so a missing baseline can be cut from CI
    // without a second run (README: baselines come from CI only). CSS pixels, as
    // toHaveScreenshot compares -- on the 3x iphone project the default is device
    // pixels, and a baseline cut from that is three times too big. Its own name, so
    // Playwright's own `-actual` on a failed compare is not fighting over the file.
    await btn.screenshot({ path: info.outputPath('kernpare-wm-btn-shot.png'), scale: 'css' })
    await expect(btn).toHaveScreenshot('kernpare-wm-btn.png')
  })
})
