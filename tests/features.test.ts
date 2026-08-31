/**
 * Tests για τα καινούργια κομμάτια: άδειες με ημερομηνίες, υπηρεσίες,
 * πάγια έξοδα, συγχώνευση δύο συσκευών, αντίγραφο ασφαλείας, ειδοποιήσεις.
 */
import { computeService } from '../src/lib/service'
import { parseISO, toISO } from '../src/lib/dates'
import {
  leaveDays, leaveTimeline, migrateLegacyLeave, newLeave, regularDaysTaken,
  sortLeaves, splitRegularDays, totalLeaveDays, validateLeave,
} from '../src/lib/leave'
import { computeDuties, newDuty } from '../src/lib/duty'
import {
  computeMoney, dueRecurring, isFromRecurring, newExpense, newRecurring,
} from '../src/lib/money'
import { mergeProfiles, withDeletion, withDeletions } from '../src/lib/merge'
import { exportBackup, parseBackup } from '../src/lib/backup'
import { buildPlan } from '../src/lib/notify'
import { clampToRange, mondayIndex, monthGrid, safeParse, weekHeader } from '../src/lib/calendar'
import { DICT } from '../src/lib/i18n'
import { DEFAULT_PROFILE } from '../src/lib/types'
import type { Profile } from '../src/lib/types'

let fails = 0
const clip = (v: unknown) => {
  const s = String(v)
  return s.length > 70 ? s.slice(0, 67) + '…' : s
}
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = String(got) === String(want)
  if (!ok) fails++
  console.log(ok ? `ok   ${label}: ${clip(got)}` : `FAIL ${label}:\n  got=${got}\n  want=${want}`)
}

const base: Profile = {
  ...DEFAULT_PROFILE,
  name: 'Κ', enlistDate: '2026-02-24', months: 12,
}
const NOW = parseISO('2026-08-31')

/* ── Άδειες ───────────────────────────────────────────────────────────── */

eq('άδεια: μία μέρα μετράει 1', leaveDays(newLeave('regular', '2026-05-03', '2026-05-03')), 1)
eq('άδεια: 3/5–5/5 μετράει 3 (περιληπτικά)',
  leaveDays(newLeave('regular', '2026-05-03', '2026-05-05')), 3)
eq('άδεια: ανάποδο διάστημα δίνει 0',
  leaveDays(newLeave('regular', '2026-05-05', '2026-05-03')), 0)

const leaves = [
  newLeave('regular', '2026-04-01', '2026-04-05'),   // 5
  newLeave('blood', '2026-06-10', '2026-06-12'),     // 3, τιμητική
  newLeave('regular', '2026-09-10', '2026-09-14'),   // 5, μελλοντική
]
eq('άδειες: σύνολο όλων', totalLeaveDays(leaves), 13)
eq('άδειες: μόνο κανονική κόβει το δικαίωμα', regularDaysTaken(leaves), 10)

const tl = leaveTimeline(leaves, NOW)
eq('χρονογραμμή: δεν είμαι σε άδεια τώρα', tl.current, null)
eq('χρονογραμμή: επόμενη άδεια', tl.next?.from, '2026-09-10')
eq('χρονογραμμή: μέρες μέχρι την επόμενη', tl.daysToNext, 10)
eq('χρονογραμμή: περασμένες', tl.past.length, 2)

const onLeave = leaveTimeline([newLeave('regular', '2026-08-29', '2026-09-02')], NOW)
eq('χρονογραμμή: τρέχουσα άδεια εντοπίζεται', onLeave.current?.from, '2026-08-29')
eq('χρονογραμμή: μέρες που απομένουν μαζί με σήμερα', onLeave.daysLeftOfCurrent, 3)

eq('έλεγχος: ανάποδες ημερομηνίες',
  validateLeave(newLeave('regular', '2026-05-05', '2026-05-01'), []), 'range')
eq('έλεγχος: επικάλυψη',
  validateLeave(newLeave('regular', '2026-04-03', '2026-04-08'), leaves), 'overlap')
eq('έλεγχος: επικάλυψη ακριβώς στο άκρο',
  validateLeave(newLeave('regular', '2026-04-05', '2026-04-09'), leaves), 'overlap')
eq('έλεγχος: κολλητά αλλά χωρίς επικάλυψη περνάει',
  validateLeave(newLeave('regular', '2026-04-06', '2026-04-09'), leaves), null)
eq('έλεγχος: παράλογο διάστημα',
  validateLeave(newLeave('regular', '2026-01-01', '2026-12-31'), []), 'tooLong')

eq('ταξινόμηση: πιο πρόσφατη πρώτη', sortLeaves(leaves)[0].from, '2026-09-10')

// Μεταφορά από τον παλιό μετρητή.
const legacy = migrateLegacyLeave({ ...base, leaveTaken: 4 }, 'παλιά', NOW)
eq('μεταφορά: φτιάχνει μία εγγραφή', legacy.leaves.length, 1)
eq('μεταφορά: κρατά τις ίδιες μέρες', leaveDays(legacy.leaves[0]), 4)
eq('μεταφορά: τελειώνει χθες', legacy.leaves[0].to, '2026-08-30')
eq('μεταφορά: μηδενίζει το παλιό πεδίο', legacy.leaveTaken, 0)
eq('μεταφορά: δεν ξανατρέχει', migrateLegacyLeave(legacy, 'παλιά', NOW).leaves.length, 1)
eq('μεταφορά: δεν κάνει τίποτε στο μηδέν',
  migrateLegacyLeave(base, 'παλιά', NOW) === base, true)

// Παρελθόν και μέλλον χωριστά: μια κλεισμένη άδεια δεν είναι «παρμένη».
const split = splitRegularDays(leaves, NOW)
eq('χωρισμός: μέρες που πέρασαν', split.past, 5)
eq('χωρισμός: μέρες κλεισμένες', split.future, 5)

// Άδεια σε εξέλιξη μοιράζεται στη σημερινή μέρα.
const straddle = splitRegularDays([newLeave('regular', '2026-08-29', '2026-09-02')], NOW)
eq('χωρισμός: τρέχουσα άδεια, μέρες που πέρασαν', straddle.past, 3)
eq('χωρισμός: τρέχουσα άδεια, μέρες που μένουν', straddle.future, 2)
eq('χωρισμός: το σύνολο διατηρείται', straddle.past + straddle.future, 5)
eq('χωρισμός: οι τιμητικές δεν μπαίνουν',
  splitRegularDays([newLeave('blood', '2026-04-01', '2026-04-03')], NOW).past, 0)

// Σύνδεση με τον υπολογισμό θητείας.
const sLeave = computeService({ ...base, leaves }, NOW)
eq('θητεία: taken μόνο ό,τι πέρασε', sLeave.leave.taken, 5)
eq('θητεία: planned ό,τι είναι κλεισμένο', sLeave.leave.planned, 5)
eq('θητεία: committed το άθροισμα', sLeave.leave.committed, 10)
eq('θητεία: τιμητικές χωριστά', sLeave.leave.otherTaken, 3)
// Το ζητούμενο: οι κλεισμένες μέρες δεσμεύουν κι αυτές το υπόλοιπο.
eq('θητεία: διαθέσιμες μετά τις κλεισμένες',
  sLeave.leave.available, Math.max(0, sLeave.leave.earned - 10))

/* ── Πληρωμή ──────────────────────────────────────────────────────────── */

const sPay = computeService(base, NOW)
eq('πληρωμή: επόμενη στην επέτειο κατάταξης', toISO(sPay.pay.nextPayDate), '2026-09-24')
eq('πληρωμή: μέρες μέχρι', sPay.pay.daysToPay, 24)

/* ── Υπηρεσίες ────────────────────────────────────────────────────────── */

const duties = [
  newDuty('guard', '2026-08-20', 2, '02:00'),
  newDuty('guard', '2026-08-25', 2, '22:00'),
  newDuty('kitchen', '2026-09-02', 6),
  newDuty('guard', '2026-08-31', 2, '06:00'),
]
const d = computeDuties(duties, 6, NOW)
eq('υπηρεσίες: επόμενη είναι η σημερινή', d.next?.date, '2026-08-31')
eq('υπηρεσίες: μέρες μέχρι την επόμενη', d.daysToNext, 0)
eq('υπηρεσίες: σύνολο', d.total, 4)
eq('υπηρεσίες: ώρες', d.totalHours, 12)
eq('υπηρεσίες: έγιναν (η σημερινή δεν μετράει περασμένη)', d.done, 2)
eq('υπηρεσίες: ανά μήνα', d.perMonth, 0.7)
eq('υπηρεσίες: πιο συχνό είδος πρώτο', d.byKind[0].kind, 'guard')
eq('υπηρεσίες: πλήθος ανά είδος', d.byKind[0].count, 3)
eq('υπηρεσίες: χωρίς μήνες δεν διαιρούμε με μηδέν', computeDuties(duties, 0, NOW).perMonth, 0)
eq('υπηρεσίες: κενή λίστα δεν έχει επόμενη', computeDuties([], 6, NOW).next, null)
eq('υπηρεσίες: οι επόμενες σε αύξουσα σειρά',
  d.upcoming.map((x) => x.date).join(','), '2026-08-31,2026-09-02')
eq('υπηρεσίες: οι περασμένες με την πιο πρόσφατη πρώτη',
  d.past.map((x) => x.date).join(','), '2026-08-25,2026-08-20')

/* ── Πάγια έξοδα ──────────────────────────────────────────────────────── */

const rec = newRecurring(1500, 'phone', 5, 'κινητό', '2026-06-01')
const withRec: Profile = { ...base, recurring: [rec] }
const due = dueRecurring(withRec, NOW)
eq('πάγια: χρεώσεις Ιουν/Ιουλ/Αυγ', due.length, 3)
eq('πάγια: πρώτη χρέωση στη σωστή μέρα', due[0].date, '2026-06-05')
eq('πάγια: ποσό σε λεπτά', due[0].amount, 1500)

// Το σημαντικό: τρέξε το ξανά με τις χρεώσεις ήδη μέσα — δεν διπλογράφει.
const afterFirst: Profile = { ...withRec, expenses: due }
eq('πάγια: δεύτερη εκτέλεση δεν διπλογράφει', dueRecurring(afterFirst, NOW).length, 0)
eq('πάγια: το id δείχνει την προέλευση', isFromRecurring(due[0], rec.id), true)
eq('πάγια: άσχετο έξοδο δεν ταιριάζει',
  isFromRecurring(newExpense(100, 'canteen'), rec.id), false)
eq('πάγια: μέρα πάνω από 28 συγκρατείται', newRecurring(100, 'phone', 31).day, 28)
eq('πάγια: μέρα κάτω από 1 συγκρατείται', newRecurring(100, 'phone', 0).day, 1)
eq('πάγια: χωρίς πάγια δεν παράγεται τίποτε', dueRecurring(base, NOW).length, 0)

const mRec = computeMoney(afterFirst, computeService(afterFirst, NOW))
eq('πάγια: μηνιαίο σύνολο', mRec.recurringMonthly, 1500)
eq('πάγια: μπαίνουν στα ξοδεμένα', mRec.spent, 4500)

/* ── Ημερομηνία στο έξοδο ─────────────────────────────────────────────── */

eq('έξοδο: κρατά την ημερομηνία που δόθηκε',
  newExpense(450, 'canteen', 'καφές', '2026-07-04').date, '2026-07-04')
eq('έξοδο: χωρίς ημερομηνία παίρνει σήμερα',
  newExpense(450, 'canteen').date, toISO(new Date()))

/* ── Συγχώνευση δύο συσκευών ──────────────────────────────────────────── */

const e1 = { ...newExpense(1000, 'canteen', 'κινητό'), id: 'e1' }
const e2 = { ...newExpense(2000, 'food', 'σουβλάκι'), id: 'e2' }

const phone: Profile = { ...base, expenses: [e1], updatedAt: 100 }
const laptop: Profile = { ...base, expenses: [e2], updatedAt: 200, name: 'Νέο' }

const merged = mergeProfiles(phone, laptop)
eq('συγχώνευση: κρατιούνται και τα δύο έξοδα', merged.expenses.length, 2)
eq('συγχώνευση: βαθμωτά από την πιο πρόσφατη', merged.name, 'Νέο')
eq('συγχώνευση: updatedAt το μεγαλύτερο', merged.updatedAt, 200)
eq('συγχώνευση: αντιμεταθετική',
  mergeProfiles(laptop, phone).expenses.length, 2)

// Χωρίς ταφόπλακες η διαγραφή θα ακυρωνόταν από την άλλη συσκευή.
const afterDelete: Profile = {
  ...phone,
  ...withDeletion({ ...phone, expenses: [e1, e2] }, 'e2'),
  updatedAt: 300,
} as Profile
const merged2 = mergeProfiles(afterDelete, { ...laptop, expenses: [e1, e2] })
eq('συγχώνευση: η διαγραφή δεν ανασταίνεται', merged2.expenses.length, 1)
eq('συγχώνευση: επέζησε το σωστό', merged2.expenses[0].id, 'e1')

const multi = withDeletions({ ...phone, expenses: [e1, e2] }, ['e1', 'e2'])
eq('πολλαπλή διαγραφή: άδειασε', multi.expenses?.length, 0)
eq('πολλαπλή διαγραφή: δύο ταφόπλακες', multi.deletedIds?.length, 2)

// Οι λίστες που δεν αγγίχτηκαν επιβιώνουν ακέραιες.
const withLists: Profile = { ...base, leaves, duties, updatedAt: 10 }
const merged3 = mergeProfiles(withLists, { ...base, updatedAt: 20 })
eq('συγχώνευση: άδειες επιβιώνουν', merged3.leaves.length, 3)
eq('συγχώνευση: υπηρεσίες επιβιώνουν', merged3.duties.length, 4)

/* ── Αντίγραφο ασφαλείας ──────────────────────────────────────────────── */

const full: Profile = { ...base, leaves, duties, expenses: [e1, e2], startingBalance: 100000 }
const roundTripText = JSON.stringify({
  format: 'army-apolele/backup', version: 1, exportedAt: '', profile: full,
})
const back = parseBackup(roundTripText)
eq('backup: διαβάζεται', back.error, null)
eq('backup: ίδιες άδειες', back.profile?.leaves.length, 3)
eq('backup: ίδια έξοδα', back.profile?.expenses.length, 2)
eq('backup: ίδιο αρχικό υπόλοιπο', back.profile?.startingBalance, 100000)
eq('backup: σκουπίδια απορρίπτονται', parseBackup('{{{').error, 'parse')
eq('backup: άλλο JSON απορρίπτεται', parseBackup('{"a":1}').error, 'format')
eq('backup: χωρίς κατάταξη απορρίπτεται',
  parseBackup(JSON.stringify({
    format: 'army-apolele/backup', version: 1, profile: { ...base, enlistDate: '' },
  })).error, 'empty')
eq('backup: το blob είναι JSON', exportBackup(full).type, 'application/json')

/* ── Πρόγραμμα ειδοποιήσεων ───────────────────────────────────────────── */

const planProfile: Profile = {
  ...base,
  leaves: [newLeave('regular', '2026-09-10', '2026-09-14')],
  duties: [newDuty('guard', '2026-09-01', 2, '02:00')],
}
const plan = buildPlan(planProfile, computeService(planProfile, NOW), DICT.el)
const ids = plan.items.map((i) => i.id)
eq('ειδοποιήσεις: badge = μέρες που μένουν', plan.badge, 177)
eq('ειδοποιήσεις: υπάρχει η επόμενη άδεια', ids.includes('lv-' + planProfile.leaves[0].id), true)
eq('ειδοποιήσεις: υπάρχει η παραμονή της άδειας',
  ids.includes('lv-eve-' + planProfile.leaves[0].id), true)
eq('ειδοποιήσεις: υπάρχει η πληρωμή', ids.includes('pay-2026-09-24'), true)
eq('ειδοποιήσεις: υπάρχει η απόλυση', ids.includes('dis-0'), true)
eq('ειδοποιήσεις: καμία στο παρελθόν',
  plan.items.every((i) => i.date >= '2026-08-31'), true)
eq('ειδοποιήσεις: όλα έχουν κείμενο',
  plan.items.every((i) => i.title.length > 0 && i.body.length > 0), true)

// Οι δύο γλώσσες πρέπει να βγάζουν το ίδιο πλήθος γεγονότων.
const planEn = buildPlan(planProfile, computeService(planProfile, NOW), DICT.en)
eq('ειδοποιήσεις: ίδια γεγονότα και στα αγγλικά', planEn.items.length, plan.items.length)

/* ── Ημερολόγιο ───────────────────────────────────────────────────────── */

// Η εβδομάδα ξεκινά Δευτέρα, ενώ το getDay() μετράει από Κυριακή.
eq('ημερολόγιο: Δευτέρα είναι 0', mondayIndex(parseISO('2026-08-31')), 0)
eq('ημερολόγιο: Κυριακή είναι 6', mondayIndex(parseISO('2026-08-30')), 6)
eq('ημερολόγιο: κεφαλίδα ξεκινά Δευτέρα',
  weekHeader(['ΚΥ', 'ΔΕ', 'ΤΡ', 'ΤΕ', 'ΠΕ', 'ΠΑ', 'ΣΑ']).join(''), 'ΔΕΤΡΤΕΠΕΠΑΣΑΚΥ')

const grid = monthGrid(2026, 7)   // Αύγουστος 2026
eq('ημερολόγιο: πάντα 42 κελιά', grid.length, 42)
eq('ημερολόγιο: ξεκινά Δευτέρα', mondayIndex(grid[0].date), 0)
eq('ημερολόγιο: πρώτο κελί είναι γέμισμα', grid[0].iso, '2026-07-27')
eq('ημερολόγιο: η 1η Αυγούστου στη σωστή θέση', grid[5].iso, '2026-08-01')
eq('ημερολόγιο: μέρες του μήνα', grid.filter((c) => c.inMonth).length, 31)
eq('ημερολόγιο: τελευταίο κελί είναι γέμισμα', grid[41].inMonth, false)

// Φεβρουάριος που ξεκινά Κυριακή — η χειρότερη περίπτωση για τη μετατόπιση.
const feb = monthGrid(2026, 1)
eq('ημερολόγιο: Φεβρουάριος 2026 ξεκινά Κυριακή', feb[6].iso, '2026-02-01')
eq('ημερολόγιο: 28 μέρες', feb.filter((c) => c.inMonth).length, 28)
eq('ημερολόγιο: κάθε μήνας χωράει σε 6 εβδομάδες',
  [0,1,2,3,4,5,6,7,8,9,10,11].every((m) =>
    monthGrid(2026, m).filter((c) => c.inMonth).length ===
    new Date(2026, m + 1, 0).getDate()), true)

eq('ημερολόγιο: όρια — πριν το min', clampToRange('2026-05-01', '2026-05-03'), false)
eq('ημερολόγιο: όρια — ακριβώς στο min', clampToRange('2026-05-03', '2026-05-03'), true)
eq('ημερολόγιο: όρια — μετά το max', clampToRange('2026-05-09', undefined, '2026-05-05'), false)
eq('ημερολόγιο: χωρίς όρια όλα περνούν', clampToRange('2026-05-09'), true)

eq('ημερολόγιο: σκουπίδια δεν γίνονται ημερομηνία', safeParse('όχι'), null)
eq('ημερολόγιο: κενό δεν γίνεται ημερομηνία', safeParse(''), null)
eq('ημερολόγιο: έγκυρο ISO διαβάζεται', toISO(safeParse('2026-05-03')!), '2026-05-03')

// Και στις δύο γλώσσες χρειάζονται και οι δύο μορφές μήνα.
for (const l of ['el', 'en'] as const) {
  eq(`ημερολόγιο: 12 μήνες ονομαστικής (${l})`, DICT[l].monthsAlone.length, 12)
  eq(`ημερολόγιο: 7 συντομογραφίες ημερών (${l})`, DICT[l].weekdaysShort.length, 7)
}
eq('ημερολόγιο: η ονομαστική διαφέρει από τη γενική στα ελληνικά',
  DICT.el.monthsAlone[7] !== DICT.el.months[7], true)

console.log(fails === 0 ? '\nΌλα πέρασαν.' : `\n${fails} απέτυχαν.`)
process.exit(fails === 0 ? 0 : 1)
