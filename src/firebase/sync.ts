import type { Profile } from '../lib/types'
import { DEFAULT_PROFILE } from '../lib/types'
import { loadProfile, saveProfile } from '../lib/storage'
import { mergeProfiles } from '../lib/merge'
import { getFirebaseApp, isFirebaseConfigured } from './config'

/**
 * Profile syncing.
 *
 * The app is **local-first**: localStorage is always the immediate source, so
 * it works offline and without an account. Firestore sits on top, and only
 * once someone signs in of their own accord.
 *
 * Schema: `users/{uid}` holding the Profile plus updatedAt.
 *
 * Conflicts: `updatedAt` decides **scalar** fields only (name, unit,
 * enlistment date). The lists — expenses, leave, duties — are merged by `id`,
 * because two devices may well have written different entries, and a plain
 * last-write-wins would silently erase one side. See `src/lib/merge.ts`.
 */

const COLLECTION = 'users'

async function getDb() {
  const app = await getFirebaseApp()
  if (!app) return null
  const { getFirestore } = await import('firebase/firestore')
  return getFirestore(app)
}

/** The local profile. Touches no network. */
export async function fetchProfile(): Promise<Profile | null> {
  return loadProfile()
}

/** Writes locally and, when there is a uid, uploads to Firestore as well. */
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
    // The local write succeeded — a network failure must not lose data.
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

/**
 * Uploads, and reports whether the write **actually reached** the server.
 *
 * `pushProfile` returns the success of the local write and swallows network
 * errors, which is right for the normal flow. But before wiping local data on
 * sign-out we need to know a copy exists — otherwise anything written offline
 * disappears silently.
 */
export async function pushRemoteOnly(profile: Profile, uid: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false
  try {
    const db = await getDb()
    if (!db) return false
    const { doc, setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, COLLECTION, uid), { ...profile, updatedAt: Date.now() })
    return true
  } catch (err) {
    console.warn('[army_app] final sync before sign-out failed', err)
    return false
  }
}

/** Permanently removes the user's document. Called before deleting the account. */
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
 * Merges the local and remote profiles after sign-in and uploads the result,
 * so both sides end up identical.
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

  // Identical on both sides: nothing to write.
  const unchanged =
    JSON.stringify({ ...merged, updatedAt: 0 }) === JSON.stringify({ ...r, updatedAt: 0 }) &&
    JSON.stringify({ ...merged, updatedAt: 0 }) === JSON.stringify({ ...l, updatedAt: 0 })

  saveProfile(merged)
  if (unchanged) return { profile: merged, outcome: 'in-sync' }

  await pushProfile(merged, uid)
  return { profile: merged, outcome: 'merged' }
}
