import type { Profile } from './types'
import {
  addDays, addMonths, daysBetween, fullMonthsBetween, parseISO, today,
} from './dates'
import { regularDaysTaken, splitRegularDays, totalLeaveDays } from './leave'

/* ── Σταθερές θητείας (ισχύουν από 1/1/2026, Ν. 5265/2026) ────────────────── */

/** Κανονική άδεια: 3 ημέρες για κάθε πλήρες δίμηνο υπηρεσίας. */
export const LEAVE_DAYS_PER_TWO_MONTHS = 3
/** Ανώτατο όριο ημερών άδειας για πλήρη θητεία (περιλαμβάνει την αναρρωτική). */
export const LEAVE_HARD_CAP = 36
/** Τιμητική άδεια αιμοδοσίας: 2-4 ημέρες, έως 2 φορές στη θητεία. */
export const BLOOD_LEAVE_DAYS = 3
export const MAX_BLOOD_DONATIONS = 2
/** Τιμητική άδεια παραμεθορίου (ΤΑΠ): 2 ημέρες για κάθε πλήρη μήνα. */
export const BORDER_LEAVE_PER_MONTH = 2
/** Αποζημίωση οπλίτη ανά μήνα (€) — 50€, 100€ σε παραμεθόριο. */
export const PAY_PER_MONTH = 50
export const PAY_PER_MONTH_BORDER = 100

export interface ServiceState {
  enlist: Date
  discharge: Date
  now: Date
  /** Συνολικές ημέρες θητείας από κατάταξη έως απόλυση. */
  totalDays: number
  /** Ημέρες που έχουν υπηρετηθεί (0 πριν την κατάταξη). */
  daysServed: number
  /** Ημέρες που απομένουν μέχρι το απολυτήριο. */
  daysLeft: number
  /** Ημέρες μέχρι την κατάταξη — >0 μόνο αν δεν έχει καταταγεί ακόμη. */
  daysUntilEnlist: number
  hasEnlisted: boolean
  isDischarged: boolean
  /** 0..1 */
  progress: number
  /** Πλήρεις μήνες που υπηρετήθηκαν. */
  monthsServed: number
  leave: LeaveState
  /** Ημέρες πραγματικής παρουσίας που απομένουν, αφαιρώντας τις άδειες. */
  daysInCamp: number
  pay: PayState
}

export interface LeaveState {
  /** Κανονική άδεια που έχει ήδη δικαιωθεί μέχρι σήμερα. */
  earned: number
  /** Συνολική κανονική άδεια για ολόκληρη τη θητεία. */
  totalEntitlement: number
  /** Μέρες κανονικής άδειας που έχουν ήδη περάσει. */
  taken: number
  /** Μέρες κανονικής άδειας κλεισμένες για το μέλλον — δεσμευμένες, όχι παρμένες. */
  planned: number
  /** taken + planned· ό,τι κόβεται από το δικαίωμα. */
  committed: number
  /** Μέρες τιμητικής/αναρρωτικής/φύλλου πορείας — δεν κόβουν την κανονική. */
  otherTaken: number
  /** Δικαιωμένη και αχρησιμοποίητη. */
  available: number
  /** Θα δικαιωθεί μέχρι την απόλυση αλλά όχι ακόμη. */
  upcoming: number
  bonusHonorary: number
  /** Ημέρες μέχρι το επόμενο δίμηνο (επόμενη πίστωση αδείας). */
  daysToNextAccrual: number
  cap: number
}

export interface PayState {
  perMonth: number
  earnedSoFar: number
  totalForService: number
  /** Επόμενη καταβολή — η επέτειος της κατάταξης κάθε μήνα. */
  nextPayDate: Date
  /** Μέρες μέχρι την επόμενη καταβολή. */
  daysToPay: number
}

/** Ημερομηνία απόλυσης = κατάταξη + μήνες υποχρέωσης.
 *  Η κανονική άδεια υπηρετείται, οπότε δεν μεταθέτει το απολυτήριο. */
export function dischargeDate(profile: Profile): Date {
  return addMonths(parseISO(profile.enlistDate), profile.months)
}

function computeLeave(profile: Profile, monthsServed: number, now: Date, enlist: Date): LeaveState {
  const completedTwoMonthBlocks = Math.floor(monthsServed / 2)
  const earned = completedTwoMonthBlocks * LEAVE_DAYS_PER_TWO_MONTHS

  const totalEntitlement = Math.min(
    Math.floor(profile.months / 2) * LEAVE_DAYS_PER_TWO_MONTHS,
    LEAVE_HARD_CAP,
  )

  const bloodDays =
    Math.min(profile.bloodDonations, MAX_BLOOD_DONATIONS) * BLOOD_LEAVE_DAYS
  const borderDays = profile.borderUnit ? monthsServed * BORDER_LEAVE_PER_MONTH : 0
  const bonusHonorary = bloodDays + borderDays

  // Επόμενη πίστωση αδείας: στο τέλος του τρέχοντος διμήνου.
  const nextAccrualMonth = (completedTwoMonthBlocks + 1) * 2
  const nextAccrualDate = addMonths(enlist, nextAccrualMonth)
  const daysToNextAccrual = Math.max(0, daysBetween(now, nextAccrualDate))

  // Πηγή αλήθειας οι εγγραφές με ημερομηνίες· το `leaveTaken` έχει ήδη
  // μεταφερθεί σε εγγραφή από το `migrateLegacyLeave` κατά τη φόρτωση.
  const { past: taken, future: planned } = splitRegularDays(profile.leaves, now)
  const committed = taken + planned
  const otherTaken = totalLeaveDays(profile.leaves) - regularDaysTaken(profile.leaves)

  return {
    earned,
    totalEntitlement,
    taken,
    planned,
    committed,
    otherTaken,
    // Οι κλεισμένες δεσμεύουν κι αυτές: δεν μπορείς να τις ξαναδώσεις αλλού.
    available: Math.max(0, earned + bonusHonorary - committed),
    upcoming: Math.max(0, totalEntitlement - earned),
    bonusHonorary,
    daysToNextAccrual,
    cap: LEAVE_HARD_CAP,
  }
}

export function computeService(profile: Profile, now: Date = today()): ServiceState {
  const enlist = parseISO(profile.enlistDate)
  const discharge = dischargeDate(profile)

  const totalDays = daysBetween(enlist, discharge)
  const rawServed = daysBetween(enlist, now)

  const hasEnlisted = rawServed >= 0
  const daysServed = Math.min(Math.max(rawServed, 0), totalDays)
  const daysLeft = Math.max(0, daysBetween(now, discharge))
  const daysUntilEnlist = hasEnlisted ? 0 : -rawServed
  const isDischarged = now.getTime() >= discharge.getTime()

  const monthsServed = hasEnlisted
    ? Math.min(fullMonthsBetween(enlist, now), profile.months)
    : 0

  const leave = computeLeave(profile, monthsServed, now, enlist)

  // «Μέρες με τα φύλλα»: όσες μένουν, μείον τις άδειες που δεν έχουν
  // ακόμη καταναλωθεί — δηλαδή πραγματική παρουσία στη μονάδα.
  const leaveStillToUse = Math.max(
    0,
    leave.totalEntitlement + leave.bonusHonorary - leave.committed,
  )
  const daysInCamp = Math.max(0, daysLeft - leaveStillToUse)

  const perMonth = profile.borderUnit ? PAY_PER_MONTH_BORDER : PAY_PER_MONTH

  // Η αποζημίωση ακολουθεί την επέτειο της κατάταξης: αν κατατάχθηκε στις 24,
  // πληρώνεται στις 24 κάθε μήνα. Μετά την απόλυση δεν υπάρχει επόμενη.
  const nextPayMonth = Math.min(monthsServed + 1, profile.months)
  const nextPayDate = addMonths(enlist, nextPayMonth)

  return {
    enlist,
    discharge,
    now,
    totalDays,
    daysServed,
    daysLeft,
    daysUntilEnlist,
    hasEnlisted,
    isDischarged,
    progress: totalDays > 0 ? daysServed / totalDays : 0,
    monthsServed,
    leave,
    daysInCamp,
    pay: {
      perMonth,
      earnedSoFar: monthsServed * perMonth,
      totalForService: profile.months * perMonth,
      nextPayDate,
      daysToPay: Math.max(0, daysBetween(now, nextPayDate)),
    },
  }
}

/* ── Ορόσημα ──────────────────────────────────────────────────────────────── */

export type MilestoneKey =
  | 'enlist' | 'oath' | 'first-leave' | 'basic-end'
  | 'posting' | 'half' | 'leles' | 'discharge'

export interface Milestone {
  key: MilestoneKey
  date: Date
  done: boolean
  daysAway: number
}

/**
 * Ορόσημα με βάση το νέο μοντέλο εκπαίδευσης: 10 εβδομάδες βασική εκπαίδευση
 * στο ΚΕΝ και 14 εβδομάδες συνολικής εκπαίδευσης πριν την τοποθέτηση σε μονάδα
 * εκστρατείας (το 70% των οπλιτών οδηγείται απευθείας σε μονάδες συνόρων).
 *
 * Επιστρέφει μόνο κλειδιά και ημερομηνίες — οι ετικέτες έρχονται από το i18n.
 */
export function milestones(s: ServiceState): Milestone[] {
  const raw: Array<{ key: MilestoneKey; date: Date }> = [
    { key: 'enlist', date: s.enlist },
    { key: 'oath', date: addDays(s.enlist, 21) },
    { key: 'first-leave', date: addDays(s.enlist, 24) },
    { key: 'basic-end', date: addDays(s.enlist, 70) },
    { key: 'posting', date: addDays(s.enlist, 98) },
    { key: 'half', date: addDays(s.enlist, Math.floor(s.totalDays / 2)) },
    { key: 'leles', date: addDays(s.discharge, -60) },
    { key: 'discharge', date: s.discharge },
  ]

  return raw
    .filter((m) => m.date.getTime() <= s.discharge.getTime())
    .map((m) => ({
      ...m,
      done: s.now.getTime() >= m.date.getTime(),
      daysAway: daysBetween(s.now, m.date),
    }))
}
