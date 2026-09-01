import { addDays, parseISO, toISO } from './dates'

/**
 * The month grid behind the calendar.
 *
 * Weeks start on **Monday** — that is how they are read in Greece, and it
 * holds for the English build (en-IE) too. `getDay()` counts from Sunday
 * though, so the shift is done explicitly here rather than in every component.
 */

/** Position within a Monday-first week: Monday is 0. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** Weekday names reordered to start on Monday. */
export function weekHeader<T>(sundayFirst: readonly T[]): T[] {
  return [...sundayFirst.slice(1), sundayFirst[0]]
}

export interface DayCell {
  date: Date
  iso: string
  /** Belongs to the month on show, or is padding from a neighbouring one. */
  inMonth: boolean
}

/**
 * Six full weeks, always — 42 cells. A fixed height means the calendar does
 * not jump when you change month, which is the most irritating way to lose
 * the spot you were looking at.
 */
export function monthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1, 12)
  const start = addDays(first, -mondayIndex(first))
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i)
    cells.push({ date, iso: toISO(date), inMonth: date.getMonth() === month })
  }
  return cells
}

/** Reads an ISO date safely, returning null instead of an Invalid Date. */
export function safeParse(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = parseISO(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function clampToRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false
  if (max && iso > max) return false
  return true
}
