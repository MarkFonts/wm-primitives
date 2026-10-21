import { test, expect, type Page } from '@playwright/test'

/* GESTURES.md G93-G94 -- the system page's live-area zoom (the shell's .wm-zoom, data-target
   ".wm-main", data-capture) on a long page: a pinch keeps the text under the fingers where it
   was, and a phone toolbar resizing the window does not move the reader. Before: a pinch half
   way down threw the reader thousands of px up the page, and deep in a zoomed page every
   toolbar change clamped scrollY to the unzoomed document's height. */
const Z = '.wm-zoom[data-target=".wm-main"]'

async function open(page: Page) {
  await page.goto('/grid/index.html')
  await page.evaluate(() => { try { localStorage.clear() } catch {} })
  await page.reload()
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500)
}

// a paragraph half way through the Color chapter, its text 400px down the screen; returns the
// focal point and the top of the character there
async function aim(page: Page) {
  return page.evaluate(() => {
    const ps = [...document.querySelectorAll('#s-color p')].filter(p => (p as HTMLElement).offsetHeight > 30)
    const p = ps[Math.floor(ps.length / 2)]
    scrollTo(0, p.getBoundingClientRect().top + scrollY - 390)
    const r = p.getBoundingClientRect(), x = r.left + Math.min(150, r.width / 2), y = 400
    const at = (document as any).caretRangeFromPoint?.(x, y) ?? null
    const rg = document.createRange()
    if (at) { rg.setStart(at.startContainer, at.startOffset); rg.setEnd(at.startContainer, Math.min(at.startOffset + 1, at.startContainer.length ?? 0)) } else rg.selectNodeContents(p)
    ;(window as any).__mark = rg
    return { x, y, top: rg.getBoundingClientRect().top }
  })
}
const markTop = (page: Page) => page.evaluate(() => (window as any).__mark.getBoundingClientRect().top)

test('G93 · a pinch (ctrl+wheel) half way down the page keeps the text under the pointer within a line', async ({ page }) => {
  await open(page)
  const a = await aim(page)
  await page.evaluate(({ x, y }) => {
    const t = document.elementFromPoint(x, y)!
    for (let i = 0; i < 8; i++) t.dispatchEvent(new WheelEvent('wheel', { deltaY: -5, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true }))
  }, a)
  expect(await page.evaluate(z => (document.querySelector(z) as any).__wmZoom.get(), Z)).toBe(150)
  expect(Math.abs(await markTop(page) - a.top)).toBeLessThan(24)
})

test('G93 · a two-finger pinch on a touch screen keeps the text under the fingers within a line', async ({ page, browserName, hasTouch, context }) => {
  test.skip(browserName !== 'chromium' || !hasTouch, 'a real touch pinch needs CDP: the touch project')
  await open(page)
  const a = await aim(page)
  const cdp = await context.newCDPSession(page)
  const pts = (d: number) => [{ x: a.x - d, y: a.y, id: 0 }, { x: a.x + d, y: a.y, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(40) })
  for (let i = 1; i <= 20; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(40 + i) })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect(await page.evaluate(z => (document.querySelector(z) as any).__wmZoom.get(), Z)).toBe(150)
  expect(Math.abs(await markTop(page) - a.top)).toBeLessThan(24)
})

test('G94 · zoomed, deep in the page: a toolbar-sized height change does not move the reader, and nothing moves after', async ({ page }) => {
  await open(page)
  const unzoomedMax = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  await page.evaluate(z => (document.querySelector(z) as any).__wmZoom.set(150), Z)
  await page.evaluate(m => scrollTo(0, m * 1.2), unzoomedMax)   // past where the unzoomed page ends
  await page.waitForTimeout(150)
  const y0 = await page.evaluate(() => scrollY)
  expect(y0).toBeGreaterThan(unzoomedMax)
  const vp = page.viewportSize()!
  for (let i = 0; i < 3; i++) {
    await page.setViewportSize({ width: vp.width, height: vp.height - 60 }); await page.waitForTimeout(80)
    await page.setViewportSize(vp); await page.waitForTimeout(80)
  }
  const ys = await page.evaluate(() => new Promise<number[]>(res => {
    const s: number[] = [], t0 = performance.now()
    const f = (now: number) => { s.push(scrollY); if (now - t0 < 1000) requestAnimationFrame(f); else res(s) }
    requestAnimationFrame(f)
  }))
  expect(Math.abs(ys[0] - y0)).toBeLessThanOrEqual(1)
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1)
})
