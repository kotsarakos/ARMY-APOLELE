import type { Profile } from './types'
import type { ServiceState } from './service'
import type { Dict } from './i18n'
import { computeDuties } from './duty'
import { leaveTimeline } from './leave'
import { addDays, daysBetween, formatShort, parseISO, toISO } from './dates'

/**
 * Notifications.
 *
 * A browser will not let a web app schedule a notification for a future time
 * without a server. So there are two mechanisms:
 *
 *  1. **Periodic Background Sync** (Chrome, installed PWA): the service worker
 *     wakes once a day and shows whatever has come due.
 *  2. **A check on open**: anything due that has not been shown appears as
 *     soon as the app is opened.
 *
 * Both read the same "plan", which the main thread writes to the Cache API —
 * the service worker cannot see localStorage.
 *
 * The text goes into the plan **already translated**, so the service worker
 * never needs the dictionary.
 */

export const PLAN_CACHE = 'army-notify-plan'
export const PLAN_URL = '/__notify-plan'
/** The service worker keeps its own set; it is cleared along with the rest. */
const SHOWN_CACHE = 'army-notify-shown'
const SHOWN_KEY = 'army_app.notify.shown.v1'
const ENABLED_KEY = 'army_app.notify.enabled.v1'
const HOUR_KEY = 'army_app.notify.hour.v1'

/**
 * The hour notifications fire at.
 *
 * The default is evening: "you are on guard tomorrow" is worth something while
 * you can still get ready, not at seven in the morning on the day itself.
 */
export const DEFAULT_NOTIFY_HOUR = 20
/** The hours on offer; finer than hourly changes nothing. */
export const NOTIFY_HOURS = [7, 8, 9, 12, 17, 19, 20, 21, 22]

/** The plan is rebuilt when the hour changes — see App. */
export const NOTIFY_HOUR_EVENT = 'army:notify-hour'

export function notifyHour(): number {
  try {
    const raw = localStorage.getItem(HOUR_KEY)
    // The `null` check has to be explicit: `Number(null)` is 0, which sails
    // through a 0-23 range check and would fire notifications at midnight for
    // anyone who never picked an hour.
    if (raw === null) return DEFAULT_NOTIFY_HOUR
    const h = Number(raw)
    return Number.isInteger(h) && h >= 0 && h <= 23 ? h : DEFAULT_NOTIFY_HOUR
  } catch {
    return DEFAULT_NOTIFY_HOUR
  }
}

export function setNotifyHour(hour: number): void {
  try { localStorage.setItem(HOUR_KEY, String(hour)) } catch { /* private browsing */ }
  // The hour lives inside the saved plan, because the service worker cannot
  // see localStorage. Without this event the plan would keep the old hour
  // until the next change to the profile.
  try { window.dispatchEvent(new Event(NOTIFY_HOUR_EVENT)) } catch { /* SSR */ }
}

export interface PlanItem {
  /** A stable id per event, so it is never shown twice. */
  id: string
  /** ISO 'YYYY-MM-DD': the day from which it applies. */
  date: string
  title: string
  body: string
}

export interface Plan {
  items: PlanItem[]
  /** Days remaining — for the badge on the icon. */
  badge: number
  /**
   * The hour at which anything due **today** is allowed to fire. It travels
   * inside the plan because the service worker cannot see localStorage.
   */
  hour: number
}

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notifyState(): NotifyState {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return 'unsupported'
  }
  return Notification.permission as NotifyState
}

/** A user preference, per device — which is why it is not in the profile. */
export function notifyEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1' } catch { return false }
}

export function setNotifyEnabled(on: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0') } catch { /* private browsing */ }
}

export async function requestNotifications(): Promise<NotifyState> {
  if (notifyState() === 'unsupported') return 'unsupported'
  const res = await Notification.requestPermission()
  return res as NotifyState
}

/* ── The plan ────────────────────────────────────────────────────────────── */

/**
 * Builds the list of events worth a notification.
 * Today or later only — there is no point firing for something already past.
 */
export function buildPlan(profile: Profile, s: ServiceState, t: Dict): Plan {
  const items: PlanItem[] = []
  const n = t.notify
  const push = (id: string, date: Date, title: string, body: string) => {
    items.push({ id, date: toISO(date), title, body })
  }

  // Discharge countdown, at the marks people actually watch for.
  for (const d of [100, 30, 7, 1]) {
    const when = addDays(s.discharge, -d)
    if (when > s.now) push(`dis-${d}`, when, n.dischargeSoon(d), n.dischargeSoonBody)
  }
  if (s.discharge > s.now) {
    push('dis-0', s.discharge, n.dischargeToday, n.dischargeTodayBody)
  }

  // Leave credited at the close of each two-month block.
  if (s.leave.daysToNextAccrual > 0) {
    const when = addDays(s.now, s.leave.daysToNextAccrual)
    push(`acc-${toISO(when)}`, when, n.accrual, n.accrualBody)
  }

  // Payday.
  if (s.pay.daysToPay > 0) {
    push(`pay-${toISO(s.pay.nextPayDate)}`, s.pay.nextPayDate, n.payday, n.paydayBody(s.pay.perMonth))
  }

  // Next leave: the evening before, and the day itself.
  const lt = leaveTimeline(profile.leaves, s.now)
  if (lt.next) {
    const start = parseISO(lt.next.from)
    const eve = addDays(start, -1)
    if (eve > s.now) push(`lv-eve-${lt.next.id}`, eve, n.leaveTomorrow, n.leaveTomorrowBody(formatShort(start)))
    push(`lv-${lt.next.id}`, start, n.leaveToday, n.leaveTodayBody)
  }

  // Next duty: the evening before, and the day itself.
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
    hour: notifyHour(),
  }
}

/** Writes the plan where the service worker can see it too. */
export async function savePlan(plan: Plan): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(PLAN_CACHE)
    await cache.put(
      PLAN_URL,
      new Response(JSON.stringify(plan), { headers: { 'Content-Type': 'application/json' } }),
    )
  } catch { /* not critical */ }
}

/* ── Showing them ────────────────────────────────────────────────────────── */

function shownIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}

function rememberShown(ids: Set<string>): void {
  // The last 200 are kept; old events never come round again.
  try { localStorage.setItem(SHOWN_KEY, JSON.stringify([...ids].slice(-200))) }
  catch { /* private browsing */ }
}

/**
 * Shows whatever is due and has not been shown. Runs when the app opens; the
 * service worker does the same when it wakes on its own.
 */
export async function flushDue(plan: Plan, now: Date): Promise<number> {
  if (notifyState() !== 'granted' || !notifyEnabled()) return 0
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 0

  const seen = shownIds()
  const iso = toISO(now)
  // `now` sits at local noon (see dates.ts), so it says nothing about the time
  // of day; the hour is read from the real clock.
  const clock = new Date().getHours()
  const hour = plan.hour ?? DEFAULT_NOTIFY_HOUR
  let count = 0

  for (const item of plan.items) {
    if (item.date > iso || seen.has(item.id)) continue
    // Anything due today waits for the chosen hour. Anything overdue shows
    // straight away — it is already late.
    if (item.date === iso && clock < hour) continue
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

/** The day count on the app icon. */
export function setBadge(days: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  try {
    if (days > 0) void nav.setAppBadge?.(days)
    else void nav.clearAppBadge?.()
  } catch { /* not supported */ }
}

/**
 * Erases every trace of notifications from the device.
 *
 * This is not housekeeping: the plan holds the user's **leave dates, duty
 * times and discharge date** as ready-to-display text. Left behind after sign
 * out, the next person to open the device would get notifications about
 * somebody else's service.
 */
export async function clearNotifications(): Promise<void> {
  try {
    localStorage.removeItem(SHOWN_KEY)
    localStorage.removeItem(ENABLED_KEY)
    localStorage.removeItem(HOUR_KEY)
  } catch { /* private browsing */ }

  if (typeof caches !== 'undefined') {
    try {
      await Promise.all([caches.delete(PLAN_CACHE), caches.delete(SHOWN_CACHE)])
    } catch { /* not critical */ }
  }

  // And any notification already sitting in the tray.
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const open = await reg?.getNotifications()
    open?.forEach((n) => n.close())
  } catch { /* not supported */ }

  setBadge(0)
}

/** Asks the browser to wake the service worker once a day. */
export async function registerDailySync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sync = (reg as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> }
    }).periodicSync
    if (!sync) return
    await sync.register('army-daily', { minInterval: 20 * 60 * 60 * 1000 })
  } catch { /* Chrome only, and only for an installed PWA */ }
}
