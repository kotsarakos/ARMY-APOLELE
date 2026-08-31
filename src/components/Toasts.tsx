import { useToast } from '../hooks/useToast'

/** Τα μηνύματα ανακοινώνονται και σε αναγνώστες οθόνης μέσω aria-live. */
export function Toasts() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast--${t.kind}`}
          onClick={() => dismiss(t.id)}
        >
          <span className="toast__icon" aria-hidden="true">
            {t.kind === 'success' ? '✓' : '!'}
          </span>
          <span className="toast__text">{t.text}</span>
        </button>
      ))}
    </div>
  )
}
