import type { ServiceState } from './service'

/**
 * The unofficial "tiers" of conscript slang, keyed off how far service has
 * progressed. They carry no official weight — this is simply how conscripts
 * count.
 *
 * Only the key and the threshold live here; the wording comes from i18n.
 */
export type TierKey =
  | 'pre' | 'psaraki' | 'neos' | 'mesaios' | 'palios' | 'leles' | 'done'

export interface Tier {
  key: TierKey
  /** Lowest progress (0..1) that still counts as this tier. */
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
