import { test, expect, type Page } from '@playwright/test'

/* GESTURES.md §13 -- the vertical theme stack (themeSwitch.css .wm-theme-stack--vertical) and
   its dismissal (src/themeStack.js), with the zoom inside it as .wm-zoom--left or --down.
   Fixture: tests/fixtures/theme-stack.html -- the stack over text, the class put on by the
   page's own phone query (max-width: 768px, or a coarse pointer), as a host does it. Every
   test runs at 375 x 812, so the desktop project is a narrow window and the phones are phones. */
const stack = '#stack'
const rect = (page: Page, sel: string) => page.evaluate(s => { const r = document.querySelector(s)!.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom } }, sel)
const hidden = (page: Page) => page.evaluate(s => document.querySelector(s)!.hasAttribute('data-stowed'), stack)
const frames = (page: Page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
const scrollBy = async (page: Page, dy: number) => { await page.evaluate(d => window.scrollBy(0, d), dy); await frames(page) }
/* a pointer gesture on the stack, as events: WebKit cannot be handed a touch drag (EVAL.md) */
const swipe = (page: Page, from: { x: number, y: number }, dy: number, steps = 6) => page.evaluate(([x, y, dy, steps]) => {
  const at = (yy: number) => document.elementFromPoint(x, yy) ?? document.body
  const ev = (type: string, yy: number, t: Element) => t.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: yy, bubbles: true, cancelable: true, composed: true }))
  const t0 = at(y)
  ev('pointerdown', y, t0)
  for (let i = 1; i <= steps; i++) ev('pointermove', y + dy * i / steps, t0)
  ev('pointerup', y + dy, t0)
  t0.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y + dy }))
}, [from.x, from.y, dy, steps] as const)

const open = async (page: Page, qs = '') => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dial/theme-stack.html' + qs)
  await page.evaluate(() => { try { localStorage.clear() } catch {} })
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
}

test('G76 · vertical: fixed top right, marks top to bottom, no ground, targets on the line', async ({ page }) => {
  await open(page, '?hide=')
  await expect(page.locator(stack)).toHaveClass(/wm-theme-stack--vertical/)
  const cs = await page.evaluate(s => { const c = getComputedStyle(document.querySelector(s)!); return { pos: c.position, bg: c.backgroundColor, img: c.backgroundImage } }, stack)
  expect(cs.pos).toBe('fixed')
  expect(cs.bg).toBe('rgba(0, 0, 0, 0)')
  expect(cs.img).toBe('none')
  const marks = await page.evaluate(() => [...document.querySelectorAll('#stack .wm-theme .wm-icon-btn, #zoom .wm-zoom-toggle')].map(b => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right } }))
  expect(marks).toHaveLength(4)
  for (let i = 0; i < marks.length; i++) {
    expect(marks[i].w).toBeGreaterThanOrEqual(27); expect(marks[i].h).toBeGreaterThanOrEqual(27)
    expect(marks[i].w % 3).toBe(0); expect(marks[i].h % 3).toBe(0)
    expect(Math.abs(marks[i].r - marks[0].r)).toBeLessThan(0.5)          // one right edge
    if (i) expect(marks[i].y).toBeGreaterThanOrEqual(marks[i - 1].y + marks[i - 1].h - 0.5)   // top to bottom, no overlap
  }
  expect(375 - marks[0].r).toBe(12)   // --spacing-04 from the right edge
  // the chosen mark is the house active mark: the PQ swatch, clipped to the glyph (dark ground)
  const paint = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('#stack .active .wm-icon')!); return { clip: c.backgroundClip || (c as any).webkitBackgroundClip, img: c.backgroundImage } })
  expect(paint.img).toContain('image/avif')
  // and it stays put when the page scrolls under it ("not move with the page as I pan")
  const before = await rect(page, stack)
  await scrollBy(page, 300)
  expect(await rect(page, stack)).toEqual(before)
})

test('G76 · without the phone query the stack is the ordinary one', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'a coarse pointer always matches the query')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/dial/theme-stack.html')
  await expect(page.locator(stack)).not.toHaveClass(/wm-theme-stack--vertical/)
  await scrollBy(page, 600)
  expect(await hidden(page)).toBe(false)   // nothing hides unless it is vertical
})

test('G77 · data-hide="scroll": down hides past the threshold, a jitter does not, up shows', async ({ page }) => {
  await open(page, '?hide=scroll')
  await scrollBy(page, 200)                               // past the stack's own height
  expect(await hidden(page)).toBe(true)
  await expect(page.locator(stack)).toHaveJSProperty('inert', true)
  await scrollBy(page, -10); await scrollBy(page, 10); await scrollBy(page, -10)   // jitter: under 24px a way
  expect(await hidden(page)).toBe(true)
  await scrollBy(page, -30)
  expect(await hidden(page)).toBe(false)
  await scrollBy(page, 10); await scrollBy(page, 10)      // 20px down: under the run
  expect(await hidden(page)).toBe(false)
  await scrollBy(page, 10)                                // 30: over it
  expect(await hidden(page)).toBe(true)
  // the CSS: translated off the top edge
  await page.waitForTimeout(300)
  expect((await rect(page, stack)).b).toBeLessThanOrEqual(0)
  await page.evaluate(() => window.scrollTo(0, 0)); await frames(page)
  expect(await hidden(page)).toBe(false)                  // at the top it always shows
})

test('G78 · data-hide="swipe": up on the stack dismisses; short settles; the press is not a theme pick; top-edge tap returns', async ({ page }) => {
  await open(page, '?hide=swipe')
  const light = await rect(page, '#stack [data-mode="light"]')
  const from = { x: light.x + light.w / 2, y: light.y + light.h / 2 }
  await swipe(page, from, -12)                            // short: settles back
  expect(await hidden(page)).toBe(false)
  await swipe(page, from, -40)
  expect(await hidden(page)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')   // the swipe did not pick Light
  await scrollBy(page, 300)                               // scroll-hide is off: down does nothing more
  expect(await hidden(page)).toBe(true)
  const tap = (x: number, y: number) => page.evaluate(([x, y]) => {
    document.querySelector('main')!.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, cancelable: true }))
  }, [x, y] as const)
  await tap(100, 400); expect(await hidden(page)).toBe(true)            // a press elsewhere does nothing
  await tap(200, 10); expect(await hidden(page)).toBe(true)             // nor the top edge outside the footprint (the host's tabs live there)
  const f = await page.evaluate(s => { const e = document.querySelector(s) as HTMLElement; return { x: e.offsetLeft + e.offsetWidth / 2, y: e.offsetTop + 40 } }, stack)
  await tap(f.x, f.y); expect(await hidden(page)).toBe(false)           // inside the rest footprint: back
  await swipe(page, from, -40)
  await scrollBy(page, -40)                               // scroll up also brings it back
  expect(await hidden(page)).toBe(false)
})

test('G78 · a drag on the zoom rail is the rail\'s, not a swipe; hiding folds an open zoom', async ({ page }) => {
  await open(page, '?hide=scroll%20swipe')
  await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.setOpen(true))
  await page.waitForTimeout(700)
  const r = await rect(page, '#zoom .wm-hd-rail')
  await swipe(page, { x: r.x + r.w / 2, y: r.b - 4 }, -60)
  expect(await hidden(page)).toBe(false)
  await scrollBy(page, 300)
  expect(await hidden(page)).toBe(true)
  await expect(page.locator('#zoom')).toHaveAttribute('data-open', 'false')
})

test('G79 · .wm-zoom--down: the rail runs down, max at the top; the box lies over the text', async ({ page }) => {
  await open(page, '?hide=')
  const z = (s: string) => page.evaluate(s => eval(s), s)
  const page0 = await rect(page, 'main p')
  await page.locator('#zoom .wm-zoom-toggle').click()
  await page.waitForTimeout(700)
  await expect(page.locator('#zoom')).toHaveAttribute('data-open', 'true')
  const rail = page.locator('#zoom [role="slider"]')
  await expect(rail).toHaveAttribute('aria-orientation', 'vertical')
  const mark = await rect(page, '#zoom .wm-zoom-toggle'), inB = await rect(page, '#zoom [aria-label="Zoom in"]'), r = await rect(page, '#zoom .wm-hd-rail'), outB = await rect(page, '#zoom [aria-label="Zoom out"]')
  expect(inB.y).toBeGreaterThan(mark.y); expect(r.y).toBeGreaterThan(inB.y); expect(outB.y).toBeGreaterThan(r.y)
  const cx = (b: { x: number, w: number }) => b.x + b.w / 2
  expect(Math.abs(cx(inB) - cx(mark))).toBeLessThan(0.5)          // one axis: the glasses and the rail on the mark's
  expect(Math.abs(cx(outB) - cx(mark))).toBeLessThan(0.5)
  expect(Math.abs(cx(r) - cx(mark))).toBeLessThan(0.5)
  expect(r.h % 3).toBe(0)
  expect(await rect(page, 'main p')).toEqual(page0)       // nothing moved
  // a press near the top is near max; near the bottom near min
  await page.evaluate(([x, y]) => { const rl = document.querySelector('#zoom .wm-hd-rail')!; rl.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerId: 3 })); rl.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, pointerId: 3 })) }, [r.x + r.w / 2, r.y + 2])
  expect(await z(`document.querySelector('#zoom').__wmZoom.get()`)).toBeGreaterThanOrEqual(380)
  const hi = await rect(page, '#zoom .wm-hd-pill')
  await rail.focus(); await page.keyboard.press('Home')
  expect(await z(`document.querySelector('#zoom').__wmZoom.get()`)).toBe(50)
  const lo = await rect(page, '#zoom .wm-hd-pill')
  expect(lo.y).toBeGreaterThan(hi.y + 60)                 // min is down the rail
  await page.keyboard.press('ArrowUp')
  expect(await z(`document.querySelector('#zoom').__wmZoom.get()`)).toBe(60)
  expect(lo.r + 3).toBeLessThanOrEqual(375)                       // the lozenge on screen
})

/* a two-finger pinch over the target, as events. Where the engine has gesture events (WebKit:
   iOS Safari) the control reads those, else two touch pointers; the test sends the kind it reads. */
const pinch = (page: Page, scale: number) => page.evaluate(async scale => {
  const t = document.getElementById('page')!, cx = 180, cy = 300, d0 = 60
  const frame = () => new Promise(r => requestAnimationFrame(r))
  if ('ongesturestart' in window) {
    const g = (type: string, s: number) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'scale', { value: s }); t.dispatchEvent(e); return e.defaultPrevented }
    const pd = [g('gesturestart', 1)]
    for (let i = 1; i <= 8; i++) { pd.push(g('gesturechange', 1 + (scale - 1) * i / 8)); await frame() }
    g('gestureend', scale)
    return pd.every(Boolean)
  }
  const p = (type: string, id: number, x: number) => { const e = new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: cy, bubbles: true, cancelable: true }); t.dispatchEvent(e); return e.defaultPrevented }
  p('pointerdown', 1, cx - d0 / 2); p('pointerdown', 2, cx + d0 / 2)
  const pd: boolean[] = []
  for (let i = 1; i <= 8; i++) { const d = d0 * (1 + (scale - 1) * i / 8); pd.push(p('pointermove', 1, cx - d / 2)); pd.push(p('pointermove', 2, cx + d / 2)); await frame() }
  p('pointerup', 1, cx - d0 * scale / 2); p('pointerup', 2, cx + d0 * scale / 2)
  return pd.slice(1).every(Boolean)
}, scale)

test('G80 · a touch pinch over the target opens the vertical control and drives it; the page does not zoom, the stack stays put', async ({ page }) => {
  await open(page, '?hide=')
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('page')!).touchAction)).toBe('pan-x pan-y')
  const before = await rect(page, stack)
  await expect(page.locator('#zoom')).toHaveAttribute('data-open', 'false')
  expect(await pinch(page, 1.5)).toBe(true)                // every step cancelled: no native zoom
  await expect(page.locator('#zoom')).toHaveAttribute('data-open', 'true')
  expect(await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.get())).toBe(150)
  expect(await page.evaluate(() => document.getElementById('page')!.style.zoom)).toBe('1.5')
  await page.waitForTimeout(700)
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)
  expect(await rect(page, stack)).toEqual(before)
  await pinch(page, 0.5)                                    // a second pinch, while open, from 150: no close-and-reopen
  await expect(page.locator('#zoom')).toHaveAttribute('data-open', 'true')
  expect(await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.get())).toBe(80)
})

test('G81 · the host\'s data-hidden forces it hidden over scroll; removed, the scroll state stands; the script never touches it', async ({ page }) => {
  await open(page, '?hide=scroll%20swipe')
  const attr = () => page.evaluate(s => document.querySelector(s)!.hasAttribute('data-hidden'), stack)
  await page.evaluate(s => document.querySelector(s)!.setAttribute('data-hidden', ''), stack)
  await page.waitForTimeout(300)
  expect((await rect(page, stack)).b).toBeLessThanOrEqual(0)                  // off the top edge
  await expect(page.locator(stack)).toHaveJSProperty('inert', true)
  await scrollBy(page, 300); await scrollBy(page, -60)                         // down then up: the scroll state says shown
  expect(await hidden(page)).toBe(false)
  expect(await attr()).toBe(true)                                              // ... and the host's hide holds
  await page.waitForTimeout(300)
  expect((await rect(page, stack)).b).toBeLessThanOrEqual(0)
  await page.evaluate(s => (window as any).wmThemeStack.hide(document.querySelector(s), false), stack)
  expect(await attr()).toBe(false)
  await page.waitForTimeout(300)
  expect((await rect(page, stack)).y).toBeGreaterThan(0)                       // shown: what the scroll says
  await expect(page.locator(stack)).toHaveJSProperty('inert', false)
  await page.evaluate(s => (window as any).wmThemeStack.hide(document.querySelector(s), true), stack)
  await scrollBy(page, 300)                                                    // a scroll-down stows it under the host's hide
  await page.evaluate(s => (window as any).wmThemeStack.hide(document.querySelector(s), false), stack)
  expect(await hidden(page)).toBe(true)                                        // removed: still hidden, by the scroll
  expect(await attr()).toBe(false)
})

/* ?chrome=2: two 54px rows of fixed chrome, the text in its own stage (#pan) from y 108, data-below
   and data-scroller set as font-proofer sets them. */
const restTop = (page: Page) => page.evaluate(s => (document.querySelector(s) as HTMLElement).offsetTop, stack)

test('G82 · data-below: the stack rests under the lowest matching row + 6, on the line; follows a row that grows or goes; nothing matching, 6', async ({ page }) => {
  await open(page, '?chrome=2&hide=')
  expect(await restTop(page)).toBe(114)
  const row1 = await rect(page, '#row2'), st = await rect(page, stack)
  expect(st.y).toBeGreaterThanOrEqual(row1.b)                                  // never over the chrome
  await page.evaluate(() => { document.getElementById('row2')!.style.height = '60px' }); await frames(page)
  expect(await restTop(page)).toBe(120)                                        // 108 + 6 + 6
  await page.evaluate(() => document.getElementById('row2')!.remove()); await frames(page)
  expect(await restTop(page)).toBe(60)                                         // the chip row gone: under the tabs
  await page.evaluate(() => document.getElementById('row1')!.remove()); await frames(page)
  expect(await restTop(page)).toBe(6)                                          // nothing matches: the default
})

for (const h of [660, 700]) test(`G77 · stowed from a 114px rest at 375x${h} after a 30px stage scroll: clear of the top edge`, async ({ page }) => {
  await open(page, '?chrome=2&hide=scroll')
  await page.setViewportSize({ width: 375, height: h }); await frames(page)
  const under = await page.evaluate(s => { const e = document.querySelector(s) as HTMLElement; return e.offsetTop + e.offsetHeight - document.getElementById('pan')!.getBoundingClientRect().top }, stack)
  expect(under).toBeGreaterThan(0)
  const pan = (y: number) => page.evaluate(y => { document.getElementById('pan')!.scrollTop = y }, y).then(() => frames(page))
  await pan(12)
  expect(await hidden(page)).toBe(false)                                       // under the run
  await pan(30)
  expect(await hidden(page)).toBe(true)                                        // a named scroller: the 24px run alone, no near-top exemption
  await page.waitForTimeout(300)
  expect((await rect(page, stack)).b).toBeLessThanOrEqual(0)                   // the whole rest top cleared, not a fixed step
})

for (const w of [375, 390]) test(`G79 · down at ${w}: the lozenge is fully on screen, centred on the axis unless the edge needs it in`, async ({ page }) => {
  await open(page, '?chrome=2&hide=')
  await page.setViewportSize({ width: w, height: 812 }); await frames(page)
  await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.set(400))
  await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.setOpen(true)); await page.waitForTimeout(700)
  const p = await rect(page, '#zoom .wm-hd-pill'), m = await rect(page, '#zoom .wm-zoom-toggle')
  expect(p.r + 3).toBeLessThanOrEqual(w)                                       // ring included
  if (p.r + 3 < w - 1) expect(Math.abs(p.x + p.w / 2 - (m.x + m.w / 2))).toBeLessThan(0.5)
  for (const s of ['[aria-label="Zoom in"]', '[aria-label="Zoom out"]', '.wm-hd-rail']) { const b = await rect(page, '#zoom ' + s); expect(Math.abs(b.x + b.w / 2 - (m.x + m.w / 2))).toBeLessThan(0.5) }
})

test('G79 · down: the rail shortens to the viewport, 45 at least', async ({ page }) => {
  await open(page, '?chrome=2&hide=')
  await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.setOpen(true)); await page.waitForTimeout(700)
  expect((await rect(page, '#zoom .wm-hd-rail')).h).toBe(126)                  // 812: room for the whole rail
  await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.setOpen(false)); await page.waitForTimeout(400)
  await page.setViewportSize({ width: 375, height: 400 }); await frames(page)
  await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.setOpen(true)); await page.waitForTimeout(700)
  const r = await rect(page, '#zoom .wm-hd-rail'), box = await rect(page, '#zoom .wm-zoom-box')
  expect(r.h).toBeLessThan(126); expect(r.h % 3).toBe(0); expect(r.h).toBeGreaterThanOrEqual(45)
  if (r.h > 45) expect(box.b).toBeLessThanOrEqual(400 - 12 + 0.5)
  await page.setViewportSize({ width: 375, height: 300 }); await frames(page)
  expect((await rect(page, '#zoom .wm-hd-rail')).h).toBe(45)                   // the floor
})

test('G78 · stowed, the rest footprint is the stack\'s: a press there returns it and the field under it gets no focus', async ({ page, hasTouch }) => {
  await open(page, '?hide=swipe')
  const f = await page.evaluate(s => { const e = document.querySelector(s) as HTMLElement; return { x: e.offsetLeft + e.offsetWidth / 2, y: e.offsetTop + 50 } }, stack)
  await page.evaluate(([x, y]) => {
    const i = document.createElement('input'); i.id = 'under'
    Object.assign(i.style, { position: 'fixed', left: (x - 40) + 'px', top: (y - 15) + 'px', width: '80px', height: '30px', zIndex: '1' })
    document.body.appendChild(i)
  }, [f.x, f.y] as const)
  await page.evaluate(s => (document.querySelector(s) as any).__wmThemeStack.hide(), stack)
  await page.waitForTimeout(300)
  if (hasTouch) await page.touchscreen.tap(f.x, f.y); else await page.mouse.click(f.x, f.y)
  await page.waitForTimeout(100)
  expect(await hidden(page)).toBe(false)
  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('under')
  await page.waitForTimeout(600)
  if (hasTouch) await page.touchscreen.tap(f.x - 30, f.y); else await page.mouse.click(f.x - 30, f.y)   // shown: the field outside the column is the page's again
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('under')
})

test('G79 · the open rail also stops 12px above the foot of the data-scroller box', async ({ page }) => {
  await open(page, '?chrome=2&hide=')
  await page.evaluate(() => { document.getElementById('pan')!.style.bottom = '400px' })   // a stage ending at 412 on 812
  await page.evaluate(() => (document.querySelector('#zoom') as any).__wmZoom.setOpen(true)); await page.waitForTimeout(700)
  const r = await rect(page, '#zoom .wm-hd-rail'), box = await rect(page, '#zoom .wm-zoom-box'), pan = await rect(page, '#pan')
  expect(r.h % 3).toBe(0); expect(r.h).toBeGreaterThanOrEqual(45)
  if (r.h > 45) expect(box.b).toBeLessThanOrEqual(pan.b - 12 + 0.5)
  expect(r.h).toBeLessThan(126)
})

test('G79 · ¶ at 375x660: rest 114, stage foot 383 -- the box ends 12px inside the stage; the lozenge reaches both ends clear of the glasses', async ({ page }) => {
  await open(page, '?chrome=2&hide=')
  await page.setViewportSize({ width: 375, height: 660 }); await frames(page)
  await page.evaluate(() => { document.getElementById('pan')!.style.bottom = (660 - 383) + 'px' }); await frames(page)
  expect(await restTop(page)).toBe(114)
  const z = '#zoom', api = (f: string) => page.evaluate(f => eval(`(document.querySelector('#zoom')).__wmZoom.${f}`), f)
  await api('setOpen(true)'); await page.waitForTimeout(700)
  const r = await rect(page, z + ' .wm-hd-rail'), box = await rect(page, z + ' .wm-zoom-box')
  expect(r.h % 3).toBe(0); expect(r.h).toBeGreaterThanOrEqual(45)
  if (r.h > 45) expect(box.b).toBeLessThanOrEqual(383 - 12 + 0.5)
  const inB = await rect(page, z + ' [aria-label="Zoom in"]'), outB = await rect(page, z + ' [aria-label="Zoom out"]')
  await api('set(400)'); await frames(page)
  const hi = await rect(page, z + ' .wm-hd-pill')
  await api('set(50)'); await frames(page)
  const lo = await rect(page, z + ' .wm-hd-pill')
  expect(hi.y - 3).toBeGreaterThanOrEqual(inB.b - 0.5)                          // max: the ring clear of zoom_in
  expect(lo.b + 3).toBeLessThanOrEqual(outB.y + 0.5)                            // min: clear of zoom_out
  expect(Math.abs(hi.y - r.y - (r.b - lo.b))).toBeLessThan(1)                   // both ends of the rail reached
  expect(box.b).toBeLessThanOrEqual(383 - 12 + 0.5)                            // and here even the floor fits
})

test('G79 · a host --zoom-rail of 59px is honoured as-is, and the lozenge still reaches both ends', async ({ page }) => {
  await open(page, '?chrome=2&hide=')
  await page.evaluate(() => document.getElementById('stack')!.style.setProperty('--zoom-rail', '59px'))
  const api = (f: string) => page.evaluate(f => eval(`(document.querySelector('#zoom')).__wmZoom.${f}`), f)
  await api('setOpen(true)'); await page.waitForTimeout(700)
  const r = await rect(page, '#zoom .wm-hd-rail')
  expect(r.h).toBe(59)
  await api('set(400)'); await frames(page); const hi = await rect(page, '#zoom .wm-hd-pill')
  await api('set(50)'); await frames(page); const lo = await rect(page, '#zoom .wm-hd-pill')
  expect(lo.y - hi.y).toBeGreaterThan(30)                                       // real travel
  expect(hi.y).toBeGreaterThanOrEqual(r.y - 0.5); expect(lo.b).toBeLessThanOrEqual(r.b + 0.5)
})

test('G83 · data-fit: a box lower than the scroller lets the open rail run past the stage foot, 12px inside that box', async ({ page }) => {
  await open(page, '?chrome=2&hide=')
  await page.setViewportSize({ width: 375, height: 660 }); await frames(page)
  // the stage ends at 383; below it a 51px row whose right sixth is free under the zoom column
  await page.evaluate(() => {
    document.getElementById('pan')!.style.bottom = (660 - 383) + 'px'
    const row = document.createElement('div'); row.id = 'flaprow'
    Object.assign(row.style, { position: 'fixed', left: '0', right: '0', top: '383px', height: '51px' })
    document.body.appendChild(row)
  })
  const api = (f: string) => page.evaluate(f => eval(`(document.querySelector('#zoom')).__wmZoom.${f}`), f)
  await api('setOpen(true)'); await page.waitForTimeout(700)
  const short = (await rect(page, '#zoom .wm-hd-rail')).h
  await api('setOpen(false)'); await page.waitForTimeout(400)
  await page.evaluate(() => { document.getElementById('stack')!.dataset.fit = '#flaprow, #nothing-here' })
  await api('setOpen(true)'); await page.waitForTimeout(700)
  const r = await rect(page, '#zoom .wm-hd-rail'), box = await rect(page, '#zoom .wm-zoom-box')
  expect(r.h).toBeGreaterThan(short)
  expect(r.h % 3).toBe(0)
  expect(box.b).toBeLessThanOrEqual(434 - 12 + 0.5)
  expect(box.b).toBeGreaterThan(383)                                            // past the stage foot, into the row
  await api('setOpen(false)'); await page.waitForTimeout(400)
  await page.evaluate(() => { document.getElementById('stack')!.dataset.fit = '#nothing-here' })   // nothing matches: the scroller again
  await api('setOpen(true)'); await page.waitForTimeout(700)
  expect((await rect(page, '#zoom .wm-hd-rail')).h).toBe(short)
})
