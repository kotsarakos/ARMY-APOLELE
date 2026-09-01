import type { Duty, Expense, LeaveEntry, Posting, Profile, Recurring } from './types'

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

/** Όλα τα id που κρατά ένα προφίλ στις λίστες του. */
function idsIn(p: Profile): Set<string> {
  return new Set([
    ...(p.expenses ?? []), ...(p.leaves ?? []), ...(p.duties ?? []),
    ...(p.recurring ?? []), ...(p.postings ?? []),
  ].map((x) => x.id))
}

export function mergeProfiles(a: Profile, b: Profile): Profile {
  const [newer, older] = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? [a, b] : [b, a]

  const dead = new Set([...(a.deletedIds ?? []), ...(b.deletedIds ?? [])])

  // Μια ταφόπλακα δεν κερδίζει μια εγγραφή που **υπάρχει ακόμη** στην πιο
  // πρόσφατη συσκευή. Χωρίς αυτόν τον κανόνα, η αναίρεση διαγραφής θα ήταν
  // τοπική ψευδαίσθηση: το σβήσιμο έχει ήδη συγχρονιστεί, οπότε η ταφόπλακα
  // υπάρχει αλλού και θα ξανάσβηνε την εγγραφή στην πρώτη συγχώνευση.
  //
  // Είναι ο ίδιος κανόνας που ισχύει ήδη για τα βαθμωτά πεδία: σε σύγκρουση,
  // κερδίζει η συσκευή που έγραψε τελευταία.
  for (const id of idsIn(newer)) dead.delete(id)

  return {
    // Βαθμωτά: από την πιο πρόσφατη συσκευή.
    ...newer,
    expenses: unionById<Expense>(newer.expenses ?? [], older.expenses ?? [], dead),
    leaves: unionById<LeaveEntry>(newer.leaves ?? [], older.leaves ?? [], dead),
    duties: unionById<Duty>(newer.duties ?? [], older.duties ?? [], dead),
    recurring: unionById<Recurring>(newer.recurring ?? [], older.recurring ?? [], dead),
    postings: unionById<Posting>(newer.postings ?? [], older.postings ?? [], dead),
    deletedIds: [...dead].slice(-MAX_TOMBSTONES),
    updatedAt: Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0),
  }
}

/**
 * Σβήνει μία εγγραφή από όποια λίστα κι αν βρίσκεται, αφήνοντας ταφόπλακα.
 * Επιστρέφει patch, ώστε να περάσει από το κανονικό `update`.
 */
export function withDeletion(profile: Profile, id: string): Partial<Profile> {
  return withDeletions(profile, [id])
}

/** Το ίδιο για πολλά id μαζί — π.χ. πάγιο μαζί με όσα έξοδα παρήγαγε. */
export function withDeletions(profile: Profile, ids: string[]): Partial<Profile> {
  const dead = new Set(ids)
  return {
    expenses: (profile.expenses ?? []).filter((e) => !dead.has(e.id)),
    leaves: (profile.leaves ?? []).filter((l) => !dead.has(l.id)),
    duties: (profile.duties ?? []).filter((d) => !dead.has(d.id)),
    recurring: (profile.recurring ?? []).filter((r) => !dead.has(r.id)),
    postings: (profile.postings ?? []).filter((p) => !dead.has(p.id)),
    deletedIds: [...(profile.deletedIds ?? []), ...ids].slice(-MAX_TOMBSTONES),
  }
}

/* ── Αναίρεση ────────────────────────────────────────────────────────────── */

/** Ό,τι αφαιρέθηκε, κρατημένο ανά λίστα ώστε να ξέρουμε πού να επιστρέψει. */
export interface Removed {
  expenses: Expense[]
  leaves: LeaveEntry[]
  duties: Duty[]
  recurring: Recurring[]
  postings: Posting[]
}

export interface Deletion {
  patch: Partial<Profile>
  /** Πόσες εγγραφές αφαιρέθηκαν συνολικά. */
  count: number
  /**
   * Το patch που τις ξαναβάζει. Παίρνει το **τρέχον** προφίλ, όχι εκείνο της
   * στιγμής της διαγραφής: ανάμεσα στη διαγραφή και στην αναίρεση μπορεί να
   * έχει προστεθεί κάτι άλλο, και δεν πρέπει να χαθεί.
   */
  restore: (current: Profile) => Partial<Profile>
}

/**
 * Διαγραφή με δυνατότητα αναίρεσης.
 *
 * Χωρίς αυτό, ένα λάθος πάτημα στο «×» έσβηνε οριστικά μια άδεια — και μαζί
 * της την ημερομηνία που κανείς δεν θυμάται απ' έξω. Η ταφόπλακα φεύγει μαζί
 * με την επαναφορά, αλλιώς η συγχώνευση με άλλη συσκευή θα την ξανάσβηνε.
 */
export function deletion(profile: Profile, ids: string[]): Deletion {
  const dead = new Set(ids)
  const removed: Removed = {
    expenses: (profile.expenses ?? []).filter((e) => dead.has(e.id)),
    leaves: (profile.leaves ?? []).filter((l) => dead.has(l.id)),
    duties: (profile.duties ?? []).filter((d) => dead.has(d.id)),
    recurring: (profile.recurring ?? []).filter((r) => dead.has(r.id)),
    postings: (profile.postings ?? []).filter((p) => dead.has(p.id)),
  }

  const count =
    removed.expenses.length + removed.leaves.length + removed.duties.length +
    removed.recurring.length + removed.postings.length

  return {
    patch: withDeletions(profile, ids),
    count,
    restore: (current) => ({
      expenses: [...(current.expenses ?? []), ...removed.expenses],
      leaves: [...(current.leaves ?? []), ...removed.leaves],
      duties: [...(current.duties ?? []), ...removed.duties],
      recurring: [...(current.recurring ?? []), ...removed.recurring],
      postings: [...(current.postings ?? []), ...removed.postings],
      deletedIds: (current.deletedIds ?? []).filter((id) => !dead.has(id)),
    }),
  }
}
