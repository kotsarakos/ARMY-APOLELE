import { useState } from 'react'
import { deleteAccount, signOutUser, AuthError } from '../firebase/auth'
import { deleteRemoteProfile, pushRemoteOnly } from '../firebase/sync'
import { wipeDevice } from '../lib/wipe'
import type { Profile } from '../lib/types'
import { AuthForm } from './AuthForm'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { upperGreek as caps } from '../lib/greek'

export function Account({ syncing, profile }: { syncing: boolean; profile: Profile | null }) {
  const { t } = useI18n()
  const toast = useToast()
  const { user, ready, enabled } = useAuth()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [unsynced, setUnsynced] = useState(false)

  if (!enabled) return null

  const fail = (err: unknown) => {
    const code = err instanceof AuthError ? err.code : 'unknown'
    toast.error(t.account.errors[code])
  }

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (err) { fail(err) } finally { setBusy(false) }
  }



  /**
   * Signing out clears the device.
   *
   * Without it, the next person to open the app saw the previous one's entire
   * profile — on a shared phone that is a leak, not a convenience.
   *
   * But one last upload comes first: if something was written offline, wiping
   * would make it vanish. When that upload does not land, we ask rather than
   * decide on their behalf.
   */
  const finish = async () => {
    await signOutUser()
    await wipeDevice()
    toast.success(t.account.okSignedOut)
    // A full reload: nothing of the previous user is left in memory.
    setTimeout(() => window.location.reload(), 700)
  }

  const out = () => withBusy(async () => {
    if (user && profile) {
      const landed = await pushRemoteOnly(profile, user.uid)
      if (!landed) { setUnsynced(true); return }
    }
    await finish()
  })

  const outAnyway = () => withBusy(finish)

  // The document first, then the user: once the account is gone the Firestore
  // rules allow no further writes, and it would be orphaned.
  const wipe = () => withBusy(async () => {
    if (user) await deleteRemoteProfile(user.uid)
    await deleteAccount()
    setConfirmDelete(false)
    toast.success(t.account.okDeleted)
  })

  if (!ready) {
    return (
      <section className="band">
        <p className="eyebrow band__label">{caps(t.account.label)}</p>
        <div className="panel"><p className="acc__muted">{t.account.working}</p></div>
      </section>
    )
  }

  if (user) {
    return (
      <section className="band">
        <p className="eyebrow band__label">{caps(t.account.label)}</p>
        <div className="panel acc">
          <div className="acc__who">
            <span className="acc__dot" aria-hidden="true" />
            <div>
              <p className="acc__label">{caps(t.account.signedInAs)}</p>
              <p className="acc__id">{user.email ?? user.name ?? user.uid}</p>
              <p className="acc__via">
                {user.provider === 'google' ? t.account.viaGoogle : t.account.viaEmail}
                {syncing && <> · {t.account.syncing}</>}
              </p>
            </div>
          </div>
          {unsynced ? (
            <div className="acc__warn" role="alert">
              <p className="acc__warnt">{t.account.signOutOffline}</p>
              <p className="acc__body">{t.account.signOutOfflineBody}</p>
              <div className="set__confirm">
                <button className="btn btn--danger btn--sm" onClick={outAnyway} disabled={busy}>
                  {busy ? t.account.working : t.account.signOutAnyway}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setUnsynced(false)}>
                  {t.account.signOutCancel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn btn--secondary" onClick={out} disabled={busy}>
                {busy ? t.account.working : t.account.signOut}
              </button>
              <p className="acc__note">{t.account.signOutNote}</p>
            </>
          )}

          <div className="acc__danger">
            <p className="acc__label">{caps(t.account.deleteTitle)}</p>
            <p className="acc__body">{t.account.deleteBody}</p>
            {confirmDelete ? (
              <div className="set__confirm">
                <span className="set__confirm-q">{t.account.deleteConfirm}</span>
                <button className="btn btn--danger btn--sm" onClick={wipe} disabled={busy}>
                  {busy ? t.account.working : t.account.deleteYes}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>
                  {t.account.deleteNo}
                </button>
              </div>
            ) : (
              <button className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(true)}>
                {t.account.deleteCta}
              </button>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.account.label)}</p>
      <div className="panel acc">
        <p className="acc__title">{t.account.signedOutTitle}</p>
        <p className="acc__body">{t.account.signedOutBody}</p>
        <AuthForm />
      </div>
    </section>
  )
}
