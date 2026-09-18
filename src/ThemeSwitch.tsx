// ThemeSwitch — Auto / Light / Dark, one of three, as the house draws it.
//
// The control existed twice and was missing once: font-proofer drew three Material marks
// in .wm-icon-btn, Kernpare drew three words in a .ui-seg pill, ReCal had none (light
// tokens only, by decision). Same state, two constructions, each with its own storage
// key and its own idea of what "auto" stamps on <html>. This is both looks over one
// engine (theme.js), so the state, the key and the attribute are the same everywhere.
//
// Placement is NOT decided here. Both apps park it top-right at reduced opacity and
// bring it up on hover -- that is a decision about an affordance that should recede,
// and it stays in the app (toggleGroup.css says the same).
import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { THEMES, THEME_KEY, readTheme, applyTheme, type Theme } from './theme.js'
import './toggleGroup.css'
import './themeSwitch.css'

const MARK: Record<Theme, string> = { auto: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' }
const WORD: Record<Theme, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }
const TITLE: Record<Theme, string> = {
  auto: 'Follow the system setting', light: 'Force the light palette', dark: 'Force the dark palette',
}

export interface ThemeSwitchProps {
  /** `marks`: three Material icons, state carried by the mark's own ink (the host must
   *  load the icon font -- see Icon.tsx). `words`: the toggleGroup.css pill. */
  look?: 'marks' | 'words'
  /** localStorage key. Leave it: one key is the point. */
  storageKey?: string
  /** Read once if the house key is empty -- a page migrating from its own key. */
  legacyKeys?: string[]
  onChange?: (t: Theme) => void
  id?: string
  className?: string
}

export function ThemeSwitch({ look = 'marks', storageKey = THEME_KEY, legacyKeys, onChange, id, className }: ThemeSwitchProps) {
  const [theme, setTheme] = useState<Theme>(() => readTheme(storageKey, legacyKeys))
  // Stay in step if something else applies a theme (a keyboard shortcut, another switch).
  useEffect(() => {
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail)
    document.documentElement.addEventListener('wm-theme', on)
    return () => document.documentElement.removeEventListener('wm-theme', on)
  }, [])
  const choose = (t: Theme) => { setTheme(applyTheme(t, storageKey)); onChange?.(t) }
  const words = look === 'words'
  return (
    <div id={id} className={`${words ? 'ui-seg' : 'wm-theme'}${className ? ' ' + className : ''}`} role="group" aria-label="Colour scheme">
      {THEMES.map(t => (
        <button
          key={t}
          type="button"
          data-mode={t}
          aria-pressed={theme === t}
          aria-label={words ? undefined : `${WORD[t]} colour scheme`}
          title={TITLE[t]}
          className={words ? (theme === t ? 'active' : undefined) : `wm-icon-btn${theme === t ? ' active' : ''}`}
          onClick={() => choose(t)}
        >
          {words ? WORD[t] : <Icon name={MARK[t]} size={20} />}
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitch
