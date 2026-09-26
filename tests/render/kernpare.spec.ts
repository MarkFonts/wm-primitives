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

  /* THE INTERFACE, not the primitives inside it (2026-09-25). The page against the
     12-pair fixture in both themes, and the three regions that carry the look: the
     graph, the pair table, the actions rail. A report, never a gate, like every render
     row. The analysis modal is the fenced exception and opens on demand, so it never
     appears here. Every shot lands in the report as its own file, CSS pixels, so a
     baseline is cut from CI's artifact and never from a laptop. */
  for (const theme of ['dark', 'light'] as const) {
    test(`the interface · ${theme}`, async ({ page }, info) => {
      await sealed(page)
      await page.goto('/kernpare/')
      await settle(page)
      await page.locator(`#theme-toggle [data-mode="${theme}"]`).click()
      await settle(page)
      await page.mouse.move(0, 0)   // no hover state on a row or a node
      const shots: [string, ReturnType<typeof page.locator> | null][] = [
        ['page', null], ['graph', page.locator('#graphWrap')], ['table', page.locator('#list')], ['actions', page.locator('#actions')],
      ]
      for (const [part, loc] of shots) {
        const name = `kernpare-${theme}-${part}.png`
        if (loc) {
          await expect(loc).toBeVisible()
          await loc.screenshot({ path: info.outputPath(name.replace('.png', '-shot.png')), scale: 'css' })
          await expect.soft(loc).toHaveScreenshot(name)
        } else {
          await page.screenshot({ path: info.outputPath(name.replace('.png', '-shot.png')), scale: 'css' })
          await expect.soft(page).toHaveScreenshot(name)
        }
      }
    })
  }
})
