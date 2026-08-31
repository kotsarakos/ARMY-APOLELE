import { computeService, milestones } from '../src/lib/service'
import { parseISO, formatShort, formatDate } from '../src/lib/dates'
import { tierFor } from '../src/lib/ranks'
import { DICT, LANGS } from '../src/lib/i18n'
import { upperGreek } from '../src/lib/greek'
import { computeMoney, parseAmount, formatMoney, totalSpent, newExpense } from '../src/lib/money'
import type { Expense } from '../src/lib/types'
import { ALL_ESSO, essoLabel } from '../src/lib/esso'
import type { Profile } from '../src/lib/types'

import { DEFAULT_PROFILE } from '../src/lib/types'

const p: Profile = { ...DEFAULT_PROFILE, name: 'Κ', enlistDate: '2026-02-24', months: 12 }

let fails = 0
const clip = (v: unknown) => {
  const s = String(v)
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = String(got) === String(want)
  if (!ok) fails++
  // Σε επιτυχία τυπώνουμε συνοπτικά· σε αποτυχία ολόκληρες τις τιμές.
  console.log(ok
    ? `ok   ${label}: ${clip(got)}`
    : `FAIL ${label}:\n  got=${got}\n  want=${want}`)
}

// Day 0 — κατάταξη
const s0 = computeService(p, parseISO('2026-02-24'))
eq('discharge date', formatShort(s0.discharge), '24/02/2027')
eq('totalDays (12mo)', s0.totalDays, 365)
eq('daysLeft at enlist', s0.daysLeft, 365)
eq('daysServed at enlist', s0.daysServed, 0)
eq('leave earned day0', s0.leave.earned, 0)
eq('leave total entitlement', s0.leave.totalEntitlement, 18)
eq('tier day0', tierFor(s0).key, 'psaraki')
eq('pay total', s0.pay.totalForService, 600)

// Πριν την κατάταξη
const sPre = computeService(p, parseISO('2026-02-14'))
eq('daysUntilEnlist', sPre.daysUntilEnlist, 10)
eq('hasEnlisted false', sPre.hasEnlisted, false)
eq('tier pre', tierFor(sPre).key, 'pre')

// Μετά από 2 μήνες ακριβώς → πρώτο δίμηνο = 3 μέρες άδεια
const s2 = computeService(p, parseISO('2026-04-24'))
eq('monthsServed @2mo', s2.monthsServed, 2)
eq('leave earned @2mo', s2.leave.earned, 3)
eq('next accrual @2mo (to month 4)', s2.leave.daysToNextAccrual, 61)

// Μία μέρα πριν το δίμηνο → ακόμη 0
const s2m = computeService(p, parseISO('2026-04-23'))
eq('monthsServed @2mo-1d', s2m.monthsServed, 1)
eq('leave earned @2mo-1d', s2m.leave.earned, 0)

// Μισή θητεία
const sHalf = computeService(p, parseISO('2026-08-25'))
eq('monthsServed @6mo', sHalf.monthsServed, 6)
eq('leave earned @6mo', sHalf.leave.earned, 9)
eq('progress ~50%', Math.round(sHalf.progress * 100), 50)

// Τέλος
const sEnd = computeService(p, parseISO('2027-02-24'))
eq('isDischarged', sEnd.isDischarged, true)
eq('daysLeft at end', sEnd.daysLeft, 0)
eq('monthsServed capped', sEnd.monthsServed, 12)
eq('tier end', tierFor(sEnd).key, 'done')

// Μετά την απόλυση δεν ξεφεύγει
const sAfter = computeService(p, parseISO('2027-06-01'))
eq('daysServed clamped', sAfter.daysServed, 365)
eq('progress clamped', sAfter.progress, 1)

// 9μηνη παραμεθόριος
const p9: Profile = { ...p, months: 9, borderUnit: true }
const s9 = computeService(p9, parseISO('2026-08-24'))
eq('9mo discharge', formatShort(computeService(p9, parseISO('2026-02-24')).discharge), '24/11/2026')
eq('9mo entitlement', s9.leave.totalEntitlement, 12)
eq('border pay/mo', s9.pay.perMonth, 100)
eq('border honorary @6mo', s9.leave.bonusHonorary, 12)

// daysInCamp < daysLeft όταν υπάρχουν αχρησιμοποίητες άδειες
eq('daysInCamp < daysLeft', s0.daysInCamp < s0.daysLeft, true)
eq('daysInCamp day0', s0.daysInCamp, 365 - 18)

// Λελές: τελευταίες 60 μέρες
const sLeles = computeService(p, parseISO('2027-01-15'))
eq('tier leles', tierFor(sLeles).key, 'leles')

// addMonths end-of-month clamp: 31 Ιαν + 1 μήνα
const pJan: Profile = { ...p, enlistDate: '2026-01-31', months: 1 as never }
eq('31 Jan +1mo = 28 Feb', formatShort(computeService(pJan, parseISO('2026-01-31')).discharge), '28/02/2026')

// Ορόσημα σε σωστή σειρά και όλα εντός θητείας
const m = milestones(s0)
const sorted = m.every((x, i) => i === 0 || m[i-1].date.getTime() <= x.date.getTime())
eq('milestones sorted', sorted, true)
eq('milestones count', m.length, 8)
eq('all within service', m.every(x => x.date <= s0.discharge), true)


/* ── i18n ─────────────────────────────────────────────────────────────── */

// Κάθε κλειδί πρέπει να υπάρχει και στις δύο γλώσσες, με ίδιο σχήμα.
function shape(o: unknown, path = ''): string[] {
  if (typeof o === 'function') return [path + ':fn']
  if (Array.isArray(o)) return [path + ':arr' + o.length]
  if (o && typeof o === 'object') {
    return Object.keys(o).sort().flatMap((k) =>
      shape((o as Record<string, unknown>)[k], path + '.' + k))
  }
  return [path + ':' + typeof o]
}
const shapeEl = shape(DICT.el).join('|')
const shapeEn = shape(DICT.en).join('|')
eq('el/en dictionaries same shape', shapeEn, shapeEl)

// Καμία μετάφραση δεν λείπει (κενό string).
function emptyStrings(o: unknown, path = ''): string[] {
  if (typeof o === 'string') return o.trim() === '' ? [path] : []
  if (Array.isArray(o)) return o.flatMap((v, i) => emptyStrings(v, path + '[' + i + ']'))
  if (o && typeof o === 'object') {
    return Object.entries(o).flatMap(([k, v]) => emptyStrings(v, path + '.' + k))
  }
  return []
}
for (const l of LANGS) eq(`no empty strings in ${l}`, emptyStrings(DICT[l]).length, 0)

// Κάθε ορόσημο έχει ετικέτα και στις δύο γλώσσες.
for (const l of LANGS) {
  const missing = m.filter((x) => !DICT[l].milestones.items[x.key])
  eq(`all milestone keys translated (${l})`, missing.length, 0)
}

// Κάθε βαθμίδα έχει τίτλο και στις δύο γλώσσες.
const tierKeys = ['pre','psaraki','neos','mesaios','palios','leles','done'] as const
for (const l of LANGS) {
  eq(`all tier keys translated (${l})`, tierKeys.every((k) => !!DICT[l].tiers[k].title), true)
}

// Οι ημερομηνίες μεταφράζονται.
eq('date el', formatDate(parseISO('2027-02-24'), DICT.el), '24 Φεβρουαρίου 2027')
eq('date en', formatDate(parseISO('2027-02-24'), DICT.en), '24 February 2027')
eq('weekday en', formatDate(parseISO('2026-02-24'), DICT.en, true), 'Tuesday, 24 February 2026')

// Οι ετικέτες ΕΣΣΟ φτιάχνονται ανά γλώσσα.
eq('esso label el', essoLabel(ALL_ESSO[0], DICT.el), "2026 A' ΕΣΣΟ")
eq('esso label en', essoLabel(ALL_ESSO[0], DICT.en), '2026 intake A')

// Οι περιγραφές meta υπάρχουν και έχουν λογικό μήκος για SEO.
for (const l of LANGS) {
  const d = DICT[l].meta.description
  eq(`meta description length ok (${l})`, d.length >= 70 && d.length <= 200, true)
}

// Η πολιτική απορρήτου έχει περιεχόμενο και στις δύο γλώσσες.
for (const l of LANGS) {
  eq(`privacy sections (${l})`, DICT[l].privacy.sections.length, 7)
}


/* ── Ελληνικά κεφαλαία ────────────────────────────────────────────────── */
// Ο τόνος φεύγει, εκτός αν πέφτει στο αρχικό γράμμα.
eq('caps: τόνος σε μη-αρχικό φεύγει', upperGreek('Υπολογιστής'), 'ΥΠΟΛΟΓΙΣΤΗΣ')
eq('caps: τόνος σε αρχικό μένει', upperGreek('Άδειες'), 'ΆΔΕΙΕΣ')
eq('caps: μονοσύλλαβο', upperGreek('ή'), 'Ή')
eq('caps: διαλυτικά μένουν', upperGreek('αϋπνία'), 'ΑΫΠΝΙΑ')
eq('caps: λατινικά ανέπαφα', upperGreek('iPhone & iPad'), 'IPHONE & IPAD')
eq('caps: πρόταση', upperGreek('Μέρες μέχρι το απολυτήριο'), 'ΜΕΡΕΣ ΜΕΧΡΙ ΤΟ ΑΠΟΛΥΤΗΡΙΟ')
eq('caps: ήδη κεφαλαία καθαρίζονται', upperGreek('ΥΠΟΛΟΓΙΣΤΉΣ'), 'ΥΠΟΛΟΓΙΣΤΗΣ')

// Κανένα ελληνικό κείμενο του λεξικού δεν βγάζει τόνο σε μη-αρχική θέση.
const TONOS = /[ΆΈΉΊΌΎΏ]/
function offenders(o: unknown, path = ''): string[] {
  if (typeof o === 'string') {
    const up = upperGreek(o)
    const bad = up.split(/[^\p{L}\p{M}]+/u).filter(Boolean).some((w) => TONOS.test(w.slice(1)))
    return bad ? [path + ' → ' + up] : []
  }
  if (Array.isArray(o)) return o.flatMap((v, i) => offenders(v, `${path}[${i}]`))
  if (o && typeof o === 'object') {
    return Object.entries(o).flatMap(([k, v]) => offenders(v, path + '.' + k))
  }
  return []
}
const bad = offenders(DICT.el)
eq('caps: κανένας τόνος σε μη-αρχικό σε όλο το λεξικό', bad.length, 0)
if (bad.length) bad.slice(0, 5).forEach((b) => console.log('     ', b))


/* ── Οικονομικά ───────────────────────────────────────────────────────── */
const ex = (amount: number, category: Expense['category'], date: string): Expense =>
  ({ id: date + amount + category, amount, category, date })

eq('parseAmount 12,50 → λεπτά', parseAmount('12,50'), 1250)
eq('parseAmount 12.5 → λεπτά', parseAmount('12.5'), 1250)
eq('parseAmount με σύμβολο', parseAmount('€ 4,20'), 420)
eq('parseAmount άκυρο', parseAmount('abc'), null)
eq('parseAmount αρνητικό', parseAmount('-5'), null)
// Ο λόγος που κρατάμε λεπτά: σε δεκαδικά το 0.1+0.2 δεν κάνει 0.3.
eq('τα λεπτά δεν χάνουν ακρίβεια',
   totalSpent([ex(10,'food','2026-03-01'), ex(10,'food','2026-03-01'), ex(10,'food','2026-03-01')]), 30)

const pm: Profile = { ...p, startingBalance: 100000, expenses: [
  ex(1500, 'canteen', '2026-03-01'),
  ex(3000, 'transport', '2026-04-10'),
  ex(2000, 'food', '2026-05-05'),
  ex(1000, 'phone', '2026-06-01'),
]}
const sm = computeService(pm, parseISO('2026-08-24'))
const mm = computeMoney(pm, sm)
eq('χρήματα: ξοδεύτηκαν', mm.spent, 7500)
eq('χρήματα: αποζημίωση 6 μηνών', mm.earned, 30000)
eq('χρήματα: υπόλοιπο', mm.balance, 100000 + 30000 - 7500)
eq('χρήματα: κορυφαία κατηγορία', mm.byCategory[0].category, 'transport')
eq('χρήματα: πρόβλεψη συνεπής',
   mm.projected, mm.balance + mm.upcomingPay - mm.dailyBurn * sm.daysLeft)
eq('χρήματα: δεν μένει από λεφτά', mm.willRunOut, false)

const broke: Profile = { ...p, startingBalance: 5000,
  expenses: Array.from({ length: 40 }, (_, i) => ex(6000, 'fun', '2026-03-01')) }
const sb = computeService(broke, parseISO('2026-04-24'))
eq('χρήματα: προειδοποίηση όταν τελειώνουν', computeMoney(broke, sb).willRunOut, true)

const m0 = computeMoney({ ...p, startingBalance: 0, expenses: [] }, computeService(p, parseISO('2026-02-24')))
eq('χρήματα: ημέρα 0 δεν βγάζει άπειρο ρυθμό', m0.dailyBurn, 0)
eq('χρήματα: μηδενικό υπόλοιπο', m0.balance, 0)

eq('format el ακέραιο', formatMoney(100000, 'el').replace(/\u00a0/g, ' '), '1.000 €')
eq('format el δεκαδικό', formatMoney(1250, 'el').replace(/\u00a0/g, ' '), '12,50 €')
eq('format en', formatMoney(1250, 'en'), '€12.50')
eq('newExpense: κενή σημείωση → undefined', newExpense(500, 'canteen', '   ').note, undefined)

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)

if (fails > 0) process.exit(1)
