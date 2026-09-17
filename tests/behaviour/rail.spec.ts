import { test, expect, type Page, type Locator } from '@playwright/test'
import { HOSTS, sealed, settle } from '../render/hosts'
import { touchDrag, touchPress, at } from './gesture'

/* GESTURES.md §1-2, on the built host, in the one track-variant row both hosts draw
   with nothing between the dial and its state: `tracking`. (`size` is capped by
   font-proofer's paragraph comfort limit, so a drag there lands where the host says.)
   The ids in the test names are the spec's. */

const sizeRow = (page: Page) =>
  page.locator('.slider-row--track').filter({ has: page.locator('.slider-label-name', { hasText: /^tracking$/ }) })
    .filter({ visible: true }).first()

const readValue = (row: Locator) => row.locator('input.slider-number').inputValue().then(v => parseFloat(v.replace('−', '-')))
const range = (row: Locator) => row.locator('input[type="range"]')
const bounds = async (row: Locator) => {
  const r = range(row)
  return { min: parseFloat(await r.getAttribute('min') ?? '0'), max: parseFloat(await r.getAttribute('max') ?? '100'), step: parseFloat(await r.getAttribute('step') ?? '1') }
}
const scrubbing = (page: Page) => page.evaluate(() => document.documentElement.hasAttribute('data-scrubbing'))
const engaged = (row: Locator) => row.evaluate(el => el.classList.contains('slider-row--engaged'))
const heights = (row: Locator) => row.evaluate(el => ({
  row: el.getBoundingClientRect().height,
  bar: el.querySelector('.slider-label')!.getBoundingClientRect().height,
}))

for (const host of HOSTS) {
  test.describe(`${host.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await sealed(page)
      await host.setTheme(page, 'dark')
      await page.goto(host.url)
      await settle(page)
      await expect(sizeRow(page)).toBeVisible()
      await sizeRow(page).scrollIntoViewIfNeeded()
    })

    test.describe('touch', () => {
      test.skip(({ hasTouch }) => !hasTouch, 'a finger, not a mouse')

      test('G1 · a drag from anywhere on the row follows the finger', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        const { min, max, step } = await bounds(row)
        const before = await readValue(row)
        await touchDrag(page, r, [await at(r, 0.3), await at(r, 0.35), await at(r, 0.5), await at(r, 0.7)])
        const after = await readValue(row)
        expect(after).not.toBe(before)
        expect(Math.abs(after - (min + 0.7 * (max - min)))).toBeLessThanOrEqual(step * 2 + (max - min) * 0.03)
      })

      test('G2 · a clearly vertical gesture leaves the value alone', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        const before = await readValue(row)
        const p = await at(r, 0.5)
        await touchDrag(page, r, [p, { x: p.x + 2, y: p.y + 8 }, { x: p.x + 4, y: p.y + 30 }, { x: p.x + 6, y: p.y + 60 }])
        expect(await readValue(row)).toBe(before)
        expect(await scrubbing(page)).toBe(false)
      })

      test('G3 · under 6px of movement is a tap, and a tap is the native input\'s', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        const { min, max } = await bounds(row)
        const before = await readValue(row)
        const p = await at(r, 0.2)
        await touchDrag(page, r, [p, { x: p.x + 3, y: p.y + 2 }, { x: p.x + 4, y: p.y + 3 }])
        expect(await scrubbing(page)).toBe(false)
        const after = await readValue(row)
        // a real touch jumps to the tap point (native); a synthesised one has no native side
        const nativeJump = Math.abs(after - (min + 0.2 * (max - min))) <= (max - min) * 0.03
        expect(after === before || nativeJump, `after=${after} before=${before}`).toBe(true)
      })

      test('G4 · a gesture that starts vertical and turns horizontal still becomes a drag', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        const before = await readValue(row)
        const p = await at(r, 0.3)
        // first sample: dy 5, dx 1 -- under threshold on both axes, so undecided, not refused
        await touchDrag(page, r, [p, { x: p.x + 1, y: p.y + 5 }, { x: p.x + 40, y: p.y + 6 }, { x: p.x + 90, y: p.y + 6 }])
        expect(await readValue(row)).not.toBe(before)
      })

      test('G8 · the value you let go on is delivered even with no frame between', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        const { min, max, step } = await bounds(row)
        const a = await at(r, 0.2), b = await at(r, 0.8)
        const pts = Array.from({ length: 60 }, (_, i) => ({ x: a.x + (b.x - a.x) * (i / 59), y: a.y }))
        await touchDrag(page, r, pts)
        const after = await readValue(row)
        expect(Math.abs(after - (min + 0.8 * (max - min)))).toBeLessThanOrEqual(step * 2 + (max - min) * 0.03)
      })

      test('G9 · data-scrubbing is on the root for exactly the live part of a drag', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        expect(await scrubbing(page)).toBe(false)
        const p = await at(r, 0.4)
        // hold at the end of the move so the attribute can be read mid-gesture
        const mid = touchDrag(page, r, [p, { x: p.x + 20, y: p.y }, { x: p.x + 50, y: p.y }], { hold: 400 })
        await page.waitForTimeout(150)
        expect(await scrubbing(page)).toBe(true)
        await mid
        expect(await scrubbing(page)).toBe(false)
      })

      test('G11-13 · the row holds its height; only the bar grows, and it stays grown for 3s after lift', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        const rest = await heights(row)
        expect(rest.row).toBe(48); expect(rest.bar).toBe(32)
        const p = await at(r, 0.5)
        const gesture = touchDrag(page, r, [p, { x: p.x + 20, y: p.y }, { x: p.x + 40, y: p.y }], { hold: 600 })
        await page.waitForTimeout(300)
        expect(await engaged(row)).toBe(true)
        const during = await heights(row)
        expect(during.row).toBe(48); expect(during.bar).toBe(48)
        await gesture
        await page.waitForTimeout(1500)
        expect(await engaged(row), 'still engaged 1.5s after lift').toBe(true)
        await page.waitForTimeout(1900)
        expect(await engaged(row), 'released after 3s').toBe(false)
        const after = await heights(row)
        expect(after.row).toBe(48); expect(after.bar).toBe(32)
      })
    })

    test.describe('mouse', () => {
      test.skip(({ hasTouch }) => hasTouch, 'a mouse, not a finger')

      test('G5 · the ends of the bar are min and max', async ({ page }) => {
        const row = sizeRow(page); const r = range(row)
        const { min, max } = await bounds(row)
        const b = (await r.boundingBox())!
        for (const [fx, want] of [[0.002, min], [0.998, max]] as const) {
          await page.mouse.click(b.x + b.width * fx, b.y + b.height / 2)
          expect(await readValue(row)).toBe(want)
        }
      })
    })
  })
}
