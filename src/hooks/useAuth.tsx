import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { watchAuth, isFirebaseConfigured } from '../firebase/auth'
import type { AuthUser } from '../firebase/auth'

interface AuthValue {
  user: AuthUser | null
  /** false μέχρι να απαντήσει το Firebase — αποφεύγει αναλαμπή της φόρμας. */
  ready: boolean
  enabled: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

/** Υπάρχει ήδη προφίλ σε αυτή τη συσκευή; Καθορίζει πόσο επείγει το auth. */
function hasLocalProfile(): boolean {
  try { return Boolean(localStorage.getItem('army_app.profile.v1')) } catch { return false }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const enabled = isFirebaseConfigured()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(!enabled)

  // Το SDK του Firebase είναι βαρύ. Η εφαρμογή είναι local-first και αποδίδει
  // πλήρως χωρίς αυτό, οπότε η παρακολούθηση σύνδεσης ξεκινά μόλις ηρεμήσει
  // ο browser — ο μετρητής εμφανίζεται αμέσως και το SDK κατεβαίνει μετά.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let unsub: (() => void) | null = null

    const start = () => {
      if (cancelled) return
      watchAuth((u) => {
        if (cancelled) return
        setUser(u)
        setReady(true)
      })
        .then((fn) => { cancelled ? fn() : (unsub = fn) })
        .catch(() => { if (!cancelled) setReady(true) })
    }

    // Νέος χρήστης: η αρχική οθόνη προσφέρει σύνδεση, άρα το auth χρειάζεται
    // αμέσως. Χρήστης με προφίλ: ο μετρητής αποδίδει από το localStorage και
    // το SDK περιμένει να ηρεμήσει ο browser.
    if (!hasLocalProfile()) {
      start()
      return () => { cancelled = true; unsub?.() }
    }

    const idle = (window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
    }).requestIdleCallback
    const handle = idle ? idle(start, { timeout: 2000 }) : window.setTimeout(start, 300)

    return () => {
      cancelled = true
      unsub?.()
      if (!idle) clearTimeout(handle)
    }
  }, [enabled])

  const value = useMemo(() => ({ user, ready, enabled }), [user, ready, enabled])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
