import type { Page } from '@playwright/test'

/* The consumers under test, at the base path each deploys to (tests/serve.mjs mounts
   them there). A host that cannot switch theme lists one theme; ReCal is light-mode
   tokens only, with the instrument rail pinned dark by its own data-theme. */
export interface Host {
  name: string
  url: string
  themes: readonly ('dark' | 'light')[]
  /** Put the host in the theme before the app boots. */
  setTheme: (page: Page, theme: 'dark' | 'light') => Promise<void>
  /** false: the host draws the primitive's CSS but not its component -- render only,
   *  no gestures to test (opsz-proofer). Default true. */
  gestures?: boolean
}

export const HOSTS: readonly Host[] = [
  {
    name: 'font-proofer',
    url: '/font-proofer/',
    themes: ['dark', 'light'],
    // App.jsx reads localStorage('wm-theme') into <html data-theme> on boot.
    setTheme: (page, theme) => page.addInitScript(t => localStorage.setItem('wm-theme', t), theme),
  },
  {
    name: 'ReCal',
    url: '/recalsans/',
    themes: ['dark'],
    setTheme: async () => {},
  },
  /* opsz-proofer's rows are HAND-EMITTED .slider-row HTML from build.py -- the
     primitive's class names without its component (SLIDERS.md 57-59). It is here for
     exactly that reason: the day AxisSlider changes structure, its rows drift, and the
     baseline and the parity numbers are what will say so. No JS gestures to test. */
  {
    name: 'opsz-proofer',
    url: '/opsz-proofer/',
    themes: ['dark', 'light'],
    setTheme: (page, theme) => page.emulateMedia({ colorScheme: theme }),
    gestures: false,
  },
]

/* Nothing leaves localhost. Analytics failed on every probe run and a screenshot must
   not depend on a beacon. */
export async function sealed(page: Page) {
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort())
}

export async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)   // one transition length past --dur-med
}
