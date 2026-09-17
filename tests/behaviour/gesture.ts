import type { Page, Locator } from '@playwright/test'

/* Two ways to put a finger on the page, because no one runner offers the real thing
   in both engines:
   - Chromium: a REAL touch through CDP Input.dispatchTouchEvent -- hit-testing,
     touch-action, pointer capture, the scroller's claim on the gesture, all of it.
   - WebKit: Playwright cannot drive a touch drag, so the PointerEvents are synthesised
     on the element itself. Same clientX/Y, same pointerType, so the component's
     judgement (GESTURES §0) is exercised exactly; what is NOT exercised is the
     browser's own arbitration with touch-action. That runs in Chromium. */

export type Pt = { x: number; y: number }

export async function touchDrag(page: Page, target: Locator, points: Pt[], opts: { hold?: number } = {}) {
  const engine = page.context().browser()?.browserType().name()
  if (engine === 'chromium') return cdpDrag(page, points, opts)
  return syntheticDrag(target, points, opts)
}

async function cdpDrag(page: Page, points: Pt[], { hold = 0 }: { hold?: number }) {
  const cdp = await page.context().newCDPSession(page)
  const tp = (p: Pt) => [{ x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 1, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(points[0]) })
  for (const p of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) })
  if (hold) await page.waitForTimeout(hold)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

async function syntheticDrag(target: Locator, points: Pt[], { hold = 0 }: { hold?: number }) {
  await target.evaluate((el, { points, hold }) => new Promise<void>(resolve => {
    const fire = (type: string, p: { x: number; y: number }) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y,
      bubbles: true, cancelable: true, composed: true,
    }))
    fire('pointerdown', points[0])
    for (const p of points.slice(1)) fire('pointermove', p)
    setTimeout(() => { fire('pointerup', points[points.length - 1]); resolve() }, hold)
  }), { points, hold })
}

/* Touch down, hold, and lift without moving -- a tap, or a long press. */
export const touchPress = (page: Page, target: Locator, p: Pt, hold = 0) => touchDrag(page, target, [p], { hold })

/* A point on a box, by fraction of its width and height. */
export async function at(target: Locator, fx: number, fy = 0.5): Promise<Pt> {
  const b = await target.boundingBox()
  if (!b) throw new Error('target has no box')
  return { x: b.x + b.width * fx, y: b.y + b.height * fy }
}
