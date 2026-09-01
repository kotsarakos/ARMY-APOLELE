import type { LeaveEntry, LeaveKind, Profile } from './types'
import { addDays, daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * Leave, recorded by date.
 *
 * The old version stored a single number (`leaveTaken`). That answered "how
 * many have I burned", which is not the question a conscript asks — the
 * question is "when am I out again". Dates answer both, with no counting by
 * hand.
 *
 * Days are counted **inclusively**: 3 May to 5 May is three days, the same way
 * the travel warrant counts them.
 */

export const LEAVE_KINDS: LeaveKind[] = ['regular', 'honorary', 'blood', 'march', 'sick']

/** The kinds that come out of the regular entitlement. */
const COUNTS_AGAINST_REGULAR: LeaveKind[] = ['regular']

export function leaveDays(entry: LeaveEntry): number {
  const d = daysBetween(parseISO(entry.from), parseISO(entry.to))
  return d < 0 ? 0 : d + 1
}

/** The `?? []` is not decoration: a profile written before these lists existed
 *  would take the whole app down to a white screen. */
export function totalLeaveDays(leaves: LeaveEntry[], kinds?: LeaveKind[]): number {
  return (leaves ?? [])
    .filter((l) => !kinds || kinds.includes(l.kind))
    .reduce((sum, l) => sum + leaveDays(l), 0)
}

/** Regular-leave days spent — all of them, past and future alike. */
export function regularDaysTaken(leaves: LeaveEntry[]): number {
  return totalLeaveDays(leaves, COUNTS_AGAINST_REGULAR)
}

export interface DaysSplit {
  /** Days already gone — including today if you are on leave right now. */
  past: number
  /** Days booked ahead. They hold back the balance, but were not "taken". */
  future: number
}

/**
 * Splits days into "gone" and "booked".
 *
 * Without the split, leave entered for next month shows up as already taken —
 * which is not true — and the balance drops for no visible reason. Leave that
 * is under way counts on both sides, by however many days fall on each.
 */
export function splitRegularDays(leaves: LeaveEntry[], now: Date = today()): DaysSplit {
  const iso = toISO(now)
  let past = 0
  let future = 0

  for (const l of (leaves ?? [])) {
    if (!COUNTS_AGAINST_REGULAR.includes(l.kind)) continue
    const total = leaveDays(l)
    if (total === 0) continue
    if (l.to <= iso) { past += total; continue }
    if (l.from > iso) { future += total; continue }
    // Under way: it splits at today.
    const done = daysBetween(parseISO(l.from), now) + 1
    past += done
    future += total - done
  }

  return { past, future }
}

/* ── Sick leave ──────────────────────────────────────────────────────────── */

/**
 * How many days of sick leave fit inside the term without extending it.
 *
 * Past that limit the time does not count as service, and discharge moves back
 * by the same amount. It is the most common reason a discharge date is not
 * simply "enlistment + months", and the app ignored it entirely until now —
 * meaning it showed the wrong day to anyone with a long sick leave.
 *
 * The final date always comes from the unit; this is only the estimate.
 */
export const SICK_LEAVE_FREE_DAYS = 30

export function sickDays(leaves: LeaveEntry[]): number {
  return totalLeaveDays(leaves, ['sick'])
}

/** Days added to the term by sick leave beyond the limit. */
export function sickExtensionDays(leaves: LeaveEntry[]): number {
  return Math.max(0, sickDays(leaves) - SICK_LEAVE_FREE_DAYS)
}

export function sortLeaves(leaves: LeaveEntry[]): LeaveEntry[] {
  return [...(leaves ?? [])].sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0))
}

export interface LeaveTimeline {
  /** The leave running right now, if any. */
  current: LeaveEntry | null
  /** The first leave that has not started yet. */
  next: LeaveEntry | null
  /** Days until the next one begins. */
  daysToNext: number
  /** Days left of the current one, today included. */
  daysLeftOfCurrent: number
  past: LeaveEntry[]
}

export function leaveTimeline(leaves: LeaveEntry[], now: Date = today()): LeaveTimeline {
  const list = leaves ?? []
  const iso = toISO(now)
  const current = list.find((l) => l.from <= iso && iso <= l.to) ?? null

  const upcoming = list
    .filter((l) => l.from > iso)
    .sort((a, b) => (a.from < b.from ? -1 : 1))
  const next = upcoming[0] ?? null

  return {
    current,
    next,
    daysToNext: next ? daysBetween(now, parseISO(next.from)) : -1,
    daysLeftOfCurrent: current ? daysBetween(now, parseISO(current.to)) + 1 : 0,
    past: sortLeaves(list.filter((l) => l.to < iso)),
  }
}

/* ── Validation ───────────────────────────────────────────────────────────── */

export type LeaveProblem = 'range' | 'overlap' | 'tooLong'

/** The longest plausible span — this catches a typo in the year. */
const MAX_SPAN_DAYS = 120

export function validateLeave(
  entry: LeaveEntry,
  existing: LeaveEntry[],
): LeaveProblem | null {
  if (entry.to < entry.from) return 'range'
  if (leaveDays(entry) > MAX_SPAN_DAYS) return 'tooLong'
  const clash = existing.some(
    (l) => l.id !== entry.id && l.from <= entry.to && entry.from <= l.to,
  )
  return clash ? 'overlap' : null
}

export function newLeave(
  kind: LeaveKind, from: string, to: string, note?: string,
): LeaveEntry {
  return { id: newId('lv'), kind, from, to, note: note?.trim() || undefined }
}

/* ── Migration from the old field ─────────────────────────────────────────── */

/**
 * Profiles written before dates existed held only a counter. It becomes a
 * single entry ending yesterday, so there is one source of truth. The dates
 * are approximate and the entry says so in its `note`, so it can be corrected
 * or deleted.
 */
export function migrateLegacyLeave(profile: Profile, note: string, now: Date = today()): Profile {
  if ((profile.leaves ?? []).length > 0 || profile.leaveTaken <= 0) return profile
  const to = addDays(now, -1)
  const from = addDays(to, -(profile.leaveTaken - 1))
  return {
    ...profile,
    leaves: [newLeave('regular', toISO(from), toISO(to), note)],
    leaveTaken: 0,
  }
}
