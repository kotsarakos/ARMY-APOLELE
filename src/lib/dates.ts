/** Date helpers. Όλες οι ημερομηνίες κρατούνται ως 'YYYY-MM-DD' και
 *  ερμηνεύονται στο τοπικό μεσημέρι, ώστε η αλλαγή ώρας (DST) να μην
 *  μετακινεί ποτέ μια ημέρα μπρος ή πίσω. */

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

/** Σημερινή ημερομηνία στο τοπικό μεσημέρι. */
export function today(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0)
}

/** Ακέραιες ημέρες από το a στο b (θετικό αν το b είναι μετά). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Προσθήκη ημερολογιακών μηνών, με συγκράτηση στο τέλος του μήνα
 *  (31 Ιαν + 1 μήνας = 28/29 Φεβ, όχι 3 Μαρ). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const targetDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(targetDay, lastDay))
  return d
}

/** Πλήρεις ημερολογιακοί μήνες που συμπληρώθηκαν μεταξύ δύο ημερομηνιών. */
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

/** Σύντομη μορφή — ίδια και στις δύο γλώσσες. */
export function formatShort(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}
