import { test, expect, type Page } from '@playwright/test'

/* CHROME.md "Corners" -- the eased corner law behind <html data-corners="eased">, on
   tests/fixtures/corners.html (/dial/corners.html). Asserted: the flag scales rect radii by
   1.125, puts the eased clip on every pill (found by numbers, not class names) and on a pill
   ::after, leaves circles and small pills alone, and does NOT clip the focus ring. With the
   flag off nothing is marked and nothing is clipped. The cap's choke follows the pill's height
   (1.30 at 24px tall, 1.15 at 96px and above), its depth never does (C6). The look itself is
   judged by the renders. */

async function open(page: Page, q = '') {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/dial/corners.html' + q)
  await page.waitForFunction(() => (window as any).ready === true)
  await page.evaluate(() => document.fonts.ready)
  expect(errors).toEqual([])
}
const style = (page: Page, sel: string, prop: string, pseudo?: string) =>
  page.locator(sel).evaluate((e, [p, ps]) => getComputedStyle(e, ps || null).getPropertyValue(p), [prop, pseudo ?? ''] as const)

// The choke ratio L : (h/2) for a pill h px tall, written out again here on purpose: Mark's ramp.
const ramp = (h: number) => Math.round(Math.min(1.3, Math.max(1.15, 1.3 - 0.15 * (h - 24) / 72)) * 100) / 100

// Evaluate a pill's --pill-clip (the raw string on its inline style, var(--pill-s) and all) for a
// box w x h with short side s, and return the eased cap's geometry: where the curve leaves the
// straight (L, from the end), and the nose (how far from the end, and how deep across).
async function cap(page: Page, sel: string, prop = '--pill-clip') {
  return page.locator(sel).evaluate((el, prop) => {
    const raw = (el as HTMLElement).style.getPropertyValue(prop)
    const sProp = prop.replace('clip', 's')
    const s = parseFloat((el as HTMLElement).style.getPropertyValue(sProp))
    const r = el.getBoundingClientRect(), W = r.width
    const num = (t: string) => {   // 'calc(100% - 12.4px * 0.5)' | '100%' | '0px' | 'calc(12.4px * 0.5)'
      t = t.trim().replace(/100%/g, W + 'px').replace(/calc/g, '').replace(/px/g, '')
      return Function('return ' + t)() as number
    }
    const body = raw.replace(/var\(--pill-s(?:-[ab])?\)/g, s + 'px')
    const cmds = body.replace(/^shape\(evenodd /, '').replace(/\)$/, '').split(/,\s*(?=(?:line|move|arc|curve|close)\b)/)
    const moves = cmds.filter(c => c.startsWith('move to'))
    const eased = moves[1]                                       // 0: the round stadium, 1: the eased one
    const pt = (t: string) => t.match(/calc\([^)]*\)|-?[\d.]+px|100%/g)!
    const L = num(pt(eased.replace('move to ', ''))[0])
    const noses = cmds.filter(c => c.startsWith('curve to 100% '))   // the far cap's extreme: x = the end
    const nose = pt(noses[0].replace('curve to ', '').split(' with ')[0]).map(num)
    return { s, W, L, noseX: nose[0], noseY: nose[1], raw: raw.slice(0, 20) }
  }, prop)
}

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
      expect((await page.locator(sel).evaluate(e => (e as HTMLElement).style.getPropertyValue('--pill-clip'))), sel).toMatch(/^shape\(evenodd/)
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
    // a resize rebuilds the shape for the new height: 40px tall is a 1.27 choke, L = 0.635 h
    await page.locator('#pill200').evaluate(e => { (e as HTMLElement).style.height = '40px' })
    await expect.poll(async () => (await cap(page, '#pill200')).s).toBeCloseTo(40, 1)
    expect((await cap(page, '#pill200')).L).toBeCloseTo(40 * ramp(40) / 2, 1)
    await page.evaluate(() => { delete document.documentElement.dataset.corners })
    await expect.poll(() => page.locator('[data-wm-pill], [data-wm-pill-a], [data-wm-pill-b]').count()).toBe(0)
    expect(await style(page, '#btn8', 'border-top-left-radius')).toBe('8px')
    await page.evaluate(() => { document.documentElement.dataset.corners = 'eased' })
    await expect.poll(() => page.locator('#chip28').getAttribute('data-wm-pill')).toBe('x')
  })

  test('C6 · the choke follows the height (1.30 at 24px tall to 1.15 at 96px, held), the depth never does', async ({ page }) => {
    await open(page, '?corners=eased')
    for (const h of [24, 32, 48, 96, 160]) {
      const sel = '#h' + h, c = await cap(page, sel)
      expect(c.s, sel).toBeCloseTo(h, 1)
      expect(ramp(h), `ramp(${h})`).toBeCloseTo({ 24: 1.3, 32: 1.28, 48: 1.25, 96: 1.15, 160: 1.15 }[h]!, 2)
      // L : (h/2) is the ratio, so L is ratio x h/2 from the end (+-0.3px)
      expect(Math.abs(c.L - ramp(h) * h / 2), `${sel} L=${c.L.toFixed(2)} want ${(ramp(h) * h / 2).toFixed(2)}`).toBeLessThan(0.3)
      // the nose touches the end (x = W) and the cap is h/2 deep (y = h/2), whatever the choke
      expect(Math.abs(c.noseX - c.W), `${sel} nose at the end`).toBeLessThan(0.25)
      expect(Math.abs(c.noseY - h / 2), `${sel} cap h/2 deep`).toBeLessThan(0.25)
      // and the CSS radius is still h/2
      expect(parseFloat(await style(page, sel, 'border-top-left-radius')), sel).toBeGreaterThanOrEqual(h / 2)
    }
    // the ratio has fallen with height: the 24px cap bends in earlier, per h, than the 96px one
    expect((await cap(page, '#h24')).L / 24).toBeGreaterThan((await cap(page, '#h96')).L / 96 + 0.05)
    // the pseudo-element path builds the same shape from its own size variable
    const a = await cap(page, '#pseudo', '--pill-clip-a')
    expect(Math.abs(a.L - ramp(a.s) * a.s / 2)).toBeLessThan(0.3)
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
