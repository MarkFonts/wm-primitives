import { test, expect, type Page, type Locator } from '@playwright/test'

/* GESTURES.md §14 -- the confirm. src/confirm.js + the keyframe in src/motion.css, wired into
   the primitives' own handlers, on tests/fixtures/confirm.html (/dial/confirm.html). What is
   asserted is the CLASS -- on after a success, off after the blink -- and the number the
   recipes read, never a colour: the paint is each recipe's, and the renders judge it. */
const has = (l: Locator) => l.evaluate(e => e.classList.contains('wm-confirm'))
const off = (l: Locator) => l.evaluate(e => getComputedStyle(e).getPropertyValue('--confirm-off').trim())

async function open(page: Page) {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/dial/confirm.html')
  await page.waitForFunction(() => (window as any).ready === true)
  await page.waitForTimeout(150)
  expect(errors).toEqual([])
}

test.describe('the confirm', () => {
  test.skip(({ hasTouch }) => hasTouch, 'a mouse is enough: the confirm is the same for every pointer')
  test.beforeEach(async ({ page }) => { await open(page) })

  test('G84 · a success adds .wm-confirm: off for the first 80ms, on for the next; removed after', async ({ page }) => {
    const chip = page.locator('#chips .wm-chip').nth(1)
    await chip.click()
    expect(await has(chip)).toBe(true)
    const phases = await chip.evaluate(e => {
      const a = e.getAnimations().find(a => (a as CSSAnimation).animationName === 'wm-confirm')!
      a.pause()
      const at = (t: number) => { a.currentTime = t; return getComputedStyle(e).getPropertyValue('--confirm-off').trim() }
      const r = [at(10), at(70), at(90), at(150)]
      a.play(); return r
    })
    expect(phases).toEqual(['1', '1', '0', '0'])
    await page.waitForTimeout(300)
    expect(await has(chip)).toBe(false)
    expect(await off(chip)).toBe('0')
  })

  test('G85 · reduced motion: no class, straight to the result', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const chip = page.locator('#chips .wm-chip').nth(1)
    await chip.click()
    expect(await has(chip)).toBe(false)
    expect(await chip.getAttribute('aria-pressed')).toBe('true')
  })

  test('G86 · a second success inside the blink restarts it on the same class -- never off and on again', async ({ page }) => {
    const chip = page.locator('#chips .wm-chip').nth(1)
    await chip.evaluate(e => {
      (window as any).removals = 0
      new MutationObserver(() => { if (!e.classList.contains('wm-confirm')) (window as any).removals++ })
        .observe(e, { attributes: true, attributeFilter: ['class'] })
    })
    await chip.click(); await page.waitForTimeout(100); await chip.click()
    const t = await chip.evaluate(e => e.getAnimations().find(a => (a as CSSAnimation).animationName === 'wm-confirm')!.currentTime as number)
    expect(t).toBeLessThan(60)
    expect(await page.evaluate(() => (window as any).removals)).toBe(0)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as any).removals)).toBe(1)
  })

  test('G87 · a press that failed its own check confirms nothing', async ({ page }) => {
    const save = page.locator('#save')
    await page.evaluate(() => { (window as any).saveOk = false })
    await save.click()
    expect(await has(save)).toBe(false)
    await page.evaluate(() => { (window as any).saveOk = true })
    await save.click()
    expect(await has(save)).toBe(true)
  })

  test('G88 · stepper: a tap confirms on lift; a hold that repeats does not, at any point', async ({ page }) => {
    const up = page.locator('#dial .slider-step-btn').first()
    await page.locator('#dial .slider-row').first().hover()
    const b = (await up.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down(); await page.mouse.up()
    expect(await page.evaluate(() => (window as any).dial.get())).toBe(11)
    expect(await has(up)).toBe(true)
    await page.waitForTimeout(300)
    // hold: the repeat starts at 400ms; sample the class through the hold and at the lift
    await page.mouse.down()
    const seen: boolean[] = []
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(90); seen.push(await has(up)) }
    await page.mouse.up()
    seen.push(await has(up))
    expect(await page.evaluate(() => (window as any).dial.get())).toBeGreaterThan(13)
    expect(seen.every(s => !s)).toBe(true)
  })

  test('G87 · stepper at its bound: the step is clamped away, nothing confirms', async ({ page }) => {
    await page.evaluate(() => (window as any).dial.set(20)); await page.waitForTimeout(50)
    const up = page.locator('#dial .slider-step-btn').first()
    await page.locator('#dial .slider-row').first().hover()
    const b = (await up.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down(); await page.mouse.up()
    expect(await has(up)).toBe(false)
  })

  test('G89 · zoom lozenge: a press that resets confirms; a drag from it does not; at 100 nothing', async ({ page }) => {
    const pill = page.locator('#zoom .wm-hd-pill')
    await page.evaluate(() => (document.getElementById('zoom') as any).__wmZoom.set(150)); await page.waitForTimeout(50)
    let b = (await pill.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2, { steps: 5 }); await page.mouse.up()
    expect(await has(pill)).toBe(false)
    expect(await page.evaluate(() => (document.getElementById('zoom') as any).__wmZoom.get())).not.toBe(100)
    b = (await pill.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    expect(await page.evaluate(() => (document.getElementById('zoom') as any).__wmZoom.get())).toBe(100)
    expect(await has(pill)).toBe(true)
    await page.waitForTimeout(300)
    b = (await pill.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)   // already 100: no outcome
    expect(await has(pill)).toBe(false)
  })

  test('G90 · theme mark (G38): the class survives React re-rendering the button on the result', async ({ page }) => {
    const light = page.locator('#theme [data-mode="light"]')
    await light.click()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
    await page.waitForTimeout(40)
    expect(await light.getAttribute('class')).toMatch(/\bactive\b/)
    expect(await has(light)).toBe(true)
    await page.waitForTimeout(300)
    expect(await has(light)).toBe(false)
  })

  test('G92 · the acknowledgement: chip and mark show a press look on :active, and the confirm at 40ms differs from it', async ({ page }) => {
    for (const [sel, read] of [
      ['#chips .wm-chip:nth-child(2)', 'chip'],
      ['#theme [data-mode="light"]', 'mark'],
    ] as const) {
      const el = page.locator(sel)
      const look = () => el.evaluate((e, read) => {
        const t = read === 'mark' ? e.querySelector('.wm-icon')! : e
        const cs = getComputedStyle(t)
        return [cs.borderTopColor, cs.backgroundColor, cs.color, cs.fontVariationSettings].join(' | ')
      }, read)
      const b = (await el.boundingBox())!
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(150)
      const hover = await look()
      await page.mouse.down()
      const pressed = await look()
      if (read === 'chip') expect(pressed).not.toBe(hover)   // a mark's ack IS the hover rung; on touch there is no hover
      await page.mouse.up()
      const at40 = await el.evaluate(e => { const a = e.getAnimations().find(a => (a as CSSAnimation).animationName === 'wm-confirm')!; a.pause(); a.currentTime = 40; return true })
      expect(at40).toBe(true)
      expect(await look()).not.toBe(pressed)
      await el.evaluate(e => e.getAnimations().forEach(a => a.finish()))
      await page.waitForTimeout(150)
    }
  })

  test('G92 · the lozenge brightens while pressed', async ({ page }) => {
    const pill = page.locator('#zoom .wm-hd-pill')
    const bg = () => pill.evaluate(e => getComputedStyle(e).backgroundColor)
    const rest = await bg()
    const b = (await pill.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down()
    expect(await bg()).not.toBe(rest)
    await page.mouse.up()
  })

  test('§14 · a --switch chip keeps its dashed edge through the blink', async ({ page }) => {
    const sw = await page.evaluate(() => {
      const b = document.createElement('button'); b.className = 'wm-chip wm-chip--switch on'; b.textContent = 'rev'
      document.getElementById('chips')!.append(b); (window as any).wmConfirm(b)
      const a = b.getAnimations().find(a => (a as CSSAnimation).animationName === 'wm-confirm')!; a.pause()
      const out: string[] = []
      for (const t of [40, 120]) { a.currentTime = t; out.push(getComputedStyle(b).borderTopStyle) }
      return out
    })
    expect(sw).toEqual(['dashed', 'dashed'])
  })
})
