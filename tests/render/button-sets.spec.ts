import { test, expect } from '@playwright/test'

/* src/button-sets.css held to a baseline: 06 Menu as a menu list and 03 Rule as inline
   text-actions, each block on its own (they never share a frame), in both themes, on the
   package's own tokens. Baselines come from CI like every other render (tests/README.md);
   the first run reports them missing. */
for (const theme of ['dark', 'light']) {
  test(`button sets · ${theme}`, async ({ page }) => {
    await page.goto(`/dial/button-sets.html?theme=${theme}`)
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('#list')).toHaveScreenshot(`button-sets-menu-${theme}.png`)
    await expect(page.locator('#inline')).toHaveScreenshot(`button-sets-rule-${theme}.png`)
  })
}
