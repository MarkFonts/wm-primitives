/* theme.js — the colour-scheme engine: one storage key, one attribute, one event.
 *
 * Plain ES-module JS, like letterbox.js and flattersatz.js, because one of its consumers
 * (Kernpare) is a single HTML page with no React. ThemeSwitch.tsx is the React form of
 * the same thing and calls into here; a page without React calls mountThemeSwitch().
 *
 * THE CONTRACT, which two apps had each written for themselves with one difference apiece:
 *   - the choice is `auto` | `light` | `dark`, stored under ONE key, `wm-theme`;
 *   - it is stamped as <html data-theme="…">, ALWAYS, including "auto" -- color.css keys
 *     on [data-theme="dark"] and :not([data-theme="light"]), and font-proofer's own
 *     [data-theme="auto"] rule needs the value present. (Kernpare deleted the attribute
 *     for auto; that is the one thing this changes there.)
 *   - every change fires `wm-theme` on <html>, so a canvas that paints with token colours
 *     can repaint without the control knowing it exists.
 * Stamp BEFORE first paint from a head script: see bootTheme(). */

export const THEMES = ['auto', 'light', 'dark']
export const THEME_KEY = 'wm-theme'

/** The stored choice, or 'auto'. `legacyKeys` are read once when the house key is empty,
 *  so a page that migrates does not lose the user's setting. */
export function readTheme(key = THEME_KEY, legacyKeys = []) {
  try {
    const v = localStorage.getItem(key)
    if (v && THEMES.includes(v)) return v
    for (const k of legacyKeys) { const l = localStorage.getItem(k); if (l && THEMES.includes(l)) return l }
  } catch { /* private mode */ }
  return 'auto'
}

/** Stamp, store, announce. */
export function applyTheme(t, key = THEME_KEY) {
  if (!THEMES.includes(t)) t = 'auto'
  const root = document.documentElement
  root.dataset.theme = t
  try { localStorage.setItem(key, t) } catch { /* private mode */ }
  root.dispatchEvent(new CustomEvent('wm-theme', { detail: t }))
  return t
}

/** For a head <script>: stamp the stored choice before the first paint. Does not fire
 *  the event -- nothing is listening yet, and a flash of the wrong palette is the bug. */
export function bootTheme(key = THEME_KEY, legacyKeys = []) {
  document.documentElement.dataset.theme = readTheme(key, legacyKeys)
}

/** Drive an existing group of buttons -- `[data-mode]` children of `el`, one per theme,
 *  as toggleGroup.css draws them -- from the engine. Returns { get, set, destroy }. */
export function mountThemeSwitch(el, { key = THEME_KEY, legacyKeys = [], onChange } = {}) {
  const buttons = [...el.querySelectorAll('[data-mode]')]
  const paint = t => buttons.forEach(b => {
    const on = b.dataset.mode === t
    b.classList.toggle('active', on)
    b.setAttribute('aria-pressed', String(on))
  })
  const set = t => { paint(applyTheme(t, key)); onChange?.(t) }
  const clicks = buttons.map(b => { const h = () => set(b.dataset.mode); b.addEventListener('click', h); return [b, h] })
  paint(readTheme(key, legacyKeys))
  return {
    get: () => readTheme(key, legacyKeys),
    set,
    destroy: () => clicks.forEach(([b, h]) => b.removeEventListener('click', h)),
  }
}
