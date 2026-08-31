import type { Profile } from '../lib/types'
import { DEFAULT_PROFILE } from '../lib/types'
import { loadProfile, saveProfile } from '../lib/storage'
import { mergeProfiles } from '../lib/merge'
import { getFirebaseApp, isFirebaseConfigured } from './config'

/**
 * Συγχρονισμός προφίλ.
 *
 * Η εφαρμογή είναι **local-first**: το localStorage είναι πάντα η άμεση πηγή,
 * ώστε να δουλεύει offline και χωρίς λογαριασμό. Το Firestore μπαίνει από πάνω
 * μόνο όταν ο χρήστης συνδεθεί μόνος του.
 *
 * Σχήμα: `users/{uid}` → Profile + updatedAt.
 *
 * Συγκρούσεις: το `updatedAt` κρίνει μόνο τα **βαθμωτά** πεδία (όνομα, μονάδα,
 * ημερομηνία κατάταξης). Οι λίστες — έξοδα, άδειες, υπηρεσίες — ενώνονται ανά
 * `id`, γιατί δύο συσκευές μπορεί κάλλιστα να έχουν γράψει διαφορετικές
 * εγγραφές· ένα σκέτο last-write-wins θα έσβηνε σιωπηλά τη μία πλευρά.
 * Βλ. `src/lib/merge.ts`.
 */

const COLLECTION = 'users'

async function getDb() {
  const app = await getFirebaseApp()
  if (!app) return null
  const { getFirestore } = await import('firebase/firestore')
  return getFirestore(app)
}

/** Τοπικό προφίλ. Δεν αγγίζει δίκτυο. */
export async function fetchProfile(): Promise<Profile | null> {
  return loadProfile()
}

/** Γράφει τοπικά και, αν υπάρχει uid, ανεβάζει και στο Firestore. */
export async function pushProfile(profile: Profile, uid?: string): Promise<boolean> {
  const stamped = { ...profile, updatedAt: Date.now() }
  const ok = saveProfile(stamped)

  if (!uid || !isFirebaseConfigured()) return ok

  try {
    const db = await getDb()
    if (!db) return ok
    const { doc, setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, COLLECTION, uid), stamped)
  } catch (err) {
    // Η τοπική εγγραφή πέτυχε — η αποτυχία δικτύου δεν πρέπει να χάσει δεδομένα.
    console.warn('[army_app] remote sync failed', err)
    return ok
  }
  return ok
}

export async function fetchRemoteProfile(uid: string): Promise<Profile | null> {
  if (!isFirebaseConfigured()) return null
  const db = await getDb()
  if (!db) return null
  const { doc, getDoc } = await import('firebase/firestore')
  const snap = await getDoc(doc(db, COLLECTION, uid))
  if (!snap.exists()) return null
  return { ...DEFAULT_PROFILE, ...(snap.data() as Partial<Profile>) }
}

/** Σβήνει οριστικά το έγγραφο του χρήστη. Καλείται πριν τη διαγραφή λογαριασμού. */
export async function deleteRemoteProfile(uid: string): Promise<void> {
  if (!isFirebaseConfigured()) return
  const db = await getDb()
  if (!db) return
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, COLLECTION, uid))
}

export type MergeOutcome = 'pulled' | 'pushed' | 'merged' | 'in-sync' | 'none'

export interface MergeResult {
  profile: Profile | null
  outcome: MergeOutcome
}

/**
 * Ενώνει τοπικό και απομακρυσμένο προφίλ μετά τη σύνδεση και ανεβάζει το
 * αποτέλεσμα, ώστε οι δύο πλευρές να καταλήξουν πανομοιότυπες.
 */
export async function mergeOnSignIn(uid: string, local: Profile | null): Promise<MergeResult> {
  const remote = await fetchRemoteProfile(uid)

  if (!remote && !local) return { profile: null, outcome: 'none' }

  if (remote && !local) {
    saveProfile(remote)
    return { profile: remote, outcome: 'pulled' }
  }

  if (local && !remote) {
    await pushProfile(local, uid)
    return { profile: local, outcome: 'pushed' }
  }

  const r = remote as Profile
  const l = local as Profile
  const merged = mergeProfiles(l, r)

  // Ίδιο περιεχόμενο και στις δύο πλευρές: τίποτα να γράψουμε.
  const unchanged =
    JSON.stringify({ ...merged, updatedAt: 0 }) === JSON.stringify({ ...r, updatedAt: 0 }) &&
    JSON.stringify({ ...merged, updatedAt: 0 }) === JSON.stringify({ ...l, updatedAt: 0 })

  saveProfile(merged)
  if (unchanged) return { profile: merged, outcome: 'in-sync' }

  await pushProfile(merged, uid)
  return { profile: merged, outcome: 'merged' }
}
