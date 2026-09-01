import { useToast } from '../hooks/useToast'

/** Messages are announced to screen readers too, through aria-live. */
export function Toasts() {
  const { toasts, dismiss, run } = useToast()

  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {/* The body dismisses, the button acts. Two separate targets:
              otherwise "Undo" would be a button inside a button. */}
          <button
            type="button"
            className="toast__body"
            onClick={() => dismiss(t.id)}
          >
            <span className="toast__icon" aria-hidden="true">
              {t.kind === 'success' ? '✓' : '!'}
            </span>
            <span className="toast__text">{t.text}</span>
          </button>
          {t.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => run(t.id)}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
