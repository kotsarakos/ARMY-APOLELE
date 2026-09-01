import type { Posting, Profile } from './types'
import { addDays, daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * Ιστορικό μονάδων.
 *
 * Μια θητεία δεν γίνεται σε ένα μέρος: ΚΕΝ, μετάθεση, ίσως απόσπαση. Το
 * προφίλ κρατούσε ένα μόνο `unit`, οπότε η πρώτη μετάθεση έσβηνε το ΚΕΝ και
 * μαζί την πληροφορία «πόσο έμεινα εκεί».
 *
 * Η λίστα είναι απλή: κάθε εγγραφή δηλώνει πότε **άρχισε**. Το τέλος της
 * βγαίνει από την αρχή της επόμενης, οπότε δεν μπορεί να υπάρξει κενό ή
 * επικάλυψη που να χρειάζεται έλεγχο.
 */

export function sortPostings(postings: Posting[]): Posting[] {
  return [...(postings ?? [])].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
}

export interface PostingSpan {
  posting: Posting
  /** ISO της τελευταίας μέρας εκεί, ή null αν είναι η τρέχουσα. */
  until: string | null
  /** Μέρες παρουσίας — μέχρι σήμερα αν είναι η τρέχουσα. */
  days: number
  current: boolean
}

/**
 * Οι τοποθετήσεις με διάρκεια. Μελλοντικές εγγραφές (μετάθεση που ξέρεις ότι
 * έρχεται) επιτρέπονται και βγάζουν `days: 0` — δεν έχεις πάει ακόμη.
 */
export function postingSpans(postings: Posting[], now: Date = today()): PostingSpan[] {
  const list = sortPostings(postings)
  const iso = toISO(now)

  return list.map((posting, i) => {
    const next = list[i + 1]
    const started = posting.from <= iso
    const from = parseISO(posting.from)
    // Η επόμενη τοποθέτηση αρχίζει τη μέρα που τελειώνει αυτή, οπότε η
    // τελευταία μέρα εδώ είναι η προηγούμενή της.
    const until = next ? toISO(addDays(parseISO(next.from), -1)) : null
    const to = next ? parseISO(next.from) : now

    return {
      posting,
      until,
      days: started ? Math.max(0, daysBetween(from, to)) : 0,
      current: started && !next,
    }
  })
}

/** Η μονάδα στην οποία βρίσκεται σήμερα — η τελευταία που έχει ήδη αρχίσει. */
export function currentPosting(postings: Posting[], now: Date = today()): Posting | null {
  const iso = toISO(now)
  const started = sortPostings(postings).filter((p) => p.from <= iso)
  return started[started.length - 1] ?? null
}

export function newPosting(unit: string, from: string, note?: string): Posting {
  return { id: newId('ps'), unit: unit.trim(), from, note: note?.trim() || undefined }
}

/**
 * Μεταφορά παλιών προφίλ: ένα σκέτο `unit` γίνεται η πρώτη τοποθέτηση, με
 * ημερομηνία την κατάταξη. Είναι η μόνη ημερομηνία που ξέρουμε σίγουρα, και
 * ο χρήστης μπορεί να τη διορθώσει.
 */
export function migrateLegacyUnit(profile: Profile): Profile {
  const unit = profile.unit?.trim()
  if (!unit || (profile.postings ?? []).length > 0 || !profile.enlistDate) return profile
  return { ...profile, postings: [newPosting(unit, profile.enlistDate)] }
}
