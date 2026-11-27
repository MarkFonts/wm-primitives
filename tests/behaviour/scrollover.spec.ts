import { test, expect, type Page } from '@playwright/test'

/* The scrollover: src/scrollover.css + src/scrollover.js on tests/fixtures/scrollover.html
   (/dial/scrollover.html). What is asserted is the contract a host leans on -- the element's
   box never changes, the label stays the accessible text, the rest state puts the anchor copy
   on the label, hover runs the track and leave lands it and resets -- never the look. */
async function open(page: Page) {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/dial/scrollover.html')
  await page.waitForFunction(() => (window as any).ready === true)
  expect(errors).toEqual([])
}
const mid = (page: Page, sel: string) => page.locator(sel).evaluate(e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2 })

test.describe('the scrollover', () => {
  test.skip(({ hasTouch }) => hasTouch, 'a hover: on (hover: none) the track is not drawn at all')
  test.beforeEach(async ({ page }) => { await open(page) })

  test('mounting keeps the box, the label and the accessible name', async ({ page }) => {
    const a = page.locator('#a')
    await expect(a).toHaveAccessibleName('Explore Cal Sans')
    const w = await a.evaluate(e => {
      const before = e.getBoundingClientRect().width
      ;(window as any).wmScrollover.unmount(e)
      const bare = e.getBoundingClientRect().width
      const kids = e.childNodes.length
      ;(window as any).wmScrollover.mount(e)
      return { before, bare, kids, after: e.getBoundingClientRect().width }
    })
    expect(Math.abs(w.before - w.bare)).toBeLessThan(0.5)
    expect(Math.abs(w.after - w.bare)).toBeLessThan(0.5)
    expect(w.kids).toBe(2)          // unmount put the text node and the sep back
    await expect(a.locator('.so-track')).toHaveAttribute('aria-hidden', 'true')
  })

  test('at rest the anchor copy sits exactly on the label, and nothing runs', async ({ page }) => {
    for (const id of ['#a', '#b', '#c', '#d', '#e', '#f']) {
      const d = Math.abs(await mid(page, `${id} .so-anchor`) - await mid(page, `${id} .so-lab`))
      expect(d, id).toBeLessThan(0.1)
      const state = await page.locator(`${id} .so-track`).evaluate(e => getComputedStyle(e).animationPlayState)
      expect(state, id).toBe('paused')
    }
  })

  test('a short label in a wide box gets a run at least as wide as the box', async ({ page }) => {
    const r = await page.locator('#d').evaluate(e => ({ box: e.clientWidth, run: e.querySelector('.so-run')!.getBoundingClientRect().width }))
    expect(r.run).toBeGreaterThanOrEqual(r.box)
  })

  test('hover runs the track in --so-dir; leave lands a copy on the label and resets', async ({ page }) => {
    for (const [id, dir] of [['#a', 1], ['#c', -1]] as const) {
      const el = page.locator(id)
      const x0 = await el.locator('.so-track').evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).m41)
      await el.hover()
      await expect(el).toHaveClass(/is-on/)
      await page.waitForTimeout(400)
      const x1 = await el.locator('.so-track').evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).m41)
      expect((x1 - x0) * dir, id).toBeGreaterThan(2)
      await page.mouse.move(2, 2)
      await expect(el).toHaveClass(/is-out/)
      await expect(el.locator('.so-landing')).toHaveCount(1)
      await page.waitForTimeout(250)   // most of the landing
      await page.waitForTimeout(250)   // past the reset
      await expect(el).not.toHaveClass(/is-on|is-out/)
      const d = Math.abs(await mid(page, `${id} .so-anchor`) - await mid(page, `${id} .so-lab`))
      expect(d, id).toBeLessThan(0.1)
    }
  })

  test('data-scrollover="ital": a press slides ital to 1 and keeps wght and GEOM', async ({ page }) => {
    const b = page.locator('#b')
    const fvs = () => b.evaluate(e => getComputedStyle(e).fontVariationSettings)
    expect(await fvs()).toContain('"ital" 0')
    await b.hover(); await page.mouse.down()
    await page.waitForTimeout(350)
    const pressed = await fvs()
    await page.mouse.up()
    expect(pressed).toContain('"ital" 1'); expect(pressed).toContain('"wght" 700'); expect(pressed).toContain('"GEOM" 50')
  })

  test('reduced motion: the track does not run', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('#a').hover()
    const name = await page.locator('#a .so-track').evaluate(e => getComputedStyle(e).animationName)
    expect(name).toBe('none')
  })
})
