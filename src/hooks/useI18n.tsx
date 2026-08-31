import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DICT, detectLang } from '../lib/i18n'
import type { Dict, Lang } from '../lib/i18n'

const LANG_KEY = 'army_app.lang.v1'

interface I18nValue {
  lang: Lang
  t: Dict
  setLang: (l: Lang) => void
  toggleLang: () => void
}

const I18nContext = createContext<I18nValue | null>(null)

function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'el' || v === 'en' ? v : null
  } catch {
    return null
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang() ?? detectLang())

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ }
  }, [])

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === 'el' ? 'en' : 'el'
      try { localStorage.setItem(LANG_KEY, next) } catch { /* ignore */ }
      return next
    })
  }, [])

  const t = DICT[lang]

  // Κρατά τα <html lang>, <title> και τη meta description συγχρονισμένα με
  // τη γλώσσα — μετράει τόσο για τους αναγνώστες οθόνης όσο και για το SEO.
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t.meta.title
    const set = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector(selector)
      if (el) el.setAttribute(attr, value)
    }
    set('meta[name="description"]', 'content', t.meta.description)
    set('meta[property="og:title"]', 'content', t.meta.title)
    set('meta[property="og:description"]', 'content', t.meta.description)
    set('meta[property="og:locale"]', 'content', lang === 'el' ? 'el_GR' : 'en_US')
    set('meta[name="twitter:title"]', 'content', t.meta.title)
    set('meta[name="twitter:description"]', 'content', t.meta.description)
  }, [lang, t])

  const value = useMemo(() => ({ lang, t, setLang, toggleLang }), [lang, t, setLang, toggleLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
