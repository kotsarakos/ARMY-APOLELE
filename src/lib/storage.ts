import type { Profile } from './types'
import { DEFAULT_PROFILE } from './types'

/**
 * The storage layer. It writes to localStorage; `syncProfile` in
 * src/firebase/sync.ts handles upload and download on top of it, without any
 * component having to know.
 *
 * Writes return a boolean rather than swallowing the error, so the interface
 * can tell the user when it failed — private browsing, for instance.
 */
const KEY = 'army_app.profile.v1'

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) }
  } catch {
    return null
  }
}

export function saveProfile(profile: Profile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
    return true
  } catch {
    return false
  }
}

export function clearProfile(): boolean {
  try {
    localStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}
