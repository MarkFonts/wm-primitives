import { test, expect, chromium, type Page } from '@playwright/test'

/* THE JPEG XL LIGHT IS TRANSPARENT ON THE PAGE, not only in the file (wm-primitives#133).
   On the system page's five-grounds demo (the accent buttons, Interface), with JPEG XL decoding (Chromium:
   --enable-features=JXLImageFormat) and the HDR rules forced on (headless has no HDR screen, so every
   `@media (dynamic-range: high)` in the page's styles is rewritten to apply), in BOTH themes, every q5 button over the
   checkerboard and the gradient is sampled at points inside its light's boxes but well outside the light:
     the spill   ::after, 8px in from each corner of its box (clipped to the ground's box)
     the rim     .wm-accent__lab::before, 2px in from each corner of its box -- outside the pill's rounded corner, so
                 this also proves the button's own ground (the ink face) is clipped to its radius, not a rectangle.
                 Sampled with the spill switched off, since the spill's light legitimately reaches those corners
   The grounds are enlarged for the test (and the column's clip lifted) so the spill's whole box fits on them and its
   corners are where its light has died out.
   and each sample must match the same pixel with that button hidden, within 2 levels. An opaque layer anywhere --
   an AVIF plane with a baked floor, a face painted square -- shows as a mismatch. The one opaque thing allowed is
   the pill-shaped face itself, which no sample touches. */

const GROUNDS = ['checker', 'gradient'] as const

async function open(page: Page, theme: 'dark' | 'light') {
  await page.emulateMedia({ colorScheme: theme })
  await page.goto('/grid/index.html')
  await page.evaluate(t => {
    document.documentElement.setAttribute('data-theme', t)
    for (const s of document.querySelectorAll('style')) {
      if (!s.textContent || !s.textContent.includes('dynamic-range: high')) continue
      s.textContent = s.textContent
        .replace(/@media \(dynamic-range: high\) and \(prefers-color-scheme: (dark|light)\)/g, '@media (prefers-color-scheme: $1)')
        .replace(/@media \(dynamic-range: high\)/g, '@media all')
    }
    /* room for the whole light: the grounds grow past it, so the samples can sit where the light has died out
       (the demo's own grounds clip it, and the column clips them) */
    const st = document.createElement('style'); st.id = 'jxl-spec'
    st.textContent = '#s-controls .ab-stage, #s-controls .ab-col { overflow: visible !important }' +
      '#s-controls .ab-ground { width: 680px !important; height: 360px !important; padding-top: 64px !important; overflow: visible !important }'
    document.head.appendChild(st)
  }, theme)
  return page.evaluate(() => (window as unknown as { wmJxl?: () => Promise<boolean> }).wmJxl?.() ?? false)
}

type Box = { x: number; y: number; w: number; h: number }
async function boxes(page: Page, ground: string) {
  return page.evaluate(g => {
    const cell = document.querySelector(`#s-controls .ab-ground--${g}`) as HTMLElement
    const btn = cell.querySelector('.wm-accent') as HTMLElement
    const c = cell.getBoundingClientRect(), b = btn.getBoundingClientRect(), cs = getComputedStyle(btn)
    const px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0
    const after = { x: b.left - px('--ab-mx'), y: b.top - px('--ab-mt'), w: b.width + 2 * px('--ab-mx'), h: b.height + px('--ab-mt') + px('--ab-mb') }
    const lab = getComputedStyle(btn.querySelector('.wm-accent__lab')!, '::before')
    return { cell: { x: c.left, y: c.top, w: c.width, h: c.height }, after, rim: { x: b.left + 1, y: b.top, w: b.width - 2, h: b.height - 1 },
      rimContent: lab.content, afterImage: getComputedStyle(btn, '::after').backgroundImage }
  }, ground)
}

function corners(b: Box, inset: number, within: Box) {
  const x0 = Math.max(b.x, within.x) + inset, x1 = Math.min(b.x + b.w, within.x + within.w) - inset - 1
  const y0 = Math.max(b.y, within.y) + inset, y1 = Math.min(b.y + b.h, within.y + within.h) - inset - 1
  return [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [Math.round(x), Math.round(y)])
}

async function grab(page: Page, clip: Box) {
  const buf = await page.screenshot({ clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h }, animations: 'disabled' })
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0)
    return { w: img.width, data: Array.from(x.getImageData(0, 0, img.width, img.height).data) }
  }, buf.toString('base64'))
}

test.describe('the JPEG XL light composites transparently', () => {
  test.skip(({ browserName, hasTouch }) => browserName !== 'chromium' || !!hasTouch, 'Chromium with its JXL flag, one profile')

  for (const theme of ['dark', 'light'] as const) {
    test(`${theme}: outside the light, every ground is untouched`, async ({ baseURL }) => {
      test.setTimeout(180_000)        // the system page is large, and each ground is shot three times
      /* its own Chromium: the JXL decoder is behind a feature flag (on by default from Chrome 155) */
      const browser = await chromium.launch({ args: ['--enable-features=JXLImageFormat'] })
      const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 900 } })
      const jxl = await open(page, theme)
      if (!jxl) await browser.close()
      /* a Chromium without the JXL decoder (the flag is a no-op there) cannot run this: skip, and say so */
      test.skip(!jxl, 'this Chromium does not decode JPEG XL even with --enable-features=JXLImageFormat (html.wm-jxl absent)')
      const report: string[] = [], bad: string[] = []
      for (const g of GROUNDS) {
        await page.locator(`#s-controls .ab-ground--${g}`).scrollIntoViewIfNeeded()
        await page.waitForTimeout(400)
        const bx = await boxes(page, g)
        expect(bx.afterImage, `${g}: the spill is the JXL one`).toContain('.jxl')
        expect(bx.rimContent, `${g}: the rim is drawn`).not.toBe('none')
        const pts = [...corners(bx.after, 8, bx.cell).map(p => ['spill', ...p]), ...corners(bx.rim, 2, bx.cell).map(p => ['rim', ...p])] as [string, number, number][]
        const hide = (gg: string, how: string) => page.evaluate(([gg, how]) => {
          const b = document.querySelector(`#s-controls .ab-ground--${gg} .wm-accent`) as HTMLElement
          b.style.visibility = how === 'button' ? 'hidden' : ''; b.classList.toggle('jxl-spec-nospill', how === 'spill')
        }, [gg, how])
        await page.evaluate(() => { document.getElementById('jxl-spec')!.textContent += '.jxl-spec-nospill::after { display: none !important }' })
        const shot = await grab(page, bx.cell)                      // everything
        await hide(g, 'spill'); const rimOnly = await grab(page, bx.cell)   // the rim and the face, the spill off
        await hide(g, 'button'); const bare = await grab(page, bx.cell)     // the ground alone
        await hide(g, '')
        for (const [what, x, y] of pts) {
          const img = what === 'rim' ? rimOnly : shot
          const i = ((y - Math.round(bx.cell.y)) * shot.w + (x - Math.round(bx.cell.x))) * 4
          const d = Math.max(...[0, 1, 2].map(k => Math.abs(img.data[i + k] - bare.data[i + k])))
          report.push(`${theme} ${g} ${what} (${x},${y}): ${img.data.slice(i, i + 3).join(',')} vs ${bare.data.slice(i, i + 3).join(',')} -> ${d}`)
          if (d > 2) bad.push(report[report.length - 1])
        }
      }
      console.log(report.join('\n'))
      await browser.close()
      expect(bad, bad.join('\n')).toEqual([])
    })
  }
})
