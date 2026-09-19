import { test, expect } from '@playwright/test'
import {
  EASES, blend, blurLayers, declaration, maskRamp, rampStops, scrim, bezierY,
  channelBlend, resolveRGB, type Triple,
} from '../../src/gradient'

/* GRADIENTS.md, the parts that are arithmetic. No browser and no host: this is the
   engine, and the engine is numbers. It runs under the desktop and iphone projects
   because testDir is `tests` -- the same answer twice costs nothing and means a future
   engine-side branch on the platform cannot hide. */

test.describe('the clothoid is a Bézier', () => {
  /* The pen's own seven stops (lhermann/qmpMGQ, alpha 1 -> 0). If the preset is ever
     retuned, this is the thing it has to keep agreeing with -- otherwise the name is
     just decoration on four numbers. */
  const PEN: [number, number][] = [[0, 1], [.5, .30], [.65, .15], [.755, .075], [.8285, .037], [.88, .019], [1, 0]]

  for (const [at, alpha] of PEN) {
    test(`alpha at ${at * 100}% is the pen's ${alpha}`, () => {
      expect(1 - bezierY(EASES.clothoid, at)).toBeCloseTo(alpha, 2)
      expect(Math.abs((1 - bezierY(EASES.clothoid, at)) - alpha)).toBeLessThan(0.0015)
    })
  }
})

test.describe('sampling', () => {
  test('the ends are exact, not nearly', () => {
    const s = rampStops({ stops: 8 })
    expect(s[0]).toEqual({ at: 0, v: 1 })
    expect(s[s.length - 1]).toEqual({ at: 1, v: 0 })
  })

  test('stops is the count, and two is the floor', () => {
    expect(rampStops({ stops: 5 })).toHaveLength(5)
    expect(rampStops({ stops: 16 })).toHaveLength(16)
    expect(rampStops({ stops: 1 })).toHaveLength(2)   // a one-stop gradient is a colour
  })

  test('linear stays linear — the stops move, the values stay on the line', () => {
    /* Sampling by curve parameter does NOT space linear's stops evenly, and that is
       correct: what must hold is that every stop sits on the straight line, which is
       v = 1 - at. An even-spacing assertion here would be testing the sampler's
       parameterisation rather than the ramp. */
    /* To 3dp, not 4: both fields are rounded to four places on the way out, so a stop
       that lands on a half-step (0.84375 -> 0.8438 against 1 - 0.1563 = 0.8437) differs
       by one unit in the last place. That is the rounding, not the ramp. */
    for (const { at, v } of rampStops({ ease: 'linear', stops: 9 }))
      expect(v).toBeCloseTo(1 - at, 3)
  })

  test('from / to are the channel, so a blur ramp is px', () => {
    const s = rampStops({ from: 0, to: 24, stops: 4 })
    expect(s[0].v).toBe(0)
    expect(s[3].v).toBe(24)
  })
})

test.describe('emitters', () => {
  test('a scrim ends bare, not at a 100% / 0% mix', () => {
    const css = scrim('var(--bg)', { stops: 4 })
    expect(css).toContain('var(--bg) 0%')
    expect(css).toContain('transparent 100%')
    expect(css).toContain('color-mix(in srgb,')     // sRGB: see GRADIENTS.md
    expect(css).not.toContain('100%, transparent)')
  })

  test('a mask is alpha only, and takes the direction it was given', () => {
    const css = maskRamp({ dir: 'to right', stops: 3 })
    expect(css.startsWith('linear-gradient(to right, rgb(0 0 0 / 1) 0%')).toBe(true)
    expect(css).toContain('rgb(0 0 0 / 0) 100%')
  })

  test('span measures the stops against a length, and lands exactly on it', () => {
    /* UiKitBoard's requirement: the ramp has to END at the inset the app's chrome
       occupies, not at 100% of a strip that resizes. The ends are spelled plainly --
       calc(0 * 48px) and calc(1 * 48px) are correct and unreadable. */
    const css = maskRamp({ dir: 'to bottom', from: .55, to: 1, span: '48px', stops: 4 })
    expect(css).toContain('rgb(0 0 0 / 0.55) 0,')
    expect(css).toContain('rgb(0 0 0 / 1) 48px')
    expect(css).toContain('calc(')
    expect(css).not.toContain('%')                 // no percentage survives a span
    expect(css).not.toContain('calc(0 *')
    expect(css).not.toContain('calc(1 *')
  })

  test('without span the positions are percentages, as before', () => {
    const css = maskRamp({ stops: 4 })
    expect(css).not.toContain('calc(')
    expect(css).toContain('100%')
  })

  test('a blend mixes in the space it was asked for', () => {
    expect(blend('red', 'blue', { space: 'oklch', stops: 3 })).toContain('color-mix(in oklch,')
    expect(blend('red', 'blue', { space: 'srgb', stops: 3 })).toContain('color-mix(in srgb,')
  })
})

test.describe('progressive blur', () => {
  /* The stack is TILED: each layer owns one band at full opacity and carries the absolute
     radius that band should read at. The earlier construction had the layers accumulate,
     with quadrature steps so the sum landed on the target -- correct arithmetic, wrong
     construction: partial mask alpha composites a blurred copy over the sharp original
     and live text shows a double image. These tests pin the tiling instead. */

  test('the last layer reaches the radius that was asked for', () => {
    for (const layers of [1, 2, 6, 10]) {
      const stack = blurLayers({ radius: 28, layers })
      expect(stack).toHaveLength(layers)
      const last = parseFloat(stack[stack.length - 1].backdropFilter.slice(5))
      expect(last, `${layers} layers`).toBeCloseTo(28, 4)
    }
  })

  test('radii only ever increase', () => {
    const r = blurLayers({ radius: 28, layers: 8 }).map(l => parseFloat(l.backdropFilter.slice(5)))
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1])
  })

  test('the bands tile the whole span, ends clamped', () => {
    /* A feather on the first or last band leaves a strip no layer covers -- content that
       is simply not blurred at the very edge. */
    const stack = blurLayers({ layers: 5 })
    expect(stack[0].maskImage).toContain('rgb(0 0 0 / 1) 0%')
    expect(stack[stack.length - 1].maskImage).toContain('rgb(0 0 0 / 1) 100%')
  })

  test('every point stays covered, and the hand-over is smooth', () => {
    /* The stack must never thin out to nothing between bands, and the coverage curve must
       not kink -- a kink in the blur profile is a hard line across the text, which is the
       exact defect a two-stop feather produced. */
    const stack = blurLayers({ layers: 6 })
    const alphaAt = (mask: string, p: number) => {
      const st = [...mask.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\) ([\d.]+)%/g)]
        .map(m => [parseFloat(m[2]), parseFloat(m[1])] as const)
      if (p <= st[0][0]) return st[0][1]
      if (p >= st[st.length - 1][0]) return st[st.length - 1][1]
      for (let i = 1; i < st.length; i++)
        if (p <= st[i][0]) {
          const [a, va] = st[i - 1], [b, vb] = st[i]
          return va + (vb - va) * (p - a) / (b - a)
        }
      return 0
    }
    const cover: number[] = []
    for (let p = 0; p <= 100; p += 2)
      cover.push(stack.reduce((sum, l) => sum + alphaAt(l.maskImage, p), 0))
    expect(Math.min(...cover)).toBeGreaterThanOrEqual(1)
    /* No second-difference spike: the profile bends, it does not corner. */
    let worst = 0
    for (let i = 2; i < cover.length; i++)
      worst = Math.max(worst, Math.abs(cover[i] - 2 * cover[i - 1] + cover[i - 2]))
    expect(worst).toBeLessThan(0.35)
  })

  test('start holds the leading edge, and feathers in rather than cutting', () => {
    /* Over text the useful ramp does not begin at the element's edge: the smallest stop
       in a 24px stack is still 1.35px, and that lands inside the first line's ascenders.
       With an offset nothing before it is touched -- and the onset is feathered, because
       a hard one would be the same visible edge, landing right under the line the offset
       exists to protect. */
    const held = blurLayers({ layers: 4, start: 0.25 })
    expect(held[0].maskImage).toContain('rgb(0 0 0 / 0) 25%')      // nothing before 25%
    expect(held[0].maskImage).not.toContain('rgb(0 0 0 / 1) 25%')  // and no hard onset
    const plain = blurLayers({ layers: 4 })
    expect(plain[0].maskImage).toContain('rgb(0 0 0 / 1) 0%')      // no offset: opaque at 0
  })

  test('a length offset becomes calc, so lh and friends survive', () => {
    /* `start: "1lh"` is the useful one -- hold the first line, ramp after it. It cannot
       be folded into a percentage, so the arithmetic is handed to CSS. */
    const m = blurLayers({ layers: 3, start: '1lh' })[0].maskImage
    expect(m).toContain('calc(1lh + (100% - 1lh) *')
    expect(m).not.toMatch(/\bNaN\b/)
  })

  test('band positions are even, and the curve does not move them', () => {
    /* Position and strength are different questions. Placing bands by curve parameter
       made ease-in crowd them into the last 5% of the span. */
    const edges = (ease: 'linear' | 'ease-in' | 'clothoid') =>
      blurLayers({ layers: 4, ease })
        .map(l => (l.maskImage.match(/rgb\(0 0 0 \/ 1\) ([\d.]+)%/g) ?? []).join('|'))
    expect(edges('ease-in')).toEqual(edges('clothoid'))
    expect(edges('linear')).toEqual(edges('ease-in'))
  })

  test('the default curve holds sharpness rather than front-loading', () => {
    /* The clothoid is the house default everywhere else and is wrong here: fitted to an
       alpha scrim, which must begin imperceptibly, so it rises fast in value. Text stops
       being legible around 4px, so a front-loaded blur is spent in the first third. */
    const first = (o: Parameters<typeof blurLayers>[0]) =>
      parseFloat(blurLayers({ radius: 28, layers: 6, ...o })[0].backdropFilter.slice(5))
    expect(first({})).toBeLessThan(first({ ease: 'clothoid' }))
  })
})

test('declaration breaks at the gradient’s own commas and no others', () => {
  /* The regex version broke inside color-mix(in srgb, X 22%, transparent) -- three
     lines per stop, and the pasted rule was not CSS. */
  const out = declaration('background-image', scrim('var(--bg)', { stops: 4 }))
  for (const line of out.split('\n').slice(2, -1)) {
    const l = line.trim()
    if (!l || l === ');') continue
    const opens = (l.match(/\(/g) ?? []).length
    const closes = (l.match(/\)/g) ?? []).length
    expect(opens, `unbalanced stop line: ${l}`).toBe(closes)
  }
  expect(out).toContain('background-image:')
  expect(out.trimEnd().endsWith(');')).toBe(true)
})


test.describe('per-channel steering (Mass Driver\'s schema)', () => {
  const RED: Triple = [246, 80, 48]     // #F65030
  const BLUE: Triple = [48, 80, 246]    // #3050F6
  const B_Y: [Triple, Triple] = [[21, 68, 196], [240, 179, 35]]

  test('reproduces their published output exactly', () => {
    /* Their tool, default RGB, five samples, no control points dragged. If this ever
       stops matching, this file is reading their graphs differently from the way they
       draw them -- which is the only thing worth asserting about a port. */
    expect(channelBlend(RED, BLUE, { stops: 5 }))
      .toBe('linear-gradient(90deg, #f65030, #c45061, #935093, #6150c4, #3050f6)')
  })

  test('the endpoints are the endpoints', () => {
    const out = channelBlend(RED, BLUE, { stops: 7 }).match(/#[0-9a-f]{6}/g)!
    expect(out[0]).toBe('#f65030')
    expect(out[out.length - 1]).toBe('#3050f6')
    expect(out).toHaveLength(7)
  })

  test('ONE curve on all three channels stays on the straight line', () => {
    /* This is the limit of blend()'s single ease, stated as a test: the same curve
       everywhere re-spaces the stops ALONG the path and never leaves it. */
    const [A, B] = B_Y
    const stop = channelBlend(A, B, { stops: 5, ease: ['ease-in', 'ease-in', 'ease-in'] })
      .match(/#[0-9a-f]{6}/g)![2]
    const [r, g, b] = [1, 3, 5].map(i => parseInt(stop.slice(i, i + 2), 16))
    const t = (r - A[0]) / (B[0] - A[0])
    expect(g).toBeCloseTo(A[1] + (B[1] - A[1]) * t, 0)
    expect(b).toBeCloseTo(A[2] + (B[2] - A[2]) * t, 0)
  })

  test('steering ONE channel leaves the straight line', () => {
    const [A, B] = B_Y
    const stop = channelBlend(A, B, { stops: 5, ease: [undefined, 'ease-in', undefined] })
      .match(/#[0-9a-f]{6}/g)![2]
    const [r, g] = [1, 3].map(i => parseInt(stop.slice(i, i + 2), 16))
    const t = (r - A[0]) / (B[0] - A[0])
    const onLine = A[1] + (B[1] - A[1]) * t
    expect(Math.abs(g - onLine)).toBeGreaterThan(10)   // measured: 20 levels off
  })

  test('a channel whose ends are equal cannot be steered', () => {
    /* G is 80 at both ends of their own pair, so every curve on it is a no-op. Worth
       pinning: it is the reason the first demo of this feature looked broken. */
    const plain = channelBlend(RED, BLUE, { stops: 5 })
    expect(channelBlend(RED, BLUE, { stops: 5, ease: [undefined, 'ease-in', undefined] }))
      .toBe(plain)
  })

  test('hsl hue takes the short way round', () => {
    /* 350 -> 10 is 20 degrees forward, not 340 back. Without the wrap the ramp crawls
       through the entire wheel and the gradient is unrecognisable. */
    const out = channelBlend([255, 0, 21], [255, 43, 0], { space: 'hsl', stops: 3 })
      .match(/#[0-9a-f]{6}/g)!
    const [r, g, b] = [1, 3, 5].map(i => parseInt(out[1].slice(i, i + 2), 16))
    expect(r).toBeGreaterThan(200)      // stays red through the middle
    expect(Math.max(g, b)).toBeLessThan(40)
  })

  test('resolveRGB passes a triple through untouched', () => {
    expect(resolveRGB([1, 2, 3])).toEqual([1, 2, 3])
  })
})
