import type { LeaveEntry, LeaveKind, Profile } from './types'
import { addDays, daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * Άδειες με ημερομηνίες.
 *
 * Η παλιά έκδοση κρατούσε έναν αριθμό (`leaveTaken`). Αυτό απαντούσε «πόσες
 * έκαψα», που δεν είναι η ερώτηση του φαντάρου — η ερώτηση είναι «πότε
 * ξαναβγαίνω». Με ημερομηνίες βγαίνουν και τα δύο, χωρίς χειροκίνητο μέτρημα.
 *
 * Οι μέρες μετριούνται **περιληπτικά**: από 3/5 έως 5/5 είναι 3 μέρες, όπως
 * τις μετράει και το φύλλο πορείας.
 */

export const LEAVE_KINDS: LeaveKind[] = ['regular', 'honorary', 'blood', 'march', 'sick']

/** Είδη που αφαιρούνται από την κανονική δικαιούμενη άδεια. */
const COUNTS_AGAINST_REGULAR: LeaveKind[] = ['regular']

export function leaveDays(entry: LeaveEntry): number {
  const d = daysBetween(parseISO(entry.from), parseISO(entry.to))
  return d < 0 ? 0 : d + 1
}

/** Το `?? []` δεν είναι διακοσμητικό: ένα προφίλ γραμμένο πριν υπάρξουν οι
 *  λίστες θα έριχνε ολόκληρη την εφαρμογή σε λευκή οθόνη. */
export function totalLeaveDays(leaves: LeaveEntry[], kinds?: LeaveKind[]): number {
  return (leaves ?? [])
    .filter((l) => !kinds || kinds.includes(l.kind))
    .reduce((sum, l) => sum + leaveDays(l), 0)
}

/** Μέρες κανονικής άδειας που έχουν καταναλωθεί (όλες, παρελθόν και μέλλον). */
export function regularDaysTaken(leaves: LeaveEntry[]): number {
  return totalLeaveDays(leaves, COUNTS_AGAINST_REGULAR)
}

export interface DaysSplit {
  /** Μέρες που έχουν ήδη περάσει — μαζί με τη σημερινή αν είσαι σε άδεια. */
  past: number
  /** Μέρες κλεισμένες για το μέλλον. Δεσμεύουν το υπόλοιπο αλλά δεν «πάρθηκαν». */
  future: number
}

/**
 * Χωρίζει τις μέρες σε «πέρασαν» και «κλεισμένες».
 *
 * Χωρίς αυτόν τον διαχωρισμό, μια άδεια που καταχωρείς για τον επόμενο μήνα
 * εμφανίζεται ως «πήρα» — που δεν ισχύει — και ο χρήστης δεν καταλαβαίνει
 * γιατί έπεσε το υπόλοιπό του. Άδεια που είναι σε εξέλιξη μετριέται και στα δύο,
 * όσες μέρες της ανήκουν σε κάθε πλευρά.
 */
export function splitRegularDays(leaves: LeaveEntry[], now: Date = today()): DaysSplit {
  const iso = toISO(now)
  let past = 0
  let future = 0

  for (const l of (leaves ?? [])) {
    if (!COUNTS_AGAINST_REGULAR.includes(l.kind)) continue
    const total = leaveDays(l)
    if (total === 0) continue
    if (l.to <= iso) { past += total; continue }
    if (l.from > iso) { future += total; continue }
    // Σε εξέλιξη: μοιράζεται στη σημερινή μέρα.
    const done = daysBetween(parseISO(l.from), now) + 1
    past += done
    future += total - done
  }

  return { past, future }
}

export function sortLeaves(leaves: LeaveEntry[]): LeaveEntry[] {
  return [...(leaves ?? [])].sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0))
}

export interface LeaveTimeline {
  /** Η άδεια που τρέχει τώρα, αν υπάρχει. */
  current: LeaveEntry | null
  /** Η πρώτη άδεια που δεν έχει αρχίσει ακόμη. */
  next: LeaveEntry | null
  /** Μέρες μέχρι την έναρξη της επόμενης. */
  daysToNext: number
  /** Μέρες που απομένουν στην τρέχουσα, μαζί με τη σημερινή. */
  daysLeftOfCurrent: number
  past: LeaveEntry[]
}

export function leaveTimeline(leaves: LeaveEntry[], now: Date = today()): LeaveTimeline {
  const list = leaves ?? []
  const iso = toISO(now)
  const current = list.find((l) => l.from <= iso && iso <= l.to) ?? null

  const upcoming = list
    .filter((l) => l.from > iso)
    .sort((a, b) => (a.from < b.from ? -1 : 1))
  const next = upcoming[0] ?? null

  return {
    current,
    next,
    daysToNext: next ? daysBetween(now, parseISO(next.from)) : -1,
    daysLeftOfCurrent: current ? daysBetween(now, parseISO(current.to)) + 1 : 0,
    past: sortLeaves(list.filter((l) => l.to < iso)),
  }
}

/* ── Έλεγχοι εγκυρότητας ──────────────────────────────────────────────────── */

export type LeaveProblem = 'range' | 'overlap' | 'tooLong'

/** Το μεγαλύτερο εύλογο διάστημα — πιάνει τυπογραφικά λάθη στη χρονιά. */
const MAX_SPAN_DAYS = 120

export function validateLeave(
  entry: LeaveEntry,
  existing: LeaveEntry[],
): LeaveProblem | null {
  if (entry.to < entry.from) return 'range'
  if (leaveDays(entry) > MAX_SPAN_DAYS) return 'tooLong'
  const clash = existing.some(
    (l) => l.id !== entry.id && l.from <= entry.to && entry.from <= l.to,
  )
  return clash ? 'overlap' : null
}

export function newLeave(
  kind: LeaveKind, from: string, to: string, note?: string,
): LeaveEntry {
  return { id: newId('lv'), kind, from, to, note: note?.trim() || undefined }
}

/* ── Μεταφορά από το παλιό πεδίο ──────────────────────────────────────────── */

/**
 * Προφίλ γραμμένα πριν τις ημερομηνίες κρατούσαν μόνο έναν μετρητή. Το
 * μετατρέπουμε σε μία εγγραφή που τελειώνει χθες, ώστε να υπάρχει μία πηγή
 * αλήθειας. Οι ημερομηνίες είναι κατά προσέγγιση και η εγγραφή το δηλώνει
 * μέσω `note`, ώστε ο χρήστης να τη διορθώσει ή να τη σβήσει.
 */
export function migrateLegacyLeave(profile: Profile, note: string, now: Date = today()): Profile {
  if ((profile.leaves ?? []).length > 0 || profile.leaveTaken <= 0) return profile
  const to = addDays(now, -1)
  const from = addDays(to, -(profile.leaveTaken - 1))
  return {
    ...profile,
    leaves: [newLeave('regular', toISO(from), toISO(to), note)],
    leaveTaken: 0,
  }
}
