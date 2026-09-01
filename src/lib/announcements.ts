/**
 * Announcements from the recruitment service.
 *
 * There are three steps, tried in this order:
 *
 *  1. **The file shipped with the build** (`/announcements.json`) — same
 *     origin, in the service-worker cache, works offline. Always there.
 *  2. **Whatever was cached locally** by an earlier refresh.
 *  3. **The live file** from raw.githubusercontent.com, which a GitHub Action
 *     updates daily. That is how a new notice arrives without a new deploy.
 *
 * The third step is the only request that leaves the device, happens only when
 * the section is opened, and its failure is invisible: the screen already has
 * content from the first two.
 *
 * Nothing about the user travels with the request — it is a static file, the
 * same for everyone.
 */

const BUNDLED_URL = '/announcements.json'
const LIVE_URL =
  'https://raw.githubusercontent.com/kotsarakos/ARMY-APOLELE/main/public/announcements.json'

const CACHE_KEY = 'army_app.news.cache.v1'
const SEEN_KEY = 'army_app.news.seen.v1'

export interface Announcement {
  id: string
  title: string
  summary: string
  link: string
  /** ISO 'YYYY-MM-DD'. Empty when the feed gave no valid date. */
  date: string
}

export interface AnnouncementFeed {
  source: string
  feed: string
  /** ISO timestamp of the last time the source was checked. */
  checkedAt: string
  items: Announcement[]
}

/** Accepts only the shape we expect — the network will hand back anything. */
function valid(data: unknown): data is AnnouncementFeed {
  if (typeof data !== 'object' || data === null) return false
  const f = data as Partial<AnnouncementFeed>
  if (typeof f.checkedAt !== 'string' || !Array.isArray(f.items)) return false
  return f.items.every((i) =>
    i && typeof i.id === 'string' && typeof i.title === 'string' &&
    typeof i.link === 'string' && i.link.startsWith('https://'))
}

async function get(url: string, timeoutMs: number): Promise<AnnouncementFeed | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const data: unknown = await res.json()
    return valid(data) ? data : null
  } catch {
    return null
  }
}

function readCache(): AnnouncementFeed | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    return valid(data) ? data : null
  } catch {
    return null
  }
}

function writeCache(feed: AnnouncementFeed): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(feed)) } catch { /* private browsing */ }
}

/** Between two versions, keep the one checked more recently. */
function newer(a: AnnouncementFeed | null, b: AnnouncementFeed | null): AnnouncementFeed | null {
  if (!a) return b
  if (!b) return a
  return b.checkedAt > a.checkedAt ? b : a
}

/**
 * Whatever is already on the device, with no outbound request.
 * `/announcements.json` is same-origin and served by the service worker, so
 * this works with no network at all.
 */
export async function localAnnouncements(): Promise<AnnouncementFeed | null> {
  return newer(readCache(), await get(BUNDLED_URL, 4000))
}

/**
 * Checks the source for something newer. Returns `null` when it found nothing
 * better than what we hold — the caller keeps what it had.
 */
export async function refreshAnnouncements(
  current: AnnouncementFeed | null,
): Promise<AnnouncementFeed | null> {
  const live = await get(LIVE_URL, 8000)
  if (!live) return null
  if (current && live.checkedAt <= current.checkedAt) return null
  writeCache(live)
  return live
}

/* ── What has already been read ───────────────────────────────────────────── */

/**
 * The service publishes a handful of times a year. The point is not to reread
 * a list every day — it is to notice the day something appears. So we keep the
 * date of the newest one already seen.
 */
export function lastSeen(): string {
  try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' }
}

export function markSeen(items: Announcement[]): void {
  const newest = items.reduce((max, i) => (i.date > max ? i.date : max), '')
  if (!newest) return
  try { localStorage.setItem(SEEN_KEY, newest) } catch { /* private browsing */ }
}

export function unreadCount(items: Announcement[], seen: string = lastSeen()): number {
  // With no previous visit nothing is "unread": we would otherwise flag the
  // entire back catalogue at everyone opening the app for the first time.
  if (!seen) return 0
  return items.filter((i) => i.date > seen).length
}

/** The recruitment service's personal area is never touched — see the README. */
export const OFFICIAL_LINKS = [
  { key: 'stratologia', url: 'https://www.stratologia.gr/' },
  { key: 'govgr', url: 'https://www.gov.gr/ipiresies/strateuse' },
  { key: 'army', url: 'https://army.gr/' },
] as const
