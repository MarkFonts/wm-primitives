import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { sealed, settle } from '../render/hosts'

/* font-proofer's OWN behaviour, not the primitive's. The dial, triplet, theme and icon
   suites already run against it as a host; nothing exercised the app around them --
   upload, the modes, reset -- until 2026-09-25, when two board bugs (font-proofer#33)
   were fixed and merged without a way to see them, because they only show with a face
   that is not Cal Sans.

   Two fixtures, both OFL from google/fonts, both subset (tests/fixtures/):
   - DM Sans, the roman and italic variable files exactly as Google Fonts ships them
     (DMSans[opsz,wght].ttf beside DMSans-Italic[opsz,wght].ttf), Latin. The pair
     matters: font-proofer#34 lets both drop at once.
   - Google Sans Flex, six axes (GRAD, ROND, opsz, slnt, wdth, wght), 29 glyphs -- a
     pangram and the digits, because six axes of gvar is what makes the file big. */

const FIX = (f: string) => fileURLToPath(new URL(`../fixtures/${f}`, import.meta.url))
const ROMAN = FIX('DMSans[opsz,wght].ttf')
const ITALIC = FIX('DMSans-Italic[opsz,wght].ttf')
const FLEX = FIX('GoogleSansFlex[GRAD,ROND,opsz,slnt,wdth,wght].ttf')
/* App.jsx: the CSS family is the file's base name, alphanumerics only, + 'Preview'. */
const FAMILY = 'DMSansPreview'

/* Errors the app throws or logs. Resource failures are excluded: sealed() aborts every
   request off localhost, and the browser reports each abort as a console error. */
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

/* The five modes every font gets. cal.com/peer and booking events exist only on the
   Cal Sans routes (App.jsx isCalcom), so the smoke walks whatever buttons are there and
   insists on these. */
const MODES = ['Big Word', 'Paragraph', 'UI', 'Type Scale', 'Glyphs']

test.describe('font-proofer · the app around the primitive', () => {
  test.skip(({ hasTouch }) => hasTouch, 'a click is a click; one profile is enough')

  test('every mode opens without an error', async ({ page }) => {
    await sealed(page)
    const errors = watch(page)
    await page.goto('/font-proofer/')
    await settle(page)
    for (const name of MODES) await expect(page.locator('.mode-btn', { hasText: name }).first(), name).toBeVisible()
    const n = await page.locator('.mode-btn').count()
    for (let i = 0; i < n; i++) {
      const btn = page.locator('.mode-btn').nth(i)
      const name = (await btn.textContent())?.trim()
      await btn.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      await expect(btn, `${name} is the active mode`).toHaveClass(/active/)
    }
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('six axes make six rows; opsz on auto, the rest on the fvar defaults', async ({ page }) => {
    await sealed(page)
    const errors = watch(page)
    await page.goto('/font-proofer/')
    await settle(page)
    await page.locator('input[type="file"]').setInputFiles([FLEX])
    await expect(page.locator('.upload-name')).toHaveText(/GoogleSansFlex/)
    await settle(page)
    /* App.jsx labels a row from the font's own axis name (fvar → name table), falling
       back to its tagLabels and then the tag: Google Sans Flex calls ROND "Roundness". */
    const want: [RegExp, string][] = [
      [/^optical size$/i, 'auto'], [/^width$/i, '100'], [/^weight$/i, '400'],
      [/^grade$/i, '0'], [/^roundness$/i, '0'], [/^slant$/i, '0'],
    ]
    for (const [label, value] of want) {
      const row = page.locator('.slider-row', { has: page.locator('.slider-label-name', { hasText: label }) }).first()
      await expect(row, String(label)).toBeVisible()
      await expect(row.getByRole('spinbutton'), String(label)).toHaveValue(value)
    }
    /* No italic companion, no ital axis: the roman/italic toggle stays away. */
    await expect(page.locator('.roman-italic-toggle')).toHaveCount(0)
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('a dropped roman + italic pair becomes one family, and the rail starts on auto', async ({ page }) => {
    await sealed(page)
    const errors = watch(page)
    await page.goto('/font-proofer/')
    await settle(page)

    /* The hidden <input type=file multiple> is the same path a drop takes (splitRomanItalic). */
    await page.locator('input[type="file"]').setInputFiles([ROMAN, ITALIC])
    await expect(page.locator('.upload-name')).toHaveText(/DMSans/)
    await settle(page)

    /* Both faces registered under ONE family: the italic is the companion, style italic. */
    const faces = await page.evaluate(fam =>
      [...document.fonts].filter(f => f.family === fam).map(f => f.style).sort(), FAMILY)
    expect(faces).toEqual(['italic', 'normal'])
    await expect(page.locator('.roman-italic-toggle')).toBeVisible()

    /* The rail read the fvar: opsz and wght rows, opsz parked on auto (App.jsx axisDefaults),
       NOT on the font's own default of 9. */
    const opsz = page.locator('.slider-row', { has: page.locator('.slider-label-name', { hasText: /^optical size$/i }) }).first()
    const wght = page.locator('.slider-row', { has: page.locator('.slider-label-name', { hasText: /^weight$/i }) }).first()
    await expect(opsz).toBeVisible()
    await expect(wght).toBeVisible()
    await expect(opsz.getByRole('spinbutton')).toHaveValue('auto')
    await expect(wght.getByRole('spinbutton')).toHaveValue('400')

    /* Pin opsz by typing, then reset: back to auto, which is how the font arrived --
       font-proofer#33; before it reset handed back 9. */
    const field = opsz.getByRole('spinbutton')
    await field.click()
    await field.fill('20')
    await field.press('Enter')
    await expect(field).toHaveValue('20')
    const reset = page.locator('button[title="Reset axes"]')
    await expect(reset).toHaveClass(/active/)
    await reset.click()
    await expect(field).toHaveValue('auto')
    await expect(reset).toHaveClass(/reset-clean/)

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('the UI board is set in the uploaded face, chrome and all', async ({ page }) => {
    await sealed(page)
    const errors = watch(page)
    await page.goto('/font-proofer/')
    await settle(page)
    await page.locator('input[type="file"]').setInputFiles([ROMAN])
    await expect(page.locator('.upload-name')).toHaveText(/DMSans/)
    await page.locator('.mode-btn', { hasText: 'UI' }).first().click()
    const board = page.locator('.preview-ui')
    await expect(board).toBeVisible()
    /* The board's chips, tabs and kbd read --ui-font (UiKitBoard.css), which is the app's
       chrome face unless the wrapper repoints it -- font-proofer#33. A chip is the witness;
       body copy inherits and was never the problem. */
    const chip = board.locator('.ui-chip, .ui-kbd, .ui-tab').first()
    await expect(chip).toBeVisible()
    const fam = await chip.evaluate(el => getComputedStyle(el).fontFamily)
    expect(fam, `chip font-family: ${fam}`).toContain(FAMILY)
    const body = await board.locator('.ui-muted').first().evaluate(el => getComputedStyle(el).fontFamily)
    expect(body, `body font-family: ${body}`).toContain(FAMILY)
    /* And the app's own chrome outside the board did not follow. */
    const chrome = await page.locator('.mode-btn').first().evaluate(el => getComputedStyle(el).fontFamily)
    expect(chrome).not.toContain(FAMILY)
    expect(errors, errors.join('\n')).toEqual([])
  })
})
