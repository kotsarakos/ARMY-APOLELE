import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { watchAuth, isFirebaseConfigured } from '../firebase/auth'
import type { AuthUser } from '../firebase/auth'

interface AuthValue {
  user: AuthUser | null
  /** False until Firebase answers — this avoids a flash of the sign-in form. */
  ready: boolean
  enabled: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

/** Is there already a profile on this device? It decides how urgent auth is. */
function hasLocalProfile(): boolean {
  try { return Boolean(localStorage.getItem('army_app.profile.v1')) } catch { return false }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const enabled = isFirebaseConfigured()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(!enabled)

  // The Firebase SDK is heavy. The app is local-first and renders fully
  // without it, so auth watching starts once the browser goes idle — the
  // counter appears immediately and the SDK downloads afterwards.
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

    // A new visitor sees a sign-in offer first, so auth is needed right away.
    // Someone with a profile gets the counter straight from localStorage, and
    // the SDK waits for the browser to go idle.
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
