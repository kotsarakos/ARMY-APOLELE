import type { Profile } from './types'
import { DEFAULT_PROFILE } from './types'
import { toISO, today } from './dates'

/**
 * A JSON backup.
 *
 * Why it exists: all the data lives in localStorage, and a browser "clear
 * history" wipes it without warning. The file is human-readable and belongs to
 * the person who made it — not locked, and not ours.
 */

const FORMAT = 'army-apolele/backup'
const VERSION = 1

interface Backup {
  format: string
  version: number
  exportedAt: string
  profile: Profile
}

export function exportBackup(profile: Profile): Blob {
  const payload: Backup = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    profile,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export function downloadBackup(profile: Profile): void {
  const url = URL.createObjectURL(exportBackup(profile))
  const a = document.createElement('a')
  a.href = url
  a.download = `army-apolele-${toISO(today())}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ImportError = 'parse' | 'format' | 'empty'

export interface ImportResult {
  profile: Profile | null
  error: ImportError | null
}

/**
 * Reads a backup file. Only accepts what was written from here: an arbitrary
 * JSON file would pass silently and leave the profile half empty.
 */
export function parseBackup(text: string): ImportResult {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { profile: null, error: 'parse' } }

  if (typeof raw !== 'object' || raw === null) return { profile: null, error: 'format' }
  const b = raw as Partial<Backup>
  if (b.format !== FORMAT || typeof b.profile !== 'object' || b.profile === null) {
    return { profile: null, error: 'format' }
  }

  const p = { ...DEFAULT_PROFILE, ...b.profile } as Profile
  if (!p.enlistDate) return { profile: null, error: 'empty' }

  // The lists may be missing or malformed in an older file.
  return {
    profile: {
      ...p,
      leaves: Array.isArray(p.leaves) ? p.leaves : [],
      duties: Array.isArray(p.duties) ? p.duties : [],
      expenses: Array.isArray(p.expenses) ? p.expenses : [],
      recurring: Array.isArray(p.recurring) ? p.recurring : [],
      postings: Array.isArray(p.postings) ? p.postings : [],
      deletedIds: Array.isArray(p.deletedIds) ? p.deletedIds : [],
      updatedAt: Date.now(),
    },
    error: null,
  }
}
