/**
 * Ανακοινώσεις της Στρατολογίας.
 *
 * Η ροή έχει τρία σκαλοπάτια, με αυτή τη σειρά:
 *
 *  1. **Το αρχείο του build** (`/announcements.json`) — ίδιας προέλευσης, στην
 *     cache του service worker, δουλεύει offline. Είναι πάντα εκεί.
 *  2. **Ό,τι έχει κρατηθεί τοπικά** από προηγούμενο φρεσκάρισμα.
 *  3. **Το ζωντανό αρχείο** από το raw.githubusercontent.com, που το ενημερώνει
 *     ένα GitHub Action κάθε μέρα. Έτσι μια νέα ανακοίνωση φτάνει χωρίς νέο
 *     deploy.
 *
 * Το τρίτο βήμα είναι το μόνο αίτημα που βγαίνει έξω, γίνεται μόνο όταν
 * ανοίξει η ενότητα, και η αποτυχία του δεν φαίνεται πουθενά: η οθόνη έχει ήδη
 * περιεχόμενο από τα δύο πρώτα.
 *
 * Καμία πληροφορία του χρήστη δεν συνοδεύει το αίτημα — είναι ένα στατικό
 * αρχείο, ίδιο για όλους.
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
  /** ISO 'YYYY-MM-DD'. Κενό αν το feed δεν έδωσε έγκυρη ημερομηνία. */
  date: string
}

export interface AnnouncementFeed {
  source: string
  feed: string
  /** ISO timestamp της τελευταίας φοράς που ελέγχθηκε η πηγή. */
  checkedAt: string
  items: Announcement[]
}

/** Δέχεται μόνο ό,τι έχει το σχήμα που περιμένουμε — το δίκτυο δίνει ό,τι να 'ναι. */
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
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(feed)) } catch { /* ιδιωτική περιήγηση */ }
}

/** Από δύο εκδόσεις κρατάμε αυτή που ελέγχθηκε πιο πρόσφατα. */
function newer(a: AnnouncementFeed | null, b: AnnouncementFeed | null): AnnouncementFeed | null {
  if (!a) return b
  if (!b) return a
  return b.checkedAt > a.checkedAt ? b : a
}

/**
 * Ό,τι υπάρχει ήδη στη συσκευή, χωρίς κανένα αίτημα προς τα έξω.
 * Το `/announcements.json` είναι ίδιας προέλευσης και το σερβίρει ο service
 * worker, οπότε αυτό δουλεύει και χωρίς δίκτυο.
 */
export async function localAnnouncements(): Promise<AnnouncementFeed | null> {
  return newer(readCache(), await get(BUNDLED_URL, 4000))
}

/**
 * Ελέγχει την πηγή για κάτι νεότερο. Επιστρέφει `null` αν δεν βρήκε τίποτα
 * καλύτερο από αυτό που ήδη έχουμε — ο καλών κρατά ό,τι είχε.
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

/* ── Τι έχει ήδη διαβαστεί ────────────────────────────────────────────────── */

/**
 * Η υπηρεσία δημοσιεύει λίγες φορές τον χρόνο. Το ζητούμενο δεν είναι να
 * διαβάζεις μια λίστα κάθε μέρα — είναι να καταλάβεις τη μέρα που εμφανίστηκε
 * κάτι. Γι' αυτό κρατάμε την ημερομηνία της νεότερης που έχει ήδη ιδωθεί.
 */
export function lastSeen(): string {
  try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' }
}

export function markSeen(items: Announcement[]): void {
  const newest = items.reduce((max, i) => (i.date > max ? i.date : max), '')
  if (!newest) return
  try { localStorage.setItem(SEEN_KEY, newest) } catch { /* ιδιωτική περιήγηση */ }
}

export function unreadCount(items: Announcement[], seen: string = lastSeen()): number {
  // Χωρίς προηγούμενη επίσκεψη δεν είναι «αδιάβαστες»: θα σημαιοδοτούσαμε
  // ολόκληρο το ιστορικό στον καθένα που ανοίγει την εφαρμογή πρώτη φορά.
  if (!seen) return 0
  return items.filter((i) => i.date > seen).length
}

/** Τα προσωπικά δεδομένα της στρατολογίας δεν αγγίζονται ποτέ — δες README. */
export const OFFICIAL_LINKS = [
  { key: 'stratologia', url: 'https://www.stratologia.gr/' },
  { key: 'govgr', url: 'https://www.gov.gr/ipiresies/strateuse' },
  { key: 'army', url: 'https://army.gr/' },
] as const
