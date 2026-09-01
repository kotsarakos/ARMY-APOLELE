import type { DutyKind, LeaveKind, Profile } from './types'
import type { ServiceState, MilestoneKey } from './service'
import { milestones } from './service'
import { monthGrid } from './calendar'
import { addDays, addMonths, parseISO, toISO } from './dates'

/**
 * Ένας μήνας, με όλα μαζί.
 *
 * Οι άδειες, οι υπηρεσίες και ο μισθός ζούσαν σε τρεις διαφορετικές καρτέλες,
 * ενώ ο φαντάρος τα σκέφτεται ως έναν μήνα: «τι έχω τον Οκτώβρη». Εδώ
 * μαζεύονται όλα πάνω στο ίδιο πλέγμα ημερών.
 *
 * Όπως και τα υπόλοιπα domain modules, επιστρέφει **κλειδιά** — καμία
 * μετάφραση. Τις ετικέτες τις βάζει το component.
 */

export type AgendaKind = 'leave' | 'duty' | 'pay' | 'accrual' | 'milestone' | 'spend'

export interface AgendaEvent {
  kind: AgendaKind
  /** id της εγγραφής που το γέννησε — για άδειες και υπηρεσίες. */
  id?: string
  /** Το είδος μέσα στην κατηγορία: LeaveKind, DutyKind ή MilestoneKey. */
  ref?: LeaveKind | DutyKind | MilestoneKey
  /**
   * Το μέγεθος του γεγονότος στη μονάδα του:
   * λεπτά για `spend`, ευρώ για `pay`, μέρες για `accrual`, ώρες για `duty`.
   */
  amount?: number
  /** 'HH:MM' — μόνο για υπηρεσίες με ώρα ανάληψης. */
  at?: string
  /** Για πολυήμερα (άδειες): είναι η πρώτη μέρα του διαστήματος; */
  first?: boolean
}

export interface AgendaDay {
  iso: string
  date: Date
  /** Ανήκει στον μήνα που δείχνουμε, ή είναι γέμισμα από τον γειτονικό; */
  inMonth: boolean
  today: boolean
  /** Εντός θητείας — οι μέρες εκτός φαίνονται σβησμένες. */
  inService: boolean
  events: AgendaEvent[]
}

/** Οι ημερομηνίες πληρωμής μέσα σε ένα διάστημα — επέτειος της κατάταξης. */
function payDatesWithin(s: ServiceState, months: number, from: string, to: string): string[] {
  const out: string[] = []
  for (let m = 1; m <= months; m++) {
    const iso = toISO(addMonths(s.enlist, m))
    if (iso >= from && iso <= to) out.push(iso)
  }
  return out
}

/** Οι πιστώσεις άδειας — στο κλείσιμο κάθε πλήρους διμήνου. */
function accrualDatesWithin(s: ServiceState, months: number, from: string, to: string): string[] {
  const out: string[] = []
  for (let k = 1; k <= Math.floor(months / 2); k++) {
    const iso = toISO(addMonths(s.enlist, k * 2))
    if (iso >= from && iso <= to) out.push(iso)
  }
  return out
}

export function monthAgenda(
  profile: Profile, s: ServiceState, year: number, month: number,
): AgendaDay[] {
  const cells = monthGrid(year, month)
  const from = cells[0].iso
  const to = cells[cells.length - 1].iso
  const todayISO = toISO(s.now)
  const enlistISO = toISO(s.enlist)
  const dischargeISO = toISO(s.discharge)

  const byDay = new Map<string, AgendaEvent[]>()
  const push = (iso: string, e: AgendaEvent) => {
    if (iso < from || iso > to) return
    const list = byDay.get(iso)
    if (list) list.push(e)
    else byDay.set(iso, [e])
  }

  // Άδειες: κάθε μέρα του διαστήματος παίρνει δικό της σημάδι, ώστε το
  // πλέγμα να δείχνει τη διάρκεια και όχι μόνο την αρχή.
  for (const l of profile.leaves ?? []) {
    let day = parseISO(l.from)
    // Το φράγμα προστατεύει από εγγραφή με λάθος έτος στο `to`, που αλλιώς θα
    // γύριζε τον βρόχο για χρόνια.
    for (let guard = 0; toISO(day) <= l.to && guard < 400; guard++) {
      const iso = toISO(day)
      push(iso, { kind: 'leave', id: l.id, ref: l.kind, first: iso === l.from })
      day = addDays(day, 1)
    }
  }

  for (const d of profile.duties ?? []) {
    push(d.date, { kind: 'duty', id: d.id, ref: d.kind, amount: d.hours, at: d.start })
  }

  // Τα έξοδα αθροίζονται ανά μέρα: είκοσι καταχωρήσεις σε ένα κελί 44px δεν
  // λένε τίποτα, το σύνολο λέει.
  const spendByDay = new Map<string, number>()
  for (const e of profile.expenses ?? []) {
    if (e.date < from || e.date > to) continue
    spendByDay.set(e.date, (spendByDay.get(e.date) ?? 0) + e.amount)
  }
  for (const [iso, amount] of spendByDay) push(iso, { kind: 'spend', amount })

  for (const iso of payDatesWithin(s, profile.months, from, to)) {
    push(iso, { kind: 'pay', amount: s.pay.perMonth })
  }
  for (const iso of accrualDatesWithin(s, profile.months, from, to)) {
    push(iso, { kind: 'accrual', amount: 3 })
  }
  for (const m of milestones(s)) {
    push(toISO(m.date), { kind: 'milestone', ref: m.key })
  }

  return cells.map((c) => ({
    iso: c.iso,
    date: c.date,
    inMonth: c.inMonth,
    today: c.iso === todayISO,
    inService: c.iso >= enlistISO && c.iso <= dischargeISO,
    events: byDay.get(c.iso) ?? [],
  }))
}

/** Η σειρά με την οποία διαβάζονται τα σημάδια ενός κελιού. */
const ORDER: AgendaKind[] = ['leave', 'duty', 'milestone', 'pay', 'accrual', 'spend']

export function sortEvents(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}

/**
 * Τα είδη που φαίνονται στο πλέγμα — για να μη δείχνουμε άχρηστο υπόμνημα.
 *
 * Μετράνε **όλα** τα κελιά, μαζί με το γέμισμα από τους γειτονικούς μήνες: οι
 * κουκκίδες τους είναι ορατές, οπότε ένα υπόμνημα που τις αγνοούσε άφηνε
 * χρώματα χωρίς εξήγηση.
 */
export function kindsPresent(days: AgendaDay[]): AgendaKind[] {
  const seen = new Set<AgendaKind>()
  for (const d of days) for (const e of d.events) seen.add(e.kind)
  return ORDER.filter((k) => seen.has(k))
}
