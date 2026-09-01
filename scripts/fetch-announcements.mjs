/**
 * Downloads the recruitment service's announcements into a static JSON file.
 *
 * It runs in a GitHub Action rather than the browser, for two reasons:
 *
 *  1. The feed sends no `Access-Control-Allow-Origin`, so a browser is not
 *     allowed to read it directly.
 *  2. The app is local-first. A server doing the same would mean every opening
 *     of the app passes through somewhere; here the result is a file, the same
 *     for everyone, with no per-user request.
 *
 * The result is written to `public/announcements.json`, so it travels with the
 * build and works offline. The same file is served from
 * raw.githubusercontent.com, which the app uses to refresh without a new
 * deploy — see src/lib/announcements.ts.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FEED = 'https://www.stratologia.gr/rss.xml'
const SITE = 'https://www.stratologia.gr/'
const OUT = new URL('../public/announcements.json', import.meta.url)

/** How many to keep. The service publishes a handful of times a year. */
const MAX_ITEMS = 8
const MAX_SUMMARY = 220

/**
 * The site runs Drupal with THEME DEBUG left on, so it prints HTML comments
 * **before** the `<?xml` declaration. That makes the feed invalid XML and any
 * strict parser refuses it. Everything before the declaration is cut.
 */
function cleanXml(raw) {
  const start = raw.indexOf('<?xml')
  return start > 0 ? raw.slice(start) : raw
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
}

function decodeOnce(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

/**
 * The feed is double-encoded: `&amp;nbsp;` becomes `&nbsp;` on the first pass
 * and a space only on the second. Two passes are enough, and cannot loop.
 */
function decode(text) {
  const once = decodeOnce(text)
  return once === text ? once : decodeOnce(once)
}

/**
 * The text of one element, cleaned of CDATA, comments and HTML.
 *
 * The **order matters**: `<description>` holds its HTML encoded
 * (`&lt;!-- ... --&gt;`), so stripping comments first finds nothing — and then
 * decoding brings them back as visible prose. Decode first, clean afterwards.
 *
 * Without this, every announcement's summary was Drupal's THEME DEBUG output:
 * lists of twig files from their own site.
 */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  const unwrapped = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return decode(unwrapped)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Drupal does not render a summary — it renders the whole node. So
 * `<description>` opens with the title again, the author's username and a
 * timestamp, and only then the text:
 *
 *   "Νέος Νόμος... rodopoulou.g Τετ, 01/14/2026 - 08:07 Δημοσιεύτηκε ο Νόμος..."
 *
 * The timestamp is the most reliable marker of where the substance begins.
 */
function stripDrupalByline(text, title) {
  const stamp = text.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}:\d{2}\s*/)
  if (stamp) return text.slice(stamp.index + stamp[0].length).trim()
  // With no timestamp, at least do not repeat the title.
  return text.startsWith(title) ? text.slice(title.length).trim() : text
}

function shorten(text, max) {
  if (text.length <= max) return text
  // Cut on a word boundary, so no half word is left before the ellipsis.
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** 'Wed, 14 Jan 2026 10:00:00 +0200' becomes '2026-01-14'. Empty if unreadable. */
function isoDate(pubDate) {
  const d = new Date(pubDate)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map(([, block]) => {
      const link = tag(block, 'link')
      const title = tag(block, 'title')
      const body = stripDrupalByline(tag(block, 'description'), title)
      return {
        // The link is stable per announcement and makes a good key; if it is
        // missing we fall back to the title so the entry is not lost.
        id: link || title,
        title,
        summary: shorten(body, MAX_SUMMARY),
        link,
        date: isoDate(tag(block, 'pubDate')),
      }
    })
    .filter((i) => i.title && i.link)
    .slice(0, MAX_ITEMS)
}

async function main() {
  const res = await fetch(FEED, {
    headers: { Accept: 'application/rss+xml, application/xml;q=0.9' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`${FEED} → HTTP ${res.status}`)

  const items = parseFeed(cleanXml(await res.text()))
  if (items.length === 0) throw new Error('το feed διαβάστηκε αλλά δεν είχε καμία ανακοίνωση')

  const next = { source: SITE, feed: FEED, checkedAt: new Date().toISOString(), items }

  // `checkedAt` changes on every run. Comparing the whole file would mean a
  // commit every day with nothing of substance changed.
  const changed = !existsSync(OUT) ||
    JSON.stringify(JSON.parse(readFileSync(OUT, 'utf8')).items) !== JSON.stringify(items)

  if (!changed) {
    console.log(`καμία αλλαγή — ${items.length} ανακοινώσεις, η νεότερη ${items[0].date}`)
    return
  }

  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(`γράφτηκαν ${items.length} ανακοινώσεις, η νεότερη ${items[0].date}`)
  for (const i of items) console.log(`  · ${i.date}  ${i.title.slice(0, 70)}`)
}

/**
 * Runs the parser against a saved copy of the real feed.
 *
 * The point is not to see whether the site answers — the Action itself shows
 * that. It is to lock in the quirks already found: comments before the XML
 * declaration, HTML double-encoded inside the description, and Drupal's byline
 * in front of the text. If any of them breaks, nothing crashes — the app just
 * fills up with rubbish.
 */
function selfTest() {
  const fixture = new URL('../tests/fixtures/stratologia-rss.xml', import.meta.url)
  let fails = 0
  const check = (label, ok, extra = '') => {
    if (!ok) fails++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`)
  }

  const raw = readFileSync(fixture, 'utf8')
  check('το fixture κρατά το ελάττωμα που διορθώνουμε',
    raw.indexOf('THEME DEBUG') < raw.indexOf('<?xml'))

  const items = parseFeed(cleanXml(raw))
  check('διαβάστηκαν ανακοινώσεις', items.length === 2, String(items.length))

  for (const i of items) {
    check(`«${i.title.slice(0, 32)}…» έχει σύνδεσμο https`, i.link.startsWith('https://'))
    check('  ημερομηνία σε ISO', /^\d{4}-\d{2}-\d{2}$/.test(i.date), i.date)
    check('  καμία ετικέτα HTML στην περίληψη', !/[<>]/.test(i.summary))
    check('  κανένα σχόλιο THEME DEBUG', !i.summary.includes('THEME DEBUG'))
    check('  καμία διαδρομή twig', !i.summary.includes('.twig'))
    check('  καμία υπολειπόμενη οντότητα', !/&[a-z]+;|&#\d+;/i.test(i.summary))
    check('  δεν επαναλαμβάνει τον τίτλο', !i.summary.startsWith(i.title.slice(0, 25)))
    check('  δεν κρατά το byline του συντάκτη',
      !/\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}:\d{2}/.test(i.summary))
    check('  η περίληψη έχει περιεχόμενο', i.summary.length > 40, String(i.summary.length))
    check(`  δεν ξεπερνά τους ${MAX_SUMMARY} χαρακτήρες`, i.summary.length <= MAX_SUMMARY + 1)
  }

  console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
  process.exit(fails ? 1 : 0)
}

const invoked = process.argv[1] && import.meta.url === new URL(`file://${fileURLToPath(import.meta.url)}`).href

if (process.argv.includes('--selftest')) selfTest()
else if (invoked) {
  main().catch((err) => {
    console.error('απέτυχε:', err.message)
    process.exit(1)
  })
}
