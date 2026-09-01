import { AuthForm } from './AuthForm'
import { useI18n } from '../hooks/useI18n'

/**
 * The first screen a new visitor sees: sign in with Google or email, or carry
 * on without an account. Skipping is an equal option and not hidden — the
 * privacy policy promises that signing in is never the default.
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
