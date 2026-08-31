import type { Profile } from './types'
import { DEFAULT_PROFILE } from './types'

/**
 * Επίπεδο αποθήκευσης. Σήμερα γράφει σε localStorage· όταν μπει το Firebase,
 * το `syncProfile` στο src/firebase/sync.ts καλύπτει το ανέβασμα/κατέβασμα
 * χωρίς να αλλάξει τίποτε στα components.
 *
 * Οι εγγραφές επιστρέφουν boolean αντί να καταπίνουν σιωπηλά το σφάλμα, ώστε
 * η διεπαφή να μπορεί να ενημερώσει τον χρήστη (π.χ. ιδιωτική περιήγηση).
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
