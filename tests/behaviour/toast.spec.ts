import { test, expect, type Page } from '@playwright/test'

/* The toast: src/toast.js + src/toast.css on tests/fixtures/toast.html (/dial/toast.html), a
   page with no React. What is asserted is the contract Mark set (2026-11-08) -- every toast
   leaves after --dur-hint unless persist, the clock pauses for the pointer, focus and a hidden
   tab, the action confirms then runs then goes, one at a time, an id updates in place -- and
   where it rests: top right on a desktop, the bottom on a phone. The look is the renders'. */
const T = '.wm-toasts > .wm-toast'
const live = (page: Page) => page.locator(`${T}:not([data-state="exit"])`)

async function open(page: Page) {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/dial/toast.html')
  await page.waitForFunction(() => (window as any).ready === true)
  await page.evaluate(() => document.fonts.ready)
  expect(errors).toEqual([])
}
// `act` stands in for an action: a function cannot cross into the page
const show = (page: Page, o: object) => page.evaluate(({ act, ...o }: any) => {
  if (act) o.action = { label: act, onClick: () => { (window as any).ran++ } }
  ;(window as any).h = (window as any).toast(o)
}, o)

test.describe('the toast', () => {
  test.beforeEach(async ({ page }) => { await open(page) })

  test('shows: role=status in one polite region on <body>, and never takes focus', async ({ page }) => {
    await page.locator('#t-copied').focus()
    await show(page, { title: 'Glyph copied', line: 'ß U+00DF is on the clipboard.' })
    await expect(live(page)).toHaveCount(1)
    const r = await page.evaluate(() => {
      const reg = document.querySelector('.wm-toasts')!, t = reg.querySelector('.wm-toast')!
      return { parent: reg.parentElement!.tagName, live: reg.getAttribute('aria-live'), role: t.getAttribute('role'),
               title: t.querySelector('.wm-toast-title')!.textContent, line: t.querySelector('.wm-toast-line')!.textContent,
               focus: document.activeElement!.id, regions: document.querySelectorAll('.wm-toasts').length }
    })
    expect(r).toEqual({ parent: 'BODY', live: 'polite', role: 'status', title: 'Glyph copied',
                        line: 'ß U+00DF is on the clipboard.', focus: 't-copied', regions: 1 })
    await show(page, { title: 'Again' })
    expect(await page.evaluate(() => document.querySelectorAll('.wm-toasts').length)).toBe(1)
  })

  test('the dismiss mark: drawn for persist or an action, not for a toast that leaves on its own', async ({ page }) => {
    const marks = async (o: object) => { await show(page, o); return page.locator(`${T}:last-child .wm-menu--mark`).count() }
    expect(await marks({ title: 'Bare' })).toBe(0)
    expect(await marks({ title: 'Kept', persist: true })).toBe(1)
    expect(await marks({ title: 'Act', act: 'Reload' })).toBe(1)
    // 06 only: the action is .wm-menu, the dismiss .wm-menu--mark with the small close mark; no 03 Rule
    const r = await page.evaluate(() => {
      const t = document.querySelector('.wm-toast:last-child')!
      return { rule: t.querySelectorAll('.wm-rule').length, act: t.querySelector('.wm-menu:not(.wm-menu--mark)')!.textContent,
               x: t.querySelector('.wm-menu--mark .wm-icon.wm-menu-mark--sm')!.textContent,
               label: t.querySelector('.wm-menu--mark')!.getAttribute('aria-label') }
    })
    expect(r).toEqual({ rule: 0, act: 'Reload', x: 'close', label: 'Dismiss' })
    await page.evaluate(() => (window as any).update())
    expect(await page.locator(`${T}:last-child .wm-menu:not(.wm-menu--mark) .wm-icon`).textContent()).toBe('restart_alt')
  })

  test('auto-hides after --dur-hint (3s), an action included', async ({ page }) => {
    for (const o of [{ title: 'Glyph copied' }, { title: 'New version', act: 'Reload' }]) {
      await page.mouse.move(5, 5)
      await show(page, o)
      await page.waitForTimeout(2600)
      await expect(live(page)).toHaveCount(1)
      await page.waitForTimeout(700)
      await expect(live(page)).toHaveCount(0)
      await page.waitForTimeout(250)
      await expect(page.locator(T)).toHaveCount(0)   // gone from the DOM after --dur-fast
    }
  })

  test('the clock reads --dur-hint off the toast', async ({ page }) => {
    await page.addStyleTag({ content: ':root { --dur-hint: 600ms }' })
    await show(page, { title: 'Quick' })
    await page.waitForTimeout(450)
    await expect(live(page)).toHaveCount(1)
    await page.waitForTimeout(350)
    await expect(live(page)).toHaveCount(0)
  })

  test('pauses while the pointer is inside, resumes with what was left', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'hover is a mouse thing; focus and the hidden tab cover touch')
    await page.mouse.move(5, 5)
    await show(page, { title: 'Glyph copied', line: 'ß U+00DF is on the clipboard.' })
    await page.waitForTimeout(1000)
    const b = (await page.locator(T).boundingBox())!
    await page.mouse.move(b.x + 20, b.y + b.height / 2)
    await page.waitForTimeout(3200)
    await expect(live(page)).toHaveCount(1)
    await page.mouse.move(5, 5)
    await page.waitForTimeout(1400)                // ~2s were left
    await expect(live(page)).toHaveCount(1)
    await page.waitForTimeout(1000)
    await expect(live(page)).toHaveCount(0)
  })

  test('pauses while focus is inside, and while the tab is hidden', async ({ page }) => {
    await page.evaluate(() => (window as any).update())
    await page.locator(`${T} .wm-menu--mark`).focus()
    await page.waitForTimeout(3300)
    await expect(live(page)).toHaveCount(1)
    await page.locator('#t-copied').focus()
    await page.waitForTimeout(3300)
    await expect(live(page)).toHaveCount(0)

    await show(page, { title: 'Glyph copied' })
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(3300)
    await expect(live(page)).toHaveCount(1)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(3300)
    await expect(live(page)).toHaveCount(0)
  })

  test('persist stays until dismissed; the mark dismisses', async ({ page }) => {
    await show(page, { title: 'Kerning saved', persist: true })
    await page.waitForTimeout(3500)
    await expect(live(page)).toHaveCount(1)
    await page.locator(`${T} .wm-menu--mark`).click()
    await expect(live(page)).toHaveCount(0)
  })

  test('the action confirms first, runs after the blink, then dismisses', async ({ page }) => {
    await page.evaluate(() => (window as any).update())
    const act = page.locator(`${T} .wm-menu:not(.wm-menu--mark)`)
    const at = await act.evaluate(b => { (b as HTMLElement).click(); return { t: performance.now(), confirm: b.classList.contains('wm-confirm'), ran: (window as any).ran } })
    expect(at.confirm).toBe(true)
    expect(at.ran).toBe(0)                          // the receipt is seen before the outcome
    await page.waitForFunction(() => (window as any).ran === 1)
    const waited = await page.evaluate(() => (window as any).ranAt) - at.t
    expect(waited).toBeGreaterThanOrEqual(150)      // 2 x --dur-confirm
    expect(waited).toBeLessThan(600)
    await expect(live(page)).toHaveCount(0)
    await act.evaluate(b => (b as HTMLElement).click()).catch(() => {})
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as any).ran)).toBe(1)   // once, however often it is pressed
  })

  test('Esc dismisses', async ({ page }) => {
    await show(page, { title: 'Kerning saved', persist: true })
    await page.keyboard.press('Escape')
    await expect(live(page)).toHaveCount(0)
  })

  test('one at a time; the same id updates in place', async ({ page }) => {
    await page.evaluate(() => (window as any).update())
    await page.evaluate(() => { (document.querySelector('.wm-toast') as any).__mine = true })
    await page.evaluate(() => (window as any).update({ title: 'Newer version available' }))
    const r = await page.evaluate(() => {
      const all = document.querySelectorAll('.wm-toast')
      return { n: all.length, same: !!(all[0] as any).__mine, title: all[0].querySelector('.wm-toast-title')!.textContent }
    })
    expect(r).toEqual({ n: 1, same: true, title: 'Newer version available' })
    // the clock restarted: 2.5s after the update it is still there
    await page.waitForTimeout(1500)
    await page.evaluate(() => (window as any).update({ line: 'Still waiting.' }))
    await page.mouse.move(5, 5)
    await page.waitForTimeout(2500)
    await expect(live(page)).toHaveCount(1)
    // a different toast replaces it
    await show(page, { title: 'Glyph copied' })
    await expect(page.locator(T)).toHaveCount(1)
    expect(await page.locator(`${T} .wm-toast-title`).textContent()).toBe('Glyph copied')
    // the handle: update and close
    await page.evaluate(() => (window as any).h.update({ title: 'Glyph copied twice' }))
    expect(await page.locator(`${T} .wm-toast-title`).textContent()).toBe('Glyph copied twice')
    await page.evaluate(() => (window as any).h.close())
    await expect(live(page)).toHaveCount(0)
  })

  test('placement: top right on a desktop, the bottom full width on a phone; the host tokens move it', async ({ page, isMobile }) => {
    await show(page, { title: 'New version available', persist: true })
    await page.waitForTimeout(400)
    const vp = page.viewportSize()!
    const box = async () => (await page.locator(T).boundingBox())!
    let b = await box()
    const from = await page.evaluate(() => getComputedStyle(document.querySelector('.wm-toasts')!).getPropertyValue('--toast-from').trim())
    if (!isMobile) {
      expect(b.y).toBeCloseTo(12, 0)
      expect(b.x + b.width).toBeCloseTo(vp.width - 12, 0)
      expect(b.width).toBeLessThanOrEqual(400)
      expect(from).toMatch(/-/)                      // enters from above
      await page.addStyleTag({ content: ':root { --toast-top: 48px }' })
      await page.waitForTimeout(50)
      expect((await box()).y).toBeCloseTo(60, 0)
    } else {
      expect(b.x).toBeCloseTo(12, 0)
      expect(b.width).toBeCloseTo(vp.width - 24, 0)
      expect(b.y + b.height).toBeCloseTo(vp.height - 12, 0)   // env(safe-area-inset-bottom) is 0 here
      expect(from).not.toMatch(/-/)                  // enters from below
      await page.addStyleTag({ content: ':root { --toast-bottom: 45px }' })
      await page.waitForTimeout(50)
      b = await box()
      expect(b.y + b.height).toBeCloseTo(vp.height - 57, 0)
    }
    expect(b.height).toBeGreaterThanOrEqual(45)
  })

  test('reduced motion: opacity only, and the action runs without the blink', async ({ page }) => {
    const translate = (state: string) => page.evaluate(s => {
      const t = document.querySelector('.wm-toast') as HTMLElement
      t.style.transition = 'none'; t.dataset.state = s
      const v = getComputedStyle(t); return [v.translate, v.opacity]
    }, state)
    await show(page, { title: 'Kerning saved', persist: true })
    expect((await translate('enter'))[0]).not.toBe('none')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await translate('enter')).toEqual(['none', '0'])
    expect(await translate('exit')).toEqual(['none', '0'])

    await page.evaluate(() => (window as any).update())
    const act = page.locator(`${T}:not([data-state="exit"]) .wm-menu:not(.wm-menu--mark)`)
    const r = await act.evaluate(b => { (b as HTMLElement).click(); return b.classList.contains('wm-confirm') })
    expect(r).toBe(false)
    await page.waitForTimeout(50)
    expect(await page.evaluate(() => (window as any).ran)).toBe(1)
  })
})
