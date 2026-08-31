import { AuthForm } from './AuthForm'
import { useI18n } from '../hooks/useI18n'

/**
 * Πρώτη οθόνη για νέο χρήστη: σύνδεση με Google ή email, ή συνέχεια χωρίς
 * λογαριασμό. Η παράλειψη είναι ισότιμη επιλογή, όχι κρυμμένη — η πολιτική
 * απορρήτου υπόσχεται ότι η σύνδεση δεν είναι ποτέ προεπιλογή.
 */
export function Welcome({ onSkip }: { onSkip: () => void }) {
  const { t } = useI18n()

  return (
    <div className="welcome">
      <div className="welcome__head">
        <img className="welcome__logo" src="/icon.svg" alt="" width="56" height="56" />
        <h1 className="welcome__title">{t.account.welcomeTitle}</h1>
        <p className="welcome__sub">{t.account.welcomeSub}</p>
      </div>

      <div className="panel acc">
        <AuthForm />
      </div>

      <div className="welcome__skip">
        <button className="btn btn--secondary btn--block" onClick={onSkip}>
          {t.account.skip}
        </button>
        <p className="welcome__note">{t.account.skipNote}</p>
      </div>
    </div>
  )
}
