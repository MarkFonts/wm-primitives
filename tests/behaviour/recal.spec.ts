import { test, expect, type Page } from '@playwright/test'
import { sealed, settle } from '../render/hosts'

/* ReCal's OWN behaviour, the way font-proofer.spec.ts is font-proofer's. The dial and
   theme suites run against ReCal as a host; nothing exercised the instrument around
   them -- the modes, the rail's panels, the type panel's picker, the specimen sources.
   These are the cheap ones: they catch a lazy import, a broken preset fetch or a panel
   that no longer opens, on the commit that did it. */

function watch(page: Page) {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/net::ERR_|Failed to load resource/.test(t)) return
    /* sealed() aborts every request off localhost, and ReCal's export engine (pyodide, from
       a CDN) reports the abort as an init error. Not the instrument; not counted. */
    if (/fontEngine\] Worker init failed/.test(t)) return
    errors.push(`console: ${t}`)
  })
  return errors
}

async function open(page: Page) {
  await sealed(page)
  const errors = watch(page)
  await page.setViewportSize({ width: 1500, height: 900 })
  await page.goto('/recalsans/')
  await settle(page)
  return errors
}

test.describe('ReCal · the instrument around the primitive', () => {
  test.skip(({ hasTouch }) => hasTouch, 'a click is a click; one profile is enough')

  test('every mode opens without an error', async ({ page }) => {
    const errors = await open(page)
    for (const name of ['Words', 'Paragraph', 'Scale', 'Glyphs', 'UI', 'Info']) {
      const btn = page.locator('.canvas-bar .mode-btn', { hasText: new RegExp(`^${name}$`) })
      await expect(btn, name).toBeVisible()
      await btn.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      await expect(btn, `${name} is on`).toHaveClass(/\bon\b/)
    }
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('the rail walks its panels: Type Matrix, Freezer, Vertical Metrics, and back', async ({ page }) => {
    const errors = await open(page)
    /* Each seam is a button carrying the next panel's name; going forward swaps the
       panel and the seam to go back appears with the same name. */
    for (const name of ['TYPE MATRIX', 'FREEZER', 'VERTICAL METRICS']) {
      const fwd = page.locator('.rail-seam--down', { hasText: name })
      await expect(fwd, `seam to ${name}`).toBeVisible()
      await fwd.click()
      await page.waitForTimeout(400)
      await expect(page.locator('.rail-seam--up', { hasText: name }), `${name} is open`).toBeVisible()
    }
    await expect(page.locator('.canvas--vm'), 'vertical metrics take the canvas').toBeVisible()
    for (const name of ['VERTICAL METRICS', 'FREEZER', 'TYPE MATRIX']) {
      await page.locator('.rail-seam--up', { hasText: name }).click()
      await page.waitForTimeout(400)
    }
    await expect(page.locator('.rail-title')).toHaveText(/ReCal Builder/)
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('the type panel picks a style, and the readout follows', async ({ page }) => {
    const errors = await open(page)
    await page.locator('.canvas-bar .mode-btn', { hasText: /^Paragraph$/ }).click()
    await settle(page)
    const panel = page.locator('.type-panel')
    await expect(panel).toBeVisible()
    const btn = panel.locator('.style-menu-btn')
    const before = (await btn.textContent())?.trim()
    const size = panel.locator('.slider-row', { has: page.locator('.slider-label-name', { hasText: /^size$/ }) }).getByRole('spinbutton')
    const sizeBefore = await size.inputValue()
    await btn.click()
    const list = panel.locator('.ssd-list')
    await expect(list).toBeVisible()
    /* Pick the first row that is not the current one. */
    const row = list.locator('.ssd-row:not(.on)').first()
    const picked = (await row.locator('.ssd-name').textContent())?.trim()
    await row.click()
    await expect(list).toHaveCount(0)
    await expect(btn).not.toHaveText(before ?? '')
    expect((await btn.textContent())?.trim()).toBe(picked)
    /* A different style is a different size, which is what the panel exists to show. */
    await expect(size).not.toHaveValue(sizeBefore)
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('Paragraph swaps its specimen source', async ({ page }) => {
    const errors = await open(page)
    await page.locator('.canvas-bar .mode-btn', { hasText: /^Paragraph$/ }).click()
    await settle(page)
    const doc = page.locator('.para-doc').first()
    await expect(doc).toBeVisible()
    const before = (await doc.textContent())?.slice(0, 80)
    const tab = page.locator('.mode-row .text-tab', { hasText: /Tale of Two Cities/ })
    await tab.click()
    await page.waitForLoadState('networkidle')
    await expect(tab).toHaveClass(/\bon\b/)
    await expect(doc).not.toHaveText(before ?? '')
    await expect(doc).toContainText(/best of times|worst of times/i)
    expect(errors, errors.join('\n')).toEqual([])
  })
})
