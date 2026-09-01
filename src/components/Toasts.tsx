import { useToast } from '../hooks/useToast'

/** Τα μηνύματα ανακοινώνονται και σε αναγνώστες οθόνης μέσω aria-live. */
export function Toasts() {
  const { toasts, dismiss, run } = useToast()

  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {/* Το σώμα κλείνει το μήνυμα, το κουμπί εκτελεί. Δύο ξεχωριστοί
              στόχοι: αλλιώς το «Αναίρεση» θα ήταν κουμπί μέσα σε κουμπί. */}
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
