import type { DutyKind, LeaveKind, Profile } from './types'
import type { ServiceState, MilestoneKey } from './service'
import { milestones } from './service'
import { monthGrid } from './calendar'
import { addDays, addMonths, parseISO, toISO } from './dates'

/**
 * One month, with everything on it.
 *
 * Leave, duties and pay lived in three separate tabs, while a conscript thinks
 * of them as one month: "what have I got in October". Here they all land on
 * the same grid of days.
 *
 * Like the other domain modules, this returns **keys** and no translated text.
 * The component supplies the labels.
 */

export type AgendaKind = 'leave' | 'duty' | 'pay' | 'accrual' | 'milestone' | 'spend'

export interface AgendaEvent {
  kind: AgendaKind
  /** Id of the record behind it — for leave and duties. */
  id?: string
  /** The kind within the category: LeaveKind, DutyKind or MilestoneKey. */
  ref?: LeaveKind | DutyKind | MilestoneKey
  /**
   * The size of the event in its own unit: cents for `spend`, euro for `pay`,
   * days for `accrual`, hours for `duty`.
   */
  amount?: number
  /** 'HH:MM' — only for duties that have a start time. */
  at?: string
  /** For multi-day leave: is this the first day of the span? */
  first?: boolean
}

export interface AgendaDay {
  iso: string
  date: Date
  /** Belongs to the month on show, or is padding from a neighbouring one? */
  inMonth: boolean
  today: boolean
  /** Inside the term — days outside it are shown struck through. */
  inService: boolean
  events: AgendaEvent[]
}

/** Payday dates within a range — the monthly anniversary of enlistment. */
function payDatesWithin(s: ServiceState, months: number, from: string, to: string): string[] {
  const out: string[] = []
  for (let m = 1; m <= months; m++) {
    const iso = toISO(addMonths(s.enlist, m))
    if (iso >= from && iso <= to) out.push(iso)
  }
  return out
}

/** Leave credits — at the close of each completed two-month block. */
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

  // Leave: every day of the span gets its own marker, so the grid shows the
  // duration and not just where it starts.
  for (const l of profile.leaves ?? []) {
    let day = parseISO(l.from)
    // The guard protects against an entry with the wrong year in `to`, which
    // would otherwise spin this loop for years.
    for (let guard = 0; toISO(day) <= l.to && guard < 400; guard++) {
      const iso = toISO(day)
      push(iso, { kind: 'leave', id: l.id, ref: l.kind, first: iso === l.from })
      day = addDays(day, 1)
    }
  }

  for (const d of profile.duties ?? []) {
    push(d.date, { kind: 'duty', id: d.id, ref: d.kind, amount: d.hours, at: d.start })
  }

  // Spending is summed per day: twenty entries in a 44px cell say nothing,
  // the total says something.
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

/** The order in which a cell's markers are read. */
const ORDER: AgendaKind[] = ['leave', 'duty', 'milestone', 'pay', 'accrual', 'spend']

export function sortEvents(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}

/**
 * The kinds visible on the grid, so the legend never lists something absent.
 *
 * **Every** cell counts, padding from neighbouring months included: their dots
 * are on screen, so a legend that ignored them left colours unexplained.
 */
export function kindsPresent(days: AgendaDay[]): AgendaKind[] {
  const seen = new Set<AgendaKind>()
  for (const d of days) for (const e of d.events) seen.add(e.kind)
  return ORDER.filter((k) => seen.has(k))
}
