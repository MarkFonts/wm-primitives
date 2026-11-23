import { test, expect, type Page } from '@playwright/test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/* Five accessibility one-offs, from the audit: AxisSlider / AxisTriplet names, Collapse inert,
   the emphasis bubble as real buttons, Cmd/Ctrl+I/B, and the keyboard focus ring (GESTURES.md
   G102-G106). The React pieces are bundled from source onto tests/fixtures/zoom.html, which
   already carries the tokens, the icon font, the theme marks and a zoom control. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
let bundle = ''
test.beforeAll(async () => {
  const out = await build({
    stdin: {
      contents: `
        import { createElement as h, useState } from 'react'
        import { createRoot } from 'react-dom/client'
        import { AxisSlider } from './src/AxisSlider'
        import { AxisTriplet } from './src/AxisTriplet'
        import { Collapse } from './src/Collapse'
        import { InlineEmphasisBubble } from './src/InlineEmphasisBubble'
        import { EditableTextBlock } from './src/EditableTextBlock'
        function Sliders() {
          const [w, setW] = useState(400), [p, setP] = useState(16), [o, setO] = useState('auto')
          const [b, setB] = useState({ min: 1, desired: 2, max: 3 })
          return h('div', null,
            h(AxisSlider, { label: 'Weight', tag: 'wght', value: w, min: 100, max: 900, onChange: setW }),
            h(AxisSlider, { label: 'Size', value: p, min: 8, max: 96, suffix: 'px', onChange: setP }),
            h(AxisSlider, { label: 'Optical size', value: o, min: 8, max: 144, allowAuto: true, autoValue: 14, onChange: setO }),
            h(AxisTriplet, { label: 'Word space', unit: '%', value: b, onChange: setB }))
        }
        function Shut() {
          const [open, setOpen] = useState(false)
          return h('div', null,
            h('button', { id: 'flip', onClick: () => setOpen(o => !o) }, 'flip'),
            h(Collapse, { open }, h('button', { id: 'inside' }, 'inside')))
        }
        function Block({ emphasis }) {
          const [v, setV] = useState('alpha beta gamma')
          window.value = v
          return h(EditableTextBlock, { value: v, onCommit: setV, liveCommit: true, className: 'etb', emphasis })
        }
        window.mount = (what, props) => {
          const el = document.createElement('div'); el.id = what; document.body.appendChild(el)
          const C = { Sliders, Shut, Block, Bubble: () => h(InlineEmphasisBubble, { selector: '.ce' }) }[what]
          createRoot(el).render(h(C, props))
        }`,
      resolveDir: ROOT, loader: 'jsx',
    },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    loader: { '.css': 'empty' },   // the stylesheets come from the page, via /dial/shared
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  bundle = out.outputFiles[0].text
})

async function open(page: Page, what: string, props: object = {}) {
  await page.goto('/dial/zoom.html')
  await page.evaluate(() => document.fonts.ready)
  for (const css of ['collapse', 'chevron', 'AxisSlider', 'AxisTriplet', 'toggleGroup', 'InlineEmphasisBubble'])
    await page.addStyleTag({ url: `/dial/shared/src/${css}.css` })
  await page.addScriptTag({ content: bundle })
  await page.evaluate(([w, p]) => (window as any).mount(w, p), [what, props] as const)
}
const selectText = (page: Page, sel: string, word: string) => page.evaluate(([sel, word]) => {
  const el = document.querySelector(sel as string) as HTMLElement
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n: Node | null
  while ((n = w.nextNode())) {
    const i = n.textContent!.indexOf(word as string)
    if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + (word as string).length); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); return }
  }
}, [sel, word] as const)
const ring = (page: Page, sel: string) => page.locator(sel).evaluate(el => {
  const c = getComputedStyle(el); return c.outlineStyle === 'solid' && parseFloat(c.outlineWidth) >= 2
})
async function tabTo(page: Page, sel: string) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate(s => document.activeElement?.matches(s) ?? false, sel)) return
  }
  throw new Error('never reached ' + sel)
}

test.describe('a11y one-offs', () => {
  test.skip(({ hasTouch }) => hasTouch, 'keyboard and mouse')

  test('G102 · AxisSlider: the range and the field are named by the label, and say their unit and auto', async ({ page }) => {
    await open(page, 'Sliders')
    await expect(page.getByRole('slider', { name: 'Weight' })).toHaveCount(1)
    await expect(page.getByRole('spinbutton', { name: 'Weight' })).toHaveValue('400')
    const size = page.getByRole('slider', { name: 'Size', exact: true })
    await expect(size).toHaveAttribute('aria-valuetext', '16 px')
    await expect(page.getByRole('spinbutton', { name: 'Size', exact: true })).toHaveAttribute('aria-valuetext', '16 px')
    await expect(page.getByRole('slider', { name: 'Optical size' })).toHaveAttribute('aria-valuetext', 'auto, 14')
    await expect(page.getByRole('spinbutton', { name: 'Optical size' })).toHaveAttribute('aria-valuetext', 'auto, 14')
    // the triplet's fields were already named; the unit is spoken now
    await expect(page.getByRole('spinbutton', { name: 'Word space desired' })).toHaveAttribute('aria-valuetext', '2 %')
  })

  test('G103 · Collapse: shut is inert and aria-hidden, open is neither, and it still animates', async ({ page }) => {
    await open(page, 'Shut')
    const box = page.locator('.wm-collapse')
    await expect(box).toHaveJSProperty('inert', true)
    await expect(box).toHaveAttribute('aria-hidden', 'true')
    await page.evaluate(() => (document.getElementById('inside') as HTMLElement).focus())
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('inside')
    await page.locator('#flip').click()
    await expect(box).toHaveJSProperty('inert', false)
    await expect(box).not.toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('#inside')).toBeVisible()
    await page.evaluate(() => (document.getElementById('inside') as HTMLElement).focus())
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('inside')
    await page.locator('#flip').click()
    await expect(box).toHaveJSProperty('inert', true)
  })

  test('G104 · the emphasis bubble: a toolbar of real buttons, Enter / Space once each, aria-pressed', async ({ page }) => {
    await open(page, 'Bubble')
    await page.evaluate(() => {
      const d = document.createElement('div'); d.className = 'ce'; d.contentEditable = 'true'
      d.textContent = 'alpha beta gamma'; d.style.cssText = 'margin:200px 40px;font-size:20px'; document.body.appendChild(d)
    })
    const text = () => page.locator('.ce').textContent()
    await page.locator('.ce').focus(); await selectText(page, '.ce', 'beta')
    const bar = page.getByRole('toolbar', { name: 'Text emphasis' })
    await expect(bar).toBeVisible()
    const it = bar.getByRole('button', { name: 'Italic' }), bd = bar.getByRole('button', { name: 'Bold' })
    await expect(it).toHaveAttribute('aria-pressed', 'false')
    // keyboard: focus the button, Enter wraps once ...
    await it.focus(); await page.keyboard.press('Enter')
    expect(await text()).toBe('alpha *beta* gamma')
    await expect(it).toHaveAttribute('aria-pressed', 'true')
    // ... Space takes it off again (a toggle), still one marker pair at a time
    await it.focus(); await page.keyboard.press('Space')
    expect(await text()).toBe('alpha beta gamma')
    await expect(it).toHaveAttribute('aria-pressed', 'false')
    // the mouse path is unchanged and fires once, not twice (mousedown then click)
    await bd.click()
    expect(await text()).toBe('alpha **beta** gamma')
    await expect(bd).toHaveAttribute('aria-pressed', 'true')
    await expect(it).toHaveAttribute('aria-pressed', 'false')
  })

  test('G105 · Cmd/Ctrl+I and +B in a block with `emphasis` toggle the *markup*, never <i>/<b>', async ({ page }) => {
    await open(page, 'Block', { emphasis: true })
    const block = page.locator('.etb')
    await block.click()
    await selectText(page, '.etb', 'beta')
    await page.keyboard.press('ControlOrMeta+i')
    expect(await page.evaluate(() => (window as any).value)).toBe('alpha *beta* gamma')
    await page.keyboard.press('ControlOrMeta+b')
    expect(await page.evaluate(() => (window as any).value)).toBe('alpha ***beta*** gamma')
    await page.keyboard.press('ControlOrMeta+i')
    expect(await page.evaluate(() => (window as any).value)).toBe('alpha **beta** gamma')
    await page.keyboard.press('ControlOrMeta+b')
    expect(await page.evaluate(() => (window as any).value)).toBe('alpha beta gamma')
    expect(await block.locator('i, b, em, strong').count()).toBe(0)
  })

  test('G105 · without `emphasis` the keys are left alone', async ({ page }) => {
    await open(page, 'Block')
    await page.locator('.etb').click()
    await selectText(page, '.etb', 'beta')
    await page.keyboard.press('ControlOrMeta+i')
    expect(await page.evaluate(() => (window as any).value)).not.toContain('*')
  })

  test('G106 · the focus ring shows on keyboard focus and not on a click', async ({ page }) => {
    await open(page, 'Sliders')
    // toggle group
    await page.evaluate(() => {
      const g = document.createElement('div'); g.className = 'ui-seg'; g.id = 'seg'; g.style.cssText = 'position:fixed;left:16px;top:420px;z-index:9'
      g.innerHTML = '<button type="button" class="active">Auto</button><button type="button">Light</button>'
      document.body.prepend(g)
    })
    await tabTo(page, '#seg > button')
    expect(await ring(page, '#seg > button:first-child')).toBe(true)
    await page.locator('#seg > button:last-child').click()
    expect(await ring(page, '#seg > button:last-child')).toBe(false)
    // theme marks, and the zoom control's mark and rail
    await page.locator('#marks .wm-icon-btn').first().focus()
    await page.locator('#page p').first().click()
    await page.locator('#marks .wm-icon-btn').nth(1).click()
    expect(await ring(page, '#marks .wm-theme .wm-icon-btn:nth-child(2)')).toBe(false)
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
    expect(await ring(page, '#marks .wm-theme .wm-icon-btn:nth-child(2)')).toBe(true)
    await tabTo(page, '#ctl .wm-zoom-toggle')
    expect(await ring(page, '#ctl .wm-zoom-toggle')).toBe(true)
    await page.locator('#ctl .wm-zoom-toggle').click()
    await page.locator('#ctl .wm-zoom [role="slider"]').focus()
    await page.keyboard.press('ArrowRight')
    expect(await ring(page, '#ctl .wm-zoom [role="slider"]')).toBe(true)
    // the triplet's field: its outline:none no longer beats the ring
    await page.getByRole('spinbutton', { name: 'Word space min' }).focus()
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
    expect(await ring(page, '.triplet-num >> nth=0')).toBe(true)
  })

  test('G106 · the toast action takes the ring on a key', async ({ page }) => {
    await page.goto('/dial/toast.html')
    await page.waitForFunction(() => (window as any).ready === true)
    await page.evaluate(() => (window as any).toast({ title: 'Saved', persist: true, action: { label: 'Reload', onClick() {} } }))
    await tabTo(page, '.wm-toast .wm-menu:not(.wm-menu--mark)')
    expect(await ring(page, '.wm-toast .wm-menu:not(.wm-menu--mark)')).toBe(true)
  })
})
