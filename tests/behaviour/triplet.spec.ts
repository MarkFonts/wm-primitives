import { test, expect, type Page } from '@playwright/test'
import { sealed, settle } from '../render/hosts'

/* GESTURES.md §9 -- the triplet, in font-proofer's Fitting panel: Paragraph mode,
   justified, H&J open. Three fields, min / des / max, on the "word space" row. */
async function openHJ(page: Page) {
  await page.getByRole('button', { name: /paragraph/i }).first().click()
  await page.locator('.fit-align-btn[title="Justify"]').first().click()
  // two .fit-sub buttons exist (rag, justification); the rag one sits in a closed Collapse
  const sub = page.locator('.fit-sub', { hasText: /justification/i }).first()
  if ((await sub.getAttribute('aria-expanded')) !== 'true') await sub.click()
  await expect(page.locator('.triplet-row').first()).toBeVisible()
}
const fields = (page: Page) => page.locator('.triplet-row:not(.triplet-row--head)').first().locator('input')
const read = async (page: Page) => {
  const f = fields(page); const n = await f.count()
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(parseFloat((await f.nth(i).inputValue()).replace('−', '-')))
  return out
}

test.describe('font-proofer · triplet', () => {
  test.skip(({ hasTouch }) => hasTouch, 'keyboard and mouse')
  test.beforeEach(async ({ page }) => { await sealed(page); await page.goto('/font-proofer/'); await settle(page); await openHJ(page) })

  test('G44 · arrows step, Shift ×10, min ≤ des ≤ max holds', async ({ page }) => {
    const [min0, des0, max0] = await read(page)
    const des = fields(page).nth(1)
    await des.focus(); await des.press('ArrowUp')
    let [, des1] = await read(page); expect(des1).toBe(des0 + 1)
    await des.press('Shift+ArrowDown')
    ;[, des1] = await read(page); expect(des1).toBe(des0 + 1 - 10)
    const [min1, , max1] = await read(page)
    expect(min1).toBeLessThanOrEqual(des1); expect(des1).toBeLessThanOrEqual(max1)
    expect(max1).toBe(max0); expect(min1).toBeLessThanOrEqual(min0)
  })

  test('G46 · an edit that crosses a neighbour carries it, never clamps the edit', async ({ page }) => {
    const [, , max0] = await read(page)
    const min = fields(page).nth(0)
    await min.click(); await min.press('ControlOrMeta+a'); await min.pressSequentially(String(max0 + 5)); await min.press('Tab')
    const [min1, des1, max1] = await read(page)
    expect(min1).toBe(max0 + 5); expect(des1).toBe(max0 + 5); expect(max1).toBe(max0 + 5)
  })

  test('G43 · a stepper steps once on press and repeats on hold', async ({ page }) => {
    const [, des0] = await read(page)
    // each field carries [up, down]; the desired field's up is the third button in the row
    const row = page.locator('.triplet-row:not(.triplet-row--head)').first()
    // the steppers sit at opacity 0 until the row is hovered, and the row can be below
    // the sidebar's fold: bring it up and hover it before pressing, as a hand would
    await row.scrollIntoViewIfNeeded(); await row.hover()
    const up = row.locator('.triplet-step-btn').nth(2)
    const box = (await up.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up()
    let [, des1] = await read(page); expect(des1).toBe(des0 + 1)
    await page.mouse.down(); await page.waitForTimeout(400 + 60 * 5 + 40); await page.mouse.up()
    ;[, des1] = await read(page); expect(des1).toBeGreaterThanOrEqual(des0 + 1 + 4)
  })

  test('G45 · "-" and "." are held; a number commits at once, clamped', async ({ page }) => {
    const des = fields(page).nth(1)
    await des.click(); await des.press('ControlOrMeta+a'); await des.pressSequentially('-')
    expect(await des.inputValue()).toMatch(/^[-−]$/)
    await des.pressSequentially('5')
    expect(await des.inputValue()).toMatch(/^[-−]5$/)
    const [min1] = await read(page); expect(min1).toBeLessThanOrEqual(-5 > 0 ? -5 : 0)
    await des.press('Escape'); await des.press('Tab')
  })
})
