import { test, expect, type Page } from '@playwright/test'
import { sealed, settle } from '../render/hosts'

/* ReCal's OWN behaviour, the way font-proofer.spec.ts is font-proofer's. The dial and
   theme suites run against ReCal as a host; nothing exercised the instrument around
   them -- the modes, the rail's rows, the Try bar's style picker, the specimen sources.
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

  test('the rail walks its six rows, one open at a time', async ({ page }) => {
    const errors = await open(page)
    /* ReCal's rail is a stack of six rows (Shell.tsx RailRow). Each header is a
       button.rail-seam--row (inside .rail-seam-head, inside .rail-row) whose aria-expanded says
       whether its row's .rail-row-open panel is there; one row is open at a time, and row 1 is open on boot. */
    const rows = ['Shape', 'Optical size', 'Ascender & Sharpness', 'Type Matrix', 'Freezer', 'Vertical metrics']
    const seams = page.locator('.rail-seam--row')
    await expect(seams, 'six rows').toHaveCount(rows.length)
    for (const [i, name] of rows.entries()) {
      await expect(seams.nth(i).locator('.rail-seam-lbl'), `row ${i + 1} label`).toHaveText(name)
      await expect(seams.nth(i).locator('.rail-seam-num'), `row ${i + 1} number`).toHaveText(String(i + 1))
    }
    await expect(seams.nth(0), 'Shape is open on boot').toHaveAttribute('aria-expanded', 'true')
    const vm = page.locator('.vmetrics-stage')
    await expect(vm, 'the metrics stage is not on the canvas yet').toHaveCount(0)

    /* Row 1 is already open on boot and a second click would close it, so the walk starts
       at row 2 and clicks Shape last. */
    for (const [i, name] of rows.entries()) {
      if (i === 0) continue
      const seam = seams.nth(i)
      await seam.click()
      await expect(seam, `${name} is open`).toHaveAttribute('aria-expanded', 'true')
      await expect(page.locator('.rail-row').nth(i).locator('.rail-row-open'), `${name} panel`).toBeVisible()
      await expect(page.locator('.rail-seam--row[aria-expanded="true"]'), `only ${name} is open`).toHaveCount(1)
      await expect(page.locator('.rail-row-open'), `only ${name} has a panel`).toHaveCount(1)
      if (name === 'Vertical metrics') {
        await expect(vm, 'vertical metrics take the canvas').toBeVisible()
        await expect(page.locator('.canvas--vm')).toBeVisible()
      } else {
        await expect(vm, `${name} leaves the canvas to the scene`).toHaveCount(0)
      }
    }

    /* And back: Shape reopens, and the canvas is the scene again. */
    await seams.nth(0).click()
    await expect(seams.nth(0), 'Shape reopens').toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.rail-row').nth(0).locator('.rail-row-open'), 'Shape panel').toBeVisible()
    await expect(page.locator('.rail-seam--row[aria-expanded="true"]')).toHaveCount(1)
    await expect(vm, 'the metrics stage is gone').toHaveCount(0)
    await expect(page.locator('.rail-title')).toHaveText(/ReCal Builder/)
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('the Try bar picks a style, and the readout follows', async ({ page }) => {
    const errors = await open(page)
    await page.locator('.canvas-bar .mode-btn', { hasText: /^Paragraph$/ }).click()
    await settle(page)
    /* The floating TYPE panel is gone (ReCal 52cb2a7): the style menu and the Size pill
       live in the canvas Try bar. */
    const panel = page.locator('.try')
    await expect(panel).toBeVisible()
    /* The trigger is an icon and the fixed label "Styles" (ReCal #44), so it says nothing about
       the pick: the menu's own selection and the preview's size are what change. */
    const btn = panel.locator('.style-menu-btn')
    const size = panel.locator('.slider-row', { has: page.locator('.slider-label-name', { hasText: /^Size$/ }) }).getByRole('spinbutton')
    const sizeBefore = await size.inputValue()
    await btn.click()
    const list = panel.locator('.ssd-list')
    await expect(list).toBeVisible()
    const selected = list.locator('.ssd-row[aria-selected="true"] .ssd-name')
    const before = (await selected.first().textContent())?.trim()
    /* Pick the first row that is not the current one. */
    const row = list.locator('.ssd-row:not(.on)').first()
    const picked = (await row.locator('.ssd-name').textContent())?.trim()
    expect(picked).toBeTruthy()
    expect(picked).not.toBe(before)
    await row.click()
    await expect(list).toHaveCount(0)
    /* A different style is a different size, which is what the panel exists to show. */
    await expect(size).not.toHaveValue(sizeBefore)
    /* and the menu, reopened, has the pick selected and nothing else */
    await btn.click()
    await expect(list).toBeVisible()
    await expect(selected).toHaveCount(1)
    await expect(selected).toHaveText(picked!)
    await page.keyboard.press('Escape')
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
