import type { EssoCode } from './types'
import type { Dict } from './i18n'

/**
 * ΕΣΣΟ = Εκπαιδευτική Σειρά Στρατευσίμων Οπλιτών.
 *
 * Ν. 5265/2026: οι ΕΣΣΟ μειώθηκαν από 6 σε 4 τον χρόνο — Φεβρουάριος, Μάιος,
 * Αύγουστος, Νοέμβριος. Από 1/1/2026 καταργήθηκε η υποχρεωτική θητεία σε
 * Ναυτικό και Αεροπορία· όλοι οι στρατεύσιμοι κατατάσσονται στον Στρατό Ξηράς
 * και μόνο όσοι έχουν εξειδικευμένα προσόντα μετατάσσονται εσωτερικά.
 */
export interface Esso {
  code: EssoCode
  year: number
  /** Ημερομηνία έναρξης κατάταξης, ISO. */
  from: string
  /** Ημερομηνία λήξης κατάταξης, ISO. */
  to: string
  /** true όταν η ημερομηνία δεν έχει ακόμη επιβεβαιωθεί επίσημα. */
  provisional?: boolean
}

export const ESSO_2026: Esso[] = [
  { code: 'A', year: 2026, from: '2026-02-24', to: '2026-02-27' },
  { code: 'B', year: 2026, from: '2026-05-19', to: '2026-05-22', provisional: true },
  { code: 'C', year: 2026, from: '2026-08-18', to: '2026-08-21', provisional: true },
  { code: 'D', year: 2026, from: '2026-11-17', to: '2026-11-20', provisional: true },
]

export const ESSO_2027: Esso[] = [
  { code: 'A', year: 2027, from: '2027-02-23', to: '2027-02-26', provisional: true },
  { code: 'B', year: 2027, from: '2027-05-18', to: '2027-05-21', provisional: true },
  { code: 'C', year: 2027, from: '2027-08-17', to: '2027-08-20', provisional: true },
  { code: 'D', year: 2027, from: '2027-11-16', to: '2027-11-19', provisional: true },
]

/** Η ετικέτα φτιάχνεται στη γλώσσα του χρήστη — δεν αποθηκεύεται. */
export function essoLabel(e: Esso, dict: Dict): string {
  return dict.essoLabel(e.year, e.code)
}

export const ALL_ESSO = [...ESSO_2026, ...ESSO_2027]

/** Η επόμενη ΕΣΣΟ μετά από μια ημερομηνία — για όσους δεν έχουν καταταγεί ακόμη. */
export function nextEsso(after: Date = new Date()): Esso | undefined {
  return ALL_ESSO.find((e) => new Date(e.from + 'T00:00:00') > after)
}
