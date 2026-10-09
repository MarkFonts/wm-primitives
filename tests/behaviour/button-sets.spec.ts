import { test, expect, type Page } from '@playwright/test'

/* src/button-sets.css -- 06 Menu (.wm-menu, the primary) and 03 Rule (.wm-rule, the
   secondary), graduated from docs/system/pages/buttons.html. What the study promised for
   each, as computed style: no edge at rest, the ground under the pointer, the press law's
   stroke while held (1.8, corners.css), chosen, disabled, focus, the 44 floor on a coarse
   pointer, the full-width row, and the confirm's off/on (--confirm-off, motion.css).
   Fixture: tests/fixtures/button-sets.html, on the package's own tokens. */
const open = async (page: Page, theme = 'dark') => {
  // states are read as they land, not mid-transition
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/dial/button-sets.html?theme=${theme}`)
  await page.evaluate(() => document.fonts.ready)
}
const cs = (page: Page, sel: string) => page.evaluate(s => {
  const c = getComputedStyle(document.querySelector(s)!)
  const r = document.querySelector(s)!.getBoundingClientRect()
  return { bg: c.backgroundColor, shadow: c.boxShadow, border: c.borderTopWidth, color: c.color,
    deco: c.textDecorationLine, thick: c.textDecorationThickness, decoColor: c.textDecorationColor,
    outline: c.outlineStyle, outlineW: c.outlineWidth, h: r.height, w: r.width, x: r.x, right: r.right }
}, sel)
const surfaceHi = (page: Page) => page.evaluate(() => {
  const d = document.createElement('div'); d.style.background = 'var(--surface-hi)'; document.body.append(d)
  const v = getComputedStyle(d).backgroundColor; d.remove(); return v })
const accent = (page: Page) => page.evaluate(() => {
  const d = document.createElement('div'); d.style.color = 'var(--accent)'; document.body.append(d)
  const v = getComputedStyle(d).color; d.remove(); return v })
const NONE = 'rgba(0, 0, 0, 0)'

for (const theme of ['dark', 'light']) test.describe(theme, () => {
  test('06 at rest: no edge, no ground, on the line', async ({ page, hasTouch }) => {
    await open(page, theme)
    const m = await cs(page, '#m')
    expect(m.bg).toBe(NONE)
    expect(m.border).toBe('0px')
    expect(m.shadow).toBe('none')
    expect(m.h).toBe(hasTouch ? 45 : 36)
    expect(m.h % 3).toBe(0)
  })

  test('03 at rest: no box, a 1px rule, on the line', async ({ page, hasTouch }) => {
    await open(page, theme)
    const r = await cs(page, '#r')
    expect(r.bg).toBe(NONE)
    expect(r.border).toBe('0px')
    expect(r.deco).toBe('underline')
    expect(r.thick).toBe('1px')
    expect(r.h).toBe(hasTouch ? 45 : 36)
  })

  test('hover: 06 takes a ground, 03 thickens to 1.2', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'no hover on a touch pointer')
    await open(page, theme)
    await page.hover('#m')
    expect((await cs(page, '#m')).bg).not.toBe(NONE)
    await page.hover('#r')
    expect(parseFloat((await cs(page, '#r')).thick)).toBeCloseTo(1.2, 1)
  })

  test('held: the press law -- 06 rings at 1.8 with no fill, 03 goes to 1.8', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'a held mouse button is the probe')
    await open(page, theme)
    await page.hover('#m'); await page.mouse.down()
    const m = await cs(page, '#m')
    expect(m.shadow).toContain('inset')
    expect(m.shadow).toContain('1.8px')
    expect(m.bg).toBe(NONE)
    await page.mouse.up()
    await page.hover('#r'); await page.mouse.down()
    expect(parseFloat((await cs(page, '#r')).thick)).toBeCloseTo(1.8, 1)
    await page.mouse.up()
  })

  test('chosen: 06 on --surface-hi, 03 on the accent at 1.8', async ({ page }) => {
    await open(page, theme)
    expect((await cs(page, '#chosen')).bg).toBe(await surfaceHi(page))
    const on = await cs(page, '#r-on')
    expect(on.decoColor).toBe(await accent(page))
    expect(parseFloat(on.thick)).toBeCloseTo(1.8, 1)
  })

  test('disabled: 03 loses the rule; 06 takes no ground under the pointer', async ({ page, hasTouch }) => {
    await open(page, theme)
    expect((await cs(page, '#r-off')).deco).toBe('none')
    if (!hasTouch) { await page.hover('#off', { force: true }); expect((await cs(page, '#off')).bg).toBe(NONE) }
  })

  test('focus-visible: a 2px ring on both', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'keyboard focus')
    await open(page, theme)
    await page.focus('#m'); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
    const m = await cs(page, '#m')
    expect(m.outline).toBe('solid'); expect(m.outlineW).toBe('2px')
    await page.keyboard.press('Tab')
    const r = await cs(page, '#r')
    expect(r.outline).toBe('solid'); expect(r.outlineW).toBe('2px')
  })
})

test('the row is the full width of its column; a trailing mark sits at the far edge', async ({ page }) => {
  await open(page)
  const list = await page.evaluate(() => document.querySelector('#list')!.getBoundingClientRect().width - 24)
  const row = await cs(page, '#row')
  expect(row.w).toBeCloseTo(list, 0)
  const chosen = await cs(page, '#chosen'), trail = await cs(page, '#trail')
  expect(chosen.right - trail.right).toBeCloseTo(8, 0)   // --spacing-03, the row's own padding
})

test('the confirm: --confirm-off 1 is the rest look, 0 the held look', async ({ page }) => {
  await open(page)
  // motion.css drives the number; here it is set by hand, which is the whole contract.
  await page.evaluate(() => { for (const id of ['m', 'r']) { const el = document.getElementById(id)!; el.classList.add('wm-confirm'); el.style.setProperty('--confirm-off', '1') } })
  expect((await cs(page, '#m')).shadow).toMatch(/none|0px 0px 0px 0px/)
  expect((await cs(page, '#r')).thick).toBe('1px')
  await page.evaluate(() => { for (const id of ['m', 'r']) document.getElementById(id)!.style.setProperty('--confirm-off', '0') })
  expect((await cs(page, '#m')).shadow).toContain('1.8px')
  expect(parseFloat((await cs(page, '#r')).thick)).toBeCloseTo(1.8, 1)
})

test('the variants: icon-only is a 36 square, the field and the segment track sit on the line, the editables', async ({ page, hasTouch }) => {
  await open(page)
  const mark = await cs(page, '#mark')
  expect(mark.w).toBe(mark.h)
  expect(mark.h).toBe(hasTouch ? 45 : 36)
  const field = await cs(page, '#field')
  expect(field.h % 3).toBe(0)
  const seg = await cs(page, '#seg')
  expect(seg.h % 3).toBe(0)
  expect((await cs(page, '#field-ed')).deco).toBe('underline')
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('rule-ed')!).textDecorationStyle)).toBe('dashed')
})
