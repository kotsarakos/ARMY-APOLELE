import { addDays, parseISO, toISO } from './dates'

/**
 * Πλέγμα μήνα για το ημερολόγιο.
 *
 * Η εβδομάδα ξεκινά **Δευτέρα** — έτσι τη διαβάζει κανείς στην Ελλάδα, και το
 * ίδιο ισχύει και στην αγγλική έκδοση (en-IE). Το `getDay()` όμως μετράει από
 * Κυριακή, οπότε η μετατόπιση γίνεται ρητά εδώ και όχι σε κάθε component.
 */

/** Θέση της ημέρας μέσα σε εβδομάδα που ξεκινά Δευτέρα: Δευτέρα = 0. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** Ονόματα ημερών ξαναταξινομημένα ώστε να ξεκινούν από Δευτέρα. */
export function weekHeader<T>(sundayFirst: readonly T[]): T[] {
  return [...sundayFirst.slice(1), sundayFirst[0]]
}

export interface DayCell {
  date: Date
  iso: string
  /** Ανήκει στον μήνα που δείχνουμε, ή είναι γέμισμα από τον γειτονικό. */
  inMonth: boolean
}

/**
 * Έξι πλήρεις εβδομάδες (42 κελιά). Σταθερό ύψος σημαίνει ότι το ημερολόγιο
 * δεν αναπηδά όταν αλλάζεις μήνα — που είναι ο πιο ενοχλητικός τρόπος να
 * χάσεις το σημείο που κοιτούσες.
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

/** Ασφαλής ανάγνωση ISO· επιστρέφει null αντί για Invalid Date. */
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
