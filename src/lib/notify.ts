import type { Profile } from './types'
import type { ServiceState } from './service'
import type { Dict } from './i18n'
import { computeDuties } from './duty'
import { leaveTimeline } from './leave'
import { addDays, daysBetween, formatShort, parseISO, toISO } from './dates'

/**
 * Ειδοποιήσεις.
 *
 * Ο browser δεν επιτρέπει σε μια web εφαρμογή να προγραμματίσει ειδοποίηση για
 * μελλοντική ώρα χωρίς διακομιστή. Οπότε δουλεύουμε με δύο μηχανισμούς:
 *
 *  1. **Periodic Background Sync** (Chrome, εγκατεστημένη PWA): ο service
 *     worker ξυπνά μία φορά την ημέρα και δείχνει ό,τι έχει ωριμάσει.
 *  2. **Έλεγχος στο άνοιγμα**: ό,τι ωρίμασε και δεν έχει δειχτεί, εμφανίζεται
 *     μόλις ανοίξεις την εφαρμογή.
 *
 * Και τα δύο διαβάζουν το ίδιο «πρόγραμμα», που το γράφει το κύριο νήμα στο
 * Cache API — ο service worker δεν βλέπει localStorage.
 *
 * Το κείμενο μπαίνει **μεταφρασμένο** μέσα στο πρόγραμμα, ώστε ο service
 * worker να μη χρειάζεται το λεξικό.
 */

export const PLAN_CACHE = 'army-notify-plan'
export const PLAN_URL = '/__notify-plan'
const SHOWN_KEY = 'army_app.notify.shown.v1'
const ENABLED_KEY = 'army_app.notify.enabled.v1'

export interface PlanItem {
  /** Σταθερό id ανά γεγονός — δεν ξαναδείχνεται ποτέ. */
  id: string
  /** ISO 'YYYY-MM-DD': η μέρα από την οποία και μετά ισχύει. */
  date: string
  title: string
  body: string
}

export interface Plan {
  items: PlanItem[]
  /** Ημέρες που απομένουν — για το σήμα στο εικονίδιο. */
  badge: number
}

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notifyState(): NotifyState {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return 'unsupported'
  }
  return Notification.permission as NotifyState
}

/** Προτίμηση χρήστη — ανά συσκευή, γι' αυτό δεν μπαίνει στο προφίλ. */
export function notifyEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1' } catch { return false }
}

export function setNotifyEnabled(on: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0') } catch { /* ιδιωτική περιήγηση */ }
}

export async function requestNotifications(): Promise<NotifyState> {
  if (notifyState() === 'unsupported') return 'unsupported'
  const res = await Notification.requestPermission()
  return res as NotifyState
}

/* ── Το πρόγραμμα ────────────────────────────────────────────────────────── */

/**
 * Χτίζει τη λίστα των γεγονότων που αξίζουν ειδοποίηση.
 * Μόνο μελλοντικά ή σημερινά — τα περασμένα δεν έχουν νόημα να χτυπήσουν.
 */
export function buildPlan(profile: Profile, s: ServiceState, t: Dict): Plan {
  const items: PlanItem[] = []
  const n = t.notify
  const push = (id: string, date: Date, title: string, body: string) => {
    items.push({ id, date: toISO(date), title, body })
  }

  // Αντίστροφη μέτρηση απόλυσης στα ορόσημα που κοιτάει όντως κανείς.
  for (const d of [100, 30, 7, 1]) {
    const when = addDays(s.discharge, -d)
    if (when > s.now) push(`dis-${d}`, when, n.dischargeSoon(d), n.dischargeSoonBody)
  }
  if (s.discharge > s.now) {
    push('dis-0', s.discharge, n.dischargeToday, n.dischargeTodayBody)
  }

  // Πίστωση άδειας στο τέλος κάθε διμήνου.
  if (s.leave.daysToNextAccrual > 0) {
    const when = addDays(s.now, s.leave.daysToNextAccrual)
    push(`acc-${toISO(when)}`, when, n.accrual, n.accrualBody)
  }

  // Πληρωμή.
  if (s.pay.daysToPay > 0) {
    push(`pay-${toISO(s.pay.nextPayDate)}`, s.pay.nextPayDate, n.payday, n.paydayBody(s.pay.perMonth))
  }

  // Επόμενη άδεια: την προηγουμένη και την ίδια μέρα.
  const lt = leaveTimeline(profile.leaves, s.now)
  if (lt.next) {
    const start = parseISO(lt.next.from)
    const eve = addDays(start, -1)
    if (eve > s.now) push(`lv-eve-${lt.next.id}`, eve, n.leaveTomorrow, n.leaveTomorrowBody(formatShort(start)))
    push(`lv-${lt.next.id}`, start, n.leaveToday, n.leaveTodayBody)
  }

  // Επόμενη υπηρεσία: την προηγουμένη και την ίδια μέρα.
  const dt = computeDuties(profile.duties, s.monthsServed, s.now)
  if (dt.next) {
    const day = parseISO(dt.next.date)
    const label = t.duty.kinds[dt.next.kind]
    const eve = addDays(day, -1)
    if (eve > s.now) push(`dt-eve-${dt.next.id}`, eve, n.dutyTomorrow, n.dutyTomorrowBody(label, dt.next.start ?? ''))
    push(`dt-${dt.next.id}`, day, n.dutyToday, n.dutyTodayBody(label, dt.next.start ?? ''))
  }

  return {
    items: items.filter((i) => daysBetween(s.now, parseISO(i.date)) >= 0),
    badge: s.daysLeft,
  }
}

/** Γράφει το πρόγραμμα εκεί που το βλέπει και ο service worker. */
export async function savePlan(plan: Plan): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(PLAN_CACHE)
    await cache.put(
      PLAN_URL,
      new Response(JSON.stringify(plan), { headers: { 'Content-Type': 'application/json' } }),
    )
  } catch { /* δεν είναι κρίσιμο */ }
}

/* ── Εμφάνιση ────────────────────────────────────────────────────────────── */

function shownIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}

function rememberShown(ids: Set<string>): void {
  // Κρατάμε τα τελευταία 200· τα παλιά γεγονότα δεν επανέρχονται.
  try { localStorage.setItem(SHOWN_KEY, JSON.stringify([...ids].slice(-200))) }
  catch { /* ιδιωτική περιήγηση */ }
}

/**
 * Δείχνει ό,τι έχει ωριμάσει και δεν έχει ήδη δειχτεί. Τρέχει στο άνοιγμα της
 * εφαρμογής· ο service worker κάνει το ίδιο όταν ξυπνά μόνος του.
 */
export async function flushDue(plan: Plan, now: Date): Promise<number> {
  if (notifyState() !== 'granted' || !notifyEnabled()) return 0
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 0

  const seen = shownIds()
  const iso = toISO(now)
  let count = 0

  for (const item of plan.items) {
    if (item.date > iso || seen.has(item.id)) continue
    await reg.showNotification(item.title, {
      body: item.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: item.id,
      data: { url: '/' },
    })
    seen.add(item.id)
    count++
  }

  if (count > 0) rememberShown(seen)
  return count
}

/** Ο αριθμός των ημερών πάνω στο εικονίδιο της εφαρμογής. */
export function setBadge(days: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  try {
    if (days > 0) void nav.setAppBadge?.(days)
    else void nav.clearAppBadge?.()
  } catch { /* δεν υποστηρίζεται */ }
}

/** Ζητά από τον browser να ξυπνά τον service worker μία φορά την ημέρα. */
export async function registerDailySync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sync = (reg as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> }
    }).periodicSync
    if (!sync) return
    await sync.register('army-daily', { minInterval: 20 * 60 * 60 * 1000 })
  } catch { /* Chrome μόνο, και μόνο σε εγκατεστημένη PWA */ }
}
