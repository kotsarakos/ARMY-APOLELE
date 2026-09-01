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
  /** A message with a button — "Deleted · Undo", for instance. */
  undoable: (text: string, label: string, run: () => void) => void
  dismiss: (id: number) => void
  run: (id: number) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const LIFETIME_MS = 3200
/** Messages with a button stay longer: there has to be time to press it. */
const ACTION_LIFETIME_MS = 7000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  // A mirror of the list outside React. The undo action must not run inside a
  // `setState` updater: StrictMode calls it twice, and the undo would happen
  // twice with it.
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
    // At most three messages are visible at once.
    setToasts((prev) => [...prev.slice(-2), { id, kind, text, action }])
    timers.current.set(
      id,
      setTimeout(() => dismiss(id), action ? ACTION_LIFETIME_MS : LIFETIME_MS),
    )
    if (kind === 'success') buzzOk()
    else buzzWarn()
  }, [dismiss])

  /** Runs the action and closes: pressing it twice would mean nothing. */
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
