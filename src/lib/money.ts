import type { Expense, ExpenseCategory, Profile, Recurring } from './types'
import type { ServiceState } from './service'
import { daysBetween, parseISO, toISO, today } from './dates'
import { newId } from './id'

/**
 * Οικονομικά της θητείας.
 *
 * Όλα τα ποσά κρατούνται σε **λεπτά** ως ακέραιοι. Με δεκαδικά, το
 * 0.1 + 0.2 δεν κάνει 0.3 σε JavaScript, και μετά από μερικές δεκάδες
 * καταχωρήσεις το υπόλοιπο θα ήταν αισθητά λάθος.
 */

export const CATEGORIES: ExpenseCategory[] = [
  'canteen', 'transport', 'food', 'phone', 'gear', 'fun', 'other',
]

export interface CategoryTotal {
  category: ExpenseCategory
  total: number
  /** 0..1 του συνολικού εξόδου. */
  share: number
}

export interface MoneyState {
  /** Αρχικά χρήματα εκτός στρατού. */
  starting: number
  /** Αποζημίωση που έχει ήδη δικαιωθεί. */
  earned: number
  /** Συνολική αποζημίωση για όλη τη θητεία. */
  totalPay: number
  /** Αποζημίωση που δεν έχει έρθει ακόμη. */
  upcomingPay: number
  spent: number
  /** starting + earned − spent */
  balance: number
  /** Μέσο ημερήσιο έξοδο μέχρι σήμερα. */
  dailyBurn: number
  /** Μέσο μηνιαίο έξοδο. */
  monthlyBurn: number
  /** Πρόβλεψη υπολοίπου την ημέρα της απόλυσης, με τον τρέχοντα ρυθμό. */
  projected: number
  /** true αν η πρόβλεψη βγάζει το υπόλοιπο κάτω από το μηδέν. */
  willRunOut: boolean
  /**
   * Πόσα μπορεί να ξοδεύει την ημέρα ώστε να φτάσει στο απολυτήριο με μηδέν.
   * Είναι το «όριο», όχι πρόταση.
   */
  dailyAllowance: number
  byCategory: CategoryTotal[]
  count: number
  /** Άθροισμα των πάγιων ανά μήνα. */
  recurringMonthly: number
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

  // Ο ρυθμός μετριέται πάνω στις μέρες που έχουν πραγματικά περάσει· την
  // πρώτη μέρα δεν υπάρχει ιστορικό, οπότε ο ρυθμός είναι μηδέν αντί άπειρο.
  const daysIn = Math.max(1, service.daysServed)
  const dailyBurn = service.daysServed > 0 ? Math.round(spent / daysIn) : 0
  const monthlyBurn = dailyBurn * 30

  const daysLeft = service.daysLeft
  const futureSpend = dailyBurn * daysLeft
  const upcomingPay = totalPay - earned
  const projected = balance + upcomingPay - futureSpend

  // Πόσα αντέχει την ημέρα ώστε να μη μείνει από λεφτά.
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
  }
}

/* ── Πάγια έξοδα ─────────────────────────────────────────────────────────── */

/**
 * Τα πάγια δεν είναι έξοδα από μόνα τους — γίνονται. Για κάθε μήνα που έχει
 * περάσει από την έναρξή τους παράγουμε ένα κανονικό `Expense`.
 *
 * Το id είναι ντετερμινιστικό (`rec-<id>-<YYYY-MM>`), οπότε αν η συνάρτηση
 * τρέξει δέκα φορές — ή σε δύο συσκευές — η χρέωση γράφεται μία μόνο φορά.
 */
export function dueRecurring(profile: Profile, now: Date = today()): Expense[] {
  if ((profile.recurring ?? []).length === 0) return []
  const have = new Set((profile.expenses ?? []).map((e) => e.id))
  const iso = toISO(now)
  const out: Expense[] = []

  for (const r of profile.recurring) {
    const start = parseISO(r.since)
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12)
    // Ανώτατο όριο επαναλήψεων: 5 χρόνια. Προστατεύει από `since` με λάθος έτος.
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

/** Τα έξοδα που παρήγαγε ένα πάγιο — για να φύγουν μαζί του. */
export function isFromRecurring(expense: Expense, recurringId: string): boolean {
  return expense.id.startsWith(`rec-${recurringId}-`)
}

/* ── Μετατροπές και μορφοποίηση ──────────────────────────────────────────── */

/** «12,50» ή «12.5» → 1250 λεπτά. Επιστρέφει null αν δεν είναι έγκυρο. */
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

/** Έξοδα ταξινομημένα από το πιο πρόσφατο. */
export function recentFirst(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    const d = daysBetween(parseISO(a.date), parseISO(b.date))
    return d !== 0 ? d : b.id.localeCompare(a.id)
  })
}
