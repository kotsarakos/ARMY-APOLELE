import type { Duty, DutyKind } from './types'
import { daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * Υπηρεσίες: σκοπιές, θάλαμος, αγγαρείες.
 *
 * Είναι το πράγμα που ο φαντάρος σημειώνει σε χαρτάκι — πότε έχω, τι ώρα,
 * πόσες έκανα. Κρατάμε ημερομηνία, ώρα ανάληψης και διάρκεια, ώστε να βγαίνει
 * και «η επόμενη σε πόσο» και «πόσες ώρες έχω δώσει συνολικά».
 */

export const DUTY_KINDS: DutyKind[] = ['guard', 'kitchen', 'orderly', 'patrol', 'other']

/** Τυπική διάρκεια ανά είδος, ως αρχική τιμή στη φόρμα. */
export const DEFAULT_HOURS: Record<DutyKind, number> = {
  guard: 2, kitchen: 6, orderly: 8, patrol: 4, other: 2,
}

export interface DutyCount {
  kind: DutyKind
  count: number
  hours: number
}

export interface DutyState {
  /** Η αμέσως επόμενη υπηρεσία, σήμερα ή μετά. */
  next: Duty | null
  /** Μέρες μέχρι την επόμενη· 0 σημαίνει σήμερα. */
  daysToNext: number
  total: number
  totalHours: number
  /** Υπηρεσίες που έχουν ήδη γίνει. */
  done: number
  byKind: DutyCount[]
  /** Μέσος όρος υπηρεσιών ανά μήνα υπηρεσίας — δείχνει αν σε «φορτώνουν». */
  perMonth: number
  upcoming: Duty[]
  past: Duty[]
}

export function sortDuties(duties: Duty[], newestFirst = true): Duty[] {
  duties = duties ?? []
  // `dir` είναι η τιμή που επιστρέφεται όταν το a προηγείται χρονικά του b:
  // +1 το στέλνει πίσω (πιο πρόσφατο πρώτο), −1 μπροστά.
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
    // Στρογγυλοποίηση στο ένα δεκαδικό: «3,5 υπηρεσίες τον μήνα» λέει κάτι,
    // το «3,4827» όχι.
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
