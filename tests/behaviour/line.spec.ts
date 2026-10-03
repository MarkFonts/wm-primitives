import { test, expect } from '@playwright/test'

/* THE LINE, at the roles and the controls (src/grid.css; TYPOGRAPHY.md "Height follows the type").
   tests/fixtures/line.html loads type.css, chip.css, button.css and select.css from src/ and
   nothing else. Every role's computed leading is its `line` (type.ts) and every control's
   box is a whole number of 3px units -- lint-tokens checks the declarations; this checks
   what the browser makes of them, which is where 45 x 1.1 = 49.5 went wrong. */
const LINE = { micro: 12, label: 15, ui: 15, body: 24, lede: 27, title: 30, display: 51 }

test.describe('the line · roles and controls', () => {
  test('every role leads on the line; every control is units tall', async ({ page, hasTouch }) => {
    await page.goto('/dial/line.html'); await page.evaluate(() => document.fonts.ready)
    const leads = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-role]')]
      .map(e => [e.getAttribute('data-role'), parseFloat(getComputedStyle(e).lineHeight)])))
    expect(leads).toEqual(LINE)
    const heights = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-h]')]
      .map(e => [e.getAttribute('data-h'), e.getBoundingClientRect().height])))
    for (const [k, h] of Object.entries(heights)) expect(h % 3, `${k} is ${h}px, not on the 3px unit`).toBe(0)
    if (!hasTouch) expect(heights).toEqual({ chip: 27, small: 18, btn: 27, select: 27 })
    else { expect(heights.chip).toBe(33); expect(heights.btn).toBe(45) }
  })
})
