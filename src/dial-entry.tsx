// dial-entry — the dial for a page with no React: ONE source, a second output.
//
// Kernpare and opsz-proofer are not React apps; the census (SLIDERS.md 57-59) records
// what happened when one of them hand-wrote the dial's markup instead: the primitive's
// class names with none of its behaviour, free to drift the first time AxisSlider.tsx
// changes shape. A plain-JS port would be the same drift with more code. So this is not
// a port. It is AxisSlider.tsx itself, with React inside, bundled by scripts/build-dial.mjs
// into dist/dial.js (a script tag; global `wmDial`) and dist/dial.css. About 60 KB gzipped
// -- the price of one engine, paid once per page.
//
//   const d = wmDial.mount(el, { label: 'Glyph size', value: 76, min: 20, max: 200, suffix: 'px',
//                                variant: 'track', onChange: v => draw(v) })
//   d.set(90); d.get(); d.destroy()
//
// The host still supplies the token sheets and --ui-font / --text-rgb (HOWTO.md Part A).
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AxisSlider, type AxisSliderProps } from './AxisSlider'
import { Chevron } from './Chevron'
import { Icon } from './Icon'
import { ThemeSwitch, type ThemeSwitchProps } from './ThemeSwitch'

export type DialProps = Omit<AxisSliderProps, 'value' | 'onChange'> & {
  value: number | 'auto'
  onChange?: (v: number | 'auto') => void
}
export interface DialHandle {
  get(): number | 'auto'
  set(v: number | 'auto'): void
  update(props: Partial<DialProps>): void
  destroy(): void
}

export function mount(el: Element, props: DialProps): DialHandle {
  let current = props
  let value: number | 'auto' = props.value
  let setFromOutside: ((v: number | 'auto') => void) | null = null
  let setProps: ((p: DialProps) => void) | null = null

  function Host() {
    const [v, setV] = useState(value)
    const [p, setP] = useState(current)
    useEffect(() => { setFromOutside = setV; setProps = setP; return () => { setFromOutside = null; setProps = null } }, [])
    const { value: _v, onChange, ...rest } = p
    return (
      <AxisSlider {...rest} value={v} onChange={nv => { value = nv; setV(nv); onChange?.(nv) }} />
    )
  }
  const root = createRoot(el)
  root.render(<StrictMode><Host /></StrictMode>)
  return {
    get: () => value,
    set: nv => { value = nv; setFromOutside?.(nv) },
    update: patch => { current = { ...current, ...patch }; if ('value' in patch && patch.value !== undefined) { value = patch.value; setFromOutside?.(patch.value) } setProps?.(current) },
    destroy: () => root.unmount(),
  }
}

/* The theme switch, for the same pages: Kernpare drove its own three buttons through
   theme.js and kept its words pill; this mounts the React form, so the marks look is
   available without React on the page. The engine underneath is the same file. */
export function mountTheme(el: Element, props: ThemeSwitchProps = {}) {
  const root = createRoot(el)
  root.render(<StrictMode><ThemeSwitch look="marks" {...props} /></StrictMode>)
  return { destroy: () => root.unmount() }
}

// The marks and chevrons travel too: a page that has the dial may as well draw its
// other chrome from the same file rather than inline a path by hand (Kernpare did).
export { Chevron, Icon }
