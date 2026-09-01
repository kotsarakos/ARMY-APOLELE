import type { Posting, Profile } from './types'
import { addDays, daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * Posting history.
 *
 * Service does not happen in one place: the training centre, a transfer,
 * perhaps a detachment. The profile held a single `unit`, so the first
 * transfer erased the training centre and, with it, how long was spent there.
 *
 * The list is deliberately simple: each entry records only when it **began**.
 * The end comes from the start of the next one, so there can be no gap or
 * overlap that would need validating.
 */

export function sortPostings(postings: Posting[]): Posting[] {
  return [...(postings ?? [])].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
}

export interface PostingSpan {
  posting: Posting
  /** ISO of the last day there, or null when this is the current posting. */
  until: string | null
  /** Days present — counted up to today for the current posting. */
  days: number
  current: boolean
}

/**
 * Postings with their durations. Future entries are allowed — a transfer you
 * already know about — and report `days: 0`, because you have not been yet.
 */
export function postingSpans(postings: Posting[], now: Date = today()): PostingSpan[] {
  const list = sortPostings(postings)
  const iso = toISO(now)

  return list.map((posting, i) => {
    const next = list[i + 1]
    const started = posting.from <= iso
    const from = parseISO(posting.from)
    // The next posting starts on the day this one ends, so the last day here
    // is the day before it.
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

/** Where they are today — the most recent posting that has already begun. */
export function currentPosting(postings: Posting[], now: Date = today()): Posting | null {
  const iso = toISO(now)
  const started = sortPostings(postings).filter((p) => p.from <= iso)
  return started[started.length - 1] ?? null
}

export function newPosting(unit: string, from: string, note?: string): Posting {
  return { id: newId('ps'), unit: unit.trim(), from, note: note?.trim() || undefined }
}

/**
 * Migrates older profiles: a bare `unit` becomes the first posting, dated to
 * enlistment. That is the only date we know for certain, and it can be
 * corrected by hand.
 */
export function migrateLegacyUnit(profile: Profile): Profile {
  const unit = profile.unit?.trim()
  if (!unit || (profile.postings ?? []).length > 0 || !profile.enlistDate) return profile
  return { ...profile, postings: [newPosting(unit, profile.enlistDate)] }
}
