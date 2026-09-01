import { useCallback, useEffect, useRef, useState } from 'react'
import type { Profile } from '../lib/types'
import { fetchProfile, pushProfile, mergeOnSignIn } from '../firebase/sync'
import type { MergeOutcome } from '../firebase/sync'
import { migrateLegacyLeave } from '../lib/leave'
import { migrateLegacyUnit } from '../lib/postings'
import { dueRecurring } from '../lib/money'
import { toISO } from '../lib/dates'
import { useToast } from './useToast'
import { useI18n } from './useI18n'
import { useAuth } from './useAuth'
import { useToday } from './useToday'

/**
 * Loads the profile — always locally, and from Firestore when signed in — and
 * saves it on every change, reporting a failed write.
 */
export function useProfile() {
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const toast = useToast()
  const { t } = useI18n()
  const { user, ready } = useAuth()
  const now = useToday()

  const uidRef = useRef<string | undefined>(undefined)
  uidRef.current = user?.uid
  const mergedFor = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProfile().then((p) => {
      if (!cancelled) {
        setProfileState(p)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  // On sign-in, merge the local and remote profiles exactly once.
  useEffect(() => {
    if (!ready || loading) return
    if (!user) { mergedFor.current = null; return }
    if (mergedFor.current === user.uid) return
    mergedFor.current = user.uid

    let cancelled = false
    setSyncing(true)
    mergeOnSignIn(user.uid, profile)
      .then(({ profile: merged, outcome }) => {
        if (cancelled) return
        if (merged) setProfileState(merged)
        const msg: Record<MergeOutcome, string | null> = {
          pulled: t.account.okPulled,
          pushed: t.account.okPushed,
          merged: t.account.okPushed,
          'in-sync': t.account.okInSync,
          none: null,
        }
        if (msg[outcome]) toast.success(msg[outcome]!)
      })
      .catch(() => { if (!cancelled) toast.error(t.errors.generic) })
      .finally(() => { if (!cancelled) setSyncing(false) })

    return () => { cancelled = true }
    // `profile` is left out deliberately: the merge runs once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, loading])

  const persist = useCallback((next: Profile) => {
    void pushProfile(next, uidRef.current).then((ok) => {
      if (!ok) toast.error(t.errors.storage)
    })
  }, [toast, t])

  // A stable reference, so the maintenance below does not depend on `persist`.
  const persistRef = useRef(persist)
  persistRef.current = persist

  const setProfile = useCallback((next: Profile) => {
    setProfileState(next)
    persist(next)
  }, [persist])

  // Three maintenance jobs: turning the old leave counter into a dated entry,
  // turning a bare unit into a posting, and charging any recurring expenses
  // that have come due.
  //
  // They run once per calendar day rather than once per load: this is a PWA
  // and can stay open for weeks, so recurring charges have to land without a
  // reload.
  const maintainedFor = useRef<string | null>(null)
  useEffect(() => {
    const day = toISO(now)
    if (loading || !profile || maintainedFor.current === day) return
    maintainedFor.current = day

    const migrated = migrateLegacyUnit(migrateLegacyLeave(profile, t.leave.legacyNote, now))
    const due = dueRecurring(migrated, now)
    if (migrated === profile && due.length === 0) return

    const next: Profile = { ...migrated, expenses: [...migrated.expenses, ...due] }
    setProfileState(next)
    persistRef.current(next)
    // `t` is left out deliberately: changing language must not re-run migration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading, now])

  const update = useCallback((patch: Partial<Profile>) => {
    setProfileState((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [persist])

  /**
   * An update that builds its patch from the **current** profile.
   *
   * Undo needs this: between the delete and the tap on "Undo" another entry
   * may have been added, and a patch built from an old snapshot would erase it.
   */
  const updateWith = useCallback((build: (prev: Profile) => Partial<Profile>) => {
    setProfileState((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...build(prev) }
      persist(next)
      return next
    })
  }, [persist])

  return { profile, setProfile, update, updateWith, loading, syncing }
}
