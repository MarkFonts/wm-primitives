import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/* GESTURES.md §15 -- src/iosFocusGuard.js on tests/fixtures/ios-guard.html. The fling only happens
   on a real iPhone, so nothing here shows the fix working. These cover the logic: a faked UA,
   synthetic touches (an Event carrying touches, which every engine here accepts), and a scroll
   the test makes itself where iOS would. A wrong guard fails these; a right one still needs
   the phone. */
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const VIEW = { width: 390, height: 664 }

const contexts: BrowserContext[] = []
test.afterEach(async () => { await Promise.all(contexts.splice(0).map(c => c.close())) })

async function open(browser: Browser, baseURL: string | undefined, ua: string, maxTouchPoints?: number) {
  const context = await browser.newContext({ baseURL, userAgent: ua, viewport: VIEW, hasTouch: true })
  contexts.push(context)
  const page = await context.newPage()
  await page.addInitScript(points => {
    if (points !== null) Object.defineProperty(navigator, 'maxTouchPoints', { get: () => points })
    const w = window as any
    w.listeners = 0
    const add = EventTarget.prototype.addEventListener, rm = EventTarget.prototype.removeEventListener
    const counted = (t: string) => /^touch|^focus/.test(t)
    EventTarget.prototype.addEventListener = function (t: string, ...r: any[]) { if (counted(t)) w.listeners++; return (add as any).call(this, t, ...r) }
    EventTarget.prototype.removeEventListener = function (t: string, ...r: any[]) { if (counted(t)) w.listeners--; return (rm as any).call(this, t, ...r) }
    w.touch = (el: Element, type: string, x: number, y: number, fingers = 1) => {
      const e = new Event(type, { bubbles: true, cancelable: true }) as any
      const point = { clientX: x, clientY: y, target: el }
      e.touches = type === 'touchend' ? [] : Array(fingers).fill(point)
      e.changedTouches = [point]
      el.dispatchEvent(e)
      return e.defaultPrevented
    }
    w.$ = (id: string) => document.getElementById(id)
    // The keyboard, as far as the guard can see it.
    w.keyboard = (height: number) => Object.defineProperty(window.visualViewport, 'height', { get: () => height, configurable: true })
    w.wait = (ms: number) => new Promise(r => setTimeout(r, ms))
    // The reveal scroll, played a few times over the hold. Returns what each box ended up at.
    w.reveal = async (ms = 300) => {
      const until = performance.now() + ms
      while (performance.now() < until) {
        window.scrollBy({ top: 500, behavior: 'instant' as ScrollBehavior })
        w.$('scroll').scrollBy({ top: 500, behavior: 'instant' as ScrollBehavior })
        w.$('shell').scrollBy({ top: 500, behavior: 'instant' as ScrollBehavior })
        await w.wait(50)
      }
      await w.wait(120)
      return { win: window.scrollY, scroll: w.$('scroll').scrollTop, shell: w.$('shell').scrollTop }
    }
    w.tap = (el: HTMLElement, y = 100) => { w.touch(el, 'touchstart', 50, y); w.touch(el, 'touchend', 50, y); el.focus({ preventScroll: true }) }
  }, maxTouchPoints ?? null)
  await page.goto('/dial/ios-guard.html')
  await page.waitForFunction(() => (window as any).ready === true)
  await page.evaluate(() => {
    const w = window as any
    window.scrollTo({ top: 200, behavior: 'instant' as ScrollBehavior })
    w.$('scroll').scrollTop = 60
  })
  return page
}

const SAVED = { win: 200, scroll: 60, shell: 0 }
const guard = (page: Page, id: string, caret = false) =>
  page.evaluate(([id, caret]) => { const w = window as any; w.stop = w.iosFocusGuard(w.$(id), { caret }) }, [id, caret] as const)

test.describe('off iOS it is not there', () => {
  for (const [name, ua, points] of [['Android phone', ANDROID, 5], ['a Mac with no touch', MAC, 0]] as const) {
    test(`G95 · ${name}: no listeners, no holding, and nothing to clean up`, async ({ browser, baseURL }) => {
      const page = await open(browser, baseURL, ua, points)
      const before = await page.evaluate(() => (window as any).listeners)
      await guard(page, 'inner')
      expect(await page.evaluate(() => (window as any).listeners)).toBe(before)
      const end = await page.evaluate(async () => { const w = window as any; w.tap(w.$('inner')); return w.reveal() })
      expect(end.win).toBeGreaterThan(SAVED.win)
      expect(end.scroll).toBeGreaterThan(SAVED.scroll)
      expect(await page.evaluate(() => { (window as any).stop(); return (window as any).listeners })).toBe(before)
    })
  }

  test('G95 · iPad reporting as a Mac is iOS', async ({ browser, baseURL }) => {
    const page = await open(browser, baseURL, MAC, 5)
    const before = await page.evaluate(() => (window as any).listeners)
    await guard(page, 'inner')
    expect(await page.evaluate(() => (window as any).listeners)).toBeGreaterThan(before)
  })
})

test.describe('on iOS', () => {
  let page: Page
  test.beforeEach(async ({ browser, baseURL }) => { page = await open(browser, baseURL, IPHONE) })

  test('G96 · the window, the scroller, and the overflow:hidden box around it are all put back', async () => {
    await guard(page, 'inner')
    const end = await page.evaluate(async () => { const w = window as any; w.tap(w.$('inner')); return w.reveal() })
    expect(end).toEqual(SAVED)
  })

  test('G96 · a textarea and a wrapper around editables are held the same way', async () => {
    await guard(page, 'ta')
    await guard(page, 'wrap')
    expect(await page.evaluate(async () => { const w = window as any; w.tap(w.$('ta')); return w.reveal() })).toEqual(SAVED)
    await page.evaluate(() => (document.activeElement as HTMLElement).blur())
    expect(await page.evaluate(async () => {
      const w = window as any
      w.touch(w.$('wrapped'), 'touchstart', 50, 100); w.touch(w.$('wrapped'), 'touchend', 50, 100); w.$('wrapped').focus({ preventScroll: true })
      return w.reveal()
    })).toEqual(SAVED)
  })

  test('G96 · a surface without the bug is never written to', async () => {
    await guard(page, 'inner')
    const writes = await page.evaluate(async () => {
      const w = window as any
      let n = 0
      const count = (o: any) => { const f = o.scrollTo; o.scrollTo = function (...a: any[]) { n++; return f.apply(this, a) } }
      count(window); count(w.$('scroll')); count(w.$('shell'))
      w.tap(w.$('inner'))
      await w.wait(800)
      return n
    })
    expect(writes).toBe(0)
  })

  test('G96 · the hold ends 700ms after the focus', async () => {
    await guard(page, 'inner')
    const end = await page.evaluate(async () => {
      const w = window as any
      w.tap(w.$('inner'))
      await w.wait(850)
      window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior })
      await w.wait(100)
      return window.scrollY
    })
    expect(end).toBe(900)
  })

  test('G97 · a touchmove anywhere ends the hold, and one before the focus means no hold', async () => {
    await guard(page, 'inner')
    const during = await page.evaluate(async () => {
      const w = window as any
      w.tap(w.$('inner'))
      await w.wait(50)
      w.touch(document.body, 'touchmove', 50, 90)
      return w.reveal(200)
    })
    expect(during.win).toBeGreaterThan(SAVED.win)
    await page.evaluate(() => (document.activeElement as HTMLElement).blur())
    const before = await page.evaluate(async () => {
      const w = window as any
      const y = window.scrollY
      w.touch(w.$('inner'), 'touchstart', 50, 100)
      w.touch(w.$('inner'), 'touchmove', 50, 80)
      w.touch(w.$('inner'), 'touchend', 50, 80)
      w.$('inner').focus({ preventScroll: true })
      return (await w.reveal(200)).win > y
    })
    expect(before).toBe(true)
  })

  test('G97 · a second finger is not a tap', async () => {
    await guard(page, 'inner')
    const end = await page.evaluate(async () => {
      const w = window as any
      w.touch(w.$('inner'), 'touchstart', 50, 100, 2); w.touch(w.$('inner'), 'touchend', 50, 100); w.$('inner').focus({ preventScroll: true })
      return w.reveal(200)
    })
    expect(end.win).toBeGreaterThan(SAVED.win)
  })

  test('G98 · a tap the keyboard would cover is left to iOS, closed or open', async () => {
    await guard(page, 'inner')
    const run = (y: number, kb: number) => page.evaluate(async ([y, kb]) => {
      const w = window as any
      w.keyboard(kb)
      window.scrollTo({ top: 200, behavior: 'instant' as ScrollBehavior })
      w.$('scroll').scrollTop = 60; w.$('shell').scrollTop = 0
      w.tap(w.$('inner'), y)
      const end = await w.reveal(200)
      w.$('inner').blur()
      await w.wait(750)
      return end
    }, [y, kb] as const)
    // Closed: the room is 664 * 0.55 = 365.2.
    expect(await run(317, 664)).toEqual(SAVED)
    expect((await run(318, 664)).win).toBeGreaterThan(SAVED.win)
    // Open: the room is what is left.
    expect(await run(251, 300)).toEqual(SAVED)
    expect((await run(252, 300)).win).toBeGreaterThan(SAVED.win)
  })

  test('G99 · a tap that got no focus does not hold a later one', async () => {
    await guard(page, 'inner')
    const end = await page.evaluate(async () => {
      const w = window as any
      w.touch(w.$('inner'), 'touchstart', 50, 100); w.touch(w.$('inner'), 'touchend', 50, 100)
      await w.wait(550)
      w.$('inner').focus({ preventScroll: true })
      return w.reveal(200)
    })
    expect(end.win).toBeGreaterThan(SAVED.win)
  })

  test('G99 · a tap is spent by its focus', async () => {
    await guard(page, 'inner')
    const end = await page.evaluate(async () => {
      const w = window as any
      w.tap(w.$('inner'))
      await w.wait(750)
      w.$('inner').blur(); w.$('inner').focus({ preventScroll: true })
      return w.reveal(200)
    })
    expect(end.win).toBeGreaterThan(SAVED.win)
  })

  test('G100 · without caret, a tap is native: nothing prevented, nothing focused', async () => {
    await guard(page, 'inner')
    const r = await page.evaluate(() => {
      const w = window as any
      w.touch(w.$('inner'), 'touchstart', 50, 100)
      return { prevented: w.touch(w.$('inner'), 'touchend', 50, 100), active: document.activeElement === w.$('inner') }
    })
    expect(r).toEqual({ prevented: false, active: false })
  })

  test('G100 · with caret, a quick tap takes the focus without scrolling and places the caret', async () => {
    await guard(page, 'inner', true)
    const r = await page.evaluate(() => {
      const w = window as any
      const el = w.$('inner')
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })    // caretRangeFromPoint needs it on screen
      const range = document.createRange()
      range.setStart(el.firstChild, 6); range.collapse(true)
      const at = range.getBoundingClientRect()
      const before = w.$('scroll').scrollTop
      w.touch(el, 'touchstart', at.left, at.top + 4)
      const prevented = w.touch(el, 'touchend', at.left, at.top + 4)
      const sel = getSelection()!
      return { prevented, active: document.activeElement === el, offset: sel.anchorOffset, moved: w.$('scroll').scrollTop - before }
    })
    expect(r).toEqual({ prevented: true, active: true, offset: 6, moved: 0 })
  })

  test('G100 · with caret, left to iOS: a drag, a long press, an element already focused, a covered line', async () => {
    await guard(page, 'inner', true)
    const r = await page.evaluate(async () => {
      const w = window as any
      const el = w.$('inner')
      const out: Record<string, boolean> = {}
      w.touch(el, 'touchstart', 50, 100); w.touch(el, 'touchmove', 50, 80)
      out.drag = w.touch(el, 'touchend', 50, 80)
      w.touch(el, 'touchstart', 50, 100); await w.wait(420)
      out.press = w.touch(el, 'touchend', 50, 100)
      w.touch(el, 'touchstart', 50, 500)
      out.covered = w.touch(el, 'touchend', 50, 500)
      out.anyFocus = document.activeElement === el
      el.focus({ preventScroll: true })
      w.touch(el, 'touchstart', 50, 100)
      out.focused = w.touch(el, 'touchend', 50, 100)
      return out
    })
    expect(r).toEqual({ drag: false, press: false, covered: false, anyFocus: false, focused: false })
  })

  test('G100 · with caret, a textarea only gets the hold', async () => {
    await guard(page, 'ta', true)
    const r = await page.evaluate(async () => {
      const w = window as any
      w.touch(w.$('ta'), 'touchstart', 50, 100)
      const prevented = w.touch(w.$('ta'), 'touchend', 50, 100)
      w.$('ta').focus({ preventScroll: true })
      return { prevented, end: await w.reveal() }
    })
    expect(r.prevented).toBe(false)
    expect(r.end).toEqual(SAVED)
  })

  test('G101 · cleanup removes every listener, the shared touchmove with the last one', async () => {
    const r = await page.evaluate(() => {
      const w = window as any
      const before = w.listeners
      const one = w.iosFocusGuard(w.$('inner'), { caret: true }), two = w.iosFocusGuard(w.$('ta'))
      const up = w.listeners
      one()
      const half = w.listeners
      two()
      return { added: up - before, half: half - before, left: w.listeners - before }
    })
    expect(r).toEqual({ added: 9, half: 5, left: 0 })
  })

  test('G101 · the last guard going stops the hold, and leaves no listener', async () => {
    const r = await page.evaluate(async () => {
      const w = window as any
      const before = w.listeners
      const stop = w.iosFocusGuard(w.$('inner'))
      w.tap(w.$('inner'))
      stop()
      await Promise.resolve()
      return { left: w.listeners - before, end: await w.reveal(100) }
    })
    expect(r.left).toBe(0)
    expect(r.end.win).toBeGreaterThan(SAVED.win)
  })

  test('G101 · a replacement guard attached in the same turn inherits the hold and the touchmove', async () => {
    const r = await page.evaluate(async () => {
      const w = window as any
      const stop = w.iosFocusGuard(w.$('inner'))
      w.tap(w.$('inner'))
      stop()
      w.stop = w.iosFocusGuard(w.$('ta'))
      const held = await w.reveal(200)
      await w.wait(0)
      w.tap(w.$('ta'))
      w.touch(document.body, 'touchmove', 50, 90)
      const released = await w.reveal(100)
      return { held, released }
    })
    expect(r.held).toEqual(SAVED)
    expect(r.released.win).toBeGreaterThan(SAVED.win)
  })
})

/* The real component, bundled from source: Enter-free editing on whatever pointer the project
   has, plus the hand-off its key forces. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
let bundle = ''
test.beforeAll(async () => {
  const out = await build({
    stdin: {
      contents: `
        import { createElement as h, useState } from 'react'
        import { createRoot } from 'react-dom/client'
        import { EditableTextBlock } from './src/EditableTextBlock'
        function App() {
          const [value, set] = useState('alpha beta gamma')
          window.value = value
          return h(EditableTextBlock, { value, onCommit: set, className: 'etb', render: v => h('span', { className: 'styled' }, v) })
        }
        createRoot(document.getElementById('etb')).render(h(App))`,
      resolveDir: ROOT, loader: 'jsx',
    },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  bundle = out.outputFiles[0].text
})

async function mount(page: Page) {
  await page.addScriptTag({ content: bundle })
  await page.waitForSelector('.etb .styled')
  return page.evaluate(() => {
    const t = document.querySelector('.etb .styled')!.firstChild!
    const r = document.createRange()
    r.setStart(t, 6); r.collapse(true)
    const at = r.getBoundingClientRect()
    return { x: at.left, y: at.top + at.height / 2 }
  })
}
const flip = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('.etb') as HTMLElement
  return { active: document.activeElement === el, styled: !!el.querySelector('.styled'), offset: getSelection()!.anchorOffset }
})

test('EditableTextBlock · editing still works: raw on focus, caret at the click, commit on blur', async ({ page, hasTouch }) => {
  await page.goto('/dial/ios-guard.html')
  await page.waitForFunction(() => (window as any).ready === true)
  const at = await mount(page)
  if (hasTouch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
  await expect.poll(() => flip(page)).toEqual({ active: true, styled: false, offset: 6 })
  await page.keyboard.type('X')
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())
  await expect.poll(() => page.evaluate(() => (window as any).value)).toBe('alpha Xbeta gamma')
  expect(await page.locator('.etb .styled').textContent()).toBe('alpha Xbeta gamma')
})

test('EditableTextBlock · on iOS, a tap holds the scrollers through the element swap', async ({ browser, baseURL, hasTouch }) => {
  test.skip(!hasTouch, 'a real tap, so a touch project')
  const page = await open(browser, baseURL, IPHONE)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
  const at = await mount(page)
  // A real tap and a real focus, and the scroll that comes with iOS played from the focus.
  await page.evaluate(() => {
    const w = window as any
    document.addEventListener('focusin', () => { w.ended = w.reveal(300) }, { once: true })
  })
  await page.touchscreen.tap(at.x, at.y)
  await expect.poll(() => flip(page)).toEqual({ active: true, styled: false, offset: 6 })
  expect(await page.evaluate(() => (window as any).ended)).toEqual({ win: 0, scroll: 60, shell: 0 })
  // The hold is over, and it has let go.
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => {
    const w = window as any
    w.$('scroll').scrollTop = 150
    return new Promise(r => setTimeout(() => r(w.$('scroll').scrollTop), 100))
  })).toBe(150)
})

test('EditableTextBlock · off iOS it adds nothing of its own', async ({ browser, baseURL }) => {
  const page = await open(browser, baseURL, ANDROID, 5)
  await page.evaluate(() => { (window as any).scrollCalls = 0; const f = window.scrollTo; window.scrollTo = function (this: Window, ...a: any[]) { (window as any).scrollCalls++; return (f as any).apply(this, a) } as any })
  const at = await mount(page)
  await page.touchscreen.tap(at.x, at.y).catch(() => {})
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => (window as any).scrollCalls)).toBe(0)
})
