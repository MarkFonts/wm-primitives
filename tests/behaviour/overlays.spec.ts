import { test, expect, type Page } from '@playwright/test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/* GESTURES.md §17 -- src/overlays.tsx on tests/fixtures/overlays.html, with the page bundled
   from tests/fixtures/overlays-entry.tsx here (no committed build). What is asserted is the
   behavior the audit found missing -- Escape, the outside press, focus in and back, the ARIA on
   the trigger, the modal's inert page and trap -- and that none of it gets in the way of the
   dial or the iOS focus guard. There is no look to test: the primitives have none. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
let js = '', css = ''
test.beforeAll(async () => {
  const out = await build({
    entryPoints: [ROOT + 'tests/fixtures/overlays-entry.tsx'],
    bundle: true, write: false, format: 'iife', jsx: 'automatic', outdir: 'out',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'css' }, external: ['*.woff2', '../fonts/*', '*.ttf', '*.avif', '*.png', '*.svg'],
    logLevel: 'error',
  })
  for (const f of out.outputFiles) { if (f.path.endsWith('.js')) js = f.text; else css = f.text }
})

async function open(page: Page) {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/dial/overlays.html')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: js })
  await page.waitForSelector('#pop-btn')
  expect(errors).toEqual([])
}
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)
const log = (page: Page) => page.evaluate(() => (window as any).log as string[])

test.describe('overlays · keyboard and mouse', () => {
  test.skip(({ hasTouch }) => hasTouch, 'keyboard and mouse; the touch rows are below')
  test.beforeEach(async ({ page }) => { await open(page) })

  test('G112 · the trigger says what it opens, whether it is open, and which panel', async ({ page }) => {
    const btn = page.locator('#pop-btn')
    await expect(btn).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await expect(btn).not.toHaveAttribute('aria-controls', /.+/)
    await expect(page.locator('#menu-btn')).toHaveAttribute('aria-haspopup', 'true')
    await expect(page.locator('#lb-btn')).toHaveAttribute('aria-haspopup', 'listbox')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    const panel = page.locator('.house-panel')
    const id = await panel.getAttribute('id')
    expect(id).toBeTruthy()
    await expect(btn).toHaveAttribute('aria-controls', id!)
    await expect(panel).toHaveAttribute('role', 'dialog')
    await expect(panel).toHaveAttribute('tabindex', '-1')
    // the consumer's class and label land on the element, untouched
    await expect(panel).toHaveAttribute('aria-label', 'Panel')
  })

  test('G113 · Escape, a press outside, focus leaving and the trigger close it; the outside press lands', async ({ page }) => {
    const btn = page.locator('#pop-btn'), panel = page.locator('.house-panel')
    await btn.click(); await expect(panel).toBeVisible()
    await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0)

    await btn.click(); await expect(panel).toBeVisible()
    await page.locator('#outside').click()
    await expect(panel).toHaveCount(0)
    expect(await log(page)).toEqual(['outside click'])

    await btn.click(); await expect(panel).toBeVisible()
    await btn.click()
    await expect(panel).toHaveCount(0)
    await expect(btn).toHaveAttribute('aria-expanded', 'false')

    await btn.click(); await expect(panel).toBeVisible()
    await page.locator('#outside-field').focus()
    await expect(panel).toHaveCount(0)
  })

  test('G114 · focus goes in: the panel itself, never a field; a menu lands on its chosen item', async ({ page }) => {
    await page.locator('#pop-btn').click()
    await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('house-panel'))).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('#menu-btn').click()
    await expect.poll(() => focused(page)).toBe('mi-Regular')
    await page.keyboard.press('Escape')
    await page.locator('#lb-btn').click()
    await expect.poll(() => focused(page)).toBe('opt-h2')
  })

  test('G115 · focus comes back to the trigger, even one that takes no ref, but not from a field it went to on purpose', async ({ page }) => {
    await page.locator('#pop-btn').click()
    await page.keyboard.press('Escape')
    await expect.poll(() => focused(page)).toBe('pop-btn')
    await page.locator('#pop-btn').click()
    await page.locator('#pop-close').click()
    await expect.poll(() => focused(page)).toBe('pop-btn')
    // no ref: found by aria-controls at the open
    await page.locator('#noref-btn').click()
    await expect(page.locator('span.rail-pop')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect.poll(() => focused(page)).toBe('noref-btn')
    // focus moved to a field outside: it stays there
    await page.locator('#pop-btn').click()
    await page.locator('#outside-field').click()
    await expect(page.locator('.house-panel')).toHaveCount(0)
    await expect.poll(() => focused(page)).toBe('outside-field')
  })

  test('G116 · only the topmost answers: Escape closes the inner menu, then the dialog', async ({ page }) => {
    await page.locator('#dlg-btn').click()
    await page.locator('#inner-btn').click()
    await expect(page.locator('#inner-menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#inner-menu')).toHaveCount(0)
    await expect(page.locator('.modal')).toBeVisible()
    await expect.poll(() => focused(page)).toBe('inner-btn')
    await page.keyboard.press('Escape')
    await expect(page.locator('.modal')).toHaveCount(0)
    await expect.poll(() => focused(page)).toBe('dlg-btn')
  })

  test('G117 · Escape in a field that answers it is the field\'s; in one that ignores it, the panel\'s', async ({ page }) => {
    await page.locator('#pop-btn').click()
    const num = page.locator('.house-panel input.slider-number')
    await num.focus(); await num.press('Escape')
    await expect(page.locator('.house-panel')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('house-panel'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator('.house-panel')).toHaveCount(0)

    await page.locator('#pop-btn').click()
    await page.locator('#pop-plain').focus(); await page.keyboard.press('Escape')
    await expect(page.locator('.house-panel')).toHaveCount(0)
    await expect.poll(() => focused(page)).toBe('pop-btn')
  })

  test('G118 · arrows, Home and End walk the items, wrap, and skip a disabled one; arrows on the trigger open onto an end', async ({ page }) => {
    await page.locator('#menu-btn').click()
    await expect.poll(() => focused(page)).toBe('mi-Regular')
    await page.keyboard.press('ArrowDown'); expect(await focused(page)).toBe('mi-Bold')  // Medium is disabled
    await page.keyboard.press('ArrowDown'); expect(await focused(page)).toBe('mi-Light') // wraps
    await page.keyboard.press('ArrowUp'); expect(await focused(page)).toBe('mi-Bold')
    await page.keyboard.press('Home'); expect(await focused(page)).toBe('mi-Light')
    await page.keyboard.press('End'); expect(await focused(page)).toBe('mi-Bold')
    await page.keyboard.press('Escape')
    await page.locator('#menu-btn').focus()
    await page.keyboard.press('ArrowUp')
    await expect.poll(() => focused(page)).toBe('mi-Bold')
    await page.keyboard.press('Escape')
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => focused(page)).toBe('mi-Regular')  // the chosen one, before the first
    await page.keyboard.press('Tab')
    await expect(page.locator('#menu')).toHaveCount(0)
  })

  test('G119 · an item\'s action runs, then the menu closes and focus is back on the trigger; a disabled item does nothing', async ({ page }) => {
    await page.locator('#menu-btn').click()
    await expect(page.locator('#mi-Regular')).toHaveAttribute('role', 'menuitemradio')
    await expect(page.locator('#mi-Regular')).toHaveAttribute('aria-checked', 'true')
    await page.locator('#mi-Medium').click({ force: true })  // aria-disabled: Playwright will not, a hand can
    await expect(page.locator('#menu')).toBeVisible()
    await page.keyboard.press('End'); await page.keyboard.press('Enter')
    await expect(page.locator('#menu')).toHaveCount(0)
    expect(await log(page)).toEqual(['pick Bold'])
    await expect(page.locator('#menu-btn')).toHaveText('Bold')
    await expect.poll(() => focused(page)).toBe('menu-btn')
  })

  test('G120 · a modal makes the rest of the page inert and unscrollable, and gives both back', async ({ page }) => {
    await page.locator('#dlg-btn').click()
    await expect(page.locator('.modal')).toHaveAttribute('aria-modal', 'true')
    const inert = () => page.evaluate(() => ['outside', 'pop-btn', 'menu-btn'].map(id => !!document.getElementById(id)!.closest('[inert]')))
    expect(await inert()).toEqual([true, true, true])
    expect(await page.evaluate(() => !!document.querySelector('.modal')!.closest('[inert]'))).toBe(false)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden')
    await page.keyboard.press('Escape')
    expect(await inert()).toEqual([false, false, false])
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden')
  })

  test('G121 · a modal closes on Escape, the scrim and its own controls, and Tab stays inside', async ({ page }) => {
    const modal = page.locator('.modal')
    await page.locator('#dlg-btn').click()
    // Tab walks a, field, close, more, then wraps to a
    for (const id of ['dlg-a', 'dlg-field', 'dlg-z', 'inner-btn', 'dlg-a']) {
      await page.keyboard.press('Tab'); expect(await focused(page)).toBe(id)
    }
    await page.keyboard.press('Shift+Tab'); expect(await focused(page)).toBe('inner-btn')
    await page.mouse.click(5, 5)            // the scrim
    await expect(modal).toHaveCount(0)
    expect(await log(page)).toEqual([])
    await page.locator('#dlg-btn').click()
    await page.locator('#dlg-z').click()
    await expect(modal).toHaveCount(0)
  })

  test('G122 · a modal takes focus on its panel and gives it back to the opener once the page is live again', async ({ page }) => {
    await page.locator('#dlg-btn').click()
    await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('modal'))).toBe(true)
    await page.locator('#dlg-z').click()
    await expect.poll(() => focused(page)).toBe('dlg-btn')
  })

  test('G123 · a dial inside a panel drags without closing it', async ({ page }) => {
    await page.locator('#pop-btn').click()
    const range = page.locator('.house-panel input[type="range"]').first()
    const before = await page.locator('.house-panel input.slider-number').inputValue()
    const b = (await range.boundingBox())!
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width * 0.9, b.y + b.height / 2, { steps: 6 })
    await page.mouse.move(b.x + b.width * 1.6, b.y + b.height * 4, { steps: 4 })  // let go outside the panel
    await page.mouse.up()
    await expect(page.locator('.house-panel')).toBeVisible()
    expect(await page.locator('.house-panel input.slider-number').inputValue()).not.toBe(before)
  })

  test('G124 · reduced motion: the same states at the same moments, and focus moves never scroll', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator('#menu-btn').click()
    await expect.poll(() => focused(page)).toBe('mi-Regular')
    await page.keyboard.press('Escape')
    await expect(page.locator('#menu')).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    // nothing in the primitive animates: no running animations on the panel or its trigger
    await page.locator('#pop-btn').click()
    expect(await page.evaluate(() => document.querySelector('.house-panel')!.getAnimations({ subtree: true }).length)).toBe(0)
  })
})

test.describe('overlays · touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch only')
  test.beforeEach(async ({ page }) => { await open(page) })

  test('G113 · a tap outside closes it, and the tap lands', async ({ page }) => {
    await page.locator('#pop-btn').tap()
    await expect(page.locator('.house-panel')).toBeVisible()
    await page.locator('#outside').tap()
    await expect(page.locator('.house-panel')).toHaveCount(0)
    expect(await log(page)).toEqual(['outside click'])
  })

  test('G123 · with the iOS focus guard on an editable, a tap into it closes the panel and focus stays in the text', async ({ page }) => {
    await page.evaluate(() => { const w = window as any; w.stop = w.iosFocusGuard(document.getElementById('editable'), { caret: true }) })
    await page.locator('#pop-btn').tap()
    await expect(page.locator('.house-panel')).toBeVisible()
    // focus on the panel, not a field: no keyboard was asked for
    expect(await page.evaluate(() => document.activeElement?.classList.contains('house-panel'))).toBe(true)
    await page.locator('#editable').tap()
    await expect(page.locator('.house-panel')).toHaveCount(0)
    await expect.poll(() => focused(page)).toBe('editable')
  })
})
