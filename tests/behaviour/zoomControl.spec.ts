import { test, expect, type Page } from '@playwright/test'

/* GESTURES.md §12 -- the zoom control (src/zoomControl.js + .css) and the theme switch's
   stacked alternate (src/themeSwitch.css .wm-theme-stack). Fixture: tests/fixtures/zoom.html,
   a centred 720px measure as the target, the chips + zoom stack over it, and a marks + zoom
   stack (no target, local keys) under that. */
const ctl = '#ctl .wm-zoom'
const value = (page: Page, sel = ctl) => page.evaluate(s => (document.querySelector(s) as any).__wmZoom.get(), sel)
const set = (page: Page, v: number, sel = ctl) => page.evaluate(([s, v]) => (document.querySelector(s as string) as any).__wmZoom.set(v), [sel, v] as const)
const zoomOf = (page: Page) => page.evaluate(() => document.getElementById('page')!.style.zoom)

test.beforeEach(async ({ page }) => {
  await page.goto('/dial/zoom.html')
  await page.evaluate(() => { try { localStorage.clear() } catch {} })
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
})

test('G58 · the value clamps to min and max, and snaps to the step', async ({ page }) => {
  expect(await value(page)).toBe(100)
  await set(page, 9999); expect(await value(page)).toBe(400)
  await set(page, 1); expect(await value(page)).toBe(50)
  await set(page, 123); expect(await value(page)).toBe(120)
  await set(page, 126); expect(await value(page)).toBe(130)
  const rail = page.locator(`${ctl} [role="slider"]`)
  await expect(rail).toHaveAttribute('aria-valuemin', '50')
  await expect(rail).toHaveAttribute('aria-valuemax', '400')
  await expect(rail).toHaveAttribute('aria-valuenow', '130')
  await expect(rail).toHaveAttribute('aria-label', 'Zoom')
  await expect(page.locator(`${ctl} output`)).toHaveText('130%')
})

test('G59 · zoom_in / zoom_out step by 10, fit_screen goes back to 100', async ({ page, hasTouch }) => {
  /* On the phone profile a zoomed target is wider than the viewport, and mobile Chromium
     shrinks the visual viewport to it, so a coordinate click lands beside the fixed control.
     The press is the button's own click either way. */
  const press = (label: string) => { const b = page.locator(`${ctl} [aria-label="${label}"]`); return hasTouch ? b.dispatchEvent('click') : b.click() }
  await press('Zoom in')
  expect(await value(page)).toBe(110)
  await press('Zoom out')
  await press('Zoom out')
  expect(await value(page)).toBe(90)
  await set(page, 250); expect(await zoomOf(page)).toBe('2.5')
  await press('Back to 100%')
  expect(await value(page)).toBe(100)
  expect(await zoomOf(page)).toBe('')
})

test('G60 · + − 0 from the page and from the rail; never in a field, never with a modifier', async ({ page }) => {
  await page.locator('#page p').first().click()
  await page.keyboard.press('+'); expect(await value(page)).toBe(110)
  await page.keyboard.press('='); expect(await value(page)).toBe(120)
  await page.keyboard.press('-'); expect(await value(page)).toBe(110)
  await page.keyboard.press('0'); expect(await value(page)).toBe(100)
  // the local stack answers only when focus is inside it; the page-level one is left alone
  await page.locator('#marks [role="slider"]').focus()
  await page.keyboard.press('+')
  expect(await value(page, '#marks .wm-zoom')).toBe(110)
  expect(await value(page)).toBe(100)
  await page.keyboard.press('ArrowRight'); expect(await value(page, '#marks .wm-zoom')).toBe(120)
  await page.keyboard.press('End'); expect(await value(page, '#marks .wm-zoom')).toBe(400)
  // a field keeps its keys
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'f'; document.body.appendChild(i) })
  await page.locator('#f').focus(); await page.keyboard.press('+')
  expect(await value(page)).toBe(100)
  await page.locator('#page p').first().click()
  await page.keyboard.press('Control+='); expect(await value(page)).toBe(100)
})

test('G61 · the value survives a reload, and fires wm-zoom', async ({ page }) => {
  await set(page, 170)
  expect(await page.evaluate(() => localStorage.getItem('wm-zoom'))).toBe('170')
  expect(await page.evaluate(() => (window as any).events.at(-1))).toBe(170)
  await page.reload(); await page.evaluate(() => document.fonts.ready)
  expect(await value(page)).toBe(170)
  expect(await zoomOf(page)).toBe('1.7')
  await expect(page.locator(`${ctl} output`)).toHaveText('170%')
  // the other control keeps its own key
  expect(await value(page, '#marks .wm-zoom')).toBe(100)
})

test('G62 · anchored top-left: the left edge holds, the page grows right and scrolls', async ({ page }) => {
  const at = () => page.evaluate(() => {
    const t = document.getElementById('page')!.getBoundingClientRect()
    return { left: t.left + scrollX, top: t.top + scrollY, w: t.width, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }
  })
  const a = await at()
  await set(page, 300)
  const b = await at()
  expect(Math.abs(b.left - a.left)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(b.top - a.top * 3)).toBeLessThanOrEqual(1)   // the top margin is the target's own, so it zooms too
  expect(Math.abs(b.w - a.w * 3)).toBeLessThanOrEqual(1)
  expect(b.sw).toBeGreaterThanOrEqual(Math.floor(a.left + a.w * 3))   // the document scrolls to the zoomed target's right edge
  expect(b.sw).toBeGreaterThan(a.sw)
  expect(b.sw).toBeGreaterThan(b.cw)
})

test('G62 · a selector that matches several boxes zooms each, anchored on its own', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('div'); el.className = 'wm-zoom'; document.body.appendChild(el)
    const ps = [...document.querySelectorAll('#page p')] as HTMLElement[]
    const left = ps.map(p => p.getBoundingClientRect().left)
    const z = (window as any).wmZoom.mount(el, { target: '#page p', key: 'wm-zoom-multi', keys: 'local' })
    z.set(200)
    const out = { zooms: ps.map(p => p.style.zoom), dl: ps.map((p, i) => Math.abs(p.getBoundingClientRect().left - left[i])) }
    z.destroy()
    return { ...out, after: ps.map(p => p.style.zoom) }
  })
  expect(r.zooms).toEqual(['2', '2'])
  for (const d of r.dl) expect(d).toBeLessThanOrEqual(0.5)
  expect(r.after).toEqual(['', ''])
})

test('G63 · a baseline in the target is exactly twice as far down at 200%', async ({ page }) => {
  /* No re-seat: the prototype re-seated absolutely placed paragraphs on its own marks, a page's
     job, and flowing text has no mark to re-seat on. Chrome rounds a face's ascent and descent
     to whole pixels AT EACH SIZE, so the half-leading and the ascent at 32px are not exactly
     twice those at 16px: on macOS's system-ui the probe lands exactly (0px); on the Linux
     runner's face it lands 1px off (CI, 2026-10-07). So the bound is 1px, and the measured
     error is reported. */
  const off = () => page.evaluate(() => document.getElementById('probe')!.getBoundingClientRect().top - document.getElementById('page')!.getBoundingClientRect().top)
  const a = await off()
  await set(page, 200)
  const b = await off()
  test.info().annotations.push({ type: 'baseline', description: `100%: ${a}px, 200%: ${b}px, error ${Math.abs(b - 2 * a)}px` })
  expect(Math.abs(b - 2 * a)).toBeLessThanOrEqual(1)
})

test('G64 · the stack: one width and one right edge, both rows on the line', async ({ page, hasTouch }) => {
  const H = hasTouch ? 33 : 27
  for (const stack of ['#ctl', '#marks']) {
    const g = await page.evaluate(s => {
      const r = (e: Element) => { const b = e.getBoundingClientRect(); return { w: b.width, right: b.right, top: b.top, h: Math.round(b.height * 100) / 100 } }
      const root = document.querySelector(s)!
      return {
        r1: r(root.children[0]), r2: r(root.children[1]),
        marks: [...root.querySelectorAll('.wm-icon-btn')].map(e => Math.round(e.getBoundingClientRect().height * 100) / 100),
        chips: [...root.querySelectorAll('.wm-chip')].map(e => Math.round(e.getBoundingClientRect().height * 100) / 100),
        rail: Math.round(root.querySelector('.wm-hd-rail')!.getBoundingClientRect().height * 100) / 100,
        pill: Math.round(root.querySelector('.wm-hd-pill')!.getBoundingClientRect().height * 100) / 100,
      }
    }, stack)
    expect(Math.abs(g.r1.w - g.r2.w), stack).toBeLessThanOrEqual(0.5)
    expect(Math.abs(g.r1.right - g.r2.right), stack).toBeLessThanOrEqual(0.5)
    expect(g.r1.h, stack).toBe(H); expect(g.r2.h, stack).toBe(H); expect(g.rail, stack).toBe(H)
    for (const h of [...g.marks, ...g.chips]) expect(h, stack).toBe(H)
    expect(g.r2.top - g.r1.top, stack).toBe(H + 6)   // --spacing-02 between the rows
    if (!hasTouch) expect(g.pill, stack).toBe(21)    // ui 15 + a --tick each side; the 3px ring fills the 27
  }
})

test('G65 · press the lozenge and it does not jump; drag to the end reaches max', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'a pointer drag; the touch profile is covered by the press and the keys')
  const pill = (await page.locator(`${ctl} .wm-hd-pill`).boundingBox())!
  const rail = (await page.locator(`${ctl} .wm-hd-rail`).boundingBox())!
  await page.mouse.move(pill.x + pill.width / 2 + 3, pill.y + pill.height / 2)
  await page.mouse.down()
  expect(await value(page)).toBe(100)
  await page.mouse.move(rail.x + rail.width + 40, pill.y + pill.height / 2, { steps: 6 })
  expect(await value(page)).toBe(400)
  await page.mouse.move(rail.x - 40, pill.y + pill.height / 2, { steps: 6 })
  await page.mouse.up()
  expect(await value(page)).toBe(50)
  const p2 = (await page.locator(`${ctl} .wm-hd-pill`).boundingBox())!
  expect(p2.x - rail.x).toBeGreaterThanOrEqual(-0.5)   // the lozenge never leaves the rail
})

/* ---- collapse (data-collapse): rest as one mark, transform out of it on press ---- */
const rect = (page: Page, s: string) => page.evaluate(s => { const b = document.querySelector(s)!.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, w: b.width, h: Math.round(b.height * 100) / 100 } }, s)
const press = (page: Page, s: string, hasTouch: boolean) => hasTouch ? page.locator(s).dispatchEvent('click') : page.locator(s).click()

test('G66 · at rest a collapsing control is one 27px mark: data-icon, frame_inspect by default', async ({ page, hasTouch }) => {
  const H = hasTouch ? 33 : 27
  const row = await page.evaluate(() => {
    const z = document.querySelector('#row .wm-zoom')!
    return { open: (z as HTMLElement).dataset.open, mark: z.querySelector('.wm-zoom-toggle .wm-icon')!.textContent,
      inert: [...z.querySelectorAll('.wm-zoom-box > .wm-icon-btn, .wm-hd-rail, .wm-zoom-slot > :not(.wm-zoom-toggle)')].map(e => (e as HTMLElement).inert),
      expanded: z.querySelector('.wm-zoom-toggle')!.getAttribute('aria-expanded') }
  })
  expect(row.open).toBe('false'); expect(row.mark).toBe('frame_inspect'); expect(row.expanded).toBe('false')
  expect(row.inert.every(Boolean)).toBe(true)
  const box = await rect(page, '#row .wm-zoom-box'), t = await rect(page, '#row .wm-zoom-toggle')
  expect(box.w).toBe(H); expect(box.h).toBe(H); expect(t.w).toBe(H); expect(t.h).toBe(H)
  // the other two rest marks, as data-icon picks them
  expect(await page.locator('#cstack .wm-zoom-toggle .wm-icon').textContent()).toBe('pageview')
  const fs = await page.evaluate(() => { const el = document.createElement('div'); el.className = 'wm-zoom'; el.dataset.collapse = ''; el.dataset.icon = 'feature_search'; el.dataset.key = 'wm-zoom-x'; el.dataset.keys = 'local'; document.body.appendChild(el); (window as any).wmZoom.mount(el); return el.querySelector('.wm-zoom-toggle .wm-icon')!.textContent })
  expect(fs).toBe('feature_search')
})

test('G67 · press transforms the mark into the control; Escape and a press outside close it', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the press and the keys are the same on touch; the transform is timed here once')
  await expect(page.locator('#cstack .wm-zoom')).toHaveAttribute('data-open', 'true')
  await page.locator('#row .wm-zoom-toggle').click()
  await expect(page.locator('#cstack .wm-zoom')).toHaveAttribute('data-open', 'false')   // that press was outside the stack
  await page.waitForTimeout(60)
  const mid = await rect(page, '#row .wm-zoom-box')
  expect(mid.w).toBeGreaterThan(27); expect(mid.w).toBeLessThan(217)   // it is moving, not swapped
  await page.waitForTimeout(400)
  const open = await rect(page, '#row .wm-zoom-box')
  expect(open.w).toBe(217)
  await expect(page.locator('#row .wm-zoom')).toHaveAttribute('data-open', 'true')
  await expect(page.locator('#row .wm-zoom-toggle')).toHaveAttribute('aria-expanded', 'true')
  expect(await page.evaluate(() => document.activeElement!.getAttribute('role'))).toBe('slider')
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  await expect(page.locator('#row .wm-zoom')).toHaveAttribute('data-open', 'false')
  expect(await page.evaluate(() => document.activeElement!.classList.contains('wm-zoom-toggle'))).toBe(true)
  expect((await rect(page, '#row .wm-zoom-box')).w).toBe(27)
  // a press on the page closes it too
  await page.locator('#row .wm-zoom-toggle').click()
  await page.mouse.click(600, 420)
  await expect(page.locator('#row .wm-zoom')).toHaveAttribute('data-open', 'false')
})

test('G68 · reduced motion: the same states, no transform', async ({ page, hasTouch }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await press(page, '#row .wm-zoom-toggle', hasTouch)
  const w = await page.evaluate(() => [document.querySelector('#row .wm-zoom-box')!.getBoundingClientRect().width, 'moving' in (document.querySelector('#row .wm-zoom') as HTMLElement).dataset])
  expect(w[1]).toBe(false)
  expect(w[0]).toBeGreaterThan(200)
})

test('G69 · the open state is kept with the value, under the one key', async ({ page, hasTouch }) => {
  await press(page, '#row .wm-zoom-toggle', hasTouch)
  await page.evaluate(() => (document.querySelector('#row .wm-zoom') as any).__wmZoom.set(180))
  expect(await page.evaluate(() => localStorage.getItem('wm-zoom-row'))).toBe('180 open')
  await page.reload(); await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('#row .wm-zoom')).toHaveAttribute('data-open', 'true')
  expect(await value(page, '#row .wm-zoom')).toBe(180)
  await page.keyboard.press('Tab')   // focus somewhere, then close from inside
  await page.locator('#row [role="slider"]').focus(); await page.keyboard.press('Escape')
  expect(await page.evaluate(() => localStorage.getItem('wm-zoom-row'))).toBe('180 closed')
})

test('G70 · LEFT: opens leftwards over its row; right edge, row height and everything else stay', async ({ page, hasTouch }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const H = hasTouch ? 33 : 27
  const snap = async () => ({ z: await rect(page, '#row .wm-zoom'), box: await rect(page, '#row .wm-zoom-box'), theme: await rect(page, '#row .wm-theme'),
    exp: await rect(page, '#export'), under: await rect(page, '#under'), hdg: await rect(page, '#hdg'), row: await rect(page, '#row') })
  const a = await snap()
  await press(page, '#row .wm-zoom-toggle', hasTouch)
  const b = await snap()
  expect(Math.abs(b.box.r - a.box.r)).toBeLessThanOrEqual(0.5)   // the right edge is anchored
  expect(b.box.h).toBe(H); expect(b.row.h).toBe(H)
  expect(b.box.w).toBeGreaterThanOrEqual(3 * H + 128)             // the rail has 8rem of travel
  for (const k of ['z', 'theme', 'exp', 'under', 'hdg', 'row'] as const) expect(b[k], k).toEqual(a[k])
})

test('G71 · STACK: rests at the right edge under the switch; open, one width and one right edge', async ({ page, hasTouch }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const H = hasTouch ? 33 : 27
  let r1 = await rect(page, '#cstack > :first-child'), r2 = await rect(page, '#cstack > .wm-zoom')
  expect(Math.abs(r1.w - r2.w)).toBeLessThanOrEqual(0.5); expect(Math.abs(r1.r - r2.r)).toBeLessThanOrEqual(0.5)
  expect(r2.h).toBe(H)
  expect((await rect(page, '#cstack .wm-hd-rail')).w).toBeGreaterThanOrEqual(160)   // the 10rem floor
  await page.locator('#cstack [role="slider"]').focus(); await page.keyboard.press('Escape')
  r1 = await rect(page, '#cstack > :first-child'); r2 = await rect(page, '#cstack > .wm-zoom')
  expect(r2.w).toBe(H); expect(Math.abs(r1.r - r2.r)).toBeLessThanOrEqual(0.5); expect(r2.h).toBe(H)
})
