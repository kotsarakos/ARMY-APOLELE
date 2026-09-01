import type { Expense, ExpenseCategory, Profile, Recurring } from './types'
import type { ServiceState } from './service'
import { daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * The money side of service.
 *
 * Every amount is stored in **cents**, as an integer. In floating point
 * 0.1 + 0.2 is not 0.3, and after a few dozen entries the balance would be
 * visibly wrong.
 */

export const CATEGORIES: ExpenseCategory[] = [
  'canteen', 'transport', 'food', 'phone', 'gear', 'fun', 'other',
]

export interface CategoryTotal {
  category: ExpenseCategory
  total: number
  /** 0..1 of total spending. */
  share: number
}

export interface MoneyState {
  /** Money held before enlisting, outside the army. */
  starting: number
  /** Pay already earned. */
  earned: number
  /** Total pay across the whole term. */
  totalPay: number
  /** Pay still to come. */
  upcomingPay: number
  spent: number
  /** starting + earned − spent */
  balance: number
  /** Average daily spend so far. */
  dailyBurn: number
  /** Average monthly spend. */
  monthlyBurn: number
  /** Projected balance on discharge day, at the current rate. */
  projected: number
  /** True when the projection puts the balance below zero. */
  willRunOut: boolean
  /**
   * How much can be spent per day to reach discharge at exactly zero.
   * It is the ceiling, not a suggestion.
   */
  dailyAllowance: number
  byCategory: CategoryTotal[]
  count: number
  /** Sum of the recurring charges per month. */
  recurringMonthly: number
  budget: BudgetState
}

export interface BudgetState {
  /** The limit in cents; 0 means none has been set. */
  limit: number
  set: boolean
  /** Spent within the current calendar month. */
  spent: number
  /** What is left of the limit; can go negative. */
  left: number
  /** 0..1 of the limit — clipped at 1 so the bar cannot overflow. */
  share: number
  over: boolean
  /** Days left in the month, today included. */
  daysLeftInMonth: number
  /** Daily room left to stay inside the limit until the month ends. */
  perDay: number
}

/** Spending within the calendar month that `now` falls in. */
export function spentInMonth(expenses: Expense[], now: Date): number {
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return (expenses ?? [])
    .filter((e) => e.date.startsWith(prefix))
    .reduce((sum, e) => sum + e.amount, 0)
}

function computeBudget(profile: Profile, now: Date): BudgetState {
  const limit = Math.max(0, profile.monthlyBudget ?? 0)
  const spent = spentInMonth(profile.expenses, now)
  const left = limit - spent

  // Days left in the month, counting today: on 28 April there are still three
  // days to spend across (28, 29, 30).
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeftInMonth = lastDay - now.getDate() + 1

  return {
    limit,
    set: limit > 0,
    spent,
    left,
    share: limit > 0 ? Math.min(1, spent / limit) : 0,
    over: limit > 0 && spent > limit,
    daysLeftInMonth,
    perDay: limit > 0 ? Math.max(0, Math.floor(left / daysLeftInMonth)) : 0,
  }
}

export function totalSpent(expenses: Expense[]): number {
  return (expenses ?? []).reduce((sum, e) => sum + e.amount, 0)
}

export function computeMoney(profile: Profile, service: ServiceState): MoneyState {
  const starting = Math.max(0, profile.startingBalance)
  const earned = service.pay.earnedSoFar * 100
  const totalPay = service.pay.totalForService * 100
  const spent = totalSpent(profile.expenses)
  const balance = starting + earned - spent

  // The rate is measured over days that have actually passed. On day one
  // there is no history, so the rate is zero rather than infinite.
  const daysIn = Math.max(1, service.daysServed)
  const dailyBurn = service.daysServed > 0 ? Math.round(spent / daysIn) : 0
  const monthlyBurn = dailyBurn * 30

  const daysLeft = service.daysLeft
  const futureSpend = dailyBurn * daysLeft
  const upcomingPay = totalPay - earned
  const projected = balance + upcomingPay - futureSpend

  // How much a day is affordable without running out.
  const dailyAllowance = daysLeft > 0
    ? Math.max(0, Math.floor((balance + upcomingPay) / daysLeft))
    : 0

  const sums = new Map<ExpenseCategory, number>()
  for (const e of profile.expenses ?? []) {
    sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount)
  }
  const byCategory: CategoryTotal[] = [...sums.entries()]
    .map(([category, total]) => ({
      category,
      total,
      share: spent > 0 ? total / spent : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    starting, earned, totalPay, upcomingPay, spent, balance,
    dailyBurn, monthlyBurn, projected,
    willRunOut: projected < 0,
    dailyAllowance,
    byCategory,
    count: (profile.expenses ?? []).length,
    recurringMonthly: (profile.recurring ?? []).reduce((s, r) => s + r.amount, 0),
    budget: computeBudget(profile, service.now),
  }
}

/* ── Recurring charges ───────────────────────────────────────────────────── */

/**
 * A recurring charge is not an expense in itself — it becomes one. For every
 * month that has passed since it started, an ordinary `Expense` is produced.
 *
 * The id is deterministic (`rec-<id>-<YYYY-MM>`), so whether this runs ten
 * times or on two devices, the charge is written exactly once.
 */
export function dueRecurring(profile: Profile, now: Date = today()): Expense[] {
  if ((profile.recurring ?? []).length === 0) return []
  const have = new Set((profile.expenses ?? []).map((e) => e.id))
  const iso = toISO(now)
  const out: Expense[] = []

  for (const r of profile.recurring) {
    const start = parseISO(r.since)
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12)
    // Capped at five years of repeats, which guards against a `since` with the wrong year.
    for (let guard = 0; guard < 60; guard++) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth()
      const date = new Date(y, m, Math.min(r.day, 28), 12)
      const dISO = toISO(date)
      if (dISO > iso) break
      if (dISO >= r.since) {
        const id = `rec-${r.id}-${y}-${String(m + 1).padStart(2, '0')}`
        if (!have.has(id)) {
          out.push({ id, amount: r.amount, category: r.category, date: dISO, note: r.note })
        }
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }
  return out
}

export function newRecurring(
  amount: number, category: ExpenseCategory, day: number, note?: string,
  since: string = toISO(today()),
): Recurring {
  return {
    id: newId('rc'),
    amount,
    category,
    day: Math.min(28, Math.max(1, Math.round(day))),
    note: note?.trim() || undefined,
    since,
  }
}

/** The expenses a recurring charge produced, so they can go with it. */
export function isFromRecurring(expense: Expense, recurringId: string): boolean {
  return expense.id.startsWith(`rec-${recurringId}-`)
}

/* ── Parsing and formatting ──────────────────────────────────────────────── */

/** "12,50" or "12.5" becomes 1250 cents. Returns null when it is not valid. */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(',', '.').replace(/[€\s]/g, '')
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

export function formatMoney(cents: number, lang: 'el' | 'en'): string {
  return new Intl.NumberFormat(lang === 'el' ? 'el-GR' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function newExpense(
  amount: number,
  category: ExpenseCategory,
  note?: string,
  date: string = toISO(today()),
): Expense {
  return {
    id: newId(),
    amount,
    category,
    date,
    note: note?.trim() || undefined,
  }
}

/** Expenses, most recent first. */
export function recentFirst(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    const d = daysBetween(parseISO(a.date), parseISO(b.date))
    return d !== 0 ? d : b.id.localeCompare(a.id)
  })
}
