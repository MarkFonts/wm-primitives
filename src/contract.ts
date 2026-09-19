/* contract.ts -- the host contract, checked once at runtime, in development only.
 *
 * HOWTO.md's wiring run found two failures that say nothing: a dial with no rail when
 * color.css is not imported (--border resolves to nothing), and black on black when the
 * host set color-scheme: dark and never stamped data-theme (the ramp is keyed on the
 * attribute). Both looked finished. This is the console.warn the run asked for --
 * once per page, only where a dev build can be told from a production one, and never
 * throwing: a warning that breaks the page is worse than the silence it replaces. */

let checked = false

const isDev = (): boolean => {
  try {
    // Vite consumers; the esbuild bundle defines NODE_ENV instead and has no import.meta.env.
    const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env
    if (env && typeof env.DEV === 'boolean') return env.DEV
  } catch { /* not a module context that has it */ }
  // No `process` identifier: a consumer's tsc without @types/node rejects it. The bundle
  // defines process.env.NODE_ENV, so esbuild still folds this to a constant.
  try { const g = globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }; return g.process?.env?.NODE_ENV !== 'production' } catch { return false }
}

export function checkHostContract(el: Element): void {
  if (checked || typeof window === 'undefined') return
  checked = true
  if (!isDev()) return
  try {
    const root = document.documentElement
    const rootStyle = getComputedStyle(root)
    const border = getComputedStyle(el).getPropertyValue('--border').trim()
    if (!border) {
      console.warn('[wm-primitives] --border resolves to nothing on this dial, so its rail will not paint. Import shared/src/color.css (or define --border on :root). HOWTO.md, step 4.')
    }
    const scheme = rootStyle.colorScheme
    if (/dark/.test(scheme) && !root.hasAttribute('data-theme')) {
      console.warn('[wm-primitives] color-scheme is dark but <html> has no data-theme. The colour ramp is keyed on data-theme, so this page is dark ink on a dark ground. Set data-theme="dark" (ThemeSwitch / bootTheme do). HOWTO.md, step 6.')
    }
  } catch { /* never let a check break a page */ }
}
