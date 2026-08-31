import type { Duty, Expense, LeaveEntry, Profile, Recurring } from './types'

/**
 * Συγχώνευση δύο προφίλ από διαφορετικές συσκευές.
 *
 * Το πρόβλημα που λύνει: αν γράψεις ένα έξοδο στο κινητό εκτός σήματος και
 * μετά ένα άλλο στον υπολογιστή, ένα σκέτο «κερδίζει το πιο πρόσφατο» θα
 * πετούσε τη μία από τις δύο εγγραφές — σιωπηλά.
 *
 * Ο κανόνας εδώ:
 *  - **Βαθμωτά πεδία** (όνομα, μονάδα, ημερομηνία κατάταξης): κερδίζει το
 *    μεγαλύτερο `updatedAt`. Δεν υπάρχει καλύτερος κανόνας για ένα πεδίο που
 *    άλλαξε και στις δύο μεριές.
 *  - **Λίστες**: ένωση ανά `id`. Καμία εγγραφή δεν χάνεται.
 *  - **Διαγραφές**: κάθε σβήσιμο αφήνει ταφόπλακα στο `deletedIds`. Χωρίς
 *    αυτές, η ένωση θα ανάσταινε ό,τι έσβησες στη μία συσκευή.
 */

/** Πόσες ταφόπλακες κρατάμε πριν αρχίσουν να πέφτουν οι παλιότερες. */
export const MAX_TOMBSTONES = 500

interface HasId { id: string }

/** Ένωση ανά id· σε σύγκρουση κερδίζει η πλευρά `winner`. */
function unionById<T extends HasId>(winner: T[], loser: T[], dead: Set<string>): T[] {
  const out = new Map<string, T>()
  for (const item of loser) out.set(item.id, item)
  for (const item of winner) out.set(item.id, item)
  return [...out.values()].filter((item) => !dead.has(item.id))
}

export function mergeProfiles(a: Profile, b: Profile): Profile {
  const [newer, older] = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? [a, b] : [b, a]

  const dead = new Set([...(a.deletedIds ?? []), ...(b.deletedIds ?? [])])

  return {
    // Βαθμωτά: από την πιο πρόσφατη συσκευή.
    ...newer,
    expenses: unionById<Expense>(newer.expenses ?? [], older.expenses ?? [], dead),
    leaves: unionById<LeaveEntry>(newer.leaves ?? [], older.leaves ?? [], dead),
    duties: unionById<Duty>(newer.duties ?? [], older.duties ?? [], dead),
    recurring: unionById<Recurring>(newer.recurring ?? [], older.recurring ?? [], dead),
    deletedIds: [...dead].slice(-MAX_TOMBSTONES),
    updatedAt: Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0),
  }
}

/**
 * Σβήνει μία εγγραφή από όποια λίστα κι αν βρίσκεται, αφήνοντας ταφόπλακα.
 * Επιστρέφει patch, ώστε να περάσει από το κανονικό `update`.
 */
export function withDeletion(profile: Profile, id: string): Partial<Profile> {
  return {
    expenses: profile.expenses.filter((e) => e.id !== id),
    leaves: profile.leaves.filter((l) => l.id !== id),
    duties: profile.duties.filter((d) => d.id !== id),
    recurring: profile.recurring.filter((r) => r.id !== id),
    deletedIds: [...(profile.deletedIds ?? []), id].slice(-MAX_TOMBSTONES),
  }
}

/** Το ίδιο για πολλά id μαζί — π.χ. πάγιο μαζί με όσα έξοδα παρήγαγε. */
export function withDeletions(profile: Profile, ids: string[]): Partial<Profile> {
  const dead = new Set(ids)
  return {
    expenses: profile.expenses.filter((e) => !dead.has(e.id)),
    leaves: profile.leaves.filter((l) => !dead.has(l.id)),
    duties: profile.duties.filter((d) => !dead.has(d.id)),
    recurring: profile.recurring.filter((r) => !dead.has(r.id)),
    deletedIds: [...(profile.deletedIds ?? []), ...ids].slice(-MAX_TOMBSTONES),
  }
}
