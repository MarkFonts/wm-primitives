import { test, expect, type Page } from '@playwright/test'

/* CHROME.md "Corners" -- the eased corner law behind <html data-corners="eased">, on
   tests/fixtures/corners.html (/dial/corners.html). Asserted: the flag scales rect radii by
   1.125, puts the eased clip on every pill (found by numbers, not class names) and on a pill
   ::after, leaves circles and small pills alone, and does NOT clip the focus ring. With the
   flag off nothing is marked and nothing is clipped. The look itself is judged by the renders. */

async function open(page: Page, q = '') {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/dial/corners.html' + q)
  await page.waitForFunction(() => (window as any).ready === true)
  await page.evaluate(() => document.fonts.ready)
  expect(errors).toEqual([])
}
const style = (page: Page, sel: string, prop: string, pseudo?: string) =>
  page.locator(sel).evaluate((e, [p, ps]) => getComputedStyle(e, ps || null).getPropertyValue(p), [prop, pseudo ?? ''] as const)

// the house ring's left edge, sampled from a screenshot: [r, g, b] at 3px left of the element, mid-height
async function ringPixel(page: Page, sel: string) {
  await page.keyboard.press('Tab')
  await page.locator(sel).focus()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(100)
  expect(await page.locator(sel).evaluate(e => e.matches(':focus-visible'))).toBe(true)
  const r = (await page.locator(sel).boundingBox())!
  const buf = await page.screenshot({ clip: { x: Math.round(r.x - 12), y: Math.round(r.y + r.height / 2), width: 10, height: 1 } })
  return page.evaluate(async b64 => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode()
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
    const x = c.getContext('2d')!; x.drawImage(im, 0, 0)
    const d = x.getImageData(0, 0, c.width, 1).data, px = (i: number) => [...d.slice(i * 4, i * 4 + 3)]
    return { ring: px(c.width - 1), ground: px(0) }   // 3px left of the box: inside the 2px ring at offset 2
  }, buf.toString('base64'))
}

test.describe('the eased corner law', () => {
  test.skip(({ hasTouch }) => hasTouch, 'a geometry contract: the same for every pointer')

  test('C1 · flag off: nothing marked, nothing clipped, radii as written', async ({ page }) => {
    await open(page)
    expect(await page.locator('[data-wm-pill], [data-wm-pill-a], [data-wm-pill-b]').count()).toBe(0)
    expect(await style(page, '#chip28', 'clip-path')).toBe('none')
    expect(await style(page, '#btn8', 'border-top-left-radius')).toBe('8px')
    expect(await style(page, '#wmbtn', 'border-top-left-radius')).toBe('8px')
  })

  test('C2 · flag on: every rect radius x1.125, corner-shape kept', async ({ page }) => {
    await open(page, '?corners=eased')
    for (const sel of ['#btn8', '#wmbtn', '#menu']) {
      expect(await style(page, sel, 'border-top-left-radius'), sel).toBe('9px')
      expect(await style(page, sel, 'clip-path'), sel).toBe('none')
    }
    expect(await style(page, '#btn8', 'corner-shape')).toMatch(/superellipse\(1\.2\)/)
  })

  test('C3 · flag on: pills get the eased clip and a round cap underneath, found by numbers', async ({ page }) => {
    await open(page, '?corners=eased')
    const pills: [string, string, number][] = [['#chip28', 'x', 28], ['#pill200', 'x', 200], ['#chip', 'x', 27],
      ['#seg', 'x', 22], ['#lozenge', 'x', 26], ['#accent', 'x', 32], ['#vpill', 'y', 10]]
    for (const [sel, axis, s] of pills) {
      const el = page.locator(sel)
      expect(await el.getAttribute('data-wm-pill'), sel).toBe(axis)
      expect(parseFloat(await style(page, sel, '--pill-s')), sel).toBeCloseTo(s, 0)
      expect(await style(page, sel, 'clip-path'), sel).toMatch(/^shape\(evenodd/)
      expect(await style(page, sel, 'corner-shape'), sel).toMatch(/round|superellipse\(1\)/)
    }
    // a pill pseudo-element is marked on its host
    expect(await page.locator('#pseudo').getAttribute('data-wm-pill-a')).toBe('x')
    expect(await style(page, '#pseudo', 'clip-path', '::after')).toMatch(/^shape\(evenodd/)
    // the accent pill's face (::before, radius inherit) is a pill too; its spill (::after, square) is not
    expect(await page.locator('#accent').getAttribute('data-wm-pill-b')).toBe('x')
    expect(await page.locator('#accent').getAttribute('data-wm-pill-a')).toBeNull()
  })

  test('C4 · the clip follows the size, and goes when the flag goes', async ({ page }) => {
    await open(page, '?corners=eased')
    await page.locator('#pill200').evaluate(e => { (e as HTMLElement).style.height = '120px' })
    await expect.poll(() => style(page, '#pill200', '--pill-s')).toBe('120.00px')
    await page.evaluate(() => { delete document.documentElement.dataset.corners })
    await expect.poll(() => page.locator('[data-wm-pill], [data-wm-pill-a], [data-wm-pill-b]').count()).toBe(0)
    expect(await style(page, '#btn8', 'border-top-left-radius')).toBe('8px')
    await page.evaluate(() => { document.documentElement.dataset.corners = 'eased' })
    await expect.poll(() => page.locator('#chip28').getAttribute('data-wm-pill')).toBe('x')
  })

  test('C5 · the focus ring is drawn, not clipped, on a pill and on a rect under the flag', async ({ page }) => {
    for (const sel of ['#chip28', '#pill200', '#btn8', '#chip']) {
      await open(page)
      const off = (await ringPixel(page, sel)).ring
      await open(page, '?corners=eased')
      const { ring: on, ground } = await ringPixel(page, sel)
      // the ring's colour is there at all (not the page ground) ...
      expect(Math.max(...on.map((v, i) => Math.abs(v - ground[i]))), `${sel} ring present`).toBeGreaterThan(80)
      // ... and is the same paint as without the flag
      expect(Math.max(...on.map((v, i) => Math.abs(v - off[i]))), `${sel} ring unchanged`).toBeLessThan(24)
    }
  })
})
