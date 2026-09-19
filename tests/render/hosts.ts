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
  /** false: nothing to drive (a host with no dial). Default true. */
  gestures?: boolean
  /** The rows the gesture suite drives, one per variant the host draws. Track rows are
   *  the mobile-pass design; default rows are the native-thumb design (DIAL.md §7). */
  rows?: { variant: 'track' | 'default'; label: RegExp; open?: (page: Page) => Promise<void> }[]
}

export const HOSTS: readonly Host[] = [
  {
    name: 'font-proofer',
    url: '/font-proofer/',
    themes: ['dark', 'light'],
    rows: [
      { variant: 'track', label: /^tracking$/ },
      // the rag-width dial in the fitting panel: paragraph mode, Swiss Rag on
      { variant: 'default', label: /^rag width$/, open: async page => {
        await page.getByRole('button', { name: /paragraph/i }).first().click()
        const sw = page.locator('.fit-switch, button', { hasText: /swiss rag/i }).first()
        if (await sw.count() && !/on/i.test((await sw.textContent()) ?? '')) await sw.click()
      } },
    ],
    // App.jsx reads localStorage('wm-theme') into <html data-theme> on boot.
    setTheme: (page, theme) => page.addInitScript(t => localStorage.setItem('wm-theme', t), theme),
  },
  {
    name: 'ReCal',
    url: '/recalsans/',
    themes: ['dark'],
    setTheme: async () => {},
    // its default rows are the Type Matrix, a named exception (EVAL Q1): track only
    rows: [{ variant: 'track', label: /^tracking$/ }],
  },
  /* opsz-proofer's rows WERE hand-emitted HTML wearing the primitive's classes
     (SLIDERS.md 57-59); they are the component now, so it is a full host. */
  {
    name: 'opsz-proofer',
    url: '/opsz-proofer/',
    themes: ['dark', 'light'],
    setTheme: (page, theme) => page.emulateMedia({ colorScheme: theme }),
    // since wordmarktools 5f4c808 its rows are the component (dist/dial.js): default variant
    rows: [{ variant: 'default', label: /^wght$/ }],
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
