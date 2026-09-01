import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ok as buzzOk, warn as buzzWarn } from '../lib/haptics'

export type ToastKind = 'success' | 'error'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  kind: ToastKind
  text: string
  action?: ToastAction
}

interface ToastValue {
  toasts: Toast[]
  success: (text: string) => void
  error: (text: string) => void
  /** Μήνυμα με κουμπί — π.χ. «Διαγράφηκε · Αναίρεση». */
  undoable: (text: string, label: string, run: () => void) => void
  dismiss: (id: number) => void
  run: (id: number) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const LIFETIME_MS = 3200
/** Τα μηνύματα με κουμπί μένουν περισσότερο: πρέπει να προλάβει να το πατήσει. */
const ACTION_LIFETIME_MS = 7000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  // Καθρέφτης της λίστας εκτός React. Η ενέργεια της αναίρεσης δεν επιτρέπεται
  // να τρέξει μέσα σε updater του `setState`: το StrictMode τον καλεί δύο
  // φορές, και η αναίρεση θα γινόταν δύο φορές μαζί.
  const live = useRef<Toast[]>([])
  live.current = toasts

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((kind: ToastKind, text: string, action?: ToastAction) => {
    const id = nextId.current++
    // Κρατάμε το πολύ 3 μηνύματα ορατά ταυτόχρονα.
    setToasts((prev) => [...prev.slice(-2), { id, kind, text, action }])
    timers.current.set(
      id,
      setTimeout(() => dismiss(id), action ? ACTION_LIFETIME_MS : LIFETIME_MS),
    )
    if (kind === 'success') buzzOk()
    else buzzWarn()
  }, [dismiss])

  /** Εκτελεί την ενέργεια και κλείνει — δεν έχει νόημα να πατηθεί δεύτερη φορά. */
  const run = useCallback((id: number) => {
    const action = live.current.find((t) => t.id === id)?.action
    dismiss(id)
    action?.run()
  }, [dismiss])

  const value = useMemo(() => ({
    toasts,
    success: (text: string) => push('success', text),
    error: (text: string) => push('error', text),
    undoable: (text: string, label: string, action: () => void) =>
      push('success', text, { label, run: action }),
    dismiss,
    run,
  }), [toasts, push, dismiss, run])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
