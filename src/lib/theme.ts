/**
 * Θέμα εμφάνισης.
 *
 * Είναι προτίμηση **συσκευής**, όχι λογαριασμού: το ίδιο πρόσωπο θέλει άλλο
 * θέμα στο κινητό απ' ό,τι στον υπολογιστή. Γι' αυτό μένει στο localStorage
 * και δεν ταξιδεύει με το προφίλ στο Firestore.
 *
 * Τρεις καταστάσεις:
 *  - `auto`  — ακολουθεί το λειτουργικό (κανένα `data-theme`, δουλεύει το
 *              `prefers-color-scheme` του tokens.css).
 *  - `light` / `dark` — ρητή επιλογή, κερδίζει το λειτουργικό.
 */

export type Theme = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEMES: Theme[] = ['auto', 'light', 'dark']

const KEY = 'army_app.theme.v1'

/** Ο καμβάς κάθε θέματος — πρέπει να ταιριάζει με το tokens.css. */
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

export function systemTheme(): ResolvedTheme {
  if (typeof matchMedia === 'undefined') return 'dark'
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'auto' ? systemTheme() : theme
}

/**
 * Γράφει το `data-theme` στο <html> και συγχρονίζει το `theme-color`, ώστε η
 * μπάρα του browser στο κινητό να μη μένει μαύρη πάνω από φωτεινή σελίδα.
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
  try { localStorage.setItem(KEY, theme) } catch { /* ιδιωτική περιήγηση */ }
  applyTheme(theme)
}

/**
 * Σε `auto`, το λειτουργικό μπορεί να αλλάξει θέμα όσο η εφαρμογή είναι
 * ανοιχτή (χειροκίνητα ή με το ηλιοβασίλεμα). Το CSS το πιάνει μόνο του· το
 * `theme-color` όχι, οπότε το ξαναγράφουμε εδώ.
 */
export function watchSystemTheme(): () => void {
  if (typeof matchMedia === 'undefined') return () => {}
  const mq = matchMedia('(prefers-color-scheme: light)')
  const onChange = () => { if (readTheme() === 'auto') applyTheme('auto') }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
