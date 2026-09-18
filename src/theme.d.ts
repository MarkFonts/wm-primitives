/* Types for theme.js -- see that file for the contract. */
export type Theme = 'auto' | 'light' | 'dark'
export const THEMES: readonly Theme[]
export const THEME_KEY: string
export function readTheme(key?: string, legacyKeys?: string[]): Theme
export function applyTheme(t: Theme, key?: string): Theme
export function bootTheme(key?: string, legacyKeys?: string[]): void
export function mountThemeSwitch(
  el: Element,
  opts?: { key?: string; legacyKeys?: string[]; onChange?: (t: Theme) => void },
): { get(): Theme; set(t: Theme): void; destroy(): void }
