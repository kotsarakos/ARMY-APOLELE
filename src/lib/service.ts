import type { Profile } from './types'
import {
  addDays, addMonths, daysBetween, fullMonthsBetween, parseISO, today,
} from './dates'
import {
  regularDaysTaken, sickExtensionDays, splitRegularDays, totalLeaveDays,
} from './leave'

/* ── Service constants (in force from 1 Jan 2026, Law 5265/2026) ──────────── */

/** Regular leave: 3 days for every completed two-month period. */
export const LEAVE_DAYS_PER_TWO_MONTHS = 3
/** Hard cap on leave days for a full term, sick leave included. */
export const LEAVE_HARD_CAP = 36
/** Honorary blood-donation leave: 2-4 days, at most twice per term. */
export const BLOOD_LEAVE_DAYS = 3
export const MAX_BLOOD_DONATIONS = 2
/** Honorary border-area leave: 2 days for every completed month. */
export const BORDER_LEAVE_PER_MONTH = 2
/** Conscript pay per month in euro — 50, or 100 in a border unit. */
export const PAY_PER_MONTH = 50
export const PAY_PER_MONTH_BORDER = 100

export interface ServiceState {
  enlist: Date
  /**
   * The discharge date.
   *
   * Regular leave counts as service, so it never pushes discharge back — this
   * is the single most misunderstood point. Sick leave beyond
   * `SICK_LEAVE_FREE_DAYS` does not count as service, and moves discharge back
   * by the same amount.
   */
  discharge: Date
  /** Discharge without the sick-leave extension — "enlistment + months". */
  baseDischarge: Date
  /** Days added by sick leave past the limit; 0 for an ordinary term. */
  sickExtension: number
  now: Date
  /** Total days of service, from enlistment to discharge. */
  totalDays: number
  /** Days served so far — 0 before enlistment. */
  daysServed: number
  /** Days left until discharge. */
  daysLeft: number
  /** Days until enlistment — above 0 only while it has not happened yet. */
  daysUntilEnlist: number
  hasEnlisted: boolean
  isDischarged: boolean
  /** 0..1 */
  progress: number
  /** Whole months served. */
  monthsServed: number
  leave: LeaveState
  /** Days of actual presence left, with leave taken out. */
  daysInCamp: number
  pay: PayState
}

export interface LeaveState {
  /** Regular leave accrued up to today. */
  earned: number
  /** Total regular leave for the whole term. */
  totalEntitlement: number
  /** Regular-leave days that have already passed. */
  taken: number
  /** Regular-leave days booked ahead — set aside, not yet taken. */
  planned: number
  /** taken + planned: everything that comes off the entitlement. */
  committed: number
  /** Honorary, sick and travel-warrant days — these do not touch the regular allowance. */
  otherTaken: number
  /** Accrued and still unused. */
  available: number
  /** Will accrue before discharge, but has not yet. */
  upcoming: number
  bonusHonorary: number
  /** Days until the next two-month mark, when leave is credited. */
  daysToNextAccrual: number
  cap: number
}

export interface PayState {
  perMonth: number
  earnedSoFar: number
  totalForService: number
  /** Next payment — the monthly anniversary of enlistment. */
  nextPayDate: Date
  /** Days until the next payment. */
  daysToPay: number
}

/** Discharge with nothing added: enlistment plus the months owed. */
function baseDischargeDate(profile: Profile): Date {
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

  // Next leave credit: at the close of the current two-month block.
  const nextAccrualMonth = (completedTwoMonthBlocks + 1) * 2
  const nextAccrualDate = addMonths(enlist, nextAccrualMonth)
  const daysToNextAccrual = Math.max(0, daysBetween(now, nextAccrualDate))

  // The dated entries are the source of truth; `leaveTaken` has already been
  // turned into one by `migrateLegacyLeave` during load.
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
    // Booked days are committed too: you cannot spend them twice.
    available: Math.max(0, earned + bonusHonorary - committed),
    upcoming: Math.max(0, totalEntitlement - earned),
    bonusHonorary,
    daysToNextAccrual,
    cap: LEAVE_HARD_CAP,
  }
}

export function computeService(profile: Profile, now: Date = today()): ServiceState {
  const enlist = parseISO(profile.enlistDate)
  const baseDischarge = baseDischargeDate(profile)
  const sickExtension = sickExtensionDays(profile.leaves)
  const discharge = addDays(baseDischarge, sickExtension)

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

  // Days actually on base: the days remaining, minus the leave still unspent.
  const leaveStillToUse = Math.max(
    0,
    leave.totalEntitlement + leave.bonusHonorary - leave.committed,
  )
  const daysInCamp = Math.max(0, daysLeft - leaveStillToUse)

  const perMonth = profile.borderUnit ? PAY_PER_MONTH_BORDER : PAY_PER_MONTH

  // Pay follows the anniversary of enlistment: enlist on the 24th and you are
  // paid on the 24th of each month. After discharge there is no next one.
  const nextPayMonth = Math.min(monthsServed + 1, profile.months)
  const nextPayDate = addMonths(enlist, nextPayMonth)

  return {
    enlist,
    discharge,
    baseDischarge,
    sickExtension,
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

/* ── Leave forecast ───────────────────────────────────────────────────────── */

export interface AccrualPoint {
  /** The day the two-month block closes and the days are credited. */
  date: Date
  daysAway: number
  /** How many days are credited then. */
  credit: number
  /** How many will be available after it, with committed days removed. */
  available: number
}

/**
 * When leave is next credited, and how much there will be by then.
 *
 * The app only answered "how many do I have today". The question people
 * actually ask runs the other way: "I want five days in October — do I have
 * them?". Credits are deterministic (3 days per completed two-month block), so
 * every one of them can be worked out in advance.
 *
 * Anything already booked counts as spent: if you have leave booked for
 * November, you cannot promise those same days elsewhere.
 */
export function leaveForecast(profile: Profile, s: ServiceState): AccrualPoint[] {
  const blocks = Math.floor(profile.months / 2)
  const doneBlocks = Math.floor(s.monthsServed / 2)
  const out: AccrualPoint[] = []

  let previous = s.leave.earned
  for (let k = doneBlocks + 1; k <= blocks; k++) {
    const date = addMonths(s.enlist, k * 2)
    if (date.getTime() <= s.now.getTime()) continue

    const earned = Math.min(k * LEAVE_DAYS_PER_TWO_MONTHS, s.leave.totalEntitlement)
    // Border-area honorary leave also accrues per month, so it grows along
    // with the rest; blood-donation leave is fixed.
    const bonus = profile.borderUnit
      ? Math.min(profile.bloodDonations, MAX_BLOOD_DONATIONS) * BLOOD_LEAVE_DAYS +
        k * 2 * BORDER_LEAVE_PER_MONTH
      : s.leave.bonusHonorary

    out.push({
      date,
      daysAway: daysBetween(s.now, date),
      credit: earned - previous,
      available: Math.max(0, earned + bonus - s.leave.committed),
    })
    previous = earned
  }

  return out
}

export interface LeaveAvailability {
  /** The first day the balance reaches what was asked for, or null if never. */
  date: Date | null
  daysAway: number
  /** True when the days are already available today. */
  already: boolean
}

/** "When will I have N days?" — reads the forecast for the first point that clears it. */
export function whenAvailable(
  s: ServiceState, forecast: AccrualPoint[], wanted: number,
): LeaveAvailability {
  if (wanted <= s.leave.available) return { date: s.now, daysAway: 0, already: true }
  const hit = forecast.find((p) => p.available >= wanted)
  return hit
    ? { date: hit.date, daysAway: hit.daysAway, already: false }
    : { date: null, daysAway: -1, already: false }
}

/* ── Milestones ───────────────────────────────────────────────────────────── */

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
 * Milestones under the new training model: 10 weeks of basic training at the
 * training centre, and 14 weeks of training in total before posting to a field
 * unit — around 70% of conscripts go straight to border units.
 *
 * Returns keys and dates only; the labels come from i18n.
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
