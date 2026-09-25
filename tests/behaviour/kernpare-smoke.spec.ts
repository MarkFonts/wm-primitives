import { test, expect, type Page } from '@playwright/test'
import { sealed, settle } from '../render/hosts'

/* Kernpare against the 12-pair fixture the browser job already copies to data.json.
   The render suite shoots its button and its theme marks; the theme suite presses its
   switch. Nothing checked that the page does its one job: open, show the pairs, take
   an edit. (Nothing here touches the fenced analysis UI, which is a named exception.) */

function watch(page: Page) {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/net::ERR_|Failed to load resource/.test(t)) return
    errors.push(`console: ${t}`)
  })
  return errors
}

test.describe('kernpare · opens, lists, edits', () => {
  test.skip(({ hasTouch }) => hasTouch, 'a click is a click; one profile is enough')

  test('the fixture opens: family, masters, twelve pairs', async ({ page }) => {
    await sealed(page)
    const errors = watch(page)
    await page.goto('/kernpare/')
    await settle(page)
    await expect(page.locator('#list tbody tr')).toHaveCount(12)
    await expect(page.locator('#meta')).toContainText(/12 pairs/)
    await expect(page.locator('#status')).toHaveText(/12 shown/)
    /* Every pair shows a roman / italic value per master column, all numbers. */
    const first = page.locator('#list tbody tr').first()
    expect(await first.locator('.ev').count()).toBeGreaterThan(0)
    for (const v of await first.locator('.ev').allTextContents()) expect(Number.isFinite(Number(v)), v).toBe(true)
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('a kern edit changes the value, is counted, and reverts', async ({ page }) => {
    await sealed(page)
    const errors = watch(page)
    page.on('dialog', d => d.accept())
    await page.goto('/kernpare/')
    await settle(page)
    /* A click on a pair opens the current master's value as a field (input.cellinput);
       Enter commits. The value in the row follows, the row is dirty, the status counts
       the edit, and Revert all edits (#bReset, behind a confirm) puts it all back. */
    const row = page.locator('#list tbody tr').first()
    const value = row.locator('.ev.cur')
    const before = Number((await value.textContent())?.trim())
    expect(Number.isFinite(before)).toBe(true)
    await row.click()
    const field = page.locator('input.cellinput')
    await expect(field).toBeFocused()
    await field.fill(String(before + 5))
    await field.press('Enter')
    await expect(row.locator('.ev.cur')).toHaveText(String(before + 5))
    await expect(row).toHaveClass(/\bdirty\b/)
    await expect(page.locator('#status')).toContainText(/1 pair\(s\) edited/)
    await page.locator('#bReset', { hasText: /revert all/i }).click()
    await expect(row.locator('.ev.cur')).toHaveText(String(before))
    await expect(row).not.toHaveClass(/\bdirty\b/)
    await expect(page.locator('#status')).toHaveText(/12 shown$/)
    expect(errors, errors.join('\n')).toEqual([])
  })
})
