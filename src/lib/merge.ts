import type { Duty, Expense, LeaveEntry, Posting, Profile, Recurring } from './types'

/**
 * Merging two profiles from different devices.
 *
 * The problem it solves: write one expense on your phone with no signal, then
 * another on your laptop, and a plain "most recent wins" throws one of them
 * away — silently.
 *
 * The rules:
 *  - **Scalar fields** (name, unit, enlistment date): the larger `updatedAt`
 *    wins. There is no better rule for a field that changed on both sides.
 *  - **Lists**: unioned by `id`. No entry is ever lost.
 *  - **Deletions**: every delete leaves a tombstone in `deletedIds`. Without
 *    them, the union would resurrect whatever you deleted on one device.
 */

/** How many tombstones we keep before the oldest start falling off. */
export const MAX_TOMBSTONES = 500

interface HasId { id: string }

/** Union by id; on a clash the `winner` side takes it. */
function unionById<T extends HasId>(winner: T[], loser: T[], dead: Set<string>): T[] {
  const out = new Map<string, T>()
  for (const item of loser) out.set(item.id, item)
  for (const item of winner) out.set(item.id, item)
  return [...out.values()].filter((item) => !dead.has(item.id))
}

/** Every id a profile currently holds across its lists. */
function idsIn(p: Profile): Set<string> {
  return new Set([
    ...(p.expenses ?? []), ...(p.leaves ?? []), ...(p.duties ?? []),
    ...(p.recurring ?? []), ...(p.postings ?? []),
  ].map((x) => x.id))
}

export function mergeProfiles(a: Profile, b: Profile): Profile {
  const [newer, older] = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? [a, b] : [b, a]

  const dead = new Set([...(a.deletedIds ?? []), ...(b.deletedIds ?? [])])

  // A tombstone does not beat a record that the more recently written device
  // **still holds**. Without this rule, undoing a deletion would be a local
  // illusion: the delete has already synced, so the tombstone exists elsewhere
  // and the first merge would delete the row again.
  //
  // It is the same rule the scalar fields already follow: on a clash, the
  // device that wrote last wins.
  for (const id of idsIn(newer)) dead.delete(id)

  return {
    // Scalars: taken from the more recently written device.
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
 * Removes one entry from whichever list holds it, leaving a tombstone behind.
 * Returns a patch, so it goes through the normal `update` path.
 */
export function withDeletion(profile: Profile, id: string): Partial<Profile> {
  return withDeletions(profile, [id])
}

/** The same for several ids — a recurring charge with everything it created. */
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

/* ── Undo ────────────────────────────────────────────────────────────────── */

/** What was removed, kept per list so we know where to put it back. */
export interface Removed {
  expenses: Expense[]
  leaves: LeaveEntry[]
  duties: Duty[]
  recurring: Recurring[]
  postings: Posting[]
}

export interface Deletion {
  patch: Partial<Profile>
  /** How many entries were removed in total. */
  count: number
  /**
   * The patch that puts them back. It takes the **current** profile, not the
   * one from the moment of deletion: something else may have been added
   * between the tap and the undo, and it must not be lost.
   */
  restore: (current: Profile) => Partial<Profile>
}

/**
 * A deletion that can be undone.
 *
 * Without it, one stray tap on the "×" permanently erased a leave entry — and
 * with it a date nobody remembers off the top of their head. The tombstone is
 * lifted on restore, otherwise a merge with another device would delete it
 * again.
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
