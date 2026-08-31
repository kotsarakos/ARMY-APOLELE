import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastKind = 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
}

interface ToastValue {
  toasts: Toast[]
  success: (text: string) => void
  error: (text: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const LIFETIME_MS = 3200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++
    // Κρατάμε το πολύ 3 μηνύματα ορατά ταυτόχρονα.
    setToasts((prev) => [...prev.slice(-2), { id, kind, text }])
    timers.current.set(id, setTimeout(() => dismiss(id), LIFETIME_MS))
  }, [dismiss])

  const value = useMemo(() => ({
    toasts,
    success: (text: string) => push('success', text),
    error: (text: string) => push('error', text),
    dismiss,
  }), [toasts, push, dismiss])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
