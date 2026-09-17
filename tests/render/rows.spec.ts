import { test, expect, type Page, type Locator } from '@playwright/test'
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { HOSTS, sealed, settle } from './hosts'

/* EVAL.md §3 -- rendering.
   Per host: every visible AxisSlider row, screenshotted alone and held to a committed
   baseline. That answers "did THIS host change?".
   Across hosts: not pixels -- the hosts show different labels and values, so two
   screenshots of `size` cannot be equal. The NUMBERS can: row height, label size and
   weight, bar height, field size, stepper box. Those are collected per host into
   test-results/parity/ and the last test prints every disagreement. Reported, never
   asserted (EVAL Q3). */

const PARITY_DIR = join('test-results', 'parity')

const labelOf = async (row: Locator) => {
  const name = row.locator('.slider-label-name, .slider-label-text').first()
  const raw = (await name.count()) ? await name.textContent() : (await row.textContent())?.trim().split(/\s+/)[0]
  return (raw ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'row'
}

/* The numbers a row is made of. Anything here that differs between hosts is a host
   stylesheet winning over the primitive -- which is allowed by the layer contract, and
   is exactly what the report exists to show. */
const measure = (row: Locator) => row.evaluate(el => {
  const n = (v: string) => Math.round(parseFloat(v) * 100) / 100
  const cs = (q: string, props: string[]) => {
    const t = q ? el.querySelector(q) : el
    if (!t) return null
    const s = getComputedStyle(t); const r = t.getBoundingClientRect()
    const out: Record<string, string | number> = { w: n(String(r.width)), h: n(String(r.height)) }
    for (const p of props) out[p] = s.getPropertyValue(p).trim()
    return out
  }
  return {
    row: cs('', ['min-height', 'padding-left', 'padding-right', 'border-radius']),
    label: cs('.slider-label', ['font-size', 'font-weight', 'letter-spacing', 'line-height', 'min-height', 'color']),
    name: cs('.slider-label-left', ['font-size', 'font-weight', 'letter-spacing', 'color', 'padding-bottom']),
    tag: cs('.slider-tag', ['font-size', 'font-weight', 'letter-spacing', 'color']),
    field: cs('input.slider-number', ['font-size', 'font-weight', 'padding', 'margin', 'color', 'width']),
    step: cs('.slider-step-btn', ['width', 'height', 'padding', 'margin']),
    track: cs('.slider-track-wrap', ['top', 'bottom', 'padding', 'height']),
    input: cs('input[type="range"]', ['height', 'opacity', 'cursor']),
  }
})

for (const host of HOSTS) for (const theme of host.themes) {
  test.describe(`${host.name} · ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await sealed(page)
      await host.setTheme(page, theme)
      await page.goto(host.url)
      await settle(page)
    })

    test('every visible dial row matches its baseline', async ({ page }, info) => {
      const rows = page.locator('.slider-row')
      const n = await rows.count()
      expect(n, 'the host renders at least one dial').toBeGreaterThan(0)
      const seen = new Map<string, number>()
      const parity: Record<string, unknown> = {}
      for (let i = 0; i < n; i++) {
        const row = rows.nth(i)
        const box = await row.boundingBox()
        if (!box || box.height === 0) continue          // collapsed tray / hidden panel
        if (!(await row.isVisible())) continue          // visibility:hidden ancestor (opsz-proofer's calibration row)
        await row.scrollIntoViewIfNeeded()
        const variant = (await row.getAttribute('class'))?.includes('slider-row--track') ? 'track' : 'default'
        let label = await labelOf(row)
        const k = seen.get(label) ?? 0; seen.set(label, k + 1); if (k) label += `-${k + 1}`
        await expect.soft(row).toHaveScreenshot(`${host.name}/${theme}/${variant}-${label}.png`)
        if (!(variant in parity)) parity[variant] = await measure(row)
      }
      mkdirSync(PARITY_DIR, { recursive: true })
      writeFileSync(join(PARITY_DIR, `${info.project.name}--${host.name}--${theme}.json`), JSON.stringify(parity, null, 1))
    })

    /* HDR is invisible to a screenshot -- the PNG is SDR. What CAN be asserted: the
       chosen mark is masked with the swatch in dark, and NOT in light, where the boost
       has nowhere to go (CHANGELOG 2026-09-09). Whether it glows is a device check. */
    test('the chosen mark carries the swatch only in the dark', async ({ page }) => {
      const active = page.locator('.wm-icon--active, .active .wm-icon').first()
      if (await active.count() === 0) test.skip(true, `${host.name} draws no Icon in an active state on this screen`)
      const bg = await active.evaluate(el => getComputedStyle(el).backgroundImage)
      if (theme === 'dark') expect(bg).toContain('data:image/avif')
      else expect(bg).toBe('none')
    })
  })
}

/* Runs last (workers: 1, file order). Reads what the tests above wrote for THIS
   project and lists every number that is not the same in every host. */
test('parity report: the same dial in every host', async ({}, info) => {
  if (!existsSync(PARITY_DIR)) test.skip(true, 'nothing collected')
  const files = readdirSync(PARITY_DIR).filter(f => f.startsWith(info.project.name + '--') && f.endsWith('.json'))
  const sets = files.map(f => ({ who: f.replace(info.project.name + '--', '').replace('.json', ''), data: JSON.parse(readFileSync(join(PARITY_DIR, f), 'utf8')) }))
  /* Not compared: widths (the container's, not the primitive's), colours (the host's
     seven numbers, by contract -- color.css), and a part one host simply does not draw
     (a size row has no axis tag). What is left is geometry the primitive owns. */
  const HOST_OWNED = /^(w|width|color)$/
  const lines: string[] = []
  for (const variant of ['track', 'default']) {
    const have = sets.filter(s => s.data[variant])
    if (have.length < 2) continue
    const parts = Object.keys(have[0].data[variant])
    for (const part of parts) {
      if (have.some(s => !s.data[variant][part])) continue
      const keys = new Set<string>(); have.forEach(s => Object.keys(s.data[variant][part] ?? {}).forEach(k => keys.add(k)))
      for (const key of keys) {
        if (HOST_OWNED.test(key)) continue
        const vals = have.map(s => `${s.who}=${JSON.stringify(s.data[variant][part]?.[key] ?? null)}`)
        if (new Set(have.map(s => JSON.stringify(s.data[variant][part]?.[key] ?? null))).size > 1)
          lines.push(`${variant}.${part}.${key}\n    ${vals.join('\n    ')}`)
      }
    }
  }
  const report = lines.length ? lines.join('\n') : 'every measured number agrees across hosts'
  await info.attach('parity', { body: report, contentType: 'text/plain' })
  console.log(`\n[parity · ${info.project.name}] ${lines.length} disagreement(s)\n${report}\n`)
})
