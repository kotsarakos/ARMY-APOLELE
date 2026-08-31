import type { ServiceState } from './service'

/**
 * Ανεπίσημες «βαθμίδες» της φαντάρικης αργκό, με βάση το πόσο έχει προχωρήσει
 * η θητεία. Δεν έχουν καμία επίσημη ισχύ — είναι ο τρόπος που μετράει ο φαντάρος.
 *
 * Εδώ ζει μόνο το κλειδί και το κατώφλι· το κείμενο έρχεται από το i18n.
 */
export type TierKey =
  | 'pre' | 'psaraki' | 'neos' | 'mesaios' | 'palios' | 'leles' | 'done'

export interface Tier {
  key: TierKey
  /** Κατώτατο ποσοστό προόδου (0..1) για τη βαθμίδα. */
  from: number
  accent: 'olive' | 'signal'
}

export const TIERS: Tier[] = [
  { key: 'psaraki', from: 0.00, accent: 'olive' },
  { key: 'neos',    from: 0.10, accent: 'olive' },
  { key: 'mesaios', from: 0.35, accent: 'olive' },
  { key: 'palios',  from: 0.60, accent: 'olive' },
  { key: 'leles',   from: 0.85, accent: 'signal' },
]

export function tierFor(s: ServiceState): Tier {
  if (s.isDischarged) return { key: 'done', from: 1, accent: 'signal' }
  if (!s.hasEnlisted) return { key: 'pre', from: 0, accent: 'olive' }
  let current = TIERS[0]
  for (const t of TIERS) if (s.progress >= t.from) current = t
  return current
}
