import { useCallback, useEffect, useRef, useState } from 'react'
import type { Profile } from '../lib/types'
import { fetchProfile, pushProfile, mergeOnSignIn } from '../firebase/sync'
import type { MergeOutcome } from '../firebase/sync'
import { migrateLegacyLeave } from '../lib/leave'
import { dueRecurring } from '../lib/money'
import { toISO } from '../lib/dates'
import { useToast } from './useToast'
import { useI18n } from './useI18n'
import { useAuth } from './useAuth'
import { useToday } from './useToday'

/**
 * Φορτώνει το προφίλ (τοπικά πάντα, από Firestore όταν υπάρχει σύνδεση) και
 * το αποθηκεύει σε κάθε αλλαγή, ειδοποιώντας αν η εγγραφή αποτύχει.
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

  // Όταν συνδεθεί κάποιος, ενώνουμε τοπικό και απομακρυσμένο προφίλ μία φορά.
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
    // `profile` σκόπιμα εκτός: η συγχώνευση τρέχει μία φορά ανά σύνδεση.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, loading])

  const persist = useCallback((next: Profile) => {
    void pushProfile(next, uidRef.current).then((ok) => {
      if (!ok) toast.error(t.errors.storage)
    })
  }, [toast, t])

  // Σταθερή αναφορά, ώστε η συντήρηση παρακάτω να μην εξαρτάται από το `persist`.
  const persistRef = useRef(persist)
  persistRef.current = persist

  const setProfile = useCallback((next: Profile) => {
    setProfileState(next)
    persist(next)
  }, [persist])

  // Δύο εργασίες συντήρησης: μεταφορά του παλιού μετρητή αδείας σε εγγραφή με
  // ημερομηνίες, και χρέωση των πάγιων εξόδων που ωρίμασαν.
  //
  // Τρέχουν μία φορά ανά ημερολογιακή μέρα, όχι μία φορά ανά φόρτωση: η
  // εφαρμογή είναι PWA και μπορεί να μείνει ανοιχτή για βδομάδες, οπότε τα
  // πάγια πρέπει να μπαίνουν και χωρίς reload.
  const maintainedFor = useRef<string | null>(null)
  useEffect(() => {
    const day = toISO(now)
    if (loading || !profile || maintainedFor.current === day) return
    maintainedFor.current = day

    const migrated = migrateLegacyLeave(profile, t.leave.legacyNote, now)
    const due = dueRecurring(migrated, now)
    if (migrated === profile && due.length === 0) return

    const next: Profile = { ...migrated, expenses: [...migrated.expenses, ...due] }
    setProfileState(next)
    persistRef.current(next)
    // `t` σκόπιμα εκτός: αλλαγή γλώσσας δεν πρέπει να ξανατρέξει τη μεταφορά.
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

  return { profile, setProfile, update, loading, syncing }
}
