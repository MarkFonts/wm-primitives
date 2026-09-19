import { test, expect } from '@playwright/test'

/* The no-React bundle's API is what three pages depend on and nothing tested but a
   smoke probe (NEXT.md B). mount / get / set / update / destroy, plus mountTheme, on
   tests/fixtures/dial.html served at /dial/ with this repo's dist/. */
test.describe('wmDial contract', () => {
  test.skip(({ hasTouch }) => hasTouch, 'one profile is enough for an API')
  test.beforeEach(async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto('/dial/'); await page.waitForTimeout(300)
    expect(errors).toEqual([])
  })

  test('mount renders a row; get reads; a click on the rail changes it and calls onChange', async ({ page }) => {
    expect(await page.locator('#a .slider-row--track').count()).toBe(1)
    expect(await page.evaluate(() => da.get())).toBe(76)
    const r = page.locator('#a input[type=range]'); const b = (await r.boundingBox())!
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height / 2)
    const [v, last] = await page.evaluate(() => [da.get(), log[log.length - 1]])
    expect(v).not.toBe(76); expect(last).toEqual(['a', v])
  })

  test('set moves the value and the field without calling onChange; update changes props', async ({ page }) => {
    await page.evaluate(() => { log.length = 0; da.set(150) }); await page.waitForTimeout(50)
    expect(await page.locator('#a input.slider-number').inputValue()).toBe('150')
    expect(await page.evaluate(() => [da.get(), log.length])).toEqual([150, 0])
    await page.evaluate(() => da.update({ max: 300, value: 250 })); await page.waitForTimeout(50)
    expect(await page.locator('#a input[type=range]').getAttribute('max')).toBe('300')
    expect(await page.locator('#a input.slider-number').inputValue()).toBe('250')
  })

  test('typing commits on Enter, clamped, through onChange', async ({ page }) => {
    const f = page.locator('#b input.slider-number')
    await f.click(); await f.press('ControlOrMeta+a'); await f.pressSequentially('99'); await f.press('Enter')
    expect(await page.evaluate(() => [db.get(), log[log.length - 1]])).toEqual([30, ['b', 30]])
  })

  test('destroy empties the host; mountTheme draws the marks and stamps the root', async ({ page }) => {
    await page.evaluate(() => da.destroy()); await page.waitForTimeout(50)
    expect(await page.locator('#a .slider-row').count()).toBe(0)
    expect(await page.locator('#t .wm-icon').count()).toBe(3)
    await page.locator('#t [data-mode="light"]').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})
