/** Date helpers. Every date is stored as 'YYYY-MM-DD' and read at local noon,
 *  so that a daylight-saving shift can never move a day forwards or back. */

const MS_PER_DAY = 86_400_000

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today's date, at local noon. */
export function today(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0)
}

/** Whole days from a to b — positive when b is the later one. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Adds calendar months, clamping to the end of the month:
 *  31 Jan + 1 month is 28/29 Feb, not 3 Mar. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const targetDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(targetDay, lastDay))
  return d
}

/** Whole calendar months completed between two dates. */
export function fullMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return Math.max(0, months)
}

import type { Dict } from './i18n'

export function formatDate(date: Date, dict: Dict, withWeekday = false): string {
  const base = `${date.getDate()} ${dict.months[date.getMonth()]} ${date.getFullYear()}`
  return withWeekday ? `${dict.weekdays[date.getDay()]}, ${base}` : base
}

/** Short form — identical in both languages. */
export function formatShort(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}
