import { test, expect, type Page } from '@playwright/test'
import { build } from '../build-fixture.mjs'

/* Collections from the keyboard (GESTURES.md §16, G126-G136): StyleScopeList and
   StyleScopeDropdown (React Aria listbox) and GlyphPicker (a roving-tabindex grid), on
   tests/fixtures/collections.html (/dial/collections.html) -- the picker holds every
   codepoint Cal Sans encodes, so "one Tab stop" is measured against ~1,000 cells, not ten.
   Keyboard paths only: the look is the renders', and a pointer pick is unchanged. */

test.beforeAll(async () => { await build('collections') })

async function open(page: Page) {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/dial/collections.html')
  await page.waitForFunction(() => (window as any).ready === true)
  expect(errors).toEqual([])
}
const log = (page: Page) => page.evaluate(() => (window as any).log as unknown[][])
const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement
  return a.getAttribute('aria-label') ?? a.id ?? a.textContent
})

test.describe('StyleScopeDropdown', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard paths: one profile is enough')
    await open(page)
  })

  test('G129: the trigger says what it opens and whether it is open', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Body' })
    await expect(btn).toHaveAttribute('aria-haspopup', 'listbox')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    const list = page.getByRole('listbox', { name: 'Body' })
    await expect(list).toBeVisible()
    await expect(btn).toHaveAttribute('aria-controls', (await list.getAttribute('id'))!)
  })

  test('G126 + G130: opening from the keyboard lands on the selected row; Escape closes and returns', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Body' })
    await btn.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: /Body/ })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(1)          // only the inline multi list
    await expect(btn).toBeFocused()
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  test('G127 + G131: arrows/Home/End/typeahead move focus without picking; Enter picks, closes, returns', async ({ page }) => {
    await page.getByRole('button', { name: 'Body' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('option', { name: /Body/ })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: /Caption/ })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(page.getByRole('option', { name: /Display/ })).toBeFocused()
    await page.keyboard.press('End')
    await expect(page.getByRole('option', { name: /Micro/ })).toBeFocused()
    await page.keyboard.type('ti')
    await expect(page.getByRole('option', { name: /Title/ })).toBeFocused()
    expect(await log(page)).toEqual([])                            // nothing picked yet
    await page.keyboard.press('Enter')
    expect(await log(page)).toEqual([['dd', 'Title', 'keydown']])
    const btn = page.getByRole('button', { name: 'Title' })
    await expect(btn).toBeFocused()
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  test('G128: a pointer pick is unchanged -- one onSelect, the list closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Body' }).click()
    await page.getByRole('option', { name: /Heading/ }).click()
    expect(await log(page)).toEqual([['dd', 'Heading', 'click']])
    await expect(page.getByRole('button', { name: 'Heading' })).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('StyleScopeList, multi', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard paths: one profile is enough')
    await open(page)
  })

  test('G127: aria-multiselectable, one Tab stop, Space toggles the focused row only', async ({ page }) => {
    const list = page.getByRole('listbox', { name: 'Tiers' })
    await expect(list).toHaveAttribute('aria-multiselectable', 'true')
    await expect(list.getByRole('option', { selected: true })).toHaveCount(2)
    // Tab from the dropdown trigger lands in the list, on the first selected row; a second Tab leaves it.
    await page.getByRole('button', { name: 'Body' }).focus()
    await page.keyboard.press('Tab')
    await expect(list.getByRole('option', { name: 'sm', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press(' ')
    expect(await log(page)).toEqual([['multi', 'base', 'keydown', false]])
    await expect(list.getByRole('option', { name: 'base', exact: true })).toHaveAttribute('aria-selected', 'true')
    // React Aria's own range and select-all do not reach the host.
    await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('ControlOrMeta+a')
    expect((await log(page)).length).toBe(1)
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('[role=listbox]'))).toBeNull()
  })

  test('G128: shift-click still reaches the host with shiftKey', async ({ page }) => {
    await page.getByRole('listbox', { name: 'Tiers' }).getByRole('option', { name: 'xl', exact: true }).click({ modifiers: ['Shift'] })
    expect(await log(page)).toEqual([['multi', 'xl', 'click', true]])
  })
})

test.describe('GlyphPicker', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard paths: one profile is enough')
    await open(page)
  })

  test('G132: the whole picker is ONE Tab stop, however many cells', async ({ page }) => {
    const cells = await page.evaluate(() => (window as any).cellCount)
    expect(cells).toBeGreaterThan(500)
    await page.locator('#before').focus()
    // before -> 2 dropdown/list stops -> copy -> search -> ONE grid stop -> after
    const seen: string[] = []
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const id = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement
        return a.id || (a.closest('.gp-groups') ? 'grid' : a.className)
      })
      seen.push(id)
      if (id === 'after') break
    }
    expect(seen.filter(s => s === 'grid')).toHaveLength(1)
    expect(seen.at(-1)).toBe('after')
  })

  test('G133: arrows move in two dimensions and across groups; Home/End, Ctrl+Home/End, PageDown', async ({ page }) => {
    const grid = page.getByRole('grid', { name: 'Uppercase' })
    await grid.getByRole('gridcell', { name: /^A, / }).focus()
    await page.keyboard.press('ArrowRight')
    expect(await focused(page)).toMatch(/^B, /)
    const cols = await grid.getByRole('row').first().getByRole('gridcell').count()
    await page.keyboard.press('ArrowDown')
    const down = await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.gpI))
    expect(down).toBe(1 + cols)
    await page.keyboard.press('Home')
    expect(await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.gpI))).toBe(cols)
    await page.keyboard.press('End')
    expect(await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.gpI))).toBe(2 * cols - 1)
    await page.keyboard.press('ControlOrMeta+End')
    const last = await page.evaluate(() => document.querySelectorAll('.gp-cell').length - 1)
    expect(await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.gpI))).toBe(last)
    await page.keyboard.press('ControlOrMeta+Home')
    expect(await focused(page)).toMatch(/^A, /)
    // Down from the last row of Uppercase lands in the first row of Lowercase.
    const upper = await grid.getByRole('gridcell').count()
    await grid.getByRole('gridcell').nth(upper - 1).focus()
    await page.keyboard.press('ArrowDown')
    expect(await page.evaluate(() => document.activeElement!.closest('[role=grid]')!.getAttribute('aria-labelledby')))
      .toBe(await page.getByRole('grid', { name: 'Lowercase' }).getAttribute('aria-labelledby'))
    // PageDown moves by whole rows (same column), at least one.
    const from = await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.gpI))
    await page.keyboard.press('PageDown')
    const to = await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.gpI))
    expect(to).toBeGreaterThan(from)
    // Still one Tab stop after all that moving.
    expect(await page.locator('.gp-cell[tabindex="0"]').count()).toBe(1)
  })

  test('G134: a cell is named by its character and glyph name; selection is aria-selected and needs Enter', async ({ page }) => {
    const upper = page.getByRole('grid', { name: 'Uppercase' })
    const cell = upper.getByRole('gridcell', { name: 'Ä, Adieresis, U+00C4' })
    await expect(cell).toHaveCount(1)
    await expect(upper.getByRole('gridcell', { selected: true })).toHaveCount(1)   // 'A', the default
    await cell.focus()
    await page.keyboard.press('ArrowRight')
    expect(await log(page)).toEqual([])                               // moving is not picking
    await page.keyboard.press('Enter')
    expect((await log(page)).at(-1)).toEqual(['glyph', 'Å'])
    await expect(upper.getByRole('gridcell', { name: /^Å, / })).toHaveAttribute('aria-selected', 'true')
  })

  test('G135: copying is announced in a polite live region', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('gridcell', { name: /^ß, / }).first().click()
    await page.getByRole('button', { name: /U\+00DF/ }).click()
    const status = page.locator('.gp-live')
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await expect(status).toHaveText('Copied ß, U+00DF')
  })

  test('G136: the focus ring is keyboard-only and is not the selected ring', async ({ page }) => {
    const upper = page.getByRole('grid', { name: 'Uppercase' })
    const cell = upper.getByRole('gridcell', { name: /^B, / })
    await cell.click()
    expect(await cell.evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none')
    await page.keyboard.press('ArrowRight')
    const c = upper.getByRole('gridcell', { name: /^C, / })
    expect(await c.evaluate(e => getComputedStyle(e).outlineStyle)).toBe('solid')
  })
})

test.describe('a tap', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'touch profiles only')
    await open(page)
  })

  test('G128: a tap picks once and closes, a tap on a glyph picks it', async ({ page }) => {
    await page.getByRole('button', { name: 'Body' }).tap()
    await page.getByRole('option', { name: /Heading/ }).tap()
    await expect(page.getByRole('button', { name: 'Heading' })).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('listbox', { name: 'Tiers' }).getByRole('option', { name: 'xs', exact: true }).tap()
    await page.getByRole('grid', { name: 'Uppercase' }).getByRole('gridcell', { name: /^Q, / }).tap()
    expect((await log(page)).map(r => r.slice(0, 2))).toEqual([['dd', 'Heading'], ['multi', 'xs'], ['glyph', 'Q']])
  })
})
