import type { EssoCode } from './types'
import type { Dict } from './i18n'

/**
 * ΕΣΣΟ (ESSO) = the intake a conscript enlists with.
 *
 * Law 5265/2026 cut them from six a year to four — February, May, August,
 * November. From 1 January 2026 conscription into the Navy and Air Force
 * ended: every conscript joins the Army, and only those with specialised
 * qualifications are transferred on internally.
 */
export interface Esso {
  code: EssoCode
  year: number
  /** First day of the enlistment window, ISO. */
  from: string
  /** Last day of the enlistment window, ISO. */
  to: string
  /** True while the date has not been officially confirmed yet. */
  provisional?: boolean
}

const ESSO_2026: Esso[] = [
  { code: 'A', year: 2026, from: '2026-02-24', to: '2026-02-27' },
  { code: 'B', year: 2026, from: '2026-05-19', to: '2026-05-22', provisional: true },
  { code: 'C', year: 2026, from: '2026-08-18', to: '2026-08-21', provisional: true },
  { code: 'D', year: 2026, from: '2026-11-17', to: '2026-11-20', provisional: true },
]

const ESSO_2027: Esso[] = [
  { code: 'A', year: 2027, from: '2027-02-23', to: '2027-02-26', provisional: true },
  { code: 'B', year: 2027, from: '2027-05-18', to: '2027-05-21', provisional: true },
  { code: 'C', year: 2027, from: '2027-08-17', to: '2027-08-20', provisional: true },
  { code: 'D', year: 2027, from: '2027-11-16', to: '2027-11-19', provisional: true },
]

/** The label is built in the reader's language — it is never stored. */
export function essoLabel(e: Esso, dict: Dict): string {
  return dict.essoLabel(e.year, e.code)
}

export const ALL_ESSO = [...ESSO_2026, ...ESSO_2027]
