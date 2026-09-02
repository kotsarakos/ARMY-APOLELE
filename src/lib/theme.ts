/**
 * The appearance theme.
 *
 * This is a **device** preference, not an account one: the same person wants a
 * different theme on their phone than on their laptop. So it stays in
 * localStorage and never travels with the profile to Firestore.
 *
 * Three states:
 *  - `auto` — follows the operating system (no `data-theme`, so the
 *    `prefers-color-scheme` block in tokens.css does the work).
 *  - `light` / `dark` — an explicit choice, which beats the system.
 */

export type Theme = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEMES: Theme[] = ['auto', 'light', 'dark']

const KEY = 'army_app.theme.v1'

/** Each theme's canvas colour — must match tokens.css. */
const CANVAS: Record<ResolvedTheme, string> = {
  dark: '#06070A',
  light: '#FBFBF9',
}

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function systemTheme(): ResolvedTheme {
  if (typeof matchMedia === 'undefined') return 'dark'
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'auto' ? systemTheme() : theme
}

/**
 * Writes `data-theme` onto <html> and keeps `theme-color` in step, so the
 * browser chrome on a phone is not left black above a light page.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)

  const resolved = resolveTheme(theme)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', CANVAS[resolved])
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute('content', resolved)
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, theme) } catch { /* private browsing */ }
  applyTheme(theme)
}

/**
 * Under `auto`, the system theme can change while the app is open — by hand,
 * or at sunset. The CSS picks that up on its own; `theme-color` does not, so
 * it is rewritten here.
 */
export function watchSystemTheme(): () => void {
  if (typeof matchMedia === 'undefined') return () => {}
  const mq = matchMedia('(prefers-color-scheme: light)')
  const onChange = () => { if (readTheme() === 'auto') applyTheme('auto') }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
