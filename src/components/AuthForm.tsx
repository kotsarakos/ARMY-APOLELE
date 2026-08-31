import { useState } from 'react'
import {
  signInWithGoogle, signInWithEmail, registerWithEmail, resetPassword, AuthError,
} from '../firebase/auth'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { upperGreek as caps } from '../lib/greek'

type Mode = 'signin' | 'signup'

/** Κοινή φόρμα σύνδεσης — χρησιμοποιείται στην αρχική οθόνη και στις Ρυθμίσεις. */
export function AuthForm({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onDone?.()
    } catch (err) {
      toast.error(t.account.errors[err instanceof AuthError ? err.code : 'unknown'])
    } finally {
      setBusy(false)
    }
  }

  const google = () => withBusy(async () => {
    await signInWithGoogle()
    toast.success(t.account.okSignedIn)
  })

  const submit = () => {
    if (!email.trim()) return toast.error(t.account.errEmptyEmail)
    if (!password) return toast.error(t.account.errEmptyPassword)
    if (mode === 'signup' && password.length < 6) return toast.error(t.account.errShortPassword)
    void withBusy(async () => {
      if (mode === 'signup') {
        await registerWithEmail(email, password)
        toast.success(t.account.okSignedUp)
      } else {
        await signInWithEmail(email, password)
        toast.success(t.account.okSignedIn)
      }
      setPassword('')
    })
  }

  const forgot = () => {
    if (!email.trim()) return toast.error(t.account.errEmptyEmail)
    void withBusy(async () => {
      await resetPassword(email)
      toast.success(t.account.okResetSent)
    })
  }

  return (
    <>
      <button className="btn btn--google" onClick={google} disabled={busy}>
        <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
          <path fill="#4285F4" d="M17.6 9.2c0-.6 0-1.2-.2-1.7H9v3.4h4.8a4 4 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6Z"/>
          <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18Z"/>
          <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3Z"/>
          <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6Z"/>
        </svg>
        {t.account.google}
      </button>

      <div className="acc__or"><span>{caps(t.account.or)}</span></div>

      <label className="acc__field">
        <span className="eyebrow">{caps(t.account.email)}</span>
        <input
          className="input" type="email" autoComplete="email" inputMode="email"
          placeholder={t.account.emailPlaceholder}
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="acc__field">
        <span className="eyebrow">{caps(t.account.password)}</span>
        <input
          className="input" type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder={t.account.passwordPlaceholder}
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </label>

      <button className="btn btn--primary btn--block" onClick={submit} disabled={busy}>
        {busy ? t.account.working : mode === 'signup' ? t.account.signUp : t.account.signIn}
      </button>

      <div className="acc__links">
        <button className="acc__link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? t.account.toggleToSignUp : t.account.toggleToSignIn}
        </button>
        {mode === 'signin' && (
          <button className="acc__link" onClick={forgot} disabled={busy}>
            {t.account.forgot}
          </button>
        )}
      </div>
    </>
  )
}
