import type { Profile } from './types'
import type { ServiceState } from './service'
import type { Dict } from './i18n'
import { addDays, addMonths, parseISO, toISO } from './dates'
import { leaveDays } from './leave'

/**
 * Export to a calendar file (RFC 5545).
 *
 * The JSON backup can only be read by this app. An `.ics` goes into the
 * person's Google or Apple calendar, so leave and duties turn up where they
 * already look every day — and their family sees them too, if the calendar is
 * shared.
 *
 * It is a snapshot, not a subscription: an export does not update itself.
 * Subscriptions (webcal) need a server, and a server would mean the data
 * leaving the device.
 */

const CRLF = '\r\n'

/** Characters with special meaning inside an ics value. */
function escape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * The standard caps lines at 75 **octets**. In Greek a character is two octets
 * of UTF-8, so the count has to be in bytes — otherwise the break lands inside
 * a character and corrupts the file.
 */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line

  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = enc.encode(ch).length
    // Continuation lines begin with a space, which counts towards the limit.
    const limit = out.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join(`${CRLF} `)
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

/** 'YYYY-MM-DD' becomes 'YYYYMMDD' for all-day events. */
function dateValue(iso: string): string {
  return iso.replace(/-/g, '')
}

interface Event {
  uid: string
  summary: string
  description?: string
  /** All-day: the ISO start, and the ISO of the day **after** it ends. */
  start: string
  end: string
  /** 'HH:MM' — when present the event is timed rather than all-day. */
  at?: string
  /** Length in hours, when there is a start time. */
  hours?: number
}

function renderEvent(e: Event, now: Date, tz: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`]

  if (e.at) {
    const [h, m] = e.at.split(':').map(Number)
    const start = parseISO(e.start)
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + Math.max(0.25, e.hours ?? 1) * 3_600_000)
    const local = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
        `T${p(d.getHours())}${p(d.getMinutes())}00`
    }
    lines.push(`DTSTART;TZID=${tz}:${local(start)}`, `DTEND;TZID=${tz}:${local(end)}`)
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${dateValue(e.start)}`,
      `DTEND;VALUE=DATE:${dateValue(e.end)}`,
    )
  }

  lines.push(`SUMMARY:${escape(e.summary)}`)
  if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`)
  lines.push('TRANSP:TRANSPARENT', 'END:VEVENT')
  return lines
}

/**
 * Everything about the term in one file: leave, duties, paydays, leave credits
 * and the discharge.
 */
export function buildIcs(
  profile: Profile, s: ServiceState, t: Dict, now: Date = new Date(),
): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Athens'
  const events: Event[] = []
  const c = t.calendarExport

  for (const l of profile.leaves ?? []) {
    events.push({
      uid: `${l.id}@army-apolele`,
      summary: `${c.leavePrefix}: ${t.leave.kinds[l.kind]}`,
      description: [l.note, t.leave.days(leaveDays(l))].filter(Boolean).join(' · '),
      start: l.from,
      end: toISO(addDays(parseISO(l.to), 1)),
    })
  }

  for (const d of profile.duties ?? []) {
    events.push({
      uid: `${d.id}@army-apolele`,
      summary: `${c.dutyPrefix}: ${t.duty.kinds[d.kind]}`,
      description: d.note,
      start: d.date,
      end: toISO(addDays(parseISO(d.date), 1)),
      at: d.start,
      hours: d.hours,
    })
  }

  for (let m = 1; m <= profile.months; m++) {
    const iso = toISO(addMonths(s.enlist, m))
    events.push({
      uid: `pay-${iso}@army-apolele`,
      summary: `${c.payTitle} · ${s.pay.perMonth}€`,
      start: iso,
      end: toISO(addDays(parseISO(iso), 1)),
    })
  }

  for (let k = 1; k <= Math.floor(profile.months / 2); k++) {
    const iso = toISO(addMonths(s.enlist, k * 2))
    events.push({
      uid: `accrual-${iso}@army-apolele`,
      summary: c.accrualTitle,
      start: iso,
      end: toISO(addDays(parseISO(iso), 1)),
    })
  }

  const dis = toISO(s.discharge)
  events.push({
    uid: `discharge-${dis}@army-apolele`,
    summary: c.dischargeTitle,
    description: c.dischargeBody,
    start: dis,
    end: toISO(addDays(s.discharge, 1)),
  })

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Army Apolele//EL//v1',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(c.calendarName)}`,
    `X-WR-TIMEZONE:${tz}`,
    ...events.flatMap((e) => renderEvent(e, now, tz)),
    'END:VCALENDAR',
  ]

  return lines.map(fold).join(CRLF) + CRLF
}

export function icsFilename(now: Date = new Date()): string {
  return `army-apolele-${toISO(now)}.ics`
}

export function downloadIcs(profile: Profile, s: ServiceState, t: Dict): void {
  const blob = new Blob([buildIcs(profile, s, t)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = icsFilename()
  a.click()
  // Revoked later: in Safari, revoking immediately cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
