import type { Duty, DutyKind } from './types'
import { daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * Duties: guard shifts, barracks orderly, fatigues.
 *
 * This is the thing conscripts scribble on a scrap of paper — when is mine,
 * what time, how many have I done. Storing the date, the start time and the
 * length gives both "how long until the next one" and "how many hours in
 * total".
 */

export const DUTY_KINDS: DutyKind[] = ['guard', 'kitchen', 'orderly', 'patrol', 'other']

/** The usual length of each type, used to prefill the form. */
export const DEFAULT_HOURS: Record<DutyKind, number> = {
  guard: 2, kitchen: 6, orderly: 8, patrol: 4, other: 2,
}

export interface DutyCount {
  kind: DutyKind
  count: number
  hours: number
}

export interface DutyState {
  /** The next duty due, today or later. */
  next: Duty | null
  /** Days until the next one; 0 means today. */
  daysToNext: number
  total: number
  totalHours: number
  /** Duties already done. */
  done: number
  byKind: DutyCount[]
  /** Average duties per month served — shows whether you are being piled on. */
  perMonth: number
  upcoming: Duty[]
  past: Duty[]
}

function sortDuties(duties: Duty[], newestFirst = true): Duty[] {
  duties = duties ?? []
  // `dir` is what we return when a comes before b in time: +1 sends it to the
  // back (most recent first), -1 to the front.
  const dir = newestFirst ? 1 : -1
  return [...duties].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? dir : -dir
    return (a.start ?? '') < (b.start ?? '') ? dir : -dir
  })
}

export function computeDuties(
  duties: Duty[], monthsServed: number, now: Date = today(),
): DutyState {
  duties = duties ?? []
  const iso = toISO(now)
  const upcoming = sortDuties(duties.filter((d) => d.date >= iso), false)
  const past = sortDuties(duties.filter((d) => d.date < iso))
  const next = upcoming[0] ?? null

  const sums = new Map<DutyKind, DutyCount>()
  for (const d of duties) {
    const cur = sums.get(d.kind) ?? { kind: d.kind, count: 0, hours: 0 }
    cur.count += 1
    cur.hours += Math.max(0, d.hours)
    sums.set(d.kind, cur)
  }

  const totalHours = duties.reduce((s, d) => s + Math.max(0, d.hours), 0)

  return {
    next,
    daysToNext: next ? daysBetween(now, parseISO(next.date)) : -1,
    total: duties.length,
    totalHours,
    done: past.length,
    byKind: [...sums.values()].sort((a, b) => b.count - a.count),
    // Rounded to one decimal: "3.5 duties a month" says something,
    // "3.4827" does not.
    perMonth: monthsServed > 0 ? Math.round((duties.length / monthsServed) * 10) / 10 : 0,
    upcoming,
    past,
  }
}

export function newDuty(
  kind: DutyKind, date: string, hours: number, start?: string, note?: string,
): Duty {
  return {
    id: newId('dt'),
    kind,
    date,
    hours: Math.max(0, hours),
    start: start || undefined,
    note: note?.trim() || undefined,
  }
}
