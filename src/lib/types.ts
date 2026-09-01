/** Length of service in months. From 1 Jan 2026 every conscript joins the Army. */
export type ServiceMonths = 12 | 9 | 6 | 3

export type EssoCode = 'A' | 'B' | 'C' | 'D'

import type { Lang } from './i18n'

/** Spending categories that make sense to a conscript. */
export type ExpenseCategory =
  | 'canteen' | 'transport' | 'food' | 'phone' | 'gear' | 'fun' | 'other'

export interface Expense {
  id: string
  /** Amount in **cents** — never a decimal, so totals cannot drift. */
  amount: number
  category: ExpenseCategory
  /** ISO 'YYYY-MM-DD'. */
  date: string
  note?: string
}

/**
 * A charge that repeats every month — a phone plan, a subscription.
 * It is not an expense itself: it produces ordinary `Expense` entries when its
 * day comes round, with a deterministic id so it can never be written twice.
 */
export interface Recurring {
  id: string
  amount: number
  category: ExpenseCategory
  /** Day of the month, 1-28 — the 28th is the last day every month has. */
  day: number
  note?: string
  /** ISO date of the first charge; nothing is produced before it. */
  since: string
}

/** Kinds of leave. Honorary kinds do not come off the regular entitlement. */
export type LeaveKind = 'regular' | 'honorary' | 'blood' | 'march' | 'sick'

export interface LeaveEntry {
  id: string
  kind: LeaveKind
  /** ISO 'YYYY-MM-DD', the first day away from the unit. */
  from: string
  /** ISO 'YYYY-MM-DD', the last day — **inclusive**. */
  to: string
  note?: string
}

/** Kinds of duty. */
export type DutyKind = 'guard' | 'kitchen' | 'orderly' | 'patrol' | 'other'

export interface Duty {
  id: string
  kind: DutyKind
  /** ISO 'YYYY-MM-DD'. */
  date: string
  /** 'HH:MM' — when it starts. Optional. */
  start?: string
  /** Length in hours. */
  hours: number
  note?: string
}

/**
 * A posting to a unit.
 *
 * The profile held a single `unit` string, so the first transfer erased the
 * training centre. The list keeps the whole route; `unit` remains as whichever
 * unit is shown in the bar right now.
 */
export interface Posting {
  id: string
  /** Name of the unit or training centre. */
  unit: string
  /** ISO 'YYYY-MM-DD', the first day present there. */
  from: string
  note?: string
}

export interface Profile {
  /** Full name or nickname — for display only. */
  name: string
  /** Enlistment date, ISO 'YYYY-MM-DD'. */
  enlistDate: string
  /** Full (12) or reduced (9/6/3) military obligation. */
  months: ServiceMonths
  /** A border-area unit: Thrace, the East Aegean islands, the Dodecanese, ELDYK. */
  borderUnit: boolean
  /** Optional unit name for display — where they are **now**. */
  unit?: string
  /** Posting history, from the training centre to the current unit. */
  postings: Posting[]
  /**
   * Leave days already spent.
   * **Legacy field.** `leaves` is the source of truth now; this survives only
   * so that profiles written before dates existed can be migrated.
   * @deprecated
   */
  leaveTaken: number
  /** Leave with dates. The source of truth for days taken. */
  leaves: LeaveEntry[]
  /** Duties: guard shifts, barracks orderly, fatigues. */
  duties: Duty[]
  /** Blood donations — up to 2, each worth 2-4 days of honorary leave. */
  bloodDonations: number
  /** Interface language. */
  lang: Lang
  /** Money held outside the army, in **cents**. */
  startingBalance: number
  /** Recorded expenses. */
  expenses: Expense[]
  /** Monthly recurring charges. */
  recurring: Recurring[]
  /**
   * A personal spending limit per calendar month, in **cents**. Zero means no
   * limit — this is not an army rule, it is their own decision.
   */
  monthlyBudget: number
  /**
   * Tombstones: ids the user has deleted.
   *
   * Without them, merging two devices would resurrect whatever you deleted on
   * one but which still exists on the other. The last `MAX_TOMBSTONES` are kept.
   */
  deletedIds: string[]
  /** Epoch ms of the last change — decides which device wins a merge. */
  updatedAt: number
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  enlistDate: '',
  months: 12,
  borderUnit: false,
  unit: '',
  postings: [],
  leaveTaken: 0,
  leaves: [],
  duties: [],
  bloodDonations: 0,
  lang: 'el',
  startingBalance: 0,
  expenses: [],
  recurring: [],
  monthlyBudget: 0,
  deletedIds: [],
  updatedAt: 0,
}
